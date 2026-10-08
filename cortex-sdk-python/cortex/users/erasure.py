"""Fixed administrative erasure transport, separate from ordinary user identity."""

from __future__ import annotations

import asyncio
import concurrent.futures
import hashlib
import json
import math
import re
import time
from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib.parse import urlsplit
from uuid import uuid4

from convex.values import json_to_convex, strict_convex_to_json

from ..errors import CascadeDeletionError
from ..types import ErasureReceipt
from .export import (
    DOMAINS,
    _Connection,
    _export_string_text,
    _Job,
    canonical_user_export_value,
)

ERASURE_OPERATIONS = (
    "discoverPage",
    "checkRecord",
    "checkBinaryReferences",
    "verifyPage",
    "getReceiptPage",
    "eraseRecord",
    "purgeExpiredReceiptsPage",
)
_MUTATIONS = frozenset(("eraseRecord", "purgeExpiredReceiptsPage"))
_MAX_ARGUMENTS = 1024 * 1024
_MAX_RESPONSE = 8 * 1024 * 1024


class DomainErasureError(CascadeDeletionError):
    """Sanitized failure; an uncertain send is reconciled, never automatically retried."""

    def __init__(
        self,
        code: str,
        stage: str,
        *,
        unknown_outcome: bool = False,
        receipt: Optional[ErasureReceipt] = None,
    ) -> None:
        self.code, self.stage = code, stage
        self.unknown_outcome, self.receipt = unknown_outcome, receipt
        self.outcomes: list[Any] = []
        self.unstarted: list[str] = []
        self.deleted = 0
        self.user_ids: list[str] = []
        super().__init__(f"{code} at {stage}")


def _integer(value: Any, minimum: int = 0, maximum: Optional[int] = None) -> bool:
    try:
        return (
            type(value) in (int, float)
            and math.isfinite(value)
            and value == int(value)
            and value >= minimum
            and (maximum is None or value <= maximum)
        )
    except (OverflowError, ValueError, TypeError):
        return False


def _text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _digest(value: Any) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[a-f0-9]{64}", value) is not None


def validate_erasure_domain(domain: Any) -> None:
    """Exact tenantless/tenant domain; caller selection never supplies ownership."""
    valid = isinstance(domain, dict) and domain.get("kind") in ("user", "space")
    if valid:
        key = "userId" if domain["kind"] == "user" else "memorySpaceId"
        valid = set(domain) <= {"kind", key, "tenantId", "rootDocumentId"} and _text(
            domain.get(key)
        )
        valid = valid and len(domain.get(key, "")) <= 256
        valid = valid and (
            "tenantId" not in domain
            or _text(domain["tenantId"])
            and len(domain["tenantId"]) <= 256
        )
        valid = valid and (
            "rootDocumentId" not in domain or _text(domain["rootDocumentId"])
        )
    if not valid:
        raise DomainErasureError("ERASURE_PROTOCOL", "domain")


def _validate_request(operation: str, request: Any) -> None:
    if operation not in ERASURE_OPERATIONS or not isinstance(request, dict):
        raise DomainErasureError("ERASURE_PROTOCOL", operation)
    if operation == "purgeExpiredReceiptsPage":
        valid = (
            set(request) == {"before", "cursor", "numItems"}
            and _integer(request.get("before"))
            and (
                request.get("cursor") is None or isinstance(request.get("cursor"), str)
            )
            and _integer(request.get("numItems"), 1, 128)
        )
    else:
        validate_erasure_domain(request.get("domain"))
        allowed = {"domain"}
        if operation in ("discoverPage", "verifyPage"):
            allowed.update(("table", "cursor", "endCursor", "numItems"))
            valid = (
                request.get("table") in DOMAINS
                and "cursor" in request
                and (request["cursor"] is None or isinstance(request["cursor"], str))
                and (
                    request.get("endCursor") is None
                    or isinstance(request.get("endCursor"), str)
                )
                and _integer(request.get("numItems"), 1, 128)
            )
        elif operation == "getReceiptPage":
            allowed.update(("operationId", "cursor", "numItems", "itemKey"))
            valid = (
                _text(request.get("operationId"))
                and "cursor" in request
                and (request["cursor"] is None or isinstance(request["cursor"], str))
                and _integer(request.get("numItems"), 1, 128)
                and ("itemKey" not in request or _text(request["itemKey"]))
            )
        else:
            allowed.update(("table", "id", "expectedFingerprint"))
            valid = (
                request.get("table") in DOMAINS
                and _text(request.get("id"))
                and _digest(request.get("expectedFingerprint"))
            )
            if operation == "eraseRecord":
                allowed.update(
                    (
                        "operationId",
                        "itemKey",
                        "requestDigest",
                        "domainDigest",
                        "graphInvocationId",
                    )
                )
                valid = (
                    valid
                    and _text(request.get("operationId"))
                    and _text(request.get("itemKey"))
                    and _digest(request.get("requestDigest"))
                    and _digest(request.get("domainDigest"))
                    and (
                        "graphInvocationId" not in request
                        or _text(request["graphInvocationId"])
                    )
                )
        valid = valid and set(request) <= allowed
    if not valid:
        raise DomainErasureError("ERASURE_PROTOCOL", operation)


