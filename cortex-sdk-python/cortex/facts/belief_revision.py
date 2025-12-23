"""
Cortex SDK - Belief Revision Service

Main orchestration service for the belief revision pipeline.
Determines whether a new fact should CREATE, UPDATE, SUPERSEDE, or be IGNORED.

Pipeline flow:
1. Slot matching (fast path)
2. Semantic matching (catch-all)
3. LLM conflict resolution (nuanced decisions)
4. Execute decision
5. Log history
6. Sync to graph
"""

from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine, Dict, List, Literal, Optional, Protocol

from .conflict_prompts import (
    ConflictAction,
    ConflictCandidate,
    ConflictDecision,
    build_conflict_resolution_prompt,
    get_default_decision,
    parse_conflict_decision,
    validate_conflict_decision,
)
from .deduplication import DeduplicationConfig, FactDeduplicationService
from .slot_matching import SlotConflictResult, SlotMatchingConfig, SlotMatchingService

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LLM Client Protocol
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class BeliefRevisionLLMClient(Protocol):
    """
    LLM client interface for belief revision conflict resolution.

    This is separate from the base LLMClient to allow for different
    implementations (e.g., OpenAI, Anthropic) while keeping the
    belief revision logic generic.
    """

    async def complete(
        self,
        *,
        system: str,
        prompt: str,
        model: Optional[str] = None,
        response_format: Optional[Literal["json", "text"]] = None,
    ) -> str:
        """
        Complete a prompt with system and user messages.

        Args:
            system: System prompt
            prompt: User prompt
            model: Optional model override
            response_format: Optional response format hint

        Returns:
            The model's response as a string
        """
        ...


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class SlotMatchingConfigOptions:
    """Configuration for slot matching."""

    enabled: bool = True
    """Enable slot matching"""

    predicate_classes: Optional[Dict[str, List[str]]] = None
    """Custom predicate classes"""


@dataclass
class SemanticMatchingConfigOptions:
    """Configuration for semantic matching."""

    enabled: bool = True
    """Enable semantic matching"""

    threshold: float = 0.7
    """Similarity threshold (lower than dedup's 0.85)"""

    limit: int = 10
    """Max candidates to consider"""

    generate_embedding: Optional[Callable[[str], Coroutine[Any, Any, List[float]]]] = None
    """Embedding function for semantic search"""


@dataclass
class LLMResolutionConfigOptions:
    """Configuration for LLM resolution."""

    enabled: bool = True
    """Enable LLM resolution"""

    model: Optional[str] = None
    """Custom model to use"""


@dataclass
class HistoryConfigOptions:
    """Configuration for history logging."""

    enabled: bool = True
    """Enable history logging"""

    retention_days: int = 90
    """Days to retain history"""


@dataclass
class BeliefRevisionConfig:
    """Configuration for belief revision."""

    slot_matching: Optional[SlotMatchingConfigOptions] = None
    """Slot matching configuration"""

    semantic_matching: Optional[SemanticMatchingConfigOptions] = None
    """Semantic matching configuration"""

    llm_resolution: Optional[LLMResolutionConfigOptions] = None
    """LLM resolution configuration"""

    history: Optional[HistoryConfigOptions] = None
    """History logging configuration"""


@dataclass
class ReviseParams:
    """Parameters for the revise operation."""

    memory_space_id: str
    """Memory space to operate in"""

    fact: ConflictCandidate
    """The new fact to evaluate"""

    user_id: Optional[str] = None
    """Optional user ID filter"""

    participant_id: Optional[str] = None
    """Optional participant ID"""


@dataclass
class PipelineStageResult:
    """Result of a pipeline stage."""

    executed: bool
    """Whether the stage was executed"""

    matched: bool = False
    """Whether matches were found"""

    fact_ids: Optional[List[str]] = None
    """IDs of matched facts"""

    decision: Optional[ConflictAction] = None
    """Decision made (for LLM stage)"""


@dataclass
class ReviseResult:
    """Result of the revise operation."""

    action: ConflictAction
    """The action that was taken"""

    fact: Any  # FactRecord
    """The resulting fact record"""

    superseded: List[Any] = field(default_factory=list)  # List[FactRecord]
    """Facts that were superseded (if any)"""

    reason: str = ""
    """Explanation for the decision"""

    confidence: int = 100
    """Confidence in the decision"""

    pipeline: Dict[str, PipelineStageResult] = field(default_factory=dict)
    """Pipeline stages that were executed"""


