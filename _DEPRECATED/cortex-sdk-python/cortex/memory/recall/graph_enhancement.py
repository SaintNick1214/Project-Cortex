"""
Graph Enhancement Utilities for recall() Orchestration

These utilities leverage the graph database to discover related context
that wouldn't be found through direct vector/fact searches alone.

The graph expansion strategy:
1. Extract entities from initial search results
2. Traverse graph relationships to discover connected entities
3. Fetch additional memories/facts that mention discovered entities
"""

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, List, Optional, Set

if TYPE_CHECKING:
    from ...facts import FactsAPI
    from ...types import FactRecord, MemoryEntry
    from ...vector import VectorAPI


@dataclass
class GraphExpansionConfig:
    """Configuration for graph expansion."""
    max_depth: int = 2
    relationship_types: List[str] = field(default_factory=list)
    expand_from_facts: bool = True
    expand_from_memories: bool = True
    entities_per_hop: int = 5  # Max entities to expand per graph hop
    results_per_entity: int = 3  # Max results per discovered entity


@dataclass
class GraphExpansionResult:
    """Result from graph expansion."""
    discovered_entities: List[str] = field(default_factory=list)
    related_memories: List["MemoryEntry"] = field(default_factory=list)
    related_facts: List["FactRecord"] = field(default_factory=list)
    processed_ids: Set[str] = field(default_factory=set)


def extract_entities_from_results(
    memories: List["MemoryEntry"],
    facts: List["FactRecord"],
) -> List[str]:
    """
    Extract entity names from memories and facts.

    Entities are found in:
    - Fact subjects and objects
    - Memory content (mentioned entities)
    - Fact entity arrays (enriched extraction)

    Args:
        memories: List of memory entries
        facts: List of fact records

    Returns:
        List of unique entity names
    """
    entities: Set[str] = set()

    # Extract from facts (primary source of structured entities)
    for fact in facts:
        if fact.subject:
            entities.add(fact.subject)
        if fact.object:
            entities.add(fact.object)

        # Extract from enriched entities array
        if fact.entities:
            for entity in fact.entities:
                if hasattr(entity, 'name'):
                    entities.add(entity.name)
                elif isinstance(entity, dict) and 'name' in entity:
                    entities.add(entity['name'])

    # Extract from memories (user/agent mentions)
    for memory in memories:
        # Check for userId as an entity
        if memory.user_id:
            entities.add(memory.user_id)

        # Extract enriched content entities if available
        if memory.fact_category:
            entities.add(memory.fact_category)

    # Filter out empty/invalid entities
    return [
        e for e in entities
        if e and e.strip() and len(e) < 100
    ]


async def extract_entities_from_query(
    query: str,
    graph_adapter: Any,
) -> List[str]:
    """
    Extract potential entity names from a query string by looking them up
    in the graph database.

    This enables graph expansion even when initial search results don't
    contain facts with entities. The query text is tokenized and each
    significant word/phrase is checked against Entity nodes in the graph.

    Strategy:
    1. Tokenize query into words and n-grams (2-3 word phrases)
    2. Query the graph for Entity nodes matching each candidate
    3. Return matched entity names for graph traversal

    Args:
        query: Query string to extract entities from
        graph_adapter: Graph database adapter (can be None)

    Returns:
        List of matched entity names from the graph
    """
    import re

    if not graph_adapter or not query or not query.strip():
        return []

    try:
        # Check if graph is connected
        is_connected = await graph_adapter.is_connected()
        if not is_connected:
            return []

        matched_entities: List[str] = []

        # Tokenize query: split on spaces and common punctuation
        words = re.sub(r"[^\w\s'-]", " ", query.lower()).split()
        words = [w for w in words if len(w) > 2]  # Skip very short words

        # Generate candidate phrases: single words and n-grams
        candidates: Set[str] = set()

        # Add individual words (capitalized - common for names)
        for word in words:
            # Capitalize first letter (entity names are often proper nouns)
            capitalized = word[0].upper() + word[1:] if word else word
            candidates.add(capitalized)
            candidates.add(word)  # Also try lowercase

        # Add 2-word phrases (for names like "Planet Granite", "Sarah Chen")
        for i in range(len(words) - 1):
            phrase = " ".join(
                w[0].upper() + w[1:] if w else w
                for w in words[i:i + 2]
            )
            candidates.add(phrase)

        # Add 3-word phrases (for longer entity names)
        for i in range(len(words) - 2):
            phrase = " ".join(
                w[0].upper() + w[1:] if w else w
                for w in words[i:i + 3]
            )
            candidates.add(phrase)

        # Query graph for each candidate (limit to avoid performance issues)
        candidate_list = list(candidates)[:20]

        for candidate in candidate_list:
            try:
                # Look for exact match on entity name
                entity_nodes = await graph_adapter.find_nodes(
                    "Entity",
                    {"name": candidate},
                    1,
                )

                if entity_nodes:
                    matched_entities.append(candidate)
            except Exception:
                # Individual lookup failure - continue with others
                continue

        return matched_entities

    except Exception:
        # Query entity extraction failed - return empty (graceful degradation)
        return []


