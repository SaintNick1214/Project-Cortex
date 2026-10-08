"""Task19 fixed transport controls use only owned loopback HTTP fixtures."""

import asyncio
import json
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from convex.values import ConvexInt64, strict_convex_to_json

from cortex.memory_spaces import MemorySpacesAPI
from cortex.users import UsersAPI
from cortex.users.erasure import (
    ERASURE_OPERATIONS,
    DomainErasureError,
    create_erasure_transport,
    validate_erasure_domain,
    validate_erasure_transport,
)
from cortex.users.export import UserExportTransport

DOMAIN = {"kind": "user", "userId": "controlled-user", "tenantId": "controlled-tenant"}
FP = "1" * 64


def request(operation):
    if operation == "purgeExpiredReceiptsPage":
        return {"before": 100, "cursor": None, "numItems": 8}
    result = {"domain": DOMAIN}
    if operation in ("discoverPage", "verifyPage"):
        result.update(table="immutable", cursor=None, numItems=8)
    elif operation == "getReceiptPage":
        result.update(operationId="controlled-operation", cursor=None, numItems=8)
    else:
        result.update(table="immutable", id="controlled-id", expectedFingerprint=FP)
        if operation == "eraseRecord":
            result.update(
                operationId="controlled-operation",
                itemKey="controlled-item",
                requestDigest=FP,
                domainDigest=FP,
            )
    return result


@pytest.fixture
def listener():
    state = {
        "mode": "normal",
        "requests": [],
        "entered": threading.Event(),
        "peer_closed": threading.Event(),
        "stop": threading.Event(),
        "override": {},
    }

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            state["requests"].append(
                (
                    self.path,
                    self.headers.get("Authorization") == "Convex controlled-key",
                    body,
                )
            )
            state["entered"].set()
            if state["mode"] == "lost":
                self.close_connection = True
                return
            if state["mode"] == "stall":
                self.connection.settimeout(0.05)
                while not state["stop"].is_set():
                    try:
                        if self.connection.recv(1) == b"":
                            state["peer_closed"].set()
                            return
                    except socket.timeout:
                        continue
                    except OSError:
                        state["peer_closed"].set()
                        return
                return
            value = {
                "protocolVersion": 1,
                "observationTime": 1,
                "domain": body["args"].get("domain"),
                "page": [],
                "isDone": True,
                "continueCursor": "end",
                "codecControl": {
                    "maximum": ConvexInt64(2**63 - 1),
                    "bytes": b"\x00\xff",
                    "negativeZero": -0.0,
                },
                **state["override"],
            }
            payload = json.dumps(
                state.get("wireEnvelope", {"status": "success", "value": strict_convex_to_json(value)}),
                allow_nan=False,
            ).encode()
            self.send_response(state.get("httpStatus", 403 if state["mode"] == "authorization" else 200))
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            try:
                self.wfile.write(payload)
            except (BrokenPipeError, ConnectionResetError):
                pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever)
    thread.start()
    try:
        yield "http://127.0.0.1:" + str(server.server_port), state
    finally:
        state["stop"].set()
        server.shutdown()
        server.server_close()
        thread.join(2)
        assert not thread.is_alive()


METHODS = dict(
    zip(
        ERASURE_OPERATIONS,
        (
            "discover_page",
            "check_record",
            "check_binary_references",
            "verify_page",
            "get_receipt_page",
            "erase_record",
            "purge_expired_receipts_page",
        ),
    )
)


