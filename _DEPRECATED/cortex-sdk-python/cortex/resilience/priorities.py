"""
Operation Priority Mapping

Automatically assigns priority levels to SDK operations based on their
importance and latency requirements.

Priority Levels:
- critical: GDPR/security operations that must not be delayed
- high: Real-time conversation operations for responsive UX
- normal: Standard reads/writes with reasonable latency tolerance
- low: Bulk operations that can tolerate delays
- background: Async operations that run when resources are available
"""

from typing import Dict, List

from .types import Priority

# Operation name to priority mapping
#
# Uses pattern matching with wildcards:
# - Exact match: "memory:remember" -> specific operation
# - Wildcard suffix: "graphSync:*" -> all graphSync operations

OPERATION_PRIORITIES: Dict[str, Priority] = {
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # CRITICAL - GDPR/Security (never delayed, never dropped)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    "users:delete": "critical",
    "users:purge": "critical",
    "governance:purge": "critical",
    "governance:deleteUserData": "critical",
    "governance:executeRetentionPolicy": "critical",
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # HIGH - Real-time conversation (low latency required)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    "memory:remember": "high",
    "memory:rememberStream": "high",
    "conversations:create": "high",
    "conversations:addMessage": "high",
    "conversations:update": "high",
    "a2a:sendMessage": "high",
    "a2a:broadcast": "high",
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # NORMAL - Standard operations (default)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    "memory:search": "normal",
    "memory:get": "normal",
    "memory:store": "normal",
    "memory:update": "normal",
    "memory:delete": "normal",
    "memory:list": "normal",
    "memory:count": "normal",
    "conversations:get": "normal",
    "conversations:list": "normal",
    "conversations:delete": "normal",
    "facts:store": "normal",
    "facts:get": "normal",
    "facts:search": "normal",
    "facts:update": "normal",
    "facts:delete": "normal",
    "facts:list": "normal",
    "contexts:create": "normal",
    "contexts:get": "normal",
    "contexts:update": "normal",
    "contexts:delete": "normal",
    "vector:store": "normal",
    "vector:search": "normal",
    "vector:get": "normal",
    "vector:update": "normal",
    "vector:delete": "normal",
    "immutable:append": "normal",
    "immutable:get": "normal",
    "immutable:list": "normal",
    "mutable:set": "normal",
    "mutable:get": "normal",
    "mutable:delete": "normal",
    "users:create": "normal",
    "users:get": "normal",
    "users:update": "normal",
    "users:list": "normal",
    "agents:create": "normal",
    "agents:get": "normal",
    "agents:update": "normal",
    "agents:delete": "normal",
    "agents:list": "normal",
    "memorySpaces:create": "normal",
    "memorySpaces:get": "normal",
    "memorySpaces:update": "normal",
    "memorySpaces:delete": "normal",
    "memorySpaces:list": "normal",
    "a2a:get": "normal",
    "a2a:list": "normal",
    "a2a:subscribe": "normal",
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # LOW - Bulk operations (can tolerate delays)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    "memory:export": "low",
    "memory:deleteMany": "low",
    "memory:updateMany": "low",
    "memory:archive": "low",
    "memory:restoreFromArchive": "low",
    "facts:deleteMany": "low",
    "facts:updateMany": "low",
    "facts:export": "low",
    "conversations:deleteMany": "low",
    "conversations:export": "low",
    "vector:deleteMany": "low",
    "vector:updateMany": "low",
    "governance:listPolicies": "low",
    "governance:createPolicy": "low",
    "governance:updatePolicy": "low",
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # BACKGROUND - Async operations (run when idle)
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    "graphSync:*": "background",
    "graph:sync": "background",
    "graph:batchSync": "background",
}

DEFAULT_PRIORITY: Priority = "normal"
"""Default priority for unknown operations"""


def get_priority(operation_name: str) -> Priority:
    """
    Get priority for an operation name.

    Supports exact matches and wildcard patterns (e.g., "graphSync:*")

    Args:
        operation_name: The operation name (e.g., "memory:remember")

    Returns:
        The priority level for the operation
    """
    # Try exact match first
    if operation_name in OPERATION_PRIORITIES:
        return OPERATION_PRIORITIES[operation_name]

    # Try wildcard match (e.g., "graphSync:*" matches "graphSync:anything")
    parts = operation_name.split(":")
    if len(parts) >= 1:
        wildcard_key = f"{parts[0]}:*"
        if wildcard_key in OPERATION_PRIORITIES:
            return OPERATION_PRIORITIES[wildcard_key]

    # Return default priority
    return DEFAULT_PRIORITY


def is_critical(operation_name: str) -> bool:
    """Check if an operation is critical (should never be dropped)."""
    return get_priority(operation_name) == "critical"


def get_operations_by_priority(priority: Priority) -> List[str]:
    """Get all operation names for a given priority level."""
    return [name for name, p in OPERATION_PRIORITIES.items() if p == priority]