def validate_erasure_transport(transport: Any) -> None:
    """Require the distinct complete capability before discovery or dry-run effects."""
    if (
        getattr(transport, "kind", None) != "cortex-erasure-v1"
        or type(getattr(transport, "protocol_version", None)) is not int
        or transport.protocol_version != 1
        or not isinstance(getattr(transport, "operations", None), (list, tuple))
        or tuple(getattr(transport, "operations", ())) != ERASURE_OPERATIONS
        or not all(
            callable(getattr(transport, name, None))
            for name in (
                "discover_page",
                "check_record",
                "check_binary_references",
                "verify_page",
                "get_receipt_page",
                "erase_record",
                "purge_expired_receipts_page",
                "close",
            )
        )
    ):
        raise DomainErasureError("ERASURE_TRANSPORT_REQUIRED", "capability")


class ErasureTransport:
    """Seven fixed administrator functions, bounded I/O and one-send semantics."""

    @property
    def kind(self) -> str:
        return "cortex-erasure-v1"

    @property
    def protocol_version(self) -> int:
        return 1

    @property
    def operations(self) -> tuple[str, ...]:
        return ERASURE_OPERATIONS

    def __init__(
        self,
        *,
        url: str,
        deployment_key: str,
        timeout: float = 30,
        socket_timeout: float = 5,
    ) -> None:
        try:
            parsed = urlsplit(url)
            port = (
                parsed.port
                if parsed.port is not None
                else (443 if parsed.scheme == "https" else 80)
            )
            valid = (
                parsed.scheme in ("http", "https")
                and bool(parsed.hostname)
                and parsed.username is None
                and parsed.password is None
                and not parsed.query
                and not parsed.fragment
                and parsed.path in ("", "/")
                and _text(deployment_key)
                and type(timeout) in (int, float)
                and math.isfinite(timeout)
                and 0 < timeout <= 30
                and type(socket_timeout) in (int, float)
                and math.isfinite(socket_timeout)
                and 0 < socket_timeout <= 5
                and 0 < port < 65536
            )
        except (TypeError, ValueError):
            valid = False
        if not valid:
            raise DomainErasureError("ERASURE_TRANSPORT_REQUIRED", "factory")
        self._hostname, self._port = parsed.hostname or "", port
        self._secure = parsed.scheme == "https"
        self._key, self._timeout, self._socket_timeout = (
            deployment_key,
            timeout,
            socket_timeout,
        )
        self._closed = False
        self._job: Optional[_Job] = None

    async def _call(
        self,
        operation: str,
        request: Dict[str, Any],
        *,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> Dict[str, Any]:
        _validate_request(operation, request)
        if self._closed or self._job is not None:
            raise DomainErasureError("ERASURE_TRANSPORT_BUSY", operation)
        if cancel_event is not None and cancel_event.is_set():
            raise DomainErasureError("ERASURE_CANCELLED", operation)
        try:
            body = json.dumps(
                {
                    "path": "domainErasure:" + operation,
                    "format": "convex_encoded_json",
                    "args": strict_convex_to_json(request),
                },
                separators=(",", ":"),
                allow_nan=False,
            ).encode("utf-8")
        except Exception:
            raise DomainErasureError("ERASURE_PROTOCOL", operation) from None
        if len(body) > _MAX_ARGUMENTS:
            raise DomainErasureError("ERASURE_REQUEST_TOO_LARGE", operation)
        job = _Job(operation, time.monotonic() + self._timeout, self._socket_timeout)
        self._job = job
        sent = False

        def work() -> Dict[str, Any]:
            nonlocal sent
            try:
                connection = _Connection(self._hostname, self._port, self._secure, job)
                job.connection = connection
                sent = True  # Conservatively unknown if a body may have been partially sent.
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
                while not response.isclosed():
                    if job.sock is not None:
                        job.sock.settimeout(job.remaining())
                    chunk = response.read1(16384)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > _MAX_RESPONSE:
                        raise DomainErasureError(
                            "ERASURE_RESPONSE_TOO_LARGE",
                            operation,
                            unknown_outcome=operation in _MUTATIONS,
                        )
                    chunks.append(chunk)
                job.remaining()
                if response.status in (401, 403):
                    raise DomainErasureError("ERASURE_AUTHORIZATION", operation)
                if response.status not in (200, 560):
                    raise DomainErasureError(
                        "ERASURE_TRANSPORT_FAILED",
                        operation,
                        unknown_outcome=operation in _MUTATIONS,
                    )
                envelope = json.loads(b"".join(chunks))
                if not isinstance(envelope, dict):
                    raise ValueError("Invalid envelope")
                if envelope.get("status") == "error":
                    data = json_to_convex(envelope.get("errorData"))
                    code = data.get("code") if isinstance(data, dict) else None
                    if not isinstance(code, str) or not re.fullmatch(
                        r"(?:ERASURE_|REFERENCE_|GRAPH_|SOURCE_|FACT_HISTORY_|BINARY_)[A-Z0-9_]{1,80}",
                        code,
                    ):
                        code = "ERASURE_NATIVE_REFUSED"
                    raise DomainErasureError(code, operation)
                if envelope.get("status") != "success" or response.status != 200:
                    raise ValueError("Incomplete native envelope")
                value = json_to_convex(envelope["value"])
                if (
                    not isinstance(value, dict)
                    or type(value.get("protocolVersion")) not in (int, float)
                    or value["protocolVersion"] != 1
                    or operation != "purgeExpiredReceiptsPage"
                    and (not _integer(value.get("observationTime"))
                         or value.get("domain") != request["domain"])
                ):
                    raise DomainErasureError(
                        "ERASURE_PROTOCOL",
                        operation,
                        unknown_outcome=operation in _MUTATIONS,
                    )
                return value
            except DomainErasureError:
                raise
            except Exception:
                code = (
                    "ERASURE_CANCELLED"
                    if job.cancelled.is_set()
                    else "ERASURE_DEADLINE"
                    if time.monotonic() >= job.deadline
                    else "ERASURE_RESPONSE_UNKNOWN"
                )
                raise DomainErasureError(
                    code, operation, unknown_outcome=sent and operation in _MUTATIONS
                ) from None
            finally:
                job.finish()

        executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=1, thread_name_prefix="cortex-erasure"
        )
        future = executor.submit(work)
        wrapped = asyncio.wrap_future(future)
        cancellation = (
            asyncio.create_task(cancel_event.wait())
            if cancel_event is not None
            else None
        )
        try:
            done, _ = await asyncio.wait(
                [wrapped] + ([cancellation] if cancellation else []),
                timeout=self._timeout,
                return_when=asyncio.FIRST_COMPLETED,
            )
            if wrapped in done:
                return wrapped.result()
            raise DomainErasureError(
                "ERASURE_CANCELLED" if cancellation in done else "ERASURE_DEADLINE",
                operation,
                unknown_outcome=sent and operation in _MUTATIONS,
            )
        except asyncio.CancelledError:
            raise DomainErasureError("ERASURE_CANCELLED", operation,
                                     unknown_outcome=sent and operation in _MUTATIONS) from None
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
                raise DomainErasureError("ERASURE_CANCELLED", operation,
                                         unknown_outcome=sent and operation in _MUTATIONS)

    async def discover_page(
        self, request: Dict[str, Any], **kwargs: Any
    ) -> Dict[str, Any]:
        return await self._call("discoverPage", request, **kwargs)

    async def check_record(
        self, request: Dict[str, Any], **kwargs: Any
    ) -> Dict[str, Any]:
        return await self._call("checkRecord", request, **kwargs)

    async def check_binary_references(
        self, request: Dict[str, Any], **kwargs: Any
    ) -> Dict[str, Any]:
        return await self._call("checkBinaryReferences", request, **kwargs)

    async def verify_page(
        self, request: Dict[str, Any], **kwargs: Any
    ) -> Dict[str, Any]:
        return await self._call("verifyPage", request, **kwargs)

    async def get_receipt_page(
        self, request: Dict[str, Any], **kwargs: Any
    ) -> Dict[str, Any]:
        return await self._call("getReceiptPage", request, **kwargs)

    async def erase_record(
        self, request: Dict[str, Any], **kwargs: Any
    ) -> Dict[str, Any]:
        return await self._call("eraseRecord", request, **kwargs)

    async def purge_expired_receipts_page(
        self, request: Dict[str, Any], **kwargs: Any
    ) -> Dict[str, Any]:
        return await self._call("purgeExpiredReceiptsPage", request, **kwargs)

    def close(self) -> None:
        self._closed = True
        if self._job is not None:
            self._job.cancelled.set()
            self._job.interrupt()


