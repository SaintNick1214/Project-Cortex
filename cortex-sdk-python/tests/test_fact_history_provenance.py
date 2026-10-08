"""Task18 native Python parity; owned loopback45410 and unique record prefixes."""
import asyncio
import json
import os
from pathlib import Path
from uuid import uuid4

import pytest

from cortex import Cortex, CortexConfig
from cortex.facts import FactsAPI, StoreFactWithDedupOptions
from cortex.facts.discovery import collect_candidates
from cortex.facts.history import (
    FactCommittedResultUnavailableError,
    HistoryReceipt,
    HistorySelector,
    LogEventParams,
)
from cortex.types import AuthContext, DeleteManyFactsParams, StoreFactParams

PRIVATE = Path("/Users/SaintNick/Documents/Cortex/Project-Cortex-Proofs/cli-sandbox-2026/fact-history-provenance")


@pytest.fixture
async def native_fixture():
    assert os.environ.get("CONVEX_URL_PY") == "http://127.0.0.1:45410"
    assert os.environ.get("HOME") == str(PRIVATE / "home")
    assert os.environ.get("PYTHON_DOTENV_DISABLED") == "1"
    ownership = json.loads((PRIVATE / "ownership.json").read_text())
    assert ownership["owner"] == "task18-fact-history-provenance" and ownership["ports"] == [45410, 45411]
    os.kill(ownership["pid"], 0)
    run = "task18-repair3-py-parity-" + uuid4().hex
    cortex = Cortex(CortexConfig(convex_url=os.environ["CONVEX_URL_PY"]))
    client = cortex.facts.client
    apis = {scope: FactsAPI(client, auth_context=AuthContext(user_id=run + "actor", tenant_id=run + scope)) for scope in ("A", "B")}
    apis["none"] = FactsAPI(client)
    expected = {"run": run, "spaces": [], "originalPhysicalIds": [], "events": [], "cases": []}
    yield run, client, apis, expected
    # Retained privately for18/16 independent expected-ID consumers; no other records touched.
    (PRIVATE / (run + ".json")).write_text(json.dumps(expected, sort_keys=True, indent=2))
    await cortex.close()


async def store(api, space, text, confidence=70, **kwargs):
    return await api.store(StoreFactParams(space, text, "preference", confidence, "manual", tags=[], **kwargs))


async def events(api, space):
    return [e async for batch in api._history_service.pages(HistorySelector(memory_space_id=space)) for e in batch]


@pytest.mark.asyncio
async def test_native_exact_scope_owner_actor_and_physical_delete(native_fixture):
    run, client, apis, evidence = native_fixture
    space = run + "scope"
    evidence["spaces"].append(space)
    sources = {}
    for scope, api in apis.items():
        sources[scope] = await store(api, space, scope + " fact", user_id=run + "owner")
        logged = await api._history_service.log(LogEventParams(sources[scope].fact_id, space, "CREATE", user_id=run + "actor", new_value=scope + " fact"))
        evidence["events"].append(logged["event_id"])
    for scope, api in apis.items():
        rows = await events(api, space)
        assert len(rows) == 1 and rows[0].source_fact_id == sources[scope]._id
        assert rows[0].owner_user_id == run + "owner" and rows[0].user_id == run + "actor"
        assert rows[0].scope_version == 1 and rows[0].tenant_id == (None if scope == "none" else run + scope)
    with pytest.raises(Exception, match="SOURCE_REQUIRED"):
        await apis["B"]._history_service.log(LogEventParams(sources["A"].fact_id, space, "UPDATE"))
    await apis["A"].delete_many(DeleteManyFactsParams(memory_space_id=space))
    assert await apis["A"].get(space, sources["A"].fact_id) is None
    retained = await apis["A"].history(sources["A"].fact_id)
    assert {e.action for e in retained} == {"CREATE", "DELETE"} and all(e.source_fact_id == sources["A"]._id for e in retained)
    with pytest.raises(Exception, match="SOURCE_REQUIRED"):
        await apis["A"]._history_service.log(LogEventParams(sources["A"].fact_id, space, "UPDATE"))
    assert await apis["B"].get(space, sources["B"].fact_id) is not None
    evidence["originalPhysicalIds"] += [f._id for f in sources.values()]
    evidence["cases"].append("exactScopeKnownTenantlessOwnerActorDeleteCapture")


