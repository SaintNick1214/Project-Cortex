import math
from decimal import Decimal
from types import SimpleNamespace

import pytest

from cortex.conversations import ConversationsAPI
from cortex.facts import FactsAPI
from cortex.memory_spaces import MemorySpacesAPI
from cortex.types import (
    AuthContext,
    CountConversationsFilter,
    CountFactsFilter,
    DeleteMemorySpaceOptions,
    DeleteUserOptions,
    ListMemorySpacesFilter,
    ListUsersFilter,
    ParticipantUpdates,
    RegisterMemorySpaceParams,
)
from cortex.users import UsersAPI
from cortex.users.validators import validate_user_count_result
from cortex.vector import VectorAPI


class Transport:
    def __init__(self, tenant=None):
        self.calls = []
        self.profile = dict(id="same", tenantId=tenant, data={}, version=2, createdAt=1, updatedAt=2)
        self.tenant = tenant

    async def query(self, name, args):
        self.calls.append((name, args))
        space = dict(_id="owned-space", memorySpaceId="shared", name="same", type="team", status="active", participants=[], metadata={}, createdAt=1, updatedAt=2)
        if self.tenant is not None:
            space["tenantId"] = self.tenant
        if name.endswith(":count"):
            return 1001
        if name == "immutable:get":
            return self.profile
        if name == "immutable:list":
            return dict(entries=[self.profile], total=1, hasMore=False)
        if name == "immutable:getHistory":
            return [dict(version=1, data={"old": True}, timestamp=1)]
        if name == "memorySpaces:list":
            return dict(spaces=[space], total=1, hasMore=False, offset=0)
        if name in ("memorySpaces:search", "memorySpaces:findByParticipant"):
            return [space]
        if name == "memorySpaces:getStats":
            return dict(memorySpaceId="shared", totalMemories=0, totalConversations=0, totalFacts=0, totalMessages=0,
                        storage=dict(conversationsBytes=0, memoriesBytes=0, factsBytes=0, totalBytes=0), topTags=[], importanceBreakdown={}, storageMeasurement="convex-json-utf8-estimate")
        return space

    async def mutation(self, name, args):
        if name == "immutable:purge":
            self.calls.append((name, args))
            self.profile = None
            return dict(deleted=True)
        if name == "immutable:store":
            self.calls.append((name, args))
            return dict(id=args["id"], data=args["data"], tenantId=args.get("tenantId"), version=3, createdAt=1, updatedAt=3)
        if name == "memorySpaces:deleteSpace":
            self.calls.append((name, args))
            return dict(memorySpaceId="shared", deleted=True, cascade={}, reason="owned", deletedAt=3)
        return await self.query(name, args)


def fixture(tenant):
    t = Transport(tenant)
    auth = AuthContext(user_id="actor", tenant_id=tenant)
    return t, auth


async def delete_with_erasure(api):
    """Task19 deletion uses a distinct admin capability; retain exact17 scope checks."""
    from cortex.users.erasure import ERASURE_OPERATIONS
    row = dict(table="memorySpaces", id="owned-space", fingerprint="1" * 64,
               action="root", dependencies=[], retainedVersions=0, messages=0,
               serializedBytes=1, storageIds=[])
    observed, state = [], {"deleted": False}
    async def call(operation, request, **kwargs):
        assert request["domain"] == dict(kind="space", memorySpaceId="shared", **(
            {"tenantId": api.client.tenant} if api.client.tenant is not None else {}))
        observed.append((operation, request))
        api.client.calls.append((operation, request["domain"]))
        envelope = dict(protocolVersion=1, observationTime=1, domain=request["domain"])
        if operation in ("discover", "verify"):
            return dict(**envelope, table=request["table"], page=[row] if request["table"] == "memorySpaces" and not state["deleted"] else [], continueCursor="end", isDone=True)
        if operation == "check":
            return dict(**envelope, record=row)
        if operation == "binary":
            return dict(**envelope, blobs=[])
        if operation == "erase":
            state["deleted"] = True
            return dict(**envelope, operationId=request["operationId"], itemKey=request["itemKey"],
                        table="memorySpaces", id="owned-space", state="committed", deleted=1, detached=0,
                        retainedVersions=0, messages=0, blobs=[], graphJobs=[])
        raise AssertionError("Unexpected admin operation")
    transport = SimpleNamespace(kind="cortex-erasure-v1", protocol_version=1, operations=ERASURE_OPERATIONS,
        discover_page=lambda r, **k: call("discover", r, **k), verify_page=lambda r, **k: call("verify", r, **k),
        check_record=lambda r, **k: call("check", r, **k), check_binary_references=lambda r, **k: call("binary", r, **k),
        erase_record=lambda r, **k: call("erase", r, **k), get_receipt_page=lambda r, **k: call("receipt", r, **k),
        purge_expired_receipts_page=lambda r, **k: call("purge", r, **k), close=lambda: None)
    result = await api.delete("shared", DeleteMemorySpaceOptions(cascade=True, reason="owned", erasure_transport=transport))
    assert result.deleted and result.erasure.complete and result.erasure.total_deleted == 1
    assert {r["table"] for op, r in observed if op == "discover"} == set(result.erasure.per_table)
    assert len([op for op, _ in observed if op == "erase"]) == 1
    assert all(op != "memorySpaces:deleteSpace" for op, _ in api.client.calls)
    return result


