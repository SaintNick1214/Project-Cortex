"""Profile-only verification uses the exact scope already selected for purge."""

from unittest.mock import AsyncMock, patch

import pytest

from cortex.types import AuthContext, DeleteUserOptions, ErasureReceipt
from cortex.users import UsersAPI
from cortex.users.erasure import DomainErasureError
from cortex.users.export import DOMAINS
from cortex.users.validators import UserValidationError


@pytest.mark.asyncio
@pytest.mark.parametrize("constructor_tenant", [None, "tenant-A"])
async def test_explicit_profile_scope_verifies_selected_only(constructor_tenant):
    user = "same-logical-user"
    profiles = {None: {"kept": "tenantless"}, "tenant-A": {"kept": "A"}, "tenant-B": {"kept": "B"}}
    foreign_before = {tenant: dict(profiles[tenant]) for tenant in (None, "tenant-B")}
    client = AsyncMock()

    async def purge(function, args):
        assert function == "immutable:purge"
        assert args == {"type": "user", "id": user, "tenantId": "tenant-A"}
        del profiles[args["tenantId"]]

    async def get(function, args):
        assert function == "immutable:get"
        tenant = args.get("tenantId")
        if tenant not in profiles:
            return None
        return {"id": user, "tenantId": tenant, "data": profiles[tenant], "version": 1, "createdAt": 1, "updatedAt": 1}

    client.mutation.side_effect = purge
    client.query.side_effect = get
    auth = AuthContext(user_id=user, tenant_id=constructor_tenant) if constructor_tenant else None
    result = await UsersAPI(client, auth_context=auth).delete(user, DeleteUserOptions(tenant_id="tenant-A"))
    assert result.verification.complete and result.total_deleted == 1
    assert result.immutable_records_deleted == 0 and result.deleted_layers == ["user-profile"]
    client.query.assert_awaited_once_with("immutable:get", {"type": "user", "id": user, "tenantId": "tenant-A"})
    assert {tenant: profiles[tenant] for tenant in (None, "tenant-B")} == foreign_before
    assert "tenant-A" not in profiles


@pytest.mark.asyncio
@pytest.mark.parametrize("dry_run,verify", [(True, True), (False, False)])
async def test_profile_preview_and_noverify_skip_optional_query(dry_run, verify):
    client = AsyncMock()
    result = await UsersAPI(client).delete("same-logical-user", DeleteUserOptions(tenant_id="tenant-A", dry_run=dry_run, verify=verify))
    client.query.assert_not_awaited()
    assert result.verification.complete is False
    assert result.total_deleted == (0 if dry_run else 1)
    if dry_run:
        client.mutation.assert_not_awaited()
    else:
        client.mutation.assert_awaited_once_with("immutable:purge", {"type": "user", "id": "same-logical-user", "tenantId": "tenant-A"})


@pytest.mark.asyncio
async def test_conflicting_profile_scope_refuses_before_purge_or_verification():
    client = AsyncMock()
    api = UsersAPI(client, auth_context=AuthContext(user_id="same-logical-user", tenant_id="tenant-B"))
    with pytest.raises(UserValidationError) as error:
        await api.delete("same-logical-user", DeleteUserOptions(tenant_id="tenant-A"))
    assert error.value.code == "TENANT_SCOPE_MISMATCH"
    client.query.assert_not_awaited()
    client.mutation.assert_not_awaited()


def controlled_receipt(user="a", mode="profile"):
    root = {"table": "immutable", "id": user + "-root", "action": "root"}
    planned = [root] if mode == "profile" else [root, {"table": "immutable", "id": user + "-other", "action": "delete"}, {"table": "memories", "id": user + "-memory", "action": "delete"}]
    outcomes = [] if mode == "preview" else [{"table": row["table"], "id": row["id"], "state": "alreadyAbsent" if mode == "absent" and row["action"] == "root" else "committed", "deleted": 0 if mode == "absent" and row["action"] == "root" else 1, "messages": 0} for row in planned]
    per_table = {table: {"deleted": sum(item["deleted"] for item in outcomes if item["table"] == table), "detached": 0} for table in DOMAINS}
    return ErasureReceipt(operation_id=user + "-operation", domain={"kind": "user", "userId": user}, started_at=1, ended_at=2, planned=planned, remaining=[], per_table=per_table, outcomes=outcomes, executed=bool(outcomes), total_deleted=sum(item["deleted"] for item in outcomes), graph={"state": "complete" if mode == "graph" else "notConfigured", "jobs": [], "nodesDeleted": 2 if mode == "graph" else 0}, verification={"complete": mode != "preview"}, complete=mode != "preview")


@pytest.mark.asyncio
@pytest.mark.parametrize("mode,immutable,layers,total,graph", [
    ("profile", 0, ["user-profile"], 1, 0),
    ("mixed", 1, ["immutable", "vector", "user-profile"], 3, 0),
    ("graph", 1, ["immutable", "vector", "graph", "user-profile"], 3, 2),
    ("preview", 0, [], 0, 0),
    ("absent", 1, ["immutable", "vector"], 2, 0),
])
async def test_public_cascade_legacy_detail_counts(mode, immutable, layers, total, graph):
    original = controlled_receipt(mode=mode)
    with patch("cortex.users.prepare_erasure", new=AsyncMock(return_value=object())), patch("cortex.users.execute_erasure", new=AsyncMock(return_value=original)):
        result = await UsersAPI(AsyncMock()).delete("a", DeleteUserOptions(cascade=True, dry_run=mode == "preview"))
    assert result.immutable_records_deleted == immutable
    assert result.total_deleted == total and result.graph_nodes_deleted == graph
    assert result.deleted_layers == layers and result.erasure is original
    assert original.per_table["immutable"]["deleted"] == (2 if mode in ("mixed", "graph") else 0 if mode == "preview" else 1)


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["partial", "unknown", "zero", "absent"])
async def test_public_bulk_current_progress_is_not_unstarted(mode):
    first, current = controlled_receipt(), controlled_receipt("b", "preview")
    if mode == "partial":
        current.outcomes = controlled_receipt("b").outcomes
        current.executed, current.total_deleted = True, 1
    if mode == "unknown":
        current.unknown = ["b-root"]
    if mode == "absent":
        current.outcomes = [{"table": "immutable", "id": "b-root", "state": "alreadyAbsent", "deleted": 0}]
        current.executed = True
    cause = DomainErasureError("controlled-stop", "controlled", receipt=current)
    prepare, execute = AsyncMock(return_value=object()), AsyncMock(side_effect=[first, cause])
    with patch("cortex.users.prepare_erasure", new=prepare), patch("cortex.users.execute_erasure", new=execute):
        with pytest.raises(DomainErasureError) as error:
            await UsersAPI(AsyncMock()).delete_many(["a", "b", "c"], {"cascade": True})
    assert error.value is cause and error.value.receipt is current
    assert error.value.deleted == 1 and error.value.user_ids == ["a"]
    assert error.value.unstarted == (["b", "c"] if mode == "zero" else ["c"])
    assert len(error.value.outcomes) == 1 and error.value.outcomes[0].user_id == "a"
    assert prepare.await_count == 3 and execute.await_count == 2
