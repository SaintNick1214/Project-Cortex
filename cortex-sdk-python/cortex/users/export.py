"""Fixed administrative export transport: stdlib HTTP, installed Python DNS child, Convex codecs."""

from __future__ import annotations

import asyncio
import base64
import concurrent.futures
import hashlib
import http.client
import ipaddress
import json
import math
import queue
import socket
import ssl
import subprocess
import sys
import threading
import time
from collections import deque
from typing import Any, AsyncGenerator, Dict, Optional, cast
from urllib.parse import urlsplit

from convex.values import json_to_convex, strict_convex_to_json

from ..types import UserExportEvent

DOMAINS = (
    "immutable",
    "mutable",
    "conversations",
    "memories",
    "facts",
    "factHistory",
    "contexts",
    "sessions",
    "artifacts",
    "attachments",
    "conversationShares",
    "conversationSnapshots",
    "memorySpaces",
    "agents",
    "governancePolicies",
    "governanceEnforcement",
    "graphSyncQueue",
)
_FUNCTIONS = {
    "inspect": "userExport:inspect",
    "page": "userExport:page",
    "inspectEdge": "userExport:inspectEdge",
    "readNode": "userExport:readNode",
    "resolveFile": "userExport:resolveFile",
}
_MAX_RESPONSE = 8 * 1024 * 1024 + 64 * 1024
_MAX_REQUEST = 64 * 1024
_SERVER_CODES = {
    "EXPORT_STAGE_UNIMPLEMENTED",
    "EXPORT_CHANGED",
    "EXPORT_SCOPE",
    "EXPORT_INELIGIBLE",
    "EXPORT_REFERENCE_AMBIGUOUS",
    "EXPORT_PROFILE_NOT_FOUND",
    "EXPORT_PROFILE_AMBIGUOUS",
    "EXPORT_BUDGET",
    "EXPORT_FILE_METADATA",
    "EXPORT_RESPONSE_TOO_LARGE",
    "EXPORT_PROTOCOL",
    "FACT_HISTORY_PROVENANCE_UNRESOLVED",
}
_DNS_CODE = """import json,socket,sys
r=json.loads(sys.stdin.buffer.read(1024));h,p=r['hostname'],r['port']
if not isinstance(h,str) or not 0<len(h)<=253 or not isinstance(p,int) or not 0<p<65536:raise ValueError('invalid resolution request')
rows=socket.getaddrinfo(h,p,type=socket.SOCK_STREAM)
result=[{'family':r[0],'type':r[1],'protocol':r[2],'address':list(r[4])}for r in rows if r[0] in (socket.AF_INET,socket.AF_INET6)][:32]
sys.stdout.write(json.dumps(result,separators=(',',':')))
"""


class UserExportTransportError(Exception):
    """Only sanitized stage and code, never native messages, keys or storage URLs."""

    def __init__(self, code: str, stage: str) -> None:
        self.code, self.stage = code, stage
        super().__init__(f"{code} at {stage}")


def _scope(v: Any) -> bool:
    return isinstance(v, dict) and (
        v == {"kind": "tenantless"}
        or (
            set(v) == {"kind", "tenantId"}
            and v.get("kind") == "tenant"
            and isinstance(v.get("tenantId"), str)
            and bool(v["tenantId"].strip())
        )
    )


def _node(v: Any) -> bool:
    return (
        isinstance(v, dict)
        and v.get("domain") in DOMAINS
        and isinstance(v.get("id"), str)
        and bool(v["id"])
    )


def _fingerprint(v: Any) -> bool:
    return (
        isinstance(v, str) and len(v) == 64 and all(c in "0123456789abcdef" for c in v)
    )


def _finite(v: Any) -> bool:
    try:
        return (
            isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)
        )
    except (OverflowError, ValueError, TypeError):
        return False


def _integer(v: Any, minimum: int = 0, maximum: Optional[int] = None) -> bool:
    return (
        _finite(v)
        and int(v) == v
        and v >= minimum
        and (maximum is None or v <= maximum)
    )


def _witness(v: Any) -> bool:
    return (
        isinstance(v, dict)
        and _node(v.get("childNode"))
        and _fingerprint(v.get("childFingerprint"))
        and isinstance(v.get("kind"), str)
        and bool(v["kind"])
        and _integer(v.get("ordinal"))
        and _finite(v.get("observationTime"))
        and v.get("status") in ("admissible", "foreignOwner", "missing", "unresolved")
        and ("parentNode" not in v or _node(v["parentNode"]))
        and ("parentFingerprint" not in v or _fingerprint(v["parentFingerprint"]))
        and (
            v["status"] != "admissible"
            or (_node(v.get("parentNode")) and _fingerprint(v.get("parentFingerprint")))
        )
    )


def _validate_request(op: str, r: Dict[str, Any]) -> None:
    allowed = {"userId", "scope"}
    allowed.update(
        {
            "page": ("selection", "cursor", "endCursor", "numItems"),
            "inspectEdge": ("node", "edgeOrdinal", "expectedFingerprint"),
            "readNode": ("node", "expectedFingerprint", "witness"),
            "resolveFile": ("node", "expectedFingerprint", "witness", "version"),
        }.get(op, ())
    )
    valid = (
        isinstance(r, dict)
        and set(r) <= allowed
        and isinstance(r.get("userId"), str)
        and bool(r["userId"].strip())
        and _scope(r.get("scope"))
    )
    if valid and op == "page":
        s = r.get("selection")
        valid = (
            isinstance(s, dict)
            and set(s) == {"kind", "domain"}
            and s.get("kind") in ("rootProjections", "closureProjections")
            and s.get("domain") in DOMAINS
            and _integer(r.get("numItems"), 1, 100)
            and "cursor" in r
            and (r["cursor"] is None or isinstance(r["cursor"], str))
            and (r.get("endCursor") is None or isinstance(r["endCursor"], str))
        )
    elif valid and op != "inspect":
        valid = _node(r.get("node")) and _fingerprint(r.get("expectedFingerprint"))
        if op == "inspectEdge":
            valid = valid and _integer(r.get("edgeOrdinal"))
        else:
            valid = valid and ("witness" not in r or _witness(r["witness"]))
            if op == "resolveFile":
                valid = (
                    valid
                    and r["node"]["domain"] in ("artifacts", "attachments")
                    and ("version" not in r or _integer(r["version"], 1))
                )
    if not valid:
        raise UserExportTransportError("EXPORT_PROTOCOL", op)


