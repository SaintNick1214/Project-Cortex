/** Atomic writers shared by custody and the actual ingestion state machine. No public callbacks. */
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { RuntimeChangeEvent, RuntimeChangeType } from "../src/client-runtime/external";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import { dataDenied } from "./runtimeDataAuth";

type Scope = { tenantId: string; memorySpaceId: string };
type ReadCtx = Pick<QueryCtx, "db">;
export async function changeHead(ctx: ReadCtx, scope: Scope, streamOwner: string) {
  return ctx.db.query("runtimeChangeHeads").withIndex("by_stream", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("streamOwner", streamOwner)).unique();
}
/** Private randomness prevents checkpoint-existence probing from public sequence guesses. */
export async function ensureChangeHead(ctx: MutationCtx, scope: Scope, streamOwner: string) {
  const row = await changeHead(ctx, scope, streamOwner); if (row) return row;
  const id = await ctx.db.insert("runtimeChangeHeads", { tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, streamOwner, sequence: 0, erasureEpoch: 0, nonce: crypto.randomUUID() });
  return (await ctx.db.get("runtimeChangeHeads", id))!;
}
async function nextSequence(ctx: MutationCtx, scope: Scope, streamOwner: string) {
  const old = await ensureChangeHead(ctx, scope, streamOwner), sequence = old.sequence + 1;
  if (!Number.isSafeInteger(sequence)) dataDenied("SEQUENCE_EXHAUSTED");
  await ctx.db.patch("runtimeChangeHeads", old._id, { sequence });
  return sequence;
}
export async function invalidateChangeStreams(ctx: MutationCtx, scope: Scope, ownerPrincipalId: string) {
  for (const streamOwner of ["", ownerPrincipalId]) {
    const old = await ensureChangeHead(ctx, scope, streamOwner), erasureEpoch = old.erasureEpoch + 1;
    if (!Number.isSafeInteger(erasureEpoch)) dataDenied("SEQUENCE_EXHAUSTED");
    await ctx.db.patch("runtimeChangeHeads", old._id, { erasureEpoch });
  }
}
export async function appendExternalChange(ctx: MutationCtx, identity: readonly unknown[], event: Omit<RuntimeChangeEvent, "version" | "eventId">) {
  const identityCanonical = canonicalModelJson(["external-change-v1", ...identity]);
  const eventId = `external-change:${await semanticHash(identityCanonical)}`;
  const prior = await ctx.db.query("runtimeChangeEvents").withIndex("by_event", q => q.eq("tenantId", event.scope.tenantId).eq("memorySpaceId", event.scope.memorySpaceId).eq("eventId", eventId)).unique();
  if (prior) { if (prior.identityCanonical !== identityCanonical) dataDenied("CHANGE_CONFLICT"); return eventId; }
  const payload: RuntimeChangeEvent = { version: 1, eventId, ...event };
  await ctx.db.insert("runtimeChangeEvents", { ...event.scope, eventId, ownerPrincipalId: event.principalId, sourceId: event.source.sourceId,
    identityCanonical, payloadCanonical: canonicalModelJson(payload), sequence: await nextSequence(ctx, event.scope, ""), ownerSequence: await nextSequence(ctx, event.scope, event.principalId) });
  return eventId;
}
export async function publishExternalSourceChange(ctx: MutationCtx, head: Doc<"runtimeExternalSources">, version: Doc<"runtimeExternalVersions">,
  receipt: Doc<"runtimeExternalObservations">, type: Extract<RuntimeChangeType, "source.created" | "source.revised" | "source.tombstoned">, current: boolean) {
  return appendExternalChange(ctx, [head.tenantId, head.memorySpaceId, head.sourceId, version.versionId, type], {
    type, scope: { tenantId: head.tenantId, memorySpaceId: head.memorySpaceId }, principalId: head.ownerPrincipalId,
    source: { sourceId: head.sourceId, versionId: version.versionId, externalRevision: version.externalRevision },
    operationId: receipt.receiptId, receiptId: receipt.receiptId, occurredAt: version.capturedAt, current });
}
/** Failure text from a private service must never become event metadata. */
export function publicIndexFailure(code: string | undefined) { return code && /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? code : "INDEXING_FAILED"; }
export async function publishExternalIndexTransition(ctx: MutationCtx, event: Doc<"runtimeIngestionEvents">,
  stage: Doc<"runtimeIngestionStages">, next: Doc<"runtimeIngestionStages">) {
  if (event.lineage.role !== "external" || stage.stage !== "vectors" || stage.state === next.state
    || !["complete", "failed", "unknown", "dead_letter"].includes(next.state)) return;
  const head = await ctx.db.query("runtimeExternalSources").withIndex("by_source", q => q.eq("tenantId", event.tenantId).eq("memorySpaceId", event.memorySpaceId).eq("sourceId", event.lineage.sourceId)).unique();
  if (!head || head.erasedAt !== undefined || head.tombstonedAt !== undefined || head.ownerPrincipalId !== event.ownerPrincipalId || head.currentSourceRevision !== event.lineage.sourceRevision) return;
  const fence = await ctx.db.query("runtimeExternalErasureFences").withIndex("by_source", q => q.eq("tenantId", event.tenantId).eq("memorySpaceId", event.memorySpaceId).eq("sourceId", head.sourceId)).first();
  if (fence) return;
  const version = await ctx.db.query("runtimeExternalVersions").withIndex("by_version", q => q.eq("tenantId", event.tenantId).eq("memorySpaceId", event.memorySpaceId).eq("sourceId", head.sourceId).eq("versionId", head.currentVersionId)).unique();
  if (!version || version.kind !== "content" || version.sourceRevision !== event.lineage.sourceRevision || version.ingestionEventId !== event.eventId) dataDenied("CHANGE_CONFLICT");
  const ready = next.state === "complete", state = next.state as "complete" | "failed" | "unknown" | "dead_letter";
  await appendExternalChange(ctx, [event.tenantId, event.memorySpaceId, event.eventId, "vectors", next.attempt, state], {
    type: ready ? "source.index.ready" : "source.index.failed", scope: { tenantId: event.tenantId, memorySpaceId: event.memorySpaceId },
    principalId: event.ownerPrincipalId, source: { sourceId: head.sourceId, versionId: version.versionId, externalRevision: version.externalRevision },
    operationId: event.eventId, occurredAt: next.updatedAt, current: true, stage: "vectors", attempt: next.attempt, indexState: state,
    ...(next.receiptId === undefined ? {} : { receiptId: next.receiptId }), ...(ready ? {} : { failureCode: publicIndexFailure(next.failureCode) }) });
}
