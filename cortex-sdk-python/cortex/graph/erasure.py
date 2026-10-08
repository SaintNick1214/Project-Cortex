"""Fixed managed job delivery. Exact-source erasure and managed job delivery."""

import hashlib
import re
from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Dict, Literal, TypeVar, cast
from uuid import uuid4

from ..types import (
    GraphApplyResult,
    GraphIdentity,
    GraphJob,
    GraphJobReceipt,
    GraphScope,
    ManagedGraphAdapter,
    ManagedGraphTransaction,
    QueryStatistics,
)
from .errors import (
    GraphCommittedPartial,
    GraphDatabaseError,
    GraphJobUnresolved,
    GraphPrimaryOutcomeUnknown,
)
from .identity import (
    MANAGED_LABELS,
    MANAGED_RELATIONSHIPS,
    assert_identity_properties,
    canonical_subtree,
    decode_native_json,
    derived_graph_identity,
    equivalent,
    graph_job_from_wire,
    graph_source_digest,
    identity_properties,
    safe_integer,
    string_tuple_digest,
    validate_graph_job,
)
from .schema.init_schema import assert_managed_graph_compatibility

T = TypeVar("T")


def requested_graph(adapter: Any, explicit: bool | None = None) -> bool:
    if explicit is not None and type(explicit) is not bool:
        raise GraphDatabaseError("sync_to_graph must be boolean.", "GRAPH_POLICY_INVALID")
    if explicit is True and adapter is None:
        raise GraphDatabaseError("Graph synchronization requires an adapter.", "GRAPH_ADAPTER_REQUIRED")
    return explicit is not False and adapter is not None


def graph_option(options: Any) -> bool | None:
    if isinstance(options, dict):
        return options.get("sync_to_graph", options.get("syncToGraph"))
    return getattr(options, "sync_to_graph", None)


def graph_receipt_from_wire(value: Any) -> GraphJobReceipt:
    if isinstance(value, GraphJobReceipt):
        receipt = value
    else:
        try:
            identity = value["identity"]
            receipt = GraphJobReceipt(value["id"], value["generation"], GraphIdentity(
                identity["tenantKnown"], identity["tenantId"], identity["memorySpaceId"],
                identity["schemaVersion"], identity["kind"], identity["physicalSourceId"],
                identity["key"], identity["tupleJson"]), value["sourceRevision"])
        except (KeyError, TypeError) as error:
            raise GraphJobUnresolved() from error
    identity_properties(receipt.identity)
    if not receipt.id or not receipt.generation or not safe_integer(receipt.source_revision) or receipt.source_revision < 1:
        raise GraphJobUnresolved(receipt)
    return receipt


def _backend_data(error: BaseException) -> Any:
    from convex import ConvexError, ConvexExecutionError

    while error is not None:
        if isinstance(error, (ConvexError, ConvexExecutionError)):
            return getattr(error, "data", None) if getattr(error, "data", None) is not None else "GRAPH_NATIVE_REFUSAL"
        error = error.__cause__  # type: ignore[assignment]
    return None


async def write_with_graph(client: Any, adapter: Any, policy: Any, scope: GraphScope,
                           domain: str, intent: Any, operation: Any, explicit: bool | None = None,
                           known_physical_source_ids: list[str] | None = None) -> Any:
    if not requested_graph(adapter, explicit):
        return graph_off_result(await operation(None))
    mode = getattr(policy, "mode", "inline") if not isinstance(policy, dict) else policy.get("mode", "inline")
    if mode not in ("inline", "background"):
        raise GraphDatabaseError("Invalid graph synchronization policy.", "GRAPH_POLICY_INVALID")
    await assert_managed_graph_compatibility(adapter)
    invocation_id = str(uuid4())
    try:
        response = await operation({"graphInvocationId": invocation_id})
    except Exception as error:
        if _backend_data(error) is not None:
            raise
        raise GraphPrimaryOutcomeUnknown(domain, scope, invocation_id, deepcopy(intent), known_physical_source_ids) from error
    if not isinstance(response, dict) or response.get("graphVersion") != 2 or "primaryResult" not in response or not isinstance(response.get("graphJobs"), list):
        raise GraphJobUnresolved()
    result = response["primaryResult"]
    try:
        jobs = [graph_receipt_from_wire(value) for value in response["graphJobs"]]
    except GraphDatabaseError as error:
        raise GraphCommittedPartial(result, response["graphJobs"], "failed", error.code or "GRAPH_JOB_UNRESOLVED") from error
    if mode != "background":
        try:
            for job in jobs:
                await deliver_graph_job(client, adapter, job)
        except Exception as error:
            code = getattr(error, "code", None) or "GRAPH_ACK_UNKNOWN"
            raise GraphCommittedPartial(result, jobs, "unknown" if code == "GRAPH_TRANSACTION_OUTCOME_UNKNOWN" else "failed", code) from error
    if isinstance(result, dict):
        return {**result, "graphJobs": jobs, "graphDisposition": "queued" if mode == "background" else "delivered"}
    return result


