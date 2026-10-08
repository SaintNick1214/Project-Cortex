/** Disposable Task08 fixture only. Never part of the shipped backend. */
import { getFunctionName, makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import { saveMessages } from "@convex-dev/agent";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { ingestionStage } from "./runtimeIngestionSchema";
import { submitHandler, activeAttempt } from "./runs";
import { dataAuthorityReference, requireDataAuthority } from "./runtimeDataAuth";
import { ConvexMemoryRepository } from "./runtimeMemoryRepository";
import { enqueueSourceEvent, processStageHandler, readEventCurrent, persistStage, retry, requireStageLease } from "./runtimeIngestion";
import { commitBeliefPlan } from "./runtimeBeliefs";
import { canonicalModelJson } from "./_cortex/shared/domain/model_policy";
import { prepareSourceContent } from "./_cortex/shared/domain/sources";
import type { AttributedFact } from "./_cortex/shared/domain/contracts";
import { planBeliefs } from "./_cortex/shared/domain/belief_plan";
import { executableRegistryHash } from "./agentDefinitions";
import { edit, append, agentComponent } from "./runtimeTranscript";

function ref<T extends "query" | "mutation" | "action", A extends Record<string, unknown>, R>(name: string) {
  return makeFunctionReference<T, A, R>(name) as unknown as FunctionReference<T, "internal", A, R>;
}
const stageArgs = { reference: runtimeAuthorityReference, eventId: v.string(), stage: ingestionStage };
const holdRef = ref<"mutation", Record<string, unknown>, null>("ingestionQualification:hold");
/** Redirect only initial indexing scheduling; all run recovery/Workflow scheduling is unchanged. */
function holding(ctx: MutationCtx): MutationCtx {
  return { ...ctx, scheduler: { ...ctx.scheduler, runAfter: async (delay, name, args) => {
    if (getFunctionName(name) === "runtimeIngestion:processStage") return await ctx.scheduler.runAfter(0, holdRef, args ?? {});
    return await ctx.scheduler.runAfter(delay, name, args);
  } } };
}
export const submitHeld = mutation({ args: { request: v.any() }, handler: async (ctx, args) => await submitHandler(holding(ctx), args) });
const editArgs = { memorySpaceId: v.optional(v.string()), tenantId: v.optional(v.string()), conversationId: v.string(), expectedRevision: v.number(), messageId: v.string(), expectedMessageRevision: v.number(), parts: v.array(v.object({ type: v.literal("text"), text: v.string() })) };
export const editHeld = mutation({ args: editArgs, handler: async (ctx, args) => {
  const native = edit as unknown as { _handler(ctx: MutationCtx, input: typeof args): Promise<unknown> };
  return await native._handler(holding(ctx), args);
} });
const appendArgs = { memorySpaceId: v.optional(v.string()), tenantId: v.optional(v.string()), conversationId: v.string(), expectedRevision: v.number(), role: v.union(v.literal("user"), v.literal("assistant")), parts: v.array(v.object({ type: v.literal("text"), text: v.string() })) };
export const appendHeld = mutation({ args: appendArgs, handler: async (ctx, args) => {
  const native = append as unknown as { _handler(ctx: MutationCtx, input: typeof args): Promise<unknown> };
  return await native._handler(holding(ctx), args);
} });
const retryArgs = { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()), eventId: v.string(), stage: ingestionStage };
export const retryHeld = mutation({ args: retryArgs, handler: async (ctx, args) => {
  const native = retry as unknown as { _handler(ctx: MutationCtx, input: typeof args): Promise<unknown> };
  return await native._handler(holding(ctx), args);
} });
export const reference = query({ args: { memorySpaceId: v.string() }, handler: async (ctx, args) =>
  dataAuthorityReference(await requireDataAuthority(ctx, args, "write")) });
