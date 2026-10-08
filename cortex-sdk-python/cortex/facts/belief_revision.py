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
from uuid import uuid4

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
from .discovery import collect_candidates
from .history import (
    FactChangePipeline,
    FactHistoryService,
    HistoryReceipt,
    HistoryWriteAfterCommitError,
    LogEventParams,
    RevisionAfterCommitError,
    definite_backend_failure,
    execute_fact_mutation,
)
from .slot_matching import SlotConflictResult, SlotMatchingConfig, SlotMatchingService

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LLM Client Protocol
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class DecisionLogError(RuntimeError):
    committed = False
    phase = "decision_log"

    def __init__(self, cause: Exception) -> None:
        super().__init__("Decision history publication failed")
        self.original_cause = cause


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

    tenant_id: Optional[str] = None
    operation_id: Optional[str] = None
    conversation_id: Optional[str] = None
    source_ref: Optional[Dict[str, Any]] = None


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
        graph_sync_policy: Optional[Any] = None,
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
        self._graph_sync_policy = graph_sync_policy
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
        operation_id = params.operation_id or str(uuid4())
        intent = {"operationId": operation_id, "phase": "revision", "reason": reason, "confidence": confidence,
                  "pipeline": {"slotMatching": pipeline_result.get("slot_matching", PipelineStageResult(executed=False)).executed,
                               "semanticMatching": pipeline_result.get("semantic_matching", PipelineStageResult(executed=False)).executed,
                               "llmResolution": pipeline_result.get("llm_resolution", PipelineStageResult(executed=False)).executed},
                  "userId": params.user_id, "participantId": params.participant_id,
                  "conversationId": params.conversation_id or (params.source_ref or {}).get("conversationId")}
        from .._utils import filter_none_values

        intent = filter_none_values(intent)
        execution_result = await self._execute_decision(action, params, target_fact, reason, intent)
        history = FactHistoryService(self._client)
        fact = execution_result["fact"]
        receipt_wire = fact.get("historyReceipt") if isinstance(fact, dict) else None
        if receipt_wire:
            receipt = HistoryReceipt.from_wire(receipt_wire)
            try:
                await history.retry_history(receipt)
            except Exception as error:
                raise HistoryWriteAfterCommitError(receipt, filter_none_values({"tenantId": params.tenant_id, "memorySpaceId": params.memory_space_id}), error) from error
        elif action == "NONE" and self._get_fact_id(fact):
            try:
                await history.log(LogEventParams(fact_id=self._get_fact_id(fact), memory_space_id=params.memory_space_id, tenant_id=params.tenant_id,
                    source_fact_id=self._document_id(fact), action="UPDATE", new_value=self._fact_text(fact), reason=reason, confidence=confidence,
                    pipeline=FactChangePipeline(slot_matching=intent["pipeline"]["slotMatching"], semantic_matching=intent["pipeline"]["semanticMatching"], llm_resolution=intent["pipeline"]["llmResolution"]),
                    user_id=params.user_id, participant_id=params.participant_id, conversation_id=intent.get("conversationId"), operation_id=operation_id))
            except Exception as error:
                raise DecisionLogError(error) from error

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
            params.tenant_id,
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
            params.tenant_id,
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
        # Skip if no subject or fact_type - can't match without these
        if not params.fact.subject or not params.fact.fact_type:
            return []

        return await collect_candidates(self._client, "list", {
            "memorySpaceId": params.memory_space_id, "tenantId": params.tenant_id,
            "userId": params.user_id, "subject": params.fact.subject,
            "factType": params.fact.fact_type, "includeSuperseded": False,
        }, 20)

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
        self, action: ConflictAction, params: ReviseParams, target_fact: Optional[Any],
        reason: str, intent: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Freeze intent before writes; link and publication retries never rerun matching."""
        from .._utils import filter_none_values

        history = FactHistoryService(self._client)
        scope = filter_none_values({"tenantId": params.tenant_id, "memorySpaceId": params.memory_space_id})
        if action == "NONE":
            return {"fact": target_fact or {"fact_id": None, "fact": params.fact.fact, "skipped": True, "reason": "Fact already captured in knowledge base (NONE action)"}, "superseded": []}
        if action == "UPDATE" and target_fact:
            updated = await execute_fact_mutation(self._client, "facts:updateInPlace", filter_none_values({**scope,
                "factId": self._get_fact_id(target_fact), "expectedSourceFactId": self._document_id(target_fact),
                "historyIntent": {**intent, "phase": "revision_update"}, "fact": params.fact.fact,
                "confidence": params.fact.confidence, "tags": params.fact.tags}), history, "revision_update", graph_adapter=self._graph_adapter, graph_sync_policy=self._graph_sync_policy)
            return {"fact": updated, "superseded": []}
        new_fact = await execute_fact_mutation(self._client, "facts:store", filter_none_values({**scope,
            "participantId": params.participant_id, "userId": params.user_id,
            "fact": params.fact.fact, "factType": params.fact.fact_type or "custom",
            "subject": params.fact.subject, "predicate": params.fact.predicate, "object": params.fact.object,
            "confidence": params.fact.confidence, "sourceType": "conversation", "sourceRef": params.source_ref,
            "tags": params.fact.tags or [], "historyIntent": {**intent, "phase": "revision_store"}}), history, "revision_store", graph_adapter=self._graph_adapter, graph_sync_policy=self._graph_sync_policy)
        if action == "SUPERSEDE" and target_fact:
            link_args = filter_none_values({**scope, "oldFactId": self._get_fact_id(target_fact), "newFactId": self._get_fact_id(new_fact),
                "expectedOldFactId": self._document_id(target_fact), "expectedNewFactId": self._document_id(new_fact),
                "reason": reason, "historyIntent": {**intent, "phase": "revision_link"}})
            try:
                from ..graph.erasure import write_graph_mutation
                linked = await write_graph_mutation(self._client, self._graph_adapter, self._graph_sync_policy, "facts:supersede", link_args)
            except Exception as error:
                store_anchor = HistoryReceipt.from_wire(new_fact["historyReceipt"]) if new_fact.get("historyReceipt") else None
                raise RevisionAfterCommitError({"store": {"committed": True, "createdFactId": self._get_fact_id(new_fact), "createdDocumentId": self._document_id(new_fact), "storeAnchor": store_anchor},
                    "link": {"committed": False} if definite_backend_failure(error) else {"outcome": "unknown"},
                    "scope": scope, "intent": intent, "expectedOldFactId": self._document_id(target_fact), "expectedNewFactId": self._document_id(new_fact)}, error) from error
            fact = linked.get("fact") or new_fact
            if linked.get("historyReceipt"):
                fact["historyReceipt"] = linked["historyReceipt"]
            # Store CREATE is independently retained. Publish its original anchor too.
            if new_fact.get("historyReceipt"):
                store_receipt = HistoryReceipt.from_wire(new_fact["historyReceipt"])
                try:
                    await history.retry_history(store_receipt)
                except Exception as error:
                    link_receipt = HistoryReceipt.from_wire(linked["historyReceipt"])
                    combined = HistoryReceipt(store_receipt.events + link_receipt.events, tuple(dict.fromkeys(store_receipt.affected_fact_ids + link_receipt.affected_fact_ids)), link_receipt.result_fact_id)
                    raise HistoryWriteAfterCommitError(combined, scope, error) from error
            return {"fact": fact, "superseded": [target_fact]}
        return {"fact": new_fact, "superseded": []}

    @staticmethod
    def _document_id(fact: Any) -> Optional[str]:
        return fact.get("_id") if isinstance(fact, dict) else getattr(fact, "_id", None)

    @staticmethod
    def _fact_text(fact: Any) -> str:
        return str(fact.get("fact", "")) if isinstance(fact, dict) else str(getattr(fact, "fact", ""))

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
