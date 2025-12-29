"""
Cortex SDK - Facts API

Layer 3: Structured knowledge extraction and storage
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union, cast

from .._utils import convert_convex_response, filter_none_values
from ..errors import CortexError, ErrorCode  # noqa: F401
from ..types import (
    AuthContext,
    CountFactsFilter,
    DeleteFactOptions,
    DeleteFactResult,
    DeleteManyFactsParams,
    DeleteManyFactsResult,
    FactRecord,
    FactType,
    ListFactsFilter,
    QueryByRelationshipFilter,
    QueryBySubjectFilter,
    SearchFactsOptions,
    StoreFactOptions,
    StoreFactParams,
    UpdateFactInput,
    UpdateFactOptions,
)
from .belief_revision import (
    BeliefRevisionConfig,
    BeliefRevisionLLMClient,
    BeliefRevisionService,
    ConflictCandidate,
    ConflictCheckResult,
    LLMResolutionConfigOptions,
    ReviseParams,
    ReviseResult,
    SemanticMatchingConfigOptions,
    SlotMatchingConfigOptions,
)
from .deduplication import (
    DeduplicationConfig,
    DeduplicationStrategy,
    DuplicateResult,
    FactCandidate,
    FactDeduplicationService,
    StoreWithDedupResult,
)
from .history import (
    ActionCounts,
    ActivitySummary,
    ChangeFilter,
    FactChangeEvent,
    FactChangePipeline,
    FactHistoryService,
    LogEventParams,
    SupersessionChainEntry,
)
from .slot_matching import (
    DEFAULT_PREDICATE_CLASSES,
    SlotConflictResult,
    SlotMatch,
    SlotMatchingConfig,
    SlotMatchingService,
    classify_predicate,
    extract_slot,
    normalize_predicate,
    normalize_subject,
)
from .validators import (
    FactsValidationError,
    validate_confidence,
    validate_consolidation,
    validate_datetime_range,
    validate_export_format,
    validate_fact_id_format,
    validate_fact_type,
    validate_memory_space_id,
    validate_metadata,
    validate_non_negative_integer,
    validate_required_string,
    validate_sort_by,
    validate_sort_order,
    validate_source_ref,
    validate_source_type,
    validate_string_array,
    validate_tag_match,
    validate_update_has_fields,
    validate_validity_period,
)


@dataclass
class StoreFactWithDedupOptions:
    """Options for storing a fact with deduplication."""

    deduplication: Optional[Union[DeduplicationConfig, DeduplicationStrategy]] = None
    """Deduplication configuration or strategy shorthand."""

    sync_to_graph: bool = False
    """Whether to sync the fact to the graph database."""


class FactsAPI:
    """
    Facts API - Layer 3

    Manages structured fact storage with versioning, relationships, and temporal validity.
    """

    def __init__(
        self,
        client: Any,
        graph_adapter: Optional[Any] = None,
        resilience: Optional[Any] = None,
        auth_context: Optional[AuthContext] = None,
        llm_client: Optional[BeliefRevisionLLMClient] = None,
        belief_revision_config: Optional[BeliefRevisionConfig] = None,
    ) -> None:
        """
        Initialize Facts API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter for sync
            resilience: Optional resilience layer for overload protection
            auth_context: Optional auth context for multi-tenancy
            llm_client: Optional LLM client for belief revision
            belief_revision_config: Optional belief revision configuration
        """
        self.client = client
        self.graph_adapter = graph_adapter
        self._resilience = resilience
        self._auth_context = auth_context
        self._dedup_service = FactDeduplicationService(client)
        self._llm_client = llm_client
        self._history_service = FactHistoryService(client, resilience)

        # Always initialize belief revision service - "batteries included"
        # When no LLM is configured, the service uses heuristics via get_default_decision()
        # This enables intelligent fact supersession even without an LLM for conflict resolution
        self._belief_revision_service = BeliefRevisionService(
            client,
            llm_client,
            graph_adapter,
            belief_revision_config,
        )

    @property
    def _tenant_id(self) -> Optional[str]:
        """Get tenant_id from auth context (for multi-tenancy)."""
        return self._auth_context.tenant_id if self._auth_context else None

    async def _execute_with_resilience(
        self, operation: Any, operation_name: str
    ) -> Any:
        """Execute an operation through the resilience layer (if available)."""
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

    async def store(
        self, params: StoreFactParams, options: Optional[StoreFactOptions] = None
    ) -> FactRecord:
        """
        Store a new fact with metadata and relationships.

        Args:
            params: Fact storage parameters
            options: Optional store options (e.g., syncToGraph)

        Returns:
            Stored fact record

        Example:
            >>> fact = await cortex.facts.store(
            ...     StoreFactParams(
            ...         memory_space_id='agent-1',
            ...         fact='User prefers dark mode',
            ...         fact_type='preference',
            ...         subject='user-123',
            ...         confidence=95,
            ...         source_type='conversation',
            ...         tags=['ui', 'settings']
            ...     )
            ... )
        """
        # Validate required fields
        validate_memory_space_id(params.memory_space_id)
        validate_required_string(params.fact, "fact")
        validate_fact_type(params.fact_type)
        validate_confidence(params.confidence, "confidence")
        validate_source_type(params.source_type)

        # Validate optional fields if provided
        if params.tags is not None:
            validate_string_array(params.tags, "tags", True)
        if params.valid_from is not None and params.valid_until is not None:
            validate_validity_period(params.valid_from, params.valid_until)
        if params.source_ref is not None:
            validate_source_ref(params.source_ref)
        if params.metadata is not None:
            validate_metadata(params.metadata)

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "facts:store",
                filter_none_values({
                    "memorySpaceId": params.memory_space_id,
                    "participantId": params.participant_id,
                    "userId": params.user_id,
                    "fact": params.fact,
                    "factType": params.fact_type,
                    "subject": params.subject,
                    "predicate": params.predicate,
                    "object": params.object,
                    "confidence": params.confidence,
                    "sourceType": params.source_type,
                    "sourceRef": (
                        {
                            "conversationId": params.source_ref.get("conversationId") if isinstance(params.source_ref, dict) else getattr(params.source_ref, "conversation_id", None),
                            "messageIds": (params.source_ref.get("messageIds") if isinstance(params.source_ref, dict) else getattr(params.source_ref, "message_ids", None)) or [],
                            "memoryId": params.source_ref.get("memoryId") if isinstance(params.source_ref, dict) else getattr(params.source_ref, "memory_id", None),
                        }
                        if params.source_ref
                        else None
                    ),
                    "metadata": params.metadata,
                    "tags": params.tags or [],
                    "validFrom": params.valid_from,
                    "validUntil": params.valid_until,
                    # Enrichment fields (for bullet-proof retrieval)
                    "category": params.category,
                    "searchAliases": params.search_aliases,
                    "semanticContext": params.semantic_context,
                    "entities": (
                        [{"name": e.name, "type": e.type, "fullValue": e.full_value} for e in params.entities]
                        if params.entities
                        else None
                    ),
                    "relations": (
                        [{"subject": r.subject, "predicate": r.predicate, "object": r.object} for r in params.relations]
                        if params.relations
                        else None
                    ),
                }),
            ),
            "facts:store",
        )

        # Sync to graph if requested
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import sync_fact_relationships, sync_fact_to_graph

                node_id = await sync_fact_to_graph(result, self.graph_adapter)
                await sync_fact_relationships(result, node_id, self.graph_adapter)
            except Exception as error:
                print(f"Warning: Failed to sync fact to graph: {error}")

        return FactRecord(**convert_convex_response(result))

    async def store_with_dedup(
        self,
        params: StoreFactParams,
        options: Optional[StoreFactWithDedupOptions] = None,
    ) -> StoreWithDedupResult:
        """
        Store a fact with cross-session deduplication.

        Checks for existing duplicate facts before storing. If a duplicate is found:
        - If new fact has higher confidence: updates the existing fact
        - Otherwise: returns the existing fact without modification

        Args:
            params: Fact storage parameters
            options: Optional options including deduplication config

        Returns:
            StoreWithDedupResult with fact and deduplication details

        Example:
            >>> result = await cortex.facts.store_with_dedup(
            ...     StoreFactParams(
            ...         memory_space_id='agent-1',
            ...         fact='User prefers dark mode',
            ...         fact_type='preference',
            ...         subject='user-123',
            ...         confidence=95,
            ...         source_type='conversation',
            ...     ),
            ...     StoreFactWithDedupOptions(
            ...         deduplication=DeduplicationConfig(strategy='structural')
            ...     )
            ... )
            >>> if result.was_updated:
            ...     print(f"Updated existing fact: {result.fact.fact_id}")
        """
        # Validate required fields (same as store)
        validate_memory_space_id(params.memory_space_id)
        validate_required_string(params.fact, "fact")
        validate_fact_type(params.fact_type)
        validate_confidence(params.confidence, "confidence")
        validate_source_type(params.source_type)

        # Validate optional fields if provided
        if params.tags is not None:
            validate_string_array(params.tags, "tags", True)
        if params.valid_from is not None and params.valid_until is not None:
            validate_validity_period(params.valid_from, params.valid_until)
        if params.source_ref is not None:
            validate_source_ref(params.source_ref)
        if params.metadata is not None:
            validate_metadata(params.metadata)

        opts = options or StoreFactWithDedupOptions()

        # Resolve deduplication config
        dedup_config = FactDeduplicationService.resolve_config(opts.deduplication)

        # Check for duplicates
        candidate = FactCandidate(
            fact=params.fact,
            fact_type=params.fact_type,
            confidence=params.confidence,
            subject=params.subject,
            predicate=params.predicate,
            object=params.object,
            tags=params.tags,
        )

        duplicate_result = await self._dedup_service.find_duplicate(
            candidate,
            params.memory_space_id,
            dedup_config,
            params.user_id,
        )

        # Handle duplicate found
        if duplicate_result.is_duplicate and duplicate_result.existing_fact:
            existing = duplicate_result.existing_fact

            # If new confidence is higher, update the existing fact
            if duplicate_result.should_update:
                # Build update payload
                update_data: Dict[str, Any] = {"confidence": params.confidence}
                if params.tags:
                    # Merge tags
                    existing_tags = existing.tags or []
                    merged_tags = list(set(existing_tags + params.tags))
                    update_data["tags"] = merged_tags

                updated_fact = await self.update(
                    params.memory_space_id,
                    existing.fact_id,
                    update_data,
                    UpdateFactOptions(sync_to_graph=opts.sync_to_graph),
                )

                return StoreWithDedupResult(
                    fact=updated_fact,
                    was_updated=True,
                    deduplication={
                        "strategy": dedup_config.strategy,
                        "matched_existing": True,
                        "similarity_score": duplicate_result.similarity_score,
                    },
                )

            # Return existing fact without modification
            return StoreWithDedupResult(
                fact=existing,
                was_updated=False,
                deduplication={
                    "strategy": dedup_config.strategy,
                    "matched_existing": True,
                    "similarity_score": duplicate_result.similarity_score,
                },
            )

        # No duplicate found - store new fact
        stored_fact = await self.store(
            params,
            StoreFactOptions(sync_to_graph=opts.sync_to_graph),
        )

        return StoreWithDedupResult(
            fact=stored_fact,
            was_updated=False,
            deduplication={
                "strategy": dedup_config.strategy,
                "matched_existing": False,
            },
        )

    async def get(
        self, memory_space_id: str, fact_id: str
    ) -> Optional[FactRecord]:
        """
        Retrieve a fact by ID.

        Args:
            memory_space_id: Memory space ID
            fact_id: Fact ID

        Returns:
            Fact record if found, None otherwise

        Example:
            >>> fact = await cortex.facts.get('agent-1', 'fact-123')
        """
        validate_memory_space_id(memory_space_id)
        validate_required_string(fact_id, "fact_id")
        validate_fact_id_format(fact_id)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "facts:get", {"memorySpaceId": memory_space_id, "factId": fact_id}
            ),
            "facts:get",
        )

        if not result:
            return None

        return FactRecord(**convert_convex_response(result))

    async def list(
        self,
        filter: ListFactsFilter,
    ) -> List[FactRecord]:
        """
        List facts with comprehensive universal filters (v0.9.1+).

        Args:
            filter: Comprehensive filter options with 25+ parameters

        Returns:
            List of fact records

        Example:
            >>> from cortex.types import ListFactsFilter
            >>> facts = await cortex.facts.list(
            ...     ListFactsFilter(
            ...         memory_space_id='agent-1',
            ...         user_id='user-123',  # GDPR filtering
            ...         fact_type='preference',
            ...         min_confidence=80,
            ...         tags=['important'],
            ...         sort_by='confidence',
            ...         sort_order='desc'
            ...     )
            ... )
        """
        validate_memory_space_id(filter.memory_space_id)

        if filter.fact_type is not None:
            validate_fact_type(filter.fact_type)
        if filter.source_type is not None:
            validate_source_type(filter.source_type)
        if filter.confidence is not None:
            validate_confidence(filter.confidence, "confidence")
        if filter.min_confidence is not None:
            validate_confidence(filter.min_confidence, "min_confidence")
        if filter.tags is not None:
            validate_string_array(filter.tags, "tags", True)
        if filter.tag_match is not None:
            validate_tag_match(filter.tag_match)
        if filter.limit is not None:
            validate_non_negative_integer(filter.limit, "limit")
        if filter.offset is not None:
            validate_non_negative_integer(filter.offset, "offset")
        if filter.sort_by is not None:
            validate_sort_by(filter.sort_by)
        if filter.sort_order is not None:
            validate_sort_order(filter.sort_order)
        if filter.created_before and filter.created_after:
            validate_datetime_range(
                filter.created_after,
                filter.created_before,
                "created_after",
                "created_before",
            )
        if filter.updated_before and filter.updated_after:
            validate_datetime_range(
                filter.updated_after,
                filter.updated_before,
                "updated_after",
                "updated_before",
            )
        if filter.metadata is not None:
            validate_metadata(filter.metadata)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "facts:list",
                filter_none_values({
                    "memorySpaceId": filter.memory_space_id,
                    "factType": filter.fact_type,
                    "subject": filter.subject,
                    "predicate": filter.predicate,
                    "object": filter.object,
                    "minConfidence": filter.min_confidence,
                    "confidence": filter.confidence,
                    "userId": filter.user_id,
                    "participantId": filter.participant_id,
                    "tags": filter.tags,
                    "tagMatch": filter.tag_match,
                    "sourceType": filter.source_type,
                    "createdBefore": int(filter.created_before.timestamp() * 1000) if filter.created_before else None,
                    "createdAfter": int(filter.created_after.timestamp() * 1000) if filter.created_after else None,
                    "updatedBefore": int(filter.updated_before.timestamp() * 1000) if filter.updated_before else None,
                    "updatedAfter": int(filter.updated_after.timestamp() * 1000) if filter.updated_after else None,
                    "version": filter.version,
                    "includeSuperseded": filter.include_superseded,
                    "validAt": int(filter.valid_at.timestamp() * 1000) if filter.valid_at else None,
                    "metadata": filter.metadata,
                    "limit": filter.limit,
                    "offset": filter.offset,
                    "sortBy": filter.sort_by,
                    "sortOrder": filter.sort_order,
                }),
            ),
            "facts:list",
        )

        return [FactRecord(**convert_convex_response(fact)) for fact in result]

    async def search(
        self,
        memory_space_id: str,
        query: str,
        options: Optional[SearchFactsOptions] = None,
    ) -> List[FactRecord]:
        """
        Search facts with text matching and comprehensive universal filters (v0.9.1+).

        Args:
            memory_space_id: Memory space ID
            query: Search query string
            options: Optional comprehensive search options with universal filters

        Returns:
            List of matching facts

        Example:
            >>> from cortex.types import SearchFactsOptions
            >>> results = await cortex.facts.search(
            ...     'agent-1',
            ...     'food preferences',
            ...     SearchFactsOptions(
            ...         user_id='user-123',
            ...         min_confidence=80,
            ...         tags=['verified']
            ...     )
            ... )
        """
        validate_memory_space_id(memory_space_id)
        validate_required_string(query, "query")

        if options:
            if options.fact_type is not None:
                validate_fact_type(options.fact_type)
            if options.source_type is not None:
                validate_source_type(options.source_type)
            if options.confidence is not None:
                validate_confidence(options.confidence, "confidence")
            if options.min_confidence is not None:
                validate_confidence(options.min_confidence, "min_confidence")
            if options.tags is not None:
                validate_string_array(options.tags, "tags", True)
            if options.tag_match is not None:
                validate_tag_match(options.tag_match)
            if options.limit is not None:
                validate_non_negative_integer(options.limit, "limit")
            if options.offset is not None:
                validate_non_negative_integer(options.offset, "offset")
            if options.sort_by is not None:
                validate_sort_by(options.sort_by)
            if options.sort_order is not None:
                validate_sort_order(options.sort_order)
            if options.created_before and options.created_after:
                validate_datetime_range(
                    options.created_after,
                    options.created_before,
                    "created_after",
                    "created_before",
                )
            if options.updated_before and options.updated_after:
                validate_datetime_range(
                    options.updated_after,
                    options.updated_before,
                    "updated_after",
                    "updated_before",
                )
            if options.metadata is not None:
                validate_metadata(options.metadata)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "facts:search",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "query": query,
                    "factType": options.fact_type if options else None,
                    "subject": options.subject if options else None,
                    "predicate": options.predicate if options else None,
                    "object": options.object if options else None,
                    "minConfidence": options.min_confidence if options else None,
                    "confidence": options.confidence if options else None,
                    "userId": options.user_id if options else None,
                    "participantId": options.participant_id if options else None,
                    "tags": options.tags if options else None,
                    "tagMatch": options.tag_match if options else None,
                    "sourceType": options.source_type if options else None,
                    "createdBefore": int(options.created_before.timestamp() * 1000) if options and options.created_before else None,
                    "createdAfter": int(options.created_after.timestamp() * 1000) if options and options.created_after else None,
                    "updatedBefore": int(options.updated_before.timestamp() * 1000) if options and options.updated_before else None,
                    "updatedAfter": int(options.updated_after.timestamp() * 1000) if options and options.updated_after else None,
                    "version": options.version if options else None,
                    "includeSuperseded": options.include_superseded if options else None,
                    "validAt": int(options.valid_at.timestamp() * 1000) if options and options.valid_at else None,
                    "metadata": options.metadata if options else None,
                    "limit": options.limit if options else None,
                    "offset": options.offset if options else None,
                    "sortBy": options.sort_by if options else None,
                    "sortOrder": options.sort_order if options else None,
                }),
            ),
            "facts:search",
        )

        return [FactRecord(**convert_convex_response(fact)) for fact in result]

    async def update(
        self,
        memory_space_id: str,
        fact_id: str,
        updates: Union[UpdateFactInput, Dict[str, Any]],
        options: Optional[UpdateFactOptions] = None,
    ) -> FactRecord:
        """
        Update a fact (creates new version).

        Args:
            memory_space_id: Memory space ID
            fact_id: Fact ID
            updates: Updates to apply (UpdateFactInput dataclass or dict)
            options: Optional update options (e.g., syncToGraph)

        Returns:
            Updated fact record

        Example:
            >>> from cortex.types import UpdateFactInput
            >>> updated = await cortex.facts.update(
            ...     'agent-1', 'fact-123',
            ...     UpdateFactInput(confidence=99, tags=['verified', 'ui'])
            ... )
        """
        validate_memory_space_id(memory_space_id)
        validate_required_string(fact_id, "fact_id")
        validate_fact_id_format(fact_id)

        # Convert UpdateFactInput to dict for validation if needed
        if isinstance(updates, UpdateFactInput):
            updates_dict = {
                "fact": updates.fact,
                "confidence": updates.confidence,
                "tags": updates.tags,
                "validUntil": updates.valid_until,
                "metadata": updates.metadata,
                "category": updates.category,
                "searchAliases": updates.search_aliases,
                "semanticContext": updates.semantic_context,
                "entities": updates.entities,
                "relations": updates.relations,
            }
        else:
            updates_dict = updates

        validate_update_has_fields(updates_dict)

        if updates_dict.get("confidence") is not None:
            conf = updates_dict["confidence"]
            if isinstance(conf, (int, float)):
                validate_confidence(conf, "confidence")
        if updates_dict.get("tags") is not None:
            validate_string_array(updates_dict["tags"], "tags", True)
        if updates_dict.get("metadata") is not None:
            validate_metadata(updates_dict["metadata"])

        # Build the mutation payload with proper field mapping
        if isinstance(updates, UpdateFactInput):
            mutation_payload = filter_none_values({
                "memorySpaceId": memory_space_id,
                "factId": fact_id,
                "fact": updates.fact,
                "confidence": updates.confidence,
                "tags": updates.tags,
                "validUntil": updates.valid_until,
                "metadata": updates.metadata,
                # Enrichment fields
                "category": updates.category,
                "searchAliases": updates.search_aliases,
                "semanticContext": updates.semantic_context,
                "entities": (
                    [{"name": e.name, "type": e.type, "fullValue": e.full_value} for e in updates.entities]
                    if updates.entities
                    else None
                ),
                "relations": (
                    [{"subject": r.subject, "predicate": r.predicate, "object": r.object} for r in updates.relations]
                    if updates.relations
                    else None
                ),
            })
        else:
            # Legacy dict support - assume keys are already in camelCase or snake_case
            mutation_payload = filter_none_values({
                "memorySpaceId": memory_space_id,
                "factId": fact_id,
                "fact": updates.get("fact"),
                "confidence": updates.get("confidence"),
                "tags": updates.get("tags"),
                "validUntil": updates.get("validUntil") or updates.get("valid_until"),
                "metadata": updates.get("metadata"),
                # Enrichment fields
                "category": updates.get("category"),
                "searchAliases": updates.get("searchAliases") or updates.get("search_aliases"),
                "semanticContext": updates.get("semanticContext") or updates.get("semantic_context"),
                "entities": updates.get("entities"),
                "relations": updates.get("relations"),
            })

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "facts:update",
                mutation_payload,
            ),
            "facts:update",
        )

        # Sync to graph if requested
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import sync_fact_to_graph

                await sync_fact_to_graph(result, self.graph_adapter)
            except Exception as error:
                print(f"Warning: Failed to sync fact update to graph: {error}")

        return FactRecord(**convert_convex_response(result))

    async def delete(
        self,
        memory_space_id: str,
        fact_id: str,
        options: Optional[DeleteFactOptions] = None,
    ) -> DeleteFactResult:
        """
        Delete a fact (soft delete - marks as superseded).

        Args:
            memory_space_id: Memory space ID
            fact_id: Fact ID
            options: Optional delete options (e.g., syncToGraph)

        Returns:
            DeleteFactResult with deleted status and fact_id

        Example:
            >>> result = await cortex.facts.delete('agent-1', 'fact-123')
            >>> print(f"Deleted: {result.deleted}, ID: {result.fact_id}")
        """
        validate_memory_space_id(memory_space_id)
        validate_required_string(fact_id, "fact_id")
        validate_fact_id_format(fact_id)

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "facts:deleteFact", {"memorySpaceId": memory_space_id, "factId": fact_id}
            ),
            "facts:deleteFact",
        )

        # Delete from graph
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import delete_fact_from_graph

                await delete_fact_from_graph(fact_id, self.graph_adapter)
            except Exception as error:
                print(f"Warning: Failed to delete fact from graph: {error}")

        return DeleteFactResult(
            deleted=result.get("deleted", False),
            fact_id=result.get("factId", fact_id),
        )

    async def delete_many(
        self,
        params: DeleteManyFactsParams,
    ) -> DeleteManyFactsResult:
        """
        Delete multiple facts matching filters in a single operation.

        This is a hard delete operation. For soft delete (marking as superseded),
        use delete() on individual facts.

        Args:
            params: Delete many parameters with optional filters

        Returns:
            DeleteManyFactsResult with deleted count and memory_space_id

        Example:
            >>> from cortex.types import DeleteManyFactsParams
            >>> # Delete all facts in a memory space
            >>> result = await cortex.facts.delete_many(
            ...     DeleteManyFactsParams(memory_space_id='agent-1')
            ... )
            >>> print(f"Deleted {result.deleted} facts")

            >>> # Delete all facts for a specific user (GDPR compliance)
            >>> gdpr_result = await cortex.facts.delete_many(
            ...     DeleteManyFactsParams(
            ...         memory_space_id='agent-1',
            ...         user_id='user-to-delete'
            ...     )
            ... )

            >>> # Delete all preference facts
            >>> pref_result = await cortex.facts.delete_many(
            ...     DeleteManyFactsParams(
            ...         memory_space_id='agent-1',
            ...         fact_type='preference'
            ...     )
            ... )
        """
        validate_memory_space_id(params.memory_space_id)

        if params.fact_type is not None:
            validate_fact_type(params.fact_type)

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "facts:deleteMany",
                filter_none_values({
                    "memorySpaceId": params.memory_space_id,
                    "userId": params.user_id,
                    "factType": params.fact_type,
                }),
            ),
            "facts:deleteMany",
        )

        return DeleteManyFactsResult(
            deleted=result.get("deleted", 0),
            memory_space_id=result.get("memorySpaceId", params.memory_space_id),
        )

    async def count(
        self,
        filter: CountFactsFilter,
    ) -> int:
        """
        Count facts with comprehensive universal filters (v0.9.1+).

        Args:
            filter: Comprehensive filter options

        Returns:
            Count of matching facts

        Example:
            >>> from cortex.types import CountFactsFilter
            >>> total = await cortex.facts.count(
            ...     CountFactsFilter(
            ...         memory_space_id='agent-1',
            ...         user_id='user-123',
            ...         fact_type='preference',
            ...         min_confidence=80
            ...     )
            ... )
        """
        validate_memory_space_id(filter.memory_space_id)

        if filter.fact_type is not None:
            validate_fact_type(filter.fact_type)
        if filter.source_type is not None:
            validate_source_type(filter.source_type)
        if filter.confidence is not None:
            validate_confidence(filter.confidence, "confidence")
        if filter.min_confidence is not None:
            validate_confidence(filter.min_confidence, "min_confidence")
        if filter.tags is not None:
            validate_string_array(filter.tags, "tags", True)
        if filter.tag_match is not None:
            validate_tag_match(filter.tag_match)
        if filter.created_before and filter.created_after:
            validate_datetime_range(
                filter.created_after,
                filter.created_before,
                "created_after",
                "created_before",
            )
        if filter.updated_before and filter.updated_after:
            validate_datetime_range(
                filter.updated_after,
                filter.updated_before,
                "updated_after",
                "updated_before",
            )
        if filter.metadata is not None:
            validate_metadata(filter.metadata)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "facts:count",
                filter_none_values({
                    "memorySpaceId": filter.memory_space_id,
                    "factType": filter.fact_type,
                    "subject": filter.subject,
                    "predicate": filter.predicate,
                    "object": filter.object,
                    "minConfidence": filter.min_confidence,
                    "confidence": filter.confidence,
                    "userId": filter.user_id,
                    "participantId": filter.participant_id,
                    "tags": filter.tags,
                    "tagMatch": filter.tag_match,
                    "sourceType": filter.source_type,
                    "createdBefore": int(filter.created_before.timestamp() * 1000) if filter.created_before else None,
                    "createdAfter": int(filter.created_after.timestamp() * 1000) if filter.created_after else None,
                    "updatedBefore": int(filter.updated_before.timestamp() * 1000) if filter.updated_before else None,
                    "updatedAfter": int(filter.updated_after.timestamp() * 1000) if filter.updated_after else None,
                    "version": filter.version,
                    "includeSuperseded": filter.include_superseded,
                    "validAt": int(filter.valid_at.timestamp() * 1000) if filter.valid_at else None,
                    "metadata": filter.metadata,
                }),
            ),
            "facts:count",
        )

        return int(result)

    async def query_by_subject(
        self,
        filter: QueryBySubjectFilter,
    ) -> List[FactRecord]:
        """
        Get all facts about a specific entity with comprehensive universal filters (v0.9.1+).

        Args:
            filter: Comprehensive filter options with subject as required field

        Returns:
            List of facts about the subject

        Example:
            >>> from cortex.types import QueryBySubjectFilter
            >>> user_facts = await cortex.facts.query_by_subject(
            ...     QueryBySubjectFilter(
            ...         memory_space_id='agent-1',
            ...         subject='user-123',
            ...         user_id='user-123',
            ...         fact_type='preference',
            ...         min_confidence=85
            ...     )
            ... )
        """
        validate_memory_space_id(filter.memory_space_id)
        validate_required_string(filter.subject, "subject")

        if filter.fact_type is not None:
            validate_fact_type(filter.fact_type)
        if filter.source_type is not None:
            validate_source_type(filter.source_type)
        if filter.confidence is not None:
            validate_confidence(filter.confidence, "confidence")
        if filter.min_confidence is not None:
            validate_confidence(filter.min_confidence, "min_confidence")
        if filter.tags is not None:
            validate_string_array(filter.tags, "tags", True)
        if filter.tag_match is not None:
            validate_tag_match(filter.tag_match)
        if filter.limit is not None:
            validate_non_negative_integer(filter.limit, "limit")
        if filter.offset is not None:
            validate_non_negative_integer(filter.offset, "offset")
        if filter.sort_by is not None:
            validate_sort_by(filter.sort_by)
        if filter.sort_order is not None:
            validate_sort_order(filter.sort_order)
        if filter.created_before and filter.created_after:
            validate_datetime_range(
                filter.created_after,
                filter.created_before,
                "created_after",
                "created_before",
            )
        if filter.updated_before and filter.updated_after:
            validate_datetime_range(
                filter.updated_after,
                filter.updated_before,
                "updated_after",
                "updated_before",
            )
        if filter.metadata is not None:
            validate_metadata(filter.metadata)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "facts:queryBySubject",
                filter_none_values({
                    "memorySpaceId": filter.memory_space_id,
                    "subject": filter.subject,
                    "factType": filter.fact_type,
                    "predicate": filter.predicate,
                    "object": filter.object,
                    "minConfidence": filter.min_confidence,
                    "confidence": filter.confidence,
                    "userId": filter.user_id,
                    "participantId": filter.participant_id,
                    "tags": filter.tags,
                    "tagMatch": filter.tag_match,
                    "sourceType": filter.source_type,
                    "createdBefore": int(filter.created_before.timestamp() * 1000) if filter.created_before else None,
                    "createdAfter": int(filter.created_after.timestamp() * 1000) if filter.created_after else None,
                    "updatedBefore": int(filter.updated_before.timestamp() * 1000) if filter.updated_before else None,
                    "updatedAfter": int(filter.updated_after.timestamp() * 1000) if filter.updated_after else None,
                    "version": filter.version,
                    "includeSuperseded": filter.include_superseded,
                    "validAt": int(filter.valid_at.timestamp() * 1000) if filter.valid_at else None,
                    "metadata": filter.metadata,
                    "limit": filter.limit,
                    "offset": filter.offset,
                    "sortBy": filter.sort_by,
                    "sortOrder": filter.sort_order,
                }),
            ),
            "facts:queryBySubject",
        )

        return [FactRecord(**convert_convex_response(fact)) for fact in result]

    async def query_by_relationship(
        self,
        filter: QueryByRelationshipFilter,
    ) -> List[FactRecord]:
        """
        Get facts with specific relationship and comprehensive universal filters (v0.9.1+).

        Args:
            filter: Comprehensive filter options with subject and predicate as required fields

        Returns:
            List of matching facts

        Example:
            >>> from cortex.types import QueryByRelationshipFilter
            >>> work_places = await cortex.facts.query_by_relationship(
            ...     QueryByRelationshipFilter(
            ...         memory_space_id='agent-1',
            ...         subject='user-123',
            ...         predicate='works_at',
            ...         user_id='user-123',
            ...         min_confidence=90
            ...     )
            ... )
        """
        validate_memory_space_id(filter.memory_space_id)
        validate_required_string(filter.subject, "subject")
        validate_required_string(filter.predicate, "predicate")

        if filter.fact_type is not None:
            validate_fact_type(filter.fact_type)
        if filter.source_type is not None:
            validate_source_type(filter.source_type)
        if filter.confidence is not None:
            validate_confidence(filter.confidence, "confidence")
        if filter.min_confidence is not None:
            validate_confidence(filter.min_confidence, "min_confidence")
        if filter.tags is not None:
            validate_string_array(filter.tags, "tags", True)
        if filter.tag_match is not None:
            validate_tag_match(filter.tag_match)
        if filter.limit is not None:
            validate_non_negative_integer(filter.limit, "limit")
        if filter.offset is not None:
            validate_non_negative_integer(filter.offset, "offset")
        if filter.sort_by is not None:
            validate_sort_by(filter.sort_by)
        if filter.sort_order is not None:
            validate_sort_order(filter.sort_order)
        if filter.created_before and filter.created_after:
            validate_datetime_range(
                filter.created_after,
                filter.created_before,
                "created_after",
                "created_before",
            )
        if filter.updated_before and filter.updated_after:
            validate_datetime_range(
                filter.updated_after,
                filter.updated_before,
                "updated_after",
                "updated_before",
            )
        if filter.metadata is not None:
            validate_metadata(filter.metadata)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "facts:queryByRelationship",
                filter_none_values({
                    "memorySpaceId": filter.memory_space_id,
                    "subject": filter.subject,
                    "predicate": filter.predicate,
                    "object": filter.object,
                    "factType": filter.fact_type,
                    "minConfidence": filter.min_confidence,
                    "confidence": filter.confidence,
                    "userId": filter.user_id,
                    "participantId": filter.participant_id,
                    "tags": filter.tags,
                    "tagMatch": filter.tag_match,
                    "sourceType": filter.source_type,
                    "createdBefore": int(filter.created_before.timestamp() * 1000) if filter.created_before else None,
                    "createdAfter": int(filter.created_after.timestamp() * 1000) if filter.created_after else None,
                    "updatedBefore": int(filter.updated_before.timestamp() * 1000) if filter.updated_before else None,
                    "updatedAfter": int(filter.updated_after.timestamp() * 1000) if filter.updated_after else None,
                    "version": filter.version,
                    "includeSuperseded": filter.include_superseded,
                    "validAt": int(filter.valid_at.timestamp() * 1000) if filter.valid_at else None,
                    "metadata": filter.metadata,
                    "limit": filter.limit,
                    "offset": filter.offset,
                    "sortBy": filter.sort_by,
                    "sortOrder": filter.sort_order,
                }),
            ),
            "facts:queryByRelationship",
        )

        return [FactRecord(**convert_convex_response(fact)) for fact in result]

    async def get_history(
        self, memory_space_id: str, fact_id: str
    ) -> List[FactRecord]:
        """
        Get complete version history for a fact.

        Args:
            memory_space_id: Memory space ID
            fact_id: Fact ID

        Returns:
            List of all versions

        Example:
            >>> history = await cortex.facts.get_history('agent-1', 'fact-123')
        """
        validate_memory_space_id(memory_space_id)
        validate_required_string(fact_id, "fact_id")
        validate_fact_id_format(fact_id)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "facts:getHistory", {"memorySpaceId": memory_space_id, "factId": fact_id}
            ),
            "facts:getHistory",
        )

        return [FactRecord(**convert_convex_response(v)) for v in result]

    async def export(
        self,
        memory_space_id: str,
        format: str = "json",
        fact_type: Optional[FactType] = None,
    ) -> Dict[str, Any]:
        """
        Export facts in various formats.

        Args:
            memory_space_id: Memory space ID
            format: Export format ('json', 'jsonld', or 'csv')
            fact_type: Filter by fact type

        Returns:
            Export result

        Example:
            >>> exported = await cortex.facts.export(
            ...     'agent-1',
            ...     format='json',
            ...     fact_type='preference'
            ... )
        """
        validate_memory_space_id(memory_space_id)
        validate_export_format(format)

        if fact_type is not None:
            validate_fact_type(fact_type)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "facts:exportFacts",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "format": format,
                    "factType": fact_type,
                }),
            ),
            "facts:exportFacts",
        )

        return cast(Dict[str, Any], result)

    async def consolidate(
        self, memory_space_id: str, fact_ids: List[str], keep_fact_id: str
    ) -> Dict[str, Any]:
        """
        Merge duplicate facts.

        Args:
            memory_space_id: Memory space ID
            fact_ids: List of fact IDs to consolidate
            keep_fact_id: Fact ID to keep

        Returns:
            Consolidation result

        Example:
            >>> result = await cortex.facts.consolidate(
            ...     'agent-1',
            ...     ['fact-1', 'fact-2', 'fact-3'],
            ...     'fact-1'
            ... )
        """
        validate_memory_space_id(memory_space_id)
        validate_string_array(fact_ids, "fact_ids", False)
        validate_required_string(keep_fact_id, "keep_fact_id")
        validate_consolidation(fact_ids, keep_fact_id)

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "facts:consolidate",
                {
                    "memorySpaceId": memory_space_id,
                    "factIds": fact_ids,
                    "keepFactId": keep_fact_id,
                },
            ),
            "facts:consolidate",
        )

        return cast(Dict[str, Any], result)

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Belief Revision Methods
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    def configure_belief_revision(
        self,
        llm_client: Optional[BeliefRevisionLLMClient] = None,
        config: Optional[BeliefRevisionConfig] = None,
    ) -> None:
        """
        Configure or update the belief revision service.

        Args:
            llm_client: Optional LLM client for conflict resolution
            config: Optional belief revision configuration

        Example:
            >>> cortex.facts.configure_belief_revision(
            ...     llm_client=my_llm_client,
            ...     config=BeliefRevisionConfig(
            ...         slot_matching=SlotMatchingConfigOptions(enabled=True),
            ...         semantic_matching=SemanticMatchingConfigOptions(threshold=0.7),
            ...     )
            ... )
        """
        self._belief_revision_service = BeliefRevisionService(
            self.client,
            llm_client or self._llm_client,
            self.graph_adapter,
            config,
        )

    def has_belief_revision(self) -> bool:
        """
        Check if belief revision is configured and available.

        Returns:
            True if belief revision service is initialized

        Example:
            >>> if cortex.facts.has_belief_revision():
            ...     # Use revise() for intelligent fact management
            ...     await cortex.facts.revise(...)
            ... else:
            ...     # Fall back to store_with_dedup()
            ...     await cortex.facts.store_with_dedup(...)
        """
        return self._belief_revision_service is not None

    async def revise(self, params: ReviseParams) -> ReviseResult:
        """
        Evaluate a new fact and determine the appropriate action using belief revision.

        This is the intelligent entry point for fact storage that:
        1. Checks for slot-based conflicts (fast path)
        2. Checks for semantic conflicts (catch-all)
        3. Uses LLM to determine the best action
        4. Executes the decision (ADD, UPDATE, SUPERSEDE, or NONE)

        Args:
            params: Revise parameters including the fact to evaluate

        Returns:
            ReviseResult with action taken and resulting fact

        Raises:
            ValueError: If belief revision is not configured

        Example:
            >>> result = await cortex.facts.revise(ReviseParams(
            ...     memory_space_id="space-1",
            ...     fact=ConflictCandidate(
            ...         fact="User prefers purple",
            ...         subject="user-123",
            ...         predicate="favorite color",
            ...         object="purple",
            ...         confidence=90,
            ...     ),
            ... ))
            >>> print(f"Action: {result.action}, Reason: {result.reason}")
        """
        if not self._belief_revision_service:
            raise ValueError(
                "Belief revision is not configured. Call configure_belief_revision() first "
                "or provide an llm_client when initializing FactsAPI."
            )

        validate_memory_space_id(params.memory_space_id)
        validate_required_string(params.fact.fact, "fact")
        validate_confidence(params.fact.confidence, "confidence")

        return await self._belief_revision_service.revise(params)

    async def check_conflicts(self, params: ReviseParams) -> ConflictCheckResult:
        """
        Check for conflicts without executing (preview mode).

        This is useful for understanding what would happen if you stored a fact,
        without actually making any changes to the database.

        Args:
            params: Revise parameters including the fact to check

        Returns:
            ConflictCheckResult with conflict details and recommended action

        Raises:
            ValueError: If belief revision is not configured

        Example:
            >>> result = await cortex.facts.check_conflicts(ReviseParams(
            ...     memory_space_id="space-1",
            ...     fact=ConflictCandidate(
            ...         fact="User now lives in SF",
            ...         subject="user-123",
            ...         predicate="lives in",
            ...         object="San Francisco",
            ...         confidence=90,
            ...     ),
            ... ))
            >>> if result.has_conflicts:
            ...     print(f"Found {len(result.slot_conflicts)} slot conflicts")
            ...     print(f"Recommended action: {result.recommended_action}")
        """
        if not self._belief_revision_service:
            raise ValueError(
                "Belief revision is not configured. Call configure_belief_revision() first "
                "or provide an llm_client when initializing FactsAPI."
            )

        validate_memory_space_id(params.memory_space_id)
        validate_required_string(params.fact.fact, "fact")
        validate_confidence(params.fact.confidence, "confidence")

        return await self._belief_revision_service.check_conflicts(params)

    async def supersede(
        self,
        *,
        memory_space_id: str,
        old_fact_id: str,
        new_fact_id: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Manually supersede one fact with another.

        This marks the old fact as superseded (sets validUntil) and establishes
        the relationship between the two facts.

        Args:
            memory_space_id: Memory space ID
            old_fact_id: ID of the fact to supersede
            new_fact_id: ID of the superseding fact
            reason: Optional reason for the supersession

        Returns:
            Dict with supersession result

        Example:
            >>> result = await cortex.facts.supersede(
            ...     memory_space_id="space-1",
            ...     old_fact_id="fact-123",
            ...     new_fact_id="fact-456",
            ...     reason="User stated updated preference",
            ... )
            >>> if result["superseded"]:
            ...     print("Fact superseded successfully")
        """
        import time

        validate_memory_space_id(memory_space_id)
        validate_required_string(old_fact_id, "old_fact_id")
        validate_fact_id_format(old_fact_id)
        validate_required_string(new_fact_id, "new_fact_id")
        validate_fact_id_format(new_fact_id)

        # Prevent self-supersession which would create an inconsistent state
        # where a fact is marked as expired (validUntil set) but no replacement exists
        if old_fact_id == new_fact_id:
            raise ValueError(
                f"Cannot supersede a fact with itself: {old_fact_id}. "
                "old_fact_id and new_fact_id must be different."
            )

        # Verify old fact exists
        old_fact = await self.get(memory_space_id, old_fact_id)
        if not old_fact:
            raise ValueError(f"Old fact not found: {old_fact_id}")

        # Verify new fact exists
        new_fact = await self.get(memory_space_id, new_fact_id)
        if not new_fact:
            raise ValueError(f"New fact not found: {new_fact_id}")

        # Mark old fact as superseded
        await self.update(
            memory_space_id,
            old_fact_id,
            {"validUntil": int(time.time() * 1000)},
        )

        # Log the supersession event
        await self._history_service.log(LogEventParams(
            fact_id=old_fact_id,
            memory_space_id=memory_space_id,
            action="SUPERSEDE",
            old_value=old_fact.fact,
            new_value=new_fact.fact,
            superseded_by=new_fact_id,
            reason=reason,
        ))

        return {
            "superseded": True,
            "oldFactId": old_fact_id,
            "newFactId": new_fact_id,
            "reason": reason,
        }

    async def history(self, fact_id: str, limit: Optional[int] = None) -> List[FactChangeEvent]:
        """
        Get change history for a specific fact.

        Args:
            fact_id: The fact ID to get history for
            limit: Max events to return (default: 100)

        Returns:
            List of change events

        Example:
            >>> events = await cortex.facts.history("fact-123")
            >>> for event in events:
            ...     print(f"{event.action}: {event.reason}")
        """
        validate_required_string(fact_id, "fact_id")
        validate_fact_id_format(fact_id)

        return await self._history_service.get_history(fact_id, limit)

    async def get_changes(self, filter: ChangeFilter) -> List[FactChangeEvent]:
        """
        Get changes in a time range with filters.

        Args:
            filter: Filter parameters

        Returns:
            List of change events

        Example:
            >>> from datetime import datetime, timedelta
            >>> changes = await cortex.facts.get_changes(ChangeFilter(
            ...     memory_space_id="space-1",
            ...     after=datetime.now() - timedelta(hours=24),
            ...     action="SUPERSEDE",
            ... ))
        """
        validate_memory_space_id(filter.memory_space_id)

        return await self._history_service.get_changes(filter)

    async def get_supersession_chain(self, fact_id: str) -> List[SupersessionChainEntry]:
        """
        Get the supersession chain for a fact.

        Returns the chain of facts that led to the current state,
        showing how the knowledge evolved over time.

        Args:
            fact_id: The fact ID to trace

        Returns:
            List of chain entries from oldest to newest

        Example:
            >>> chain = await cortex.facts.get_supersession_chain("fact-456")
            >>> for entry in chain:
            ...     print(f"{entry.fact_id} -> {entry.superseded_by}")
        """
        validate_required_string(fact_id, "fact_id")
        validate_fact_id_format(fact_id)

        return await self._history_service.get_supersession_chain(fact_id)

    async def get_activity_summary(
        self, memory_space_id: str, hours: int = 24
    ) -> ActivitySummary:
        """
        Get activity summary for a time period.

        Args:
            memory_space_id: Memory space to query
            hours: Number of hours to look back (default: 24)

        Returns:
            Activity summary with counts and statistics

        Example:
            >>> summary = await cortex.facts.get_activity_summary("space-1", 24)
            >>> print(f"Total events: {summary.total_events}")
            >>> print(f"Supersessions: {summary.action_counts.SUPERSEDE}")
        """
        validate_memory_space_id(memory_space_id)

        return await self._history_service.get_activity_summary(memory_space_id, hours)


__all__ = [
    "FactsAPI",
    "FactsValidationError",
    # Deduplication exports
    "DeduplicationConfig",
    "DeduplicationStrategy",
    "DuplicateResult",
    "FactCandidate",
    "FactDeduplicationService",
    "StoreWithDedupResult",
    "StoreFactWithDedupOptions",
    # Belief revision exports
    "BeliefRevisionConfig",
    "BeliefRevisionLLMClient",
    "BeliefRevisionService",
    "ConflictCandidate",
    "ConflictCheckResult",
    "LLMResolutionConfigOptions",
    "ReviseParams",
    "ReviseResult",
    "SemanticMatchingConfigOptions",
    "SlotMatchingConfigOptions",
    # History exports
    "ActionCounts",
    "ActivitySummary",
    "ChangeFilter",
    "FactChangeEvent",
    "FactChangePipeline",
    "FactHistoryService",
    "LogEventParams",
    "SupersessionChainEntry",
    # Slot matching exports
    "DEFAULT_PREDICATE_CLASSES",
    "SlotConflictResult",
    "SlotMatch",
    "SlotMatchingConfig",
    "SlotMatchingService",
    "classify_predicate",
    "extract_slot",
    "normalize_predicate",
    "normalize_subject",
]