async def write_graph_mutation(client: Any, adapter: Any, policy: Any, name: str,
                               args: Dict[str, Any], explicit: bool | None = None) -> Any:
    if not requested_graph(adapter, explicit):
        return graph_off_result(await client.mutation(name, args))
    original = deepcopy(args)
    scope = GraphScope(True, args.get("tenantId"), args.get("memorySpaceId"))
    fact = name.startswith("facts:")
    if fact and name == "facts:store" and not original.get("historyIntent"):
        original["historyIntent"] = {"operationId": str(uuid4()), "phase": "store"}
    history = original.get("historyIntent", {})
    operation_id = history.get("operationId", original.get("operationId"))
    phase = history.get("phase") or {"update": "update", "deleteFact": "delete", "deleteMany": "physical_delete", "consolidate": "consolidate", "supersede": "supersede"}.get(name.split(":")[-1])

    async def send(queue_graph: Any) -> Any:
        return await client.mutation(name, {**original, **({"queueGraph": queue_graph} if queue_graph is not None else {})})

    try:
        return await write_with_graph(client, adapter, policy, scope, name, original, send, explicit,
                                      [original["expectedPhysicalId"]] if isinstance(original.get("expectedPhysicalId"), str) else [])
    except Exception as error:
        data = _backend_data(error)
        if isinstance(data, dict) and isinstance(data.get("code"), str) and re.match(r"^(GRAPH_|REFERENCE_)", data["code"]):
            raise GraphDatabaseError("Native graph capture refused atomically.", data["code"]) from error
        if not fact or isinstance(error, GraphCommittedPartial) or not (isinstance(error, GraphPrimaryOutcomeUnknown) or data == "FACT_HISTORY_COMMITTED_RESULT_UNAVAILABLE"):
            raise
        from .._utils import filter_none_values
        from ..facts.history import (
            FactCommitOutcomeUnknownError,
            FactCommittedReceiptUnresolvedError,
            FactCommittedResultUnavailableError,
            HistoryReceipt,
        )

        fact_scope = filter_none_values({"memorySpaceId": original.get("memorySpaceId"), "tenantId": scope.tenant_id})
        if not operation_id or not phase or not isinstance(original.get("memorySpaceId"), str):
            raise FactCommitOutcomeUnknownError(operation_id or "unavailable", phase or name, fact_scope, error) from error
        try:
            receipt = await client.query("factHistory:getOperationReceipt", {**fact_scope, "operationId": operation_id, "phase": phase})
        except Exception as receipt_error:
            raise FactCommittedReceiptUnresolvedError(operation_id, phase, fact_scope, "unavailable", error, receipt_error) from error
        if not receipt:
            raise FactCommitOutcomeUnknownError(operation_id, phase, fact_scope, error) from error
        # Native canonical bytes, not a guessed cross-language numeric encoder,
        # bind this exact original request before any retained job is delivered.
        events = receipt.get("events", [])
        try:
            for event in events:
                payload = event["pending"]["payload"]
                canonical = event["requestJson"]
                if not equivalent(decode_native_json(canonical), original) or hashlib.sha256(canonical.encode("utf-8")).hexdigest() != payload["requestDigest"]:
                    raise ValueError("contradictory original request")
            if not events:
                raise ValueError("missing original request")
        except (KeyError, TypeError, ValueError) as contradiction:
            raise FactCommittedReceiptUnresolvedError(operation_id, phase, fact_scope, "missing", error, contradiction) from error
        jobs = [graph_receipt_from_wire(value) for value in receipt.get("graphJobs", [])]
        if not jobs:
            raise GraphJobUnresolved()
        mode = getattr(policy, "mode", "inline") if not isinstance(policy, dict) else policy.get("mode", "inline")
        if mode != "background":
            try:
                for job in jobs:
                    await deliver_graph_job(client, adapter, job)
            except Exception as cause:
                raise GraphCommittedPartial({"historyReceipt": receipt, "primaryResultUnavailable": True}, jobs, "failed", getattr(cause, "code", None) or "GRAPH_ACK_UNKNOWN") from cause
        raise FactCommittedResultUnavailableError(HistoryReceipt.from_wire(receipt)) from error


async def mutate_graph_selected(client: Any, domain: str, selected: list[dict[str, Any]],
                                args: Dict[str, Any], options: Any, adapter: Any, policy: Any = None,
                                *, explicit: bool | None = None) -> Dict[str, Any]:
    from .._domain_paging import (
        DomainOperationPartialError,
        active,
        definite_failure,
        mutate,
        partial,
        receipt_matches,
        wait_operation,
    )
    from .._utils import filter_none_values

    explicit = graph_option(options) if explicit is None else explicit
    if not requested_graph(adapter, explicit):
        return cast(Dict[str, Any], await mutate(client, domain, selected, args, options))
    outcomes = [{"physicalId": row["physicalId"], "disposition": "unstarted"} for row in selected]
    intents = [row.get("deleteIntent") for row in selected] if domain == "facts" else None
    for index, row in enumerate(selected):
        sent = False
        try:
            active(options)
            request = row.get("deleteIntent", {}).get("request") if domain == "facts" else {**args, "physicalId": row["physicalId"], "expectedFingerprint": row["fingerprint"]}
            if not request:
                raise ValueError("DOMAIN_INVALID_DELETE_INTENT")
            sent = True
            result = await wait_operation(write_graph_mutation(client, adapter, policy, "facts:deleteMany" if domain == "facts" else f"{domain}:eraseSelected", filter_none_values(request), explicit), options)
            outcomes[index]["disposition"] = "knownCommitted" if result["deleted"] else "alreadyAbsent"
            if result.get("graphIdentity"):
                outcomes[index]["graphIdentity"] = result["graphIdentity"]
        except BaseException as cause:
            if isinstance(cause, GraphCommittedPartial):
                result = cause.primary_result
                outcomes[index]["disposition"] = "knownCommitted" if result.get("deleted") else "alreadyAbsent"
                outcomes[index]["graphJobs"] = cause.jobs
                if result.get("graphIdentity"):
                    outcomes[index]["graphIdentity"] = result["graphIdentity"]
            elif sent:
                outcomes[index]["disposition"] = "knownRolledBack" if definite_failure(cause) else "outcomeUnknown"
                if domain == "facts" and not definite_failure(cause):
                    item = row["deleteIntent"]
                    try:
                        receipt = await wait_operation(client.query("factHistory:getOperationReceipt", filter_none_values({"memorySpaceId": args["memorySpaceId"], "tenantId": args.get("tenantId"), "operationId": item["operationId"], "phase": "physical_delete"})), options)
                        if receipt and receipt_matches(receipt, item):
                            outcomes[index]["disposition"] = "knownCommitted"
                    except BaseException:
                        pass  # The retained original response remains unresolved.
            raise DomainOperationPartialError(domain, partial(outcomes, intents), cause) from cause
    return cast(Dict[str, Any], partial(outcomes, intents))


