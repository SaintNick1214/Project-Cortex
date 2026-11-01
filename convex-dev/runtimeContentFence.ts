/** Current content job/source fences shared by native ledger and final publication. */
import { ConvexError } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { ModelOperationKey, ModelPolicySnapshotV1 } from "../src/domain/model-policy";
import { canonicalModelJson } from "../src/domain/model-policy";
import { contentOperation } from "../src/domain/content";
import { semanticHash } from "../src/domain/profile";
import { recheckAuthority } from "./runtimeAuth";
import { managedConversationAccess } from "./runtimeDataAuth";
import { conversationById, executionRevision, verifyMessage, agentComponent } from "./runtimeTranscript";
import { checkContextSourceWitnesses } from "./runtimeContextWitness";
import { readArtifactContext, checkArtifactContextWitnesses } from "./runtimeArtifactContext";
import { deliveryExpiresAt } from "./runtimeDelivery";
import { guardAgentRunBudget } from "./runtimeAgentFence";
import type { CompletedAgentTitle } from "./runtimeAgentFence";
type Ctx = Pick<QueryCtx, "db"> & Partial<Pick<QueryCtx, "runQuery">>;
export type ContentJob = Doc<"runtimeContentJobs">;
function titleParent(job: ContentJob): CompletedAgentTitle | undefined {
  if (!job.completedParentTitle) return;
  if (job.intent !== "title" || job.stage !== "primary" || !job.parentRunId || !job.parentOperationId || !job.sourceMessageId
    || job.requestId !== `automatic-title:${job.parentRunId}` || job.artifactId || job.sourceArtifactId) contentDenied("POLICY_DENIED");
  return { ...job.completedParentTitle, runId: job.parentRunId, sourceMessageId: job.sourceMessageId, parentOperationId: job.parentOperationId };
}
export function contentDenied(code = "FORBIDDEN"): never { throw new ConvexError({ version: 1, code, message: "Content operation denied.", retryable: false, outcome: "not_dispatched" }); }
export async function contentJob(ctx: Pick<QueryCtx, "db">, jobId: string): Promise<ContentJob> {
  const row = await ctx.db.query("runtimeContentJobs").withIndex("by_job", q => q.eq("jobId", jobId)).unique();
  if (!row) contentDenied("CONTENT_JOB_NOT_FOUND"); return row;
}
export async function contentArtifact(ctx: Ctx, job: ContentJob, reference: RuntimeAuthorityReference, deadlines: number[] = []) {
  if (!job.artifactId) return undefined;
  await readArtifactContext(ctx, reference, job.artifactId, deadlines);
  const row = await ctx.db.query("artifacts").withIndex("by_runtime_key", q => q.eq("tenantId", job.tenantId).eq("memorySpaceId", job.memorySpaceId).eq("artifactId", job.artifactId!)).unique();
  if (!row || row.isDeleted || row.tombstonedAt !== undefined) contentDenied(); return row;
}
export async function checkContentJob(ctx: Ctx, job: ContentJob, reference: RuntimeAuthorityReference, execution = false, deadlines: number[] = []) {
  const s = { tenantId: job.tenantId, memorySpaceId: job.memorySpaceId };
  const completedTitle = execution ? titleParent(job) : undefined;
  if (reference.tenantId !== s.tenantId || reference.memorySpaceId !== s.memorySpaceId) contentDenied();
  await recheckAuthority(ctx, reference, { ...s, capability: execution ? "run" : "read" });
  if (job.conversationId) {
    const conversation = await conversationById(ctx, reference, job.conversationId); if (!conversation) contentDenied();
    await managedConversationAccess(ctx, reference, conversation, execution ? "write" : "read", execution ? "canContinue" : "canView", deadlines);
    // Only the internal completed-parent title can outlive a later turn. Its
    // parent fence below proves every revision increment and the original
    // captured prefix; source pin/current authority checks still run here.
    if (execution && (conversation.epoch !== job.conversationEpoch || !completedTitle && executionRevision(conversation) !== job.conversationRevision)) contentDenied("STALE_CONTEXT");
    if (job.sourceMessageId) {
      const bridge = await ctx.db.query("runtimeTranscriptMessages").withIndex("by_native", q => q.eq("tenantId", job.tenantId).eq("memorySpaceId", job.memorySpaceId).eq("nativeMessageId", job.sourceMessageId!)).unique();
      if (!bridge || !ctx.runQuery || !job.sourceMessagePin || bridge.revision !== job.sourceMessagePin.revision || bridge.contentHash !== job.sourceMessagePin.contentHash) contentDenied("STALE_CONTEXT");
      const native = await ctx.runQuery(agentComponent.messages.getMessagesByIds, { messageIds: [job.sourceMessageId] }); await verifyMessage({ db: ctx.db, runQuery: ctx.runQuery }, conversation, bridge, native[0]);
      await checkContextSourceWitnesses(ctx, reference, bridge.contextSourceWitnesses ?? [], deadlines);
      await checkArtifactContextWitnesses(ctx, reference, bridge.artifactContextWitnesses ?? [], deadlines);
    }
  } else if (job.ownerPrincipalId !== reference.principalId) contentDenied();
  await checkContextSourceWitnesses(ctx, reference, job.sourceWitnesses, deadlines);
  await checkArtifactContextWitnesses(ctx, reference, execution ? job.artifactWitnesses : job.deliveryArtifactWitnesses, deadlines);
  const artifact = await contentArtifact(ctx, job, reference, deadlines);
  if (artifact) {
    if (execution) {
      await recheckAuthority(ctx, reference, { ...s, capability: "write", resource: { ...s, resourceType: "artifact", resourceId: artifact.artifactId, ownerPrincipalId: artifact.ownerPrincipalId! } });
      if (artifact.version !== job.artifactVersion || artifact.versionPointer !== job.artifactVersion || await semanticHash(canonicalModelJson([artifact.title, artifact.content ?? ""])) !== job.artifactHash) contentDenied("STALE_CONTEXT");
    }
    // Historical jobs require their exact retained output version; pruning it
    // closes this delivery even if a newer unrelated artifact remains readable.
    if (job.state === "ready" && job.resultCanonical) {
      const result = JSON.parse(job.resultCanonical) as { artifactVersion?: number };
      if (result.artifactVersion !== undefined && !artifact.versionHistory.some(value => value.version === result.artifactVersion)) contentDenied("STALE_CONTEXT");
    }
  }
  if (execution && job.parentRunId) {
    await guardAgentRunBudget(ctx as Pick<QueryCtx, "db" | "runQuery">, reference, job.runAccountId, completedTitle);
  }
  if (execution && (job.state !== "running" || job.expiresAt <= Date.now() || !job.leaseToken || !job.leaseExpiresAt || job.leaseExpiresAt <= Date.now())) contentDenied("CONTENT_JOB_EXPIRED");
  await deliveryExpiresAt(ctx, reference, deadlines); return artifact;
}
async function accountJobs(ctx: Pick<QueryCtx, "db">, accountId: Id<"runtimeBudgetAccounts">) {
  const rows = await ctx.db.query("runtimeContentJobs").withIndex("by_account", q => q.eq("runAccountId", accountId)).take(33);
  if (rows.length > 32) contentDenied("CONTENT_JOB_LIMIT"); return rows;
}
/** Derive the exception from a durable internal job, never from model args alone. */
export async function completedContentTitle(ctx: Ctx, reference: RuntimeAuthorityReference, accountId: Id<"runtimeBudgetAccounts">,
  key: ModelOperationKey, parentOperationId?: Id<"runtimeModelOperations">, semanticId?: string): Promise<CompletedAgentTitle | undefined> {
  if (key !== "conversation.title" || !parentOperationId) return;
  const jobs = (await accountJobs(ctx, accountId)).filter(job => job.completedParentTitle && job.state === "running" && job.parentOperationId === parentOperationId);
  if (jobs.length > 1) contentDenied("POLICY_DENIED");
  const job = jobs[0]; if (!job) return;
  if (canonicalModelJson(job.reference) !== canonicalModelJson(reference) || semanticId !== undefined && semanticId !== `${job.jobId}:primary`) contentDenied("POLICY_DENIED");
  return titleParent(job);
}
function relevant(rows: ContentJob[], key: ModelOperationKey): ContentJob | undefined {
  const standalone = rows.filter(row => !row.parentRunId);
  if (standalone.length > 1) contentDenied();
  const candidates = standalone.length ? standalone : rows.filter(row => contentOperation(row.intent) === key || key === "conversation.title" && row.intent !== "title");
  const running = candidates.filter(row => row.state === "running");
  if (running.length > 1 || standalone.length > 1) contentDenied();
  return running[0] ?? candidates.sort((a, b) => b.createdAt - a.createdAt)[0];
}
export async function guardContentRunBudget(ctx: Ctx, reference: RuntimeAuthorityReference, accountId: Id<"runtimeBudgetAccounts">, key: ModelOperationKey) {
  const job = relevant(await accountJobs(ctx, accountId), key); if (!job) return;
  if (canonicalModelJson(job.reference) !== canonicalModelJson(reference)) contentDenied();
  await checkContentJob(ctx, job, reference, true);
}
export async function assertContentPolicyPin(ctx: Ctx, accountId: Id<"runtimeBudgetAccounts">, key: ModelOperationKey, snapshot: ModelPolicySnapshotV1, allowUnpinned = false, requireRunning = true) {
  const job = relevant(await accountJobs(ctx, accountId), key); if (!job) return;
  const stage = key === contentOperation(job.intent) ? "primary" : key === "conversation.title" && job.intent !== "title" ? "title" : undefined;
  if (!stage || requireRunning && job.stage !== stage) contentDenied("POLICY_DENIED");
  const pin = stage === "primary" ? job.primarySnapshot : job.titleSnapshot;
  if (!pin ? !allowUnpinned : pin !== canonicalModelJson(snapshot)) contentDenied("POLICY_DENIED");
}
