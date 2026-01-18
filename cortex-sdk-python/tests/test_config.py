"""
Tests for Configuration Module (cortex.config)

Tests for recall limits resolution and environment variable handling.
"""

import os
import pytest

from cortex import RecallLimits
from cortex.config import (
    ResolvedRecallLimits,
    get_recall_defaults,
    resolve_recall_limits,
)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# get_recall_defaults() Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def test_get_recall_defaults_returns_resolved_limits():
    """get_recall_defaults() returns ResolvedRecallLimits with all fields."""
    defaults = get_recall_defaults()

    assert isinstance(defaults, ResolvedRecallLimits)
    assert defaults.memories is not None
    assert defaults.facts is not None
    assert defaults.graph_hops is not None
    assert defaults.graph_entities_per_hop is not None
    assert defaults.graph_results_per_entity is not None
    assert defaults.total is not None

    # Verify defaults are positive integers
    assert isinstance(defaults.memories, int)
    assert isinstance(defaults.facts, int)
    assert isinstance(defaults.graph_hops, int)
    assert isinstance(defaults.graph_entities_per_hop, int)
    assert isinstance(defaults.graph_results_per_entity, int)
    assert isinstance(defaults.total, int)

    assert defaults.memories > 0
    assert defaults.facts > 0
    assert defaults.graph_hops >= 0
    assert defaults.graph_entities_per_hop > 0
    assert defaults.graph_results_per_entity > 0
    assert defaults.total > 0


def test_get_recall_defaults_respects_env_vars():
    """get_recall_defaults() respects environment variable overrides."""
    # Save original env vars
    original_env = {}
    env_vars = {
        "CORTEX_RECALL_LIMIT_MEMORIES": "50",
        "CORTEX_RECALL_LIMIT_FACTS": "25",
        "CORTEX_RECALL_GRAPH_HOPS": "3",
        "CORTEX_RECALL_GRAPH_ENTITIES_PER_HOP": "10",
        "CORTEX_RECALL_GRAPH_RESULTS_PER_ENTITY": "5",
        "CORTEX_RECALL_LIMIT_TOTAL": "40",
    }

    for key, value in env_vars.items():
        original_env[key] = os.environ.get(key)
        os.environ[key] = value

    try:
        defaults = get_recall_defaults()

        assert defaults.memories == 50
        assert defaults.facts == 25
        assert defaults.graph_hops == 3
        assert defaults.graph_entities_per_hop == 10
        assert defaults.graph_results_per_entity == 5
        assert defaults.total == 40
    finally:
        # Restore original env vars
        for key, original_value in original_env.items():
            if original_value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = original_value


def test_get_recall_defaults_handles_invalid_env_vars():
    """get_recall_defaults() falls back to defaults for invalid env var values."""
    # Set invalid env vars
    os.environ["CORTEX_RECALL_LIMIT_MEMORIES"] = "invalid"
    os.environ["CORTEX_RECALL_LIMIT_FACTS"] = "not-a-number"

    try:
        defaults = get_recall_defaults()

        # Should fall back to defaults (positive integers)
        assert isinstance(defaults.memories, int)
        assert isinstance(defaults.facts, int)
        assert defaults.memories > 0
        assert defaults.facts > 0
    finally:
        # Clean up
        os.environ.pop("CORTEX_RECALL_LIMIT_MEMORIES", None)
        os.environ.pop("CORTEX_RECALL_LIMIT_FACTS", None)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# resolve_recall_limits() Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def test_resolve_recall_limits_with_user_limits():
    """resolve_recall_limits() applies user-provided limits."""
    user_limits = RecallLimits(
        memories=30,
        facts=20,
        graph_hops=1,
        graph_entities_per_hop=7,
        graph_results_per_entity=4,
        total=25,
    )

    resolved = resolve_recall_limits(user_limits=user_limits)

    assert isinstance(resolved, ResolvedRecallLimits)
    assert resolved.memories == 30
    assert resolved.facts == 20
    assert resolved.graph_hops == 1
    assert resolved.graph_entities_per_hop == 7
    assert resolved.graph_results_per_entity == 4
    assert resolved.total == 25


