"""Managed physical identity and verified native canonical graph evidence.

Number-bearing fingerprints use the original native Convex/JSON.stringify bytes.
Python never substitutes json.dumps float spelling for a native fingerprint.
"""

import hashlib
import json
import math
import re
from dataclasses import fields, is_dataclass
from typing import Any, Dict, List, Optional, Union

from convex.values import ConvexInt64, json_to_convex

from ..types import (
    GraphDerivedNode,
    GraphIdentity,
    GraphJob,
    GraphProjection,
    GraphReference,
    GraphScope,
)
from .errors import GraphDatabaseError

GRAPH_TABLES = {
    "memories": "Memory",
    "facts": "Fact",
    "contexts": "Context",
    "conversations": "Conversation",
    "memorySpaces": "MemorySpace",
    "immutable": "Immutable",
    "mutable": "Mutable",
    "artifacts": "Artifact",
}
MANAGED_KINDS = (
    *GRAPH_TABLES.values(),
    "User",
    "Agent",
    "Participant",
    "Entity",
    "SourceState",
)
MANAGED_LABELS = {kind: f"CortexV2{kind}" for kind in MANAGED_KINDS}
MANAGED_RELATIONSHIPS = (
    "IN_SPACE",
    "CHILD_OF",
    "TRIGGERED_BY",
    "GRANTS_ACCESS_TO",
    "REFERENCES",
    "SOURCED_FROM",
    "PART_OF",
    "EXTRACTED_FROM",
    "SUPERSEDES",
    "SUPERSEDED_BY",
    "INVOLVES",
    "RELATES_TO",
    "HAS_PARTICIPANT",
    "STORED_BY",
    "EXTRACTED_BY",
    "MENTIONS",
    "ENTITY_RELATION",
    "ARTIFACT_MEMORY",
    "ARTIFACT_CONVERSATION",
)


def safe_integer(value: Any) -> bool:
    if type(value) is int:
        return abs(value) <= 9007199254740991
    return (
        type(value) is float
        and math.isfinite(value)
        and value.is_integer()
        and abs(value) <= 9007199254740991
    )


def graph_wire(value: Any) -> Any:
    """Map the additive Python dataclasses to the fixed native camelCase wire shape."""
    if is_dataclass(value) and not isinstance(value, type):
        output = {}
        for item in fields(value):
            member = getattr(value, item.name)
            if member is None and item.name in (
                "entity_type",
                "derived_relations",
                "priority",
                "source_digest", "suppressed_jobs",
            ):
                continue
            key = re.sub(r"_([a-z])", lambda m: m[1].upper(), item.name)
            if isinstance(value, GraphJob) and item.name == "id":
                key = "_id"
            output[key] = graph_wire(member)
        return output
    if isinstance(value, list):
        return [graph_wire(item) for item in value]
    if isinstance(value, dict):
        return {key: graph_wire(item) for key, item in value.items()}
    return value


def _string_json(value: Any) -> str:
    # This deliberately narrow serializer is used only for string identity/edge tuples.
    if isinstance(value, list):
        return "[" + ",".join(_string_json(item) for item in value) + "]"
    if not isinstance(value, str):
        raise GraphDatabaseError(
            "Identity tuples require strings.", "GRAPH_IDENTITY_REQUIRED"
        )
    quoted = json.dumps(value, ensure_ascii=False)
    return re.sub(r"[\ud800-\udfff]", lambda m: f"\\u{ord(m[0]):04x}", quoted)


def string_tuple_digest(value: List[Any]) -> str:
    return hashlib.sha256(_string_json(value).encode("utf-8")).hexdigest()


