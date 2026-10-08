"""Task16A protocol and real owned-resource boundaries; no export eligibility claim."""

import asyncio
import base64
import hashlib
import json
import math
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from convex.values import ConvexInt64, strict_convex_to_json

from cortex.users import UsersAPI
from cortex.users import export as module
from cortex.users.export import UserExportTransport, UserExportTransportError

IDENTITY = {"userId": "task16a-python-unit", "scope": {"kind": "tenantless"}}
NODE = {"domain": "immutable", "id": "unit-id"}
FP = "1" * 64


@pytest.fixture
def listener():
    state = {
        "mode": "normal",
        "requests": [],
        "closed": threading.Event(),
        "entered": threading.Event(),
        "stop": threading.Event(),
        "override": {},
        "fileData": b"\x00\xff" * 100000,
        "fileHash": None,
        "gets": [],
    }

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            state["requests"].append({**body, "auth": self.headers["Authorization"]})
            state["entered"].set()
            if state["mode"] in ("stall", "stream"):
                if state["mode"] == "stream":
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b'{"status":"success","value":')
                    self.wfile.flush()
                self.connection.settimeout(0.05)
                while not state["stop"].is_set():
                    try:
                        if self.connection.recv(1) == b"":
                            state["closed"].set()
                            return
                    except socket.timeout:
                        continue
                    except OSError:
                        state["closed"].set()
                        return
                return
            v = {
                **IDENTITY,
                "protocolVersion": 1,
                "observationTime": 1,
                "kind": "inspect",
                "capability": "transport-only",
                "profile": None,
                "supportedDomains": list(module.DOMAINS),
                **state["override"],
            }
            if body["path"].endswith(":readNode"):
                v = {
                    **IDENTITY,
                    "protocolVersion": 1,
                    "observationTime": 1,
                    "kind": "node",
                    "node": NODE,
                    "fingerprint": FP,
                    "disposition": "record",
                    "record": {
                        "_id": NODE["id"],
                        "_creationTime": 2,
                        "maximum": ConvexInt64(2**63 - 1),
                        "bytes": b"\x00\xff",
                        "negativeZero": -0.0,
                        "nan": float("nan"),
                    },
                }
            if body["path"].endswith(":resolveFile"):
                v = {
                    **IDENTITY,
                    "protocolVersion": 1,
                    "observationTime": 1,
                    "kind": "file",
                    "node": body["args"]["node"],
                    "fingerprint": FP,
                    "file": {
                        "storageId": "owned-storage",
                        "url": "http://127.0.0.1:"
                        + str(server.server_port)
                        + "/owned?transient=secret",
                        "size": len(state["fileData"]),
                        "mimeType": "application/octet-stream",
                        "sha256": state["fileHash"]
                        or hashlib.sha256(state["fileData"]).hexdigest(),
                    },
                }
            payload = (
                b"x" * (9 * 1024 * 1024)
                if state["mode"] == "large"
                else json.dumps(
                    {"status": "success", "value": strict_convex_to_json(v)},
                    allow_nan=False,
                ).encode()
            )
            self.send_response(200)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            try:
                self.wfile.write(payload)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_GET(self):
            state["gets"].append(
                {"path": self.path, "auth": self.headers.get("Authorization")}
            )
            state["entered"].set()
            if state["mode"] == "binary-redirect":
                self.send_response(302)
                self.send_header("Location", "/redirect-target")
                self.end_headers()
                return
            if state["mode"] != "binary-stall":
                self.send_response(200)
                self.send_header("Content-Length", str(len(state["fileData"])))
                self.end_headers()
                if state["mode"] != "binary-partial":
                    try:
                        self.wfile.write(state["fileData"])
                    except (BrokenPipeError, ConnectionResetError):
                        state["closed"].set()
                    return
                self.wfile.write(state["fileData"][:65536])
                self.wfile.flush()
            self.connection.settimeout(0.05)
            while not state["stop"].is_set():
                try:
                    if self.connection.recv(1) == b"":
                        state["closed"].set()
                        return
                except socket.timeout:
                    continue
                except OSError:
                    state["closed"].set()
                    return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever)
    worker.start()
    yield "http://127.0.0.1:" + str(server.server_port), state
    state["stop"].set()
    server.shutdown()
    server.server_close()
    worker.join()


def no_workers():
    assert not [
        t for t in threading.enumerate() if t.name.startswith("cortex-user-export-")
    ]


@pytest.mark.asyncio
async def test_reachable_factory_native_path_raw_values_no_identity_mutation(listener):
    url, state = listener
    api = UsersAPI(object())
    t = api.create_export_transport(url=url, deployment_key="task16a-python-key")
    assert (await t.inspect(IDENTITY))["capability"] == "transport-only"
    record = (await t.read_node({**IDENTITY, "node": NODE, "expectedFingerprint": FP}))[
        "record"
    ]
    assert strict_convex_to_json(record) == strict_convex_to_json(
        {
            "_id": NODE["id"],
            "_creationTime": 2,
            "maximum": ConvexInt64(2**63 - 1),
            "bytes": b"\x00\xff",
            "negativeZero": -0.0,
            "nan": float("nan"),
        }
    )
    assert [r["path"] for r in state["requests"]] == [
        "userExport:inspect",
        "userExport:readNode",
    ]
    assert all(r["auth"] == "Convex task16a-python-key" for r in state["requests"])
    assert not hasattr(t, "function")
    no_workers()


@pytest.mark.asyncio
async def test_scope_protocol_and_raw_selector_refusal_before_transport(listener):
    url, state = listener
    with pytest.raises(UserExportTransportError, match="EXPORT_PROTOCOL"):
        UserExportTransport(url, "")
    t = UserExportTransport(url, "secret-not-in-errors")
    for req in [
        {**IDENTITY, "function": "admin:clearAll"},
        {**IDENTITY, "scope": {"kind": "tenant", "tenantId": " "}},
    ]:
        with pytest.raises(UserExportTransportError, match="EXPORT_PROTOCOL"):
            await t.inspect(req)
    assert state["requests"] == []
    for override in [
        {"userId": "foreign"},
        {"scope": {"kind": "tenant", "tenantId": "foreign"}},
        {"protocolVersion": True},
        {"protocolVersion": 2},
    ]:
        state["override"] = override
        with pytest.raises(UserExportTransportError, match="EXPORT_PROTOCOL"):
            await t.inspect(IDENTITY)
    no_workers()


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["stall", "stream"])
async def test_cancel_closes_owned_response_socket_and_joins_worker(listener, mode):
    url, state = listener
    state["mode"] = mode
    task = asyncio.create_task(
        UserExportTransport(url, "secret", timeout=0.5, socket_timeout=0.2).inspect(
            IDENTITY
        )
    )
    while not state["entered"].is_set():
        await asyncio.sleep(0.01)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    for _ in range(50):
        if state["closed"].is_set():
            break
        await asyncio.sleep(0.01)
    assert state["closed"].is_set()
    no_workers()


