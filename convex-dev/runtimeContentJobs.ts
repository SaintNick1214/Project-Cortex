/** Durable, replay-safe content jobs. Public callers supply intent and immutable IDs only. */
import { ConvexError, v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { WorkflowManager } from "@convex-dev/workflow";
import { mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { components } from "./_generated/api";
import { contentSubmitSchema, contentOperation, CONTENT_DEADLINE_MS, CONTENT_LEASE_MS, CONTENT_MAX_OUTPUT_BYTES, parseContentOutput } from "../src/domain/content";
import type { ContentSubmitV1, RuntimeContentJobV1 } from "../src/domain/content";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import { dataAuthorityReference, requireDataAuthority, managedConversationAccess } from "./runtimeDataAuth";
import { recheckAuthority } from "./runtimeAuth";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { contentIntent } from "./runtimeContentJobsSchema";
import { contentJob, checkContentJob, contentDenied } from "./runtimeContentFence";
import type { ContentJob } from "./runtimeContentFence";
import { conversationById, executionRevision, agentComponent, verifyMessage } from "./runtimeTranscript";
import { artifactMetadataWitness, readArtifactContext } from "./runtimeArtifactContext";
import { validateArtifact } from "./runtimeArtifactAuth";
import { bindTrustedBudget } from "./runtimeModelPolicy";
import { deliveryExpiresAt } from "./runtimeDelivery";
import { guardAgentRunBudget } from "./runtimeAgentFence";
import { currentRun } from "./runs";

const selectors = { tenantId: v.optional(v.string()), memorySpaceId: v.optional(v.string()) };
const select = { ...selectors, jobId: v.string() };
const work = { jobId: v.string(), leaseToken: v.string() };
const workflow = new WorkflowManager((components as unknown as { workflow: ConstructorParameters<typeof WorkflowManager>[0] }).workflow);
const jobMutation = (name: string) => makeFunctionReference<"mutation">(`runtimeContentJobs:${name}`);
const stageAction = makeFunctionReference<"action">("runtimeContentGateway:processStage");
export async function publicContentJob(ctx: MutationCtx, job: ContentJob, reference: RuntimeAuthorityReference): Promise<RuntimeContentJobV1> {
  const deadlines: number[] = []; await checkContentJob(ctx, job, reference, false, deadlines);
  const expiresAt = await deliveryExpiresAt(ctx, reference, deadlines);
  const result = job.state === "ready" && job.resultCanonical ? JSON.parse(job.resultCanonical) as Pick<RuntimeContentJobV1, "artifactVersion" | "title" | "content" | "suggestions"> : {};
  return { version: 1, jobId: job.jobId, intent: job.intent, state: job.state, revision: job.revision, createdAt: job.createdAt, updatedAt: job.updatedAt,
    ...(job.conversationId ? { conversationId: job.conversationId } : {}), ...(job.artifactId ? { artifactId: job.artifactId } : {}),
    ...result, ...(job.failureCode ? { failureCode: job.failureCode } : {}), ...(expiresAt === undefined ? {} : { deliveryExpiresAt: expiresAt }) };
}
async function parentBinding(ctx: MutationCtx, reference: RuntimeAuthorityReference, runId: string, conversationId?: string) {
  const { row: run } = await currentRun(ctx, reference, runId, "run");
  if (!run.runBudgetId || !run.runAccountId || run.responseStatus !== "running" || run.conversationId !== conversationId) contentDenied();
  await guardAgentRunBudget(ctx, reference, run.runAccountId);
  const rows = await ctx.db.query("runtimeAgentOperations").withIndex("by_attempt", q => q.eq("tenantId", run.tenantId).eq("memorySpaceId", run.memorySpaceId).eq("runId", run.runId).eq("attemptNumber", run.attemptNumber)).take(65);
  const model = rows.filter(row => row.kind === "model" && row.state === "complete" && row.nativeModelOperationId).sort((a, b) => b.ordinal - a.ordinal)[0];
  if (!model?.nativeModelOperationId) contentDenied();
  const operation = await ctx.db.get("runtimeModelOperations", model.nativeModelOperationId);
  if (!operation || operation.runAccountId !== run.runAccountId || canonicalModelJson(operation.reference) !== canonicalModelJson(reference)) contentDenied();
  const execution = await ctx.db.query("runtimeAgentExecutions").withIndex("by_attempt", q => q.eq("tenantId", run.tenantId).eq("memorySpaceId", run.memorySpaceId).eq("runId", run.runId).eq("attemptNumber", run.attemptNumber)).unique();
  if (!execution) contentDenied();
  return { runBudgetId: run.runBudgetId, runAccountId: run.runAccountId, parentOperationId: operation._id, sourceWitnesses: execution.sourceWitnesses, artifactWitnesses: execution.artifactContextWitnesses ?? [] };
}
export async function enqueueContent(ctx: MutationCtx, reference: RuntimeAuthorityReference, input: ContentSubmitV1, dispatch = true) {
  const parsed = contentSubmitSchema.safeParse(input); if (!parsed.success || !reference.memorySpaceId) contentDenied("INVALID_CONTENT_INPUT"); const args = parsed.data;
  const s = { tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId };
  for (const capability of ["run", "write", "read"] as const) await recheckAuthority(ctx, reference, { ...s, capability });
  let conversation; if (args.conversationId) { conversation = await conversationById(ctx, reference, args.conversationId); if (!conversation) contentDenied(); await managedConversationAccess(ctx, reference, conversation, "write", "canContinue"); }
  const existing = await ctx.db.query("runtimeContentJobs").withIndex("by_request", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("ownerPrincipalId", reference.principalId).eq("requestId", args.requestId)).unique();
  const requestCanonical = canonicalModelJson(args);
  if (existing) { if (existing.requestCanonical !== requestCanonical) contentDenied("CONTENT_IDEMPOTENCY_CONFLICT"); return existing; }
  const jobId = `content:${await semanticHash(canonicalModelJson([s, reference.principalId, args.requestId]))}`;
  const parent = args.parentRunId ? await parentBinding(ctx, reference, args.parentRunId, args.conversationId) : undefined;
  const binding = parent ?? await bindTrustedBudget(ctx, { reference, operationKey: contentOperation(args.intent), requestId: jobId, requestCanonical });
  let sourceMessagePin: ContentJob["sourceMessagePin"], sourceWitnesses: ContentJob["sourceWitnesses"] = parent?.sourceWitnesses ?? [], artifactWitnesses: ContentJob["artifactWitnesses"] = parent?.artifactWitnesses ?? [];
  if (args.sourceMessageId) { if (!conversation) contentDenied(); const bridge = await ctx.db.query("runtimeTranscriptMessages").withIndex("by_native", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("nativeMessageId", args.sourceMessageId!)).unique();
    if (!bridge || !bridge.approved) contentDenied(); const native = await ctx.runQuery(agentComponent.messages.getMessagesByIds, { messageIds: [args.sourceMessageId] }); await verifyMessage(ctx, conversation, bridge, native[0]);
    sourceMessagePin = { revision: bridge.revision, contentHash: bridge.contentHash }; sourceWitnesses = [...sourceWitnesses, ...bridge.contextSourceWitnesses ?? []]; artifactWitnesses = [...artifactWitnesses, ...bridge.artifactContextWitnesses ?? []]; }
  let artifactId: string | undefined, artifactVersion: number | undefined, artifactHash: string | undefined;
  if (args.artifact) {
    const metadata = await readArtifactContext(ctx, reference, args.artifact.artifactId); if (metadata.artifactVersion !== args.artifact.version || !["text", "code", "sheet"].includes(metadata.kind) || args.intent !== "suggestions" && metadata.kind !== args.intent) contentDenied("STALE_CONTEXT");
    artifactWitnesses = [...artifactWitnesses, await artifactMetadataWitness(metadata)];
    const artifact = await ctx.db.query("artifacts").withIndex("by_runtime_key", q => q.eq("tenantId", s.tenantId).eq("memorySpaceId", s.memorySpaceId).eq("artifactId", args.artifact!.artifactId)).unique(); if (!artifact) contentDenied();
    await recheckAuthority(ctx, reference, { ...s, capability: "write", resource: { ...s, resourceType: "artifact", resourceId: artifact.artifactId, ownerPrincipalId: artifact.ownerPrincipalId! } });
    artifactId = artifact.artifactId; artifactVersion = artifact.version; artifactHash = await semanticHash(canonicalModelJson([artifact.title, artifact.content ?? ""]));
  } else if (!["title", "suggestions"].includes(args.intent)) {
    artifactId = `artifact:${jobId}`; artifactVersion = 1; artifactHash = await semanticHash(canonicalModelJson(["Pending document", ""]));
    const row = { ...s, artifactId, ownerPrincipalId: reference.principalId, lastActorPrincipalId: reference.principalId, kind: args.intent as "text" | "code" | "sheet", streamingState: "draft" as const, title: "Pending document", content: "", version: 1, versionPointer: 1,
      versionHistory: [{ version: 1, content: "", title: "Pending document", timestamp: Date.now(), changedBy: reference.principalId, changeType: "create" as const }], tags: [], metadata: { version: 1, contentJobId: jobId }, ...(conversation ? { conversationRef: { conversationId: conversation.conversationId } } : {}), createdAt: Date.now(), updatedAt: Date.now() };
    validateArtifact(row); await ctx.db.insert("artifacts", row);
  }
  if (sourceWitnesses.length > 64 || artifactWitnesses.length > 32) contentDenied("CONTEXT_LIMIT_EXCEEDED");
  const id = await ctx.db.insert("runtimeContentJobs", { ...s, ownerPrincipalId: reference.principalId, jobId, requestId: args.requestId, requestCanonical, reference, intent: args.intent, prompt: args.prompt,
    ...conversation ? { conversationId: conversation.conversationId, conversationEpoch: conversation.epoch, conversationRevision: executionRevision(conversation) } : {},
    ...args.sourceMessageId ? { sourceMessageId: args.sourceMessageId, sourceMessagePin } : {}, ...args.parentRunId ? { parentRunId: args.parentRunId } : {},
    ...artifactId ? { artifactId, artifactVersion, artifactHash } : {}, ...args.artifact ? { sourceArtifactId: args.artifact.artifactId } : {}, sourceWitnesses, artifactWitnesses, deliveryArtifactWitnesses: artifactWitnesses.filter(witness => witness.artifactId !== artifactId),
    runBudgetId: binding.runBudgetId, runAccountId: binding.runAccountId, ...parent ? { parentOperationId: parent.parentOperationId } : {},
    stage: "primary", state: "pending", revision: 1, expiresAt: Date.now() + CONTENT_DEADLINE_MS, createdAt: Date.now(), updatedAt: Date.now() });
  if (dispatch) { const workflowId = await workflow.start(ctx, makeFunctionReference<"mutation">("runtimeContentJobs:execute") as unknown as Parameters<typeof workflow.start>[1], { jobId }); await ctx.db.patch("runtimeContentJobs", id, { workflowId }); }
  await ctx.scheduler.runAfter(CONTENT_DEADLINE_MS, jobMutation("expire"), { jobId }); return (await ctx.db.get("runtimeContentJobs", id))!;
}
export const submit = mutation({ args: { ...selectors, version: v.literal(1), requestId: v.string(), intent: contentIntent, prompt: v.string(), conversationId: v.optional(v.string()), sourceMessageId: v.optional(v.string()), parentRunId: v.optional(v.string()), artifact: v.optional(v.object({ artifactId: v.string(), version: v.number() })) }, handler: async (ctx, args): Promise<RuntimeContentJobV1> => {
  const actor = await requireDataAuthority(ctx, args, "run"), reference = dataAuthorityReference(actor); const { tenantId: _tenant, memorySpaceId: _space, ...input } = args;
  return publicContentJob(ctx, await enqueueContent(ctx, reference, input), reference);
} });
export const get = mutation({ args: select, handler: async (ctx, args): Promise<RuntimeContentJobV1> => { const reference = dataAuthorityReference(await requireDataAuthority(ctx, args, "read")); return publicContentJob(ctx, await contentJob(ctx, args.jobId), reference); } });
export const list = mutation({ args: { ...selectors, conversationId: v.optional(v.string()), limit: v.optional(v.number()) }, handler: async (ctx, args): Promise<RuntimeContentJobV1[]> => {
  const reference = dataAuthorityReference(await requireDataAuthority(ctx, args, "read")), limit = args.limit ?? 20; if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) contentDenied("INVALID_CONTENT_INPUT");
  const rows = await ctx.db.query("runtimeContentJobs").withIndex("by_owner", q => q.eq("tenantId", reference.tenantId).eq("memorySpaceId", reference.memorySpaceId!).eq("ownerPrincipalId", reference.principalId)).order("desc").take(101);
  const result: RuntimeContentJobV1[] = []; for (const job of rows) { if (args.conversationId && job.conversationId !== args.conversationId) continue;
    try { result.push(await publicContentJob(ctx, job, reference)); } catch (error) { if (!(error instanceof ConvexError) || !["FORBIDDEN", "STALE_CONTEXT"].includes(String(error.data.code))) throw error; }
    if (result.length >= limit) break; } return result;
} });
export const claim = internalMutation({ args: { jobId: v.string() }, handler: async (ctx, args) => {
  const job = await contentJob(ctx, args.jobId); if (["ready", "failed", "unknown", "cancelled", "expired"].includes(job.state)) return null;
  if (job.expiresAt <= Date.now()) { await ctx.db.patch("runtimeContentJobs", job._id, { state: "expired", failureCode: "CONTENT_JOB_EXPIRED", revision: job.revision + 1, updatedAt: Date.now() }); return null; }
  if (job.state === "running") { if (job.leaseExpiresAt! > Date.now()) return null; await ctx.db.patch("runtimeContentJobs", job._id, { state: "unknown", failureCode: "CONTENT_OPERATION_UNKNOWN", revision: job.revision + 1, updatedAt: Date.now() }); return null; }
  const leaseToken = crypto.randomUUID(); const next = { ...job, state: "running" as const, leaseToken, leaseExpiresAt: Date.now() + CONTENT_LEASE_MS };
  await checkContentJob(ctx, next, job.reference, true); await ctx.db.patch("runtimeContentJobs", job._id, { state: next.state, leaseToken, leaseExpiresAt: next.leaseExpiresAt, revision: job.revision + 1, updatedAt: Date.now() }); return { jobId: job.jobId, leaseToken };
} });
export async function leasedContent(ctx: MutationCtx, args: { jobId: string; leaseToken: string }) { const job = await contentJob(ctx, args.jobId); if (job.leaseToken !== args.leaseToken) contentDenied("CONTENT_LEASE_EXPIRED"); await checkContentJob(ctx, job, job.reference, true); return job; }
export const input = internalMutation({ args: work, handler: async (ctx, args) => { const job = await leasedContent(ctx, args); const artifact = await checkContentJob(ctx, job, job.reference, true); return { job, document: job.sourceArtifactId ? artifact?.content ?? "" : "" }; } });
export const pin = internalMutation({ args: { ...work, snapshotCanonical: v.string() }, handler: async (ctx, args) => { const job = await leasedContent(ctx, args); const key = job.stage === "primary" ? "primarySnapshot" : "titleSnapshot"; if (job[key] && job[key] !== args.snapshotCanonical) contentDenied("POLICY_DENIED"); await ctx.db.patch("runtimeContentJobs", job._id, { [key]: args.snapshotCanonical }); return null; } });
export const bindOperation = internalMutation({ args: { ...work, operationId: v.id("runtimeModelOperations") }, handler: async (ctx, args) => { const job = await leasedContent(ctx, args), op = await ctx.db.get("runtimeModelOperations", args.operationId); const key = job.stage === "primary" ? "primaryOperationId" : "titleOperationId";
  if (!op || op.runAccountId !== job.runAccountId || op.operationKey !== (job.stage === "primary" ? contentOperation(job.intent) : "conversation.title") || canonicalModelJson(op.reference) !== canonicalModelJson(job.reference) || job[key] && job[key] !== op._id) contentDenied(); await ctx.db.patch("runtimeContentJobs", job._id, { [key]: op._id }); return null;
} });
export async function confirmedContentDraft(ctx: MutationCtx, job: ContentJob, stage: "primary" | "title", text: string) {
  const operationId = stage === "primary" ? job.primaryOperationId : job.titleOperationId; if (!operationId) contentDenied("CONTENT_RECOVERY_INCOMPLETE");
  const operation = await ctx.db.get("runtimeModelOperations", operationId), snapshot = stage === "primary" ? job.primarySnapshot : job.titleSnapshot;
  if (!operation || operation.runAccountId !== job.runAccountId || operation.operationKey !== (stage === "primary" ? contentOperation(job.intent) : "conversation.title")
    || operation.semanticId !== `${job.jobId}:${stage}` || operation.parentOperationId !== (stage === "title" ? job.primaryOperationId : job.parentOperationId)
    || operation.cancelled || operation.overrun || canonicalModelJson(operation.reference) !== canonicalModelJson(job.reference) || !snapshot || operation.snapshotCanonical !== snapshot) contentDenied("CONTENT_RECOVERY_INCOMPLETE");
  const attempts = await ctx.db.query("runtimeModelAttempts").withIndex("by_operation", q => q.eq("operationDocumentId", operationId)).take(2);
  const attempt = attempts[0];
  if (attempts.length !== 1 || attempt.runAccountId !== job.runAccountId || attempt.snapshotCanonical !== snapshot || attempt.resultAttachmentState !== "attached" || attempt.resultWithheld
    || !attempt.terminalEvidenceCanonical || await semanticHash(attempt.terminalEvidenceCanonical) !== attempt.terminalEvidenceHash || attempt.privateResultCanonical !== canonicalModelJson({ text })) contentDenied("CONTENT_RECOVERY_INCOMPLETE");
  const terminal = JSON.parse(attempt.terminalEvidenceCanonical) as Record<string, unknown>, policy = JSON.parse(snapshot) as { modelId: string; nativeInterface: string };
  if (terminal.version !== 1 || terminal.outcome !== "confirmed" || terminal.proof !== "provider-terminal-v1" || terminal.dispatchIdentity !== attempt.dispatchIdentity
    || terminal.modelId !== policy.modelId || terminal.nativeInterface !== policy.nativeInterface) contentDenied("CONTENT_RECOVERY_INCOMPLETE");
  if (stage === job.stage) {
    const resolved = await ctx.runQuery(makeFunctionReference<"query">("runtimeModelPolicy:resolve"), { reference: job.reference, operationKey: operation.operationKey, runBudgetId: job.runBudgetId,
      ...(operation.parentOperationId ? { parentOperationId: operation.parentOperationId } : {}) }) as { snapshot: unknown };
    if (canonicalModelJson(resolved.snapshot) !== snapshot) contentDenied("POLICY_DENIED");
  }
}
function rejectedTitle(text: string): boolean {
  // A fallback repairs only a confirmed format failure, never an output bound.
  if (!text.trim() || new TextEncoder().encode(text).byteLength > CONTENT_MAX_OUTPUT_BYTES) contentDenied("CONTENT_OUTPUT_INVALID");
  try { parseContentOutput("title", text); return false; } catch { return true; }
}
function fallbackTitle(job: ContentJob): string {
  if (job.stage !== "title" || job.sourceArtifactId || !["text", "code", "sheet"].includes(job.intent) || !job.primaryResult) contentDenied("CONTENT_RECOVERY_INCOMPLETE");
  parseContentOutput(job.intent, job.primaryResult);
  return job.intent === "code" ? "Generated Code" : job.intent === "sheet" ? "Generated Sheet" : "Generated Document";
}
async function titlePatch(ctx: MutationCtx, job: ContentJob, text: string) {
  await confirmedContentDraft(ctx, job, "title", text);
  if (!rejectedTitle(text)) return { generatedTitle: text };
  await confirmedContentDraft(ctx, job, "primary", job.primaryResult ?? "");
  return { generatedTitle: fallbackTitle(job), rejectedTitleResult: text, failureCode: "CONTENT_TITLE_INVALID" };
}
export const save = internalMutation({ args: { ...work, text: v.string() }, handler: async (ctx, args) => {
  const job = await leasedContent(ctx, args);
  if (job.stage === "title") {
    const patch = await titlePatch(ctx, job, args.text);
    if (job.generatedTitle !== undefined && (job.generatedTitle !== patch.generatedTitle || job.rejectedTitleResult !== ("rejectedTitleResult" in patch ? patch.rejectedTitleResult : undefined))) contentDenied("CONTENT_IDEMPOTENCY_CONFLICT");
    await ctx.db.patch("runtimeContentJobs", job._id, { ...patch, updatedAt: Date.now() }); return null;
  }
  await confirmedContentDraft(ctx, job, "primary", args.text);
  if (job.intent === "title" && rejectedTitle(args.text)) {
    await ctx.db.patch("runtimeContentJobs", job._id, { rejectedTitleResult: args.text, state: "failed", failureCode: "CONTENT_TITLE_INVALID", revision: job.revision + 1, updatedAt: Date.now() }); return null;
  }
  parseContentOutput(job.intent, args.text);
  if (job.primaryResult !== undefined && job.primaryResult !== args.text) contentDenied("CONTENT_IDEMPOTENCY_CONFLICT");
  await ctx.db.patch("runtimeContentJobs", job._id, { primaryResult: args.text, updatedAt: Date.now() }); return null;
} });
export const next = internalMutation({ args: work, handler: async (ctx, args) => { const job = await leasedContent(ctx, args); if (!job.primaryResult || !job.primaryOperationId) contentDenied(); if (["title", "suggestions"].includes(job.intent) || job.sourceArtifactId) return false; await ctx.db.patch("runtimeContentJobs", job._id, { stage: "title", leaseExpiresAt: Date.now() + CONTENT_LEASE_MS }); return true; } });
export const publish = internalMutation({ args: work, handler: async (ctx, args) => publishContent(ctx, await leasedContent(ctx, args)) });
async function publishContent(ctx: MutationCtx, job: ContentJob) {
  const artifact = await checkContentJob(ctx, job, job.reference, true); if (!job.primaryResult) contentDenied("CONTENT_RECOVERY_INCOMPLETE");
  await confirmedContentDraft(ctx, job, "primary", job.primaryResult);
  if (job.generatedTitle) {
    if (job.rejectedTitleResult !== undefined) {
      if (!rejectedTitle(job.rejectedTitleResult) || job.generatedTitle !== fallbackTitle(job) || job.failureCode !== "CONTENT_TITLE_INVALID") contentDenied("CONTENT_RECOVERY_INCOMPLETE");
      await confirmedContentDraft(ctx, job, "title", job.rejectedTitleResult);
    } else await confirmedContentDraft(ctx, job, "title", job.generatedTitle);
  }
  // Resolve the current final stage without reserving or redispatching. Its
  // parent checks cover the completed primary operation and shared account.
  await ctx.runQuery(makeFunctionReference<"query">("runtimeModelPolicy:resolve"), { reference: job.reference, operationKey: job.stage === "primary" ? contentOperation(job.intent) : "conversation.title", runBudgetId: job.runBudgetId,
    ...(job.stage === "title" ? { parentOperationId: job.primaryOperationId! } : job.parentOperationId ? { parentOperationId: job.parentOperationId } : {}) });
  const output = parseContentOutput(job.intent, job.primaryResult); let result: Pick<RuntimeContentJobV1, "title" | "content" | "suggestions" | "artifactVersion">;
  if (job.intent === "title") {
    const conversation = await conversationById(ctx, job.reference, job.conversationId!); if (!conversation) contentDenied(); const title = output as string;
    const metadata = conversation.metadataCanonical ? JSON.parse(conversation.metadataCanonical) as Record<string, unknown> : {};
    await ctx.db.patch("runtimeConversations", conversation._id, { metadataCanonical: canonicalModelJson({ ...metadata, title }), updatedAt: Date.now() }); result = { title };
  } else if (job.intent === "suggestions") {
    if (!artifact || !Array.isArray(output) || output.some(item => !artifact.content?.includes(item.originalText))) contentDenied("CONTENT_OUTPUT_INVALID");
    result = { artifactVersion: artifact.versionPointer, suggestions: await Promise.all(output.map(async (item, ordinal) => ({ ...item, suggestionId: await semanticHash(canonicalModelJson([job.jobId, ordinal, item])) }))) };
  } else {
    if (!artifact || typeof output !== "string") contentDenied(); const title = job.generatedTitle ? parseContentOutput("title", job.generatedTitle) as string : artifact.title;
    if (!job.sourceArtifactId && !job.generatedTitle) contentDenied("CONTENT_RECOVERY_INCOMPLETE");
    const version = artifact.version + 1; const patch = { content: output, title, version, versionPointer: version, streamingState: "final" as const, lastActorPrincipalId: job.ownerPrincipalId,
      versionHistory: [...artifact.versionHistory, { version, content: output, title, timestamp: Date.now(), changedBy: job.ownerPrincipalId, changeType: "update" as const }], updatedAt: Date.now() };
    validateArtifact({ ...artifact, ...patch }); await ctx.db.patch("artifacts", artifact._id, patch); result = { artifactVersion: version, content: output, title };
  }
  await ctx.db.patch("runtimeContentJobs", job._id, { state: "ready", resultCanonical: canonicalModelJson(result), revision: job.revision + 1, updatedAt: Date.now() }); return null;
}
export const failed = internalMutation({ args: { jobId: v.string(), leaseToken: v.string(), uncertain: v.boolean() }, handler: async (ctx, args) => { const job = await contentJob(ctx, args.jobId); if (job.leaseToken !== args.leaseToken || job.state !== "running") return null; await ctx.db.patch("runtimeContentJobs", job._id, { state: args.uncertain ? "unknown" : "failed", failureCode: job.rejectedTitleResult ? "CONTENT_TITLE_INVALID" : args.uncertain ? "CONTENT_OPERATION_UNKNOWN" : "CONTENT_OPERATION_FAILED", revision: job.revision + 1, updatedAt: Date.now() }); return null; } });
export const cancel = mutation({ args: select, handler: async (ctx, args) => { const reference = dataAuthorityReference(await requireDataAuthority(ctx, args, "write")), job = await contentJob(ctx, args.jobId); if (job.ownerPrincipalId !== reference.principalId || job.tenantId !== reference.tenantId || job.memorySpaceId !== reference.memorySpaceId) contentDenied();
  if (!["ready", "failed", "unknown", "cancelled", "expired"].includes(job.state)) { await ctx.db.patch("runtimeContentJobs", job._id, { state: "cancelled", revision: job.revision + 1, updatedAt: Date.now() }); if (job.workflowId) await workflow.cancel(ctx, job.workflowId as Parameters<typeof workflow.cancel>[1]); } return publicContentJob(ctx, (await ctx.db.get("runtimeContentJobs", job._id))!, reference);
} });
export const expire = internalMutation({ args: { jobId: v.string() }, handler: async (ctx, args) => { const job = await contentJob(ctx, args.jobId); if (job.expiresAt <= Date.now() && ["pending", "running"].includes(job.state)) await ctx.db.patch("runtimeContentJobs", job._id, { state: "expired", failureCode: "CONTENT_JOB_EXPIRED", revision: job.revision + 1, updatedAt: Date.now() }); return null; } });
export const reconcile = mutation({ args: select, handler: async (ctx, args) => { const reference = dataAuthorityReference(await requireDataAuthority(ctx, args, "write")), job = await contentJob(ctx, args.jobId); if (job.ownerPrincipalId !== reference.principalId) contentDenied();
  if (job.state === "ready") return publicContentJob(ctx, job, reference);
  if (["cancelled", "expired", "failed"].includes(job.state) || !job.primaryResult || job.expiresAt <= Date.now()) contentDenied("CONTENT_RECOVERY_INCOMPLETE");
  let next = { ...job, state: "running" as const, leaseToken: crypto.randomUUID(), leaseExpiresAt: Date.now() + CONTENT_LEASE_MS };
  // Recovery joins only durable confirmed drafts; it never issues a model call.
  await checkContentJob(ctx, next, job.reference, true);
  // The policy guard reads this same transaction's current job state. Any
  // evidence or publication denial rolls this recovery lease back atomically.
  await ctx.db.patch("runtimeContentJobs", job._id, { state: "running", leaseToken: next.leaseToken, leaseExpiresAt: next.leaseExpiresAt });
  if (!next.generatedTitle && next.stage === "title" && next.titleOperationId && !next.sourceArtifactId && ["text", "code", "sheet"].includes(next.intent)) {
    const attempts = await ctx.db.query("runtimeModelAttempts").withIndex("by_operation", q => q.eq("operationDocumentId", next.titleOperationId!)).take(2);
    const text = attempts.length === 1 && attempts[0].privateResultCanonical ? (JSON.parse(attempts[0].privateResultCanonical) as { text?: unknown }).text : undefined;
    if (typeof text !== "string" || !rejectedTitle(text)) contentDenied("CONTENT_RECOVERY_INCOMPLETE");
    const patch = await titlePatch(ctx, next, text); next = { ...next, ...patch }; await ctx.db.patch("runtimeContentJobs", job._id, patch);
  }
  await publishContent(ctx, next); return publicContentJob(ctx, (await ctx.db.get("runtimeContentJobs", job._id))!, reference);
} });
export const execute = workflow.define({ args: { jobId: v.string() }, returns: v.null(), handler: async (step, args) => {
  const lease = await step.runMutation(jobMutation("claim"), args) as { jobId: string; leaseToken: string } | null; if (!lease) return null;
  try { await step.runAction(stageAction, lease, { retry: false, name: "governed content" }); if (await step.runMutation(jobMutation("next"), lease)) await step.runAction(stageAction, lease, { retry: false, name: "governed artifact title" }); await step.runMutation(jobMutation("publish"), lease); }
  catch { await step.runMutation(jobMutation("failed"), { ...lease, uncertain: true }); } return null;
} });

/** User-selected application of one exact suggestion, without model calls. */
export const applySuggestion = mutation({ args: { ...select, suggestionId: v.string(), artifactVersion: v.number() }, handler: async (ctx, args): Promise<RuntimeContentJobV1> => {
  const reference = dataAuthorityReference(await requireDataAuthority(ctx, args, "write")), job = await contentJob(ctx, args.jobId);
  if (job.intent !== "suggestions" || job.state !== "ready" || !job.resultCanonical || job.ownerPrincipalId !== reference.principalId) contentDenied();
  const artifact = await checkContentJob(ctx, job, reference); if (!artifact) contentDenied();
  if (job.appliedSuggestionId) { if (job.appliedSuggestionId !== args.suggestionId || job.artifactVersion !== args.artifactVersion) contentDenied("CONTENT_IDEMPOTENCY_CONFLICT"); return publicContentJob(ctx, job, reference); }
  const result = JSON.parse(job.resultCanonical) as Pick<RuntimeContentJobV1, "suggestions">;
  const suggestion = result.suggestions?.find(value => value.suggestionId === args.suggestionId);
  if (!suggestion || artifact.versionPointer !== args.artifactVersion || args.artifactVersion !== job.artifactVersion || await semanticHash(canonicalModelJson([artifact.title, artifact.content ?? ""])) !== job.artifactHash) contentDenied("STALE_CONTEXT");
  await recheckAuthority(ctx, reference, { capability: "write", tenantId: job.tenantId, memorySpaceId: job.memorySpaceId, resource: { tenantId: job.tenantId, memorySpaceId: job.memorySpaceId, resourceType: "artifact", resourceId: artifact.artifactId, ownerPrincipalId: artifact.ownerPrincipalId! } });
  if (!artifact.content?.includes(suggestion.originalText)) contentDenied("STALE_CONTEXT");
  const content = artifact.content.replace(suggestion.originalText, suggestion.suggestedText), version = artifact.version + 1;
  const patch = { content, version, versionPointer: version, updatedAt: Date.now(), lastActorPrincipalId: reference.principalId,
    versionHistory: [...artifact.versionHistory, { version, content, title: artifact.title, timestamp: Date.now(), changedBy: reference.principalId, changeType: "update" as const }] };
  validateArtifact({ ...artifact, ...patch }); await ctx.db.patch("artifacts", artifact._id, patch);
  await ctx.db.patch("runtimeContentJobs", job._id, { appliedSuggestionId: args.suggestionId, appliedArtifactVersion: version, resultCanonical: canonicalModelJson({ ...result, artifactVersion: version, content, title: artifact.title }), revision: job.revision + 1, updatedAt: Date.now() });
  return publicContentJob(ctx, (await ctx.db.get("runtimeContentJobs", job._id))!, reference);
} });
/** Only an active Agent Workflow can create this shared-account automatic title. */
export const enqueueParentTitle = internalMutation({ args: { reference: runtimeAuthorityReference, runId: v.string() }, handler: async (ctx, args) => {
  const { row: run } = await currentRun(ctx, args.reference, args.runId, "run"); const conversation = await conversationById(ctx, args.reference, run.conversationId); if (!conversation) contentDenied();
  const metadata = conversation.metadataCanonical ? JSON.parse(conversation.metadataCanonical) as Record<string, unknown> : {};
  if (typeof metadata.title === "string" && metadata.title.trim()) return null;
  const sourceMessageId = run.inputMessageIds[0]; if (!sourceMessageId) contentDenied();
  const messages = await ctx.runQuery(agentComponent.messages.getMessagesByIds, { messageIds: [sourceMessageId] }), message = messages[0];
  if (!message || message.message?.role !== "user") contentDenied();
  const content = typeof message.message.content === "string" ? message.message.content : message.message.content.filter(part => part.type === "text").map(part => part.text).join("\n");
  return (await enqueueContent(ctx, args.reference, { version: 1, requestId: `automatic-title:${run.runId}`, intent: "title", prompt: content, conversationId: run.conversationId, sourceMessageId, parentRunId: run.runId }, false)).jobId;
} });
