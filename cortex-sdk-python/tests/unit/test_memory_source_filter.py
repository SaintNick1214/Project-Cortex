"""I166 public memory/vector filters with controlled state and ordinary paging."""

from typing import Any, get_args

import pytest

from cortex.graph.erasure import requested_graph
from cortex.graph.errors import GraphDatabaseError
from cortex.memory import MemoryAPI
from cortex.types import (
    AuthContext,
    MemoryMetadata,
    MemorySource,
    SourceType,
    StoreFactParams,
    StoreMemoryInput,
    UpdateMemoryOptions,
)
from cortex.vector import VectorAPI

SOURCES = ("conversation", "system", "tool", "a2a", "fact-extraction")
FILTER = dict(memory_space_id="selected-space", tenant_id="selected-tenant", user_id="selected-user", participant_id="selected-participant", source_type="fact-extraction")
NATIVE = dict(memorySpaceId=FILTER["memory_space_id"], tenantId=FILTER["tenant_id"], userId=FILTER["user_id"], participantId=FILTER["participant_id"], sourceType=FILTER["source_type"])


def memory(id_: str, **overrides: Any) -> dict[str, Any]:
    return dict(_id=id_, memoryId=f"logical-{id_}", **NATIVE, content=id_, contentType="raw", sourceTimestamp=1, importance=50, tags=[], version=1, previousVersions=[], createdAt=1, updatedAt=1, accessCount=0) | overrides


class Transport:
    def __init__(self, count: int = 129) -> None:
        self.owned = [memory(f"owned-{index}") for index in range(count)]
        self.controls = [memory("other-source", sourceType="system"), memory("other-tenant", tenantId="foreign-tenant"), memory("other-space", memorySpaceId="foreign-space"), memory("other-user", userId="foreign-user"), memory("other-participant", participantId="foreign-participant")]
        self.rows = self.owned + self.controls
        self.facts: list[dict[str, Any]] = []
        self.calls: list[tuple[str, dict[str, Any]]] = []
        self.scans = 0
        self.change_on_reselection = False

    def selected(self, args: dict[str, Any]) -> list[dict[str, Any]]:
        return [row for row in self.rows if all(args.get(key) is None or args[key] == row[key] for key in NATIVE)]

    async def query(self, name: str, args: dict[str, Any]) -> Any:
        self.calls.append((name, args))
        if name == "memories:count":
            return len(self.selected(args))
        if name == "facts:candidatePage":
            return dict(page=[], isDone=True, continueCursor="end")
        assert name == "memories:domainPage"
        window = args["paginationOpts"]
        if window["cursor"] is None:
            self.scans += 1
        start = int(window["cursor"] or 0)
        matches = self.selected(args)
        page = matches[start:start + window["numItems"]]
        fingerprint = ("b" if self.change_on_reselection and self.scans > 1 else "a") * 64
        return dict(page=page, isDone=start + len(page) >= len(matches), continueCursor=str(start + len(page)), fingerprints={row["_id"]: fingerprint for row in page})

    async def mutation(self, name: str, args: dict[str, Any]) -> Any:
        self.calls.append((name, args))
        if name == "memories:store":
            stored = memory("created-memory", **args)
            self.rows.append(stored)
            return stored
        if name == "memories:update":
            stored = next(row for row in self.rows if row["memoryId"] == args["memoryId"] and row["memorySpaceId"] == args["memorySpaceId"])
            stored["content"] = args["content"]
            return stored
        if name == "facts:store":
            assert args["sourceType"] in (*SOURCES, "manual")
            if "sourceRef" in args:
                reference = args["sourceRef"]
                for key in ("conversationId", "memoryId"):
                    if key in reference:
                        assert isinstance(reference[key], str)
                assert isinstance(reference["messageIds"], list)
            stored = dict(_id=f"fact-document-{len(self.facts)}", factId=f"fact-{len(self.facts)}", version=1, createdAt=1, updatedAt=1, **args)
            self.facts.append(stored)
            return stored
        assert name == "memories:eraseSelected"
        row = next(row for row in self.rows if row["_id"] == args["physicalId"])
        assert row["tenantId"] == args["tenantId"] and row["memorySpaceId"] == args["memorySpaceId"]
        assert args["expectedFingerprint"] == "a" * 64
        self.rows = [item for item in self.rows if item["_id"] != row["_id"]]
        return dict(deleted=True)


