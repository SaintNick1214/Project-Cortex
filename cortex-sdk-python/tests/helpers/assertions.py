"""
Filtered Assertion Helpers

Provides assertion helpers that filter results by test run prefix,
enabling accurate count/list assertions in parallel test environments.

These replace conflict-prone global assertions like:
    assert await cortex.users.count() >= 3

With isolated assertions like:
    assert await count_users(cortex, ctx) == 3
"""

import asyncio
from typing import Any, Awaitable, Callable, List, Optional, TypeVar

from cortex import Cortex

from .isolation import TestRunContext

T = TypeVar("T")


def _get_attr(item: Any, field: str) -> Optional[str]:
    """Get attribute from object or dict."""
    if isinstance(item, dict):
        return item.get(field)
    return getattr(item, field, None)


def _filter_by_prefix(items: List[T], prefix: str, id_fields: List[str]) -> List[T]:
    """Filter items by prefix, checking multiple possible ID fields."""
    result = []
    for item in items:
        for field in id_fields:
            value = _get_attr(item, field)
            if isinstance(value, str) and value.startswith(prefix):
                result.append(item)
                break
    return result


# ============================================================================
# User Assertions
# ============================================================================


async def count_users(cortex: Cortex, ctx: TestRunContext) -> int:
    """
    Count users belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context

    Returns:
        Number of users matching the run prefix
    """
    result = await cortex.users.list(limit=1000)
    users = result if isinstance(result, list) else result.get("users", [])
    return len(_filter_by_prefix(users, ctx.run_id, ["id"]))


async def list_users(cortex: Cortex, ctx: TestRunContext) -> List[Any]:
    """
    List users belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context

    Returns:
        Users matching the run prefix
    """
    result = await cortex.users.list(limit=1000)
    users = result if isinstance(result, list) else result.get("users", [])
    return _filter_by_prefix(users, ctx.run_id, ["id"])


async def expect_user_count(
    cortex: Cortex, ctx: TestRunContext, expected_count: int
) -> None:
    """
    Assert that exactly N users exist for this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context
        expected_count: Expected number of users

    Raises:
        AssertionError: If count doesn't match
    """
    count = await count_users(cortex, ctx)
    assert (
        count == expected_count
    ), f"Expected {expected_count} users for run {ctx.run_id}, but found {count}"


# ============================================================================
# Agent Assertions
# ============================================================================


async def count_agents(cortex: Cortex, ctx: TestRunContext) -> int:
    """
    Count agents belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context

    Returns:
        Number of agents matching the run prefix
    """
    result = await cortex.agents.list(limit=1000)
    agents = result if isinstance(result, list) else []
    return len(_filter_by_prefix(agents, ctx.run_id, ["id", "agent_id"]))


async def list_agents(cortex: Cortex, ctx: TestRunContext) -> List[Any]:
    """
    List agents belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context

    Returns:
        Agents matching the run prefix
    """
    result = await cortex.agents.list(limit=1000)
    agents = result if isinstance(result, list) else []
    return _filter_by_prefix(agents, ctx.run_id, ["id", "agent_id"])


# ============================================================================
# Memory Space Assertions
# ============================================================================


async def count_memory_spaces(cortex: Cortex, ctx: TestRunContext) -> int:
    """
    Count memory spaces belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context

    Returns:
        Number of memory spaces matching the run prefix
    """
    result = await cortex.memory_spaces.list(limit=1000)
    spaces = result.get("spaces", []) if isinstance(result, dict) else result
    return len(_filter_by_prefix(spaces, ctx.run_id, ["memory_space_id"]))


async def list_memory_spaces(cortex: Cortex, ctx: TestRunContext) -> List[Any]:
    """
    List memory spaces belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context

    Returns:
        Memory spaces matching the run prefix
    """
    result = await cortex.memory_spaces.list(limit=1000)
    spaces = result.get("spaces", []) if isinstance(result, dict) else result
    return _filter_by_prefix(spaces, ctx.run_id, ["memory_space_id"])


# ============================================================================
# Conversation Assertions
# ============================================================================