@pytest.mark.asyncio
async def test_absolute_deadline_stops_slow_header_and_response_worker(listener):
    url, state = listener
    state["mode"] = "stall"
    start = time.monotonic()
    with pytest.raises(UserExportTransportError, match="EXPORT_DEADLINE"):
        await UserExportTransport(
            url, "secret", timeout=0.1, socket_timeout=0.5
        ).inspect(IDENTITY)
    assert time.monotonic() - start < 1
    no_workers()


@pytest.mark.asyncio
@pytest.mark.parametrize("cancel", [False, True])
async def test_blocked_credential_free_dns_child_terminated_and_joined(
    monkeypatch, cancel
):
    children = []
    original = subprocess.Popen

    def spawn(argv, **kwargs):
        assert argv[:3] == [sys.executable, "-I", "-c"]
        assert kwargs["shell"] is False and set(kwargs["env"]) == {
            "PYTHONIOENCODING",
            "PYTHONNOUSERSITE",
        }
        assert "secret" not in repr(argv) + repr(kwargs)
        p = original([*argv[:3], "import time;time.sleep(60)"], **kwargs)
        children.append(p)
        return p

    monkeypatch.setattr(module.subprocess, "Popen", spawn)
    task = asyncio.create_task(
        UserExportTransport(
            "http://localhost:45410", "secret", timeout=0.15, socket_timeout=0.2
        ).inspect(IDENTITY)
    )
    if cancel:
        while not children:
            await asyncio.sleep(0.01)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
    else:
        with pytest.raises(UserExportTransportError, match="EXPORT_DEADLINE"):
            await task
    assert children and all(p.poll() is not None for p in children)
    no_workers()


@pytest.mark.asyncio
async def test_blocked_connect_real_socket_closed_and_worker_joined(monkeypatch):
    entered, sockets = threading.Event(), []

    def connect(sock, address):
        sockets.append(sock)
        entered.set()
        end = time.monotonic() + 0.5
        while sock.fileno() != -1 and time.monotonic() < end:
            time.sleep(0.01)
        raise OSError("owned simulated blocked connect")

    monkeypatch.setattr(module.socket.socket, "connect", connect)
    task = asyncio.create_task(
        UserExportTransport(
            "http://127.0.0.1:45410", "secret", timeout=1, socket_timeout=0.2
        ).inspect(IDENTITY)
    )
    while not entered.is_set():
        await asyncio.sleep(0.01)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert sockets and all(s.fileno() == -1 for s in sockets)
    no_workers()


@pytest.mark.asyncio
async def test_bounded_response_and_request_leave_no_worker(listener):
    url, state = listener
    t = UserExportTransport(url, "secret")
    with pytest.raises(UserExportTransportError, match="EXPORT_REQUEST_TOO_LARGE"):
        await t.inspect({**IDENTITY, "userId": "x" * 70000})
    assert state["requests"] == []
    state["mode"] = "large"
    with pytest.raises(UserExportTransportError, match="EXPORT_RESPONSE_TOO_LARGE"):
        await t.inspect(IDENTITY)
    no_workers()


# 16B closure selection is independent from payload/file release.
def projected(domain, identity, root=False):
    return {
        "node": {"domain": domain, "id": identity},
        "fingerprint": FP,
        "logicalId": identity,
        "disposition": "root" if root else "unownedCandidate",
        "edgeDescriptors": [],
        **({"rootReason": "scopedProfile"} if identity == "profile" else {}),
    }


class ProjectionTransport:
    def __init__(self, records):
        self.records = records
        self.requests = []
        self.envelope = {**IDENTITY, "protocolVersion": 1, "observationTime": 1}

    async def inspect(self, request):
        return {
            **self.envelope,
            "kind": "inspect",
            "capability": "transport-only",
            "profile": {"domain": "immutable", "id": "profile"},
            "supportedDomains": list(module.DOMAINS),
        }

    async def page(self, request):
        self.requests.append(request)
        return {
            **self.envelope,
            "kind": "page",
            "page": [
                p
                for p in self.records
                if p["node"]["domain"] == request["selection"]["domain"]
                and (
                    p["disposition"] != "unownedCandidate"
                    if request["selection"]["kind"] == "rootProjections"
                    else p["disposition"] == "unownedCandidate"
                )
            ],
            "continueCursor": "terminal",
            "isDone": True,
        }

    async def inspect_edge(self, request):
        raise AssertionError("unexpected edge")

    async def read_node(self, request):
        raise AssertionError("payload remains gated")

    async def resolve_file(self, request):
        raise AssertionError("files remain gated")


@pytest.mark.asyncio
async def test_least_rooted_closure_alternating_chain_cycles_and_foreign_break():
    records = [projected("immutable", "profile", True), projected("facts", "F0", True)]
    parents = {}
    previous = records[1]
    for index in range(1, 21):
        child = projected("memories" if index % 2 else "facts", f"chain-{index}")
        child["edgeDescriptors"] = [
            {
                "ordinal": 0,
                "kind": "link",
                "domain": previous["node"]["domain"],
                "storedLogicalTarget": previous["node"]["id"],
                "purpose": "inclusion",
            }
        ]
        parents[child["node"]["id"]] = previous
        records.append(child)
        previous = child
    disconnected = [projected("facts", "cycle1"), projected("memories", "cycle2")]
    for index, child in enumerate(disconnected):
        parent = disconnected[1 - index]
        child["edgeDescriptors"] = [
            {
                "ordinal": 0,
                "kind": "link",
                "domain": parent["node"]["domain"],
                "storedLogicalTarget": parent["node"]["id"],
                "purpose": "inclusion",
            }
        ]
        parents[child["node"]["id"]] = parent
    records.extend(disconnected)
    broken = projected("facts", "foreignBreak")
    broken["edgeDescriptors"] = [
        {"ordinal": 0, "kind": "link", "domain": "memories", "purpose": "inclusion"}
    ]
    records.extend([broken, projected("facts", "independent", True)])
    t = ProjectionTransport(records)

    async def edge(request):
        foreign = request["node"]["id"] == "foreignBreak"
        return {
            **t.envelope,
            "kind": "edge",
            "witness": {
                "childNode": request["node"],
                "childFingerprint": FP,
                "ordinal": 0,
                "kind": "link",
                "observationTime": 1,
                **(
                    {"status": "foreignOwner"}
                    if foreign
                    else {
                        "status": "admissible",
                        "parentNode": parents[request["node"]["id"]]["node"],
                        "parentFingerprint": FP,
                    }
                ),
            },
        }

    t.inspect_edge = edge
    result = await module.discover_user_export_closure(t, IDENTITY)
    assert {v["projection"]["node"]["id"] for v in result["reachable"]} == {
        "profile",
        "F0",
        "independent",
        *(f"chain-{i}" for i in range(1, 21)),
    }
    assert len(result["witnesses"]) == 20
    assert result["diagnostics"] == []


