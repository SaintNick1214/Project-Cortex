import { artifactMetadataWitness, checkArtifactContextWitnesses, readArtifactContext } from "./runtimeArtifactContext";
import type { ArtifactContextWitness } from "../src/domain/artifact-context";
import { bindNativeAssetReferences, publicMessageAssets, releaseAssetReferences } from "./runtimeAssetCatalog";
import { checkMediaJob } from "./runtimeMediaFence";
/** One private Agent store, with scoped Cortex metadata and current source fences. */
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import { createThread, saveMessages } from "@convex-dev/agent";
import type { AgentComponent, MessageDoc } from "@convex-dev/agent";
import type { ModelMessage } from "ai";
import { ConvexError, v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { components } from "./_generated/api";
import type { RuntimeAuthorityReference, RuntimeCapability } from "../src/auth/verified";
import { canonicalModelJson } from "../src/domain/model-policy";
import { normalizeSourceText, semanticHash } from "../src/domain/profile";
import { boundedIdentifier, clientRequestKey, comparePosition, normalizeTextSubmit, publicTextParts, utf8Bytes } from "../src/domain/transcript";
import type { CutoffV1, MessagePin, PublicTranscriptMessage } from "../src/domain/transcript";
import { dataAuthorityReference, managedConversationAccess, requireDataAuthority, recheckDataAuthority } from "./runtimeDataAuth";
import type { ScopedDataAuthority } from "./runtimeDataAuth";
import { readNativeTranscriptMessages, recheckAuthority } from "./runtimeAuth";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { checkContextSourceWitnesses } from "./runtimeContextWitness";
import type { ContextSourceWitness } from "../src/domain/context-witness";
import { enqueueSourceEvent, retireSourceEvents, readScopeSequence } from "./runtimeIngestion";

// Official generated component projection; this does not expose component functions publicly.
export const agentComponent = (components as unknown as { agent: AgentComponent }).agent;
type ReadCtx = Pick<QueryCtx, "db" | "runQuery">;
export type ManagedConversation = Doc<"runtimeConversations">;
/** C3 cutoff history fence now counts execution-invalidating changes independently of future queued admissions.
 * Public historyRevision/cursors still track every canonical change. Existing current rows require no migration. */
export function executionRevision(conversation: ManagedConversation): number { return conversation.executionRevision ?? conversation.historyRevision; }
export function transcriptDenied(code = "FORBIDDEN"): never {
  throw new ConvexError({ version: 1, code, message: "Conversation operation denied.", retryable: false, outcome: "not_dispatched" });
}
export function singleTranscript<T>(rows: T[]): T | undefined { if (rows.length > 1) transcriptDenied("TRANSCRIPT_CONFLICT"); return rows[0]; }
export async function conversationById(ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference, conversationId: string) {
  const direct = singleTranscript(await ctx.db.query("runtimeConversations").withIndex("by_scoped_id", q => q.eq("tenantId", reference.tenantId)
    .eq("memorySpaceId", reference.memorySpaceId!).eq("conversationId", conversationId)).take(2));
  return direct ?? singleTranscript(await ctx.db.query("runtimeConversations").withIndex("by_scoped_alias", q => q.eq("tenantId", reference.tenantId)
    .eq("memorySpaceId", reference.memorySpaceId!).eq("legacyConversationId", conversationId)).take(2));
}
export async function checkConversation(ctx: Pick<QueryCtx, "db">, reference: RuntimeAuthorityReference,
  conversation: ManagedConversation, capability: RuntimeCapability): Promise<void> {
  await managedConversationAccess(ctx, reference, conversation, capability);
}
export async function requireConversation(ctx: Pick<QueryCtx, "db" | "auth">,
  selectors: { tenantId?: string; memorySpaceId?: string }, conversationId: string, capability: RuntimeCapability) {
  const actor = await requireDataAuthority(ctx, selectors, capability); const reference = dataAuthorityReference(actor);
  boundedIdentifier(conversationId);
  const conversation = await conversationById(ctx, reference, conversationId); if (!conversation) transcriptDenied();
  await checkConversation(ctx, reference, conversation, capability);
  return { actor, reference, conversation };
}
export async function createManagedConversation(ctx: MutationCtx, actor: ScopedDataAuthority, identity: string, creationCanonical: string,
  options: { type?: "user-agent" | "agent-agent"; participants?: string[]; visibility?: "private" | "space"; retentionUntil?: number;
    requireApproval?: boolean; forkedFrom?: string } = {}): Promise<ManagedConversation> {
  const reference = dataAuthorityReference(actor);
  const conversationId = `conversation:${await semanticHash(identity)}`;
  const existing = await conversationById(ctx, reference, conversationId);
  if (existing) {
    await checkConversation(ctx, reference, existing, "write");
    if (existing.creationIdentity !== identity || existing.creationCanonical !== creationCanonical) transcriptDenied("IDEMPOTENCY_CONFLICT");
    return existing;
  }
  if (options.retentionUntil !== undefined && (!Number.isSafeInteger(options.retentionUntil) || options.retentionUntil <= Date.now())) transcriptDenied("INVALID_INPUT");
  const participants = [...new Set([actor.principalId, ...options.participants ?? []])];
  if (participants.length > 64) transcriptDenied("INVALID_INPUT");
  // Sharing metadata names only principals already admitted to this same tenant.
  for (const id of participants) {
    boundedIdentifier(id);
    const principal = ctx.db.normalizeId("runtimeAuthPrincipals", id);
    if (!principal || !(await ctx.db.get("runtimeAuthPrincipals", principal))) transcriptDenied();
    const memberships = await ctx.db.query("runtimeAuthMemberships").withIndex("by_principal_tenant", q => q.eq("principalId", principal).eq("tenantId", actor.tenantId)).take(2);
    if (memberships.length !== 1 || memberships[0].revokedAt !== undefined || memberships[0].deletedAt !== undefined) transcriptDenied();
  }
  await recheckAuthority(ctx, reference, { capability: "write", resource: { resourceType: "conversation", resourceId: conversationId,
    tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId, ownerPrincipalId: actor.principalId } });
  const threadId = await createThread(ctx, agentComponent, { userId: actor.principalId });
  const now = Date.now();
  const id = await ctx.db.insert("runtimeConversations", { tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId,
    ownerPrincipalId: actor.principalId, conversationId, threadId, type: options.type ?? "user-agent", participants,
    visibility: options.visibility ?? "private", manualWriteLocked: true, requireApproval: options.requireApproval ?? false,
    ...(options.retentionUntil === undefined ? {} : { retentionUntil: options.retentionUntil }),
    ...(options.forkedFrom === undefined ? {} : { forkedFrom: options.forkedFrom }),
    epoch: 1, historyRevision: 0, executionRevision: 0, nextQueueSequence: 0, messageCount: 0, createdAt: now, updatedAt: now, creationIdentity: identity, creationCanonical });
  return (await ctx.db.get("runtimeConversations", id))!;
}
async function nativeById(ctx: Pick<QueryCtx, "runQuery">, ids: string[]) {
  return await readNativeTranscriptMessages(ctx, agentComponent.messages.getMessagesByIds, ids);
}
export async function bridgeFor(ctx: Pick<QueryCtx, "db">, conversation: ManagedConversation, nativeMessageId: string) {
  return singleTranscript(await ctx.db.query("runtimeTranscriptMessages").withIndex("by_native", q => q.eq("tenantId", conversation.tenantId)
    .eq("memorySpaceId", conversation.memorySpaceId).eq("nativeMessageId", nativeMessageId)).take(2));
}
function content(message: MessageDoc) {
  const role = message.message?.role;
  if (role !== "user" && role !== "assistant" && role !== "tool") transcriptDenied("TRANSCRIPT_CONFLICT");
  const parts = publicTextParts(message.message?.content);
  // A non-text native message is not implicitly factual or publicly executable.
  return { role, parts };
}
async function contentHash(message: MessageDoc): Promise<string> { return await semanticHash(canonicalModelJson(content(message))); }
/** Private model history is the canonical Agent message, never the public text projection. */
export async function canonicalMessageHash(message: MessageDoc): Promise<string> {
  if (!message.message) transcriptDenied("STALE_TRANSCRIPT");
  return await semanticHash(canonicalModelJson(message.message));
}
export function privateModelMessage(message: MessageDoc): ModelMessage {
  const native = message.message;
  if (!native || !["user", "assistant", "tool"].includes(native.role)) transcriptDenied("TRANSCRIPT_CONFLICT");
  // Agent validators and the governed native envelope independently validate the complete graph.
  // Detach stored values; do not mutate canonical history or spread native provider metadata.
  return JSON.parse(canonicalModelJson(native)) as ModelMessage;
}
export async function verifyMessage(ctx: ReadCtx, conversation: ManagedConversation, bridge: Doc<"runtimeTranscriptMessages">,
  native: MessageDoc | null): Promise<MessageDoc> {
  if (!native || bridge.tombstonedAt !== undefined || bridge.conversationId !== conversation.conversationId
    || bridge.tenantId !== conversation.tenantId || bridge.memorySpaceId !== conversation.memorySpaceId
    || native.threadId !== conversation.threadId || native._id !== bridge.nativeMessageId
    || comparePosition(native, bridge) !== 0 || native.message?.role !== bridge.role || await contentHash(native) !== bridge.contentHash) transcriptDenied("STALE_TRANSCRIPT");
  return native;
}
async function sourceWrite(ctx: MutationCtx, conversation: ManagedConversation, bridge: Pick<Doc<"runtimeTranscriptMessages">,
  "sourceId" | "sourceEventId" | "revision" | "role" | "ownerPrincipalId" | "sourceContentHash" | "approved" | "nativeMessageId">, text: string) {
  if (!bridge.approved || !text.trim()) return;
  // Public/manual tool text cannot gain verified_tool_evidence. Task07 must register trusted operation output separately.
  if (bridge.role === "tool") return;
  const lineage = bridge.role === "user" ? { sourceId: bridge.sourceId, sourceEventId: bridge.sourceEventId, sourceRevision: bridge.revision,
    role: "user" as const, trust: "user_assertion" as const } : { sourceId: bridge.sourceId, sourceEventId: bridge.sourceEventId, sourceRevision: bridge.revision,
    role: "assistant" as const, trust: "assistant_claim" as const };
  const existing = singleTranscript(await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", conversation.tenantId)
    .eq("memorySpaceId", conversation.memorySpaceId).eq("lineage.sourceId", bridge.sourceId)).take(2));
  const value = { tenantId: conversation.tenantId, memorySpaceId: conversation.memorySpaceId, ownerPrincipalId: bridge.ownerPrincipalId,
    lineage, content: normalizeSourceText(text), contentHash: bridge.sourceContentHash, createdAt: Date.now(),
    transcriptOrigin: { conversationId: conversation.conversationId, conversationEpoch: conversation.epoch, nativeMessageId: bridge.nativeMessageId } };
  if (existing) {
    if (existing.tombstonedAt !== undefined || existing.ownerPrincipalId !== bridge.ownerPrincipalId || existing.lineage.sourceRevision >= bridge.revision) transcriptDenied("STALE_TRANSCRIPT");
    await ctx.db.replace("runtimeMemorySources", existing._id, value);
  } else await ctx.db.insert("runtimeMemorySources", value);
}
async function messageOutbox(ctx: MutationCtx, conversation: ManagedConversation,
  bridge: Pick<Doc<"runtimeTranscriptMessages">, "nativeMessageId" | "sourceEventId" | "revision" | "approved">,
  state: "pending" | "registered" | "tombstoned", initialQueueSequence?: number) {
  const canonicalIdentity = canonicalModelJson([bridge.sourceEventId, bridge.revision, "canonical-transcript-v1"]);
  const identityHash = await semanticHash(canonicalIdentity);
  const prior = singleTranscript(await ctx.db.query("runtimeTranscriptOutbox").withIndex("by_identity", q => q.eq("tenantId", conversation.tenantId)
    .eq("memorySpaceId", conversation.memorySpaceId).eq("identityHash", identityHash)).take(2));
  if (prior && (prior.canonicalIdentity !== canonicalIdentity || prior.conversationId !== conversation.conversationId
    || prior.nativeMessageId !== bridge.nativeMessageId || prior.sourceEventId !== bridge.sourceEventId || prior.sourceRevision !== bridge.revision)) transcriptDenied("IDEMPOTENCY_CONFLICT");
  if (prior) {
    if (prior.state === "tombstoned" && state !== "tombstoned") transcriptDenied("STALE_TRANSCRIPT");
    if (prior.state !== state) await ctx.db.patch("runtimeTranscriptOutbox", prior._id, { state });
  } else await ctx.db.insert("runtimeTranscriptOutbox", { tenantId: conversation.tenantId, memorySpaceId: conversation.memorySpaceId,
    conversationId: conversation.conversationId, nativeMessageId: bridge.nativeMessageId, sourceEventId: bridge.sourceEventId,
    sourceRevision: bridge.revision, canonicalIdentity, identityHash, state, createdAt: Date.now() });
  const full = await bridgeFor(ctx, conversation, bridge.nativeMessageId); if (!full) transcriptDenied("TRANSCRIPT_CONFLICT");
  if (state === "tombstoned") { await retireSourceEvents(ctx, full.actorReference, full.sourceId, "superseded"); return; }
  const native = (await nativeById(ctx, [bridge.nativeMessageId]))[0];
  if (!native || native.status !== "success" || full.role === "tool") return;
  const text = content(native).parts.map(part => part.text).join("\n"); if (!text.trim()) return;
  const source = { tenantId: conversation.tenantId, memorySpaceId: conversation.memorySpaceId, ownerPrincipalId: full.ownerPrincipalId,
    lineage: full.role === "user" ? { sourceId: full.sourceId, sourceEventId: full.sourceEventId, sourceRevision: bridge.revision, role: "user" as const, trust: "user_assertion" as const }
      : { sourceId: full.sourceId, sourceEventId: full.sourceEventId, sourceRevision: bridge.revision, role: "assistant" as const, trust: "assistant_claim" as const },
    content: normalizeSourceText(text), contentHash: full.sourceContentHash, createdAt: full.createdAt };
  const run = full.runId ? await ctx.db.query("runtimeRuns").withIndex("by_scoped_id", q => q.eq("tenantId", conversation.tenantId)
    .eq("memorySpaceId", conversation.memorySpaceId).eq("runId", full.runId!)).unique() : null;
  const conversationSequence = run?.queueSequence ?? initialQueueSequence;
  await enqueueSourceEvent(ctx, full.actorReference, source, { conversationId: conversation.conversationId,
    ...(conversationSequence === undefined ? {} : { conversationSequence }),
    conversationEpoch: conversation.epoch, nativeMessageId: full.nativeMessageId, ...(full.runId ? { runId: full.runId } : {}),
    eligibility: state === "pending" ? "awaiting_approval" : "eligible" });
}
export async function registerMessages(ctx: MutationCtx, conversation: ManagedConversation, reference: RuntimeAuthorityReference,
  messages: MessageDoc[], options: { runId?: string; queueSequence?: number; attemptNumber?: number; approved?: boolean; invalidateExecution?: boolean; trustedToolMessages?: boolean;
    contextSourceWitnesses?: ContextSourceWitness[]; artifactContextWitnesses?: ArtifactContextWitness[] } = {}) {
  const pins: MessagePin[] = [];
  for (const message of messages) {
    if (message.threadId !== conversation.threadId || message.status !== "success") transcriptDenied("TRANSCRIPT_CONFLICT");
    if (await bridgeFor(ctx, conversation, message._id)) transcriptDenied("TRANSCRIPT_CONFLICT");
    const typed = content(message); const now = Date.now();
    if (typed.role === "tool" && !options.trustedToolMessages) transcriptDenied("TRANSCRIPT_CONFLICT");
    const event = `transcript:${conversation.conversationId}:${message._id}`;
    const text = typed.parts.map(part => part.text).join("\n");
    const hash = await contentHash(message); const sourceHash = await semanticHash(text.trim() ? normalizeSourceText(text) : "");
    const mediaJobReferences = await checkNativeMediaReferences(ctx, reference, message);
    const artifactContextWitnesses = [...new Map([...(options.artifactContextWitnesses ?? []), ...await nativeArtifactWitnesses(ctx, reference, message)].map(witness => [canonicalModelJson(witness), witness])).values()];
    await checkArtifactContextWitnesses(ctx, reference, artifactContextWitnesses);
    const bridge = { tenantId: conversation.tenantId, memorySpaceId: conversation.memorySpaceId, ownerPrincipalId: reference.principalId,
      conversationId: conversation.conversationId, nativeMessageId: message._id, order: message.order, stepOrder: message.stepOrder,
      role: typed.role, revision: 1, contentHash: hash, sourceEventId: event, sourceId: event, sourceContentHash: sourceHash,
      actorReference: reference, approved: options.approved ?? true,
      ...(options.contextSourceWitnesses?.length ? { contextSourceWitnesses: options.contextSourceWitnesses } : {}),
      ...(mediaJobReferences.length ? { mediaJobReferences } : {}),
      ...(artifactContextWitnesses.length ? { artifactContextWitnesses } : {}),
      ...(options.runId === undefined ? {} : { runId: options.runId }), ...(options.attemptNumber === undefined ? {} : { attemptNumber: options.attemptNumber }), createdAt: now, updatedAt: now };
    const bridgeId = await ctx.db.insert("runtimeTranscriptMessages", bridge);
    await bindNativeAssetReferences(ctx, reference, (await ctx.db.get("runtimeTranscriptMessages", bridgeId))!, message);
    await sourceWrite(ctx, conversation, bridge, text);
    await messageOutbox(ctx, conversation, bridge, bridge.approved ? "registered" : "pending", options.queueSequence);
    pins.push({ nativeMessageId: message._id, order: message.order, stepOrder: message.stepOrder, sourceEventId: event, sourceRevision: 1, contentHash: hash });
  }
  await ctx.db.patch("runtimeConversations", conversation._id, { historyRevision: conversation.historyRevision + 1,
    executionRevision: executionRevision(conversation) + (options.invalidateExecution === false ? 0 : 1),
    messageCount: conversation.messageCount + messages.length, updatedAt: Date.now() });
  return pins;
}
async function nativeArtifactWitnesses(ctx: Pick<ReadCtx, "db">, reference: RuntimeAuthorityReference, message: MessageDoc): Promise<ArtifactContextWitness[]> {
  const parts = message.message?.content;
  if (message.message?.role !== "tool" || !Array.isArray(parts)) return [];
  const witnesses: ArtifactContextWitness[] = [];
  for (const part of parts) {
    if (part.type !== "tool-result" || part.toolName !== "artifact_read") continue;
    const output = part.output;
    if (!output || output.type !== "json") transcriptDenied("INVALID_MODEL_OUTPUT");
    const value = output.value;
    if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== 1 || typeof value.artifactId !== "string") transcriptDenied("INVALID_MODEL_OUTPUT");
    const current = await readArtifactContext(ctx, reference, value.artifactId);
    if (canonicalModelJson(current) !== canonicalModelJson(value)) transcriptDenied("STALE_CONTEXT");
    witnesses.push(await artifactMetadataWitness(current));
  }
  if (witnesses.length > 32) transcriptDenied("TOOL_STEP_LIMIT"); return witnesses;
}
/** Canonical private tool results carry references, never binary data or provider handles. */
export async function checkNativeMediaReferences(ctx: Pick<ReadCtx, "db">, reference: RuntimeAuthorityReference, message: MessageDoc) {
  await nativeArtifactWitnesses(ctx, reference, message);
  const references: NonNullable<Doc<"runtimeTranscriptMessages">["mediaJobReferences"]> = [];
  const parts = message.message?.content;
  if (message.message?.role !== "tool" || !Array.isArray(parts)) return references;
  for (const part of parts) {
    if (part.type !== "tool-result" || !["media_image_generate", "media_video_generate"].includes(part.toolName)) continue;
    const output = part.output; if (!output || output.type !== "json") continue;
    const value = output.value;
    if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== 1 || typeof value.jobId !== "string" || typeof value.artifactId !== "string" || (value.kind !== "image" && value.kind !== "video")) transcriptDenied("INVALID_MODEL_OUTPUT");
    const job = await ctx.db.query("runtimeMediaJobs").withIndex("by_job", q => q.eq("jobId", value.jobId as string)).unique();
    if (!job || job.artifactId !== value.artifactId || job.kind !== value.kind) transcriptDenied("STALE_CONTEXT");
    await checkMediaJob(ctx, job, reference);
    references.push({ type: "media-job", version: 1, jobId: job.jobId, artifactId: job.artifactId, kind: job.kind });
  }
  if (references.length > 4) transcriptDenied("TOOL_STEP_LIMIT"); return references;
}
async function currentPrivateSources(ctx: ReadCtx, reference: RuntimeAuthorityReference,
  witnesses: readonly ContextSourceWitness[]) {
  await checkContextSourceWitnesses(ctx, reference, witnesses);
}
export async function approveRegisteredMessage(ctx: MutationCtx, conversation: ManagedConversation,
  bridge: Doc<"runtimeTranscriptMessages">, actor: RuntimeAuthorityReference,
  options: { invalidateExecution?: boolean } = {}): Promise<void> {
  const native = await verifyMessage(ctx, conversation, bridge, (await nativeById(ctx, [bridge.nativeMessageId]))[0]);
  if (bridge.approved) return;
  const revision = bridge.revision + 1; const now = Date.now();
  const changed = { ...bridge, approved: true, revision, actorReference: actor, updatedAt: now };
  await sourceWrite(ctx, conversation, changed, content(native).parts.map(part => part.text).join("\n"));
  await ctx.db.patch("runtimeTranscriptMessages", bridge._id, { approved: true, revision, actorReference: actor, updatedAt: now });
  await messageOutbox(ctx, conversation, bridge, "tombstoned");
  await messageOutbox(ctx, conversation, changed, "registered");
  await ctx.db.patch("runtimeConversations", conversation._id, { historyRevision: conversation.historyRevision + 1,
    executionRevision: executionRevision(conversation) + (options.invalidateExecution === false ? 0 : 1), updatedAt: now });
}
function publicConversation(row: ManagedConversation) {
  return { conversationId: row.conversationId, type: row.type, visibility: row.visibility, manualWriteLocked: row.manualWriteLocked,
    requireApproval: row.requireApproval, historyRevision: row.historyRevision, epoch: row.epoch, messageCount: row.messageCount,
    participants: row.participants, retentionUntil: row.retentionUntil ?? null, createdAt: row.createdAt, updatedAt: row.updatedAt };
}
export async function readTranscriptPage(ctx: ReadCtx, conversation: ManagedConversation, reference: RuntimeAuthorityReference,
  cursor: string | null, limit = 100) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) transcriptDenied("INVALID_INPUT");
  let nativeCursor: string | null = null;
  if (cursor !== null) {
    let value: { conversationId: string; epoch: number; revision: number; nativeCursor: string };
    try { if (utf8Bytes(cursor) > 4096) transcriptDenied("INVALID_INPUT"); value = JSON.parse(cursor); if (!value || typeof value !== "object" || Object.keys(value).sort().join(",") !== "conversationId,epoch,nativeCursor,revision") transcriptDenied("INVALID_INPUT"); } catch { return transcriptDenied("INVALID_INPUT"); }
    if (value.conversationId !== conversation.conversationId || value.epoch !== conversation.epoch || value.revision !== conversation.historyRevision
      || typeof value.nativeCursor !== "string") transcriptDenied("STALE_TRANSCRIPT");
    nativeCursor = value.nativeCursor;
  }
  const result: { page: MessageDoc[]; isDone: boolean; continueCursor: string } = await ctx.runQuery(agentComponent.messages.listMessagesByThreadId, { threadId: conversation.threadId,
    order: "asc", paginationOpts: { cursor: nativeCursor, numItems: limit } });
  const page: PublicTranscriptMessage[] = [];
  for (const native of result.page) {
    const bridge = await bridgeFor(ctx, conversation, native._id);
    if (!bridge || bridge.tombstonedAt !== undefined) continue;
    await verifyMessage(ctx, conversation, bridge, native);
    await currentPrivateSources(ctx, reference, bridge.contextSourceWitnesses ?? []);
    await checkArtifactContextWitnesses(ctx, reference, bridge.artifactContextWitnesses ?? []);
    const typed = content(native);
    for (const item of bridge.mediaJobReferences ?? []) {
      const job = await ctx.db.query("runtimeMediaJobs").withIndex("by_job", q => q.eq("jobId", item.jobId)).unique();
      if (!job || job.artifactId !== item.artifactId || job.kind !== item.kind) transcriptDenied("STALE_CONTEXT");
      await checkMediaJob(ctx, job, reference);
    }
    page.push({ id: native._id, order: native.order, stepOrder: native.stepOrder, role: typed.role, parts: [...typed.parts, ...(bridge.mediaJobReferences ?? [])],
      status: !bridge.approved ? "pending" : native.status, revision: bridge.revision, ...(bridge.assetVersionIds?.length ? { assets: await publicMessageAssets(ctx, reference, bridge) } : {}) });
  }
  return { page, isDone: result.isDone, continueCursor: result.isDone ? null : canonicalModelJson({ conversationId: conversation.conversationId,
    epoch: conversation.epoch, revision: conversation.historyRevision, nativeCursor: result.continueCursor }) };
}
export async function captureCutoff(ctx: ReadCtx, conversation: ManagedConversation, run: Doc<"runtimeRuns">,
  requiredStages: ("facts" | "vectors" | "graph")[], maxContextTokens: number): Promise<CutoffV1> {
  await checkConversation(ctx, run.authorityReference, conversation, "run");
  if (run.conversationEpoch !== conversation.epoch || !run.inputMessageIds.length) transcriptDenied("STALE_TRANSCRIPT");
  const input = await nativeById(ctx, run.inputMessageIds);
  const inputPins: MessagePin[] = [];
  for (let i = 0; i < input.length; i++) {
    const bridge = await bridgeFor(ctx, conversation, run.inputMessageIds[i]);
    if (!bridge || bridge.runId !== run.runId || bridge.role !== "user" || !bridge.approved) transcriptDenied("STALE_TRANSCRIPT");
    const native = await verifyMessage(ctx, conversation, bridge, input[i]);
    if (native.status !== "success") transcriptDenied("STALE_TRANSCRIPT");
    inputPins.push({ nativeMessageId: native._id, order: native.order, stepOrder: native.stepOrder,
      sourceEventId: bridge.sourceEventId, sourceRevision: bridge.revision, contentHash: bridge.contentHash,
      canonicalContentHash: await canonicalMessageHash(native) });
  }
  inputPins.sort(comparePosition); const anchor = inputPins[inputPins.length - 1]!;
  let cursor: string | null = null; let scanned = 0; let bytes = 0; const pins: MessagePin[] = []; const positions = new Set<string>();
  let complete = true;
  do {
    const result: { page: MessageDoc[]; isDone: boolean; continueCursor: string } = await ctx.runQuery(agentComponent.messages.listMessagesByThreadId, { threadId: conversation.threadId,
      order: "asc", statuses: ["success"], upToAndIncludingMessageId: anchor.nativeMessageId, paginationOpts: { cursor, numItems: 100 } });
    for (const native of result.page) {
      if (comparePosition(native, anchor) > 0) continue;
      const bridge = await bridgeFor(ctx, conversation, native._id);
      if (!bridge || bridge.tombstonedAt !== undefined || !bridge.approved) continue;
      if (bridge.runId && bridge.runId !== run.runId) {
        const previous = singleTranscript(await ctx.db.query("runtimeRuns").withIndex("by_scoped_id", q => q.eq("tenantId", conversation.tenantId)
          .eq("memorySpaceId", conversation.memorySpaceId).eq("runId", bridge.runId!)).take(2));
        if (!previous || previous.responseStatus !== "complete" || previous.queueSequence >= run.queueSequence || previous.tombstonedAt !== undefined) continue;
      }
      await verifyMessage(ctx, conversation, bridge, native);
      const position = canonicalModelJson([native.order, native.stepOrder]); if (positions.has(position)) transcriptDenied("TRANSCRIPT_CONFLICT"); positions.add(position);
      bytes += utf8Bytes(canonicalModelJson(native.message)); scanned++;
      if (bytes > maxContextTokens || scanned > 1000) { complete = false; break; }
      pins.push({ nativeMessageId: native._id, order: native.order, stepOrder: native.stepOrder,
        sourceEventId: bridge.sourceEventId, sourceRevision: bridge.revision, contentHash: bridge.contentHash,
        canonicalContentHash: await canonicalMessageHash(native) });
    }
    if (!complete || result.isDone) break;
    if (!result.continueCursor || result.continueCursor === cursor) transcriptDenied("TRANSCRIPT_CONFLICT"); cursor = result.continueCursor;
  } while (true);
  if (complete && !inputPins.every(pin => pins.some(p => p.nativeMessageId === pin.nativeMessageId))) transcriptDenied("STALE_TRANSCRIPT");
  const ingestion = await readScopeSequence(ctx, run.authorityReference);
  const graph = await ctx.db.query("runtimeGraphScopes").withIndex("by_scope", q => q.eq("tenantId", conversation.tenantId).eq("memorySpaceId", conversation.memorySpaceId)).unique();
  const snapshot: CutoffV1 = { version: 1, conversationId: conversation.conversationId, threadId: conversation.threadId,
    conversationEpoch: conversation.epoch, historyRevision: executionRevision(conversation), queueSequence: run.queueSequence,
    runDocId: run._id, attemptNumber: run.attemptNumber + 1, definitionVersion: run.agentVersion, definitionHash: run.definitionHash,
    anchor, messages: pins.sort(comparePosition), ingestionCutoff: { scopeIdentity: canonicalModelJson([conversation.tenantId, conversation.memorySpaceId]),
      sequence: ingestion.sequence, graphSequence: graph?.sequence ?? 0, requiredStages }, capturedAuthorityReference: run.authorityReference, completeness: complete ? "complete" : "incomplete" };
  if (utf8Bytes(canonicalModelJson(snapshot)) > 180_000) transcriptDenied("CONTEXT_INCOMPLETE");
  return snapshot;
}
export async function hydrateCutoff(ctx: ReadCtx, conversation: ManagedConversation, run: Doc<"runtimeRuns">, snapshot: CutoffV1) {
  await checkConversation(ctx, run.authorityReference, conversation, "run");
  if (snapshot.completeness !== "complete" || snapshot.conversationId !== conversation.conversationId || snapshot.threadId !== conversation.threadId
    || snapshot.conversationEpoch !== conversation.epoch || snapshot.historyRevision !== executionRevision(conversation)
    || snapshot.runDocId !== run._id || snapshot.queueSequence !== run.queueSequence || snapshot.attemptNumber !== run.attemptNumber
    || snapshot.definitionHash !== run.definitionHash || snapshot.definitionVersion !== run.agentVersion
    || canonicalModelJson(snapshot.capturedAuthorityReference) !== canonicalModelJson(run.authorityReference)) transcriptDenied("STALE_TRANSCRIPT");
  const result: { role: "user" | "assistant" | "tool"; parts: { type: "text"; text: string }[] }[] = [];
  if (!snapshot.messages.some(pin => canonicalModelJson(pin) === canonicalModelJson(snapshot.anchor))) transcriptDenied("STALE_TRANSCRIPT");
  for (let offset = 0; offset < snapshot.messages.length; offset += 100) {
    const chunk = snapshot.messages.slice(offset, offset + 100); const native = await nativeById(ctx, chunk.map(pin => pin.nativeMessageId));
    for (let i = 0; i < chunk.length; i++) {
      const pin = chunk[i]; const bridge = await bridgeFor(ctx, conversation, pin.nativeMessageId);
      if (!bridge || !bridge.approved || bridge.sourceEventId !== pin.sourceEventId || bridge.revision !== pin.sourceRevision
        || bridge.contentHash !== pin.contentHash || comparePosition(bridge, pin) !== 0) transcriptDenied("STALE_TRANSCRIPT");
      const checked = await verifyMessage(ctx, conversation, bridge, native[i]);
      if (pin.canonicalContentHash !== undefined && await canonicalMessageHash(checked) !== pin.canonicalContentHash) transcriptDenied("STALE_TRANSCRIPT");
      await checkNativeMediaReferences(ctx, run.authorityReference, checked);
      await checkArtifactContextWitnesses(ctx, run.authorityReference, bridge.artifactContextWitnesses ?? []);
      result.push(content(checked));
    }
  }
  return result;
}
/** Same complete cutoff fence, with full private tool calls/results retained for model input. */
export async function hydratePrivateCutoff(ctx: ReadCtx, conversation: ManagedConversation, run: Doc<"runtimeRuns">, snapshot: CutoffV1): Promise<ModelMessage[]> {
  await hydrateCutoff(ctx, conversation, run, snapshot);
  const result: ModelMessage[] = []; const checkedAttempts = new Set<string>();
  for (let offset = 0; offset < snapshot.messages.length; offset += 100) {
    const pins = snapshot.messages.slice(offset, offset + 100);
    const messages = await nativeById(ctx, pins.map(pin => pin.nativeMessageId));
    for (let i = 0; i < pins.length; i++) {
      const message = messages[i];
      if (!message || !pins[i].canonicalContentHash || await canonicalMessageHash(message) !== pins[i].canonicalContentHash) transcriptDenied("STALE_TRANSCRIPT");
      // Private tool results remain native history, but their injected memory is
      // source-attributed by the server execution that saved them. A later turn
      // must not resurrect stale recalled context merely because its bytes match.
      const bridge = await bridgeFor(ctx, conversation, message._id);
      if (bridge?.contextSourceWitnesses?.length) await currentPrivateSources(ctx, run.authorityReference, bridge.contextSourceWitnesses);
      await checkNativeMediaReferences(ctx, run.authorityReference, message);
      await checkArtifactContextWitnesses(ctx, run.authorityReference, bridge?.artifactContextWitnesses ?? []);
      const label = message.agentName?.match(/^cortex:(.+):([1-9]\d*):(\d+)$/);
      const ownerRunId = bridge?.runId ?? label?.[1]; const ownerAttempt = bridge?.attemptNumber ?? (label ? Number(label[2]) : undefined);
      if (ownerRunId && ownerAttempt !== undefined) {
        const owner = singleTranscript(await ctx.db.query("runtimeAgentExecutions").withIndex("by_attempt", q => q.eq("tenantId", conversation.tenantId)
          .eq("memorySpaceId", conversation.memorySpaceId).eq("runId", ownerRunId).eq("attemptNumber", ownerAttempt)).take(2));
        // Task05 manual/non-Agent outputs have no private Agent context owner.
        if (label && !owner) transcriptDenied("STALE_CONTEXT");
        const manuallyRevised = bridge && bridge.revision > 1 && message.message?.role !== "tool"
          && (typeof message.message?.content === "string" || message.message?.content.every(part => part.type === "text"));
        if (owner && !manuallyRevised) {
          const pin = owner.savedMessagePins?.find(item => item.id === message._id);
          if (owner.state !== "complete" || !pin || pin.order !== message.order || pin.stepOrder !== message.stepOrder
            || pin.canonicalContentHash !== pins[i].canonicalContentHash) transcriptDenied("STALE_CONTEXT");
          const ownerKey = canonicalModelJson([ownerRunId, ownerAttempt]);
          if (!checkedAttempts.has(ownerKey)) {
            checkedAttempts.add(ownerKey);
            await currentPrivateSources(ctx, run.authorityReference, owner.sourceWitnesses);
            await checkArtifactContextWitnesses(ctx, run.authorityReference, owner.artifactContextWitnesses ?? []);
          }
        }
      }
      result.push(privateModelMessage(message));
    }
  }
  return result;
}
const selector = { conversationId: v.string(), memorySpaceId: v.optional(v.string()), tenantId: v.optional(v.string()) };
export const create = mutation({ args: { memorySpaceId: v.optional(v.string()), clientRequestId: v.string(),
  type: v.optional(v.union(v.literal("user-agent"), v.literal("agent-agent"))), participants: v.optional(v.array(v.string())),
  visibility: v.optional(v.union(v.literal("private"), v.literal("space"))), retentionUntil: v.optional(v.number()), requireApproval: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const actor = await requireDataAuthority(ctx, { memorySpaceId: args.memorySpaceId }, "write"); clientRequestKey(args.clientRequestId);
    const identity = canonicalModelJson(["conversation.create.v1", actor.tenantId, actor.memorySpaceId, actor.principalId, args.clientRequestId]);
    const options = Object.fromEntries(Object.entries(args).filter(([key, value]) => key !== "memorySpaceId" && key !== "clientRequestId" && value !== undefined));
    return publicConversation(await createManagedConversation(ctx, actor, identity, canonicalModelJson(options), options));
  } });
