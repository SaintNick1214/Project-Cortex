"""Complete rolling rebuild through two fixed administrative query services."""

import math
import time
from dataclasses import asdict
from typing import Any, AsyncIterator, Dict, Optional

from ..types import (
    BatchSyncError,
    BatchSyncOptions,
    BatchSyncResult,
    GraphApplyResult,
    GraphJob,
)
from .erasure import apply_graph_rebuild_snapshot
from .errors import GraphDatabaseError
from .identity import GRAPH_TABLES, graph_job_from_wire, safe_integer
from .schema.init_schema import assert_managed_graph_compatibility


class GraphRebuildPartialError(GraphDatabaseError):
    def __init__(self, result: BatchSyncResult, original_error: BaseException) -> None:
        super().__init__("Graph rebuild stopped after confirmed work; counts are partial.", "GRAPH_REBUILD_PARTIAL")
        self.result, self.original_error = result, original_error


def _page(value: Any) -> Dict[str, Any]:
    if not isinstance(value, dict) or value.get("schemaVersion") != 2 or not isinstance(value.get("page"), list) or type(value.get("isDone")) is not bool or not isinstance(value.get("continueCursor"), str) or value.get("pageStatus") not in (None, "SplitRequired", "SplitRecommended") or value.get("splitCursor") is not None and not isinstance(value["splitCursor"], str):
        raise GraphDatabaseError("Invalid native graph rebuild page.", "GRAPH_REBUILD_INVALID_PAGE")
    return value


async def graph_rebuild_pages(load: Any) -> AsyncIterator[Dict[str, Any]]:
    ranges = [{"cursor": None, "endCursor": None}]
    seen = set()
    while ranges:
        range_ = ranges.pop(0)
        while True:
            key = (range_["cursor"], range_["endCursor"])
            if key in seen:
                raise GraphDatabaseError("Native rebuild cursor did not advance.", "GRAPH_REBUILD_NONADVANCING_CURSOR")
            seen.add(key)
            page = _page(await load({**range_, "numItems": 8}))
            if page.get("pageStatus") == "SplitRequired":
                split = page.get("splitCursor")
                if not split or split in key:
                    raise GraphDatabaseError("Invalid native rebuild split.", "GRAPH_REBUILD_INVALID_PAGE")
                ranges.insert(0, {"cursor": split, "endCursor": range_["endCursor"]})
                range_ = {"cursor": range_["cursor"], "endCursor": split}
                continue
            if not page["isDone"] and (not page["continueCursor"] or page["continueCursor"] == range_["cursor"]):
                raise GraphDatabaseError("Native rebuild cursor did not advance.", "GRAPH_REBUILD_NONADVANCING_CURSOR")
            yield page
            if page["isDone"] or range_["endCursor"] is not None and page["continueCursor"] == range_["endCursor"]:
                break
            range_ = {**range_, "cursor": page["continueCursor"]}


def _sum(target: GraphApplyResult, value: GraphApplyResult) -> None:
    for field in ("nodes_created", "nodes_deleted", "relationships_created", "relationships_deleted"):
        setattr(target, field, getattr(target, field) + getattr(value, field))
    target.absent_targets.extend(value.absent_targets)


def _table_field(table: str) -> str:
    return "memory_spaces" if table == "memorySpaces" else table