@pytest.mark.asyncio
@pytest.mark.parametrize("operation", ERASURE_OPERATIONS)
async def test_exact_seven_functions_official_codec_and_closed_resources(
    listener, operation
):
    url, state = listener
    transport = create_erasure_transport(url=url, deployment_key="controlled-key")
    validate_erasure_transport(transport)
    value = await getattr(transport, METHODS[operation])(request(operation))
    assert value["codecControl"]["maximum"] == ConvexInt64(2**63 - 1)
    assert value["codecControl"]["bytes"] == b"\x00\xff"
    assert transport._job is None
    assert len(state["requests"]) == 1
    path, authorized, body = state["requests"][0]
    assert path == "/api/function" and authorized
    assert body["path"] == "domainErasure:" + operation
    assert body["format"] == "convex_encoded_json"
    transport.close()
    with pytest.raises(DomainErasureError, match="ERASURE_TRANSPORT_BUSY"):
        await getattr(transport, METHODS[operation])(request(operation))
    assert len(state["requests"]) == 1


@pytest.mark.parametrize(
    "domain",
    [
        {"kind": "user", "userId": "u"},
        {
            "kind": "space",
            "memorySpaceId": "space",
            "tenantId": "A",
            "rootDocumentId": "physical",
        },
    ],
)
def test_exact_supported_domain(domain):
    validate_erasure_domain(domain)


@pytest.mark.parametrize(
    "domain",
    [
        {"kind": "user", "userId": "u", "tenantId": None},
        {"kind": "user", "userId": "u", "memorySpaceId": "space"},
        {"kind": "space", "memorySpaceId": ""},
        {"kind": "tenant", "userId": "u"},
        {"kind": "user", "userId": "u", "admin": True},
    ],
)
def test_contradictory_scope_and_caller_authority_refused(domain):
    with pytest.raises(DomainErasureError, match="ERASURE_PROTOCOL"):
        validate_erasure_domain(domain)


@pytest.mark.parametrize(
    "url,key",
    [
        ("file:///tmp/x", "x"),
        ("http://user:pass@localhost", "x"),
        ("http://localhost/path", "x"),
        ("http://localhost?key=x", "x"),
        ("http://localhost", ""),
        ("http://localhost:0", "x"),
    ],
)
def test_explicit_target_and_key_required(url, key):
    with pytest.raises(DomainErasureError, match="ERASURE_TRANSPORT_REQUIRED"):
        create_erasure_transport(url=url, deployment_key=key)


def test_export_capability_cannot_be_used_for_erasure():
    export = UserExportTransport("http://127.0.0.1", "controlled-key")
    with pytest.raises(DomainErasureError, match="ERASURE_TRANSPORT_REQUIRED"):
        validate_erasure_transport(export)


@pytest.mark.parametrize("api_type", [UsersAPI, MemorySpacesAPI])
def test_factory_reachable_from_both_existing_namespaces_without_user_identity_change(api_type):
    client = object()
    api = api_type(client)
    transport = api.create_erasure_transport(url="http://127.0.0.1", deployment_key="controlled-key")
    validate_erasure_transport(transport)
    assert api.client is client and api._auth_context is None
    with pytest.raises(DomainErasureError, match="ERASURE_TRANSPORT_REQUIRED"):
        api.create_erasure_transport(url="http://127.0.0.1/path", deployment_key="controlled-key")
    transport.close()


@pytest.mark.asyncio
async def test_extra_endpoint_wrong_table_and_malformed_range_no_network(listener):
    url, state = listener
    transport = create_erasure_transport(url=url, deployment_key="controlled-key")
    for extra in [
        {"function": "arbitrary"},
        {"table": "private"},
        {"numItems": True},
        {"numItems": 129},
        {"cursor": 8},
    ]:
        with pytest.raises(DomainErasureError, match="ERASURE_PROTOCOL"):
            await transport.discover_page({**request("discoverPage"), **extra})
    assert state["requests"] == [] and transport._job is None
    transport.close()


@pytest.mark.asyncio
async def test_authorization_refusal_known_no_success_or_retry(listener):
    url, state = listener
    state["mode"] = "authorization"
    transport = create_erasure_transport(url=url, deployment_key="controlled-key")
    with pytest.raises(DomainErasureError) as failure:
        await transport.erase_record(request("eraseRecord"))
    assert (
        failure.value.code == "ERASURE_AUTHORIZATION"
        and not failure.value.unknown_outcome
    )
    assert len(state["requests"]) == 1 and transport._job is None
    assert "controlled-key" not in str(failure.value)
    transport.close()


