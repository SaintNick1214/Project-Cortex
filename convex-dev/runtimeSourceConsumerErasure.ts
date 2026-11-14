/** Bounded physical cleanup of declared SDK copies. Witness edges survive as denial metadata. */
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { components } from "./_generated/api";
import { WorkflowManager } from "@convex-dev/workflow";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import { agentComponent, canonicalMessageHash } from "./runtimeTranscript";
import type { MessageDoc } from "@convex-dev/agent";
import { dataDenied } from "./runtimeDataAuth";
import type { SourceDependencyScope, SourceDependencyTarget } from "./runtimeSourceDependencies";

const BATCH = 8, redacted = canonicalModelJson({ version: 1, erased: true });
type Job = Doc<"runtimeSourceConsumerErasureJobs">;
const workflowComponent = (components as unknown as { workflow: ConstructorParameters<typeof WorkflowManager>[0] }).workflow;

/** Late financial observations still settle liability; no input/proof/result bytes survive. */
export async function eraseModelPayloads(ctx: MutationCtx, operationId: Id<"runtimeModelOperations">): Promise<boolean> {
  const operation = await ctx.db.get("runtimeModelOperations", operationId);
  if (!operation) return true;
  const attempts = await ctx.db.query("runtimeModelAttempts").withIndex("by_operation_erasure", q => q.eq("operationDocumentId", operationId).eq("sourceErasedAt", undefined)).take(BATCH + 1);
  for (const attempt of attempts.slice(0, BATCH)) await ctx.db.patch("runtimeModelAttempts", attempt._id, { canonical: redacted, inputProofCanonical: redacted,
    privateResultCanonical: undefined, resultWithheld: true, resultAttachmentState: attempt.terminalEvidenceHash === undefined ? undefined : "closed",
    outputVisible: false, toolInputVisible: false, toolResultVisible: false, sourceErasedAt: Date.now() });
  if (attempts.length > BATCH) return false;
  // A generated storage RPC is nontransactional. Preserve its issued witness
  // until the byte writer has acknowledged terminal transport, including when
  // media.materialized never attached the resulting version back to its job.
  const generated = await ctx.db.query("runtimeAssetJobs").withIndex("by_generated_erasure", q => q.eq("tenantId", operation.tenantId).eq("memorySpaceId", operation.memorySpaceId).eq("lineage.kind", "generated").eq("lineage.operationId", operationId).eq("sourceErasedAt", undefined)).first();
  if (generated) {
    const value = await ctx.db.query("runtimeAssetVersions").withIndex("by_version_id", q => q.eq("tenantId", operation.tenantId).eq("memorySpaceId", operation.memorySpaceId).eq("versionId", generated.versionId)).unique();
    if (generated.transferState === "issued" || generated.transferState === undefined && !generated.storageId && !value) return false;
    if (value && (value.lineage.kind !== "generated" || value.lineage.operationId !== operationId || value.assetId !== generated.assetId)) dataDenied("ERASURE_CONFLICT");
    const edges = await ctx.db.query("runtimeAssetReferences").withIndex("by_version", q => q.eq("tenantId", operation.tenantId).eq("memorySpaceId", operation.memorySpaceId).eq("versionId", generated.versionId).eq("active", true)).take(BATCH + 1);
    for (const edge of edges.slice(0, BATCH)) await ctx.db.delete("runtimeAssetReferences", edge._id);
    if (edges.length > BATCH) return false;
    const storageIds = [...new Set([generated.storageId, value?.storageId].filter((id): id is Id<"_storage"> => id !== undefined))];
    for (const id of storageIds) {
      const metadata = await ctx.storage.getMetadata(id);
      if (metadata) {
        if (metadata.contentType !== generated.marker || metadata.sha256 !== generated.contentHash || metadata.size !== generated.sizeBytes) dataDenied("ERASURE_CONFLICT");
        await ctx.storage.delete(id);
      }
    }
    if (value) await ctx.db.patch("runtimeAssetVersions", value._id, { state: "deleted", filename: undefined, deletedAt: Date.now() });
    await ctx.db.patch("runtimeAssetJobs", generated._id, { state: "cancelled", transferState: "settled", filename: undefined, sourceErasedAt: Date.now() });
    return false;
  }
  await ctx.db.patch("runtimeModelOperations", operation._id, { sourceErasedAt: operation.sourceErasedAt ?? Date.now(), cancelled: true });
  return true;
}
async function remove<T extends TableNames>(ctx: MutationCtx, table: T, rows: Doc<T>[]): Promise<boolean> {
  for (const row of rows.slice(0, BATCH)) await ctx.db.delete(table, row._id);
  return rows.length <= BATCH;
}
/** Workpool removes each work/payload row before (or atomically with) recording
 * the step's terminal result. Do not force-delete a still-issued step: that
 * would lose the only parent-visible completion witness for its private args.
 * Source fences block new SDK dispatch/writes while issued work winds down.
 * cleanup may then schedule more journal batches; root absence is insufficient. */
