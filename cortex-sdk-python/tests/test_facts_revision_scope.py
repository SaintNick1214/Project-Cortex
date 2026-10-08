"""Task18 actual Python exact discovery and revision phase outcomes."""
import json

import pytest

from cortex.facts import FactsAPI
from cortex.facts.belief_revision import ConflictCandidate, ReviseParams
from cortex.facts.deduplication import (
    DeduplicationConfig,
    FactCandidate,
    FactDeduplicationService,
)
from cortex.facts.discovery import collect_candidates
from cortex.facts.history import HistoryWriteAfterCommitError, RevisionAfterCommitError
from cortex.facts.slot_matching import SlotMatchingService
from cortex.types import AuthContext, DeleteManyFactsParams
from tests import test_fact_history_provenance as native
from tests.test_fact_history_provenance import events, store

native_fixture = native.native_fixture


class DecisionLLM:
    def __init__(self, action, target):
        self.action, self.target = action, target
    async def complete(self, **kwargs):
        return json.dumps({"action": self.action, "targetFactId": self.target, "reason": "native deterministic decision", "confidence": 95, "mergedFact": "User prefers purple"})


@pytest.mark.asyncio
async def test_native_all_finite_discovery_windows_exact_scope(native_fixture):
    run, client, apis, evidence = native_fixture
    space = run + "discover"
    evidence["spaces"].append(space)
    originals = {}
    for scope, api in apis.items():
        originals[scope] = await store(api, space, "User prefers blue", 70, subject="user", predicate="favorite color", object="blue")
    for scope in apis:
        tenant = None if scope == "none" else run + scope
        expected = originals[scope]
        for strategy in ("structural", "exact"):
            result = await FactDeduplicationService(client).find_duplicate(FactCandidate("User prefers blue", "preference", 90, "user", "favorite color", "blue"), space, DeduplicationConfig(strategy=strategy), tenant_id=tenant)
            assert result.is_duplicate and result.existing_fact._id == expected._id
        async def embed(text):
            return [1.0, 0.0]
        result = await FactDeduplicationService(client).find_duplicate(FactCandidate("Blue is preferred", "preference", 90), space, DeduplicationConfig(strategy="semantic", generate_embedding=embed), tenant_id=tenant)
        assert result.matched_by == "semantic" and result.existing_fact._id == expected._id
        slot = await SlotMatchingService(client).find_slot_conflicts({"subject": "user", "predicate": "favorite color", "object": "purple"}, space, tenant_id=tenant)
        assert slot.has_conflict and {f._id for f in slot.conflicting_facts} == {expected._id}
        fallback = await collect_candidates(client, "list", {"tenantId": tenant, "memorySpaceId": space, "subject": "user", "factType": "preference", "includeSuperseded": False}, 20)
        assert {f._id for f in fallback} == {expected._id}
    evidence["originalPhysicalIds"] += [f._id for f in originals.values()]
    evidence["cases"].append("slot100Structure1Exact100Semantic50Subject20ExactTenantBeforeMatching")


@pytest.mark.asyncio
async def test_native_revision_update_pending_failure_delete_retry_no_reexecution(native_fixture):
    run, client, apis, evidence = native_fixture
    space, api = run + "revision-update", apis["A"]
    evidence["spaces"].append(space)
    old = await store(api, space, "User prefers blue", 70, subject="user", predicate="favorite color", object="blue")
    class FailPublish:
        writes = []
        async def query(self, name, args):
            return await client.query(name, args)
        async def mutation(self, name, args):
            self.writes.append(name)
            if name == "factHistory:publishPendingEvent":
                raise OSError("native fact committed; publication intentionally failed")
            return await client.mutation(name, args)
    boundary = FailPublish()
    revision_api = FactsAPI(boundary, auth_context=AuthContext(user_id="u", tenant_id=run + "A"), llm_client=DecisionLLM("UPDATE", old.fact_id))
    params = ReviseParams(space, ConflictCandidate("User prefers purple", confidence=90, fact_type="preference", subject="user", predicate="favorite color", object="purple"), user_id=None, operation_id=run + "revision-op")
    with pytest.raises(HistoryWriteAfterCommitError) as failed:
        await revision_api.revise(params)
    receipt = failed.value.receipt
    assert receipt.affected_fact_ids == (old._id,) and failed.value.committed
    current = await api.get(space, old.fact_id)
    assert current._id == old._id and current.fact == "User prefers purple" and current.version == old.version
    assert boundary.writes == ["facts:updateInPlace", "factHistory:publishPendingEvent"]
    await api.delete_many(DeleteManyFactsParams(memory_space_id=space))
    first, second = await api.retry_history(receipt), await api.retry_history(receipt)
    assert first == second and boundary.writes == ["facts:updateInPlace", "factHistory:publishPendingEvent"]
    captured = await api._history_service.get_event(first["event_ids"][0])
    assert captured.old_value == "User prefers blue" and captured.new_value == "User prefers purple" and captured.reason == "native deterministic decision"
    assert captured.pipeline.slot_matching and captured.pipeline.llm_resolution
    evidence["originalPhysicalIds"].append(old._id)
    evidence["events"] += first["event_ids"]
    evidence["cases"].append("revisionUpdatePostCommitPublicationFailureDeleteSourceHistoryOnlyRetry")