@pytest.mark.asyncio
async def test_lost_mutation_response_unknown_one_send_not_retried(listener):
    url, state = listener
    state["mode"] = "lost"
    transport = create_erasure_transport(url=url, deployment_key="controlled-key")
    with pytest.raises(DomainErasureError) as failure:
        await transport.erase_record(request("eraseRecord"))
    assert (
        failure.value.code == "ERASURE_RESPONSE_UNKNOWN"
        and failure.value.unknown_outcome
    )
    assert len(state["requests"]) == 1 and transport._job is None
    transport.close()


@pytest.mark.asyncio
async def test_cancel_inflight_owned_connection_and_worker_are_joined(listener):
    url, state = listener
    state["mode"] = "stall"
    transport = create_erasure_transport(url=url, deployment_key="controlled-key")
    cancel = asyncio.Event()
    task = asyncio.create_task(
        transport.erase_record(request("eraseRecord"), cancel_event=cancel)
    )
    for _ in range(100):
        if state["entered"].is_set():
            break
        await asyncio.sleep(0.01)
    assert state["entered"].is_set()
    cancel.set()
    with pytest.raises(DomainErasureError) as failure:
        await asyncio.wait_for(task, 2)
    assert failure.value.code == "ERASURE_CANCELLED" and failure.value.unknown_outcome
    assert transport._job is None and state["peer_closed"].wait(1)
    assert len(state["requests"]) == 1
    assert not any(t.name.startswith("cortex-erasure") for t in threading.enumerate())
    transport.close()


@pytest.mark.asyncio
async def test_wrong_response_domain_refused_after_single_read(listener):
    url, state = listener
    state["override"] = {"domain": {"kind": "user", "userId": "foreign"}}
    transport = create_erasure_transport(url=url, deployment_key="controlled-key")
    with pytest.raises(DomainErasureError, match="ERASURE_PROTOCOL"):
        await transport.discover_page(request("discoverPage"))
    assert len(state["requests"]) == 1 and transport._job is None
    transport.close()

# Orchestration controls exercise actual public namespace and fixed kernel bodies.
from copy import deepcopy
from unittest.mock import AsyncMock, patch

from cortex.types import (
    AuthContext,
    DeleteMemorySpaceOptions,
    DeleteUserOptions,
    ListUsersFilter,
)
from cortex.users.erasure import (
    discover_erasure,
    erasure_control_digest,
    execute_erasure,
    order_erasure,
    prepare_erasure,
)
from cortex.users.export import DOMAINS
from cortex.users.validators import UserValidationError


def projection(table, id_, action="delete", dependencies=None, **extra):
    return {"table": table, "id": id_, "fingerprint": FP, "action": action,
            "dependencies": dependencies or [], "retainedVersions": 0, "messages": 0,
            "serializedBytes": 17, "storageIds": [], **extra}


