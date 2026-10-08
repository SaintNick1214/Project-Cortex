"""Task18 parity: immutable provenance, bounded cursors and committed retries."""
from dataclasses import replace
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from convex import ConvexError

from cortex.facts import FactsAPI
from cortex.facts.discovery import parse_fact
from cortex.facts.history import (
    ChangeFilter,
    FactCommitOutcomeUnknownError,
    FactCommittedResultUnavailableError,
    FactHistoryService,
    HistoryReceipt,
    HistorySelector,
    LogEventParams,
    execute_fact_mutation,
)
from cortex.types import AuthContext, StoreFactParams


def event(event_id="event1", **kwargs):
    return dict(eventId=event_id, factId="fact-one", memorySpaceId="space", action="UPDATE", timestamp=10,
                scopeVersion=1, tenantId="tenantA", sourceFactId="physical1", ownerKnown=True,
                ownerUserId="owner", userId="actor", supersedesEndpoint={"state": "absent"},
                supersededByEndpoint={"state": "absent"}, **kwargs)


def page(events, done=True, cursor="", **extra):
    return {"page": events, "isDone": done, "continueCursor": cursor, **extra}


def receipt(payload=None):
    payload = payload or event(operationId="op", phase="revision_update", eventRole="source", reason="original", oldValue="old", newValue="new", affectedFactIds=["physical1"], resultFactId="physical1")
    return {"committed": True, "events": [{"eventId": payload["eventId"], "_id": "anchor1", "pending": {"version": 1, "payload": payload, "absentFields": ["participantId"], "payloadDigest": "original-digest"}}], "affectedFactIds": ["physical1"], "resultFactId": "physical1"}


@pytest.mark.asyncio
async def test_constructor_scope_all_reads_and_legacy_absence():
    client = AsyncMock()
    history = FactHistoryService(client, None, AuthContext(user_id="auth", tenant_id="tenantA"))
    client.query.return_value = page([event()])
    rows = await history.get_history("fact-one", selector=HistorySelector(memory_space_id="space"))
    assert rows[0].owner_user_id == "owner" and rows[0].user_id == "actor"
    assert rows[0].source_fact_id == "physical1" and rows[0].scope_version == 1
    args = client.query.call_args.args[1]
    assert args["tenantId"] == "tenantA" and args["factId"] == "fact-one" and args["memorySpaceId"] == "space"
    legacy = history._parse_event({"eventId": "old", "factId": "f", "memorySpaceId": "s", "action": "CREATE", "timestamp": 0})
    assert legacy.scope_version is None and legacy.owner_known is None
    with pytest.raises(ValueError, match="SCOPE_MISMATCH"):
        await history.get_history("fact-one", selector=HistorySelector(tenant_id="tenantB"))
    assert client.query.await_count == 1


@pytest.mark.asyncio
async def test_empty_pages_offset_and_native_split_preserve_both_ranges():
    client = AsyncMock()
    client.query.side_effect = [
        page([event("discard")], False, "ignored", pageStatus="SplitRequired", splitCursor="middle"),
        page([], False, "advance"), page([event("a")], True), page([event("b")], True),
    ]
    history = FactHistoryService(client)
    rows = [e.event_id async for batch in history.pages() for e in batch]
    assert rows == ["a", "b"]
    ranges = [call.args[1]["paginationOpts"] for call in client.query.call_args_list]
    assert ranges == [{"cursor": None, "endCursor": None, "numItems": 256}, {"cursor": None, "endCursor": "middle", "numItems": 256}, {"cursor": "advance", "endCursor": "middle", "numItems": 256}, {"cursor": "middle", "endCursor": None, "numItems": 256}]
    client.query.side_effect = [page([event("a"), event("b")], False, "next"), page([event("c")])]
    rows = await history.get_changes(ChangeFilter("space", offset=1, limit=2))
    assert [e.event_id for e in rows] == ["b", "c"]


