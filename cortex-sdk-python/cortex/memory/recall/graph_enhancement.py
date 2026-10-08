"""
Graph Enhancement Utilities for recall() Orchestration

These utilities leverage the graph database to discover related context
that wouldn't be found through direct vector/fact searches alone.

The graph expansion strategy:
1. Extract entities from initial search results
2. Traverse graph relationships to discover connected entities
3. Fetch additional memories/facts that mention discovered entities
"""

import asyncio
import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Set

from ...graph.errors import GraphDatabaseError
from ...graph.identity import (
    MANAGED_LABELS,
    MANAGED_RELATIONSHIPS,
    assert_identity_properties,
    derived_graph_identity,
    primary_graph_identity,
    safe_integer,
)
from ...types import GraphScope

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
                if hasattr(entity, "name"):
                    entities.add(entity.name)
                elif isinstance(entity, dict) and "name" in entity:
                    entities.add(entity["name"])

    # Extract from memories (user/agent mentions)
    for memory in memories:
        # Check for userId as an entity
        if memory.user_id:
            entities.add(memory.user_id)

        # Extract enriched content entities if available
        if memory.fact_category:
            entities.add(memory.fact_category)

    # Filter out empty/invalid entities
    return [e for e in entities if e and e.strip() and len(e) < 100]


@dataclass
class GraphNativeSelection:
    kind: str
    physical_source_id: str
    logical_id: str
    scope: GraphScope


def _exact_scope(
    scope: Optional[GraphScope], memory_space_id: Optional[str] = None
) -> GraphScope:
    if (
        scope is None
        or scope.tenant_known is not True
        or scope.tenant_id is not None
        and (not isinstance(scope.tenant_id, str) or not scope.tenant_id)
        or not isinstance(scope.memory_space_id, str)
        or not scope.memory_space_id
        or memory_space_id is not None
        and scope.memory_space_id != memory_space_id
    ):
        raise GraphDatabaseError(
            "Graph expansion needs exact known tenant and owning space.",
            "GRAPH_IDENTITY_REQUIRED",
        )
    return scope


def _scope_parameters(scope: GraphScope) -> Dict[str, Any]:
    return {
        "tenantTag": "knownTenantless" if scope.tenant_id is None else "tenant",
        "tenantValue": scope.tenant_id or "",
        "space": scope.memory_space_id,
    }


def _entity(node: Dict[str, Any], scope: GraphScope) -> None:
    if (
        node.get("kind") != "Entity"
        or not isinstance(node.get("name"), str)
        or not isinstance(node.get("type"), str)
    ):
        raise GraphDatabaseError(
            "Malformed managed Entity projection.", "GRAPH_IDENTITY_MISMATCH"
        )
    expected = derived_graph_identity("Entity", node["name"], scope, node["type"])
    if any(node.get(key) != value for key, value in expected["properties"].items()):
        raise GraphDatabaseError(
            "Managed Entity key, tuple or scope mismatch.", "GRAPH_IDENTITY_MISMATCH"
        )


def _path_node(node: Dict[str, Any], scope: GraphScope) -> None:
    if node.get("kind") == "Entity":
        _entity(node, scope)
        return
    if node.get("kind") not in (
        "Memory",
        "Fact",
        "Context",
        "Conversation",
        "MemorySpace",
        "Artifact",
    ) or not isinstance(node.get("physicalSourceId"), str):
        raise GraphDatabaseError(
            "Legacy or inapplicable path node excluded.", "GRAPH_IDENTITY_MISMATCH"
        )
    assert_identity_properties(
        node, primary_graph_identity(node["kind"], node["physicalSourceId"], scope)
    )


async def _entity_seeds(
    name: str, adapter: Any, scope: GraphScope
) -> List[Dict[str, Any]]:
    if not callable(getattr(adapter, "managed_read", None)):
        raise GraphDatabaseError(
            "Managed bounded reads unavailable.", "GRAPH_SCHEMA_MIGRATION_REQUIRED"
        )
    result = await adapter.managed_read(
        "MATCH (n:CortexV2Entity) WHERE n.schemaVersion=2 AND n.tenantTag=$tenantTag AND n.tenantValue=$tenantValue AND n.spaceTag='space' AND n.spaceValue=$space AND n.name=$name RETURN properties(n) AS node LIMIT 65",
        {**_scope_parameters(scope), "name": name.strip().lower()},
    )
    if result.count > 64:
        raise GraphDatabaseError(
            "Scoped Entity matches exceed budget.", "GRAPH_QUERY_BUDGET"
        )
    nodes = []
    for row in result.records:
        node = row.get("node", {})
        _entity(node, scope)
        nodes.append(node)
    return nodes


