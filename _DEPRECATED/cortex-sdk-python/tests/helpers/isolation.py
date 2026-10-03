"""
Test Isolation Helpers

Provides unique run IDs and prefixed entity generators to enable
parallel test execution without conflicts.

Each test file should create a TestRunContext at module scope,
then use its generators for all entity IDs.
"""

import random
import string
import time
from dataclasses import dataclass, field
from typing import List, Optional


def _generate_random_suffix(length: int = 6) -> str:
    """Generate a random alphanumeric suffix."""
    chars = string.ascii_lowercase + string.digits
    return "".join(random.choice(chars) for _ in range(length))


@dataclass
class TestRunContext:
    """
    Context for a single test run, containing a unique run ID and
    generators for creating prefixed entity identifiers.

    Example:
        >>> ctx = create_test_run_context()
        >>> user_id = ctx.user_id("alice")
        >>> # user_id is like: "run-1234567890-abc123-user-alice"
    """

    run_id: str
    """Unique identifier for this test run"""

    _generators: dict = field(default_factory=dict, repr=False)

    def _make_id(self, prefix: str, suffix: Optional[str] = None) -> str:
        """Generate an ID with the run prefix and entity type prefix."""
        base = f"{self.run_id}-{prefix}"
        if suffix:
            return f"{base}-{suffix}"
        else:
            # Add timestamp to ensure uniqueness within same test
            return f"{base}-{int(time.time() * 1000)}"

    def memory_space_id(self, suffix: Optional[str] = None) -> str:
        """
        Generate a memory space ID prefixed with the run ID.

        Args:
            suffix: Optional suffix to distinguish multiple spaces within a test

        Returns:
            Unique memory space ID
        """
        return self._make_id("space", suffix)

    def user_id(self, suffix: Optional[str] = None) -> str:
        """
        Generate a user ID prefixed with the run ID.

        Args:
            suffix: Optional suffix to distinguish multiple users within a test

        Returns:
            Unique user ID
        """
        return self._make_id("user", suffix)

    def agent_id(self, suffix: Optional[str] = None) -> str:
        """
        Generate an agent ID prefixed with the run ID.

        Args:
            suffix: Optional suffix to distinguish multiple agents within a test

        Returns:
            Unique agent ID
        """
        return self._make_id("agent", suffix)

    def conversation_id(self, suffix: Optional[str] = None) -> str:
        """
        Generate a conversation ID prefixed with the run ID.

        Args:
            suffix: Optional suffix to distinguish multiple conversations within a test

        Returns:
            Unique conversation ID
        """
        return self._make_id("conv", suffix)

    def context_id(self, suffix: Optional[str] = None) -> str:
        """
        Generate a context ID prefixed with the run ID.

        Args:
            suffix: Optional suffix to distinguish multiple contexts within a test

        Returns:
            Unique context ID
        """
        return self._make_id("ctx", suffix)

    def immutable_type(self, suffix: Optional[str] = None) -> str:
        """
        Generate an immutable type prefixed with the run ID.

        Args:
            suffix: Optional suffix to distinguish multiple types within a test

        Returns:
            Unique immutable type
        """
        return self._make_id("immtype", suffix)

    def immutable_id(self, suffix: Optional[str] = None) -> str:
        """
        Generate an immutable record ID prefixed with the run ID.

        Args:
            suffix: Optional suffix to distinguish multiple records within a test

        Returns:
            Unique immutable ID
        """
        return self._make_id("immid", suffix)

    def mutable_namespace(self, suffix: Optional[str] = None) -> str:
        """
        Generate a mutable namespace prefixed with the run ID.

        Args:
            suffix: Optional suffix to distinguish multiple namespaces within a test

        Returns:
            Unique mutable namespace
        """
        return self._make_id("mutns", suffix)

    def mutable_key(self, suffix: Optional[str] = None) -> str:
        """
        Generate a mutable key prefixed with the run ID.

        Args:
            suffix: Optional suffix to distinguish multiple keys within a test

        Returns:
            Unique mutable key
        """
        return self._make_id("mutkey", suffix)

    def fact_prefix(self, suffix: Optional[str] = None) -> str:
        """
        Generate a fact ID prefix (for reference/tracking purposes).
        Note: Facts generate their own IDs, but this helps with tracking.

        Args:
            suffix: Optional suffix to distinguish multiple facts within a test

        Returns:
            Fact prefix for tracking
        """
        return self._make_id("fact", suffix)

    def belongs_to_run(self, entity_id: str) -> bool:
        """
        Check if an entity ID belongs to this test run.

        Args:
            entity_id: The entity ID to check

        Returns:
            True if the ID starts with this run's prefix
        """
        return entity_id.startswith(self.run_id)