export const registryHash = internalQuery({ args: {}, handler: async () => await executableRegistryHash() });
export const hold = internalMutation({ args: stageArgs, handler: async (ctx, args) => {
  const row = await ctx.db.query("task08HeldStages").withIndex("by_event_stage", q => q.eq("eventId", args.eventId).eq("stage", args.stage)).unique();
  if (!row) await ctx.db.insert("task08HeldStages", { ...args, tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId!, heldAt: Date.now() });
  return null;
} });
export const held = internalQuery({ args: stageArgs, handler: async (ctx, args) => {
  await new ConvexMemoryRepository(ctx, args.reference, "read").recheckAuthority();
  return await ctx.db.query("task08HeldStages").withIndex("by_event_stage", q => q.eq("eventId", args.eventId).eq("stage", args.stage)).unique();
} });
export const release = internalAction({ args: stageArgs, handler: async (ctx, args) => {
  const row = await ctx.runQuery(ref<"query", typeof args, unknown>("ingestionQualification:held"), args);
  if (!row) throw new Error("NO_OWNED_HELD_STAGE");
  // Real worker, real policy/ledger, real provider. Completed duplicate claims return without billing.
  return await processStageHandler(ctx, args);
} });
const extractPersistArgs = { ...stageArgs, attempt: v.number(), leaseVersion: v.number(), payloadCanonical: v.string() };
export const persistExtractHeld = internalMutation({ args: extractPersistArgs, handler: async (ctx, args) => {
  if (args.stage !== "extract") throw new Error("EXACT_EXTRACT_ONLY");
  const native = persistStage as unknown as { _handler(ctx: MutationCtx, input: typeof args): Promise<unknown> };
  return await native._handler(holding(ctx), args);
} });
export const releaseExtractHeld = internalAction({ args: stageArgs, handler: async (ctx, args) => {
  if (args.stage !== "extract") throw new Error("EXACT_EXTRACT_ONLY");
  const row = await ctx.runQuery(ref<"query", typeof args, unknown>("ingestionQualification:held"), args);
  if (!row) throw new Error("NO_OWNED_HELD_STAGE");
  const decorated: ActionCtx = { ...ctx, runMutation: (async (name, input) => {
    if (getFunctionName(name) === "runtimeIngestion:persistStage") return await ctx.runMutation(ref<"mutation", Record<string, unknown>, unknown>("ingestionQualification:persistExtractHeld"), input ?? {});
    return await ctx.runMutation(name, input);
  }) as ActionCtx["runMutation"] };
  return await processStageHandler(decorated, args);
} });
const scopeArgs = { tenantId: v.string(), memorySpaceId: v.string() };
export const state = internalQuery({ args: scopeArgs, handler: async (ctx, args) => {
  const tables = ["runtimeIngestionScopes", "runtimeIngestionEvents", "runtimeIngestionStages", "runtimeIngestionJobs", "runtimeBeliefHeads", "runtimeBeliefHistory", "runtimeBeliefOutbox", "runtimeMemorySources", "runtimeMemoryChunks", "runtimeMemoryVectors", "runtimeMemoryReceipts", "facts", "runtimeRuns", "runtimeAgentExecutions", "runtimeTranscriptMessages", "runtimeModelOperations", "task08HeldStages"] as const;
  const result: Record<string, unknown[]> = {};
  for (const table of tables) {
    const rows = await ctx.db.query(table).filter(q => q.and(q.eq(q.field("tenantId"), args.tenantId), q.eq(q.field("memorySpaceId"), args.memorySpaceId))).take(1001);
    if (rows.length > 1000) throw new Error("FIXTURE_STATE_TOO_BROAD");
    result[table] = table === "runtimeMemoryVectors" ? rows.map(row => {
      const { embedding, ...vector } = row as unknown as { embedding: number[] };
      return { ...vector, dimensions: embedding.length, finite: embedding.every(Number.isFinite) };
    }) : rows;
  }
  const operations = await ctx.db.query("runtimeModelOperations").filter(q => q.and(q.eq(q.field("tenantId"), args.tenantId), q.eq(q.field("memorySpaceId"), args.memorySpaceId))).take(100);
  result.runtimeModelAttempts = (await Promise.all(operations.map(op => ctx.db.query("runtimeModelAttempts").withIndex("by_operation", q => q.eq("operationDocumentId", op._id)).take(10)))).flat();
  result.runtimeBudgetAccounts = await ctx.db.query("runtimeBudgetAccounts").filter(q => q.eq(q.field("tenantId"), args.tenantId)).take(100);
  return JSON.parse(JSON.stringify(result));
} });
export const seedSources = internalMutation({ args: { reference: runtimeAuthorityReference, prefix: v.string(), texts: v.array(v.string()), role: v.optional(v.union(v.literal("user"), v.literal("assistant"))) }, handler: async (ctx, args) => {
  if (!args.texts.length || args.texts.length > 33 || args.texts.some(text => new TextEncoder().encode(text).length > 4096)) throw new Error("BOUNDED_FIXTURE_INPUT");
  const repository = new ConvexMemoryRepository(ctx, args.reference, "write", ctx.db), result = [];
  for (const [ordinal, text] of args.texts.entries()) {
    const id = `${args.prefix}:${ordinal}`, role = args.role ?? "user";
    const lineage = role === "user" ? { sourceId: id, sourceEventId: `${id}:1`, sourceRevision: 1, role, trust: "user_assertion" as const }
      : { sourceId: id, sourceEventId: `${id}:1`, sourceRevision: 1, role, trust: "assistant_claim" as const };
    const prepared = await prepareSourceContent(repository.scope, lineage, text, { now: () => Date.now() });
    const saved = await repository.putSource(prepared.source);
    result.push(await enqueueSourceEvent(holding(ctx), args.reference, saved.source));
  }
  return result;
} });
/** Actual saved extraction candidates; controlled conflict decision tests native CAS/ordering. */
export const preparePlan = internalMutation({ args: { reference: runtimeAuthorityReference, eventId: v.string(), action: v.optional(v.union(v.literal("UPDATE"), v.literal("SUPERSEDE"))) }, handler: async (ctx, args) => {
  const current = await readEventCurrent(ctx, args.reference, args.eventId, "write");
  const factsRequest = { reference: args.reference, eventId: args.eventId, stage: "facts" as const };
  const factsLease = await ctx.runMutation(ref<"mutation", typeof factsRequest, { attempt: number; leaseVersion: number } | null>("runtimeIngestion:claim"), factsRequest);
  if (!factsLease) throw new Error("CONTROLLED_FACTS_NOT_CLAIMED");
  const saved = await ctx.db.query("runtimeIngestionStages").withIndex("by_event_stage", q => q.eq("tenantId", current.event.tenantId).eq("memorySpaceId", current.event.memorySpaceId).eq("eventId", args.eventId).eq("stage", "extract")).unique();
  if (!saved || saved.state !== "complete" || !saved.payloadCanonical) throw new Error("ACTUAL_EXTRACT_RECEIPT_REQUIRED");
  const candidates = JSON.parse(saved.payloadCanonical) as AttributedFact[];
  const existing = await new ConvexMemoryRepository(ctx, args.reference, "read").listFacts({ limit: 100 });
  const plan = await planBeliefs({ eventId: args.eventId, sequence: current.event.sequence, source: current.source, candidates, existing,
    resolve: async (candidate, matched) => ({ action: args.action ?? "UPDATE", targetFactId: matched[0]!.factId, mergedFact: args.action === "SUPERSEDE" ? null : candidate.fact, reason: "Controlled native ordered-commit fixture" }) });
  await ctx.runMutation(ref<"mutation", Record<string, unknown>, null>("runtimeIngestion:persistDraft"), { ...factsRequest, attempt: factsLease.attempt, leaseVersion: factsLease.leaseVersion, payloadCanonical: canonicalModelJson(plan) });
  return { ...factsRequest, attempt: factsLease.attempt, leaseVersion: factsLease.leaseVersion, planCanonical: canonicalModelJson(plan) };
} });
export const commitPlan = internalMutation({ args: { ...stageArgs, attempt: v.number(), leaseVersion: v.number(), planCanonical: v.string() }, handler: async (ctx, args) =>
  await commitBeliefPlan(holding(ctx), args) });
