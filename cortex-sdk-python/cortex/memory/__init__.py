"""
Cortex SDK - Memory Convenience API

Layer 4: High-level helpers that orchestrate Layer 1 (ACID) and Layer 2 (Vector) automatically
"""

import asyncio
import time
from typing import Any, Dict, List, Literal, Optional, Tuple, Union, cast

from ..conversations import ConversationsAPI
from ..errors import CortexError, ErrorCode
from ..facts import FactsAPI
from ..llm import ExtractedFact, LLMClient, create_llm_client
from ..types import (
    ConversationType,
    DeleteMemoryOptions,
    EnrichedMemory,
    ForgetOptions,
    ForgetResult,
    LLMConfig,
    MemoryEntry,
    MemoryMetadata,
    MemorySource,
    RememberOptions,
    RememberParams,
    RememberResult,
    SearchOptions,
    SourceType,
    StoreMemoryInput,
    UpdateMemoryOptions,
)
from ..vector import VectorAPI
from .validators import (
    MemoryValidationError,
    validate_content,
    validate_conversation_id,
    validate_conversation_ref_requirement,
    validate_export_format,
    validate_filter_combination,
    validate_importance,
    validate_limit,
    validate_memory_id,
    validate_memory_space_id,
    validate_remember_params,
    validate_search_options,
    validate_source_type,
    validate_store_memory_input,
    validate_stream_object,
    validate_tags,
    validate_timestamp,
    validate_update_options,
    validate_user_id,
    validate_version,
)