def _validate_response(op: str, r: Dict[str, Any], v: Any) -> Dict[str, Any]:
    valid = (
        isinstance(v, dict)
        and v.get("protocolVersion") == 1
        and not isinstance(v.get("protocolVersion"), bool)
        and v.get("userId") == r["userId"]
        and v.get("scope") == r["scope"]
        and _scope(v.get("scope"))
        and _finite(v.get("observationTime"))
    )
    if valid and op == "inspect":
        valid = (
            v.get("kind") == "inspect"
            and v.get("capability") in ("transport-only", "complete-export")
            and isinstance(v.get("supportedDomains"), list)
            and len(v["supportedDomains"]) == len(DOMAINS)
            and set(v["supportedDomains"]) == set(DOMAINS)
            and (v.get("profile") is None or _node(v["profile"]))
        )
    elif valid and op == "page":
        valid = (
            v.get("kind") == "page"
            and isinstance(v.get("page"), list)
            and isinstance(v.get("continueCursor"), str)
            and isinstance(v.get("isDone"), bool)
            and v.get("pageStatus") in (None, "SplitRequired", "SplitRecommended")
            and (v.get("splitCursor") is None or isinstance(v["splitCursor"], str))
        )
        if valid:
            valid = all(
                isinstance(p, dict)
                and _node(p.get("node"))
                and p.get("disposition")
                in ("root", "unownedCandidate", "membershipProjection", "excluded")
                and ("fingerprint" not in p or _fingerprint(p["fingerprint"]))
                and isinstance(p.get("edgeDescriptors"), list)
                and all(
                    isinstance(e, dict)
                    and _integer(e.get("ordinal"))
                    and isinstance(e.get("kind"), str)
                    and e.get("domain") in DOMAINS
                    and e.get("purpose")
                    in ("inclusion", "support", "reference", "legacy")
                    for e in p["edgeDescriptors"]
                )
                for p in v["page"]
            )
    elif valid and op == "inspectEdge":
        valid = v.get("kind") == "edge" and _witness(v.get("witness"))
    elif valid and op == "readNode":
        valid = (
            v.get("kind") == "node"
            and _node(v.get("node"))
            and _fingerprint(v.get("fingerprint"))
            and v.get("disposition") in ("record", "membershipProjection")
            and isinstance(v.get("record"), dict)
            and v["node"] == r["node"]
            and v["fingerprint"] == r["expectedFingerprint"]
            and v["record"].get("_id") == r["node"]["id"]
            and (
                v["record"].get("tenantId") is None
                if r["scope"]["kind"] == "tenantless"
                else v["record"].get("tenantId") == r["scope"]["tenantId"]
            )
        )
    elif valid and op == "resolveFile":
        f = v.get("file")
        valid = (
            v.get("kind") == "file"
            and _node(v.get("node"))
            and v["node"]["domain"] in ("artifacts", "attachments")
            and _fingerprint(v.get("fingerprint"))
            and isinstance(f, dict)
            and v["node"] == r["node"]
            and v["fingerprint"] == r["expectedFingerprint"]
            and isinstance(f.get("storageId"), str)
            and bool(f["storageId"])
            and isinstance(f.get("url"), str)
            and _integer(f.get("size"))
            and isinstance(f.get("mimeType"), str)
            and bool(f["mimeType"])
            and _fingerprint(f.get("sha256"))
            and ("version" not in f or _integer(f["version"], 1))
            and ("version" not in r or f.get("version") == r["version"])
        )
    if not valid:
        raise UserExportTransportError("EXPORT_PROTOCOL", op)
    return cast(Dict[str, Any], v)


class _Job:
    def __init__(self, stage: str, deadline: float, socket_timeout: float) -> None:
        self.stage, self.deadline, self.socket_timeout = stage, deadline, socket_timeout
        self.cancelled = threading.Event()
        self.lock = threading.Lock()
        self.child: Optional[subprocess.Popen[bytes]] = None
        self.sock: Optional[socket.socket] = None
        self.response: Optional[http.client.HTTPResponse] = None
        self.connection: Optional[http.client.HTTPConnection] = None

    def remaining(self) -> float:
        if self.cancelled.is_set():
            raise UserExportTransportError("EXPORT_CANCELLED", self.stage)
        left = self.deadline - time.monotonic()
        if left <= 0:
            raise UserExportTransportError("EXPORT_DEADLINE", self.stage)
        return min(left, self.socket_timeout)

    def interrupt(self) -> None:
        with self.lock:
            child, sock = self.child, self.sock
        if child is not None and child.poll() is None:
            try:
                child.terminate()
            except ProcessLookupError:
                pass
        if sock is not None:
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            sock.close()

    def resolve(
        self, hostname: str, port: int
    ) -> list[tuple[int, int, int, tuple[Any, ...]]]:
        try:
            ip = ipaddress.ip_address(hostname)
        except ValueError:
            ip = None
        if ip is not None:
            return [
                (
                    socket.AF_INET if ip.version == 4 else socket.AF_INET6,
                    socket.SOCK_STREAM,
                    0,
                    (str(ip), port),
                )
            ]
        self.remaining()
        # Fixed credential-free code, installed interpreter, no inherited env or caller code.
        child = subprocess.Popen(
            [sys.executable, "-I", "-c", _DNS_CODE],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            env={"PYTHONIOENCODING": "utf-8", "PYTHONNOUSERSITE": "1"},
            shell=False,
        )
        with self.lock:
            self.child = child
        payload = json.dumps({"hostname": hostname, "port": port}).encode()
        try:
            first = True
            while True:
                wait = min(0.05, self.remaining())
                try:
                    output, _ = child.communicate(
                        payload if first else None, timeout=wait
                    )
                    break
                except subprocess.TimeoutExpired:
                    first = False
            if child.returncode != 0 or len(output) > 64 * 1024:
                raise UserExportTransportError("EXPORT_TRANSPORT", self.stage)
            rows = json.loads(output)
            if not isinstance(rows, list) or not 0 < len(rows) <= 32:
                raise UserExportTransportError("EXPORT_PROTOCOL", self.stage)
            result: list[tuple[int, int, int, tuple[Any, ...]]] = []
            for row in rows:
                family, address = row["family"], row["address"]
                if (
                    family not in (socket.AF_INET, socket.AF_INET6)
                    or row["type"] != socket.SOCK_STREAM
                    or not isinstance(address, list)
                    or len(address) not in (2, 4)
                    or not isinstance(address[0], str)
                    or int(address[1]) != port
                ):
                    raise UserExportTransportError("EXPORT_PROTOCOL", self.stage)
                ipaddress.ip_address(address[0])
                result.append(
                    (family, socket.SOCK_STREAM, int(row["protocol"]), tuple(address))
                )
            return result
        finally:
            if child.poll() is None:
                child.terminate()
                try:
                    child.wait(timeout=0.25)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait(timeout=0.25)
            for stream in (child.stdin, child.stdout):
                if stream is not None:
                    stream.close()
            with self.lock:
                self.child = None

    def connect(self, hostname: str, port: int, secure: bool) -> socket.socket:
        for family, kind, protocol, address in self.resolve(hostname, port):
            sock = socket.socket(family, kind, protocol)
            with self.lock:
                self.sock = sock
            try:
                sock.settimeout(self.remaining())
                sock.connect(
                    address
                )  # Numeric sockaddr: no second hostname resolution.
                if secure:
                    wrapped = ssl.create_default_context().wrap_socket(
                        sock, server_hostname=hostname, do_handshake_on_connect=False
                    )
                    with self.lock:
                        self.sock = wrapped
                    wrapped.settimeout(self.remaining())
                    wrapped.do_handshake()
                    sock = wrapped
                return sock
            except Exception:
                with self.lock:
                    active = self.sock
                if active is not None:
                    active.close()
                self.remaining()
        raise UserExportTransportError("EXPORT_TRANSPORT", self.stage)

    def finish(self) -> None:
        self.interrupt()
        if self.response is not None:
            self.response.close()
        if self.connection is not None:
            self.connection.close()


