import { deliveryExpiresAt } from "./runtimeDelivery";
import { readArtifactContext } from "./runtimeArtifactContext";
/** Durable media orchestration. Only pending jobs may submit; uncertainty never retries inference. */
import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { mutation, internalMutation, internalAction } from "./_generated/server";
import type { MutationCtx, ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { ContextSourceWitness } from "../src/domain/context-witness";
import type { RuntimeMediaJobV1, MediaSubmitV1, MediaJobState } from "../src/domain/media-jobs";
import { mediaSubmitSchema, MEDIA_LEASE_MS, MEDIA_OPERATION_RETENTION_MS, MEDIA_MAX_DOWNLOAD_ATTEMPTS, MEDIA_MAX_POLLS, mediaResultSchema } from "../src/domain/media-jobs";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { requireDataAuthority, dataAuthorityReference, managedConversationAccess } from "./runtimeDataAuth";
import { recheckAuthority } from "./runtimeAuth";
import { bindTrustedBudget, mediaResultPublicationAllowed } from "./runtimeModelPolicy";
import { assetVersion, authorizeAsset, publicAsset, versionById, syncArtifactAssets, releaseAssetReferences } from "./runtimeAssetCatalog";
import { checkMediaJob, mediaDenied } from "./runtimeMediaFence";
import { processSubmissionHandler, processPollHandler, processDownloadHandler } from "./runtimeMediaGateway";
import { contextSourceWitness } from "./runtimeContextWitnessSchema";
import { guardAgentRunBudget } from "./runtimeAgentFence";
type Job = Doc<"runtimeMediaJobs">;
const selectors = { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) };
const jobSelector = { ...selectors, jobId: v.string() };
const ref = (name: string) => makeFunctionReference<"mutation">(`runtimeMediaJobs:${name}`);
const action = (name: string) => makeFunctionReference<"action">(`runtimeMediaJobs:${name}`);
const terminal = (state: MediaJobState) => ["ready", "failed", "cancelled", "expired"].includes(state);
export async function mediaJob(ctx: Pick<MutationCtx, "db">, jobId: string): Promise<Job> {
  const row = await ctx.db.query("runtimeMediaJobs").withIndex("by_job", q => q.eq("jobId", jobId)).unique();
  if (!row) mediaDenied("MEDIA_JOB_NOT_FOUND"); return row;
}
export async function publicMediaJob(ctx: Pick<MutationCtx, "db">, job: Job, reference: RuntimeAuthorityReference): Promise<RuntimeMediaJobV1> {
  const deadlines: number[] = []; await checkMediaJob(ctx, job, reference, false, deadlines);
  const asset = job.assetVersionId ? await versionById(ctx, job, job.assetVersionId) : undefined;
  if (asset) await authorizeAsset(ctx, reference, asset, "storage:read", new Set(), deadlines);
  const expiresAt = await deliveryExpiresAt(ctx, reference, deadlines);
  return { version: 1, jobId: job.jobId, artifactId: job.artifactId, kind: job.kind, state: job.state, revision: job.revision,
    createdAt: job.createdAt, updatedAt: job.updatedAt, ...(expiresAt === undefined ? {} : { deliveryExpiresAt: expiresAt }), ...(asset ? { asset: publicAsset(asset) } : {}),
    ...(job.failureCode ? { failureCode: job.failureCode } : {}), costStatus: job.costStatus,
    upstreamCancellation: job.cancelledAt === undefined ? "not_requested" : "not_supported" };
}
export async function enqueueMediaJob(ctx: MutationCtx, reference: RuntimeAuthorityReference, input: MediaSubmitV1,
  binding?: { runBudgetId: string; runAccountId: Id<"runtimeBudgetAccounts">; parentOperationId: Id<"runtimeModelOperations">; witnesses: ContextSourceWitness[] }) {
  const parsed = mediaSubmitSchema.safeParse(input); if (!parsed.success || !reference.memorySpaceId) mediaDenied("INVALID_MEDIA_INPUT");
  const args = parsed.data; const s = { tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId };
  for (const capability of ["run", "write", "storage:write"] as const) await recheckAuthority(ctx, reference, { ...s, capability });
  let conversationId: string | undefined;
  if (args.conversationId) {
    const conversation = await ctx.db.query("runtimeConversations").withIndex("by_scoped_id", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("conversationId", args.conversationId!)).unique();
    if (!conversation) mediaDenied(); await managedConversationAccess(ctx, reference, conversation, "write"); conversationId = conversation.conversationId;
  }
  let inputBinding: Job["input"];
  if (args.inputAsset) {
    const value = await assetVersion(ctx, s, args.inputAsset.assetId, args.inputAsset.version);
    if (!value || value.mimeType !== "image/png" || args.kind !== "video" || value.sizeBytes > 4096) mediaDenied("MEDIA_INPUT_UNSUPPORTED");
    await authorizeAsset(ctx, reference, value); inputBinding = { assetId: value.assetId, assetVersion: value.assetVersion, versionId: value.versionId, contentHash: value.contentHash, sizeBytes: value.sizeBytes, mimeType: "image/png" };
  }
  const requestCanonical = canonicalModelJson({ ...args, ...(inputBinding ? { inputBinding } : {}), ...(binding ? { runBudgetId: binding.runBudgetId, parentOperationId: binding.parentOperationId, witnesses: binding.witnesses } : {}) });
  const existing = await ctx.db.query("runtimeMediaJobs").withIndex("by_request", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("ownerPrincipalId", reference.principalId).eq("requestId", args.requestId)).unique();
  if (existing) { if (existing.requestCanonical !== requestCanonical) mediaDenied("MEDIA_IDEMPOTENCY_CONFLICT"); return publicMediaJob(ctx, existing, reference); }
  const jobId = `media:${await semanticHash(canonicalModelJson([s, reference.principalId, args.requestId]))}`;
  const artifactId = `artifact:${jobId}`;
  await recheckAuthority(ctx, reference, { ...s, capability: "write", resource: { ...s, resourceType: "artifact", resourceId: artifactId, ownerPrincipalId: reference.principalId } });
  if (await ctx.db.query("artifacts").withIndex("by_runtime_key", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("artifactId", artifactId)).first()) mediaDenied("MEDIA_IDEMPOTENCY_CONFLICT");
  const key = args.kind === "image" ? "media.image.generate" : "media.video.generate";
  const budget = binding ?? await bindTrustedBudget(ctx, { reference, operationKey: key, requestId: jobId, requestCanonical });
  if (binding) { const account = await ctx.db.get("runtimeBudgetAccounts", binding.runAccountId); const parent = await ctx.db.get("runtimeModelOperations", binding.parentOperationId);
    if (!account || account.runBudgetId !== binding.runBudgetId || canonicalModelJson(account.reference) !== canonicalModelJson(reference) || !parent || parent.runAccountId !== account._id || parent.operationKey !== "agent.respond") mediaDenied();
    await guardAgentRunBudget(ctx, reference, account._id);
  }
  const now = Date.now(); const title = args.kind === "image" ? "Generated image" : "Generated video";
  await ctx.db.insert("artifacts", { ...s, artifactId, ownerPrincipalId: reference.principalId, lastActorPrincipalId: reference.principalId,
    kind: args.kind, streamingState: "draft", title, content: "", version: 1, versionPointer: 1,
    versionHistory: [{ version: 1, content: "", title, timestamp: now, changedBy: reference.principalId, changeType: "create" }],
    tags: [], metadata: { version: 1, mediaJobId: jobId }, ...(conversationId ? { conversationRef: { conversationId } } : {}), createdAt: now, updatedAt: now });
  const id = await ctx.db.insert("runtimeMediaJobs", { ...s, ownerPrincipalId: reference.principalId, jobId, artifactId,
    requestId: args.requestId, requestCanonical, kind: args.kind, prompt: args.prompt, reference, ...(conversationId ? { conversationId } : {}), ...(inputBinding ? { input: inputBinding } : {}),
    contextSourceWitnesses: binding?.witnesses ?? [], runBudgetId: budget.runBudgetId, runAccountId: budget.runAccountId,
    ...(binding ? { parentOperationId: binding.parentOperationId } : {}), state: "pending", revision: 1, expiresAt: now + MEDIA_OPERATION_RETENTION_MS,
    createdAt: now, updatedAt: now, costStatus: "reserved", downloadAttempt: 0, pollCount: 0 });
  await ctx.scheduler.runAfter(MEDIA_OPERATION_RETENTION_MS, ref("expireJob"), { jobId });
  if (!binding) await ctx.scheduler.runAfter(0, action("processSubmission"), { jobId });
  return publicMediaJob(ctx, (await ctx.db.get("runtimeMediaJobs", id))!, reference);
}
export async function submitMediaHandler(ctx: MutationCtx, args: MediaSubmitV1 & { tenantId?: string; memorySpaceId?: string }) {
  const actor = await requireDataAuthority(ctx, args, "run"); const { tenantId: _tenant, memorySpaceId: _space, ...input } = args;
  return enqueueMediaJob(ctx, dataAuthorityReference(actor), input);
}
export const submit = mutation({ args: { ...selectors, requestId: v.string(), kind: v.union(v.literal("image"), v.literal("video")), prompt: v.string(), inputAsset: v.optional(v.object({ assetId: v.string(), version: v.number() })), conversationId: v.optional(v.string()) }, handler: submitMediaHandler });
export const enqueueTrusted = internalMutation({ args: { reference: runtimeAuthorityReference, requestId: v.string(), kind: v.union(v.literal("image"), v.literal("video")), prompt: v.string(), conversationId: v.string(), runBudgetId: v.string(), runAccountId: v.id("runtimeBudgetAccounts"), parentOperationId: v.id("runtimeModelOperations"), witnesses: v.array(contextSourceWitness) }, handler: async (ctx, args) => enqueueMediaJob(ctx, args.reference, { requestId: args.requestId, kind: args.kind, prompt: args.prompt, conversationId: args.conversationId }, { runBudgetId: args.runBudgetId, runAccountId: args.runAccountId, parentOperationId: args.parentOperationId, witnesses: args.witnesses }) });
export const get = mutation({ args: jobSelector, handler: async (ctx, args) => publicMediaJob(ctx, await mediaJob(ctx, args.jobId), dataAuthorityReference(await requireDataAuthority(ctx, args, "read"))) });
export const getTrusted = internalMutation({ args: { reference: runtimeAuthorityReference, jobId: v.string() }, handler: async (ctx, args) => publicMediaJob(ctx, await mediaJob(ctx, args.jobId), args.reference) });
export const readArtifactTrusted = internalMutation({ args: { reference: runtimeAuthorityReference, artifactId: v.string() }, handler: async (ctx, args) => {
  return await readArtifactContext(ctx, args.reference, args.artifactId);
} });
export const list = mutation({ args: { ...selectors, conversationId: v.optional(v.string()), limit: v.optional(v.number()) }, handler: async (ctx, args) => {
  const actor = await requireDataAuthority(ctx, args, "read"); const reference = dataAuthorityReference(actor); const limit = args.limit ?? 20;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) mediaDenied("INVALID_MEDIA_INPUT");
  await recheckAuthority(ctx, reference, { capability: "storage:read", tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId });
  const rows = await ctx.db.query("runtimeMediaJobs").withIndex("by_owner", q => q.eq("tenantId", actor.tenantId).eq("memorySpaceId", actor.memorySpaceId).eq("ownerPrincipalId", actor.principalId)).order("desc").take(50);
  const jobs = [];
  for (const row of rows.filter(row => !args.conversationId || row.conversationId === args.conversationId)) {
    try { jobs.push(await publicMediaJob(ctx, row, reference)); }
    catch (error) {
      // Scope authority is checked before and after this bounded resource
      // filter. A retired/inaccessible neighbor cannot block current jobs.
      if (!(error instanceof ConvexError) || !error.data || typeof error.data !== "object" || !("code" in error.data)
        || !["FORBIDDEN", "STALE_CONTEXT", "STALE_MEDIA_INPUT"].includes(String(error.data.code))) throw error;
    }
    if (jobs.length >= limit) break;
  }
  await recheckAuthority(ctx, reference, { capability: "read", tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId });
  await recheckAuthority(ctx, reference, { capability: "storage:read", tenantId: actor.tenantId, memorySpaceId: actor.memorySpaceId });
  return { version: 1 as const, jobs };
} });
export const cancel = mutation({ args: jobSelector, handler: async (ctx, args) => {
  const reference = dataAuthorityReference(await requireDataAuthority(ctx, args, "write")); const job = await mediaJob(ctx, args.jobId); const artifact = await checkMediaJob(ctx, job, reference, true);
  if (job.state === "ready") mediaDenied("MEDIA_ALREADY_READY");
  if (!terminal(job.state)) { await ctx.db.patch("runtimeMediaJobs", job._id, { state: "cancelled", cancelledAt: Date.now(), revision: job.revision + 1, updatedAt: Date.now() }); await ctx.db.patch("artifacts", artifact._id, { streamingState: "error", updatedAt: Date.now() }); await ctx.scheduler.runAfter(0, ref("cleanupOutput"), { jobId: job.jobId }); }
  return publicMediaJob(ctx, await mediaJob(ctx, job.jobId), reference);
} });
export const reconcile = mutation({ args: jobSelector, handler: async (ctx, args) => {
  const reference = dataAuthorityReference(await requireDataAuthority(ctx, args, "write")); const job = await mediaJob(ctx, args.jobId); await checkMediaJob(ctx, job, reference, true);
  if (job.state === "submitting" && Date.now() >= (job.leaseExpiresAt ?? 0)) await transition(ctx, job, "submission_unknown", "MEDIA_SUBMISSION_UNKNOWN");
  else if (job.state === "downloading" || job.state === "processing" && job.operation) await ctx.scheduler.runAfter(0, action(job.state === "downloading" ? "processDownload" : "processPoll"), { jobId: job.jobId });
  return publicMediaJob(ctx, await mediaJob(ctx, job.jobId), reference);
} });
async function transition(ctx: MutationCtx, job: Job, state: MediaJobState, failureCode?: string) { await ctx.db.patch("runtimeMediaJobs", job._id, { state, ...(failureCode ? { failureCode } : {}), revision: job.revision + 1, updatedAt: Date.now() }); if (["failed", "cancelled", "expired"].includes(state)) await ctx.scheduler.runAfter(0, ref("cleanupOutput"), { jobId: job.jobId }); }
export const claimSubmission = internalMutation({ args: { jobId: v.string() }, handler: async (ctx, args) => {
  const job = await mediaJob(ctx, args.jobId); if (job.state !== "pending") return null; await checkMediaJob(ctx, job, job.reference, true);
  const leaseToken = crypto.randomUUID(); await ctx.db.patch("runtimeMediaJobs", job._id, { state: "submitting", leaseToken, leaseExpiresAt: Date.now() + MEDIA_LEASE_MS, revision: job.revision + 1, updatedAt: Date.now() });
  await ctx.scheduler.runAfter(MEDIA_LEASE_MS, ref("expireSubmission"), { jobId: job.jobId, leaseToken }); return { ...job, state: "submitting" as const, leaseToken };
} });
export const expireSubmission = internalMutation({ args: { jobId: v.string(), leaseToken: v.string() }, handler: async (ctx, args) => { const job = await mediaJob(ctx, args.jobId); if (job.state === "submitting" && job.leaseToken === args.leaseToken && Date.now() >= (job.leaseExpiresAt ?? 0)) await transition(ctx, job, "submission_unknown", "MEDIA_SUBMISSION_UNKNOWN"); return null; } });
export const chargeState = internalMutation({ args: { jobId: v.string() }, handler: async (ctx, args) => mediaJob(ctx, args.jobId) });
export const checkpoint = internalMutation({ args: { jobId: v.string(), leaseToken: v.optional(v.string()) }, handler: async (ctx, args) => {
  const job = await mediaJob(ctx, args.jobId); if (terminal(job.state) || job.state === "submission_unknown" || Date.now() >= job.expiresAt || args.leaseToken !== undefined && (job.leaseToken !== args.leaseToken || Date.now() >= (job.leaseExpiresAt ?? 0))) mediaDenied("MEDIA_JOB_EXPIRED");
  await checkMediaJob(ctx, job, job.reference, true); return job;
} });
export const bindAttempt = internalMutation({ args: { jobId: v.string(), leaseToken: v.string(), attemptId: v.id("runtimeModelAttempts"), modelOperationId: v.id("runtimeModelOperations"), dispatchIdentity: v.string(), snapshotCanonical: v.string(), proofCanonical: v.string(), envelopeCanonical: v.string() }, handler: async (ctx, args) => {
  const job = await mediaJob(ctx, args.jobId); await checkMediaJob(ctx, job, job.reference, true);
  if (job.state !== "submitting" || job.leaseToken !== args.leaseToken || Date.now() >= (job.leaseExpiresAt ?? 0) || job.attemptId) mediaDenied("MEDIA_JOB_EXPIRED");
  const attempt = await ctx.db.get("runtimeModelAttempts", args.attemptId); const operation = await ctx.db.get("runtimeModelOperations", args.modelOperationId);
  if (!attempt || !operation || attempt.operationDocumentId !== operation._id || operation.semanticId !== job.jobId || operation.runAccountId !== job.runAccountId || attempt.dispatchIdentity !== args.dispatchIdentity || attempt.snapshotCanonical !== args.snapshotCanonical) mediaDenied();
  const { jobId: _id, leaseToken: _lease, ...pin } = args; await ctx.db.patch("runtimeMediaJobs", job._id, { ...pin, costStatus: "incurred_unknown" }); return null;
} });
export const acknowledge = internalMutation({ args: { jobId: v.string(), leaseToken: v.string(), operation: v.string(), inferenceId: v.string(), webhookSecret: v.optional(v.string()) }, handler: async (ctx, args) => {
  const job = await mediaJob(ctx, args.jobId); await checkMediaJob(ctx, job, job.reference, true);
  if (job.state !== "submitting" || job.leaseToken !== args.leaseToken || Date.now() >= (job.leaseExpiresAt ?? 0) || !job.attemptId || !args.operation || args.operation.length > 8192 || !args.inferenceId || args.inferenceId.length > 256 || args.webhookSecret !== undefined && (!args.webhookSecret || args.webhookSecret.length > 256)) mediaDenied("MEDIA_JOB_EXPIRED");
  await ctx.db.patch("runtimeMediaJobs", job._id, { state: "processing", operation: args.operation, inferenceId: args.inferenceId, ...(args.webhookSecret ? { webhookSecret: args.webhookSecret } : {}), revision: job.revision + 1, updatedAt: Date.now() });
  await ctx.scheduler.runAfter(1000, action("processPoll"), { jobId: job.jobId }); return null;
} });
export const markFailure = internalMutation({ args: { jobId: v.string(), code: v.string(), uncertain: v.boolean() }, handler: async (ctx, args) => {
  const job = await mediaJob(ctx, args.jobId); if (terminal(job.state)) return null;
  const code = ["MEDIA_SUBMISSION_UNKNOWN", "MEDIA_CAPABILITY_UNAVAILABLE", "ASSET_TOO_LARGE", "MEDIA_OUTPUT_INVALID", "MEDIA_DOWNLOAD_FAILED", "MEDIA_JOB_EXPIRED", "MEDIA_RESULT_WITHHELD", "MEDIA_PROVIDER_FAILED"].includes(args.code) ? args.code : "MEDIA_PROVIDER_FAILED";
  await transition(ctx, job, args.uncertain ? "submission_unknown" : code === "MEDIA_JOB_EXPIRED" ? "expired" : "failed", code); return null;
} });
export const pollCheckpoint = internalMutation({ args: { jobId: v.string() }, handler: async (ctx, args) => {
  const job = await mediaJob(ctx, args.jobId); if (job.state !== "processing" || !job.operation) return null; await checkMediaJob(ctx, job, job.reference, true);
  if (Date.now() >= job.expiresAt || job.pollCount >= MEDIA_MAX_POLLS) { await transition(ctx, job, "expired", "MEDIA_JOB_EXPIRED"); return null; }
  await ctx.db.patch("runtimeMediaJobs", job._id, { pollCount: job.pollCount + 1 }); return job;
} });
export const pollAgain = internalMutation({ args: { jobId: v.string() }, handler: async (ctx, args) => { const job = await mediaJob(ctx, args.jobId); if (job.state === "processing") await ctx.scheduler.runAfter(Math.min(300_000, 1000 * 2 ** Math.min(job.pollCount, 8)), action("processPoll"), { jobId: job.jobId }); return null; } });
export const providerTerminal = internalMutation({ args: { jobId: v.string(), status: v.union(v.literal("completed"), v.literal("failed"), v.literal("cancelled"), v.literal("expired")) }, handler: async (ctx, args) => {
  const job = await mediaJob(ctx, args.jobId); if (terminal(job.state) || job.terminalStatus) return null;
  if (!job.attemptId || !job.dispatchIdentity || !job.modelOperationId) mediaDenied("MEDIA_RESULT_WITHHELD");
  // Trusted producer metadata cannot grant output access. Current authority is
  // checked after charge capture, again at attachment and materialization.
  await ctx.db.patch("runtimeMediaJobs", job._id, { terminalStatus: args.status, state: args.status === "completed" ? "downloading" : args.status === "expired" ? "expired" : "failed", ...(job.kind === "video" ? { leaseExpiresAt: Date.now() } : {}), revision: job.revision + 1, updatedAt: Date.now(), ...(args.status !== "completed" ? { failureCode: "MEDIA_PROVIDER_FAILED" } : {}) });
  if (args.status === "completed" && job.kind === "video") await ctx.scheduler.runAfter(0, action("processDownload"), { jobId: job.jobId }); return null;
} });
export const claimDownload = internalMutation({ args: { jobId: v.string() }, handler: async (ctx, args) => {
  const job = await mediaJob(ctx, args.jobId); if (job.state !== "downloading" || !job.modelOperationId || !job.attemptId) return null;
  await checkMediaJob(ctx, job, job.reference, true);
  if (Date.now() >= job.expiresAt || job.downloadAttempt >= MEDIA_MAX_DOWNLOAD_ATTEMPTS) { await transition(ctx, job, "failed", "MEDIA_DOWNLOAD_FAILED"); return null; }
  if (job.leaseExpiresAt && Date.now() < job.leaseExpiresAt) return null;
  const leaseToken = crypto.randomUUID(); await ctx.db.patch("runtimeMediaJobs", job._id, { leaseToken, leaseExpiresAt: Date.now() + MEDIA_LEASE_MS, downloadAttempt: job.downloadAttempt + 1 }); return { ...job, leaseToken };
} });
export const downloadFailed = internalMutation({ args: { jobId: v.string(), leaseToken: v.string() }, handler: async (ctx, args) => {
  const job = await mediaJob(ctx, args.jobId); if (job.state !== "downloading" || job.leaseToken !== args.leaseToken) return null;
  await ctx.db.patch("runtimeMediaJobs", job._id, { leaseExpiresAt: Date.now() }); await ctx.scheduler.runAfter(1000, action("processDownload"), { jobId: job.jobId }); return null;
} });
export const materialized = internalMutation({ args: { jobId: v.string(), resultCanonical: v.string(), versionId: v.string() }, handler: async (ctx, args) => {
  const job = await mediaJob(ctx, args.jobId); if (job.state === "ready") { if (job.resultCanonical !== args.resultCanonical || job.assetVersionId !== args.versionId) mediaDenied("MEDIA_IDEMPOTENCY_CONFLICT"); return null; }
  if (job.state !== "downloading" || !job.attemptId || !job.modelOperationId) mediaDenied("MEDIA_RESULT_WITHHELD");
  if (Date.now() >= job.expiresAt) { await transition(ctx, job, "expired", "MEDIA_JOB_EXPIRED"); return null; }
  if (!await mediaResultPublicationAllowed(ctx, job.reference, job.attemptId, job.modelOperationId, args.resultCanonical)) { await transition(ctx, job, "failed", "MEDIA_RESULT_WITHHELD"); return null; }
  const artifact = await checkMediaJob(ctx, job, job.reference, true);
  const result = mediaResultSchema.parse(JSON.parse(args.resultCanonical)); const value = await versionById(ctx, job, args.versionId); const attempt = await ctx.db.get("runtimeModelAttempts", job.attemptId);
  if (!value || value.lineage.kind !== "generated" || value.lineage.operationId !== job.modelOperationId || !attempt || attempt.resultAttachmentState !== "attached" || attempt.privateResultCanonical !== args.resultCanonical
    || result.jobId !== job.jobId || value.contentHash !== result.contentHash || value.sizeBytes !== result.sizeBytes || value.mimeType !== result.mimeType || artifact.version !== 1 || artifact.fileRef) mediaDenied("MEDIA_RESULT_WITHHELD");
  const fileRef = { storageId: value.storageId, assetId: value.assetId, assetVersion: value.assetVersion, versionId: value.versionId, mimeType: value.mimeType, size: value.sizeBytes, checksum: value.contentHash };
  const version = artifact.version + 1; const patch = { fileRef, content: undefined, streamingState: "final" as const, version, versionPointer: version,
    versionHistory: [...artifact.versionHistory, { version, fileRef, title: artifact.title, timestamp: Date.now(), changedBy: job.ownerPrincipalId, changeType: "update" as const }], updatedAt: Date.now() };
  await ctx.db.patch("artifacts", artifact._id, patch); await syncArtifactAssets(ctx, job.reference, { ...artifact, ...patch });
  await releaseAssetReferences(ctx, job, "upload", value.assetId);
  await ctx.db.patch("runtimeMediaJobs", job._id, { state: "ready", resultCanonical: args.resultCanonical, assetVersionId: value.versionId, costStatus: attempt.state === "settled" ? "settled" : "incurred_unknown", revision: job.revision + 1, updatedAt: Date.now() }); return null;
} });
export const retainResult = internalMutation({ args: { jobId: v.string(), resultCanonical: v.string() }, handler: async (ctx, args) => {
  const job = await mediaJob(ctx, args.jobId); await checkMediaJob(ctx, job, job.reference, true);
  const result = mediaResultSchema.safeParse(JSON.parse(args.resultCanonical));
  if (job.state !== "downloading" || !result.success || result.data.jobId !== job.jobId || job.resultCanonical && job.resultCanonical !== args.resultCanonical) mediaDenied("MEDIA_RESULT_WITHHELD");
  await ctx.db.patch("runtimeMediaJobs", job._id, { resultCanonical: args.resultCanonical }); return null;
} });
export const recoverStoredOutput = internalMutation({ args: { jobId: v.string() }, handler: async (ctx, args) => {
  const job = await mediaJob(ctx, args.jobId); if (job.state !== "downloading" || !job.resultCanonical) return null;
  if (Date.now() >= job.expiresAt) { await transition(ctx, job, "expired", "MEDIA_JOB_EXPIRED"); return null; }
  if (!job.attemptId || !job.modelOperationId || !await mediaResultPublicationAllowed(ctx, job.reference, job.attemptId, job.modelOperationId, job.resultCanonical)) { await transition(ctx, job, "failed", "MEDIA_RESULT_WITHHELD"); return null; }
  await checkMediaJob(ctx, job, job.reference, true);
  const stored = await ctx.db.query("runtimeAssetJobs").withIndex("by_request", q => q.eq("tenantId", job.tenantId).eq("memorySpaceId", job.memorySpaceId).eq("ownerPrincipalId", job.ownerPrincipalId).eq("requestId", `media-output:${job.jobId}`)).unique();
  if (!stored || stored.state !== "ready") return null;
  const value = await versionById(ctx, job, stored.versionId); if (!value) mediaDenied("MEDIA_RESULT_WITHHELD");
  return { asset: publicAsset(value), resultCanonical: job.resultCanonical };
} });
export const callbackLookup = internalMutation({ args: { jobId: v.string() }, handler: async (ctx, args) => { const job = await mediaJob(ctx, args.jobId); if (!job.webhookSecret || !job.operation || !job.inferenceId || terminal(job.state)) return null; return { secret: job.webhookSecret, operation: job.operation, inferenceId: job.inferenceId }; } });
export const acceptCallback = internalMutation({ args: { jobId: v.string(), operation: v.string(), inferenceId: v.string(), secretHash: v.string(), bodyHash: v.string(), status: v.union(v.literal("completed"), v.literal("failed"), v.literal("cancelled"), v.literal("expired")) }, handler: async (ctx, args) => {
  const job = await mediaJob(ctx, args.jobId); if (!job.webhookSecret || job.operation !== args.operation || job.inferenceId !== args.inferenceId || await semanticHash(job.webhookSecret) !== args.secretHash) mediaDenied("MEDIA_CALLBACK_DENIED");
  const old = await ctx.db.query("runtimeMediaCallbacks").withIndex("by_identity", q => q.eq("jobId", job.jobId).eq("inferenceId", args.inferenceId).eq("status", args.status)).unique();
  if (old) { if (old.bodyHash !== args.bodyHash) mediaDenied("MEDIA_CALLBACK_DENIED"); return { accepted: true }; }
  if (terminal(job.state) || job.terminalStatus) return { accepted: true };
  await ctx.db.insert("runtimeMediaCallbacks", { jobId: job.jobId, inferenceId: args.inferenceId, status: args.status, bodyHash: args.bodyHash, receivedAt: Date.now() });
  // Verified callbacks are signals, never output authority. Poll the saved handle
  // before materialization; early/missed callbacks converge on this same path.
  await ctx.scheduler.runAfter(0, action("processPoll"), { jobId: job.jobId }); return { accepted: true };
} });
export const processSubmission = internalAction({ args: { jobId: v.string() }, handler: processSubmissionHandler });
export const processPoll = internalAction({ args: { jobId: v.string() }, handler: processPollHandler });
export const processDownload = internalAction({ args: { jobId: v.string() }, handler: processDownloadHandler });
export type MediaActionContext = ActionCtx;

