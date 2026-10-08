"""
Cortex SDK - Graph Orphan Detection

Bounded managed cleanup for proven scoped derived Entity islands.
"""

import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from ..types import GraphScope
from .errors import GraphDatabaseError
from .identity import derived_graph_identity

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Types
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


@dataclass
class OrphanRule:
    """
    Orphan detection rules for different node types.

    Attributes:
        keep_if_referenced_by: Node types that must reference this node to keep it alive
        never_delete: Never auto-delete this node type
        explicit_only: Only delete if explicitly requested (not cascaded)
    """

    keep_if_referenced_by: Optional[List[str]] = None
    never_delete: bool = False
    explicit_only: bool = False


@dataclass
class DeletionContext:
    """
    Context for tracking deletions (prevents circular reference issues).

    Attributes:
        deleted_node_ids: Set of node IDs being deleted in this operation
        reason: Reason for deletion (for logging/debugging)
        timestamp: Timestamp of deletion
        orphan_rules: Optional custom orphan rules
    """

    deleted_node_ids: Set[str] = field(default_factory=set)
    reason: str = ""
    timestamp: int = 0
    orphan_rules: Optional[Dict[str, OrphanRule]] = None
    scope: Optional[GraphScope] = None


@dataclass
class OrphanCheckResult:
    """
    Result of orphan detection.

    Attributes:
        is_orphan: Is this node an orphan?
        reason: Reason for orphan status
        referenced_by: IDs of nodes that reference this node
        part_of_circular_island: Is this part of a circular orphan island?
        island_nodes: If part of island, the full island node IDs
    """

    is_orphan: bool
    reason: str
    referenced_by: List[str]
    part_of_circular_island: bool
    island_nodes: Optional[List[str]] = None


@dataclass
class DeleteResult:
    """
    Result of cascading delete operation.

    Attributes:
        deleted_nodes: IDs of all nodes deleted (including cascaded orphans)
        deleted_edges: IDs of all edges deleted
        orphan_islands: Orphan islands that were removed
    """

    deleted_nodes: List[str]
    deleted_edges: List[str]
    orphan_islands: List[Dict[str, Any]] = field(default_factory=list)


ORPHAN_RULES: Dict[str, OrphanRule] = {
    **{
        kind: OrphanRule(never_delete=True)
        for kind in ("User", "Agent", "Participant", "MemorySpace")
    },
    **{
        kind: OrphanRule(explicit_only=True)
        for kind in (
            "Memory",
            "Fact",
            "Context",
            "Conversation",
            "Immutable",
            "Mutable",
            "Artifact",
        )
    },
    "Entity": OrphanRule(keep_if_referenced_by=["Fact"]),
}


