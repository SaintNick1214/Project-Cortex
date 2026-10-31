/** Disposable Task08 fixture only. Never part of the shipped backend. */
import { getFunctionName, makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { ingestionStage } from "./runtimeIngestionSchema";
import { submitHandler } from "./runs";
import { dataAuthorityReference, requireDataAuthority } from "./runtimeDataAuth";
import { ConvexMemoryRepository } from "./runtimeMemoryRepository";
import { enqueueSourceEvent, processStageHandler, readEventCurrent } from "./runtimeIngestion";
import { commitBeliefPlan } from "./runtimeBeliefs";
import { canonicalModelJson } from "./_cortex/shared/domain/model_policy";
import { parseSourceFactsResponse, prepareSourceContent } from "./_cortex/shared/domain/sources";
import { planBeliefs } from "./_cortex/shared/domain/belief_plan";
import { executableRegistryHash } from "./agentDefinitions";
import { editMessage } from "./runtimeTranscript";

function ref<T extends "query" | "mutation" | "action", A extends Record<string, unknown>, R>(name: string) {
  return makeFunctionReference<T, A, R>(name) as unknown as FunctionReference<T, "internal", A, R>;
}
const stageArgs = { reference: runtimeAuthorityReference, eventId: v.string(), stage: ingestionStage };
const holdRef = ref<"mutation", Record<string, unknown>, null>("ingestionQualification:hold");
/** Redirect only initial indexing scheduling; all run recovery/Workflow scheduling is unchanged. */
function holding(ctx: MutationCtx): MutationCtx {
  return { ...ctx, scheduler: { ...ctx.scheduler, runAfter: async (delay, name, args) => {
    if (getFunctionName(name) === "runtimeIngestion:processStage") return await ctx.scheduler.runAfter(0, holdRef, args);
    return await ctx.scheduler.runAfter(delay, name, args);
  } } };
}
export const submitHeld = mutation({ args: { request: v.any() }, handler: async (ctx, args) => await submitHandler(holding(ctx), args) });
const editArgs = { memorySpaceId: v.optional(v.string()), tenantId: v.optional(v.string()), conversationId: v.string(), expectedRevision: v.number(), messageId: v.string(), expectedMessageRevision: v.number(), parts: v.array(v.object({ type: v.literal("text"), text: v.string() })) };
export const editHeld = mutation({ args: editArgs, handler: async (ctx, args) => {
  const native = editMessage as unknown as { _handler(ctx: MutationCtx, input: typeof args): Promise<unknown> };
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
/** Controlled extraction data tests native mutation/CAS behavior; it makes no provider claim. */
export const preparePlan = internalMutation({ args: { reference: runtimeAuthorityReference, eventId: v.string(), fact: v.string(), subject: v.string(), predicate: v.string(), object: v.string(), action: v.optional(v.union(v.literal("UPDATE"), v.literal("SUPERSEDE"))) }, handler: async (ctx, args) => {
  const request = { reference: args.reference, eventId: args.eventId, stage: "extract" as const };
  const lease = await ctx.runMutation(ref<"mutation", typeof request, { attempt: number; leaseVersion: number } | null>("runtimeIngestion:claim"), request);
  if (!lease) throw new Error("CONTROLLED_EXTRACT_NOT_CLAIMED");
  const current = await readEventCurrent(ctx, args.reference, args.eventId, "write");
  const candidates = parseSourceFactsResponse({ facts: [{ fact: args.fact, factType: "knowledge", subject: args.subject, predicate: args.predicate, object: args.object, confidence: 1, tags: [], entities: [], relations: [] }] }, current.source);
  await ctx.runMutation(ref<"mutation", Record<string, unknown>, unknown>("runtimeIngestion:persistStage"), { ...request, attempt: lease.attempt, leaseVersion: lease.leaseVersion, payloadCanonical: canonicalModelJson(candidates) });
  // Claim before this parent commits: the already scheduled native facts job sees the live lease.
  const factsRequest = { ...request, stage: "facts" as const };
  const factsLease = await ctx.runMutation(ref<"mutation", typeof factsRequest, { attempt: number; leaseVersion: number } | null>("runtimeIngestion:claim"), factsRequest);
  if (!factsLease) throw new Error("CONTROLLED_FACTS_NOT_CLAIMED");
  const existing = await new ConvexMemoryRepository(ctx, args.reference, "read").listFacts({ limit: 100 });
  const plan = await planBeliefs({ eventId: args.eventId, sequence: current.event.sequence, source: current.source, candidates, existing,
    resolve: async (_candidate, matched) => ({ action: args.action ?? "UPDATE", targetFactId: matched[0]!.factId, mergedFact: args.action === "SUPERSEDE" ? null : args.fact, reason: "Controlled native ordered-commit fixture" }) });
  return { ...factsRequest, attempt: factsLease.attempt, leaseVersion: factsLease.leaseVersion, planCanonical: canonicalModelJson(plan) };
} });
export const commitPlan = internalMutation({ args: { ...stageArgs, attempt: v.number(), leaseVersion: v.number(), planCanonical: v.string() }, handler: async (ctx, args) =>
  await commitBeliefPlan(holding(ctx), args) });
export const bumpFact = internalMutation({ args: { reference: runtimeAuthorityReference, factId: v.string(), expectedVersion: v.number() }, handler: async (ctx, args) => {
  await new ConvexMemoryRepository(ctx, args.reference, "write").recheckAuthority();
  const row = await ctx.db.query("facts").withIndex("by_runtime_scope_factId", q => q.eq("tenantId", args.reference.tenantId).eq("memorySpaceId", args.reference.memorySpaceId!).eq("factId", args.factId)).unique();
  if (!row || row.ownerPrincipalId !== args.reference.principalId || row.version !== args.expectedVersion) throw new Error("CONTROLLED_CAS_CONFLICT");
  await ctx.db.patch("facts", row._id, { version: row.version + 1, updatedAt: Date.now() });
  return { factId: row.factId, version: row.version + 1 };
} });
