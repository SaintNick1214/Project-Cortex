"""
Cortex SDK - Facts API

Layer 3: Structured knowledge extraction and storage
"""

from typing import Optional, List, Dict, Any

from ..types import (
    FactRecord,
    StoreFactParams,
    StoreFactOptions,
    UpdateFactOptions,
    DeleteFactOptions,
    FactType,
)
from ..errors import CortexError, ErrorCode
from .._utils import filter_none_values, convert_convex_response


class FactsAPI:
    """
    Facts API - Layer 3

    Manages structured fact storage with versioning, relationships, and temporal validity.
    """

    def __init__(self, client, graph_adapter=None):
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
        memory_space_id: str,
        fact_type: Optional[FactType] = None,
        subject: Optional[str] = None,
        tags: Optional[List[str]] = None,
        include_superseded: bool = False,
        limit: int = 100,
    ) -> List[FactRecord]:
        """
        List facts with filters.

        Args:
            memory_space_id: Memory space ID
            fact_type: Filter by fact type
            subject: Filter by subject entity
            tags: Filter by tags
            include_superseded: Include old versions
            limit: Maximum results

        Returns:
            List of fact records

        Example:
            >>> preferences = await cortex.facts.list(
            ...     'agent-1',
            ...     fact_type='preference',
            ...     subject='user-123'
            ... )
        """
        result = await self.client.query(
            "facts:list",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "factType": fact_type,
                "subject": subject,
                "tags": tags,
                "includeSuperseded": include_superseded,
                "limit": limit,
            }),
        )

        return [FactRecord(**convert_convex_response(fact)) for fact in result]

    async def search(
        self,
        memory_space_id: str,
        query: str,
        fact_type: Optional[FactType] = None,
        min_confidence: Optional[int] = None,
        tags: Optional[List[str]] = None,
        limit: int = 10,
    ) -> List[FactRecord]:
        """
        Search facts with text matching.

        Args:
            memory_space_id: Memory space ID
            query: Search query string
            fact_type: Filter by fact type
            min_confidence: Minimum confidence threshold
            tags: Filter by tags
            limit: Maximum results

        Returns:
            List of matching facts

        Example:
            >>> food_facts = await cortex.facts.search(
            ...     'agent-1', 'food preferences',
            ...     fact_type='preference',
            ...     min_confidence=80
            ... )
        """
        result = await self.client.query(
            "facts:search",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "query": query,
                "factType": fact_type,
                "minConfidence": min_confidence,
                "tags": tags,
                "limit": limit,
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

        return result

    async def count(
        self,
        memory_space_id: str,
        fact_type: Optional[FactType] = None,
        include_superseded: bool = False,
    ) -> int:
        """
        Count facts matching filters.

        Args:
            memory_space_id: Memory space ID
            fact_type: Filter by fact type
            include_superseded: Include old versions

        Returns:
            Count of matching facts

        Example:
            >>> total = await cortex.facts.count(
            ...     'agent-1',
            ...     fact_type='preference'
            ... )
        """
        result = await self.client.query(
            "facts:count",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "factType": fact_type,
                "includeSuperseded": include_superseded,
            }),
        )

        return int(result)

    async def query_by_subject(
        self,
        memory_space_id: str,
        subject: str,
        fact_type: Optional[FactType] = None,
    ) -> List[FactRecord]:
        """
        Get all facts about a specific entity.

        Args:
            memory_space_id: Memory space ID
            subject: Subject entity
            fact_type: Filter by fact type

        Returns:
            List of facts about the subject

        Example:
            >>> user_facts = await cortex.facts.query_by_subject(
            ...     'agent-1', 'user-123'
            ... )
        """
        result = await self.client.query(
            "facts:queryBySubject",
            filter_none_values({
                "memorySpaceId": memory_space_id,
                "subject": subject,
                "factType": fact_type,
            }),
        )

        return [FactRecord(**convert_convex_response(fact)) for fact in result]

    async def query_by_relationship(
        self, memory_space_id: str, subject: str, predicate: str
    ) -> List[FactRecord]:
        """
        Get facts with specific relationship.

        Args:
            memory_space_id: Memory space ID
            subject: Subject entity
            predicate: Relationship type

        Returns:
            List of matching facts

        Example:
            >>> work_places = await cortex.facts.query_by_relationship(
            ...     'agent-1', 'user-123', 'works_at'
            ... )
        """
        result = await self.client.query(
            "facts:queryByRelationship",
            {
                "memorySpaceId": memory_space_id,
                "subject": subject,
                "predicate": predicate,
            },
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

        return result

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

        return result