def create_test_run_context() -> TestRunContext:
    """
    Create a new test run context with a unique run ID.

    The run ID format: `run-{timestamp}-{random}`
    - timestamp: milliseconds since epoch for ordering/debugging
    - random: 6-char alphanumeric for uniqueness within same millisecond

    Returns:
        A TestRunContext with generators for all entity types

    Example:
        >>> ctx = create_test_run_context()
        >>> user_id = ctx.user_id("alice")
        >>> space_id = ctx.memory_space_id("test")
    """
    timestamp = int(time.time() * 1000)
    random_suffix = _generate_random_suffix()
    run_id = f"run-{timestamp}-{random_suffix}"

    return TestRunContext(run_id=run_id)


def create_named_test_run_context(test_name: str) -> TestRunContext:
    """
    Create a test run context with a custom prefix for better test output readability.

    Args:
        test_name: A short name identifying the test file or suite

    Returns:
        A TestRunContext with the custom prefix

    Example:
        >>> ctx = create_named_test_run_context("users")
        >>> # run_id will be like: "users-run-1234567890-abc123"
    """
    timestamp = int(time.time() * 1000)
    random_suffix = _generate_random_suffix()
    run_id = f"{test_name}-run-{timestamp}-{random_suffix}"

    return TestRunContext(run_id=run_id)


# Global registry for tracking all test run contexts
_active_contexts: dict[str, TestRunContext] = {}


def create_registered_test_run_context(
    test_name: Optional[str] = None,
) -> TestRunContext:
    """
    Create and register a test run context.
    The context will be tracked for potential cross-test debugging.

    Args:
        test_name: Optional name for the test suite

    Returns:
        A registered TestRunContext
    """
    ctx = (
        create_named_test_run_context(test_name)
        if test_name
        else create_test_run_context()
    )
    _active_contexts[ctx.run_id] = ctx
    return ctx


def unregister_test_run_context(ctx: TestRunContext) -> None:
    """
    Unregister a test run context after cleanup.

    Args:
        ctx: The context to unregister
    """
    _active_contexts.pop(ctx.run_id, None)


def get_active_test_runs() -> List[str]:
    """
    Get all currently active test run contexts.
    Useful for debugging parallel test issues.

    Returns:
        List of active run IDs
    """
    return list(_active_contexts.keys())


def extract_run_id(entity_id: str) -> Optional[str]:
    """
    Extract the run ID prefix from any entity ID created by a TestRunContext.

    Args:
        entity_id: The entity ID to parse

    Returns:
        The run ID if the entity was created by a TestRunContext, None otherwise

    Example:
        >>> run_id = extract_run_id("run-1234567890-abc123-space-test")
        >>> # returns: "run-1234567890-abc123"
    """
    import re

    # Match pattern: run-{timestamp}-{random} or {name}-run-{timestamp}-{random}
    match = re.match(r"^((?:\w+-)?run-\d+-[a-z0-9]+)", entity_id)
    return match.group(1) if match else None


def same_test_run(id1: str, id2: str) -> bool:
    """
    Check if two entity IDs belong to the same test run.

    Args:
        id1: First entity ID
        id2: Second entity ID

    Returns:
        True if both IDs belong to the same test run
    """
    run1 = extract_run_id(id1)
    run2 = extract_run_id(id2)
    return run1 is not None and run1 == run2