def api(kind: str, transport: Transport, configured: bool = True) -> Any:
    auth = AuthContext(user_id="actor", tenant_id=FILTER["tenant_id"]) if configured else None
    return (MemoryAPI if kind == "memory" else VectorAPI)(transport, auth_context=auth)


async def clear(subject: Any, kind: str, filters: dict[str, Any]) -> Any:
    if kind == "memory":
        return await subject.delete_many(filters["memory_space_id"], {key: value for key, value in filters.items() if key != "memory_space_id"})
    return await subject.delete_many(**filters)


def test_public_source_type_matches_native_contract() -> None:
    assert get_args(SourceType) == SOURCES


@pytest.mark.parametrize("kind", ["memory", "vector"])
@pytest.mark.parametrize("source", SOURCES)
async def test_supported_source_count_keeps_scope(kind: str, source: str) -> None:
    transport = Transport(1)
    subject = api(kind, transport)
    count = await subject.count(FILTER["memory_space_id"], user_id=FILTER["user_id"], participant_id=FILTER["participant_id"], source_type=source)
    assert count == (1 if source in ("system", "fact-extraction") else 0)
    assert transport.calls == [("memories:count", NATIVE | {"sourceType": source})]


@pytest.mark.parametrize("kind", ["memory", "vector"])
@pytest.mark.parametrize("configured", [True, False])
async def test_fact_filter_pages_clear_and_foreign_preservation(kind: str, configured: bool) -> None:
    transport = Transport()
    subject = api(kind, transport, configured)
    if configured:
        assert await subject.count(FILTER["memory_space_id"], user_id=FILTER["user_id"], participant_id=FILTER["participant_id"], source_type=FILTER["source_type"]) == 129
    listed = await subject.list(**FILTER, limit=200)
    assert [row.memory_id for row in listed] == [row["memoryId"] for row in transport.owned]
    assert [args["paginationOpts"]["cursor"] for name, args in transport.calls if name == "memories:domainPage"] == [None, "128"]
    result = await clear(subject, kind, FILTER)
    deleted = result.deleted if kind == "memory" else result["deleted"]
    ids = result.memory_ids if kind == "memory" else result["memoryIds"]
    partial = result.partial if kind == "memory" else result["partial"]
    assert deleted == 129 and ids == [row["memoryId"] for row in transport.owned]
    assert partial["confirmedCount"] == 129 and partial["remainingPhysicalIds"] == partial["unknownPhysicalIds"] == []
    if kind == "memory":
        assert result.facts_deleted == 0 and result.fact_ids == []
    assert transport.rows == transport.controls
    assert await subject.list(**FILTER, limit=200) == []
    mutations = [args for name, args in transport.calls if name == "memories:eraseSelected"]
    assert [args["physicalId"] for args in mutations] == [row["_id"] for row in transport.owned]
    assert all(args["expectedFingerprint"] == "a" * 64 for args in mutations)
    if kind == "memory":
        assert all(args["requireNoLinkedFacts"] is True for args in mutations)
    for name, args in transport.calls:
        if name.startswith("memories:"):
            assert args["tenantId"] == FILTER["tenant_id"] and args["memorySpaceId"] == FILTER["memory_space_id"]
            if name != "memories:eraseSelected":
                assert {key: args[key] for key in NATIVE} == NATIVE


@pytest.mark.parametrize("kind", ["memory", "vector"])
@pytest.mark.parametrize("method", ["count", "list", "delete_many"])
async def test_invalid_source_refuses_before_transport(kind: str, method: str) -> None:
    transport = Transport(1)
    subject = api(kind, transport)
    invalid = FILTER | {"source_type": "fact-extracton"}
    with pytest.raises(Exception) as error:
        if method == "delete_many":
            await clear(subject, kind, invalid)
        elif method == "count":
            await subject.count(invalid["memory_space_id"], user_id=invalid["user_id"], participant_id=invalid["participant_id"], source_type=invalid["source_type"])
        else:
            await subject.list(**invalid)
    assert error.value.code == "INVALID_SOURCE_TYPE" and error.value.field == "source_type"
    assert transport.calls == [] and transport.rows == transport.owned + transport.controls


