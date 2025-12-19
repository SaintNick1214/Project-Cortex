"""
Progressive Fact Extractor

Extracts facts incrementally during streaming with deduplication
to avoid storing redundant information as content accumulates.

Now supports cross-session deduplication via DeduplicationConfig.

Python implementation matching TypeScript src/memory/streaming/FactExtractor.ts
"""

from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Union

from ..streaming_types import ProgressiveFact
from ...facts.deduplication import (
    DeduplicationConfig,
    DeduplicationStrategy,
    FactDeduplicationService,
)


@dataclass
class ProgressiveFactExtractorConfig:
    """Configuration for ProgressiveFactExtractor."""

    deduplication: Optional[Union[DeduplicationConfig, DeduplicationStrategy, bool]] = None
    """
    Deduplication configuration for cross-session fact deduplication.

    - 'semantic': Embedding-based similarity (most accurate, requires generate_embedding)
    - 'structural': Subject + predicate + object match (fast, good accuracy)
    - 'exact': Normalized text match (fastest, lowest accuracy)
    - 'none' or False: In-memory only deduplication (previous behavior)

    Default: 'structural' for streaming (balance of speed and accuracy)
    """

    extraction_threshold: int = 500
    """Character threshold for triggering extraction during streaming."""


class ProgressiveFactExtractor:
    """
    Extracts facts progressively during streaming.

    Supports cross-session deduplication to prevent duplicate facts
    from being stored across multiple conversations.
    """

    def __init__(
        self,
        facts_api: Any,
        memory_space_id: str,
        user_id: str,
        participant_id: Optional[str] = None,
        config: Optional[ProgressiveFactExtractorConfig] = None,
    ) -> None:
        """
        Initialize the progressive fact extractor.

        Args:
            facts_api: FactsAPI instance for storing facts
            memory_space_id: Memory space ID for fact storage
            user_id: User ID for fact ownership
            participant_id: Optional participant ID
            config: Optional configuration including deduplication settings
        """
        self.facts_api = facts_api
        self.memory_space_id = memory_space_id
        self.user_id = user_id
        self.participant_id = participant_id
        self.extraction_threshold = config.extraction_threshold if config else 500

        self.extracted_facts: Dict[str, Any] = {}
        self.last_extraction_point = 0
        self.extraction_count = 0

        # Resolve deduplication config
        # Default to 'structural' for streaming (faster than semantic, still effective)
        self._deduplication_config: Optional[DeduplicationConfig] = None
        if config and config.deduplication is not False:
            dedup_input = config.deduplication if config.deduplication else "structural"
            self._deduplication_config = FactDeduplicationService.resolve_config(dedup_input)
        elif config is None:
            # Default config - use structural deduplication
            self._deduplication_config = FactDeduplicationService.resolve_config("structural")

    def should_extract(self, content_length: int) -> bool:
        """Check if we should extract facts based on content length."""
        return content_length - self.last_extraction_point >= self.extraction_threshold

    async def extract_from_chunk(
        self,
        content: str,
        chunk_number: int,
        extract_facts: Callable,
        user_message: str,
        conversation_id: str,
        sync_to_graph: bool = False,
    ) -> List[ProgressiveFact]:
        """
        Extract facts from a chunk of content.

        Uses cross-session deduplication if configured, otherwise
        falls back to in-memory deduplication.

        Args:
            content: Accumulated content so far
            chunk_number: Current chunk number
            extract_facts: Async function to extract facts from content
            user_message: The user's message
            conversation_id: Conversation ID for source reference
            sync_to_graph: Whether to sync facts to graph database

        Returns:
            List of newly extracted facts
        """
        new_facts: List[ProgressiveFact] = []

        try:
            # Extract facts from current content
            facts_to_store = await extract_facts(user_message, content)

            if not facts_to_store or len(facts_to_store) == 0:
                self.last_extraction_point = len(content)
                return new_facts

            # Store each extracted fact
            for fact_data in facts_to_store:
                # Generate a simple key for in-memory deduplication
                fact_key = self._generate_fact_key(
                    fact_data["fact"], fact_data.get("subject")
                )

                # Check if we've already stored this fact in this session
                if fact_key in self.extracted_facts:
                    # Skip duplicate - might update confidence if higher
                    existing = self.extracted_facts[fact_key]
                    if fact_data["confidence"] > existing.confidence:
                        # Update confidence in database
                        try:
                            await self.facts_api.update(
                                self.memory_space_id,
                                existing.fact_id,
                                {"confidence": fact_data["confidence"]},
                                {"syncToGraph": sync_to_graph},
                            )
                        except Exception as error:
                            print(f"Warning: Failed to update fact confidence: {error}")
                    continue

                # Store new fact (with or without cross-session deduplication)
                try:
                    from ...types import (
                        FactSourceRef,
                        StoreFactParams,
                    )
                    from ...facts import StoreFactWithDedupOptions

                    store_params = StoreFactParams(
                        memory_space_id=self.memory_space_id,
                        participant_id=self.participant_id,
                        user_id=self.user_id,
                        fact=fact_data["fact"],
                        fact_type=fact_data["factType"],
                        subject=fact_data.get("subject", self.user_id),
                        predicate=fact_data.get("predicate"),
                        object=fact_data.get("object"),
                        confidence=fact_data["confidence"],
                        source_type="conversation",
                        source_ref=FactSourceRef(
                            conversation_id=conversation_id, message_ids=[]
                        ),
                        tags=[
                            *(fact_data.get("tags") or []),
                            "progressive",
                            f"chunk-{chunk_number}",
                        ],
                    )

                    # Use store_with_dedup if deduplication is configured
                    if self._deduplication_config:
                        result = await self.facts_api.store_with_dedup(
                            store_params,
                            StoreFactWithDedupOptions(
                                deduplication=self._deduplication_config,
                                sync_to_graph=sync_to_graph,
                            ),
                        )
                        stored_fact = result.fact
                        was_deduped = result.deduplication and result.deduplication.get("matched_existing", False)
                    else:
                        from ...types import StoreFactOptions
                        stored_fact = await self.facts_api.store(
                            store_params,
                            StoreFactOptions(sync_to_graph=sync_to_graph),
                        )
                        was_deduped = False

                    # Track this fact
                    self.extracted_facts[fact_key] = stored_fact
                    self.extraction_count += 1

                    new_facts.append(
                        ProgressiveFact(
                            fact_id=stored_fact.fact_id,
                            extracted_at_chunk=chunk_number,
                            confidence=fact_data["confidence"],
                            fact=fact_data["fact"],
                            deduped=was_deduped,
                        )
                    )

                except Exception as error:
                    print(f"Warning: Failed to store progressive fact: {error}")
                    # Continue with other facts

            self.last_extraction_point = len(content)

        except Exception as error:
            print(f"Warning: Progressive fact extraction failed: {error}")
            # Don't fail the entire stream - fact extraction is optional

        return new_facts

    async def finalize_extraction(
        self,
        user_message: str,
        full_agent_response: str,
        extract_facts: Callable,
        conversation_id: str,
        memory_id: str,
        message_ids: List[str],
        sync_to_graph: bool = False,
    ) -> List[Any]:
        """
        Finalize extraction with full content.

        Performs final fact extraction and deduplication.

        Args:
            user_message: The user's message
            full_agent_response: Complete agent response
            extract_facts: Async function to extract facts
            conversation_id: Conversation ID
            memory_id: Memory ID for source reference
            message_ids: Message IDs for source reference
            sync_to_graph: Whether to sync to graph database

        Returns:
            List of all extracted facts
        """
        try:
            # Extract facts from complete response
            final_facts_to_store = await extract_facts(user_message, full_agent_response)

            if not final_facts_to_store or len(final_facts_to_store) == 0:
                return list(self.extracted_facts.values())

            # Deduplicate against progressive facts (in-memory)
            unique_final_facts = await self._deduplicate_facts(final_facts_to_store)

            # Store any new facts found in final extraction
            for fact_data in unique_final_facts:
                try:
                    from ...types import (
                        FactSourceRef,
                        StoreFactParams,
                    )
                    from ...facts import StoreFactWithDedupOptions

                    store_params = StoreFactParams(
                        memory_space_id=self.memory_space_id,
                        participant_id=self.participant_id,
                        user_id=self.user_id,
                        fact=fact_data["fact"],
                        fact_type=fact_data["factType"],
                        subject=fact_data.get("subject", self.user_id),
                        predicate=fact_data.get("predicate"),
                        object=fact_data.get("object"),
                        confidence=fact_data["confidence"],
                        source_type="conversation",
                        source_ref=FactSourceRef(
                            conversation_id=conversation_id,
                            message_ids=message_ids,
                            memory_id=memory_id,
                        ),
                        tags=fact_data.get("tags", []),
                    )

                    # Use store_with_dedup if deduplication is configured
                    if self._deduplication_config:
                        result = await self.facts_api.store_with_dedup(
                            store_params,
                            StoreFactWithDedupOptions(
                                deduplication=self._deduplication_config,
                                sync_to_graph=sync_to_graph,
                            ),
                        )
                        stored_fact = result.fact
                    else:
                        from ...types import StoreFactOptions
                        stored_fact = await self.facts_api.store(
                            store_params,
                            StoreFactOptions(sync_to_graph=sync_to_graph),
                        )

                    fact_key = self._generate_fact_key(
                        fact_data["fact"], fact_data.get("subject")
                    )
                    self.extracted_facts[fact_key] = stored_fact

                except Exception as error:
                    print(f"Warning: Failed to store final fact: {error}")

            # Update all facts with final memory reference
            await self._update_facts_with_memory_ref(
                memory_id, message_ids, sync_to_graph
            )

            return list(self.extracted_facts.values())

        except Exception as error:
            print(f"Warning: Final fact extraction failed: {error}")
            return list(self.extracted_facts.values())

    async def _deduplicate_facts(self, new_facts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Deduplicate facts against already extracted ones (in-memory)."""
        unique_facts = []

        for fact in new_facts:
            fact_key = self._generate_fact_key(fact["fact"], fact.get("subject"))

            if fact_key not in self.extracted_facts:
                unique_facts.append(fact)
            else:
                # Check if new fact has higher confidence
                existing = self.extracted_facts[fact_key]
                if fact["confidence"] > existing.confidence + 10:
                    # Significantly higher confidence - worth updating
                    unique_facts.append(fact)

        return unique_facts

    def _generate_fact_key(self, fact: str, subject: Optional[str] = None) -> str:
        """
        Generate a key for in-memory fact deduplication.

        This is a simple implementation - cross-session deduplication
        uses more sophisticated matching via FactDeduplicationService.
        """
        # Normalize the fact text
        normalized = fact.lower().strip()

        # Include subject if available for better distinction
        key = f"{subject}::{normalized}" if subject else normalized

        return key

    async def _update_facts_with_memory_ref(
        self, memory_id: str, message_ids: List[str], sync_to_graph: bool
    ) -> None:
        """
        Update all extracted facts with final memory reference.

        Note: sourceRef cannot be updated after creation, so we just remove progressive tags.
        """
        import asyncio

        async def update_fact(fact: Any) -> None:
            try:
                # Remove progressive tag to mark as finalized
                new_tags = [tag for tag in fact.tags if tag != "progressive"]
                await self.facts_api.update(
                    self.memory_space_id,
                    fact.fact_id,
                    {"tags": new_tags},
                    {"syncToGraph": sync_to_graph},
                )
            except Exception as error:
                print(f"Warning: Failed to update fact {fact.fact_id} with memory ref: {error}")

        # Update all facts in parallel
        await asyncio.gather(
            *[update_fact(fact) for fact in self.extracted_facts.values()],
            return_exceptions=True,
        )

    def get_extracted_facts(self) -> List[Any]:
        """Get all extracted facts."""
        return list(self.extracted_facts.values())

    def get_stats(self) -> Dict[str, float]:
        """Get extraction statistics."""
        return {
            "total_facts_extracted": len(self.extracted_facts),
            "extraction_points": self.extraction_count,
            "average_facts_per_extraction": (
                len(self.extracted_facts) / self.extraction_count
                if self.extraction_count > 0
                else 0.0
            ),
        }

    def reset(self) -> None:
        """Reset extractor state."""
        self.extracted_facts.clear()
        self.last_extraction_point = 0
        self.extraction_count = 0


__all__ = [
    "ProgressiveFactExtractor",
    "ProgressiveFactExtractorConfig",
]