operations = {
    "register": lambda api: api.register(RegisterMemorySpaceParams(memory_space_id="shared", type="team")),
    "get": lambda api: api.get("shared"), "list": lambda api: api.list(), "count": lambda api: api.count(),
    "update": lambda api: api.update("shared", {"name": "updated"}),
    "add": lambda api: api.add_participant("shared", {"id": "p", "type": "tool", "joinedAt": 3}),
    "remove": lambda api: api.remove_participant("shared", "p"),
    "participants": lambda api: api.update_participants("shared", ParticipantUpdates(add=[{"id": "p", "type": "tool", "joinedAt": 3}])),
    "archive": lambda api: api.archive("shared", "owned"), "reactivate": lambda api: api.reactivate("shared"),
    "stats": lambda api: api.get_stats("shared"), "find": lambda api: api.find_by_participant("p"),
    "search": lambda api: api.search("shared"), "delete": delete_with_erasure,
}


@pytest.mark.parametrize("tenant", ["A", "B", None])
@pytest.mark.parametrize("operation", operations)
async def test_space_scope(tenant, operation):
    t, auth = fixture(tenant)
    result = await operations[operation](MemorySpacesAPI(t, auth_context=auth))
    assert t.calls
    assert all(args.get("tenantId") == tenant for _, args in t.calls)
    if operation == "stats":
        assert result.storage_measurement == "convex-json-utf8-estimate"


@pytest.mark.parametrize("tenant", ["A", "B", None])
@pytest.mark.parametrize("operation", ["get", "update", "list", "get_history", "count"])
async def test_profile_scope(tenant, operation):
    t, auth = fixture(tenant)
    api = UsersAPI(t, auth_context=auth)
    if operation == "update":
        await api.update("same", {"new": True})
    elif operation in ("list", "count"):
        await getattr(api, operation)()
    else:
        await getattr(api, operation)("same")
    assert t.calls
    assert all(args.get("tenantId") == tenant for _, args in t.calls)


@pytest.mark.parametrize("tenant", ["A", "B", None])
async def test_counts_and_profile_dry_run(tenant):
    t, auth = fixture(tenant)
    await VectorAPI(t, auth_context=auth).count("shared", participant_id="p", source_type="system")
    await ConversationsAPI(t, auth_context=auth).count(CountConversationsFilter(memory_space_id="shared", type="user-agent"))
    await FactsAPI(t, auth_context=auth).count(CountFactsFilter(memory_space_id="shared", tags=["tag"]))
    assert all(args.get("tenantId") == tenant for _, args in t.calls)
    assert t.calls[0][1]["participantId"] == "p"
    t.calls.clear()
    api = UsersAPI(t, auth_context=auth)
    result = await api.delete("same", DeleteUserOptions(dry_run=True))
    assert not t.calls and result.total_deleted == 0
    assert result.verification.scope == "user-profile" and not result.verification.complete
    result = await api.delete("same")
    assert result.total_deleted == 1 and result.verification.complete
    assert [name for name, _ in t.calls] == ["immutable:purge", "immutable:get"]