class _Connection(http.client.HTTPConnection):
    def __init__(self, hostname: str, port: int, secure: bool, job: _Job) -> None:
        super().__init__(hostname, port, timeout=job.socket_timeout)
        self._secure, self._job = secure, job

    def connect(self) -> None:
        self.sock = self._job.connect(self.host, self.port, self._secure)


class _ResolvedFile(dict[str, Any]):
    """An unmodified resolver result is the authority for one binary download."""

    def __init__(self, file: Dict[str, Any], owner: object) -> None:
        super().__init__(file)
        self.owner = owner
        self.original = dict(file)
        self.used = False


class UserExportTransport:
    """Only fixed administrative operations; never changes ordinary SDK identity."""

    def __init__(
        self,
        url: str,
        deployment_key: str,
        timeout: float = 30,
        socket_timeout: float = 5,
    ) -> None:
        try:
            parsed = urlsplit(url)
            port = parsed.port or (443 if parsed.scheme == "https" else 80)
            valid = (
                parsed.scheme in ("http", "https")
                and bool(parsed.hostname)
                and not parsed.username
                and not parsed.password
                and not parsed.query
                and not parsed.fragment
                and parsed.path in ("", "/")
                and isinstance(deployment_key, str)
                and bool(deployment_key.strip())
                and _finite(timeout)
                and 0 < timeout <= 30
                and _finite(socket_timeout)
                and 0 < socket_timeout <= 5
                and 0 < port < 65536
            )
        except (TypeError, ValueError):
            valid = False
        if not valid:
            raise UserExportTransportError("EXPORT_PROTOCOL", "inspect")
        self._file_authority = object()
        self._hostname = parsed.hostname or ""
        self._port, self._secure = port, parsed.scheme == "https"
        self._key, self._timeout, self._socket_timeout = (
            deployment_key,
            timeout,
            socket_timeout,
        )

    async def _call(self, operation: str, request: Dict[str, Any]) -> Dict[str, Any]:
        _validate_request(operation, request)
        try:
            body = json.dumps(
                {
                    "path": _FUNCTIONS[operation],
                    "format": "convex_encoded_json",
                    "args": strict_convex_to_json(request),
                },
                separators=(",", ":"),
                allow_nan=False,
            ).encode()
        except Exception:
            raise UserExportTransportError("EXPORT_PROTOCOL", operation) from None
        if len(body) > _MAX_REQUEST:
            raise UserExportTransportError("EXPORT_REQUEST_TOO_LARGE", operation)
        job = _Job(operation, time.monotonic() + self._timeout, self._socket_timeout)

        def work() -> Dict[str, Any]:
            try:
                connection = _Connection(self._hostname, self._port, self._secure, job)
                job.connection = connection
                connection.request(
                    "POST",
                    "/api/function",
                    body=body,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": "Convex " + self._key,
                        "Connection": "close",
                    },
                )
                if job.sock is not None:
                    job.sock.settimeout(job.remaining())
                response = connection.getresponse()
                job.response = response
                chunks, size = [], 0
                while True:
                    if response.isclosed():
                        break
                    left = job.remaining()
                    if job.sock is not None:
                        job.sock.settimeout(left)
                    chunk = response.read1(16384)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > _MAX_RESPONSE:
                        raise UserExportTransportError(
                            "EXPORT_RESPONSE_TOO_LARGE", operation
                        )
                    chunks.append(chunk)
                job.remaining()
                if response.status in (401, 403):
                    raise UserExportTransportError("EXPORT_AUTHORIZATION", operation)
                if response.status not in (200, 560):
                    raise UserExportTransportError("EXPORT_TRANSPORT", operation)
                envelope = json.loads(b"".join(chunks))
                if not isinstance(envelope, dict):
                    raise UserExportTransportError("EXPORT_PROTOCOL", operation)
                if envelope.get("status") != "success":
                    data = json_to_convex(envelope.get("errorData"))
                    code = (
                        cast(str, data["code"])
                        if isinstance(data, dict) and data.get("code") in _SERVER_CODES
                        else "EXPORT_TRANSPORT"
                    )
                    raise UserExportTransportError(code, operation)
                return _validate_response(
                    operation, request, json_to_convex(envelope["value"])
                )
            except UserExportTransportError:
                raise
            except Exception:
                if job.cancelled.is_set():
                    raise UserExportTransportError(
                        "EXPORT_CANCELLED", operation
                    ) from None
                if time.monotonic() >= job.deadline:
                    raise UserExportTransportError(
                        "EXPORT_DEADLINE", operation
                    ) from None
                raise UserExportTransportError("EXPORT_TRANSPORT", operation) from None
            finally:
                job.finish()

        executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="cortex-user-export-" + operation
        )
        future = executor.submit(work)
        wrapped = asyncio.wrap_future(future)

        async def cleanup() -> None:
            job.cancelled.set()
            job.interrupt()
            while not future.done():
                await asyncio.sleep(0.01)
            while not wrapped.done():
                await asyncio.sleep(0.01)
            if not wrapped.cancelled():
                wrapped.exception()
            executor.shutdown(wait=True, cancel_futures=True)

        try:
            return await asyncio.wait_for(
                asyncio.shield(wrapped), timeout=self._timeout
            )
        except asyncio.TimeoutError:
            raise UserExportTransportError("EXPORT_DEADLINE", operation) from None
        finally:
            finishing = asyncio.create_task(cleanup())
            cancelled_during_cleanup = False
            while not finishing.done():
                try:
                    await asyncio.shield(finishing)
                except asyncio.CancelledError:
                    cancelled_during_cleanup = True
            finishing.result()
            if cancelled_during_cleanup:
                raise asyncio.CancelledError()

    async def inspect(self, request: Dict[str, Any]) -> Dict[str, Any]:
        return await self._call("inspect", request)

    async def page(self, request: Dict[str, Any]) -> Dict[str, Any]:
        return await self._call("page", request)

    async def inspect_edge(self, request: Dict[str, Any]) -> Dict[str, Any]:
        return await self._call("inspectEdge", request)

    async def read_node(self, request: Dict[str, Any]) -> Dict[str, Any]:
        return await self._call("readNode", request)

    async def resolve_file(self, request: Dict[str, Any]) -> Dict[str, Any]:
        response = await self._call("resolveFile", request)
        response["file"] = _ResolvedFile(response["file"], self._file_authority)
        return response

    async def stream_file(self, file: Dict[str, Any]) -> AsyncGenerator[bytes, None]:
        """Stream one unchanged result from this transport's authorized resolver.

        No credentials are forwarded to the storage host. Redirects are refused.
        Closing or cancelling the iterator closes and joins all owned resources.
        """
        stage = "resolveFile"
        if (
            not isinstance(file, _ResolvedFile)
            or file.owner is not self._file_authority
            or file.used
            or file != file.original
        ):
            raise UserExportTransportError("EXPORT_INELIGIBLE", stage)
        file.used = True
        try:
            parsed = urlsplit(file["url"])
            port = parsed.port or (443 if parsed.scheme == "https" else 80)
            if (
                parsed.scheme not in ("http", "https")
                or not parsed.hostname
                or parsed.username is not None
                or parsed.password is not None
                or parsed.fragment
                or not 0 < port < 65536
            ):
                raise ValueError()
        except (TypeError, ValueError):
            raise UserExportTransportError("EXPORT_PROTOCOL", stage) from None
        job = _Job(stage, time.monotonic() + self._timeout, self._socket_timeout)
        messages: queue.Queue[bytes | None] = queue.Queue(2)
        failures: list[UserExportTransportError] = []

        def send(value: bytes | None) -> None:
            while True:
                job.remaining()
                try:
                    messages.put(value, timeout=min(0.05, job.remaining()))
                    return
                except queue.Full:
                    continue

        def work() -> None:
            try:
                connection = _Connection(
                    parsed.hostname or "", port, parsed.scheme == "https", job
                )
                job.connection = connection
                target = parsed.path or "/"
                if parsed.query:
                    target += "?" + parsed.query
                connection.request(
                    "GET",
                    target,
                    headers={"Connection": "close", "Accept-Encoding": "identity"},
                )
                if job.sock is not None:
                    job.sock.settimeout(job.remaining())
                response = connection.getresponse()
                job.response = response
                if response.status != 200:
                    raise UserExportTransportError("EXPORT_TRANSPORT", stage)
                if response.getheader("Content-Encoding", "identity") != "identity":
                    raise UserExportTransportError("EXPORT_FILE_METADATA", stage)
                length = response.getheader("Content-Length")
                if length is not None and (
                    not length.isascii()
                    or not length.isdigit()
                    or int(length) != file["size"]
                ):
                    raise UserExportTransportError("EXPORT_FILE_METADATA", stage)
                size = 0
                digest = hashlib.sha256()
                while not response.isclosed():
                    if job.sock is not None:
                        job.sock.settimeout(job.remaining())
                    chunk = response.read(65536)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > file["size"]:
                        raise UserExportTransportError("EXPORT_FILE_METADATA", stage)
                    digest.update(chunk)
                    send(chunk)
                job.remaining()
                if size != file["size"] or digest.hexdigest() != file["sha256"]:
                    raise UserExportTransportError("EXPORT_FILE_METADATA", stage)
                send(None)
            except Exception as error:
                if isinstance(error, UserExportTransportError):
                    sanitized = error
                else:
                    sanitized = UserExportTransportError(
                        "EXPORT_CANCELLED"
                        if job.cancelled.is_set()
                        else "EXPORT_DEADLINE"
                        if time.monotonic() >= job.deadline
                        else "EXPORT_TRANSPORT",
                        stage,
                    )
                # Keep a terminal error outside the bounded chunk queue so a paused
                # consumer cannot prevent deadline-driven resource closure.
                failures.append(sanitized)
            finally:
                job.finish()

        executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="cortex-user-export-binary"
        )
        future = executor.submit(work)

        async def cleanup() -> None:
            job.cancelled.set()
            job.interrupt()
            while not future.done():
                await asyncio.sleep(0.01)
            future.result()
            executor.shutdown(wait=True, cancel_futures=True)

        try:
            while True:
                try:
                    message = messages.get_nowait()
                except queue.Empty:
                    if failures:
                        raise failures[0]
                    if time.monotonic() >= job.deadline:
                        raise UserExportTransportError("EXPORT_DEADLINE", stage)
                    await asyncio.sleep(0.005)
                    continue
                if message is None:
                    break
                yield message
        finally:
            finishing = asyncio.create_task(cleanup())
            cancelled_during_cleanup = False
            while not finishing.done():
                try:
                    await asyncio.shield(finishing)
                except asyncio.CancelledError:
                    cancelled_during_cleanup = True
            finishing.result()
            if cancelled_during_cleanup:
                raise asyncio.CancelledError()