@pytest.mark.asyncio
@pytest.mark.parametrize("nonempty", [False, True])
@pytest.mark.parametrize("recommendation", ["none", "null", "omitted"])
async def test_native_end_equality_child_preserves_44_id_tail_and_nested_split(
    nonempty,
    recommendation,
):
    records = [
        projected("immutable", "profile", True),
        *(projected("immutable", f"row-{i}", True) for i in range(43)),
    ]
    t = ProjectionTransport(records)
    old = t.page

    async def page(request):
        if request["selection"] != {"domain": "immutable", "kind": "rootProjections"}:
            return await old(request)
        t.requests.append(request)
        key = (request["cursor"], request["endCursor"])

        def answer(rows, cursor, done, status=None, split=None):
            response = {
                **t.envelope,
                "kind": "page",
                "page": rows,
                "continueCursor": cursor,
                "isDone": done,
                **({"pageStatus": status} if status else {}),
                **(
                    {"splitCursor": split}
                    if status and recommendation != "omitted" or split is not None
                    else {}
                ),
            }

            if (
                status == "SplitRecommended"
                and split is None
                and recommendation != "none"
            ):
                assert ("splitCursor" in response) == (recommendation == "null")
            return response

        if key == (None, None):
            return answer(
                [projected("immutable", "discard-provisional", True)],
                "C",
                False,
                "SplitRecommended",
                "B",
            )
        if key == (None, "B"):
            return answer(
                [projected("immutable", "discard-required", True)],
                "B",
                False,
                "SplitRequired",
                "A",
            )
        if key == (None, "A"):
            return answer(
                records[:1] if nonempty else [],
                "A",
                False,
                None if recommendation == "none" else "SplitRecommended",
            )
        if key == ("A", "B"):
            return answer(
                records[1 if nonempty else 0 : 12],
                "B",
                False,
                None if recommendation == "none" else "SplitRecommended",
            )
        if key == ("B", "C"):
            return answer(records[12:27], "C", False)
        if key == ("C", None):
            return answer(records[27:], "end", True)
        raise AssertionError(key)

    t.page = page
    result = await module.discover_user_export_closure(t, IDENTITY)
    assert {v["projection"]["node"]["id"] for v in result["reachable"]} == {
        v["node"]["id"] for v in records
    }
    assert [
        (r["cursor"], r["endCursor"])
        for r in t.requests
        if r["selection"] == {"domain": "immutable", "kind": "rootProjections"}
    ] == [(None, None), (None, "B"), (None, "A"), ("A", "B"), ("B", "C"), ("C", None)]


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["repeat", "cycle", "changed"])
async def test_invalid_repeated_range_or_changed_record_refuses_before_call10(kind):
    t = ProjectionTransport([projected("immutable", "profile", True)])
    calls = 0

    async def page(request):
        nonlocal calls
        calls += 1
        p = projected("immutable", "profile", True)
        p["fingerprint"] = ("1" if calls == 1 else "2") * 64
        return {
            **t.envelope,
            "kind": "page",
            "page": [p] if kind == "changed" else [],
            "continueCursor": (
                (request["cursor"] or "A")
                if kind == "repeat"
                else "A"
                if calls % 2
                else "B"
            ),
            "isDone": False,
        }

    t.page = page
    with pytest.raises(
        UserExportTransportError,
        match="EXPORT_CHANGED" if kind == "changed" else "EXPORT_PROTOCOL",
    ):
        await module.discover_user_export_closure(t, IDENTITY)
    assert calls < 10


@pytest.mark.asyncio
async def test_scope_copy_context_default_collision_and_100001_terminal_pages():
    assert module.resolve_user_export_identity("u")["scope"] == {"kind": "tenantless"}
    assert module.resolve_user_export_identity("u", context_tenant_id="A")["scope"] == {
        "kind": "tenant",
        "tenantId": "A",
    }
    with pytest.raises(UserExportTransportError, match="EXPORT_SCOPE"):
        module.resolve_user_export_identity("u", "B", "A")
    t = ProjectionTransport([projected("immutable", "profile", True)])
    calls = 0
    old = t.page

    async def page(request):
        nonlocal calls
        if request["selection"] != {"domain": "immutable", "kind": "rootProjections"}:
            return await old(request)
        calls += 1
        return {
            **t.envelope,
            "kind": "page",
            "page": (
                [projected("immutable", "profile", True)] if calls == 100001 else []
            ),
            "continueCursor": str(calls),
            "isDone": calls == 100001,
        }

    t.page = page
    result = await module.discover_user_export_closure(t, IDENTITY)
    assert [v["projection"]["node"]["id"] for v in result["reachable"]] == ["profile"]
    assert calls == 100001


@pytest.mark.asyncio
@pytest.mark.parametrize("status", ["missing", "unresolved", "changedParent"])
async def test_physical_deleted_source_no_reused_logical_guess(status):
    history = projected("factHistory", "history", True)
    history["edgeDescriptors"] = [
        {
            "ordinal": 0,
            "kind": "historySourceFact",
            "domain": "facts",
            "purpose": "inclusion",
            "storedDocumentTarget": "deleted-original",
            "storedLogicalTarget": "reused-logical",
        }
    ]
    replacement = projected("facts", "replacement")
    t = ProjectionTransport(
        [projected("immutable", "profile", True), history, replacement]
    )

    async def edge(r):
        return {
            **t.envelope,
            "kind": "edge",
            "witness": {
                "childNode": r["node"],
                "childFingerprint": FP,
                "ordinal": 0,
                "kind": "historySourceFact",
                "observationTime": 1,
                "status": "admissible" if status == "changedParent" else status,
                **(
                    {"parentNode": replacement["node"], "parentFingerprint": "2" * 64}
                    if status == "changedParent"
                    else {}
                ),
            },
        }

    t.inspect_edge = edge
    if status == "missing":
        result = await module.discover_user_export_closure(t, IDENTITY)
        assert [v["projection"]["node"]["id"] for v in result["reachable"]] == [
            "profile",
            "history",
        ]
        assert result["diagnostics"][0]["status"] == "missing"
    else:
        with pytest.raises(
            UserExportTransportError,
            match=(
                "EXPORT_CHANGED"
                if status == "changedParent"
                else "FACT_HISTORY_PROVENANCE_UNRESOLVED"
            ),
        ):
            await module.discover_user_export_closure(t, IDENTITY)


@pytest.mark.asyncio
async def test_support_space_does_not_root_unrelated_same_space_contents():
    profile, owned, space, unrelated = (
        projected("immutable", "profile", True),
        projected("facts", "owned", True),
        projected("memorySpaces", "space"),
        projected("memories", "unrelated"),
    )
    for row in (owned, unrelated):
        row["edgeDescriptors"] = [
            {
                "ordinal": 0,
                "kind": "supportSpace",
                "domain": "memorySpaces",
                "purpose": "support",
            }
        ]
    t = ProjectionTransport([profile, owned, space, unrelated])

    async def edge(r):
        return {
            **t.envelope,
            "kind": "edge",
            "witness": {
                "childNode": r["node"],
                "childFingerprint": FP,
                "ordinal": 0,
                "kind": "supportSpace",
                "status": "admissible",
                "parentNode": space["node"],
                "parentFingerprint": FP,
                "observationTime": 1,
            },
        }

    t.inspect_edge = edge
    result = await module.discover_user_export_closure(t, IDENTITY)
    assert [v["projection"]["node"]["id"] for v in result["reachable"]] == [
        "profile",
        "owned",
        "space",
    ]
    assert result["reachable"][2]["supportWitness"]["childNode"]["id"] == "owned"
    assert len(result["witnesses"]) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("direction", ["supersedes", "supersededBy"])