@pytest.mark.asyncio
async def test_native_revision_store_then_link_definite_rollback_keeps_created_fact(native_fixture):
    run, client, apis, evidence = native_fixture
    api, space = apis["A"], run + "revision-link"
    evidence["spaces"].append(space)
    old = await store(api, space, "User prefers blue", 70, subject="user", predicate="favorite color", object="blue")
    foreign = await store(apis["B"], space, "foreign")
    class WrongExpected:
        async def query(self, name, args):
            return await client.query(name, args)
        async def mutation(self, name, args):
            if name == "facts:supersede":
                args = {**args, "expectedNewFactId": foreign._id}
            return await client.mutation(name, args)
    revision = FactsAPI(WrongExpected(), auth_context=AuthContext(user_id="u", tenant_id=run + "A"), llm_client=DecisionLLM("SUPERSEDE", old.fact_id))
    with pytest.raises(RevisionAfterCommitError) as failed:
        await revision.revise(ReviseParams(space, ConflictCandidate("User prefers purple", confidence=90, fact_type="preference", subject="user", predicate="favorite color", object="purple"), operation_id=run + "revision-link-op"))
    partial = failed.value.receipt
    assert dict(partial["link"]) == {"committed": False}
    created = await api.get(space, partial["store"]["createdFactId"])
    assert created._id == partial["store"]["createdDocumentId"] and created.supersedes is None
    assert (await api.get(space, old.fact_id)).superseded_by is None
    assert (await api.get(space, old.fact_id)).version == 1
    store_anchor = partial["store"]["storeAnchor"]
    await api.retry_history(store_anchor)
    rows = await events(api, space)
    assert len(rows) == 1 and rows[0].action == "CREATE" and rows[0].phase == "revision_store"
    evidence["originalPhysicalIds"] += [old._id, created._id]
    evidence["events"] += [rows[0].event_id]
    evidence["cases"].append("revisionStoreCommittedActualLinkRollbackNoPairEventHistoryOnlyStoreRetry")


@pytest.mark.asyncio
async def test_native_revision_link_response_lost_reconciles_original_pair(native_fixture):
    run, client, apis, evidence = native_fixture
    api, space = apis["A"], run + "link-lost"
    evidence["spaces"].append(space)
    old = await store(api, space, "User prefers blue", 70, subject="user", predicate="favorite color", object="blue")
    class LostLink:
        writes = []
        async def query(self, name, args):
            return await client.query(name, args)
        async def mutation(self, name, args):
            self.writes.append(name)
            result = await client.mutation(name, args)
            if name == "facts:supersede":
                raise OSError("native pair committed; response intentionally lost")
            return result
    boundary = LostLink()
    operation = run + "lost-link-op"
    revision = FactsAPI(boundary, auth_context=AuthContext(user_id="u", tenant_id=run + "A"), llm_client=DecisionLLM("SUPERSEDE", old.fact_id))
    with pytest.raises(RevisionAfterCommitError) as failed:
        await revision.revise(ReviseParams(space, ConflictCandidate("User prefers purple", confidence=90, fact_type="preference", subject="user", predicate="favorite color", object="purple"), operation_id=operation))
    assert dict(failed.value.receipt["link"]) == {"outcome": "unknown"}
    pair = await api._history_service.get_operation_receipt(space, operation, "revision_link")
    assert pair is not None and pair.committed and len(pair.events) == 2
    created = await api.get(space, failed.value.receipt["store"]["createdFactId"])
    assert created.supersedes_endpoint["factDocumentId"] == old._id
    assert (await api.get(space, old.fact_id)).superseded_by_endpoint["factDocumentId"] == created._id
    await api.retry_history(pair)
    await api.retry_history(failed.value.receipt["store"]["storeAnchor"])
    await api.retry_history(pair)
    assert boundary.writes == ["facts:store", "facts:supersede"]
    rows = await events(api, space)
    assert len(rows) == 3 and {e.source_fact_id for e in rows} == {old._id, created._id}
    evidence["originalPhysicalIds"] += [old._id, created._id]
    evidence["events"] += [e.event_id for e in rows]
    evidence["cases"].append("actualLinkResponseLostRetainedPairReceiptHistoryOnlyReplayNoSecondStoreOrLink")
