"""Explicit fixed managed-v2 schema; never adopt or drop legacy/custom objects."""

from typing import Any, Dict, List, Optional

from ...types import ManagedGraphAdapter
from ..errors import GraphDatabaseError
from ..identity import MANAGED_KINDS, MANAGED_LABELS

_NAMES = [
    {
        "kind": kind,
        "label": MANAGED_LABELS[kind],
        "name": f"cortex_v2_{kind.lower()}_key",
        "scope": f"cortex_v2_{kind.lower()}_scope",
    }
    for kind in MANAGED_KINDS
]


async def _inspect(adapter: ManagedGraphAdapter) -> Dict[str, Any]:
    if not callable(getattr(adapter, "managed_dialect", None)) or not callable(
        getattr(adapter, "managed_read", None)
    ):
        raise GraphDatabaseError(
            "Adapter requires bounded managed-v2 dialect support; upgrade and explicitly initialize/rebuild.",
            "GRAPH_SCHEMA_MIGRATION_REQUIRED",
        )
    dialect = await adapter.managed_dialect()
    constraints = await adapter.managed_read(
        "SHOW CONSTRAINTS YIELD name, type, entityType, labelsOrTypes, properties RETURN *"
        if dialect == "neo4j"
        else "SHOW CONSTRAINT INFO"
    )
    indexes = await adapter.managed_read(
        "SHOW INDEXES YIELD name, type, entityType, labelsOrTypes, properties, state, owningConstraint RETURN *"
        if dialect == "neo4j"
        else "SHOW INDEX INFO"
    )
    return {
        "dialect": dialect,
        "constraints": constraints.records,
        "indexes": indexes.records,
    }


def _list(value: Any) -> List[str]:
    return list(map(str, value)) if isinstance(value, list) else []


def _constraint(row: Dict[str, Any], label: str, dialect: str) -> bool:
    if dialect == "neo4j":
        return (
            row.get("type") == "NODE_PROPERTY_UNIQUENESS"
            and row.get("entityType") == "NODE"
            and _list(row.get("labelsOrTypes")) == [label]
            and _list(row.get("properties")) == ["key"]
        )
    return (
        row.get("constraint type") == "unique"
        and row.get("label") == label
        and _list(row.get("properties")) == ["key"]
    )


def _index(row: Dict[str, Any], label: str, prop: str, dialect: str) -> bool:
    if dialect == "neo4j":
        return (
            row.get("entityType") == "NODE"
            and row.get("state") == "ONLINE"
            and _list(row.get("labelsOrTypes")) == [label]
            and _list(row.get("properties")) == [prop]
        )
    return (
        row.get("label") == label
        and _list(row.get("property")) == [prop]
        and row.get("index type") == "label+property"
    )


async def verify_graph_schema(adapter: ManagedGraphAdapter) -> Dict[str, Any]:
    actual = await _inspect(adapter)
    missing = []
    for item in _NAMES:
        if actual["dialect"] == "neo4j":
            for row in actual["constraints"]:
                if row.get("name") == item["name"] and not _constraint(
                    row, item["label"], actual["dialect"]
                ):
                    raise GraphDatabaseError(
                        "Fixed managed schema name has a conflicting definition.",
                        "GRAPH_SCHEMA_CONFLICT",
                    )
            for row in actual["indexes"]:
                if row.get("name") == item["scope"] and not _index(
                    row, item["label"], "tenantValue", actual["dialect"]
                ):
                    raise GraphDatabaseError(
                        "Fixed managed scope index has a conflicting definition.",
                        "GRAPH_SCHEMA_CONFLICT",
                    )
        if not any(
            _constraint(row, item["label"], actual["dialect"])
            for row in actual["constraints"]
        ):
            missing.append(item["name"])
        if not any(
            _index(row, item["label"], "key", actual["dialect"])
            for row in actual["indexes"]
        ):
            missing.append(item["label"] + ".key index")
        if not any(
            _index(row, item["label"], "tenantValue", actual["dialect"])
            for row in actual["indexes"]
        ):
            missing.append(item["scope"])
    return {
        "valid": not missing,
        "constraints": [
            str(row.get("name", str(row.get("label")) + ".key"))
            for row in actual["constraints"]
        ],
        "indexes": [
            str(row.get("name", str(row.get("label")) + "." + str(row.get("property"))))
            for row in actual["indexes"]
        ],
        "missing": missing,
    }


