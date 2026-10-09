/** Fixed managed identities. Logical IDs are display properties, never source authority. */
import { createSha256 } from "../common/crypto";
import { convexToJson, type Value } from "convex/values";
import { GraphDatabaseError } from "./types";
import type { GraphIdentity, GraphKind, GraphJob, GraphScope } from "./types";

export const GRAPH_TABLES = {
  memories: "Memory", facts: "Fact", contexts: "Context",
  conversations: "Conversation", memorySpaces: "MemorySpace",
  immutable: "Immutable", mutable: "Mutable", artifacts: "Artifact",
} as const;
export const MANAGED_KINDS = [
  ...Object.values(GRAPH_TABLES), "User", "Agent", "Participant", "Entity", "SourceState",
] as const;
export const MANAGED_LABELS = Object.fromEntries(
  MANAGED_KINDS.map((kind) => [kind, `CortexV2${kind}`]),
) as Record<(typeof MANAGED_KINDS)[number], string>;
export const MANAGED_RELATIONSHIPS = [
  "IN_SPACE", "CHILD_OF", "TRIGGERED_BY", "GRANTS_ACCESS_TO", "REFERENCES",
  "SOURCED_FROM", "PART_OF", "EXTRACTED_FROM", "SUPERSEDES", "SUPERSEDED_BY",
  "INVOLVES", "RELATES_TO", "HAS_PARTICIPANT", "STORED_BY", "EXTRACTED_BY",
  "MENTIONS", "ENTITY_RELATION", "ARTIFACT_MEMORY", "ARTIFACT_CONVERSATION",
] as const;

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => [key, sorted(item)]),
  );
  return value;
}
export const canonicalGraphJson = (value: Value): string =>
  JSON.stringify(sorted(convexToJson(value)));
export const graphDigest = (value: Value): string =>
  createSha256().update(canonicalGraphJson(value)).digestHex();
export const graphBytes = (value: Value): number => new TextEncoder().encode(canonicalGraphJson(value)).length;
const stringOrNull = (value: unknown): value is string | null => value === null || typeof value === "string";

