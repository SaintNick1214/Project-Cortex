"""Exact-scoped finite matching windows and native Convex range pagination."""

import re
from collections import deque
from typing import Any, AsyncIterator, Awaitable, Callable, Dict, List, Optional

from .._utils import convert_convex_response, filter_none_values
from ..types import FactRecord


class FactsDiscoveryError(RuntimeError):
    """A failed discovery stage must never become a successful empty match."""

    def __init__(self, stage: str, cause: Exception) -> None:
        match = re.search(r"\bFACT_HISTORY_[A-Z_]+\b", str(cause))
        self.code = match.group(0) if match else "FACTS_DISCOVERY_FAILED"
        super().__init__(f"{self.code}: Facts discovery failed at {stage}")
        self.stage = stage
        self.original_cause = cause


def resolve_fact_scope(context_tenant: Optional[str], selected: Optional[str]) -> Optional[str]:
    if context_tenant is not None and selected is not None and context_tenant != selected:
        raise ValueError("FACT_HISTORY_SCOPE_MISMATCH")
    return selected if selected is not None else context_tenant


async def scoped_pages(
    load: Callable[[Dict[str, Any]], Awaitable[Dict[str, Any]]], stage: str
) -> AsyncIterator[List[Dict[str, Any]]]:
    """Discard provisional split pages and visit both bounded parent ranges."""
    queue: deque[Dict[str, Any]] = deque([{"cursor": None, "endCursor": None}])
    requested: set[tuple[Optional[str], Optional[str]]] = set()
    while queue:
        page_range = queue.popleft()
        seen: set[str] = set()
        while True:
            key = (page_range["cursor"], page_range["endCursor"])
            if key in requested:
                raise FactsDiscoveryError(stage, ValueError("Repeated page request range"))
            requested.add(key)
            try:
                page = await load(page_range)
            except Exception as error:
                raise FactsDiscoveryError(stage, error) from error
            if (not isinstance(page, dict) or not isinstance(page.get("page"), list)
                    or not isinstance(page.get("isDone"), bool)
                    or not isinstance(page.get("continueCursor"), str)):
                raise FactsDiscoveryError(stage, ValueError("Invalid page envelope"))
            status = page.get("pageStatus")
            if status not in (None, "SplitRequired", "SplitRecommended"):
                raise FactsDiscoveryError(stage, ValueError("Invalid page status"))
            if status == "SplitRequired":
                split = page.get("splitCursor")
                if (not isinstance(split, str)
                        or not split or split in (page_range["cursor"], page_range["endCursor"])):
                    raise FactsDiscoveryError(stage, ValueError("Invalid split cursor"))
                queue.appendleft({"cursor": split, "endCursor": page_range["endCursor"]})
                page_range = {"cursor": page_range["cursor"], "endCursor": split}
                continue
            yield page["page"]
            if page["isDone"]:
                break
            cursor = page["continueCursor"]
            if not cursor or cursor == page_range["cursor"] or cursor in seen:
                raise FactsDiscoveryError(stage, ValueError("Non-advancing cursor"))
            seen.add(cursor)
            page_range = {**page_range, "cursor": cursor}


def parse_fact(data: Dict[str, Any]) -> FactRecord:
    """Preserve the immutable wire envelope instead of recursively renaming it."""
    from .history import HistoryReceipt

    raw = dict(data)
    receipt = raw.pop("historyReceipt", None)
    endpoints = {key: raw.pop(key) for key in ("supersedesEndpoint", "supersededByEndpoint") if key in raw}
    parsed = convert_convex_response(raw)
    for key, value in endpoints.items():
        parsed["supersedes_endpoint" if key == "supersedesEndpoint" else "superseded_by_endpoint"] = value
    if receipt is not None:
        parsed["history_receipt"] = HistoryReceipt.from_wire(receipt)
    return FactRecord(**parsed)


async def collect_candidates(client: Any, name: str, args: Dict[str, Any], cap: int) -> List[FactRecord]:
    if cap < 1 or cap > 256:
        raise ValueError("FACT_HISTORY_INVALID_PAGE_SIZE")
    result: List[FactRecord] = []

    async def load(page_range: Dict[str, Any]) -> Dict[str, Any]:
        response: Dict[str, Any] = await client.query(
            "facts:candidatePage", filter_none_values({**args, "operation": name, "paginationOpts": {**page_range, "numItems": cap}})
        )
        return response

    async for page in scoped_pages(load, name):
        result.extend(parse_fact(fact) for fact in page[:cap - len(result)])
        if len(result) >= cap:
            break
    return result
