import asyncio
import csv
import io
import json
from types import SimpleNamespace
from typing import Any

import pytest
from convex import ConvexError
from convex.values import ConvexInt64, convex_to_json, json_to_convex

from cortex._domain_export import facts_export, memory_export
from cortex._domain_paging import (
    DomainOperationPartialError,
    collect,
    mutate,
    natural,
    partial,
    resolve_scope,
    select,
    wait_operation,
)
from cortex.memory import MemoryAPI
from cortex.types import ForgetOptions


async def test_split_empty_boundary_deduplication() -> None:
    calls = []

    async def load(r: dict[str, Any]) -> dict[str, Any]:
        calls.append(dict(r))
        if r == {"cursor": None, "endCursor": None}:
            return dict(page=[{"_id": "discard"}], isDone=False, continueCursor="bad", pageStatus="SplitRequired", splitCursor="mid")
        if r == {"cursor": None, "endCursor": "mid"}:
            return dict(page=[{"_id": "a"}], isDone=False, continueCursor="left")
        if r["cursor"] == "left":
            return dict(page=[], isDone=False, continueCursor="mid")
        return dict(page=[{"_id": "a"}, {"_id": "b"}], isDone=True, continueCursor="end")
    assert [r["_id"] for r in await collect(load)] == ["a", "b"]
    assert calls == [dict(cursor=None, endCursor=None), dict(cursor=None, endCursor="mid"), dict(cursor="left", endCursor="mid"), dict(cursor="mid", endCursor=None)]


@pytest.mark.parametrize("page", [None, {}, dict(page=[], isDone=False, continueCursor=""), dict(page=[], isDone=1, continueCursor="x"), dict(page=[], isDone=False, continueCursor="x", pageStatus="SplitRequired", splitCursor=None)])
async def test_invalid_page_is_not_complete(page: Any) -> None:
    async def load(_r: Any) -> Any:
        return page
    with pytest.raises(ValueError, match="DOMAIN_"):
        await collect(load)


async def test_late_failure_does_not_return_prefix() -> None:
    calls = 0
    async def load(_r: Any) -> Any:
        nonlocal calls
        calls += 1
        if calls == 2:
            raise ConvexError("budget", "budget")
        return dict(page=[{"_id": "a"}], isDone=False, continueCursor="advance")
    with pytest.raises(ConvexError):
        await collect(load)
    assert calls == 2


async def test_changed_duplicate_preimage_refuses() -> None:
    count = 0
    async def load(_r: Any) -> Any:
        nonlocal count
        count += 1
        return dict(page=[{"_id": "a"}], isDone=count == 2, continueCursor=str(count), fingerprints={"a": ("a" if count == 1 else "b") * 64})
    with pytest.raises(ValueError, match="DOMAIN_SELECTION_CHANGED"):
        await select(load)


@pytest.mark.parametrize("value", [-1, 0.5, float("inf"), float("nan"), True, 2**53])
def test_window_rejects_invalid_native_number(value: Any) -> None:
    with pytest.raises(ValueError):
        natural(value)


@pytest.mark.parametrize("duration", [0, -1, float("inf"), float("nan"), True])
async def test_invalid_deadline_does_not_schedule_operation(duration: Any) -> None:
    called = False
    async def operation() -> None:
        nonlocal called
        called = True
    with pytest.raises(ValueError, match="DOMAIN_INVALID_DEADLINE"):
        await wait_operation(operation(), SimpleNamespace(deadline_ms=duration))
    assert not called


async def test_post_send_timeout_unknown_and_natural_join() -> None:
    calls = 0
    pending = asyncio.create_task(asyncio.sleep(.03, result={"deleted": True}))
    class Client:
        async def mutation(self, _n: Any, _args: Any) -> Any:
            nonlocal calls
            calls += 1
            return await pending
    selected = [{"physicalId": x, "fingerprint": "a" * 64} for x in ["a", "b"]]
    with pytest.raises(DomainOperationPartialError) as error:
        await mutate(Client(), "memories", selected, {}, SimpleNamespace(deadline_ms=1))
    assert error.value.partial["confirmedCount"] == 0
    assert error.value.partial["possibleCount"] == 1
    assert error.value.partial["unknownPhysicalIds"] == ["a"]
    assert error.value.partial["unstartedPhysicalIds"] == ["b"]
    await pending
    assert calls == 1


