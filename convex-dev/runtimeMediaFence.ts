/** Completion authority for an already-issued media attempt. Never admits inference. */
import { ConvexError } from "convex/values";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import { canonicalModelJson } from "../src/domain/model-policy";
import { recheckAuthority } from "./runtimeAuth";
import { managedConversationAccess } from "./runtimeDataAuth";
import { checkContextSourceWitnesses } from "./runtimeContextWitness";
import { assetVersion, authorizeAsset } from "./runtimeAssetCatalog";
import { readCurrentExecutableDefinition } from "./agentDefinitions";
type Ctx = Pick<QueryCtx, "db">;
export function mediaDenied(code = "FORBIDDEN"): never { throw new ConvexError({ version: 1, code, message: "Media operation denied.", retryable: false, outcome: "not_dispatched" }); }
export async function checkMediaJob(ctx: Ctx, job: Doc<"runtimeMediaJobs">, reference = job.reference, write = false, deadlines?: number[]) {
  const s = { tenantId: job.tenantId, memorySpaceId: job.memorySpaceId };
  if (reference.tenantId !== s.tenantId || reference.memorySpaceId !== s.memorySpaceId) mediaDenied();
  await recheckAuthority(ctx, reference, { ...s, capability: write ? "write" : "read", resource: { ...s, resourceType: "artifact", resourceId: job.artifactId, ownerPrincipalId: job.ownerPrincipalId } });
  await recheckAuthority(ctx, reference, { ...s, capability: write ? "storage:write" : "storage:read" });
  const artifact = await ctx.db.query("artifacts").withIndex("by_runtime_key", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("artifactId", job.artifactId)).unique();
  if (!artifact || artifact.isDeleted || artifact.tombstonedAt !== undefined || artifact.ownerPrincipalId !== job.ownerPrincipalId) mediaDenied();
  if (job.conversationId) {
    const conversation = await ctx.db.query("runtimeConversations").withIndex("by_scoped_id", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("conversationId", job.conversationId!)).unique();
    if (!conversation) mediaDenied();
    await managedConversationAccess(ctx, reference, conversation, write ? "write" : "read", undefined, deadlines);
  }
  await checkContextSourceWitnesses(ctx, reference, job.contextSourceWitnesses, deadlines);
  if (job.input) {
    const asset = await assetVersion(ctx, s, job.input.assetId, job.input.assetVersion);
    if (!asset || asset.versionId !== job.input.versionId || asset.contentHash !== job.input.contentHash || asset.mimeType !== job.input.mimeType || asset.sizeBytes !== job.input.sizeBytes) mediaDenied("STALE_MEDIA_INPUT");
    await authorizeAsset(ctx, reference, asset, "storage:read", new Set(), deadlines);
  }
  return artifact;
}
export async function allowMediaCompletion(ctx: Ctx, reference: RuntimeAuthorityReference, operation: Doc<"runtimeModelOperations">): Promise<boolean> {
  if (!["media.image.generate", "media.video.generate"].includes(operation.operationKey)) return false;
  const job = await ctx.db.query("runtimeMediaJobs").withIndex("by_job", q => q.eq("jobId", operation.semanticId)).unique();
  if (!job || job.modelOperationId !== operation._id || job.runAccountId !== operation.runAccountId
    || canonicalModelJson(job.reference) !== canonicalModelJson(reference) || !["submitting", "processing", "downloading"].includes(job.state)
    || job.cancelledAt !== undefined || Date.now() >= job.expiresAt) mediaDenied("MEDIA_JOB_EXPIRED");
  await checkMediaJob(ctx, job, reference, true);
  const run = await ctx.db.query("runtimeRuns").withIndex("by_run_account", q => q.eq("runAccountId", job.runAccountId)).unique();
  if (run?.executionRequested) {
    if (run.tombstonedAt !== undefined || run.cancellationRequestedAt !== undefined || run.responseStatus === "cancelled" || run.responseStatus === "failed") mediaDenied("RUN_CANCELLED");
    const definition = await readCurrentExecutableDefinition(ctx, reference, { agentId: run.agentId, version: run.agentVersion }, { capability: "run" });
    if (definition.definitionHash !== run.definitionHash) mediaDenied("POLICY_DENIED");
  }
  return true;
}
