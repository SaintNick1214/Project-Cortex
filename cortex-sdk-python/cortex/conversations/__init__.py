"""
Cortex SDK - Conversations API

Layer 1a: ACID-compliant immutable conversation storage
"""

import random
import string
import time
from typing import Any, Dict, List, Literal, Optional

from .._domain_export import conversations_export
from .._domain_paging import (
    DomainOperationPartialError,
    collect,
    loader,
    natural,
    resolve_scope,
    same_selection,
    select,
)
from .._utils import convert_convex_response, filter_none_values
from ..auth.validators import validate_tenant_id
from ..errors import CortexError, ErrorCode  # noqa: F401
from ..graph.erasure import (
    graph_option,
    mutate_graph_selected,
    requested_graph,
    write_graph_mutation,
)
from ..types import (
    AddMessageInput,
    AddMessageOptions,
    ApproveMessageInput,
    AuthContext,
    CheckAccessInput,
    CheckAccessResult,
    CheckShareAccessResult,
    Conversation,
    ConversationDeletionResult,
    ConversationSearchResult,
    ConversationShare,
    ConversationSnapshot,
    ConversationType,
    CountConversationsFilter,
    CreateConversationInput,
    CreateConversationOptions,
    CreateShareInput,
    CreateShareResult,
    CreateSnapshotInput,
    CreateSnapshotResult,
    DeleteConversationOptions,
    DeleteManyConversationsOptions,
    DeleteManyConversationsResult,
    DomainReadOptions,
    ExportResult,
    GetConversationOptions,
    GetHistoryOptions,
    GetHistoryResult,
    ListConversationsFilter,
    ListConversationsResult,
    Message,
    RevokeShareResult,
    SearchConversationsFilters,  # noqa: F401 - Re-exported for public API
    SearchConversationsInput,
    SearchConversationsOptions,  # noqa: F401 - Re-exported for public API
    SetVisibilityInput,
    SharePermissions,  # noqa: F401 - Used in type hints
    ShareStatus,
)
from .validators import (
    ConversationValidationError,
    validate_conversation_type,
    validate_export_format,
    validate_grant_type,
    validate_granted_to,
    validate_id_format,
    validate_limit,
    validate_message_role,
    validate_no_duplicates,
    validate_non_empty_list,
    validate_offset,
    validate_participants,
    validate_required_string,
    validate_search_query,
    validate_share_status,
    validate_sort_order,
    validate_timestamp_range,
    validate_visibility,
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
        auth_context: Optional[AuthContext] = None,
        graph_sync_policy: Optional[Any] = None,
    ) -> None:
        """
        Initialize Conversations API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter for sync
            resilience: Optional resilience layer for overload protection
            auth_context: Optional auth context for multi-tenancy
        """
        self.client = client
        self.graph_adapter = graph_adapter
        self._graph_sync_policy = graph_sync_policy
        self._resilience = resilience
        self._auth_context = auth_context

    async def _mutate_graph(self, reference: str, args: Dict[str, Any], explicit: Optional[bool] = None) -> Any:
        return await write_graph_mutation(self.client, self.graph_adapter, self._graph_sync_policy, reference, args, explicit)

    async def _execute_with_resilience(
        self, operation: Any, operation_name: str, *, graph_write: Optional[bool] = False
    ) -> Any:
        """Execute an operation through the resilience layer (if available)."""
        if requested_graph(self.graph_adapter, graph_write):
            return await operation()
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

    @property
    def _tenant_id(self) -> Optional[str]:
        """Get tenant_id from auth context (for multi-tenancy)."""
        return self._auth_context.tenant_id if self._auth_context else None

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

        # Validate visibility if provided
        visibility = getattr(input, "visibility", None)
        validate_visibility(visibility)

        # Auto-generate conversation ID if not provided
        conversation_id = input.conversation_id or self._generate_conversation_id()

        # Support explicit tenant_id from input, fallback to auth context
        tenant_id = (input.tenant_id if hasattr(input, "tenant_id") and input.tenant_id else None) or self._tenant_id

        result = await self._execute_with_resilience(
            lambda: self._mutate_graph(
                "conversations:create",
                filter_none_values({
                    "conversationId": conversation_id,
                    "memorySpaceId": input.memory_space_id,
                    "tenantId": tenant_id,  # Multi-tenancy support (explicit or auth context)
                    "participantId": input.participant_id,
                    "type": input.type,
                    "participants": filter_none_values({
                        "userId": input.participants.get("userId") if isinstance(input.participants, dict) else getattr(input.participants, "user_id", None),
                        "agentId": input.participants.get("agentId") if isinstance(input.participants, dict) else getattr(input.participants, "agent_id", None),
                        "userIds": input.participants.get("userIds") if isinstance(input.participants, dict) else getattr(input.participants, "user_ids", None),  # Phase 4: Collaborative
                        "participantId": input.participants.get("participantId") if isinstance(input.participants, dict) else getattr(input.participants, "participant_id", None),
                        "memorySpaceIds": input.participants.get("memorySpaceIds") if isinstance(input.participants, dict) else getattr(input.participants, "memory_space_ids", None),
                    }),
                    "metadata": input.metadata,
                    "visibility": visibility,  # Pass visibility (defaults to 'private' if None)
                    "collaborativeSettings": filter_none_values({
                        "requireApproval": getattr(input.collaborative_settings, "require_approval", None),
                        "ownerUserId": getattr(input.collaborative_settings, "owner_user_id", None),
                        "approvedParticipants": getattr(input.collaborative_settings, "approved_participants", None),
                    }) if input.collaborative_settings else None,  # Phase 4
                }),
            graph_option(options), ),
            "conversations:create",
        graph_write=graph_option(options), )

        # Sync to graph if requested

        return Conversation(**convert_convex_response(result))

    async def get(
        self,
        conversation_id: str,
        options: Optional[GetConversationOptions] = None,
        *, tenant_id: Optional[str] = None,
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
                    "tenantId": resolve_scope(self._tenant_id, tenant_id),  # Multi-tenancy support
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
            lambda: self._mutate_graph(
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
            graph_option(options), ),
            "conversations:addMessage",
        graph_write=graph_option(options), )

        # Update in graph if requested

        return Conversation(**convert_convex_response(result))

    async def list(self, filter: Optional[ListConversationsFilter] = None, *, memory_space_id: Optional[str] = None, user_id: Optional[str] = None, tenant_id: Optional[str] = None, type: Optional[ConversationType] = None, limit: Optional[int] = None, offset: Optional[int] = None, read_options: Optional[DomainReadOptions] = None) -> ListConversationsResult:
        if filter is None:
            filter = ListConversationsFilter(memory_space_id=memory_space_id, user_id=user_id, tenant_id=tenant_id, type=type, limit=limit, offset=offset)
        if filter.type is not None:
            validate_conversation_type(filter.type)
        tenant = resolve_scope(self._tenant_id, filter.tenant_id)
        maximum, skipped = natural(filter.limit, 50), natural(filter.offset, 0)
        if filter.sort_order is not None:
            validate_sort_order(filter.sort_order)
        fields = {"memorySpaceId": filter.memory_space_id, "tenantId": tenant, "userId": filter.user_id, "participantId": filter.participant_id, "type": filter.type, "createdBefore": filter.created_before, "createdAfter": filter.created_after, "updatedBefore": filter.updated_before, "updatedAfter": filter.updated_after, "lastMessageBefore": filter.last_message_before, "lastMessageAfter": filter.last_message_after, "messageCountMin": filter.message_count if filter.message_count is not None else filter.message_count_min, "messageCountMax": filter.message_count if filter.message_count is not None else filter.message_count_max}
        rows = await collect(loader(self.client, "conversations", fields), read_options)
        if filter.sort_by:
            key = filter.sort_by
            rows.sort(key=lambda row: row["messages"][-1]["timestamp"] if key == "lastMessageAt" and row["messages"] else row.get(key, row["createdAt"]), reverse=filter.sort_order != "asc")
        window = rows[skipped:skipped + maximum]
        if filter.include_messages is False:
            window = [{**row, "messages": []} for row in window]
        return ListConversationsResult(conversations=[Conversation(**convert_convex_response(row)) for row in window], total=len(rows), limit=maximum, offset=skipped, has_more=skipped + maximum < len(rows))


    async def count(
        self,
        filter: Optional[CountConversationsFilter] = None,
        *,
        memory_space_id: Optional[str] = None,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        type: Optional[ConversationType] = None,
    ) -> int:
        """
        Count conversations.

        Args:
            filter: Optional filter with type, user_id, memory_space_id
            memory_space_id: Memory space ID to filter by (convenience kwarg)
            user_id: User ID to filter by (convenience kwarg)
            tenant_id: Tenant ID for multi-tenancy filter (convenience kwarg)
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
        if filter is None and any(value is not None for value in [memory_space_id, user_id, tenant_id, type]):
            filter = CountConversationsFilter(
                memory_space_id=memory_space_id,
                user_id=user_id,
                tenant_id=tenant_id,
                type=type,
            )

        if filter and filter.type is not None:
            validate_conversation_type(filter.type)

        context = self._tenant_id
        selected = filter.tenant_id if filter else None
        validate_tenant_id(context)
        validate_tenant_id(selected)
        if context is not None and selected is not None and context != selected:
            raise ValueError("TENANT_SCOPE_MISMATCH")
        selected_tenant = selected if selected is not None else context

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversations:count",
                filter_none_values({
                    "tenantId": selected_tenant,
                    "type": filter.type if filter else None,
                    "userId": filter.user_id if filter else None,
                    "memorySpaceId": filter.memory_space_id if filter else None,
                }),
            ),
            "conversations:count",
        )

        return int(result)

    async def delete(self, conversation_id: str, options: Optional[DeleteConversationOptions] = None, *, tenant_id: Optional[str] = None, read_options: Optional[DomainReadOptions] = None) -> ConversationDeletionResult:
        validate_required_string(conversation_id, "conversation_id")
        tenant = resolve_scope(self._tenant_id, tenant_id)
        selected = [row for row in await select(loader(self.client, "conversations", {"tenantId": tenant, "conversationIds": [conversation_id]}), read_options)]
        if len(selected) > 1:
            raise ValueError("DOMAIN_SCOPE_AMBIGUOUS")
        if not selected:
            raise ValueError("CONVERSATION_NOT_FOUND")
        outcome = await mutate_graph_selected(self.client, "conversations", selected, {"tenantId": tenant}, read_options, self.graph_adapter, self._graph_sync_policy, explicit=graph_option(options))
        return ConversationDeletionResult(deleted=bool(outcome["confirmedCount"]), conversation_id=conversation_id, messages_deleted=selected[0]["document"]["messageCount"] if outcome["confirmedCount"] else 0, deleted_at=int(time.time() * 1000), restorable=False, partial=outcome)


    async def delete_many(self, filter: Dict[str, Any], options: Optional[DeleteManyConversationsOptions] = None, *, read_options: Optional[DomainReadOptions] = None) -> DeleteManyConversationsResult:
        def field(snake: str, camel: str) -> Any:
            if snake in filter and camel in filter and filter[snake] != filter[camel]:
                raise ValueError("DOMAIN_CONFLICTING_FILTER")
            return filter[snake] if snake in filter else filter.get(camel)
        tenant = resolve_scope(self._tenant_id, field("tenant_id", "tenantId"))
        args = {"tenantId": tenant, "memorySpaceId": field("memory_space_id", "memorySpaceId"), "userId": field("user_id", "userId"), "participantId": field("participant_id", "participantId"), "type": filter.get("type")}
        if not any(args[k] is not None for k in ("memorySpaceId", "userId", "type")):
            raise ConversationValidationError("delete_many requires a selected filter", "MISSING_REQUIRED_FIELD")
        if args["type"] is not None:
            validate_conversation_type(args["type"])
        load = loader(self.client, "conversations", args)
        selected = await select(load, read_options)
        if options and options.dry_run:
            return DeleteManyConversationsResult(deleted=0, conversation_ids=[], total_messages_deleted=0, would_delete=len(selected), dry_run=True)
        if options and options.require_confirmation is True and options.confirmation_threshold is None:
            raise ValueError("DOMAIN_CONFIRMATION_REQUIRED")
        threshold = natural(options.confirmation_threshold if options else None, 10)
        if len(selected) > threshold:
            raise ValueError("DELETE_MANY_THRESHOLD_EXCEEDED")
        if not same_selection(selected, await select(load, read_options)):
            raise ValueError("DOMAIN_SELECTION_CHANGED")
        outcome = await mutate_graph_selected(self.client, "conversations", selected, {"tenantId": tenant}, read_options, self.graph_adapter, self._graph_sync_policy, explicit=graph_option(options))
        try:
            remaining = await select(load, read_options)
            if remaining:
                outcome["remainingPhysicalIds"] = [row["physicalId"] for row in remaining]
                raise ValueError("DOMAIN_SELECTION_CHANGED")
        except BaseException as cause:
            raise DomainOperationPartialError("conversations:delete_many", outcome, cause) from cause
        committed = [r for r in selected if r["physicalId"] in outcome["confirmedPhysicalIds"]]
        return DeleteManyConversationsResult(deleted=outcome["confirmedCount"], conversation_ids=[r["document"]["conversationId"] for r in committed], total_messages_deleted=sum(r["document"]["messageCount"] for r in committed), partial=outcome)


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

        # Validate visibility if provided
        visibility = getattr(input, "visibility", None)
        validate_visibility(visibility)

        result = await self._execute_with_resilience(
            lambda: self._mutate_graph(
                "conversations:getOrCreate",
                filter_none_values({
                    "memorySpaceId": input.memory_space_id,
                    "participantId": input.participant_id,
                    "type": input.type,
                    "participants": filter_none_values({
                        "userId": input.participants.get("userId") if isinstance(input.participants, dict) else getattr(input.participants, "user_id", None),
                        "agentId": input.participants.get("agentId") if isinstance(input.participants, dict) else getattr(input.participants, "agent_id", None),
                        "userIds": input.participants.get("userIds") if isinstance(input.participants, dict) else getattr(input.participants, "user_ids", None),  # Phase 4: Collaborative
                        "participantId": input.participants.get("participantId") if isinstance(input.participants, dict) else getattr(input.participants, "participant_id", None),
                        "memorySpaceIds": input.participants.get("memorySpaceIds") if isinstance(input.participants, dict) else getattr(input.participants, "memory_space_ids", None),
                    }),
                    "metadata": input.metadata,
                    "visibility": visibility,  # Pass visibility (defaults to 'private' if None)
                }),
            None, ),
            "conversations:getOrCreate",
        graph_write=None, )

        return Conversation(**convert_convex_response(result))

    async def get_history(
        self,
        conversation_id: str,
        options: Optional[GetHistoryOptions] = None,
        *, tenant_id: Optional[str] = None,
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
                natural(options.limit)
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
                    "tenantId": resolve_scope(self._tenant_id, tenant_id),
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

    async def export(self, format: Literal["json", "csv"], user_id: Optional[str] = None, participant_id: Optional[str] = None, memory_space_id: Optional[str] = None, conversation_ids: Optional[List[str]] = None, type: Optional[ConversationType] = None, date_start: Optional[int] = None, date_end: Optional[int] = None, include_metadata: bool = True, *, tenant_id: Optional[str] = None, read_options: Optional[DomainReadOptions] = None) -> ExportResult:
        validate_export_format(format)
        if type is not None:
            validate_conversation_type(type)
        if conversation_ids is not None:
            validate_non_empty_list(conversation_ids, "conversation_ids")
        validate_timestamp_range(date_start, date_end)
        rows = await collect(loader(self.client, "conversations", {"tenantId": resolve_scope(self._tenant_id, tenant_id), "userId": user_id, "participantId": participant_id, "memorySpaceId": memory_space_id, "conversationIds": conversation_ids, "type": type, "dateStart": date_start, "dateEnd": date_end}), read_options)
        return ExportResult(**convert_convex_response(conversations_export(rows, format, include_metadata)))


    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Visibility & Access Control (Shareable Chats Phase 1)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def check_access(
        self,
        input: CheckAccessInput,
    ) -> CheckAccessResult:
        """
        Check if a user has access to a conversation based on visibility.

        This is a quick, cheap method to check access rights without fetching
        the full conversation data. Use this for access control checks.

        Args:
            input: Access check parameters (conversation_id, user_id, memory_space_id)

        Returns:
            Access check result with can_view, can_edit, reason, and visibility

        Example:
            >>> access = await cortex.conversations.check_access(
            ...     CheckAccessInput(
            ...         conversation_id='conv-abc123',
            ...         user_id='user-456'
            ...     )
            ... )
            >>> if access.can_view:
            ...     # User can access the conversation
            ...     pass
        """
        validate_required_string(input.conversation_id, "conversation_id")

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversations:checkAccess",
                filter_none_values({
                    "conversationId": input.conversation_id,
                    "userId": input.user_id,
                    "memorySpaceId": input.memory_space_id,
                }),
            ),
            "conversations:checkAccess",
        )

        return CheckAccessResult(**convert_convex_response(result))

    async def set_visibility(
        self,
        input: SetVisibilityInput,
    ) -> Conversation:
        """
        Set the visibility of a conversation.

        Only the owner (participants.user_id) can change visibility.

        Args:
            input: Visibility change parameters (conversation_id, visibility)

        Returns:
            Updated conversation

        Example:
            >>> # Make a conversation public
            >>> updated = await cortex.conversations.set_visibility(
            ...     SetVisibilityInput(
            ...         conversation_id='conv-abc123',
            ...         visibility='public'
            ...     )
            ... )
            >>> # Make it space-visible
            >>> await cortex.conversations.set_visibility(
            ...     SetVisibilityInput(
            ...         conversation_id='conv-abc123',
            ...         visibility='space'
            ...     )
            ... )
        """
        validate_required_string(input.conversation_id, "conversation_id")
        validate_visibility(input.visibility)

        # Get user_id from auth context for ownership verification
        user_id = self._auth_context.user_id if self._auth_context else None

        result = await self._execute_with_resilience(
            lambda: self._mutate_graph(
                "conversations:setVisibility",
                filter_none_values({
                    "conversationId": input.conversation_id,
                    "visibility": input.visibility,
                    "userId": user_id,
                }),
            None, ),
            "conversations:setVisibility",
        graph_write=None, )

        return Conversation(**convert_convex_response(result))

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Sharing Grants (Shareable Chats Phase 2)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def share(
        self,
        input: CreateShareInput,
    ) -> CreateShareResult:
        """
        Create a share for a conversation.

        Creates a shareable link or grant for accessing a conversation.
        Returns the share ID which can be used with build_share_url() to create URLs.

        Args:
            input: Share creation parameters

        Returns:
            CreateShareResult with share_id and share details

        Example:
            >>> from cortex.sharing import build_share_url
            >>>
            >>> # Create a public link share
            >>> result = await cortex.conversations.share(
            ...     CreateShareInput(
            ...         conversation_id='conv-abc123',
            ...         grant_type='link',
            ...         permissions={'can_view': True, 'can_fork': True},
            ...         expires_at=int(time.time() * 1000) + 7 * 24 * 60 * 60 * 1000,  # 7 days
            ...     )
            ... )
            >>>
            >>> # Build the URL
            >>> url = build_share_url(result.share_id, base_url='https://myapp.com/shared')
        """
        validate_required_string(input.conversation_id, "conversation_id")
        validate_grant_type(input.grant_type)
        validate_granted_to(input.grant_type, input.granted_to)

        # Default permissions
        perms = input.permissions or {}
        permissions = {
            "canView": perms.get("can_view", True),
            "canViewFacts": perms.get("can_view_facts", False),
            "canViewMemories": perms.get("can_view_memories", False),
            "canContinue": perms.get("can_continue", False),
            "canFork": perms.get("can_fork", False),
            "canExport": perms.get("can_export", False),
        }

        user_id = self._auth_context.user_id if self._auth_context else "anonymous"
        tenant_id = self._tenant_id

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "conversationShares:create",
                filter_none_values({
                    "conversationId": input.conversation_id,
                    "grantedBy": user_id,
                    # Note: sourceMemorySpaceId is derived by the backend from the conversation
                    "grantType": input.grant_type,
                    "grantedTo": input.granted_to,
                    "permissions": permissions,
                    "expiresAt": input.expires_at,
                    "maxViews": input.max_views,
                    "redactBefore": input.redact_before,
                    "redactSensitive": input.redact_sensitive,
                    "tenantId": tenant_id,
                }),
            ),
            "conversationShares:create",
        )

        share = ConversationShare(**convert_convex_response(result))

        return CreateShareResult(
            share_id=share.share_id,
            share=share,
            expires_at=share.expires_at,
        )

    async def revoke_share(
        self,
        share_id: str,
    ) -> RevokeShareResult:
        """
        Revoke an existing share.

        Args:
            share_id: The share ID to revoke

        Returns:
            RevokeShareResult with revocation details

        Example:
            >>> result = await cortex.conversations.revoke_share('share-abc123')
            >>> print(f"Revoked at: {result.revoked_at}")
        """
        validate_required_string(share_id, "share_id")

        user_id = self._auth_context.user_id if self._auth_context else None

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "conversationShares:revoke",
                filter_none_values({
                    "shareId": share_id,
                    "userId": user_id,
                }),
            ),
            "conversationShares:revoke",
        )

        share = ConversationShare(**convert_convex_response(result))

        return RevokeShareResult(
            revoked=True,
            revoked_at=share.revoked_at or int(time.time() * 1000),
            share=share,
        )

    async def list_shares(
        self,
        conversation_id: str,
        status: Optional[ShareStatus] = None,
    ) -> List[ConversationShare]:
        """
        List shares for a conversation.

        Args:
            conversation_id: The conversation ID
            status: Optional filter by share status

        Returns:
            List of ConversationShare records

        Example:
            >>> # List all active shares
            >>> shares = await cortex.conversations.list_shares(
            ...     'conv-abc123',
            ...     status='active'
            ... )
        """
        validate_required_string(conversation_id, "conversation_id")

        if status:
            validate_share_status(status)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversationShares:listByConversation",
                filter_none_values({
                    "conversationId": conversation_id,
                    "status": status,
                }),
            ),
            "conversationShares:listByConversation",
        )

        return [ConversationShare(**convert_convex_response(s)) for s in result]

    async def get_share(
        self,
        share_id: str,
    ) -> Optional[ConversationShare]:
        """
        Get a share by its ID.

        Also validates whether the share is still active and within limits.

        Args:
            share_id: The share ID

        Returns:
            ConversationShare or None if not found

        Example:
            >>> share = await cortex.conversations.get_share('share-abc123')
            >>> if share and share.is_valid:
            ...     # Share is valid and can be used
            ...     pass
        """
        validate_required_string(share_id, "share_id")

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversationShares:get",
                {"shareId": share_id},
            ),
            "conversationShares:get",
        )

        if result is None:
            return None

        return ConversationShare(**convert_convex_response(result))

    async def check_share_access(
        self,
        conversation_id: str,
        user_id: Optional[str] = None,
        memory_space_id: Optional[str] = None,
        email_domain: Optional[str] = None,
    ) -> CheckShareAccessResult:
        """
        Check if a user/space has access to a conversation via share.

        Args:
            conversation_id: The conversation ID
            user_id: Optional user ID to check
            memory_space_id: Optional memory space ID to check
            email_domain: Optional email domain to check

        Returns:
            CheckShareAccessResult with access details

        Example:
            >>> access = await cortex.conversations.check_share_access(
            ...     conversation_id='conv-abc123',
            ...     user_id='user-456'
            ... )
            >>> if access.has_access:
            ...     print('Permissions:', access.permissions)
        """
        validate_required_string(conversation_id, "conversation_id")

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversationShares:checkAccess",
                filter_none_values({
                    "conversationId": conversation_id,
                    "userId": user_id,
                    "memorySpaceId": memory_space_id,
                    "emailDomain": email_domain,
                }),
            ),
            "conversationShares:checkAccess",
        )

        return CheckShareAccessResult(**convert_convex_response(result))

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Snapshots (Shareable Chats Phase 3)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def snapshot(
        self,
        input: CreateSnapshotInput,
    ) -> CreateSnapshotResult:
        """
        Create a snapshot of a conversation.

        Creates an immutable point-in-time copy with optional PII redaction.

        Args:
            input: Snapshot creation parameters

        Returns:
            CreateSnapshotResult with snapshot_id and snapshot details

        Example:
            >>> result = await cortex.conversations.snapshot(
            ...     CreateSnapshotInput(
            ...         conversation_id='conv-abc123',
            ...         redact_pii=True,
            ...     )
            ... )
            >>> print(result.snapshot_id)
        """
        validate_required_string(input.conversation_id, "conversation_id")

        user_id = self._auth_context.user_id if self._auth_context else "anonymous"
        tenant_id = self._tenant_id

        # Convert custom redactions to Convex format
        custom_redactions = None
        if input.custom_redactions:
            custom_redactions = [
                {"pattern": r.pattern, "replacement": r.replacement}
                for r in input.custom_redactions
            ]

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "conversationSnapshots:create",
                filter_none_values({
                    "conversationId": input.conversation_id,
                    "createdBy": user_id,
                    "redactPII": input.redact_pii,
                    "redactBefore": input.redact_before,
                    "customRedactions": custom_redactions,
                    "includeFacts": input.include_facts,
                    "includeMemories": input.include_memories,
                    "tenantId": tenant_id,
                }),
            ),
            "conversationSnapshots:create",
        )

        snapshot = ConversationSnapshot(**convert_convex_response(result))

        return CreateSnapshotResult(
            snapshot_id=snapshot.snapshot_id,
            snapshot=snapshot,
        )

    async def get_snapshot(
        self,
        snapshot_id: str,
    ) -> Optional[ConversationSnapshot]:
        """
        Get a snapshot by ID.

        Args:
            snapshot_id: The snapshot ID

        Returns:
            ConversationSnapshot or None if not found
        """
        validate_required_string(snapshot_id, "snapshot_id")

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversationSnapshots:get",
                {"snapshotId": snapshot_id},
            ),
            "conversationSnapshots:get",
        )

        if result is None:
            return None

        return ConversationSnapshot(**convert_convex_response(result))

    async def list_snapshots(
        self,
        conversation_id: str,
        include_archived: bool = False,
    ) -> List[ConversationSnapshot]:
        """
        List snapshots for a conversation.

        Args:
            conversation_id: The conversation ID
            include_archived: Include archived snapshots

        Returns:
            List of ConversationSnapshot records
        """
        validate_required_string(conversation_id, "conversation_id")

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversationSnapshots:listByConversation",
                filter_none_values({
                    "conversationId": conversation_id,
                    "includeArchived": include_archived if include_archived else None,
                }),
            ),
            "conversationSnapshots:listByConversation",
        )

        return [ConversationSnapshot(**convert_convex_response(s)) for s in result]

    async def delete_snapshot(
        self,
        snapshot_id: str,
    ) -> Dict[str, bool]:
        """
        Delete a snapshot.

        Args:
            snapshot_id: The snapshot ID to delete

        Returns:
            Dict with 'deleted' boolean
        """
        validate_required_string(snapshot_id, "snapshot_id")

        user_id = self._auth_context.user_id if self._auth_context else None

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "conversationSnapshots:deleteSnapshot",
                filter_none_values({
                    "snapshotId": snapshot_id,
                    "userId": user_id,
                }),
            ),
            "conversationSnapshots:deleteSnapshot",
        )

        return {"deleted": bool(result.get("deleted", False)) if result else False}

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Collaborative Conversations (Shareable Chats Phase 4)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def approve_message(
        self,
        input: ApproveMessageInput,
    ) -> Conversation:
        """
        Approve a pending message in a collaborative conversation.

        Only the conversation owner can approve messages.

        Args:
            input: Message approval parameters

        Returns:
            Updated Conversation

        Example:
            >>> await cortex.conversations.approve_message(
            ...     ApproveMessageInput(
            ...         conversation_id='conv-abc123',
            ...         message_id='msg-456',
            ...     )
            ... )
        """
        validate_required_string(input.conversation_id, "conversation_id")
        validate_required_string(input.message_id, "message_id")

        user_id = self._auth_context.user_id if self._auth_context else ""

        result = await self._execute_with_resilience(
            lambda: self._mutate_graph(
                "conversations:approveMessage",
                {
                    "conversationId": input.conversation_id,
                    "messageId": input.message_id,
                    "approverId": user_id,
                },
            None, ),
            "conversations:approveMessage",
        graph_write=None, )

        return Conversation(**convert_convex_response(result))

    async def reject_message(
        self,
        input: ApproveMessageInput,
    ) -> Conversation:
        """
        Reject a pending message in a collaborative conversation.

        Only the conversation owner can reject messages.

        Args:
            input: Message rejection parameters

        Returns:
            Updated Conversation

        Example:
            >>> await cortex.conversations.reject_message(
            ...     ApproveMessageInput(
            ...         conversation_id='conv-abc123',
            ...         message_id='msg-456',
            ...     )
            ... )
        """
        validate_required_string(input.conversation_id, "conversation_id")
        validate_required_string(input.message_id, "message_id")

        user_id = self._auth_context.user_id if self._auth_context else ""

        result = await self._execute_with_resilience(
            lambda: self._mutate_graph(
                "conversations:rejectMessage",
                {
                    "conversationId": input.conversation_id,
                    "messageId": input.message_id,
                    "rejecterId": user_id,
                },
            None, ),
            "conversations:rejectMessage",
        graph_write=None, )

        return Conversation(**convert_convex_response(result))

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

