/** Contiguous stage progress and bounded, authorized pending context. */
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import { contiguousWatermark, contextSourceKey, planPendingContext } from "../src/domain/memory-context";
import type { MemoryStage, StageWatermark, WatermarkState } from "../src/domain/memory-context";
import type { PendingContextSource } from "../src/domain/memory-context";
import { DEFAULT_EMBEDDING_PROFILE, SUPPORTED_EMBEDDING_PROFILES } from "../src/domain/profile";
import { readCurrentEmbeddingProfile } from "./runtimeModelPolicy";
import { skipsIngestion } from "../src/domain/ingestion";
import { internalMutation, internalQuery, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { ConvexMemoryRepository, isMemoryResourceDenied } from "./runtimeMemoryRepository";
import { dataAuthorityReference, requireDataAuthority, managedConversationAccess } from "./runtimeDataAuth";
import { ingestionDenied, readEventCurrent, readScopeCutoff } from "./runtimeIngestion";

type ReadCtx = Pick<QueryCtx, "db" | "runQuery">;
type Event = Doc<"runtimeIngestionEvents">;
export interface ContextBoundary { conversationId: string; runId: string; queueSequence: number; anchor: { order: number; stepOrder: number } }
const contextBoundary = v.object({ conversationId: v.string(), runId: v.string(), queueSequence: v.number(),
  anchor: v.object({ order: v.number(), stepOrder: v.number() }) });
const refreshRef = makeFunctionReference<"mutation", { reference: RuntimeAuthorityReference }>("runtimeMemoryContext:refreshWatermarks");
function boundedCutoff(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) ingestionDenied("INVALID_INPUT");
}
function state(event: Event, stage: "facts" | "vectors", profileId = DEFAULT_EMBEDDING_PROFILE.profileId): WatermarkState {
  if (skipsIngestion(event.eligibility)) return "skipped";
  if (event.eligibility !== "eligible") return "pending";
  const summary = stage === "facts" ? event.factsState : event.vectorsState;
  if (stage === "vectors" && summary === "complete" && !(event.vectorProfilesComplete ?? [event.profile.profileId]).includes(profileId)) return "pending";
  if (summary === "complete" || summary === "skipped") return summary;
  return ["failed", "unknown", "dead_letter"].includes(summary) ? "failed" : "pending";
}
async function withinConversationBoundary(ctx: ReadCtx, event: Event, boundary?: ContextBoundary): Promise<boolean> {
  if (!boundary || event.conversationId !== boundary.conversationId) return true;
  if (event.runId) {
    const run = await ctx.db.query("runtimeRuns").withIndex("by_scoped_id", q => q.eq("tenantId", event.tenantId)
      .eq("memorySpaceId", event.memorySpaceId).eq("runId", event.runId!)).unique();
    if (!run || run.queueSequence > boundary.queueSequence || run.tombstonedAt !== undefined
      || run.runId !== boundary.runId && run.responseStatus !== "complete") return false;
  }
  if (event.nativeMessageId) {
    const message = await ctx.db.query("runtimeTranscriptMessages").withIndex("by_native", q => q.eq("tenantId", event.tenantId)
      .eq("memorySpaceId", event.memorySpaceId).eq("nativeMessageId", event.nativeMessageId!)).unique();
    if (!message || !message.approved || message.tombstonedAt !== undefined || message.order > boundary.anchor.order
      || message.order === boundary.anchor.order && message.stepOrder > boundary.anchor.stepOrder) return false;
  } else if (!event.runId) return false;
  return true;
}
async function progress(ctx: ReadCtx, reference: RuntimeAuthorityReference, stage: "facts" | "vectors", cutoff: number, through: number, profileId = DEFAULT_EMBEDDING_PROFILE.profileId) {
  if (through >= cutoff) return contiguousWatermark([], cutoff, through);
  // Each stage has its own cursor. A facts hole must not strand vector progress.
  const events = await ctx.db.query("runtimeIngestionEvents").withIndex("by_scope_sequence", q => q.eq("tenantId", reference.tenantId)
    .eq("memorySpaceId", reference.memorySpaceId!).gt("sequence", through).lte("sequence", cutoff)).take(256);
  return contiguousWatermark(events.map(event => ({ sequence: event.sequence, state: state(event, stage, profileId) })), cutoff, through);
}
export async function readStageProgress(ctx: ReadCtx, reference: RuntimeAuthorityReference, cutoff: number, runBudgetId?: string): Promise<Partial<Record<MemoryStage, StageWatermark>>> {
  boundedCutoff(cutoff); const scope = await readScopeCutoff(ctx, reference);
  if (cutoff > scope.sequence) ingestionDenied("INVALID_INPUT");
  const profile = await readCurrentEmbeddingProfile(ctx, reference, "embedding.query", runBudgetId);
  return { facts: await progress(ctx, reference, "facts", cutoff, scope.factsThrough),
    vectors: await progress(ctx, reference, "vectors", cutoff, scope.vectorProfileThrough[profile.profileId] ?? (profile.profileId === DEFAULT_EMBEDDING_PROFILE.profileId ? scope.vectorsThrough : 0), profile.profileId) };
  // Graph is added by its qualified projection service. It is unavailable here.
}
export async function refreshScopeWatermarks(ctx: MutationCtx, reference: RuntimeAuthorityReference) {
  await new ConvexMemoryRepository(ctx, reference, "write").recheckAuthority();
  const scope = await ctx.db.query("runtimeIngestionScopes").withIndex("by_scope", q => q.eq("tenantId", reference.tenantId)
    .eq("memorySpaceId", reference.memorySpaceId!)).unique();
  if (!scope) return null;
  const facts = await progress(ctx, reference, "facts", scope.sequence, scope.factsThrough);
  const profiles = await Promise.all(SUPPORTED_EMBEDDING_PROFILES.map(async profile => ({ profile, result: await progress(ctx, reference, "vectors", scope.sequence,
    scope.vectorProfileThrough?.[profile.profileId] ?? (profile.profileId === DEFAULT_EMBEDDING_PROFILE.profileId ? scope.vectorsThrough : 0), profile.profileId) })));
  const vectorProfileThrough = Object.fromEntries(profiles.map(value => [value.profile.profileId, value.result.indexedThrough]));
  const vectors = profiles.find(value => value.profile.profileId === DEFAULT_EMBEDDING_PROFILE.profileId)!.result;
  if (facts.indexedThrough !== scope.factsThrough || JSON.stringify(vectorProfileThrough) !== JSON.stringify(scope.vectorProfileThrough)) {
    await ctx.db.patch("runtimeIngestionScopes", scope._id, { factsThrough: facts.indexedThrough,
      vectorsThrough: vectors.indexedThrough, vectorProfileThrough, version: scope.version + 1, updatedAt: Date.now() });
  }
  // Continue only after making bounded progress through a full metadata page.
  if (facts.hole?.state === "missing" && facts.indexedThrough > scope.factsThrough
    || profiles.some(({ profile, result }) => result.hole?.state === "missing"
      && result.indexedThrough > (scope.vectorProfileThrough?.[profile.profileId]
        ?? (profile.profileId === DEFAULT_EMBEDDING_PROFILE.profileId ? scope.vectorsThrough : 0)))) {
    await ctx.scheduler.runAfter(0, refreshRef, { reference });
  }
  return { sequence: scope.sequence, factsThrough: facts.indexedThrough, vectorsThrough: vectors.indexedThrough };
}
export const refreshWatermarks = internalMutation({ args: { reference: runtimeAuthorityReference },
  handler: async (ctx, args) => await refreshScopeWatermarks(ctx, args.reference) });