def graph_off_result(value: T) -> T:
    """Never discard captured jobs from an unexpected graph-off envelope."""
    if isinstance(value, dict) and "graphVersion" in value:
        raise GraphDatabaseError(
            "Unexpected graph capture in a graph-off operation; retain jobs for reconciliation.",
            "GRAPH_POLICY_MISMATCH",
        )
    return value


def _map(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _rel(name: str) -> str:
    if name not in MANAGED_RELATIONSHIPS:
        raise GraphDatabaseError(
            "Unsupported managed relationship.", "GRAPH_RELATIONSHIP_UNSUPPORTED"
        )
    return name


def _add(result: GraphApplyResult, stats: QueryStatistics | None) -> None:
    if stats:
        result.nodes_created += stats.nodes_created
        result.nodes_deleted += stats.nodes_deleted
        result.relationships_created += stats.relationships_created
        result.relationships_deleted += stats.relationships_deleted


async def _gate(tx: ManagedGraphTransaction, identity: GraphIdentity) -> Dict[str, Any]:
    properties = identity_properties(identity)
    ensured = await tx.query(
        "MERGE (s:CortexV2SourceState {key:$key}) ON CREATE SET s += $properties, s.sourceRevision=-1, s.tombstoned=false, s.gateEpoch=0 RETURN properties(s) AS state",
        {"key": identity.key, "properties": properties},
    )
    if ensured.count != 1:
        raise GraphDatabaseError("SourceState is ambiguous.", "GRAPH_IDENTITY_MISMATCH")
    assert_identity_properties(_map(ensured.records[0].get("state")), identity)
    locked = await tx.query(
        "MATCH (s:CortexV2SourceState {key:$key}) SET s.gateEpoch=s.gateEpoch+1 RETURN properties(s) AS state",
        {"key": identity.key},
    )
    if locked.count != 1:
        raise GraphDatabaseError("SourceState disappeared.", "GRAPH_IDENTITY_MISMATCH")
    state = _map(locked.records[0].get("state"))
    assert_identity_properties(state, identity)
    if (
        not safe_integer(state.get("sourceRevision"))
        or type(state.get("tombstoned")) is not bool
    ):
        raise GraphDatabaseError(
            "SourceState revision is invalid.", "GRAPH_IDENTITY_MISMATCH"
        )
    return state


async def _incidents(tx: ManagedGraphTransaction, identity: GraphIdentity) -> None:
    response = await tx.query(
        f"MATCH (n:{MANAGED_LABELS[identity.kind]} {{key:$key}})-[r]-(other) RETURN type(r) AS type,properties(r) AS edge,labels(other) AS labels,properties(other) AS endpoint LIMIT 65",
        {"key": identity.key},
    )
    if response.count > 64:
        raise GraphDatabaseError(
            "Managed relationship degree exceeds fixed transaction budget.",
            "GRAPH_RELATIONSHIP_BUDGET",
        )
    properties = identity_properties(identity)
    for row in response.records:
        edge, endpoint, labels = (
            _map(row.get("edge")),
            _map(row.get("endpoint")),
            row.get("labels", []),
        )
        outgoing = (
            edge.get("sourceKey") == identity.key
            and edge.get("sourceTuple") == identity.tuple_json
            and edge.get("targetKey") == endpoint.get("key")
            and edge.get("targetTuple") == endpoint.get("tupleJson")
        )
        incoming = (
            edge.get("targetKey") == identity.key
            and edge.get("targetTuple") == identity.tuple_json
            and edge.get("sourceKey") == endpoint.get("key")
            and edge.get("sourceTuple") == endpoint.get("tupleJson")
        )
        if (
            row.get("type") not in MANAGED_RELATIONSHIPS
            or edge.get("schemaVersion") != 2
            or endpoint.get("schemaVersion") != 2
            or not isinstance(labels, list)
            or not any(label in MANAGED_LABELS.values() for label in labels)
            or endpoint.get("tenantTag") != properties["tenantTag"]
            or endpoint.get("tenantValue") != properties["tenantValue"]
            or not (outgoing or incoming)
        ):
            raise GraphDatabaseError(
                "Manual, foreign or legacy incident relationships are preserved; resolve them explicitly.",
                "GRAPH_ERASURE_BLOCKED",
            )


async def _owned_relationships(tx: ManagedGraphTransaction, identity: GraphIdentity) -> None:
    """Apply the same bounded ownership guard before primary erase and graph delete."""
    owned = await tx.query(
        "MATCH ()-[r]->() WHERE r.ownerKey=$key RETURN properties(r) AS edge LIMIT 65",
        {"key": identity.key},
    )
    if owned.count > 64 or any(
        _map(row.get("edge")).get("schemaVersion") != 2
        or _map(row.get("edge")).get("ownerTuple") != identity.tuple_json
        for row in owned.records
    ):
        raise GraphDatabaseError(
            "Foreign source-owned relationship is preserved.",
            "GRAPH_ERASURE_BLOCKED",
        )


def _node_properties(job: GraphJob) -> Dict[str, Any]:
    projection = job.projection
    properties = {
        **identity_properties(projection.identity),
        "sourceRevision": projection.source_revision,
        "projectionJson": canonical_subtree(job.projection_json, ["properties"]),
    }
    for key, value in projection.properties.items():
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9]*", key):
            raise GraphDatabaseError(
                "Unsupported graph projection property.", "GRAPH_PROJECTION_INVALID"
            )
        nested = (
            isinstance(value, dict)
            or isinstance(value, list)
            and any(isinstance(item, (dict, list)) for item in value)
        )
        display_key = (
            "artifactKind" if key == "kind" else "mutableKey" if key == "key" else key
        )
        properties[display_key] = (
            canonical_subtree(job.projection_json, ["properties", key])
            if nested
            else value
        )
    return properties