async def test_exact_physical_fact_relationship_reverse_without_actor_authority(
    direction,
):
    profile, old, next_fact, history, actor_source = (
        projected("immutable", "profile", True),
        projected("facts", "old", True),
        projected("facts", "next"),
        projected("factHistory", "actor", True),
        projected("facts", "actorSource"),
    )
    old["edgeDescriptors"] = [
        {
            "ordinal": 0,
            "kind": "physicalFact:" + direction,
            "domain": "facts",
            "purpose": "inclusion",
            "storedDocumentTarget": "next",
        }
    ]
    history["edgeDescriptors"] = [
        {
            "ordinal": 0,
            "kind": "historySourceFact",
            "domain": "facts",
            "purpose": "inclusion",
            "storedDocumentTarget": "actorSource",
        }
    ]
    t = ProjectionTransport([profile, old, next_fact, history, actor_source])

    async def edge(r):
        return {
            **t.envelope,
            "kind": "edge",
            "witness": {
                "childNode": r["node"],
                "childFingerprint": FP,
                "ordinal": 0,
                "kind": (
                    "physicalFact:" + direction
                    if r["node"]["id"] == "old"
                    else "historySourceFact"
                ),
                "status": "admissible",
                "parentNode": (
                    next_fact["node"]
                    if r["node"]["id"] == "old"
                    else actor_source["node"]
                ),
                "parentFingerprint": FP,
                "observationTime": 1,
            },
        }

    t.inspect_edge = edge
    result = await module.discover_user_export_closure(t, IDENTITY)
    assert {v["projection"]["node"]["id"] for v in result["reachable"]} == {
        "profile",
        "old",
        "next",
        "actor",
    }
    assert (
        next(v for v in result["reachable"] if v["projection"]["node"]["id"] == "next")[
            "reverseFactWitness"
        ]["childNode"]["id"]
        == "old"
    )


class StreamFixture:
    """Independent rooted rows and file bytes; no production closure implementation."""

    def __init__(self):
        self.profile = {"domain": "immutable", "id": "profile"}
        self.attachment = {"domain": "attachments", "id": "attachment"}
        self.artifact = {"domain": "artifacts", "id": "artifact"}
        self.membership = {"domain": "artifacts", "id": "viewer"}
        self.payloads = {
            "profile": {
                "_id": "profile",
                "_creationTime": 1,
                "type": "user",
                "id": IDENTITY["userId"],
                "versionHistory": [{"version": 1, "data": {"value": "retained"}}],
            },
            "attachment": {
                "_id": "attachment",
                "_creationTime": 2,
                "storageId": "a-shared",
                "userId": IDENTITY["userId"],
            },
            "artifact": {
                "_id": "artifact",
                "_creationTime": 3,
                "isDeleted": True,
                "versionPointer": 3,
                "fileRef": {"storageId": "a-shared"},
                "versionHistory": [
                    {"version": 1, "fileRef": {"storageId": "z-empty"}},
                    {"version": 2, "fileRef": {"storageId": "m-old"}},
                ],
                "opaqueUrl": "https://never-fetch.invalid/secret",
            },
            "viewer": {
                "_id": "viewer",
                "_creationTime": 4,
                "collaborators": [
                    {"type": "user", "id": IDENTITY["userId"], "role": "viewer"}
                ],
            },
        }
        self.data = {
            "a-shared": b"\x00\xff" * 70000 + b"tail",
            "z-empty": b"",
            "m-old": b"\x80previous",
        }
        self.nodes = [self.profile, self.artifact, self.membership, self.attachment]
        self.calls = []
        self.reads = {}
        self.mode = None
        self.closed = False

    async def inspect(self, request):
        return {
            **request,
            "protocolVersion": 1,
            "kind": "inspect",
            "capability": "complete-export",
            "supportedDomains": list(module.DOMAINS),
            "profile": self.profile,
            "observationTime": 1,
        }

    async def page(self, request):
        self.calls.append(("page", request))
        rows = []
        if request["selection"]["kind"] == "rootProjections":
            for node in self.nodes:
                if node["domain"] == request["selection"]["domain"]:
                    rows.append(
                        {
                            "node": node,
                            "fingerprint": FP,
                            "disposition": "membershipProjection"
                            if node == self.membership
                            else "root",
                            "edgeDescriptors": [],
                            **(
                                {"rootReason": "scopedProfile"}
                                if node == self.profile
                                else {}
                            ),
                        }
                    )
        return {
            **IDENTITY,
            "protocolVersion": 1,
            "kind": "page",
            "observationTime": 2,
            "page": rows,
            "continueCursor": "end",
            "isDone": True,
        }

    async def inspect_edge(self, request):
        raise AssertionError("This fixture has no relationship edges")

    async def read_node(self, request):
        self.calls.append(("read", request))
        id = request["node"]["id"]
        self.reads[id] = self.reads.get(id, 0) + 1
        if self.mode == "late-read" and self.reads[id] == 2:
            raise UserExportTransportError("EXPORT_CHANGED", "readNode")
        return {
            **IDENTITY,
            "protocolVersion": 1,
            "kind": "node",
            "observationTime": 3,
            "node": request["node"],
            "fingerprint": FP,
            "disposition": "membershipProjection" if id == "viewer" else "record",
            "record": self.payloads[id],
        }

    async def resolve_file(self, request):
        self.calls.append(("file", request))
        storage_id = (
            "a-shared"
            if request["node"]["domain"] == "attachments" or request["version"] == 3
            else "z-empty"
            if request["version"] == 1
            else "m-old"
        )
        data = self.data[storage_id]
        file = {
            "storageId": storage_id,
            "size": len(data),
            "mimeType": "application/octet-stream",
            "sha256": hashlib.sha256(data).hexdigest(),
            "url": "https://authorized.invalid/transient",
        }
        if "version" in request:
            file["version"] = request["version"]
        if (
            self.mode == "late-file"
            and len([c for c in self.calls if c[0] == "file"]) > 4
        ):
            file["sha256"] = "f" * 64
        return {
            **IDENTITY,
            "protocolVersion": 1,
            "kind": "file",
            "observationTime": 4,
            "node": request["node"],
            "fingerprint": FP,
            "file": file,
        }

    async def stream_file(self, file):
        self.calls.append(("stream", file["storageId"]))
        try:
            data = self.data[file["storageId"]]
            for start in range(0, len(data), 16384):
                yield data[start : start + 16384]
            if self.mode == "binary-error":
                raise UserExportTransportError("EXPORT_TRANSPORT", "resolveFile")
        finally:
            self.closed = True


