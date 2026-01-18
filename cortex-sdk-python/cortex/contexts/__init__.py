"""
Cortex SDK - Contexts API

Coordination Layer: Context chain management for multi-agent workflow coordination
"""

from typing import Any, Dict, List, Optional, Union, cast

from .._utils import convert_convex_response, filter_none_values
from ..errors import CortexError, ErrorCode  # noqa: F401
from ..types import (
    AuthContext,
    Context,
    ContextInput,
    ContextStatus,
    ContextWithChain,
    CountContextsFilter,
    CreateContextOptions,
    DeleteContextOptions,
    DeleteContextResult,
    DeleteManyContextsResult,
    ExportContextsResult,
    ListContextsFilter,
    UpdateContextOptions,
    UpdateContextParams,
    UpdateManyContextsResult,
)
from .validators import (
    ContextsValidationError,
    validate_context_id_format,
    validate_conversation_id_format,
    validate_conversation_ref,
    validate_data_object,
    validate_depth,
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
        auth_context: Optional[AuthContext] = None,
    ) -> None:
        """
        Initialize Contexts API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter for sync
            resilience: Optional resilience layer for overload protection
            auth_context: Optional auth context for multi-tenancy
        """
        self.client = client
        self.graph_adapter = graph_adapter
        self._resilience = resilience
        self._auth_context = auth_context

    async def _execute_with_resilience(
        self, operation: Any, operation_name: str
    ) -> Any:
        """Execute an operation through the resilience layer (if available)."""
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

    @property
    def _tenant_id(self) -> Optional[str]:
        """Get tenant_id from auth context (for multi-tenancy)."""
        return self._auth_context.tenant_id if self._auth_context else None

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

        # Multi-tenancy: use provided tenant_id or inject from auth context
        tenant_id = params.tenant_id if hasattr(params, 'tenant_id') and params.tenant_id else self._tenant_id

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "contexts:create",
                filter_none_values({
                    "purpose": params.purpose,
                    "memorySpaceId": params.memory_space_id,
                    "tenantId": tenant_id,  # Multi-tenancy
                    "description": params.description,
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
                }),
            ),
            "contexts:create",
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
            tenant_id=result.get("tenantId"),  # Multi-tenancy
            parent_id=result.get("parentId"),
            user_id=result.get("userId"),
            description=result.get("description"),
            conversation_ref=result.get("conversationRef"),
            completed_at=result.get("completedAt"),
            granted_access=result.get("grantedAccess"),
            metadata=result.get("metadata"),
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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "contexts:get",
                filter_none_values({
                    "contextId": context_id,
                    "tenantId": self._tenant_id,  # Multi-tenancy
                    "includeChain": include_chain,
                    "includeConversation": include_conversation,
                }),
            ),
            "contexts:get",
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
            tenant_id=result.get("tenantId"),  # Multi-tenancy
            parent_id=result.get("parentId"),
            user_id=result.get("userId"),
            description=result.get("description"),
            conversation_ref=result.get("conversationRef"),
            completed_at=result.get("completedAt"),
            granted_access=result.get("grantedAccess"),
            metadata=result.get("metadata"),
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
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "contexts:update", filter_none_values({
                    "contextId": context_id,
                    "tenantId": self._tenant_id,  # Multi-tenancy
                    **updates
                })
            ),
            "contexts:update",
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
            tenant_id=result.get("tenantId"),  # Multi-tenancy
            parent_id=result.get("parentId"),
            user_id=result.get("userId"),
            description=result.get("description"),
            conversation_ref=result.get("conversationRef"),
            completed_at=result.get("completedAt"),
            granted_access=result.get("grantedAccess"),
            metadata=result.get("metadata"),
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

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "contexts:deleteContext",
                filter_none_values({
                    "contextId": context_id,
                    "tenantId": self._tenant_id,  # Multi-tenancy
                    "cascadeChildren": opts.cascade_children,
                    "orphanChildren": opts.orphan_children,
                }),
            ),
            "contexts:deleteContext",
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
        filter: Optional[ListContextsFilter] = None,
    ) -> List[Context]:
        """
        Search contexts with filters (alias for list).

        Args:
            filter: Optional filter criteria (ListContextsFilter)

        Returns:
            List of contexts matching the filter

        Example:
            >>> active = await cortex.contexts.search(
            ...     ListContextsFilter(
            ...         user_id='user-123',
            ...         status='active',
            ...     )
            ... )
        """
        return await self.list(filter)

    async def list(
        self,
        filter: Optional[ListContextsFilter] = None,
        *,
        memory_space_id: Optional[str] = None,
        user_id: Optional[str] = None,
        status: Optional[ContextStatus] = None,
        parent_id: Optional[str] = None,
        root_id: Optional[str] = None,
        depth: Optional[int] = None,
        limit: Optional[int] = None,
        tenant_id: Optional[str] = None,
    ) -> List[Context]:
        """
        List contexts with filters.

        Args:
            filter: Optional filter criteria (ListContextsFilter)
            memory_space_id: Filter by memory space (convenience kwarg)
            user_id: Filter by user (convenience kwarg)
            status: Filter by status (convenience kwarg)
            parent_id: Filter by parent context (convenience kwarg)
            root_id: Filter by root context (convenience kwarg)
            depth: Filter by depth (convenience kwarg)
            limit: Max results (convenience kwarg)
            tenant_id: Filter by tenant (convenience kwarg)

        Returns:
            List of contexts matching the filter

        Example:
            >>> # Using filter object
            >>> contexts = await cortex.contexts.list(
            ...     ListContextsFilter(
            ...         memory_space_id='finance-space',
            ...         status='active',
            ...     )
            ... )
            >>> # Using convenience kwargs
            >>> contexts = await cortex.contexts.list(
            ...     memory_space_id='finance-space',
            ...     status='active',
            ... )
        """
        # Build filter from kwargs if not provided
        if filter is None and any([memory_space_id, user_id, status, parent_id, root_id, depth, limit, tenant_id]):
            filter = ListContextsFilter(
                memory_space_id=memory_space_id,
                user_id=user_id,
                status=status,
                parent_id=parent_id,
                root_id=root_id,
                depth=depth,
                limit=limit,
                tenant_id=tenant_id,
            )

        # Client-side validation
        if filter:
            if filter.memory_space_id is not None:
                validate_required_string(filter.memory_space_id, "memory_space_id")
            if filter.user_id is not None:
                validate_required_string(filter.user_id, "user_id")
            if filter.status is not None:
                validate_status(filter.status)
            if filter.parent_id is not None:
                validate_context_id_format(filter.parent_id)
            if filter.root_id is not None:
                validate_context_id_format(filter.root_id)
            if filter.depth is not None:
                validate_depth(filter.depth)
            if filter.limit is not None:
                validate_limit(filter.limit)

        # Multi-tenancy: use provided tenant_id or inject from auth context
        tenant_id = (filter.tenant_id if filter and filter.tenant_id else None) or self._tenant_id

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "contexts:list",
                filter_none_values({
                    "memorySpaceId": filter.memory_space_id if filter else None,
                    "tenantId": tenant_id,  # Multi-tenancy
                    "userId": filter.user_id if filter else None,
                    "status": filter.status if filter else None,
                    "parentId": filter.parent_id if filter else None,
                    "rootId": filter.root_id if filter else None,
                    "depth": filter.depth if filter else None,
                    "limit": filter.limit if filter else None,
                }),
            ),
            "contexts:list",
        )

        # Handle list or dict response
        if isinstance(result, list):
            contexts_list = result
        else:
            contexts_list = result.get("contexts", result)

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
                tenant_id=ctx.get("tenantId"),  # Multi-tenancy
                parent_id=ctx.get("parentId"),
                user_id=ctx.get("userId"),
                description=ctx.get("description"),
                conversation_ref=ctx.get("conversationRef"),
                completed_at=ctx.get("completedAt"),
                granted_access=ctx.get("grantedAccess"),
                metadata=ctx.get("metadata"),
            )
            for ctx in contexts_list
        ]

    async def count(
        self,
        filter: Optional[CountContextsFilter] = None,
        *,
        memory_space_id: Optional[str] = None,
        user_id: Optional[str] = None,
        status: Optional[ContextStatus] = None,
        tenant_id: Optional[str] = None,
    ) -> int:
        """
        Count contexts matching filters.

        Args:
            filter: Optional filter criteria (CountContextsFilter)
            memory_space_id: Filter by memory space (convenience kwarg)
            user_id: Filter by user (convenience kwarg)
            status: Filter by status (convenience kwarg)
            tenant_id: Filter by tenant (convenience kwarg)

        Returns:
            Count of matching contexts

        Example:
            >>> # Using filter object
            >>> total = await cortex.contexts.count(
            ...     CountContextsFilter(
            ...         memory_space_id='supervisor-space',
            ...         status='active',
            ...     )
            ... )
            >>> # Using convenience kwargs
            >>> total = await cortex.contexts.count(
            ...     memory_space_id='supervisor-space',
            ...     status='active',
            ... )
        """
        # Build filter from kwargs if not provided
        if filter is None and any([memory_space_id, user_id, status, tenant_id]):
            filter = CountContextsFilter(
                memory_space_id=memory_space_id,
                user_id=user_id,
                status=status,
                tenant_id=tenant_id,
            )

        # Client-side validation
        if filter:
            if filter.memory_space_id is not None:
                validate_required_string(filter.memory_space_id, "memory_space_id")
            if filter.user_id is not None:
                validate_required_string(filter.user_id, "user_id")
            if filter.status is not None:
                validate_status(filter.status)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "contexts:count",
                filter_none_values({
                    "memorySpaceId": filter.memory_space_id if filter else None,
                    "userId": filter.user_id if filter else None,
                    "status": filter.status if filter else None,
                }),
            ),
            "contexts:count",
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

        result = await self._execute_with_resilience(
            lambda: self.client.query("contexts:getChain", filter_none_values({"contextId": context_id})),
            "contexts:getChain",
        )

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

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "contexts:grantAccess",
                filter_none_values({
                    "contextId": context_id,
                    "targetMemorySpaceId": target_memory_space_id,
                    "scope": scope,
                }),
            ),
            "contexts:grantAccess",
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
            tenant_id=result.get("tenantId"),  # Multi-tenancy
            parent_id=result.get("parentId"),
            user_id=result.get("userId"),
            description=result.get("description"),
            conversation_ref=result.get("conversationRef"),
            completed_at=result.get("completedAt"),
            granted_access=result.get("grantedAccess"),
            metadata=result.get("metadata"),
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

        result = await self._execute_with_resilience(
            lambda: self.client.query("contexts:getRoot", filter_none_values({"contextId": context_id})),
            "contexts:getRoot",
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
            tenant_id=result.get("tenantId"),  # Multi-tenancy
            parent_id=result.get("parentId"),
            user_id=result.get("userId"),
            description=result.get("description"),
            conversation_ref=result.get("conversationRef"),
            completed_at=result.get("completedAt"),
            granted_access=result.get("grantedAccess"),
            metadata=result.get("metadata"),
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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "contexts:getChildren",
                filter_none_values({"contextId": context_id, "status": status, "recursive": recursive}),
            ),
            "contexts:getChildren",
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
                tenant_id=ctx.get("tenantId"),  # Multi-tenancy
                parent_id=ctx.get("parentId"),
                user_id=ctx.get("userId"),
                description=ctx.get("description"),
                conversation_ref=ctx.get("conversationRef"),
                completed_at=ctx.get("completedAt"),
                granted_access=ctx.get("grantedAccess"),
                metadata=ctx.get("metadata"),
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
        result = await self._execute_with_resilience(
            lambda: self.client.query("contexts:findOrphaned", {}),
            "contexts:findOrphaned",
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
                tenant_id=ctx.get("tenantId"),  # Multi-tenancy
                parent_id=ctx.get("parentId"),
                user_id=ctx.get("userId"),
                description=ctx.get("description"),
                conversation_ref=ctx.get("conversationRef"),
                completed_at=ctx.get("completedAt"),
                granted_access=ctx.get("grantedAccess"),
                metadata=ctx.get("metadata"),
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

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "contexts:addParticipant",
                {"contextId": context_id, "participantId": participant_id},
            ),
            "contexts:addParticipant",
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
            tenant_id=result.get("tenantId"),  # Multi-tenancy
            parent_id=result.get("parentId"),
            user_id=result.get("userId"),
            description=result.get("description"),
            conversation_ref=result.get("conversationRef"),
            completed_at=result.get("completedAt"),
            granted_access=result.get("grantedAccess"),
            metadata=result.get("metadata"),
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

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "contexts:removeParticipant",
                {"contextId": context_id, "participantId": participant_id},
            ),
            "contexts:removeParticipant",
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
            tenant_id=result.get("tenantId"),  # Multi-tenancy
            parent_id=result.get("parentId"),
            user_id=result.get("userId"),
            description=result.get("description"),
            conversation_ref=result.get("conversationRef"),
            completed_at=result.get("completedAt"),
            granted_access=result.get("grantedAccess"),
            metadata=result.get("metadata"),
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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "contexts:getByConversation", filter_none_values({"conversationId": conversation_id})
            ),
            "contexts:getByConversation",
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
                tenant_id=ctx.get("tenantId"),  # Multi-tenancy
                parent_id=ctx.get("parentId"),
                user_id=ctx.get("userId"),
                description=ctx.get("description"),
                conversation_ref=ctx.get("conversationRef"),
                completed_at=ctx.get("completedAt"),
                granted_access=ctx.get("grantedAccess"),
                metadata=ctx.get("metadata"),
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

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "contexts:updateMany",
                filter_none_values({
                    "memorySpaceId": filters.get("memorySpaceId"),
                    "userId": filters.get("userId"),
                    "status": filters.get("status"),
                    "parentId": filters.get("parentId"),
                    "rootId": filters.get("rootId"),
                    "updates": updates,
                }),
            ),
            "contexts:updateMany",
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

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "contexts:deleteMany",
                filter_none_values({
                    "memorySpaceId": filters.get("memorySpaceId"),
                    "userId": filters.get("userId"),
                    "status": filters.get("status"),
                    "completedBefore": filters.get("completedBefore"),
                    "cascadeChildren": cascade_children,
                }),
            ),
            "contexts:deleteMany",
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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "contexts:exportContexts",
                filter_none_values({
                    "memorySpaceId": filters.get("memorySpaceId") if filters else None,
                    "userId": filters.get("userId") if filters else None,
                    "status": filters.get("status") if filters else None,
                    "format": format,
                    "includeChain": include_chain,
                    "includeVersionHistory": include_version_history,
                }),
            ),
            "contexts:exportContexts",
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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "contexts:getVersion", filter_none_values({"contextId": context_id, "version": version})
            ),
            "contexts:getVersion",
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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "contexts:getHistory", filter_none_values({"contextId": context_id})
            ),
            "contexts:getHistory",
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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "contexts:getAtTimestamp",
                filter_none_values({"contextId": context_id, "timestamp": timestamp}),
            ),
            "contexts:getAtTimestamp",
        )

        return cast(Optional[Dict[str, Any]], result)


__all__ = [
    "ContextsAPI",
    "ContextsValidationError",
    # Re-exported types
    "DeleteContextResult",
    "DeleteManyContextsResult",
    "ExportContextsResult",
    "UpdateContextParams",
    "UpdateManyContextsResult",
]