export const stageProgress = internalQuery({ args: { reference: runtimeAuthorityReference, cutoff: v.number(), runBudgetId: v.optional(v.string()) },
  handler: async (ctx, args) => await readStageProgress(ctx, args.reference, args.cutoff, args.runBudgetId) });
export const indexedSourceAtCutoff = internalQuery({ args: { reference: runtimeAuthorityReference, sourceId: v.string(), sourceRevision: v.number(), cutoff: v.number(), boundary: v.optional(contextBoundary) },
  handler: async (ctx, args) => {
    boundedCutoff(args.cutoff); const repository = new ConvexMemoryRepository(ctx, args.reference, "read");
    const source = await repository.getSource(args.sourceId);
    if (!source || source.lineage.sourceRevision !== args.sourceRevision) ingestionDenied("STALE_SOURCE");
    const event = await ctx.db.query("runtimeIngestionEvents").withIndex("by_source", q => q.eq("tenantId", args.reference.tenantId)
      .eq("memorySpaceId", args.reference.memorySpaceId!).eq("lineage.sourceId", args.sourceId).eq("lineage.sourceRevision", args.sourceRevision)).unique();
    return Boolean(event && event.eligibility === "eligible" && event.sequence <= args.cutoff
      && event.contentHash === source.contentHash && event.lineage.sourceEventId === source.lineage.sourceEventId && await withinConversationBoundary(ctx, event, args.boundary));
  } });

