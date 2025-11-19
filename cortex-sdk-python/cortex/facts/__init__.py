"""
Cortex SDK - Facts API

Layer 3: Structured knowledge extraction and storage
"""

from typing import cast, Optional, Optional, List, Dict, Any

from ..types import (
    FactRecord,
    StoreFactParams,
    StoreFactOptions,
    UpdateFactOptions,
    DeleteFactOptions,
    FactType,
    ListFactsFilter,
    CountFactsFilter,
    SearchFactsOptions,
    QueryBySubjectFilter,
    QueryByRelationshipFilter,
)
from ..errors import CortexError, ErrorCode
from .._utils import filter_none_values, convert_convex_response


class FactsAPI:
    """
    Facts API - Layer 3

    Manages structured fact storage with versioning, relationships, and temporal validity.
    """

    def __init__(self, client: Any, graph_adapter: Optional[Any] = None) -> None:
        """
        Initialize Facts API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter for sync
        """
        self.client = client
        self.graph_adapter = graph_adapter

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
        result = await self.client.mutation(
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
                        "conversationId": params.source_ref.get("conversationId") if isinstance(params.source_ref, dict) else params.source_ref.conversation_id,
                        "messageIds": (params.source_ref.get("messageIds") if isinstance(params.source_ref, dict) else params.source_ref.message_ids) or [],
                        "memoryId": params.source_ref.get("memoryId") if isinstance(params.source_ref, dict) else params.source_ref.memory_id,
                    }
                    if params.source_ref
                    else None
                ),
                "metadata": params.metadata,
                "tags": params.tags or [],
                "validFrom": params.valid_from,
                "validUntil": params.valid_until,
            }),
        )

        # Sync to graph if requested
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import sync_fact_to_graph, sync_fact_relationships

                node_id = await sync_fact_to_graph(result, self.graph_adapter)
                await sync_fact_relationships(result, node_id, self.graph_adapter)
            except Exception as error:
                print(f"Warning: Failed to sync fact to graph: {error}")

        return FactRecord(**convert_convex_response(result))

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
        result = await self.client.query(
            "facts:get", {"memorySpaceId": memory_space_id, "factId": fact_id}
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
        result = await self.client.query(
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
        result = await self.client.query(
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
        )

        return [FactRecord(**convert_convex_response(fact)) for fact in result]

    async def update(
        self,
        memory_space_id: str,
        fact_id: str,
        updates: Dict[str, Any],
        options: Optional[UpdateFactOptions] = None,
    ) -> FactRecord:
        """
        Update a fact (creates new version).

        Args:
            memory_space_id: Memory space ID
            fact_id: Fact ID
            updates: Updates to apply
            options: Optional update options (e.g., syncToGraph)

        Returns:
            Updated fact record

        Example:
            >>> updated = await cortex.facts.update(
            ...     'agent-1', 'fact-123',
            ...     {'confidence': 99, 'tags': ['verified', 'ui']}
            ... )
        """
        result = await self.client.mutation(
            "facts:update",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "factId": fact_id,
                **updates,  # Flatten updates into top level
            }),
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
    ) -> Dict[str, bool]:
        """
        Delete a fact (soft delete - marks as superseded).

        Args:
            memory_space_id: Memory space ID
            fact_id: Fact ID
            options: Optional delete options (e.g., syncToGraph)

        Returns:
            Deletion result

        Example:
            >>> await cortex.facts.delete('agent-1', 'fact-123')
        """
        result = await self.client.mutation(
            "facts:deleteFact", {"memorySpaceId": memory_space_id, "factId": fact_id}
        )

        # Delete from graph
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                from ..graph import delete_fact_from_graph

                await delete_fact_from_graph(fact_id, self.graph_adapter)
            except Exception as error:
                print(f"Warning: Failed to delete fact from graph: {error}")

        return cast(Dict[str, bool], result)

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
        result = await self.client.query(
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
        result = await self.client.query(
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
        result = await self.client.query(
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
        result = await self.client.query(
            "facts:getHistory", {"memorySpaceId": memory_space_id, "factId": fact_id}
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
        result = await self.client.query(
            "facts:exportFacts",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "format": format,
                "factType": fact_type,
            }),
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
        result = await self.client.mutation(
            "facts:consolidate",
            {
                "memorySpaceId": memory_space_id,
                "factIds": fact_ids,
                "keepFactId": keep_fact_id,
            },
        )

        return cast(Dict[str, Any], result)