@pytest.mark.asyncio
@pytest.mark.parametrize("method,args,endpoint", [
    ("delete_by_fact_id", ("fact-one",), "deleteByFactId"),
    ("delete_by_user_id", ("actor",), "deleteByUserId"),
    ("delete_by_owner", ("owner",), "deleteByOwner"),
    ("delete_by_memory_space", ("space",), "deleteByMemorySpace"),
])
async def test_delete_forwarding_preserves_incomplete_envelope(method, args, endpoint):
    client = AsyncMock()
    client.mutation.return_value = {"deleted": 1, "remaining": None, "isDone": False, "continueCursor": "next", "page": []}
    result = await getattr(FactHistoryService(client, None, AuthContext(user_id="u", tenant_id="tenantA")), method)(*args)
    assert result["remaining"] is None and result["isDone"] is False
    assert client.mutation.call_args.args[0] == f"factHistory:{endpoint}"
    assert client.mutation.call_args.args[1]["tenantId"] == "tenantA"


@pytest.mark.asyncio
async def test_actor_count_activity_and_purge_do_not_guess_owner():
    client = AsyncMock()
    data = event(timestamp=1) if False else event()
    client.query.return_value = page([data, event("event2", participantId="participant")])
    history = FactHistoryService(client, None, AuthContext(user_id="u", tenant_id="tenantA"))
    assert (await history.count_by_action("space"))["UPDATE"] == 2
    summary = await history.get_activity_summary("space")
    assert summary.total_events == 2 and summary.unique_facts_modified == 1 and summary.active_participants == 2
    client.mutation.return_value = {"deleted": 0, "remaining": None, "isDone": False}
    result = await history.purge_old_events(datetime.now(timezone.utc), "space", 3)
    assert result["remaining"] is None and client.mutation.call_args.args[1]["tenantId"] == "tenantA"


@pytest.mark.asyncio
async def test_pending_original_payload_deep_frozen_and_history_only_retry():
    raw = receipt()
    frozen = HistoryReceipt.from_wire(raw)
    raw["events"][0]["pending"]["payload"]["reason"] = "changed"
    assert frozen.events[0].pending.payload["reason"] == "original"
    with pytest.raises(TypeError):
        frozen.events[0].pending.payload["reason"] = "changed"
    client = AsyncMock()
    client.mutation.return_value = {"eventId": "event1", "_id": "anchor1", "publicationState": "complete"}
    history = FactHistoryService(client, None, AuthContext(user_id="u", tenant_id="tenantA"))
    assert await history.retry_history(frozen) == {"event_ids": ["event1"]}
    name, args = client.mutation.call_args.args
    assert name == "factHistory:publishPendingEvent" and args["pending"]["payload"]["reason"] == "original"
    assert args["phase"] == "revision_update" and args["operationId"] == "op"
    assert client.query.await_count == 0
    client.mutation.side_effect = ConvexError("conflict", "FACT_HISTORY_OPERATION_CONFLICT")
    with pytest.raises(ConvexError):
        await history.retry_history(frozen)


@pytest.mark.asyncio
async def test_manual_supersede_uses_one_actual_pair_no_clone_or_duplicate_log():
    client = AsyncMock()
    client.mutation.side_effect = [{"superseded": True, "historyReceipt": receipt()}, {"eventId": "event1"}]
    api = FactsAPI(client, auth_context=AuthContext(user_id="u", tenant_id="tenantA"))
    result = await api.supersede(memory_space_id="space", old_fact_id="fact-one", new_fact_id="fact-two", operation_id="op", expected_old_fact_id="physical1", expected_new_fact_id="physical2", reason="replacement")
    assert result["superseded"] is True
    assert client.mutation.await_count == 2 and client.query.await_count == 0
    name, args = client.mutation.call_args_list[0].args
    assert name == "facts:supersede" and args["expectedOldFactId"] == "physical1" and args["expectedNewFactId"] == "physical2" and args["tenantId"] == "tenantA"
    assert [c.args[0] for c in client.mutation.call_args_list] == ["facts:supersede", "factHistory:publishPendingEvent"]
    assert args["historyIntent"]["userId"] == "u"
    with pytest.raises(ValueError):
        await api.supersede(memory_space_id="space", old_fact_id="fact-one", new_fact_id="fact-one")
    assert client.mutation.await_count == 2


