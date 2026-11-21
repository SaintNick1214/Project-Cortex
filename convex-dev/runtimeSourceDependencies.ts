/** Atomic dependency registration for Cortex-owned copies; caller labels never establish source authority. */
import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { ContextSourceWitness } from "../src/domain/context-witness";
import type { ArtifactContextWitness } from "../src/domain/artifact-context";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import { checkContextSourceWitnesses } from "./runtimeContextWitness";
import { mergeContextWitness } from "../src/domain/context-witness";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { SourceLineage } from "../src/domain/contracts";

export type SourceDependencyKind = "execution" | "transcript" | "source" | "content" | "media" | "artifact" | "model";
export interface SourceDependencyTarget { kind: SourceDependencyKind; id: string; revision?: number }
export interface SourceDependencyScope { tenantId: string; memorySpaceId: string }
type ReadCtx = Pick<QueryCtx, "db">;
function stale(): never { throw new ConvexError({ version: 1, code: "STALE_CONTEXT", message: "Source dependency is no longer available.", retryable: false, outcome: "not_dispatched" }); }
export async function assertSourceWitnessesNotErased(ctx: ReadCtx, scope: SourceDependencyScope, witnesses: readonly ContextSourceWitness[]) {
  for (const witness of witnesses) {
    const erased = await ctx.db.query("runtimeExternalErasureFences").withIndex("by_source", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("sourceId", witness.sourceId)).first();
    if (erased) stale();
    const revision = await ctx.db.query("runtimeSourceRevisionErasureFences").withIndex("by_revision", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("sourceId", witness.sourceId).eq("sourceRevision", witness.sourceRevision)).first();
    if (revision) stale();
  }
}
export async function sourceDependencyWitnesses(ctx: ReadCtx, scope: SourceDependencyScope, target: SourceDependencyTarget): Promise<ContextSourceWitness[]> {
  const rows = await ctx.db.query("runtimeSourceDependencies").withIndex("by_target", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("targetKind", target.kind).eq("targetId", target.id).eq("targetRevision", target.revision ?? 0)).take(4097);
  if (rows.length > 4096) stale();
  return rows.map(row => row.witness);
}
export async function hasExternalEvidenceAncestry(ctx: ReadCtx, scope: SourceDependencyScope, lineage: Pick<SourceLineage, "role" | "sourceId" | "sourceRevision">): Promise<boolean> {
  // Independently authored/manual assertions establish a separate user source.
  if (lineage.role === "user") return false;
  return lineage.role === "external" || (await sourceDependencyWitnesses(ctx, scope, { kind: "source", id: lineage.sourceId, revision: lineage.sourceRevision })).length > 0;
}
export async function registerSourceDependencies(ctx: MutationCtx, scope: SourceDependencyScope, target: SourceDependencyTarget,
  witnesses: readonly ContextSourceWitness[], artifacts: readonly ArtifactContextWitness[] = []) {
  const retained = new Map<string, ContextSourceWitness>();
  const remember = (witness: ContextSourceWitness) => {
    const prior = retained.get(witness.sourceId), merged = mergedWitness(prior, witness);
    retained.set(witness.sourceId, merged);
  };
  for (const witness of witnesses) remember(witness);
  for (const artifact of artifacts) for (const witness of await sourceDependencyWitnesses(ctx, scope, { kind: "artifact", id: artifact.artifactId, revision: artifact.artifactVersion })) remember(witness);
  // Retain both the immediate witness and its declared parents. Flattening at
  // admission makes later cleanup bounded even through many research steps.
  const expanded = new Set<string>();
  for (const witness of retained.values()) {
    const key = canonicalModelJson([witness.sourceId, witness.sourceRevision]);
    if (expanded.has(key)) continue; expanded.add(key);
    for (const parent of await sourceDependencyWitnesses(ctx, scope, { kind: "source", id: witness.sourceId, revision: witness.sourceRevision })) remember(parent);
    if (retained.size > 4096) stale();
  }
  if (retained.size > 4096) stale();
  const selected = [...retained.values()]; await assertSourceWitnessesNotErased(ctx, scope, selected);
  for (const witness of selected) {
    // This graph is the erasure index for external custody roots. Existing
    // authored-source guards remain responsible for ordinary user/tool data.
    // Derived sources already flattened their external parents above.
    const root = await ctx.db.query("runtimeExternalSources").withIndex("by_source", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("sourceId", witness.sourceId)).unique();
    if (!root) continue;
    const identity = await semanticHash(canonicalModelJson([scope.tenantId, scope.memorySpaceId, witness.sourceId, witness.sourceRevision, witness.sourceEventId, target.kind, target.id, target.revision ?? 0]));
    const prior = await ctx.db.query("runtimeSourceDependencies").withIndex("by_identity", q => q.eq("identity", identity)).unique();
    if (prior) {
      const merged = mergedWitness(prior.witness, witness); if (prior.erasedAt !== undefined) stale();
      if (canonicalModelJson(prior.witness) !== canonicalModelJson(merged)) await ctx.db.patch("runtimeSourceDependencies", prior._id, { witness: merged });
      continue;
    }
    await ctx.db.insert("runtimeSourceDependencies", { tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, identity, upstreamSourceId: witness.sourceId, upstreamRevision: witness.sourceRevision, witness,
      targetKind: target.kind, targetId: target.id, targetRevision: target.revision ?? 0, createdAt: Date.now() });
  }
}
/** Untagged historical witnesses already require both permissions. Preserve
 * that equivalent representation while tagged edges only widen their union. */
function mergedWitness(prior: ContextSourceWitness | undefined, next: ContextSourceWitness): ContextSourceWitness {
  const merged = mergeContextWitness(prior, next); if (!merged) stale();
  if (!prior) return next;
  if (!prior.permissions?.length || !next.permissions?.length) return { sourceId: merged.sourceId, sourceEventId: merged.sourceEventId, sourceRevision: merged.sourceRevision, contentHash: merged.contentHash };
  return merged;
}
/** Consumers with artifact/source ancestry still recheck original current access on every delivery and write. */
export async function checkSourceDependencies(ctx: ReadCtx, reference: RuntimeAuthorityReference, target: SourceDependencyTarget, deadlines?: number[]) {
  if (!reference.memorySpaceId) stale();
  const scope = { tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId };
  const witnesses = await sourceDependencyWitnesses(ctx, scope, target);
  await assertSourceWitnessesNotErased(ctx, scope, witnesses);
  await checkContextSourceWitnesses(ctx, reference, witnesses, deadlines);
}
