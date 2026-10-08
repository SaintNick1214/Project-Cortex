"""Fixed ordinary domain paging and truthful physical-item outcomes.

Caller scope selects data; it does not authenticate the caller. The caller owns
the client. An in-flight timeout cannot establish transaction rollback.
"""
import asyncio
import time
from typing import Any, AsyncIterator, Awaitable, Callable, Dict, List, Optional
from uuid import uuid4

from ._utils import filter_none_values
from .auth.validators import validate_tenant_id


class DomainOperationPartialError(RuntimeError):
    """First failure, immutable original advisory intents, and confirmed lower bound."""

    def __init__(self, operation: str, partial: Dict[str, Any], cause: BaseException):
        super().__init__(f"{operation} incomplete; inspect partial outcomes before retrying")
        self.partial = partial
        self.original_cause = cause


def resolve_scope(context: Optional[str], selected: Optional[str] = None) -> Optional[str]:
    validate_tenant_id(context)
    validate_tenant_id(selected)
    if context is not None and selected is not None and context != selected:
        raise ValueError("TENANT_SCOPE_MISMATCH")
    return selected if selected is not None else context


def natural(value: Any, default: Optional[int] = None) -> int:
    if value is None and default is not None:
        return default
    if type(value) is not int or value < 0 or value > 2**53 - 1:
        raise ValueError("DOMAIN_INVALID_WINDOW")
    return int(value)


def active(options: Any = None) -> None:
    event = getattr(options, "cancel_event", None)
    if event is not None and event.is_set():
        raise ValueError("DOMAIN_CANCELLED")


def _consume(task: "asyncio.Future[Any]") -> None:
    if not task.cancelled():
        task.exception()


async def wait_operation(operation: Awaitable[Any], options: Any = None, *, milliseconds: Optional[float] = None) -> Any:
    configured = getattr(options, "deadline_ms", None)
    duration = milliseconds if milliseconds is not None else (configured if configured is not None else 30000)
    if type(duration) not in (int, float) or not 0 < duration < float("inf"):
        if asyncio.iscoroutine(operation):
            operation.close()
        raise ValueError("DOMAIN_INVALID_DEADLINE")
    task = asyncio.ensure_future(operation)
    task.add_done_callback(_consume)
    cancel = None
    try:
        event = getattr(options, "cancel_event", None)
        cancel = asyncio.create_task(event.wait()) if event is not None else None
        done, _ = await asyncio.wait([task] + ([cancel] if cancel else []), timeout=duration / 1000, return_when=asyncio.FIRST_COMPLETED)
        if task in done:
            return task.result()
        if cancel in done:
            raise ValueError("DOMAIN_CANCELLED")
        raise TimeoutError("DOMAIN_DEADLINE_EXCEEDED")
    finally:
        if cancel is not None:
            cancel.cancel()
            await asyncio.gather(cancel, return_exceptions=True)
        # Keep observing the original in-flight operation; never resend it or
        # cancel/close a caller-owned WebSocket transport to infer rollback.


def loader(client: Any, domain: str, args: Dict[str, Any]) -> Callable[[Dict[str, Any]], Awaitable[Any]]:
    if domain not in ("memories", "facts", "conversations"):
        raise ValueError("DOMAIN_INVALID_SERVICE")
    selected = filter_none_values(dict(args))
    if domain == "facts" and args.get("selectionMode") == "delete":
        selected.setdefault("deleteOperationPrefix", str(uuid4()))
    service = "facts:candidatePage" if domain == "facts" else f"{domain}:domainPage"

    async def load(range_: Dict[str, Any]) -> Any:
        return await client.query(service, {**selected, **({"operation": "list"} if domain == "facts" else {}), "paginationOpts": {**range_, "numItems": 16 if domain == "facts" and args.get("selectionMode") in ("delete", "archive") else 128}})
    return load


async def pages(load: Callable[[Dict[str, Any]], Awaitable[Any]], options: Any = None) -> AsyncIterator[Dict[str, Any]]:
    duration = getattr(options, "deadline_ms", None)
    if duration is None:
        duration = 60000
    if type(duration) not in (int, float) or not 0 < duration < float("inf"):
        raise ValueError("DOMAIN_INVALID_DEADLINE")
    expires = time.monotonic() + duration / 1000
    queue: List[Dict[str, Any]] = [{"cursor": None, "endCursor": None}]
    seen = set()
    while queue:
        range_ = queue.pop(0)
        while True:
            active(options)
            key = (range_["cursor"], range_["endCursor"])
            if key in seen:
                raise ValueError("DOMAIN_NONADVANCING_CURSOR")
            seen.add(key)
            value = await wait_operation(load(range_), milliseconds=(expires - time.monotonic()) * 1000, options=options)
            if not isinstance(value, dict) or not isinstance(value.get("page"), list) or type(value.get("isDone")) is not bool or not isinstance(value.get("continueCursor"), str) or value.get("pageStatus") not in (None, "SplitRequired", "SplitRecommended"):
                raise ValueError("DOMAIN_INVALID_PAGE")
            if value.get("pageStatus") == "SplitRequired":
                split = value.get("splitCursor")
                if not isinstance(split, str) or not split or split in key:
                    raise ValueError("DOMAIN_INVALID_SPLIT")
                queue.insert(0, {"cursor": split, "endCursor": range_["endCursor"]})
                range_ = {"cursor": range_["cursor"], "endCursor": split}
                continue
            if not value["isDone"] and (not value["continueCursor"] or value["continueCursor"] == range_["cursor"]):
                raise ValueError("DOMAIN_NONADVANCING_CURSOR")
            yield value
            if value["isDone"] or (range_["endCursor"] is not None and value["continueCursor"] == range_["endCursor"]):
                break
            range_ = {**range_, "cursor": value["continueCursor"]}


