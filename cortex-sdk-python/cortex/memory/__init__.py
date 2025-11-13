"""
Cortex SDK - Memory Convenience API

Layer 4: High-level helpers that orchestrate Layer 1 (ACID) and Layer 2 (Vector) automatically
"""

import time
from typing import Optional, List, Dict, Any, Union, Tuple

from ..types import (
    RememberParams,
    RememberResult,
    RememberStreamParams,
    RememberStreamResult,
    RememberOptions,
    MemoryEntry,
    EnrichedMemory,
    ForgetOptions,
    ForgetResult,
    SearchOptions,
    DeleteMemoryOptions,
    UpdateMemoryOptions,
    SourceType,
    MemoryMetadata,
    MemorySource,
    StoreMemoryInput,
)
from ..errors import CortexError, ErrorCode
from ..conversations import ConversationsAPI
from ..vector import VectorAPI
from ..facts import FactsAPI


class MemoryAPI:
    """
    Memory Convenience API - Layer 4

    High-level interface that manages both ACID conversations and Vector memories automatically.
    This is the recommended API for most use cases.
    """

    def __init__(self, client, graph_adapter=None):
        """
        Initialize Memory API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter
        """
        self.client = client
        self.graph_adapter = graph_adapter
        self.conversations = ConversationsAPI(client, graph_adapter)
        self.vector = VectorAPI(client, graph_adapter)
        self.facts = FactsAPI(client, graph_adapter)

    async def remember(
        self, params: RememberParams, options: Optional[RememberOptions] = None
    ) -> RememberResult:
        """
        Remember a conversation exchange (stores in both ACID and Vector).

        This is the main method for storing conversation memories. It handles both
        ACID storage and Vector indexing automatically.

        Args:
            params: Remember parameters including conversation details
            options: Optional parameters for extraction and graph sync

        Returns:
            RememberResult with conversation details, memories, and extracted facts

        Example:
            >>> result = await cortex.memory.remember(
            ...     RememberParams(
            ...         memory_space_id='agent-1',
            ...         conversation_id='conv-123',
            ...         user_message='The password is Blue',
            ...         agent_response="I'll remember that!",
            ...         user_id='user-1',
            ...         user_name='Alex'
            ...     )
            ... )
            >>> print(len(result.memories))  # 2 (user + agent)
        """
        now = int(time.time() * 1000)
        opts = options or RememberOptions()

        # Determine if we should sync to graph
        should_sync_to_graph = (
            opts.sync_to_graph is not False and self.graph_adapter is not None
        )

        # Step 1: Ensure conversation exists
        from ..types import CreateConversationInput, ConversationParticipants, CreateConversationOptions

        existing_conversation = await self.conversations.get(params.conversation_id)

        if not existing_conversation:
            await self.conversations.create(
                CreateConversationInput(
                    memory_space_id=params.memory_space_id,
                    conversation_id=params.conversation_id,
                    type="user-agent",
                    participants=ConversationParticipants(
                        user_id=params.user_id,
                        participant_id=params.participant_id or "agent",
                    ),
                ),
                CreateConversationOptions(sync_to_graph=should_sync_to_graph),
            )

        # Step 2 & 3: Store user message and agent response in ACID
        from ..types import AddMessageInput, AddMessageOptions

        user_msg = await self.conversations.add_message(
            AddMessageInput(
                conversation_id=params.conversation_id,
                role="user",
                content=params.user_message,
            ),
            AddMessageOptions(sync_to_graph=should_sync_to_graph),
        )

        agent_msg = await self.conversations.add_message(
            AddMessageInput(
                conversation_id=params.conversation_id,
                role="agent",
                content=params.agent_response,
                participant_id=params.participant_id,
            ),
            AddMessageOptions(sync_to_graph=should_sync_to_graph),
        )
        
        # Extract message IDs from the conversation responses
        # user_msg and agent_msg are Conversation objects with messages as dict list
        user_message_id = user_msg.messages[-1]["id"] if isinstance(user_msg.messages[-1], dict) else user_msg.messages[-1].id
        agent_message_id = agent_msg.messages[-1]["id"] if isinstance(agent_msg.messages[-1], dict) else agent_msg.messages[-1].id

        # Step 4: Extract content if provided
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

        # Step 5: Generate embeddings if provided
        user_embedding = None
        agent_embedding = None

        if params.generate_embedding:
            user_embedding = await params.generate_embedding(user_content)
            agent_embedding = await params.generate_embedding(agent_content)

        # Step 6 & 7: Store in Vector with conversationRef
        from ..types import ConversationRef, StoreMemoryOptions

        user_memory = await self.vector.store(
            params.memory_space_id,
            StoreMemoryInput(
                content=user_content,
                content_type=content_type,
                participant_id=params.participant_id,
                embedding=user_embedding,
                user_id=params.user_id,
                source=MemorySource(
                    type="conversation",
                    user_id=params.user_id,
                    user_name=params.user_name,
                    timestamp=now,
                ),
                conversation_ref=ConversationRef(
                    conversation_id=params.conversation_id,
                    message_ids=[user_message_id],
                ),
                metadata=MemoryMetadata(
                    importance=params.importance or 50, tags=params.tags or []
                ),
            ),
            StoreMemoryOptions(sync_to_graph=should_sync_to_graph),
        )

        agent_memory = await self.vector.store(
            params.memory_space_id,
            StoreMemoryInput(
                content=agent_content,
                content_type=content_type,
                participant_id=params.participant_id,
                embedding=agent_embedding,
                user_id=params.user_id,
                source=MemorySource(
                    type="conversation",
                    user_id=params.user_id,
                    user_name=params.user_name,
                    timestamp=now + 1,
                ),
                conversation_ref=ConversationRef(
                    conversation_id=params.conversation_id,
                    message_ids=[agent_message_id],
                ),
                metadata=MemoryMetadata(
                    importance=params.importance or 50, tags=params.tags or []
                ),
            ),
            StoreMemoryOptions(sync_to_graph=should_sync_to_graph),
        )

        # Step 8: Extract and store facts if provided
        extracted_facts = []

        if params.extract_facts:
            try:
                facts_to_store = await params.extract_facts(
                    params.user_message, params.agent_response
                )

                if facts_to_store:
                    from ..types import StoreFactParams, FactSourceRef, StoreFactOptions

                    for fact_data in facts_to_store:
                        try:
                            stored_fact = await self.facts.store(
                                StoreFactParams(
                                    memory_space_id=params.memory_space_id,
                                    participant_id=params.participant_id,
                                    fact=fact_data["fact"],
                                    fact_type=fact_data["factType"],
                                    subject=fact_data.get("subject", params.user_id),
                                    predicate=fact_data.get("predicate"),
                                    object=fact_data.get("object"),
                                    confidence=fact_data["confidence"],
                                    source_type="conversation",
                                    source_ref=FactSourceRef(
                                        conversation_id=params.conversation_id,
                                        message_ids=[
                                            user_message_id,
                                            agent_message_id,
                                        ],
                                        memory_id=user_memory.memory_id,
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

        return RememberResult(
            conversation={
                "messageIds": [user_message_id, agent_message_id],
                "conversationId": params.conversation_id,
            },
            memories=[user_memory, agent_memory],
            facts=extracted_facts,
        )

    async def remember_stream(
        self, params, options: Optional[RememberOptions] = None
    ):
        """
        Remember a conversation exchange from a streaming response.

        This method consumes a stream (AsyncIterable) and stores the conversation
        in both ACID and Vector layers once the stream completes.

        Auto-syncs to graph if configured (default: true).

        Args:
            params: RememberStreamParams with stream parameters
            options: Optional remember options

        Returns:
            RememberStreamResult with remember result and full response text

        Raises:
            Exception: If stream consumption fails or produces no content

        Example:
            >>> # With async generator
            >>> async def stream_response():
            ...     yield "The "
            ...     yield "weather "
            ...     yield "is sunny."
            >>> 
            >>> from cortex.types import RememberStreamParams
            >>> result = await cortex.memory.remember_stream(
            ...     RememberStreamParams(
            ...         memory_space_id='agent-1',
            ...         conversation_id='conv-123',
            ...         user_message='What is the weather?',
            ...         response_stream=stream_response(),
            ...         user_id='user-1',
            ...         user_name='Alex'
            ...     )
            ... )
            >>> print(result.full_response)  # "The weather is sunny."
        """
        from .stream_utils import consume_stream
        from ..types import RememberStreamResult

        # Step 1: Consume the stream to get the full response text
        try:
            agent_response = await consume_stream(params.response_stream)
        except Exception as error:
            raise Exception(
                f"Failed to consume response stream: {str(error)}"
            ) from error

        # Step 2: Validate we got some content
        if not agent_response or agent_response.strip() == "":
            raise Exception(
                "Response stream completed but produced no content. "
                "Cannot store empty response."
            )

        # Step 3: Use the existing remember() method with the complete response
        remember_result = await self.remember(
            RememberParams(
                memory_space_id=params.memory_space_id,
                participant_id=params.participant_id,
                conversation_id=params.conversation_id,
                user_message=params.user_message,
                agent_response=agent_response,
                user_id=params.user_id,
                user_name=params.user_name,
                extract_content=params.extract_content,
                generate_embedding=params.generate_embedding,
                extract_facts=params.extract_facts,
                auto_embed=params.auto_embed,
                auto_summarize=params.auto_summarize,
                importance=params.importance,
                tags=params.tags,
            ),
            options,
        )

        # Step 4: Return the result with the full response
        return RememberStreamResult(
            conversation=remember_result.conversation,
            memories=remember_result.memories,
            facts=remember_result.facts,
            full_response=agent_response,
        )

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
        opts = options or SearchOptions()

        # Search vector
        memories = await self.vector.search(memory_space_id, query, opts)

        if not opts.enrich_conversation:
            return memories

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
        all_facts = await self.facts.list(memory_space_id, limit=10000)

        facts_by_memory_id = {}
        facts_by_conversation_id = {}

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
                        if (msg.get("id") if isinstance(msg, dict) else msg.id) in message_ids
                    ]

            # Add facts
            related_facts = facts_by_memory_id.get(memory.memory_id, [])
            if memory.conversation_ref:
                conv_id = memory.conversation_ref.get("conversation_id") if isinstance(memory.conversation_ref, dict) else memory.conversation_ref.conversation_id
                related_facts.extend(
                    facts_by_conversation_id.get(conv_id, [])
                )

            # Deduplicate facts
            unique_facts = list(
                {fact.fact_id: fact for fact in related_facts}.values()
            )

            if unique_facts:
                result.facts = unique_facts

            enriched.append(result)

        return enriched

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
        # Validate conversationRef requirement
        if input.source.type == "conversation" and not input.conversation_ref:
            raise CortexError(
                ErrorCode.INVALID_INPUT,
                "conversationRef required for source.type='conversation'",
            )

        # Store memory
        memory = await self.vector.store(memory_space_id, input)

        # Extract and store facts if callback provided
        extracted_facts = []

        if hasattr(input, "extract_facts") and input.extract_facts:
            facts_to_store = await input.extract_facts(input.content)

            if facts_to_store:
                from ..types import StoreFactParams, FactSourceRef, StoreFactOptions

                for fact_data in facts_to_store:
                    try:
                        stored_fact = await self.facts.store(
                            StoreFactParams(
                                memory_space_id=memory_space_id,
                                participant_id=input.participant_id,
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
                from ..types import StoreFactParams, FactSourceRef, StoreFactOptions

                for fact_data in facts_to_store:
                    try:
                        stored_fact = await self.facts.store(
                            StoreFactParams(
                                memory_space_id=memory_space_id,
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
        fact_ids = []

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
        return await self.vector.list(
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
        return await self.vector.count(
            memory_space_id, user_id, participant_id, source_type
        )

    async def update_many(
        self, memory_space_id: str, filters: Dict[str, Any], updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update many memories (delegates to vector.update_many)."""
        result = await self.vector.update_many(memory_space_id, filters, updates)

        # Count affected facts
        all_facts = await self.facts.list(memory_space_id, limit=10000)
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
        # Get all memories to delete
        memories = await self.vector.list(memory_space_id, limit=10000)

        total_facts_deleted = 0
        all_fact_ids = []

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
        return await self.vector.export(
            memory_space_id, user_id, format, include_embeddings, include_facts
        )

    async def archive(
        self, memory_space_id: str, memory_id: str
    ) -> Dict[str, Any]:
        """Archive a memory (delegates to vector.archive)."""
        return await self.vector.archive(memory_space_id, memory_id)

    async def get_version(
        self, memory_space_id: str, memory_id: str, version: int
    ) -> Optional[Dict[str, Any]]:
        """Get specific version (delegates to vector.get_version)."""
        return await self.vector.get_version(memory_space_id, memory_id, version)

    async def get_history(
        self, memory_space_id: str, memory_id: str
    ) -> List[Dict[str, Any]]:
        """Get version history (delegates to vector.get_history)."""
        return await self.vector.get_history(memory_space_id, memory_id)

    async def get_at_timestamp(
        self, memory_space_id: str, memory_id: str, timestamp: int
    ) -> Optional[Dict[str, Any]]:
        """Get version at timestamp (delegates to vector.get_at_timestamp)."""
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
        all_facts = await self.facts.list(memory_space_id, limit=10000)

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

        deleted_fact_ids = []
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
        all_facts = await self.facts.list(memory_space_id, limit=10000)

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

