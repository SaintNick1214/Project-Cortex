"""Captured physical lookup, scoped recall and derived-only orphan safety."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

import cortex.graph as graph
from cortex.graph import orphan_detection as orphan
from cortex.graph.errors import GraphDatabaseError
from cortex.graph.identity import (
    derived_graph_identity,
    identity_properties,
    primary_graph_identity,
)
from cortex.memory.recall import graph_enhancement as recall
from cortex.types import GraphQueryResult, GraphScope

SCOPE = GraphScope(True, "tenant", "space")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "name,args",
    [
        ("ensure_user_node", ("user",)),
        ("ensure_agent_node", ("agent",)),
        ("ensure_participant_node", ("participant",)),
        ("ensure_entity_node", ("entity", "type")),
        ("sync_memory_to_graph", ({"memoryId": "display"},)),
        ("sync_fact_to_graph", ({"factId": "display"},)),
        ("sync_context_to_graph", ({"contextId": "display"},)),
        ("delete_memory_from_graph", ("display",)),
        ("delete_fact_from_graph", ("display",)),
        ("delete_user_from_graph", ("user",)),
        ("delete_agent_from_graph", ("agent",)),
        ("update_fact_graph_status", ("display", "active")),
    ],
)
async def test_logical_helpers_refuse_before_any_adapter_effect(name, args):
    adapter = AsyncMock()
    with pytest.raises(GraphDatabaseError, match="GRAPH_CAPTURED_JOB_REQUIRED"):
        await getattr(graph, name)(*args, adapter)
    assert not adapter.mock_calls


@pytest.mark.asyncio
async def test_exact_physical_lookup_and_display_binding():
    identity = primary_graph_identity("Fact", "physical", SCOPE)
    node = SimpleNamespace(
        id="engine-id",
        properties={
            **identity_properties(identity),
            "factId": "display",
            "fact": "fact",
        },
    )
    adapter = SimpleNamespace(managed_dialect=AsyncMock(return_value='neo4j'),managed_read=AsyncMock(return_value=GraphQueryResult([{'id':node.id,'node':node.properties}],1)))
    assert (
        await graph.find_graph_node_id("Fact", "display", adapter, identity)
        == "engine-id"
    )
    assert adapter.managed_read.await_args.args == ('MATCH (n:CortexV2Fact {key:$key}) RETURN elementId(n) AS id,properties(n) AS node LIMIT 2', {'key':identity.key})
    with pytest.raises(GraphDatabaseError, match="GRAPH_IDENTITY_MISMATCH"):
        await graph.find_graph_node_id("Fact", "wrong-display", adapter, identity)
    adapter.managed_read.return_value = GraphQueryResult([{'id':node.id,'node':node.properties}]*2,2)
    with pytest.raises(GraphDatabaseError, match="GRAPH_IDENTITY_MISMATCH"):
        await graph.find_graph_node_id("Fact", "display", adapter, identity)
    adapter.managed_read.reset_mock()
    with pytest.raises(GraphDatabaseError, match="GRAPH_IDENTITY_REQUIRED"):
        await graph.find_graph_node_id("Fact", "display", adapter)
    adapter.managed_read.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('engine,native_id,expected',[('neo4j','opaque:element:731','opaque:element:731'),('memgraph',731,'731')])
async def test_managed_lookup_retains_canonical_tuple_text_and_actual_native_id(engine,native_id,expected):
    from cortex.graph.adapters.cypher import CypherGraphAdapter
    identity=primary_graph_identity('Fact','physical',SCOPE)
    properties={**identity_properties(identity),'factId':'display'}
    assert isinstance(CypherGraphAdapter()._deserialize_properties(properties)['tupleJson'],list)
    adapter=SimpleNamespace(managed_dialect=AsyncMock(return_value=engine),
        managed_read=AsyncMock(return_value=GraphQueryResult([{'id':native_id,'node':properties}],1)))
    assert await graph.find_graph_node_id('Fact','display',adapter,identity)==expected
    assert ('elementId(n)' if engine=='neo4j' else 'id(n)') in adapter.managed_read.await_args.args[0]
    adapter.managed_read.return_value=GraphQueryResult([{'id':native_id,'node':{**properties,'tupleJson':list(identity.tuple_json)}}],1)
    with pytest.raises(GraphDatabaseError,match='GRAPH_IDENTITY_MISMATCH'):
        await graph.find_graph_node_id('Fact','display',adapter,identity)


@pytest.mark.asyncio
async def test_chain_exact_scope_and_incomplete_budget_refused():
    identity = primary_graph_identity("Fact", "physical", SCOPE)
    properties = {**identity_properties(identity), "factId": "display", "fact": "fact"}
    result = GraphQueryResult([{"node": properties, "hops": 0}], 1)
    async def read(query, args):
        if " AS id,properties(n) AS node" in query:
            return GraphQueryResult([{"id":"engine-id","node":properties}],1)
        return adapter.chain_result
    adapter = SimpleNamespace(managed_dialect=AsyncMock(return_value='neo4j'),
        managed_read=AsyncMock(side_effect=read),chain_result=result)
    assert await graph.get_fact_supersession_chain_from_graph(
        "display", adapter, identity
    ) == [{"factId": "display", "fact": "fact"}]
    query, args = adapter.managed_read.await_args.args
    assert (
        "all(n IN nodes(path)" in query
        and "all(r IN relationships(path)" in query
        and args["space"] == "space"
        and args["tenantValue"] == "tenant"
    )
    adapter.chain_result = GraphQueryResult(
        [{"node": properties, "hops": 10}], 1
    )
    with pytest.raises(GraphDatabaseError, match="GRAPH_QUERY_BUDGET"):
        await graph.get_fact_supersession_chain_from_graph("display", adapter, identity)
    adapter.chain_result = GraphQueryResult(
        [{"node": {**properties, "tenantValue": "foreign"}, "hops": 1}], 1
    )
    with pytest.raises(GraphDatabaseError, match="GRAPH_IDENTITY_MISMATCH"):
        await graph.get_fact_supersession_chain_from_graph("display", adapter, identity)


@pytest.mark.asyncio
async def test_scoped_entity_seed_every_intermediate_and_primary_fetch_binding():
    seed = derived_graph_identity("Entity", "entity", SCOPE, "topic")["properties"]
    identity = primary_graph_identity("Memory", "physical-memory", SCOPE)
    memory = {**identity_properties(identity), "memoryId": "memory-display"}
    adapter = SimpleNamespace(
        managed_read=AsyncMock(
            side_effect=[
                GraphQueryResult([{"node": seed}], 1),
                GraphQueryResult([{"nodes": [seed, memory], "node": memory}], 1),
            ]
        )
    )
    selections = []
    assert (
        await recall.expand_via_graph(
            ["entity"], adapter, recall.GraphExpansionConfig(), SCOPE, selections
        )
        == []
    )
    assert selections[0].physical_source_id == "physical-memory"
    query, args = adapter.managed_read.await_args.args
    assert (
        "all(n IN nodes(path)" in query
        and "r.sourceTuple=startNode(r).tupleJson" in query
        and args["space"] == "space"
    )
    row = SimpleNamespace(
        _id="physical-memory",
        memory_space_id="space",
        tenant_id="tenant",
        memory_id="memory-display",
    )
    api = SimpleNamespace(get=AsyncMock(return_value=row))
    processed = set()
    assert await recall.fetch_related_memories(
        [], "space", api, processed, 10, selections, SCOPE
    ) == [row]
    api.get.assert_awaited_once_with("space", "memory-display", tenant_id="tenant")
    row._id = "replacement-physical"
    with pytest.raises(GraphDatabaseError, match="GRAPH_PRIMARY_CHANGED"):
        await recall.fetch_related_memories(
            [], "space", api, set(), 10, selections, SCOPE
        )
    foreign = {**memory, "spaceValue": "foreign-space"}
    adapter.managed_read.side_effect = [
        GraphQueryResult([{"node": seed}], 1),
        GraphQueryResult([{"nodes": [seed, foreign, memory], "node": memory}], 1),
    ]
    with pytest.raises(GraphDatabaseError, match="GRAPH_IDENTITY_MISMATCH"):
        await recall.expand_via_graph(
            ["entity"], adapter, recall.GraphExpansionConfig(), SCOPE, []
        )


@pytest.mark.asyncio
async def test_missing_scope_unknown_seed_and_bad_limits_refuse():
    adapter = SimpleNamespace(
        managed_read=AsyncMock(), is_connected=AsyncMock(return_value=True)
    )
    with pytest.raises(GraphDatabaseError, match="GRAPH_IDENTITY_REQUIRED"):
        await recall.extract_entities_from_query("entity", adapter)
    adapter.managed_read.assert_not_awaited()
    adapter.managed_read.return_value = GraphQueryResult(
        [{"node": {"kind": "Entity", "name": "entity", "type": "topic"}}], 1
    )
    with pytest.raises(GraphDatabaseError, match="GRAPH_IDENTITY_MISMATCH"):
        await recall.extract_entities_from_query("entity", adapter, SCOPE)
    for config in [
        recall.GraphExpansionConfig(max_depth=11),
        recall.GraphExpansionConfig(relationship_types=["MANUAL"]),
        recall.GraphExpansionConfig(entities_per_hop=True),
    ]:
        with pytest.raises(GraphDatabaseError, match="GRAPH_QUERY_BUDGET"):
            await recall.expand_via_graph(["entity"], adapter, config, SCOPE)


@pytest.mark.asyncio
async def test_one_enabled_recall_source_and_fact_physical_binding(monkeypatch):
    row = SimpleNamespace(
        _id="physical-fact",
        fact_id="fact-display",
        memory_space_id="space",
        tenant_id="tenant",
    )
    selection = recall.GraphNativeSelection(
        "Fact", "physical-fact", "fact-display", SCOPE
    )
    api = SimpleNamespace(get=AsyncMock(return_value=row))
    assert await recall.fetch_related_facts(
        [], "space", api, set(), 10, [selection], SCOPE
    ) == [row]
    row.tenant_id = "foreign"
    with pytest.raises(GraphDatabaseError, match="GRAPH_PRIMARY_CHANGED"):
        await recall.fetch_related_facts(
            [], "space", api, set(), 10, [selection], SCOPE
        )
    monkeypatch.setattr(
        recall, "extract_entities_from_results", lambda memories, facts: ["entity"]
    )

    async def expand(names, adapter, config, scope, selections):
        selections.append(selection)
        return ["related"]

    monkeypatch.setattr(recall, "expand_via_graph", expand)
    facts = AsyncMock(return_value=[row])
    monkeypatch.setattr(recall, "fetch_related_facts", facts)
    memories = AsyncMock()
    monkeypatch.setattr(recall, "fetch_related_memories", memories)
    result = await recall.perform_graph_expansion(
        [],
        [],
        "space",
        object(),
        object(),
        api,
        recall.GraphExpansionConfig(expand_from_memories=False),
        selected_scope=SCOPE,
    )
    assert result.related_facts == [row] and result.discovered_entities == ["related"]
    memories.assert_not_awaited()
    facts.assert_awaited_once()


def island_adapter(*, live=False, manual=False, foreign=False, degree=1):
    first = derived_graph_identity("Entity", "first", SCOPE, "topic")["properties"]
    second = derived_graph_identity(
        "Entity",
        "second",
        GraphScope(True, "foreign", "space") if foreign else SCOPE,
        "topic",
    )["properties"]
    source = primary_graph_identity("Fact", "owner", SCOPE)
    edge = {
        "schemaVersion": 2,
        "edgeKey": "fixed-edge",
        "ownerKey": source.key,
        "ownerTuple": source.tuple_json,
        "sourceKey": first["key"],
        "sourceTuple": first["tupleJson"],
        "targetKey": second["key"],
        "targetTuple": second["tupleJson"],
    }
    if manual:
        edge = {}
    queries = []

    async def query(text, args=None):
        queries.append((text, args))
        if "elementId(n)=$id" in text:
            return GraphQueryResult([{'node':first}],1)
        if "RETURN properties(n) AS node" in text:
            return GraphQueryResult(
                [{"node": first if args["key"] == first["key"] else second}], 1
            )
        if "LIMIT 65" in text:
            return GraphQueryResult(
                [
                    {
                        "edge": edge,
                        "source": first,
                        "target": second,
                        "other": second if args["key"] == first["key"] else first,
                        "type": "ENTITY_RELATION",
                    }
                ],
                degree,
            )
        if "RETURN properties(s) AS state" in text:
            return GraphQueryResult(
                [{"state": {"tupleJson": source.tuple_json, "tombstoned": not live}}], 1
            )
        return GraphQueryResult([], 0)

    async def transaction(operation):
        return await operation(SimpleNamespace(query=query))

    return (
        SimpleNamespace(
            managed_dialect=AsyncMock(return_value="neo4j"),
            managed_read=query,
            managed_transaction=transaction,
        ),
        queries,
        first,
        second,
    )


@pytest.mark.asyncio
async def test_orphan_atomic_derived_only_dead_owner_island_and_canonical_receipt():
    adapter, queries, first, second = island_adapter()
    context = orphan.create_deletion_context("controlled", scope=SCOPE)
    detected = await orphan.detect_orphan("engine-id", "Entity", context, adapter)
    assert detected.is_orphan and detected.part_of_circular_island
    result = await orphan.delete_with_orphan_cleanup(
        "engine-id", "Entity", context, adapter
    )
    assert set(result.deleted_nodes) == {
        first["key"],
        second["key"],
    } and result.deleted_edges == ["fixed-edge"]
    assert context.deleted_node_ids == set(result.deleted_nodes)
    delete_index = next(
        i for i, (text, _) in enumerate(queries) if "DETACH DELETE" in text
    )
    assert sum("SET n.key=n.key" in text for text, _ in queries[:delete_index]) == 2
    assert (
        queries[delete_index][1]["space"] == "space"
        and queries[delete_index][1]["tenantValue"] == "tenant"
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "options,code",
    [
        ({"live": True}, "GRAPH_ERASURE_BLOCKED"),
        ({"manual": True}, "GRAPH_ERASURE_BLOCKED"),
        ({"foreign": True}, "GRAPH_ERASURE_BLOCKED"),
        ({"degree": 65}, "GRAPH_QUERY_BUDGET"),
    ],
)
async def test_orphan_live_manual_foreign_incomplete_preserved(options, code):
    adapter, queries, _, _ = island_adapter(**options)
    with pytest.raises(GraphDatabaseError, match=code):
        await orphan.delete_with_orphan_cleanup(
            "engine-id",
            "Entity",
            orphan.create_deletion_context("controlled", scope=SCOPE),
            adapter,
        )
    assert not any("DETACH DELETE" in text for text, _ in queries)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "label",
    [
        "Memory",
        "Fact",
        "Context",
        "Conversation",
        "MemorySpace",
        "Immutable",
        "Mutable",
        "Artifact",
        "User",
        "Agent",
        "Participant",
        "Legacy",
    ],
)
async def test_orphan_protects_every_primary_and_principal_before_reads(label):
    adapter = AsyncMock()
    context = orphan.create_deletion_context("controlled", scope=SCOPE)
    assert not (
        await orphan.detect_orphan("engine-id", label, context, adapter)
    ).is_orphan
    with pytest.raises(GraphDatabaseError, match="GRAPH_ERASURE_BLOCKED"):
        await orphan.delete_with_orphan_cleanup("engine-id", label, context, adapter)
    assert not adapter.mock_calls