@dataclass
class SemanticConflict:
    """A semantic conflict result."""

    fact: Any  # FactRecord
    """The conflicting fact"""

    score: float
    """Similarity score"""


@dataclass
class ConflictCheckResult:
    """Result of conflict check (preview without execution)."""

    has_conflicts: bool
    """Whether conflicts were found"""

    slot_conflicts: List[Any] = field(default_factory=list)  # List[FactRecord]
    """Slot-based conflicts"""

    semantic_conflicts: List[SemanticConflict] = field(default_factory=list)
    """Semantic conflicts"""

    recommended_action: ConflictAction = "ADD"
    """Recommended action (without executing)"""

    reason: str = "No conflicts found"
    """Recommendation reason"""


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BeliefRevisionService
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class BeliefRevisionService:
    """
    Belief revision service for intelligent fact management.

    Example:
        >>> belief_revision = BeliefRevisionService(
        ...     convex_client,
        ...     llm_client,
        ...     graph_adapter,
        ...     BeliefRevisionConfig(
        ...         slot_matching=SlotMatchingConfigOptions(enabled=True),
        ...         semantic_matching=SemanticMatchingConfigOptions(enabled=True, threshold=0.7),
        ...         llm_resolution=LLMResolutionConfigOptions(enabled=True),
        ...     )
        ... )
        >>>
        >>> result = await belief_revision.revise(ReviseParams(
        ...     memory_space_id="space-1",
        ...     fact=ConflictCandidate(
        ...         fact="User prefers purple",
        ...         subject="user-123",
        ...         predicate="favorite color",
        ...         object="purple",
        ...         confidence=90,
        ...     ),
        ... ))
        >>>
        >>> print(f"Action: {result.action}, Reason: {result.reason}")
    """

    def __init__(
        self,
        client: Any,
        llm_client: Optional[BeliefRevisionLLMClient] = None,
        graph_adapter: Optional[Any] = None,
        config: Optional[BeliefRevisionConfig] = None,
    ) -> None:
        """
        Initialize the belief revision service.

        Args:
            client: Convex client instance
            llm_client: Optional LLM client for conflict resolution
            graph_adapter: Optional graph database adapter
            config: Optional configuration
        """
        self._client = client
        self._llm_client = llm_client
        self._graph_adapter = graph_adapter
        self._config = config or BeliefRevisionConfig()

        # Initialize slot matching service
        slot_config = SlotMatchingConfig(
            enabled=self._config.slot_matching.enabled if self._config.slot_matching else True,
            predicate_classes=self._config.slot_matching.predicate_classes if self._config.slot_matching else None,
        )
        self._slot_matcher = SlotMatchingService(client, slot_config)

        # Initialize deduplication service (for semantic matching)
        self._dedup_service = FactDeduplicationService(client)

    async def revise(self, params: ReviseParams) -> ReviseResult:
        """
        Main entry point: evaluate a new fact and determine the appropriate action.

        Args:
            params: Revise parameters including the fact to evaluate

        Returns:
            ReviseResult with action taken and resulting fact
        """
        pipeline_result: Dict[str, PipelineStageResult] = {}
        candidates: List[Any] = []
        action: ConflictAction = "ADD"
        target_fact: Optional[Any] = None
        reason = "No conflicts found - adding new fact"
        confidence = 100

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        # Stage 1: Slot Matching (Fast Path)
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        slot_enabled = self._config.slot_matching.enabled if self._config.slot_matching else True
        if slot_enabled:
            slot_result = await self._find_slot_conflicts(params)
            pipeline_result["slot_matching"] = PipelineStageResult(
                executed=True,
                matched=slot_result.has_conflict,
                fact_ids=[self._get_fact_id(f) for f in slot_result.conflicting_facts],
            )

            if slot_result.has_conflict:
                candidates = slot_result.conflicting_facts

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        # Stage 2: Semantic Matching (if no slot matches)
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        semantic_enabled = self._config.semantic_matching.enabled if self._config.semantic_matching else True
        if len(candidates) == 0 and semantic_enabled:
            semantic_result = await self._find_semantic_conflicts(params)
            pipeline_result["semantic_matching"] = PipelineStageResult(
                executed=True,
                matched=len(semantic_result) > 0,
                fact_ids=[self._get_fact_id(r["fact"]) for r in semantic_result],
            )

            if semantic_result:
                candidates = [r["fact"] for r in semantic_result]

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        # Stage 2.5: Subject + FactType Matching (if no candidates yet)
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if len(candidates) == 0:
            subject_type_candidates = await self._find_subject_type_conflicts(params)
            pipeline_result["subject_type_matching"] = PipelineStageResult(
                executed=True,
                matched=len(subject_type_candidates) > 0,
                fact_ids=[self._get_fact_id(f) for f in subject_type_candidates],
            )

            if subject_type_candidates:
                candidates = subject_type_candidates

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        # Stage 3: LLM Resolution (if candidates found)
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if candidates:
            decision = await self._resolve_with_llm(params.fact, candidates)
            pipeline_result["llm_resolution"] = PipelineStageResult(
                executed=True,
                decision=decision.action,
            )

            action = decision.action
            reason = decision.reason
            confidence = decision.confidence

            if decision.target_fact_id:
                target_fact = next(
                    (f for f in candidates if self._get_fact_id(f) == decision.target_fact_id),
                    None
                )

            # Handle UPDATE with merged fact
            if action == "UPDATE" and decision.merged_fact and target_fact:
                params.fact.fact = decision.merged_fact

        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        # Stage 4: Execute Decision
        # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        execution_result = await self._execute_decision(
            action,
            params,
            target_fact,
            reason,
        )

        return ReviseResult(
            action=action,
            fact=execution_result["fact"],
            superseded=execution_result["superseded"],
            reason=reason,
            confidence=confidence,
            pipeline=pipeline_result,
        )

    async def check_conflicts(self, params: ReviseParams) -> ConflictCheckResult:
        """
        Check for conflicts without executing (preview mode).

        Args:
            params: Revise parameters including the fact to check

        Returns:
            ConflictCheckResult with conflict details and recommended action
        """
        slot_conflicts: List[Any] = []
        semantic_conflicts: List[SemanticConflict] = []

        # Check slot conflicts
        slot_enabled = self._config.slot_matching.enabled if self._config.slot_matching else True
        if slot_enabled:
            slot_result = await self._find_slot_conflicts(params)
            if slot_result.has_conflict:
                slot_conflicts.extend(slot_result.conflicting_facts)

        # Check semantic conflicts
        semantic_enabled = self._config.semantic_matching.enabled if self._config.semantic_matching else True
        if semantic_enabled:
            semantic_result = await self._find_semantic_conflicts(params)
            for r in semantic_result:
                semantic_conflicts.append(SemanticConflict(
                    fact=r["fact"],
                    score=r["score"],
                ))

        # Get recommended action
        all_candidates = slot_conflicts + [c.fact for c in semantic_conflicts]
        unique_candidates = self._deduplicate_facts(all_candidates)

        recommended_action: ConflictAction = "ADD"
        reason = "No conflicts found"

        if unique_candidates:
            decision = await self._resolve_with_llm(params.fact, unique_candidates)
            recommended_action = decision.action
            reason = decision.reason

        return ConflictCheckResult(
            has_conflicts=len(slot_conflicts) > 0 or len(semantic_conflicts) > 0,
            slot_conflicts=slot_conflicts,
            semantic_conflicts=semantic_conflicts,
            recommended_action=recommended_action,
            reason=reason,
        )

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Private: Pipeline Stages
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async def _find_slot_conflicts(self, params: ReviseParams) -> SlotConflictResult:
        """Stage 1: Find slot-based conflicts."""
        return await self._slot_matcher.find_slot_conflicts(
            {
                "subject": params.fact.subject,
                "predicate": params.fact.predicate,
                "object": params.fact.object,
            },
            params.memory_space_id,
            params.user_id,
        )

    async def _find_semantic_conflicts(
        self, params: ReviseParams
    ) -> List[Dict[str, Any]]:
        """Stage 2: Find semantic conflicts."""
        threshold = 0.7
        generate_embedding = None

        if self._config.semantic_matching:
            threshold = self._config.semantic_matching.threshold
            generate_embedding = self._config.semantic_matching.generate_embedding

        config = DeduplicationConfig(
            strategy="semantic" if generate_embedding else "structural",
            similarity_threshold=threshold,
            generate_embedding=generate_embedding,
        )

        from .deduplication import FactCandidate

        result = await self._dedup_service.find_duplicate(
            FactCandidate(
                fact=params.fact.fact,
                fact_type=params.fact.fact_type or "custom",
                confidence=params.fact.confidence,
                subject=params.fact.subject,
                predicate=params.fact.predicate,
                object=params.fact.object,
                tags=params.fact.tags,
            ),
            params.memory_space_id,
            config,
            params.user_id,
        )

        if result.is_duplicate and result.existing_fact:
            return [
                {
                    "fact": result.existing_fact,
                    "score": result.similarity_score or 1.0,
                }
            ]

        return []

    async def _find_subject_type_conflicts(self, params: ReviseParams) -> List[Any]:
        """
        Stage 2.5: Find conflicts by subject + factType.

        This stage catches conflicts that slip through slot and semantic matching
        by querying for facts with the same subject AND factType. For example,
        "User likes blue" and "User prefers purple" both have subject="user" and
        factType="preference", making them candidates for LLM review even if their
        predicates differ.
        """
        from .._utils import filter_none_values

        # Skip if no subject or fact_type - can't match without these
        if not params.fact.subject or not params.fact.fact_type:
            return []

        # Query facts with same subject AND factType
        facts = await self._client.query(
            "facts:list",
            filter_none_values({
                "memorySpaceId": params.memory_space_id,
                "userId": params.user_id,
                "subject": params.fact.subject,
                "factType": params.fact.fact_type,
                "includeSuperseded": False,
                "limit": 20,  # Reasonable limit for LLM processing
            }),
        )

        return facts or []

    async def _resolve_with_llm(
        self,
        new_fact: ConflictCandidate,
        existing_facts: List[Any],
    ) -> ConflictDecision:
        """Stage 3: Resolve conflict with LLM."""
        # If LLM is disabled or unavailable, use default heuristics
        llm_enabled = self._config.llm_resolution.enabled if self._config.llm_resolution else True
        if not llm_enabled or not self._llm_client:
            return get_default_decision(new_fact, existing_facts)

        try:
            # Build prompt
            prompt_result = build_conflict_resolution_prompt(
                new_fact,
                existing_facts,
            )

            # Call LLM
            model = self._config.llm_resolution.model if self._config.llm_resolution else None
            response = await self._llm_client.complete(
                system=prompt_result.system,
                prompt=prompt_result.user,
                model=model,
                response_format="json",
            )

            # Parse response
            decision = parse_conflict_decision(response)

            # Validate decision
            validation = validate_conflict_decision(decision, existing_facts)
            if not validation.valid:
                print(
                    f"[Cortex] LLM decision validation failed: {validation.error}. Falling back to default."
                )
                return get_default_decision(new_fact, existing_facts)

            return decision
        except Exception as error:
            print(
                f"[Cortex] LLM conflict resolution failed: {error}. Falling back to default."
            )
            return get_default_decision(new_fact, existing_facts)

    async def _execute_decision(
        self,
        action: ConflictAction,
        params: ReviseParams,
        target_fact: Optional[Any],
        reason: str,
    ) -> Dict[str, Any]:
        """Stage 4: Execute the decision."""
        from .._utils import filter_none_values

        superseded: List[Any] = []

        if action == "NONE":
            # Return existing fact without changes - NEVER create a new fact for NONE
            # The fact is already captured in the knowledge base
            if target_fact:
                return {"fact": target_fact, "superseded": []}
            # No target_fact means the LLM determined this fact is already captured
            # but didn't specify which existing fact. Return a placeholder result.
            # This can happen when the LLM detects a duplicate concept without
            # identifying the exact existing fact ID.
            return {
                "fact": {
                    "fact_id": None,
                    "fact": params.fact.fact,
                    "skipped": True,
                    "reason": "Fact already captured in knowledge base (NONE action)",
                },
                "superseded": [],
            }

        if action == "UPDATE":
            if target_fact:
                # Update the existing fact in place (no new version created)
                fact_id = self._get_fact_id(target_fact)
                updated = await self._client.mutation(
                    "facts:updateInPlace",
                    filter_none_values({
                        "memorySpaceId": params.memory_space_id,
                        "factId": fact_id,
                        "fact": params.fact.fact,
                        "confidence": params.fact.confidence,
                        "tags": params.fact.tags,
                    }),
                )
                return {"fact": updated, "superseded": []}

        elif action == "SUPERSEDE":
            if target_fact:
                # Create new fact
                new_fact = await self._client.mutation(
                    "facts:store",
                    filter_none_values({
                        "memorySpaceId": params.memory_space_id,
                        "participantId": params.participant_id,
                        "userId": params.user_id,
                        "fact": params.fact.fact,
                        "factType": params.fact.fact_type or "custom",
                        "subject": params.fact.subject,
                        "predicate": params.fact.predicate,
                        "object": params.fact.object,
                        "confidence": params.fact.confidence,
                        "sourceType": "conversation",
                        "tags": params.fact.tags or [],
                    }),
                )

                # Mark old fact as superseded by the new fact
                # This sets both supersededBy and validUntil, and links the facts together
                old_fact_id = self._get_fact_id(target_fact)
                new_fact_id = self._get_fact_id(new_fact)
                await self._client.mutation(
                    "facts:supersede",
                    {
                        "memorySpaceId": params.memory_space_id,
                        "oldFactId": old_fact_id,
                        "newFactId": new_fact_id,
                        "reason": reason,
                    },
                )

                superseded.append(target_fact)
                return {"fact": new_fact, "superseded": superseded}

        # ADD action or fallback: create new fact
        new_fact = await self._client.mutation(
            "facts:store",
            filter_none_values({
                "memorySpaceId": params.memory_space_id,
                "participantId": params.participant_id,
                "userId": params.user_id,
                "fact": params.fact.fact,
                "factType": params.fact.fact_type or "custom",
                "subject": params.fact.subject,
                "predicate": params.fact.predicate,
                "object": params.fact.object,
                "confidence": params.fact.confidence,
                "sourceType": "conversation",
                "tags": params.fact.tags or [],
            }),
        )
        return {"fact": new_fact, "superseded": []}

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Private: Utilities
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def _get_fact_id(self, fact: Any) -> str:
        """Get fact ID from a fact object or dict."""
        if isinstance(fact, dict):
            return fact.get("factId") or fact.get("fact_id") or ""
        return getattr(fact, "fact_id", None) or getattr(fact, "factId", "") or ""

    def _deduplicate_facts(self, facts: List[Any]) -> List[Any]:
        """Remove duplicate facts from array (by factId)."""
        seen: set = set()
        result = []
        for f in facts:
            fact_id = self._get_fact_id(f)
            if fact_id not in seen:
                seen.add(fact_id)
                result.append(f)
        return result

    def get_config(self) -> BeliefRevisionConfig:
        """Get the current configuration."""
        return self._config

    def update_config(self, config: BeliefRevisionConfig) -> None:
        """Update configuration."""
        # Merge configs
        if config.slot_matching:
            if self._config.slot_matching:
                self._config.slot_matching.enabled = config.slot_matching.enabled
                if config.slot_matching.predicate_classes:
                    self._config.slot_matching.predicate_classes = config.slot_matching.predicate_classes
            else:
                self._config.slot_matching = config.slot_matching

        if config.semantic_matching:
            self._config.semantic_matching = config.semantic_matching

        if config.llm_resolution:
            self._config.llm_resolution = config.llm_resolution

        if config.history:
            self._config.history = config.history

        # Reinitialize slot matcher if predicate classes changed
        if config.slot_matching and config.slot_matching.predicate_classes:
            slot_config = SlotMatchingConfig(
                enabled=self._config.slot_matching.enabled if self._config.slot_matching else True,
                predicate_classes=self._config.slot_matching.predicate_classes if self._config.slot_matching else None,
            )
            self._slot_matcher = SlotMatchingService(self._client, slot_config)


__all__ = [
    "BeliefRevisionLLMClient",
    "BeliefRevisionConfig",
    "SlotMatchingConfigOptions",
    "SemanticMatchingConfigOptions",
    "LLMResolutionConfigOptions",
    "HistoryConfigOptions",
    "ReviseParams",
    "ReviseResult",
    "PipelineStageResult",
    "ConflictCheckResult",
    "SemanticConflict",
    "BeliefRevisionService",
    # Re-exports from conflict_prompts
    "ConflictAction",
    "ConflictDecision",
    "ConflictCandidate",
]