def create_erasure_transport(
    *, url: str, deployment_key: str, timeout: float = 30, socket_timeout: float = 5
) -> ErasureTransport:
    return ErasureTransport(
        url=url,
        deployment_key=deployment_key,
        timeout=timeout,
        socket_timeout=socket_timeout,
    )


def erasure_control_digest(value: Dict[str, Any]) -> str:
    """Official codec/order and JSON string encoding for string-only control records.

    Row fingerprints are native evidence. This deliberately does not serialize
    numeric payloads or try to reproduce JavaScript floating-point rendering.
    """
    def emit(part: Any) -> str:
        if isinstance(part, str):
            return _export_string_text(part)
        if isinstance(part, dict):
            return "{" + ",".join(_export_string_text(key) + ":" + emit(item)
                                  for key, item in part.items()) + "}"
        raise DomainErasureError("ERASURE_PROTOCOL", "canonicalControl")
    return hashlib.sha256(emit(canonical_user_export_value(value)).encode("utf-8")).hexdigest()


def _active(options: Any) -> None:
    event = getattr(options, "cancel_event", None)
    if event is not None and event.is_set():
        raise DomainErasureError("ERASURE_CANCELLED", "preflight")


def _envelope(value: Any, domain: Dict[str, Any]) -> None:
    if (not isinstance(value, dict) or not _integer(value.get("protocolVersion"), 1, 1)
            or not _integer(value.get("observationTime")) or value.get("domain") != domain):
        raise DomainErasureError("ERASURE_PROTOCOL", "envelope")