class MemoryAPI:
    """
    Memory Convenience API - Layer 4

    High-level interface that manages both ACID conversations and Vector memories automatically.
    This is the recommended API for most use cases.
    """

    def __init__(
        self,
        client: Any,
        graph_adapter: Optional[Any] = None,
        resilience: Optional[Any] = None,
        llm_config: Optional[LLMConfig] = None,
    ) -> None:
        """
        Initialize Memory API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter
            resilience: Optional resilience layer for overload protection
            llm_config: Optional LLM configuration for automatic fact extraction
        """
        self.client = client
        self.graph_adapter = graph_adapter
        self._resilience = resilience
        self._llm_config = llm_config
        self._llm_client: Optional[LLMClient] = None
        # Pass resilience layer to sub-APIs
        self.conversations = ConversationsAPI(client, graph_adapter, resilience)
        self.vector = VectorAPI(client, graph_adapter, resilience)
        self.facts = FactsAPI(client, graph_adapter, resilience)

    async def _execute_with_resilience(
        self,
        operation: Any,
        operation_name: str,
    ) -> Any:
        """Execute an operation through the resilience layer (if available)."""
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

    def _should_skip_layer(self, layer: str, skip_layers: Optional[List[str]]) -> bool:
        """Check if a layer should be skipped during orchestration."""
        return skip_layers is not None and layer in skip_layers

    def _get_llm_client(self) -> Optional[LLMClient]:
        """Get or create LLM client for fact extraction."""
        # Return cached client if already created
        if self._llm_client is not None:
            return self._llm_client

        # Create and cache client
        if self._llm_config:
            self._llm_client = create_llm_client(self._llm_config)

        return self._llm_client

    async def _create_llm_fact_extractor(
        self, user_message: str, agent_response: str
    ) -> Optional[List[ExtractedFact]]:
        """
        Create an LLM-based fact extractor function.

        Uses the configured LLM provider (OpenAI or Anthropic) to automatically
        extract structured facts from conversations. Falls back to None if
        extraction fails or LLM is not properly configured.
        """
        client = self._get_llm_client()
        if not client:
            print(
                "[Cortex] LLM fact extraction configured but client could not be created. "
                "Ensure openai or anthropic is installed."
            )
            return None

        try:
            return await client.extract_facts(user_message, agent_response)
        except Exception as e:
            print(f"[Cortex] LLM fact extraction failed: {e}")
            return None

    def _get_fact_extractor(self, params: RememberParams) -> Optional[Any]:
        """
        Get fact extractor function with fallback chain.

        Priority:
        1. params.extract_facts (explicit callback)
        2. LLM config's extract_facts (if configured)
        3. LLM client's extract_facts (if api_key configured)
        4. None (no fact extraction)
        """
        # Use provided extractor if available
        if params.extract_facts:
            return params.extract_facts

        # Check LLM config for custom extractor
        if self._llm_config and self._llm_config.extract_facts:
            return self._llm_config.extract_facts

        # Check LLM config for API key - use built-in extraction
        if self._llm_config and self._llm_config.api_key:
            return self._create_llm_fact_extractor

        return None

    async def _ensure_user_exists(self, user_id: str, user_name: Optional[str]) -> None:
        """
        Auto-create user profile if it doesn't exist.

        This ensures that user profiles are automatically registered when
        remember() is called, matching the TypeScript SDK behavior.

        Uses immutable:store with type='user' (same as UsersAPI.update).
        """
        try:
            # Check if user exists via immutable:get
            existing = await self.client.query("immutable:get", {"type": "user", "id": user_id})
            if not existing:
                # Create user profile using immutable store pattern
                # This matches TypeScript SDK's UsersAPI.update() which calls api.immutable.store
                await self.client.mutation("immutable:store", {
                    "type": "user",
                    "id": user_id,
                    "data": {
                        "displayName": user_name or user_id,
                        "createdAt": int(time.time() * 1000),
                    },
                })
        except Exception as error:
            # Log warning but don't fail - user registration is optional
            print(f"Warning: Failed to auto-create user profile: {error}")

    async def _ensure_agent_exists(self, agent_id: str) -> None:
        """
        Auto-register agent if it doesn't exist.

        This ensures that agents are automatically registered when
        remember() is called, matching the TypeScript SDK behavior.

        Uses agents:exists query and agents:register mutation.
        """
        try:
            # Check if agent exists using agents:exists query
            existing = await self.client.query("agents:exists", {"agentId": agent_id})
            if not existing:
                # Register agent with minimal data (matching TS SDK's ensureAgentExists)
                try:
                    await self.client.mutation("agents:register", {
                        "agentId": agent_id,
                        "name": agent_id,
                        "description": "Auto-registered by memory.remember()",
                    })
                except Exception as register_error:
                    # Handle "AGENT_ALREADY_REGISTERED" - race condition is OK
                    if "AGENT_ALREADY_REGISTERED" in str(register_error):
                        pass  # Another call registered it first - that's fine
                    else:
                        raise register_error
        except Exception as error:
            # Log warning but don't fail - agent registration is optional
            print(f"Warning: Failed to auto-register agent: {error}")

    async def _ensure_memory_space_exists(self, memory_space_id: str, sync_to_graph: bool = False) -> None:
        """
        Auto-register memory space if it doesn't exist.

        Memory spaces are always auto-created when used - they cannot be skipped.
        Uses memorySpaces:get query and memorySpaces:register mutation.
        """
        try:
            # Check if memory space exists
            existing = await self.client.query("memorySpaces:get", {"memorySpaceId": memory_space_id})
            if not existing:
                # Register memory space with minimal data
                try:
                    await self.client.mutation("memorySpaces:register", {
                        "memorySpaceId": memory_space_id,
                        "name": memory_space_id,
                        "type": "custom",
                    })
                except Exception as register_error:
                    # Handle race condition - another call may have registered it first
                    if "ALREADY_EXISTS" in str(register_error) or "already exists" in str(register_error).lower():
                        pass  # That's fine
                    else:
                        raise register_error
        except Exception as error:
            # Log warning but don't fail
            print(f"Warning: Failed to auto-register memory space: {error}")

    async def remember(
        self, params: RememberParams, options: Optional[RememberOptions] = None
    ) -> RememberResult:
        """
        Remember a conversation exchange (stores in both ACID and Vector).

        This is the main method for storing conversation memories. It handles both
        ACID storage and Vector indexing automatically. All configured layers are
        enabled by default - use skip_layers to explicitly opt-out.

        Args:
            params: Remember parameters including conversation details
            options: Optional parameters for extraction and graph sync

        Returns:
            RememberResult with conversation details, memories, and extracted facts

        Example:
            >>> # Full orchestration (default)
            >>> result = await cortex.memory.remember(
            ...     RememberParams(
            ...         memory_space_id='agent-1',
            ...         conversation_id='conv-123',
            ...         user_message='The password is Blue',
            ...         agent_response="I'll remember that!",
            ...         user_id='user-1',
            ...         user_name='Alex',
            ...         agent_id='assistant-v1',
            ...     )
            ... )
            >>>
            >>> # Skip specific layers
            >>> result = await cortex.memory.remember(
            ...     RememberParams(
            ...         memory_space_id='agent-1',
            ...         conversation_id='conv-456',
            ...         user_message='Quick question',
            ...         agent_response='Quick answer',
            ...         agent_id='assistant-v1',
            ...         skip_layers=['facts', 'graph'],
            ...     )
            ... )
        """
        # Client-side validation
        validate_remember_params(params)

        now = int(time.time() * 1000)
        opts = options or RememberOptions()
        skip_layers = params.skip_layers or []

        # Determine if we should sync to graph (check skipLayers)
        should_sync_to_graph = (
            opts.sync_to_graph is not False
            and self.graph_adapter is not None
            and not self._should_skip_layer("graph", skip_layers)
        )

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        # STEP 1: MEMORYSPACE (Cannot be skipped)
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        await self._ensure_memory_space_exists(params.memory_space_id, should_sync_to_graph)

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        # STEP 2: OWNER PROFILES (skip: 'users'/'agents')
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if params.user_id and not self._should_skip_layer("users", skip_layers):
            await self._ensure_user_exists(params.user_id, params.user_name)

        if params.agent_id and not self._should_skip_layer("agents", skip_layers):
            await self._ensure_agent_exists(params.agent_id)

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        # STEP 3: CONVERSATION (skip: 'conversations')
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        user_message_id = None
        agent_message_id = None

        if not self._should_skip_layer("conversations", skip_layers):
            from ..types import (
                AddMessageInput,
                AddMessageOptions,
                ConversationParticipants,
                CreateConversationInput,
                CreateConversationOptions,
            )

            existing_conversation = await self.conversations.get(params.conversation_id)

            if not existing_conversation:
                # Always use user-agent type for remember() function
                # agent-agent conversations are for explicit multi-agent collaboration
                # and require memorySpaceIds (hive-mode or collaboration-mode)
                conversation_type: ConversationType = "user-agent"
                participants = ConversationParticipants(
                    user_id=params.user_id,
                    agent_id=params.agent_id,
                    participant_id=params.participant_id,
                )

                await self.conversations.create(
                    CreateConversationInput(
                        memory_space_id=params.memory_space_id,
                        conversation_id=params.conversation_id,
                        type=conversation_type,
                        participants=participants,
                    ),
                    CreateConversationOptions(sync_to_graph=should_sync_to_graph),
                )

            # Store user message in ACID
            user_msg = await self.conversations.add_message(
                AddMessageInput(
                    conversation_id=params.conversation_id,
                    role="user",
                    content=params.user_message,
                ),
                AddMessageOptions(sync_to_graph=should_sync_to_graph),
            )

            # Store agent response in ACID
            agent_msg = await self.conversations.add_message(
                AddMessageInput(
                    conversation_id=params.conversation_id,
                    role="agent",
                    content=params.agent_response,
                    participant_id=params.participant_id or params.agent_id,
                ),
                AddMessageOptions(sync_to_graph=should_sync_to_graph),
            )

            # Extract message IDs
            user_message_id = user_msg.messages[-1]["id"] if isinstance(user_msg.messages[-1], dict) else user_msg.messages[-1].id
            agent_message_id = agent_msg.messages[-1]["id"] if isinstance(agent_msg.messages[-1], dict) else agent_msg.messages[-1].id

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        # STEP 4: VECTOR MEMORY (skip: 'vector')
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        stored_memories: List[MemoryEntry] = []

        if not self._should_skip_layer("vector", skip_layers):
            from ..types import ConversationRef, StoreMemoryOptions

            # Extract content if provided
            user_content = params.user_message
            agent_content = params.agent_response
            content_type = "raw"

            if params.extract_content:
                extracted = await params.extract_content(
                    params.user_message, params.agent_response
                )
                if extracted:
                    user_content = extracted
                    content_type = "summarized"

            # Generate embeddings if provided
            user_embedding = None
            agent_embedding = None

            if params.generate_embedding:
                user_embedding = await params.generate_embedding(user_content)
                agent_embedding = await params.generate_embedding(agent_content)

            # Store user message in Vector
            user_memory = await self.vector.store(
                params.memory_space_id,
                StoreMemoryInput(
                    content=user_content,
                    content_type=cast(Literal["raw", "summarized"], content_type),
                    participant_id=params.participant_id,
                    embedding=user_embedding,
                    user_id=params.user_id,
                    agent_id=params.agent_id,
                    message_role="user",
                    source=MemorySource(
                        type="conversation",
                        user_id=params.user_id,
                        user_name=params.user_name,
                        timestamp=now,
                    ),
                    conversation_ref=(
                        ConversationRef(
                            conversation_id=params.conversation_id,
                            message_ids=[user_message_id],
                        )
                        if user_message_id
                        else None
                    ),
                    metadata=MemoryMetadata(
                        importance=params.importance or 50, tags=params.tags or []
                    ),
                ),
                StoreMemoryOptions(sync_to_graph=should_sync_to_graph),
            )
            stored_memories.append(user_memory)

            # Detect if agent response is just an acknowledgment
            agent_content_lower = agent_content.lower()
            is_acknowledgment = len(agent_content) < 80 and any(
                phrase in agent_content_lower
                for phrase in [
                    "got it", "i've noted", "i'll remember", "noted", "understood",
                    "i'll set", "i'll call you", "will do", "sure thing", "okay,", "ok,",
                ]
            )

            # Only store agent response in vector if it contains meaningful information
            if not is_acknowledgment:
                agent_memory = await self.vector.store(
                    params.memory_space_id,
                    StoreMemoryInput(
                        content=agent_content,
                        content_type="raw",
                        participant_id=params.participant_id,
                        embedding=agent_embedding,
                        user_id=params.user_id,
                        agent_id=params.agent_id,
                        message_role="agent",
                        source=MemorySource(
                            type="conversation",
                            user_id=params.user_id,
                            user_name=params.user_name,
                            timestamp=now + 1,
                        ),
                        conversation_ref=(
                            ConversationRef(
                                conversation_id=params.conversation_id,
                                message_ids=[agent_message_id],
                            )
                            if agent_message_id
                            else None
                        ),
                        metadata=MemoryMetadata(
                            importance=params.importance or 50, tags=params.tags or []
                        ),
                    ),
                    StoreMemoryOptions(sync_to_graph=should_sync_to_graph),
                )
                stored_memories.append(agent_memory)

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        # STEP 5: FACTS (skip: 'facts')
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        extracted_facts = []

        if not self._should_skip_layer("facts", skip_layers):
            fact_extractor = self._get_fact_extractor(params)

            if fact_extractor:
                try:
                    facts_to_store = await fact_extractor(
                        params.user_message, params.agent_response
                    )

                    if facts_to_store:
                        from ..types import (
                            FactSourceRef,
                            StoreFactOptions,
                            StoreFactParams,
                        )

                        for fact_data in facts_to_store:
                            try:
                                stored_fact = await self.facts.store(
                                    StoreFactParams(
                                        memory_space_id=params.memory_space_id,
                                        participant_id=params.participant_id,
                                        user_id=params.user_id,
                                        fact=fact_data["fact"],
                                        fact_type=fact_data["factType"],
                                        subject=fact_data.get("subject", params.user_id or params.agent_id),
                                        predicate=fact_data.get("predicate"),
                                        object=fact_data.get("object"),
                                        confidence=fact_data["confidence"],
                                        source_type="conversation",
                                        source_ref=FactSourceRef(
                                            conversation_id=params.conversation_id,
                                            message_ids=(
                                                [user_message_id, agent_message_id]
                                                if user_message_id and agent_message_id
                                                else None
                                            ),
                                            memory_id=stored_memories[0].memory_id if stored_memories else None,
                                        ),
                                        tags=fact_data.get("tags", params.tags or []),
                                    ),
                                    StoreFactOptions(sync_to_graph=should_sync_to_graph),
                                )
                                extracted_facts.append(stored_fact)
                            except Exception as error:
                                print(f"Warning: Failed to store fact: {error}")
                except Exception as error:
                    print(f"Warning: Failed to extract facts: {error}")

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        # STEP 6: GRAPH (handled via syncToGraph in previous steps)
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        # Graph sync is handled inline with each layer via the shouldSyncToGraph flag

        return RememberResult(
            conversation={
                "messageIds": [user_message_id, agent_message_id] if user_message_id and agent_message_id else [],
                "conversationId": params.conversation_id,
            },
            memories=stored_memories,
            facts=extracted_facts,
        )

    async def remember_stream(
        self, params: Any, options: Optional[Any] = None
    ) -> Any:
        """
        Remember a conversation exchange from a streaming response (ENHANCED).

        This method provides true streaming capabilities with:
        - Progressive storage during streaming
        - Real-time fact extraction
        - Streaming hooks for monitoring
        - Error recovery with resume capability
        - Adaptive processing based on stream characteristics
        - Optional chunking for very long responses

        Auto-syncs to graph if configured (default: true).

        Args:
            params: RememberStreamParams with stream parameters
            options: Optional StreamingOptions for advanced features

        Returns:
            EnhancedRememberStreamResult with metrics and progressive processing details

        Example:
            >>> # Basic usage
            >>> result = await cortex.memory.remember_stream({
            ...     'memorySpaceId': 'agent-1',
            ...     'conversationId': 'conv-123',
            ...     'userMessage': 'What is the weather?',
            ...     'responseStream': llm_stream,
            ...     'userId': 'user-1',
            ...     'userName': 'Alex',
            ... })
            >>>
            >>> # With progressive features
            >>> result = await cortex.memory.remember_stream({
            ...     'memorySpaceId': 'agent-1',
            ...     'conversationId': 'conv-123',
            ...     'userMessage': 'Explain quantum computing',
            ...     'responseStream': llm_stream,
            ...     'userId': 'user-1',
            ...     'userName': 'Alex',
            ...     'extractFacts': extract_facts_from_text,
            ... }, {
            ...     'storePartialResponse': True,
            ...     'partialResponseInterval': 3000,
            ...     'progressiveFactExtraction': True,
            ...     'factExtractionThreshold': 500,
            ...     'hooks': {
            ...         'onChunk': lambda event: print(f'Chunk: {event.chunk}'),
            ...         'onProgress': lambda event: print(f'Progress: {event.bytes_processed}'),
            ...     },
            ...     'partialFailureHandling': 'store-partial',
            ... })
        """
        # Client-side validation (skip agent_response since it comes from stream)
        memory_space_id = params.get("memorySpaceId") if isinstance(params, dict) else params.memory_space_id
        conversation_id = params.get("conversationId") if isinstance(params, dict) else params.conversation_id
        user_id = params.get("userId") if isinstance(params, dict) else params.user_id
        user_name = params.get("userName") if isinstance(params, dict) else params.user_name
        agent_id = params.get("agentId") if isinstance(params, dict) else getattr(params, "agent_id", None)
        user_message = params.get("userMessage") if isinstance(params, dict) else params.user_message
        importance = params.get("importance") if isinstance(params, dict) else getattr(params, "importance", None)
        tags = params.get("tags") if isinstance(params, dict) else getattr(params, "tags", None)
        response_stream = params.get("responseStream") if isinstance(params, dict) else params.response_stream
        skip_layers = params.get("skipLayers") if isinstance(params, dict) else getattr(params, "skip_layers", None)

        validate_memory_space_id(str(memory_space_id or ""))
        validate_conversation_id(str(conversation_id or ""))
        validate_content(str(user_message or ""), "user_message")

        # Owner validation
        has_user_id = user_id and isinstance(user_id, str) and str(user_id).strip() != ""
        has_agent_id = agent_id and isinstance(agent_id, str) and str(agent_id).strip() != ""

        # Either user_id or agent_id must be provided
        if not has_user_id and not has_agent_id:
            raise MemoryValidationError(
                "Either user_id or agent_id must be provided for memory ownership. "
                "Use user_id for user-owned memories, agent_id for agent-owned memories.",
                "OWNER_REQUIRED",
                "user_id/agent_id",
            )

        # If user_id is provided, agent_id is required
        if has_user_id and not has_agent_id:
            raise MemoryValidationError(
                "agent_id is required when user_id is provided. "
                "User-agent conversations require both a user and an agent participant.",
                "AGENT_REQUIRED_FOR_USER_CONVERSATION",
                "agent_id",
            )

        # If user_id is provided, user_name is required
        if has_user_id:
            if not user_name or not isinstance(user_name, str) or str(user_name).strip() == "":
                raise MemoryValidationError(
                    "user_name is required when user_id is provided",
                    "MISSING_REQUIRED_FIELD",
                    "user_name",
                )

        if importance is not None:
            validate_importance(importance)

        if tags is not None:
            validate_tags(tags)

        validate_stream_object(response_stream)

        # Import streaming components
        from .streaming import (
            MetricsCollector,
            ProgressiveFactExtractor,
            ProgressiveGraphSync,
            ProgressiveStorageHandler,
            StreamErrorRecovery,
            StreamProcessor,
            create_stream_context,
        )
        from .streaming_types import (
            EnhancedRememberStreamResult,
            PerformanceInsights,
            ProgressiveProcessing,
            StreamingOptions,
        )

        # Parse options - ensure we always have a StreamingOptions object
        if options is None:
            opts = StreamingOptions()
        elif isinstance(options, dict):
            opts = StreamingOptions(**options)
        else:
            opts = options

        # Initialize components
        metrics = MetricsCollector()

        context = create_stream_context(
            memory_space_id=str(memory_space_id or ""),
            conversation_id=str(conversation_id or ""),
            user_id=str(user_id or ""),
            user_name=str(user_name or ""),
        )

        # Progressive storage handler (if enabled)
        storage_handler: Optional[ProgressiveStorageHandler] = None
        if opts and opts.store_partial_response:
            storage_handler = ProgressiveStorageHandler(
                self.client,
                str(memory_space_id or ""),
                str(conversation_id or ""),
                str(user_id or ""),
                opts.partial_response_interval or 3000,
            )

        # Progressive fact extractor (if enabled)
        fact_extractor: Optional[ProgressiveFactExtractor] = None
        extract_facts_fn = params.get("extractFacts") if isinstance(params, dict) else getattr(params, "extract_facts", None)
        if opts and opts.progressive_fact_extraction and extract_facts_fn:
            fact_extractor = ProgressiveFactExtractor(
                self.facts,
                str(memory_space_id or ""),
                str(user_id or ""),
                params.get("participantId") if isinstance(params, dict) else getattr(params, "participant_id", None),
                opts.fact_extraction_threshold or 500,
            )

        # Adaptive processor (if enabled)
        # Note: adaptive_processor currently not integrated, keeping for future use
        # adaptive_processor: Optional[AdaptiveStreamProcessor] = None
        # if opts and opts.enable_adaptive_processing:
        #     adaptive_processor = AdaptiveStreamProcessor()

        # Progressive graph sync (if enabled)
        graph_sync: Optional[ProgressiveGraphSync] = None
        if opts and opts.progressive_graph_sync and self.graph_adapter:
            graph_sync = ProgressiveGraphSync(
                self.graph_adapter,
                opts.graph_sync_interval or 5000,
            )

        # Enhanced hooks that integrate progressive features
        from .streaming_types import ChunkEvent, ProgressEvent, StreamHooks

        original_hooks = opts.hooks if opts else None
        progressive_facts: List[Any] = []

        # Create enhanced hooks that integrate progressive components
        async def enhanced_on_chunk(event: ChunkEvent) -> None:
            # Call original hook if exists
            hook_fn = None
            if original_hooks:
                if isinstance(original_hooks, dict):
                    hook_fn = original_hooks.get("onChunk")
                elif hasattr(original_hooks, 'on_chunk'):
                    hook_fn = original_hooks.on_chunk

            if hook_fn and callable(hook_fn):
                hook_result = hook_fn(event)
                if asyncio.iscoroutine(hook_result):
                    await hook_result

            # Progressive storage update
            if storage_handler and storage_handler.should_update():
                await storage_handler.update_partial_content(
                    event.accumulated, event.chunk_number
                )

            # Progressive fact extraction
            if fact_extractor and fact_extractor.should_extract(len(event.accumulated)):
                user_message_val = params.get("userMessage") if isinstance(params, dict) else params.user_message
                facts = await fact_extractor.extract_from_chunk(
                    event.accumulated,
                    event.chunk_number,
                    extract_facts_fn,  # type: ignore
                    str(user_message_val or ""),
                    str(conversation_id or ""),
                    sync_to_graph=(opts.sync_to_graph if opts else True) and self.graph_adapter is not None,
                )
                progressive_facts.extend(facts)

            # Progressive graph sync update
            if graph_sync and graph_sync.should_sync():
                await graph_sync.update_partial_node(event.accumulated, context)

        async def enhanced_on_progress(event: ProgressEvent) -> None:
            # Call original hook if exists
            hook_fn = None
            if original_hooks:
                if isinstance(original_hooks, dict):
                    hook_fn = original_hooks.get("onProgress")
                elif hasattr(original_hooks, 'on_progress'):
                    hook_fn = original_hooks.on_progress

            if hook_fn and callable(hook_fn):
                hook_result = hook_fn(event)
                if asyncio.iscoroutine(hook_result):
                    await hook_result

        async def enhanced_on_error(event: Any) -> None:
            # Call original hook if exists
            hook_fn = None
            if original_hooks:
                if isinstance(original_hooks, dict):
                    hook_fn = original_hooks.get("onError")
                elif hasattr(original_hooks, 'on_error'):
                    hook_fn = original_hooks.on_error

            if hook_fn and callable(hook_fn):
                hook_result = hook_fn(event)
                if asyncio.iscoroutine(hook_result):
                    await hook_result

        async def enhanced_on_complete(event: Any) -> None:
            # Call original hook if exists
            hook_fn = None
            if original_hooks:
                if isinstance(original_hooks, dict):
                    hook_fn = original_hooks.get("onComplete")
                elif hasattr(original_hooks, 'on_complete'):
                    hook_fn = original_hooks.on_complete

            if hook_fn and callable(hook_fn):
                hook_result = hook_fn(event)
                if asyncio.iscoroutine(hook_result):
                    await hook_result

        enhanced_hooks = StreamHooks(
            on_chunk=enhanced_on_chunk,
            on_progress=enhanced_on_progress,
            on_error=enhanced_on_error,
            on_complete=enhanced_on_complete,
        )

        processor = StreamProcessor(context, enhanced_hooks, metrics)
        error_recovery = StreamErrorRecovery(self.client)

        full_response = ""

        try:
            # Determine if we should sync to graph (check skipLayers)
            should_sync_to_graph = (
                (opts.sync_to_graph if opts else True)
                and self.graph_adapter is not None
                and not self._should_skip_layer("graph", skip_layers)
            )

            # Step 1: Ensure conversation exists (skip if 'conversations' in skipLayers)
            if not self._should_skip_layer("conversations", skip_layers):
                existing_conversation = await self.conversations.get(
                    str(conversation_id or "")
                )
                if not existing_conversation:
                    from ..types import (
                        ConversationParticipants,
                        CreateConversationInput,
                        CreateConversationOptions,
                    )

                    # Always use user-agent type for remember_stream() function
                    # agent-agent conversations are for explicit multi-agent collaboration
                    # and require memorySpaceIds (hive-mode or collaboration-mode)
                    conversation_type: ConversationType = "user-agent"
                    participants = ConversationParticipants(
                        user_id=user_id,
                        agent_id=agent_id,
                        participant_id=params.get("participantId") if isinstance(params, dict) else getattr(params, "participant_id", None),
                    )

                    await self.conversations.create(
                        CreateConversationInput(
                            memory_space_id=str(memory_space_id or ""),
                            conversation_id=str(conversation_id or ""),
                            type=conversation_type,
                            participants=participants,
                        ),
                        CreateConversationOptions(sync_to_graph=should_sync_to_graph),
                    )

            # Step 2: Initialize progressive storage
            if storage_handler:
                user_message_val = params.get("userMessage") if isinstance(params, dict) else params.user_message
                importance_val = params.get("importance") if isinstance(params, dict) else getattr(params, "importance", None)
                partial_memory_id = await storage_handler.initialize_partial_memory(
                    participant_id=params.get("participantId") if isinstance(params, dict) else getattr(params, "participant_id", None),
                    user_message=str(user_message_val or ""),
                    importance=int(importance_val or 50),
                    tags=params.get("tags") if isinstance(params, dict) else getattr(params, "tags", None),
                )
                context.partial_memory_id = partial_memory_id

                # Initialize graph node if enabled
                if graph_sync:
                    await graph_sync.initialize_partial_node({
                        "memoryId": partial_memory_id,
                        "memorySpaceId": params.get("memorySpaceId") if isinstance(params, dict) else params.memory_space_id,
                        "userId": params.get("userId") if isinstance(params, dict) else params.user_id,
                        "content": "[Streaming...]",
                    })

            # Step 3: Process stream with all features
            response_stream = params.get("responseStream") if isinstance(params, dict) else params.response_stream
            full_response = await processor.process_stream(response_stream, opts)  # type: ignore

            # Step 4: Validate we got content
            if not full_response or full_response.strip() == "":
                raise Exception("Response stream completed but produced no content.")

            # Step 5: Finalize storage
            generate_embedding_fn = params.get("generateEmbedding") if isinstance(params, dict) else getattr(params, "generate_embedding", None)
            if storage_handler and storage_handler.is_ready():
                embedding = None
                if generate_embedding_fn:
                    embedding = await generate_embedding_fn(full_response)
                await storage_handler.finalize_memory(full_response, embedding)

            # Step 6: Use remember() for final storage
            # Determine sync_to_graph - default to True if graph adapter exists
            should_sync = (opts.sync_to_graph if opts and hasattr(opts, 'sync_to_graph') else True) and self.graph_adapter is not None

            user_message_val = params.get("userMessage") if isinstance(params, dict) else params.user_message
            remember_result = await self.remember(
                RememberParams(
                    memory_space_id=str(memory_space_id or ""),
                    conversation_id=str(conversation_id or ""),
                    user_message=str(user_message_val or ""),
                    agent_response=full_response,
                    user_id=str(user_id or "") if user_id else None,
                    user_name=str(user_name or "") if user_name else None,
                    agent_id=str(agent_id or "") if agent_id else None,
                    participant_id=params.get("participantId") if isinstance(params, dict) else getattr(params, "participant_id", None),
                    skip_layers=skip_layers,  # Pass through skip_layers
                    extract_content=params.get("extractContent") if isinstance(params, dict) else getattr(params, "extract_content", None),
                    generate_embedding=generate_embedding_fn,
                    extract_facts=extract_facts_fn,
                    auto_embed=params.get("autoEmbed") if isinstance(params, dict) else getattr(params, "auto_embed", None),
                    auto_summarize=params.get("autoSummarize") if isinstance(params, dict) else getattr(params, "auto_summarize", None),
                    importance=params.get("importance") if isinstance(params, dict) else getattr(params, "importance", None),
                    tags=params.get("tags") if isinstance(params, dict) else getattr(params, "tags", None),
                ),
                RememberOptions(sync_to_graph=should_sync),
            )

            # Step 7: Finalize graph sync
            if graph_sync and remember_result.memories:
                await graph_sync.finalize_node(remember_result.memories[0])

            # Step 8: Generate performance insights
            metrics_snapshot = metrics.get_snapshot()
            insights = metrics.generate_insights()

            # Step 9: Return enhanced result
            return EnhancedRememberStreamResult(
                conversation=remember_result.conversation,
                memories=remember_result.memories,
                facts=remember_result.facts,
                full_response=full_response,
                stream_metrics=metrics_snapshot,
                progressive_processing=ProgressiveProcessing(
                    facts_extracted_during_stream=progressive_facts,
                    partial_storage_history=storage_handler.get_update_history() if storage_handler else [],
                    graph_sync_events=graph_sync.get_sync_events() if graph_sync else None,
                ),
                performance=PerformanceInsights(
                    bottlenecks=insights["bottlenecks"],
                    recommendations=insights["recommendations"],
                    cost_estimate=metrics_snapshot.estimated_cost,
                ),
            )

        except Exception as error:
            # Error recovery
            _ = error_recovery.create_stream_error(
                error, context, "streaming"
            )

            # Handle based on strategy
            if opts and opts.partial_failure_handling:
                from .streaming_types import RecoveryOptions

                recovery_result = await error_recovery.handle_stream_error(
                    error,
                    context,
                    RecoveryOptions(
                        strategy=opts.partial_failure_handling,
                        max_retries=opts.max_retries or 3,
                        retry_delay=opts.retry_delay or 1000,
                        preserve_partial_data=True,
                    ),
                )

                if recovery_result.success and opts.generate_resume_token:
                    from .streaming.error_recovery import ResumableStreamError

                    raise ResumableStreamError(
                        error, recovery_result.resume_token or ""
                    )

            # Cleanup on failure
            if storage_handler:
                await storage_handler.rollback()
            if graph_sync:
                await graph_sync.rollback()

            raise

    async def forget(
        self,
        memory_space_id: str,
        memory_id: str,
        options: Optional[ForgetOptions] = None,
    ) -> ForgetResult:
        """
        Forget a memory (delete from Vector and optionally ACID).

        Args:
            memory_space_id: Memory space ID
            memory_id: Memory ID to forget
            options: Optional forget options

        Returns:
            Forget result with deletion details

        Example:
            >>> result = await cortex.memory.forget(
            ...     'agent-1', 'mem-123',
            ...     ForgetOptions(delete_conversation=True)
            ... )
        """
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)

        opts = options or ForgetOptions()

        # Get the memory first
        memory = await self.vector.get(memory_space_id, memory_id)

        if not memory:
            raise CortexError(ErrorCode.MEMORY_NOT_FOUND, f"Memory {memory_id} not found")

        should_sync_to_graph = (
            opts.sync_to_graph is not False and self.graph_adapter is not None
        )

        # Delete from vector
        await self.vector.delete(
            memory_space_id,
            memory_id,
            DeleteMemoryOptions(sync_to_graph=should_sync_to_graph),
        )

        # Cascade delete associated facts
        conv_id = None
        if memory.conversation_ref:
            conv_id = memory.conversation_ref["conversation_id"] if isinstance(memory.conversation_ref, dict) else memory.conversation_ref.conversation_id
        facts_deleted, fact_ids = await self._cascade_delete_facts(
            memory_space_id,
            memory_id,
            conv_id,
            should_sync_to_graph,
        )

        conversation_deleted = False
        messages_deleted = 0

        # Optionally delete from ACID
        if opts.delete_conversation and memory.conversation_ref:
            conv_id = memory.conversation_ref["conversation_id"] if isinstance(memory.conversation_ref, dict) else memory.conversation_ref.conversation_id
            if opts.delete_entire_conversation:
                conv = await self.conversations.get(conv_id)
                messages_deleted = conv.message_count if conv else 0

                from ..types import DeleteConversationOptions

                await self.conversations.delete(
                    conv_id,
                    DeleteConversationOptions(sync_to_graph=should_sync_to_graph),
                )
                conversation_deleted = True
            else:
                msg_ids = memory.conversation_ref["message_ids"] if isinstance(memory.conversation_ref, dict) else memory.conversation_ref.message_ids
                messages_deleted = len(msg_ids)

        return ForgetResult(
            memory_deleted=True,
            conversation_deleted=conversation_deleted,
            messages_deleted=messages_deleted,
            facts_deleted=facts_deleted,
            fact_ids=fact_ids,
            restorable=not opts.delete_conversation,
        )

    async def get(
        self,
        memory_space_id: str,
        memory_id: str,
        include_conversation: bool = False,
    ) -> Optional[Union[MemoryEntry, EnrichedMemory]]:
        """
        Get memory with optional ACID enrichment.

        Args:
            memory_space_id: Memory space ID
            memory_id: Memory ID
            include_conversation: Fetch ACID conversation too

        Returns:
            Memory entry or enriched memory if found, None otherwise

        Example:
            >>> enriched = await cortex.memory.get(
            ...     'agent-1', 'mem-123',
            ...     include_conversation=True
            ... )
        """
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)

        memory = await self.vector.get(memory_space_id, memory_id)

        if not memory:
            return None

        if not include_conversation:
            return memory

        # Fetch conversation and facts
        conversation = None
        source_messages = None

        if memory.conversation_ref:
            # conversation_ref is a dict after conversion
            conv_id = memory.conversation_ref["conversation_id"] if isinstance(memory.conversation_ref, dict) else memory.conversation_ref.conversation_id
            conv = await self.conversations.get(conv_id)
            if conv:
                conversation = conv
                msg_ids = memory.conversation_ref["message_ids"] if isinstance(memory.conversation_ref, dict) else memory.conversation_ref.message_ids
                source_messages = [
                    msg
                    for msg in conv.messages
                    if (msg["id"] if isinstance(msg, dict) else msg.id) in msg_ids
                ]

        # Fetch associated facts
        conv_id = None
        if memory.conversation_ref:
            conv_id = memory.conversation_ref["conversation_id"] if isinstance(memory.conversation_ref, dict) else memory.conversation_ref.conversation_id
        related_facts = await self._fetch_facts_for_memory(
            memory_space_id, memory_id, conv_id
        )

        return EnrichedMemory(
            memory=memory,
            conversation=conversation,
            source_messages=source_messages,
            facts=related_facts if related_facts else None,
        )

    async def search(
        self,
        memory_space_id: str,
        query: str,
        options: Optional[SearchOptions] = None,
    ) -> List[Union[MemoryEntry, EnrichedMemory]]:
        """
        Search memories with optional ACID enrichment.

        Args:
            memory_space_id: Memory space ID
            query: Search query string
            options: Optional search options

        Returns:
            List of matching memories (enriched if requested)

        Example:
            >>> results = await cortex.memory.search(
            ...     'agent-1', 'password',
            ...     SearchOptions(
            ...         min_importance=50,
            ...         limit=10,
            ...         enrich_conversation=True
            ...     )
            ... )
        """
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_content(query, "query")

        if options:
            validate_search_options(options)

        opts = options or SearchOptions()

        # Search vector
        memories = await self.vector.search(memory_space_id, query, opts)

        if not opts.enrich_conversation:
            return memories  # type: ignore[return-value]

        # Batch fetch conversations
        conversation_ids = set()
        for mem in memories:
            if mem.conversation_ref:
                conv_id = mem.conversation_ref.get("conversation_id") if isinstance(mem.conversation_ref, dict) else mem.conversation_ref.conversation_id
                if conv_id:
                    conversation_ids.add(conv_id)

        conversations = {}
        for conv_id in conversation_ids:
            conv = await self.conversations.get(conv_id)
            if conv:
                conversations[conv_id] = conv

        # Batch fetch facts
        from ..types import ListFactsFilter
        all_facts = await self.facts.list(
            ListFactsFilter(memory_space_id=memory_space_id, limit=10000)
        )

        facts_by_memory_id: Dict[str, List[Any]] = {}
        facts_by_conversation_id: Dict[str, List[Any]] = {}

        for fact in all_facts:
            if fact.source_ref and fact.source_ref.memory_id:
                if fact.source_ref.memory_id not in facts_by_memory_id:
                    facts_by_memory_id[fact.source_ref.memory_id] = []
                facts_by_memory_id[fact.source_ref.memory_id].append(fact)

            if fact.source_ref and fact.source_ref.conversation_id:
                if fact.source_ref.conversation_id not in facts_by_conversation_id:
                    facts_by_conversation_id[fact.source_ref.conversation_id] = []
                facts_by_conversation_id[fact.source_ref.conversation_id].append(fact)

        # Enrich results
        enriched = []
        for memory in memories:
            result = EnrichedMemory(memory=memory)

            # Add conversation
            if memory.conversation_ref:
                conv_id = memory.conversation_ref.get("conversation_id") if isinstance(memory.conversation_ref, dict) else memory.conversation_ref.conversation_id
                conv = conversations.get(conv_id)
                if conv:
                    result.conversation = conv
                    message_ids = memory.conversation_ref.get("message_ids") if isinstance(memory.conversation_ref, dict) else memory.conversation_ref.message_ids
                    result.source_messages = [
                        msg
                        for msg in conv.messages
                        if (msg.get("id") if isinstance(msg, dict) else msg.id) in message_ids  # type: ignore[operator]
                    ]

            # Add facts
            related_facts = facts_by_memory_id.get(memory.memory_id, [])
            if memory.conversation_ref:
                conv_id = memory.conversation_ref.get("conversation_id") if isinstance(memory.conversation_ref, dict) else memory.conversation_ref.conversation_id
                related_facts.extend(
                    facts_by_conversation_id.get(conv_id, [])  # type: ignore[arg-type]
                )

            # Deduplicate facts
            unique_facts = list(
                {fact.fact_id: fact for fact in related_facts}.values()
            )

            if unique_facts:
                result.facts = unique_facts

            enriched.append(result)

        return enriched  # type: ignore[return-value]

    async def store(
        self, memory_space_id: str, input: StoreMemoryInput
    ) -> Dict[str, Any]:
        """
        Store memory with smart layer detection.

        Args:
            memory_space_id: Memory space ID
            input: Memory input data

        Returns:
            Store result with memory and facts

        Example:
            >>> result = await cortex.memory.store(
            ...     'agent-1',
            ...     StoreMemoryInput(
            ...         content='User prefers dark mode',
            ...         content_type='raw',
            ...         source=MemorySource(type='system', timestamp=now),
            ...         metadata=MemoryMetadata(importance=60, tags=['preferences'])
            ...     )
            ... )
        """
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_store_memory_input(input)
        validate_conversation_ref_requirement(input.source.type, input.conversation_ref)

        # Store memory
        memory = await self.vector.store(memory_space_id, input)

        # Extract and store facts if callback provided
        extracted_facts = []

        if hasattr(input, "extract_facts") and input.extract_facts:
            facts_to_store = await input.extract_facts(input.content)

            if facts_to_store:
                from ..types import FactSourceRef, StoreFactOptions, StoreFactParams

                for fact_data in facts_to_store:
                    try:
                        stored_fact = await self.facts.store(
                            StoreFactParams(
                                memory_space_id=memory_space_id,
                                participant_id=input.participant_id,
                                user_id=input.user_id,  # BUG FIX: Add userId to facts!
                                fact=fact_data["fact"],
                                fact_type=fact_data["factType"],
                                subject=fact_data.get("subject", input.user_id),
                                predicate=fact_data.get("predicate"),
                                object=fact_data.get("object"),
                                confidence=fact_data["confidence"],
                                source_type=input.source.type,
                                source_ref=FactSourceRef(
                                    conversation_id=(
                                        input.conversation_ref.conversation_id
                                        if input.conversation_ref
                                        else None
                                    ),
                                    message_ids=(
                                        input.conversation_ref.message_ids
                                        if input.conversation_ref
                                        else None
                                    ),
                                    memory_id=memory.memory_id,
                                ),
                                tags=fact_data.get("tags", input.metadata.tags),
                            ),
                            StoreFactOptions(sync_to_graph=True),
                        )
                        extracted_facts.append(stored_fact)
                    except Exception as error:
                        print(f"Warning: Failed to store fact: {error}")

        return {"memory": memory, "facts": extracted_facts}

    async def update(
        self,
        memory_space_id: str,
        memory_id: str,
        updates: Dict[str, Any],
        options: Optional[UpdateMemoryOptions] = None,
    ) -> Dict[str, Any]:
        """
        Update a memory with optional fact re-extraction.

        Args:
            memory_space_id: Memory space ID
            memory_id: Memory ID
            updates: Updates to apply
            options: Optional update options

        Returns:
            Update result with memory and facts

        Example:
            >>> result = await cortex.memory.update(
            ...     'agent-1', 'mem-123',
            ...     {'content': 'Updated content', 'importance': 80}
            ... )
        """
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)
        validate_update_options(updates)

        updated_memory = await self.vector.update(memory_space_id, memory_id, updates)

        facts_reextracted = []

        # Re-extract facts if content changed and reextract requested
        if (
            options
            and options.reextract_facts
            and updates.get("content")
            and options.extract_facts
        ):
            # Delete old facts first
            await self._cascade_delete_facts(
                memory_space_id, memory_id, None, options.sync_to_graph
            )

            # Extract new facts
            facts_to_store = await options.extract_facts(updates["content"])

            if facts_to_store:
                from ..types import FactSourceRef, StoreFactOptions, StoreFactParams

                for fact_data in facts_to_store:
                    try:
                        stored_fact = await self.facts.store(
                            StoreFactParams(
                                memory_space_id=memory_space_id,
                                participant_id=updated_memory.participant_id,  # BUG FIX: Add participantId
                                user_id=updated_memory.user_id,  # BUG FIX: Add userId to facts!
                                fact=fact_data["fact"],
                                fact_type=fact_data["factType"],
                                subject=fact_data.get("subject", updated_memory.user_id),
                                predicate=fact_data.get("predicate"),
                                object=fact_data.get("object"),
                                confidence=fact_data["confidence"],
                                source_type=updated_memory.source_type,
                                source_ref=FactSourceRef(
                                    conversation_id=(
                                        updated_memory.conversation_ref.conversation_id
                                        if updated_memory.conversation_ref
                                        else None
                                    ),
                                    message_ids=(
                                        updated_memory.conversation_ref.message_ids
                                        if updated_memory.conversation_ref
                                        else None
                                    ),
                                    memory_id=updated_memory.memory_id,
                                ),
                                tags=fact_data.get("tags", updated_memory.tags),
                            ),
                            StoreFactOptions(sync_to_graph=options.sync_to_graph),
                        )
                        facts_reextracted.append(stored_fact)
                    except Exception as error:
                        print(f"Warning: Failed to re-extract fact: {error}")

        return {
            "memory": updated_memory,
            "factsReextracted": facts_reextracted if facts_reextracted else None,
        }

    async def delete(
        self,
        memory_space_id: str,
        memory_id: str,
        options: Optional[DeleteMemoryOptions] = None,
    ) -> Dict[str, Any]:
        """
        Delete a memory with cascade delete of facts.

        Args:
            memory_space_id: Memory space ID
            memory_id: Memory ID
            options: Optional delete options

        Returns:
            Deletion result

        Example:
            >>> result = await cortex.memory.delete('agent-1', 'mem-123')
        """
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)

        opts = options or DeleteMemoryOptions()

        memory = await self.vector.get(memory_space_id, memory_id)

        if not memory:
            raise CortexError(ErrorCode.MEMORY_NOT_FOUND, f"Memory {memory_id} not found")

        should_sync_to_graph = (
            opts.sync_to_graph is not False and self.graph_adapter is not None
        )
        should_cascade = opts.cascade_delete_facts

        # Delete facts if cascade enabled
        facts_deleted = 0
        fact_ids: List[str] = []

        if should_cascade:
            conv_id = None
            if memory.conversation_ref:
                conv_id = memory.conversation_ref["conversation_id"] if isinstance(memory.conversation_ref, dict) else memory.conversation_ref.conversation_id
            facts_deleted, fact_ids = await self._cascade_delete_facts(
                memory_space_id,
                memory_id,
                conv_id,
                should_sync_to_graph,
            )

        # Delete from vector
        await self.vector.delete(
            memory_space_id,
            memory_id,
            DeleteMemoryOptions(sync_to_graph=should_sync_to_graph),
        )

        return {
            "deleted": True,
            "memoryId": memory_id,
            "factsDeleted": facts_deleted,
            "factIds": fact_ids,
        }

    # Delegation methods

    async def list(
        self,
        memory_space_id: str,
        user_id: Optional[str] = None,
        participant_id: Optional[str] = None,
        source_type: Optional[SourceType] = None,
        limit: Optional[int] = None,
        enrich_facts: bool = False,
    ) -> List[Union[MemoryEntry, EnrichedMemory]]:
        """List memories (delegates to vector.list)."""
        # Client-side validation
        validate_memory_space_id(memory_space_id)

        if user_id is not None:
            validate_user_id(user_id)

        if source_type is not None:
            validate_source_type(source_type)

        if limit is not None:
            validate_limit(limit)

        return await self.vector.list(  # type: ignore[return-value]
            memory_space_id, user_id, participant_id, source_type, limit, enrich_facts
        )

    async def count(
        self,
        memory_space_id: str,
        user_id: Optional[str] = None,
        participant_id: Optional[str] = None,
        source_type: Optional[SourceType] = None,
    ) -> int:
        """Count memories (delegates to vector.count)."""
        # Client-side validation
        validate_memory_space_id(memory_space_id)

        if user_id is not None:
            validate_user_id(user_id)

        if source_type is not None:
            validate_source_type(source_type)

        return await self.vector.count(
            memory_space_id, user_id, participant_id, source_type
        )

    async def update_many(
        self, memory_space_id: str, filters: Dict[str, Any], updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update many memories (delegates to vector.update_many)."""
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_update_options(updates)

        if filters.get("user_id") is not None:
            validate_user_id(filters["user_id"])

        if filters.get("source_type") is not None:
            validate_source_type(filters["source_type"])

        result = await self.vector.update_many(memory_space_id, filters, updates)

        # Count affected facts
        from ..types import ListFactsFilter
        all_facts = await self.facts.list(
            ListFactsFilter(memory_space_id=memory_space_id, limit=10000)
        )
        affected_facts = [
            fact
            for fact in all_facts
            if fact.source_ref
            and fact.source_ref.memory_id in result.get("memoryIds", [])
        ]

        return {**result, "factsAffected": len(affected_facts)}

    async def delete_many(
        self, memory_space_id: str, filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Delete many memories (delegates to vector.delete_many)."""
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_filter_combination({"memory_space_id": memory_space_id, **filters})

        if filters.get("user_id") is not None:
            validate_user_id(filters["user_id"])

        if filters.get("source_type") is not None:
            validate_source_type(filters["source_type"])

        # Get all memories to delete
        memories = await self.vector.list(memory_space_id, limit=10000)

        total_facts_deleted = 0
        all_fact_ids: List[str] = []

        # Cascade delete facts for each memory
        for memory in memories:
            facts_deleted, fact_ids = await self._cascade_delete_facts(
                memory_space_id,
                memory.memory_id,
                memory.conversation_ref.conversation_id if memory.conversation_ref else None,
                True,
            )
            total_facts_deleted += facts_deleted
            all_fact_ids.extend(fact_ids)

        # Delete memories
        result = await self.vector.delete_many(memory_space_id, filters)

        return {
            **result,
            "factsDeleted": total_facts_deleted,
            "factIds": all_fact_ids,
        }

    async def export(
        self,
        memory_space_id: str,
        user_id: Optional[str] = None,
        format: str = "json",
        include_embeddings: bool = False,
        include_facts: bool = False,
    ) -> Dict[str, Any]:
        """Export memories (delegates to vector.export)."""
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_export_format(format)

        if user_id is not None:
            validate_user_id(user_id)

        return await self.vector.export(
            memory_space_id, user_id, format, include_embeddings, include_facts
        )

    async def archive(
        self, memory_space_id: str, memory_id: str
    ) -> Dict[str, Any]:
        """Archive a memory (delegates to vector.archive)."""
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)

        return await self.vector.archive(memory_space_id, memory_id)

    async def restore_from_archive(
        self, memory_space_id: str, memory_id: str
    ) -> Dict[str, Any]:
        """
        Restore memory from archive.

        Args:
            memory_space_id: Memory space ID
            memory_id: Memory ID to restore

        Returns:
            Restore result

        Example:
            >>> restored = await cortex.memory.restore_from_archive('agent-1', 'mem-123')
            >>> print(f"Restored: {restored['restored']}")
        """
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)

        result = await self.client.mutation(
            "memories:restoreFromArchive",
            {"memorySpaceId": memory_space_id, "memoryId": memory_id},
        )

        return cast(Dict[str, Any], result)

    async def get_version(
        self, memory_space_id: str, memory_id: str, version: int
    ) -> Optional[Dict[str, Any]]:
        """Get specific version (delegates to vector.get_version)."""
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)
        validate_version(version)

        return await self.vector.get_version(memory_space_id, memory_id, version)

    async def get_history(
        self, memory_space_id: str, memory_id: str
    ) -> List[Dict[str, Any]]:
        """Get version history (delegates to vector.get_history)."""
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)

        return await self.vector.get_history(memory_space_id, memory_id)

    async def get_at_timestamp(
        self, memory_space_id: str, memory_id: str, timestamp: int
    ) -> Optional[Dict[str, Any]]:
        """Get version at timestamp (delegates to vector.get_at_timestamp)."""
        # Client-side validation
        validate_memory_space_id(memory_space_id)
        validate_memory_id(memory_id)
        validate_timestamp(timestamp)

        return await self.vector.get_at_timestamp(memory_space_id, memory_id, timestamp)

    # Helper methods

    async def _cascade_delete_facts(
        self,
        memory_space_id: str,
        memory_id: str,
        conversation_id: Optional[str],
        sync_to_graph: Optional[bool],
    ) -> Tuple[int, List[str]]:
        """Helper: Find and cascade delete facts linked to a memory."""
        from ..types import ListFactsFilter
        all_facts = await self.facts.list(
            ListFactsFilter(memory_space_id=memory_space_id, limit=10000)
        )

        facts_to_delete = [
            fact
            for fact in all_facts
            if (
                fact.source_ref
                and (
                    fact.source_ref.memory_id == memory_id
                    or (
                        conversation_id
                        and fact.source_ref.conversation_id == conversation_id
                    )
                )
            )
        ]

        deleted_fact_ids: List[str] = []
        for fact in facts_to_delete:
            try:
                from ..types import DeleteFactOptions

                await self.facts.delete(
                    memory_space_id,
                    fact.fact_id,
                    DeleteFactOptions(sync_to_graph=sync_to_graph),
                )
                deleted_fact_ids.append(fact.fact_id)
            except Exception as error:
                print(f"Warning: Failed to delete linked fact: {error}")

        return len(deleted_fact_ids), deleted_fact_ids

    async def _fetch_facts_for_memory(
        self,
        memory_space_id: str,
        memory_id: str,
        conversation_id: Optional[str],
    ) -> List:
        """Helper: Fetch facts for a memory or conversation."""
        from ..types import ListFactsFilter
        all_facts = await self.facts.list(
            ListFactsFilter(memory_space_id=memory_space_id, limit=10000)
        )

        return [
            fact
            for fact in all_facts
            if (
                fact.source_ref
                and (
                    fact.source_ref.memory_id == memory_id
                    or (
                        conversation_id
                        and fact.source_ref.conversation_id == conversation_id
                    )
                )
            )
        ]