class ControlledTransport:
    kind = "cortex-erasure-v1"
    protocol_version = 1
    operations = ERASURE_OPERATIONS

    def __init__(self, rows):
        self.rows = deepcopy(rows)
        self.calls = []
        self.fail = None
        self.lost = None
        self.receipts = {}
        self.unknown_page = False
        self.verify_extra = None
        self.corrupt_outcome = None

    def envelope(self, request, **data):
        return {"protocolVersion": 1, "observationTime": 1, "domain": request["domain"], **data}

    async def discover_page(self, request, **kwargs):
        self.calls.append(("discover", deepcopy(request)))
        rows = self.rows.get(request["domain"].get("userId", "space"), [])
        return self.envelope(request, table=request["table"], page=[r for r in rows if r["table"] == request["table"]], continueCursor="end", isDone=True)

    async def verify_page(self, request, **kwargs):
        result = await self.discover_page(request, **kwargs)
        if self.verify_extra and self.verify_extra["table"] == request["table"]:
            result["page"].append(deepcopy(self.verify_extra))
        return result

    async def check_record(self, request, **kwargs):
        self.calls.append(("check", deepcopy(request)))
        rows = self.rows.get(request["domain"].get("userId", "space"), [])
        return self.envelope(request, record=next((r for r in rows if r["id"] == request["id"]), None))

    async def check_binary_references(self, request, **kwargs):
        self.calls.append(("binary", deepcopy(request)))
        return self.envelope(request, blobs=[])

    async def erase_record(self, request, **kwargs):
        self.calls.append(("erase", deepcopy(request)))
        if request["id"] == self.fail:
            raise DomainErasureError("ERASURE_NATIVE_REFUSED", "eraseRecord")
        rows = self.rows[request["domain"].get("userId", "space")]
        row = next(r for r in rows if r["id"] == request["id"])
        assert request["domainDigest"] == erasure_control_digest(request["domain"])
        assert request["requestDigest"] == erasure_control_digest({k: v for k, v in request.items() if k != "requestDigest"})
        rows.remove(row)
        outcome = self.envelope(request, operationId=request["operationId"], itemKey=request["itemKey"],
                                table=row["table"], id=row["id"], state="committed", deleted=int(row["action"] != "detach"),
                                detached=int(row["action"] == "detach"), retainedVersions=row["retainedVersions"],
                                messages=row["messages"], serializedBytes=row["serializedBytes"], blobs=[], graphJobs=[])
        if self.corrupt_outcome:
            outcome.update(self.corrupt_outcome)
        self.receipts[request["itemKey"]] = outcome
        if request["id"] == self.lost:
            raise DomainErasureError("ERASURE_RESPONSE_UNKNOWN", "eraseRecord", unknown_outcome=True)
        return outcome

    async def get_receipt_page(self, request, **kwargs):
        self.calls.append(("receipt", deepcopy(request)))
        return self.envelope(request, page=[] if self.unknown_page else [self.receipts[request["itemKey"]]], continueCursor="end", isDone=True)

    async def purge_expired_receipts_page(self, request, **kwargs):
        return {"protocolVersion": 1, "deleted": 0, "continueCursor": "end", "isDone": True}

    def close(self):
        pass


def options(transport, **kwargs):
    return DeleteUserOptions(cascade=True, erasure_transport=transport, **kwargs)


@pytest.mark.asyncio
async def test_complete_domain_commit_counts_and_root_last():
    rows = [projection("immutable", "root", "root"), projection("facts", "fact", retainedVersions=3),
            projection("memorySpaces", "member", "detach"), projection("conversations", "conversation", messages=4),
            projection("agents", "foreign", "preserve")]
    transport = ControlledTransport({"controlled-user": rows})
    api = UsersAPI(AsyncMock())
    result = await api.delete("controlled-user", options(transport))
    assert result.total_deleted == 3 and result.conversation_messages_deleted == 4
    assert result.erasure.per_table["memorySpaces"]["detached"] == 1
    assert result.erasure.per_table["facts"]["retainedVersions"] == 3
    assert result.erasure.per_table["agents"]["preserved"] == 1
    assert result.verification.complete and result.erasure.complete
    assert not result.erasure.full_user_data_erased
    erases = [r["id"] for name, r in transport.calls if name == "erase"]
    assert erases[-2:] == ["member", "root"]
    first = next(i for i, (name, _) in enumerate(transport.calls) if name == "erase")
    assert {r["table"] for name, r in transport.calls[:first] if name == "discover"} == set(DOMAINS)
    assert sum(name == "check" for name, _ in transport.calls[:first]) == 4
    api.client.mutation.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("verify,dry_run", [(False, False), (True, True)])