async def extract_entities_from_query(
    query: str, graph_adapter: Any, selected_scope: Optional[GraphScope] = None
) -> List[str]:
    if not graph_adapter or not query.strip():
        return []
    scope = _exact_scope(selected_scope)
    if not await graph_adapter.is_connected():
        raise GraphDatabaseError(
            "Graph expansion connection unavailable.", "GRAPH_EXPANSION_UNAVAILABLE"
        )
    words = [
        word
        for word in re.sub(r"[^\w\s'-]", " ", query.lower(), flags=re.ASCII).split()
        if len(word) > 2
    ]
    candidates = list(dict.fromkeys(words))
    for size in (2, 3):
        for index in range(len(words) - size + 1):
            phrase = " ".join(words[index : index + size])
            if phrase not in candidates:
                candidates.append(phrase)
    matched = []
    for candidate in candidates[:20]:
        for node in await _entity_seeds(candidate, graph_adapter, scope):
            if node["name"] not in matched:
                matched.append(node["name"])
    return matched


async def expand_via_graph(
    initial_entities: List[str],
    graph_adapter: Any,
    config: GraphExpansionConfig,
    selected_scope: Optional[GraphScope] = None,
    native_selections: Optional[List[GraphNativeSelection]] = None,
) -> List[str]:
    if not initial_entities or config.max_depth == 0:
        return []
    scope = _exact_scope(selected_scope)
    maximum = config.entities_per_hop
    if (
        not safe_integer(config.max_depth)
        or not 0 <= config.max_depth <= 10
        or not safe_integer(maximum)
        or not 1 <= maximum <= 64
        or any(kind not in MANAGED_RELATIONSHIPS for kind in config.relationship_types)
    ):
        raise GraphDatabaseError(
            "Invalid bounded graph expansion options.", "GRAPH_QUERY_BUDGET"
        )
    if not callable(getattr(graph_adapter, "managed_read", None)):
        raise GraphDatabaseError(
            "Managed expansion unavailable.", "GRAPH_SCHEMA_MIGRATION_REQUIRED"
        )
    selections = native_selections if native_selections is not None else []
    selected = {item.physical_source_id for item in selections}
    discovered = []
    for name in initial_entities[:maximum]:
        for seed in await _entity_seeds(name, graph_adapter, scope):
            result = await graph_adapter.managed_read(
                f"""MATCH path=(seed:CortexV2Entity {{key:$key}})-[*1..{int(config.max_depth)}]-(node)
            WHERE all(n IN nodes(path) WHERE n.schemaVersion=2 AND n.tenantTag=$tenantTag AND n.tenantValue=$tenantValue AND n.spaceTag='space' AND n.spaceValue=$space AND any(label IN labels(n) WHERE label IN $labels))
              AND all(r IN relationships(path) WHERE r.schemaVersion=2 AND r.sourceKey=startNode(r).key AND r.sourceTuple=startNode(r).tupleJson AND r.targetKey=endNode(r).key AND r.targetTuple=endNode(r).tupleJson AND type(r) IN $relationships)
            RETURN [n IN nodes(path)|properties(n)] AS nodes,properties(node) AS node LIMIT 65""",
                {
                    **_scope_parameters(scope),
                    "key": seed["key"],
                    "labels": [
                        MANAGED_LABELS[kind]
                        for kind in (
                            "Entity",
                            "Memory",
                            "Fact",
                            "Context",
                            "Conversation",
                            "MemorySpace",
                            "Artifact",
                        )
                    ],
                    "relationships": config.relationship_types
                    or list(MANAGED_RELATIONSHIPS),
                },
            )
            if result.count > 64:
                raise GraphDatabaseError(
                    "Managed expansion exceeds path budget.", "GRAPH_QUERY_BUDGET"
                )
            for row in result.records:
                if not isinstance(row.get("nodes"), list):
                    raise GraphDatabaseError(
                        "Malformed managed path.", "GRAPH_IDENTITY_MISMATCH"
                    )
                for value in row["nodes"]:
                    _path_node(value, scope)
                node = row.get("node", {})
                if node.get("kind") == "Entity" and node.get("name") not in discovered:
                    discovered.append(node["name"])
                if (
                    node.get("kind") in ("Memory", "Fact")
                    and node.get("physicalSourceId") not in selected
                ):
                    logical_id = node.get(
                        "memoryId" if node["kind"] == "Memory" else "factId"
                    )
                    if not isinstance(logical_id, str):
                        raise GraphDatabaseError(
                            "Native display identity missing.",
                            "GRAPH_IDENTITY_MISMATCH",
                        )
                    selected.add(node["physicalSourceId"])
                    selections.append(
                        GraphNativeSelection(
                            node["kind"], node["physicalSourceId"], logical_id, scope
                        )
                    )
    return [
        name
        for name in discovered
        if name not in {name.strip().lower() for name in initial_entities}
    ]