@pytest.mark.asyncio
async def test_complete_stream_retained_history_projection_binary_dedup_and_manifest():
    fixture = StreamFixture()
    events = [
        event
        async for event in UsersAPI(object()).export_data(
            IDENTITY["userId"], transport=fixture, page_size=7
        )
    ]
    assert events[0]["type"] == "header" and events[-1]["complete"] is True
    records = [e for e in events if e["type"] == "record"]
    assert [e["node"]["id"] for e in records] == [
        "profile",
        "artifact",
        "viewer",
        "attachment",
    ]
    assert records[0]["record"]["versionHistory"][0]["data"] == {"value": "retained"}
    assert records[1]["record"]["isDeleted"] is True
    assert (
        records[2]["disposition"] == "membershipProjection"
        and "fileRef" not in records[2]["record"]
    )
    assert all(
        c[1]["node"] != fixture.membership for c in fixture.calls if c[0] == "file"
    )
    assert [c[1] for c in fixture.calls if c[0] == "stream"] == [
        "z-empty",
        "m-old",
        "a-shared",
    ]
    for id, data in fixture.data.items():
        chunks = [e for e in events if e["type"] == "chunk" and e["storageId"] == id]
        assert [e["sequence"] for e in chunks] == list(range(len(chunks)))
        assert b"".join(base64.b64decode(e["data"]) for e in chunks) == data
        assert all(len(base64.b64decode(e["data"])) == 65536 for e in chunks[:-1])
    shared = next(
        e for e in events if e["type"] == "blob" and e["storageId"] == "a-shared"
    )
    assert shared["referrers"] == [
        {"node": fixture.artifact, "version": 3},
        {"node": fixture.attachment},
    ]
    manifest = events[-1]
    first_reference_order = ["z-empty", "m-old", "a-shared"]
    assert first_reference_order != sorted(first_reference_order)
    assert [
        e["storageId"] for e in events if e["type"] == "blob"
    ] == first_reference_order
    assert [blob["storageId"] for blob in manifest["blobs"]] == first_reference_order
    assert manifest["consistency"] == "rolling-read"
    assert manifest["pageCount"] == len(manifest["pageObservations"]) == 34
    assert sum(t["pages"] for t in manifest["tableManifest"]) == 34
    assert [t["domain"] for t in manifest["tableManifest"]] == list(module.DOMAINS)
    assert all(c[1]["numItems"] == 7 for c in fixture.calls if c[0] == "page")
    assert all(count == 2 for count in fixture.reads.values())
    assert "transient" not in json.dumps(
        events
    ) and "authorized.invalid" not in json.dumps(events)


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["late-read", "late-file", "binary-error"])
async def test_late_stream_error_has_no_manifest(mode):
    fixture = StreamFixture()
    fixture.mode = mode
    events = []
    with pytest.raises(UserExportTransportError):
        async for event in UsersAPI(object()).export_data(
            IDENTITY["userId"], transport=fixture
        ):
            events.append(event)
    assert not any(e["type"] == "manifest" for e in events)
    assert fixture.closed


@pytest.mark.asyncio
async def test_early_return_closes_active_binary_and_stops_reads():
    fixture = StreamFixture()
    stream = UsersAPI(object()).export_data(IDENTITY["userId"], transport=fixture)
    async for event in stream:
        if event["type"] == "chunk" and event["storageId"] == "a-shared":
            break
    calls = len(fixture.calls)
    await stream.aclose()
    assert fixture.closed and len(fixture.calls) == calls
    assert all(count == 1 for count in fixture.reads.values())


@pytest.mark.asyncio
async def test_raw_codec_sorted_objects_retains_extremes_and_rejects_wrong_scope():
    value = {
        "z": [
            ConvexInt64(-(2**63)),
            ConvexInt64(2**63 - 1),
            b"\x00\xff",
            -0.0,
            float("nan"),
            float("inf"),
            "世界",
        ],
        "a": {"z": 1, "a": 2},
    }
    encoded = module.canonical_user_export_value(value)
    assert list(encoded) == ["a", "z"] and list(encoded["a"]) == ["a", "z"]
    assert encoded == strict_convex_to_json(value)
    fixture = StreamFixture()
    fixture.payloads["profile"]["tenantId"] = "foreign"
    events = []
    with pytest.raises(UserExportTransportError, match="EXPORT_PROTOCOL"):
        async for event in UsersAPI(object()).export_data(
            IDENTITY["userId"], transport=fixture
        ):
            events.append(event)
    assert not any(e["type"] == "record" for e in events)


async def authorized_file(transport):
    return (
        await transport.resolve_file(
            {
                **IDENTITY,
                "node": {"domain": "attachments", "id": "owned-attachment"},
                "expectedFingerprint": FP,
            }
        )
    )["file"]


@pytest.mark.asyncio
async def test_binary_real_http_verified_bytes_no_credentials_and_resolver_authority(
    listener,
):
    url, state = listener
    t = UserExportTransport(url, "secret-key")
    file = await authorized_file(t)
    with pytest.raises(UserExportTransportError, match="EXPORT_INELIGIBLE"):
        async for _ in t.stream_file(dict(file)):
            pass
    with pytest.raises(UserExportTransportError, match="EXPORT_INELIGIBLE"):
        async for _ in UserExportTransport(url, "different").stream_file(file):
            pass
    assert state["gets"] == []
    chunks = [chunk async for chunk in t.stream_file(file)]
    assert b"".join(chunks) == state["fileData"] and all(
        len(c) == 65536 for c in chunks[:-1]
    )
    assert len(state["gets"]) == 1 and state["gets"][0]["auth"] is None
    with pytest.raises(UserExportTransportError, match="EXPORT_INELIGIBLE"):
        async for _ in t.stream_file(file):
            pass
    no_workers()


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["binary-stall", "binary-partial"])
async def test_binary_cancel_joins_worker_and_closes_response_socket(listener, mode):
    url, state = listener
    t = UserExportTransport(url, "secret-key", timeout=1, socket_timeout=0.3)
    file = await authorized_file(t)
    state["entered"].clear()
    state["mode"] = mode
    stream = t.stream_file(file)
    if mode == "binary-partial":
        assert len(await anext(stream)) == 65536
        await stream.aclose()
    else:
        task = asyncio.create_task(anext(stream))
        while not state["entered"].is_set():
            await asyncio.sleep(0.005)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
    for _ in range(50):
        if state["closed"].is_set():
            break
        await asyncio.sleep(0.005)
    assert state["closed"].is_set()
    no_workers()


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["binary-redirect", "bad-hash", "binary-stall"])
async def test_binary_redirect_checksum_and_deadline_refuse_without_secret_errors(
    listener, mode
):
    url, state = listener
    if mode == "bad-hash":
        state["fileHash"] = "f" * 64
    t = UserExportTransport(url, "secret-key", timeout=0.15, socket_timeout=0.3)
    file = await authorized_file(t)
    state["mode"] = mode
    with pytest.raises(UserExportTransportError) as error:
        async for _ in t.stream_file(file):
            pass
    assert "secret" not in str(error.value) and "/owned" not in str(error.value)
    assert len(state["gets"]) == 1 and all(g["auth"] is None for g in state["gets"])
    assert (
        error.value.code
        == {
            "binary-redirect": "EXPORT_TRANSPORT",
            "bad-hash": "EXPORT_FILE_METADATA",
            "binary-stall": "EXPORT_DEADLINE",
        }[mode]
    )
    no_workers()


@pytest.mark.asyncio
async def test_paused_binary_consumer_does_not_keep_response_open_past_deadline(
    listener, monkeypatch
):
    url, state = listener
    state["fileData"] = b"\xff" * (1024 * 1024)
    t = UserExportTransport(url, "secret-key", timeout=0.15, socket_timeout=0.3)
    file = await authorized_file(t)
    finished = threading.Event()
    original = module._Job.finish

    def finish(job):
        original(job)
        finished.set()

    monkeypatch.setattr(module._Job, "finish", finish)
    stream = t.stream_file(file)
    assert len(await anext(stream)) == 65536
    await asyncio.sleep(0.3)
    assert finished.is_set()
    await stream.aclose()
    no_workers()


