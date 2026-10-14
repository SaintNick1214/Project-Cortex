/** Durable source/stage jobs. Scheduler actions never inherit an Agent response budget. */
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { retireGraphSource } from "./runtimeGraph";
import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { SourceContent, AttributedFact, DerivedFact } from "../src/domain/contracts";
import type { IngestionStage, IngestionEligibility } from "../src/domain/ingestion";
import { BELIEF_POLICY_VERSION, INGESTION_LEASE_MS, MAX_INGESTION_ATTEMPTS, ingestionIdentity, skipsIngestion } from "../src/domain/ingestion";
import { SOURCE_EXTRACTION_POLICY_VERSION, extractSourceFacts, prepareSourceContent, validateModelEmbeddings, processingIdentityKey, parseSourceFactsResponse } from "../src/domain/sources";
import { DEFAULT_EMBEDDING_PROFILE, assertSupportedEmbeddingProfile, assertProfileMatches, semanticHash } from "../src/domain/profile";
import { canonicalModelJson } from "../src/domain/model-policy";
import type { ModelOperationKey, ModelPolicySnapshotV1 } from "../src/domain/model-policy";
import { buildConflictResolutionPrompt } from "../src/domain/conflicts";
import { planBeliefs, beliefSlot } from "../src/domain/belief-plan";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { ingestionStage, unreservedCapacityRefusal } from "./runtimeIngestionSchema";
import { ConvexMemoryRepository, createActionMemoryRepository } from "./runtimeMemoryRepository";
import { dataAuthorityReference, requireDataAuthority } from "./runtimeDataAuth";
import { bindTrustedBudget, assertUnreservedIngestionCapacity } from "./runtimeModelPolicy";
import type { UnreservedCapacityRefusal } from "./runtimeModelPolicy";
import type { ConflictDecision } from "../src/domain/conflicts";
import { createGatewayMemoryModel } from "./runtimeMemoryGateway";

type ReadCtx = Pick<QueryCtx, "db">;
type Event = Doc<"runtimeIngestionEvents">;
export type StageLease = { reference: RuntimeAuthorityReference; eventId: string; stage: IngestionStage; attempt: number; leaseVersion: number };
function ref<T extends "query" | "mutation" | "action", A extends Record<string, unknown>, R>(kind: T, name: string) {
  return makeFunctionReference<T, A, R>(name) as unknown as FunctionReference<T, "internal", A, R>;
}
const processRef = ref<"action", { reference: RuntimeAuthorityReference; eventId: string; stage: IngestionStage }, null>("action", "runtimeIngestion:processStage");
export function ingestionDenied(code = "INGESTION_DENIED", uncertain = false): never {
  throw new ConvexError({ version: 1, code, message: "Memory indexing operation denied.", retryable: false, outcome: uncertain ? "uncertain" : "not_dispatched" });
}
function exactOne<T>(rows: T[]): T | undefined { if (rows.length > 1) ingestionDenied("INGESTION_CONFLICT"); return rows[0]; }
export async function readScopeCutoff(ctx: ReadCtx, reference: RuntimeAuthorityReference) {
  await new ConvexMemoryRepository(ctx, reference, "read").recheckAuthority();
  const row = await ctx.db.query("runtimeIngestionScopes").withIndex("by_scope", q => q.eq("tenantId", reference.tenantId).eq("memorySpaceId", reference.memorySpaceId!)).unique();
  return { tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId!, sequence: row?.sequence ?? 0,
    factsThrough: row?.factsThrough ?? 0, vectorsThrough: row?.vectorsThrough ?? 0, vectorProfileThrough: row?.vectorProfileThrough ?? {}, graphThrough: row?.graphThrough ?? 0 };
}
/** Fresh-install stable cutoff. Absent heads retain the original reader; no backfill. */
export async function readScopeSequence(ctx: ReadCtx, reference: RuntimeAuthorityReference) {
  await new ConvexMemoryRepository(ctx, reference, "read").recheckAuthority();
  const head = await ctx.db.query("runtimeIngestionSequenceHeads").withIndex("by_scope", q => q.eq("tenantId", reference.tenantId)
    .eq("memorySpaceId", reference.memorySpaceId!)).unique();
  if (!head) return { ...(await readScopeCutoff(ctx, reference)), stable: false as const };
  if (!Number.isSafeInteger(head.sequence) || head.sequence < 0) ingestionDenied("INGESTION_CONFLICT");
  return { tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId!, sequence: head.sequence, stable: true as const };
}
export async function eventById(ctx: ReadCtx, reference: RuntimeAuthorityReference, eventId: string) {
  return exactOne(await ctx.db.query("runtimeIngestionEvents").withIndex("by_event", q => q.eq("tenantId", reference.tenantId)
    .eq("memorySpaceId", reference.memorySpaceId!).eq("eventId", eventId)).take(2));
}
export async function readEventStages(ctx: ReadCtx, event: Event) {
  return await ctx.db.query("runtimeIngestionStages").withIndex("by_event_stage", q => q.eq("tenantId", event.tenantId).eq("memorySpaceId", event.memorySpaceId).eq("eventId", event.eventId)).take(4);
}
export async function readEventCurrent(ctx: ReadCtx, reference: RuntimeAuthorityReference, eventId: string, capability: "read" | "write" = "read") {
  const repository = new ConvexMemoryRepository(ctx, reference, capability);
  await repository.recheckAuthority(); const event = await eventById(ctx, reference, eventId); if (!event || event.eligibility !== "eligible") ingestionDenied("STALE_SOURCE");
  const source = await repository.getSource(event.lineage.sourceId);
  if (!source || source.lineage.sourceEventId !== event.lineage.sourceEventId || source.lineage.sourceRevision !== event.lineage.sourceRevision
    || source.contentHash !== event.contentHash || canonicalModelJson(source.lineage) !== canonicalModelJson(event.lineage)
    || source.ownerPrincipalId !== event.ownerPrincipalId) ingestionDenied("STALE_SOURCE");
  if (event.toolOperationId) {
    const op = await ctx.db.query("runtimeAgentOperations").withIndex("by_operation", q => q.eq("tenantId", event.tenantId)
      .eq("memorySpaceId", event.memorySpaceId).eq("operationId", event.toolOperationId!)).unique();
    if (!op || op.state !== "complete" || op.toolName !== "memory_remember") ingestionDenied("TOOL_NOT_COMPLETE");
  }
  return { event, source };
}
export async function readScopeEvents(ctx: ReadCtx, reference: RuntimeAuthorityReference, options: { after: number; through: number; limit: number }) {
  await new ConvexMemoryRepository(ctx, reference, "read").recheckAuthority();
  if (![options.after, options.through, options.limit].every(Number.isSafeInteger) || options.after < 0 || options.through < options.after || options.limit < 1 || options.limit > 256) ingestionDenied("INVALID_INPUT");
  return await ctx.db.query("runtimeIngestionEvents").withIndex("by_scope_sequence", q => q.eq("tenantId", reference.tenantId)
    .eq("memorySpaceId", reference.memorySpaceId!).gt("sequence", options.after).lte("sequence", options.through)).take(options.limit);
}
async function readiness(ctx: MutationCtx, event: Event) {
  await ctx.scheduler.runAfter(0, ref<"mutation", { reference: RuntimeAuthorityReference }, unknown>("mutation", "runtimeMemoryContext:refreshWatermarks"), { reference: event.authorityReference });
  if (!event.runId || !event.conversationId) return;
  const run = await ctx.db.query("runtimeRuns").withIndex("by_scoped_id", q => q.eq("tenantId", event.tenantId).eq("memorySpaceId", event.memorySpaceId).eq("runId", event.runId!)).unique();
  if (!run || run.tombstonedAt !== undefined) return;
  const events = await ctx.db.query("runtimeIngestionEvents").withIndex("by_conversation_sequence", q => q.eq("tenantId", event.tenantId).eq("memorySpaceId", event.memorySpaceId)
    .eq("conversationId", event.conversationId!)).filter(q => q.eq(q.field("runId"), event.runId)).take(257);
  if (events.length > 256) ingestionDenied("INGESTION_TOO_BROAD");
  let failed = false; let pending = false;
  for (const item of events) {
    if (skipsIngestion(item.eligibility)) continue;
    if (item.eligibility !== "eligible") { pending = true; continue; }
    for (const state of [item.factsState, item.vectorsState]) {
      if (["failed", "unknown", "dead_letter"].includes(state)) failed = true;
      else if (state !== "complete" && state !== "skipped") pending = true;
    }
  }
  // Response finality is independent. A current source edit deliberately resets indexing readiness.
  const memoryStatus = failed ? "failed" : pending ? "pending" : "complete";
  if (run.modelInputVersion === 8) {
    const progress = await ctx.db.query("runtimeRunMemoryProgress").withIndex("by_run", q => q.eq("tenantId", run.tenantId)
      .eq("memorySpaceId", run.memorySpaceId).eq("runId", run.runId)).unique();
    if (progress && progress.runDocId !== run._id) ingestionDenied("INGESTION_CONFLICT");
    if (!progress) await ctx.db.insert("runtimeRunMemoryProgress", { tenantId: run.tenantId, memorySpaceId: run.memorySpaceId,
      runId: run.runId, runDocId: run._id, memoryStatus, version: 1, updatedAt: Date.now() });
    else if (progress.memoryStatus !== memoryStatus) await ctx.db.patch("runtimeRunMemoryProgress", progress._id,
      { memoryStatus, version: progress.version + 1, updatedAt: Date.now() });
  } else if (run.memoryStatus !== memoryStatus) await ctx.db.patch("runtimeRuns", run._id, { memoryStatus, updatedAt: Date.now() });
}
/** Public projection only, after its caller's current run/authority checks. Never used by execution guards. */
export async function readRunMemoryPublication(ctx: ReadCtx, run: Doc<"runtimeRuns">) {
  if (run.modelInputVersion !== 8) return { memoryStatus: run.memoryStatus, updatedAt: run.updatedAt, version: 0 };
  const progress = await ctx.db.query("runtimeRunMemoryProgress").withIndex("by_run", q => q.eq("tenantId", run.tenantId)
    .eq("memorySpaceId", run.memorySpaceId).eq("runId", run.runId)).unique();
  if (!progress) return { memoryStatus: run.memoryStatus, updatedAt: run.updatedAt, version: 0 };
  if (progress.runDocId !== run._id || !Number.isSafeInteger(progress.version) || progress.version < 1) ingestionDenied("INGESTION_CONFLICT");
  return { memoryStatus: progress.memoryStatus, updatedAt: Math.max(run.updatedAt, progress.updatedAt), version: progress.version };
}
export interface IngestionOrigin { conversationId?: string; conversationSequence?: number; conversationEpoch?: number; nativeMessageId?: string;
  runId?: string; toolOperationId?: string; eligibility?: IngestionEligibility }