@pytest.mark.parametrize("selected", ["", " ", False, 12])
async def test_invalid_scope_zero_transport(selected):
    t, auth = fixture(None)
    calls = [lambda: MemorySpacesAPI(t).list(ListMemorySpacesFilter(tenant_id=selected)),
             lambda: UsersAPI(t).count({"tenant_id": selected}),
             lambda: VectorAPI(t).count("shared", tenant_id=selected),
             lambda: ConversationsAPI(t).count(tenant_id=selected),
             lambda: FactsAPI(t).count(CountFactsFilter(memory_space_id="shared", tenant_id=selected))]
    for call in calls:
        with pytest.raises(Exception):
            await call()
    assert not t.calls


@pytest.mark.parametrize("tenant", [None, "A"])
async def test_explicit_scope_and_conflict(tenant):
    t, auth = fixture(tenant)
    calls = [lambda: MemorySpacesAPI(t, auth_context=auth).list(ListMemorySpacesFilter(tenant_id="B")),
             lambda: UsersAPI(t, auth_context=auth).list(ListUsersFilter(tenant_id="B")),
             lambda: UsersAPI(t, auth_context=auth).count({"tenantId": "B"}),
             lambda: VectorAPI(t, auth_context=auth).count("shared", tenant_id="B"),
             lambda: ConversationsAPI(t, auth_context=auth).count(tenant_id="B"),
             lambda: FactsAPI(t, auth_context=auth).count(CountFactsFilter(memory_space_id="shared", tenant_id="B"))]
    for call in calls:
        if tenant is None:
            await call()
        else:
            with pytest.raises(Exception):
                await call()
    if tenant is None:
        assert all(args["tenantId"] == "B" for _, args in t.calls)
    else:
        assert not t.calls


@pytest.mark.parametrize("filters", [[], 4, {"tenantId": None}, {3: 4}, {"type": "audit"}, {"userId": "u"}, {"filters": {}},
    {"limit": None}, {"createdAfter": True}, {"createdAfter": Decimal("1")}, {"createdAfter": float("nan")},
    {"createdAfter": float("inf")}, {"createdAfter": -1}, {"createdAfter": 2**53+1}, {"createdAfter": 10**400},
    {"createdAfter": 0, "createdBefore": 0}, {"updatedAfter": 1, "updatedBefore": 0},
    {"created_after": 1, "createdAfter": 1}, {"tenant_id": "A", "tenantId": "A"}, {"createdBefore": SimpleNamespace()}])
async def test_count_invalid_filter_zero_transport(filters):
    t, _ = fixture(None)
    with pytest.raises(Exception):
        await UsersAPI(t).count(filters)
    assert not t.calls


@pytest.mark.parametrize("aliases", [False, True])
async def test_count_flat_numeric_cutoffs(aliases):
    t, auth = fixture("A")
    args = dict(created_after=0, created_before=0.5, updated_after=1.25, updated_before=2)
    if aliases:
        args = dict(createdAfter=0, createdBefore=0.5, updatedAfter=1.25, updatedBefore=2)
    assert await UsersAPI(t, auth_context=auth).count(args) == 1001
    assert t.calls == [("immutable:count", dict(type="user", tenantId="A", createdAfter=0, createdBefore=0.5, updatedAfter=1.25, updatedBefore=2))]


@pytest.mark.parametrize("result", [True, "1", None, {}, 1.5, -1, float("nan"), float("inf")])
def test_count_response_validation(result):
    with pytest.raises(Exception):
        validate_user_count_result(result)


async def test_count_transport_error_and_defensive_profile_scope():
    t, auth = fixture("A")
    t.profile["tenantId"] = None
    assert await UsersAPI(t, auth_context=auth).get("same") is None
    async def fail(*args):
        raise RuntimeError("native-budget")
    t.query = fail
    with pytest.raises(RuntimeError, match="native-budget"):
        await UsersAPI(t).count()

@pytest.mark.parametrize("value", [2**53, 2**53 + 2, float(2**53 + 2), 0, 0.25])
def test_count_cutoff_survives_actual_official_codec(value):
    from convex.values import coerce_args_to_convex

    from cortex.users.validators import validate_user_count_filter
    actual = validate_user_count_filter({"created_after": value}, None)
    encoded = coerce_args_to_convex(actual)
    assert encoded["createdAfter"] == value
    assert actual["createdAfter"] == value
    if type(value) is int and value > 2**53:
        assert type(actual["createdAfter"]) is float


def test_gigantic_count_response_is_sanitized():
    from cortex.users.validators import UserValidationError
    with pytest.raises(UserValidationError, match="Invalid profile count response"):
        validate_user_count_result(10**10000)