async def initial_graph_sync(cortex: Any, adapter: Any, options: Optional[BatchSyncOptions] = None) -> BatchSyncResult:
    """The Cortex argument is retained for compatibility; it supplies no authority."""
    opts = options or BatchSyncOptions()
    if opts.transport is None:
        raise GraphDatabaseError("Pass an explicit administrator rebuild transport.", "GRAPH_REBUILD_TRANSPORT_REQUIRED")
    transport = opts.transport
    start = time.monotonic()
    result = BatchSyncResult(scope={**({"tenantId": opts.tenant_id} if opts.tenant_id is not None else {}), **({"memorySpaceId": opts.memory_space_id} if opts.memory_space_id is not None else {})})
    current = None
    try:
        if opts.deadline_ms is not None and (type(opts.deadline_ms) not in (int, float) or not math.isfinite(opts.deadline_ms) or opts.deadline_ms <= 0):
            raise GraphDatabaseError("Invalid optional rebuild deadline.", "GRAPH_REBUILD_CANCELLED")
        expires = math.inf if opts.deadline_ms is None else start + opts.deadline_ms / 1000
        limits = opts.limits if isinstance(opts.limits, dict) else asdict(opts.limits) if opts.limits is not None else {}
        limits = {key: value for key, value in limits.items() if value is not None}
        if any(not safe_integer(value) or value < 0 for value in limits.values()):
            raise GraphDatabaseError("Rebuild limits must be explicit nonnegative safe integers.", "GRAPH_REBUILD_LIMIT_INVALID")

        def request() -> Dict[str, Any]:
            if opts.cancel_event is not None and opts.cancel_event.is_set() or time.monotonic() >= expires:
                raise GraphDatabaseError("Rebuild cancelled or deadline expired.", "GRAPH_REBUILD_CANCELLED")
            return {"cancel_event": opts.cancel_event, "timeout_ms": min(30000, (expires - time.monotonic()) * 1000)}

        request()
        await assert_managed_graph_compatibility(adapter)
        selected = []
        for table, kind in GRAPH_TABLES.items():
            field = _table_field(table)
            if opts.memory_space_id is not None and table in ("immutable", "mutable"):
                result.excluded_kinds.append(table)
                continue
            seen: Dict[str, str] = {}
            maximum = limits.get(table, limits.get(field, math.inf))
            result.confirmed_physical_ids[table] = []
            stats = getattr(result, field)
            if maximum == 0:
                result.limited = True
                continue

            async def source(range_: Any, kind: str = kind) -> Any:
                return await transport.source_page({"version": 2, "kind": kind, **result.scope, "paginationOpts": range_}, **request())

            async for page in graph_rebuild_pages(source):
                for index, value in enumerate(page["page"]):
                    snapshot = graph_job_from_wire(value)
                    identity = snapshot.identity
                    current = (field, identity.physical_source_id)
                    if snapshot.table != table or identity.tenant_id != opts.tenant_id or opts.memory_space_id is not None and identity.memory_space_id != opts.memory_space_id:
                        raise GraphDatabaseError("Native rebuild returned another scope or kind.", "GRAPH_SCOPE_MISMATCH")
                    prior = seen.get(identity.physical_source_id)
                    if prior is not None:
                        if prior != snapshot.projection_digest:
                            raise GraphDatabaseError("Repeated physical source changed during rebuild.", "GRAPH_REBUILD_SOURCE_CHANGED")
                        continue
                    request()
                    _sum(result.graph, await apply_graph_rebuild_snapshot(adapter, snapshot, "nodes"))
                    seen[identity.physical_source_id] = snapshot.projection_digest
                    selected.append((field, snapshot))
                    stats.synced += 1
                    result.confirmed_physical_ids[table].append(identity.physical_source_id)
                    if opts.on_progress:
                        opts.on_progress(table, stats.synced, stats.synced)
                    if stats.synced >= maximum:
                        result.limited = result.limited or not page["isDone"] or index != len(page["page"]) - 1
                        break
                if stats.synced >= maximum:
                    result.limited = result.limited or not page["isDone"]
                    break
        if opts.sync_relationships:
            for field, item in selected:
                current = (field, item.identity.physical_source_id)
                edge_snapshot: Optional[GraphJob] = None

                async def edge(range_: Any) -> Any:
                    return await transport.edge_page({"version": 2, "kind": item.identity.kind, **result.scope, "physicalSourceId": item.identity.physical_source_id,
                        "expectedSourceRevision": item.source_revision, "expectedOwnershipRevision": item.ownership_revision,
                        "expectedReferenceGeneration": item.reference_generation, "paginationOpts": range_}, **request())

                async for page in graph_rebuild_pages(edge):
                    next_snapshot = graph_job_from_wire(page["snapshot"])
                    if next_snapshot.identity.physical_source_id != item.identity.physical_source_id or next_snapshot.source_digest != item.source_digest or edge_snapshot is not None and edge_snapshot.projection_digest != next_snapshot.projection_digest:
                        raise GraphDatabaseError("Physical source/edge snapshot changed during rolling rebuild.", "GRAPH_REBUILD_SOURCE_CHANGED")
                    edge_snapshot = next_snapshot
                if edge_snapshot is None:
                    raise GraphDatabaseError("Native edge service returned no physical source snapshot.", "GRAPH_REBUILD_INVALID_PAGE")
                request()
                _sum(result.graph, await apply_graph_rebuild_snapshot(adapter, edge_snapshot, "edges"))
        result.complete = not result.limited and opts.sync_relationships
        return result
    except Exception as error:
        if current:
            field, physical_id = current
            getattr(result, field).failed += 1
            result.errors.append(BatchSyncError(field, physical_id, getattr(error, "code", None) or "GRAPH_REBUILD_NATIVE_FAILED"))
        raise GraphRebuildPartialError(result, error) from error
    finally:
        result.duration = int((time.monotonic() - start) * 1000)
        transport.close()