def primary_graph_identity(
    kind: Any, physical_source_id: str, scope: GraphScope
) -> GraphIdentity:
    if (
        kind not in GRAPH_TABLES.values()
        or not isinstance(physical_source_id, str)
        or not physical_source_id
        or scope.tenant_known is not True
        or not (scope.tenant_id is None or isinstance(scope.tenant_id, str))
        or not (scope.memory_space_id is None or isinstance(scope.memory_space_id, str))
    ):
        raise GraphDatabaseError(
            "Managed graph needs captured physical identity and exact known scope.",
            "GRAPH_IDENTITY_REQUIRED",
        )
    if (kind not in ("Immutable", "Mutable")) != (scope.memory_space_id is not None):
        raise GraphDatabaseError(
            "Graph source space applicability does not match its kind.",
            "GRAPH_SCOPE_MISMATCH",
        )
    parts = [
        "cortex.graph.v2",
        ["knownTenantless"] if scope.tenant_id is None else ["tenant", scope.tenant_id],
        kind,
        ["spaceNotApplicable"]
        if scope.memory_space_id is None
        else ["space", scope.memory_space_id],
        physical_source_id,
    ]
    return GraphIdentity(
        scope.tenant_known,
        scope.tenant_id,
        scope.memory_space_id,
        2,
        kind,
        physical_source_id,
        string_tuple_digest(parts),
        _string_json(parts),
    )


def identity_properties(identity: GraphIdentity) -> Dict[str, Any]:
    expected = primary_graph_identity(
        identity.kind, identity.physical_source_id, identity
    )
    if (
        expected.key != identity.key
        or expected.tuple_json != identity.tuple_json
        or identity.schema_version != 2
    ):
        raise GraphDatabaseError(
            "Graph key and exact tuple disagree.", "GRAPH_IDENTITY_MISMATCH"
        )
    return {
        "key": identity.key,
        "schemaVersion": 2,
        "tupleJson": identity.tuple_json,
        "kind": identity.kind,
        "physicalSourceId": identity.physical_source_id,
        "tenantTag": "knownTenantless" if identity.tenant_id is None else "tenant",
        "tenantValue": identity.tenant_id if identity.tenant_id is not None else "",
        "spaceTag": "spaceNotApplicable"
        if identity.memory_space_id is None
        else "space",
        "spaceValue": identity.memory_space_id
        if identity.memory_space_id is not None
        else "",
    }


def assert_identity_properties(actual: Dict[str, Any], identity: GraphIdentity) -> None:
    for key, value in identity_properties(identity).items():
        if not equivalent(actual.get(key), value):
            raise GraphDatabaseError(
                "Managed graph key/tuple mismatch; legacy nodes cannot be adopted.",
                "GRAPH_IDENTITY_MISMATCH",
            )


def derived_graph_identity(
    kind: str, logical_id: str, scope: GraphScope, entity_type: Optional[str] = None
) -> Dict[str, Any]:
    if (
        kind not in ("User", "Agent", "Participant", "Entity")
        or scope.tenant_known is not True
        or not (scope.tenant_id is None or isinstance(scope.tenant_id, str))
        or not isinstance(logical_id, str)
        or not logical_id
        or kind == "Entity"
        and (
            not isinstance(scope.memory_space_id, str)
            or not isinstance(entity_type, str)
        )
    ):
        raise GraphDatabaseError(
            "Derived graph identity requires exact scope.", "GRAPH_IDENTITY_REQUIRED"
        )
    name = (
        logical_id.strip(
            "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
        ).lower()
        if kind == "Entity"
        else logical_id
    )
    if not name:
        raise GraphDatabaseError(
            "Derived graph identity cannot be empty.", "GRAPH_IDENTITY_REQUIRED"
        )
    parts = [
        "cortex.graph.v2.derived",
        ["knownTenantless"] if scope.tenant_id is None else ["tenant", scope.tenant_id],
        kind,
        ["space", scope.memory_space_id, name, entity_type]
        if kind == "Entity"
        else ["logical", name],
    ]
    key, tuple_json = string_tuple_digest(parts), _string_json(parts)
    properties = {
        "key": key,
        "tupleJson": tuple_json,
        "schemaVersion": 2,
        "kind": kind,
        "logicalId": name,
        "tenantTag": "knownTenantless" if scope.tenant_id is None else "tenant",
        "tenantValue": scope.tenant_id or "",
        "spaceTag": "space" if kind == "Entity" else "spaceNotApplicable",
        "spaceValue": scope.memory_space_id if kind == "Entity" else "",
    }
    if kind == "Entity":
        properties.update(name=name, type=entity_type)
    return {"key": key, "tupleJson": tuple_json, "properties": properties}


