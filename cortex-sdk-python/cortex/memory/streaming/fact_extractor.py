"""
Progressive Fact Extractor

Extracts facts incrementally during streaming with deduplication
to avoid storing redundant information as content accumulates.

Python implementation matching TypeScript src/memory/streaming/FactExtractor.ts
"""

from typing import Any, Callable, Dict, List, Optional

from ..streaming_types import ProgressiveFact


class ProgressiveFactExtractor:
    """Extracts facts progressively during streaming"""

    def __init__(
        self,
        facts_api: Any,
        memory_space_id: str,
        user_id: str,
        participant_id: Optional[str] = None,
        extraction_threshold: int = 500,  # Extract every 500 chars
    ) -> None:
        self.facts_api = facts_api
        self.memory_space_id = memory_space_id
        self.user_id = user_id
        self.participant_id = participant_id
        self.extraction_threshold = extraction_threshold

        self.extracted_facts: Dict[str, Any] = {}
        self.last_extraction_point = 0
        self.extraction_count = 0

    def should_extract(self, content_length: int) -> bool:
        """Check if we should extract facts based on content length"""
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
        """Extract facts from a chunk of content"""
        new_facts: List[ProgressiveFact] = []

        try:
            # Extract facts from current content
            facts_to_store = await extract_facts(user_message, content)

            if not facts_to_store or len(facts_to_store) == 0:
                self.last_extraction_point = len(content)
                return new_facts

            # Store each extracted fact with deduplication
            for fact_data in facts_to_store:
                # Generate a simple key for deduplication
                fact_key = self._generate_fact_key(
                    fact_data["fact"], fact_data.get("subject")
                )

                # Check if we've already stored this fact
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

                # Store new fact
                try:
                    from ...types import (
                        FactSourceRef,
                        StoreFactOptions,
                        StoreFactParams,
                    )

                    stored_fact = await self.facts_api.store(
                        StoreFactParams(
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
                        ),
                        StoreFactOptions(sync_to_graph=sync_to_graph),
                    )

                    # Track this fact
                    self.extracted_facts[fact_key] = stored_fact
                    self.extraction_count += 1

                    new_facts.append(
                        ProgressiveFact(
                            fact_id=stored_fact.fact_id,
                            extracted_at_chunk=chunk_number,
                            confidence=fact_data["confidence"],
                            fact=fact_data["fact"],
                            deduped=False,
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
        Finalize extraction with full content
        Performs final fact extraction and deduplication
        """
        try:
            # Extract facts from complete response
            final_facts_to_store = await extract_facts(user_message, full_agent_response)

            if not final_facts_to_store or len(final_facts_to_store) == 0:
                return list(self.extracted_facts.values())

            # Deduplicate against progressive facts
            unique_final_facts = await self._deduplicate_facts(final_facts_to_store)

            # Store any new facts found in final extraction
            for fact_data in unique_final_facts:
                try:
                    from ...types import (
                        FactSourceRef,
                        StoreFactOptions,
                        StoreFactParams,
                    )

                    stored_fact = await self.facts_api.store(
                        StoreFactParams(
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
                        ),
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
        """Deduplicate facts against already extracted ones"""
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
        Generate a key for fact deduplication
        Simple implementation - could be enhanced with fuzzy matching
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
        Update all extracted facts with final memory reference
        Note: sourceRef cannot be updated after creation, so we just remove progressive tags
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
        """Get all extracted facts"""
        return list(self.extracted_facts.values())

    def get_stats(self) -> Dict[str, float]:
        """Get extraction statistics"""
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
        """Reset extractor state"""
        self.extracted_facts.clear()
        self.last_extraction_point = 0
        self.extraction_count = 0