def test_partial_scope_and_official_json_csv_semantics() -> None:
    assert resolve_scope(None, "A") == "A"
    with pytest.raises(ValueError):
        resolve_scope("A", "B")
    assert natural(0) == 0
    x = partial([dict(physicalId=str(i), disposition=d) for i, d in enumerate(["knownCommitted", "outcomeUnknown", "alreadyAbsent", "unstarted", "knownRolledBack"])])
    assert (x["confirmedCount"], x["possibleCount"]) == (1, 2)
    fact = dict(factId="f", fact='comma, quote" newline\n雪', factType="custom", confidence=90, sourceType="manual", tags=[], createdAt=0, metadata=dict(integer=ConvexInt64(2**63-1), bytes=bytes([0, 255])))
    exported = facts_export([fact], "json")
    decoded = json_to_convex(json.loads(exported["data"]))
    assert decoded[0]["metadata"] == fact["metadata"]
    assert json.loads(json.dumps(convex_to_json(fact)))
    parsed = list(csv.DictReader(io.StringIO(facts_export([fact], "csv")["data"], newline="")))
    assert parsed[0]["fact"] == fact["fact"]
    m = dict(memoryId="m", content="text", sourceType="system", importance=50, tags=[], createdAt=0)
    assert len(json.loads(memory_export([m], "json", False, True, [{**fact, "sourceRef": {"memoryId": "m"}}])["data"])[0]["facts"]) == 1


async def test_forget_source_survives_preflight_then_original_options() -> None:
    m = MemoryAPI(SimpleNamespace())
    order = []
    async def get(_s: Any, _m: Any) -> Any:
        return SimpleNamespace(conversation_ref=dict(conversation_id="c", message_ids=["m"]))
    async def delete(_s: Any, _m: Any, opts: Any) -> None:
        assert opts.sync_to_graph is False
        order.append("memory")
    async def cascade(*_args: Any) -> Any:
        assert order == []
        order.append("facts")
        return 2, ["f1", "f2"]
    m.vector = SimpleNamespace(get=get, delete=delete)
    m._cascade_delete_facts = cascade
    r = await m.forget("space", "memory", ForgetOptions())
    assert order == ["facts", "memory"]
    assert r.facts_deleted == 2
    async def refused(*_args: Any) -> Any:
        raise ValueError("SOURCE_PROVENANCE_UNRESOLVED")
    m._cascade_delete_facts = refused
    with pytest.raises(ValueError, match="SOURCE_PROVENANCE_UNRESOLVED"):
        await m.forget("space", "memory")
    assert order == ["facts", "memory"]


async def test_declared_search_filters_forward_without_losing_zero_values() -> None:
    from cortex.vector import VectorAPI
    from cortex.types import SearchOptions
    seen = []
    class Client:
        async def action(self, name, args):
            seen.append((name, args))
            return []
    opts = SearchOptions(tenant_id="A", tag_match="all", tags=["a", "b"], importance=0, created_before=30, created_after=0, updated_before=40, updated_after=0, last_accessed_before=35, last_accessed_after=0, access_count=0, version=0, content_type="fact", offset=1, limit=0)
    assert await VectorAPI(Client()).search("s", "x", opts) == []
    assert seen == [("memories:search", dict(memorySpaceId="s", tenantId="A", query="x", tags=["a", "b"], tagMatch="all", importance=0, createdBefore=30, createdAfter=0, updatedBefore=40, updatedAfter=0, lastAccessedBefore=35, lastAccessedAfter=0, accessCount=0, version=0, contentType="fact", offset=1, limit=0))]


@pytest.mark.parametrize("field,value", [("offset", True), ("access_count", -1), ("version", .5), ("created_before", float("inf")), ("last_accessed_after", -1), ("importance", True), ("tag_match", "some"), ("limit", False)])
def test_declared_search_filter_refuses_invalid_values(field, value) -> None:
    from cortex.types import SearchOptions
    from cortex.vector.validators import VectorValidationError, validate_search_options as vector_validate
    from cortex.memory.validators import MemoryValidationError, validate_search_options as memory_validate
    for validate, error in ((vector_validate, VectorValidationError), (memory_validate, MemoryValidationError)):
        with pytest.raises(error):
            validate(SearchOptions(**{field: value}))