@pytest.mark.asyncio
async def test_native_manual_pair_replay_no_clone_and_atomic_conflicts(native_fixture):
    run, client, apis, evidence = native_fixture
    api, space = apis["A"], run + "manual"
    evidence["spaces"].append(space)
    old, new = await store(api, space, "old", user_id=run + "owner"), await store(api, space, "new", user_id=run + "owner")
    kwargs = dict(memory_space_id=space, old_fact_id=old.fact_id, new_fact_id=new.fact_id, reason="original", operation_id=run + "pair", expected_old_fact_id=old._id, expected_new_fact_id=new._id)
    result = await api.supersede(**kwargs)
    repeated = await api.supersede(**kwargs)
    assert result["historyReceipt"] == repeated["historyReceipt"]
    actual_old, actual_new = await api.get(space, old.fact_id), await api.get(space, new.fact_id)
    assert actual_old.superseded_by_endpoint["factDocumentId"] == new._id and actual_new.supersedes_endpoint["factDocumentId"] == old._id
    candidates = await collect_candidates(client, "list", {"tenantId": run + "A", "memorySpaceId": space, "includeSuperseded": True}, 100)
    assert {f._id for f in candidates} == {old._id, new._id}
    rows = await events(api, space)
    assert len(rows) == 2 and {e.source_fact_id for e in rows} == {old._id, new._id}
    assert all(e.owner_user_id == run + "owner" and e.user_id == run + "actor" and e.reason == "original" for e in rows)
    with pytest.raises(Exception, match="OPERATION_CONFLICT"):
        await api.supersede(**{**kwargs, "reason": "changed"})
    third = await store(api, space, "third")
    with pytest.raises(Exception, match="RELATIONSHIP_(CONFLICT|UNRESOLVED)"):
        await api.supersede(memory_space_id=space, old_fact_id=old.fact_id, new_fact_id=third.fact_id)
    assert (await api.get(space, third.fact_id)).supersedes is None
    evidence["originalPhysicalIds"] += [old._id, new._id]
    evidence["events"] += [e.event_id for e in rows]
    evidence["cases"].append("manualOnePairReplayConflictNoClone")


@pytest.mark.asyncio
async def test_native_version_dedup_append_lost_response_and_deleted_result(native_fixture):
    run, client, apis, evidence = native_fixture
    api, space = apis["A"], run + "versions"
    evidence["spaces"].append(space)
    original = await store(api, space, "User prefers blue", 60)
    kwargs = dict(operation_id=run + "update", expected_source_fact_id=original._id)
    updated = await api.update(space, original.fact_id, {"fact": "User prefers purple", "confidence": 70}, **kwargs)
    repeated = await api.update(space, original.fact_id, {"fact": "User prefers purple", "confidence": 70}, **kwargs)
    assert repeated._id == updated._id and updated.version == 2 and updated.supersedes_endpoint["factDocumentId"] == original._id
    dedup = await api.store_with_dedup(StoreFactParams(space, "User prefers purple", "preference", 90, "manual", operation_id=run + "dedup"), StoreFactWithDedupOptions(deduplication="exact"))
    assert dedup.was_updated and dedup.fact.version == 3 and dedup.fact.supersedes_endpoint["factDocumentId"] == updated._id
    rows = await events(api, space)
    assert len(rows) == 4 and {e.source_fact_id for e in rows} == {original._id, updated._id, dedup.fact._id}
    assert {e.old_value for e in rows} == {"User prefers blue", "User prefers purple"}
    assert [e.fact_id for e in await api._history_service.get_supersession_chain(dedup.fact.fact_id)] == [original.fact_id, updated.fact_id, dedup.fact.fact_id]
    class Lost:
        def __init__(self, delete=False):
            self.called, self.delete = 0, delete
        async def query(self, name, args):
            return await client.query(name, args)
        async def mutation(self, name, args):
            self.called += 1
            await client.mutation(name, args)
            if self.delete:
                await api.delete_many(DeleteManyFactsParams(memory_space_id=space))
            raise OSError("Task18 simulated response loss after native commit")
    lost = Lost()
    recovered = await FactsAPI(lost, auth_context=AuthContext(user_id="u", tenant_id=run + "A")).update(space, dedup.fact.fact_id, {"confidence": 95}, operation_id=run + "lost", expected_source_fact_id=dedup.fact._id)
    assert recovered.version == 4 and lost.called == 1
    deleted_response = Lost(delete=True)
    with pytest.raises(FactCommittedResultUnavailableError) as unavailable:
        await FactsAPI(deleted_response, auth_context=AuthContext(user_id="u", tenant_id=run + "A")).update(space, recovered.fact_id, {"confidence": 99}, operation_id=run + "lostdeleted", expected_source_fact_id=recovered._id)
    assert unavailable.value.receipt.committed and unavailable.value.receipt.result_fact_id != recovered._id and deleted_response.called == 1
    from cortex.facts.history import FactCommittedReceiptUnresolvedError
    for disposition in ("missing", "unavailable"):
        class ReceiptFailure:
            writes = 0
            async def mutation(self, name, args):
                self.writes += 1
                return await client.mutation(name, args)
            async def query(self, name, args):
                if name == "factHistory:getOperationReceipt":
                    if disposition == "missing":
                        return None
                    raise OSError("secondary receipt unavailable")
                return await client.query(name, args)
        failed_receipt = ReceiptFailure()
        before = [e.event_id for e in await events(api, space)]
        with pytest.raises(FactCommittedReceiptUnresolvedError) as unresolved:
            await FactsAPI(failed_receipt, auth_context=AuthContext(user_id="u", tenant_id=run + "A")).update(space, recovered.fact_id, {"confidence": 99}, operation_id=run + "lostdeleted", expected_source_fact_id=recovered._id)
        assert unresolved.value.committed and unresolved.value.receipt_disposition == disposition
        assert unresolved.value.operation_id == run + "lostdeleted" and unresolved.value.scope == {"memorySpaceId": space, "tenantId": run + "A"}
        assert not hasattr(unresolved.value, "receipt") and failed_receipt.writes == 1
        assert [e.event_id for e in await events(api, space)] == before
    retained = await api._history_service.get_supersession_chain(dedup.fact.fact_id)
    assert original.fact_id in {e.fact_id for e in retained} and recovered.fact_id in {e.fact_id for e in retained}
    evidence["originalPhysicalIds"] += [original._id, updated._id, dedup.fact._id, recovered._id, unavailable.value.receipt.result_fact_id]
    evidence["events"] += [e.event_id for e in rows]
    evidence["cases"].append("ordinaryVersionDedupAppendLostResponseDeletedResult")