/** Recompute against a changed native read set without resetting the old lease or source sequence. */
export const replanOwned = internalMutation({ args: { ...stageArgs, attempt: v.number(), leaseVersion: v.number() }, handler: async (ctx, args) => {
  const current = await requireStageLease(ctx, args); if (args.stage !== "facts") throw new Error("EXACT_FACTS_ONLY");
  const saved = await ctx.db.query("runtimeIngestionStages").withIndex("by_event_stage", q => q.eq("tenantId", current.event.tenantId).eq("memorySpaceId", current.event.memorySpaceId).eq("eventId", args.eventId).eq("stage", "extract")).unique();
  if (!saved || saved.state !== "complete" || !saved.payloadCanonical) throw new Error("ACTUAL_EXTRACT_RECEIPT_REQUIRED");
  const candidates = JSON.parse(saved.payloadCanonical) as AttributedFact[], existing = await new ConvexMemoryRepository(ctx, args.reference, "read").listFacts({ limit: 100 });
  const plan = await planBeliefs({ eventId: args.eventId, sequence: current.event.sequence, source: current.source, candidates, existing,
    resolve: async (candidate, matched) => ({ action: "UPDATE", targetFactId: matched[0]!.factId, mergedFact: candidate.fact, reason: "Controlled replan of original older source sequence" }) });
  return { ...args, planCanonical: canonicalModelJson(plan) };
} });
export const bumpFact = internalMutation({ args: { reference: runtimeAuthorityReference, factId: v.string(), expectedVersion: v.number() }, handler: async (ctx, args) => {
  await new ConvexMemoryRepository(ctx, args.reference, "write").recheckAuthority();
  const row = await ctx.db.query("facts").withIndex("by_runtime_scope_factId", q => q.eq("tenantId", args.reference.tenantId).eq("memorySpaceId", args.reference.memorySpaceId!).eq("factId", args.factId)).unique();
  if (!row || row.ownerPrincipalId !== args.reference.principalId || row.version !== args.expectedVersion) throw new Error("CONTROLLED_CAS_CONFLICT");
  await ctx.db.patch("facts", row._id, { version: row.version + 1, updatedAt: Date.now() });
  return { factId: row.factId, version: row.version + 1 };
} });
/** Real native pending assistant row, with no provider call and no Core registration. */
export const savePartial = internalMutation({ args: { reference: runtimeAuthorityReference, runId: v.string(), attemptNumber: v.number(), leaseVersion: v.number() }, handler: async (ctx, args) => {
  const current = await activeAttempt(ctx, args); if (!current.row.snapshotCanonical) throw new Error("ACTUAL_SNAPSHOT_REQUIRED");
  const snapshot = JSON.parse(current.row.snapshotCanonical);
  const saved = await saveMessages(ctx, agentComponent, { threadId: current.conversation.threadId, userId: current.row.ownerPrincipalId, order: snapshot.anchor.order,
    messages: [{ role: "assistant", content: "Unfinished speculation: perhaps the user is a pilot." }], metadata: [{ status: "pending" }],
    agentName: `cortex:${args.runId}:${args.attemptNumber}:0`, failPendingSteps: false });
  return saved.messages.map(message => ({ id: message._id, status: message.status, order: message.order, stepOrder: message.stepOrder, role: message.message?.role }));
} });
/** Fixture-only cleanup: retired exact-scope held records, never product data or eligible work. */
export const clearRetiredHeld = internalMutation({ args: { tenantId: v.string(), memorySpaceId: v.string() }, handler: async (ctx, args) => {
  const rows = await ctx.db.query("task08HeldStages").withIndex("by_event_stage", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId)).take(1000);
  if (rows.length === 1000) throw new Error("OWNED_HELD_SCOPE_TOO_BROAD");
  for (const row of rows) {
    const event = await ctx.db.query("runtimeIngestionEvents").withIndex("by_event", q => q.eq("tenantId", args.tenantId).eq("memorySpaceId", args.memorySpaceId).eq("eventId", row.eventId)).unique();
    if (!event || !["tombstoned", "superseded"].includes(event.eligibility)) throw new Error("LIVE_HELD_EVENT_MUST_BE_RETIRED_FIRST");
  }
  for (const row of rows) await ctx.db.delete("task08HeldStages", row._id);
  return { deleted: rows.length, tenantId: args.tenantId, memorySpaceId: args.memorySpaceId, productRowsDeleted: 0 };
} });
