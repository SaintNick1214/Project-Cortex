/** Scheduling metadata only. Original ingestion claim/authority/budget guards decide all work. */
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { readCurrentExecutableDefinition } from "./agentDefinitions";
import type { IngestionStage } from "../src/domain/ingestion";
import { canonicalModelJson } from "../src/domain/model-policy";

export const FOREGROUND_INGESTION_MAX_DELAY_MS = 5000;
export const FOREGROUND_INGESTION_MAX_HELD_RUNS = 256;
type Scope = { tenantId: string; memorySpaceId: string };
type Priority = Doc<"runtimeIngestionForegroundPriority">;
type CurrentDefinition = Awaited<ReturnType<typeof readCurrentExecutableDefinition>>;
export type ForegroundIngestionScope = Scope;
export type ForegroundIngestionDefinition = CurrentDefinition;
function deny(): never { throw new ConvexError({ version: 1, code: "INGESTION_CONFLICT", message: "Memory scheduling control denied.", retryable: false, outcome: "not_dispatched" }); }
function single<T>(rows: T[]): T | undefined { if (rows.length > 1) deny(); return rows[0]; }
function internalRef<T extends "action" | "mutation", Args extends Record<string, unknown>>(kind: T, name: string) {
  return makeFunctionReference<T, Args, null>(name) as unknown as FunctionReference<T, "internal", Args, null>;
}
async function marker(ctx: Pick<MutationCtx, "db">, scope: Scope, runId: string) {
  return single(await ctx.db.query("runtimeIngestionForegroundPriority").withIndex("by_run", q => q.eq("tenantId", scope.tenantId)
    .eq("memorySpaceId", scope.memorySpaceId).eq("runId", runId)).take(2));
}
function validPriority(row: Priority) {
  if (!Number.isSafeInteger(row.captureAt) || !Number.isSafeInteger(row.deadline)
    || row.deadline !== row.captureAt + FOREGROUND_INGESTION_MAX_DELAY_MS || row.nativeMessageIds.length !== 1) deny();
}
async function associatedEvents(ctx: Pick<MutationCtx, "db">, row: Priority, through?: number) {
  validPriority(row);
  const events = await ctx.db.query("runtimeIngestionEvents").withIndex("by_run_message_eligibility", q => {
    const match = q.eq("tenantId", row.tenantId).eq("memorySpaceId", row.memorySpaceId).eq("runId", row.runId)
      .eq("nativeMessageId", row.nativeMessageIds[0]).eq("eligibility", "eligible");
    return through === undefined ? match : match.lte("sequence", through);
  }).take(2);
  if (events.length > 1) deny();
  return events.filter(event => event.ownerPrincipalId === row.ownerPrincipalId && event.conversationId === row.conversationId
    && event.conversationEpoch === row.conversationEpoch && event.lineage.role === "user" && event.toolOperationId === undefined);
}
async function release(ctx: MutationCtx, row: Priority) {
  validPriority(row); if (row.state !== "held") return false;
  await ctx.db.patch("runtimeIngestionForegroundPriority", row._id, { state: "released", releasedAt: Date.now() });
  for (const event of await associatedEvents(ctx, row)) {
    const stages = await ctx.db.query("runtimeIngestionStages").withIndex("by_event_stage", q => q.eq("tenantId", row.tenantId)
      .eq("memorySpaceId", row.memorySpaceId).eq("eventId", event.eventId)).take(4);
    if (stages.length > 3) deny();
    for (const stage of stages) if (stage.state === "pending" && stage.attempt === 0) {
      await ctx.scheduler.runAfter(0, internalRef<"action", { reference: typeof event.authorityReference; eventId: string; stage: IngestionStage }>("action", "runtimeIngestion:processStage"),
        { reference: event.authorityReference, eventId: event.eventId, stage: stage.stage });
    }
  }
  return true;
}
/** Private parent hook: both arguments are ORIGINAL currentRun server results, never public input. */
export async function holdForegroundIngestion(ctx: MutationCtx, run: Doc<"runtimeRuns">, definition?: CurrentDefinition) {
  const current = await ctx.db.get("runtimeRuns", run._id);
  if (!current || !definition || current.runId !== run.runId || current.tenantId !== run.tenantId || current.memorySpaceId !== run.memorySpaceId
    || current.definitionHash !== definition.definitionHash || current.agentId !== definition.agent.agentId || current.agentVersion !== definition.agent.version
    || current.modelInputVersion !== 8 || current.tombstonedAt !== undefined || current.cancellationRequestedAt !== undefined
    || !["queued", "running"].includes(current.responseStatus) || current.inputMessageIds.length !== 1
    || definition.definition.context.handlerId !== "cortex.transcript.relevant" || definition.definition.context.memoryMode !== "indexed-plus-pending"
    || definition.definition.context.requiredStages.length !== 0) return { held: false as const };
  const scope = { tenantId: current.tenantId, memorySpaceId: current.memorySpaceId };
  const old = await marker(ctx, scope, current.runId);
  if (old) { validPriority(old); if (old.runDocId !== current._id || old.captureAt !== current.createdAt) deny(); return { held: old.state === "held", deadline: old.deadline }; }
  const deadline = current.createdAt + FOREGROUND_INGESTION_MAX_DELAY_MS;
  if (!Number.isSafeInteger(current.createdAt) || !Number.isSafeInteger(deadline) || Date.now() >= deadline) return { held: false as const };
  const active = await ctx.db.query("runtimeIngestionForegroundPriority").withIndex("by_scope_state", q => q.eq("tenantId", current.tenantId)
    .eq("memorySpaceId", current.memorySpaceId).eq("state", "held")).take(FOREGROUND_INGESTION_MAX_HELD_RUNS + 1);
  if (active.length >= FOREGROUND_INGESTION_MAX_HELD_RUNS) return { held: false as const };
  await ctx.db.insert("runtimeIngestionForegroundPriority", { ...scope, runId: current.runId, runDocId: current._id,
    ownerPrincipalId: current.ownerPrincipalId, conversationId: current.conversationId, conversationEpoch: current.conversationEpoch,
    nativeMessageIds: [...current.inputMessageIds], captureAt: current.createdAt, deadline, state: "held" });
  await ctx.scheduler.runAfter(deadline - Date.now(), internalRef<"mutation", Scope & { runId: string; deadline: number }>("mutation", "runtimeIngestionPriority:expireForeground"),
    { ...scope, runId: current.runId, deadline });
  return { held: true as const, deadline };
}
/** Release is scheduling-only, including after revoke/cancel. Original claims still deny stale authority. */
export async function releaseForegroundIngestion(ctx: MutationCtx, scope: Scope, runId: string) {
  const row = await marker(ctx, scope, runId); return row ? await release(ctx, row) : false;
}
/** Called before ORIGINAL strict barriers. No source/result is returned, admitted or marked indexed. */
export async function promoteForegroundIngestion(ctx: MutationCtx, scope: Scope, through: number) {
  if (!Number.isSafeInteger(through) || through < 0) deny();
  const rows = await ctx.db.query("runtimeIngestionForegroundPriority").withIndex("by_scope_state", q => q.eq("tenantId", scope.tenantId)
    .eq("memorySpaceId", scope.memorySpaceId).eq("state", "held")).take(FOREGROUND_INGESTION_MAX_HELD_RUNS + 1);
  if (rows.length > FOREGROUND_INGESTION_MAX_HELD_RUNS) deny();
  let released = 0;
  for (const row of rows) if ((await associatedEvents(ctx, row, through)).length && await release(ctx, row)) released++;
  return { released };
}
/** Only pending attempt0 stages, BEFORE original job binding/lease/reservation. */
export async function deferForegroundStage(ctx: MutationCtx, event: Doc<"runtimeIngestionEvents">, stage: Doc<"runtimeIngestionStages">) {
  if (!event.runId || !event.nativeMessageId || event.eligibility !== "eligible" || event.lineage.role !== "user" || event.toolOperationId
    || stage.state !== "pending" || stage.attempt !== 0 || stage.policyCanonical !== undefined || stage.payloadCanonical !== undefined
    || stage.receiptId !== undefined || stage.leaseExpiresAt !== undefined || stage.capacityWait !== undefined) return false;
  const row = await marker(ctx, event, event.runId); if (!row || row.state !== "held") return false;
  validPriority(row);
  if (Date.now() >= Math.min(row.deadline, event.createdAt + FOREGROUND_INGESTION_MAX_DELAY_MS)) return false;
  const run = await ctx.db.get("runtimeRuns", row.runDocId);
  if (!run || run.modelInputVersion !== 8 || run.runId !== row.runId || run.createdAt !== row.captureAt || run.tombstonedAt !== undefined
    || run.tenantId !== event.tenantId || run.memorySpaceId !== event.memorySpaceId
    || run.cancellationRequestedAt !== undefined || !["queued", "running"].includes(run.responseStatus)
    || run.ownerPrincipalId !== event.ownerPrincipalId || row.ownerPrincipalId !== event.ownerPrincipalId
    || run.conversationId !== event.conversationId || run.conversationEpoch !== event.conversationEpoch
    || row.conversationId !== event.conversationId || row.conversationEpoch !== event.conversationEpoch
    || canonicalModelJson(run.authorityReference) !== canonicalModelJson(event.authorityReference)
    || !row.nativeMessageIds.includes(event.nativeMessageId) || !run.inputMessageIds.includes(event.nativeMessageId)) return false;
  const job = await ctx.db.query("runtimeIngestionJobs").withIndex("by_event", q => q.eq("tenantId", event.tenantId)
    .eq("memorySpaceId", event.memorySpaceId).eq("eventId", event.eventId)).unique();
  return !job;
}
export const expireForeground = internalMutation({ args: { tenantId: v.string(), memorySpaceId: v.string(), runId: v.string(), deadline: v.number() },
  handler: async (ctx, args) => {
    const row = await marker(ctx, args, args.runId);
    if (row && row.deadline === args.deadline && Date.now() >= row.deadline) await release(ctx, row);
    return null;
  } });
