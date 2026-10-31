/** Temporary internal-only disposable-host qualification. Never shipped in the SDK.
 * Prepared source only: no runtime outcome is implied by this file's existence.
 * Seeded persisted fixtures test traversal; separate public runs test actual ingestion.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { createV8AuthorityReadScope, recheckAuthority } from "./runtimeAuth";
import { ConvexMemoryRepository, memoryScope, memoryError } from "./runtimeMemoryRepository";
import type { MemoryDeliveryBindings } from "./runtimeMemoryRepository";
import { factEvidenceNode, replaceFactEntityLinks, traverseConvexMemory } from "./runtimeMemoryTraversal";
import { resolveMemoryEffortPolicy } from "../src/domain/memory-effort";
import type { MemoryEffort } from "../src/domain/memory-effort";
import { prepareSourceContent } from "../src/domain/sources";

function label(value: string): string {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)) throw Error("Invalid fixture label");
  return `effort-qualification:${value}`;
}
const modes = v.union(v.literal("fast"), v.literal("normal"), v.literal("high"), v.literal("max"));

export const seed = internalMutation({ args: { reference: runtimeAuthorityReference, label: v.string() }, handler: async (nativeCtx, args) => {
  const prefix = label(args.label), ctx = createV8AuthorityReadScope(nativeCtx, { managedSources: true });
  await recheckAuthority(ctx, args.reference, { capability: "write", tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId });
  const scope = memoryScope(args.reference), repository = new ConvexMemoryRepository(ctx, args.reference, "write", ctx.db);
  if (await repository.getSource(`${prefix}:source:1`)) throw Error("Fixture already exists; do not replay seed");
  for (let ordinal = 1; ordinal <= 12; ordinal++) {
    const lineage = { sourceId: `${prefix}:source:${ordinal}`, sourceEventId: `${prefix}:event:${ordinal}`, sourceRevision: 1,
      role: "user" as const, trust: "user_assertion" as const };
    const prepared = await prepareSourceContent(scope, lineage, `Persisted traversal fixture ${ordinal}`, { now: () => Date.now() });
    await repository.putSource(prepared.source);
    const fact = { tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, ownerPrincipalId: scope.principalId,
      lineage, extractionPolicyVersion: "seeded-hosted-qualification-v1", factId: `${prefix}:fact:${ordinal}`,
      fact: ordinal === 1 ? `${prefix}:unique-seed` : `${prefix}:linked-evidence`, factType: "relationship" as const,
      subject: `${prefix}:entity:${ordinal - 1}`, object: `${prefix}:entity:${ordinal}`, confidence: 90, tags: [],
      sourceType: "manual" as const, version: 1, createdAt: Date.now(), updatedAt: Date.now() };
    await ctx.db.insert("facts", fact);
    await replaceFactEntityLinks(ctx.db, fact);
  }
  return { version: 1, seededSources: 12, seededFacts: 12, inferenceCalls: 0, fixtureLabel: args.label };
} });

export const traverse = internalQuery({ args: { reference: runtimeAuthorityReference, label: v.string(), effort: modes,
  seedOrdinal: v.optional(v.number()), maxEntries: v.optional(v.number()), maxContextTokens: v.optional(v.number()) }, handler: async (nativeCtx, args) => {
  const prefix = label(args.label), ordinal = args.seedOrdinal ?? 1;
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > 12) throw Error("Invalid fixture ordinal");
  const ctx = createV8AuthorityReadScope(nativeCtx, { managedSources: true });
  const repository = new ConvexMemoryRepository(ctx, args.reference, "read");
  const fact = await repository.getFact(`${prefix}:fact:${ordinal}`);
  if (!fact) memoryError("FORBIDDEN", "Authorized fixture seed unavailable");
  const bindings: MemoryDeliveryBindings = { sources: [], facts: [], vectors: [] };
  const result = await traverseConvexMemory(ctx, repository, [factEvidenceNode(fact)], resolveMemoryEffortPolicy({ effort: args.effort as MemoryEffort,
    ...(args.maxEntries === undefined ? {} : { maxEntries: args.maxEntries }),
    ...(args.maxContextTokens === undefined ? {} : { maxContextTokens: args.maxContextTokens }) }), bindings);
  await repository.checkDelivery(bindings, nativeCtx);
  return { version: 1, memoryEffort: result.memoryEffort,
    items: result.items.map(item => ({ id: item.id, kind: item.type, retrieval: item.retrieval })), bindings,
    durationClock: "Native fixed transaction clock; coordinator measures actual elapsed separately" };
} });

export const changeBridge = internalMutation({ args: { reference: runtimeAuthorityReference, label: v.string(), ordinal: v.number(),
  change: v.union(v.literal("version"), v.literal("tombstone")) }, handler: async (ctx, args) => {
  const prefix = label(args.label), scope = memoryScope(args.reference);
  if (!Number.isSafeInteger(args.ordinal) || args.ordinal < 2 || args.ordinal > 11) throw Error("Expected an intermediate bridge");
  await recheckAuthority(ctx, args.reference, { capability: "write", tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId });
  const row = await ctx.db.query("facts").withIndex("by_runtime_scope_factId", q => q.eq("tenantId", args.reference.tenantId)
    .eq("memorySpaceId", scope.memorySpaceId).eq("factId", `${prefix}:fact:${args.ordinal}`)).unique();
  if (!row || row.ownerPrincipalId !== args.reference.principalId) throw Error("Owned fixture bridge required");
  await ctx.db.patch("facts", row._id, args.change === "version" ? { version: row.version + 1 } : { tombstonedAt: Date.now() });
  return { changed: true, change: args.change };
} });

export const delivery = internalQuery({ args: { reference: runtimeAuthorityReference, bindingsCanonical: v.string() }, handler: async (ctx, args) => {
  if (new TextEncoder().encode(args.bindingsCanonical).length > 262144) throw Error("Bounded fixture bindings required");
  // Only an authenticated deployment administrator can call this internal fixture.
  const bindings = JSON.parse(args.bindingsCanonical) as MemoryDeliveryBindings;
  return await new ConvexMemoryRepository(ctx, args.reference, "read").checkDelivery(bindings, ctx);
} });
