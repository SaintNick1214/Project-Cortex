"""
Cortex SDK Configuration

Centralized configuration with environment variable support.
Values can be overridden at runtime via API parameters.
"""

import os
from dataclasses import dataclass
from typing import Optional

from .types import RecallLimits


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LLM Model Configuration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MODEL_DEFAULTS = {
    "fact_extraction": {
        "openai": "gpt-4o-2024-11-20",
        "anthropic": "claude-3-haiku-20240307",
    },
    "conflict_resolution": {
        "openai": "gpt-4o-2024-11-20",
        "anthropic": "claude-3-haiku-20240307",
    },
    "embedding": "text-embedding-3-small",
}


def resolve_fact_extraction_model(
    config_model: Optional[str] = None,
    provider: str = "openai",
) -> str:
    """
    Resolve model for fact extraction.

    Priority order:
    1. config_model (programmatic config)
    2. CORTEX_FACT_EXTRACTION_MODEL env var
    3. Provider-specific default

    Args:
        config_model: Model from LLMConfig.model
        provider: LLM provider ("openai" or "anthropic")

    Returns:
        Resolved model name
    """
    if config_model:
        return config_model
    env_model = os.environ.get("CORTEX_FACT_EXTRACTION_MODEL")
    if env_model:
        return env_model
    return MODEL_DEFAULTS["fact_extraction"].get(provider, MODEL_DEFAULTS["fact_extraction"]["openai"])


def resolve_conflict_resolution_model(
    config_model: Optional[str] = None,
    provider: str = "openai",
) -> str:
    """
    Resolve model for conflict resolution (belief revision).

    Priority order:
    1. config_model (per-call or programmatic config)
    2. CORTEX_CONFLICT_RESOLUTION_MODEL env var
    3. CORTEX_FACT_EXTRACTION_MODEL env var (fallback)
    4. Provider-specific default

    Args:
        config_model: Model from BeliefRevisionConfig
        provider: LLM provider ("openai" or "anthropic")

    Returns:
        Resolved model name
    """
    if config_model:
        return config_model
    env_model = os.environ.get("CORTEX_CONFLICT_RESOLUTION_MODEL")
    if env_model:
        return env_model
    env_model = os.environ.get("CORTEX_FACT_EXTRACTION_MODEL")
    if env_model:
        return env_model
    return MODEL_DEFAULTS["conflict_resolution"].get(
        provider, MODEL_DEFAULTS["conflict_resolution"]["openai"]
    )


def resolve_embedding_model(config_model: Optional[str] = None) -> str:
    """
    Resolve model for embedding generation.

    Priority order:
    1. config_model (programmatic config)
    2. CORTEX_EMBEDDING_MODEL env var
    3. Default model

    Args:
        config_model: Model from EmbeddingConfig.model

    Returns:
        Resolved model name
    """
    if config_model:
        return config_model
    env_model = os.environ.get("CORTEX_EMBEDDING_MODEL")
    if env_model:
        return env_model
    return MODEL_DEFAULTS["embedding"]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Recall Limits Configuration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


def _parse_env_int(env_var: Optional[str], default_value: int) -> int:
    """Parse an environment variable as an integer with a default value."""
    if not env_var:
        return default_value
    try:
        return int(env_var)
    except ValueError:
        return default_value


@dataclass
class ResolvedRecallLimits:
    """
    Fully resolved recall limits with all fields populated.

    This is the result of resolve_recall_limits() and guarantees
    all fields have values (no None).
    """
    memories: int
    facts: int
    graph_hops: int
    graph_entities_per_hop: int
    graph_results_per_entity: int
    total: int


def get_recall_defaults() -> ResolvedRecallLimits:
    """
    Get default limits for recall() operations with env var overrides.

    Environment variables:
    - CORTEX_RECALL_LIMIT_MEMORIES: Max memories from vector search (default: 20)
    - CORTEX_RECALL_LIMIT_FACTS: Max facts from semantic search (default: 15)
    - CORTEX_RECALL_GRAPH_HOPS: Graph traversal depth, 0=off (default: 2)
    - CORTEX_RECALL_GRAPH_ENTITIES_PER_HOP: Entities to expand per hop (default: 5)
    - CORTEX_RECALL_GRAPH_RESULTS_PER_ENTITY: Results per entity (default: 3)
    - CORTEX_RECALL_LIMIT_TOTAL: Final aggregate limit (default: 30)

    Returns:
        ResolvedRecallLimits with defaults and env var overrides
    """
    return ResolvedRecallLimits(
        memories=_parse_env_int(os.environ.get("CORTEX_RECALL_LIMIT_MEMORIES"), 20),
        facts=_parse_env_int(os.environ.get("CORTEX_RECALL_LIMIT_FACTS"), 15),
        graph_hops=_parse_env_int(os.environ.get("CORTEX_RECALL_GRAPH_HOPS"), 2),
        graph_entities_per_hop=_parse_env_int(
            os.environ.get("CORTEX_RECALL_GRAPH_ENTITIES_PER_HOP"), 5
        ),
        graph_results_per_entity=_parse_env_int(
            os.environ.get("CORTEX_RECALL_GRAPH_RESULTS_PER_ENTITY"), 3
        ),
        total=_parse_env_int(os.environ.get("CORTEX_RECALL_LIMIT_TOTAL"), 30),
    )


def resolve_recall_limits(
    user_limits: Optional[RecallLimits] = None,
    legacy_limit: Optional[int] = None,
) -> ResolvedRecallLimits:
    """
    Merge user-provided limits with defaults.

    User values take precedence, falling back to env vars, then SDK defaults.

    Args:
        user_limits: Optional limits from RecallParams.limits
        legacy_limit: Optional legacy 'limit' param for backward compat

    Returns:
        Fully resolved limits with all fields populated
    """
    # Start with defaults (already includes env var overrides)
    defaults = get_recall_defaults()

    resolved = ResolvedRecallLimits(
        memories=defaults.memories,
        facts=defaults.facts,
        graph_hops=defaults.graph_hops,
        graph_entities_per_hop=defaults.graph_entities_per_hop,
        graph_results_per_entity=defaults.graph_results_per_entity,
        total=defaults.total,
    )

    # Apply user-provided limits
    if user_limits:
        if user_limits.memories is not None:
            resolved.memories = user_limits.memories
        if user_limits.facts is not None:
            resolved.facts = user_limits.facts
        if user_limits.graph_hops is not None:
            resolved.graph_hops = user_limits.graph_hops
        if user_limits.graph_entities_per_hop is not None:
            resolved.graph_entities_per_hop = user_limits.graph_entities_per_hop
        if user_limits.graph_results_per_entity is not None:
            resolved.graph_results_per_entity = user_limits.graph_results_per_entity
        if user_limits.total is not None:
            resolved.total = user_limits.total

    # Legacy 'limit' param maps to 'total' (only if limits.total not set)
    if legacy_limit is not None:
        if user_limits is None or user_limits.total is None:
            resolved.total = legacy_limit

    return resolved