def _record(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _entity(properties: Dict[str, Any], scope: GraphScope) -> str:
    if (
        properties.get("kind") != "Entity"
        or not isinstance(properties.get("name"), str)
        or not isinstance(properties.get("type"), str)
    ):
        raise GraphDatabaseError(
            "Unknown or non-derived graph node preserved.", "GRAPH_ERASURE_BLOCKED"
        )
    expected = derived_graph_identity(
        "Entity", properties["name"], scope, properties["type"]
    )
    if any(
        properties.get(key) != value for key, value in expected["properties"].items()
    ):
        raise GraphDatabaseError(
            "Foreign or legacy Entity preserved.", "GRAPH_ERASURE_BLOCKED"
        )
    return str(expected["key"])


async def _selected(
    node_id: str, node_label: str, context: DeletionContext, adapter: Any
) -> Optional[tuple[str, GraphScope]]:
    if node_label != "Entity":
        return None
    rule = (context.orphan_rules or {}).get("Entity")
    if rule and (rule.never_delete or rule.explicit_only):
        return None
    if (
        context.scope is None
        or context.scope.tenant_known is not True
        or not isinstance(context.scope.memory_space_id, str)
    ):
        raise GraphDatabaseError(
            "Derived cleanup needs exact known tenant and space.",
            "GRAPH_IDENTITY_REQUIRED",
        )
    reader, dialect = getattr(adapter, "managed_read", None), getattr(adapter, "managed_dialect", None)
    if not callable(reader) or not callable(dialect):
        raise GraphDatabaseError("Verified managed reads and engine dialect required.", "GRAPH_SCHEMA_MIGRATION_REQUIRED")
    engine = await dialect()
    if engine not in ("neo4j", "memgraph"):
        raise GraphDatabaseError("Unverified managed engine dialect.", "GRAPH_SCHEMA_MIGRATION_REQUIRED")
    native_id: Any
    if engine == "neo4j":
        if not isinstance(node_id, str) or not node_id:
            raise GraphDatabaseError("Exact native node ID required.", "GRAPH_IDENTITY_REQUIRED")
        native_id = node_id
    else:
        if not isinstance(node_id, str) or not node_id.isascii() or not node_id.isdecimal():
            raise GraphDatabaseError("Exact native node ID required.", "GRAPH_IDENTITY_REQUIRED")
        native_id = int(node_id)
    id_function = "elementId" if engine == "neo4j" else "id"
    response = await reader(
        f"MATCH (n:CortexV2Entity) WHERE {id_function}(n)=$id RETURN properties(n) AS node LIMIT 2",
        {"id": native_id},
    )
    if response.count > 1 or len(response.records) > 1:
        raise GraphDatabaseError("Ambiguous derived graph node preserved.", "GRAPH_IDENTITY_MISMATCH")
    return (
        (_entity(_record(response.records[0].get("node")), context.scope), context.scope)
        if response.records else None
    )



async def _island(tx: Any, start: str, scope: GraphScope, lock: bool) -> Dict[str, Any]:
    queue = [(start, 0)]
    seen: Set[str] = set()
    edges: Set[str] = set()
    anchors: Set[str] = set()
    circular = False
    while queue:
        key, depth = queue.pop(0)
        if key in seen:
            circular = True
            continue
        if len(seen) >= 64 or depth > 10:
            raise GraphDatabaseError(
                "No truncated derived cleanup allowed.", "GRAPH_QUERY_BUDGET"
            )
        found = await tx.query(
            "MATCH (n:CortexV2Entity {key:$key}) "
            + ("SET n.key=n.key " if lock else "")
            + "RETURN properties(n) AS node",
            {"key": key},
        )
        if found.count == 0:
            if key == start:
                return {"keys": [], "edges": [], "anchors": [], "circular": False}
            raise GraphDatabaseError("Derived island changed.", "GRAPH_ERASURE_BLOCKED")
        if (
            found.count != 1
            or _entity(_record(found.records[0].get("node")), scope) != key
        ):
            raise GraphDatabaseError(
                "Derived identity ambiguous.", "GRAPH_ERASURE_BLOCKED"
            )
        seen.add(key)
        links = await tx.query(
            "MATCH (n:CortexV2Entity {key:$key})-[r]-(other) RETURN properties(r) AS edge,properties(startNode(r)) AS source,properties(endNode(r)) AS target,properties(other) AS other,type(r) AS type LIMIT 65",
            {"key": key},
        )
        if links.count > 64:
            raise GraphDatabaseError(
                "Derived incident degree exceeds guard.", "GRAPH_QUERY_BUDGET"
            )
        for row in links.records:
            edge, source, target, other = [
                _record(row.get(name)) for name in ("edge", "source", "target", "other")
            ]
            if (
                edge.get("schemaVersion") != 2
                or any(
                    not isinstance(edge.get(name), str)
                    for name in ("edgeKey", "ownerKey", "ownerTuple")
                )
                or edge.get("sourceKey") != source.get("key")
                or edge.get("sourceTuple") != source.get("tupleJson")
                or edge.get("targetKey") != target.get("key")
                or edge.get("targetTuple") != target.get("tupleJson")
            ):
                raise GraphDatabaseError(
                    "Manual, foreign or legacy edge preserved.", "GRAPH_ERASURE_BLOCKED"
                )
            edges.add(edge["edgeKey"])
            if len(edges) > 128:
                raise GraphDatabaseError(
                    "Derived edge budget exceeded.", "GRAPH_QUERY_BUDGET"
                )
            if other.get("kind") != "Entity":
                anchors.add(str(other.get("key")))
                continue
            other_key = _entity(other, scope)
            if row.get("type") != "ENTITY_RELATION":
                raise GraphDatabaseError(
                    "Unsupported derived relationship preserved.",
                    "GRAPH_ERASURE_BLOCKED",
                )
            owner = await tx.query(
                "MATCH (s:CortexV2SourceState {key:$key}) RETURN properties(s) AS state",
                {"key": edge["ownerKey"]},
            )
            if (
                owner.count != 1
                or _record(owner.records[0].get("state")).get("tupleJson")
                != edge["ownerTuple"]
            ):
                raise GraphDatabaseError(
                    "Relationship owner unresolved.", "GRAPH_ERASURE_BLOCKED"
                )
            if _record(owner.records[0].get("state")).get("tombstoned") is not True:
                anchors.add(edge["ownerKey"])
            if other_key in seen:
                circular = True
            else:
                queue.append((other_key, depth + 1))
    return {
        "keys": sorted(seen),
        "edges": sorted(edges),
        "anchors": sorted(anchors),
        "circular": circular,
    }


async def detect_orphan(
    node_id: str, node_label: str, context: DeletionContext, adapter: Any
) -> OrphanCheckResult:
    target = await _selected(node_id, node_label, context, adapter)
    if target is None:
        return OrphanCheckResult(
            False,
            "Primary, protected or absent node; captured primary erasure separate",
            [],
            False,
        )
    if not callable(getattr(adapter, "managed_read", None)):
        raise GraphDatabaseError(
            "Managed bounded reads required.", "GRAPH_SCHEMA_MIGRATION_REQUIRED"
        )

    class ReadOnly:
        async def query(self, text: str, args: Any = None) -> Any:
            return await adapter.managed_read(text, args)

    found = await _island(ReadOnly(), *target, False)
    return OrphanCheckResult(
        bool(found["keys"]) and not found["anchors"],
        "Preserved live references" if found["anchors"] else "Proven derived island",
        found["anchors"],
        found["circular"],
        found["keys"],
    )


async def delete_with_orphan_cleanup(
    node_id: str, node_label: str, context: DeletionContext, adapter: Any
) -> DeleteResult:
    target = await _selected(node_id, node_label, context, adapter)
    if target is None:
        raise GraphDatabaseError(
            "Primary, protected or unknown node requires captured job.",
            "GRAPH_ERASURE_BLOCKED",
        )
    if not callable(getattr(adapter, "managed_transaction", None)):
        raise GraphDatabaseError(
            "Managed transaction required.", "GRAPH_SCHEMA_MIGRATION_REQUIRED"
        )
    key, scope = target

    async def remove(tx: Any) -> DeleteResult:
        found = await _island(tx, key, scope, True)
        if found["anchors"]:
            raise GraphDatabaseError(
                "Live references preserve island.", "GRAPH_ERASURE_BLOCKED"
            )
        if found["keys"]:
            await tx.query(
                "MATCH (n:CortexV2Entity) WHERE n.key IN $keys AND n.schemaVersion=2 AND n.tenantTag=$tenantTag AND n.tenantValue=$tenantValue AND n.spaceTag='space' AND n.spaceValue=$space DETACH DELETE n",
                {
                    "keys": found["keys"],
                    "tenantTag": "knownTenantless"
                    if scope.tenant_id is None
                    else "tenant",
                    "tenantValue": scope.tenant_id or "",
                    "space": scope.memory_space_id,
                },
            )
        return DeleteResult(
            found["keys"],
            found["edges"],
            [{"nodes": found["keys"], "reason": "Proven scoped derived island"}]
            if found["circular"]
            else [],
        )

    result: DeleteResult = await adapter.managed_transaction(remove)
    context.deleted_node_ids.update(result.deleted_nodes)
    return result


def create_deletion_context(
    reason: str,
    orphan_rules: Optional[Dict[str, OrphanRule]] = None,
    scope: Optional[GraphScope] = None,
) -> DeletionContext:
    return DeletionContext(
        reason=reason,
        timestamp=int(time.time() * 1000),
        orphan_rules=orphan_rules,
        scope=scope,
    )


async def can_run_orphan_cleanup(adapter: Any) -> bool:
    try:
        return callable(getattr(adapter, "managed_transaction", None)) and bool(
            await adapter.is_connected()
        )
    except Exception:
        return False