@pytest.mark.asyncio
async def test_consumer_mutations_cannot_change_scope_record_selectors_or_blob_referrers():
    fixture = StreamFixture()
    stream = UsersAPI(object()).export_data(IDENTITY["userId"], transport=fixture)
    manifest = None
    async for event in stream:
        if event["type"] == "header":
            event["identity"]["userId"] = "foreign"
            event["identity"]["scope"].update(kind="tenant", tenantId="foreign")
        elif event["type"] == "record":
            event["node"]["id"] = "foreign"
        elif event["type"] == "blob":
            event["referrers"][0]["node"]["id"] = "foreign"
            event["referrers"].clear()
        elif event["type"] == "manifest":
            manifest = event
    assert manifest["identity"] == IDENTITY
    assert manifest["complete"] is True
    assert all(
        r["node"]["id"] != "foreign"
        for blob in manifest["blobs"]
        for r in blob["referrers"]
    )
    assert all(
        call[1]["userId"] == IDENTITY["userId"]
        and call[1]["scope"] == IDENTITY["scope"]
        for call in fixture.calls
        if call[0] != "stream"
    )
    assert all(count == 2 for count in fixture.reads.values())


@pytest.mark.asyncio
async def test_cancel_during_binary_cleanup_is_preserved_after_worker_join(
    listener, monkeypatch
):
    url, state = listener
    state["fileData"] = b""
    transport = UserExportTransport(url, "secret-key")
    file = await authorized_file(transport)
    finishing = threading.Event()
    original = module._Job.finish

    def finish(job):
        original(job)
        finishing.set()
        time.sleep(0.2)

    monkeypatch.setattr(module._Job, "finish", finish)
    stream = transport.stream_file(file)
    task = asyncio.create_task(anext(stream))
    while not finishing.is_set():
        await asyncio.sleep(0.005)
    await asyncio.sleep(0.03)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    no_workers()


@pytest.mark.parametrize(
    "number,expected",
    [
        (1.0, "1"),
        (-1.0, "-1"),
        (0.0, "0"),
        (1e-6, "0.000001"),
        (math.nextafter(1e-6, 0), "9.999999999999997e-7"),
        (1e-7, "1e-7"),
        (1e20, "100000000000000000000"),
        (1e21, "1e+21"),
        (1.0000000000000001e18, "1000000000000000100"),
        (5e-324, "5e-324"),
        (-5e-324, "-5e-324"),
        (sys.float_info.max, "1.7976931348623157e+308"),
    ],
)
def test_public_canonical_serializer_uses_js_number_text_without_value_coercion(
    number, expected
):
    event = {"type": "record", "record": {"number": number}}
    assert UsersAPI(object()).serialize_export_event(event) == (
        '{"record":{"number":' + expected + '},"type":"record"}'
    )
    assert event["record"]["number"] is number


def test_canonical_serializer_preserves_official_tags_arrays_and_utf16_key_order():
    record = module.canonical_user_export_value(
        {
            "specials": [
                ConvexInt64(2**63 - 1),
                b"\x00\xff",
                -0.0,
                float("nan"),
                float("inf"),
                -float("inf"),
            ],
            "array": [3.0, 1.0, 2.0],
        }
    )
    # Convex field names are ASCII; arbitrary event object keys still have a
    # defined serialization order independent of that storage restriction.
    record["keys"] = {"2": "two", "10": "ten", "\uffff": "last", "🧠": "beforeLast"}
    event = {"type": "record", "record": record}
    before = json.dumps(event)
    text = module.serialize_user_export_event(event)
    assert '"array":[3,1,2]' in text
    assert '"keys":{"10":"ten","2":"two","🧠":"beforeLast","\uffff":"last"}' in text
    assert json.loads(text)["record"]["specials"] == record["specials"]
    assert json.dumps(event) == before


def test_canonical_serializer_matches_well_formed_js_strings_and_repeated_aliases():
    shared = [
        True,
        False,
        None,
        '"\\\b\t\n\f\r\x00',
        "\ud83e\udde0",
        "\ud800",
        "\udfff",
        "\u2028\u2029",
    ]
    text = module.serialize_user_export_event(
        {"type": "record", "record": {"b": shared, "a": shared}}
    )
    encoded = '[true,false,null,"\\"\\\\\\b\\t\\n\\f\\r\\u0000","🧠","\\ud800","\\udfff","\u2028\u2029"]'
    assert (
        text == '{"record":{"a":' + encoded + ',"b":' + encoded + '},"type":"record"}'
    )
    text.encode("utf-8")


@pytest.mark.parametrize(
    "value",
    [
        float("nan"),
        float("inf"),
        -float("inf"),
        -0.0,
        2**53,
        -(2**53),
        b"unencoded",
        object(),
        (1, 2),
        {1: "nonstring"},
        {"$unknown": "bad"},
        {"$bytes": "not base64"},
        {"$integer": "AA=="},
        {"$float": "AAAAAAAA8D8="},
        {"$bytes": "AA==", "extra": True},
        {"\ud83e\udde0": "paired", "🧠": "astral"},
    ],
)
def test_canonical_serializer_refuses_invalid_values_without_successful_text(value):
    with pytest.raises(UserExportTransportError) as failure:
        UsersAPI(object()).serialize_export_event(
            {"type": "record", "record": {"value": value}}
        )
    assert (failure.value.code, failure.value.stage) == ("EXPORT_PROTOCOL", "serialize")


def test_canonical_serializer_refuses_cycles_and_invalid_event_kind():
    cycle = []
    cycle.append(cycle)
    for event in ({"type": "record", "record": cycle}, {"type": "unsupported"}, None):
        with pytest.raises(
            UserExportTransportError, match="EXPORT_PROTOCOL at serialize"
        ):
            module.serialize_user_export_event(event)