async def assert_managed_graph_compatibility(adapter: ManagedGraphAdapter) -> None:
    if not await adapter.is_connected():
        raise GraphDatabaseError("Managed graph is unavailable.", "GRAPH_UNAVAILABLE")
    result = await verify_graph_schema(adapter)
    if not result["valid"]:
        raise GraphDatabaseError(
            "Managed-v2 schema is missing. Explicitly initialize and rebuild with an administrator transport.",
            "GRAPH_SCHEMA_MIGRATION_REQUIRED",
        )


async def initialize_graph_schema(adapter: ManagedGraphAdapter) -> None:
    actual = await _inspect(adapter)
    await verify_graph_schema(
        adapter
    )  # Conflicting named shapes refuse before effects.
    for item in _NAMES:
        label, name, scope = item["label"], item["name"], item["scope"]
        if not any(
            _constraint(row, label, actual["dialect"]) for row in actual["constraints"]
        ):
            await adapter.query(
                f"CREATE CONSTRAINT {name} IF NOT EXISTS FOR (n:{label}) REQUIRE n.key IS UNIQUE"
                if actual["dialect"] == "neo4j"
                else f"CREATE CONSTRAINT ON (n:{label}) ASSERT n.key IS UNIQUE"
            )
        if actual["dialect"] == "memgraph" and not any(
            _index(row, label, "key", actual["dialect"]) for row in actual["indexes"]
        ):
            await adapter.query(f"CREATE INDEX ON :{label}(key)")
        if not any(
            _index(row, label, "tenantValue", actual["dialect"])
            for row in actual["indexes"]
        ):
            await adapter.query(
                f"CREATE INDEX {scope} IF NOT EXISTS FOR (n:{label}) ON (n.tenantValue)"
                if actual["dialect"] == "neo4j"
                else f"CREATE INDEX ON :{label}(tenantValue)"
            )
    await assert_managed_graph_compatibility(adapter)


async def drop_graph_schema(
    adapter: ManagedGraphAdapter, options: Optional[Dict[str, Any]] = None
) -> None:
    if not options or options.get("managedVersion") != 2:
        raise GraphDatabaseError(
            "Global schema deletion is retired; explicitly select managedVersion:2 for fixed Cortex-v2 objects.",
            "GRAPH_SCHEMA_MIGRATION_REQUIRED",
        )
    actual = await _inspect(adapter)
    await verify_graph_schema(adapter)
    for item in _NAMES:
        label, name, scope = item["label"], item["name"], item["scope"]
        if actual["dialect"] == "neo4j":
            if any(
                row.get("name") == name and _constraint(row, label, actual["dialect"])
                for row in actual["constraints"]
            ):
                await adapter.query(f"DROP CONSTRAINT {name} IF EXISTS")
            if any(
                row.get("name") == scope
                and _index(row, label, "tenantValue", actual["dialect"])
                for row in actual["indexes"]
            ):
                await adapter.query(f"DROP INDEX {scope} IF EXISTS")
        else:
            if any(
                _constraint(row, label, actual["dialect"])
                for row in actual["constraints"]
            ):
                await adapter.query(
                    f"DROP CONSTRAINT ON (n:{label}) ASSERT n.key IS UNIQUE"
                )
            for prop in ("key", "tenantValue"):
                if any(
                    _index(row, label, prop, actual["dialect"])
                    for row in actual["indexes"]
                ):
                    await adapter.query(f"DROP INDEX ON :{label}({prop})")