@pytest.mark.parametrize("kind", ["memory", "vector"])
async def test_conflicting_tenant_refuses_before_transport(kind: str) -> None:
    transport = Transport(1)
    with pytest.raises(ValueError, match="TENANT_SCOPE_MISMATCH"):
        await clear(api(kind, transport), kind, FILTER | {"tenant_id": "foreign-tenant"})
    assert transport.calls == [] and transport.rows == transport.owned + transport.controls


@pytest.mark.parametrize("kind", ["memory", "vector"])
async def test_changed_selected_preimage_preserves_rows(kind: str) -> None:
    transport = Transport(1)
    transport.change_on_reselection = True
    with pytest.raises(ValueError, match="DOMAIN_SELECTION_CHANGED"):
        await clear(api(kind, transport), kind, FILTER)
    assert not any(name == "memories:eraseSelected" for name, _ in transport.calls)
    assert transport.rows == transport.owned + transport.controls


@pytest.mark.parametrize("kind", ["memory", "vector"])
async def test_empty_fact_selection_preserves_controls(kind: str) -> None:
    transport = Transport(0)
    result = await clear(api(kind, transport), kind, FILTER)
    assert (result.deleted if kind == "memory" else result["deleted"]) == 0
    assert (result.memory_ids if kind == "memory" else result["memoryIds"]) == []
    assert transport.rows == transport.controls
    assert not any(name == "memories:eraseSelected" for name, _ in transport.calls)


async def test_memory_clear_requires_an_additional_destructive_filter() -> None:
    transport = Transport(1)
    with pytest.raises(Exception) as error:
        await api("memory", transport).delete_many(FILTER["memory_space_id"], {})
    assert error.value.code == "INVALID_FILTER"
    assert transport.calls == [] and transport.rows == transport.owned + transport.controls


@pytest.mark.parametrize("method", ["store", "update"])
async def test_memory_extraction_forwards_fact_provenance(method: str) -> None:
    transport = Transport(0 if method == "store" else 1)
    subject = api("memory", transport)

    async def extract(content: str) -> list[dict[str, Any]]:
        return [dict(fact=f"extracted {content}", factType="knowledge", confidence=90)]

    if method == "store":
        input_ = StoreMemoryInput(content="new text", content_type="raw", source=MemorySource(type="fact-extraction", timestamp=1), metadata=MemoryMetadata(importance=50, tags=["kept-tag"]), tenant_id=FILTER["tenant_id"], user_id=FILTER["user_id"], participant_id=FILTER["participant_id"])
        input_.extract_facts = extract
        result = await subject.store(FILTER["memory_space_id"], input_)
        facts = result.facts
    else:
        result = await subject.update(FILTER["memory_space_id"], transport.owned[0]["memoryId"], dict(content="new text"), UpdateMemoryOptions(reextract_facts=True, extract_facts=extract))
        facts = result.facts_reextracted
    assert facts is not None and len(facts) == len(transport.facts) == 1
    assert facts[0].fact_id == transport.facts[0]["factId"] and facts[0].source_type == "fact-extraction"
    assert {key: transport.facts[0][key] for key in ("memorySpaceId", "tenantId", "userId", "participantId")} == {key: NATIVE[key] for key in ("memorySpaceId", "tenantId", "userId", "participantId")}
    assert transport.facts[0]["fact"] == "extracted new text" and transport.facts[0]["sourceRef"]["memoryId"] == result.memory.memory_id
    assert [row for row in transport.rows if row["_id"].startswith("other-")] == transport.controls
    assert len([name for name, _ in transport.calls if name == "facts:store"]) == 1


@pytest.mark.parametrize("source", (*SOURCES, "manual"))
async def test_fact_store_retains_six_source_contract(source: str) -> None:
    transport = Transport(0)
    result = await api("memory", transport).facts.store(StoreFactParams(memory_space_id=FILTER["memory_space_id"], user_id=FILTER["user_id"], participant_id=FILTER["participant_id"], fact="owned fact", fact_type="knowledge", confidence=90, source_type=source))
    assert result.source_type == source and result.tenant_id == FILTER["tenant_id"] and result.fact == "owned fact"
    assert len(transport.calls) == len(transport.facts) == 1