/** Exact owned output cleanup can run after authority invalidation. It never
 * retires a committed artifact or a recoverable save gap. */
export const cleanupOutput = internalMutation({ args: { jobId: v.string() }, handler: async (ctx, args) => {
  const job = await mediaJob(ctx, args.jobId); if (!["failed", "cancelled", "expired"].includes(job.state)) return null;
  const stored = await ctx.db.query("runtimeAssetJobs").withIndex("by_request", q => q.eq("tenantId", job.tenantId).eq("memorySpaceId", job.memorySpaceId).eq("ownerPrincipalId", job.ownerPrincipalId).eq("requestId", `media-output:${job.jobId}`)).unique();
  if (!stored || stored.state !== "ready") return null;
  const value = await versionById(ctx, job, stored.versionId);
  if (!value || value.lineage.kind !== "generated" || value.lineage.operationId !== job.modelOperationId) mediaDenied("MEDIA_RESULT_WITHHELD");
  const artifact = await ctx.db.query("artifacts").withIndex("by_runtime_key", q => q.eq("tenantId", job.tenantId).eq("memorySpaceId", job.memorySpaceId).eq("artifactId", job.artifactId)).unique();
  if (artifact?.fileRef?.versionId === value.versionId) return null;
  await releaseAssetReferences(ctx, job, "upload", value.assetId); return null;
} });

/** Finite local retention cannot promise upstream cancellation or release an
 * unresolved paid slot. It still fences publication after actor revocation. */
export const expireJob = internalMutation({ args: { jobId: v.string() }, handler: async (ctx, args) => {
  const job = await mediaJob(ctx, args.jobId);
  if (!terminal(job.state) && Date.now() >= job.expiresAt) await transition(ctx, job, "expired", "MEDIA_JOB_EXPIRED");
  return null;
} });