export async function enqueueSourceEvent(ctx: MutationCtx, reference: RuntimeAuthorityReference, source: SourceContent, origin: IngestionOrigin = {}) {
  if (source.tenantId !== reference.tenantId || source.memorySpaceId !== reference.memorySpaceId) ingestionDenied();
  await new ConvexMemoryRepository(ctx, reference, "write").authority({ resourceType: "source", resourceId: source.lineage.sourceId,
    tenantId: source.tenantId, memorySpaceId: source.memorySpaceId, ownerPrincipalId: source.ownerPrincipalId }, "write");
  const identityCanonical = ingestionIdentity({ ...source, lineage: source.lineage });
  const eventId = `ingestion:${await semanticHash(identityCanonical)}`;
  const same = await ctx.db.query("runtimeIngestionEvents").withIndex("by_source", q => q.eq("tenantId", source.tenantId).eq("memorySpaceId", source.memorySpaceId)
    .eq("lineage.sourceId", source.lineage.sourceId).eq("lineage.sourceRevision", source.lineage.sourceRevision)).take(2);
  if (same.length) {
    const old = exactOne(same)!;
    if (old.identityCanonical !== identityCanonical || canonicalModelJson(old.lineage) !== canonicalModelJson(source.lineage)) ingestionDenied("IDEMPOTENCY_CONFLICT");
    const additions: Partial<Event> = {};
    for (const key of ["conversationId", "conversationSequence", "conversationEpoch", "nativeMessageId", "runId", "toolOperationId"] as const) {
      const value = origin[key]; if (value === undefined) continue;
      if (old[key] !== undefined && old[key] !== value) ingestionDenied("IDEMPOTENCY_CONFLICT");
      if (old[key] === undefined) Object.assign(additions, { [key]: value });
    }
    if (Object.keys(additions).length) { await ctx.db.patch("runtimeIngestionEvents", old._id, additions); await readiness(ctx, { ...old, ...additions }); }
    return { eventId: old.eventId, sequence: old.sequence, created: false };
  }
  const now = Date.now();
  const latest = await ctx.db.query("runtimeIngestionEvents").withIndex("by_source", q => q.eq("tenantId", source.tenantId).eq("memorySpaceId", source.memorySpaceId).eq("lineage.sourceId", source.lineage.sourceId)).order("desc").take(1);
  if (latest.some(old => old.lineage.sourceRevision >= source.lineage.sourceRevision)) ingestionDenied("STALE_SOURCE");
  await retireScopedSourceEvents(ctx, source, source.lineage.sourceId, "superseded");
  const scope = await ctx.db.query("runtimeIngestionScopes").withIndex("by_scope", q => q.eq("tenantId", source.tenantId).eq("memorySpaceId", source.memorySpaceId)).unique();
  const sequence = (scope?.sequence ?? 0) + 1; if (!Number.isSafeInteger(sequence)) ingestionDenied("SEQUENCE_EXHAUSTED");
  if (scope) await ctx.db.patch("runtimeIngestionScopes", scope._id, { sequence, version: scope.version + 1, updatedAt: now });
  else await ctx.db.insert("runtimeIngestionScopes", { tenantId: source.tenantId, memorySpaceId: source.memorySpaceId, sequence, factsThrough: 0, vectorsThrough: 0, graphThrough: 0, version: 1, updatedAt: now });
  const head = await ctx.db.query("runtimeIngestionSequenceHeads").withIndex("by_scope", q => q.eq("tenantId", source.tenantId)
    .eq("memorySpaceId", source.memorySpaceId)).unique();
  if (head) {
    if (!scope || head.sequence !== sequence - 1) ingestionDenied("INGESTION_CONFLICT");
    await ctx.db.patch("runtimeIngestionSequenceHeads", head._id, { sequence });
  } else if (!scope) {
    await ctx.db.insert("runtimeIngestionSequenceHeads", { tenantId: source.tenantId, memorySpaceId: source.memorySpaceId, version: 1, sequence });
  }
  const eligibility = origin.eligibility ?? (source.lineage.role === "tool" ? "awaiting_tool" : "eligible");
  const value = { version: 1 as const, tenantId: source.tenantId, memorySpaceId: source.memorySpaceId, eventId, identityCanonical,
    ownerPrincipalId: source.ownerPrincipalId, sequence, lineage: source.lineage, contentHash: source.contentHash,
    authorityReference: reference, eligibility, factsState: source.lineage.role === "assistant" ? "skipped" as const : "pending" as const,
    vectorsState: "pending" as const, extractionVersion: SOURCE_EXTRACTION_POLICY_VERSION, beliefVersion: BELIEF_POLICY_VERSION, profile: DEFAULT_EMBEDDING_PROFILE,
    ...Object.fromEntries(Object.entries(origin).filter(([key, value]) => key !== "eligibility" && value !== undefined)), createdAt: now, updatedAt: now };
  const id = await ctx.db.insert("runtimeIngestionEvents", value);
  for (const stage of ["extract", "facts", "vectors"] as const) await ctx.db.insert("runtimeIngestionStages", { tenantId: source.tenantId,
    memorySpaceId: source.memorySpaceId, eventId, stage, state: source.lineage.role === "assistant" && stage !== "vectors" ? "skipped" : "pending",
    attempt: 0, leaseVersion: 0, updatedAt: now });
  const event = (await ctx.db.get("runtimeIngestionEvents", id))!; await readiness(ctx, event);
  if (eligibility === "eligible") await ctx.scheduler.runAfter(0, processRef, { reference, eventId, stage: source.lineage.role === "assistant" ? "vectors" : "extract" });
  return { eventId, sequence, created: true };
}
export async function retireSourceEvents(ctx: MutationCtx, reference: RuntimeAuthorityReference, sourceId: string, state: "superseded" | "tombstoned") {
  if (!reference.memorySpaceId) ingestionDenied();
  await retireScopedSourceEvents(ctx, { tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId }, sourceId, state);
}
/** Trusted parent deletion/edit already checked its own resource authority. Active rows only: retained history never grows cleanup cost. */
export async function retireScopedSourceEvents(ctx: MutationCtx, scope: { tenantId: string; memorySpaceId: string }, sourceId: string, state: "superseded" | "tombstoned") {
  await retireGraphSource(ctx, scope, sourceId);
  for (const eligibility of ["eligible", "awaiting_approval", "awaiting_tool"] as const) {
    const events = await ctx.db.query("runtimeIngestionEvents").withIndex("by_source_eligibility", q => q.eq("tenantId", scope.tenantId)
      .eq("memorySpaceId", scope.memorySpaceId).eq("lineage.sourceId", sourceId).eq("eligibility", eligibility)).take(2);
    if (events.length > 1) ingestionDenied("INGESTION_CONFLICT");
    for (const event of events) { await ctx.db.patch("runtimeIngestionEvents", event._id, { eligibility: state, updatedAt: Date.now() }); await readiness(ctx, { ...event, eligibility: state }); }
  }
}
/** Only the trusted internal tombstone parent invokes this atomic child mutation. */
export const retireScopedSource = internalMutation({ args: { tenantId: v.string(), memorySpaceId: v.string(), sourceId: v.string() },
  handler: async (ctx, args) => { await retireScopedSourceEvents(ctx, args, args.sourceId, "tombstoned"); return null; } });
