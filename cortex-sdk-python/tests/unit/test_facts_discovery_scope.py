"""Task18 finite matching windows select exact scope before all scoring."""
from unittest.mock import AsyncMock

import pytest
from convex import ConvexError

from cortex.facts import FactsAPI
from cortex.facts.belief_revision import (
    BeliefRevisionService,
    ConflictCandidate,
    ReviseParams,
)
from cortex.facts.deduplication import (
    DeduplicationConfig,
    FactCandidate,
    FactDeduplicationService,
)
from cortex.facts.discovery import FactsDiscoveryError, collect_candidates, scoped_pages
from cortex.facts.history import HistoryWriteAfterCommitError, RevisionAfterCommitError
from cortex.facts.slot_matching import SlotMatchingService
from cortex.types import AuthContext
from tests.unit.test_fact_history_provenance import page, receipt


def fact(**kwargs):
    return dict(_id="physical1", factId="fact-one", memorySpaceId="space", tenantId="tenantA", fact="User lives in Paris", factType="identity", confidence=90, sourceType="manual", tags=[], createdAt=1, updatedAt=1, version=1, subject="user", predicate="lives in", object="Paris", supersedesEndpoint={"state": "absent"}, supersededByEndpoint={"state": "absent"}, **kwargs)


@pytest.mark.asyncio
@pytest.mark.parametrize("strategy,cap,operation", [("structural", 1, "findByStructure"), ("exact", 100, "list")])
async def test_dedup_literal_native_endpoint_scope_and_caps(strategy, cap, operation):
    client = AsyncMock()
    client.query.return_value = page([fact()])
    result = await FactDeduplicationService(client).find_duplicate(FactCandidate("User lives in Paris", "identity", 99, "user", "lives in", "Paris"), "space", DeduplicationConfig(strategy=strategy), "owner", "tenantA")
    assert result.is_duplicate and result.existing_fact._id == "physical1" and result.should_update
    name, args = client.query.call_args.args
    assert name == "facts:candidatePage" and args["operation"] == operation and args["tenantId"] == "tenantA"
    assert args["paginationOpts"]["numItems"] == cap and "limit" not in args and "candidatePage" not in args


@pytest.mark.asyncio
async def test_semantic_window_50_scoring_and_slot_window100():
    client = AsyncMock()
    client.query.side_effect = [page([]), page([]), page([fact()])]
    async def embed(text):
        return [1.0, 0.0]
    result = await FactDeduplicationService(client).find_duplicate(FactCandidate("Paris resident", "identity", 99, "user", "lives in", "Paris"), "space", DeduplicationConfig(strategy="semantic", generate_embedding=embed), tenant_id="tenantA")
    assert result.matched_by == "semantic" and result.similarity_score == 1.0
    assert [call.args[1]["paginationOpts"]["numItems"] for call in client.query.call_args_list] == [1, 100, 50]
    client.query.side_effect = None
    client.query.return_value = page([fact()])
    result = await SlotMatchingService(client).find_slot_conflicts({"subject": "user", "predicate": "lives in", "object": "London"}, "space", tenant_id="tenantA")
    assert result.has_conflict and result.conflicting_facts[0]._id == "physical1"
    assert client.query.call_args.args[1]["paginationOpts"]["numItems"] == 100


@pytest.mark.asyncio
@pytest.mark.parametrize("bad", [OSError("query failed"), [], page([], False, ""), page([], False, "next", pageStatus="SplitRequired", splitCursor=None)])
async def test_discovery_failure_prevents_all_revision_writes(bad):
    client = AsyncMock()
    if isinstance(bad, Exception):
        client.query.side_effect = bad
    else:
        client.query.return_value = bad
    with pytest.raises(FactsDiscoveryError):
        await FactsAPI(client, auth_context=AuthContext(user_id="u", tenant_id="tenantA")).revise(ReviseParams("space", ConflictCandidate("User lives in London", subject="user", predicate="lives in", object="London", confidence=90)))
    assert client.mutation.await_count == 0


