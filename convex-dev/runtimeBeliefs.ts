/** A belief plan, read versions, ordered slot heads, history and outbox commit together. */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { AttributedFact } from "../src/domain/contracts";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import { planBeliefs } from "../src/domain/belief-plan";
import type { BeliefPlanV1 } from "../src/domain/belief-plan";
import { BELIEF_POLICY_VERSION } from "../src/domain/ingestion";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { ingestionStage } from "./runtimeIngestionSchema";
import { ConvexMemoryRepository } from "./runtimeMemoryRepository";
import { finishBeliefStage, requireStageCommit, ingestionDenied } from "./runtimeIngestion";
import type { StageLease } from "./runtimeIngestion";

export async function commitBeliefPlan(ctx: MutationCtx, args: StageLease & { planCanonical: string }) {
  const current = await requireStageCommit(ctx, args);
  if (args.stage !== "facts" || current.source.lineage.role === "assistant" || new TextEncoder().encode(args.planCanonical).length > 1_000_000) ingestionDenied("INVALID_INPUT");
  const plan = JSON.parse(args.planCanonical) as BeliefPlanV1;
  if (canonicalModelJson(plan) !== args.planCanonical || plan.version !== 1 || plan.eventId !== current.event.eventId
    || plan.sequence !== current.event.sequence || plan.sourceHash !== current.source.contentHash) ingestionDenied("INVALID_BELIEF_PLAN");
  const extraction = await ctx.db.query("runtimeIngestionStages").withIndex("by_event_stage", q => q.eq("tenantId", current.event.tenantId)
    .eq("memorySpaceId", current.event.memorySpaceId).eq("eventId", current.event.eventId).eq("stage", "extract")).unique();
  if (!extraction || extraction.state !== "complete" || !extraction.payloadCanonical) ingestionDenied("INVALID_STATE");
  const candidates = JSON.parse(extraction.payloadCanonical) as AttributedFact[];
  const repository = new ConvexMemoryRepository(ctx, args.reference, "write", ctx.db);
  const existing = await repository.listFacts({ limit: 100 }); if (existing.length === 100) ingestionDenied("BELIEF_SCOPE_TOO_BROAD");
  // Include all consumed versions, even candidates which were not rewritten.
  for (const [factId, expected] of Object.entries(plan.expectedVersions ?? {})) {
    const fact = await ctx.db.query("facts").withIndex("by_runtime_scope_factId", q => q.eq("tenantId", current.event.tenantId).eq("memorySpaceId", current.event.memorySpaceId).eq("factId", factId)).unique();
    if (expected !== (fact?.version ?? 0)) ingestionDenied("FACT_VERSION_CONFLICT");
  }
  const checked = await planBeliefs({ eventId: current.event.eventId, sequence: current.event.sequence, source: current.source, candidates, existing,
    resolve: async (_candidate, _existing, ordinal) => { const entry = plan.entries[ordinal]; if (!entry) ingestionDenied("INVALID_BELIEF_PLAN"); return entry.decision; } });
  if (canonicalModelJson(checked) !== args.planCanonical) ingestionDenied("FACT_VERSION_CONFLICT");
  // Exact source order defeats reversed model completion, not merely source wall-clock time.
  for (const entry of plan.entries) {
    const head = await ctx.db.query("runtimeBeliefHeads").withIndex("by_slot", q => q.eq("tenantId", current.event.tenantId).eq("memorySpaceId", current.event.memorySpaceId).eq("slotKey", entry.slotKey)).unique();
    if (head && head.sequence >= current.event.sequence && head.eventId !== current.event.eventId) ingestionDenied("BELIEF_ORDER_CONFLICT");
  }
  const facts = plan.entries.flatMap(entry => entry.next ? [entry.next] : []);
  const identity = { sourceId: current.source.lineage.sourceId, sourceEventId: current.source.lineage.sourceEventId,
    sourceRevision: current.source.lineage.sourceRevision, stage: "facts" as const, semanticPolicyVersion: BELIEF_POLICY_VERSION };
  const source = { sourceId: identity.sourceId, sourceEventId: identity.sourceEventId, sourceRevision: identity.sourceRevision };
  const receipt = await repository.commitDerived({ source, identity, facts, expectedFactVersions: plan.expectedVersions });
  if (!receipt.created) ingestionDenied("INGESTION_CONFLICT");
  for (const entry of plan.entries) {
    const before = entry.targetFactId ? existing.find(f => f.factId === entry.targetFactId) : undefined;
    const factId = entry.next?.factId ?? entry.targetFactId!;
    if (entry.decision.action === "SUPERSEDE") {
      const prior = await ctx.db.query("facts").withIndex("by_runtime_scope_factId", q => q.eq("tenantId", current.event.tenantId).eq("memorySpaceId", current.event.memorySpaceId).eq("factId", entry.targetFactId!)).unique();
      if (!prior || prior.version !== plan.expectedVersions[prior.factId]) ingestionDenied("FACT_VERSION_CONFLICT");
      await ctx.db.patch("facts", prior._id, { supersededBy: factId, version: prior.version + 1, updatedAt: Date.now() });
    }
    const head = await ctx.db.query("runtimeBeliefHeads").withIndex("by_slot", q => q.eq("tenantId", current.event.tenantId).eq("memorySpaceId", current.event.memorySpaceId).eq("slotKey", entry.slotKey)).unique();
    const headValue = { tenantId: current.event.tenantId, memorySpaceId: current.event.memorySpaceId, slotKey: entry.slotKey, factId,
      sequence: current.event.sequence, eventId: current.event.eventId, version: (head?.version ?? 0) + 1, updatedAt: Date.now() };
    if (head) await ctx.db.replace("runtimeBeliefHeads", head._id, headValue); else await ctx.db.insert("runtimeBeliefHeads", headValue);
    const historyId = `belief-history:${await semanticHash(canonicalModelJson([current.event.eventId, entry.ordinal, factId]))}`;
    await ctx.db.insert("runtimeBeliefHistory", { tenantId: current.event.tenantId, memorySpaceId: current.event.memorySpaceId, historyId,
      eventId: current.event.eventId, sequence: current.event.sequence, factId, action: entry.decision.action,
      ...(before ? { beforeCanonical: canonicalModelJson(before) } : {}), ...(entry.next ? { afterCanonical: canonicalModelJson(entry.next) } : {}),
      planCanonical: args.planCanonical, actorReference: args.reference, createdAt: Date.now() });
  }
  await ctx.db.insert("runtimeBeliefOutbox", { tenantId: current.event.tenantId, memorySpaceId: current.event.memorySpaceId,
    eventId: current.event.eventId, receiptId: receipt.receiptId, sequence: current.event.sequence, factIds: facts.map(f => f.factId), state: "pending", createdAt: Date.now() });
  await finishBeliefStage(ctx, args, receipt.receiptId, args.planCanonical);
  return receipt;
}
export const commit = internalMutation({ args: { reference: runtimeAuthorityReference, eventId: v.string(), stage: ingestionStage,
  attempt: v.number(), leaseVersion: v.number(), planCanonical: v.string() }, handler: async (ctx, args) => await commitBeliefPlan(ctx, args) });