async function writeStage(ctx: MutationCtx, event: Event, row: Doc<"runtimeIngestionStages">,
  patch: Partial<Omit<Doc<"runtimeIngestionStages">, "_id" | "_creationTime">>) {
  await ctx.db.patch("runtimeIngestionStages", row._id, patch);
  // Lease/running activity lives on the stage. Event summaries publish readiness,
  // whose pending/running states are equivalent for every foreground consumer.
  if (patch.state && patch.state !== "running") {
    const summary = row.stage === "vectors" ? { vectorsState: patch.state } : row.stage === "facts" ? { factsState: patch.state }
      : ["failed", "unknown", "dead_letter"].includes(patch.state) ? { factsState: patch.state } : { factsState: "pending" as const };
    // A multi-stage receipt import can call this helper with the same old event.
    // Compare the current transaction row, including earlier helper writes.
    const current = await ctx.db.get("runtimeIngestionEvents", event._id);
    if (!current) ingestionDenied("INGESTION_CONFLICT");
    if ("vectorsState" in summary ? current.vectorsState !== summary.vectorsState : current.factsState !== summary.factsState) {
      await ctx.db.patch("runtimeIngestionEvents", event._id, { ...summary, updatedAt: Date.now() });
    }
  }
}
async function stageRow(ctx: ReadCtx, event: Event, stage: IngestionStage) {
  const row = exactOne(await ctx.db.query("runtimeIngestionStages").withIndex("by_event_stage", q => q.eq("tenantId", event.tenantId)
    .eq("memorySpaceId", event.memorySpaceId).eq("eventId", event.eventId).eq("stage", stage)).take(2));
  if (!row) ingestionDenied("INGESTION_CONFLICT"); return row;
}
export async function requireStageLease(ctx: ReadCtx, args: StageLease) {
  const current = await readEventCurrent(ctx, args.reference, args.eventId, "write"); const stage = await stageRow(ctx, current.event, args.stage);
  if (stage.state !== "running" || stage.attempt !== args.attempt || stage.leaseVersion !== args.leaseVersion || (stage.leaseExpiresAt ?? 0) <= Date.now()) ingestionDenied("LEASE_EXPIRED");
  if (canonicalModelJson(args.reference) !== canonicalModelJson(current.event.authorityReference)) ingestionDenied();
  return { ...current, stage };
}
/** Resolve the same job/stage/source again in the parent commit; policy changes cannot attach an old paid draft. */
export async function requireStageCommit(ctx: MutationCtx, args: StageLease) {
  const current = await requireStageLease(ctx, args);
  const job = await ctx.db.query("runtimeIngestionJobs").withIndex("by_event", q => q.eq("tenantId", current.event.tenantId)
    .eq("memorySpaceId", current.event.memorySpaceId).eq("eventId", current.event.eventId)).unique();
  if (!job) ingestionDenied("INVALID_STATE");
  const parentOperationId = args.stage === "extract" ? undefined : await extractionParent(ctx, current.event, job);
  await ctx.runQuery(ref<"query", { reference: RuntimeAuthorityReference; operationKey: ModelOperationKey; runBudgetId: string;
    source: { sourceId: string; sourceEventId: string; sourceRevision: number; contentHash: string }; parentOperationId?: Id<"runtimeModelOperations"> }, unknown>("query", "runtimeModelPolicy:resolve"),
    { reference: args.reference, operationKey: stageOperation[args.stage], runBudgetId: job.runBudgetId,
      source: { sourceId: current.source.lineage.sourceId, sourceEventId: current.source.lineage.sourceEventId, sourceRevision: current.source.lineage.sourceRevision, contentHash: current.source.contentHash },
      ...(parentOperationId ? { parentOperationId } : {}) });
  return current;
}
/** Atomic model-ledger hook. Standalone budgets remain untouched; exact job accounts share the native ledger. */
export async function guardIngestionRunBudget(ctx: ReadCtx, reference: RuntimeAuthorityReference, accountId: Id<"runtimeBudgetAccounts">): Promise<void> {
  const job = await ctx.db.query("runtimeIngestionJobs").withIndex("by_account", q => q.eq("runAccountId", accountId)).unique(); if (!job) return;
  const current = await readEventCurrent(ctx, reference, job.eventId, "write");
  if (job.tenantId !== reference.tenantId || job.memorySpaceId !== reference.memorySpaceId || canonicalModelJson(reference) !== canonicalModelJson(current.event.authorityReference)) ingestionDenied();
  const active = (await readEventStages(ctx, current.event)).filter(s => s.state === "running" && (s.leaseExpiresAt ?? 0) > Date.now());
  if (!active.length) ingestionDenied("LEASE_EXPIRED");
}
const stageOperation = { extract: "memory.extract", facts: "facts.resolve", vectors: "embedding.memory" } as const;
export async function assertIngestionPolicyPin(ctx: ReadCtx, accountId: Id<"runtimeBudgetAccounts">, operationKey: ModelOperationKey,
  snapshot: ModelPolicySnapshotV1, allowUnpinned = false, requireRunning = false): Promise<void> {
  const job = await ctx.db.query("runtimeIngestionJobs").withIndex("by_account", q => q.eq("runAccountId", accountId)).unique(); if (!job) return;
  const stage = (Object.entries(stageOperation).find(([, key]) => key === operationKey)?.[0]) as IngestionStage | undefined;
  if (!stage) ingestionDenied("POLICY_DENIED");
  const event = await eventById(ctx, snapshot.scope, job.eventId); if (!event) ingestionDenied();
  const row = await stageRow(ctx, event, stage);
  if (requireRunning && (row.state !== "running" || (row.leaseExpiresAt ?? 0) <= Date.now())) ingestionDenied("LEASE_EXPIRED");
  if (row.policyCanonical === undefined) { if (!allowUnpinned) ingestionDenied("POLICY_DENIED"); return; }
  if (row.policyCanonical !== canonicalModelJson(snapshot)) ingestionDenied("POLICY_CHANGED");
}
async function extractionParent(ctx: ReadCtx, event: Event, job: Doc<"runtimeIngestionJobs">) {
  if (event.lineage.role === "assistant") return undefined;
  const extraction = await stageRow(ctx, event, "extract");
  const semanticId = await semanticHash(canonicalModelJson(["memory.extract", `${event.eventId}:extract:${extraction.attempt}`, event.extractionVersion]));
  const operation = await ctx.db.query("runtimeModelOperations").withIndex("by_identity", q => q.eq("tenantId", event.tenantId).eq("memorySpaceId", event.memorySpaceId)
    .eq("principalId", event.authorityReference.principalId).eq("semanticId", semanticId).eq("operationKey", "memory.extract")).unique();
  if (!operation || operation.runAccountId !== job.runAccountId) ingestionDenied("EXTRACTION_PARENT_MISSING");
  return operation._id;
}
const eventArgs = { reference: runtimeAuthorityReference, eventId: v.string() };
const stageArgs = { ...eventArgs, stage: ingestionStage };
export const claim = internalMutation({ args: stageArgs, handler: async (ctx, args) => {
  const current = await readEventCurrent(ctx, args.reference, args.eventId, "write"); const row = await stageRow(ctx, current.event, args.stage);
  if (row.state === "complete" || row.state === "skipped") return null;
  if (row.state === "running") {
    if ((row.leaseExpiresAt ?? 0) > Date.now()) return null;
    await writeStage(ctx, current.event, row, { state: "unknown", failureCode: "INTERRUPTED_REQUIRES_RECONCILIATION", updatedAt: Date.now() });
    await readiness(ctx, current.event); return null;
  }
  if (row.state !== "pending") return null;
  // Capacity wakes are the SAME never-dispatched stage intent, not a new paid
  // retry. Keep the first lease deadline and operation identity across wakes.
  if (row.capacityWait) {
    if (![row.capacityWait.deadline, row.capacityWait.notBefore, row.capacityWait.wakes, row.attempt].every(Number.isSafeInteger)
      || row.capacityWait.wakes < 1 || row.attempt < 1 || row.capacityWait.notBefore >= row.capacityWait.deadline) ingestionDenied("INGESTION_CONFLICT");
    if (Date.now() >= row.capacityWait.deadline || row.capacityWait.wakes > 64) {
      await writeStage(ctx, current.event, row, { state: "failed", failureCode: "CAPACITY_WAIT_EXPIRED", updatedAt: Date.now() });
      await readiness(ctx, current.event); return null;
    }
    if (Date.now() < row.capacityWait.notBefore) return null;
  }
  if (args.stage !== "extract" && current.source.lineage.role !== "assistant") {
    const dependency = await stageRow(ctx, current.event, args.stage === "facts" ? "extract" : "facts");
    if (dependency.state !== "complete" && dependency.state !== "skipped") return null;
  }
  let job = await ctx.db.query("runtimeIngestionJobs").withIndex("by_event", q => q.eq("tenantId", current.event.tenantId).eq("memorySpaceId", current.event.memorySpaceId).eq("eventId", args.eventId)).unique();
  if (!job) {
    const requestCanonical = canonicalModelJson([current.event.identityCanonical, current.event.extractionVersion, current.event.beliefVersion, current.event.profile]);
    const budget = await bindTrustedBudget(ctx, { reference: args.reference, operationKey: current.source.lineage.role === "assistant" ? "embedding.memory" : "memory.extract", requestId: args.eventId, requestCanonical });
    const id = await ctx.db.insert("runtimeIngestionJobs", { tenantId: current.event.tenantId, memorySpaceId: current.event.memorySpaceId,
      eventId: args.eventId, ...budget, requestCanonical, createdAt: Date.now() }); job = (await ctx.db.get("runtimeIngestionJobs", id))!;
  }
  if (row.capacityWait) {
    const account = await ctx.db.get("runtimeBudgetAccounts", job.runAccountId);
    if (!account || !account.reference || account.kind !== "run" || account.runBudgetId !== job.runBudgetId
      || canonicalModelJson(account.reference) !== canonicalModelJson(args.reference)) ingestionDenied("POLICY_DENIED");
    if (!account.current || account.cancelled || account.overrun || Date.now() < account.windowStart || Date.now() >= account.windowEnd) ingestionDenied("BUDGET_EXCEEDED");
  }
  const attempt = row.capacityWait ? row.attempt : row.attempt + 1;
  const leaseExpiresAt = row.capacityWait?.deadline ?? Date.now() + INGESTION_LEASE_MS;
  await writeStage(ctx, current.event, row, { state: "running", attempt, leaseVersion: row.leaseVersion + 1,
    leaseExpiresAt, updatedAt: Date.now() });
  const parentOperationId = args.stage === "extract" ? undefined : await extractionParent(ctx, current.event, job);
  const resolution = await ctx.runQuery(ref<"query", { reference: RuntimeAuthorityReference; operationKey: ModelOperationKey; runBudgetId: string;
    source: { sourceId: string; sourceEventId: string; sourceRevision: number; contentHash: string }; parentOperationId?: Id<"runtimeModelOperations"> }, { snapshot: ModelPolicySnapshotV1 }>("query", "runtimeModelPolicy:resolve"),
    { reference: args.reference, operationKey: stageOperation[args.stage], runBudgetId: job.runBudgetId,
      source: { sourceId: current.source.lineage.sourceId, sourceEventId: current.source.lineage.sourceEventId, sourceRevision: current.source.lineage.sourceRevision, contentHash: current.source.contentHash },
      ...(parentOperationId ? { parentOperationId } : {}) });
  const policyCanonical = canonicalModelJson(resolution.snapshot);
  if (row.policyCanonical !== undefined && row.policyCanonical !== policyCanonical) ingestionDenied("POLICY_CHANGED");
  if (args.stage === "vectors") {
    if (!resolution.snapshot.semanticProfile) ingestionDenied("PROFILE_NOT_READY");
    assertSupportedEmbeddingProfile(resolution.snapshot.semanticProfile);
    if (row.policyCanonical !== undefined) assertProfileMatches(current.event.profile, resolution.snapshot.semanticProfile);
    else if (canonicalModelJson(current.event.profile) !== canonicalModelJson(resolution.snapshot.semanticProfile)) {
      await ctx.db.patch("runtimeIngestionEvents", current.event._id, { profile: resolution.snapshot.semanticProfile });
    }
  }
  await ctx.db.patch("runtimeIngestionStages", row._id, { policyCanonical });
  await ctx.scheduler.runAfter(leaseExpiresAt - Date.now() + 1, ref<"mutation", StageLease, null>("mutation", "runtimeIngestion:expireStage"),
    { reference: args.reference, eventId: args.eventId, stage: args.stage, attempt, leaseVersion: row.leaseVersion + 1 });
  return { reference: args.reference, eventId: args.eventId, stage: args.stage, attempt, leaseVersion: row.leaseVersion + 1, runBudgetId: job.runBudgetId,
    ...(parentOperationId ? { parentOperationId } : {}) };
} });
const leaseArgs = { ...stageArgs, attempt: v.number(), leaseVersion: v.number() };
/** Known, fresh, never-reserved capacity waits use Scheduler's original action
 * ownership. A failed/late child rolls back; the original Action records failure. */
