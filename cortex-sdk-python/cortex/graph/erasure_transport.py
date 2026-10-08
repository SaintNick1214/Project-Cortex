"""One fixed administrator copied-job disposal operation with owned finite I/O."""

import asyncio
import concurrent.futures
import json
import math
import re
import time
from typing import Any, Dict
from urllib.parse import urlsplit

from convex import ConvexError
from convex.values import strict_convex_to_json

from ..users.export import _Connection, _Job
from .erasure import GraphErasureItem, graph_receipt_from_wire, validate_erasure_item
from .errors import GraphDatabaseError
from .identity import GRAPH_TABLES, decode_native_json, safe_integer


class FixedGraphErasureTransport:
    def __init__(self, *, url: str, deployment_key: str) -> None:
        parsed = urlsplit(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username is not None or parsed.password is not None or parsed.query or parsed.fragment or parsed.path not in ("", "/") or not isinstance(deployment_key, str) or not deployment_key.strip():
            raise GraphDatabaseError("Explicit deployment URL and administrator key required.", "GRAPH_ERASURE_TRANSPORT_REQUIRED")
        self._hostname, self._port, self._secure = parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), parsed.scheme == "https"
        self._key = deployment_key
        self._closed = False
        self._job: _Job | None = None

    async def _call(self, args: Dict[str, Any], cancel_event: Any, timeout_ms: float) -> Any:
        if self._closed or self._job is not None:
            raise GraphDatabaseError("Erasure transport is closed or busy.", "GRAPH_ERASURE_TRANSPORT_BUSY")
        if type(timeout_ms) not in (int, float) or not math.isfinite(timeout_ms) or timeout_ms <= 0 or cancel_event is not None and cancel_event.is_set():
            raise GraphDatabaseError("Erasure cancelled or deadline expired.", "GRAPH_ERASURE_CANCELLED")
        duration = min(30, timeout_ms / 1000)
        body = json.dumps({"path": "graphSync:clearSyncedItems", "format": "convex_encoded_json", "args": strict_convex_to_json(args)}, separators=(",", ":"), allow_nan=False).encode("utf-8")
        job = _Job("clearSyncedItems", time.monotonic() + duration, min(duration, 5))
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
                        raise GraphDatabaseError("Native erasure response exceeds encoded bound.", "GRAPH_ERASURE_PAGE_BUDGET")
                    chunks.append(chunk)
                job.remaining()
                if response.status in (401, 403):
                    raise GraphDatabaseError("Administrator erasure request refused.", "GRAPH_ERASURE_AUTHORIZATION")
                if response.status not in (200, 560):
                    raise GraphDatabaseError("Native erasure request failed.", "GRAPH_ERASURE_TRANSPORT_FAILED")
                envelope = json.loads(b"".join(chunks))
                if not isinstance(envelope, dict):
                    raise GraphDatabaseError("Invalid native erasure response.", "GRAPH_ERASURE_INVALID_PAGE")
                if envelope.get("status") != "success":
                    data = decode_native_json(json.dumps(envelope.get("errorData")))
                    code = data.get("code") if isinstance(data, dict) else data if isinstance(data, str) else None
                    if isinstance(code, str) and re.fullmatch(r"(?:GRAPH_|REFERENCE_)[A-Z0-9_]{1,80}", code):
                        raise ConvexError("Native erasure refused.", {"code": code})
                    raise GraphDatabaseError("Native erasure refusal is unresolved.", "GRAPH_ERASURE_NATIVE_FAILED")
                return decode_native_json(json.dumps(envelope["value"], ensure_ascii=False))
            except (GraphDatabaseError, ConvexError):
                raise
            except Exception:
                raise GraphDatabaseError("Original graph disposal response is unresolved; read status before continuing.", "GRAPH_ERASURE_CANCELLED" if job.cancelled.is_set() or time.monotonic() >= job.deadline else "GRAPH_ERASURE_RESPONSE_UNKNOWN") from None
            finally:
                job.finish()

        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="cortex-graph-erasure")
        future = executor.submit(work)
        wrapped = asyncio.wrap_future(future)
        cancellation = asyncio.create_task(cancel_event.wait()) if cancel_event is not None else None
        try:
            done, _ = await asyncio.wait([wrapped] + ([cancellation] if cancellation else []), timeout=duration, return_when=asyncio.FIRST_COMPLETED)
            if wrapped in done:
                return wrapped.result()
            raise GraphDatabaseError("Erasure cancelled or deadline expired.", "GRAPH_ERASURE_CANCELLED")
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

    def _selection(self, item: GraphErasureItem) -> Dict[str, Any]:
        validate_erasure_item(item)
        table = next(table for table, kind in GRAPH_TABLES.items() if kind == item.identity.kind)
        return {"table": table, "physicalSourceId": item.identity.physical_source_id,
                "sourceRevision": item.source_revision, "ownershipRevision": item.ownership_revision,
                "referenceRevision": item.reference_revision, "referenceGeneration": item.reference_generation,
                "targetId": item.evidence.target_id}

    def _args(self, item: GraphErasureItem, mode: Dict[str, Any]) -> Dict[str, Any]:
        args: Dict[str, Any] = {"disposal": {**self._selection(item), **mode}}
        if item.identity.tenant_id is not None:
            args["tenantId"] = item.identity.tenant_id
        return args

    def _receipt(self, item: GraphErasureItem, value: Any) -> Any:
        receipt = graph_receipt_from_wire(value)
        if receipt.identity.key != item.identity.key or receipt.identity.tuple_json != item.identity.tuple_json or receipt.source_revision != item.source_revision + 1:
            raise GraphDatabaseError("Original erasure receipt does not match selected physical source.", "GRAPH_JOB_UNRESOLVED")
        return receipt

    async def preflight(self, item: GraphErasureItem, scan: str, range_: Dict[str, Any], *, cancel_event: Any = None, timeout_ms: float = 30000) -> Any:
        if scan not in ("source", "legacy") or not isinstance(range_, dict) or set(range_) != {"cursor", "endCursor"} or any(value is not None and not isinstance(value, str) for value in range_.values()):
            raise GraphDatabaseError("Invalid copied-job preflight range.", "GRAPH_ERASURE_INVALID_PAGE")
        return await self._call(self._args(item, {"kind": "preflight", "scan": scan, "range": range_}), cancel_event, timeout_ms)

    async def status(self, item: GraphErasureItem, receipt: Any, *, cancel_event: Any = None, timeout_ms: float = 30000) -> Any:
        receipt = self._receipt(item, receipt)
        return await self._call(self._args(item, {"kind": "status", "id": receipt.id, "generation": receipt.generation}), cancel_event, timeout_ms)

    async def dispose(self, item: GraphErasureItem, receipt: Any, expected_disposal_revision: int, *, cancel_event: Any = None, timeout_ms: float = 30000) -> Any:
        if not safe_integer(expected_disposal_revision) or expected_disposal_revision < 0:
            raise GraphDatabaseError("Invalid copied-job disposal revision.", "GRAPH_ERASURE_PROGRESS_CHANGED")
        receipt = self._receipt(item, receipt)
        return await self._call(self._args(item, {"kind": "dispose", "id": receipt.id, "generation": receipt.generation, "expectedDisposalRevision": expected_disposal_revision}), cancel_event, timeout_ms)

    def close(self) -> None:
        self._closed = True
        if self._job:
            self._job.cancelled.set()
            self._job.interrupt()


def create_graph_erasure_transport(*, url: str, deployment_key: str) -> FixedGraphErasureTransport:
    return FixedGraphErasureTransport(url=url, deployment_key=deployment_key)