def _projection(value: Any, table: str) -> Dict[str, Any]:
    if (not isinstance(value, dict) or value.get("table") != table
            or table not in DOMAINS or not _text(value.get("id"))
            or not _digest(value.get("fingerprint"))
            or value.get("action") not in ("delete", "detach", "root", "preserve", "block")
            or not isinstance(value.get("dependencies"), list)
            or not all(isinstance(edge, dict) and set(edge) == {"id", "kind"}
                       and _text(edge["id"]) and edge["kind"] in ("hard", "data")
                       for edge in value["dependencies"])
            or not all(_integer(value.get(key)) for key in ("retainedVersions", "messages", "serializedBytes"))
            or not isinstance(value.get("storageIds"), list)
            or not all(_text(item) for item in value["storageIds"])
            or "managedQueueCount" in value and not _integer(value["managedQueueCount"])):
        raise DomainErasureError("ERASURE_PROTOCOL", "projection")
    return value


async def discover_erasure(domain: Dict[str, Any], transport: Any, options: Any,
                           *, verify: bool = False) -> list[Dict[str, Any]]:
    """Exhaust all 17 fixed domains, discarding provisional split-page rows."""
    found: Dict[str, Dict[str, Any]] = {}
    tables = list(DOMAINS)
    if domain["kind"] == "space":
        tables.remove("memorySpaces")
        tables.insert(0, "memorySpaces")
    call = transport.verify_page if verify else transport.discover_page
    for table in tables:
        ranges: list[tuple[Optional[str], Optional[str]]] = [(None, None)]
        visited: set[tuple[Optional[str], Optional[str]]] = set()
        while ranges:
            _active(options)
            cursor, end = ranges.pop(0)
            if (cursor, end) in visited:
                raise DomainErasureError("ERASURE_PAGE_NONPROGRESS", "discovery")
            visited.add((cursor, end))
            page = await call({"domain": domain, "table": table, "cursor": cursor,
                               "endCursor": end, "numItems": 16},
                              cancel_event=getattr(options, "cancel_event", None))
            _envelope(page, domain)
            if (page.get("table") != table or not isinstance(page.get("page"), list)
                    or not isinstance(page.get("continueCursor"), str)
                    or type(page.get("isDone")) is not bool
                    or page.get("pageStatus") not in (None, "SplitRequired", "SplitRecommended")):
                raise DomainErasureError("ERASURE_PROTOCOL", "discovery")
            next_cursor = page["continueCursor"]
            if page.get("pageStatus") in ("SplitRequired", "SplitRecommended"):
                split = page.get("splitCursor")
                if not _text(split) or split in (cursor, end, next_cursor):
                    raise DomainErasureError("ERASURE_PAGE_NONPROGRESS", "discovery")
                children = [(cursor, split), (split, next_cursor)]
                if not page["isDone"]:
                    children.append((next_cursor, end))
                ranges[0:0] = children
                continue
            for row in page["page"]:
                record = _projection(row, table)
                previous = found.get(record["id"])
                if previous is not None and previous != record:
                    raise DomainErasureError("ERASURE_SELECTION_CHANGED", "discovery")
                found[record["id"]] = deepcopy(record)
            if not page["isDone"]:
                if next_cursor == cursor:
                    raise DomainErasureError("ERASURE_PAGE_NONPROGRESS", "discovery")
                ranges.insert(0, (next_cursor, end))
    return list(found.values())