export async function readPendingContext(ctx: ReadCtx, args: { reference: RuntimeAuthorityReference; cutoff: number;
  alreadyRepresented: string[]; maxBytes: number; runBudgetId?: string; boundary?: ContextBoundary }) {
  boundedCutoff(args.cutoff);
  if (args.alreadyRepresented.length > 1000 || !Number.isSafeInteger(args.maxBytes) || args.maxBytes < 1 || args.maxBytes > 16_384) ingestionDenied("INVALID_INPUT");
  const repository = new ConvexMemoryRepository(ctx, args.reference, "read"); const authority = await repository.authority();
  const scope = await readScopeCutoff(ctx, args.reference); if (args.cutoff > scope.sequence) ingestionDenied("INVALID_INPUT");
  const profile = await readCurrentEmbeddingProfile(ctx, args.reference, "embedding.query", args.runBudgetId);
  const after = Math.min(scope.factsThrough, scope.vectorProfileThrough[profile.profileId] ?? (profile.profileId === DEFAULT_EMBEDDING_PROFILE.profileId ? scope.vectorsThrough : 0), args.cutoff);
  const represented = new Set(args.alreadyRepresented);
  const sources: PendingContextSource[] = []; let cursor = after; let scanned = 0; let exhausted = false;
  // Bound all metadata reads, including completed events behind an older hole.
  // History entries are deduplicated before counting the 32-source tail budget.
  while (scanned < 2048 && sources.length <= 32) {
    const selected = authority.resourceAccess === "own"
      ? ctx.db.query("runtimeIngestionEvents").withIndex("by_owner_sequence", q => q.eq("tenantId", authority.tenantId)
        .eq("memorySpaceId", args.reference.memorySpaceId!).eq("ownerPrincipalId", authority.principalId).gt("sequence", cursor).lte("sequence", args.cutoff))
      : ctx.db.query("runtimeIngestionEvents").withIndex("by_scope_sequence", q => q.eq("tenantId", authority.tenantId)
        .eq("memorySpaceId", args.reference.memorySpaceId!).gt("sequence", cursor).lte("sequence", args.cutoff));
    const events = await selected.take(128); scanned += events.length;
    for (const event of events) {
      if (event.eligibility === "eligible" && (state(event, "facts") !== "complete" && state(event, "facts") !== "skipped"
        || state(event, "vectors", profile.profileId) !== "complete" && state(event, "vectors", profile.profileId) !== "skipped")
        && !represented.has(contextSourceKey(scope, event.lineage)) && await withinConversationBoundary(ctx, event, args.boundary)) {
        try {
          // Authorize private conversation metadata before loading its potentially large content.
          if (event.conversationId) {
            const conversation = await ctx.db.query("runtimeConversations").withIndex("by_scoped_id", q => q.eq("tenantId", event.tenantId)
              .eq("memorySpaceId", event.memorySpaceId).eq("conversationId", event.conversationId!)).unique();
            if (!conversation) continue;
            await managedConversationAccess(ctx, args.reference, conversation, "read", "canViewMemories");
          }
          const current = await readEventCurrent(ctx, args.reference, event.eventId);
          sources.push({ ...current.source, sequence: event.sequence });
        } catch (error) {
          if (!isMemoryResourceDenied(error)) throw error;
          await repository.authority();
        }
      }
      if (sources.length > 32) break;
    }
    if (events.length < 128 || events[events.length - 1]!.sequence >= args.cutoff) { exhausted = true; break; }
    cursor = events[events.length - 1]!.sequence;
  }
  if (!exhausted || sources.length > 32) return { completeness: "incomplete" as const, reason: "CONTEXT_OVERFLOW" as const,
    text: "", sources: [], sourceKeys: [], withheldCount: sources.length };
  return await planPendingContext({ scope, cutoff: args.cutoff, sources, alreadyRepresented: args.alreadyRepresented,
    maxSources: 32, maxBytes: args.maxBytes });
}
export const pendingContext = internalQuery({ args: { reference: runtimeAuthorityReference, cutoff: v.number(),
  alreadyRepresented: v.array(v.string()), maxBytes: v.number(), runBudgetId: v.optional(v.string()), boundary: v.optional(contextBoundary) }, handler: async (ctx, args) => await readPendingContext(ctx, args) });
export const status = query({ args: { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"); const reference = dataAuthorityReference(actor);
  if (actor.resourceAccess === "own") ingestionDenied("FORBIDDEN");
  const scope = await readScopeCutoff(ctx, reference); const stages = await readStageProgress(ctx, reference, scope.sequence);
  return { version: 1, cutoff: scope.sequence, stages, graph: { state: "unavailable", failureCode: "CAPABILITY_UNAVAILABLE" } };
} });