async def expand_via_graph(
    initial_entities: List[str],
    graph_adapter: Any,
    config: GraphExpansionConfig,
) -> List[str]:
    """
    Discover connected entities via graph traversal.

    Uses the GraphAdapter's traverse() method to find entities
    connected to the initial set within the specified depth.

    Args:
        initial_entities: Starting entity names
        graph_adapter: Graph database adapter
        config: Expansion configuration

    Returns:
        List of discovered entity names (excluding initial entities)
    """
    if not graph_adapter or not initial_entities:
        return []

    discovered_entities: Set[str] = set()

    try:
        # Check if graph is connected
        is_connected = await graph_adapter.is_connected()
        if not is_connected:
            return []

        # For each initial entity, traverse the graph
        # Use entities_per_hop from config (default: 5)
        max_entities = config.entities_per_hop if hasattr(config, 'entities_per_hop') else 5
        for entity_name in initial_entities[:max_entities]:
            try:
                # Find the entity node
                entity_nodes = await graph_adapter.find_nodes(
                    "Entity",
                    {"name": entity_name},
                    1,
                )

                if not entity_nodes:
                    continue

                entity_node = entity_nodes[0]
                node_id = getattr(entity_node, 'id', None)
                if not node_id:
                    continue

                # Build traversal config
                traversal_config = {
                    "startId": node_id,
                    "maxDepth": config.max_depth,
                    "direction": "BOTH",
                }

                if config.relationship_types:
                    traversal_config["relationshipTypes"] = config.relationship_types

                # Traverse from this entity
                connected_nodes = await graph_adapter.traverse(traversal_config)

                # Extract entity names from connected nodes
                for node in connected_nodes:
                    label = getattr(node, 'label', None)
                    properties = getattr(node, 'properties', {})

                    if label == "Entity" and properties.get("name"):
                        discovered_entities.add(properties["name"])

            except Exception:
                # Individual entity traversal failure - continue with others
                continue

        # Remove initial entities from discovered (we already have those)
        for initial in initial_entities:
            discovered_entities.discard(initial)

        return list(discovered_entities)

    except Exception:
        # Graph expansion failed - return empty (graceful degradation)
        return []