def test_resolve_recall_limits_with_partial_user_limits():
    """resolve_recall_limits() merges partial user limits with defaults."""
    user_limits = RecallLimits(
        memories=40,
        total=35,
        # Other fields not specified - should use defaults
    )

    resolved = resolve_recall_limits(user_limits=user_limits)

    assert resolved.memories == 40  # User override
    assert resolved.total == 35  # User override
    # Other fields should use defaults
    assert resolved.facts is not None
    assert resolved.graph_hops is not None
    assert resolved.graph_entities_per_hop is not None
    assert resolved.graph_results_per_entity is not None


def test_resolve_recall_limits_with_legacy_limit():
    """resolve_recall_limits() maps legacy limit parameter to total."""
    resolved = resolve_recall_limits(legacy_limit=15)

    assert resolved.total == 15
    # Other fields should use defaults
    assert resolved.memories is not None
    assert resolved.facts is not None


def test_resolve_recall_limits_legacy_limit_precedence():
    """resolve_recall_limits() uses user limits.total over legacy limit."""
    user_limits = RecallLimits(total=20)
    resolved = resolve_recall_limits(user_limits=user_limits, legacy_limit=15)

    # User limits.total should take precedence
    assert resolved.total == 20


def test_resolve_recall_limits_legacy_limit_when_no_user_total():
    """resolve_recall_limits() uses legacy limit when user limits.total not set."""
    user_limits = RecallLimits(memories=30)  # total not set
    resolved = resolve_recall_limits(user_limits=user_limits, legacy_limit=18)

    # Legacy limit should be applied
    assert resolved.total == 18
    assert resolved.memories == 30  # User override still applies


def test_resolve_recall_limits_no_user_input():
    """resolve_recall_limits() returns defaults when no user input provided."""
    resolved = resolve_recall_limits()

    assert isinstance(resolved, ResolvedRecallLimits)
    # Should match defaults
    defaults = get_recall_defaults()
    assert resolved.memories == defaults.memories
    assert resolved.facts == defaults.facts
    assert resolved.graph_hops == defaults.graph_hops
    assert resolved.graph_entities_per_hop == defaults.graph_entities_per_hop
    assert resolved.graph_results_per_entity == defaults.graph_results_per_entity
    assert resolved.total == defaults.total


def test_resolve_recall_limits_env_var_integration():
    """resolve_recall_limits() respects env vars when user limits not provided."""
    # Set env vars
    os.environ["CORTEX_RECALL_LIMIT_MEMORIES"] = "60"
    os.environ["CORTEX_RECALL_LIMIT_TOTAL"] = "45"

    try:
        resolved = resolve_recall_limits()

        # Should use env var values
        assert resolved.memories == 60
        assert resolved.total == 45
    finally:
        # Clean up
        os.environ.pop("CORTEX_RECALL_LIMIT_MEMORIES", None)
        os.environ.pop("CORTEX_RECALL_LIMIT_TOTAL", None)


def test_resolve_recall_limits_user_overrides_env_vars():
    """resolve_recall_limits() user limits take precedence over env vars."""
    # Set env vars
    os.environ["CORTEX_RECALL_LIMIT_MEMORIES"] = "100"
    os.environ["CORTEX_RECALL_LIMIT_TOTAL"] = "80"

    try:
        user_limits = RecallLimits(memories=50, total=40)
        resolved = resolve_recall_limits(user_limits=user_limits)

        # User limits should override env vars
        assert resolved.memories == 50
        assert resolved.total == 40
    finally:
        # Clean up
        os.environ.pop("CORTEX_RECALL_LIMIT_MEMORIES", None)
        os.environ.pop("CORTEX_RECALL_LIMIT_TOTAL", None)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ResolvedRecallLimits Tests
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def test_resolved_recall_limits_dataclass():
    """ResolvedRecallLimits is a proper dataclass with all fields."""
    limits = ResolvedRecallLimits(
        memories=20,
        facts=15,
        graph_hops=2,
        graph_entities_per_hop=5,
        graph_results_per_entity=3,
        total=30,
    )

    assert limits.memories == 20
    assert limits.facts == 15
    assert limits.graph_hops == 2
    assert limits.graph_entities_per_hop == 5
    assert limits.graph_results_per_entity == 3
    assert limits.total == 30