@pytest.mark.asyncio
async def test_native_consolidate3_edges_mean_replay_and_caps(native_fixture):
    run, client, apis, evidence = native_fixture
    api, space = apis["A"], run + "consolidate"
    evidence["spaces"].append(space)
    facts = [await store(api, space, "fact " + str(i), c) for i, c in enumerate([61, 72, 92])]
    fourth = await store(api, space, "fourth", 80)
    with pytest.raises(ValueError, match="CONSOLIDATION_BUDGET"):
        await api.consolidate(space, [f.fact_id for f in facts] + [fourth.fact_id], facts[0].fact_id)
    assert [(await api.get(space, f.fact_id)).confidence for f in facts] == [61, 72, 92]
    guards = [{"factId": f.fact_id, "factDocumentId": f._id} for f in facts]
    with pytest.raises(Exception, match="FACT_HISTORY_SOURCE_MISMATCH"):
        await api.consolidate(space, [f.fact_id for f in facts], facts[0].fact_id, operation_id=run + "bad-guard", expected_fact_ids=[{**g, "factDocumentId": fourth._id} if i == 1 else g for i, g in enumerate(guards)])
    assert [(await api.get(space, f.fact_id)).confidence for f in facts] == [61, 72, 92]
    result = await api.consolidate(space, [f.fact_id for f in facts], facts[0].fact_id, operation_id=run + "op", expected_fact_ids=guards)
    repeated = await api.consolidate(space, [f.fact_id for f in facts], facts[0].fact_id, operation_id=run + "op", expected_fact_ids=guards)
    assert repeated["historyReceipt"] == result["historyReceipt"]
    kept = await api.get(space, facts[0].fact_id)
    assert kept.confidence == 75 and kept.supersedes is None and kept.supersedes_endpoint["state"] == "absent"
    for old in facts[1:]:
        assert (await api.get(space, old.fact_id)).superseded_by_endpoint["factDocumentId"] == kept._id
    rows = await events(api, space)
    assert len(rows) == 3 and {e.source_fact_id for e in rows} == {f._id for f in facts}
    assert {e.fact_id for e in await api._history_service.get_supersession_chain(kept.fact_id)} == {f.fact_id for f in facts}
    await api.delete_many(DeleteManyFactsParams(memory_space_id=space))
    assert {e.fact_id for e in await api._history_service.get_supersession_chain(kept.fact_id)} == {f.fact_id for f in facts}
    evidence["originalPhysicalIds"] += [f._id for f in facts]
    evidence["events"] += [e.event_id for e in rows]
    evidence["cases"].append("consolidation3PhysicalEdgesMeanReplayTombstones")


