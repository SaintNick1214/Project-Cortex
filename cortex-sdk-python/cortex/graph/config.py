"""Deterministic automatic graph connection selection (no driver work)."""
import os
from dataclasses import dataclass
from typing import Mapping, Optional

from ..types import GraphConnectionConfig


@dataclass
class GraphConnectionOptions:
    """One provider-specific tuple; explicit untyped URIs need explicit credentials."""
    type: Optional[str] = None
    uri: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


def resolve_graph_connection(
    enabled: Optional[bool] = None,
    connection: Optional[GraphConnectionOptions] = None,
    env: Optional[Mapping[str, str]] = None,
) -> Optional[GraphConnectionConfig]:
    """Explicit false prevents driver work; never mix credentials across providers."""
    values = os.environ if env is None else env
    if not (enabled if enabled is not None else values.get("CORTEX_GRAPH_SYNC") == "true"):
        return None
    explicit = connection or GraphConnectionOptions()
    if explicit.type is not None and explicit.type not in ("neo4j", "memgraph"):
        raise ValueError("Graph provider must be neo4j or memgraph.")
    available = [name for name in ("neo4j", "memgraph") if values.get(f"{name.upper()}_URI")]
    provider = explicit.type or (None if explicit.uri else available[0] if len(available) == 1 else None)
    if not explicit.uri and not provider:
        raise ValueError(
            "Graph configuration is ambiguous. Select neo4j or memgraph."
            if len(available) > 1 else
            "Graph is enabled but no URI is configured. Set NEO4J_URI or MEMGRAPH_URI."
        )
    prefix = provider.upper() if provider else None
    uri = explicit.uri if explicit.uri is not None else values.get(f"{prefix}_URI") if prefix else None
    username = explicit.username if explicit.username is not None else values.get(f"{prefix}_USERNAME") if prefix else None
    password = explicit.password if explicit.password is not None else values.get(f"{prefix}_PASSWORD") if prefix else None
    if not uri or not username or not password:
        raise ValueError("Graph is enabled but its URI, username and password tuple is incomplete. Configure one provider's credentials or a complete explicit graph connection.")
    return GraphConnectionConfig(uri=uri, username=username, password=password)