async def collect(load: Callable[[Dict[str, Any]], Awaitable[Any]], options: Any = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    if limit is not None:
        natural(limit)
    if limit == 0:
        return []
    records: Dict[str, Dict[str, Any]] = {}
    async for page in pages(load, options):
        for row in page["page"]:
            if not isinstance(row, dict) or not isinstance(row.get("_id"), str):
                raise ValueError("DOMAIN_INVALID_RECORD")
            records.setdefault(row["_id"], row)
            if limit is not None and len(records) >= limit:
                return list(records.values())
    return list(records.values())


async def select(load: Callable[[Dict[str, Any]], Awaitable[Any]], options: Any = None) -> List[Dict[str, Any]]:
    import re
    records: Dict[str, Dict[str, Any]] = {}
    async for page in pages(load, options):
        for row in page["page"]:
            fingerprint = page.get("fingerprints", {}).get(row.get("_id"))
            if not isinstance(row.get("_id"), str) or not isinstance(fingerprint, str) or re.fullmatch(r"[a-f0-9]{64}", fingerprint) is None:
                raise ValueError("DOMAIN_INVALID_FINGERPRINT")
            previous = records.get(row["_id"])
            if previous and previous["fingerprint"] != fingerprint:
                raise ValueError("DOMAIN_SELECTION_CHANGED")
            intent = next((item for item in page.get("deleteIntents", []) if item["physicalId"] == row["_id"]), None)
            records[row["_id"]] = {"document": row, "physicalId": row["_id"], "fingerprint": fingerprint, "deleteIntent": intent}
    return list(records.values())


def same_selection(before: List[Dict[str, Any]], after: List[Dict[str, Any]]) -> bool:
    return {x["physicalId"]: x["fingerprint"] for x in before} == {x["physicalId"]: x["fingerprint"] for x in after}


def partial(outcomes: List[Dict[str, Any]], intents: Optional[List[Any]] = None) -> Dict[str, Any]:
    confirmed = [x["physicalId"] for x in outcomes if x["disposition"] == "knownCommitted"]
    unknown = [x["physicalId"] for x in outcomes if x["disposition"] == "outcomeUnknown"]
    return {"outcomes": outcomes, "confirmedPhysicalIds": confirmed, "unknownPhysicalIds": unknown, "remainingPhysicalIds": [x["physicalId"] for x in outcomes if x["disposition"] not in ("knownCommitted", "alreadyAbsent")], "unstartedPhysicalIds": [x["physicalId"] for x in outcomes if x["disposition"] == "unstarted"], "confirmedCount": len(confirmed), "possibleCount": len(confirmed) + len(unknown), "originalIntents": intents}


def definite_failure(error: BaseException) -> bool:
    from convex import ConvexError, ConvexExecutionError
    current: Optional[BaseException] = error
    while current is not None:
        if isinstance(current, (ConvexError, ConvexExecutionError)):
            return True
        current = current.__cause__
    return False


def receipt_matches(receipt: Dict[str, Any], item: Dict[str, Any]) -> bool:
    return receipt.get("committed") is True and item["physicalId"] in receipt.get("affectedFactIds", []) and bool(receipt.get("events")) and all(e.get("pending", {}).get("payload", {}).get("requestDigest") == item["requestDigest"] for e in receipt["events"])


async def mutate(client: Any, domain: str, selected: List[Dict[str, Any]], args: Dict[str, Any], options: Any = None) -> Dict[str, Any]:
    if domain not in ("memories", "facts", "conversations"):
        raise ValueError("DOMAIN_INVALID_SERVICE")
    outcomes = [{"physicalId": row["physicalId"], "disposition": "unstarted"} for row in selected]
    intents = [row.get("deleteIntent") for row in selected] if domain == "facts" else None
    for i, row in enumerate(selected):
        try:
            active(options)
        except BaseException as cause:
            raise DomainOperationPartialError(domain, partial(outcomes, intents), cause) from cause
        request = row.get("deleteIntent", {}).get("request") if domain == "facts" else {**args, "physicalId": row["physicalId"], "expectedFingerprint": row["fingerprint"]}
        if not request:
            raise ValueError("DOMAIN_INVALID_DELETE_INTENT")
        try:
            result = await wait_operation(client.mutation("facts:deleteMany" if domain == "facts" else f"{domain}:eraseSelected", filter_none_values(request)), options)
            outcomes[i]["disposition"] = "knownCommitted" if result["deleted"] else "alreadyAbsent"
            if result.get("graphIdentity"):
                outcomes[i]["graphIdentity"] = result["graphIdentity"]
        except BaseException as cause:
            outcomes[i]["disposition"] = "knownRolledBack" if definite_failure(cause) else "outcomeUnknown"
            if domain == "facts" and not definite_failure(cause):
                item = row["deleteIntent"]
                try:
                    receipt = await wait_operation(client.query("factHistory:getOperationReceipt", filter_none_values({"memorySpaceId": args["memorySpaceId"], "tenantId": args.get("tenantId"), "operationId": item["operationId"], "phase": "physical_delete"})), options)
                    if receipt and receipt_matches(receipt, item):
                        outcomes[i]["disposition"] = "knownCommitted"
                except BaseException:
                    pass
            raise DomainOperationPartialError(domain, partial(outcomes, intents), cause) from cause
    return partial(outcomes, intents)
