/** Attributed external custody. Original evidence and observations never become user facts. */
import { v } from "convex/values";
import type { RegisteredMutation } from "convex/server";
import { mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { RuntimeExternalSourceInput, RuntimeExternalReceipt, RuntimeExternalIngestResult, RuntimeExternalReadiness,
  RuntimeExternalSourceVersion, RuntimeExternalContentVersion, RuntimeExternalTombstoneInput, RuntimeExternalSourceReference,
  RuntimeExternalHistoryInput, RuntimeExternalSearchInput, RuntimeExternalOutcome } from "../src/client-runtime/external";
import { externalSourceInput, externalGetInput, externalHistoryInput, externalSearchInput, externalTombstoneInput, RUNTIME_EXTERNAL_LIMITS } from "../src/client-runtime/external";
import { identifier } from "../src/client-runtime/validation";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import { prepareSourceContent } from "../src/domain/sources";
import { requireDataAuthority, dataAuthorityReference, assertOwnedResource, dataDenied } from "./runtimeDataAuth";
import type { ScopedDataAuthority } from "./runtimeDataAuth";
import { createAuthorityReader, readManagedSourceUniqueRow } from "./runtimeAuth";
import { ConvexMemoryRepository } from "./runtimeMemoryRepository";
import { enqueueSourceEvent, retireSourceEvents } from "./runtimeIngestion";
import { authorizeAsset, assetVersion, addAssetReference, releaseAssetReferences } from "./runtimeAssetCatalog";
import { deliveryExpiresAt } from "./runtimeDelivery";
import { changeHead, publishExternalSourceChange, publicIndexFailure } from "./runtimeChangesStore";
import { ASSET_MAX_BYTES } from "../src/domain/assets";

type ReadCtx = Pick<QueryCtx, "db">;
export type ExternalHead = Doc<"runtimeExternalSources">;
export type ExternalVersion = Doc<"runtimeExternalVersions">;
type Observation = Doc<"runtimeExternalObservations">;
type Selectors = { tenantId?: string; memorySpaceId?: string };
// A mapped object alias retains the strict public fields while satisfying Convex's Record constraint without widening the callable arguments.
type TombstoneArgs = { [K in keyof (Selectors & RuntimeExternalTombstoneInput)]: (Selectors & RuntimeExternalTombstoneInput)[K] };
const selectors = { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) };
const scopeOf = (row: { tenantId: string; memorySpaceId: string }) => ({ tenantId: row.tenantId, memorySpaceId: row.memorySpaceId });
function parse<T>(parser: (value: unknown) => T, value: unknown): T { try { return parser(value); } catch { return dataDenied("INVALID_INPUT"); } }
function single<T>(rows: T[]): T | undefined { if (rows.length > 1) dataDenied("EXTERNAL_SOURCE_CONFLICT"); return rows[0]; }
export function externalVersionReference(row: ExternalVersion): RuntimeExternalSourceReference { return { sourceId: row.sourceId, versionId: row.versionId, externalRevision: row.externalRevision }; }
export async function externalHead(ctx: ReadCtx, scope: { tenantId: string; memorySpaceId: string }, sourceId: string) {
  return single(await ctx.db.query("runtimeExternalSources").withIndex("by_source", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("sourceId", sourceId)).take(2));
}
export async function externalVersionRow(ctx: ReadCtx, scope: { tenantId: string; memorySpaceId: string }, sourceId: string, versionId: string) {
  return single(await ctx.db.query("runtimeExternalVersions").withIndex("by_version", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("sourceId", sourceId).eq("versionId", versionId)).take(2));
}
/** Logical tombstones preserve authorized archive access; trusted erasure does not. */
export async function authorizeExternalHead(ctx: ReadCtx, actor: ScopedDataAuthority, head: ExternalHead, capability: "read" | "write") {
  if (head.erasedAt !== undefined) dataDenied();
  const fence = await ctx.db.query("runtimeExternalErasureFences").withIndex("by_source", q => q.eq("tenantId", head.tenantId).eq("memorySpaceId", head.memorySpaceId).eq("sourceId", head.sourceId)).first();
  if (fence) dataDenied();
  const owner = await createAuthorityReader(ctx).getPrincipal(head.ownerPrincipalId);
  if (!owner || owner.deletedAt !== undefined || owner.revokedAt !== undefined) dataDenied();
  await assertOwnedResource(ctx, actor, capability, { ...scopeOf(head), resourceType: "source", resourceId: head.sourceId, ownerPrincipalId: head.ownerPrincipalId });
}
async function requiredHead(ctx: ReadCtx, actor: ScopedDataAuthority, sourceId: string, capability: "read" | "write") {
  const head = await externalHead(ctx, actor, sourceId); if (!head) dataDenied(); await authorizeExternalHead(ctx, actor, head, capability); return head;
}
interface ContentDetails { providerRevision?: string; author: RuntimeExternalSourceInput["author"]; authoredAt?: number; editedAt?: number;
  metadata?: RuntimeExternalSourceInput["metadata"]; assetReferences: NonNullable<RuntimeExternalSourceInput["assetReferences"]> }