export const get = mutation({ args: selector, handler: async (ctx, args) => publicConversation((await requireConversation(ctx, args, args.conversationId, "read")).conversation) });
export const list = mutation({ args: { memorySpaceId: v.optional(v.string()), tenantId: v.optional(v.string()), limit: v.optional(v.number()) }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"); const reference = dataAuthorityReference(actor);
  const limit = args.limit ?? 100; if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) transcriptDenied("INVALID_INPUT");
  const rows = await ctx.db.query("runtimeConversations").withIndex("by_scope", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId)).order("desc").take(1000);
  const visible: ReturnType<typeof publicConversation>[] = [];
  for (const row of rows) {
    try { await checkConversation(ctx, reference, row, "read"); } catch (error) { if (error instanceof ConvexError && error.data.code === "FORBIDDEN") continue; throw error; }
    visible.push(publicConversation(row)); if (visible.length === limit) break;
  }
  return visible;
} });
export const messages = mutation({ args: { ...selector, cursor: v.optional(v.union(v.string(), v.null())), limit: v.optional(v.number()) }, handler: async (ctx, args) => {
  const { conversation, reference } = await requireConversation(ctx, args, args.conversationId, "read");
  return await readTranscriptPage(ctx, conversation, reference, args.cursor ?? null, args.limit);
} });
export const setPolicy = mutation({ args: { ...selector, expectedRevision: v.number(), manualWriteLocked: v.optional(v.boolean()),
  participants: v.optional(v.array(v.string())), visibility: v.optional(v.union(v.literal("private"), v.literal("space"))), requireApproval: v.optional(v.boolean()), retentionUntil: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { conversation, reference } = await requireConversation(ctx, args, args.conversationId, "admin");
    if (conversation.historyRevision !== args.expectedRevision) transcriptDenied("IDEMPOTENCY_CONFLICT");
    const patch: Partial<ManagedConversation> = { updatedAt: Date.now() };
    for (const key of ["manualWriteLocked", "visibility", "requireApproval", "retentionUntil"] as const) if (args[key] !== undefined) Object.assign(patch, { [key]: args[key] });
    if (args.retentionUntil !== undefined && (!Number.isSafeInteger(args.retentionUntil) || args.retentionUntil <= Date.now())) transcriptDenied("INVALID_INPUT");
    if (args.participants !== undefined) {
      if (args.participants.length > 64) transcriptDenied("INVALID_INPUT");
      for (const id of args.participants) {
        const principal = ctx.db.normalizeId("runtimeAuthPrincipals", boundedIdentifier(id)); if (!principal) transcriptDenied();
        const membership = singleTranscript(await ctx.db.query("runtimeAuthMemberships").withIndex("by_principal_tenant", q => q.eq("principalId", principal).eq("tenantId", reference.tenantId)).take(2));
        if (!membership || membership.revokedAt !== undefined || membership.deletedAt !== undefined) transcriptDenied();
      }
      patch.participants = [...new Set([conversation.ownerPrincipalId, ...args.participants])];
    }
    // Policy changes fence deferred readers/dispatch as well as manual changes.
    patch.historyRevision = conversation.historyRevision + 1; patch.executionRevision = executionRevision(conversation) + 1;
    await ctx.db.patch("runtimeConversations", conversation._id, patch); return { updated: true as const, historyRevision: patch.historyRevision };
  } });
