"""
Cortex SDK - A2A Communication API

Agent-to-agent communication helpers with optional pub/sub support
"""

from typing import Any, Dict, List, Optional, cast

from .._utils import convert_convex_response, filter_none_values  # noqa: F401
from ..errors import A2ATimeoutError, CortexError, ErrorCode  # noqa: F401
from ..types import (
    A2ABroadcastParams,
    A2ABroadcastResult,
    A2AMessage,
    A2ARequestParams,
    A2AResponse,
    A2ASendParams,
)
from .validators import (
    A2AValidationError,
    validate_agent_id,
    validate_broadcast_params,
    validate_conversation_filters,
    validate_request_params,
    validate_send_params,
)

# Re-export for convenience
__all__ = ["A2AAPI", "A2AValidationError"]


class A2AAPI:
    """
    A2A Communication API

    Provides convenience helpers for inter-agent communication. This is syntactic
    sugar over the standard memory system with source.type='a2a'.
    """

    def __init__(
        self,
        client: Any,
        graph_adapter: Optional[Any] = None,
        resilience: Optional[Any] = None,
    ) -> None:
        """
        Initialize A2A API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter
            resilience: Optional resilience layer for overload protection
        """
        self.client = client
        self.graph_adapter = graph_adapter
        self._resilience = resilience

    async def _execute_with_resilience(
        self, operation: Any, operation_name: str
    ) -> Any:
        """Execute an operation through the resilience layer (if available)."""
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

    async def send(self, params: A2ASendParams) -> A2AMessage:
        """
        Send a message from one agent to another.

        Stores in ACID conversation + both agents' Vector memories.
        No pub/sub required - this is fire-and-forget.

        Args:
            params: Send parameters

        Returns:
            A2A message result

        Raises:
            A2AValidationError: If validation fails

        Example:
            >>> result = await cortex.a2a.send(
            ...     A2ASendParams(
            ...         from_agent='sales-agent',
            ...         to_agent='support-agent',
            ...         message='Customer asking about enterprise pricing',
            ...         importance=70
            ...     )
            ... )
        """
        # Client-side validation
        validate_send_params(params)

        result = await self.client.mutation(
            "a2a:send",
            filter_none_values({
                "from": params.from_agent,
                "to": params.to_agent,
                "message": params.message,
                "userId": params.user_id,
                "contextId": params.context_id,
                "importance": params.importance,
                "trackConversation": params.track_conversation,
                "autoEmbed": params.auto_embed,
                "metadata": params.metadata,
            }),
        )

        return A2AMessage(**convert_convex_response(result))

    async def request(self, params: A2ARequestParams) -> A2AResponse:
        """
        Send a request and wait for response (synchronous request-response).

        REQUIRES PUB/SUB INFRASTRUCTURE:
        - Direct Mode: Configure your own Redis/RabbitMQ/NATS adapter
        - Cloud Mode: Pub/sub infrastructure included automatically

        Args:
            params: Request parameters

        Returns:
            A2A response

        Raises:
            A2AValidationError: If validation fails
            A2ATimeoutError: If no response within timeout
            CortexError: If pub/sub not configured

        Example:
            >>> try:
            ...     response = await cortex.a2a.request(
            ...         A2ARequestParams(
            ...             from_agent='finance-agent',
            ...             to_agent='hr-agent',
            ...             message='What is the Q4 budget?',
            ...             timeout=30000
            ...         )
            ...     )
            ...     print(response.response)
            ... except A2ATimeoutError:
            ...     print("No response received")
        """
        # Client-side validation
        validate_request_params(params)

        result = await self.client.mutation(
            "a2a:request",
            filter_none_values({
                "from": params.from_agent,
                "to": params.to_agent,
                "message": params.message,
                "timeout": params.timeout,
                "retries": params.retries,
                "userId": params.user_id,
                "contextId": params.context_id,
                "importance": params.importance,
            }),
        )

        if result.get("timeout"):
            raise A2ATimeoutError(
                f"Request to {params.to_agent} timed out after {params.timeout}ms",
                result["messageId"],
                params.timeout,
            )

        return A2AResponse(**convert_convex_response(result))

    async def broadcast(self, params: A2ABroadcastParams) -> A2ABroadcastResult:
        """
        Send one message to multiple agents efficiently.

        REQUIRES PUB/SUB for optimized delivery.

        Args:
            params: Broadcast parameters

        Returns:
            Broadcast result

        Raises:
            A2AValidationError: If validation fails

        Example:
            >>> result = await cortex.a2a.broadcast(
            ...     A2ABroadcastParams(
            ...         from_agent='manager-agent',
            ...         to_agents=['dev-agent-1', 'dev-agent-2', 'qa-agent'],
            ...         message='Sprint review meeting Friday at 2 PM',
            ...         importance=70
            ...     )
            ... )
        """
        # Client-side validation
        validate_broadcast_params(params)

        result = await self.client.mutation(
            "a2a:broadcast",
            filter_none_values({
                "from": params.from_agent,
                "to": params.to_agents,
                "message": params.message,
                "userId": params.user_id,
                "contextId": params.context_id,
                "importance": params.importance,
                "trackConversation": params.track_conversation,
                "metadata": params.metadata,
            }),
        )

        return A2ABroadcastResult(**convert_convex_response(result))

    async def get_conversation(
        self,
        agent1: str,
        agent2: str,
        since: Optional[int] = None,
        until: Optional[int] = None,
        min_importance: Optional[int] = None,
        tags: Optional[List[str]] = None,
        user_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Get chronological conversation between two agents.

        Args:
            agent1: First agent ID
            agent2: Second agent ID
            since: Filter by start date (timestamp)
            until: Filter by end date (timestamp)
            min_importance: Minimum importance filter
            tags: Filter by tags
            user_id: Filter A2A about specific user
            limit: Maximum messages
            offset: Pagination offset

        Returns:
            A2A conversation with messages

        Raises:
            A2AValidationError: If validation fails

        Example:
            >>> convo = await cortex.a2a.get_conversation(
            ...     'finance-agent', 'hr-agent',
            ...     since=start_timestamp,
            ...     min_importance=70,
            ...     tags=['budget']
            ... )
        """
        # Client-side validation
        validate_agent_id(agent1, "agent1")
        validate_agent_id(agent2, "agent2")
        validate_conversation_filters(
            since=since,
            until=until,
            min_importance=min_importance,
            limit=limit,
            offset=offset,
        )

        result = await self.client.query(
            "a2a:getConversation",
            filter_none_values({
                "agent1": agent1,
                "agent2": agent2,
                "since": since,
                "until": until,
                "minImportance": min_importance,
                "tags": tags,
                "userId": user_id,
                "limit": limit,
                "offset": offset,
            }),
        )

        return cast(Dict[str, Any], result)

