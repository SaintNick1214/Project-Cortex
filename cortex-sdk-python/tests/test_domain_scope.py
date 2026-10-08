import hashlib
import json
import os
from pathlib import Path

import pytest
from convex.http_client import ConvexHttpClient

from cortex import Cortex, CortexConfig
from cortex.resilience import ResilienceConfig
from cortex.types import (
    AuthContext,
    CountConversationsFilter,
    CountFactsFilter,
    DeleteUserOptions,
    GetMemorySpaceStatsOptions,
    ListMemorySpacesFilter,
    ListUsersFilter,
    ParticipantUpdates,
)

ROOT = Path(os.environ["CORTEX_TASK17_PROOF_ROOT"])
KEY = json.loads((ROOT / "private-admin.json").read_text())["key"]
URL = "http://127.0.0.1:45710"
assert os.environ["CONVEX_URL_PY"] == URL


def digest(value):
    # Known fixture data only; Python's ordinary JSON is an independent preservation hash.
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


@pytest.mark.parametrize("scope", ["A", "B", "none"])
async def test_actual_native_domain_scope(scope):
    tenant = None if scope == "none" else f"task17-{scope}"
    admin = ConvexHttpClient(URL)
    admin.set_admin_auth(KEY)
    client = Cortex(CortexConfig(convex_url=URL, auth=AuthContext(user_id="actor", tenant_id=tenant), resilience=ResilienceConfig(enabled=False)))
    client.client._sync_client.set_admin_auth(KEY)
    receipts = []
    async def read(ids):
        import asyncio
        result = []
        for i in range(0, len(ids), 16):
            result.extend(await asyncio.to_thread(admin.query, "task17Fixture:readLedgerRows", {"ids": ids[i:i + 16]}))
        return result
    ledger = json.loads((ROOT / "evidence/native-ledger5.json").read_text())
    ids = [id for row in ledger if row["case"] == "python" for id in row["ids"]]
    try:
        before = [row for row in await read(ids) if row]
        selected = [r for r in before if r.get("tenantId") == tenant]
        foreign = [digest(r) for r in before if r.get("tenantId") != tenant]
        space = "task17-python"
        user = "task17-python-user"
        assert (await client.memory_spaces.get(space))._id == next(r["_id"] for r in selected if r.get("type") == "team")
        assert (await client.users.get(user)).data["python" if os.environ.get("CORTEX_TASK17_PYTHON_RESUME") == "1" else "marker"] == scope
        assert [v.version for v in await client.users.get_history(user)] == ([1, 2, 3] if os.environ.get("CORTEX_TASK17_PYTHON_RESUME") == "1" else [1, 2])
        if os.environ.get("CORTEX_TASK17_PYTHON_RESUME") != "1":
            await client.memory_spaces.update(space, {"name": f"python-{scope}"})
            await client.memory_spaces.add_participant(space, {"id": "new", "type": "tool", "joinedAt": 20})
            await client.memory_spaces.update_participants(space, ParticipantUpdates(add=[{"id": "third", "type": "agent", "joinedAt": 21}], remove=["new"]))
            await client.memory_spaces.remove_participant(space, "third")
            await client.memory_spaces.archive(space, "task17 owned")
            assert (await client.memory_spaces.get(space)).status == "archived"
            await client.memory_spaces.reactivate(space)
            await client.users.update(user, {"python": scope})
            assert [v.version for v in await client.users.get_history(user)] == [1, 2, 3]
        else:
            # Prior failed attempt completed these mutations; reconcile, never resend.
            observed = await client.memory_spaces.get(space)
            assert observed.name == f"python-{scope}" and observed.status == "active"
            assert [p["id"] for p in observed.participants] == ["participant"]
            assert (await client.users.get(user)).version == 3
            receipts.append({"operation": "committed-python-mutations-reconciled", "outcome": "PASS", "mutationReplayed": False})
        assert all(r.tenant_id == tenant for r in (await client.memory_spaces.list(ListMemorySpacesFilter(limit=1000))).spaces)
        assert all(r.tenant_id == tenant for r in await client.memory_spaces.find_by_participant("participant"))
        assert [r.memory_space_id for r in await client.memory_spaces.search(space)] == [space]
        assert all(r.tenant_id == tenant for r in (await client.users.list(ListUsersFilter(limit=1000))).users)
        assert await client.vector.count("task17-count", user_id="task17-count-user", participant_id="count-participant", source_type="system") == 1001
        assert await client.memory.count("task17-count", participant_id="count-participant") == 1001
        assert await client.conversations.count(CountConversationsFilter(memory_space_id="task17-count", user_id="task17-count-user", type="user-agent")) == 1001
        assert await client.facts.count(CountFactsFilter(memory_space_id="task17-count", participant_id="count-participant", tags=["task17", "tag"], tag_match="all", confidence=75)) == 1001
        assert await client.memory_spaces.count(type="custom") == 1001
        assert await client.users.count({"created_before": 1001}) == 1001
        assert await client.users.count({"createdAfter": 0, "createdBefore": 2, "updatedAfter": 0.5, "updatedBefore": 2.5}) == 1
        assert await client.users.count({"createdBefore": 0}) == 0
        assert await client.users.count({"created_after": 2**53 + 2}) == 0
        with pytest.raises(Exception):
            await client.users.count({"created_after": 2**53 + 1})
        stats = await client.memory_spaces.get_stats("task17-stats", GetMemorySpaceStatsOptions(include_participants=True, time_window="all"))
        ts_stats = next(r["storage"] for r in json.loads((ROOT / "evidence/native-outcomes.json").read_text()) if r.get("name") == f"stats-{scope}")
        assert stats.storage == {"conversations_bytes": ts_stats["conversationsBytes"], "memories_bytes": ts_stats["memoriesBytes"], "facts_bytes": ts_stats["factsBytes"], "total_bytes": ts_stats["totalBytes"]}
        assert stats.storage_measurement == "convex-json-utf8-estimate" and stats.total_facts == 1
        after = [row for row in await read(ids) if row]
        assert [digest(r) for r in after if r.get("tenantId") != tenant] == foreign
        receipts.append({"operation": "scope-lifecycle-count-stats-history", "outcome": "PASS", "counts": 1001, "foreignPreserved": len(foreign)})
        dry_before = [digest(r) for r in after]
        dry = await client.users.delete(user, DeleteUserOptions(dry_run=True))
        assert dry.total_deleted == 0 and not dry.verification.complete and dry.verification.scope == "user-profile"
        assert [digest(r) for r in await read(ids) if r] == dry_before
        result = await client.users.delete(user)
        assert result.total_deleted == 1 and result.verification.complete and result.verification.scope == "user-profile"
        profile_id = next(r["_id"] for r in selected if r.get("type") == "user")
        assert [digest(r) for r in await read(ids) if r] == [digest(r) for r in after if r["_id"] != profile_id]
        assert await client.users.get(user) is None
        receipts.append({"operation": "profile-only-dry-run-purge", "outcome": "PASS"})
        for operation in [lambda: client.memory_spaces.list(ListMemorySpacesFilter(tenant_id="conflicting")), lambda: client.users.count({"tenant_id": "conflicting"})]:
            if tenant is not None:
                with pytest.raises(Exception):
                    await operation()
        for user_operation in [lambda: client.users.get("task17-duplicate-user"), lambda: client.users.update("task17-duplicate-user", {"no": True}), lambda: client.users.get_history("task17-duplicate-user"), lambda: client.users.delete("task17-duplicate-user")]:
            with pytest.raises(Exception, match="DOMAIN_SCOPE_AMBIGUOUS"):
                await user_operation()
        if tenant in (None, "task17-A"):
            with pytest.raises(Exception, match="limit|many bytes|maximum"):
                await client.vector.count("task17-rollback", tenant_id="task17-A")
        receipts.append({"operation": "ambiguity-and-errors", "outcome": "PASS"})
    except Exception as error:
        receipts.append({"operation": "native-python", "outcome": "FAIL", "error": str(error).replace(KEY, "[private]")})
        raise
    finally:
        await client.close()
        admin.clear_auth()
        # This official HTTP oracle has no persistent client close API.
        # SDK close is awaited; the process receipt observes natural join.
        receipts.append({"operation": "actual-client-close", "outcome": "PASS"})
        (ROOT / "evidence" / f"python-native-{scope}.json").write_text(json.dumps(receipts, indent=2) + "\n")