@pytest.mark.asyncio
async def test_subject_type_fallback_cap20_scope_and_empty_advancing_page():
    client = AsyncMock()
    client.query.side_effect = [page([], False, "next"), page([fact()])]
    found = await BeliefRevisionService(client)._find_subject_type_conflicts(ReviseParams("space", ConflictCandidate("new", subject="user", fact_type="identity", confidence=90), tenant_id="tenantA"))
    assert len(found) == 1 and found[0]._id == "physical1"
    for call in client.query.call_args_list:
        assert call.args[1]["tenantId"] == "tenantA" and call.args[1]["paginationOpts"]["numItems"] == 20


@pytest.mark.asyncio
async def test_revision_add_publication_failure_yields_original_committed_receipt():
    client = AsyncMock()
    client.query.return_value = page([])
    created = {**fact(), "historyReceipt": receipt()}
    client.mutation.side_effect = [created, OSError("publication failed")]
    params = ReviseParams("space", ConflictCandidate("new", confidence=90), tenant_id="tenantA", operation_id="op")
    with pytest.raises(HistoryWriteAfterCommitError) as failed:
        await BeliefRevisionService(client).revise(params)
    assert failed.value.committed and failed.value.receipt.events[0].pending.payload["reason"] == "original"
    calls = client.mutation.call_args_list
    assert [c.args[0] for c in calls] == ["facts:store", "factHistory:publishPendingEvent"]
    assert calls[0].args[1]["tenantId"] == "tenantA" and calls[0].args[1]["historyIntent"]["phase"] == "revision_store"


@pytest.mark.asyncio
@pytest.mark.parametrize("error,link", [(ConvexError("rollback", "conflict"), {"committed": False}), (OSError("response lost"), {"outcome": "unknown"})])
async def test_revision_store_link_phase_partial_receipt(error, link):
    client = AsyncMock()
    client.mutation.side_effect = [{**fact(), "_id": "newphysical", "factId": "fact-two", "historyReceipt": receipt()}, error]
    params = ReviseParams("space", ConflictCandidate("new", confidence=90), tenant_id="tenantA")
    with pytest.raises(RevisionAfterCommitError) as failed:
        await BeliefRevisionService(client)._execute_decision("SUPERSEDE", params, fact(), "replacement", {"operationId": "op", "phase": "revision", "reason": "replacement"})
    assert dict(failed.value.receipt["link"]) == link
    assert failed.value.receipt["store"]["createdDocumentId"] == "newphysical"
    assert client.mutation.call_args.args[1]["expectedOldFactId"] == "physical1"
    assert client.mutation.call_args.args[1]["expectedNewFactId"] == "newphysical"


@pytest.mark.asyncio
async def test_valid_terminal_page100001_has_no_whole_scan_cap():
    from cortex.facts.discovery import scoped_pages
    calls, yielded = 0, 0

    async def load(page_range):
        nonlocal calls
        calls += 1
        return {"page": [], "continueCursor": str(calls), "isDone": calls == 100001}

    async for _page in scoped_pages(load, "long-valid"):
        yielded += 1
    assert calls == yielded == 100001

@pytest.mark.asyncio
async def test_alternating_split_repeated_request_refuses_before_fourth_external_call():
    requests = []

    async def load(page_range):
        requests.append(dict(page_range))
        if len(requests) >= 10:
            raise RuntimeError("external stop must not occur")
        return {"page": [], "isDone": False, "continueCursor": "ignored", "pageStatus": "SplitRequired", "splitCursor": "B" if page_range["endCursor"] == "A" else "A"}

    with pytest.raises(FactsDiscoveryError) as failure:
        async for _rows in scoped_pages(load, "split-cycle"):
            pass
    assert str(failure.value.original_cause) == "Repeated page request range"
    assert requests == [{"cursor": None, "endCursor": None}, {"cursor": None, "endCursor": "A"}, {"cursor": None, "endCursor": "B"}]