export const waitForCapacity = internalMutation({ args: { ...leaseArgs, refusal: unreservedCapacityRefusal }, handler: async (ctx, args) => {
  const current = await requireStageCommit(ctx, args);
  const job = await ctx.db.query("runtimeIngestionJobs").withIndex("by_event", q => q.eq("tenantId", current.event.tenantId)
    .eq("memorySpaceId", current.event.memorySpaceId).eq("eventId", args.eventId)).unique();
  if (!job || args.refusal.runBudgetId !== job.runBudgetId || args.refusal.operationKey !== stageOperation[args.stage]) ingestionDenied("RETRY_NOT_SAFE");
  const operationId = `${args.eventId}:${args.stage}:${args.attempt}`;
  const policy = args.stage === "extract" ? current.event.extractionVersion : args.stage === "facts" ? current.event.beliefVersion : current.event.profile.profileId;
  const identities = await Promise.all(Array.from({ length: args.stage === "facts" ? 100 : 1 }, (_, ordinal) => semanticHash(canonicalModelJson([
    stageOperation[args.stage], args.stage === "facts" ? `${operationId}:${ordinal}` : operationId, policy]))));
  if (!identities.includes(args.refusal.semanticId)) ingestionDenied("RETRY_NOT_SAFE");
  // No previous candidate/chunk may have dispatched under this stage intent.
  // A later capacity refusal cannot replay an earlier paid batch/resolver.
  for (const semanticId of identities) {
    const operations = await ctx.db.query("runtimeModelOperations").withIndex("by_identity", q => q.eq("tenantId", args.reference.tenantId)
      .eq("memorySpaceId", args.reference.memorySpaceId!).eq("principalId", args.reference.principalId).eq("semanticId", semanticId)
      .eq("operationKey", stageOperation[args.stage])).take(1);
    if (operations.length) ingestionDenied("RETRY_NOT_SAFE", true);
  }
  const parent = args.stage === "extract" ? undefined : await extractionParent(ctx, current.event, job);
  const bound = await assertUnreservedIngestionCapacity(ctx, args.reference, args.refusal, {
    sourceId: current.source.lineage.sourceId, sourceEventId: current.source.lineage.sourceEventId,
    sourceRevision: current.source.lineage.sourceRevision, contentHash: current.source.contentHash }, parent);
  const deadline = Math.min(current.stage.capacityWait?.deadline ?? current.stage.leaseExpiresAt!, bound);
  const wakes = (current.stage.capacityWait?.wakes ?? 0) + 1;
  const delay = Math.min(2000, 250 * 2 ** Math.min(wakes - 1, 3));
  if (wakes > 64 || Date.now() + delay >= deadline) ingestionDenied("CAPACITY_WAIT_EXPIRED");
  await writeStage(ctx, current.event, current.stage, { state: "pending", leaseExpiresAt: deadline,
    capacityWait: { deadline, notBefore: Date.now() + delay, wakes }, updatedAt: Date.now() });
  await readiness(ctx, current.event);
  await ctx.scheduler.runAfter(delay, processRef, { reference: args.reference, eventId: args.eventId, stage: args.stage });
  await ctx.scheduler.runAfter(deadline - Date.now() + 1, ref<"mutation", StageLease, null>("mutation", "runtimeIngestion:expireStage"),
    { reference: args.reference, eventId: args.eventId, stage: args.stage, attempt: args.attempt, leaseVersion: args.leaseVersion });
  return null;
} });
export const hydrate = internalQuery({ args: leaseArgs, handler: async (ctx, args) => await requireStageLease(ctx, args) });
export const persistStage = internalMutation({ args: { ...leaseArgs, payloadCanonical: v.string() }, handler: async (ctx, args) => {
  const current = await requireStageCommit(ctx, args); if (new TextEncoder().encode(args.payloadCanonical).length > 1_000_000 || canonicalModelJson(JSON.parse(args.payloadCanonical)) !== args.payloadCanonical) ingestionDenied("INVALID_INPUT");
  if (args.stage !== "extract") ingestionDenied("INVALID_INPUT");
  const parsed = JSON.parse(args.payloadCanonical) as AttributedFact[];
  const checked = parseSourceFactsResponse({ facts: parsed.map(({ lineage: _lineage, ...fact }) => ({ ...fact, entities: fact.entities ?? [], relations: fact.relations ?? [] })) }, current.source);
  // The strict domain parser includes optional undefined properties. Persist only its JSON wire values.
  if (canonicalModelJson(JSON.parse(JSON.stringify(checked))) !== args.payloadCanonical) ingestionDenied("INVALID_INPUT");
  const receiptId = `stage:${await semanticHash(canonicalModelJson([current.event.identityCanonical, args.stage, current.event.extractionVersion, current.event.profile]))}`;
  await writeStage(ctx, current.event, current.stage, { state: "complete", payloadCanonical: args.payloadCanonical, receiptId, updatedAt: Date.now() });
  await readiness(ctx, current.event);
  const next = args.stage === "extract" ? "facts" : args.stage === "facts" ? "vectors" : undefined;
  if (next) await ctx.scheduler.runAfter(0, processRef, { reference: args.reference, eventId: args.eventId, stage: next }); return { receiptId };
} });
export const failStage = internalMutation({ args: { ...leaseArgs, uncertain: v.boolean(), failureCode: v.string() }, handler: async (ctx, args) => {
  const event = await eventById(ctx, args.reference, args.eventId); if (!event) return null; const row = await stageRow(ctx, event, args.stage);
  if (row.state !== "running" || row.attempt !== args.attempt || row.leaseVersion !== args.leaseVersion) return null;
  await writeStage(ctx, event, row, { state: args.uncertain ? "unknown" : row.attempt >= MAX_INGESTION_ATTEMPTS ? "dead_letter" : "failed",
    failureCode: args.failureCode, updatedAt: Date.now() }); await readiness(ctx, event); return null;
} });
/** No grant/model lookup is needed to retire an already expired captured job. */
export const expireStage = internalMutation({ args: leaseArgs, handler: async (ctx, args) => {
  const event = await eventById(ctx, args.reference, args.eventId); if (!event || canonicalModelJson(event.authorityReference) !== canonicalModelJson(args.reference)) return null;
  const stage = await stageRow(ctx, event, args.stage);
  if (stage.state === "pending" && stage.capacityWait && stage.attempt === args.attempt && stage.leaseVersion === args.leaseVersion
    && stage.capacityWait.deadline <= Date.now()) {
    await writeStage(ctx, event, stage, { state: "failed", failureCode: "CAPACITY_WAIT_EXPIRED", updatedAt: Date.now() });
    await readiness(ctx, event); return null;
  }
  if (stage.state !== "running" || stage.attempt !== args.attempt || stage.leaseVersion !== args.leaseVersion || (stage.leaseExpiresAt ?? 0) > Date.now()) return null;
  await writeStage(ctx, event, stage, { state: "unknown", failureCode: "INTERRUPTED_REQUIRES_RECONCILIATION", updatedAt: Date.now() });
  await readiness(ctx, event); return null;
} });
/** Claim is one mutation and never dispatches a model. A rolled-back claim failure is observable. */
export const failUnclaimed = internalMutation({ args: stageArgs, handler: async (ctx, args) => {
  const event = await eventById(ctx, args.reference, args.eventId); if (!event || canonicalModelJson(event.authorityReference) !== canonicalModelJson(args.reference)) return null;
  const stage = await stageRow(ctx, event, args.stage); if (stage.state !== "pending" || skipsIngestion(event.eligibility)) return null;
  const attempt = stage.capacityWait ? stage.attempt : stage.attempt + 1;
  await writeStage(ctx, event, stage, { state: attempt >= MAX_INGESTION_ATTEMPTS ? "dead_letter" : "failed", attempt,
    failureCode: "INDEXING_ADMISSION_FAILED", updatedAt: Date.now() }); await readiness(ctx, event); return null;
} });
export const retry = mutation({ args: { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()), eventId: v.string(), stage: ingestionStage }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "write"); const reference = dataAuthorityReference(actor);
  const current = await readEventCurrent(ctx, reference, args.eventId, "write"); const row = await stageRow(ctx, current.event, args.stage);
  if (row.state !== "failed" || row.attempt >= MAX_INGESTION_ATTEMPTS || canonicalModelJson(reference) !== canonicalModelJson(current.event.authorityReference)) ingestionDenied("RETRY_NOT_SAFE");
  await writeStage(ctx, current.event, row, { state: "pending", updatedAt: Date.now() }); await readiness(ctx, current.event);
  await ctx.scheduler.runAfter(0, processRef, { reference, eventId: args.eventId, stage: args.stage }); return { queued: true };
} });
/** Positive durable draft recovery performs no model or tool call. Unknown without a draft is never retried. */
export const reconcile = mutation({ args: { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()), eventId: v.string(), stage: ingestionStage }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "write"); const reference = dataAuthorityReference(actor);
  const current = await readEventCurrent(ctx, reference, args.eventId, "write"); const row = await stageRow(ctx, current.event, args.stage);
  if (row.state === "complete" || row.state === "skipped") return { reconciled: true, receiptId: row.receiptId ?? null };
  if (args.stage === "extract" || !row.payloadCanonical || !["unknown", "failed"].includes(row.state)
    || canonicalModelJson(reference) !== canonicalModelJson(current.event.authorityReference)) ingestionDenied("RECONCILIATION_NOT_SAFE");
  const lease = { reference, eventId: args.eventId, stage: args.stage, attempt: row.attempt, leaseVersion: row.leaseVersion + 1 };
  await writeStage(ctx, current.event, row, { state: "running", leaseVersion: lease.leaseVersion, leaseExpiresAt: Date.now() + INGESTION_LEASE_MS, updatedAt: Date.now() });
  try {
    const result = args.stage === "facts"
      ? await ctx.runMutation(ref<"mutation", StageLease & { planCanonical: string }, { receiptId: string }>("mutation", "runtimeBeliefs:commit"), { ...lease, planCanonical: row.payloadCanonical })
      : await ctx.runMutation(ref<"mutation", StageLease & { payloadCanonical: string }, { receiptId: string }>("mutation", "runtimeIngestion:commitVectors"), { ...lease, payloadCanonical: row.payloadCanonical });
    return { reconciled: true, receiptId: result.receiptId };
  } catch (error) {
    // A child mutation's failed read-set CAS rolls back every effect. Replan remains bounded/manual.
    if (args.stage === "facts" && error instanceof ConvexError && Object.getOwnPropertyDescriptor(error, "data")?.value?.code === "FACT_VERSION_CONFLICT") {
      await writeStage(ctx, current.event, row, { state: "failed", failureCode: "REPLAN_REQUIRED", updatedAt: Date.now() }); await readiness(ctx, current.event);
      return { reconciled: false, receiptId: null, failureCode: "REPLAN_REQUIRED" };
    }
    throw error;
  }
} });
export const status = mutation({ args: { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()), eventId: v.string() }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"); const reference = dataAuthorityReference(actor); const event = await eventById(ctx, reference, args.eventId); if (!event) ingestionDenied();
  // A superseded event remains observable by its currently authorized resource owner.
  await new ConvexMemoryRepository(ctx, reference, "read").authority({ resourceType: "source", resourceId: event.lineage.sourceId, tenantId: event.tenantId, memorySpaceId: event.memorySpaceId, ownerPrincipalId: event.ownerPrincipalId });
  return { eventId: event.eventId, sequence: event.sequence, eligibility: event.eligibility,
    stages: (await readEventStages(ctx, event)).map(s => ({ stage: s.stage, state: s.state, attempt: s.attempt, failureCode: s.failureCode ?? null, receiptId: s.receiptId ?? null })) };
} });
export const stageInput = internalQuery({ args: leaseArgs, handler: async (ctx, args) => {
  const current = await requireStageLease(ctx, args); const extract = await stageRow(ctx, current.event, "extract");
  const repository = new ConvexMemoryRepository(ctx, args.reference, "read");
  const existing = args.stage === "facts" ? await repository.listFacts({ limit: 100 }) : [];
  // No truncated read-set is represented as a complete conflict plan.
  if (existing.length === 100) ingestionDenied("BELIEF_SCOPE_TOO_BROAD");
  return { ...current, extraction: extract.payloadCanonical ?? "[]", existing };
} });
/** Store a confirmed model result before its CAS/native commit. Safe replans reuse the extracted candidates; unchanged read sets reuse paid decisions. */
export const persistDraft = internalMutation({ args: { ...leaseArgs, payloadCanonical: v.string() }, handler: async (ctx, args) => {
  const current = await requireStageCommit(ctx, args);
  if (args.stage === "extract" || new TextEncoder().encode(args.payloadCanonical).length > 1_000_000) ingestionDenied("INVALID_INPUT");
  const payload = JSON.parse(args.payloadCanonical);
  if (canonicalModelJson(payload) !== args.payloadCanonical) ingestionDenied("INVALID_INPUT");
  if (args.stage === "facts") {
    if (payload.version !== 1 || payload.eventId !== current.event.eventId || payload.sequence !== current.event.sequence
      || payload.sourceHash !== current.source.contentHash || !Array.isArray(payload.entries)) ingestionDenied("INVALID_BELIEF_PLAN");
  } else if (payload.identity?.stage !== "vectors" || payload.identity?.semanticPolicyVersion !== current.event.profile.profileId
    || payload.source?.sourceId !== current.source.lineage.sourceId || payload.source?.sourceEventId !== current.source.lineage.sourceEventId
    || payload.source?.sourceRevision !== current.source.lineage.sourceRevision) ingestionDenied("INVALID_INPUT");
  await ctx.db.patch("runtimeIngestionStages", current.stage._id, { payloadCanonical: args.payloadCanonical, updatedAt: Date.now() }); return null;
} });
export const commitVectors = internalMutation({ args: { ...leaseArgs, payloadCanonical: v.string() }, handler: async (ctx, args) => {
  const current = await requireStageCommit(ctx, args); if (args.stage !== "vectors" || new TextEncoder().encode(args.payloadCanonical).length > 1_000_000) ingestionDenied("INVALID_INPUT");
  const payload = JSON.parse(args.payloadCanonical) as import("./runtimeMemoryRepository").DerivedCommit;
  if (canonicalModelJson(payload) !== args.payloadCanonical || payload.facts?.length || payload.expectedFactVersions && Object.keys(payload.expectedFactVersions).length
    || payload.identity.stage !== "vectors" || payload.identity.semanticPolicyVersion !== current.event.profile.profileId) ingestionDenied("INVALID_INPUT");
  const job = await ctx.db.query("runtimeIngestionJobs").withIndex("by_event", q => q.eq("tenantId", current.event.tenantId).eq("memorySpaceId", current.event.memorySpaceId).eq("eventId", args.eventId)).unique();
  if (!job || payload.embeddingRunBudgetId !== job.runBudgetId) ingestionDenied("POLICY_DENIED");
  const result = await new ConvexMemoryRepository(ctx, args.reference, "write", ctx.db).commitDerived(payload);
  await ctx.db.patch("runtimeIngestionEvents", current.event._id, { vectorProfilesComplete: [...new Set([...(current.event.vectorProfilesComplete ?? []), current.event.profile.profileId])] });
  await writeStage(ctx, current.event, current.stage, { state: "complete", receiptId: result.receiptId, payloadCanonical: args.payloadCanonical, updatedAt: Date.now() });
  await readiness(ctx, current.event); return result;
} });
/** Only safe pre-dispatch failures are manually retryable. Unknown work requires positive native result reconciliation. */
function predispatch(error: unknown): boolean {
  if (!(error instanceof ConvexError)) return false;
  const data = Object.getOwnPropertyDescriptor(error, "data");
  if (!data || !("value" in data) || data.value === null || typeof data.value !== "object") return false;
  return Object.getOwnPropertyDescriptor(data.value, "outcome")?.value === "not_dispatched";
}
function controlCode(error: unknown): unknown {
  if (!(error instanceof ConvexError)) return undefined;
  const data = Object.getOwnPropertyDescriptor(error, "data")?.value;
  return data && typeof data === "object" ? Object.getOwnPropertyDescriptor(data, "code")?.value : undefined;
}
function capacityRefusal(error: unknown): UnreservedCapacityRefusal | undefined {
  if (controlCode(error) !== "BUDGET_EXCEEDED" || !predispatch(error)) return undefined;
  const data = Object.getOwnPropertyDescriptor(error, "data")?.value;
  const capacity = Object.getOwnPropertyDescriptor(data, "capacity")?.value;
  if (!capacity || typeof capacity !== "object" || Array.isArray(capacity)) return undefined;
  const read = (key: string) => Object.getOwnPropertyDescriptor(capacity, key)?.value;
  if (Object.keys(capacity).sort().join(",") !== "operationKey,ordinal,origin,reason,runBudgetId,semanticId,version"
    || read("version") !== 1 || read("origin") !== "unreserved-admission" || read("reason") !== "concurrency"
    || read("ordinal") !== 0 || typeof read("runBudgetId") !== "string" || typeof read("semanticId") !== "string"
    || !["memory.extract", "facts.resolve", "embedding.memory"].includes(read("operationKey"))) return undefined;
  return capacity as UnreservedCapacityRefusal;
}
/** Only exact semantic equality can avoid a new conflict decision; attribution
 * remains on both source events and the original belief is retained unchanged. */