export function primaryGraphIdentity(
  kind: GraphKind, physicalSourceId: string, scope: GraphScope,
): GraphIdentity {
  if (!Object.values(GRAPH_TABLES).includes(kind) || typeof physicalSourceId !== "string" || !physicalSourceId ||
      scope.tenantKnown !== true || !stringOrNull(scope.tenantId) || !stringOrNull(scope.memorySpaceId))
    throw new GraphDatabaseError("A managed graph operation needs captured physical identity and exact known scope.", "GRAPH_IDENTITY_REQUIRED");
  const spaceApplicable = kind !== "Immutable" && kind !== "Mutable";
  if (spaceApplicable !== (scope.memorySpaceId !== null))
    throw new GraphDatabaseError("Graph source space applicability does not match its fixed kind.", "GRAPH_SCOPE_MISMATCH");
  const tuple = ["cortex.graph.v2", scope.tenantId === null ? ["knownTenantless"] : ["tenant", scope.tenantId],
    kind, scope.memorySpaceId === null ? ["spaceNotApplicable"] : ["space", scope.memorySpaceId], physicalSourceId];
  return { schemaVersion: 2, key: graphDigest(tuple), tupleJson: canonicalGraphJson(tuple), kind,
    physicalSourceId, tenantKnown: true, tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId };
}
export function identityProperties(identity: GraphIdentity): Record<string, string | number | boolean> {
  const expected = primaryGraphIdentity(identity.kind, identity.physicalSourceId, identity);
  if (expected.key !== identity.key || expected.tupleJson !== identity.tupleJson || identity.schemaVersion !== 2)
    throw new GraphDatabaseError("Graph identity key and exact tuple disagree.", "GRAPH_IDENTITY_MISMATCH");
  return { key: identity.key, schemaVersion: 2, tupleJson: identity.tupleJson,
    kind: identity.kind, physicalSourceId: identity.physicalSourceId,
    tenantTag: identity.tenantId === null ? "knownTenantless" : "tenant", tenantValue: identity.tenantId ?? "",
    spaceTag: identity.memorySpaceId === null ? "spaceNotApplicable" : "space", spaceValue: identity.memorySpaceId ?? "" };
}
export function assertIdentityProperties(actual: Record<string, unknown>, identity: GraphIdentity): void {
  for (const [key, value] of Object.entries(identityProperties(identity)))
    if (actual[key] !== value) throw new GraphDatabaseError("Managed graph key/tuple mismatch; no legacy node may be adopted.", "GRAPH_IDENTITY_MISMATCH");
}
export function derivedGraphIdentity(kind: "User" | "Agent" | "Participant" | "Entity", logicalId: string,
  scope: GraphScope, entityType?: string): {key: string; tupleJson: string; properties: Record<string, Value>} {
  if (scope.tenantKnown !== true || !stringOrNull(scope.tenantId) || typeof logicalId !== "string" || !logicalId ||
      (kind === "Entity" && (typeof scope.memorySpaceId !== "string" || typeof entityType !== "string")))
    throw new GraphDatabaseError("Derived graph identity requires exact scope.", "GRAPH_IDENTITY_REQUIRED");
  const name = kind === "Entity" ? logicalId.trim().toLowerCase() : logicalId;
  if (!name) throw new GraphDatabaseError("Derived graph identity cannot be empty.", "GRAPH_IDENTITY_REQUIRED");
  const tuple = ["cortex.graph.v2.derived", scope.tenantId === null ? ["knownTenantless"] : ["tenant", scope.tenantId], kind,
    kind === "Entity" ? ["space", scope.memorySpaceId ?? "", name, entityType ?? ""] : ["logical", name]];
  const key = graphDigest(tuple), tupleJson = canonicalGraphJson(tuple);
  return { key, tupleJson, properties: {key, tupleJson, schemaVersion: 2, kind, logicalId: name,
    tenantTag: scope.tenantId === null ? "knownTenantless" : "tenant", tenantValue: scope.tenantId ?? "",
    spaceTag: kind === "Entity" ? "space" : "spaceNotApplicable", spaceValue: kind === "Entity" ? scope.memorySpaceId : "",
    ...(kind === "Entity" ? {name, type: entityType!} : {})} };
}
/** Target content revisions are delivery preconditions, not changes to the source payload/physical binding. */
export function graphSourceDigest(projection: import("./types").GraphProjection): string {
  return graphDigest({...projection,references:projection.references.map(({sourceRevision: _targetRevision,...binding})=>binding)} as unknown as Value);
}
function validateGraphJobEvidence(job: GraphJob): GraphJob {
  identityProperties(job.identity);
  if (job.sourceDigest !== undefined && job.sourceDigest !== graphSourceDigest(job.projection))
    throw new GraphDatabaseError("Captured source fingerprint contradicts its physical projection.", "GRAPH_JOB_UNRESOLVED");
  if (job.schemaVersion !== 2 || GRAPH_TABLES[job.table] !== job.identity.kind || !job._id || !job.generation || !job.attemptToken ||
      !Number.isSafeInteger(job.sourceRevision) || job.sourceRevision < 1 ||
      !["insert", "update", "delete"].includes(job.operation) || job.projection.sourceRevision !== job.sourceRevision ||
      job.projection.identity.key !== job.identity.key || job.projection.identity.tupleJson !== job.identity.tupleJson ||
      !job.referenceGeneration || !Number.isSafeInteger(job.ownershipRevision) || job.ownershipRevision < 1)
    throw new GraphDatabaseError("The immutable graph job has missing or contradictory captured evidence.", "GRAPH_JOB_UNRESOLVED");
  const expectedDigest = graphDigest({request:{graphInvocationId:job.graphInvocationId,priority:job.priority??"normal"},table:job.table,operation:job.operation,projection:job.projection,...job.sourceDigest===undefined?{}:{sourceDigest:job.sourceDigest},...job.suppressedJobs===undefined?{}:{suppressedJobs:job.suppressedJobs}} as unknown as Value);
  if (job.projectionJson !== undefined || job.projectionDigest !== undefined || job.requestJson !== undefined) {
    const request = {request:{graphInvocationId:job.graphInvocationId,priority:job.priority??"normal"},table:job.table,operation:job.operation,projection:job.projection,...job.sourceDigest===undefined?{}:{sourceDigest:job.sourceDigest},...job.suppressedJobs===undefined?{}:{suppressedJobs:job.suppressedJobs}};
    if (job.projectionJson !== canonicalGraphJson(job.projection as unknown as Value) ||
        job.requestJson !== canonicalGraphJson(request as unknown as Value) ||
        job.projectionDigest !== createSha256().update(job.projectionJson).digestHex() ||
        job.requestDigest !== createSha256().update(job.requestJson).digestHex())
      throw new GraphDatabaseError("Native canonical projection evidence is contradictory.", "GRAPH_JOB_UNRESOLVED");
  }
  if (job.requestDigest !== expectedDigest)
    throw new GraphDatabaseError("Graph job digest is contradictory.", "GRAPH_JOB_UNRESOLVED");
  if (graphBytes(job.projection as unknown as Value) > 256 * 1024)
    throw new GraphDatabaseError("Graph projection exceeds the inline native limit.", "GRAPH_PROJECTION_BUDGET");
  return job;
}

/** Malformed external evidence must refuse with a typed unresolved result before graph effects. */
export function validateGraphJob(job: GraphJob): GraphJob {
  try {return validateGraphJobEvidence(job);}
  catch(error) {if(error instanceof GraphDatabaseError)throw error;throw new GraphDatabaseError("Captured graph job evidence is malformed.","GRAPH_JOB_UNRESOLVED");}
}