async def test_no_false_verification_or_dryrun_counts(verify, dry_run):
    transport = ControlledTransport({"controlled-user": [projection("facts", "fact")]})
    result = await UsersAPI(AsyncMock()).delete("controlled-user", options(transport, verify=verify, dry_run=dry_run))
    assert result.total_deleted == (0 if dry_run else 1)
    assert not result.verification.complete and not result.erasure.complete
    assert result.erasure.verification["state"] == ("notExecuted" if dry_run else "notRequested")
    assert sum(n == "erase" for n, _ in transport.calls) == (0 if dry_run else 1)


@pytest.mark.asyncio
async def test_bulk_later_user_blocker_precedes_every_write():
    transport = ControlledTransport({"a": [projection("facts", "a-fact")], "b": [projection("contexts", "b-context", "block")]})
    with pytest.raises(DomainErasureError, match="ERASURE_PREFLIGHT_BLOCKED"):
        await UsersAPI(AsyncMock()).delete_many(["a", "b"], {"cascade": True, "erasure_transport": transport})
    assert not any(n == "erase" for n, _ in transport.calls)
    assert transport.rows["a"][0]["id"] == "a-fact"


@pytest.mark.asyncio
async def test_partial_bulk_retains_prior_commits_and_unstarted_no_rollback():
    transport = ControlledTransport({"a": [projection("facts", "a")], "b": [projection("facts", "b")], "c": [projection("facts", "c")]})
    transport.fail = "b"
    client = AsyncMock()
    with pytest.raises(DomainErasureError) as failure:
        await UsersAPI(client).delete_many(["a", "b", "c"], {"cascade": True, "erasure_transport": transport})
    assert failure.value.deleted == 1 and failure.value.user_ids == ["a"]
    assert failure.value.unstarted == ["b", "c"]
    assert failure.value.receipt.total_deleted == 0
    assert [r["id"] for n, r in transport.calls if n == "erase"] == ["a", "b"]
    client.mutation.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("found", [True, False])
async def test_lost_response_original_receipt_only_without_resend(found):
    transport = ControlledTransport({"controlled-user": [projection("facts", "fact")]})
    transport.lost, transport.unknown_page = "fact", not found
    if found:
        result = await UsersAPI(AsyncMock()).delete("controlled-user", options(transport))
        assert result.total_deleted == 1 and result.erasure.unknown == []
    else:
        with pytest.raises(DomainErasureError) as failure:
            await UsersAPI(AsyncMock()).delete("controlled-user", options(transport))
        assert failure.value.receipt.unknown == ["fact"] and failure.value.receipt.total_deleted == 0
    assert sum(n == "erase" for n, _ in transport.calls) == 1
    assert sum(n == "receipt" for n, _ in transport.calls) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("corruption", [{"deleted": True}, {"deleted": 2}, {"messages": -1}, {"state": "alreadyAbsent", "deleted": 1}])
async def test_malformed_outcome_never_becomes_committed_count(corruption):
    transport = ControlledTransport({"controlled-user": [projection("facts", "fact")]})
    transport.corrupt_outcome = corruption
    with pytest.raises(DomainErasureError) as failure:
        await UsersAPI(AsyncMock()).delete("controlled-user", options(transport))
    assert failure.value.receipt.total_deleted == 0 and failure.value.receipt.outcomes == []
    assert failure.value.receipt.remaining == ["fact"]


@pytest.mark.asyncio
async def test_root_retained_when_rolling_closure_finds_new_child():
    transport = ControlledTransport({"controlled-user": [projection("facts", "fact"), projection("immutable", "root", "root")]})
    transport.verify_extra = projection("contexts", "new-child")
    with pytest.raises(DomainErasureError, match="ERASURE_REMAINING_PRIMARY") as failure:
        await UsersAPI(AsyncMock()).delete("controlled-user", options(transport))
    assert failure.value.receipt.total_deleted == 1
    assert [r["id"] for n, r in transport.calls if n == "erase"] == ["fact"]
    assert transport.rows["controlled-user"][0]["id"] == "root"


