/** Independent worker/operator boundary derived only from reviewed runtimeAuth/02B. */
import { ConvexError, v, type GenericValidator } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { RuntimeAuthority, RuntimeAuthorityReference, RuntimeCapability } from "../src/auth/verified";
import { recheckAuthority } from "./runtimeAuth";
import { assertSourceLineage } from "../src/domain/sources";
import { normalizeSourceText, semanticHash } from "../src/domain/profile";
import { canonicalMemoryValue } from "./runtimeMemoryRepository";

export function workerDeny(code: "FORBIDDEN" | "INVALID_INPUT" | "UNSUPPORTED_OPERATION" = "FORBIDDEN"): never {
  throw new ConvexError({ version: 1, code, message: code === "UNSUPPORTED_OPERATION"
    ? "Resource lifecycle is not supported by this maintenance adapter" : "Access denied or invalid worker input",
  retryable: false, outcome: "not_dispatched" });
}
export function boundedInteger(value: number, max = 1000, min = 1): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) workerDeny("INVALID_INPUT");
  return value;
}
export function authorityReference(authority: RuntimeAuthority): RuntimeAuthorityReference {
  const { principalId, principalVersion, membershipId, membershipVersion, grantId, grantVersion,
    tenantId, tenantEpoch, memorySpaceId, memorySpaceEpoch } = authority;
  return { principalId, principalVersion, membershipId, membershipVersion, grantId, grantVersion,
    tenantId, tenantEpoch, ...(memorySpaceId === undefined ? {} : { memorySpaceId, memorySpaceEpoch }) };
}
export function sameAuthority(a: RuntimeAuthorityReference, b: RuntimeAuthorityReference): boolean {
  return canonicalMemoryValue(authorityReferenceFields(a)) === canonicalMemoryValue(authorityReferenceFields(b));
}
function authorityReferenceFields(a: RuntimeAuthorityReference) {
  return [a.principalId, a.principalVersion, a.membershipId, a.membershipVersion, a.grantId, a.grantVersion,
    a.tenantId, a.tenantEpoch, a.memorySpaceId ?? null, a.memorySpaceEpoch ?? null];
}
export async function workerAuthority(ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference, capability: RuntimeCapability) {
  if (!reference.memorySpaceId) workerDeny();
  return await recheckAuthority(ctx, reference, { capability, tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId });
}

/** Strict structural validation is also applied to persisted JSON and direct handler fixtures. */
export function matchesValidator(value: unknown, schema: GenericValidator): boolean {
  switch (schema.kind) {
    case "string": case "id": return typeof value === "string" && value.trim().length > 0;
    case "float64": return typeof value === "number" && Number.isFinite(value);
    case "boolean": return typeof value === "boolean";
    case "null": return value === null;
    case "literal": return value === schema.value;
    case "array": return Array.isArray(value) && value.every((item: unknown) => matchesValidator(item, schema.element));
    case "union": return schema.members.some((member: GenericValidator) => matchesValidator(value, member));
    case "object": {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const record = value as Record<string, unknown>;
      const fields: Record<string, GenericValidator> = schema.fields;
      return Object.keys(record).every((key) => Object.hasOwn(fields, key))
        && Object.entries(fields).every(([key, field]) => record[key] === undefined
          ? field.isOptional === "optional" : matchesValidator(record[key], field));
    }
    case "record": return value !== null && typeof value === "object" && !Array.isArray(value)
      && Object.entries(value).every(([key, item]) => matchesValidator(key, schema.key) && matchesValidator(item, schema.value));
    default: return false;
  }
}

function validStoredTime(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 8.64e15;
}