async def _apply(
    tx: ManagedGraphTransaction,
    job: GraphJob,
    phase: Literal["all", "nodes", "edges"] = "all",
) -> GraphApplyResult:
    result, projection, identity = GraphApplyResult(), job.projection, job.identity
    targets = {identity.key: identity}
    for reference in projection.references:
        target = reference.identity
        identity_properties(target)
        if target.tenant_id != identity.tenant_id:
            raise GraphDatabaseError("Foreign graph reference.", "GRAPH_SCOPE_MISMATCH")
        prior = targets.get(target.key)
        if prior and prior.tuple_json != target.tuple_json:
            raise GraphDatabaseError(
                "Graph reference tuple mismatch.", "GRAPH_IDENTITY_MISMATCH"
            )
        targets[target.key] = target
    if (
        len(projection.references)
        + len(projection.derived)
        + len(projection.derived_relations or [])
        > 64
        or len(projection.derived) + 1 > 32
    ):
        raise GraphDatabaseError(
            "Managed graph batch budget exceeded.", "GRAPH_TRANSACTION_BUDGET"
        )
    states = {key: await _gate(tx, target) for key, target in sorted(targets.items())}
    state = states[identity.key]
    revision = state["sourceRevision"]
    label = MANAGED_LABELS[identity.kind]
    existing = await tx.query(
        f"MATCH (n:{label} {{key:$key}}) RETURN properties(n) AS node",
        {"key": identity.key},
    )
    if existing.count > 1:
        raise GraphDatabaseError(
            "Managed source is ambiguous.", "GRAPH_IDENTITY_MISMATCH"
        )
    if existing.count:
        assert_identity_properties(_map(existing.records[0].get("node")), identity)
    if job.operation == "delete":
        if revision > job.source_revision:
            result.disposition = "suppressed"
            return result
        await _incidents(tx, identity)
        await _owned_relationships(tx, identity)
        params = {"key": identity.key, "tuple": identity.tuple_json}
        for query in (
            "MATCH ()-[r]->() WHERE r.schemaVersion=2 AND r.ownerKey=$key AND r.ownerTuple=$tuple DELETE r",
            f"MATCH (n:{label} {{key:$key}})-[r]-() WHERE r.schemaVersion=2 AND (r.sourceKey=$key OR r.targetKey=$key) DELETE r",
            f"MATCH (n:{label} {{key:$key}}) WHERE n.schemaVersion=2 AND n.tupleJson=$tuple DELETE n",
        ):
            _add(result, (await tx.query(query, params)).stats)
        await tx.query(
            "MATCH (s:CortexV2SourceState {key:$key}) SET s.sourceRevision=$revision,s.tombstoned=true,s.ownershipRevision=$ownershipRevision,s.referenceGeneration=$referenceGeneration REMOVE s.activeDigest RETURN s.key AS key",
            {"key": identity.key, "revision": job.source_revision, "ownershipRevision": job.ownership_revision, "referenceGeneration": job.reference_generation},
        )
        if state["tombstoned"] is True and not existing.count:
            result.disposition = "idempotent"
        return result
    if state["tombstoned"] is True or revision > job.source_revision:
        result.disposition = "suppressed"
        return result
    digest = job.source_digest or graph_source_digest(job)
    if revision == job.source_revision:
        if state.get("activeDigest") != digest or not existing.count:
            raise GraphDatabaseError(
                "Equal graph revision has a contradictory projection.",
                "GRAPH_REVISION_CONFLICT",
            )
        if phase != "edges":
            result.disposition = "idempotent"
            return result
    elif phase == "edges":
        raise GraphDatabaseError(
            "Rebuild source changed before edge phase.", "GRAPH_REBUILD_SOURCE_CHANGED"
        )
    if phase != "edges":
        properties = _node_properties(job)
        if existing.count:
            before = _map(existing.records[0].get("node"))
            for key in before.get("projectionKeys", []):
                if isinstance(key, str) and key not in properties:
                    properties[key] = None
        properties["projectionKeys"] = [
            "artifactKind" if key == "kind" else "mutableKey" if key == "key" else key
            for key in projection.properties
        ]
        node = await tx.query(
            f"MERGE (n:{label} {{key:$key}}) ON CREATE SET n += $identity WITH n WHERE n.schemaVersion=2 AND n.tupleJson=$tuple SET n += $properties RETURN n.key AS key",
            {
                "key": identity.key,
                "tuple": identity.tuple_json,
                "identity": identity_properties(identity),
                "properties": properties,
            },
        )
        if node.count != 1:
            raise GraphDatabaseError(
                "Managed source identity mismatch.", "GRAPH_IDENTITY_MISMATCH"
            )
        _add(result, node.stats)
        await tx.query(
            "MATCH (s:CortexV2SourceState {key:$key}) SET s.sourceRevision=$revision,s.activeDigest=$digest,s.ownershipRevision=$ownershipRevision,s.referenceGeneration=$referenceGeneration RETURN s.key AS key",
            {
                "key": identity.key,
                "revision": job.source_revision,
                "digest": digest,
                "ownershipRevision": job.ownership_revision,
                "referenceGeneration": job.reference_generation,
            },
        )
        # Same-source references must observe the successful native SET above,
        # rather than the -1 gate snapshot captured before this source existed.
        state.update(sourceRevision=job.source_revision, activeDigest=digest,
                     ownershipRevision=job.ownership_revision,
                     referenceGeneration=job.reference_generation)
    if phase == "nodes":
        return result
    _add(
        result,
        (
            await tx.query(
                "MATCH ()-[r]->() WHERE r.schemaVersion=2 AND r.ownerKey=$key AND r.ownerTuple=$tuple DELETE r",
                {"key": identity.key, "tuple": identity.tuple_json},
            )
        ).stats,
    )
    for reference in projection.references:
        target, target_state = reference.identity, states[reference.identity.key]
        if target_state["tombstoned"] is True:
            result.absent_targets.append(target.key)
            continue
        if target_state["sourceRevision"] == -1:
            raise GraphDatabaseError(
                "Captured live target has not been delivered; retry only this graph job after its target.",
                "GRAPH_TARGET_NOT_DELIVERED",
            )
        if (
            target_state["sourceRevision"] != reference.source_revision
            or target_state.get("ownershipRevision") != reference.ownership_revision
            or target_state.get("referenceGeneration") != reference.reference_generation
        ):
            raise GraphDatabaseError(
                "Captured live target revision, ownership or generation changed.",
                "GRAPH_REFERENCE_CHANGED",
            )
        relationship = _rel(reference.relationship)
        edge_key = string_tuple_digest(
            [identity.key, reference.role, reference.slot, target.key]
        )
        edge = await tx.query(
            f"MATCH (a:{label} {{key:$sourceKey}}),(b:{MANAGED_LABELS[target.kind]} {{key:$targetKey}}) WHERE a.schemaVersion=2 AND a.tupleJson=$sourceTuple AND a.sourceRevision=$sourceRevision AND b.schemaVersion=2 AND b.tupleJson=$targetTuple AND b.sourceRevision=$targetRevision MERGE (a)-[r:{relationship} {{edgeKey:$edgeKey}}]->(b) ON CREATE SET r += $properties RETURN r.edgeKey AS edgeKey",
            {
                "sourceKey": identity.key,
                "targetKey": target.key,
                "sourceTuple": identity.tuple_json,
                "targetTuple": target.tuple_json,
                "sourceRevision": job.source_revision,
                "targetRevision": reference.source_revision,
                "edgeKey": edge_key,
                "properties": {
                    "schemaVersion": 2,
                    "edgeKey": edge_key,
                    "ownerKey": identity.key,
                    "ownerTuple": identity.tuple_json,
                    "sourceKey": identity.key,
                    "targetKey": target.key,
                    "sourceTuple": identity.tuple_json,
                    "targetTuple": target.tuple_json,
                    "sourceRevision": job.source_revision,
                    "targetRevision": reference.source_revision,
                    "role": reference.role,
                    "slot": reference.slot,
                },
            },
        )
        if not edge.count:
            raise GraphDatabaseError(
                "Live target disappeared after its SourceState check.",
                "GRAPH_REFERENCE_CHANGED",
            )
        _add(result, edge.stats)
    for index, item in enumerate(projection.derived):
        derived_target = derived_graph_identity(
            item.kind, item.logical_id, identity, item.entity_type
        )
        relationship, target_label = _rel(item.relationship), MANAGED_LABELS[item.kind]
        props = dict(derived_target["properties"])
        if isinstance(item.properties.get("fullValue"), str):
            props["fullValue"] = item.properties["fullValue"]
        created = await tx.query(
            f"MERGE (n:{target_label} {{key:$key}}) ON CREATE SET n += $properties RETURN properties(n) AS node",
            {"key": derived_target["key"], "properties": props},
        )
        if (
            created.count != 1
            or _map(created.records[0].get("node")).get("tupleJson")
            != derived_target["tupleJson"]
            or _map(created.records[0].get("node")).get("schemaVersion") != 2
        ):
            raise GraphDatabaseError(
                "Derived graph identity mismatch.", "GRAPH_IDENTITY_MISMATCH"
            )
        _add(result, created.stats)
        edge_key = string_tuple_digest(
            [identity.key, relationship, derived_target["key"]]
        )
        edge = await tx.query(
            f"MATCH (a:{label} {{key:$sourceKey}}),(b:{target_label} {{key:$targetKey}}) MERGE (a)-[r:{relationship} {{edgeKey:$edgeKey}}]->(b) ON CREATE SET r += $properties RETURN r.edgeKey AS edgeKey",
            {
                "sourceKey": identity.key,
                "targetKey": derived_target["key"],
                "edgeKey": edge_key,
                "properties": {
                    "schemaVersion": 2,
                    "edgeKey": edge_key,
                    "ownerKey": identity.key,
                    "ownerTuple": identity.tuple_json,
                    "sourceKey": identity.key,
                    "targetKey": derived_target["key"],
                    "sourceTuple": identity.tuple_json,
                    "targetTuple": derived_target["tupleJson"],
                    "sourceRevision": job.source_revision,
                    "detailsJson": canonical_subtree(
                        job.projection_json, ["derived", index, "properties"]
                    ),
                },
            },
        )
        _add(result, edge.stats)
    for relation in projection.derived_relations or []:
        source = derived_graph_identity(
            "Entity", relation["subject"]["name"], identity, relation["subject"]["type"]
        )
        derived_target = derived_graph_identity(
            "Entity", relation["object"]["name"], identity, relation["object"]["type"]
        )
        edge_key = string_tuple_digest(
            [
                identity.key,
                "ENTITY_RELATION",
                source["key"],
                relation["predicate"],
                derived_target["key"],
            ]
        )
        edge = await tx.query(
            "MATCH (a:CortexV2Entity {key:$sourceKey}),(b:CortexV2Entity {key:$targetKey}) WHERE a.schemaVersion=2 AND b.schemaVersion=2 AND a.tupleJson=$sourceTuple AND b.tupleJson=$targetTuple MERGE (a)-[r:ENTITY_RELATION {edgeKey:$edgeKey}]->(b) ON CREATE SET r += $properties RETURN r.edgeKey AS edgeKey",
            {
                "sourceKey": source["key"],
                "targetKey": derived_target["key"],
                "sourceTuple": source["tupleJson"],
                "targetTuple": derived_target["tupleJson"],
                "edgeKey": edge_key,
                "properties": {
                    "schemaVersion": 2,
                    "edgeKey": edge_key,
                    "ownerKey": identity.key,
                    "ownerTuple": identity.tuple_json,
                    "sourceKey": source["key"],
                    "targetKey": derived_target["key"],
                    "sourceTuple": source["tupleJson"],
                    "targetTuple": derived_target["tupleJson"],
                    "sourceRevision": job.source_revision,
                    "predicate": relation["predicate"],
                },
            },
        )
        _add(result, edge.stats)
    return result


