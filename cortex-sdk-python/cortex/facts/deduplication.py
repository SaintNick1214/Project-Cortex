"""
Cortex SDK - Fact Deduplication Service

Cross-session fact deduplication with configurable strategies:
- exact: Normalized text match (fastest, lowest accuracy)
- structural: Subject + predicate + object match (fast, medium accuracy)
- semantic: Embedding similarity search (slower, highest accuracy)

Python implementation matching TypeScript src/facts/deduplication.ts
"""

import math
import re
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Literal, Optional, Union

from .discovery import collect_candidates

# Type alias for deduplication strategy
DeduplicationStrategy = Literal["none", "exact", "structural", "semantic"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class DeduplicationConfig:
    """Configuration for fact deduplication."""

    strategy: DeduplicationStrategy
    """Deduplication strategy to use."""

    similarity_threshold: float = 0.85
    """
    Similarity threshold for semantic matching (0-1).
    Only used when strategy is 'semantic'.
    """

    generate_embedding: Optional[Callable[[str], Awaitable[List[float]]]] = None
    """
    Function to generate embeddings for semantic matching.
    Required when strategy is 'semantic', otherwise ignored.
    """


@dataclass
class FactCandidate:
    """Candidate fact for deduplication check."""

    fact: str
    fact_type: str
    confidence: int
    subject: Optional[str] = None
    predicate: Optional[str] = None
    object: Optional[str] = None
    tags: Optional[List[str]] = None


@dataclass
class DuplicateResult:
    """Result of duplicate detection."""

    is_duplicate: bool
    """Whether a duplicate was found."""

    existing_fact: Optional[Any] = None
    """The existing fact if a duplicate was found (FactRecord)."""

    similarity_score: Optional[float] = None
    """Similarity score (0-1) for semantic matches, 1.0 for exact/structural."""

    matched_by: Optional[DeduplicationStrategy] = None
    """Which strategy detected the duplicate."""

    should_update: Optional[bool] = None
    """Whether the new fact has higher confidence than existing."""


@dataclass
class StoreWithDedupResult:
    """Result of store with deduplication."""

    fact: Any  # FactRecord
    """The fact record (new or existing)."""

    was_updated: bool
    """Whether an existing fact was updated instead of creating new."""

    deduplication: Optional[Dict[str, Any]] = field(default_factory=lambda: None)
    """Deduplication details."""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Utility Functions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def normalize_fact_text(text: str) -> str:
    """Normalize fact text for exact matching."""
    result = text.lower().strip()
    # Remove punctuation
    result = re.sub(r"[.,!?;:'\"]+", "", result)
    # Remove common words
    result = re.sub(r"\b(the|a|an|is|are|was|were|be|been|being)\b", "", result, flags=re.IGNORECASE)
    # Collapse whitespace AFTER word removal to handle gaps left by removed words
    result = re.sub(r"\s+", " ", result)
    return result.strip()


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    if len(a) != len(b):
        raise ValueError(f"Embedding dimension mismatch: {len(a)} vs {len(b)}")

    dot_product = 0.0
    norm_a = 0.0
    norm_b = 0.0

    for i in range(len(a)):
        dot_product += a[i] * b[i]
        norm_a += a[i] * a[i]
        norm_b += b[i] * b[i]

    magnitude = math.sqrt(norm_a) * math.sqrt(norm_b)
    if magnitude == 0:
        return 0.0

    return dot_product / magnitude


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FactDeduplicationService
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class FactDeduplicationService:
    """
    Service for cross-session fact deduplication.

    Example:
        ```python
        dedup_service = FactDeduplicationService(convex_client)

        # Check for duplicates before storing
        result = await dedup_service.find_duplicate(
            FactCandidate(fact="User prefers dark mode", fact_type="preference", confidence=95),
            "memory-space-1",
            DeduplicationConfig(strategy="semantic", generate_embedding=embed_fn)
        )

        if result.is_duplicate:
            print(f"Found duplicate: {result.existing_fact.fact_id}")
        ```
    """

    def __init__(self, client: Any) -> None:
        """
        Initialize the deduplication service.

        Args:
            client: Convex client instance
        """
        self.client = client

    async def find_duplicate(
        self,
        candidate: FactCandidate,
        memory_space_id: str,
        config: DeduplicationConfig,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> DuplicateResult:
        """
        Find a duplicate fact in the database.

        Args:
            candidate: The fact to check for duplicates
            memory_space_id: Memory space to search in
            config: Deduplication configuration
            user_id: Optional user ID filter

        Returns:
            Duplicate detection result
        """
        # Skip if strategy is 'none'
        if config.strategy == "none":
            return DuplicateResult(is_duplicate=False)

        # Try strategies in order of specificity
        # Structural is most specific, then exact, then semantic

        # 1. Structural match (most reliable)
        if config.strategy == "structural" or config.strategy == "semantic":
            structural_match = await self._find_structural_match(
                candidate, memory_space_id, user_id, tenant_id
            )

            if structural_match:
                return DuplicateResult(
                    is_duplicate=True,
                    existing_fact=structural_match,
                    similarity_score=1.0,
                    matched_by="structural",
                    should_update=candidate.confidence > structural_match.confidence,
                )

        # 2. Exact text match
        if config.strategy == "exact" or config.strategy == "semantic":
            exact_match = await self._find_exact_match(
                candidate, memory_space_id, user_id, tenant_id
            )

            if exact_match:
                return DuplicateResult(
                    is_duplicate=True,
                    existing_fact=exact_match,
                    similarity_score=1.0,
                    matched_by="exact",
                    should_update=candidate.confidence > exact_match.confidence,
                )

        # 3. Semantic similarity (most expensive)
        if config.strategy == "semantic":
            # Check if generate_embedding is available
            if not config.generate_embedding:
                print(
                    "[Cortex] Semantic deduplication requested but no generate_embedding "
                    "function provided. Falling back to structural."
                )
                return DuplicateResult(is_duplicate=False)

            semantic_match = await self._find_semantic_match(
                candidate,
                memory_space_id,
                config.generate_embedding,
                config.similarity_threshold,
                user_id,
                tenant_id,
            )

            if semantic_match:
                return DuplicateResult(
                    is_duplicate=True,
                    existing_fact=semantic_match["fact"],
                    similarity_score=semantic_match["score"],
                    matched_by="semantic",
                    should_update=candidate.confidence > semantic_match["fact"].confidence,
                )

        return DuplicateResult(is_duplicate=False)

    async def _find_structural_match(
        self,
        candidate: FactCandidate,
        memory_space_id: str,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> Optional[Any]:
        """Find a fact with matching subject, predicate, and object."""
        # Only check structural match if we have at least subject AND (predicate OR object)
        if not candidate.subject or (not candidate.predicate and not candidate.object):
            return None

        query_params: Dict[str, Any] = {
            "memorySpaceId": memory_space_id, "subject": candidate.subject,
            "predicate": candidate.predicate, "object": candidate.object,
            "userId": user_id, "tenantId": tenant_id,
        }
        facts = await collect_candidates(self.client, "findByStructure", query_params, 1)
        return facts[0] if facts else None

    async def _find_exact_match(
        self,
        candidate: FactCandidate,
        memory_space_id: str,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> Optional[Any]:
        """Find a fact with matching normalized text."""
        normalized_candidate = normalize_fact_text(candidate.fact)

        # Build query parameters
        query_params: Dict[str, Any] = {
            "memorySpaceId": memory_space_id,
            "factType": candidate.fact_type,
            "tenantId": tenant_id,
        }
        if user_id:
            query_params["userId"] = user_id

        # Get facts for this memory space and optionally filter by user
        facts = await collect_candidates(self.client, "list", query_params, 100)

        if not facts:
            return None

        # Find exact match by normalized text
        for fact in facts:
            normalized_existing = normalize_fact_text(fact.fact)
            if normalized_candidate == normalized_existing:
                return fact

        return None

    async def _find_semantic_match(
        self,
        candidate: FactCandidate,
        memory_space_id: str,
        generate_embedding: Callable[[str], Awaitable[List[float]]],
        threshold: float,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Find a semantically similar fact using embeddings."""
        # Generate embedding for candidate fact
        candidate_embedding = await generate_embedding(candidate.fact)

        # Build query parameters
        query_params: Dict[str, Any] = {
            "memorySpaceId": memory_space_id,
            "factType": candidate.fact_type,
            "tenantId": tenant_id,
        }
        if user_id:
            query_params["userId"] = user_id

        # Get existing facts
        facts = await collect_candidates(self.client, "list", query_params, 50)

        if not facts:
            return None

        best_match: Optional[Dict[str, Any]] = None

        # Compare with each existing fact
        for fact in facts:

            # Generate embedding for existing fact
            existing_embedding = await generate_embedding(fact.fact)

            # Calculate similarity
            score = cosine_similarity(candidate_embedding, existing_embedding)

            if score >= threshold:
                if not best_match or score > best_match["score"]:
                    best_match = {"fact": fact, "score": score}

        return best_match

    @staticmethod
    def get_default_config(
        strategy: DeduplicationStrategy,
        generate_embedding: Optional[Callable[[str], Awaitable[List[float]]]] = None,
    ) -> DeduplicationConfig:
        """Get default deduplication config for a given strategy."""
        return DeduplicationConfig(
            strategy=strategy,
            similarity_threshold=0.85,
            generate_embedding=generate_embedding,
        )

    @staticmethod
    def resolve_config(
        config: Optional[Union[DeduplicationConfig, DeduplicationStrategy]],
        fallback_embedding: Optional[Callable[[str], Awaitable[List[float]]]] = None,
    ) -> DeduplicationConfig:
        """
        Resolve deduplication config with fallbacks.

        If semantic is requested but no embedding function is available,
        falls back to structural.

        Args:
            config: Configuration or strategy string
            fallback_embedding: Fallback embedding function if not in config

        Returns:
            Resolved deduplication configuration
        """
        # Handle string shorthand
        if isinstance(config, str):
            config = DeduplicationConfig(strategy=config)

        # Default to semantic
        if config is None:
            config = DeduplicationConfig(strategy="semantic")

        # Add fallback embedding function if not provided
        if config.generate_embedding is None and fallback_embedding is not None:
            config = DeduplicationConfig(
                strategy=config.strategy,
                similarity_threshold=config.similarity_threshold,
                generate_embedding=fallback_embedding,
            )

        # Fallback from semantic to structural if no embedding function
        if config.strategy == "semantic" and config.generate_embedding is None:
            print(
                "[Cortex] Semantic deduplication requested but no generate_embedding "
                "function available. Falling back to structural strategy."
            )
            return DeduplicationConfig(
                strategy="structural",
                similarity_threshold=config.similarity_threshold,
                generate_embedding=config.generate_embedding,
            )

        return config


__all__ = [
    "DeduplicationStrategy",
    "DeduplicationConfig",
    "FactCandidate",
    "DuplicateResult",
    "StoreWithDedupResult",
    "FactDeduplicationService",
    "normalize_fact_text",
    "cosine_similarity",
]