function details(input: RuntimeExternalSourceInput): ContentDetails { return { author: input.author, assetReferences: input.assetReferences ?? [],
  ...(input.providerRevision === undefined ? {} : { providerRevision: input.providerRevision }), ...(input.authoredAt === undefined ? {} : { authoredAt: input.authoredAt }),
  ...(input.editedAt === undefined ? {} : { editedAt: input.editedAt }), ...(input.metadata === undefined ? {} : { metadata: input.metadata }) }; }
function contentDetails(row: ExternalVersion): ContentDetails { if (row.kind !== "content" || row.originalText === undefined || !row.originalContentHash || !row.normalizedContentHash) dataDenied("EXTERNAL_SOURCE_CONFLICT"); return JSON.parse(row.detailsCanonical) as ContentDetails; }
async function checkAssets(ctx: ReadCtx, reference: RuntimeAuthorityReference, head: { tenantId: string; memorySpaceId: string }, data: ContentDetails, deadlines: number[] = []) {
  const values = [];
  for (const item of data.assetReferences) { const value = await assetVersion(ctx, head, item.assetId, item.version); if (!value) dataDenied(); await authorizeAsset(ctx, reference, value, "storage:read", new Set(), deadlines); values.push(value); }
  return values;
}
/** Exact retained-version dependency fence for history and durable replay metadata. */
export async function authorizeExternalVersion(ctx: ReadCtx, actor: ScopedDataAuthority, head: ExternalHead, version: ExternalVersion, deadlines: number[] = []) {
  await authorizeExternalHead(ctx, actor, head, "read");
  if (version.tenantId !== head.tenantId || version.memorySpaceId !== head.memorySpaceId || version.sourceId !== head.sourceId || version.ownerPrincipalId !== head.ownerPrincipalId) dataDenied();
  if (version.kind === "content") await checkAssets(ctx, dataAuthorityReference(actor), head, contentDetails(version), deadlines);
}
/** Used by trusted policy erasure; owner reference continuations derive current custody liveness. */
export async function releaseExternalAssetReferences(ctx: MutationCtx, head: { tenantId: string; memorySpaceId: string; sourceId: string }) {
  await releaseAssetReferences(ctx, head, "source", head.sourceId);
}
async function counter(ctx: MutationCtx, s: { tenantId: string; memorySpaceId: string }, streamOwner: string, kind: "versions" | "observations", advance: boolean) {
  const row = await ctx.db.query("runtimeExternalCounters").withIndex("by_stream", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("streamOwner", streamOwner).eq("kind", kind)).unique();
  if (!advance) return row?.sequence ?? 0;
  const sequence = (row?.sequence ?? 0) + 1; if (!Number.isSafeInteger(sequence)) dataDenied("SEQUENCE_EXHAUSTED");
  if (row) await ctx.db.patch("runtimeExternalCounters", row._id, { sequence }); else await ctx.db.insert("runtimeExternalCounters", { ...scopeOf(s), streamOwner, kind, sequence }); return sequence;
}
async function sequences(ctx: MutationCtx, actor: { tenantId: string; memorySpaceId: string; ownerPrincipalId: string }, kind: "versions" | "observations") {
  return { sequence: await counter(ctx, actor, "", kind, true), ownerSequence: await counter(ctx, actor, actor.ownerPrincipalId, kind, true) };
}
function receipt(row: Observation): RuntimeExternalReceipt { return JSON.parse(row.receiptCanonical) as RuntimeExternalReceipt; }
async function observationByEvent(ctx: ReadCtx, owner: { tenantId: string; memorySpaceId: string; ownerPrincipalId: string }, provider: string, externalEventId: string) {
  return single(await ctx.db.query("runtimeExternalObservations").withIndex("by_event", q => q.eq("tenantId", owner.tenantId).eq("memorySpaceId", owner.memorySpaceId).eq("ownerPrincipalId", owner.ownerPrincipalId).eq("provider", provider).eq("externalEventId", externalEventId)).take(2));
}
async function recordObservation(ctx: MutationCtx, head: ExternalHead, version: ExternalVersion, requestId: string, input: Pick<RuntimeExternalSourceInput, "externalEventId" | "observedAt" | "provenance">,
  observationCanonical: string, outcome: RuntimeExternalOutcome) {
  const receiptId = `external-receipt:${await semanticHash(canonicalModelJson([head.tenantId, head.memorySpaceId, head.ownerPrincipalId, head.provider, input.externalEventId]))}`;
  const value: RuntimeExternalReceipt = { version: 1, receiptId, requestId, scope: scopeOf(head), principalId: head.ownerPrincipalId,
    reference: externalVersionReference(version), externalEventId: input.externalEventId, outcome, observedAt: input.observedAt, capturedAt: Date.now(), provenance: input.provenance,
    ...(version.kind === "content" ? { originalContentHash: version.originalContentHash! } : {}) };
  const id = await ctx.db.insert("runtimeExternalObservations", { ...scopeOf(head), ownerPrincipalId: head.ownerPrincipalId, sourceId: head.sourceId, versionId: version.versionId,
    receiptId, provider: head.provider, externalEventId: input.externalEventId, observationCanonical, receiptCanonical: canonicalModelJson(value), ...await sequences(ctx, head, "observations") });
  return (await ctx.db.get("runtimeExternalObservations", id))!;
}
export async function externalReadiness(ctx: ReadCtx, head: ExternalHead, version: ExternalVersion): Promise<RuntimeExternalReadiness> {
  if (version.kind === "tombstone") return { facts: "skipped", vectors: "not_requested" };
  if (head.tombstonedAt !== undefined || version.sourceRevision !== undefined && head.currentSourceRevision !== version.sourceRevision) return { facts: "skipped", vectors: "not_current" };
  if (version.sourceRevision === undefined || !version.ingestionEventId) return { facts: "skipped", vectors: version.versionId === head.currentVersionId ? "not_requested" : "not_current" };
  const event = single(await ctx.db.query("runtimeIngestionEvents").withIndex("by_event", q => q.eq("tenantId", head.tenantId).eq("memorySpaceId", head.memorySpaceId).eq("eventId", version.ingestionEventId!)).take(2));
  if (!event || event.ownerPrincipalId !== head.ownerPrincipalId || event.lineage.sourceId !== head.sourceId || event.lineage.sourceRevision !== version.sourceRevision || event.eligibility !== "eligible") return { facts: "skipped", vectors: "not_current" };
  const stage = await ctx.db.query("runtimeIngestionStages").withIndex("by_event_stage", q => q.eq("tenantId", head.tenantId).eq("memorySpaceId", head.memorySpaceId).eq("eventId", event.eventId).eq("stage", "vectors")).unique();
  if (!stage || stage.state === "skipped") dataDenied("EXTERNAL_SOURCE_CONFLICT");
  return { facts: "skipped", vectors: stage.state, sourceRevision: version.sourceRevision, ingestionEventId: event.eventId, profile: event.profile, attempt: stage.attempt,
    ...(stage.failureCode ? { failureCode: publicIndexFailure(stage.failureCode) } : {}) };
}
async function result(ctx: MutationCtx, actor: ScopedDataAuthority, observation: Observation): Promise<RuntimeExternalIngestResult> {
  const head = await requiredHead(ctx, actor, observation.sourceId, "read"), version = await externalVersionRow(ctx, head, head.sourceId, observation.versionId); if (!version) dataDenied();
  const deadlines: number[] = []; if (version.kind === "content") await checkAssets(ctx, dataAuthorityReference(actor), head, contentDetails(version), deadlines);
  const expiry = await deliveryExpiresAt(ctx, dataAuthorityReference(actor), deadlines);
  return { version: 1, receipt: receipt(observation), readiness: await externalReadiness(ctx, head, version), ...(expiry === undefined ? {} : { deliveryExpiresAt: expiry }) };
}
async function publicVersion(ctx: MutationCtx, actor: ScopedDataAuthority, head: ExternalHead, version: ExternalVersion): Promise<RuntimeExternalSourceVersion> {
  await authorizeExternalHead(ctx, actor, head, "read");
  const base = { version: 1 as const, scope: scopeOf(head), principalId: head.ownerPrincipalId, reference: externalVersionReference(version), provider: head.provider, externalSourceId: head.externalSourceId,
    capturedAt: version.capturedAt, current: version.versionId === head.currentVersionId, tombstoned: head.tombstonedAt !== undefined };
  const deadlines: number[] = [];
  if (version.kind === "tombstone") {
    const details = JSON.parse(version.detailsCanonical) as { reason?: string }, expiry = await deliveryExpiresAt(ctx, dataAuthorityReference(actor));
    return { ...base, kind: "tombstone", tombstoned: true, ...details, ...(expiry === undefined ? {} : { deliveryExpiresAt: expiry }) };
  }
  const details = contentDetails(version); await checkAssets(ctx, dataAuthorityReference(actor), head, details, deadlines);
  const expiry = await deliveryExpiresAt(ctx, dataAuthorityReference(actor), deadlines);
  return { ...base, kind: "content", originalText: version.originalText!, originalContentHash: version.originalContentHash!, normalizedContentHash: version.normalizedContentHash!,
    ...details, attribution: "unverified_external", extraction: "none", ...(expiry === undefined ? {} : { deliveryExpiresAt: expiry }) };
}
async function retireIndexedSource(ctx: MutationCtx, actor: ScopedDataAuthority, head: ExternalHead) {
  const source = await readManagedSourceUniqueRow(ctx, head.tenantId, head.memorySpaceId, head.sourceId);
  if (source) { if (source.ownerPrincipalId !== head.ownerPrincipalId || source.lineage.role !== "external") dataDenied("EXTERNAL_SOURCE_CONFLICT"); await ctx.db.patch("runtimeMemorySources", source._id, { tombstonedAt: Date.now() }); await retireSourceEvents(ctx, dataAuthorityReference(actor), head.sourceId, "tombstoned"); }
}
export async function ingestExternalSourceHandler(ctx: MutationCtx, args: Selectors & { requestId: string; input: RuntimeExternalSourceInput }): Promise<RuntimeExternalIngestResult> {
  const actor = await requireDataAuthority(ctx, args, "write"), reference = dataAuthorityReference(actor), input = parse(externalSourceInput, args.input), requestId = parse(v => identifier(v, 128), args.requestId);
  const identityCanonical = canonicalModelJson([actor.tenantId, actor.memorySpaceId, actor.principalId, input.provider, input.externalSourceId]);
  const sourceId = `external:${await semanticHash(identityCanonical)}`, owner = { ...scopeOf(actor), ownerPrincipalId: actor.principalId };
  await assertOwnedResource(ctx, actor, "write", { ...scopeOf(actor), resourceType: "source", resourceId: sourceId, ownerPrincipalId: actor.principalId });
  if (await ctx.db.query("runtimeExternalErasureFences").withIndex("by_source", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId).eq("sourceId", sourceId)).first()) dataDenied();
  let head = await externalHead(ctx, actor, sourceId); if (head) { if (head.identityCanonical !== identityCanonical) dataDenied("IDEMPOTENCY_CONFLICT"); await authorizeExternalHead(ctx, actor, head, "write"); }
  const sourceDetails = details(input), detailsCanonical = canonicalModelJson(sourceDetails);
  const observationCanonical = canonicalModelJson({ sourceId, externalRevision: input.externalRevision, originalText: input.originalText, details: sourceDetails, observedAt: input.observedAt, provenance: input.provenance });
  const priorObservation = await observationByEvent(ctx, owner, input.provider, input.externalEventId);
  if (priorObservation) { if (priorObservation.observationCanonical !== observationCanonical) dataDenied("IDEMPOTENCY_CONFLICT"); return result(ctx, actor, priorObservation); }
  const values = await checkAssets(ctx, reference, actor, sourceDetails);
  let version = single(await ctx.db.query("runtimeExternalVersions").withIndex("by_revision", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId).eq("sourceId", sourceId).eq("externalRevision", input.externalRevision)).take(2));
  if (version && (version.kind !== "content" || version.originalText !== input.originalText || version.detailsCanonical !== detailsCanonical)) dataDenied("IDEMPOTENCY_CONFLICT");
  const previous = head ? await externalVersionRow(ctx, actor, sourceId, head.currentVersionId) : undefined;
  if (head && !previous) dataDenied("EXTERNAL_SOURCE_CONFLICT");
  const current = !head || input.externalRevision >= head.maxExternalRevision;
  if (current && head?.tombstonedAt !== undefined) dataDenied("SOURCE_TOMBSTONED");
  const unchanged = previous?.kind === "content" && previous.originalText === input.originalText && previous.detailsCanonical === detailsCanonical;
  const outcome: RuntimeExternalOutcome = !head ? "created" : !current ? "historical" : version || unchanged ? "unchanged" : "revised";
  const now = Date.now(), versionId = `external-version:${await semanticHash(canonicalModelJson([sourceId, input.externalRevision]))}`;
  if (!head) { const id = await ctx.db.insert("runtimeExternalSources", { ...owner, sourceId, identityCanonical, provider: input.provider, externalSourceId: input.externalSourceId,
    maxExternalRevision: input.externalRevision, currentVersionId: versionId, createdAt: now, updatedAt: now }); head = (await ctx.db.get("runtimeExternalSources", id))!; }
  const newVersionCreated = !version;
  if (!version) {
    const normalized = input.originalText.normalize("NFC").replace(/\r\n?/g, "\n").trim();
    let lineage: { sourceRevision?: number; ingestionEventId?: string } = {};
    if (current && unchanged && previous) lineage = { ...(previous.sourceRevision === undefined ? {} : { sourceRevision: previous.sourceRevision }), ...(previous.ingestionEventId ? { ingestionEventId: previous.ingestionEventId } : {}) };
    else if (current && normalized) {
      const repository = new ConvexMemoryRepository(ctx, reference, "write", ctx.db), sourceEventId = `external-event:${await semanticHash(canonicalModelJson([sourceId, input.externalRevision]))}`;
      const prepared = await prepareSourceContent(repository.scope, { sourceId, sourceEventId, sourceRevision: input.externalRevision, role: "external", trust: "unverified_external" }, input.originalText, { now: () => now });
      const oldSource = await readManagedSourceUniqueRow(ctx, actor.tenantId, actor.memorySpaceId, sourceId);
      if (oldSource) { if (oldSource.ownerPrincipalId !== actor.principalId || oldSource.lineage.role !== "external" || oldSource.lineage.sourceRevision >= input.externalRevision) dataDenied("EXTERNAL_SOURCE_CONFLICT"); await ctx.db.replace("runtimeMemorySources", oldSource._id, prepared.source); }
      else await repository.putSource(prepared.source);
      const admitted = await enqueueSourceEvent(ctx, reference, prepared.source); lineage = { sourceRevision: input.externalRevision, ingestionEventId: admitted.eventId };
    } else if (current) await retireIndexedSource(ctx, actor, head);
    const id = await ctx.db.insert("runtimeExternalVersions", { ...owner, sourceId, versionId, externalRevision: input.externalRevision, kind: "content", detailsCanonical, originalText: input.originalText,
      originalContentHash: await semanticHash(input.originalText), normalizedContentHash: await semanticHash(normalized), ...lineage, ...await sequences(ctx, owner, "versions"), capturedAt: now });
    version = (await ctx.db.get("runtimeExternalVersions", id))!;
    for (const value of values) await addAssetReference(ctx, value, { kind: "source", ownerId: sourceId, ownerVersion: canonicalModelJson([versionId, value.versionId]), ownerPrincipalId: actor.principalId });
  }
  if (current && head.currentVersionId !== version.versionId || current && head.currentSourceRevision !== version.sourceRevision) {
    await ctx.db.patch("runtimeExternalSources", head._id, { maxExternalRevision: input.externalRevision, currentVersionId: version.versionId, currentSourceRevision: version.sourceRevision, updatedAt: now });
    head = (await ctx.db.get("runtimeExternalSources", head._id))!;
  }
  const observation = await recordObservation(ctx, head, version, requestId, input, observationCanonical, outcome);
  if (newVersionCreated && outcome !== "unchanged") await publishExternalSourceChange(ctx, head, version, observation, outcome === "created" ? "source.created" : "source.revised", current);
  return result(ctx, actor, observation);
}
export const ingest = mutation({ args: { ...selectors, requestId: v.string(), input: v.any() }, handler: ingestExternalSourceHandler });
export const get = mutation({ args: { ...selectors, sourceId: v.string(), versionId: v.optional(v.string()) }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"), input = parse(externalGetInput, { sourceId: args.sourceId, ...(args.versionId === undefined ? {} : { versionId: args.versionId }) });
  const head = await requiredHead(ctx, actor, input.sourceId, "read"), version = await externalVersionRow(ctx, actor, input.sourceId, input.versionId ?? head.currentVersionId); if (!version) dataDenied(); return publicVersion(ctx, actor, head, version);
} });
export const status = mutation({ args: { ...selectors, receiptId: v.string() }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"), receiptId = parse(v => identifier(v, 512), args.receiptId);
  const observation = single(await ctx.db.query("runtimeExternalObservations").withIndex("by_receipt", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId).eq("receiptId", receiptId)).take(2));
  if (!observation) dataDenied(); return result(ctx, actor, observation);
} });
interface ReadPosition { position: number; through: number; watermark: string; visibility: string; bindingCanonical: string; erasureEpoch: number }
function visibility(actor: ScopedDataAuthority) { return actor.resourceAccess === "own" ? `own:${actor.principalId}` : "scope"; }
async function readPosition(ctx: MutationCtx, actor: ScopedDataAuthority, kind: "history" | "search", input: RuntimeExternalHistoryInput | RuntimeExternalSearchInput): Promise<ReadPosition> {
  const { after: _after, limit: _limit, ...binding } = input, bindingCanonical = canonicalModelJson(kind === "search" ? { ...binding, includeHistory: (input as RuntimeExternalSearchInput).includeHistory ?? false } : binding), visible = visibility(actor);
  const erasureEpoch = (await changeHead(ctx, actor, actor.resourceAccess === "own" ? actor.principalId : ""))?.erasureEpoch ?? 0;
  if (input.after) {
    const cursor = await ctx.db.query("runtimeExternalReadCursors").withIndex("by_token", q => q.eq("token", input.after!)).unique();
    if (!cursor) dataDenied("CURSOR_INVALID"); if (cursor.invalidatedAt !== undefined || (cursor.erasureEpoch ?? 0) !== erasureEpoch) dataDenied("CURSOR_EXPIRED");
    if (cursor.kind !== kind || cursor.tenantId !== actor.tenantId || cursor.memorySpaceId !== actor.memorySpaceId || cursor.principalId !== actor.principalId || cursor.visibility !== visible || cursor.bindingCanonical !== bindingCanonical) dataDenied("CURSOR_SCOPE_CHANGED");
    return { position: cursor.position, through: cursor.through, watermark: cursor.watermark, visibility: cursor.visibility, bindingCanonical: cursor.bindingCanonical, erasureEpoch };
  }
  const through = await counter(ctx, actor, visible.startsWith("own:") ? actor.principalId : "", kind === "history" ? "observations" : "versions", false);
  return { position: 0, through, watermark: `external-watermark:${crypto.randomUUID()}`, visibility: visible, bindingCanonical, erasureEpoch };
}
async function nextReadCursor(ctx: MutationCtx, actor: ScopedDataAuthority, kind: "history" | "search", position: ReadPosition) {
  const token = `external-cursor:${crypto.randomUUID()}`; await ctx.db.insert("runtimeExternalReadCursors", { ...scopeOf(actor), principalId: actor.principalId, token, kind, ...position, createdAt: Date.now() }); return token;
}
export const history = mutation({ args: { ...selectors, sourceId: v.string(), after: v.optional(v.string()), limit: v.optional(v.number()) }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"), input = parse(externalHistoryInput, { sourceId: args.sourceId, ...(args.after === undefined ? {} : { after: args.after }), ...(args.limit === undefined ? {} : { limit: args.limit }) });
  const head = await requiredHead(ctx, actor, input.sourceId, "read"), pos = await readPosition(ctx, actor, "history", input), limit = input.limit ?? 10;
  const own = pos.visibility.startsWith("own:");
  const rows = own ? await ctx.db.query("runtimeExternalObservations").withIndex("by_source_owner_sequence", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId).eq("sourceId", head.sourceId).gt("ownerSequence", pos.position).lte("ownerSequence", pos.through)).take(limit + 1)
    : await ctx.db.query("runtimeExternalObservations").withIndex("by_source_sequence", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId).eq("sourceId", head.sourceId).gt("sequence", pos.position).lte("sequence", pos.through)).take(limit + 1);
  const items = rows.slice(0, limit), hasMore = rows.length > limit, last = items[items.length - 1], position = last ? own ? last.ownerSequence : last.sequence : pos.position;
  const deadlines: number[] = [];
  for (const item of items) {
    const version = await externalVersionRow(ctx, head, head.sourceId, item.versionId); if (!version) dataDenied();
    await authorizeExternalVersion(ctx, actor, head, version, deadlines);
  }
  const nextCursor = hasMore ? await nextReadCursor(ctx, actor, "history", { ...pos, position }) : null;
  const expiry = await deliveryExpiresAt(ctx, dataAuthorityReference(actor), deadlines);
  return { version: 1 as const, scope: scopeOf(actor), principalId: actor.principalId, sourceId: head.sourceId, items: items.map(receipt), nextCursor, hasMore, ...(expiry === undefined ? {} : { deliveryExpiresAt: expiry }) };
} });
export const search = mutation({ args: { ...selectors, literal: v.string(), after: v.optional(v.string()), limit: v.optional(v.number()), includeHistory: v.optional(v.boolean()) }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"), input = parse(externalSearchInput, { literal: args.literal, ...(args.after === undefined ? {} : { after: args.after }), ...(args.limit === undefined ? {} : { limit: args.limit }), ...(args.includeHistory === undefined ? {} : { includeHistory: args.includeHistory }) });
  const pos = await readPosition(ctx, actor, "search", input), own = pos.visibility.startsWith("own:"), limit = input.limit ?? 10;
  const rows = own ? await ctx.db.query("runtimeExternalVersions").withIndex("by_owner_sequence", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId).eq("ownerPrincipalId", actor.principalId).gt("ownerSequence", pos.position).lte("ownerSequence", pos.through)).take(RUNTIME_EXTERNAL_LIMITS.maxScanRows + 1)
    : await ctx.db.query("runtimeExternalVersions").withIndex("by_scope_sequence", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId).gt("sequence", pos.position).lte("sequence", pos.through)).take(RUNTIME_EXTERNAL_LIMITS.maxScanRows + 1);
  const items: RuntimeExternalContentVersion[] = []; let position = pos.position, scanned = 0;
  for (const row of rows.slice(0, RUNTIME_EXTERNAL_LIMITS.maxScanRows)) {
    position = own ? row.ownerSequence : row.sequence; scanned++;
    if (row.kind !== "content" || !row.originalText?.includes(input.literal)) continue;
    const head = await externalHead(ctx, actor, row.sourceId); if (!head || head.tombstonedAt !== undefined || head.erasedAt !== undefined || !input.includeHistory && head.currentVersionId !== row.versionId) continue;
    try { const value = await publicVersion(ctx, actor, head, row); if (value.kind === "content") items.push(value); }
    catch (error) { if (!error || typeof error !== "object" || !("data" in error) || !(error.data && typeof error.data === "object") || !("code" in error.data) || error.data.code !== "FORBIDDEN") throw error; await requireDataAuthority(ctx, args, "read"); }
    if (items.length === limit) break;
  }
  const hasMore = rows.length > scanned, nextCursor = hasMore ? await nextReadCursor(ctx, actor, "search", { ...pos, position }) : null;
  const deadlines = items.flatMap(item => item.deliveryExpiresAt === undefined ? [] : [item.deliveryExpiresAt]), expiry = await deliveryExpiresAt(ctx, dataAuthorityReference(actor), deadlines);
  return { version: 1 as const, scope: scopeOf(actor), principalId: actor.principalId, items, nextCursor, hasMore, watermark: pos.watermark, completeThroughWatermark: !hasMore, match: "literal_case_sensitive" as const, ...(expiry === undefined ? {} : { deliveryExpiresAt: expiry }) };
} });
export async function tombstoneExternalSourceHandler(ctx: MutationCtx, args: Selectors & RuntimeExternalTombstoneInput): Promise<RuntimeExternalIngestResult> {
  const actor = await requireDataAuthority(ctx, args, "write"), { tenantId: _tenant, memorySpaceId: _space, ...raw } = args, input = parse(externalTombstoneInput, raw);
  const head = await requiredHead(ctx, actor, input.sourceId, "write"), observationCanonical = canonicalModelJson({ sourceId: head.sourceId, externalRevision: input.externalRevision, observedAt: input.observedAt, provenance: input.provenance, kind: "tombstone", ...(input.reason === undefined ? {} : { reason: input.reason }) });
  const prior = await observationByEvent(ctx, head, head.provider, input.externalEventId);
  if (prior) { if (prior.observationCanonical !== observationCanonical) dataDenied("IDEMPOTENCY_CONFLICT"); return result(ctx, actor, prior); }
  if (head.tombstonedAt !== undefined) dataDenied("SOURCE_TOMBSTONED");
  if (input.externalRevision <= head.maxExternalRevision) dataDenied("STALE_REVISION");
  const now = Date.now(), versionId = `external-version:${await semanticHash(canonicalModelJson([head.sourceId, input.externalRevision]))}`;
  const id = await ctx.db.insert("runtimeExternalVersions", { ...scopeOf(head), ownerPrincipalId: head.ownerPrincipalId, sourceId: head.sourceId, versionId, externalRevision: input.externalRevision, kind: "tombstone",
    detailsCanonical: canonicalModelJson(input.reason === undefined ? {} : { reason: input.reason }), ...await sequences(ctx, head, "versions"), capturedAt: now });
  await retireIndexedSource(ctx, actor, head);
  await ctx.db.patch("runtimeExternalSources", head._id, { maxExternalRevision: input.externalRevision, currentVersionId: versionId, currentSourceRevision: undefined, tombstonedAt: now, updatedAt: now });
  const current = (await ctx.db.get("runtimeExternalSources", head._id))!, version = (await ctx.db.get("runtimeExternalVersions", id))!;
  const observation = await recordObservation(ctx, current, version, input.requestId, input, observationCanonical, "tombstoned");
  await publishExternalSourceChange(ctx, current, version, observation, "source.tombstoned", true);
  return result(ctx, actor, observation);
}
export const tombstone: RegisteredMutation<"public", TombstoneArgs, Promise<RuntimeExternalIngestResult>> = mutation({ args: { ...selectors, sourceId: v.string(), requestId: v.string(), externalEventId: v.string(), externalRevision: v.number(), observedAt: v.number(), provenance: v.any(), reason: v.optional(v.string()) }, handler: tombstoneExternalSourceHandler });

