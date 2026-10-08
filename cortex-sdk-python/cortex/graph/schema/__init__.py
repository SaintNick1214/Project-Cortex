"""Fixed managed graph schema management."""

from .init_schema import (
    assert_managed_graph_compatibility,
    drop_graph_schema,
    initialize_graph_schema,
    verify_graph_schema,
)

__all__ = [
    "assert_managed_graph_compatibility",
    "initialize_graph_schema",
    "verify_graph_schema",
    "drop_graph_schema",
]
