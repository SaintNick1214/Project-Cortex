/** Actual Agent/transcript handlers over controlled native component/database ports. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { saveMessages } from "@convex-dev/agent";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import type { ActionCtx } from "../../../convex-dev/_generated/server";
import { canonicalModelJson } from "../../../src/domain/model-policy";
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(value: { handler: unknown }) { return { _handler: value.handler }; }
  async start() { return "workflow:source-dependencies"; }
  async cancel() {}
} }));
let boundaryFailure: Error | undefined, boundaryCalls = 0;
const nativeAgent = await import("@convex-dev/agent");
jest.unstable_mockModule("@convex-dev/agent", () => ({ ...nativeAgent, Agent: class {
  constructor(_component: unknown, readonly options: { contextHandler(): Promise<unknown> }) {}
  async streamText() { boundaryCalls++; await this.options.contextHandler(); throw boundaryFailure; }
  async generateText() { boundaryCalls++; await this.options.contextHandler(); throw boundaryFailure; }
} }));
const { installIngestionMockRoot } = await import("../runtimeIngestion/fixture");
const gateway = await import("../../../convex-dev/runtimeGateway");
jest.unstable_mockModule("../../../convex-dev/runtimeGateway", () => ({ ...gateway, createGovernedGatewayModel: async () => ({
  model: { specificationVersion: "v4", provider: "controlled", modelId: "controlled/model", doGenerate: async () => {}, doStream: async () => {} },
  lifecycle: { complete: async () => {}, signal: new AbortController().signal },
}) }));
const agent = await import("../../../convex-dev/runtimeAgent");
const transcript = await import("../../../convex-dev/runtimeTranscript");
const erasure = await import("../../../convex-dev/runtimeExternalErasure");
const dependencies = await import("../../../convex-dev/runtimeSourceDependencies");
const artifacts = await import("../../../convex-dev/runtimeArtifactContext");
const { guardAgentRunBudget } = await import("../../../convex-dev/runtimeAgentFence");
const { serverToolSourceLineage } = await import("../../../convex-dev/runtimeAgentTools");
const { memoryScope } = await import("../../../convex-dev/runtimeMemoryRepository");
const { prepareSourceContent } = await import("../../../src/domain/sources");

beforeEach(() => { installIngestionMockRoot(); boundaryFailure = undefined; boundaryCalls = 0; });
afterEach(() => { jest.restoreAllMocks(); });
const { dependencyFixture: fixture, generated } = await import("./agent-dependency-fixture");

it.each([false, true])("%s V8 selection saves exact dependency before context and refuses root-fenced writes", async v8 => {
  const f = await fixture({ v8 }), root = await f.external(), { attempt, owned, run } = await f.start();
  const entries = [{ key: "source:external", kind: "memory" as const, text: root.source.content, relevance: 1 }];
  const args = { ...attempt, context: root.source.content, witnesses: [root.witness], completeness: "complete" as const };
  await f.call(v8 ? agent.saveContextV8 : agent.saveContext, { ...args, ...(v8 ? { entries } : {}) });
  expect(await dependencies.sourceDependencyWitnesses(f.ctx, root.scope, { kind: "execution", id: owned._id })).toEqual([root.witness]);
  expect(JSON.stringify(f.db.table("runtimeSourceDependencies"))).not.toContain(root.source.content);
  expect(f.db.table("runtimeAgentExecutions")[0]!.contextCanonical).toBe(root.source.content);
  if (v8) expect(f.db.table("runtimeAgentExecutions")[0]!.modelInputEntries).toEqual(entries);
  await f.call(erasure.eraseSource, root.scope);
  // Even an empty in-row witness projection cannot bypass persisted ancestry.
  await f.ctx.db.patch("runtimeAgentExecutions", owned._id as never, { sourceWitnesses: [] });
  await expect(agent.executionContext(f.ctx, attempt)).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  await expect(f.call(agent.observe, { runId: run.runId })).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  await expect(f.call(agent.recordOutput, { ...attempt, parts: [{ type: "text-delta", text: "late private output", id: "late" }] })).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  const currentRun = (await f.ctx.db.query("runtimeRuns").withIndex("by_scoped_id", q => q.eq("tenantId", "tenant-a").eq("memorySpaceId", "space-a").eq("runId", run.runId)).unique())!;
  await expect(guardAgentRunBudget(f.ctx, f.reference, currentRun.runAccountId!)).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  expect(f.db.table("runtimeAgentOutput").some(row => String(row.partCanonical).includes("late private output"))).toBe(false);
});

it("dependency insertion and legacy saved private bytes roll back atomically on failure", async () => {
  const f = await fixture(), root = await f.external(), { attempt } = await f.start();
  const insert = f.db.insert.bind(f.db), fail = jest.spyOn(f.db, "insert").mockImplementation(async (table, value) => {
    if (table === "runtimeSourceDependencies") throw Error("injected dependency write failure"); return insert(table, value);
  });
  await expect(f.call(agent.saveContext, { ...attempt, context: root.source.content, witnesses: [root.witness], completeness: "complete" })).rejects.toThrow("injected dependency write failure");
  expect(f.db.table("runtimeAgentExecutions")[0]!.contextCanonical).toBeUndefined();
  expect(f.db.table("runtimeSourceDependencies")).toEqual([]); fail.mockRestore();
});

it("actual tool witness growth registers source and inherited artifact roots without duplicates", async () => {
  const f = await fixture({ tools: true }), root = await f.external(), later = await f.external("later-root"), { attempt, owned } = await f.start();
  await f.call(agent.saveContext, { ...attempt, context: "", witnesses: [], completeness: "complete" });
  const op = await f.call<{ operationId: string }>(agent.beginOperation, { ...attempt, kind: "tool", ordinal: 0, toolCallId: "dependency-tool", toolName: "memory_recall", requestCanonical: canonicalModelJson({ text: "search", limit: 1 }) });
  await f.call(agent.startOperation, { ...attempt, operationId: op.operationId });
  f.db.seed("artifacts", { tenantId: "tenant-a", memorySpaceId: "space-a", artifactId: "derived-metadata", ownerPrincipalId: f.reference.principalId, versionPointer: 1, kind: "document", title: "Derived title", streamingState: "complete", isDeleted: false });
  const artifactWitness = await artifacts.artifactMetadataWitness(await artifacts.readArtifactContext(f.ctx, f.reference, "derived-metadata"));
  await dependencies.registerSourceDependencies(f.ctx, root.scope, { kind: "artifact", id: artifactWitness.artifactId, revision: 1 }, [root.witness]);
  for (let n = 0; n < 2; n++) await f.call(agent.rememberToolSources, { ...attempt, operationId: op.operationId, witnesses: [later.witness], artifactWitnesses: [artifactWitness] });
  expect(new Set((await dependencies.sourceDependencyWitnesses(f.ctx, root.scope, { kind: "execution", id: owned._id })).map(w => w.sourceId))).toEqual(new Set([root.witness.sourceId, later.witness.sourceId]));
  expect(f.db.table("runtimeSourceDependencies").filter(row => row.targetKind === "execution")).toHaveLength(2);
  await f.call(erasure.eraseSource, root.scope);
  await expect(f.call(agent.rememberToolSources, { ...attempt, operationId: op.operationId, witnesses: [] })).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
});

it("assistant bridges and normalized sources inherit roots while authored user messages do not", async () => {
  const f = await fixture(), root = await f.external(), history = await generated(f, root.witness);
  expect(history.user.contextSourceWitnesses).toBeUndefined();
  expect(await dependencies.sourceDependencyWitnesses(f.ctx, root.scope, { kind: "transcript", id: history.user._id, revision: 1 })).toEqual([]);
  for (const target of [{ kind: "transcript" as const, id: history.assistant._id }, { kind: "source" as const, id: history.assistant.sourceId }]) {
    expect(await dependencies.sourceDependencyWitnesses(f.ctx, root.scope, { ...target, revision: 1 })).toEqual([root.witness]);
  }
  const { attempt, owned } = await f.start();
  const derived = (await f.ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", "tenant-a").eq("memorySpaceId", "space-a").eq("lineage.sourceId", history.assistant.sourceId)).unique())!;
  await f.call(agent.saveContext, { ...attempt, context: derived.content, witnesses: [{ sourceId: derived.lineage.sourceId, sourceEventId: derived.lineage.sourceEventId,
    sourceRevision: derived.lineage.sourceRevision, contentHash: derived.contentHash }], completeness: "complete" });
  expect((await dependencies.sourceDependencyWitnesses(f.ctx, root.scope, { kind: "execution", id: owned._id })).map(w => w.sourceId)).toContain(root.witness.sourceId);
  await f.call(erasure.eraseSource, root.scope);
  const userNative = f.native.messages.get(history.user.nativeMessageId)!;
  expect(await transcript.verifyMessage(f.ctx, history.conversation, history.user, userNative as never)).toMatchObject({ _id: history.user.nativeMessageId });
  await expect(transcript.verifyMessage(f.ctx, history.conversation, history.assistant, f.native.messages.get(history.assistant.nativeMessageId) as never)).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
  await expect(agent.executionContext(f.ctx, attempt)).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
});

it.each([false, true])("%s V8 history roots register at start before recall context can be cached", async v8 => {
  const f = await fixture({ v8 }), root = await f.external(), history = await generated(f, root.witness);
  const { attempt, owned, run } = await f.start(history.conversation.conversationId);
  expect((await dependencies.sourceDependencyWitnesses(f.ctx, root.scope, { kind: "execution", id: owned._id })).map(w => w.sourceId)).toContain(root.witness.sourceId);
  await f.call(v8 ? agent.saveContextV8 : agent.saveContext, { ...attempt, context: "", witnesses: [], completeness: "complete", ...(v8 ? { entries: [] } : {}) });
  const operation = await f.call<{ operationId: string }>(agent.beginOperation, { ...attempt, kind: "model", ordinal: 0, requestCanonical: "{}" });
  await f.call(agent.startOperation, { ...attempt, operationId: operation.operationId });
  const saved = await f.call<{ savedMessageIds: string[] }>(agent.finishGeneratedOperation, { ...attempt, operationId: operation.operationId,
    messagesCanonical: canonicalModelJson([{ role: "assistant", content: "Next generated answer inherits history roots" }]) });
  await f.call(agent.finalize, { ...attempt, finalMessageIds: saved.savedMessageIds });
  const next = (await f.ctx.db.query("runtimeTranscriptMessages").withIndex("by_native", q => q.eq("tenantId", "tenant-a").eq("memorySpaceId", "space-a").eq("nativeMessageId", saved.savedMessageIds[0]!)).unique())!;
  expect((await dependencies.sourceDependencyWitnesses(f.ctx, root.scope, { kind: "source", id: next.sourceId, revision: next.revision })).map(w => w.sourceId)).toContain(root.witness.sourceId);
  await f.call(erasure.eraseSource, root.scope);
  await expect(f.call(agent.observe, { runId: run.runId })).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
});

it("trusted native tool bridges register declared roots even without a normalized tool text projection", async () => {
  const f = await fixture(), root = await f.external(), history = await generated(f, root.witness);
  const saved = await saveMessages(f.ctx, transcript.agentComponent, { threadId: history.conversation.threadId,
    messages: [{ role: "tool", content: [{ type: "tool-result", toolCallId: "declared-tool", toolName: "memory_recall", output: { type: "json", value: { context: root.source.content } } }] }] });
  await transcript.registerMessages(f.ctx, history.conversation, f.reference, saved.messages, { trustedToolMessages: true, contextSourceWitnesses: [root.witness] });
  const bridge = (await f.ctx.db.query("runtimeTranscriptMessages").withIndex("by_native", q => q.eq("tenantId", "tenant-a").eq("memorySpaceId", "space-a").eq("nativeMessageId", saved.messages[0]!._id)).unique())!;
  expect(bridge.role).toBe("tool");
  expect(await dependencies.sourceDependencyWitnesses(f.ctx, root.scope, { kind: "transcript", id: bridge._id, revision: bridge.revision })).toEqual([root.witness]);
  await f.call(erasure.eraseSource, root.scope);
  await expect(transcript.verifyMessage(f.ctx, history.conversation, bridge, saved.messages[0]!)).rejects.toMatchObject({ data: { code: "STALE_CONTEXT" } });
});

it("a context-cleared authored rewrite owns a higher revision and survives old revision ancestry fencing", async () => {
  const f = await fixture(), root = await f.external(), history = await generated(f, root.witness);
  await f.ctx.db.patch("runtimeConversations", history.conversation._id, { manualWriteLocked: false });
  await f.call(transcript.edit, { conversationId: history.conversation.conversationId, expectedRevision: 1, messageId: history.assistant.nativeMessageId, expectedMessageRevision: 1,
    parts: [{ type: "text", text: "Replacement authored independently" }] });
  const rewritten = (await f.ctx.db.get("runtimeTranscriptMessages", history.assistant._id))!;
  expect(rewritten).toMatchObject({ revision: 2 }); expect(rewritten.contextSourceWitnesses).toBeUndefined();
  expect(await dependencies.sourceDependencyWitnesses(f.ctx, root.scope, { kind: "transcript", id: rewritten._id, revision: 2 })).toEqual([]);
  await f.call(erasure.eraseSource, root.scope);
  expect(await transcript.verifyMessage(f.ctx, history.conversation, rewritten, f.native.messages.get(rewritten.nativeMessageId) as never)).toMatchObject({ _id: rewritten.nativeMessageId });
  expect(f.native.messages.get(rewritten.nativeMessageId)!.message).toMatchObject({ content: [{ text: "Replacement authored independently" }] });
});

function financialState(f: Awaited<ReturnType<typeof fixture>>) {
  return canonicalModelJson(["runtimeModelAttempts", "runtimeModelOperations", "runtimeBudgetAccounts"].map(table => f.db.table(table)));
}
const rememberRequest = { kind: "tool", ordinal: 0, toolCallId: "trust-boundary-remember", toolName: "memory_remember", requestCanonical: canonicalModelJson({ text: "Do not promote this generated claim" }) };
const unavailable = { data: { code: "CAPABILITY_UNAVAILABLE", outcome: "not_dispatched", retryable: false } };

it.each([false, true])("%s V8 external context refuses memory.remember before operation creation or tool charges", async v8 => {
  const f = await fixture({ v8, remember: true }), root = await f.external(), { attempt } = await f.start();
  await f.call(v8 ? agent.saveContextV8 : agent.saveContext, { ...attempt, context: root.source.content, witnesses: [root.witness], completeness: "complete",
    ...(v8 ? { entries: [{ key: "external", kind: "memory", text: root.source.content, relevance: 1 }] } : {}) });
  const before = financialState(f), sourceCount = f.db.table("runtimeMemorySources").length;
  await expect(f.call(agent.beginOperation, { ...attempt, ...rememberRequest })).rejects.toMatchObject(unavailable);
  expect(f.db.table("runtimeAgentOperations")).toEqual([]);
  expect(f.db.table("runtimeAgentExecutions")[0]!.toolCount).toBe(0);
  expect(f.db.table("runtimeMemorySources")).toHaveLength(sourceCount);
  expect(f.db.table("facts")).toEqual([]); expect(financialState(f)).toBe(before);
});

it.each(["history", "artifact"] as const)("%s-only external ancestry refuses memory.remember with empty recall witnesses", async kind => {
  const f = await fixture({ v8: true, remember: true }), root = await f.external();
  const history = kind === "history" ? await generated(f, root.witness) : undefined;
  const { attempt } = await f.start(history?.conversation.conversationId);
  await f.call(agent.saveContextV8, { ...attempt, context: "", entries: [], witnesses: [], completeness: "complete" });
  if (kind === "artifact") {
    const recall = await f.call<{ operationId: string }>(agent.beginOperation, { ...attempt, kind: "tool", ordinal: 0, toolCallId: "artifact-context", toolName: "memory_recall", requestCanonical: canonicalModelJson({ text: "search", limit: 1 }) });
    await f.call(agent.startOperation, { ...attempt, operationId: recall.operationId });
    f.db.seed("artifacts", { tenantId: "tenant-a", memorySpaceId: "space-a", artifactId: "external-trust-metadata", ownerPrincipalId: f.reference.principalId, versionPointer: 1, kind: "document", title: "Derived title", streamingState: "complete", isDeleted: false });
    const witness = await artifacts.artifactMetadataWitness(await artifacts.readArtifactContext(f.ctx, f.reference, "external-trust-metadata"));
    await dependencies.registerSourceDependencies(f.ctx, root.scope, { kind: "artifact", id: witness.artifactId, revision: 1 }, [root.witness]);
    await f.call(agent.rememberToolSources, { ...attempt, operationId: recall.operationId, witnesses: [], artifactWitnesses: [witness] });
  }
  const current = await agent.executionContext(f.ctx, attempt);
  expect(current.execution.sourceWitnesses).toEqual([]); expect(current.execution.hasExternalDependencies).toBe(true);
  expect(current.dependencyWitnesses?.map(w => w.sourceId)).toContain(root.witness.sourceId);
  const before = financialState(f), count = f.db.table("runtimeAgentOperations").length, sourceCount = f.db.table("runtimeMemorySources").length;
  await expect(f.call(agent.beginOperation, { ...attempt, ...rememberRequest })).rejects.toMatchObject(unavailable);
  expect(f.db.table("runtimeAgentOperations")).toHaveLength(count);
  expect(f.db.table("runtimeMemorySources")).toHaveLength(sourceCount);
  expect(f.db.table("facts")).toEqual([]); expect(financialState(f)).toBe(before);
});

it("a new external dependency fences prepared/started memory.remember at start, active checks and both write gates", async () => {
  const f = await fixture({ remember: true }), root = await f.external(), { attempt } = await f.start();
  await f.call(agent.saveContext, { ...attempt, context: "", witnesses: [], completeness: "complete" });
  const prepared = await f.call<{ operationId: string }>(agent.beginOperation, { ...attempt, ...rememberRequest });
  const started = await f.call<{ operationId: string }>(agent.beginOperation, { ...attempt, ...rememberRequest, toolCallId: "remember-started" });
  await f.call(agent.startOperation, { ...attempt, operationId: started.operationId });
  const recall = await f.call<{ operationId: string }>(agent.beginOperation, { ...attempt, kind: "tool", ordinal: 0, toolCallId: "recall-external", toolName: "memory_recall", requestCanonical: canonicalModelJson({ text: "search", limit: 1 }) });
  await f.call(agent.startOperation, { ...attempt, operationId: recall.operationId });
  await f.call(agent.rememberToolSources, { ...attempt, operationId: recall.operationId, witnesses: [root.witness] });
  const before = financialState(f), count = f.db.table("runtimeMemorySources").length;
  const lineage = serverToolSourceLineage(memoryScope(f.reference), started.operationId);
  const { source } = await prepareSourceContent(memoryScope(f.reference), lineage, "Do not promote this generated claim", { now: () => Date.now() });
  await expect(f.call(agent.startOperation, { ...attempt, operationId: prepared.operationId })).rejects.toMatchObject(unavailable);
  await expect(f.call(agent.checkActiveTool, { ...attempt, operationId: started.operationId })).rejects.toMatchObject(unavailable);
  await expect(f.call(agent.writeToolSource, { ...attempt, operationId: started.operationId, source })).rejects.toMatchObject(unavailable);
  const sourceReference = { sourceId: lineage.sourceId, sourceEventId: lineage.sourceEventId, sourceRevision: lineage.sourceRevision };
  await expect(f.call(agent.writeToolDerived, { ...attempt, operationId: started.operationId, input: { source: sourceReference, identity: { ...sourceReference, stage: "facts", semanticPolicyVersion: "policy-v1" }, facts: [] } })).rejects.toMatchObject(unavailable);
  expect(f.db.table("runtimeMemorySources")).toHaveLength(count); expect(f.db.table("facts")).toEqual([]);
  expect(financialState(f)).toBe(before);
});

it.each(["user", "tool"] as const)("ordinary %s-only context still starts memory.remember and writes its normalized source", async role => {
  const f = await fixture({ remember: true }), original = await f.source("Ordinary authored information", "ordinary-trust-context");
  const row = (await f.ctx.db.query("runtimeMemorySources").withIndex("by_scope_source", q => q.eq("tenantId", "tenant-a").eq("memorySpaceId", "space-a").eq("lineage.sourceId", original.lineage.sourceId)).unique())!;
  if (role === "tool") await f.ctx.db.patch("runtimeMemorySources", row._id, { lineage: { sourceId: original.lineage.sourceId, sourceEventId: original.lineage.sourceEventId, sourceRevision: 1, role: "tool", trust: "verified_tool_evidence", operationId: "ordinary-completed-tool" } });
  const { attempt } = await f.start();
  await f.call(agent.saveContext, { ...attempt, context: original.content, witnesses: [{ sourceId: original.lineage.sourceId, sourceEventId: original.lineage.sourceEventId, sourceRevision: 1, contentHash: original.contentHash }], completeness: "complete" });
  const op = await f.call<{ operationId: string }>(agent.beginOperation, { ...attempt, ...rememberRequest });
  await f.call(agent.startOperation, { ...attempt, operationId: op.operationId });
  const lineage = serverToolSourceLineage(memoryScope(f.reference), op.operationId);
  const { source } = await prepareSourceContent(memoryScope(f.reference), lineage, "Do not promote this generated claim", { now: () => Date.now() });
  const before = financialState(f);
  expect(await f.call(agent.writeToolSource, { ...attempt, operationId: op.operationId, source })).toMatchObject({ created: true, source: { lineage: { role: "tool", trust: "verified_tool_evidence" } } });
  expect(f.db.table("runtimeAgentOperations")[0]!.state).toBe("started"); expect(financialState(f)).toBe(before);
});

async function captureFailure(work: () => Promise<unknown>): Promise<Error> {
  try { await work(); } catch (error) { if (error instanceof Error) return error; throw error; }
  throw new Error("Expected action boundary failure");
}

it.each([false, true])("source-dependent=%s provider errors escape the actual model Workflow action with the required privacy", async external => {
  const f = await fixture(), root = external ? await f.external() : undefined, { attempt } = await f.start();
  await f.call(agent.saveContext, { ...attempt, context: root?.source.content ?? "Ordinary context", witnesses: root ? [root.witness] : [], completeness: "complete" });
  const marker = "ERASE-AGENT-PRIVATE-provider-error", raw = new Error(marker, { cause: new Error(`${marker}:cause`) }); boundaryFailure = raw;
  const escaped = await captureFailure(() => f.call(agent.modelStep, { ...attempt, ordinal: 0 }));
  expect(boundaryCalls).toBe(1);
  if (external) {
    expect(escaped).toBeInstanceOf(Error); expect(escaped.message).toBe("AGENT_EXECUTION_FAILED");
    expect(escaped.cause).toBeUndefined(); expect(String(escaped.stack) + JSON.stringify(escaped)).not.toContain(marker);
  } else expect(escaped).toBe(raw);
});

it.each([false, true])("source-dependent=%s tool errors escape the actual tool Workflow action with the required privacy", async external => {
  const f = await fixture({ tools: true }), root = external ? await f.external() : undefined, { attempt } = await f.start();
  await f.call(agent.saveContext, { ...attempt, context: root?.source.content ?? "Ordinary context", witnesses: root ? [root.witness] : [], completeness: "complete" });
  const marker = "ERASE-AGENT-PRIVATE-tool-error", raw = new Error(marker, { cause: new Error(`${marker}:cause`) });
  const query = f.ctx.runQuery.bind(f.ctx);
  f.ctx.runQuery = (async (ref, args) => { let name = ""; try { name = getFunctionName(ref); } catch { return query(ref, args); }
    if (name === "runtimeAgent:toolParent") return "runtimeModelOperations:controlled-parent";
    if (name === "runtimeAgent:checkToolAuthority") { await query(ref, args); boundaryCalls++; throw raw; }
    return query(ref, args); }) as typeof f.ctx.runQuery;
  const escaped = await captureFailure(() => f.call(agent.toolStep, { ...attempt, ordinal: 0, call: { toolCallId: "sentinel-tool", toolName: "memory_recall", inputCanonical: canonicalModelJson({ text: "search", limit: 1 }) } }));
  if (!external) expect(escaped).toBe(raw);
  expect(boundaryCalls).toBe(1);
  if (external) {
    expect(escaped.message).toBe("AGENT_EXECUTION_FAILED"); expect(escaped.cause).toBeUndefined();
    expect(String(escaped.stack) + JSON.stringify(escaped)).not.toContain(marker);
  } else expect(escaped).toBe(raw);
});

it.each(["not_dispatched", "confirmed_rejected", "confirmed", "uncertain"] as const)("external pending context preserves safe %s classification while discarding raw error details", async outcome => {
  const f = await fixture(), root = await f.external(), { attempt } = await f.start();
  await f.call(agent.startContext, attempt);
  const query = f.ctx.runQuery.bind(f.ctx);
  f.ctx.runQuery = (async (ref, args) => {
    const result = await query(ref, args);
    let name = ""; try { name = getFunctionName(ref); } catch { return result; }
    if (name === "runtimeAgent:contextInputs") return { ...result, availability: { ...(result as { availability: object }).availability, empty: false } };
    return result;
  }) as typeof f.ctx.runQuery;
  const marker = "ERASE-AGENT-PRIVATE-context-error";
  const raw = new ConvexError({ version: 1, code: "CAPABILITY_UNAVAILABLE", message: marker, providerBody: marker, retryable: false, outcome });
  const escaped = await captureFailure(() => agent.prepareContextHandler(f.ctx as unknown as ActionCtx, attempt, async () => { throw raw; }));
  if (!(escaped instanceof ConvexError)) throw escaped;
  expect(escaped).not.toBe(raw); expect(escaped.data).toEqual({ version: 1, code: "CAPABILITY_UNAVAILABLE", message: "Agent execution failed.", retryable: false, outcome });
  expect(String(escaped.stack) + JSON.stringify(escaped)).not.toContain(marker);
  expect(f.db.table("runtimeAgentExecutions")[0]!.hasExternalDependencies).toBeUndefined();
  expect(root.witness.sourceId).toBeDefined();
});