async def count_conversations(
    cortex: Cortex, ctx: TestRunContext, memory_space_id: Optional[str] = None
) -> int:
    """
    Count conversations belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context
        memory_space_id: Optional specific memory space ID

    Returns:
        Number of conversations matching the run prefix
    """
    if memory_space_id:
        result = await cortex.conversations.list(
            memory_space_id=memory_space_id, limit=1000
        )
    else:
        result = await cortex.conversations.list(limit=1000)

    conversations = (
        result if isinstance(result, list) else result.get("conversations", [])
    )
    return len(
        _filter_by_prefix(
            conversations, ctx.run_id, ["memory_space_id", "conversation_id"]
        )
    )


async def list_conversations(
    cortex: Cortex, ctx: TestRunContext, memory_space_id: Optional[str] = None
) -> List[Any]:
    """
    List conversations belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context
        memory_space_id: Optional specific memory space ID

    Returns:
        Conversations matching the run prefix
    """
    if memory_space_id:
        result = await cortex.conversations.list(
            memory_space_id=memory_space_id, limit=1000
        )
    else:
        result = await cortex.conversations.list(limit=1000)

    conversations = (
        result if isinstance(result, list) else result.get("conversations", [])
    )
    return _filter_by_prefix(
        conversations, ctx.run_id, ["memory_space_id", "conversation_id"]
    )


# ============================================================================
# Context Assertions
# ============================================================================


async def count_contexts(cortex: Cortex, ctx: TestRunContext) -> int:
    """
    Count contexts belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context

    Returns:
        Number of contexts matching the run prefix
    """
    result = await cortex.contexts.list(limit=1000)
    contexts = result.get("contexts", []) if isinstance(result, dict) else result
    return len(_filter_by_prefix(contexts, ctx.run_id, ["memory_space_id", "id"]))


async def list_contexts(cortex: Cortex, ctx: TestRunContext) -> List[Any]:
    """
    List contexts belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context

    Returns:
        Contexts matching the run prefix
    """
    result = await cortex.contexts.list(limit=1000)
    contexts = result.get("contexts", []) if isinstance(result, dict) else result
    return _filter_by_prefix(contexts, ctx.run_id, ["memory_space_id", "id"])


# ============================================================================
# Immutable Record Assertions
# ============================================================================


async def count_immutable(
    cortex: Cortex, ctx: TestRunContext, record_type: Optional[str] = None
) -> int:
    """
    Count immutable records belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context
        record_type: Optional filter by type

    Returns:
        Number of immutable records matching the run prefix
    """
    if record_type:
        result = await cortex.immutable.list(type=record_type, limit=1000)
    else:
        result = await cortex.immutable.list(limit=1000)

    records = result if isinstance(result, list) else []
    return len(_filter_by_prefix(records, ctx.run_id, ["type", "id"]))


async def list_immutable(
    cortex: Cortex, ctx: TestRunContext, record_type: Optional[str] = None
) -> List[Any]:
    """
    List immutable records belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context
        record_type: Optional filter by type

    Returns:
        Immutable records matching the run prefix
    """
    if record_type:
        result = await cortex.immutable.list(type=record_type, limit=1000)
    else:
        result = await cortex.immutable.list(limit=1000)

    records = result if isinstance(result, list) else []
    return _filter_by_prefix(records, ctx.run_id, ["type", "id"])


# ============================================================================
# Mutable Record Assertions
# ============================================================================


async def count_mutable(
    cortex: Cortex, ctx: TestRunContext, namespace: Optional[str] = None
) -> int:
    """
    Count mutable records belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context
        namespace: Optional filter by namespace

    Returns:
        Number of mutable records matching the run prefix
    """
    if namespace:
        result = await cortex.mutable.list(namespace=namespace, limit=1000)
    else:
        result = await cortex.mutable.list(limit=1000)

    records = result if isinstance(result, list) else []
    return len(_filter_by_prefix(records, ctx.run_id, ["namespace", "key"]))


async def list_mutable(
    cortex: Cortex, ctx: TestRunContext, namespace: Optional[str] = None
) -> List[Any]:
    """
    List mutable records belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context
        namespace: Optional filter by namespace

    Returns:
        Mutable records matching the run prefix
    """
    if namespace:
        result = await cortex.mutable.list(namespace=namespace, limit=1000)
    else:
        result = await cortex.mutable.list(limit=1000)

    records = result if isinstance(result, list) else []
    return _filter_by_prefix(records, ctx.run_id, ["namespace", "key"])


