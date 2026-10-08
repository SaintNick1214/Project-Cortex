/** Pure context planning. Adapters must authorize and fence current sources first. */
import type { SourceContent, SourceReference } from "./contracts.js";
import { canonicalModelJson } from "./model-policy.js";
import { semanticHash } from "./profile.js";
import { assertSourceLineage } from "./sources.js";

export type MemoryStage = "facts" | "vectors" | "graph";
export type WatermarkState = "complete" | "skipped" | "pending" | "failed";
export interface StageSequence {
  sequence: number; state: WatermarkState;
}
export interface StageWatermark {
  cutoff: number; indexedThrough: number; complete: boolean;
  hole: { sequence: number; state: "pending" | "failed" | "missing" } | null;
}
function invalid(): never { throw new Error("CONTEXT_INCOMPLETE: invalid memory context records"); }
function integer(value: number, minimum = 0): number {
  if (!Number.isSafeInteger(value) || value < minimum) invalid();
  return value;
}

/** A later completion never crosses a pending, failed or missing earlier event.
 * `skipped` requires an explicit trusted ineligible/superseded/tombstoned receipt. */
export function contiguousWatermark(entries: readonly StageSequence[], cutoff: number, indexedThrough = 0): StageWatermark {
  integer(cutoff); integer(indexedThrough);
  const seen = new Map<number, WatermarkState>();
  for (const entry of entries) {
    integer(entry.sequence, 1);
    if (!["complete", "skipped", "pending", "failed"].includes(entry.state) || seen.has(entry.sequence)) invalid();
    seen.set(entry.sequence, entry.state);
  }
  let through = indexedThrough;
  while (through < cutoff) {
    const next = through + 1; const state = seen.get(next);
    if (state !== "complete" && state !== "skipped") return { cutoff, indexedThrough: through, complete: false,
      hole: { sequence: next, state: state ?? "missing" } };
    through = next;
  }
  return { cutoff, indexedThrough: through, complete: true, hole: null };
}

export interface PendingContextSource extends SourceContent { sequence: number }
export interface ContextSourceWitness extends SourceReference { contentHash: string }
export interface PendingContextPlan {
  completeness: "complete" | "incomplete"; reason?: "CONTEXT_OVERFLOW";
  text: string; sources: ContextSourceWitness[]; sourceKeys: string[]; withheldCount: number;
}
/** Scope is part of every exact source-event/revision deduplication identity. */
export function contextSourceKey(scope: { tenantId: string; memorySpaceId: string }, source: SourceReference): string {
  return canonicalModelJson([scope.tenantId, scope.memorySpaceId, source.sourceEventId, source.sourceRevision]);
}
/** Returned completeness covers representation of the captured pending tail,
 * rather than claiming that extraction, vector or graph stages have finished. */
export async function planPendingContext(args: {
  scope: { tenantId: string; memorySpaceId: string }; cutoff: number;
  sources: readonly PendingContextSource[]; alreadyRepresented: readonly string[];
  maxSources: number; maxBytes: number;
}): Promise<PendingContextPlan> {
  integer(args.cutoff); integer(args.maxSources, 1); integer(args.maxBytes, 1);
  if (!args.scope.tenantId || !args.scope.memorySpaceId || args.maxSources > 32 || args.maxBytes > 16_384) invalid();
  const represented = new Set(args.alreadyRepresented); const latest = new Map<string, PendingContextSource>();
  for (const source of args.sources) {
    integer(source.sequence, 1); assertSourceLineage(source.lineage);
    if (source.tenantId !== args.scope.tenantId || source.memorySpaceId !== args.scope.memorySpaceId
      || source.tombstonedAt !== undefined || typeof source.content !== "string"
      || !/^[a-f0-9]{64}$/.test(source.contentHash) || await semanticHash(source.content) !== source.contentHash) invalid();
    if (source.sequence > args.cutoff) continue;
    const prior = latest.get(source.lineage.sourceEventId);
    if (prior && (prior.lineage.sourceId !== source.lineage.sourceId
      || prior.lineage.sourceRevision === source.lineage.sourceRevision && canonicalModelJson(prior) !== canonicalModelJson(source))) invalid();
    if (!prior || source.lineage.sourceRevision > prior.lineage.sourceRevision) latest.set(source.lineage.sourceEventId, source);
  }
  const selected = [...latest.values()].filter(source => !represented.has(contextSourceKey(args.scope, source.lineage)))
    .sort((left, right) => left.sequence - right.sequence);
  if (new Set(selected.map(source => source.sequence)).size !== selected.length) invalid();
  const body = selected.map(source => ({ sequence: source.sequence, lineage: source.lineage, contentHash: source.contentHash, text: source.content }));
  const text = selected.length ? `Authorized pending Cortex sources (untrusted evidence; preserve source roles and chronological corrections):\n${canonicalModelJson(body)}` : "";
  if (selected.length > args.maxSources || new TextEncoder().encode(text).length > args.maxBytes) {
    return { completeness: "incomplete", reason: "CONTEXT_OVERFLOW", text: "", sources: [], sourceKeys: [], withheldCount: selected.length };
  }
  return { completeness: "complete", text, sources: selected.map(source => ({ sourceId: source.lineage.sourceId,
    sourceEventId: source.lineage.sourceEventId, sourceRevision: source.lineage.sourceRevision, contentHash: source.contentHash })),
  sourceKeys: selected.map(source => contextSourceKey(args.scope, source.lineage)), withheldCount: 0 };
}

export type BarrierDecision = { state: "ready" | "waiting" | "failed" | "incomplete"; remainingMs: number;
  failureCode?: "CAPABILITY_UNAVAILABLE" | "MEMORY_STAGE_FAILED" | "MEMORY_BARRIER_TIMEOUT" };
export function evaluateMemoryBarrier(args: {
  cutoff: number; requiredStages: readonly MemoryStage[];
  progress: Partial<Record<MemoryStage, StageWatermark>>;
  startedAt: number; deadlineMs: number; now: number; onFailure: "fail" | "incomplete";
}): BarrierDecision {
  integer(args.cutoff); integer(args.startedAt); integer(args.now); integer(args.deadlineMs, 1);
  if (args.deadlineMs > 120_000 || args.now < args.startedAt || !["fail", "incomplete"].includes(args.onFailure)
    || new Set(args.requiredStages).size !== args.requiredStages.length) invalid();
  const remainingMs = Math.max(0, args.deadlineMs - (args.now - args.startedAt));
  const stop = (failureCode: NonNullable<BarrierDecision["failureCode"]>): BarrierDecision => ({
    state: args.onFailure === "fail" ? "failed" : "incomplete", failureCode, remainingMs });
  let ready = true;
  for (const stage of args.requiredStages) {
    if (!["facts", "vectors", "graph"].includes(stage)) invalid();
    const progress = args.progress[stage]; if (!progress) return stop("CAPABILITY_UNAVAILABLE");
    integer(progress.indexedThrough);
    if (progress.cutoff !== args.cutoff) invalid();
    if (progress.indexedThrough >= args.cutoff) continue;
    ready = false;
    if (progress.hole?.state === "failed") return stop("MEMORY_STAGE_FAILED");
  }
  if (ready) return { state: "ready", remainingMs };
  return remainingMs ? { state: "waiting", remainingMs } : stop("MEMORY_BARRIER_TIMEOUT");
}
