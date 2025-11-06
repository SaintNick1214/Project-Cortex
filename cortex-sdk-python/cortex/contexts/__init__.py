"""
Cortex SDK - Contexts API

Coordination Layer: Context chain management for multi-agent workflow coordination
"""

from typing import Optional, List, Dict, Any, Literal, Union

from ..types import (
    Context,
    ContextInput,
    ContextWithChain,
    ContextStatus,
    CreateContextOptions,
    UpdateContextOptions,
    DeleteContextOptions,
)
from ..errors import CortexError, ErrorCode
from .._utils import filter_none_values


class ContextsAPI:
    """
    Contexts API

    Manages hierarchical workflows where agents collaborate on complex tasks.
    Context chains track task delegation, shared state, and workflow evolution.
    """

    def __init__(self, client, graph_adapter=None):
        """
        Initialize Contexts API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter for sync
        """
        self.client = client
        self.graph_adapter = graph_adapter

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
        result = await self.client.mutation(
            "contexts:create",
            {
                "purpose": params.purpose,
                "memorySpaceId": params.memory_space_id,
                "parentId": params.parent_id,
                "userId": params.user_id,
                "conversationRef": (
                    {
                        "conversationId": params.conversation_ref.conversation_id,
                        "messageIds": params.conversation_ref.message_ids,
                    }
                    if params.conversation_ref
                    else None
                ),
                "data": params.data,
                "status": params.status,
                "description": params.description,
            },
        )

        # Sync to graph if requested
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import sync_context_to_graph, sync_context_relationships

                node_id = await sync_context_to_graph(result, self.graph_adapter)
                await sync_context_relationships(result, node_id, self.graph_adapter)
            except Exception as error:
                print(f"Warning: Failed to sync context to graph: {error}")

        return Context(**result)

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
        result = await self.client.query(
            "contexts:get",
            {
                "contextId": context_id,
                "includeChain": include_chain,
                "includeConversation": include_conversation,
            },
        )

        if not result:
            return None

        if include_chain:
            return ContextWithChain(**result)

        return Context(**result)

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
        result = await self.client.mutation(
            "contexts:update", {"contextId": context_id, "updates": updates}
        )

        # Sync to graph if requested
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import sync_context_to_graph

                await sync_context_to_graph(result, self.graph_adapter)
            except Exception as error:
                print(f"Warning: Failed to sync context update to graph: {error}")

        return Context(**result)

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
        opts = options or DeleteContextOptions()

        result = await self.client.mutation(
            "contexts:delete",
            {
                "contextId": context_id,
                "cascadeChildren": opts.cascade_children,
                "orphanChildren": opts.orphan_children,
            },
        )

        # Delete from graph
        if opts.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import delete_context_from_graph

                await delete_context_from_graph(context_id, self.graph_adapter, True)
            except Exception as error:
                print(f"Warning: Failed to delete context from graph: {error}")

        return result

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
        result = await self.client.query(
            "contexts:search",
            {
                "memorySpaceId": memory_space_id,
                "userId": user_id,
                "status": status,
                "limit": limit,
                "includeChain": include_chain,
            },
        )

        if include_chain:
            return [ContextWithChain(**ctx) for ctx in result]

        return [Context(**ctx) for ctx in result]

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
        result = await self.client.query(
            "contexts:list",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "status": status,
                "limit": limit,
                # Note: offset not supported by backend yet
            }),
        )

        result["contexts"] = [Context(**ctx) for ctx in result.get("contexts", [])]
        return result

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
        result = await self.client.query(
            "contexts:count",
            {
                "memorySpaceId": memory_space_id,
                "userId": user_id,
                "status": status,
            },
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
        result = await self.client.query("contexts:getChain", {"contextId": context_id})

        return result

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
        result = await self.client.query("contexts:getRoot", {"contextId": context_id})

        return Context(**result)

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
        result = await self.client.query(
            "contexts:getChildren",
            {"contextId": context_id, "status": status, "recursive": recursive},
        )

        return [Context(**ctx) for ctx in result]

    async def find_orphaned(self) -> List[Context]:
        """
        Find contexts whose parent no longer exists.

        Returns:
            List of orphaned contexts

        Example:
            >>> orphaned = await cortex.contexts.find_orphaned()
        """
        result = await self.client.query("contexts:findOrphaned", {})

        return [Context(**ctx) for ctx in result]

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
        result = await self.client.mutation(
            "contexts:addParticipant",
            {"contextId": context_id, "participantId": participant_id},
        )

        return Context(**result)

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
        result = await self.client.mutation(
            "contexts:removeParticipant",
            {"contextId": context_id, "participantId": participant_id},
        )

        return Context(**result)

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
        result = await self.client.query(
            "contexts:getByConversation", {"conversationId": conversation_id}
        )

        return [Context(**ctx) for ctx in result]

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
        result = await self.client.mutation(
            "contexts:updateMany",
            {"filters": filters, "updates": updates, "dryRun": dry_run},
        )

        return result

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
        result = await self.client.mutation(
            "contexts:deleteMany",
            {
                "filters": filters,
                "cascadeChildren": cascade_children,
                "dryRun": dry_run,
            },
        )

        return result

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

        return result

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
        result = await self.client.query(
            "contexts:getVersion", {"contextId": context_id, "version": version}
        )

        return result

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
        result = await self.client.query(
            "contexts:getHistory", {"contextId": context_id}
        )

        return result

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
        result = await self.client.query(
            "contexts:getAtTimestamp",
            {"contextId": context_id, "timestamp": timestamp},
        )

        return result