async function eraseWorkflow(ctx: MutationCtx, job: Job, workflowId?: string): Promise<boolean> {
  if (!workflowId) return true;
  const issued = await ctx.runQuery(workflowComponent.workflow.listSteps, { workflowId, order: "asc", paginationOpts: { cursor: job.workflowCursor ?? null, numItems: BATCH } });
  if (issued.page.some(step => "workId" in step && step.workId && step.runResult === undefined)) return false;
  if (!issued.isDone) {
    if (!issued.continueCursor || issued.continueCursor === job.workflowCursor) dataDenied("ERASURE_WORKFLOW_PROGRESS_UNAVAILABLE");
    await ctx.db.patch("runtimeSourceConsumerErasureJobs", job._id, { workflowCursor: issued.continueCursor }); return false;
  }
  await ctx.runMutation(workflowComponent.workflow.cleanup, { workflowId, force: true });
  await ctx.db.patch("runtimeSourceConsumerErasureJobs", job._id, { workflowCursor: undefined });
  const steps = await ctx.runQuery(workflowComponent.workflow.listSteps, { workflowId, order: "asc", paginationOpts: { cursor: null, numItems: 1 } });
  return steps.page.length === 0 && steps.isDone;
}
async function redactStandaloneBudget(ctx: MutationCtx, accountId: Id<"runtimeBudgetAccounts">) {
  // An Agent budget request is an independent authored user request, not a
  // recalled-source copy. Standalone job budgets duplicate generated prompts.
  const run = await ctx.db.query("runtimeRuns").withIndex("by_run_account", q => q.eq("runAccountId", accountId)).first();
  if (!run) { const account = await ctx.db.get("runtimeBudgetAccounts", accountId); if (account) await ctx.db.patch("runtimeBudgetAccounts", accountId, { requestCanonical: redacted }); }
}
/** Older managed runs may already own native deltas. Discover only an exact
 * generated message position/agent, never a thread-wide deletion. The owning
 * list is capped: a full page is not evidence that an unseen stream is absent.
 * A pinned stream is aborted before draining, preventing new delta writes.
 * After the exact delta query is empty, the final bounded delete owns removal
 * of its header and file references in the same parent transaction. */