def equivalent(left: Any, right: Any) -> bool:
    """Compare official decoded values without losing NaN, -0, bytes or Int64 type."""
    if isinstance(left, dict) and isinstance(right, dict):
        return left.keys() == right.keys() and all(
            equivalent(left[k], right[k]) for k in left
        )
    if isinstance(left, list) and isinstance(right, list):
        return len(left) == len(right) and all(
            equivalent(a, b) for a, b in zip(left, right)
        )
    if isinstance(left, ConvexInt64) or isinstance(right, ConvexInt64):
        return type(left) is type(right) and left == right
    if type(left) in (int, float) and type(right) in (int, float):
        if math.isnan(left) or math.isnan(right):
            return math.isnan(left) and math.isnan(right)
        if left == right == 0:
            return math.copysign(1, left) == math.copysign(1, right)
        return bool(left == right)
    return type(left) is type(right) and bool(left == right)


def _pairs(pairs: List[Any]) -> Dict[str, Any]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate native JSON field")
        result[key] = value
    return result


def decode_native_json(text: str) -> Any:
    return json_to_convex(
        json.loads(
            text,
            object_pairs_hook=_pairs,
            parse_int=float,
            parse_constant=lambda _: (_ for _ in ()).throw(
                ValueError("Invalid JSON number")
            ),
        )
    )


def _subtree_span(text: str, path: List[Union[str, int]]) -> tuple[int, int]:
    """Retain a subtree's exact native bytes, including original number spellings."""
    decoder = json.JSONDecoder()
    start, end = 0, len(text)
    for part in path:
        pos = start + 1
        if isinstance(part, str) and text[start] == "{":
            while pos < end:
                key, key_end = decoder.raw_decode(text, pos)
                if text[key_end] != ":":
                    raise ValueError("Noncanonical native JSON")
                value_start = key_end + 1
                _, value_end = decoder.raw_decode(text, value_start)
                if key == part:
                    start, end = value_start, value_end
                    break
                pos = value_end + 1
            else:
                raise ValueError("Missing native JSON field")
        elif (
            isinstance(part, int)
            and not isinstance(part, bool)
            and text[start] == "["
            and part >= 0
        ):
            for index in range(part + 1):
                _, value_end = decoder.raw_decode(text, pos)
                if index == part:
                    start, end = pos, value_end
                pos = value_end + 1
        else:
            raise ValueError("Invalid native JSON path")
    return start, end


def canonical_subtree(text: str, path: List[Union[str, int]]) -> str:
    start, end = _subtree_span(text, path)
    return text[start:end]


def graph_source_digest(job: GraphJob) -> str:
    """Remove only reference content revisions from verified original canonical bytes."""
    start, end = _subtree_span(job.projection_json, ["references"])
    references = []
    decoder = json.JSONDecoder()
    for index in range(len(job.projection.references)):
        text = canonical_subtree(job.projection_json, ["references", index])
        parts = []
        pos = 1
        while pos < len(text) - 1:
            key, key_end = decoder.raw_decode(text, pos)
            _, value_end = decoder.raw_decode(text, key_end + 1)
            if key != "sourceRevision":
                parts.append(text[pos:value_end])
            pos = value_end + 1
        references.append("{" + ",".join(parts) + "}")
    source = (
        job.projection_json[:start]
        + "["
        + ",".join(references)
        + "]"
        + job.projection_json[end:]
    )
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def _identity(value: Dict[str, Any]) -> GraphIdentity:
    return GraphIdentity(
        value["tenantKnown"],
        value["tenantId"],
        value["memorySpaceId"],
        value["schemaVersion"],
        value["kind"],
        value["physicalSourceId"],
        value["key"],
        value["tupleJson"],
    )


