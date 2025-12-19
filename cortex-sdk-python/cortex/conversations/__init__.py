"""
Cortex SDK - Conversations API

Layer 1a: ACID-compliant immutable conversation storage
"""

import random
import string
import time
from typing import Any, Dict, List, Literal, Optional

from .._utils import convert_convex_response, filter_none_values
from ..errors import CortexError, ErrorCode  # noqa: F401
from ..types import (
    AddMessageInput,
    AddMessageOptions,
    Conversation,
    ConversationDeletionResult,
    ConversationSearchResult,
    ConversationType,
    CountConversationsFilter,
    CreateConversationInput,
    CreateConversationOptions,
    DeleteConversationOptions,
    DeleteManyConversationsOptions,
    DeleteManyConversationsResult,
    ExportResult,
    GetConversationOptions,
    GetHistoryOptions,
    GetHistoryResult,
    ListConversationsFilter,
    ListConversationsResult,
    Message,
    SearchConversationsFilters,  # noqa: F401 - Re-exported for public API
    SearchConversationsInput,
    SearchConversationsOptions,  # noqa: F401 - Re-exported for public API
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

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
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
            ),
            "conversations:create",
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

    async def get(
        self,
        conversation_id: str,
        options: Optional[GetConversationOptions] = None,
    ) -> Optional[Conversation]:
        """
        Get a conversation by ID.

        Args:
            conversation_id: The conversation ID to retrieve
            options: Optional options for controlling message loading

        Returns:
            Conversation if found, None otherwise

        Example:
            >>> conversation = await cortex.conversations.get('conv-abc123')

            >>> # Get without messages (faster for metadata-only queries)
            >>> conv = await cortex.conversations.get('conv-abc123', GetConversationOptions(
            ...     include_messages=False
            ... ))

            >>> # Limit messages returned
            >>> conv = await cortex.conversations.get('conv-abc123', GetConversationOptions(
            ...     message_limit=10
            ... ))
        """
        validate_required_string(conversation_id, "conversation_id")

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversations:get",
                filter_none_values({
                    "conversationId": conversation_id,
                    "includeMessages": options.include_messages if options else None,
                    "messageLimit": options.message_limit if options else None,
                }),
            ),
            "conversations:get",
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

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
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
            ),
            "conversations:addMessage",
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
        filter: Optional[ListConversationsFilter] = None,
        *,
        memory_space_id: Optional[str] = None,
        user_id: Optional[str] = None,
        type: Optional[ConversationType] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> ListConversationsResult:
        """
        List conversations with optional filters and pagination.

        Args:
            filter: Optional filter with type, user_id, memory_space_id, dates,
                   pagination, and sorting options
            memory_space_id: Memory space ID to filter by (convenience kwarg)
            user_id: User ID to filter by (convenience kwarg)
            type: Conversation type to filter by (convenience kwarg)
            limit: Max results to return (convenience kwarg)
            offset: Pagination offset (convenience kwarg)

        Returns:
            ListConversationsResult with conversations and pagination metadata

        Example:
            >>> result = await cortex.conversations.list(ListConversationsFilter(
            ...     user_id='user-123',
            ...     limit=10
            ... ))
            >>> print(f"Found {result.total} conversations")

            >>> # Using convenience kwargs
            >>> result = await cortex.conversations.list(memory_space_id='space-123')

            >>> # With pagination and sorting
            >>> page2 = await cortex.conversations.list(ListConversationsFilter(
            ...     memory_space_id='space-123',
            ...     offset=10,
            ...     limit=10,
            ...     sort_by='lastMessageAt',
            ...     sort_order='desc',
            ... ))

            >>> # Filter by date range
            >>> recent = await cortex.conversations.list(ListConversationsFilter(
            ...     created_after=int(time.time() * 1000) - 7 * 24 * 60 * 60 * 1000,
            ... ))
        """
        # Build filter from kwargs if no filter object provided
        if filter is None and any([memory_space_id, user_id, type, limit, offset]):
            filter = ListConversationsFilter(
                memory_space_id=memory_space_id,
                user_id=user_id,
                type=type,
                limit=limit,
                offset=offset,
            )

        # All fields optional, validate only if provided
        if filter and filter.type is not None:
            validate_conversation_type(filter.type)
        if filter and filter.limit is not None:
            validate_limit(filter.limit)
        if filter and filter.offset is not None:
            validate_offset(filter.offset)
        if filter and filter.sort_order is not None:
            validate_sort_order(filter.sort_order)

        # Handle message_count filter
        message_count_min: Optional[int] = None
        message_count_max: Optional[int] = None
        if filter:
            if filter.message_count is not None:
                message_count_min = filter.message_count
                message_count_max = filter.message_count
            else:
                message_count_min = filter.message_count_min
                message_count_max = filter.message_count_max

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversations:list",
                filter_none_values({
                    "type": filter.type if filter else None,
                    "userId": filter.user_id if filter else None,
                    "memorySpaceId": filter.memory_space_id if filter else None,
                    "participantId": filter.participant_id if filter else None,
                    "createdBefore": filter.created_before if filter else None,
                    "createdAfter": filter.created_after if filter else None,
                    "updatedBefore": filter.updated_before if filter else None,
                    "updatedAfter": filter.updated_after if filter else None,
                    "lastMessageBefore": filter.last_message_before if filter else None,
                    "lastMessageAfter": filter.last_message_after if filter else None,
                    "messageCountMin": message_count_min,
                    "messageCountMax": message_count_max,
                    "limit": filter.limit if filter else None,
                    "offset": filter.offset if filter else None,
                    "sortBy": filter.sort_by if filter else None,
                    "sortOrder": filter.sort_order if filter else None,
                    "includeMessages": filter.include_messages if filter else None,
                }),
            ),
            "conversations:list",
        )

        # Convert response to ListConversationsResult
        # Handle both dict response (with conversations key) and direct list response
        raw_conversations = result if isinstance(result, list) else result.get("conversations", [])
        conversations = [
            Conversation(**convert_convex_response(conv))
            for conv in raw_conversations
        ]
        return ListConversationsResult(
            conversations=conversations,
            total=result.get("total", len(conversations)) if isinstance(result, dict) else len(conversations),
            limit=result.get("limit", filter.limit if filter and filter.limit else 50) if isinstance(result, dict) else (filter.limit if filter and filter.limit else 50),
            offset=result.get("offset", filter.offset if filter and filter.offset else 0) if isinstance(result, dict) else (filter.offset if filter and filter.offset else 0),
            has_more=result.get("hasMore", False) if isinstance(result, dict) else False,
        )

    async def count(
        self,
        filter: Optional[CountConversationsFilter] = None,
        *,
        memory_space_id: Optional[str] = None,
        user_id: Optional[str] = None,
        type: Optional[ConversationType] = None,
    ) -> int:
        """
        Count conversations.

        Args:
            filter: Optional filter with type, user_id, memory_space_id
            memory_space_id: Memory space ID to filter by (convenience kwarg)
            user_id: User ID to filter by (convenience kwarg)
            type: Conversation type to filter by (convenience kwarg)

        Returns:
            Count of matching conversations

        Example:
            >>> count = await cortex.conversations.count(CountConversationsFilter(
            ...     memory_space_id='user-123-personal'
            ... ))

            >>> # Using convenience kwargs
            >>> count = await cortex.conversations.count(memory_space_id='space-123')
        """
        # Build filter from kwargs if no filter object provided
        if filter is None and any([memory_space_id, user_id, type]):
            filter = CountConversationsFilter(
                memory_space_id=memory_space_id,
                user_id=user_id,
                type=type,
            )

        if filter and filter.type is not None:
            validate_conversation_type(filter.type)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversations:count",
                filter_none_values({
                    "type": filter.type if filter else None,
                    "userId": filter.user_id if filter else None,
                    "memorySpaceId": filter.memory_space_id if filter else None,
                }),
            ),
            "conversations:count",
        )

        return int(result)

    async def delete(
        self, conversation_id: str, options: Optional[DeleteConversationOptions] = None
    ) -> ConversationDeletionResult:
        """
        Delete a conversation (for GDPR/cleanup).

        Args:
            conversation_id: The conversation to delete
            options: Optional deletion options (e.g., syncToGraph)

        Returns:
            ConversationDeletionResult with deletion details

        Example:
            >>> result = await cortex.conversations.delete('conv-abc123')
            >>> print(f"Deleted {result.messages_deleted} messages")
            >>> print(f"Restorable: {result.restorable}")  # false - permanent!
        """
        validate_required_string(conversation_id, "conversation_id")

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "conversations:deleteConversation", filter_none_values({"conversationId": conversation_id})
            ),
            "conversations:deleteConversation",
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

        return ConversationDeletionResult(**convert_convex_response(result))

    async def delete_many(
        self,
        filter: Dict[str, Any],
        options: Optional[DeleteManyConversationsOptions] = None,
    ) -> DeleteManyConversationsResult:
        """
        Delete many conversations matching filters.

        Args:
            filter: Filter with user_id, memory_space_id, and/or type
            options: Optional options including dryRun and confirmationThreshold

        Returns:
            DeleteManyConversationsResult with deletion counts

        Example:
            >>> # Preview what would be deleted (dryRun)
            >>> preview = await cortex.conversations.delete_many(
            ...     {'user_id': 'user-123'},
            ...     DeleteManyConversationsOptions(dry_run=True)
            ... )
            >>> print(f"Would delete {preview.would_delete} conversations")

            >>> # Execute deletion
            >>> result = await cortex.conversations.delete_many({
            ...     'memory_space_id': 'user-123-personal',
            ...     'user_id': 'user-123',
            ...     'type': 'user-agent',
            ... })
            >>> print(f"Deleted {result.deleted} conversations")
        """
        # Extract filter values
        user_id = filter.get("user_id") or filter.get("userId")
        memory_space_id = filter.get("memory_space_id") or filter.get("memorySpaceId")
        conv_type = filter.get("type")

        # Validate type if provided
        if conv_type is not None:
            validate_conversation_type(conv_type)

        # Ensure at least one filter is provided
        if user_id is None and memory_space_id is None and conv_type is None:
            raise ConversationValidationError(
                "delete_many requires at least one filter (user_id, memory_space_id, or type)",
                "MISSING_REQUIRED_FIELD",
            )

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "conversations:deleteMany",
                filter_none_values({
                    "userId": user_id,
                    "memorySpaceId": memory_space_id,
                    "type": conv_type,
                    "dryRun": options.dry_run if options else None,
                    "confirmationThreshold": options.confirmation_threshold if options else None,
                }),
            ),
            "conversations:deleteMany",
        )

        return DeleteManyConversationsResult(**convert_convex_response(result))

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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversations:getMessage",
                filter_none_values({"conversationId": conversation_id, "messageId": message_id}),
            ),
            "conversations:getMessage",
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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversations:getMessagesByIds",
                filter_none_values({"conversationId": conversation_id, "messageIds": message_ids}),
            ),
            "conversations:getMessagesByIds",
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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversations:findConversation",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "type": type,
                    "userId": user_id,
                    "memorySpaceIds": memory_space_ids,
                }),
            ),
            "conversations:findConversation",
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

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
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
            ),
            "conversations:getOrCreate",
        )

        return Conversation(**convert_convex_response(result))

    async def get_history(
        self,
        conversation_id: str,
        options: Optional[GetHistoryOptions] = None,
    ) -> GetHistoryResult:
        """
        Get paginated message history from a conversation.

        Args:
            conversation_id: The conversation ID
            options: Optional history options with limit, offset, sort_order,
                    since, until, and roles filters

        Returns:
            GetHistoryResult with messages and pagination info

        Example:
            >>> history = await cortex.conversations.get_history(
            ...     'conv-abc123',
            ...     GetHistoryOptions(limit=20, offset=0, sort_order='desc')
            ... )

            >>> # Filter by date range
            >>> recent = await cortex.conversations.get_history(
            ...     'conv-abc123',
            ...     GetHistoryOptions(
            ...         since=int(time.time() * 1000) - 24 * 60 * 60 * 1000,  # Last 24h
            ...     )
            ... )

            >>> # Filter by roles
            >>> user_messages = await cortex.conversations.get_history(
            ...     'conv-abc123',
            ...     GetHistoryOptions(roles=['user'])
            ... )
        """
        validate_required_string(conversation_id, "conversation_id")

        if options:
            if options.limit is not None:
                validate_limit(options.limit)
            if options.offset is not None:
                validate_offset(options.offset)
            if options.sort_order is not None:
                validate_sort_order(options.sort_order)
            # Validate date range if both provided
            if options.since is not None and options.until is not None:
                validate_timestamp_range(options.since, options.until)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversations:getHistory",
                filter_none_values({
                    "conversationId": conversation_id,
                    "limit": options.limit if options else None,
                    "offset": options.offset if options else None,
                    "sortOrder": options.sort_order if options else None,
                    "since": options.since if options else None,
                    "until": options.until if options else None,
                    "roles": options.roles if options else None,
                }),
            ),
            "conversations:getHistory",
        )

        # Convert messages to Message objects
        messages = [Message(**convert_convex_response(msg)) for msg in result.get("messages", [])]
        return GetHistoryResult(
            messages=messages,
            total=result.get("total", len(messages)),
            has_more=result.get("hasMore", False),
            conversation_id=result.get("conversationId", conversation_id),
        )

    async def search(
        self,
        input: SearchConversationsInput,
    ) -> List[ConversationSearchResult]:
        """
        Search conversations by text query.

        Args:
            input: Search input with query, filters, and options

        Returns:
            List of search results with score and highlights

        Example:
            >>> results = await cortex.conversations.search(
            ...     SearchConversationsInput(
            ...         query='password',
            ...         filters=SearchConversationsFilters(user_id='user-123', limit=5)
            ...     )
            ... )

            >>> # Search with options
            >>> fuzzy_results = await cortex.conversations.search(
            ...     SearchConversationsInput(
            ...         query='account balance',
            ...         options=SearchConversationsOptions(
            ...             search_in='both',  # Search content and metadata
            ...             match_mode='fuzzy',
            ...         )
            ...     )
            ... )
        """
        validate_search_query(input.query)

        if input.filters:
            if input.filters.type is not None:
                validate_conversation_type(input.filters.type)
            if input.filters.limit is not None:
                validate_limit(input.filters.limit)
            # Validate date range
            validate_timestamp_range(input.filters.date_start, input.filters.date_end)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversations:search",
                filter_none_values({
                    "query": input.query,
                    "type": input.filters.type if input.filters else None,
                    "userId": input.filters.user_id if input.filters else None,
                    "memorySpaceId": input.filters.memory_space_id if input.filters else None,
                    "dateStart": input.filters.date_start if input.filters else None,
                    "dateEnd": input.filters.date_end if input.filters else None,
                    "limit": input.filters.limit if input.filters else None,
                    "searchIn": input.options.search_in if input.options else None,
                    "matchMode": input.options.match_mode if input.options else None,
                }),
            ),
            "conversations:search",
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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
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
            ),
            "conversations:exportConversations",
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

