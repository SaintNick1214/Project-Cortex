"""
Cortex SDK - Conversations API

Layer 1a: ACID-compliant immutable conversation storage
"""

import random
import string
import time
from typing import Any, Dict, List, Literal, Optional, cast

from .._utils import convert_convex_response, filter_none_values
from ..errors import CortexError, ErrorCode  # noqa: F401
from ..types import (
    AddMessageInput,
    AddMessageOptions,
    Conversation,
    ConversationSearchResult,
    ConversationType,
    CreateConversationInput,
    CreateConversationOptions,
    DeleteConversationOptions,
    ExportResult,
    Message,
)
from .validators import (
    ConversationValidationError,
    validate_conversation_type,
    validate_export_format,
    validate_id_format,
    validate_limit,
    validate_message_role,
    validate_no_duplicates,
    validate_non_empty_list,
    validate_offset,
    validate_participants,
    validate_required_string,
    validate_search_query,
    validate_sort_order,
    validate_timestamp_range,
)


class ConversationsAPI:
    """
    Conversations API - Layer 1a

    Manages immutable conversation threads that serve as the ACID source of truth
    for all message history.
    """

    def __init__(
        self,
        client: Any,
        graph_adapter: Optional[Any] = None,
        resilience: Optional[Any] = None,
    ) -> None:
        """
        Initialize Conversations API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter for sync
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

    async def create(
        self,
        input: CreateConversationInput,
        options: Optional[CreateConversationOptions] = None,
    ) -> Conversation:
        """
        Create a new conversation.

        Args:
            input: Conversation creation parameters
            options: Optional creation options (e.g., syncToGraph)

        Returns:
            Created conversation

        Example:
            >>> conversation = await cortex.conversations.create(
            ...     CreateConversationInput(
            ...         memory_space_id='user-123-personal',
            ...         type='user-agent',
            ...         participants=ConversationParticipants(
            ...             user_id='user-123',
            ...             participant_id='my-bot'
            ...         )
            ...     )
            ... )
        """
        # Validate required fields
        validate_required_string(input.memory_space_id, "memory_space_id")
        validate_conversation_type(input.type)

        # Validate optional conversation_id format
        validate_id_format(
            input.conversation_id if hasattr(input, "conversation_id") else None,
            "conversation",
            "conversation_id",
        )

        # Validate participants based on type
        validate_participants(input.type, input.participants)

        # For agent-agent, validate no duplicate memory_space_ids
        if input.type == "agent-agent":
            memory_space_ids = None
            if hasattr(input.participants, "memory_space_ids"):
                memory_space_ids = input.participants.memory_space_ids
            elif isinstance(input.participants, dict):
                memory_space_ids = input.participants.get(
                    "memorySpaceIds"
                ) or input.participants.get("memory_space_ids")

            if memory_space_ids:
                validate_no_duplicates(
                    memory_space_ids, "participants.memory_space_ids"
                )

        # Auto-generate conversation ID if not provided
        conversation_id = input.conversation_id or self._generate_conversation_id()

        result = await self.client.mutation(
            "conversations:create",
            filter_none_values({
                "conversationId": conversation_id,
                "memorySpaceId": input.memory_space_id,
                "participantId": input.participant_id,
                "type": input.type,
                "participants": filter_none_values({
                    "userId": input.participants.get("userId") if isinstance(input.participants, dict) else getattr(input.participants, "user_id", None),
                    "agentId": input.participants.get("agentId") if isinstance(input.participants, dict) else getattr(input.participants, "agent_id", None),
                    "participantId": input.participants.get("participantId") if isinstance(input.participants, dict) else getattr(input.participants, "participant_id", None),
                    "memorySpaceIds": input.participants.get("memorySpaceIds") if isinstance(input.participants, dict) else getattr(input.participants, "memory_space_ids", None),
                }),
                "metadata": input.metadata,
            }),
        )

        # Sync to graph if requested
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import (
                    sync_conversation_relationships,
                    sync_conversation_to_graph,
                )

                node_id = await sync_conversation_to_graph(result, self.graph_adapter)
                await sync_conversation_relationships(result, node_id, self.graph_adapter)
            except Exception as error:
                print(f"Warning: Failed to sync conversation to graph: {error}")

        return Conversation(**convert_convex_response(result))

    async def get(self, conversation_id: str) -> Optional[Conversation]:
        """
        Get a conversation by ID.

        Args:
            conversation_id: The conversation ID to retrieve

        Returns:
            Conversation if found, None otherwise

        Example:
            >>> conversation = await cortex.conversations.get('conv-abc123')
        """
        validate_required_string(conversation_id, "conversation_id")

        result = await self.client.query(
            "conversations:get", {"conversationId": conversation_id}
        )

        if not result:
            return None

        return Conversation(**convert_convex_response(result))

    async def add_message(
        self, input: AddMessageInput, options: Optional[AddMessageOptions] = None
    ) -> Conversation:
        """
        Add a message to a conversation.

        Args:
            input: Message input parameters
            options: Optional message options (e.g., syncToGraph)

        Returns:
            Updated conversation

        Example:
            >>> conversation = await cortex.conversations.add_message(
            ...     AddMessageInput(
            ...         conversation_id='conv-abc123',
            ...         role='user',
            ...         content='Hello!',
            ...     )
            ... )
        """
        validate_required_string(input.conversation_id, "conversation_id")
        validate_required_string(input.content, "content")
        validate_message_role(input.role)

        # Auto-generate message ID
        message_id = self._generate_message_id()

        result = await self.client.mutation(
            "conversations:addMessage",
            filter_none_values({
                "conversationId": input.conversation_id,
                "message": filter_none_values({
                    "id": message_id,
                    "role": input.role,
                    "content": input.content,
                    "participantId": input.participant_id,
                    "metadata": input.metadata,
                }),
            }),
        )

        # Update in graph if requested
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                nodes = await self.graph_adapter.find_nodes(
                    "Conversation", {"conversationId": input.conversation_id}, 1
                )
                if nodes:
                    await self.graph_adapter.update_node(
                        nodes[0].id,
                        {
                            "messageCount": result["messageCount"],
                            "updatedAt": result["updatedAt"],
                        }, # type: ignore[arg-type]
                    )
            except Exception as error:
                print(f"Warning: Failed to update conversation in graph: {error}")

        return Conversation(**convert_convex_response(result))

    async def list(
        self,
        type: Optional[ConversationType] = None,
        user_id: Optional[str] = None,
        memory_space_id: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Conversation]:
        """
        List conversations with optional filters.

        Args:
            type: Filter by conversation type
            user_id: Filter by user ID
            memory_space_id: Filter by memory space
            limit: Maximum number of results

        Returns:
            List of conversations

        Example:
            >>> conversations = await cortex.conversations.list(
            ...     user_id='user-123',
            ...     limit=10
            ... )
        """
        # All fields optional, validate only if provided
        if type is not None:
            validate_conversation_type(type)
        if limit is not None:
            validate_limit(limit)

        result = await self.client.query(
            "conversations:list",
            filter_none_values({
                "type": type,
                "userId": user_id,
                "memorySpaceId": memory_space_id,
                "limit": limit,
            }),
        )

        return [Conversation(**convert_convex_response(conv)) for conv in result]

    async def count(
        self,
        type: Optional[ConversationType] = None,
        user_id: Optional[str] = None,
        memory_space_id: Optional[str] = None,
    ) -> int:
        """
        Count conversations.

        Args:
            type: Filter by conversation type
            user_id: Filter by user ID
            memory_space_id: Filter by memory space

        Returns:
            Count of matching conversations

        Example:
            >>> count = await cortex.conversations.count(
            ...     memory_space_id='user-123-personal'
            ... )
        """
        if type is not None:
            validate_conversation_type(type)

        result = await self.client.query(
            "conversations:count",
            filter_none_values({
                "type": type,
                "userId": user_id,
                "memorySpaceId": memory_space_id,
            }),
        )

        return int(result)

    async def delete(
        self, conversation_id: str, options: Optional[DeleteConversationOptions] = None
    ) -> Dict[str, bool]:
        """
        Delete a conversation (for GDPR/cleanup).

        Args:
            conversation_id: The conversation to delete
            options: Optional deletion options (e.g., syncToGraph)

        Returns:
            Deletion result

        Example:
            >>> await cortex.conversations.delete('conv-abc123')
        """
        validate_required_string(conversation_id, "conversation_id")

        result = await self.client.mutation(
            "conversations:deleteConversation", filter_none_values({"conversationId": conversation_id})
        )

        # Delete from graph
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import delete_conversation_from_graph

                await delete_conversation_from_graph(
                    conversation_id, self.graph_adapter, True
                )
            except Exception as error:
                print(f"Warning: Failed to delete conversation from graph: {error}")

        return cast(Dict[str, bool], result)

    async def delete_many(
        self,
        user_id: Optional[str] = None,
        memory_space_id: Optional[str] = None,
        type: Optional[ConversationType] = None,
    ) -> Dict[str, Any]:
        """
        Delete many conversations matching filters.

        Args:
            user_id: Filter by user ID
            memory_space_id: Filter by memory space
            type: Filter by conversation type

        Returns:
            Deletion result with counts

        Example:
            >>> result = await cortex.conversations.delete_many(
            ...     memory_space_id='user-123-personal',
            ...     user_id='user-123'
            ... )
        """
        # Validate type if provided
        if type is not None:
            validate_conversation_type(type)

        # Ensure at least one filter is provided
        if user_id is None and memory_space_id is None and type is None:
            raise ConversationValidationError(
                "delete_many requires at least one filter (user_id, memory_space_id, or type)",
                "MISSING_REQUIRED_FIELD",
            )

        result = await self.client.mutation(
            "conversations:deleteMany",
            filter_none_values({
                "userId": user_id,
                "memorySpaceId": memory_space_id,
                "type": type,
            }),
        )

        return cast(Dict[str, Any], result)

    async def get_message(
        self, conversation_id: str, message_id: str
    ) -> Optional[Message]:
        """
        Get a specific message by ID.

        Args:
            conversation_id: The conversation ID
            message_id: The message ID

        Returns:
            Message if found, None otherwise

        Example:
            >>> message = await cortex.conversations.get_message('conv-123', 'msg-456')
        """
        validate_required_string(conversation_id, "conversation_id")
        validate_required_string(message_id, "message_id")

        result = await self.client.query(
            "conversations:getMessage",
            filter_none_values({"conversationId": conversation_id, "messageId": message_id}),
        )

        if not result:
            return None

        return Message(**convert_convex_response(result))

    async def get_messages_by_ids(
        self, conversation_id: str, message_ids: List[str]
    ) -> List[Message]:
        """
        Get multiple messages by their IDs.

        Args:
            conversation_id: The conversation ID
            message_ids: List of message IDs to retrieve

        Returns:
            List of messages

        Example:
            >>> messages = await cortex.conversations.get_messages_by_ids(
            ...     'conv-123', ['msg-1', 'msg-2']
            ... )
        """
        validate_required_string(conversation_id, "conversation_id")
        validate_non_empty_list(message_ids, "message_ids")
        validate_no_duplicates(message_ids, "message_ids")

        result = await self.client.query(
            "conversations:getMessagesByIds",
            filter_none_values({"conversationId": conversation_id, "messageIds": message_ids}),
        )

        return [Message(**convert_convex_response(msg)) for msg in result]

    async def find_conversation(
        self,
        memory_space_id: str,
        type: ConversationType,
        user_id: Optional[str] = None,
        memory_space_ids: Optional[List[str]] = None,
    ) -> Optional[Conversation]:
        """
        Find an existing conversation by participants.

        Args:
            memory_space_id: Memory space ID
            type: Conversation type
            user_id: User ID (for user-agent conversations)
            memory_space_ids: Memory space IDs (for agent-agent conversations)

        Returns:
            Conversation if found, None otherwise

        Example:
            >>> existing = await cortex.conversations.find_conversation(
            ...     memory_space_id='user-123-personal',
            ...     type='user-agent',
            ...     user_id='user-123'
            ... )
        """
        validate_required_string(memory_space_id, "memory_space_id")
        validate_conversation_type(type)

        # Validate based on type
        if type == "user-agent" and user_id is None:
            raise ConversationValidationError(
                "user_id is required for user-agent conversation search",
                "MISSING_REQUIRED_FIELD",
                "user_id",
            )

        if type == "agent-agent":
            if not memory_space_ids or not isinstance(memory_space_ids, list) or len(memory_space_ids) < 2:
                raise ConversationValidationError(
                    "agent-agent conversations require at least 2 memory_space_ids",
                    "INVALID_ARRAY_LENGTH",
                    "memory_space_ids",
                )
            validate_no_duplicates(memory_space_ids, "memory_space_ids")

        result = await self.client.query(
            "conversations:findConversation",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "type": type,
                "userId": user_id,
                "memorySpaceIds": memory_space_ids,
            }),
        )

        if not result:
            return None

        return Conversation(**convert_convex_response(result))

    async def get_or_create(self, input: CreateConversationInput) -> Conversation:
        """
        Get or create a conversation (atomic).

        Args:
            input: Conversation creation parameters

        Returns:
            Existing or newly created conversation

        Example:
            >>> conversation = await cortex.conversations.get_or_create(
            ...     CreateConversationInput(
            ...         memory_space_id='user-123-personal',
            ...         type='user-agent',
            ...         participants=ConversationParticipants(
            ...             user_id='user-123',
            ...             participant_id='my-bot'
            ...         )
            ...     )
            ... )
        """
        # Same validation as create()
        validate_required_string(input.memory_space_id, "memory_space_id")
        validate_conversation_type(input.type)
        validate_participants(input.type, input.participants)

        if input.type == "agent-agent":
            memory_space_ids = None
            if hasattr(input.participants, "memory_space_ids"):
                memory_space_ids = input.participants.memory_space_ids
            elif isinstance(input.participants, dict):
                memory_space_ids = input.participants.get(
                    "memorySpaceIds"
                ) or input.participants.get("memory_space_ids")

            if memory_space_ids:
                validate_no_duplicates(
                    memory_space_ids, "participants.memory_space_ids"
                )

        result = await self.client.mutation(
            "conversations:getOrCreate",
            filter_none_values({
                "memorySpaceId": input.memory_space_id,
                "participantId": input.participant_id,
                "type": input.type,
                "participants": filter_none_values({
                    "userId": input.participants.get("userId") if isinstance(input.participants, dict) else getattr(input.participants, "user_id", None),
                    "agentId": input.participants.get("agentId") if isinstance(input.participants, dict) else getattr(input.participants, "agent_id", None),
                    "participantId": input.participants.get("participantId") if isinstance(input.participants, dict) else getattr(input.participants, "participant_id", None),
                    "memorySpaceIds": input.participants.get("memorySpaceIds") if isinstance(input.participants, dict) else getattr(input.participants, "memory_space_ids", None),
                }),
                "metadata": input.metadata,
            }),
        )

        return Conversation(**convert_convex_response(result))

    async def get_history(
        self,
        conversation_id: str,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        sort_order: Optional[Literal["asc", "desc"]] = None,
    ) -> Dict[str, Any]:
        """
        Get paginated message history from a conversation.

        Args:
            conversation_id: The conversation ID
            limit: Maximum messages to return
            offset: Number of messages to skip
            sort_order: Sort order (asc or desc)

        Returns:
            History with messages and pagination info

        Example:
            >>> history = await cortex.conversations.get_history(
            ...     'conv-abc123',
            ...     limit=20,
            ...     offset=0,
            ...     sort_order='desc'
            ... )
        """
        validate_required_string(conversation_id, "conversation_id")

        if limit is not None:
            validate_limit(limit)
        if offset is not None:
            validate_offset(offset)
        if sort_order is not None:
            validate_sort_order(sort_order)

        result = await self.client.query(
            "conversations:getHistory",
            filter_none_values({
                "conversationId": conversation_id,
                "limit": limit,
                # Note: offset not supported by backend yet
                "sortOrder": sort_order,
            }),
        )

        # Convert messages to Message objects
        result["messages"] = [Message(**convert_convex_response(msg)) for msg in result.get("messages", [])]
        return cast(Dict[str, Any], result)

    async def search(
        self,
        query: str,
        type: Optional[ConversationType] = None,
        user_id: Optional[str] = None,
        memory_space_id: Optional[str] = None,
        date_start: Optional[int] = None,
        date_end: Optional[int] = None,
        limit: Optional[int] = None,
    ) -> List[ConversationSearchResult]:
        """
        Search conversations by text query.

        Args:
            query: Search query string
            type: Filter by conversation type
            user_id: Filter by user ID
            memory_space_id: Filter by memory space
            date_start: Filter by start date (timestamp)
            date_end: Filter by end date (timestamp)
            limit: Maximum results

        Returns:
            List of search results

        Example:
            >>> results = await cortex.conversations.search(
            ...     'password',
            ...     user_id='user-123',
            ...     limit=5
            ... )
        """
        validate_search_query(query)

        if type is not None:
            validate_conversation_type(type)
        if limit is not None:
            validate_limit(limit)

        # Validate date range
        validate_timestamp_range(date_start, date_end)

        result = await self.client.query(
            "conversations:search",
            filter_none_values({
                "query": query,
                "type": type,
                "userId": user_id,
                "memorySpaceId": memory_space_id,
                "dateStart": date_start,
                "dateEnd": date_end,
                "limit": limit,
            }),
        )

        return [ConversationSearchResult(**convert_convex_response(item)) for item in result]

    async def export(
        self,
        format: Literal["json", "csv"],
        user_id: Optional[str] = None,
        memory_space_id: Optional[str] = None,
        conversation_ids: Optional[List[str]] = None,
        type: Optional[ConversationType] = None,
        date_start: Optional[int] = None,
        date_end: Optional[int] = None,
        include_metadata: bool = True,
    ) -> ExportResult:
        """
        Export conversations to JSON or CSV.

        Args:
            format: Export format ('json' or 'csv')
            user_id: Filter by user ID
            memory_space_id: Filter by memory space
            conversation_ids: Specific conversation IDs to export
            type: Filter by conversation type
            date_start: Filter by start date
            date_end: Filter by end date
            include_metadata: Include metadata in export

        Returns:
            Export result with data

        Example:
            >>> exported = await cortex.conversations.export(
            ...     format='json',
            ...     memory_space_id='user-123-personal',
            ...     user_id='user-123',
            ...     include_metadata=True
            ... )
        """
        validate_export_format(format)

        if type is not None:
            validate_conversation_type(type)
        if conversation_ids is not None:
            validate_non_empty_list(conversation_ids, "conversation_ids")

        # Validate date range
        validate_timestamp_range(date_start, date_end)

        result = await self.client.query(
            "conversations:exportConversations",
            filter_none_values({
                "userId": user_id,
                "memorySpaceId": memory_space_id,
                "conversationIds": conversation_ids,
                "type": type,
                "dateStart": date_start,
                "dateEnd": date_end,
                "format": format,
                "includeMetadata": include_metadata,
            }),
        )

        return ExportResult(**convert_convex_response(result))

    # Helper methods

    def _generate_conversation_id(self) -> str:
        """Generate a unique conversation ID."""
        return f"conv-{self._generate_id()}"

    def _generate_message_id(self) -> str:
        """Generate a unique message ID."""
        return f"msg-{self._generate_id()}"

    def _generate_id(self) -> str:
        """Generate a unique ID component."""
        timestamp = int(time.time() * 1000)
        random_part = "".join(random.choices(string.ascii_lowercase + string.digits, k=9))
        return f"{timestamp}-{random_part}"


# Export validation error for users who want to catch it specifically
__all__ = ["ConversationsAPI", "ConversationValidationError"]

