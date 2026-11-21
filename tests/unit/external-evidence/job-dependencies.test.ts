/** Actual job, artifact, native ledger and gateway handlers on controlled ports.
 * Source custody rows are seeded; no hosted Convex/OCC/provider proof is claimed. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { ActionCtx, MutationCtx } from "../../../convex-dev/_generated/server";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import type { ContextSourceWitness } from "../../../src/domain/context-witness";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { RuntimeContentJobV1 } from "../../../src/domain/content";
import type { RuntimeMediaJobV1 } from "../../../src/domain/media-jobs";
import type { ContentModelFactory } from "../../../convex-dev/runtimeContentGateway";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { semanticHash } from "../../../src/domain/profile";

let workflowSequence = 0;
const workflowJournals = new Map<string, string[]>();
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start() { const id = `workflow:controlled:${++workflowSequence}`; workflowJournals.set(id, Array.from({ length: 12 }, () => "PRIVATE-WORKFLOW-JOURNAL")); return id; }
  async cancel() {}
} }));
const { mediaFixture, media, gateway, installMediaMockRoot, png } = await import("../runtimeMedia/fixture");
const { artifacts } = await import("../runtimeAssets/fixture");
const { invoke, clock, ledger, installIngestionMockRoot, currentMockRootSelection } = await import("../runtimeTranscript/fixture");
const content = await import("../../../convex-dev/runtimeContentJobs");
const { processContentStageHandler, processStage } = await import("../../../convex-dev/runtimeContentGateway");
const { governGatewayLanguageModel } = await import("../../../convex-dev/runtimeGateway");
const { registerSourceDependencies, sourceDependencyWitnesses } = await import("../../../convex-dev/runtimeSourceDependencies");
const { checkContentJob } = await import("../../../convex-dev/runtimeContentFence");
const { checkMediaJob } = await import("../../../convex-dev/runtimeMediaFence");
const { readArtifactContext } = await import("../../../convex-dev/runtimeArtifactContext");
const erasure = await import("../../../convex-dev/runtimeExternalErasure");

beforeEach(() => { installMediaMockRoot(); workflowSequence = 0; workflowJournals.clear(); });
afterEach(() => { jest.restoreAllMocks(); });
async function fixture(mediaPolicy = false) {
  const f = await mediaFixture(), mutation = f.ctx.runMutation.bind(f.ctx), query = f.ctx.runQuery.bind(f.ctx);
  let workflowCleanups = 0, workflowBarriers = 0;
  // The media root permits this fixture's default Agent context size. Content
  // calls use the existing ingestion root's plain content dispatch contract.
  if (!mediaPolicy) { installIngestionMockRoot(); await f.call(ledger.installDeploymentPolicy, currentMockRootSelection()); }
  f.ctx.runMutation = (async (reference, args) => {
    const path = (reference as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")];
    if (path?.includes("workflow") && path.includes("cleanup")) {
      workflowCleanups++; const id = (args as { workflowId: string }).workflowId;
      workflowJournals.set(id, (workflowJournals.get(id) ?? []).slice(8)); return true;
    }
    let name: string; try { name = getFunctionName(reference); } catch { return mutation(reference, args); }
    if (name.startsWith("runtimeContentJobs:")) return f.transaction(() => invoke(content[name.split(":")[1] as keyof typeof content], f.ctx, args));
    return mutation(reference, args);
  }) as MutationCtx["runMutation"];
  f.ctx.runQuery = (async (reference, args) => {
    const path = (reference as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")];
    if (path?.includes("workflow") && path.includes("listSteps")) {
      workflowBarriers++; const remaining = workflowJournals.get((args as { workflowId: string }).workflowId) ?? [];
      const pagination = (args as { paginationOpts: { cursor: string | null; numItems: number } }).paginationOpts, offset = Number(pagination.cursor ?? 0), end = offset + pagination.numItems;
      return { page: remaining.slice(offset, end).map((value, index) => ({ kind: "function", workId: `finished:${offset + index}`, runResult: { kind: "success", returnValue: value } })), isDone: end >= remaining.length, continueCursor: String(end) };
    }
    let name: string; try { name = getFunctionName(reference); } catch { return query(reference, args); }
    return name === "runtimeModelPolicy:resolve" ? invoke(ledger.resolve, f.ctx, args) : query(reference, args); }) as MutationCtx["runQuery"];
  async function source(sourceId = "external-source") {
    const text = `PRIVATE-SOURCE-${sourceId}`, contentHash = await semanticHash(text);
    const witness: ContextSourceWitness = { sourceId, sourceEventId: `capture:${sourceId}`, sourceRevision: 1, contentHash };
    const scope = { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId };
    f.db.seed("runtimeMemorySources", { ...scope, lineage: { ...witness, role: "external", trust: "unverified_external" }, content: text, contentHash, createdAt: clock });
    f.db.seed("runtimeExternalSources", { ...scope, sourceId, identityCanonical: "[]", provider: "fixture", externalSourceId: sourceId,
      maxExternalRevision: 1, currentVersionId: `version:${sourceId}`, currentSourceRevision: 1, createdAt: clock, updatedAt: clock });
    f.db.seed("runtimeExternalVersions", { ...scope, sourceId, versionId: `version:${sourceId}`, externalRevision: 1, kind: "content",
      detailsCanonical: canonicalModelJson({ author: {}, assetReferences: [] }), originalText: text, originalContentHash: contentHash, normalizedContentHash: contentHash,
      sourceRevision: 1, sequence: 1, ownerSequence: 1, capturedAt: clock });
    return witness;
  }
  function erase(witness: ContextSourceWitness) {
    f.db.seed("runtimeExternalErasureFences", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
      ownerPrincipalId: f.reference.principalId, sourceId: witness.sourceId, erasedAt: clock });
  }
  async function document(witness: ContextSourceWitness, artifactId = "declared-derived-document") {
    await f.call(artifacts.create, { artifactId, title: "Derived document", content: "Alpha sentence. Beta sentence." });
    await f.transaction(() => registerSourceDependencies(f.ctx, f.reference, { kind: "artifact", id: artifactId, revision: 1 }, [witness]));
    return artifactId;
  }
  async function submit(artifactId: string, requestId = "derived-content", intent: "text" | "suggestions" = "text", version = 1) {
    return f.call<RuntimeContentJobV1>(content.submit, { version: 1, requestId, intent, prompt: "Improve this document", artifact: { artifactId, version } });
  }
  function contentFactory(text: string): ContentModelFactory {
    return async (composition, binding) => {
      const resolution = await composition.ledger.resolve(binding);
      const model: LanguageModelV4 = { specificationVersion: "v4", provider: "convexGateway.chat", modelId: resolution.snapshot.modelId, supportedUrls: {},
        doStream: async () => { throw new Error("Unexpected stream"); }, doGenerate: async () => ({ content: [{ type: "text", text }],
          finishReason: { unified: "stop", raw: "stop" }, warnings: [], usage: { inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 2, text: 2, reasoning: 0 } },
          response: { body: { id: "controlled-content", model: resolution.snapshot.modelId, choices: [{ finish_reason: "stop", message: { content: text } }], usage: { prompt_tokens: 8, completion_tokens: 2, total_tokens: 10 } } } }) };
      return governGatewayLanguageModel(model, composition, binding, resolution);
    };
  }
  async function generate(jobId: string, text: string) {
    const lease = await f.call<{ jobId: string; leaseToken: string }>(content.claim, { jobId });
    await processContentStageHandler(f.action, lease, contentFactory(text));
    await f.call(content.publish, lease);
    return lease;
  }
  async function purge(witness: ContextSourceWitness) {
    const scope = { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, sourceId: witness.sourceId };
    await f.call(erasure.eraseSource, scope);
    let complete = false, turns = 0;
    while (!complete && turns++ < 400) complete = (await f.call<{ complete: boolean }>(erasure.continueSource, scope)).complete;
    expect(complete).toBe(true); return turns;
  }
  const dependencies = (kind: "content" | "media" | "artifact" | "model", id: string, revision = 0) => sourceDependencyWitnesses(f.ctx, f.reference, { kind, id, revision });
  return { ...f, submitMedia: f.submit, source, erase, document, submit, generate, contentFactory, dependencies, purge,
    workflowCounts: () => ({ cleanups: workflowCleanups, barriers: workflowBarriers }) };
}

it("content enqueue inherits exact artifact ancestry while its direct source list is empty", async () => {
  const f = await fixture(), witness = await f.source(), artifactId = await f.document(witness);
  const job = await f.submit(artifactId);
  expect(f.db.table("runtimeContentJobs")[0].sourceWitnesses).toEqual([]);
  expect(await f.dependencies("content", job.jobId)).toMatchObject([witness]);
  await f.submit(artifactId);
  expect(f.db.table("runtimeSourceDependencies").filter(row => row.targetKind === "content")).toHaveLength(1);
  f.erase(witness);
  await expect(f.call(content.get, { jobId: job.jobId })).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  await expect(f.call(content.claim, { jobId: job.jobId })).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  expect(f.db.table("runtimeContentJobs")[0].state).toBe("pending");
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});

it("dependency registration and new job/artifact/budget custody roll back together", async () => {
  const f = await fixture(), witness = await f.source(), artifactId = await f.document(witness);
  const counts = { artifacts: f.db.table("artifacts").length, accounts: f.db.table("runtimeBudgetAccounts").length, dependencies: f.db.table("runtimeSourceDependencies").length };
  const insert = f.db.insert.bind(f.db);
  jest.spyOn(f.db, "insert").mockImplementation(async (table, row) => { if (table === "runtimeSourceDependencies" && row.targetKind === "content") throw new Error("INJECTED_DEPENDENCY_FAILURE"); return insert(table, row); });
  await expect(f.submit(artifactId)).rejects.toThrow("INJECTED_DEPENDENCY_FAILURE");
  expect(f.db.table("runtimeContentJobs")).toHaveLength(0);
  expect(f.db.table("artifacts")).toHaveLength(counts.artifacts);
  expect(f.db.table("runtimeBudgetAccounts")).toHaveLength(counts.accounts);
  expect(f.db.table("runtimeSourceDependencies")).toHaveLength(counts.dependencies);
});

it("a newly declared message source registers the content job and generated draft atomically", async () => {
  const f = await fixture(true), witness = await f.source(), run = await f.run();
  const bridge = f.db.table("runtimeTranscriptMessages").find(row => row.nativeMessageId === run.inputMessageIds[0])!;
  await f.db.patch("runtimeTranscriptMessages", bridge._id, { contextSourceWitnesses: [witness] });
  const args = { version: 1, requestId: "from-message", intent: "text", prompt: "Use the declared source", conversationId: run.conversationId, sourceMessageId: run.inputMessageIds[0] };
  const job = await f.call<RuntimeContentJobV1>(content.submit, args);
  expect(await f.dependencies("content", job.jobId)).toMatchObject([witness]);
  expect(await f.dependencies("artifact", job.artifactId!, 1)).toMatchObject([witness]);
  f.erase(witness); const accounts = f.db.table("runtimeBudgetAccounts").length;
  await expect(f.call(content.submit, { ...args, requestId: "late-message" })).rejects.toThrow();
  expect(f.db.table("runtimeContentJobs")).toHaveLength(1); expect(f.db.table("artifacts")).toHaveLength(1);
  expect(f.db.table("runtimeBudgetAccounts")).toHaveLength(accounts);
});

it("content publication registers the exact generated version and bound native operation", async () => {
  const f = await fixture(), witness = await f.source(), artifactId = await f.document(witness), job = await f.submit(artifactId);
  await f.generate(job.jobId, "Generated from the declared external source.");
  expect(await f.call(content.get, { jobId: job.jobId })).toMatchObject({ state: "ready", artifactVersion: 2, content: "Generated from the declared external source." });
  expect(await f.dependencies("artifact", artifactId, 2)).toMatchObject([witness]);
  expect(await f.dependencies("model", f.db.table("runtimeModelOperations")[0]._id)).toMatchObject([witness]);
  const child = await f.submit(artifactId, "second-generation", "text", 2);
  expect(await f.dependencies("content", child.jobId)).toMatchObject([witness]);
  f.erase(witness);
  await expect(f.call(content.claim, { jobId: child.jobId })).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
});

it("applying a declared source-derived suggestion registers only its resulting version", async () => {
  const f = await fixture(), witness = await f.source(), artifactId = await f.document(witness), job = await f.submit(artifactId, "suggestions", "suggestions");
  await f.generate(job.jobId, canonicalModelJson([{ originalText: "Alpha sentence.", suggestedText: "Clear alpha sentence.", description: "Clarity" }]));
  const ready = await f.call<RuntimeContentJobV1>(content.get, { jobId: job.jobId });
  await f.call(content.applySuggestion, { jobId: job.jobId, suggestionId: ready.suggestions![0].suggestionId, artifactVersion: 1 });
  expect(f.db.table("artifacts")[0]).toMatchObject({ content: "Clear alpha sentence. Beta sentence.", version: 2 });
  expect(await f.dependencies("artifact", artifactId, 2)).toMatchObject([witness]);
  expect(await f.dependencies("artifact", artifactId, 3)).toEqual([]);
});

it("the registered Content Workflow action keeps malformed private suggestions out of retained failure messages", async () => {
  const f = await fixture(), witness = await f.source(), artifactId = await f.document(witness), job = await f.submit(artifactId, "workflow-error", "suggestions");
  const marker = "SRC_SECRET", output = `${marker} is not a JSON suggestions array`;
  let actionError: Error | undefined;
  let completion: { kind: "failed"; error: string } | undefined;
  const step = {
    runMutation: async (reference: unknown, args: unknown) => {
      const name = getFunctionName(reference as Parameters<typeof getFunctionName>[0]);
      return f.call(content[name.split(":")[1] as keyof typeof content], args);
    },
    runAction: async (reference: unknown, args: { jobId: string; leaseToken: string }) => {
      expect(getFunctionName(reference as Parameters<typeof getFunctionName>[0])).toBe("runtimeContentGateway:processStage");
      try {
        return await (processStage as unknown as { _handler(ctx: ActionCtx, work: { jobId: string; leaseToken: string }, factory: ContentModelFactory): Promise<null> })._handler(f.action, args, f.contentFactory(output));
      } catch (error) {
        actionError = error as Error;
        // The installed Workpool worker retains Error.message for failures.
        completion = { kind: "failed", error: actionError.message };
        throw new Error(completion.error);
      }
    },
  };
  await (content.execute as unknown as { _handler(context: typeof step, input: { jobId: string }): Promise<null> })._handler(step, { jobId: job.jobId });
  expect(completion).toEqual({ kind: "failed", error: "CONTENT_OPERATION_FAILED" });
  expect(String(actionError?.stack)).not.toContain(marker);
  expect(Object.getOwnPropertyNames(actionError!)).not.toContain("cause");
  // Positive control: real governed native result attachment reached the action
  // before its malformed suggestions parser failed; no provider was contacted.
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
  expect(f.db.table("runtimeModelAttempts")[0].privateResultCanonical).toBe(canonicalModelJson({ text: output }));
  expect(f.db.table("runtimeContentJobs")[0]).toMatchObject({ state: "unknown", failureCode: "CONTENT_OPERATION_UNKNOWN" });
  expect(f.db.table("runtimeContentJobs")[0].primaryResult).toBeUndefined();
  await f.purge(witness);
  expect(f.db.table("runtimeModelAttempts")[0].privateResultCanonical).toBeUndefined();
  expect(JSON.stringify(completion)).not.toContain(marker);
});

it("source-derived conversation title publication records its exact generating job", async () => {
  const f = await fixture(true), witness = await f.source(), run = await f.run();
  const bridge = f.db.table("runtimeTranscriptMessages").find(row => row.nativeMessageId === run.inputMessageIds[0])!;
  await f.db.patch("runtimeTranscriptMessages", bridge._id, { contextSourceWitnesses: [witness] });
  installIngestionMockRoot(); jest.spyOn(Date, "now").mockReturnValue(clock + 60_001); await f.call(ledger.installDeploymentPolicy, currentMockRootSelection());
  const job = await f.call<RuntimeContentJobV1>(content.submit, { version: 1, requestId: "declared-title", intent: "title", prompt: "Use this declared source",
    conversationId: run.conversationId, sourceMessageId: run.inputMessageIds[0] });
  await f.generate(job.jobId, "Source Derived Title");
  const conversation = f.db.table("runtimeConversations").find(row => row.conversationId === run.conversationId)!;
  expect(JSON.parse(conversation.metadataCanonical as string)).toMatchObject({ title: "Source Derived Title" });
  expect(conversation.sourceTitleJobId).toBe(job.jobId);
  expect(await f.dependencies("content", job.jobId)).toMatchObject([witness]);
});

it("legacy content witnesses register at claim and root erasure fences late private writes", async () => {
  const f = await fixture(), witness = await f.source();
  const job = await f.call<RuntimeContentJobV1>(content.submit, { version: 1, requestId: "legacy", intent: "text", prompt: "Legacy prompt" });
  const stored = f.db.table("runtimeContentJobs")[0];
  await f.db.patch("runtimeContentJobs", stored._id, { sourceWitnesses: [witness] });
  expect(await f.dependencies("content", job.jobId)).toEqual([]);
  const lease = await f.call<{ jobId: string; leaseToken: string }>(content.claim, { jobId: job.jobId });
  expect(await f.dependencies("content", job.jobId)).toMatchObject([witness]);
  f.erase(witness);
  for (const [registration, args] of [[content.save, { ...lease, text: "LATE-PRIVATE-RESULT" }], [content.pin, { ...lease, snapshotCanonical: "LATE-PRIVATE-PIN" }], [content.input, lease], [content.publish, lease]] as const) {
    await expect(f.call(registration, args)).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  }
  expect(f.db.table("runtimeContentJobs")[0].primaryResult).toBeUndefined();
  expect(f.db.table("runtimeContentJobs")[0].primarySnapshot).toBeUndefined();
  expect(JSON.stringify(f.db.table("artifacts"))).not.toContain("LATE-PRIVATE");
});

it("content and media sourceErasedAt flags close legacy rows even with empty witness arrays", async () => {
  const f = await fixture();
  const job = await f.call<RuntimeContentJobV1>(content.submit, { version: 1, requestId: "redacted", intent: "text", prompt: "Original prompt" });
  await f.db.patch("runtimeContentJobs", f.db.table("runtimeContentJobs")[0]._id, { sourceErasedAt: clock });
  await expect(checkContentJob(f.ctx, f.db.table("runtimeContentJobs")[0] as never, f.reference)).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  await expect(f.call(content.claim, { jobId: job.jobId })).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  installMediaMockRoot(); const m = await fixture(true), mediaJob = await m.submitMedia();
  await m.db.patch("runtimeMediaJobs", m.db.table("runtimeMediaJobs")[0]._id, { sourceErasedAt: clock });
  await expect(checkMediaJob(m.ctx, m.db.table("runtimeMediaJobs")[0] as never)).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  await expect(m.call(media.checkpoint, { jobId: mediaJob.jobId })).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
});

it("artifact metadata and manual history reads reject the erased exact version, then allow a surviving unrelated version", async () => {
  const f = await fixture(), witness = await f.source(), artifactId = await f.document(witness);
  await f.call(artifacts.update, { artifactId, content: "Unrelated manually authored replacement" });
  expect(await f.dependencies("artifact", artifactId, 2)).toEqual([]);
  f.erase(witness);
  // Current metadata is independent; the raw history still contains erased v1.
  expect(await readArtifactContext(f.ctx, f.reference, artifactId)).toMatchObject({ artifactVersion: 2 });
  await expect(f.call(artifacts.get, { artifactId })).rejects.toThrow();
  const row = f.db.table("artifacts")[0];
  await f.db.patch("artifacts", row._id, { versionHistory: (row.versionHistory as { version: number }[]).map(value => value.version === 1
    ? { version: 1, content: "", title: "Erased source", timestamp: clock, changeType: "update" } : value) });
  // A caller-shaped redaction label alone never replaces trusted completion.
  await expect(f.call(artifacts.get, { artifactId })).rejects.toThrow();
  await f.db.patch("artifacts", row._id, { versionHistory: (row.versionHistory as { version: number }[]).filter(value => value.version !== 1) });
  expect(await f.call(artifacts.get, { artifactId })).toMatchObject({ version: 2, content: "Unrelated manually authored replacement" });
});

it("media checkpoints upgrade recorded witnesses and generated artifact/model versions retain ancestry", async () => {
  installMediaMockRoot(); const f = await fixture(true), witness = await f.source(), job = await f.submitMedia();
  await f.db.patch("runtimeMediaJobs", f.db.table("runtimeMediaJobs")[0]._id, { contextSourceWitnesses: [witness] });
  expect(await f.dependencies("media", job.jobId)).toEqual([]);
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  expect(await f.call(media.get, { jobId: job.jobId })).toMatchObject({ state: "ready", asset: { mimeType: "image/png" } });
  expect(await f.dependencies("media", job.jobId)).toMatchObject([witness]);
  expect(await f.dependencies("model", f.db.table("runtimeModelOperations")[0]._id)).toMatchObject([witness]);
  expect(await f.dependencies("artifact", job.artifactId, 2)).toMatchObject([witness]);
  f.erase(witness);
  await expect(readArtifactContext(f.ctx, f.reference, job.artifactId)).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  await expect(f.call(media.get, { jobId: job.jobId })).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  expect(f.counts().images).toBe(1);
});

it("trusted media enqueue inherits parent ancestry into its job and exact generated placeholder", async () => {
  const f = await fixture(true), witness = await f.source(), run = await f.run();
  const owned = f.db.table("runtimeRuns").find(row => row.runId === run.runId)!;
  // The native parent row is the controlled trusted port here. Real child
  // admission/binding and generated publication are covered in the test above.
  const parent = f.db.seed("runtimeModelOperations", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
    reference: f.reference, runAccountId: owned.runAccountId, operationKey: "agent.respond" });
  await f.transaction(() => registerSourceDependencies(f.ctx, f.reference, { kind: "model", id: parent._id }, [witness]));
  const args = { reference: f.reference, requestId: "trusted-media", kind: "image", prompt: "Source-derived image", conversationId: run.conversationId,
    runBudgetId: owned.runBudgetId, runAccountId: owned.runAccountId as Id<"runtimeBudgetAccounts">, parentOperationId: parent._id as Id<"runtimeModelOperations">, witnesses: [] };
  const job = await f.call<RuntimeMediaJobV1>(media.enqueueTrusted, args);
  expect(f.db.table("runtimeMediaJobs")[0].contextSourceWitnesses).toEqual([]);
  expect(await f.dependencies("media", job.jobId)).toMatchObject([witness]);
  expect(await f.dependencies("artifact", job.artifactId, 1)).toMatchObject([witness]);
  f.erase(witness);
  await expect(f.call(media.enqueueTrusted, { ...args, requestId: "late-trusted-media" })).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  expect(f.db.table("runtimeMediaJobs")).toHaveLength(1); expect(f.db.table("artifacts")).toHaveLength(1);
  expect(f.counts().images).toBe(0);
});

it("repeated source registration monotonically retains facts and memories permissions through artifact inheritance", async () => {
  const f = await fixture(), witness = await f.source(), artifactId = "permission-derived";
  await f.call(artifacts.create, { artifactId, title: "Declared permissions", content: "Both evidence kinds" });
  const target = { kind: "artifact" as const, id: artifactId, revision: 1 };
  await f.transaction(() => registerSourceDependencies(f.ctx, f.reference, target, [{ ...witness, permissions: ["canViewFacts"] }]));
  expect(await f.dependencies("artifact", artifactId, 1)).toEqual([{ ...witness, permissions: ["canViewFacts"] }]);
  await f.transaction(() => registerSourceDependencies(f.ctx, f.reference, target, [{ ...witness, permissions: ["canViewMemories"] }, { ...witness, permissions: ["canViewFacts"] }]));
  const combined = { ...witness, permissions: ["canViewFacts", "canViewMemories"] };
  expect(await f.dependencies("artifact", artifactId, 1)).toEqual([combined]);
  const job = await f.submit(artifactId, "permission-inheritance");
  expect(await f.dependencies("content", job.jobId)).toEqual([combined]);
  await f.transaction(() => registerSourceDependencies(f.ctx, f.reference, { kind: "content", id: job.jobId }, [{ ...witness, permissions: ["canViewFacts"] }]));
  expect(await f.dependencies("content", job.jobId)).toEqual([combined]);
});

it("completed source erasure removes content/model/title copies while preserving later authored versions and bounded workflow completion", async () => {
  const f = await fixture(true), witness = await f.source(), run = await f.run();
  const bridge = f.db.table("runtimeTranscriptMessages").find(row => row.nativeMessageId === run.inputMessageIds[0])!;
  await f.db.patch("runtimeTranscriptMessages", bridge._id, { contextSourceWitnesses: [witness] });
  installIngestionMockRoot(); jest.spyOn(Date, "now").mockReturnValue(clock + 60_001);
  await f.call(ledger.installDeploymentPolicy, currentMockRootSelection());
  const artifactId = await f.document(witness), job = await f.submit(artifactId, "purge-content");
  const lease = await f.generate(job.jobId, "PRIVATE-DERIVED-CONTENT");
  await f.call(artifacts.update, { artifactId, content: "Unaffected later manual version", title: "Manual title" });
  const title = await f.call<RuntimeContentJobV1>(content.submit, { version: 1, requestId: "purge-title", intent: "title", prompt: "PRIVATE-TITLE-PROMPT",
    conversationId: run.conversationId, sourceMessageId: run.inputMessageIds[0] });
  await f.generate(title.jobId, "Private Generated Title");
  const upload = await f.upload("Unaffected authored upload", "authored-upload");
  expect(f.db.table("runtimeContentJobs").some(row => String(row.resultCanonical).includes("PRIVATE-DERIVED-CONTENT"))).toBe(true);
  expect(workflowJournals.size).toBe(2);
  await f.purge(witness);
  for (const row of f.db.table("runtimeContentJobs")) {
    expect(row).toMatchObject({ sourceErasedAt: clock + 60_001, prompt: "", requestCanonical: canonicalModelJson({ version: 1, erased: true }), state: "failed" });
    for (const field of ["primaryResult", "generatedTitle", "rejectedTitleResult", "resultCanonical"]) expect(row[field]).toBeUndefined();
  }
  const artifact = f.db.table("artifacts").find(row => row.artifactId === artifactId)!;
  expect(artifact).toMatchObject({ versionPointer: 3, content: "Unaffected later manual version", title: "Manual title" });
  expect((artifact.versionHistory as { version: number; content?: string }[]).find(value => value.version === 2)?.content).toBe("");
  expect(await f.call(artifacts.get, { artifactId })).toMatchObject({ versionPointer: 3, content: "Unaffected later manual version", title: "Manual title" });
  const conversation = f.db.table("runtimeConversations").find(row => row.conversationId === run.conversationId)!;
  expect(JSON.parse(conversation.metadataCanonical as string).title).toBeUndefined(); expect(conversation.sourceTitleJobId).toBeUndefined();
  for (const attempt of f.db.table("runtimeModelAttempts")) {
    expect(attempt.canonical).toBe(canonicalModelJson({ version: 1, erased: true }));
    expect(attempt.inputProofCanonical).toBe(canonicalModelJson({ version: 1, erased: true }));
    expect(attempt.privateResultCanonical).toBeUndefined(); expect(attempt.sourceErasedAt).toBe(clock + 60_001);
  }
  expect(f.workflowCounts().cleanups).toBeGreaterThanOrEqual(4);
  expect(f.workflowCounts().barriers).toBeGreaterThanOrEqual(f.workflowCounts().cleanups * 2);
  expect([...workflowJournals.values()].every(journal => journal.length === 0)).toBe(true);
  const uploaded = f.db.table("runtimeAssetVersions").find(value => value.versionId === upload.asset.versionId)!;
  expect(uploaded.state).toBe("ready"); expect(f.blobs.has(uploaded.storageId as string)).toBe(true);
  expect(f.native.messages.has(run.inputMessageIds[0])).toBe(true);
  await expect(f.call(content.save, { ...lease, text: "LATE-RESURRECTED-CONTENT" })).rejects.toThrow();
  expect(JSON.stringify(f.db.table("runtimeContentJobs"))).not.toContain("LATE-RESURRECTED-CONTENT");
});

it("completed source erasure removes media/job/model/generated bytes and retains unrelated uploads", async () => {
  const f = await fixture(true), witness = await f.source(), job = await f.submitMedia();
  await f.db.patch("runtimeMediaJobs", f.db.table("runtimeMediaJobs")[0]._id, { contextSourceWitnesses: [witness] });
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, f.factory);
  const generated = f.db.table("runtimeAssetVersions")[0], upload = await f.upload("Unaffected media neighbor", "media-neighbor");
  expect(f.blobs.has(generated.storageId as string)).toBe(true);
  await f.purge(witness);
  const row = f.db.table("runtimeMediaJobs")[0];
  expect(row).toMatchObject({ sourceErasedAt: clock, prompt: "", requestCanonical: canonicalModelJson({ version: 1, erased: true }), state: "failed" });
  for (const field of ["envelopeCanonical", "proofCanonical", "resultCanonical", "webhookSecret"]) expect(row[field]).toBeUndefined();
  expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ canonical: canonicalModelJson({ version: 1, erased: true }), resultWithheld: true, sourceErasedAt: clock });
  expect(f.db.table("runtimeModelAttempts")[0].privateResultCanonical).toBeUndefined();
  expect(f.blobs.has(generated.storageId as string)).toBe(false);
  const uploaded = f.db.table("runtimeAssetVersions").find(value => value.versionId === upload.asset.versionId)!;
  expect(uploaded.state).toBe("ready"); expect(f.blobs.has(uploaded.storageId as string)).toBe(true);
  expect(f.db.table("runtimeAssetVersions").find(value => value.versionId === generated.versionId)?.state).toBe("deleted");
  const artifact = f.db.table("artifacts").find(value => value.artifactId === job.artifactId)!;
  expect(artifact).toMatchObject({ streamingState: "error", title: "Erased source" }); expect(artifact.fileRef).toBeUndefined();
  expect(JSON.stringify(artifact.versionHistory)).not.toContain(String(generated.storageId));
  await expect(f.call(media.checkpoint, { jobId: job.jobId })).rejects.toThrow();
  await expect(f.call(media.retainResult, { jobId: job.jobId, resultCanonical: "LATE-PRIVATE-RESULT" })).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  expect(f.db.table("runtimeMediaJobs")[0].resultCanonical).toBeUndefined();
});

it("an erased declared source prevents late media acknowledgement and private handle writes", async () => {
  installMediaMockRoot(); const f = await fixture(true), witness = await f.source(), job = await f.submitMedia("video");
  await f.db.patch("runtimeMediaJobs", f.db.table("runtimeMediaJobs")[0]._id, { contextSourceWitnesses: [witness] });
  await gateway.processSubmissionHandler(f.action, { jobId: job.jobId }, modelId => ({ ...f.factory(modelId), start: async () => {
    f.erase(witness); return { operation: "LATE-PRIVATE-OPERATION", inferenceId: "LATE-PRIVATE-INFERENCE", webhookSecret: "LATE-PRIVATE-SECRET" };
  } }));
  const stored = f.db.table("runtimeMediaJobs")[0];
  expect(stored.operation).toBeUndefined(); expect(stored.inferenceId).toBeUndefined(); expect(stored.webhookSecret).toBeUndefined();
  expect(f.db.table("runtimeAssetVersions")).toHaveLength(0);
  await expect(f.call(media.retainResult, { jobId: job.jobId, resultCanonical: canonicalModelJson({ version: 1, kind: "media", jobId: job.jobId, contentHash: "a".repeat(64), sizeBytes: png.length, mimeType: "image/png" }) })).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  expect(f.db.table("runtimeMediaJobs")[0].resultCanonical).toBeUndefined();
});