async def apply_graph_job(
    adapter: ManagedGraphAdapter, job: GraphJob
) -> GraphApplyResult:
    validate_graph_job(job)
    await assert_managed_graph_compatibility(adapter)
    for attempt in range(3):
        try:
            return await adapter.managed_transaction(lambda tx: _apply(tx, job))
        except GraphDatabaseError as error:
            if error.code != "GRAPH_TRANSACTION_CONFLICT" or attempt == 2:
                raise
    raise AssertionError("Unreachable managed transaction attempt")


async def apply_graph_rebuild_snapshot(
    adapter: ManagedGraphAdapter, snapshot: GraphJob, phase: Literal["nodes", "edges"]
) -> GraphApplyResult:
    """Fixed administrator snapshot phase only; no primary CRUD or queue acknowledgement."""
    if phase not in ("nodes", "edges"):
        raise GraphDatabaseError(
            "Rebuild phase must be nodes or edges.", "GRAPH_REBUILD_SOURCE_CHANGED"
        )
    validate_graph_job(snapshot)
    await assert_managed_graph_compatibility(adapter)
    for attempt in range(3):
        try:
            return await adapter.managed_transaction(
                lambda tx: _apply(tx, snapshot, phase)
            )
        except GraphDatabaseError as error:
            if error.code != "GRAPH_TRANSACTION_CONFLICT" or attempt == 2:
                raise
    raise AssertionError("Unreachable managed rebuild attempt")