def order_erasure(records: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    """Hard dependencies form a DAG; ordinary data cycles use stable table/ID order."""
    selected = [row for row in records if row["action"] in ("delete", "detach", "root")]
    nodes = {row["id"]: row for row in selected}
    degree = dict.fromkeys(nodes, 0)
    edges: Dict[str, set[str]] = {}
    for row in selected:
        for edge in row["dependencies"]:
            if edge["kind"] == "hard" and edge["id"] in nodes:
                outgoing = edges.setdefault(row["id"], set())
                if edge["id"] not in outgoing:
                    degree[edge["id"]] += 1
                    outgoing.add(edge["id"])
    def rank(row: Dict[str, Any]) -> tuple[int, str]:
        return (100 if row["action"] == "root" else 90 if row["action"] == "detach"
                else DOMAINS.index(row["table"]), row["id"])
    ready = sorted((row for row in selected if degree[row["id"]] == 0), key=rank)
    result = []
    while ready:
        index = next((i for i, candidate in enumerate(ready)
                      if not any(other["id"] != candidate["id"] and any(
                          edge["id"] == candidate["id"] for edge in other["dependencies"])
                                 for other in ready)), 0)
        row = ready.pop(index)
        result.append(row)
        for id_ in edges.get(row["id"], ()):
            degree[id_] -= 1
            if degree[id_] == 0:
                ready.append(nodes[id_])
                ready.sort(key=rank)
    if len(result) != len(selected):
        raise DomainErasureError("ERASURE_DEPENDENCY_CYCLE", "ordering")
    return [row for action in ("delete", "detach", "root") for row in result if row["action"] == action]


def _graph_item(value: Any) -> Any:
    from ..graph.erasure import (
        GraphErasureEvidence,
        GraphErasureItem,
        validate_erasure_item,
    )
    from ..types import GraphIdentity
    try:
        identity, evidence = value["identity"], value["evidence"]
        item = GraphErasureItem(GraphIdentity(
            identity["tenantKnown"], identity["tenantId"], identity["memorySpaceId"],
            identity["schemaVersion"], identity["kind"], identity["physicalSourceId"],
            identity["key"], identity["tupleJson"]), value["sourceRevision"],
            value["ownershipRevision"], value["referenceGeneration"], value["referenceRevision"],
            GraphErasureEvidence(evidence["targetId"], evidence["generation"],
                                 evidence["physicalSourceId"], evidence["scopeKnown"]))
        validate_erasure_item(item)
        return item
    except (KeyError, TypeError, AttributeError):
        raise DomainErasureError("ERASURE_PROTOCOL", "graphProjection") from None


@dataclass
class PreparedErasure:
    receipt: ErasureReceipt
    order: list[Dict[str, Any]]
    graph: list[Any]
    options: Any


async def prepare_erasure(domain: Dict[str, Any], options: Any,
                          configured_adapter: Any = None) -> PreparedErasure:
    validate_erasure_domain(domain)
    transport: Any = getattr(options, "erasure_transport", None)
    validate_erasure_transport(transport)
    _active(options)
    participant = getattr(options, "graph_participant", None)
    if configured_adapter is not None and (participant is None or participant.adapter is not configured_adapter):
        raise DomainErasureError("ERASURE_GRAPH_PARTICIPANT_REQUIRED", "preflight")
    planned = await discover_erasure(domain, transport, options)
    order = order_erasure(planned)
    now = int(time.time() * 1000)
    receipt = ErasureReceipt(str(uuid4()), deepcopy(domain), now, now, planned,
                            [row["id"] for row in order],
                            {table: {"deleted": 0, "detached": 0, "preserved": sum(
                                row["table"] == table and row["action"] == "preserve" for row in planned),
                                     "alreadyAbsent": 0, "retainedVersions": 0} for table in DOMAINS})
    receipt.graph["state"] = "prepared" if participant else "notConfigured"
    receipt.exclusions = ["sharedRegistry", "operationalGovernance", "protectedOperationalProvenance",
                          "temporarySevenDayReceipts", "externalManualOrPreviouslyConfiguredGraph"]
    receipt.blockers = [{"id": row["id"], "reason": row.get("reason", "ERASURE_BLOCKED")}
                        for row in planned if row["action"] == "block"]
    try:
        if receipt.blockers:
            raise DomainErasureError("ERASURE_PREFLIGHT_BLOCKED", "preflight")
        for record in order:
            _active(options)
            request = {"domain": domain, "table": record["table"], "id": record["id"],
                       "expectedFingerprint": record["fingerprint"]}
            checked = await transport.check_record(request, cancel_event=getattr(options, "cancel_event", None))
            _envelope(checked, domain)
            if checked.get("record") is None or _projection(checked["record"], record["table"]) != record:
                raise DomainErasureError("ERASURE_SELECTION_CHANGED", "preflight")
            binary = await transport.check_binary_references(request, cancel_event=getattr(options, "cancel_event", None))
            _envelope(binary, domain)
            if not isinstance(binary.get("blobs"), list):
                raise DomainErasureError("ERASURE_PROTOCOL", "binaryPreflight")
            if record.get("managedQueueCount", 0) and participant is None:
                raise DomainErasureError("ERASURE_GRAPH_PARTICIPANT_REQUIRED", "preflight")
        graph = []
        if participant:
            from ..graph.erasure import prepare_graph_erasure
            graph = await prepare_graph_erasure([_graph_item(row["graph"]) for row in order if "graph" in row],
                                               adapter=participant.adapter, disposal_transport=participant.disposal_transport)
        return PreparedErasure(receipt, order, graph, options)
    except DomainErasureError as error:
        error.receipt = receipt
        raise
    except Exception as error:
        raise DomainErasureError("ERASURE_PREFLIGHT_FAILED", "preflight", receipt=receipt) from error


def _merge_outcome(receipt: ErasureReceipt, record: Dict[str, Any], value: Any) -> None:
    _envelope(value, receipt.domain)
    if (value.get("operationId") != receipt.operation_id or value.get("itemKey") != f'{record["table"]}:{record["id"]}'
            or value.get("id") != record["id"] or value.get("table") != record["table"]
            or value.get("state") not in ("committed", "alreadyAbsent")
            or not all(_integer(value.get(key), 0, 1) for key in ("deleted", "detached"))
            or value["deleted"] + value["detached"] > 1
            or not all(_integer(value.get(key)) for key in ("retainedVersions", "messages"))
            or "serializedBytes" in value and not _integer(value["serializedBytes"])
            or not isinstance(value.get("blobs"), list) or not isinstance(value.get("graphJobs"), list)
            or value["state"] == "alreadyAbsent" and any(value[key] != 0 for key in ("deleted", "detached", "retainedVersions", "messages"))):
        raise DomainErasureError("ERASURE_PROTOCOL", "outcome", receipt=receipt)
    receipt.outcomes.append(deepcopy(value))
    receipt.remaining = [id_ for id_ in receipt.remaining if id_ != record["id"]]
    counts = receipt.per_table[record["table"]]
    if value["state"] == "committed":
        counts["deleted"] += int(value["deleted"])
        counts["detached"] += int(value["detached"])
        counts["retainedVersions"] += int(value["retainedVersions"])
        receipt.total_deleted += int(value["deleted"])
    else:
        counts["alreadyAbsent"] += 1
    receipt.graph["jobs"].extend(value["graphJobs"])


async def execute_erasure(prepared: PreparedErasure, client: Any) -> ErasureReceipt:
    """One primary send per selected physical item; unknown responses read original receipts."""
    receipt, options, transport = prepared.receipt, prepared.options, prepared.options.erasure_transport
    if options.dry_run:
        receipt.ended_at = int(time.time() * 1000)
        return receipt
    participant = options.graph_participant
    delivered: list[Any] = []
    async def graph_verified() -> None:
        from ..graph.erasure import graph_receipt_from_wire, verify_graph_erasure
        result = await verify_graph_erasure([item.item for item in delivered], adapter=participant.adapter,
                                           disposal_transport=participant.disposal_transport,
                                           jobs=[graph_receipt_from_wire(job) for job in receipt.graph["jobs"]])
        if not result["complete"]:
            raise DomainErasureError("ERASURE_GRAPH_INCOMPLETE", "graphVerify")
    try:
        for record in prepared.order:
            _active(options)
            if record["action"] == "root":
                current = await discover_erasure(receipt.domain, transport, options, verify=True)
                if any(row["id"] != record["id"] and row["action"] in ("delete", "detach", "root", "block") for row in current):
                    raise DomainErasureError("ERASURE_REMAINING_PRIMARY", "rootGuard")
                if participant and delivered:
                    await graph_verified()
            request = {"domain": receipt.domain, "table": record["table"], "id": record["id"],
                       "expectedFingerprint": record["fingerprint"], "operationId": receipt.operation_id,
                       "itemKey": f'{record["table"]}:{record["id"]}', "domainDigest": erasure_control_digest(receipt.domain)}
            if participant:
                request["graphInvocationId"] = f'{receipt.operation_id}:{record["id"]}'
            request["requestDigest"] = erasure_control_digest(request)
            try:
                outcome = await transport.erase_record(request, cancel_event=options.cancel_event)
            except DomainErasureError as error:
                if not error.unknown_outcome:
                    raise
                receipt.unknown.append(record["id"])
                reconciled = await transport.get_receipt_page({"domain": receipt.domain, "operationId": receipt.operation_id,
                                                              "itemKey": request["itemKey"], "cursor": None, "numItems": 2})
                _envelope(reconciled, receipt.domain)
                if not isinstance(reconciled.get("page"), list) or len(reconciled["page"]) != 1:
                    raise DomainErasureError("ERASURE_OUTCOME_UNKNOWN", "reconcile")
                outcome = reconciled["page"][0]
            try:
                _merge_outcome(receipt, record, outcome)
            except DomainErasureError:
                if record["id"] not in receipt.unknown:
                    receipt.unknown.append(record["id"])
                raise
            receipt.unknown = [id_ for id_ in receipt.unknown if id_ != record["id"]]
            receipt.executed = True
            graph = next((item for item in prepared.graph if item.item.identity.physical_source_id == record["id"]), None)
            if graph and outcome["state"] == "committed":
                from ..graph.erasure import erase_graph_item, graph_receipt_from_wire
                result = await erase_graph_item(graph, client=client, jobs=[graph_receipt_from_wire(job) for job in outcome["graphJobs"]])
                receipt.graph["nodesDeleted"] += result.nodes_deleted
                delivered.append(graph)
        if participant:
            await graph_verified()
            receipt.graph["state"] = "complete"
        if options.verify is False:
            receipt.verification = {"state": "notRequested", "complete": False}
        else:
            remaining = await discover_erasure(receipt.domain, transport, options, verify=True)
            receipt.remaining = [row["id"] for row in remaining if row["action"] in ("delete", "detach", "root", "block")]
            receipt.verification = {"state": "failed" if receipt.remaining else "verified", "complete": not receipt.remaining}
            if receipt.remaining:
                raise DomainErasureError("ERASURE_POSTVERIFY_FAILED", "verification")
        receipt.complete = receipt.verification["complete"]
        receipt.ended_at = int(time.time() * 1000)
        return receipt
    except (Exception, asyncio.CancelledError) as error:
        receipt.ended_at = int(time.time() * 1000)
        code = error.code if isinstance(error, DomainErasureError) else "ERASURE_CANCELLED" if isinstance(error, asyncio.CancelledError) else "ERASURE_PARTIAL"
        receipt.errors.append(code)
        if participant:
            receipt.graph["state"] = "partial"
        raise DomainErasureError(code, "execution", receipt=receipt) from error