@pytest.mark.asyncio
async def test_response_loss_reconciles_original_identity_without_another_write():
    client = AsyncMock()
    client.mutation.side_effect = OSError("response lost")
    client.query.side_effect = [receipt(), {"_id": "physical1", "factId": "fact-one"}, {"_id": "physical1", "factId": "fact-one"}]
    args = {"memorySpaceId": "space", "tenantId": "tenantA", "operationId": "op", "factId": "fact-one"}
    result = await execute_fact_mutation(client, "facts:update", args, FactHistoryService(client), "update")
    assert result["_id"] == "physical1" and result["historyReceipt"]["committed"] is True
    assert client.mutation.await_count == 1
    client.query.side_effect = [receipt(), None, None]
    with pytest.raises(FactCommittedResultUnavailableError) as failed:
        await execute_fact_mutation(client, "facts:update", args, FactHistoryService(client), "update")
    assert failed.value.receipt.result_fact_id == "physical1"
    client.query.side_effect = [None]
    with pytest.raises(FactCommitOutcomeUnknownError) as failed:
        await execute_fact_mutation(client, "facts:update", args, FactHistoryService(client), "update")
    assert failed.value.operation_id == "op" and failed.value.committed is None


@pytest.mark.asyncio
async def test_chain_uses_physical_incoming_edges_and_detects_cycle():
    client = AsyncMock()
    predecessor = event("pred", supersededBy="fact-two")
    predecessor["supersededByEndpoint"] = {"state": "known", "factDocumentId": "physical2", "logicalFactId": "fact-two", "scopeVersion": 1, "tenantId": "tenantA", "memorySpaceId": "space"}
    kept = {**event("kept"), "sourceFactId": "physical2", "factId": "fact-two"}
    async def query(name, args):
        if "factId" in args:
            return page([kept])
        if args.get("sourceFactId") == "physical1":
            return page([predecessor])
        if args.get("sourceFactId") == "physical2":
            return page([kept])
        return page([predecessor] if args.get("incomingFactId") == "physical2" else [])
    client.query.side_effect = query
    chain = await FactHistoryService(client, None, AuthContext(user_id="u", tenant_id="tenantA")).get_supersession_chain("fact-two")
    assert [e.fact_id for e in chain] == ["fact-one", "fact-two"]
    kept["supersededByEndpoint"] = {"state": "known", "factDocumentId": "physical1", "scopeVersion": 1, "tenantId": "tenantA", "memorySpaceId": "space"}
    with pytest.raises(ValueError, match="CYCLE"):
        await FactHistoryService(client, None, AuthContext(user_id="u", tenant_id="tenantA")).get_supersession_chain("fact-two")


@pytest.mark.asyncio
async def test_recommended_page_is_complete_and_partial_delete_is_honest():
    from cortex._domain_paging import DomainOperationPartialError
    from cortex.types import DeleteManyFactsParams

    client = AsyncMock()
    client.query.side_effect = [page([event("recommended")], False, "next", pageStatus="SplitRecommended", splitCursor="next"), page([event("tail")])]
    rows = [e.event_id async for batch in FactHistoryService(client).pages() for e in batch]
    assert rows == ["recommended", "tail"]
    assert client.query.call_args_list[1].args[1]["paginationOpts"]["cursor"] == "next"
    selected = [{"_id": "physical1", "factId": "fact-one"}, {"_id": "physical2", "factId": "fact-two"}]
    fingerprints = {"physical1": "a" * 64, "physical2": "b" * 64}
    intents = [{"physicalId": row["_id"], "operationId": "delete:" + row["_id"], "requestDigest": "original-" + row["_id"],
                "request": {"memorySpaceId": "space", "selectedPhysicalId": row["_id"], "expectedFingerprint": fingerprints[row["_id"]], "operationId": "delete:" + row["_id"]}} for row in selected]
    candidates = page(selected, fingerprints=fingerprints, deleteIntents=intents)
    # Accepted22 selects and revalidates physical intents before one send/item.
    # A lost second reply reads only its original receipt, which is unavailable.
    client.query.side_effect = [candidates, candidates, None]
    client.mutation.side_effect = [{"deleted": 1}, OSError("late failure")]
    with pytest.raises(DomainOperationPartialError) as failed:
        await FactsAPI(client).delete_many(DeleteManyFactsParams("space"))
    assert failed.value.partial["confirmedCount"] == 1
    assert failed.value.partial["confirmedPhysicalIds"] == ["physical1"]
    assert failed.value.partial["unknownPhysicalIds"] == ["physical2"]
    assert failed.value.partial["originalIntents"] == intents
    assert client.mutation.await_count == 2
    assert [call.args[1]["selectedPhysicalId"] for call in client.mutation.await_args_list] == ["physical1", "physical2"]
    assert client.query.await_args_list[-1].args == ("factHistory:getOperationReceipt", {"memorySpaceId": "space", "operationId": "delete:physical2", "phase": "physical_delete"})

