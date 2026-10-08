"""
Cortex SDK - Fact History Service

SDK wrapper for fact change history operations.
Provides audit trail for belief revision decisions.
"""

from copy import deepcopy
from dataclasses import dataclass
from datetime import datetime, timezone
from types import MappingProxyType
from typing import (
    Any,
    AsyncIterator,
    Dict,
    List,
    Literal,
    Mapping,
    Optional,
    Tuple,
    cast,
)
from uuid import uuid4

from typing_extensions import NotRequired, TypedDict

from .._utils import filter_none_values
from ..types import AuthContext, FactHistoryEndpoint, FactHistoryPayload
from .discovery import resolve_fact_scope, scoped_pages

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Fact change action types
FactChangeAction = Literal["CREATE", "UPDATE", "SUPERSEDE", "DELETE"]


@dataclass
class FactChangePipeline:
    """Pipeline information for a change event."""

    slot_matching: Optional[bool] = None
    """Whether slot matching was used"""

    semantic_matching: Optional[bool] = None
    """Whether semantic matching was used"""

    llm_resolution: Optional[bool] = None
    """Whether LLM resolution was used"""


@dataclass
class FactChangeEvent:
    """Fact change event record."""

    event_id: str
    """Unique event identifier"""

    fact_id: str
    """ID of the fact that changed"""

    memory_space_id: str
    """Memory space ID"""

    action: FactChangeAction
    """Type of change action"""

    timestamp: int
    """When the change occurred (Unix timestamp in ms)"""

    old_value: Optional[str] = None
    """Previous fact value"""

    new_value: Optional[str] = None
    """New fact value"""

    superseded_by: Optional[str] = None
    """ID of fact that superseded this one"""

    supersedes: Optional[str] = None
    """ID of fact that this supersedes"""

    reason: Optional[str] = None
    """Reason for the change"""

    confidence: Optional[int] = None
    """Confidence in the decision"""

    pipeline: Optional[FactChangePipeline] = None
    """Pipeline stages that were executed"""

    user_id: Optional[str] = None
    """User ID associated with the change"""

    participant_id: Optional[str] = None
    """Participant ID associated with the change"""

    conversation_id: Optional[str] = None
    """Conversation ID if applicable"""


    _id: Optional[str] = None
    scope_version: Optional[Literal[1]] = None
    tenant_id: Optional[str] = None
    source_fact_id: Optional[str] = None
    source_memory_space_id: Optional[str] = None
    source_memory_id: Optional[str] = None
    source_conversation_id: Optional[str] = None
    owner_known: Optional[bool] = None
    owner_user_id: Optional[str] = None
    association_known: Optional[bool] = None
    associated_user_ids: Optional[List[str]] = None
    source_ref: Optional[Dict[str, Any]] = None
    evidence: Optional[Dict[str, Any]] = None
    supersedes_endpoint: Optional[FactHistoryEndpoint] = None
    superseded_by_endpoint: Optional[FactHistoryEndpoint] = None
    operation_id: Optional[str] = None
    phase: Optional[str] = None
    event_role: Optional[str] = None
    operation_kind: Optional[str] = None
    request_digest: Optional[str] = None
    affected_fact_ids: Optional[List[str]] = None
    result_fact_id: Optional[str] = None
    pending_rich_event: Optional["PendingRichEventV1"] = None
    publication_state: Optional[Literal["pending", "complete"]] = None


@dataclass
class LogEventParams:
    """Parameters for logging a change event."""

    fact_id: str
    """ID of the fact that changed"""

    memory_space_id: str
    """Memory space ID"""

    action: FactChangeAction
    """Type of change action"""

    old_value: Optional[str] = None
    """Previous fact value"""

    new_value: Optional[str] = None
    """New fact value"""

    superseded_by: Optional[str] = None
    """ID of fact that superseded this one"""

    supersedes: Optional[str] = None
    """ID of fact that this supersedes"""

    reason: Optional[str] = None
    """Reason for the change"""

    confidence: Optional[int] = None
    """Confidence in the decision"""

    pipeline: Optional[FactChangePipeline] = None
    """Pipeline stages that were executed"""

    user_id: Optional[str] = None
    """User ID associated with the change"""

    participant_id: Optional[str] = None
    """Participant ID associated with the change"""

    conversation_id: Optional[str] = None
    """Conversation ID if applicable"""

    tenant_id: Optional[str] = None
    source_fact_id: Optional[str] = None
    operation_id: Optional[str] = None