async def deliver_graph_job(
    client: Any, adapter: ManagedGraphAdapter, receipt: GraphJobReceipt
) -> GraphApplyResult:
    try:
        args = {"id": receipt.id, "generation": receipt.generation}
        if receipt.identity.tenant_id is not None:
            args["tenantId"] = receipt.identity.tenant_id
        value = await client.query("graphSync:getGraphJob", args)
    except Exception:
        raise GraphJobUnresolved(receipt) from None
    job = graph_job_from_wire(value)
    if (
        job.identity.key != receipt.identity.key
        or job.source_revision != receipt.source_revision
    ):
        raise GraphJobUnresolved(receipt)
    if job.state in ("synced", "suppressed"):
        return GraphApplyResult(
            disposition="idempotent" if job.state == "synced" else "suppressed"
        )
    if job.state != "pending":
        raise GraphDatabaseError(
            "Graph job retry attempts are exhausted.", "GRAPH_JOB_FAILED"
        )
    result = await apply_graph_job(adapter, job)
    args = {
        "id": job.id,
        "generation": job.generation,
        "attemptToken": job.attempt_token,
    }
    if job.identity.tenant_id is not None:
        args["tenantId"] = job.identity.tenant_id
    await client.mutation(
        "graphSync:suppressJob"
        if result.disposition == "suppressed"
        else "graphSync:markSynced",
        args,
    )
    return result


@dataclass
class GraphErasureEvidence:
    target_id: str
    generation: str
    physical_source_id: str
    scope_known: Literal[True]


@dataclass
class GraphErasureItem:
    identity: GraphIdentity
    source_revision: int
    ownership_revision: int
    reference_generation: str
    reference_revision: int
    evidence: GraphErasureEvidence


@dataclass
class PreparedGraphErasureItem:
    item: GraphErasureItem
    adapter: ManagedGraphAdapter
    disposal_transport: Any
    prepared: Literal[True] = True


@dataclass
class GraphErasureStatus:
    id: str
    generation: str
    identity: GraphIdentity
    source_revision: int
    state: Literal["synced", "suppressed"]
    request_digest: str
    projection_digest: str
    disposal_revision: int
    disposed_job_count: int
    complete: bool
    kind: Literal["status"] = "status"


@dataclass
class GraphErasureApplyResult(GraphApplyResult):
    disposal: GraphErasureStatus | None = None