@pytest.mark.asyncio
@pytest.mark.parametrize("disposition", ["missing", "unavailable"])
async def test_acknowledged_commit_unresolved_receipt_preserves_phase_scope_operation_no_replay(disposition):
    from cortex.facts.history import FactCommittedReceiptUnresolvedError
    client = AsyncMock()
    client.mutation.side_effect = ConvexError("FACT_HISTORY_COMMITTED_RESULT_UNAVAILABLE", "FACT_HISTORY_COMMITTED_RESULT_UNAVAILABLE")
    if disposition == "missing":
        client.query.return_value = None
    else:
        client.query.side_effect = OSError("receipt transport unavailable")
    history = FactHistoryService(client)
    with pytest.raises(FactCommittedReceiptUnresolvedError) as failure:
        await execute_fact_mutation(client, "facts:update", {"memorySpaceId": "space", "tenantId": "A", "factId": "fact-one", "operationId": "original-operation"}, history, "update")
    error = failure.value
    assert error.committed and error.phase == "committed_receipt_unresolved"
    assert error.operation_id == "original-operation" and error.mutation_phase == "update"
    assert error.scope == {"memorySpaceId": "space", "tenantId": "A"} and error.receipt_disposition == disposition
    assert not hasattr(error, "receipt") and not hasattr(error, "result_fact_id")
    assert client.mutation.await_count == 1
    assert client.query.call_args.args == ("factHistory:getOperationReceipt", {"memorySpaceId": "space", "tenantId": "A", "operationId": "original-operation", "phase": "update"})

@pytest.mark.asyncio
async def test_time_cutoff_selector_datetime_hours_and_limit_reject_before_transport():
    client = AsyncMock()
    h = FactHistoryService(client)
    for value in (float("nan"), float("inf"), -float("inf"), True, "1"):
        with pytest.raises(ValueError, match="INVALID_TIME_RANGE"):
            async for _rows in h.pages(HistorySelector(after=value)):
                pass
        with pytest.raises(ValueError, match="INVALID_TIME_RANGE"):
            await h.get_activity_summary("space", value)
    class NonfiniteDate(datetime):
        def timestamp(self):
            return float("nan")

    for value in (False, "date", 1, object(), NonfiniteDate(2020, 1, 1)):
        with pytest.raises(ValueError, match="INVALID_TIME_RANGE"):
            await h.get_changes(ChangeFilter("space", after=value))
        with pytest.raises(ValueError, match="INVALID_TIME_RANGE"):
            await h.count_by_action("space", value)
        with pytest.raises(ValueError, match="INVALID_TIME_RANGE"):
            await h.purge_old_events(value, "space")
    for hours in (0, -1, 1e300, 1e20, 10**1000):
        with pytest.raises(ValueError, match="INVALID_TIME_RANGE"):
            await h.get_activity_summary("space", hours)
    with pytest.raises(ValueError, match="INVALID_TIME_RANGE"):
        async for _rows in h.pages(HistorySelector(after=2, before=1)):
            pass
    for limit in (-1, 0, float("nan"), float("inf"), -float("inf"), 1.5, True, "1"):
        for opts in (None, {"numItems": 1, "cursor": None}):
            with pytest.raises(ValueError, match="INVALID_PAGE_SIZE"):
                await h.purge_old_events(datetime.now(timezone.utc), "space", limit, pagination_opts=opts)
    assert client.query.await_count == 0 and client.mutation.await_count == 0


@pytest.mark.asyncio
async def test_purge_valid_batch_hint_keeps_honest_single_page_and_explicit_size_minimum():
    client = AsyncMock()
    client.mutation.return_value = {"deleted": 1, "isDone": False, "continueCursor": "next", "remaining": None}
    h = FactHistoryService(client)
    result = await h.purge_old_events(datetime.now(timezone.utc), "space", 1, pagination_opts={"numItems": 3, "cursor": None})
    assert result["remaining"] is None and not result["isDone"]
    assert client.mutation.call_args.args[1]["paginationOpts"]["numItems"] == 1
    assert client.mutation.call_args.args[1]["limit"] == 1
    with pytest.raises(ValueError, match="INVALID_PAGE_SIZE"):
        await h.purge_old_events(datetime.now(timezone.utc), "space", 1, pagination_opts={"numItems": 257, "cursor": None})
    assert client.mutation.await_count == 1