@pytest.mark.asyncio
async def test_native_pending_after_source_delete_exact_retry_conflict(native_fixture):
    run, client, apis, evidence = native_fixture
    api, space = apis["A"], run + "pending"
    evidence["spaces"].append(space)
    original = await store(api, space, "original", 70, user_id=run + "owner")
    result = await client.mutation("facts:updateInPlace", {"tenantId": run + "A", "memorySpaceId": space, "factId": original.fact_id, "expectedSourceFactId": original._id, "fact": "replacement", "historyIntent": {"operationId": run + "pending-op", "phase": "revision_update", "reason": "original reason", "confidence": 91, "userId": run + "actor", "pipeline": {"slotMatching": True, "semanticMatching": False, "llmResolution": False}}})
    receipt = HistoryReceipt.from_wire(result["historyReceipt"])
    await api.delete_many(DeleteManyFactsParams(memory_space_id=space))
    first, second = await api.retry_history(receipt), await api.retry_history(receipt)
    assert first == second == {"event_ids": [receipt.events[0].event_id]}
    retained = await api._history_service.get_event(first["event_ids"][0])
    assert retained.old_value == "original" and retained.new_value == "replacement" and retained.reason == "original reason"
    assert retained.source_fact_id == original._id and retained.owner_user_id == run + "owner" and retained.user_id == run + "actor" and retained.publication_state == "complete"
    pending = receipt.events[0].pending.to_wire()
    pending["payload"]["reason"] = "forged reason"
    with pytest.raises(Exception, match="OPERATION_CONFLICT"):
        await client.mutation("factHistory:publishPendingEvent", {"tenantId": run + "A", "memorySpaceId": space, "operationId": run + "pending-op", "phase": "revision_update", "eventRole": receipt.events[0].pending.payload["eventRole"], "eventId": first["event_ids"][0], "pending": pending})
    assert (await api._history_service.get_event(first["event_ids"][0])).reason == "original reason"
    evidence["originalPhysicalIds"].append(original._id)
    evidence["events"] += first["event_ids"]
    evidence["cases"].append("pendingAfterDeleteExactReplayConflict")