@dataclass
class ChangeFilter:
    """Filter for querying change events."""

    memory_space_id: str
    """Memory space to query"""

    after: Optional[datetime] = None
    """Start time filter"""

    before: Optional[datetime] = None
    """End time filter"""

    action: Optional[FactChangeAction] = None
    """Filter by action type"""

    limit: Optional[int] = None
    """Max results to return"""

    offset: Optional[int] = None
    """Offset for pagination"""

    tenant_id: Optional[str] = None


@dataclass
class TimeRange:
    """Time range for activity summary."""

    hours: int
    """Number of hours in the range"""

    since: str
    """Start of range (ISO string)"""

    until: str
    """End of range (ISO string)"""


@dataclass
class ActionCounts:
    """Counts by action type."""

    CREATE: int = 0
    UPDATE: int = 0
    SUPERSEDE: int = 0
    DELETE: int = 0


@dataclass
class ActivitySummary:
    """Activity summary for a time period."""

    time_range: TimeRange
    """Time range for the summary"""

    total_events: int
    """Total number of events"""

    action_counts: ActionCounts
    """Counts by action type"""

    unique_facts_modified: int = 0
    """Number of unique facts modified"""

    active_participants: int = 0
    """Number of active participants"""


@dataclass
class SupersessionChainEntry:
    """Supersession chain entry."""

    fact_id: str
    """Fact ID"""

    superseded_by: Optional[str]
    """ID of fact that superseded this one"""

    timestamp: int
    """When the supersession occurred"""

    reason: Optional[str] = None
    """Reason for the supersession"""



    source_fact_id: Optional[str] = None


