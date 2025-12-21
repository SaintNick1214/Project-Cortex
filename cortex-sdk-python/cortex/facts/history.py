"""
Cortex SDK - Fact History Service

SDK wrapper for fact change history operations.
Provides audit trail for belief revision decisions.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

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


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FactHistoryService
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


class FactHistoryService:
    """
    Service for managing fact change history.

    Example:
        >>> history = FactHistoryService(convex_client)
        >>>
        >>> # Log a change event
        >>> await history.log(LogEventParams(
        ...     fact_id="fact-123",
        ...     memory_space_id="space-1",
        ...     action="UPDATE",
        ...     old_value="User likes blue",
        ...     new_value="User likes purple",
        ...     reason="User explicitly stated preference change",
        ... ))
        >>>
        >>> # Get history for a fact
        >>> events = await history.get_history("fact-123")
        >>>
        >>> # Get changes in a time range
        >>> recent_changes = await history.get_changes(ChangeFilter(
        ...     memory_space_id="space-1",
        ...     after=datetime.now() - timedelta(hours=24),
        ... ))
    """

    def __init__(
        self,
        client: Any,
        resilience: Optional[Any] = None,
    ) -> None:
        """
        Initialize the fact history service.

        Args:
            client: Convex client instance
            resilience: Optional resilience layer for retries
        """
        self._client = client
        self._resilience = resilience

    async def _execute_with_resilience(
        self, operation: Any, operation_name: str
    ) -> Any:
        """Execute an operation through the resilience layer (if available)."""
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

    async def log(self, params: LogEventParams) -> Dict[str, str]:
        """
        Log a fact change event.

        Args:
            params: Event parameters

        Returns:
            Dict with the created event ID
        """
        from .._utils import filter_none_values

        result = await self._execute_with_resilience(
            lambda: self._client.mutation(
                "factHistory:logEvent",
                filter_none_values({
                    "factId": params.fact_id,
                    "memorySpaceId": params.memory_space_id,
                    "action": params.action,
                    "oldValue": params.old_value,
                    "newValue": params.new_value,
                    "supersededBy": params.superseded_by,
                    "supersedes": params.supersedes,
                    "reason": params.reason,
                    "confidence": params.confidence,
                    "pipeline": (
                        {
                            "slotMatching": params.pipeline.slot_matching,
                            "semanticMatching": params.pipeline.semantic_matching,
                            "llmResolution": params.pipeline.llm_resolution,
                        }
                        if params.pipeline
                        else None
                    ),
                    "userId": params.user_id,
                    "participantId": params.participant_id,
                    "conversationId": params.conversation_id,
                }),
            ),
            "factHistory:log",
        )

        return {"event_id": result.get("eventId", "")}

    async def get_history(
        self, fact_id: str, limit: Optional[int] = None
    ) -> List[FactChangeEvent]:
        """
        Get history for a specific fact.

        Args:
            fact_id: The fact ID to get history for
            limit: Max events to return (default: 100)

        Returns:
            List of change events
        """
        from .._utils import filter_none_values

        result = await self._execute_with_resilience(
            lambda: self._client.query(
                "factHistory:getHistory",
                filter_none_values({
                    "factId": fact_id,
                    "limit": limit,
                }),
            ),
            "factHistory:getHistory",
        )

        return [self._parse_event(e) for e in (result or [])]

    async def get_event(self, event_id: str) -> Optional[FactChangeEvent]:
        """
        Get a specific change event by ID.

        Args:
            event_id: The event ID

        Returns:
            The event or None if not found
        """
        result = await self._execute_with_resilience(
            lambda: self._client.query(
                "factHistory:getEvent",
                {"eventId": event_id},
            ),
            "factHistory:getEvent",
        )

        if not result:
            return None

        return self._parse_event(result)

    async def get_changes(self, filter: ChangeFilter) -> List[FactChangeEvent]:
        """
        Get changes in a time range with filters.

        Args:
            filter: Filter parameters

        Returns:
            List of change events
        """
        from .._utils import filter_none_values

        result = await self._execute_with_resilience(
            lambda: self._client.query(
                "factHistory:getChangesByTimeRange",
                filter_none_values({
                    "memorySpaceId": filter.memory_space_id,
                    "after": int(filter.after.timestamp() * 1000) if filter.after else None,
                    "before": int(filter.before.timestamp() * 1000) if filter.before else None,
                    "action": filter.action,
                    "limit": filter.limit,
                    "offset": filter.offset,
                }),
            ),
            "factHistory:getChanges",
        )

        return [self._parse_event(e) for e in (result or [])]

    async def count_by_action(
        self,
        memory_space_id: str,
        after: Optional[datetime] = None,
        before: Optional[datetime] = None,
    ) -> Dict[str, int]:
        """
        Count changes by action type.

        Args:
            memory_space_id: Memory space to query
            after: Start timestamp
            before: End timestamp

        Returns:
            Dict with counts by action type and total
        """
        from .._utils import filter_none_values

        result = await self._execute_with_resilience(
            lambda: self._client.query(
                "factHistory:countByAction",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "after": int(after.timestamp() * 1000) if after else None,
                    "before": int(before.timestamp() * 1000) if before else None,
                }),
            ),
            "factHistory:countByAction",
        )

        return {
            "CREATE": result.get("CREATE", 0),
            "UPDATE": result.get("UPDATE", 0),
            "SUPERSEDE": result.get("SUPERSEDE", 0),
            "DELETE": result.get("DELETE", 0),
            "total": result.get("total", 0),
        }

    async def get_supersession_chain(
        self, fact_id: str
    ) -> List[SupersessionChainEntry]:
        """
        Get the supersession chain for a fact.

        Returns the chain of facts that led to the current state,
        showing how the knowledge evolved over time.

        Args:
            fact_id: The fact ID to trace

        Returns:
            List of chain entries from oldest to newest
        """
        result = await self._execute_with_resilience(
            lambda: self._client.query(
                "factHistory:getSupersessionChain",
                {"factId": fact_id},
            ),
            "factHistory:getSupersessionChain",
        )

        return [
            SupersessionChainEntry(
                fact_id=e.get("factId", ""),
                superseded_by=e.get("supersededBy"),
                timestamp=e.get("timestamp", 0),
                reason=e.get("reason"),
            )
            for e in (result or [])
        ]

    async def get_activity_summary(
        self,
        memory_space_id: str,
        hours: int = 24,
    ) -> ActivitySummary:
        """
        Get activity summary for a time period.

        Args:
            memory_space_id: Memory space to query
            hours: Number of hours to look back (default: 24)

        Returns:
            Activity summary
        """
        result = await self._execute_with_resilience(
            lambda: self._client.query(
                "factHistory:getActivitySummary",
                {
                    "memorySpaceId": memory_space_id,
                    "hours": hours,
                },
            ),
            "factHistory:getActivitySummary",
        )

        time_range_data = result.get("timeRange", {})
        action_counts_data = result.get("actionCounts", {})

        return ActivitySummary(
            time_range=TimeRange(
                hours=time_range_data.get("hours", hours),
                since=time_range_data.get("since", ""),
                until=time_range_data.get("until", ""),
            ),
            total_events=result.get("totalEvents", 0),
            action_counts=ActionCounts(
                CREATE=action_counts_data.get("CREATE", 0),
                UPDATE=action_counts_data.get("UPDATE", 0),
                SUPERSEDE=action_counts_data.get("SUPERSEDE", 0),
                DELETE=action_counts_data.get("DELETE", 0),
            ),
            unique_facts_modified=result.get("uniqueFactsModified", 0),
            active_participants=result.get("activeParticipants", 0),
        )

    async def delete_by_fact_id(self, fact_id: str) -> Dict[str, int]:
        """
        Delete history for a fact (GDPR cascade).

        Args:
            fact_id: The fact ID

        Returns:
            Dict with number of events deleted
        """
        result = await self._execute_with_resilience(
            lambda: self._client.mutation(
                "factHistory:deleteByFactId",
                {"factId": fact_id},
            ),
            "factHistory:deleteByFactId",
        )

        return {"deleted": result.get("deleted", 0)}

    async def delete_by_user_id(self, user_id: str) -> Dict[str, int]:
        """
        Delete history for a user (GDPR cascade).

        Args:
            user_id: The user ID

        Returns:
            Dict with number of events deleted
        """
        result = await self._execute_with_resilience(
            lambda: self._client.mutation(
                "factHistory:deleteByUserId",
                {"userId": user_id},
            ),
            "factHistory:deleteByUserId",
        )

        return {"deleted": result.get("deleted", 0)}

    async def delete_by_memory_space(
        self, memory_space_id: str
    ) -> Dict[str, int]:
        """
        Delete history for a memory space.

        Args:
            memory_space_id: The memory space ID

        Returns:
            Dict with number of events deleted
        """
        result = await self._execute_with_resilience(
            lambda: self._client.mutation(
                "factHistory:deleteByMemorySpace",
                {"memorySpaceId": memory_space_id},
            ),
            "factHistory:deleteByMemorySpace",
        )

        return {"deleted": result.get("deleted", 0)}

    async def purge_old_events(
        self,
        older_than: datetime,
        memory_space_id: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> Dict[str, int]:
        """
        Purge old history events (retention policy).

        Args:
            older_than: Delete events before this date
            memory_space_id: Optional memory space filter
            limit: Max events to delete per call

        Returns:
            Dict with deleted count and remaining count
        """
        from .._utils import filter_none_values

        result = await self._execute_with_resilience(
            lambda: self._client.mutation(
                "factHistory:purgeOldEvents",
                filter_none_values({
                    "memorySpaceId": memory_space_id,
                    "olderThan": int(older_than.timestamp() * 1000),
                    "limit": limit,
                }),
            ),
            "factHistory:purgeOldEvents",
        )

        return {
            "deleted": result.get("deleted", 0),
            "remaining": result.get("remaining", 0),
        }

    def _parse_event(self, data: Dict[str, Any]) -> FactChangeEvent:
        """Parse a raw event dict into a FactChangeEvent."""
        pipeline_data = data.get("pipeline")
        pipeline = None
        if pipeline_data:
            pipeline = FactChangePipeline(
                slot_matching=pipeline_data.get("slotMatching"),
                semantic_matching=pipeline_data.get("semanticMatching"),
                llm_resolution=pipeline_data.get("llmResolution"),
            )

        return FactChangeEvent(
            event_id=data.get("eventId", ""),
            fact_id=data.get("factId", ""),
            memory_space_id=data.get("memorySpaceId", ""),
            action=data.get("action", "CREATE"),
            timestamp=data.get("timestamp", 0),
            old_value=data.get("oldValue"),
            new_value=data.get("newValue"),
            superseded_by=data.get("supersededBy"),
            supersedes=data.get("supersedes"),
            reason=data.get("reason"),
            confidence=data.get("confidence"),
            pipeline=pipeline,
            user_id=data.get("userId"),
            participant_id=data.get("participantId"),
            conversation_id=data.get("conversationId"),
        )


__all__ = [
    "FactChangeAction",
    "FactChangePipeline",
    "FactChangeEvent",
    "LogEventParams",
    "ChangeFilter",
    "TimeRange",
    "ActionCounts",
    "ActivitySummary",
    "SupersessionChainEntry",
    "FactHistoryService",
]