@pytest.mark.asyncio
@pytest.mark.parametrize("omitted", [False, True])
async def test_nullable_recommended_unbounded_advancement_and_terminal(omitted):
    records = [
        projected("immutable", "profile", True),
        projected("immutable", "last", True),
    ]
    t = ProjectionTransport(records)
    old = t.page
    requested = []

    async def page(request):
        if request["selection"] != {"domain": "immutable", "kind": "rootProjections"}:
            return await old(request)
        requested.append(request["cursor"])
        return {
            **t.envelope,
            "kind": "page",
            "page": records[:1] if request["cursor"] is None else records[1:],
            "continueCursor": "next" if request["cursor"] is None else "done",
            "isDone": request["cursor"] is not None,
            "pageStatus": "SplitRecommended",
            **({} if omitted else {"splitCursor": None}),
        }

    t.page = page
    result = await module.discover_user_export_closure(t, IDENTITY)
    assert sorted(x["projection"]["node"]["id"] for x in result["reachable"]) == [
        "last",
        "profile",
    ]
    assert requested == [None, "next"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status,malformed",
    [
        ("SplitRequired", "null"),
        ("SplitRequired", "omitted"),
        ("SplitRequired", "empty"),
        ("SplitRequired", "wrongType"),
        ("SplitRequired", "start"),
        ("SplitRequired", "end"),
        ("SplitRequired", "continuation"),
        ("SplitRecommended", "empty"),
        ("SplitRecommended", "wrongType"),
        ("SplitRecommended", "start"),
        ("SplitRecommended", "end"),
        ("SplitRecommended", "continuation"),
    ],
)
async def test_required_missing_and_recommended_invalid_split_never_release(
    status, malformed
):
    t = ProjectionTransport([projected("immutable", "profile", True)])
    calls = 0

    async def page(request):
        nonlocal calls
        calls += 1
        if (request["cursor"], request["endCursor"]) == (None, None):
            return {
                **t.envelope,
                "kind": "page",
                "page": [projected("immutable", "discard-provisional", True)],
                "continueCursor": "end",
                "isDone": False,
                "pageStatus": "SplitRequired",
                "splitCursor": "start",
            }
        if (request["cursor"], request["endCursor"]) == (None, "start"):
            return {
                **t.envelope,
                "kind": "page",
                "page": [],
                "continueCursor": "start",
                "isDone": False,
                "pageStatus": "SplitRecommended",
                "splitCursor": None,
            }
        assert (request["cursor"], request["endCursor"]) == ("start", "end")
        split = {
            "null": None,
            "empty": "",
            "wrongType": 123,
            "start": "start",
            "end": "end",
            "continuation": "within",
            "omitted": None,
        }[malformed]
        return {
            **t.envelope,
            "kind": "page",
            "page": [projected("immutable", "must-not-release", True)],
            "continueCursor": "within",
            "isDone": False,
            "pageStatus": status,
            **({} if malformed == "omitted" else {"splitCursor": split}),
        }

    t.page = page

    async def unexpected_file_release(_file):
        raise AssertionError("file release must remain gated")

    t.stream_file = unexpected_file_release
    released = []
    with pytest.raises(UserExportTransportError, match="EXPORT_PROTOCOL") as caught:
        async for event in UsersAPI(object()).export_data(
            IDENTITY["userId"], transport=t
        ):
            if event["type"] in ["record", "manifest"]:
                released.append(event)
    assert caught.value.stage == "page"
    assert released == [] and calls == 3


@pytest.mark.asyncio
async def test_nullable_recommended_no_progress_refuses_without_false_completion():
    t = ProjectionTransport([projected("immutable", "profile", True)])
    calls = 0

    async def page(request):
        nonlocal calls
        calls += 1
        return {
            **t.envelope,
            "kind": "page",
            "page": [],
            "continueCursor": "repeat",
            "isDone": False,
            "pageStatus": "SplitRecommended",
            "splitCursor": None,
        }

    t.page = page
    with pytest.raises(UserExportTransportError, match="EXPORT_PROTOCOL"):
        await module.discover_user_export_closure(t, IDENTITY)
    assert calls == 2


class MatchingCountDict(dict):
    """Count field observations performed by the actual exported closure function."""

    def __init__(self, value, counter):
        super().__init__(value)
        self.counter = counter

    def get(self, key, *args):
        if key in ("logicalId", "storedLogicalTarget"):
            self.counter[0] += 1
        return super().get(key, *args)

    def __getitem__(self, key):
        if key in ("logicalId", "storedLogicalTarget"):
            self.counter[0] += 1
        return super().__getitem__(key)


def adversarial_closure_fixture(length):
    records = [
        projected("immutable", "profile", True),
        projected("facts", "root", True),
    ]
    parent_by_child = {}
    parent = records[1]
    for index in range(1, length + 1):
        child = projected("memories" if index % 2 else "facts", f"{length - index:06d}")
        child["edgeDescriptors"] = [
            {
                "ordinal": 0,
                "kind": "chain",
                "domain": parent["node"]["domain"],
                "purpose": "inclusion",
                "storedLogicalTarget": parent["node"]["id"],
            }
        ]
        parent_by_child[child["node"]["id"]] = parent
        records.append(child)
        parent = child
    for index in range(512):
        child = projected("facts", f"poison-{index}")
        child["edgeDescriptors"] = [
            {
                "ordinal": 0,
                "kind": "poison",
                "domain": "facts",
                "purpose": "inclusion",
                "storedLogicalTarget": f"poison-{(index + 1) % 512}",
            }
        ]
        records.append(child)
    counter = [0]
    for record in records:
        record["edgeDescriptors"] = [
            MatchingCountDict(d, counter) for d in record["edgeDescriptors"]
        ]
    records = [MatchingCountDict(p, counter) for p in records]
    transport = ProjectionTransport(records)
    calls = []

    async def inspect_edge(request):
        calls.append(request["node"]["id"])
        parent = parent_by_child.get(request["node"]["id"])
        assert parent is not None, "disconnected poison must not be inspected"
        return {
            **transport.envelope,
            "kind": "edge",
            "witness": {
                "childNode": request["node"],
                "childFingerprint": FP,
                "kind": "chain",
                "ordinal": 0,
                "status": "admissible",
                "parentNode": parent["node"],
                "parentFingerprint": FP,
                "observationTime": 1,
            },
        }

    transport.inspect_edge = inspect_edge
    return transport, records, calls, counter


