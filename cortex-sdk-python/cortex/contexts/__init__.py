"""
Cortex SDK - Contexts API

Coordination Layer: Context chain management for multi-agent workflow coordination
"""

from typing import Any, Dict, List, Optional, Union, cast

from .._utils import convert_convex_response, filter_none_values
from ..errors import CortexError, ErrorCode  # noqa: F401
from ..types import (
    Context,
    ContextInput,
    ContextStatus,
    ContextWithChain,
    CreateContextOptions,
    DeleteContextOptions,
    UpdateContextOptions,
)
from .validators import (
    ContextsValidationError,
    validate_context_id_format,
    validate_conversation_id_format,
    validate_conversation_ref,
    validate_data_object,
    validate_export_format,
    validate_has_filters,
    validate_limit,
    validate_purpose,
    validate_required_string,
    validate_status,
    validate_timestamp,
    validate_updates_dict,
    validate_version,
)


class ContextsAPI:
    """
    Contexts API

    Manages hierarchical workflows where agents collaborate on complex tasks.
    Context chains track task delegation, shared state, and workflow evolution.
    """

    def __init__(
        self,
        client: Any,
        graph_adapter: Optional[Any] = None,
        resilience: Optional[Any] = None,
    ) -> None:
        """
        Initialize Contexts API.

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
        self, params: ContextInput, options: Optional[CreateContextOptions] = None
    ) -> Context:
        """
        Create a new context (root or child).

        Args:
            params: Context creation parameters
            options: Optional creation options (e.g., syncToGraph)

        Returns:
            Created context

        Example:
            >>> context = await cortex.contexts.create(
            ...     ContextInput(
            ...         purpose='Process customer refund request',
            ...         memory_space_id='supervisor-agent-space',
            ...         user_id='user-123',
            ...         data={'importance': 85, 'amount': 500}
            ...     )
            ... )
        """
        # Client-side validation
        validate_purpose(params.purpose)
        validate_required_string(params.memory_space_id, "memory_space_id")

        if params.user_id is not None:
            validate_required_string(params.user_id, "user_id")

        if params.parent_id is not None:
            validate_context_id_format(params.parent_id)

        if params.status is not None:
            validate_status(params.status)

        if params.conversation_ref is not None:
            # Handle both dict and object types
            ref_dict = params.conversation_ref if isinstance(params.conversation_ref, dict) else {
                "conversationId": getattr(params.conversation_ref, "conversation_id", None),
                "messageIds": getattr(params.conversation_ref, "message_ids", [])
            }
            validate_conversation_ref(ref_dict)

        if params.data is not None:
            validate_data_object(params.data)

        result = await self.client.mutation(
            "contexts:create",
            filter_none_values({
                "purpose": params.purpose,
                "memorySpaceId": params.memory_space_id,
                "parentId": params.parent_id,
                "userId": params.user_id,
                "conversationRef": (
                    {
                        "conversationId": params.conversation_ref.get("conversationId") if isinstance(params.conversation_ref, dict) else getattr(params.conversation_ref, "conversation_id", None),
                        "messageIds": (params.conversation_ref.get("messageIds") if isinstance(params.conversation_ref, dict) else getattr(params.conversation_ref, "message_ids", None)) or [],
                    }
                    if params.conversation_ref
                    else None
                ),
                "data": params.data,
                "status": params.status,
                # Note: description not supported by backend - put in data instead
            }),
        )

        # Sync to graph if requested
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import sync_context_relationships, sync_context_to_graph

                node_id = await sync_context_to_graph(result, self.graph_adapter)
                await sync_context_relationships(result, node_id, self.graph_adapter)
            except Exception as error:
                print(f"Warning: Failed to sync context to graph: {error}")

        # Manually construct to handle field name differences
        return Context(
            id=result.get("contextId"),
            memory_space_id=result.get("memorySpaceId"),
            purpose=result.get("purpose"),
            status=result.get("status"),
            depth=result.get("depth", 0),
            child_ids=result.get("childIds", []),
            participants=result.get("participants", []),
            data=result.get("data", {}),
            created_at=result.get("createdAt"),
            updated_at=result.get("updatedAt"),
            version=result.get("version", 1),
            root_id=result.get("rootId"),
            parent_id=result.get("parentId"),
            user_id=result.get("userId"),
            conversation_ref=result.get("conversationRef"),
            completed_at=result.get("completedAt"),
            granted_access=result.get("grantedAccess"),
        )

    async def get(
        self,
        context_id: str,
        include_chain: bool = False,
        include_conversation: bool = False,
    ) -> Optional[Union[Context, ContextWithChain]]:
        """
        Retrieve a context by ID with optional chain traversal.

        Args:
            context_id: Context ID
            include_chain: Include parent/children/siblings
            include_conversation: Fetch ACID conversation

        Returns:
            Context or ContextWithChain if found, None otherwise

        Example:
            >>> chain = await cortex.contexts.get(
            ...     'ctx-abc123',
            ...     include_chain=True
            ... )
        """
        # Client-side validation
        validate_required_string(context_id, "context_id")
        validate_context_id_format(context_id)

        result = await self.client.query(
            "contexts:get",
            filter_none_values({
                "contextId": context_id,
                "includeChain": include_chain,
                # Note: includeConversation not supported by backend yet
            }),
        )

        if not result:
            return None

        if include_chain:
            return ContextWithChain(**convert_convex_response(result))

        # Manually construct to handle field name differences
        return Context(
            id=result.get("contextId"),
            memory_space_id=result.get("memorySpaceId"),
            purpose=result.get("purpose"),
            status=result.get("status"),
            depth=result.get("depth", 0),
            child_ids=result.get("childIds", []),
            participants=result.get("participants", []),
            data=result.get("data", {}),
            created_at=result.get("createdAt"),
            updated_at=result.get("updatedAt"),
            version=result.get("version", 1),
            root_id=result.get("rootId"),
            parent_id=result.get("parentId"),
            user_id=result.get("userId"),
            conversation_ref=result.get("conversationRef"),
            completed_at=result.get("completedAt"),
            granted_access=result.get("grantedAccess"),
        )

    async def update(
        self,
        context_id: str,
        updates: Dict[str, Any],
        options: Optional[UpdateContextOptions] = None,
    ) -> Context:
        """
        Update a context (creates new version).

        Args:
            context_id: Context ID
            updates: Updates to apply
            options: Optional update options (e.g., syncToGraph)

        Returns:
            Updated context

        Example:
            >>> await cortex.contexts.update(
            ...     'ctx-abc123',
            ...     {'status': 'completed', 'data': {'result': 'success'}}
            ... )
        """
        # Client-side validation
        validate_required_string(context_id, "context_id")
        validate_context_id_format(context_id)

        if "status" in updates and updates["status"] is not None:
            validate_status(updates["status"])

        if "data" in updates and updates["data"] is not None:
            validate_data_object(updates["data"])

        if "completedAt" in updates and updates["completedAt"] is not None:
            validate_timestamp(updates["completedAt"], "completedAt")

        # Flatten updates into top-level parameters
        result = await self.client.mutation(
            "contexts:update", filter_none_values({"contextId": context_id, **updates})
        )

        # Sync to graph if requested
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import sync_context_to_graph

                await sync_context_to_graph(result, self.graph_adapter)
            except Exception as error:
                print(f"Warning: Failed to sync context update to graph: {error}")

        # Manually construct to handle field name differences
        return Context(
            id=result.get("contextId"),
            memory_space_id=result.get("memorySpaceId"),
            purpose=result.get("purpose"),
            status=result.get("status"),
            depth=result.get("depth", 0),
            child_ids=result.get("childIds", []),
            participants=result.get("participants", []),
            data=result.get("data", {}),
            created_at=result.get("createdAt"),
            updated_at=result.get("updatedAt"),
            version=result.get("version", 1),
            root_id=result.get("rootId"),
            parent_id=result.get("parentId"),
            user_id=result.get("userId"),
            conversation_ref=result.get("conversationRef"),
            completed_at=result.get("completedAt"),
            granted_access=result.get("grantedAccess"),
        )

    async def delete(
        self, context_id: str, options: Optional[DeleteContextOptions] = None
    ) -> Dict[str, Any]:
        """
        Delete a context and optionally its descendants.

        Args:
            context_id: Context ID
            options: Optional delete options

        Returns:
            Deletion result

        Example:
            >>> result = await cortex.contexts.delete(
            ...     'ctx-root',
            ...     DeleteContextOptions(cascade_children=True)
            ... )
        """
        # Client-side validation
        validate_required_string(context_id, "context_id")
        validate_context_id_format(context_id)

        opts = options or DeleteContextOptions()

        result = await self.client.mutation(
            "contexts:deleteContext",
            filter_none_values({
                "contextId": context_id,
                "cascadeChildren": opts.cascade_children,
                # Note: orphanChildren not supported by backend
            }),
        )

        # Delete from graph
        if opts.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import delete_context_from_graph

                await delete_context_from_graph(context_id, self.graph_adapter, True)
            except Exception as error:
                print(f"Warning: Failed to delete context from graph: {error}")

        return cast(Dict[str, Any], result)

    async def search(
        self,
        memory_space_id: Optional[str] = None,
        user_id: Optional[str] = None,
        status: Optional[ContextStatus] = None,
        limit: int = 50,
        include_chain: bool = False,
    ) -> List[Union[Context, ContextWithChain]]:
        """
        Search contexts with filters.

        Args:
            memory_space_id: Filter by memory space
            user_id: Filter by user ID
            status: Filter by status
            limit: Maximum results
            include_chain: Return ContextWithChain instead of Context

        Returns:
            List of contexts

        Example:
            >>> active = await cortex.contexts.search(
            ...     memory_space_id='finance-agent-space',
            ...     status='active'
            ... )
        """
        # Client-side validation
        if memory_space_id is not None:
            validate_required_string(memory_space_id, "memory_space_id")

        if user_id is not None:
            validate_required_string(user_id, "user_id")

        if status is not None:
            validate_status(status)

        validate_limit(limit)

        result = await self.client.query(
            "contexts:search",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "userId": user_id,
                "status": status,
                "limit": limit,
                # Note: includeChain not supported by backend
            }),
        )

        if include_chain:
            return [ContextWithChain(**ctx) for ctx in result]

        # Manually construct contexts
        return [
            Context(
                id=ctx.get("contextId"),
                memory_space_id=ctx.get("memorySpaceId"),
                purpose=ctx.get("purpose"),
                status=ctx.get("status"),
                depth=ctx.get("depth", 0),
                child_ids=ctx.get("childIds", []),
                participants=ctx.get("participants", []),
                data=ctx.get("data", {}),
                created_at=ctx.get("createdAt"),
                updated_at=ctx.get("updatedAt"),
                version=ctx.get("version", 1),
                root_id=ctx.get("rootId"),
                parent_id=ctx.get("parentId"),
                user_id=ctx.get("userId"),
                conversation_ref=ctx.get("conversationRef"),
                completed_at=ctx.get("completedAt"),
                granted_access=ctx.get("grantedAccess"),
            )
            for ctx in result
        ]

    async def list(
        self,
        memory_space_id: Optional[str] = None,
        status: Optional[ContextStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        List contexts with pagination.

        Args:
            memory_space_id: Filter by memory space
            status: Filter by status
            limit: Maximum results
            offset: Number of results to skip

        Returns:
            List result with pagination info

        Example:
            >>> page1 = await cortex.contexts.list(limit=50, offset=0)
        """
        # Client-side validation
        if memory_space_id is not None:
            validate_required_string(memory_space_id, "memory_space_id")

        if status is not None:
            validate_status(status)

        validate_limit(limit)

        if offset < 0:
            raise ContextsValidationError(
                f"offset must be >= 0, got {offset}",
                "INVALID_RANGE",
                "offset",
            )

        result = await self.client.query(
            "contexts:list",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "status": status,
                "limit": limit,
                # Note: offset not supported by backend yet
            }),
        )

        # Handle list or dict response
        if isinstance(result, list):
            contexts_list = result
        else:
            contexts_list = result.get("contexts", [])

        # Manually construct contexts
        contexts = [
            Context(
                id=ctx.get("contextId"),
                memory_space_id=ctx.get("memorySpaceId"),
                purpose=ctx.get("purpose"),
                status=ctx.get("status"),
                depth=ctx.get("depth", 0),
                child_ids=ctx.get("childIds", []),
                participants=ctx.get("participants", []),
                data=ctx.get("data", {}),
                created_at=ctx.get("createdAt"),
                updated_at=ctx.get("updatedAt"),
                version=ctx.get("version", 1),
                root_id=ctx.get("rootId"),
                parent_id=ctx.get("parentId"),
                user_id=ctx.get("userId"),
                conversation_ref=ctx.get("conversationRef"),
                completed_at=ctx.get("completedAt"),
                granted_access=ctx.get("grantedAccess"),
            )
            for ctx in contexts_list
        ]

        # Return in expected format
        if isinstance(result, list):
            return {"contexts": contexts}
        else:
            result["contexts"] = contexts
            return cast(Dict[str, Any], result)

    async def count(
        self,
        memory_space_id: Optional[str] = None,
        user_id: Optional[str] = None,
        status: Optional[ContextStatus] = None,
    ) -> int:
        """
        Count contexts matching filters.

        Args:
            memory_space_id: Filter by memory space
            user_id: Filter by user ID
            status: Filter by status

        Returns:
            Count of matching contexts

        Example:
            >>> total = await cortex.contexts.count()
        """
        # Client-side validation
        if memory_space_id is not None:
            validate_required_string(memory_space_id, "memory_space_id")

        if user_id is not None:
            validate_required_string(user_id, "user_id")

        if status is not None:
            validate_status(status)

        result = await self.client.query(
            "contexts:count",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "userId": user_id,
                "status": status,
            }),
        )

        return int(result)

    async def get_chain(self, context_id: str) -> Dict[str, Any]:
        """
        Get the complete context chain from a context ID.

        Args:
            context_id: Context ID

        Returns:
            Complete context chain

        Example:
            >>> chain = await cortex.contexts.get_chain('ctx-child')
        """
        # Client-side validation
        validate_required_string(context_id, "context_id")
        validate_context_id_format(context_id)

        result = await self.client.query("contexts:getChain", filter_none_values({"contextId": context_id}))

        return cast(Dict[str, Any], result)

    async def grant_access(
        self, context_id: str, target_memory_space_id: str, scope: str = "read-only"
    ) -> Context:
        """
        Grant access to a context from another memory space (Collaboration Mode).

        Args:
            context_id: Context ID
            target_memory_space_id: Memory space to grant access to
            scope: Access scope ('read-only', 'collaborate', 'full-access')

        Returns:
            Updated context with granted access

        Example:
            >>> await cortex.contexts.grant_access(
            ...     'ctx-abc123',
            ...     'partner-space',
            ...     'collaborate'
            ... )
        """
        # Client-side validation
        validate_required_string(context_id, "context_id")
        validate_context_id_format(context_id)
        validate_required_string(target_memory_space_id, "target_memory_space_id")
        validate_required_string(scope, "scope")

        result = await self.client.mutation(
            "contexts:grantAccess",
            filter_none_values({
                "contextId": context_id,
                "targetMemorySpaceId": target_memory_space_id,
                "scope": scope,
            }),
        )

        # Manually construct to handle field name differences
        return Context(
            id=result.get("contextId"),
            memory_space_id=result.get("memorySpaceId"),
            purpose=result.get("purpose"),
            status=result.get("status"),
            depth=result.get("depth", 0),
            child_ids=result.get("childIds", []),
            participants=result.get("participants", []),
            data=result.get("data", {}),
            created_at=result.get("createdAt"),
            updated_at=result.get("updatedAt"),
            version=result.get("version", 1),
            root_id=result.get("rootId"),
            parent_id=result.get("parentId"),
            user_id=result.get("userId"),
            conversation_ref=result.get("conversationRef"),
            completed_at=result.get("completedAt"),
            granted_access=result.get("grantedAccess"),
        )

    async def get_root(self, context_id: str) -> Context:
        """
        Get the root context of a chain.

        Args:
            context_id: Any context ID in the chain

        Returns:
            Root context

        Example:
            >>> root = await cortex.contexts.get_root('ctx-deeply-nested-child')
        """
        # Client-side validation
        validate_required_string(context_id, "context_id")
        validate_context_id_format(context_id)

        result = await self.client.query("contexts:getRoot", filter_none_values({"contextId": context_id}))

        # Manually construct to handle field name differences
        return Context(
            id=result.get("contextId"),
            memory_space_id=result.get("memorySpaceId"),
            purpose=result.get("purpose"),
            status=result.get("status"),
            depth=result.get("depth", 0),
            child_ids=result.get("childIds", []),
            participants=result.get("participants", []),
            data=result.get("data", {}),
            created_at=result.get("createdAt"),
            updated_at=result.get("updatedAt"),
            version=result.get("version", 1),
            root_id=result.get("rootId"),
            parent_id=result.get("parentId"),
            user_id=result.get("userId"),
            conversation_ref=result.get("conversationRef"),
            completed_at=result.get("completedAt"),
            granted_access=result.get("grantedAccess"),
        )

    async def get_children(
        self,
        context_id: str,
        status: Optional[ContextStatus] = None,
        recursive: bool = False,
    ) -> List[Context]:
        """
        Get all direct children (or descendants) of a context.

        Args:
            context_id: Parent context ID
            status: Filter by status
            recursive: Get all descendants (not just direct children)

        Returns:
            List of child contexts

        Example:
            >>> children = await cortex.contexts.get_children('ctx-root')
        """
        # Client-side validation
        validate_required_string(context_id, "context_id")
        validate_context_id_format(context_id)

        if status is not None:
            validate_status(status)

        result = await self.client.query(
            "contexts:getChildren",
            filter_none_values({"contextId": context_id, "status": status, "recursive": recursive}),
        )

        # Manually construct contexts
        return [
            Context(
                id=ctx.get("contextId"),
                memory_space_id=ctx.get("memorySpaceId"),
                purpose=ctx.get("purpose"),
                status=ctx.get("status"),
                depth=ctx.get("depth", 0),
                child_ids=ctx.get("childIds", []),
                participants=ctx.get("participants", []),
                data=ctx.get("data", {}),
                created_at=ctx.get("createdAt"),
                updated_at=ctx.get("updatedAt"),
                version=ctx.get("version", 1),
                root_id=ctx.get("rootId"),
                parent_id=ctx.get("parentId"),
                user_id=ctx.get("userId"),
                conversation_ref=ctx.get("conversationRef"),
                completed_at=ctx.get("completedAt"),
                granted_access=ctx.get("grantedAccess"),
            )
            for ctx in result
        ]

    async def find_orphaned(self) -> List[Context]:
        """
        Find contexts whose parent no longer exists.

        Returns:
            List of orphaned contexts

        Example:
            >>> orphaned = await cortex.contexts.find_orphaned()
        """
        result = await self.client.query("contexts:findOrphaned", {})

        # Manually construct contexts
        return [
            Context(
                id=ctx.get("contextId"),
                memory_space_id=ctx.get("memorySpaceId"),
                purpose=ctx.get("purpose"),
                status=ctx.get("status"),
                depth=ctx.get("depth", 0),
                child_ids=ctx.get("childIds", []),
                participants=ctx.get("participants", []),
                data=ctx.get("data", {}),
                created_at=ctx.get("createdAt"),
                updated_at=ctx.get("updatedAt"),
                version=ctx.get("version", 1),
                root_id=ctx.get("rootId"),
                parent_id=ctx.get("parentId"),
                user_id=ctx.get("userId"),
                conversation_ref=ctx.get("conversationRef"),
                completed_at=ctx.get("completedAt"),
                granted_access=ctx.get("grantedAccess"),
            )
            for ctx in result
        ]

    async def add_participant(self, context_id: str, participant_id: str) -> Context:
        """
        Add an agent to a context's participant list.

        Args:
            context_id: Context ID
            participant_id: Participant ID to add

        Returns:
            Updated context

        Example:
            >>> await cortex.contexts.add_participant('ctx-abc123', 'legal-agent')
        """
        # Client-side validation
        validate_required_string(context_id, "context_id")
        validate_context_id_format(context_id)
        validate_required_string(participant_id, "participant_id")

        result = await self.client.mutation(
            "contexts:addParticipant",
            {"contextId": context_id, "participantId": participant_id},
        )

        # Manually construct to handle field name differences
        return Context(
            id=result.get("contextId"),
            memory_space_id=result.get("memorySpaceId"),
            purpose=result.get("purpose"),
            status=result.get("status"),
            depth=result.get("depth", 0),
            child_ids=result.get("childIds", []),
            participants=result.get("participants", []),
            data=result.get("data", {}),
            created_at=result.get("createdAt"),
            updated_at=result.get("updatedAt"),
            version=result.get("version", 1),
            root_id=result.get("rootId"),
            parent_id=result.get("parentId"),
            user_id=result.get("userId"),
            conversation_ref=result.get("conversationRef"),
            completed_at=result.get("completedAt"),
            granted_access=result.get("grantedAccess"),
        )

    async def remove_participant(self, context_id: str, participant_id: str) -> Context:
        """
        Remove an agent from a context's participant list.

        Args:
            context_id: Context ID
            participant_id: Participant ID to remove

        Returns:
            Updated context

        Example:
            >>> await cortex.contexts.remove_participant('ctx-abc123', 'old-agent')
        """
        # Client-side validation
        validate_required_string(context_id, "context_id")
        validate_context_id_format(context_id)
        validate_required_string(participant_id, "participant_id")

        result = await self.client.mutation(
            "contexts:removeParticipant",
            {"contextId": context_id, "participantId": participant_id},
        )

        # Manually construct to handle field name differences
        return Context(
            id=result.get("contextId"),
            memory_space_id=result.get("memorySpaceId"),
            purpose=result.get("purpose"),
            status=result.get("status"),
            depth=result.get("depth", 0),
            child_ids=result.get("childIds", []),
            participants=result.get("participants", []),
            data=result.get("data", {}),
            created_at=result.get("createdAt"),
            updated_at=result.get("updatedAt"),
            version=result.get("version", 1),
            root_id=result.get("rootId"),
            parent_id=result.get("parentId"),
            user_id=result.get("userId"),
            conversation_ref=result.get("conversationRef"),
            completed_at=result.get("completedAt"),
            granted_access=result.get("grantedAccess"),
        )

    async def get_by_conversation(self, conversation_id: str) -> List[Context]:
        """
        Get all contexts originating from a specific conversation.

        Args:
            conversation_id: Conversation ID

        Returns:
            List of contexts triggered by this conversation

        Example:
            >>> contexts = await cortex.contexts.get_by_conversation('conv-456')
        """
        # Client-side validation
        validate_required_string(conversation_id, "conversation_id")
        validate_conversation_id_format(conversation_id)

        result = await self.client.query(
            "contexts:getByConversation", filter_none_values({"conversationId": conversation_id})
        )

        # Manually construct contexts
        return [
            Context(
                id=ctx.get("contextId"),
                memory_space_id=ctx.get("memorySpaceId"),
                purpose=ctx.get("purpose"),
                status=ctx.get("status"),
                depth=ctx.get("depth", 0),
                child_ids=ctx.get("childIds", []),
                participants=ctx.get("participants", []),
                data=ctx.get("data", {}),
                created_at=ctx.get("createdAt"),
                updated_at=ctx.get("updatedAt"),
                version=ctx.get("version", 1),
                root_id=ctx.get("rootId"),
                parent_id=ctx.get("parentId"),
                user_id=ctx.get("userId"),
                conversation_ref=ctx.get("conversationRef"),
                completed_at=ctx.get("completedAt"),
                granted_access=ctx.get("grantedAccess"),
            )
            for ctx in result
        ]

    async def update_many(
        self, filters: Dict[str, Any], updates: Dict[str, Any], dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Bulk update contexts matching filters.

        Args:
            filters: Filter criteria
            updates: Updates to apply
            dry_run: Preview without updating

        Returns:
            Update result

        Example:
            >>> await cortex.contexts.update_many(
            ...     {'status': 'completed'},
            ...     {'data': {'archived': True}}
            ... )
        """
        # Client-side validation
        validate_has_filters(filters)
        validate_updates_dict(updates)

        if "memorySpaceId" in filters and filters["memorySpaceId"] is not None:
            validate_required_string(filters["memorySpaceId"], "memorySpaceId")

        if "userId" in filters and filters["userId"] is not None:
            validate_required_string(filters["userId"], "userId")

        if "status" in filters and filters["status"] is not None:
            validate_status(filters["status"])

        if "parentId" in filters and filters["parentId"] is not None:
            validate_context_id_format(filters["parentId"])

        if "rootId" in filters and filters["rootId"] is not None:
            validate_context_id_format(filters["rootId"])

        if "status" in updates and updates["status"] is not None:
            validate_status(updates["status"])

        if "data" in updates and updates["data"] is not None:
            validate_data_object(updates["data"])

        result = await self.client.mutation(
            "contexts:updateMany",
            filter_none_values({"filters": filters, "updates": updates, "dryRun": dry_run}),
        )

        return cast(Dict[str, Any], result)

    async def delete_many(
        self,
        filters: Dict[str, Any],
        cascade_children: bool = False,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """
        Bulk delete contexts matching filters.

        Args:
            filters: Filter criteria
            cascade_children: Delete descendants
            dry_run: Preview without deleting

        Returns:
            Deletion result

        Example:
            >>> result = await cortex.contexts.delete_many(
            ...     {'status': 'cancelled'},
            ...     cascade_children=True
            ... )
        """
        # Client-side validation
        validate_has_filters(filters)

        if "memorySpaceId" in filters and filters["memorySpaceId"] is not None:
            validate_required_string(filters["memorySpaceId"], "memorySpaceId")

        if "userId" in filters and filters["userId"] is not None:
            validate_required_string(filters["userId"], "userId")

        if "status" in filters and filters["status"] is not None:
            validate_status(filters["status"])

        if "completedBefore" in filters and filters["completedBefore"] is not None:
            validate_timestamp(filters["completedBefore"], "completedBefore")

        result = await self.client.mutation(
            "contexts:deleteMany",
            filter_none_values({
                "filters": filters,
                "cascadeChildren": cascade_children,
                "dryRun": dry_run,
            }),
        )

        return cast(Dict[str, Any], result)

    async def export(
        self,
        filters: Optional[Dict[str, Any]] = None,
        format: str = "json",
        include_chain: bool = False,
        include_conversations: bool = False,
        include_version_history: bool = False,
    ) -> Dict[str, Any]:
        """
        Export contexts to JSON or CSV.

        Args:
            filters: Optional filter criteria
            format: Export format ('json' or 'csv')
            include_chain: Include full hierarchy
            include_conversations: Include ACID conversations
            include_version_history: Include version history

        Returns:
            Export result

        Example:
            >>> await cortex.contexts.export(
            ...     filters={'user_id': 'user-123'},
            ...     format='json',
            ...     include_chain=True
            ... )
        """
        # Client-side validation
        validate_export_format(format)

        if filters:
            if "memorySpaceId" in filters and filters["memorySpaceId"] is not None:
                validate_required_string(filters["memorySpaceId"], "memorySpaceId")

            if "userId" in filters and filters["userId"] is not None:
                validate_required_string(filters["userId"], "userId")

            if "status" in filters and filters["status"] is not None:
                validate_status(filters["status"])

        result = await self.client.query(
            "contexts:export",
            {
                "filters": filters,
                "format": format,
                "includeChain": include_chain,
                "includeConversations": include_conversations,
                "includeVersionHistory": include_version_history,
            },
        )

        return cast(Dict[str, Any], result)

    async def get_version(
        self, context_id: str, version: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get a specific version of a context.

        Args:
            context_id: Context ID
            version: Version number

        Returns:
            Context version if found, None otherwise

        Example:
            >>> v1 = await cortex.contexts.get_version('ctx-abc123', 1)
        """
        # Client-side validation
        validate_required_string(context_id, "context_id")
        validate_context_id_format(context_id)
        validate_version(version)

        result = await self.client.query(
            "contexts:getVersion", filter_none_values({"contextId": context_id, "version": version})
        )

        return cast(Optional[Dict[str, Any]], result)

    async def get_history(self, context_id: str) -> List[Dict[str, Any]]:
        """
        Get all versions of a context.

        Args:
            context_id: Context ID

        Returns:
            List of all versions

        Example:
            >>> history = await cortex.contexts.get_history('ctx-abc123')
        """
        # Client-side validation
        validate_required_string(context_id, "context_id")
        validate_context_id_format(context_id)

        result = await self.client.query(
            "contexts:getHistory", filter_none_values({"contextId": context_id})
        )

        return cast(List[Dict[str, Any]], result)

    async def get_at_timestamp(
        self, context_id: str, timestamp: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get context state at a specific point in time.

        Args:
            context_id: Context ID
            timestamp: Point in time (Unix timestamp in ms)

        Returns:
            Context version at that time if found, None otherwise

        Example:
            >>> historical = await cortex.contexts.get_at_timestamp(
            ...     'ctx-abc123', 1609459200000
            ... )
        """
        # Client-side validation
        validate_required_string(context_id, "context_id")
        validate_context_id_format(context_id)
        validate_timestamp(timestamp, "timestamp")

        result = await self.client.query(
            "contexts:getAtTimestamp",
            filter_none_values({"contextId": context_id, "timestamp": timestamp}),
        )

        return cast(Optional[Dict[str, Any]], result)


__all__ = ["ContextsAPI", "ContextsValidationError"]