type FactExpectation = { documentId?: Id<"facts">; version: number; sourceId: string; sourceEventId: string; sourceRevision: number };
function validateFact(fact: Doc<"facts"> | null, expected: FactExpectation): asserts fact is Doc<"facts"> {
  const now = Date.now();
  if (!fact || !fact.ownerPrincipalId || !fact.lineage || !fact.extractionPolicyVersion?.trim()
    || (expected.documentId !== undefined && expected.documentId !== fact._id)
    || !Number.isSafeInteger(fact.version) || fact.version < 1 || fact.version !== expected.version
    || !Number.isFinite(fact.confidence) || fact.confidence < 0 || fact.confidence > 100
    || !validStoredTime(fact.createdAt) || !validStoredTime(fact.updatedAt) || fact.updatedAt < fact.createdAt
    || fact.tombstonedAt !== undefined || fact.supersededBy !== undefined
    || (fact.validFrom !== undefined && (!validStoredTime(fact.validFrom) || fact.validFrom > now))
    || (fact.validUntil !== undefined && (!validStoredTime(fact.validUntil) || fact.validUntil <= now))
    || (fact.validFrom !== undefined && fact.validUntil !== undefined && fact.validUntil <= fact.validFrom)
    || fact.lineage.sourceId !== expected.sourceId || fact.lineage.sourceEventId !== expected.sourceEventId
    || fact.lineage.sourceRevision !== expected.sourceRevision || fact.lineage.role === "assistant"
    || (fact.sourceType !== "manual" && fact.sourceType !== "tool")
    || (fact.sourceType === "tool") !== (fact.lineage.role === "tool")) workerDeny();
  assertSourceLineage(fact.lineage);
}
function validateSource(source: Doc<"runtimeMemorySources"> | null, fact: Doc<"facts">): asserts source is Doc<"runtimeMemorySources"> {
  if (!source || !validStoredTime(source.createdAt) || source.ownerPrincipalId !== fact.ownerPrincipalId
    || source.tenantId !== fact.tenantId || source.memorySpaceId !== fact.memorySpaceId || source.tombstonedAt !== undefined
    || canonicalMemoryValue(source.lineage) !== canonicalMemoryValue(fact.lineage)
    || normalizeSourceText(source.content) !== source.content) workerDeny();
  assertSourceLineage(source.lineage);
}
async function scopedFact(ctx: Pick<QueryCtx, "db">, authority: RuntimeAuthority, factId: string) {
  return await ctx.db.query("facts").withIndex("by_runtime_scope_factId", (q) =>
    q.eq("tenantId", authority.tenantId).eq("memorySpaceId", authority.memorySpaceId!).eq("factId", factId))
    .filter((q) => authority.resourceAccess === "own" ? q.eq(q.field("ownerPrincipalId"), authority.principalId)
      : q.eq(q.field("tenantId"), authority.tenantId)).unique();
}
async function scopedSource(ctx: Pick<QueryCtx, "db">, authority: RuntimeAuthority, sourceId: string) {
  return await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", (q) =>
    q.eq("tenantId", authority.tenantId).eq("memorySpaceId", authority.memorySpaceId!).eq("lineage.sourceId", sourceId))
    .filter((q) => authority.resourceAccess === "own" ? q.eq(q.field("ownerPrincipalId"), authority.principalId)
      : q.eq(q.field("tenantId"), authority.tenantId)).unique();
}
/** Canonical fact/source checks precede private use. Final reloads follow all crypto/authority awaits. */
export async function canonicalFact(ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference,
  factId: string, expected: FactExpectation) {
  const authority = await workerAuthority(ctx, reference, "tool");
  await workerAuthority(ctx, reference, "read");
  await recheckAuthority(ctx, reference, { capability: "read", resource: { resourceType: "fact", resourceId: factId,
    tenantId: authority.tenantId, memorySpaceId: authority.memorySpaceId, ownerPrincipalId: authority.principalId } });
  const fact = await scopedFact(ctx, authority, factId);
  validateFact(fact, expected);
  const resource = { resourceType: "fact" as const, resourceId: fact.factId, tenantId: fact.tenantId,
    memorySpaceId: fact.memorySpaceId, ownerPrincipalId: fact.ownerPrincipalId };
  const sourceResource = { resourceType: "source" as const, resourceId: expected.sourceId,
    tenantId: fact.tenantId, memorySpaceId: fact.memorySpaceId, ownerPrincipalId: fact.ownerPrincipalId };
  await recheckAuthority(ctx, reference, { capability: "read", resource });
  await recheckAuthority(ctx, reference, { capability: "read", resource: sourceResource });
  const source = await scopedSource(ctx, authority, expected.sourceId);
  validateSource(source, fact);
  const factSnapshot = canonicalMemoryValue(fact);
  const sourceSnapshot = canonicalMemoryValue(source);
  const actualHash = await semanticHash(source.content);
  if (actualHash !== source.contentHash) workerDeny();
  // Source fences are independent of fact fences. Both explicit capabilities remain current after digest.
  await recheckAuthority(ctx, reference, { capability: "tool", resource });
  await recheckAuthority(ctx, reference, { capability: "tool", resource: sourceResource });
  await recheckAuthority(ctx, reference, { capability: "read", resource });
  await recheckAuthority(ctx, reference, { capability: "read", resource: sourceResource });
  // Reload canonical rows after those checkpoints. Exact snapshots prove the reloaded bytes match
  // the verified digest without introducing another asynchronous digest after the final checks.
  // Convex reads/writes share one transaction snapshot; fixture hooks model changes at awaited seams.
  const currentFact = await scopedFact(ctx, authority, factId);
  const currentSource = await scopedSource(ctx, authority, expected.sourceId);
  validateFact(currentFact, expected);
  validateSource(currentSource, currentFact);
  if (canonicalMemoryValue(currentFact) !== factSnapshot || canonicalMemoryValue(currentSource) !== sourceSnapshot
    || currentSource.contentHash !== actualHash) workerDeny();
  return currentFact;
}