async def fetch_related_memories(
    discovered_entities: List[str],
    memory_space_id: str,
    vector_api: "VectorAPI",
    processed_ids: Set[str],
    limit: int = 10,
) -> List["MemoryEntry"]:
    """
    Fetch memories that reference discovered entities.

    Searches for memories where:
    - The content mentions any of the discovered entities
    - The memory is linked to facts about those entities

    Args:
        discovered_entities: Entities to search for
        memory_space_id: Memory space to search in
        vector_api: Vector API instance
        processed_ids: IDs already processed (to avoid re-fetching)
        limit: Maximum memories to return

    Returns:
        List of related memories
    """
    if not discovered_entities:
        return []

    related_memories: List["MemoryEntry"] = []

    try:
        from ...types import SearchOptions

        # Search for each entity (limit to top 5 to avoid too many queries)
        for entity in discovered_entities[:5]:
            try:
                # Use text search to find memories mentioning this entity
                search_opts = SearchOptions(
                    limit=max(1, limit // 5),
                    min_score=0.5,
                )
                memories = await vector_api.search(
                    memory_space_id,
                    entity,
                    search_opts,
                )

                for memory in memories:
                    memory_id = getattr(memory, 'memory_id', None)
                    if not memory_id:
                        continue

                    # Skip if already processed
                    if memory_id in processed_ids:
                        continue

                    related_memories.append(memory)
                    processed_ids.add(memory_id)

                    # Stop if we've reached the limit
                    if len(related_memories) >= limit:
                        break

                if len(related_memories) >= limit:
                    break

            except Exception:
                # Individual search failure - continue with others
                continue

        return related_memories

    except Exception:
        # Memory fetch failed - return empty (graceful degradation)
        return []


async def fetch_related_facts(
    discovered_entities: List[str],
    memory_space_id: str,
    facts_api: "FactsAPI",
    processed_ids: Set[str],
    limit: int = 10,
) -> List["FactRecord"]:
    """
    Fetch facts that reference discovered entities.

    Searches for facts where:
    - The subject or object matches discovered entities
    - The fact mentions the entity in its content

    Args:
        discovered_entities: Entities to search for
        memory_space_id: Memory space to search in
        facts_api: Facts API instance
        processed_ids: IDs already processed (to avoid re-fetching)
        limit: Maximum facts to return

    Returns:
        List of related facts
    """
    if not discovered_entities:
        return []

    related_facts: List["FactRecord"] = []

    try:
        # Query facts for each entity
        for entity in discovered_entities[:5]:
            try:
                from ...types import QueryBySubjectFilter

                # Query facts where entity is the subject
                subject_facts = await facts_api.query_by_subject(
                    QueryBySubjectFilter(
                        memory_space_id=memory_space_id,
                        subject=entity,
                        limit=max(1, limit // 10),
                    )
                )

                for fact in subject_facts:
                    fact_id = getattr(fact, 'fact_id', None)
                    if not fact_id:
                        continue

                    if fact_id in processed_ids:
                        continue

                    related_facts.append(fact)
                    processed_ids.add(fact_id)

                # Also search facts by text to catch mentions in object/content
                from ...types import SearchFactsOptions
                facts_search_opts = SearchFactsOptions(limit=max(1, limit // 10))
                search_facts = await facts_api.search(
                    memory_space_id,
                    entity,
                    facts_search_opts,
                )

                for fact in search_facts:
                    fact_id = getattr(fact, 'fact_id', None)
                    if not fact_id:
                        continue

                    if fact_id in processed_ids:
                        continue

                    related_facts.append(fact)
                    processed_ids.add(fact_id)

                if len(related_facts) >= limit:
                    break

            except Exception:
                # Individual query failure - continue with others
                continue

        return related_facts[:limit]

    except Exception:
        # Facts fetch failed - return empty (graceful degradation)
        return []


async def perform_graph_expansion(
    initial_memories: List["MemoryEntry"],
    initial_facts: List["FactRecord"],
    memory_space_id: str,
    graph_adapter: Any,
    vector_api: "VectorAPI",
    facts_api: "FactsAPI",
    config: GraphExpansionConfig,
    query_text: Optional[str] = None,
) -> GraphExpansionResult:
    """
    Full graph expansion pipeline.

    1. Extract entities from QUERY TEXT (NEW - enables expansion without facts)
    2. Extract entities from initial results (existing behavior)
    3. Combine and traverse graph to discover connected entities
    4. Fetch related memories and facts

    Args:
        initial_memories: Memories from initial search
        initial_facts: Facts from initial search
        memory_space_id: Memory space to search in
        graph_adapter: Graph database adapter (can be None)
        vector_api: Vector API instance
        facts_api: Facts API instance
        config: Expansion configuration
        query_text: Optional query text for entity extraction (v0.31.0+)

    Returns:
        GraphExpansionResult with discovered entities and related data
    """
    processed_ids: Set[str] = set()

    # Track initial IDs to avoid re-fetching
    for memory in initial_memories:
        if hasattr(memory, 'memory_id') and memory.memory_id:
            processed_ids.add(memory.memory_id)
    for fact in initial_facts:
        if hasattr(fact, 'fact_id') and fact.fact_id:
            processed_ids.add(fact.fact_id)

    # If no graph adapter or expansion disabled, return empty result
    if not graph_adapter or not config.expand_from_facts or not config.expand_from_memories:
        return GraphExpansionResult(processed_ids=processed_ids)

    # Step 1: Extract entities from QUERY TEXT (NEW - enables expansion without facts)
    # This allows graph expansion even when initial search results don't contain facts
    query_entities: List[str] = []
    if query_text:
        query_entities = await extract_entities_from_query(query_text, graph_adapter)

    # Step 2: Extract entities from initial results (existing behavior)
    result_entities = extract_entities_from_results(initial_memories, initial_facts)

    # Step 3: Combine all entities (deduplicated)
    all_entities = list(set(query_entities + result_entities))

    if not all_entities:
        return GraphExpansionResult(processed_ids=processed_ids)

    # Step 4: Expand via graph traversal
    discovered_entities = await expand_via_graph(
        all_entities,
        graph_adapter,
        config,
    )

    # Even if no NEW entities discovered, if we have initial entities from query,
    # we should still fetch related content for those entities
    max_entities = config.entities_per_hop if hasattr(config, 'entities_per_hop') else 5
    entities_to_fetch_raw = discovered_entities if discovered_entities else all_entities
    # Limit entities to fetch based on config
    entities_to_fetch = entities_to_fetch_raw[:max_entities]

    if not entities_to_fetch:
        return GraphExpansionResult(processed_ids=processed_ids)

    # Calculate total results limit: entities * results_per_entity
    results_per_entity = config.results_per_entity if hasattr(config, 'results_per_entity') else 3
    total_results_limit = len(entities_to_fetch) * results_per_entity

    # Step 5: Fetch related data in parallel
    import asyncio

    async def empty_list() -> List:
        return []

    related_memories_task = (
        fetch_related_memories(
            entities_to_fetch,
            memory_space_id,
            vector_api,
            processed_ids,
            total_results_limit,
        )
        if config.expand_from_memories
        else empty_list()
    )

    related_facts_task = (
        fetch_related_facts(
            entities_to_fetch,
            memory_space_id,
            facts_api,
            processed_ids,
            total_results_limit,
        )
        if config.expand_from_facts
        else empty_list()
    )

    related_memories, related_facts = await asyncio.gather(
        related_memories_task,
        related_facts_task,
    )

    return GraphExpansionResult(
        discovered_entities=entities_to_fetch,
        related_memories=related_memories,
        related_facts=related_facts,
        processed_ids=processed_ids,
    )