def _freeze(value: Any) -> Any:
    if isinstance(value, dict):
        return MappingProxyType({k: _freeze(v) for k, v in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(v) for v in value)
    return value


def _thaw(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {k: _thaw(v) for k, v in value.items()}
    if isinstance(value, tuple):
        return [_thaw(v) for v in value]
    return value


@dataclass(frozen=True)
class PendingRichEventV1:
    """The original backend payload; absent keys and null values stay distinct."""

    payload: FactHistoryPayload
    absent_fields: Tuple[str, ...]
    payload_digest: str
    version: Literal[1] = 1

    def __post_init__(self) -> None:
        object.__setattr__(self, "payload", _freeze(_thaw(self.payload)))
        object.__setattr__(self, "absent_fields", tuple(self.absent_fields))

    @classmethod
    def from_wire(cls, value: Dict[str, Any]) -> "PendingRichEventV1":
        if value.get("version") != 1:
            raise ValueError("FACT_HISTORY_PENDING_EVENT_UNRESOLVED")
        return cls(cast(FactHistoryPayload, value["payload"]), tuple(value["absentFields"]), value["payloadDigest"])

    def to_wire(self) -> Dict[str, Any]:
        return {"version": 1, "payload": _thaw(self.payload), "absentFields": list(self.absent_fields), "payloadDigest": self.payload_digest}


@dataclass(frozen=True)
class HistoryEventReceipt:
    event_id: str
    _id: str
    pending: Optional[PendingRichEventV1] = None
    request_json: Optional[str] = None


@dataclass(frozen=True)
class HistoryReceipt:
    events: Tuple[HistoryEventReceipt, ...]
    affected_fact_ids: Tuple[str, ...]
    result_fact_id: Optional[str] = None
    committed: Literal[True] = True
    graph_jobs: Tuple[Any, ...] = ()

    @classmethod
    def from_wire(cls, value: Dict[str, Any]) -> "HistoryReceipt":
        if value.get("committed") is not True:
            raise ValueError("FACT_HISTORY_PENDING_EVENT_UNRESOLVED")
        from ..graph.erasure import graph_receipt_from_wire

        return cls(tuple(HistoryEventReceipt(e["eventId"], e["_id"], PendingRichEventV1.from_wire(e["pending"]) if e.get("pending") else None, e.get("requestJson")) for e in value["events"]), tuple(value["affectedFactIds"]), value.get("resultFactId"), graph_jobs=tuple(graph_receipt_from_wire(job) for job in value.get("graphJobs", [])))


def _receipt_graph_jobs(receipt: HistoryReceipt) -> List[Any]:
    from ..graph.identity import graph_wire

    return [graph_wire(job) for job in receipt.graph_jobs]


class HistoryWriteAfterCommitError(RuntimeError):
    committed = True
    phase = "rich_publication"

    def __init__(self, receipt: HistoryReceipt, scope: Dict[str, Any], cause: Exception) -> None:
        super().__init__("Fact committed; rich history publication remains pending")
        self.receipt = receipt
        self.affected_fact_ids = receipt.affected_fact_ids
        self.event_ids = tuple(event.event_id for event in receipt.events)
        first = receipt.events[0].pending if receipt.events else None
        self.operation_id = first.payload.get("operationId") if first else None
        self.request_digest = first.payload.get("requestDigest") if first else None
        self.scope = _freeze(deepcopy(scope))
        self.original_cause = cause


class RevisionAfterCommitError(RuntimeError):
    phase = "revision_link"
    committed = True

    def __init__(self, receipt: Dict[str, Any], cause: Exception) -> None:
        super().__init__("Revision store committed; relationship phase incomplete")
        self.receipt = _freeze(receipt)
        self.original_cause = cause


class FactCommitOutcomeUnknownError(RuntimeError):
    committed = None

    def __init__(self, operation_id: str, phase: str, scope: Dict[str, Any], cause: Exception) -> None:
        super().__init__("Fact commit outcome unknown; reconcile the original operation before retrying")
        self.operation_id = operation_id
        self.phase = phase
        self.scope = _freeze(scope)
        self.original_cause = cause


class FactOperationAlreadyCommittedError(RuntimeError):
    committed = True
    phase = "update"

    def __init__(self, receipt: HistoryReceipt) -> None:
        super().__init__("Original dedup update committed; reconcile retained operation without rediscovery")
        self.receipt = receipt


class FactCommittedResultUnavailableError(RuntimeError):
    committed = True

    def __init__(self, receipt: HistoryReceipt) -> None:
        super().__init__("FACT_HISTORY_COMMITTED_RESULT_UNAVAILABLE")
        self.receipt = receipt


class FactCommittedReceiptUnresolvedError(RuntimeError):
    """The server acknowledged commitment, but no authoritative receipt was read."""
    committed = True
    phase = "committed_receipt_unresolved"

    def __init__(self, operation_id: str, mutation_phase: str, scope: Dict[str, Any], disposition: str, cause: Exception, receipt_cause: Optional[Exception] = None) -> None:
        super().__init__("Fact committed; retained operation receipt unresolved")
        self.operation_id = operation_id
        self.mutation_phase = mutation_phase
        self.scope = _freeze(scope)
        self.receipt_disposition = disposition
        self.original_cause = cause
        self.receipt_cause = receipt_cause


@dataclass
class HistorySelector:
    tenant_id: Optional[str] = None
    memory_space_id: Optional[str] = None
    source_memory_space_id: Optional[str] = None
    fact_id: Optional[str] = None
    source_fact_id: Optional[str] = None
    incoming_fact_id: Optional[str] = None
    user_id: Optional[str] = None
    owner_user_id: Optional[str] = None
    after: Optional[int] = None
    before: Optional[int] = None
    action: Optional[FactChangeAction] = None

    def to_wire(self) -> Dict[str, Any]:
        return filter_none_values({"tenantId": self.tenant_id, "memorySpaceId": self.memory_space_id, "sourceMemorySpaceId": self.source_memory_space_id, "factId": self.fact_id, "sourceFactId": self.source_fact_id, "incomingFactId": self.incoming_fact_id, "userId": self.user_id, "ownerUserId": self.owner_user_id, "after": self.after, "before": self.before, "action": self.action})


class HistoryDeleteResult(TypedDict):
    deleted: int
    remaining: Optional[int]
    isDone: bool
    continueCursor: str
    page: List[Dict[str, Any]]
    splitCursor: NotRequired[Optional[str]]
    pageStatus: NotRequired[Optional[Literal["SplitRequired", "SplitRecommended"]]]


def _finite_time(value: Any) -> None:
    import math

    try:
        valid = not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value)
    except (OverflowError, TypeError, ValueError):
        valid = False
    if not valid:
        raise ValueError("FACT_HISTORY_INVALID_TIME_RANGE")


def _time_range(selector: HistorySelector) -> None:
    for value in (selector.after, selector.before):
        if value is not None:
            _finite_time(value)
    if selector.after is not None and selector.before is not None and selector.after > selector.before:
        raise ValueError("FACT_HISTORY_INVALID_TIME_RANGE")


def _timestamp(value: datetime) -> int:
    if not isinstance(value, datetime):
        raise ValueError("FACT_HISTORY_INVALID_TIME_RANGE")
    try:
        raw = value.timestamp() * 1000
        _finite_time(raw)
        return int(raw)
    except (OverflowError, OSError, TypeError, ValueError) as error:
        raise ValueError("FACT_HISTORY_INVALID_TIME_RANGE") from error


def _optional_timestamp(value: Optional[datetime]) -> Optional[int]:
    return None if value is None else _timestamp(value)


def _batch_hint(limit: Optional[int]) -> int:
    if limit is not None and (isinstance(limit, bool) or not isinstance(limit, int) or limit < 1):
        raise ValueError("FACT_HISTORY_INVALID_PAGE_SIZE")
    return min(limit if limit is not None else 256, 256)


class FactHistoryService:
    """Durable exact-scope audit. Omitted scope selects known tenantless records."""

    def __init__(self, client: Any, resilience: Optional[Any] = None, auth_context: Optional[AuthContext] = None) -> None:
        self._client = client
        self._resilience = resilience
        self._auth_context = auth_context

    def _scope(self, tenant_id: Optional[str] = None) -> Optional[str]:
        return resolve_fact_scope(self._auth_context.tenant_id if self._auth_context else None, tenant_id)

    async def _execute_with_resilience(self, operation: Any, operation_name: str) -> Any:
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

    async def log(self, params: LogEventParams) -> Dict[str, Any]:
        args = filter_none_values({"tenantId": self._scope(params.tenant_id), "sourceFactId": params.source_fact_id, "operationId": params.operation_id or str(uuid4()), "factId": params.fact_id, "memorySpaceId": params.memory_space_id, "action": params.action, "oldValue": params.old_value, "newValue": params.new_value, "supersededBy": params.superseded_by, "supersedes": params.supersedes, "reason": params.reason, "confidence": params.confidence, "pipeline": filter_none_values({"slotMatching": params.pipeline.slot_matching, "semanticMatching": params.pipeline.semantic_matching, "llmResolution": params.pipeline.llm_resolution}) if params.pipeline else None, "userId": params.user_id, "participantId": params.participant_id, "conversationId": params.conversation_id})
        result = await self._execute_with_resilience(lambda: self._client.mutation("factHistory:logEvent", args), "factHistory:log")
        return {"event_id": result["eventId"], "_id": result.get("_id"), "receipt": HistoryReceipt.from_wire(result["receipt"]) if result.get("receipt") else None}

    async def pages(self, selector: Optional[HistorySelector] = None) -> AsyncIterator[List[FactChangeEvent]]:
        selected = selector or HistorySelector()
        _time_range(selected)
        args = filter_none_values({**selected.to_wire(), "tenantId": self._scope(selected.tenant_id)})

        async def load(page_range: Dict[str, Any]) -> Dict[str, Any]:
            result: Dict[str, Any] = await self._execute_with_resilience(lambda: self._client.query("factHistory:page", {**args, "paginationOpts": {**page_range, "numItems": 256}}), "factHistory:page")
            return result

        async for page in scoped_pages(load, "factHistory"):
            yield [self._parse_event(e) for e in page]

    async def get_history(self, fact_id: str, limit: Optional[int] = None, selector: Optional[HistorySelector] = None) -> List[FactChangeEvent]:
        from dataclasses import replace

        limit = 100 if limit is None else limit
        self._validate_window(limit, 0)
        result: List[FactChangeEvent] = []
        async for page in self.pages(replace(selector or HistorySelector(), fact_id=fact_id)):
            result.extend(page[:limit - len(result)])
            if len(result) >= limit:
                break
        return result

    async def get_event(self, event_id: str, tenant_id: Optional[str] = None) -> Optional[FactChangeEvent]:
        result = await self._execute_with_resilience(lambda: self._client.query("factHistory:getEvent", filter_none_values({"eventId": event_id, "tenantId": self._scope(tenant_id)})), "factHistory:getEvent")
        return self._parse_event(result) if result else None

    @staticmethod
    def _validate_window(limit: int, offset: int) -> None:
        if isinstance(limit, bool) or not isinstance(limit, int) or limit < 1 or isinstance(offset, bool) or not isinstance(offset, int) or offset < 0:
            raise ValueError("FACT_HISTORY_INVALID_PAGE_SIZE")

    async def get_changes(self, filter: ChangeFilter) -> List[FactChangeEvent]:
        limit, skip = filter.limit if filter.limit is not None else 100, filter.offset if filter.offset is not None else 0
        self._validate_window(limit, skip)
        result: List[FactChangeEvent] = []
        selector = HistorySelector(tenant_id=filter.tenant_id, memory_space_id=filter.memory_space_id, after=_optional_timestamp(filter.after), before=_optional_timestamp(filter.before), action=filter.action)
        async for page in self.pages(selector):
            if skip >= len(page):
                skip -= len(page)
                continue
            result.extend(page[skip:skip + limit - len(result)])
            skip = 0
            if len(result) >= limit:
                break
        return result

    async def count_by_action(self, memory_space_id: str, after: Optional[datetime] = None, before: Optional[datetime] = None, tenant_id: Optional[str] = None) -> Dict[str, int]:
        counts = {"CREATE": 0, "UPDATE": 0, "SUPERSEDE": 0, "DELETE": 0, "total": 0}
        async for page in self.pages(HistorySelector(tenant_id=tenant_id, memory_space_id=memory_space_id, after=_optional_timestamp(after), before=_optional_timestamp(before))):
            for event in page:
                counts[event.action] += 1
                counts["total"] += 1
        return counts

    async def get_activity_summary(self, memory_space_id: str, hours: int = 24, tenant_id: Optional[str] = None) -> ActivitySummary:
        _finite_time(hours)
        if hours <= 0:
            raise ValueError("FACT_HISTORY_INVALID_TIME_RANGE")
        now = datetime.now(timezone.utc)
        try:
            raw_since = now.timestamp() * 1000 - hours * 3600000
            _finite_time(raw_since)
            since = int(raw_since)
            since_iso = datetime.fromtimestamp(since / 1000, timezone.utc).isoformat()
        except (OverflowError, OSError, TypeError, ValueError) as error:
            raise ValueError("FACT_HISTORY_INVALID_TIME_RANGE") from error
        counts = ActionCounts()
        facts: set[str] = set()
        actors: set[str] = set()
        total = 0
        async for page in self.pages(HistorySelector(tenant_id=tenant_id, memory_space_id=memory_space_id, after=since, before=int(now.timestamp() * 1000))):
            for event in page:
                setattr(counts, event.action, getattr(counts, event.action) + 1)
                total += 1
                facts.add(event.source_fact_id or event.fact_id)
                actors.update(v for v in (event.user_id, event.participant_id) if v)
        return ActivitySummary(TimeRange(hours, since_iso, now.isoformat()), total, counts, len(facts), len(actors))

    async def get_operation_receipt(self, memory_space_id: str, operation_id: str, phase: str, tenant_id: Optional[str] = None) -> Optional[HistoryReceipt]:
        result = await self._client.query("factHistory:getOperationReceipt", filter_none_values({"tenantId": self._scope(tenant_id), "memorySpaceId": memory_space_id, "operationId": operation_id, "phase": phase}))
        return HistoryReceipt.from_wire(result) if result else None

    async def retry_history(self, receipt: HistoryReceipt) -> Dict[str, List[str]]:
        event_ids: List[str] = []
        for event in receipt.events:
            pending = event.pending
            if pending is None:
                raise ValueError("FACT_HISTORY_PENDING_EVENT_UNRESOLVED")
            p = pending.payload
            if not p.get("operationId") or not p.get("phase") or not p.get("eventRole"):
                raise ValueError("FACT_HISTORY_PENDING_EVENT_UNRESOLVED")
            args = filter_none_values({"tenantId": self._scope(p.get("tenantId")), "memorySpaceId": p["memorySpaceId"], "operationId": p["operationId"], "phase": p["phase"], "eventRole": p["eventRole"], "eventId": event.event_id, "pending": pending.to_wire()})
            result = await self._execute_with_resilience(lambda: self._client.mutation("factHistory:publishPendingEvent", args), "factHistory:publishPendingEvent")
            event_ids.append(result["eventId"])
        return {"event_ids": event_ids}

    async def get_supersession_chain(self, fact_id: str, selector: Optional[HistorySelector] = None) -> List[SupersessionChainEntry]:
        from dataclasses import replace

        identities: set[Optional[str]] = set()
        initial_event: Optional[FactChangeEvent] = None
        async for page in self.pages(replace(selector or HistorySelector(), fact_id=fact_id)):
            for event in page:
                identities.add(event.source_fact_id)
                if initial_event is None:
                    initial_event = event
        if initial_event is None:
            return []
        if len(identities) != 1 or None in identities:
            raise ValueError("FACT_HISTORY_SOURCE_AMBIGUOUS")
        source_space = initial_event.memory_space_id
        queue = list(identities)
        visited: set[str] = set()
        edges: Dict[str, set[str]] = {}
        entries: Dict[str, SupersessionChainEntry] = {}
        while queue:
            source_id = queue.pop(0)
            assert source_id is not None
            if source_id in visited:
                continue
            visited.add(source_id)
            for selected in (replace(selector or HistorySelector(), memory_space_id=source_space, fact_id=None, source_fact_id=source_id, incoming_fact_id=None), replace(selector or HistorySelector(), memory_space_id=source_space, fact_id=None, source_fact_id=None, incoming_fact_id=source_id)):
                async for page in self.pages(selected):
                    for event in page:
                        if not event.source_fact_id:
                            raise ValueError("FACT_HISTORY_RELATIONSHIP_UNRESOLVED")
                        event_source = event.source_fact_id
                        queue.append(event_source)
                        if event_source not in entries:
                            entries[event_source] = SupersessionChainEntry(event.fact_id, event.superseded_by, event.timestamp, event.reason, event_source)
                        for direction, endpoint in (("supersedes", event.supersedes_endpoint), ("supersededBy", event.superseded_by_endpoint)):
                            if not endpoint or endpoint["state"] == "unknown":
                                raise ValueError("FACT_HISTORY_RELATIONSHIP_UNRESOLVED")
                            if endpoint["state"] == "known":
                                target = endpoint.get("factDocumentId")
                                if not target or endpoint.get("scopeVersion") != 1 or endpoint.get("tenantId") != self._scope((selector or HistorySelector()).tenant_id) or endpoint.get("memorySpaceId") != event.memory_space_id:
                                    raise ValueError("FACT_HISTORY_SCOPE_MISMATCH")
                                start, end = (event_source, target) if direction == "supersededBy" else (target, event_source)
                                edges.setdefault(start, set()).add(end)
                                if len(edges[start]) > 1:
                                    raise ValueError("FACT_HISTORY_RELATIONSHIP_CONFLICT")
                                queue.append(target)
        # Topological order also detects cycles without mistaking reciprocal witnesses for a cycle.
        degree = {node: 0 for node in visited}
        for targets in edges.values():
            for target in targets:
                degree[target] = degree.get(target, 0) + 1
        ready = sorted(node for node, count in degree.items() if count == 0)
        ordered: List[str] = []
        while ready:
            node = ready.pop(0)
            ordered.append(node)
            for target in sorted(edges.get(node, set())):
                degree[target] -= 1
                if degree[target] == 0:
                    ready.append(target)
        if len(ordered) != len(degree):
            raise ValueError("FACT_HISTORY_RELATIONSHIP_CYCLE")
        if any(node not in entries for node in ordered):
            raise ValueError("FACT_HISTORY_RELATIONSHIP_UNRESOLVED")
        return [entries[node] for node in ordered]

    async def _delete(self, name: str, args: Dict[str, Any], selector: Optional[HistorySelector], pagination_opts: Optional[Dict[str, Any]] = None) -> HistoryDeleteResult:
        selected = selector or HistorySelector()
        _time_range(selected)
        if pagination_opts is not None:
            size = pagination_opts.get("numItems")
            if isinstance(size, bool) or not isinstance(size, int) or not 1 <= size <= 256:
                raise ValueError("FACT_HISTORY_INVALID_PAGE_SIZE")
        payload = filter_none_values({**selected.to_wire(), **args, "tenantId": self._scope(selected.tenant_id), "paginationOpts": pagination_opts})
        result: Dict[str, Any] = await self._execute_with_resilience(lambda: self._client.mutation(f"factHistory:{name}", payload), f"factHistory:{name}")
        return cast(HistoryDeleteResult, result)

    async def delete_by_fact_id(self, fact_id: str, selector: Optional[HistorySelector] = None, pagination_opts: Optional[Dict[str, Any]] = None) -> HistoryDeleteResult:
        return await self._delete("deleteByFactId", {"factId": fact_id}, selector, pagination_opts)

    async def delete_by_user_id(self, user_id: str, selector: Optional[HistorySelector] = None, pagination_opts: Optional[Dict[str, Any]] = None) -> HistoryDeleteResult:
        """Actor selection; this does not imply ownership erasure."""
        return await self._delete("deleteByUserId", {"userId": user_id}, selector, pagination_opts)

    async def delete_by_owner(self, owner_user_id: str, selector: Optional[HistorySelector] = None, pagination_opts: Optional[Dict[str, Any]] = None) -> HistoryDeleteResult:
        return await self._delete("deleteByOwner", {"ownerUserId": owner_user_id}, selector, pagination_opts)

    async def delete_by_memory_space(self, memory_space_id: str, selector: Optional[HistorySelector] = None, pagination_opts: Optional[Dict[str, Any]] = None) -> HistoryDeleteResult:
        return await self._delete("deleteByMemorySpace", {"memorySpaceId": memory_space_id}, selector, pagination_opts)

    async def purge_old_events(self, older_than: datetime, memory_space_id: Optional[str] = None, limit: Optional[int] = None, tenant_id: Optional[str] = None, pagination_opts: Optional[Dict[str, Any]] = None) -> HistoryDeleteResult:
        cutoff = _timestamp(older_than)
        hint = _batch_hint(limit)
        if pagination_opts is not None:
            size = pagination_opts.get("numItems")
            if isinstance(size, bool) or not isinstance(size, int) or not 1 <= size <= 256:
                raise ValueError("FACT_HISTORY_INVALID_PAGE_SIZE")
            pagination_opts = {**pagination_opts, "numItems": min(size, hint)}
        return await self._delete("purgeOldEvents", filter_none_values({"olderThan": cutoff, "limit": limit}), HistorySelector(tenant_id=tenant_id, memory_space_id=memory_space_id), pagination_opts)

    def _parse_event(self, data: Dict[str, Any]) -> FactChangeEvent:
        from .._utils import convert_convex_response

        raw = dict(data)
        pending = raw.pop("pendingRichEvent", None)
        raw.pop("_creationTime", None)
        pipeline = raw.pop("pipeline", None)
        endpoints = {key: raw.pop(key) for key in ("supersedesEndpoint", "supersededByEndpoint") if key in raw}
        values = convert_convex_response(raw)
        for key, value in endpoints.items():
            values["supersedes_endpoint" if key == "supersedesEndpoint" else "superseded_by_endpoint"] = value
        values["pipeline"] = FactChangePipeline(**convert_convex_response(pipeline)) if pipeline is not None else None
        values["pending_rich_event"] = PendingRichEventV1.from_wire(pending) if pending else None
        return FactChangeEvent(**values)

async def execute_fact_mutation(client: Any, name: str, args: Dict[str, Any], history: FactHistoryService, phase: str, *, graph_adapter: Any = None, graph_sync_policy: Any = None, sync_to_graph: Optional[bool] = None) -> Dict[str, Any]:
    """Resolve retained operation evidence after response loss; never rerun a decision."""
    from ..graph.erasure import requested_graph, write_graph_mutation

    if requested_graph(graph_adapter, sync_to_graph):
        captured_result: Dict[str, Any] = await write_graph_mutation(client, graph_adapter, graph_sync_policy, name, args, sync_to_graph)
        return captured_result

    operation_id = args.get("operationId") or args.get("historyIntent", {}).get("operationId")
    scope = filter_none_values({"tenantId": args.get("tenantId"), "memorySpaceId": args["memorySpaceId"]})
    try:
        result: Dict[str, Any] = await client.mutation(name, args)
        return result
    except Exception as error:
        unavailable = "FACT_HISTORY_COMMITTED_RESULT_UNAVAILABLE" in str(error)
        if definite_backend_failure(error) and not unavailable:
            raise
        if operation_id:
            try:
                receipt = await history.get_operation_receipt(args["memorySpaceId"], operation_id, phase, args.get("tenantId"))
            except Exception as receipt_error:
                if unavailable:
                    raise FactCommittedReceiptUnresolvedError(operation_id, phase, scope, "unavailable", error, receipt_error) from error
                receipt = None
            if unavailable and receipt is None:
                raise FactCommittedReceiptUnresolvedError(operation_id, phase, scope, "missing", error) from error
            if receipt:
                if unavailable or receipt.result_fact_id is None:
                    raise FactCommittedResultUnavailableError(receipt) from error
                try:
                    recovered = await client.query("facts:get", filter_none_values({**scope, "factId": receipt.events[0].pending.payload.get("factId") if receipt.events[0].pending else args.get("factId")}))
                except Exception:
                    recovered = None
                # Ordinary update output has a new logical id; obtain it from the original new role anchor.
                for event in receipt.events:
                    if event.pending and event.pending.payload.get("sourceFactId") == receipt.result_fact_id:
                        logical_id = event.pending.payload["factId"]
                        try:
                            recovered = await client.query("facts:get", {**scope, "factId": logical_id})
                        except Exception:
                            recovered = None
                        break
                if not recovered or recovered.get("_id") != receipt.result_fact_id:
                    raise FactCommittedResultUnavailableError(receipt) from error
                # Recover only the original committed source, with the exact retained envelopes.
                recovered["historyReceipt"] = {"committed": True, "events": [{"eventId": e.event_id, "_id": e._id, "pending": e.pending.to_wire() if e.pending else None, **({"requestJson": e.request_json} if e.request_json is not None else {})} for e in receipt.events], "affectedFactIds": list(receipt.affected_fact_ids), "resultFactId": receipt.result_fact_id, **({"graphJobs": _receipt_graph_jobs(receipt)} if receipt.graph_jobs else {})}
                return dict(recovered)
        raise FactCommitOutcomeUnknownError(operation_id or "", phase, scope, error) from error


def definite_backend_failure(error: Exception) -> bool:
    """The public async transport preserves the original server exception as cause."""
    from convex import ConvexError, ConvexExecutionError

    current: Optional[BaseException] = error
    while current is not None:
        if isinstance(current, (ConvexError, ConvexExecutionError)):
            return True
        current = current.__cause__
    return False


async def execute_relationship_mutation(client: Any, name: str, args: Dict[str, Any], history: FactHistoryService, phase: str, *, graph_adapter: Any = None, graph_sync_policy: Any = None, sync_to_graph: Optional[bool] = None) -> Dict[str, Any]:
    """Reconcile a lost pair/group reply using retained identity without touching facts."""
    from ..graph.erasure import requested_graph, write_graph_mutation

    if requested_graph(graph_adapter, sync_to_graph):
        captured_result: Dict[str, Any] = await write_graph_mutation(client, graph_adapter, graph_sync_policy, name, args, sync_to_graph)
        return captured_result

    try:
        result: Dict[str, Any] = await client.mutation(name, args)
        return result
    except Exception as error:
        if definite_backend_failure(error):
            raise
        operation_id = args.get("operationId") or args.get("historyIntent", {}).get("operationId", "")
        try:
            receipt = await history.get_operation_receipt(args["memorySpaceId"], operation_id, phase, args.get("tenantId"))
        except Exception:
            receipt = None
        if receipt is None:
            raise FactCommitOutcomeUnknownError(operation_id, phase, filter_none_values({"tenantId": args.get("tenantId"), "memorySpaceId": args["memorySpaceId"]}), error) from error
        wire = {"committed": True, "events": [{"eventId": e.event_id, "_id": e._id, "pending": e.pending.to_wire() if e.pending else None, **({"requestJson": e.request_json} if e.request_json is not None else {})} for e in receipt.events], "affectedFactIds": list(receipt.affected_fact_ids), "resultFactId": receipt.result_fact_id, **({"graphJobs": _receipt_graph_jobs(receipt)} if receipt.graph_jobs else {})}
        if phase == "supersede":
            return {"superseded": True, "oldFactId": args["oldFactId"], "newFactId": args["newFactId"], "reason": args.get("reason"), "historyReceipt": wire}
        return {"consolidated": True, "keptFactId": args["keepFactId"], "mergedCount": len(args["factIds"]) - 1, "historyReceipt": wire}