def graph_job_from_wire(value: Dict[str, Any]) -> GraphJob:
    try:
        projection = value["projection"]
        refs = [
            GraphReference(
                r["role"],
                r["slot"],
                r["relationship"],
                _identity(r["identity"]),
                r["sourceRevision"],
                r["ownershipRevision"],
                r["referenceGeneration"],
            )
            for r in projection["references"]
        ]
        derived = [
            GraphDerivedNode(
                r["kind"],
                r["logicalId"],
                r["relationship"],
                r["properties"],
                r.get("entityType"),
            )
            for r in projection["derived"]
        ]
        job = GraphJob(
            value["_id"],
            value["schemaVersion"],
            value["table"],
            _identity(value["identity"]),
            value["sourceRevision"],
            value["operation"],
            value["graphInvocationId"],
            value["requestDigest"],
            value["generation"],
            value["attemptToken"],
            value["referenceGeneration"],
            value["ownershipRevision"],
            value["state"],
            value["failedAttempts"],
            GraphProjection(
                _identity(projection["identity"]),
                projection["sourceRevision"],
                projection["properties"],
                refs,
                derived,
                projection.get("derivedRelations"),
            ),
            value["createdAt"],
            value["projectionJson"],
            value["projectionDigest"],
            value["requestJson"],
            value.get("sourceDigest"),
            value.get("suppressedJobs"),
            value.get("priority"),
        )
        return validate_graph_job(job)
    except (KeyError, TypeError, ValueError, AttributeError):
        raise GraphDatabaseError(
            "Native graph job evidence is missing or malformed.", "GRAPH_JOB_UNRESOLVED"
        ) from None


def validate_graph_job(job: GraphJob) -> GraphJob:
    identity_properties(job.identity)
    if (
        job.schema_version != 2
        or GRAPH_TABLES.get(job.table) != job.identity.kind
        or not job.id
        or not job.generation
        or not job.attempt_token
        or not safe_integer(job.source_revision)
        or job.source_revision < 1
        or job.operation not in ("insert", "update", "delete")
        or job.projection.source_revision != job.source_revision
        or job.projection.identity.key != job.identity.key
        or job.projection.identity.tuple_json != job.identity.tuple_json
        or not job.reference_generation
        or not safe_integer(job.ownership_revision)
        or job.ownership_revision < 1
    ):
        raise GraphDatabaseError(
            "Immutable graph job has contradictory captured evidence.",
            "GRAPH_JOB_UNRESOLVED",
        )
    try:
        encoded = job.projection_json.encode("utf-8")
        request = {
            "request": {
                "graphInvocationId": job.graph_invocation_id,
                "priority": job.priority or "normal",
            },
            "table": job.table,
            "operation": job.operation,
            "projection": graph_wire(job.projection),
        }
        if job.suppressed_jobs is not None:
            request["suppressedJobs"] = job.suppressed_jobs
        if job.source_digest is not None:
            request["sourceDigest"] = job.source_digest
            if job.source_digest != graph_source_digest(job):
                raise ValueError("Contradictory source fingerprint")
        if (
            hashlib.sha256(encoded).hexdigest() != job.projection_digest
            or hashlib.sha256(job.request_json.encode("utf-8")).hexdigest()
            != job.request_digest
            or not equivalent(
                decode_native_json(job.projection_json), graph_wire(job.projection)
            )
            or not equivalent(decode_native_json(job.request_json), request)
        ):
            raise ValueError("Contradictory canonical evidence")
    except (TypeError, ValueError, UnicodeError):
        raise GraphDatabaseError(
            "Graph job canonical evidence is contradictory.", "GRAPH_JOB_UNRESOLVED"
        ) from None
    if len(encoded) > 256 * 1024:
        raise GraphDatabaseError(
            "Graph projection exceeds inline native limit.", "GRAPH_PROJECTION_BUDGET"
        )
    return job