@pytest.mark.asyncio
async def test_split_provisional_rows_are_discarded_children_and_tail_exhausted():
    transport = ControlledTransport({})
    seen = []
    async def pages(req, **kwargs):
        if req["table"] != "facts":
            return transport.envelope(req, table=req["table"], page=[], continueCursor="end", isDone=True)
        seen.append((req["cursor"], req["endCursor"]))
        if req["cursor"] is None and req["endCursor"] is None:
            return transport.envelope(req, table="facts", page=[projection("facts", "discard")], continueCursor="tail", isDone=False, pageStatus="SplitRequired", splitCursor="mid")
        marker = { (None, "mid"): "first", ("mid", "tail"): "second", ("tail", None): "last" }[(req["cursor"],req["endCursor"])]
        return transport.envelope(req, table="facts", page=[projection("facts", marker)], continueCursor="end", isDone=True)
    transport.discover_page = pages
    result = await discover_erasure(DOMAIN, transport, options(transport))
    assert [r["id"] for r in result] == ["first", "second", "last"]
    assert seen == [(None, None), (None, "mid"), ("mid", "tail"), ("tail", None)]


def test_hard_dag_data_cycle_and_detach_root_order():
    a = projection("facts", "a", dependencies=[{"id": "b", "kind": "hard"}])
    b = projection("facts", "b", dependencies=[{"id": "a", "kind": "data"}])
    root = projection("immutable", "root", "root")
    assert [r["id"] for r in order_erasure([root, b, a])] == ["a", "b", "root"]
    b["dependencies"][0]["kind"] = "hard"
    with pytest.raises(DomainErasureError, match="ERASURE_DEPENDENCY_CYCLE"):
        order_erasure([a, b])
    a["dependencies"][0]["kind"] = b["dependencies"][0]["kind"] = "data"
    assert [r["id"] for r in order_erasure([b, a])] == ["a", "b"]


@pytest.mark.asyncio
async def test_scope_conflict_capability_cancel_and_queue_guard_before_effect():
    transport = ControlledTransport({"controlled-user": [projection("facts", "fact", managedQueueCount=1)]})
    client = AsyncMock()
    api = UsersAPI(client, auth_context=AuthContext(user_id="controlled-user", tenant_id="tenant-a"))
    with pytest.raises(UserValidationError, match="conflicts"):
        await api.delete("controlled-user", options(transport, tenant_id="tenant-b"))
    assert transport.calls == []
    with pytest.raises(DomainErasureError, match="ERASURE_TRANSPORT_REQUIRED"):
        await api.delete("controlled-user", DeleteUserOptions(cascade=True, dry_run=True))
    event = asyncio.Event(); event.set()
    with pytest.raises(DomainErasureError, match="ERASURE_CANCELLED"):
        await api.delete("controlled-user", options(transport, cancel_event=event))
    assert transport.calls == []
    with pytest.raises(DomainErasureError, match="ERASURE_GRAPH_PARTICIPANT_REQUIRED"):
        await api.delete("controlled-user", options(transport))
    assert not any(n == "erase" for n, _ in transport.calls)
    client.mutation.assert_not_called()


@pytest.mark.asyncio
async def test_space_same_complete_domain_transport_and_commit_only_estimate():
    transport = ControlledTransport({"space": [projection("memorySpaces", "root", "root"), projection("facts", "fact")]})
    client = AsyncMock()
    result = await MemorySpacesAPI(client).delete("controlled-space", DeleteMemorySpaceOptions(
        cascade=True, reason="controlled-erasure", erasure_transport=transport))
    assert result.deleted and result.cascade.facts_deleted == 1
    assert result.cascade.total_bytes == 34 and result.total_bytes_kind == "serializedDocumentEstimate"
    assert result.erasure.domain == {"kind": "space", "memorySpaceId": "controlled-space"}
    assert result.erasure.verification["complete"]
    client.mutation.assert_not_called()