@pytest.mark.asyncio
@pytest.mark.parametrize("length", [64, 128, 256, 1024])
async def test_fifo_linear_work_descending_chain_disconnected_poison(length):
    transport, records, calls, counter = adversarial_closure_fixture(length)
    result = await module.discover_user_export_closure(transport, IDENTITY)
    assert sorted(
        item["projection"]["node"]["id"] for item in result["reachable"]
    ) == sorted(["profile", "root", *[f"{i:06d}" for i in range(length)]])
    assert len(calls) == len(set(calls)) == length
    assert counter[0] <= 16 * (len(records) + length + 512)
    expected = sorted(
        records[2 : length + 2],
        key=lambda p: (module.DOMAINS.index(p["node"]["domain"]), p["node"]["id"]),
    )
    assert [w["childNode"]["id"] for w in result["witnesses"]] == [
        p["node"]["id"] for p in expected
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("stage", ["index", "frontier"])
async def test_fifo_cancellation_immediate_transport(stage):
    transport, _, calls, _ = adversarial_closure_fixture(1024)
    task = None
    if stage == "frontier":
        original = transport.inspect_edge

        async def inspect(request):
            if not calls:
                asyncio.get_running_loop().call_soon(task.cancel)
            return await original(request)

        transport.inspect_edge = inspect
    task = asyncio.create_task(module.discover_user_export_closure(transport, IDENTITY))
    if stage == "index":
        await asyncio.sleep(0)
        task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert task.done()
    assert len(calls) <= (0 if stage == "index" else 128)
    if stage == "frontier":
        assert calls


@pytest.mark.asyncio
async def test_fifo_exact_parent_waiting_tuple_collisions_duplicate_candidates():
    profile = projected("immutable", "profile", True)
    root = projected("facts", "root", True)
    early = projected("conversations", "early", True)
    delayed = projected("memories", "delayed")
    child = projected("contexts", "child")
    collision = projected("facts", "collision")
    matching = projected("facts", "matching", True)
    foreign = projected("facts", "foreign")
    matching.update(logicalId="x:y", memorySpaceId="z")
    root.update(logicalId="x", memorySpaceId="y:z")
    foreign["disposition"] = "excluded"
    early["edgeDescriptors"] = [
        {
            "ordinal": 0,
            "kind": "early-link",
            "domain": "memories",
            "purpose": "inclusion",
            "storedDocumentTarget": "delayed",
        }
    ]
    delayed["edgeDescriptors"] = [
        {
            "ordinal": 0,
            "kind": "link",
            "domain": "facts",
            "purpose": "inclusion",
            "storedDocumentTarget": "root",
        }
    ]
    child["edgeDescriptors"] = [
        {
            "ordinal": 0,
            "kind": "chosen",
            "domain": "memories",
            "purpose": "inclusion",
            "storedDocumentTarget": "delayed",
        },
        {
            "ordinal": 1,
            "kind": "alternate",
            "domain": "facts",
            "purpose": "inclusion",
            "storedDocumentTarget": "root",
        },
    ]
    collision.update(
        memorySpaceId="z",
        edgeDescriptors=[
            {
                "ordinal": 0,
                "kind": "collision-safe",
                "domain": "facts",
                "purpose": "inclusion",
                "storedLogicalTarget": "x:y",
            }
        ],
    )
    duplicate = projected("facts", "second-key", True)
    duplicate.update(logicalId="x:y", memorySpaceId="z")
    records = [
        profile,
        root,
        early,
        delayed,
        child,
        collision,
        matching,
        foreign,
        duplicate,
    ]
    transport = ProjectionTransport(records)
    calls = []
    parents = {
        ("early", 0): delayed,
        ("delayed", 0): root,
        ("child", 0): delayed,
        ("child", 1): root,
        ("collision", 0): matching,
    }

    async def inspect(request):
        key = (request["node"]["id"], request["edgeOrdinal"])
        calls.append(key)
        row = next(p for p in records if p["node"] == request["node"])
        return {
            **transport.envelope,
            "kind": "edge",
            "witness": {
                "childNode": request["node"],
                "childFingerprint": FP,
                "kind": row["edgeDescriptors"][key[1]]["kind"],
                "ordinal": key[1],
                "status": "admissible",
                "parentNode": parents[key]["node"],
                "parentFingerprint": FP,
                "observationTime": 1,
            },
        }

    transport.inspect_edge = inspect
    result = await module.discover_user_export_closure(transport, IDENTITY)
    assert [p["projection"]["node"]["id"] for p in result["reachable"]] == [
        "profile",
        "early",
        "delayed",
        "collision",
        "matching",
        "root",
        "second-key",
        "child",
    ]
    selected = next(
        p for p in result["reachable"] if p["projection"]["node"]["id"] == "child"
    )
    assert selected["spanningWitness"]["kind"] == "alternate"
    assert len(calls) == len(set(calls)) == 5
    records.reverse()
    calls.clear()
    assert await module.discover_user_export_closure(transport, IDENTITY) == result
    assert len(calls) == len(set(calls)) == 5

    async def ambiguous(request):
        if request["node"]["id"] == "collision":
            raise UserExportTransportError("EXPORT_REFERENCE_AMBIGUOUS", "inspectEdge")
        return await inspect(request)

    transport.inspect_edge = ambiguous
    with pytest.raises(UserExportTransportError, match="EXPORT_REFERENCE_AMBIGUOUS"):
        await module.discover_user_export_closure(transport, IDENTITY)


@pytest.mark.asyncio
async def test_fifo_caller_timeout_interrupts_local_work_without_new_api_deadline():
    transport, _, calls, _ = adversarial_closure_fixture(1024)
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(
            module.discover_user_export_closure(transport, IDENTITY), timeout=0.000001
        )
    assert calls == []


@pytest.mark.asyncio
@pytest.mark.parametrize("incoming", [False, True])
async def test_share_space_support_witness_forwarding_and_incoming_absence(incoming):
    profile = projected("immutable", "profile", True)
    share = projected("conversationShares", "share", not incoming)
    space = projected("memorySpaces", "space")
    if incoming:
        share["disposition"] = "membershipProjection"
    else:
        share["edgeDescriptors"] = [
            {
                "ordinal": 0,
                "kind": "shareSpace",
                "domain": "memorySpaces",
                "purpose": "support",
                "storedLogicalTarget": "space",
            }
        ]
    transport = ProjectionTransport([profile, share, space])
    calls = []

    async def inspect(request):
        calls.append(request)
        return {
            **transport.envelope,
            "kind": "edge",
            "witness": {
                "childNode": share["node"],
                "childFingerprint": FP,
                "kind": "shareSpace",
                "ordinal": 0,
                "status": "admissible",
                "parentNode": space["node"],
                "parentFingerprint": FP,
                "observationTime": 1,
            },
        }

    transport.inspect_edge = inspect
    result = await module.discover_user_export_closure(transport, IDENTITY)
    assert [r["projection"]["node"]["id"] for r in result["reachable"]] == (
        ["profile", "share"] if incoming else ["profile", "share", "space"]
    )
    assert len(calls) == (0 if incoming else 1)
    if not incoming:
        release = module._release_request(IDENTITY, result["reachable"][-1])
        assert release["witness"]["kind"] == "shareSpace"
        assert release["witness"]["childNode"] == share["node"]
        assert release["witness"]["parentNode"] == space["node"]


@pytest.mark.asyncio
async def test_fifo_competing_edges_kind_ordinal_not_stored_descriptor_order():
    profile = projected("immutable", "profile", True)
    root = projected("facts", "root", True)
    child = projected("contexts", "child")
    child["edgeDescriptors"] = [
        {"ordinal": 0, "kind": "z-last", "domain": "facts", "purpose": "inclusion", "storedDocumentTarget": "root"},
        {"ordinal": 1, "kind": "a-first", "domain": "facts", "purpose": "inclusion", "storedDocumentTarget": "root"},
    ]
    records = [child, root, profile]
    transport = ProjectionTransport(records)
    calls = []

    async def inspect(request):
        calls.append(request["edgeOrdinal"])
        descriptor = next(edge for edge in child["edgeDescriptors"] if edge["ordinal"] == request["edgeOrdinal"])
        return {**transport.envelope, "kind": "edge", "witness": {
            "childNode": child["node"], "childFingerprint": FP, "ordinal": descriptor["ordinal"], "kind": descriptor["kind"],
            "status": "admissible", "parentNode": root["node"], "parentFingerprint": FP, "observationTime": 1,
        }}

    transport.inspect_edge = inspect
    result = await module.discover_user_export_closure(transport, IDENTITY)
    assert calls == [1, 0]
    selected = next(entry for entry in result["reachable"] if entry["projection"]["node"]["id"] == "child")
    assert selected["spanningWitness"]["kind"] == "a-first"
    assert [edge["kind"] for edge in result["witnesses"]] == ["a-first", "z-last"]
    records.reverse()
    calls.clear()
    assert await module.discover_user_export_closure(transport, IDENTITY) == result
    assert calls == [1, 0]