async def test_fact_store_rejects_invalid_source_before_effects() -> None:
    transport = Transport(0)
    with pytest.raises(Exception) as error:
        await api("memory", transport).facts.store(StoreFactParams(memory_space_id=FILTER["memory_space_id"], fact="owned fact", fact_type="knowledge", confidence=90, source_type="fact-extracton"))
    assert error.value.code == "INVALID_SOURCE_TYPE" and error.value.field == "source_type"
    assert transport.calls == [] and transport.facts == [] and transport.rows == transport.controls


@pytest.mark.parametrize("kind", ["memory", "vector"])
async def test_memory_filters_keep_manual_exclusive_to_fact_provenance(kind: str) -> None:
    transport = Transport(1)
    with pytest.raises(Exception) as error:
        await api(kind, transport).count(FILTER["memory_space_id"], source_type="manual")
    assert error.value.code == "INVALID_SOURCE_TYPE" and transport.calls == []


@pytest.mark.parametrize("failure", [None, "memories:store", "facts:store"])
async def test_memory_store_keeps_configured_graph_auto_selection_and_failures(failure: str | None, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    """Control graph dispatch while retaining actual APIs, options and request data."""
    transport = Transport(0)
    adapter = object()
    subject = MemoryAPI(transport, graph_adapter=adapter, auth_context=AuthContext(user_id="actor", tenant_id=FILTER["tenant_id"]))
    writes = []
    cause = GraphDatabaseError("controlled-graph-failure", "GRAPH_TRANSACTION_FAILED")

    async def controlled_graph_dispatch(client: Any, selected_adapter: Any, policy: Any, name: str, args: dict[str, Any], explicit: Any = None) -> Any:
        assert selected_adapter is adapter and explicit is None
        assert requested_graph(selected_adapter, explicit) is True
        writes.append((name, args))
        if name == failure:
            raise cause
        return await client.mutation(name, args)

    monkeypatch.setattr("cortex.vector.write_graph_mutation", controlled_graph_dispatch)
    monkeypatch.setattr("cortex.facts.write_graph_mutation", controlled_graph_dispatch)

    async def extract(content: str) -> list[dict[str, Any]]:
        return [dict(fact=f"extracted {content}", factType="knowledge", confidence=90)]

    input_ = StoreMemoryInput(content="new text", content_type="raw", source=MemorySource(type="fact-extraction", timestamp=1), metadata=MemoryMetadata(importance=50), tenant_id=FILTER["tenant_id"], user_id=FILTER["user_id"], participant_id=FILTER["participant_id"])
    input_.extract_facts = extract
    if failure == "memories:store":
        with pytest.raises(GraphDatabaseError) as error:
            await subject.store(FILTER["memory_space_id"], input_)
        assert error.value is cause and transport.calls == []
        assert [name for name, _ in writes] == ["memories:store"]
    else:
        result = await subject.store(FILTER["memory_space_id"], input_)
        assert [name for name, _ in writes] == ["memories:store", "facts:store"]
        assert result.memory.source_type == "fact-extraction"
        if failure is None:
            assert len(result.facts) == len(transport.facts) == 1
            assert result.facts[0].source_type == "fact-extraction"
            assert "Warning" not in capsys.readouterr().out
        else:
            # Existing best-effort fact extraction semantics remain explicit:
            # no fact result is fabricated and no graph-off retry is attempted.
            assert result.facts == transport.facts == []
            assert "controlled-graph-failure" in capsys.readouterr().out
            assert [name for name, _ in transport.calls] == ["memories:store"]
        for _, args in writes:
            assert {key: args[key] for key in ("memorySpaceId", "tenantId", "userId", "participantId")} == {key: NATIVE[key] for key in ("memorySpaceId", "tenantId", "userId", "participantId")}
    assert [row for row in transport.rows if row["_id"].startswith("other-")] == transport.controls