@pytest.mark.asyncio
async def test_bulk_filtered_selection_exhausts_pages_not_original_default_limit():
    transport = ControlledTransport({"a": [], "b": []})
    client = AsyncMock()
    api = UsersAPI(client)
    def profile(id_):
        return {"id": id_, "data": {}, "version": 1, "createdAt": 1, "updatedAt": 1}
    client.query.side_effect = [{"entries": [profile("a")], "hasMore": True}, {"entries": [profile("b")], "hasMore": False}]
    result = await api.delete_many(ListUsersFilter(limit=1), {"cascade": True, "erasure_transport": transport, "dry_run": True})
    assert result["user_ids"] == ["a", "b"] and result["deleted"] == 0 and not result["complete"]
    assert [call.args[1]["offset"] for call in client.query.call_args_list] == [0, 500]
    assert all(call.args[1]["limit"] == 500 for call in client.query.call_args_list)
    assert not any(n == "erase" for n, _ in transport.calls)


@pytest.mark.asyncio
async def test_actual_async_task_cancel_joins_transport_before_unknown_refusal(listener):
    url, state = listener
    state["mode"] = "stall"
    transport = create_erasure_transport(url=url, deployment_key="controlled-key")
    task = asyncio.create_task(transport.erase_record(request("eraseRecord")))
    await asyncio.to_thread(state["entered"].wait, 2)
    task.cancel()
    with pytest.raises(DomainErasureError) as failure:
        await task
    assert failure.value.code == "ERASURE_CANCELLED" and failure.value.unknown_outcome
    assert transport._job is None and state["peer_closed"].wait(2)
    assert not any(t.name.startswith("cortex-erasure") for t in threading.enumerate())
    transport.close()


@pytest.mark.parametrize("index", [0, 1, 2])
def test_official_node_canonical_domain_and_request_fixtures(index):
    from pathlib import Path
    fixture = json.loads((Path(__file__).parents[3] / "tests/fixtures/domain-erasure-v1.json").read_text())
    case = fixture["cases"][index]
    assert erasure_control_digest(case["domain"]) == case["domainDigest"]
    assert erasure_control_digest(case["request"]) == case["requestDigest"]
    with pytest.raises(DomainErasureError):
        erasure_control_digest({"numericPayload": 1.5})


@pytest.mark.asyncio
async def test_purge_real_wire_envelope_does_not_require_domain_or_observation(listener):
    url, state = listener
    state["override"] = {"observationTime": None}
    transport = create_erasure_transport(url=url, deployment_key="controlled-key")
    result = await transport.purge_expired_receipts_page(request("purgeExpiredReceiptsPage"))
    assert result["protocolVersion"] == 1 and transport._job is None
    transport.close()


@pytest.mark.asyncio
async def test_check_drift_refuses_before_any_primary_send():
    transport = ControlledTransport({"controlled-user": [projection("facts", "fact")]})
    original = transport.check_record
    async def changed(request, **kwargs):
        value = deepcopy(await original(request, **kwargs)); value["record"]["fingerprint"] = "2" * 64
        return value
    transport.check_record = changed
    with pytest.raises(DomainErasureError, match="ERASURE_SELECTION_CHANGED"):
        await UsersAPI(AsyncMock()).delete("controlled-user", options(transport))
    assert not any(n == "erase" for n, _ in transport.calls)


@pytest.mark.asyncio
async def test_nonadvancing_discovery_refuses_without_false_complete():
    transport = ControlledTransport({})
    async def repeated(request, **kwargs):
        return transport.envelope(request, table=request["table"], page=[], continueCursor="same", isDone=False)
    transport.discover_page = repeated
    with pytest.raises(DomainErasureError, match="ERASURE_PAGE_NONPROGRESS"):
        await prepare_erasure(DOMAIN, options(transport))
    assert not any(n == "erase" for n, _ in transport.calls)


