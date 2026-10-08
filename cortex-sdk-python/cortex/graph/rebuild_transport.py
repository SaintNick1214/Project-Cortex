"""Two fixed administrator queries with explicit authority and finite owned I/O."""

import asyncio
import concurrent.futures
import json
import math
import re
import time
from typing import Any, Dict
from urllib.parse import urlsplit

from convex.values import strict_convex_to_json

from ..users.export import _Connection, _Job
from .errors import GraphDatabaseError
from .identity import GRAPH_TABLES, decode_native_json, safe_integer


class FixedGraphRebuildTransport:
    """No environment lookup, ordinary SDK client, or arbitrary function dispatch."""

    def __init__(self, *, url: str, deployment_key: str) -> None:
        parsed = urlsplit(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username is not None or parsed.password is not None or parsed.query or parsed.fragment or parsed.path not in ("", "/") or not isinstance(deployment_key, str) or not deployment_key.strip():
            raise GraphDatabaseError("Explicit deployment URL and administrator key required.", "GRAPH_REBUILD_TRANSPORT_REQUIRED")
        self._hostname, self._port, self._secure = parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), parsed.scheme == "https"
        self._key = deployment_key
        self._closed = False
        self._job: _Job | None = None

    async def _call(self, name: str, args: Dict[str, Any], cancel_event: Any, timeout_ms: float) -> Any:
        if self._closed or self._job is not None:
            raise GraphDatabaseError("Rebuild transport is closed or busy.", "GRAPH_REBUILD_TRANSPORT_BUSY")
        keys = {"version", "kind", "paginationOpts", "tenantId", "memorySpaceId"}
        if name == "rebuildEdgePage":
            keys |= {"physicalSourceId", "expectedSourceRevision", "expectedOwnershipRevision", "expectedReferenceGeneration"}
        if set(args) - keys or args.get("version") != 2 or args.get("kind") not in GRAPH_TABLES.values() or any(key in args and (not isinstance(args[key], str) or not args[key]) for key in ("tenantId", "memorySpaceId")):
            raise GraphDatabaseError("Fixed kind and exact known scope required.", "GRAPH_SCOPE_MISMATCH")
        range_ = args.get("paginationOpts")
        if not isinstance(range_, dict) or set(range_) != {"cursor", "endCursor", "numItems"} or any(range_[key] is not None and not isinstance(range_[key], str) for key in ("cursor", "endCursor")) or not safe_integer(range_["numItems"]) or not 1 <= range_["numItems"] <= 8:
            raise GraphDatabaseError("Invalid native rebuild range.", "GRAPH_REBUILD_INVALID_PAGE")
        if name == "rebuildEdgePage" and (any(not isinstance(args.get(key), str) or not args[key] for key in ("physicalSourceId", "expectedReferenceGeneration")) or any(not safe_integer(args.get(key)) or args[key] < 1 for key in ("expectedSourceRevision", "expectedOwnershipRevision"))):
            raise GraphDatabaseError("Invalid captured rebuild source.", "GRAPH_IDENTITY_REQUIRED")
        if type(timeout_ms) not in (int, float) or not math.isfinite(timeout_ms) or timeout_ms <= 0 or cancel_event is not None and cancel_event.is_set():
            raise GraphDatabaseError("Rebuild cancelled or deadline expired.", "GRAPH_REBUILD_CANCELLED")
        duration = min(30, timeout_ms / 1000)
        body = json.dumps({"path": "graphSync:" + name, "format": "convex_encoded_json", "args": strict_convex_to_json(args)}, separators=(",", ":"), allow_nan=False).encode("utf-8")
        job = _Job(name, time.monotonic() + duration, min(duration, 5))
        self._job = job

        def work() -> Any:
            try:
                connection = _Connection(self._hostname, self._port, self._secure, job)
                job.connection = connection
                connection.request("POST", "/api/function", body=body, headers={"Content-Type": "application/json", "Authorization": "Convex " + self._key, "Connection": "close"})
                if job.sock:
                    job.sock.settimeout(job.remaining())
                response = connection.getresponse()
                job.response = response
                chunks, count = [], 0
                while not response.isclosed():
                    if job.sock:
                        job.sock.settimeout(job.remaining())
                    chunk = response.read1(16384)
                    if not chunk:
                        break
                    count += len(chunk)
                    if count > 8 * 1024 * 1024:
                        raise GraphDatabaseError("Native rebuild response exceeds encoded bound.", "GRAPH_REBUILD_PAGE_BUDGET")
                    chunks.append(chunk)
                job.remaining()
                if response.status in (401, 403):
                    raise GraphDatabaseError("Administrator rebuild request refused.", "GRAPH_REBUILD_AUTHORIZATION")
                if response.status not in (200, 560):
                    raise GraphDatabaseError("Native rebuild request failed.", "GRAPH_REBUILD_TRANSPORT_FAILED")
                envelope = json.loads(b"".join(chunks))
                if not isinstance(envelope, dict):
                    raise GraphDatabaseError("Invalid native rebuild response.", "GRAPH_REBUILD_INVALID_PAGE")
                if envelope.get("status") != "success":
                    data = decode_native_json(json.dumps(envelope.get("errorData")))
                    code = data.get("code") if isinstance(data, dict) else data if isinstance(data, str) else None
                    raise GraphDatabaseError("Native rebuild query refused.", code if isinstance(code, str) and re.fullmatch(r"(?:GRAPH_|REFERENCE_)[A-Z0-9_]{1,80}", code) else "GRAPH_REBUILD_NATIVE_FAILED")
                return decode_native_json(json.dumps(envelope["value"], ensure_ascii=False))
            except GraphDatabaseError:
                raise
            except Exception:
                raise GraphDatabaseError("Fixed native rebuild request failed; confirmed counts remain partial.", "GRAPH_REBUILD_CANCELLED" if job.cancelled.is_set() or time.monotonic() >= job.deadline else "GRAPH_REBUILD_TRANSPORT_FAILED") from None
            finally:
                job.finish()

        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="cortex-graph-rebuild")
        future = executor.submit(work)
        wrapped = asyncio.wrap_future(future)
        cancellation = asyncio.create_task(cancel_event.wait()) if cancel_event is not None else None
        try:
            done, _ = await asyncio.wait([wrapped] + ([cancellation] if cancellation else []), timeout=duration, return_when=asyncio.FIRST_COMPLETED)
            if wrapped in done:
                return wrapped.result()
            raise GraphDatabaseError("Rebuild cancelled or deadline expired.", "GRAPH_REBUILD_CANCELLED")
        finally:
            if cancellation:
                cancellation.cancel()
                await asyncio.gather(cancellation, return_exceptions=True)
            job.cancelled.set()
            job.interrupt()

            async def finish() -> None:
                while not wrapped.done():
                    await asyncio.sleep(0.01)
                if not wrapped.cancelled():
                    wrapped.exception()
                executor.shutdown(wait=True, cancel_futures=True)
                self._job = None

            closing = asyncio.create_task(finish())
            cancelled_during_cleanup = False
            while not closing.done():
                try:
                    await asyncio.shield(closing)
                except asyncio.CancelledError:
                    cancelled_during_cleanup = True
            closing.result()
            if cancelled_during_cleanup:
                raise asyncio.CancelledError()

    async def source_page(self, args: Dict[str, Any], *, cancel_event: Any = None, timeout_ms: float = 30000) -> Any:
        return await self._call("rebuildSourcePage", args, cancel_event, timeout_ms)

    async def edge_page(self, args: Dict[str, Any], *, cancel_event: Any = None, timeout_ms: float = 30000) -> Any:
        return await self._call("rebuildEdgePage", args, cancel_event, timeout_ms)

    def close(self) -> None:
        self._closed = True
        if self._job:
            self._job.cancelled.set()
            self._job.interrupt()


def create_graph_rebuild_transport(*, url: str, deployment_key: str) -> FixedGraphRebuildTransport:
    return FixedGraphRebuildTransport(url=url, deployment_key=deployment_key)