async def admin_fixture(name, args):
    process = await asyncio.create_subprocess_exec("node", str(PRIVATE / "repair3/python-admin-fixture.mjs"), stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    output, error = await process.communicate(json.dumps({"name": name, "args": args}).encode())
    assert process.returncode == 0, error.decode()
    return json.loads(output)


@pytest.mark.asyncio
async def test_native_reused_logical_ids_legacy_migration_and_physical_guards(native_fixture):
    run, client, apis, evidence = native_fixture
    api, space = apis["A"], run + "legacy"
    evidence["spaces"].append(space)
    logical = "fact-" + run + "reused"
    old = await admin_fixture("ownedHistoryFixture:seedFact", {"memorySpaceId": space, "tenantId": run + "A", "factId": logical, "userId": run + "owner", "fact": "old"})
    foreign = await admin_fixture("ownedHistoryFixture:seedFact", {"memorySpaceId": space, "tenantId": run + "B", "factId": logical, "fact": "foreign"})
    ledger = await admin_fixture("ownedHistoryFixture:seedLegacy", {"sourceFactId": old["_id"], "userId": run + "actor"})
    evidence["contemporaneousLedgers"] = [ledger]
    with pytest.raises(Exception, match="PROVENANCE_UNRESOLVED"):
        await api.history(logical)
    with pytest.raises(Exception, match="PROVENANCE_UNRESOLVED"):
        await api._history_service.delete_by_fact_id(logical)
    assert (await admin_fixture("ownedHistoryFixture:source", {"id": old["_id"]}))["fact"] == "old"
    with pytest.raises(Exception):
        await client.mutation("factHistory:migrateEvidence", {**ledger, "dryRun": False})
    dry = await admin_fixture("factHistory:migrateEvidence", {**ledger, "dryRun": True})
    assert dry == {"changed": False, "dryRun": True}
    applied = await admin_fixture("factHistory:migrateEvidence", {**ledger, "dryRun": False})
    assert applied == {"changed": True, "dryRun": False}
    assert (await admin_fixture("factHistory:migrateEvidence", {**ledger, "dryRun": False}))["changed"] is False
    migrated = await api.history(logical)
    assert len(migrated) == 1 and migrated[0].source_fact_id == old["_id"] and migrated[0].owner_user_id == run + "owner"
    await admin_fixture("ownedHistoryFixture:removeSources", {"ids": [old["_id"]]})
    replacement = await admin_fixture("ownedHistoryFixture:seedFact", {"memorySpaceId": space, "tenantId": run + "A", "factId": logical, "fact": "replacement"})
    assert replacement["_id"] != old["_id"]
    assert all(e.source_fact_id == old["_id"] for e in await api.history(logical, selector=HistorySelector(source_fact_id=old["_id"])))
    assert [e async for batch in api._history_service.pages(HistorySelector(memory_space_id=space, source_fact_id=replacement["_id"])) for e in batch] == []
    with pytest.raises(Exception, match="FACT_HISTORY_SOURCE_MISMATCH"):
        await api.update(space, logical, {"confidence": 99}, expected_source_fact_id=old["_id"])
    assert (await admin_fixture("ownedHistoryFixture:source", {"id": replacement["_id"]}))["version"] == 1
    assert await apis["B"].history(logical) == []
    b_event = await apis["B"]._history_service.log(LogEventParams(logical, space, "CREATE", source_fact_id=foreign["_id"], new_value="foreign"))
    none = await admin_fixture("ownedHistoryFixture:seedFact", {"memorySpaceId": space, "factId": logical, "fact": "known tenantless"})
    none_event = await apis["none"]._history_service.log(LogEventParams(logical, space, "CREATE", source_fact_id=none["_id"], new_value="known tenantless"))
    assert {e.source_fact_id for e in await apis["B"].history(logical)} == {foreign["_id"]}
    assert {e.source_fact_id for e in await apis["none"].history(logical)} == {none["_id"]}
    assert {e.source_fact_id for e in await api.history(logical)} == {old["_id"]}
    evidence["events"] += [b_event["event_id"], none_event["event_id"]]
    evidence["originalPhysicalIds"] += [old["_id"], foreign["_id"]]
    evidence["excludedReplacementIds"] = [replacement["_id"]]
    evidence["events"] += [e.event_id for e in migrated]
    evidence["cases"].append("trustedLedgerUnknownLegacyFailClosedExactMigrationReusedPhysicalGuard")


@pytest.mark.asyncio
async def test_native_1001_history_events_cursor_count_activity_and_near_limit_rollback(native_fixture):
    run, client, apis, evidence = native_fixture
    api, space = apis["A"], run + "volume"
    evidence["spaces"].append(space)
    original = await store(api, space, "volume", user_id=run + "owner")
    expected = set()
    for i in range(1001):
        result = await api._history_service.log(LogEventParams(original.fact_id, space, "UPDATE", source_fact_id=original._id, operation_id=run + "log-" + str(i), new_value=str(i), user_id=run + "actor"))
        expected.add(result["event_id"])
    actual = await events(api, space)
    assert {e.event_id for e in actual} == expected and len(actual) == 1001
    assert (await api._history_service.count_by_action(space))["total"] == 1001
    summary = await api.get_activity_summary(space)
    assert summary.total_events == 1001 and summary.unique_facts_modified == 1
    large = await store(api, run + "near-limit", "x" * 510000)
    with pytest.raises(Exception, match="BUDGET_EXCEEDED"):
        await api.update(run + "near-limit", large.fact_id, {"fact": "y" * 510000}, operation_id=run + "budget", expected_source_fact_id=large._id)
    retained = await api.get(run + "near-limit", large.fact_id)
    assert retained.version == 1 and retained.superseded_by is None and retained.fact == "x" * 510000
    assert await events(api, run + "near-limit") == []
    evidence["originalPhysicalIds"] += [original._id, large._id]
    evidence["events"] += sorted(expected)
    evidence["cases"].append("1001CursorExactCountActivityNearLimitAtomicRollback")


@pytest.mark.asyncio
async def test_native_missing_anchor_never_reconstructs_source_or_creates_event(native_fixture):
    run, client, apis, evidence = native_fixture
    api, space = apis["A"], run + "missing-anchor"
    evidence["spaces"].append(space)
    original = await store(api, space, "before")
    result = await client.mutation("facts:updateInPlace", {"tenantId": run + "A", "memorySpaceId": space, "factId": original.fact_id, "fact": "after", "historyIntent": {"operationId": run + "missing-op", "phase": "revision_update", "reason": "original"}})
    receipt = HistoryReceipt.from_wire(result["historyReceipt"])
    deleted = await api._history_service.delete_by_fact_id(original.fact_id, HistorySelector(memory_space_id=space))
    assert deleted["deleted"] == 1 and deleted["isDone"]
    with pytest.raises(Exception, match="PENDING_EVENT_UNRESOLVED"):
        await api.retry_history(receipt)
    assert await events(api, space) == []
    current = await api.get(space, original.fact_id)
    assert current._id == original._id and current.fact == "after" and current.version == 1
    evidence["originalPhysicalIds"].append(original._id)
    evidence["removedEventIds"] = [e.event_id for e in receipt.events]
    evidence["cases"].append("missingRetainedAnchorUnresolvedNoReconstructionNoFactOrHistoryWrite")


@pytest.mark.asyncio
async def test_native_retained_writer_invalid_sources_conflicts_zero_effects(native_fixture):
    run, client, apis, evidence = native_fixture
    api, space = apis["A"], run + "rejects"
    evidence["spaces"].append(space)
    first, second = await store(api, space, "first", 60), await store(api, space, "second", 80)
    foreign = await store(apis["B"], space, "foreign", 99)
    attempts = [([first.fact_id, first.fact_id], first.fact_id), ([first.fact_id, "fact-missing"], first.fact_id), ([first.fact_id, "fact-missing"], "fact-missing"), ([first.fact_id, foreign.fact_id], first.fact_id)]
    for ids, kept in attempts:
        with pytest.raises(Exception):
            await api.consolidate(space, ids, kept)
        assert (await api.get(space, first.fact_id)).confidence == 60
        assert (await api.get(space, second.fact_id)).confidence == 80
        assert (await api.get(space, first.fact_id)).superseded_by is None
        assert await events(api, space) == []
    unknown = await admin_fixture("ownedHistoryFixture:seedFact", {"tenantId": run + "A", "memorySpaceId": space, "factId": "fact-" + run + "unknown", "supersedes": "fact-legacy-missing"})
    with pytest.raises(Exception, match="RELATIONSHIP_UNRESOLVED"):
        await api.consolidate(space, [first.fact_id, unknown["factId"]], first.fact_id)
    assert await events(api, space) == []
    duplicate_logical = "fact-" + run + "duplicate"
    duplicate1 = await admin_fixture("ownedHistoryFixture:seedFact", {"tenantId": run + "A", "memorySpaceId": space, "factId": duplicate_logical})
    duplicate2 = await admin_fixture("ownedHistoryFixture:seedFact", {"tenantId": run + "A", "memorySpaceId": space, "factId": duplicate_logical})
    with pytest.raises(Exception, match="SOURCE_AMBIGUOUS"):
        await api.update(space, duplicate_logical, {"confidence": 99}, expected_source_fact_id=duplicate1["_id"])
    assert (await admin_fixture("ownedHistoryFixture:source", {"id": duplicate1["_id"]}))["version"] == 1
    assert (await admin_fixture("ownedHistoryFixture:source", {"id": duplicate2["_id"]}))["version"] == 1
    assert await events(api, space) == []
    evidence["originalPhysicalIds"] += [first._id, second._id, duplicate1["_id"], duplicate2["_id"], unknown["_id"]]
    evidence["cases"].append("duplicateMissingForeignKeepUnknownLegacyPredecessorAndAmbiguousSourceZeroEffects")


@pytest.mark.asyncio
async def test_native_context_and_per_call_chain_scope_deleted_reused_origins(native_fixture):
    from cortex.facts.history import FactHistoryService
    run, client, apis, evidence = native_fixture
    space = run + "scope-chain"
    logical = "fact-" + run + "same"
    originals = {}
    for scope, api in apis.items():
        args = {"memorySpaceId": space, "factId": logical}
        if scope != "none":
            args["tenantId"] = run + scope
        original = await admin_fixture("ownedHistoryFixture:seedFact", args)
        originals[scope] = original
        await api._history_service.log(LogEventParams(logical, space, "UPDATE"))
    unscoped = FactHistoryService(client)
    for scope, api in apis.items():
        selected = HistorySelector(memory_space_id=space, tenant_id=None if scope == "none" else run + scope)
        assert [e.source_fact_id for e in await api._history_service.get_supersession_chain(logical, selected)] == [originals[scope]["_id"]]
        assert [e.source_fact_id for e in await unscoped.get_supersession_chain(logical, selected)] == [originals[scope]["_id"]]
    with pytest.raises(ValueError, match="SCOPE_MISMATCH"):
        await apis["A"]._history_service.get_supersession_chain(logical, HistorySelector(memory_space_id=space, tenant_id=run + "B"))
    first = originals["A"]
    second = await apis["A"].update(space, logical, {"confidence": 80})
    third = await apis["A"].update(space, second.fact_id, {"confidence": 90})
    ids = {first["_id"], second._id, third._id}
    await apis["A"].delete_many(DeleteManyFactsParams(memory_space_id=space))
    replacement = await admin_fixture("ownedHistoryFixture:seedFact", {"memorySpaceId": space, "factId": logical, "tenantId": run + "A"})
    assert replacement["_id"] not in ids
    assert {e.source_fact_id for e in await unscoped.get_supersession_chain(logical, HistorySelector(memory_space_id=space, tenant_id=run + "A"))} == ids
    evidence["originalPhysicalIds"] += sorted(ids)
    evidence["replacementPhysicalIds"] = [replacement["_id"]]
    evidence["cases"].append("repair1ContextAndPerCallA_B_NoneDeletedReusedPhysicalChain")

@pytest.mark.asyncio
async def test_native_public_history_all_physical_versions_multi_predecessor_and_unavailable(native_fixture):
    run, client, apis, evidence = native_fixture
    space, logical = run + "public-history", "fact-" + run + "public"
    evidence["spaces"].append(space)
    originals = {}
    for scope, api in apis.items():
        selected_tenant = None if scope == "none" else run + scope
        first = await admin_fixture("ownedHistoryFixture:seedFact", {"memorySpaceId": space, "factId": logical, **({"tenantId": selected_tenant} if selected_tenant else {})})
        second = await api.update(space, logical, {"confidence": 91}, operation_id=run + scope + "public", expected_source_fact_id=first["_id"])
        ids = {first["_id"], second._id}
        assert {f._id for f in await api.get_history(space, logical)} == ids
        assert {f._id for f in await apis["none"].get_history(space, logical, tenant_id=selected_tenant)} == ids
        originals[scope] = sorted(ids)
    with pytest.raises(ValueError, match="SCOPE_MISMATCH"):
        await apis["A"].get_history(space, logical, tenant_id=run + "B")
    consolidation_space = run + "public-consolidate"
    evidence["spaces"].append(consolidation_space)
    inputs = [await store(apis["A"], consolidation_space, f"Distinct {i}") for i in range(3)]
    await apis["A"].consolidate(consolidation_space, [f.fact_id for f in inputs], inputs[0].fact_id, operation_id=run + "public-consolidate")
    ids = {f._id for f in inputs}
    assert {f._id for f in await apis["A"].get_history(consolidation_space, inputs[0].fact_id)} == ids
    await admin_fixture("ownedHistoryFixture:removeSources", {"ids": [inputs[1]._id]})
    replacement = await admin_fixture("ownedHistoryFixture:seedFact", {"memorySpaceId": consolidation_space, "tenantId": run + "A", "factId": inputs[1].fact_id})
    with pytest.raises(ValueError, match="ORIGINAL_RECORD_UNAVAILABLE"):
        await apis["A"].get_history(consolidation_space, inputs[0].fact_id)
    assert {e.source_fact_id for e in await apis["A"]._history_service.get_supersession_chain(inputs[0].fact_id, HistorySelector(memory_space_id=consolidation_space))} == ids
    evidence["originalPhysicalIds"] += [value for group in originals.values() for value in group] + sorted(ids)
    purged_space = run + "public-purged-audit"
    evidence["spaces"].append(purged_space)
    purged = await store(apis["A"], purged_space, "Original purged audit")
    await apis["A"].update(purged_space, purged.fact_id, {"confidence": 80})
    from cortex.facts.discovery import scoped_pages
    deleted = 0

    async def purge_range(page_range):
        nonlocal deleted
        result = await apis["A"]._history_service.delete_by_memory_space(purged_space, pagination_opts={**page_range, "numItems": 256})
        deleted += result["deleted"]
        return {**result, "page": []}

    async for _page in scoped_pages(purge_range, "test-owned-purge"):
        pass
    assert deleted == 2
    with pytest.raises(ValueError, match="RELATIONSHIP_UNRESOLVED"):
        await apis["A"].get_history(purged_space, purged.fact_id)
    evidence["publicHistory"] = {"scopes": originals, "consolidation": sorted(ids), "replacement": replacement["_id"], "unavailableRefused": True}
    evidence["cases"].append("repair2PublicExactHistoryLive2Consolidate3CollisionPerCallDeletedReuseRefusal")


@pytest.mark.asyncio
async def test_native_none_decision_log_phase_original_context_no_fact_writes(native_fixture):
    from cortex.facts.belief_revision import ConflictCandidate, DecisionLogError, ReviseParams
    run, client, apis, evidence = native_fixture
    space = run + "none-log"
    evidence["spaces"].append(space)
    source = await store(apis["A"], space, "User likes blue", 90, subject="person", user_id="owner")
    calls = []

    class FailLog:
        async def query(self, name, args):
            return await client.query(name, args)
        async def mutation(self, name, args):
            calls.append((name, args))
            raise OSError("decision history unavailable")

    api = FactsAPI(FailLog(), auth_context=AuthContext(user_id="actor", tenant_id=run + "A"))
    with pytest.raises(DecisionLogError) as failure:
        await api.revise(ReviseParams(space, ConflictCandidate(fact=source.fact, fact_type="preference", confidence=50, subject="person"), user_id="owner", source_ref={"conversationId": "original-decision-context"}))
    assert failure.value.committed is False and failure.value.phase == "decision_log"
    assert [name for name, args in calls] == ["factHistory:logEvent"]
    assert calls[0][1]["conversationId"] == "original-decision-context"
    assert (await apis["A"].get(space, source.fact_id)).confidence == 90
    assert await events(apis["A"], space) == []
    evidence["originalPhysicalIds"].append(source._id)
    evidence["cases"].append("repair2NoneTypedNoncommittedDecisionLogOriginalConversationZeroFactWrites")

@pytest.mark.asyncio
async def test_native_time_filters_purge_hints_and_strict_large_equality(native_fixture):
    from datetime import datetime, timezone
    from cortex.facts.discovery import scoped_pages
    run, client, apis, evidence = native_fixture
    h = apis["A"]._history_service
    outcomes = []
    for cutoff in (0, 10**14):
        space = run + "time-boundary-" + str(cutoff)
        evidence["spaces"].append(space)
        source = await store(apis["A"], space, "boundary source", user_id="boundary-owner")
        originals = [await admin_fixture("ownedHistoryFixture:seedBoundaryEvent", {"sourceFactId": source._id, "timestamp": time}) for time in (cutoff - 1, cutoff, cutoff + 1)]
        date = datetime.fromtimestamp(cutoff / 1000, timezone.utc)
        from cortex.facts.history import ChangeFilter
        assert [e.event_id for e in await h.get_changes(ChangeFilter(space, after=date, before=date))] == [originals[1]["eventId"]]
        assert (await h.count_by_action(space, date, date))["total"] == 1
        before = [e.event_id for e in await events(apis["A"], space)]
        for limit in (-1, 0, float("nan"), float("inf"), -float("inf"), 1.5):
            for opts in (None, {"numItems": 1, "cursor": None}):
                with pytest.raises(ValueError, match="INVALID_PAGE_SIZE"):
                    await h.purge_old_events(date, space, limit, pagination_opts=opts)
                assert [e.event_id for e in await events(apis["A"], space)] == before
        for value in (float("nan"), float("inf"), -float("inf")):
            with pytest.raises(ValueError, match="INVALID_TIME_RANGE"):
                async for _batch in h.pages(HistorySelector(memory_space_id=space, before=value)):
                    pass
            for name in ("deleteByFactId", "deleteByUserId", "deleteByOwner", "deleteByMemorySpace"):
                selector = {"factId": source.fact_id} if name == "deleteByFactId" else {"userId": "boundary-actor"} if name == "deleteByUserId" else {"ownerUserId": source.user_id} if name == "deleteByOwner" else {}
                with pytest.raises(Exception, match="INVALID_TIME_RANGE"):
                    await client.mutation("factHistory:" + name, {"tenantId": run + "A", "memorySpaceId": space, **selector, "before": value})
                assert [e.event_id for e in await events(apis["A"], space)] == before
        first = await h.purge_old_events(date, space, 1, pagination_opts={"numItems": 3, "cursor": None})
        assert first["deleted"] == 0 and first["remaining"] is None and not first["isDone"]
        total = first["deleted"]

        async def purge_range(page_range):
            nonlocal total
            result = await h.purge_old_events(date, space, 1, pagination_opts={**page_range, "numItems": 3})
            total += result["deleted"]
            return {**result, "page": []}

        async for _batch in scoped_pages(purge_range, "owned-boundary-purge"):
            pass
        assert total == 1
        assert {e.event_id for e in await events(apis["A"], space)} == {e["eventId"] for e in originals[1:]}
        assert (await h.purge_old_events(date, space, 1000))["deleted"] == 0
        summary = await h.get_activity_summary(space, 0.5)
        native_summary = await client.query("factHistory:getActivitySummary", {"tenantId": run + "A", "memorySpaceId": space, "hours": 0.5})
        assert summary.total_events == native_summary["totalEvents"] == 0
        outcomes.append({"space": space, "cutoff": cutoff, "source": source._id, "events": originals, "equalPreserved": True, "activityBeforeAndAfterBounded": True})
        evidence["originalPhysicalIds"].append(source._id)
    evidence["timeBoundaries"] = outcomes
    evidence["cases"].append("repair3FiniteWindowsStrictEpochLargeCutoffAndHonestPositiveBatchHints")