@pytest.mark.asyncio
@pytest.mark.parametrize("blocked", [False, True])
async def test_graph_all_item_preflight_before_primary_original_jobs_only(blocked):
    from dataclasses import asdict
    from types import SimpleNamespace

    from cortex.graph.erasure import PreparedGraphErasureItem
    from cortex.graph.errors import GraphDatabaseError
    from cortex.graph.identity import primary_graph_identity
    from cortex.types import ErasureGraphParticipant, GraphScope
    identity = primary_graph_identity("Fact", "fact", GraphScope(True, None, "controlled-space"))
    wire_identity = {"tenantKnown": True, "tenantId": None, "memorySpaceId": "controlled-space", "schemaVersion": 2,
                     "kind": "Fact", "physicalSourceId": "fact", "key": identity.key, "tupleJson": identity.tuple_json}
    item = {"identity": wire_identity, "sourceRevision": 1, "ownershipRevision": 1,
            "referenceGeneration": "generation", "referenceRevision": 1,
            "evidence": {"targetId": "target", "generation": "generation", "physicalSourceId": "fact", "scopeKnown": True}}
    transport = ControlledTransport({"controlled-user": [projection("facts", "fact", graph=item)]})
    jobs = [{"id": "original-job", "generation": "generation", "identity": wire_identity, "sourceRevision": 2}]
    transport.corrupt_outcome = {"graphJobs": jobs}
    adapter, disposal = object(), object()
    participant = ErasureGraphParticipant(adapter, disposal)
    client = AsyncMock()
    async def preflight(items, **kwargs):
        assert not any(n == "erase" for n, _ in transport.calls)
        assert kwargs == {"adapter": adapter, "disposal_transport": disposal}
        assert asdict(items[0].identity) == asdict(identity)
        if blocked:
            raise GraphDatabaseError("Blocked fixture", "GRAPH_ERASURE_BLOCKED")
        return [PreparedGraphErasureItem(items[0], adapter, disposal)]
    async def deliver(prepared, **kwargs):
        assert [n for n, _ in transport.calls].count("erase") == 1
        assert kwargs["client"] is client and kwargs["jobs"][0].id == "original-job"
        return SimpleNamespace(nodes_deleted=1)
    async def verify(items, **kwargs):
        assert len(items) == 1 and kwargs["jobs"][0].id == "original-job"
        return {"complete": True}
    with patch("cortex.graph.erasure.prepare_graph_erasure", side_effect=preflight), patch("cortex.graph.erasure.erase_graph_item", side_effect=deliver), patch("cortex.graph.erasure.verify_graph_erasure", side_effect=verify):
        if blocked:
            with pytest.raises(DomainErasureError, match="ERASURE_PREFLIGHT_FAILED"):
                await UsersAPI(client, graph_adapter=adapter).delete("controlled-user", options(transport, graph_participant=participant))
            assert not any(n == "erase" for n, _ in transport.calls)
        else:
            result = await UsersAPI(client, graph_adapter=adapter).delete("controlled-user", options(transport, graph_participant=participant))
            assert result.graph_nodes_deleted == 1 and result.erasure.graph["state"] == "complete"
            assert result.erasure.graph["jobs"] == jobs and result.total_deleted == 1
    client.mutation.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("status,envelope,unknown", [
    (200, {"status": "error", "errorData": {"code": "ERASURE_BLOCKED"}}, False),
    (560, {"status": "error", "errorMessage": "Controlled native refusal"}, False),
    (200, {}, True),
])
async def test_complete_native_refusal_vs_incomplete_mutation_response(listener, status, envelope, unknown):
    url, state = listener
    state["wireEnvelope"], state["httpStatus"] = envelope, status
    transport = create_erasure_transport(url=url, deployment_key="controlled-key")
    with pytest.raises(DomainErasureError) as failure:
        await transport.erase_record(request("eraseRecord"))
    assert failure.value.unknown_outcome is unknown
    assert len(state["requests"]) == 1 and transport._job is None
    assert failure.value.code == ("ERASURE_BLOCKED" if status == 200 and not unknown else "ERASURE_RESPONSE_UNKNOWN" if unknown else "ERASURE_NATIVE_REFUSED")
    transport.close()