def resolve_user_export_identity(
    user_id: str,
    tenant_id: Optional[str] = None,
    context_tenant_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Exact administrative selection; context is a defensive bound, not authority."""
    if (
        not isinstance(user_id, str)
        or not user_id.strip()
        or any(
            v is not None and (not isinstance(v, str) or not v.strip())
            for v in (tenant_id, context_tenant_id)
        )
    ):
        raise UserExportTransportError("EXPORT_PROTOCOL", "inspect")
    if (
        tenant_id is not None
        and context_tenant_id is not None
        and tenant_id != context_tenant_id
    ):
        raise UserExportTransportError("EXPORT_SCOPE", "inspect")
    selected = tenant_id if tenant_id is not None else context_tenant_id
    return {
        "userId": user_id,
        "scope": (
            {"kind": "tenantless"}
            if selected is None
            else {"kind": "tenant", "tenantId": selected}
        ),
    }


def _node_key(node: Dict[str, Any]) -> str:
    return str(node["domain"]) + ":" + str(node["id"])


def _stable(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


async def discover_user_export_closure(
    transport: UserExportTransport, selected: Dict[str, Any], page_size: int = 100
) -> Dict[str, Any]:
    """Select rooted projections only. No payload, binary, or terminal export completion."""
    if not _integer(page_size, 1, 100):
        raise UserExportTransportError("EXPORT_PROTOCOL", "page")
    _validate_request("inspect", selected)
    identity = {"userId": selected["userId"], "scope": dict(selected["scope"])}
    inspected = _validate_response(
        "inspect", identity, await transport.inspect(identity)
    )
    if inspected["profile"] is None:
        raise UserExportTransportError("EXPORT_STAGE_UNIMPLEMENTED", "inspect")
    projections: Dict[str, Dict[str, Any]] = {}
    page_count = 0
    page_observations = []
    for domain in DOMAINS:
        for kind in ("rootProjections", "closureProjections"):
            ranges: list[Dict[str, Any]] = [
                {"cursor": None, "endCursor": None, "depth": 0}
            ]
            requested = set()
            while ranges:
                page_range = ranges.pop(0)
                state = _stable([page_range["cursor"], page_range["endCursor"]])
                if state in requested or page_range["depth"] > 64:
                    raise UserExportTransportError("EXPORT_PROTOCOL", "page")
                requested.add(state)
                request = {
                    **identity,
                    "selection": {"kind": kind, "domain": domain},
                    "cursor": page_range["cursor"],
                    "endCursor": page_range["endCursor"],
                    "numItems": page_size,
                }
                page = _validate_response(
                    "page", request, await transport.page(request)
                )
                page_count += 1
                page_observations.append(
                    {
                        "domain": domain,
                        "selection": kind,
                        "observationTime": page["observationTime"],
                    }
                )
                if page.get("pageStatus") == "SplitRequired" or (
                    page.get("pageStatus") == "SplitRecommended"
                    and page.get("splitCursor") is not None
                ):
                    split, continuation = (
                        page.get("splitCursor"),
                        page["continueCursor"],
                    )
                    if (
                        not split
                        or split
                        in (page_range["cursor"], page_range["endCursor"], continuation)
                        or not continuation
                        or continuation == page_range["cursor"]
                    ):
                        raise UserExportTransportError("EXPORT_PROTOCOL", "page")
                    children = [
                        {
                            "cursor": page_range["cursor"],
                            "endCursor": split,
                            "depth": page_range["depth"] + 1,
                        },
                        {
                            "cursor": split,
                            "endCursor": continuation,
                            "depth": page_range["depth"] + 1,
                        },
                    ]
                    if not page["isDone"] and (
                        page_range["endCursor"] is None
                        or page["continueCursor"] != page_range["endCursor"]
                    ):
                        children.append(
                            {
                                "cursor": continuation,
                                "endCursor": page_range["endCursor"],
                                "depth": page_range["depth"],
                            }
                        )
                    ranges[0:0] = children
                    continue
                for projection in page["page"]:
                    if (
                        projection["node"]["domain"] != domain
                        or projection["disposition"] != "excluded"
                        and not projection.get("fingerprint")
                        or any(
                            edge["ordinal"] != ordinal
                            for ordinal, edge in enumerate(
                                projection["edgeDescriptors"]
                            )
                        )
                    ):
                        raise UserExportTransportError("EXPORT_PROTOCOL", "page")
                    key = _node_key(projection["node"])
                    if key in projections and _stable(projections[key]) != _stable(
                        projection
                    ):
                        raise UserExportTransportError("EXPORT_CHANGED", "page")
                    projections[key] = projection
                if not page["isDone"] and (
                    page_range["endCursor"] is None
                    or page["continueCursor"] != page_range["endCursor"]
                ):
                    if (
                        not page["continueCursor"]
                        or page["continueCursor"] == page_range["cursor"]
                    ):
                        raise UserExportTransportError("EXPORT_PROTOCOL", "page")
                    ranges.insert(0, {**page_range, "cursor": page["continueCursor"]})
    ordered = sorted(
        projections.values(),
        key=lambda p: (DOMAINS.index(p["node"]["domain"]), p["node"]["id"]),
    )
    profiles = [p for p in ordered if p.get("rootReason") == "scopedProfile"]
    if len(profiles) != 1 or _node_key(profiles[0]["node"]) != _node_key(
        inspected["profile"]
    ):
        raise UserExportTransportError("EXPORT_CHANGED", "inspect")
    entries: list[Dict[str, Any]] = []
    outgoing: Dict[str, list[Dict[str, Any]]] = {}
    # Tuple keys keep arbitrary IDs collision-safe; space is a separate key.
    dependencies: Dict[
        tuple[str, str, str], Dict[Optional[str], list[Dict[str, Any]]]
    ] = {}
    waiting_for_parent: Dict[str, list[Dict[str, Any]]] = {}
    reachable: Dict[str, Dict[str, Any]] = {}
    frontier: deque[Dict[str, Any]] = deque()
    local_work = 0

    async def checkpoint() -> None:
        nonlocal local_work
        local_work += 1
        if local_work % 128 == 0:
            # Deliver cancellation even when the injected transport resolves immediately.
            await asyncio.sleep(0)

    for projection in ordered:
        await checkpoint()
        child_key = _node_key(projection["node"])
        if projection["disposition"] in ("root", "membershipProjection"):
            reachable[child_key] = {"projection": projection}
            frontier.append(projection)
        if projection["disposition"] == "excluded":
            continue
        child_space = projection.get("memorySpaceId")
        children = []
        for descriptor in sorted(
            projection["edgeDescriptors"], key=lambda edge: (edge["kind"], edge["ordinal"])
        ):
            await checkpoint()
            entry = {
                "projection": projection,
                "descriptor": descriptor,
                "rank": len(entries),
            }
            entries.append(entry)
            children.append(entry)
            if descriptor["purpose"] not in ("inclusion", "legacy"):
                continue
            physical = descriptor.get("storedDocumentTarget")
            logical = descriptor.get("storedLogicalTarget")
            if not physical and logical is None:
                continue
            target = (
                "physical" if physical else "logical",
                descriptor["domain"],
                physical or logical,
            )
            dependencies.setdefault(target, {}).setdefault(child_space, []).append(
                entry
            )
        outgoing[child_key] = children
    visited = set()
    while frontier:
        await checkpoint()
        rooted = frontier.popleft()
        rooted_key = _node_key(rooted["node"])
        if rooted_key in visited:
            continue
        visited.add(rooted_key)
        candidates = {entry["rank"]: entry for entry in outgoing.get(rooted_key, [])}
        for entry in waiting_for_parent.pop(rooted_key, []):
            await checkpoint()
            entry["waiting"] = False
            candidates[entry["rank"]] = entry
        logical = rooted.get("logicalId")
        space = rooted.get("memorySpaceId")
        targets = [("physical", rooted["node"]["domain"], rooted["node"]["id"])]
        if logical is not None:
            targets.append(("logical", rooted["node"]["domain"], logical))
        for target in targets:
            spaces = dependencies.get(target)
            if spaces is None:
                continue
            selected_spaces = list(spaces) if space is None else [space, None]
            for selected_space in selected_spaces:
                for entry in spaces.pop(selected_space, []):
                    await checkpoint()
                    candidates[entry["rank"]] = entry
            if not spaces:
                del dependencies[target]
        for rank in sorted(candidates):
            await checkpoint()
            entry = candidates[rank]
            projection, descriptor = entry["projection"], entry["descriptor"]
            if "witness" not in entry:
                request = {
                    **identity,
                    "node": projection["node"],
                    "expectedFingerprint": projection["fingerprint"],
                    "edgeOrdinal": descriptor["ordinal"],
                }
                response = _validate_response(
                    "inspectEdge", request, await transport.inspect_edge(request)
                )
                witness = response["witness"]
                if (
                    _node_key(witness["childNode"]) != _node_key(projection["node"])
                    or witness["childFingerprint"] != projection["fingerprint"]
                    or witness["ordinal"] != descriptor["ordinal"]
                    or witness["kind"] != descriptor["kind"]
                    or witness.get("parentNode")
                    and witness["parentNode"]["domain"] != descriptor["domain"]
                ):
                    raise UserExportTransportError("EXPORT_PROTOCOL", "inspectEdge")
                if witness.get("parentNode"):
                    parent = projections.get(_node_key(witness["parentNode"]))
                    if (
                        parent is None
                        or parent["disposition"] == "excluded"
                        or parent.get("fingerprint") != witness.get("parentFingerprint")
                    ):
                        raise UserExportTransportError("EXPORT_CHANGED", "inspectEdge")
                entry["witness"] = witness
                # Only a rooted child or matching rooted parent schedules a descriptor.
                if witness["status"] == "unresolved":
                    raise UserExportTransportError(
                        "FACT_HISTORY_PROVENANCE_UNRESOLVED", "inspectEdge"
                    )
            witness = entry["witness"]
            if witness["status"] != "admissible" or not witness.get("parentNode"):
                continue
            child_rooted = _node_key(projection["node"]) in reachable
            parent_key = _node_key(witness["parentNode"])
            parent_rooted = parent_key in reachable
            support = descriptor["purpose"] == "support"
            reverse_fact = (
                projection["node"]["domain"] == "facts"
                and descriptor["purpose"] == "inclusion"
                and descriptor["kind"]
                in ("physicalFact:supersedes", "physicalFact:supersededBy")
                and child_rooted
                and not parent_rooted
            )
            if not support and descriptor["purpose"] != "inclusion":
                continue
            if (not child_rooted) if support or reverse_fact else (not parent_rooted):
                if not support and not parent_rooted and not entry.get("waiting"):
                    waiting_for_parent.setdefault(parent_key, []).append(entry)
                    entry["waiting"] = True
                continue
            target_node = (
                witness["parentNode"]
                if support or reverse_fact
                else witness["childNode"]
            )
            if support and target_node["domain"] != "memorySpaces":
                raise UserExportTransportError("EXPORT_PROTOCOL", "inspectEdge")
            key = _node_key(target_node)
            if key not in reachable:
                projection = projections[key]
                reachable[key] = {
                    "projection": projection,
                    "supportWitness"
                    if support
                    else "reverseFactWitness"
                    if reverse_fact
                    else "spanningWitness": witness,
                }
                frontier.append(projection)
    edges = [
        {"descriptor": entry["descriptor"], "witness": entry["witness"]}
        for entry in entries
        if "witness" in entry
    ]
    rooted_spaces = {
        value["projection"]["memorySpaceId"]
        for value in reachable.values()
        if isinstance(value["projection"].get("memorySpaceId"), str)
    }
    for projection in ordered:
        if (
            projection.get("rootReason") == "legacyActorProvenanceUnresolved"
            or projection.get("rootReason") == "legacyProvenanceUnresolved"
            and projection.get("memorySpaceId") in rooted_spaces
        ):
            raise UserExportTransportError("FACT_HISTORY_PROVENANCE_UNRESOLVED", "page")
    for edge in edges:
        witness = edge["witness"]
        if witness["status"] == "unresolved" and (
            _node_key(witness["childNode"]) in reachable
            or witness.get("parentNode")
            and _node_key(witness["parentNode"]) in reachable
        ):
            raise UserExportTransportError(
                "FACT_HISTORY_PROVENANCE_UNRESOLVED", "inspectEdge"
            )
    return {
        "identity": identity,
        "inspect": inspected,
        "reachable": [
            reachable[_node_key(p["node"])]
            for p in ordered
            if _node_key(p["node"]) in reachable
        ],
        "witnesses": [
            e["witness"]
            for e in edges
            if e["witness"]["status"] == "admissible"
            and _node_key(e["witness"]["childNode"]) in reachable
            and e["witness"].get("parentNode")
            and _node_key(e["witness"]["parentNode"]) in reachable
        ],
        "diagnostics": [
            e["witness"] for e in edges if e["witness"]["status"] != "admissible"
        ],
        "projectionCount": len(projections),
        "pageCount": page_count,
        "pageObservations": page_observations,
    }


USER_EXPORT_EXCLUSIONS = (
    "operationalRegistries:agents,governancePolicies,governanceEnforcement,graphSyncQueue",
    "externalDerivedGraphs",
    "customApplicationTables",
    "deploymentConfigurationAndCredentials",
    "purgedRecordsAndPurgedHistory",
    "foreignOwnershipAndDisconnectedUnownedComponents",
    "incomingShareSourceContentAndEditorViewerArtifactContent",
)


def _export_number_text(value: float) -> str:
    """ECMAScript JSON number text from the shortest round-tripping mantissa.

    Expanding int(value) loses the shortest representation for large rounded
    doubles. Reposition its decimal point instead; JSON uses fixed notation
    from 1e-6 (inclusive) to 1e21 (exclusive).
    """
    if not math.isfinite(value) or (value == 0 and math.copysign(1, value) < 0):
        raise ValueError("a special Convex float requires its official tag")
    if value == 0:
        return "0"
    magnitude = abs(value)
    mantissa, _, exponent = repr(magnitude).partition("e")
    whole, _, fraction = mantissa.partition(".")
    digits = whole + fraction
    point = len(whole) + int(exponent or "0")
    while len(digits) > 1 and digits.startswith("0"):
        digits = digits[1:]
        point -= 1
    digits = digits.rstrip("0")
    if 1e-6 <= magnitude < 1e21:
        if point <= 0:
            text = "0." + "0" * (-point) + digits
        elif point >= len(digits):
            text = digits + "0" * (point - len(digits))
        else:
            text = digits[:point] + "." + digits[point:]
    else:
        power = point - 1
        text = (
            digits[0]
            + ("." + digits[1:] if len(digits) > 1 else "")
            + "e"
            + ("+" if power >= 0 else "-")
            + str(abs(power))
        )
    return ("-" if value < 0 else "") + text


def _export_string_text(value: str) -> str:
    """Match well-formed JSON.stringify, including isolated UTF-16 surrogates."""
    short = {8: "\\b", 9: "\\t", 10: "\\n", 12: "\\f", 13: "\\r"}
    parts = ['"']
    index = 0
    while index < len(value):
        character = value[index]
        code = ord(character)
        if character in ('"', "\\"):
            parts.append("\\" + character)
        elif code < 32:
            parts.append(short.get(code, f"\\u{code:04x}"))
        elif (
            0xD800 <= code <= 0xDBFF
            and index + 1 < len(value)
            and 0xDC00 <= ord(value[index + 1]) <= 0xDFFF
        ):
            parts.append(
                chr(0x10000 + ((code - 0xD800) << 10) + ord(value[index + 1]) - 0xDC00)
            )
            index += 1
        elif 0xD800 <= code <= 0xDFFF:
            parts.append(f"\\u{code:04x}")
        else:
            parts.append(character)
        index += 1
    parts.append('"')
    return "".join(parts)


def serialize_user_export_event(event: UserExportEvent) -> str:
    """Serialize an encoded export event to canonical version1 JSON text.

    Use this method when persisting export_data events: Python json.dumps does
    not use the same double text as JavaScript. Raw events and the existing
    backend change-detection fingerprints remain unchanged. Object keys use
    UTF-16 order (including numeric-looking keys), arrays retain their order,
    and official Convex value tags are validated and preserved. No newline is
    appended. A serialization failure cannot certify a completed bundle.
    """
    active: set[int] = set()

    def emit(value: Any) -> str:
        if value is None:
            return "null"
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, str):
            return _export_string_text(value)
        if isinstance(value, int):
            if abs(value) > 2**53 - 1:
                raise ValueError("an int64 requires its official tag")
            return str(value)
        if isinstance(value, float):
            return _export_number_text(value)
        if not isinstance(value, (dict, list)) or id(value) in active:
            raise ValueError("unsupported or cyclic export value")
        active.add(id(value))
        try:
            if isinstance(value, list):
                return "[" + ",".join(emit(item) for item in value) + "]"
            if not all(isinstance(key, str) for key in value):
                raise ValueError("export object keys must be strings")
            if any(key.startswith("$") for key in value):
                if len(value) != 1 or next(iter(value)) not in (
                    "$integer",
                    "$bytes",
                    "$float",
                ):
                    raise ValueError("invalid Convex tag")
                if strict_convex_to_json(json_to_convex(value)) != value:
                    raise ValueError("noncanonical Convex tag")
            keys = sorted(
                value, key=lambda key: key.encode("utf-16-be", "surrogatepass")
            )
            encoded_keys = [_export_string_text(key) for key in keys]
            if len(set(encoded_keys)) != len(keys):
                raise ValueError("duplicate UTF-16 object key")
            return (
                "{"
                + ",".join(
                    encoded + ":" + emit(value[key])
                    for key, encoded in zip(keys, encoded_keys)
                )
                + "}"
            )
        finally:
            active.remove(id(value))

    try:
        if not isinstance(event, dict) or event.get("type") not in (
            "header",
            "record",
            "blob",
            "chunk",
            "blobEnd",
            "manifest",
        ):
            raise ValueError("invalid export event")
        return emit(event)
    except Exception:
        raise UserExportTransportError("EXPORT_PROTOCOL", "serialize") from None


def canonical_user_export_value(value: Any) -> Any:
    """Use the official Convex codec, sort keys, and preserve array order/tags."""

    def ordered(encoded: Any) -> Any:
        if isinstance(encoded, list):
            return [ordered(v) for v in encoded]
        if isinstance(encoded, dict):
            return {
                k: ordered(encoded[k])
                for k in sorted(
                    encoded, key=lambda k: k.encode("utf-16-be", "surrogatepass")
                )
            }
        return encoded

    try:
        return ordered(strict_convex_to_json(value))
    except Exception:
        raise UserExportTransportError("EXPORT_PROTOCOL", "readNode") from None


def _release_request(identity: Dict[str, Any], item: Dict[str, Any]) -> Dict[str, Any]:
    projection = item["projection"]
    request = {
        **identity,
        "node": projection["node"],
        "expectedFingerprint": projection["fingerprint"],
    }
    witness = (
        item.get("spanningWitness")
        or item.get("supportWitness")
        or item.get("reverseFactWitness")
    )
    if witness is not None:
        request["witness"] = witness
    return request


def _checked_record(
    request: Dict[str, Any], response: Dict[str, Any]
) -> Dict[str, Any]:
    _validate_response("readNode", request, response)
    return response


def _checked_file(request: Dict[str, Any], response: Dict[str, Any]) -> Dict[str, Any]:
    _validate_response("resolveFile", request, response)
    if response["file"].get("version") != request.get("version"):
        raise UserExportTransportError("EXPORT_CHANGED", "resolveFile")
    return cast(Dict[str, Any], response["file"])


async def export_user_data(
    identity: Dict[str, Any], transport: UserExportTransport, page_size: int = 100
) -> AsyncGenerator[Dict[str, Any], None]:
    """Version1 supported data stream; only a terminal manifest means completion.

    Reads are rolling observations across transactions, not an atomic snapshot.
    Concurrent changes can be detected at revalidation; not every race is detectable.
    Closing/cancelling the iterator stops subsequent calls and joins binary resources.
    """
    _validate_request("inspect", identity)
    identity = {"userId": identity["userId"], "scope": dict(identity["scope"])}
    if (
        transport is None
        or not _integer(page_size, 1, 100)
        or not all(
            callable(getattr(transport, name, None))
            for name in (
                "inspect",
                "page",
                "inspect_edge",
                "read_node",
                "resolve_file",
                "stream_file",
            )
        )
    ):
        raise UserExportTransportError("EXPORT_PROTOCOL", "inspect")
    started_at = int(time.time() * 1000)
    yield {
        "type": "header",
        "format": "cortex-user-export",
        "version": 1,
        "identity": {"userId": identity["userId"], "scope": dict(identity["scope"])},
        "consistency": "rolling-read",
        "startedAt": started_at,
    }
    closure = await discover_user_export_closure(transport, identity, page_size)
    counts = {domain: {"records": 0, "projections": 0} for domain in DOMAINS}
    files: Dict[str, Dict[str, Any]] = {}
    file_requests = []
    for item in closure["reachable"]:
        request = _release_request(identity, item)
        response = _checked_record(request, await transport.read_node(request))
        expected = (
            "membershipProjection"
            if item["projection"]["disposition"] == "membershipProjection"
            or request["node"]["domain"] == "memorySpaces"
            else "record"
        )
        if response["disposition"] != expected:
            raise UserExportTransportError("EXPORT_CHANGED", "readNode")
        counts[request["node"]["domain"]][
            "records" if expected == "record" else "projections"
        ] += 1
        row = response["record"]
        yield {
            "type": "record",
            "node": dict(request["node"]),
            "fingerprint": response["fingerprint"],
            "disposition": response["disposition"],
            "record": canonical_user_export_value(row),
        }
        domain = request["node"]["domain"]
        if expected != "record" or domain not in ("attachments", "artifacts"):
            continue
        versions: set[Optional[int]] = set()
        if domain == "attachments":
            versions.add(None)
        else:
            if isinstance(row.get("fileRef"), dict):
                version = row.get("versionPointer")
                if not _integer(version, 1):
                    raise UserExportTransportError("EXPORT_PROTOCOL", "resolveFile")
                versions.add(int(version))
            for entry in row.get("versionHistory", []):
                if isinstance(entry, dict) and isinstance(entry.get("fileRef"), dict):
                    if not _integer(entry.get("version"), 1):
                        raise UserExportTransportError("EXPORT_PROTOCOL", "resolveFile")
                    versions.add(int(entry["version"]))
        for version in sorted(versions, key=lambda v: v or 0):
            file_request = {
                **request,
                **({"version": version} if version is not None else {}),
            }
            file = _checked_file(
                file_request, await transport.resolve_file(file_request)
            )
            file_requests.append({"request": file_request, "file": file})
            existing = files.get(file["storageId"])
            metadata = {k: file[k] for k in ("storageId", "size", "mimeType", "sha256")}
            if existing is not None and any(
                existing["blob"][k] != v for k, v in metadata.items()
            ):
                raise UserExportTransportError("EXPORT_FILE_METADATA", "resolveFile")
            selected = existing or {"file": file, "blob": {**metadata, "referrers": []}}
            selected["blob"]["referrers"].append(
                {
                    "node": request["node"],
                    **({"version": version} if version is not None else {}),
                }
            )
            files[file["storageId"]] = selected
    for storage_id in files:
        file, blob = files[storage_id]["file"], files[storage_id]["blob"]
        yield {
            "type": "blob",
            **blob,
            "referrers": [{**r, "node": dict(r["node"])} for r in blob["referrers"]],
        }
        sequence = 0
        size = 0
        digest = hashlib.sha256()
        buffered = bytearray()
        stream = transport.stream_file(file)
        try:
            async for chunk in stream:
                if not isinstance(chunk, bytes):
                    raise UserExportTransportError("EXPORT_PROTOCOL", "resolveFile")
                size += len(chunk)
                if size > file["size"]:
                    raise UserExportTransportError(
                        "EXPORT_FILE_METADATA", "resolveFile"
                    )
                digest.update(chunk)
                buffered.extend(chunk)
                while len(buffered) >= 65536:
                    data = bytes(buffered[:65536])
                    del buffered[:65536]
                    yield {
                        "type": "chunk",
                        "storageId": storage_id,
                        "sequence": sequence,
                        "byteLength": len(data),
                        "data": base64.b64encode(data).decode("ascii"),
                    }
                    sequence += 1
            if size != file["size"] or digest.hexdigest() != file["sha256"]:
                raise UserExportTransportError("EXPORT_FILE_METADATA", "resolveFile")
            if buffered:
                yield {
                    "type": "chunk",
                    "storageId": storage_id,
                    "sequence": sequence,
                    "byteLength": len(buffered),
                    "data": base64.b64encode(buffered).decode("ascii"),
                }
                sequence += 1
        finally:
            await stream.aclose()
        yield {
            "type": "blobEnd",
            "storageId": storage_id,
            "chunks": sequence,
            "size": size,
            "sha256": file["sha256"],
        }
    for item in closure["reachable"]:
        request = _release_request(identity, item)
        response = _checked_record(request, await transport.read_node(request))
        expected = (
            "membershipProjection"
            if item["projection"]["disposition"] == "membershipProjection"
            or request["node"]["domain"] == "memorySpaces"
            else "record"
        )
        if response["disposition"] != expected:
            raise UserExportTransportError("EXPORT_CHANGED", "readNode")
    rooted = {_node_key(item["projection"]["node"]) for item in closure["reachable"]}
    for saved in closure["witnesses"] + [
        w for w in closure["diagnostics"] if _node_key(w["childNode"]) in rooted
    ]:
        request = {
            **identity,
            "node": saved["childNode"],
            "expectedFingerprint": saved["childFingerprint"],
            "edgeOrdinal": saved["ordinal"],
        }
        response = _validate_response(
            "inspectEdge", request, await transport.inspect_edge(request)
        )
        if _stable(
            {k: v for k, v in saved.items() if k != "observationTime"}
        ) != _stable(
            {k: v for k, v in response["witness"].items() if k != "observationTime"}
        ):
            raise UserExportTransportError("EXPORT_CHANGED", "inspectEdge")
    for entry in file_requests:
        current = _checked_file(
            entry["request"], await transport.resolve_file(entry["request"])
        )
        if _stable({k: v for k, v in entry["file"].items() if k != "url"}) != _stable(
            {k: v for k, v in current.items() if k != "url"}
        ):
            raise UserExportTransportError("EXPORT_CHANGED", "resolveFile")
    yield {
        "type": "manifest",
        "version": 1,
        "complete": True,
        "identity": identity,
        "consistency": "rolling-read",
        "startedAt": started_at,
        "endedAt": int(time.time() * 1000),
        "tableManifest": [
            {
                "domain": domain,
                **counts[domain],
                "pages": sum(
                    p["domain"] == domain for p in closure["pageObservations"]
                ),
            }
            for domain in DOMAINS
        ],
        "pageCount": closure["pageCount"],
        "pageObservations": closure["pageObservations"],
        "projectionCount": closure["projectionCount"],
        "blobs": [files[storage_id]["blob"] for storage_id in files],
        "diagnostics": closure["diagnostics"],
        "exclusions": list(USER_EXPORT_EXCLUSIONS),
    }