export async function manualAppend(ctx: MutationCtx, args: { conversationId: string; memorySpaceId?: string; tenantId?: string;
  expectedRevision: number; parts: { type: "text"; text: string }[]; role: "user" | "assistant" }) {
  const { conversation, reference } = await requireConversation(ctx, args, args.conversationId, "write");
  if (conversation.manualWriteLocked) transcriptDenied("TRANSCRIPT_LOCKED");
  if (args.expectedRevision !== conversation.historyRevision) transcriptDenied("IDEMPOTENCY_CONFLICT");
  const parts = normalizeTextSubmit({ version: 1, agentId: "manual", agentVersion: 1, clientRequestId: "manual", parts: args.parts }).userInput.parts;
  const saved = await saveMessages(ctx, agentComponent, { threadId: conversation.threadId, userId: reference.principalId,
    order: "next", messages: [{ role: args.role, content: parts }], failPendingSteps: false });
  return await registerMessages(ctx, conversation, reference, saved.messages, { approved: !conversation.requireApproval });
}
export const append = mutation({ args: { ...selector, expectedRevision: v.number(), role: v.union(v.literal("user"), v.literal("assistant")),
  parts: v.array(v.object({ type: v.literal("text"), text: v.string() })) }, handler: manualAppend });
export async function reviseMessage(ctx: MutationCtx, args: { conversationId: string; memorySpaceId?: string; tenantId?: string;
  expectedRevision: number; messageId: string; expectedMessageRevision: number; parts?: { type: "text"; text: string }[] }, remove: boolean) {
  const { conversation, reference } = await requireConversation(ctx, args, args.conversationId, "write");
  if (conversation.manualWriteLocked) transcriptDenied("TRANSCRIPT_LOCKED");
  if (conversation.historyRevision !== args.expectedRevision) transcriptDenied("IDEMPOTENCY_CONFLICT");
  const bridge = await bridgeFor(ctx, conversation, args.messageId);
  if (!bridge || bridge.revision !== args.expectedMessageRevision || bridge.role === "tool") transcriptDenied("STALE_TRANSCRIPT");
  const native = await verifyMessage(ctx, conversation, bridge, (await nativeById(ctx, [args.messageId]))[0]);
  // A text-only edit/removal cannot remove one half of canonical tool history.
  // Fork or delete the conversation instead; paired tool payloads remain immutable.
  if (native.message?.role === "assistant" && Array.isArray(native.message.content)
    && native.message.content.some(part => part.type === "tool-call")) transcriptDenied("TOOL_HISTORY_EDIT_DENIED");
  const now = Date.now(); const revision = bridge.revision + 1;
  await releaseAssetReferences(ctx, { tenantId: conversation.tenantId, memorySpaceId: conversation.memorySpaceId }, "agent", bridge.nativeMessageId);
  if (remove) {
    await ctx.runMutation(agentComponent.messages.deleteByIds, { messageIds: [args.messageId] });
    await ctx.db.patch("runtimeTranscriptMessages", bridge._id, { tombstonedAt: now, revision, actorReference: reference, updatedAt: now });
    const source = singleTranscript(await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", reference.tenantId)
      .eq("memorySpaceId", reference.memorySpaceId!).eq("lineage.sourceId", bridge.sourceId)).take(2));
    if (source && source.tombstonedAt === undefined) await ctx.db.patch("runtimeMemorySources", source._id, { tombstonedAt: now });
  } else {
    const parts = normalizeTextSubmit({ version: 1, agentId: "manual", agentVersion: 1, clientRequestId: "manual", parts: args.parts }).userInput.parts;
    const changed = await ctx.runMutation(agentComponent.messages.updateMessage, { messageId: args.messageId, patch: { message: { role: bridge.role, content: parts } } });
    const hash = await contentHash(changed); const sourceHash = await semanticHash(normalizeSourceText(parts.map(part => part.text).join("\n")));
    await ctx.db.patch("runtimeTranscriptMessages", bridge._id, { revision, contentHash: hash, sourceContentHash: sourceHash, contextSourceWitnesses: undefined, artifactContextWitnesses: undefined, assetVersionIds: undefined, actorReference: reference, updatedAt: now });
    await sourceWrite(ctx, conversation, { ...bridge, revision, sourceContentHash: sourceHash }, parts.map(part => part.text).join("\n"));
  }
  await messageOutbox(ctx, conversation, bridge, "tombstoned");
  if (!remove) await messageOutbox(ctx, conversation, { ...bridge, revision }, bridge.approved ? "registered" : "pending");
  await ctx.db.patch("runtimeConversations", conversation._id, { historyRevision: conversation.historyRevision + 1,
    executionRevision: executionRevision(conversation) + 1, messageCount: conversation.messageCount - (remove ? 1 : 0), updatedAt: now });
  return { messageId: native._id, revision, deleted: remove };
}
const editArgs = { ...selector, expectedRevision: v.number(), messageId: v.string(), expectedMessageRevision: v.number() };
export const edit = mutation({ args: { ...editArgs, parts: v.array(v.object({ type: v.literal("text"), text: v.string() })) }, handler: async (ctx, args) => await reviseMessage(ctx, args, false) });
export const removeMessage = mutation({ args: editArgs, handler: async (ctx, args) => await reviseMessage(ctx, args, true) });
export async function deleteManagedConversation(ctx: MutationCtx, args: { conversationId: string; memorySpaceId?: string; tenantId?: string }) {
  const { conversation, reference } = await requireConversation(ctx, args, args.conversationId, "write");
  if (conversation.manualWriteLocked) transcriptDenied("TRANSCRIPT_LOCKED");
  const now = Date.now();
  await ctx.db.patch("runtimeConversations", conversation._id, { tombstonedAt: now, epoch: conversation.epoch + 1, historyRevision: conversation.historyRevision + 1, executionRevision: executionRevision(conversation) + 1, deletionActorReference: reference, updatedAt: now });
  await ctx.runMutation(makeFunctionReference<"mutation">("runtimeGraph:retireAuthority"), { tenantId: conversation.tenantId,
    memorySpaceId: conversation.memorySpaceId, conversationId: conversation.conversationId });
  await ctx.scheduler.runAfter(0, cleanupReference, { reference, conversationId: conversation.conversationId,
    epoch: conversation.epoch + 1, phase: "messages", cursor: null });
  // Visibility/tombstones commit now; physical component deletion is explicitly paged work.
  await ctx.runMutation(agentComponent.threads.deleteAllForThreadIdAsync, { threadId: conversation.threadId, limit: 100 });
  return { deleted: true as const, cleanup: "scheduled" as const, conversationId: conversation.conversationId, messagesDeleted: 0, hiddenMessageCount: conversation.messageCount, deletedAt: now, restorable: false };
}
const cleanupReference = makeFunctionReference<"mutation", { reference: RuntimeAuthorityReference; conversationId: string;
  epoch: number; phase: "messages" | "runs"; cursor: string | null }, unknown>("runtimeTranscript:cleanupDeleted") as unknown as
  FunctionReference<"mutation", "internal", { reference: RuntimeAuthorityReference; conversationId: string; epoch: number;
    phase: "messages" | "runs"; cursor: string | null }, unknown>;