async function eraseNativeStreams(ctx: MutationCtx, message: MessageDoc): Promise<boolean> {
  const streams = await ctx.runQuery(agentComponent.streams.list, { threadId: message.threadId, startOrder: message.order,
    statuses: ["streaming", "finished", "aborted"] });
  const selected = streams.filter(stream => stream.order === message.order && stream.stepOrder === message.stepOrder && stream.agentName === message.agentName);
  for (const stream of selected.slice(0, BATCH)) {
    if (stream.status === "streaming") await ctx.runMutation(agentComponent.streams.abort, { streamId: stream.streamId, reason: "SOURCE_ERASED" });
    await ctx.runMutation(agentComponent.streams.deleteStreamAsync, { streamId: stream.streamId });
    const remaining = await ctx.runQuery(agentComponent.streams.listDeltas, { threadId: message.threadId, cursors: [{ streamId: stream.streamId, cursor: 0 }] });
    if (remaining.length) return false;
    // deleteStreamAsync returns no completion flag. This second call, after an
    // exact empty delta read, executes its isDone branch rather than inferring
    // physical removal from a scheduled continuation or capped thread listing.
    await ctx.runMutation(agentComponent.streams.deleteStreamAsync, { streamId: stream.streamId });
  }
  // The owning message delete aborts every active stream at its order. Wait
  // rather than indirectly cancelling an independently authored generation.
  const unrelatedActive = streams.some(stream => stream.order === message.order && stream.status === "streaming"
    && (stream.stepOrder !== message.stepOrder || stream.agentName !== message.agentName));
  return streams.length < 100 && selected.length <= BATCH && !unrelatedActive;
}
async function deleteGeneratedNative(ctx: MutationCtx, scope: SourceDependencyScope, ids: string[], pins?: { id: string; canonicalContentHash: string }[]): Promise<boolean> {
  if (!ids.length) return true;
  const messages = await ctx.runQuery(agentComponent.messages.getMessagesByIds, { messageIds: ids });
  const selected: string[] = [];
  for (const message of messages) {
    if (!message || !message.message || !["assistant", "tool"].includes(message.message.role)) continue;
    const bridge = await ctx.db.query("runtimeTranscriptMessages").withIndex("by_native", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("nativeMessageId", message._id)).unique();
    // Registered copies have their own exact-revision dependency target. A
    // later manual edit clears ancestry and must survive an older execution.
    if (bridge) continue;
    const pin = pins?.find(pin => pin.id === message._id);
    if (pin && await canonicalMessageHash(message, ctx) !== pin.canonicalContentHash) continue;
    if (!await eraseNativeStreams(ctx, message)) return false;
    selected.push(message._id);
  }
  if (selected.length) await ctx.runMutation(agentComponent.messages.deleteByIds, { messageIds: selected });
  return true;
}
async function executionStep(ctx: MutationCtx, job: Job): Promise<string> {
  const id = ctx.db.normalizeId("runtimeAgentExecutions", job.targetId);
  const execution = id ? await ctx.db.get("runtimeAgentExecutions", id) : null;
  if (!execution) return "complete";
  const scope = { tenantId: job.tenantId, memorySpaceId: job.memorySpaceId };
  if (execution.tenantId !== scope.tenantId || execution.memorySpaceId !== scope.memorySpaceId) dataDenied("ERASURE_CONFLICT");
  switch (job.phase) {
    case "start":
      await ctx.db.patch("runtimeAgentExecutions", execution._id, { contextCanonical: undefined, modelInputEntries: undefined, modelInputSelection: undefined,
        sourceErasedAt: execution.sourceErasedAt ?? Date.now(), state: "failed", failureCode: "SOURCE_ERASED", updatedAt: Date.now() });
      return "operations";
    case "operations": {
      const operation = await ctx.db.query("runtimeAgentOperations").withIndex("by_attempt_erasure", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("runId", execution.runId).eq("attemptNumber", execution.attemptNumber).eq("sourceErasedAt", undefined)).first();
      if (!operation) return "output";
      if (operation.nativeModelOperationId && !await eraseModelPayloads(ctx, operation.nativeModelOperationId)) return job.phase;
      await ctx.db.patch("runtimeAgentOperations", operation._id, { requestCanonical: redacted, nativeRequestCanonical: undefined, resultCanonical: undefined, sourceErasedAt: Date.now(), state: "unknown" });
      return job.phase;
    }
    case "output": return await remove(ctx, "runtimeAgentOutput", await ctx.db.query("runtimeAgentOutput").withIndex("by_sequence", q => q.eq("tenantId", scope.tenantId).eq("memorySpaceId", scope.memorySpaceId).eq("runId", execution.runId).eq("attemptNumber", execution.attemptNumber)).take(BATCH + 1)) ? "messages" : job.phase;
    case "messages": {
      const ids = execution.savedMessageIds.slice(job.position, job.position + BATCH);
      if (!await deleteGeneratedNative(ctx, scope, ids, execution.savedMessagePins)) return job.phase;
      if (job.position + BATCH < execution.savedMessageIds.length) { await ctx.db.patch("runtimeSourceConsumerErasureJobs", job._id, { position: job.position + BATCH }); return job.phase; }
      return "workflow";
    }
    case "workflow": return await eraseWorkflow(ctx, job, execution.workflowId) ? "complete" : job.phase;
    default: dataDenied("ERASURE_CONFLICT");
  }
}
async function transcriptStep(ctx: MutationCtx, job: Job): Promise<string> {
  const id = ctx.db.normalizeId("runtimeTranscriptMessages", job.targetId), bridge = id ? await ctx.db.get("runtimeTranscriptMessages", id) : null;
  if (!bridge || bridge.revision !== job.targetRevision) return "complete";
  if (bridge.tenantId !== job.tenantId || bridge.memorySpaceId !== job.memorySpaceId || bridge.role === "user") dataDenied("ERASURE_CONFLICT");
  const [message] = await ctx.runQuery(agentComponent.messages.getMessagesByIds, { messageIds: [bridge.nativeMessageId] });
  if (message && !await eraseNativeStreams(ctx, message)) return job.phase;
  await ctx.runMutation(agentComponent.messages.deleteByIds, { messageIds: [bridge.nativeMessageId] });
  await ctx.db.patch("runtimeTranscriptMessages", bridge._id, { legacyRequestCanonical: undefined, sourceErasedAt: Date.now(), tombstonedAt: bridge.tombstonedAt ?? Date.now() });
  return "complete";
}
async function sourceStep(ctx: MutationCtx, job: Job): Promise<string> {
  const s = { tenantId: job.tenantId, memorySpaceId: job.memorySpaceId }, sourceId = job.targetId, revision = job.targetRevision;
  const next: Record<string, string> = { start: "chunks", chunks: "vectors", vectors: "generations", generations: "receipts", receipts: "ingestion", ingestion: "graph", graph: "facts", facts: "source", source: "complete" };
  let done = true;
  switch (job.phase) {
    case "start": {
      const fence = await ctx.db.query("runtimeSourceRevisionErasureFences").withIndex("by_revision", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("sourceId", sourceId).eq("sourceRevision", revision)).unique();
      if (!fence) await ctx.db.insert("runtimeSourceRevisionErasureFences", { ...s, sourceId, sourceRevision: revision, erasedAt: Date.now() });
      break;
    }
    case "chunks": done = await remove(ctx, "runtimeMemoryChunks", await ctx.db.query("runtimeMemoryChunks").withIndex("by_source_revision", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("sourceId", sourceId).eq("sourceRevision", revision)).take(BATCH + 1)); break;
    case "vectors": done = await remove(ctx, "runtimeMemoryVectors", await ctx.db.query("runtimeMemoryVectors").withIndex("by_scope_source_revision", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("sourceId", sourceId).eq("sourceRevision", revision)).take(BATCH + 1)); break;
    case "generations": done = await remove(ctx, "runtimeMemoryVectorGenerations", await ctx.db.query("runtimeMemoryVectorGenerations").withIndex("by_source_revision", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("sourceId", sourceId).eq("sourceRevision", revision)).take(BATCH + 1)); break;
    case "receipts": done = await remove(ctx, "runtimeMemoryReceipts", await ctx.db.query("runtimeMemoryReceipts").withIndex("by_source_revision", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("identity.sourceId", sourceId).eq("identity.sourceRevision", revision)).take(BATCH + 1)); break;
    case "ingestion": {
      const event = await ctx.db.query("runtimeIngestionEvents").withIndex("by_source", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("lineage.sourceId", sourceId).eq("lineage.sourceRevision", revision)).first();
      if (!event) break;
      if (!await remove(ctx, "runtimeBeliefHistory", await ctx.db.query("runtimeBeliefHistory").withIndex("by_event", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("eventId", event.eventId)).take(BATCH + 1))) return job.phase;
      if (!await remove(ctx, "runtimeBeliefHeads", await ctx.db.query("runtimeBeliefHeads").withIndex("by_event", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("eventId", event.eventId)).take(BATCH + 1))) return job.phase;
      const stages = await ctx.db.query("runtimeIngestionStages").withIndex("by_event_stage", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("eventId", event.eventId)).take(4);
      const jobs = await ctx.db.query("runtimeIngestionJobs").withIndex("by_event", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("eventId", event.eventId)).take(2);
      if (stages.length > 3 || jobs.length > 1) dataDenied("ERASURE_CONFLICT");
      for (const row of stages) await ctx.db.delete("runtimeIngestionStages", row._id);
      for (const row of jobs) await ctx.db.delete("runtimeIngestionJobs", row._id);
      await ctx.db.delete("runtimeIngestionEvents", event._id); done = false; break;
    }
    case "graph": {
      const revisions = await ctx.db.query("runtimeGraphRevisions").withIndex("by_source", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("sourceId", sourceId).gt("revision", job.position)).take(BATCH);
      for (const graph of revisions) {
        const payload = await ctx.db.query("runtimeGraphPayloads").withIndex("by_revision", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("revision", graph.revision)).unique();
        if (payload) {
          const parsed = JSON.parse(payload.payloadCanonical) as { source: { sourceRevision: number } };
          if (parsed.source.sourceRevision === revision) await ctx.db.delete("runtimeGraphPayloads", payload._id);
        }
      }
      if (revisions.length) await ctx.db.patch("runtimeSourceConsumerErasureJobs", job._id, { position: revisions[revisions.length - 1]!.revision });
      done = revisions.length < BATCH; break;
    }
    case "facts": {
      const fact = await ctx.db.query("facts").withIndex("by_runtime_source", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("lineage.sourceId", sourceId).eq("lineage.sourceRevision", revision)).first();
      if (!fact) break;
      const links = await ctx.db.query("runtimeMemoryFactEntities").withIndex("by_scope_fact", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("factId", fact.factId)).take(BATCH + 1);
      if (!await remove(ctx, "runtimeMemoryFactEntities", links)) return job.phase;
      // Legacy/host factHistory is not written by the managed source pipeline.
      // Never infer destructive authority from a colliding logical factId.
      // Managed belief snapshots were selected by exact source event above.
      await ctx.db.delete("facts", fact._id); done = false; break;
    }
    case "source": {
      const source = await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("lineage.sourceId", sourceId)).unique();
      if (source?.lineage.sourceRevision === revision) {
        if (!["assistant", "tool"].includes(source.lineage.role)) dataDenied("ERASURE_CONFLICT");
        await ctx.db.delete("runtimeMemorySources", source._id);
      }
      break;
    }
    default: dataDenied("ERASURE_CONFLICT");
  }
  return done ? next[job.phase]! : job.phase;
}
async function artifactStep(ctx: MutationCtx, job: Job): Promise<string> {
  const artifact = await ctx.db.query("artifacts").withIndex("by_runtime_key", q => q.eq("tenantId", job.tenantId).eq("memorySpaceId", job.memorySpaceId).eq("artifactId", job.targetId)).unique();
  if (!artifact) return "complete";
  const current = artifact.versionPointer === job.targetRevision;
  // Only the declared generated revision is redacted; later manual versions
  // remain independently authored data and retain their pointer/content.
  await ctx.db.patch("artifacts", artifact._id, { versionHistory: artifact.versionHistory.map(version => version.version === job.targetRevision ? { version: version.version, timestamp: version.timestamp, changeType: version.changeType, content: "", title: "Erased source" } : version),
    ...(current ? { content: undefined, fileRef: undefined, title: "Erased source", description: undefined, streamingMetadata: undefined, streamingState: "error" as const } : {}), updatedAt: Date.now() });
  return "complete";
}
async function jobStep(ctx: MutationCtx, job: Job): Promise<string> {
  if (job.targetKind === "content") {
    const content = await ctx.db.query("runtimeContentJobs").withIndex("by_job", q => q.eq("jobId", job.targetId)).unique(); if (!content) return "complete";
    if (content.tenantId !== job.tenantId || content.memorySpaceId !== job.memorySpaceId) dataDenied("ERASURE_CONFLICT");
    if (content.intent === "title" && content.conversationId) {
      const conversation = await ctx.db.query("runtimeConversations").withIndex("by_scoped_id", q => q.eq("tenantId", job.tenantId).eq("memorySpaceId", job.memorySpaceId).eq("conversationId", content.conversationId!)).unique();
      if (conversation?.sourceTitleJobId === content.jobId) {
        const metadata = conversation.metadataCanonical ? JSON.parse(conversation.metadataCanonical) as Record<string, unknown> : {};
        delete metadata.title;
        await ctx.db.patch("runtimeConversations", conversation._id, { metadataCanonical: canonicalModelJson(metadata), sourceTitleJobId: undefined, updatedAt: Date.now() });
      }
    }
    await ctx.db.patch("runtimeContentJobs", content._id, { requestCanonical: redacted, prompt: "", primaryResult: undefined, generatedTitle: undefined, rejectedTitleResult: undefined, resultCanonical: undefined,
      sourceErasedAt: content.sourceErasedAt ?? Date.now(), state: "failed", failureCode: "SOURCE_ERASED", leaseToken: undefined, leaseExpiresAt: undefined, updatedAt: Date.now() });
    if (content.primaryOperationId && !await eraseModelPayloads(ctx, content.primaryOperationId)) return job.phase;
    if (content.titleOperationId && !await eraseModelPayloads(ctx, content.titleOperationId)) return job.phase;
    await redactStandaloneBudget(ctx, content.runAccountId);
    return await eraseWorkflow(ctx, job, content.workflowId) ? "complete" : job.phase;
  }
  const media = await ctx.db.query("runtimeMediaJobs").withIndex("by_job", q => q.eq("jobId", job.targetId)).unique(); if (!media) return "complete";
  if (media.tenantId !== job.tenantId || media.memorySpaceId !== job.memorySpaceId) dataDenied("ERASURE_CONFLICT");
  await ctx.db.patch("runtimeMediaJobs", media._id, { requestCanonical: redacted, prompt: "", envelopeCanonical: undefined, proofCanonical: undefined, resultCanonical: undefined, webhookSecret: undefined, operation: undefined, inferenceId: undefined,
    sourceErasedAt: media.sourceErasedAt ?? Date.now(), state: "failed", failureCode: "SOURCE_ERASED", leaseToken: undefined, leaseExpiresAt: undefined, pollLeaseToken: undefined, pollLeaseExpiresAt: undefined, cancelledAt: media.cancelledAt ?? Date.now(), updatedAt: Date.now() });
  if (media.modelOperationId && !await eraseModelPayloads(ctx, media.modelOperationId)) return job.phase;
  await redactStandaloneBudget(ctx, media.runAccountId);
  if (media.assetVersionId) {
    const asset = await ctx.db.query("runtimeAssetVersions").withIndex("by_version_id", q => q.eq("tenantId", job.tenantId).eq("memorySpaceId", job.memorySpaceId).eq("versionId", media.assetVersionId!)).unique();
    if (asset && asset.state !== "deleted") {
      if (asset.lineage.kind !== "generated" || asset.lineage.operationId !== media.modelOperationId) dataDenied("ERASURE_CONFLICT");
      const edges = await ctx.db.query("runtimeAssetReferences").withIndex("by_version", q => q.eq("tenantId", job.tenantId).eq("memorySpaceId", job.memorySpaceId).eq("versionId", asset.versionId).eq("active", true)).take(BATCH + 1);
      for (const edge of edges.slice(0, BATCH)) await ctx.db.patch("runtimeAssetReferences", edge._id, { active: false });
      if (edges.length > BATCH) return job.phase;
      await ctx.storage.delete(asset.storageId);
      await ctx.db.patch("runtimeAssetVersions", asset._id, { state: "deleted", deletedAt: Date.now() });
    }
  }
  return "complete";
}
export async function eraseSourceConsumer(ctx: MutationCtx, scope: SourceDependencyScope, target: SourceDependencyTarget): Promise<boolean> {
  const identity = await semanticHash(canonicalModelJson([scope.tenantId, scope.memorySpaceId, target.kind, target.id, target.revision ?? 0]));
  let job = await ctx.db.query("runtimeSourceConsumerErasureJobs").withIndex("by_identity", q => q.eq("identity", identity)).unique();
  if (!job) {
    const id = await ctx.db.insert("runtimeSourceConsumerErasureJobs", { tenantId: scope.tenantId, memorySpaceId: scope.memorySpaceId, identity, targetKind: target.kind, targetId: target.id, targetRevision: target.revision ?? 0, phase: "start", position: 0, complete: false, createdAt: Date.now(), updatedAt: Date.now() });
    job = (await ctx.db.get("runtimeSourceConsumerErasureJobs", id))!;
  }
  if (job.complete) return true;
  const phase = target.kind === "execution" ? await executionStep(ctx, job) : target.kind === "transcript" ? await transcriptStep(ctx, job)
    : target.kind === "source" ? await sourceStep(ctx, job) : target.kind === "artifact" ? await artifactStep(ctx, job)
    : target.kind === "model" ? await eraseModelPayloads(ctx, target.id as Id<"runtimeModelOperations">) ? "complete" : job.phase : await jobStep(ctx, job);
  const complete = phase === "complete";
  await ctx.db.patch("runtimeSourceConsumerErasureJobs", job._id, { phase, complete, updatedAt: Date.now() });
  return complete;
}