def validate_erasure_item(item: GraphErasureItem) -> None:
    identity_properties(item.identity)
    if (item.evidence.scope_known is not True
            or item.evidence.physical_source_id != item.identity.physical_source_id
            or item.evidence.generation != item.reference_generation
            or not isinstance(item.evidence.target_id, str) or not item.evidence.target_id
            or any(not safe_integer(value) or value < 1 for value in (
                item.source_revision, item.ownership_revision, item.reference_revision))):
        raise GraphDatabaseError("Erasure requires captured physical lifecycle evidence.", "GRAPH_IDENTITY_REQUIRED")


async def _preflight_copies(item: GraphErasureItem, transport: Any) -> None:
    for scan in ("source", "legacy"):
        ranges: list[dict[str, str | None]] = [{"cursor": None, "endCursor": None}]
        seen: set[tuple[str | None, str | None]] = set()
        while ranges:
            range_ = ranges.pop(0)
            while True:
                key = (range_["cursor"], range_["endCursor"])
                if key in seen:
                    raise GraphDatabaseError("Copied-job preflight cursor did not advance.", "GRAPH_ERASURE_INVALID_PAGE")
                seen.add(key)
                page = await transport.preflight(item, scan, range_)
                if (not isinstance(page, dict) or page.get("kind") != "preflight"
                        or not safe_integer(page.get("checked")) or page["checked"] < 0
                        or type(page.get("isDone")) is not bool
                        or not isinstance(page.get("continueCursor"), str)):
                    raise GraphDatabaseError("Copied-job preflight returned invalid evidence.", "GRAPH_ERASURE_INVALID_PAGE")
                if page.get("pageStatus") == "SplitRequired":
                    split = page.get("splitCursor")
                    if not isinstance(split, str) or not split or split in key:
                        raise GraphDatabaseError("Invalid copied-job preflight split.", "GRAPH_ERASURE_INVALID_PAGE")
                    ranges.insert(0, {"cursor": split, "endCursor": range_["endCursor"]})
                    range_ = {"cursor": range_["cursor"], "endCursor": split}
                    continue
                if page["isDone"] or range_["endCursor"] is not None and page["continueCursor"] == range_["endCursor"]:
                    break
                if not page["continueCursor"] or page["continueCursor"] == range_["cursor"]:
                    raise GraphDatabaseError("Copied-job preflight cursor did not advance.", "GRAPH_ERASURE_INVALID_PAGE")
                range_ = {**range_, "cursor": page["continueCursor"]}


async def prepare_graph_erasure(items: list[GraphErasureItem], *, adapter: ManagedGraphAdapter,
                                disposal_transport: Any) -> list[PreparedGraphErasureItem]:
    if disposal_transport is None:
        raise GraphDatabaseError("Explicit copied-job preflight is required before primary erasure.", "GRAPH_ERASURE_TRANSPORT_REQUIRED")
    await assert_managed_graph_compatibility(adapter)
    for item in items:
        validate_erasure_item(item)
        response = await adapter.managed_read(
            f"MATCH (n:{MANAGED_LABELS[item.identity.kind]} {{key:$key}}) RETURN properties(n) AS node", {"key": item.identity.key})
        if response.count > 1:
            raise GraphDatabaseError("Graph source is ambiguous.", "GRAPH_IDENTITY_MISMATCH")
        if response.count:
            assert_identity_properties(_map(response.records[0].get("node")), item.identity)
        class ReadOnlyIncidents:
            async def query(self, cypher: str, params: Dict[str, Any] | None = None) -> Any:
                return await adapter.managed_read(cypher, params)
        read_only = ReadOnlyIncidents()
        await _incidents(read_only, item.identity)
        await _owned_relationships(read_only, item.identity)
        await _preflight_copies(item, disposal_transport)
    return [PreparedGraphErasureItem(item, adapter, disposal_transport) for item in items]


async def _erasure_jobs(item: GraphErasureItem, client: Any, receipts: list[GraphJobReceipt]) -> list[GraphJob]:
    if not receipts:
        raise GraphJobUnresolved()
    jobs = []
    for receipt in receipts:
        args = {"id": receipt.id, "generation": receipt.generation}
        if item.identity.tenant_id is not None:
            args["tenantId"] = item.identity.tenant_id
        try:
            value = await client.query("graphSync:getGraphJob", args)
        except Exception:
            raise GraphJobUnresolved(receipt) from None
        job = graph_job_from_wire(value)
        if (job.operation != "delete" or job.identity.key != item.identity.key
                or job.identity.tuple_json != item.identity.tuple_json
                or job.source_revision != item.source_revision + 1
                or job.reference_generation != item.reference_generation
                or job.ownership_revision != item.ownership_revision):
            raise GraphJobUnresolved(receipt)
        jobs.append(job)
    return jobs


def _disposal_status(value: Any, item: GraphErasureItem, receipt: GraphJobReceipt) -> GraphErasureStatus:
    state = _map(value)
    if (state.get("kind") != "status" or state.get("id") != receipt.id
            or state.get("generation") != receipt.generation
            or state.get("sourceRevision") != item.source_revision + 1
            or state.get("state") not in ("synced", "suppressed")
            or any(not safe_integer(state.get(key)) or state[key] < 0 for key in ("disposalRevision", "disposedJobCount"))
            or type(state.get("complete")) is not bool
            or any(not isinstance(state.get(key), str) or re.fullmatch(r"[a-f0-9]{64}", state[key]) is None for key in ("requestDigest", "projectionDigest"))):
        raise GraphJobUnresolved(receipt)
    status_receipt = graph_receipt_from_wire(state)
    assert_identity_properties(identity_properties(status_receipt.identity), item.identity)
    return GraphErasureStatus(state["id"], state["generation"], status_receipt.identity,
                              state["sourceRevision"], state["state"], state["requestDigest"],
                              state["projectionDigest"], state["disposalRevision"],
                              state["disposedJobCount"], state["complete"])