/** Trusted paged cleanup of already invisible evidence. Grant revocation cannot resurrect it or strand component deletion. */
export const cleanupDeleted = internalMutation({ args: { reference: runtimeAuthorityReference, conversationId: v.string(), epoch: v.number(),
  phase: v.union(v.literal("messages"), v.literal("runs")), cursor: v.union(v.string(), v.null()) }, handler: async (ctx, args) => {
  const conversation = await conversationById(ctx, args.reference, args.conversationId);
  if (!conversation || conversation.tombstonedAt === undefined || conversation.epoch !== args.epoch
    || !conversation.deletionActorReference || canonicalModelJson(conversation.deletionActorReference) !== canonicalModelJson(args.reference)) transcriptDenied();
  const now = conversation.tombstonedAt;
  if (args.phase === "messages") {
    const page = await ctx.db.query("runtimeTranscriptMessages").withIndex("by_conversation_position", q => q.eq("tenantId", conversation.tenantId)
      .eq("memorySpaceId", conversation.memorySpaceId).eq("conversationId", conversation.conversationId)).paginate({ cursor: args.cursor, numItems: 100 });
    for (const bridge of page.page) {
      if (bridge.tombstonedAt !== undefined) continue;
      await releaseAssetReferences(ctx, { tenantId: conversation.tenantId, memorySpaceId: conversation.memorySpaceId }, "agent", bridge.nativeMessageId);
      await ctx.db.patch("runtimeTranscriptMessages", bridge._id, { tombstonedAt: now, revision: bridge.revision + 1, updatedAt: now });
      const source = singleTranscript(await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", conversation.tenantId)
        .eq("memorySpaceId", conversation.memorySpaceId).eq("lineage.sourceId", bridge.sourceId)).take(2));
      if (source && source.tombstonedAt === undefined) await ctx.db.patch("runtimeMemorySources", source._id, { tombstonedAt: now });
      await retireSourceEvents(ctx, args.reference, bridge.sourceId, "tombstoned");
    }
    await ctx.scheduler.runAfter(0, cleanupReference, { ...args, phase: page.isDone ? "runs" : "messages", cursor: page.isDone ? null : page.continueCursor });
  } else {
    const page = await ctx.db.query("runtimeRuns").withIndex("by_conversation_queue", q => q.eq("tenantId", conversation.tenantId)
      .eq("memorySpaceId", conversation.memorySpaceId).eq("conversationId", conversation.conversationId)).paginate({ cursor: args.cursor, numItems: 100 });
    for (const row of page.page) {
      await ctx.db.patch("runtimeRuns", row._id, { tombstonedAt: now, cancellationRequestedAt: now, responseStatus: "cancelled", cancelledAt: now, updatedAt: now });
      const outbox = singleTranscript(await ctx.db.query("runtimeRunOutbox").withIndex("by_run", q => q.eq("tenantId", row.tenantId).eq("memorySpaceId", row.memorySpaceId).eq("runId", row.runId)).take(2));
      if (outbox) await ctx.db.patch("runtimeRunOutbox", outbox._id, { state: "complete", updatedAt: now });
      if (row.attemptNumber) {
        const attempt = singleTranscript(await ctx.db.query("runtimeRunAttempts").withIndex("by_run_attempt", q => q.eq("tenantId", row.tenantId).eq("memorySpaceId", row.memorySpaceId).eq("runId", row.runId).eq("attemptNumber", row.attemptNumber)).take(2));
        if (attempt?.status === "running") await ctx.db.patch("runtimeRunAttempts", attempt._id, { status: "cancelled", failureCode: "CONVERSATION_DELETED", endedAt: now });
      }
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, cleanupReference, { ...args, cursor: page.continueCursor });
  }
  return { processed: true as const };
} });
export const remove = mutation({ args: selector, handler: deleteManagedConversation });
export const exportPage = mutation({ args: { ...selector, cursor: v.optional(v.union(v.string(), v.null())), limit: v.optional(v.number()) }, handler: async (ctx, args) => {
  const { conversation, reference } = await requireConversation(ctx, args, args.conversationId, "read");
  await managedConversationAccess(ctx, reference, conversation, "read", "canExport");
  return await readTranscriptPage(ctx, conversation, reference, args.cursor ?? null, args.limit);
} });
export const stats = mutation({ args: selector, handler: async (ctx, args) => {
  const { conversation } = await requireConversation(ctx, args, args.conversationId, "read");
  return { conversationId: conversation.conversationId, messageCount: conversation.messageCount, historyRevision: conversation.historyRevision, createdAt: conversation.createdAt, updatedAt: conversation.updatedAt };
} });
export const fork = mutation({ args: { ...selector, clientRequestId: v.string(), expectedRevision: v.number() }, handler: async (ctx, args) => {
  const { conversation, actor, reference } = await requireConversation(ctx, args, args.conversationId, "read");
  await recheckDataAuthority(ctx, reference, "write");
  await managedConversationAccess(ctx, reference, conversation, "read", "canFork"); clientRequestKey(args.clientRequestId);
  if (conversation.historyRevision !== args.expectedRevision) transcriptDenied("STALE_TRANSCRIPT");
  const identity = canonicalModelJson(["conversation.fork.v1", actor.tenantId, actor.memorySpaceId, actor.principalId, conversation.conversationId, args.clientRequestId]);
  const canonical = canonicalModelJson({ source: conversation.conversationId, revision: args.expectedRevision });
  const id = `conversation:${await semanticHash(identity)}`; const existing = await conversationById(ctx, reference, id);
  if (existing) { await checkConversation(ctx, reference, existing, "write"); if (existing.creationCanonical !== canonical) transcriptDenied("IDEMPOTENCY_CONFLICT"); return publicConversation(existing); }
  let target = await createManagedConversation(ctx, actor, identity, canonical, { forkedFrom: conversation.conversationId });
  let cursor: string | null = null;
  do {
    const page = await readTranscriptPage(ctx, conversation, reference, cursor, 100);
    for (const message of page.page) {
      if (message.status !== "success") continue;
      const native = (await nativeById(ctx, [message.id]))[0];
      const sourceBridge = await bridgeFor(ctx, conversation, message.id);
      if (!sourceBridge || !native) transcriptDenied("STALE_TRANSCRIPT");
      await verifyMessage(ctx, conversation, sourceBridge, native);
      await currentPrivateSources(ctx, reference, sourceBridge.contextSourceWitnesses ?? []);
      await checkArtifactContextWitnesses(ctx, reference, sourceBridge.artifactContextWitnesses ?? []);
      const saved = await saveMessages(ctx, agentComponent, { threadId: target.threadId, userId: actor.principalId, order: "next",
        messages: [privateModelMessage(native)], failPendingSteps: false });
      await registerMessages(ctx, target, reference, saved.messages, { trustedToolMessages: true, contextSourceWitnesses: sourceBridge.contextSourceWitnesses, artifactContextWitnesses: sourceBridge.artifactContextWitnesses }); target = (await ctx.db.get("runtimeConversations", target._id))!;
    }
    cursor = page.continueCursor;
  } while (cursor !== null);
  return publicConversation(target);
} });
/** Rebuild metadata-only projection/outbox from every registered native message, never a recent-100 cursor. */
export const rebuild = internalMutation({ args: { reference: runtimeAuthorityReference, conversationId: v.string() }, handler: async (ctx, args) => {
  const conversation = await conversationById(ctx, args.reference, args.conversationId); if (!conversation) transcriptDenied();
  await checkConversation(ctx, args.reference, conversation, "admin");
  let cursor: string | null = null; let count = 0;
  do {
    const result: { page: MessageDoc[]; isDone: boolean; continueCursor: string } = await ctx.runQuery(agentComponent.messages.listMessagesByThreadId, { threadId: conversation.threadId, order: "asc", paginationOpts: { cursor, numItems: 100 } });
    for (const native of result.page) {
      const bridge = await bridgeFor(ctx, conversation, native._id);
      // Unregistered outputs must be attached by the owning Task07 attempt, never adopted as evidence.
      if (!bridge || bridge.tombstonedAt !== undefined) continue;
      await verifyMessage(ctx, conversation, bridge, native); count++;
      await messageOutbox(ctx, conversation, bridge, native.status === "success" && bridge.approved ? "registered" : "pending");
    }
    if (result.isDone) break; if (!result.continueCursor || result.continueCursor === cursor) transcriptDenied("TRANSCRIPT_CONFLICT"); cursor = result.continueCursor;
  } while (true);
  await ctx.db.patch("runtimeConversations", conversation._id, { messageCount: count }); return { registeredMessages: count };
} });