export async function canonicalJob(ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference, item: Doc<"graphSyncQueue">) {
  if (!item.authority || !sameAuthority(item.authority, reference) || item.tenantId !== reference.tenantId
    || item.memorySpaceId !== reference.memorySpaceId || !item.ownerPrincipalId || item.table !== "facts"
    || !item.entityDocumentId || item.entityVersion === undefined || !item.sourceId || !item.sourceEventId
    || item.sourceRevision === undefined || item.operation === "delete"
    || !validStoredTime(item.createdAt)
    || (item.syncedAt !== undefined && (!validStoredTime(item.syncedAt) || item.syncedAt < item.createdAt))) workerDeny();
  const fact = await canonicalFact(ctx, item.authority, item.entityId, { documentId: item.entityDocumentId,
    version: item.entityVersion, sourceId: item.sourceId, sourceEventId: item.sourceEventId, sourceRevision: item.sourceRevision });
  if (item.ownerPrincipalId !== fact.ownerPrincipalId || canonicalMemoryValue(item.entity) !== canonicalMemoryValue(factPayload(fact))) workerDeny();
  return fact;
}
export function factPayload(fact: Doc<"facts">) {
  return { factId: fact.factId, fact: fact.fact, factType: fact.factType, confidence: fact.confidence, version: fact.version,
    tenantId: fact.tenantId!, memorySpaceId: fact.memorySpaceId, ownerPrincipalId: fact.ownerPrincipalId!, lineage: fact.lineage!,
    tags: fact.tags, ...(fact.subject === undefined ? {} : { subject: fact.subject }),
    ...(fact.predicate === undefined ? {} : { predicate: fact.predicate }), ...(fact.object === undefined ? {} : { object: fact.object }),
    ...(fact.entities === undefined ? {} : { entities: fact.entities }), ...(fact.relations === undefined ? {} : { relations: fact.relations }) };
}

export const maintenanceTable = v.union(v.literal("agents"), v.literal("artifacts"), v.literal("contexts"),
  v.literal("conversations"), v.literal("factHistory"), v.literal("facts"), v.literal("governanceEnforcement"),
  v.literal("governancePolicies"), v.literal("graphSyncQueue"), v.literal("immutable"), v.literal("memories"),
  v.literal("memorySpaces"), v.literal("mutable"), v.literal("sessions"));
export type MaintenanceTable = typeof maintenanceTable.type;
export function assertMaintenanceTable(table: MaintenanceTable): void {
  if (!matchesValidator(table, maintenanceTable)) workerDeny("INVALID_INPUT");
}
export function assertDeletionSupported(table: MaintenanceTable): void {
  assertMaintenanceTable(table);
  if (table !== "governancePolicies" && table !== "governanceEnforcement" && table !== "graphSyncQueue") workerDeny("UNSUPPORTED_OPERATION");
}
/** Operator-only metadata cleanup. Auth/source/tombstone controls are never allowlisted. */
export async function deleteMaintenanceRecord(ctx: MutationCtx, table: MaintenanceTable, rawId: string) {
  assertMaintenanceTable(table);
  const id = ctx.db.normalizeId(table, rawId);
  if (!id) workerDeny("INVALID_INPUT"); // Validate the table/ID pair before destructive routing.
  assertDeletionSupported(table);
  if (table === "governancePolicies") {
    const policyId = ctx.db.normalizeId("governancePolicies", rawId)!;
    const row = await ctx.db.get("governancePolicies", policyId);
    if (!row) return false;
    const references = await ctx.db.query("governanceEnforcement").withIndex("by_runtime_policy", (q) => q.eq("policyId", policyId)).collect();
    for (const log of references) await ctx.db.delete("governanceEnforcement", log._id);
    await ctx.db.delete("governancePolicies", policyId);
  } else if (table === "governanceEnforcement") {
    const rowId = ctx.db.normalizeId("governanceEnforcement", rawId)!;
    if (!await ctx.db.get("governanceEnforcement", rowId)) return false;
    await ctx.db.delete("governanceEnforcement", rowId);
  } else {
    const rowId = ctx.db.normalizeId("graphSyncQueue", rawId)!;
    if (!await ctx.db.get("graphSyncQueue", rowId)) return false;
    await ctx.db.delete("graphSyncQueue", rowId);
  }
  return true;
}