# ============================================================================
# Fact Assertions
# ============================================================================


async def count_facts(
    cortex: Cortex, ctx: TestRunContext, memory_space_id: str
) -> int:
    """
    Count facts in a memory space belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context
        memory_space_id: Memory space ID (should be prefixed with run ID)

    Returns:
        Number of facts in the memory space
    """
    if not memory_space_id.startswith(ctx.run_id):
        print(
            f"Warning: memory_space_id {memory_space_id} does not belong to run {ctx.run_id}"
        )

    result = await cortex.facts.list(memory_space_id=memory_space_id, limit=1000)
    facts = result if isinstance(result, list) else result.get("facts", [])
    return len(facts)


async def list_facts(
    cortex: Cortex, ctx: TestRunContext, memory_space_id: str
) -> List[Any]:
    """
    List facts in a memory space belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context
        memory_space_id: Memory space ID (should be prefixed with run ID)

    Returns:
        Facts in the memory space
    """
    if not memory_space_id.startswith(ctx.run_id):
        print(
            f"Warning: memory_space_id {memory_space_id} does not belong to run {ctx.run_id}"
        )

    result = await cortex.facts.list(memory_space_id=memory_space_id, limit=1000)
    return result if isinstance(result, list) else result.get("facts", [])


# ============================================================================
# Memory/Vector Assertions
# ============================================================================


async def count_memories(
    cortex: Cortex, ctx: TestRunContext, memory_space_id: str
) -> int:
    """
    Count memories in a memory space belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context
        memory_space_id: Memory space ID (should be prefixed with run ID)

    Returns:
        Number of memories in the memory space
    """
    if not memory_space_id.startswith(ctx.run_id):
        print(
            f"Warning: memory_space_id {memory_space_id} does not belong to run {ctx.run_id}"
        )

    result = await cortex.vector.list(memory_space_id=memory_space_id, limit=1000)
    memories = result if isinstance(result, list) else result.get("memories", [])
    return len(memories)


async def list_memories(
    cortex: Cortex, ctx: TestRunContext, memory_space_id: str
) -> List[Any]:
    """
    List memories in a memory space belonging to this test run.

    Args:
        cortex: Cortex SDK instance
        ctx: Test run context
        memory_space_id: Memory space ID (should be prefixed with run ID)

    Returns:
        Memories in the memory space
    """
    if not memory_space_id.startswith(ctx.run_id):
        print(
            f"Warning: memory_space_id {memory_space_id} does not belong to run {ctx.run_id}"
        )

    result = await cortex.vector.list(memory_space_id=memory_space_id, limit=1000)
    return result if isinstance(result, list) else result.get("memories", [])


# ============================================================================
# Generic Assertion Helpers
# ============================================================================


def assert_condition(condition: bool, message: str, ctx: TestRunContext) -> None:
    """
    Assert that a condition is true for this test run.

    Args:
        condition: Condition to check
        message: Error message if condition is false
        ctx: Test run context for error context

    Raises:
        AssertionError: If condition is false
    """
    assert condition, f"Assertion failed for run {ctx.run_id}: {message}"


async def wait_for_condition(
    check: Callable[[], Awaitable[bool]],
    ctx: TestRunContext,
    timeout: float = 5.0,
    interval: float = 0.1,
) -> bool:
    """
    Wait for a condition to be true, with timeout.

    Args:
        check: Async function that returns true when condition is met
        ctx: Test run context
        timeout: Maximum time to wait in seconds (default: 5.0)
        interval: Polling interval in seconds (default: 0.1)

    Returns:
        True if condition was met, False if timeout
    """
    import time

    start_time = time.time()

    while time.time() - start_time < timeout:
        if await check():
            return True
        await asyncio.sleep(interval)

    print(f"Timeout waiting for condition in run {ctx.run_id}")
    return False


async def wait_for_count(
    count_fn: Callable[[], Awaitable[int]],
    expected: int,
    ctx: TestRunContext,
    timeout: float = 5.0,
) -> bool:
    """
    Wait for an entity count to reach expected value.

    Args:
        count_fn: Async function that returns current count
        expected: Expected count
        ctx: Test run context
        timeout: Maximum time to wait

    Returns:
        True if count reached expected value
    """
    return await wait_for_condition(
        lambda: count_fn().then(lambda c: c == expected), ctx, timeout
    )