export function identicalBelief(candidate: AttributedFact, existing: readonly DerivedFact[]): ConflictDecision | undefined {
  if (existing.length !== 1) return undefined;
  const shape = (fact: AttributedFact | DerivedFact, confidence: number) => ({ fact: fact.fact, factType: fact.factType,
    subject: fact.subject ?? null, predicate: fact.predicate ?? null, object: fact.object ?? null, confidence,
    tags: fact.tags ?? [], entities: fact.entities ?? [], relations: fact.relations ?? [] });
  const fact = existing[0]!;
  if (canonicalModelJson(shape(candidate, candidate.confidence * 100)) !== canonicalModelJson(shape(fact, fact.confidence))) return undefined;
  return { action: "NONE", targetFactId: fact.factId, mergedFact: null, reason: "Identical current belief" };
}
export async function processStageHandler(ctx: ActionCtx, args: { reference: RuntimeAuthorityReference; eventId: string; stage: IngestionStage },
  modelFactory: typeof createGatewayMemoryModel = createGatewayMemoryModel): Promise<null> {
  let owned: (StageLease & { runBudgetId: string; parentOperationId?: Id<"runtimeModelOperations"> }) | null;
  try { owned = await ctx.runMutation(ref<"mutation", typeof args, typeof owned>("mutation", "runtimeIngestion:claim"), args); }
  catch {
    await ctx.runMutation(ref<"mutation", typeof args, null>("mutation", "runtimeIngestion:failUnclaimed"), args); return null;
  }
  if (!owned) return null;
  const lease: StageLease = { reference: owned.reference, eventId: owned.eventId, stage: owned.stage, attempt: owned.attempt, leaseVersion: owned.leaseVersion };
  let dispatched = false;
  try {
    const input = await ctx.runQuery(ref<"query", StageLease, Awaited<ReturnType<typeof requireStageLease>> & { extraction: string; existing: DerivedFact[] }>("query", "runtimeIngestion:stageInput"), lease);
    const base = createActionMemoryRepository(ctx, args.reference, "write");
    const repository = { ...base, recheckAuthority: async () => {
      await base.recheckAuthority(); await ctx.runQuery(ref<"query", StageLease, unknown>("query", "runtimeIngestion:hydrate"), lease);
    } };
    const model = modelFactory(ctx, repository, { runBudgetId: owned.runBudgetId, ...(owned.parentOperationId ? { parentOperationId: owned.parentOperationId } : {}) });
    const operationId = `${args.eventId}:${args.stage}:${owned.attempt}`;
    if (args.stage === "extract") {
      dispatched = true;
      const facts = await extractSourceFacts(input.source, model, { operationId, policyVersion: input.event.extractionVersion, attempt: 1, source: input.source.lineage });
      await ctx.runMutation(ref<"mutation", StageLease & { payloadCanonical: string }, unknown>("mutation", "runtimeIngestion:persistStage"),
        { ...lease, payloadCanonical: canonicalModelJson(JSON.parse(JSON.stringify(facts))) });
    } else if (args.stage === "facts") {
      const candidates = JSON.parse(input.extraction) as AttributedFact[];
      const oldPlan = input.stage.payloadCanonical ? JSON.parse(input.stage.payloadCanonical) as import("../src/domain/belief-plan").BeliefPlanV1 : undefined;
      const unchanged = oldPlan && input.existing.every(fact => oldPlan.expectedVersions[fact.factId] === fact.version)
        && Object.entries(oldPlan.expectedVersions).every(([id, version]) => version === 0 || input.existing.some(fact => fact.factId === id && fact.version === version));
      const plan = unchanged ? oldPlan : await planBeliefs({ eventId: args.eventId, sequence: input.event.sequence, source: input.source, candidates, existing: input.existing,
        resolve: async (candidate, existing, ordinal) => {
          const duplicate = identicalBelief(candidate, existing); if (duplicate) return duplicate;
          await repository.recheckAuthority(); dispatched = true;
          const prompt = buildConflictResolutionPrompt(candidate, [...existing], { maxExistingFacts: 100 }, { now: () => input.source.createdAt });
          return await model.resolve({ purpose: "facts.resolve", operationId: `${operationId}:${ordinal}`, policyVersion: input.event.beliefVersion,
            attempt: 1, source: input.source.lineage, system: prompt.system, prompt: prompt.user, candidate });
        } });
      await ctx.runMutation(ref<"mutation", StageLease & { payloadCanonical: string }, null>("mutation", "runtimeIngestion:persistDraft"), { ...lease, payloadCanonical: canonicalModelJson(plan) });
      try {
        await ctx.runMutation(ref<"mutation", StageLease & { planCanonical: string }, unknown>("mutation", "runtimeBeliefs:commit"), { ...lease, planCanonical: canonicalModelJson(plan) });
      } catch (error) {
        if (controlCode(error) !== "FACT_VERSION_CONFLICT") throw error;
        // One fresh atomic no-inference replan. Changed conflict inputs require
        // explicit disposition; the stored extraction is never called again.
        await ctx.runMutation(ref<"mutation", StageLease & { planCanonical: string }, unknown>("mutation", "runtimeBeliefs:replan"), { ...lease, planCanonical: canonicalModelJson(plan) });
      }
    } else {
      if (input.stage.payloadCanonical) {
        await ctx.runMutation(ref<"mutation", StageLease & { payloadCanonical: string }, unknown>("mutation", "runtimeIngestion:commitVectors"), { ...lease, payloadCanonical: input.stage.payloadCanonical });
        return null;
      }
      const prepared = await prepareSourceContent(base.scope, input.source.lineage, input.source.content, { now: () => input.source.createdAt }, input.event.profile);
      dispatched = true;
      const embedded = await model.embed({ purpose: "embedding.memory", operationId, policyVersion: input.event.profile.profileId,
        attempt: 1, source: input.source.lineage, profile: input.event.profile, texts: prepared.chunks.map(c => c.text) });
      validateModelEmbeddings(embedded, input.event.profile, prepared.chunks.length);
      const identity = { sourceId: input.source.lineage.sourceId, sourceEventId: input.source.lineage.sourceEventId, sourceRevision: input.source.lineage.sourceRevision,
        stage: "vectors" as const, semanticPolicyVersion: input.event.profile.profileId };
      const receiptId = await processingIdentityKey(identity);
      const vectors = await Promise.all(prepared.chunks.map(async (chunk, ordinal) => ({ sourceId: chunk.sourceId, sourceEventId: chunk.sourceEventId, sourceRevision: chunk.sourceRevision,
        vectorId: await semanticHash(canonicalModelJson([args.eventId, input.event.profile, ordinal])), chunkId: chunk.chunkId,
        tenantId: input.source.tenantId, memorySpaceId: input.source.memorySpaceId, profile: input.event.profile, embedding: embedded.vectors[ordinal]!, processingReceiptId: receiptId })));
      const payload = { source: identity, identity, chunks: prepared.chunks, vectors, embeddingRunBudgetId: owned.runBudgetId };
      // Source RPC is the exact three-field source reference, not the processing identity.
      const source = { sourceId: identity.sourceId, sourceEventId: identity.sourceEventId, sourceRevision: identity.sourceRevision };
      const payloadCanonical = canonicalModelJson({ ...payload, source });
      await ctx.runMutation(ref<"mutation", StageLease & { payloadCanonical: string }, null>("mutation", "runtimeIngestion:persistDraft"), { ...lease, payloadCanonical });
      await ctx.runMutation(ref<"mutation", StageLease & { payloadCanonical: string }, unknown>("mutation", "runtimeIngestion:commitVectors"), { ...lease, payloadCanonical });
    }
  } catch (error) {
    const refusal = capacityRefusal(error);
    if (refusal) {
      try {
        await ctx.runMutation(ref<"mutation", StageLease & { refusal: UnreservedCapacityRefusal }, null>("mutation", "runtimeIngestion:waitForCapacity"), { ...lease, refusal });
        return null;
      } catch (waitError) { error = waitError; }
    }
    const safe = !dispatched || predispatch(error);
    await ctx.runMutation(ref<"mutation", StageLease & { uncertain: boolean; failureCode: string }, null>("mutation", "runtimeIngestion:failStage"),
      { ...lease, uncertain: !safe, failureCode: controlCode(error) === "REPLAN_REQUIRED" ? "REPLAN_REQUIRED"
        : controlCode(error) === "CAPACITY_WAIT_EXPIRED" ? "CAPACITY_WAIT_EXPIRED" : safe ? "INDEXING_FAILED" : "INDEXING_OUTCOME_UNKNOWN" });
  }
  return null;
}
export const processStage = internalAction({ args: stageArgs, handler: async (ctx, args) => await processStageHandler(ctx, args) });
export async function finishBeliefStage(ctx: MutationCtx, args: StageLease, receiptId: string, payloadCanonical: string) {
  const current = await requireStageLease(ctx, args); if (args.stage !== "facts") ingestionDenied("INVALID_INPUT");
  await writeStage(ctx, current.event, current.stage, { state: "complete", receiptId, payloadCanonical, updatedAt: Date.now() }); await readiness(ctx, current.event);
  await ctx.scheduler.runAfter(0, processRef, { reference: args.reference, eventId: args.eventId, stage: "vectors" });
}
/** Foreground memory work is already governed and committed. Stamp the scope cutoff without a second model writer. */
export async function registerCompletedDerivedSource(ctx: MutationCtx, reference: RuntimeAuthorityReference, receiptId: string, origin: IngestionOrigin = {}) {
  const receipt = await ctx.db.query("runtimeMemoryReceipts").withIndex("by_scope_receipt", q => q.eq("tenantId", reference.tenantId)
    .eq("memorySpaceId", reference.memorySpaceId!).eq("receiptId", receiptId)).unique();
  if (!receipt) ingestionDenied("INVALID_INPUT");
  const payload = JSON.parse(receipt.canonicalPayload) as import("./runtimeMemoryRepository").DerivedCommit;
  // A complete foreground source pipeline carries logical chunks plus one exact derived profile.
  if (!["facts", "vectors"].includes(payload.identity.stage) || !payload.vectors?.length || !payload.chunks?.length) return null;
  const profile = payload.vectors[0]!.profile; assertSupportedEmbeddingProfile(profile);
  const source = await new ConvexMemoryRepository(ctx, reference, "write").getSource(receipt.identity.sourceId);
  if (!source || source.lineage.sourceEventId !== receipt.identity.sourceEventId || source.lineage.sourceRevision !== receipt.identity.sourceRevision
    || payload.vectors.some(vector => canonicalModelJson(vector.profile) !== canonicalModelJson(profile))) ingestionDenied("STALE_SOURCE");
  const admitted = await enqueueSourceEvent(ctx, reference, source, { ...origin, eligibility: source.lineage.role === "tool" ? "awaiting_tool" : "eligible",
    ...(source.lineage.role === "tool" ? { toolOperationId: source.lineage.operationId } : {}) });
  const event = (await eventById(ctx, reference, admitted.eventId))!;
  if (skipsIngestion(event.eligibility)) ingestionDenied("STALE_SOURCE");
  if (!event.vectorProfilesComplete?.includes(profile.profileId)) {
    const canPinProfile = event.vectorsState === "pending" && !(event.vectorProfilesComplete?.length)
      && (await stageRow(ctx, event, "vectors")).state === "pending";
    await ctx.db.patch("runtimeIngestionEvents", event._id, { ...(canPinProfile ? { profile } : {}),
      vectorProfilesComplete: [...new Set([...(event.vectorProfilesComplete ?? []), profile.profileId])] });
  }
  for (const stage of await readEventStages(ctx, event)) {
    if (payload.identity.stage === "vectors" && stage.stage !== "vectors") continue;
    const state = stage.stage === "extract" || source.lineage.role === "assistant" && stage.stage === "facts" ? "skipped" as const : "complete" as const;
    if (stage.state !== state || stage.receiptId !== receiptId) await writeStage(ctx, event, stage,
      { state, receiptId, updatedAt: Date.now() });
  }
  const oldOutbox = await ctx.db.query("runtimeBeliefOutbox").withIndex("by_event", q => q.eq("tenantId", event.tenantId).eq("memorySpaceId", event.memorySpaceId).eq("eventId", event.eventId)).unique();
  if (!oldOutbox && payload.identity.stage === "facts" && source.lineage.role !== "assistant") {
    for (const [ordinal, fact] of (payload.facts ?? []).entries()) {
      const slotKey = canonicalModelJson([source.ownerPrincipalId, beliefSlot(fact)]);
      const head = await ctx.db.query("runtimeBeliefHeads").withIndex("by_slot", q => q.eq("tenantId", event.tenantId).eq("memorySpaceId", event.memorySpaceId).eq("slotKey", slotKey)).unique();
      if (head && head.sequence > event.sequence) ingestionDenied("BELIEF_ORDER_CONFLICT");
      const value = { tenantId: event.tenantId, memorySpaceId: event.memorySpaceId, slotKey, factId: fact.factId, sequence: event.sequence,
        eventId: event.eventId, version: (head?.version ?? 0) + 1, updatedAt: Date.now() };
      if (head) await ctx.db.replace("runtimeBeliefHeads", head._id, value); else await ctx.db.insert("runtimeBeliefHeads", value);
      await ctx.db.insert("runtimeBeliefHistory", { tenantId: event.tenantId, memorySpaceId: event.memorySpaceId,
        historyId: `belief-history:${await semanticHash(canonicalModelJson([event.eventId, ordinal, fact.factId]))}`,
        eventId: event.eventId, sequence: event.sequence, factId: fact.factId, action: fact.version === 1 ? "ADD" : "UPDATE",
        afterCanonical: canonicalModelJson(fact), planCanonical: receipt.canonicalPayload, actorReference: reference, createdAt: Date.now() });
    }
    await ctx.db.insert("runtimeBeliefOutbox", { tenantId: event.tenantId, memorySpaceId: event.memorySpaceId, eventId: event.eventId,
      receiptId, sequence: event.sequence, factIds: (payload.facts ?? []).map(fact => fact.factId), state: "pending", createdAt: Date.now() });
  }
  await readiness(ctx, event); return admitted;
}
/** Atomic foreground receipt import, kept out of auth/memory module initialization. */
export const registerCompletedDerived = internalMutation({ args: { reference: runtimeAuthorityReference, receiptId: v.string() },
  handler: async (ctx, args) => { await registerCompletedDerivedSource(ctx, args.reference, args.receiptId); return null; } });