/** Advertise only implemented, authenticated lifecycle capabilities. No model dispatch or policy changes. */
export const capabilities = mutation({ args: selectors, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"), expiry = await deliveryExpiresAt(ctx, dataAuthorityReference(actor));
  return { version: 1 as const, scope: scopeOf(actor), principalId: actor.principalId,
    externalSources: { version: 1 as const, immutableVersions: true as const, originalTextRetrieval: true as const, exactTextSearch: "literal_case_sensitive_scan" as const,
      attribution: ["unverified_external" as const], extraction: ["none" as const], maxBatchSources: RUNTIME_EXTERNAL_LIMITS.maxBatchSources,
      maxSourceBytes: RUNTIME_EXTERNAL_LIMITS.maxSourceBytes, maxBatchBytes: RUNTIME_EXTERNAL_LIMITS.maxBatchBytes, maxMetadataBytes: RUNTIME_EXTERNAL_LIMITS.maxMetadataBytes,
      maxAssetReferences: RUNTIME_EXTERNAL_LIMITS.maxAssetReferences, maxPageSize: RUNTIME_EXTERNAL_LIMITS.maxPageSize },
    changes: { version: 1 as const, durable: true as const, atomicPublication: true as const, opaqueCursors: true as const, maxPageSize: RUNTIME_EXTERNAL_LIMITS.maxChangePageSize,
      retention: "until_policy_erasure" as const, cursorExpiry: "explicit_invalidation_only" as const },
    largeAssets: { resumableUpload: false as const, rangeRetrieval: false as const, maxManagedBytes: ASSET_MAX_BYTES, modelInputLimitsSeparate: true as const },
    ...(expiry === undefined ? {} : { deliveryExpiresAt: expiry }) };
} });