async def _graph_erasure_state(item: GraphErasureItem, adapter: ManagedGraphAdapter) -> Dict[str, Any]:
    response = await adapter.managed_read(
        f"OPTIONAL MATCH (n:{MANAGED_LABELS[item.identity.kind]} {{key:$key}}) OPTIONAL MATCH (s:CortexV2SourceState {{key:$key}}) RETURN count(n) AS nodes,properties(s) AS state", {"key": item.identity.key})
    row = response.records[0] if response.records else {}
    state = _map(row.get("state"))
    if state:
        assert_identity_properties(state, item.identity)
    edges = await adapter.managed_read(
        "MATCH ()-[r]-() WHERE r.schemaVersion=2 AND (r.sourceKey=$key OR r.targetKey=$key OR r.ownerKey=$key) RETURN r.edgeKey AS key LIMIT 1", {"key": item.identity.key})
    return {"absent": row.get("nodes") == 0 and edges.count == 0,
            "tombstoned": state.get("tombstoned") is True
            and safe_integer(state.get("sourceRevision")) and state["sourceRevision"] >= item.source_revision + 1
            and state.get("ownershipRevision") == item.ownership_revision
            and state.get("referenceGeneration") == item.reference_generation}


class GraphErasureProgressError(GraphCommittedPartial):
    def __init__(self, item: GraphErasureItem, jobs: list[GraphJobReceipt],
                 disposal_outcome: Literal["failed", "unknown"], disposal_status: GraphErasureStatus | None,
                 reason: str) -> None:
        super().__init__({"physicalSourceId": item.identity.physical_source_id}, jobs, disposal_outcome, reason)
        self.disposal_outcome = disposal_outcome
        self.disposal_status = disposal_status


async def erase_graph_item(prepared: PreparedGraphErasureItem, *, client: Any,
                           jobs: list[GraphJobReceipt]) -> GraphErasureApplyResult:
    if prepared.prepared is not True:
        raise GraphDatabaseError("Prepare every selected item before primary effects.", "GRAPH_ERASURE_NOT_PREPARED")
    receipts = [graph_receipt_from_wire(value) for value in jobs]
    receipt = receipts[0] if receipts else None
    if receipt is None or any(value.identity.key != prepared.item.identity.key
                               or value.identity.tuple_json != prepared.item.identity.tuple_json
                               or value.source_revision != prepared.item.source_revision + 1 for value in receipts):
        raise GraphJobUnresolved(receipt)
    result = GraphErasureApplyResult()
    status = None
    try:
        try:
            status = _disposal_status(await prepared.disposal_transport.status(prepared.item, receipt), prepared.item, receipt)
        except Exception as cause:
            data = _backend_data(cause)
            if not isinstance(data, dict) or data.get("code") != "GRAPH_ERASURE_NOT_ACKNOWLEDGED":
                raise
            original = await _erasure_jobs(prepared.item, client, receipts)
            for job in original:
                applied = await deliver_graph_job(client, prepared.adapter, GraphJobReceipt(job.id, job.generation, job.identity, job.source_revision))
                result.nodes_created += applied.nodes_created
                result.nodes_deleted += applied.nodes_deleted
                result.relationships_created += applied.relationships_created
                result.relationships_deleted += applied.relationships_deleted
                result.absent_targets.extend(applied.absent_targets)
            status = _disposal_status(await prepared.disposal_transport.status(prepared.item, receipt), prepared.item, receipt)
        graph = await _graph_erasure_state(prepared.item, prepared.adapter)
        if not graph["absent"] or not graph["tombstoned"]:
            raise GraphDatabaseError("Original graph erasure is not verified; copied data remains protected.", "GRAPH_ERASURE_NOT_VERIFIED")
        while not status.complete:
            prior = status
            status = _disposal_status(await prepared.disposal_transport.dispose(prepared.item, receipt, prior.disposal_revision), prepared.item, receipt)
            if status.disposal_revision != prior.disposal_revision + 1 or status.disposed_job_count < prior.disposed_job_count:
                raise GraphDatabaseError("Copied-job disposal progress is contradictory.", "GRAPH_ERASURE_PROGRESS_CHANGED")
        result.disposal = status
        return result
    except Exception as cause:
        code = getattr(cause, "code", None)
        unknown = code in ("GRAPH_ERASURE_RESPONSE_UNKNOWN", "GRAPH_ERASURE_CANCELLED", "GRAPH_TRANSACTION_OUTCOME_UNKNOWN") or not isinstance(cause, GraphDatabaseError) and _backend_data(cause) is None
        raise GraphErasureProgressError(prepared.item, receipts, "unknown" if unknown else "failed", status, code or "GRAPH_ERASURE_RESPONSE_UNKNOWN") from cause


async def verify_graph_erasure(items: list[GraphErasureItem], *, adapter: ManagedGraphAdapter,
                               disposal_transport: Any, jobs: list[GraphJobReceipt]) -> Dict[str, Any]:
    await assert_managed_graph_compatibility(adapter)
    receipts = [graph_receipt_from_wire(value) for value in jobs]
    results = []
    for item in items:
        validate_erasure_item(item)
        receipt = next((value for value in receipts if value.identity.key == item.identity.key), None)
        if receipt is None:
            raise GraphJobUnresolved()
        status = _disposal_status(await disposal_transport.status(item, receipt), item, receipt)
        graph = await _graph_erasure_state(item, adapter)
        results.append({"key": item.identity.key, **graph, "queueComplete": status.complete, "disposedJobCount": status.disposed_job_count})
    return {"complete": all(row["absent"] and row["tombstoned"] and row["queueComplete"] for row in results), "items": results}