/** A completed foreground memory tool already has one canonical source+facts/vector receipt.
 * Import that positive durable receipt; do not run a duplicate extraction/embedding loop. */
export async function registerCompletedToolSource(ctx: MutationCtx, reference: RuntimeAuthorityReference, operationId: string) {
  const operation = await ctx.db.query("runtimeAgentOperations").withIndex("by_operation", q => q.eq("tenantId", reference.tenantId).eq("memorySpaceId", reference.memorySpaceId!).eq("operationId", operationId)).unique();
  if (!operation || operation.state !== "complete" || operation.toolName !== "memory_remember" || !operation.resultCanonical) ingestionDenied("TOOL_NOT_COMPLETE");
  const result = JSON.parse(operation.resultCanonical) as { sourceId?: unknown; receiptId?: unknown };
  if (typeof result.sourceId !== "string" || typeof result.receiptId !== "string") ingestionDenied("INVALID_INPUT");
  const source = await new ConvexMemoryRepository(ctx, reference, "write").getSource(result.sourceId); if (!source || source.lineage.role !== "tool" || source.lineage.operationId !== operationId) ingestionDenied("STALE_SOURCE");
  const receipt = await ctx.db.query("runtimeMemoryReceipts").withIndex("by_scope_receipt", q => q.eq("tenantId", reference.tenantId).eq("memorySpaceId", reference.memorySpaceId!).eq("receiptId", result.receiptId as string)).unique();
  if (!receipt || receipt.identity.sourceId !== source.lineage.sourceId || receipt.identity.sourceEventId !== source.lineage.sourceEventId
    || receipt.identity.sourceRevision !== source.lineage.sourceRevision) ingestionDenied("INVALID_INPUT");
  const run = await ctx.db.query("runtimeRuns").withIndex("by_scoped_id", q => q.eq("tenantId", reference.tenantId)
    .eq("memorySpaceId", reference.memorySpaceId!).eq("runId", operation.runId)).unique();
  const admitted = await registerCompletedDerivedSource(ctx, reference, receipt.receiptId, { toolOperationId: operationId, runId: operation.runId,
    ...(run ? { conversationId: run.conversationId, conversationSequence: run.queueSequence, conversationEpoch: run.conversationEpoch } : {}) });
  if (!admitted) ingestionDenied("INVALID_INPUT");
  const event = (await eventById(ctx, reference, admitted.eventId))!;
  if (event.eligibility === "eligible") return;
  if (event.eligibility !== "awaiting_tool") ingestionDenied("INVALID_STATE");
  const payload = JSON.parse(receipt.canonicalPayload) as import("./runtimeMemoryRepository").DerivedCommit;
  if (!payload.vectors?.length || payload.vectors.some(vector => !event.vectorProfilesComplete?.includes(vector.profile.profileId)) || payload.identity.stage !== "facts") ingestionDenied("INVALID_INPUT");
  await ctx.db.patch("runtimeIngestionEvents", event._id, { eligibility: "eligible", updatedAt: Date.now() });
  for (const stage of await readEventStages(ctx, event)) await writeStage(ctx, event, stage,
    { state: stage.stage === "extract" ? "skipped" : "complete", receiptId: receipt.receiptId, payloadCanonical: receipt.canonicalPayload, updatedAt: Date.now() });
  await readiness(ctx, { ...event, eligibility: "eligible" });
}