async def fetch_related_memories(
    discovered_entities: List[str],
    memory_space_id: str,
    vector_api: "VectorAPI",
    processed_ids: Set[str],
    limit: int = 10,
    selections: Optional[List[GraphNativeSelection]] = None,
    selected_scope: Optional[GraphScope] = None,
) -> List["MemoryEntry"]:
    scope = _exact_scope(selected_scope, memory_space_id)
    if not safe_integer(limit) or limit < 0:
        raise GraphDatabaseError("Invalid graph result window.", "GRAPH_QUERY_BUDGET")
    related: List["MemoryEntry"] = []
    for item in selections or []:
        if item.kind != "Memory" or item.logical_id in processed_ids:
            continue
        if len(related) >= limit:
            break
        row = await vector_api.get(
            memory_space_id, item.logical_id, tenant_id=scope.tenant_id
        )
        if row is None:
            continue
        if (
            row._id != item.physical_source_id
            or row.memory_space_id != memory_space_id
            or row.tenant_id != scope.tenant_id
        ):
            raise GraphDatabaseError(
                "Graph Memory physical source changed; no logical replacement adopted.",
                "GRAPH_PRIMARY_CHANGED",
            )
        related.append(row)
        processed_ids.add(row.memory_id)
    return related


async def fetch_related_facts(
    discovered_entities: List[str],
    memory_space_id: str,
    facts_api: "FactsAPI",
    processed_ids: Set[str],
    limit: int = 10,
    selections: Optional[List[GraphNativeSelection]] = None,
    selected_scope: Optional[GraphScope] = None,
) -> List["FactRecord"]:
    scope = _exact_scope(selected_scope, memory_space_id)
    if not safe_integer(limit) or limit < 0:
        raise GraphDatabaseError("Invalid graph result window.", "GRAPH_QUERY_BUDGET")
    related: List["FactRecord"] = []
    for item in selections or []:
        if item.kind != "Fact" or item.logical_id in processed_ids:
            continue
        if len(related) >= limit:
            break
        row = await facts_api.get(
            memory_space_id, item.logical_id, tenant_id=scope.tenant_id
        )
        if row is None:
            continue
        if (
            row._id != item.physical_source_id
            or row.memory_space_id != memory_space_id
            or row.tenant_id != scope.tenant_id
        ):
            raise GraphDatabaseError(
                "Graph Fact physical source changed; no logical replacement adopted.",
                "GRAPH_PRIMARY_CHANGED",
            )
        related.append(row)
        processed_ids.add(row.fact_id)
    return related


async def perform_graph_expansion(
    initial_memories: List["MemoryEntry"],
    initial_facts: List["FactRecord"],
    memory_space_id: str,
    graph_adapter: Any,
    vector_api: "VectorAPI",
    facts_api: "FactsAPI",
    config: GraphExpansionConfig,
    query_text: Optional[str] = None,
    selected_scope: Optional[GraphScope] = None,
) -> GraphExpansionResult:
    processed_ids = {row.memory_id for row in initial_memories} | {
        row.fact_id for row in initial_facts
    }
    if (
        not graph_adapter
        or not config.expand_from_facts
        and not config.expand_from_memories
    ):
        return GraphExpansionResult(processed_ids=processed_ids)
    scope = _exact_scope(selected_scope, memory_space_id)
    selections: List[GraphNativeSelection] = []
    query_entities = (
        await extract_entities_from_query(query_text, graph_adapter, scope)
        if query_text
        else []
    )
    all_entities = list(
        dict.fromkeys(
            query_entities
            + extract_entities_from_results(initial_memories, initial_facts)
        )
    )
    if not all_entities:
        return GraphExpansionResult(processed_ids=processed_ids)
    discovered = await expand_via_graph(
        all_entities, graph_adapter, config, scope, selections
    )
    entities = (discovered or all_entities)[: config.entities_per_hop]
    if not entities:
        return GraphExpansionResult(processed_ids=processed_ids)
    total_limit = len(entities) * config.results_per_entity

    async def empty() -> List[Any]:
        return []

    memories, facts = await asyncio.gather(
        fetch_related_memories(
            entities,
            memory_space_id,
            vector_api,
            processed_ids,
            total_limit,
            selections,
            scope,
        )
        if config.expand_from_memories
        else empty(),
        fetch_related_facts(
            entities,
            memory_space_id,
            facts_api,
            processed_ids,
            total_limit,
            selections,
            scope,
        )
        if config.expand_from_facts
        else empty(),
    )
    return GraphExpansionResult(entities, memories, facts, processed_ids)
