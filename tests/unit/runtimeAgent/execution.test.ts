/** Controlled product handlers. Actual Agent/Workflow/OCC/provider behavior has its separate disposable lane. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { MessageDoc } from "@convex-dev/agent";
import { assertNativeArgs } from "./native-arguments";
const starts: unknown[] = [], cancellations: string[] = [], events: unknown[] = [];
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start(...args: unknown[]) { starts.push(args); return `workflow:${starts.length}`; }
  async cancel(_ctx: unknown, id: string) { cancellations.push(id); }
  async sendEvent(_ctx: unknown, args: unknown) { events.push(args); }
} }));
const { installMockRoot, installIngestionMockRoot, transcriptFixture, transcript, runs, invoke } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const definitions = await import("../../../convex-dev/agentDefinitions");
const memory = await import("../../../convex-dev/runtimeMemory");
const auth = await import("../../../convex-dev/runtimeAuth");
const tools = await import("../../../convex-dev/runtimeAgentTools");
const { guardAgentRunBudget } = await import("../../../convex-dev/runtimeAgentFence");
const { prepareSourceContent } = await import("../../../src/domain/sources");
const { explicitSourceLineage } = await import("../../../convex-dev/runtimeMemoryServices");
const { memoryScope } = await import("../../../convex-dev/runtimeMemoryRepository");
type F = Awaited<ReturnType<typeof transcriptFixture>>;
beforeEach(() => { installMockRoot(); starts.length = cancellations.length = events.length = 0; });
afterEach(() => { jest.restoreAllMocks(); });
async function fixture(options: { maxContextTokens?: number } = {}) {
  const f = await transcriptFixture(options); const mutation = f.ctx.runMutation.bind(f.ctx), query = f.ctx.runQuery.bind(f.ctx);
  const route = (name: string) => name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : name === "runs:claimNext" ? runs.claimNext
    : name === "runs:cancel" ? runs.cancel : name === "runs:recoverQueue" ? runs.recoverQueue : name === "runs:recoverOwnedQueue" ? runs.recoverOwnedQueue : name === "runtimeMemory:readSource" ? memory.readSource : undefined;
  f.ctx.runMutation = (async (ref: unknown, args: unknown) => {
    if ((ref as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")]?.endsWith("/abortByOrder")) return true;
    let name = ""; try { name = getFunctionName(ref as never); } catch { /* Native component handled by original fixture. */ }
    const registration = route(name); if (registration) assertNativeArgs(registration, args);
    return registration ? await invoke(registration, f.ctx, args) : await mutation(ref as never, args as never);
  }) as typeof f.ctx.runMutation;
  f.ctx.runQuery = (async (ref: unknown, args: unknown) => {
    let name = ""; try { name = getFunctionName(ref as never); } catch { /* Native component handled by original fixture. */ }
    const registration = route(name); if (registration) assertNativeArgs(registration, args);
    return registration ? await invoke(registration, f.ctx, args) : await query(ref as never, args as never);
  }) as typeof f.ctx.runQuery;
  return f;
}
async function started(f: F) {
  const run = await f.run(); await f.call(runtime.start, { runId: run.runId });
  const row = f.db.table("runtimeRuns")[0], owned = f.db.table("runtimeAgentExecutions")[0];
  const args = { reference: f.reference, runId: run.runId, attemptNumber: row.attemptNumber as number, leaseVersion: owned.leaseVersion as number };
  await f.call(runtime.saveContext, { ...args, context: "private memory context SENTINEL", witnesses: [], completeness: "complete" });
  return { run, args, owned };
}
async function savedFinal(f: F, args: Awaited<ReturnType<typeof started>>["args"], text = "public final") {
  const input = f.native.messages.get((f.db.table("runtimeRuns")[0].inputMessageIds as string[])[0])!;
  const id = "native:final";
  const native = { ...input, _id: id, order: input.order as number, stepOrder: 1, agentName: `cortex:${args.runId}:${args.attemptNumber}:0`, message: { role: "assistant", content: text } };
  f.native.messages.set(id, native);
  const op = await f.call<{ operationId: string }>(runtime.beginOperation, { ...args, kind: "model", ordinal: 0, requestCanonical: "{}" });
  await f.call(runtime.startOperation, { ...args, operationId: op.operationId });
  await f.call(runtime.finishOperation, { ...args, operationId: op.operationId, resultCanonical: "{}", nativeMessageIds: [id] });
  return { id, op, native };
}
async function approvalWait(shortLease = false) {
  installMockRoot({ tools: true }); const f = await fixture(); f.grant.capabilities = [...f.grant.capabilities as string[], "tool"];
  const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "expiring-tool", expectedPreviousVersion: 0,
    definitionInput: { ...f.definitionInput, tools: [{ toolId: "memory.remember", toolVersion: 1, registryHash: await definitions.executableRegistryHash(), requiredCapability: "tool", approval: "explicit" }],
      policies: [{ policyId: "expiring-tool", version: 1, rules: { limits: { toolSteps: 4 } } }] } });
  const request = (id: string, conversationId?: string) => ({ ...f.request(id, conversationId), agentId: published.agentId, agentVersion: published.version });
  const run = await f.call<{ runId: string; conversationId: string }>(runs.submit, { request: request("waiting") });
  await f.call(runtime.start, { runId: run.runId }); const owned = f.db.table("runtimeAgentExecutions")[0];
  const args = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
  await f.call(runtime.saveContext, { ...args, context: "", witnesses: [], completeness: "complete" });
  const requestCanonical = f.canonical({ text: "Approved tool evidence" });
  const op = await f.call<{ operationId: string }>(runtime.beginOperation, { ...args, kind: "tool", ordinal: 0, toolCallId: "expiring-call", toolName: "memory_remember", requestCanonical });
  const outbox = f.db.table("runtimeRunOutbox")[0]; if (shortLease) outbox.leaseExpiresAt = Date.now() + 5;
  await f.call(runtime.waitForApproval, { ...args, operationId: op.operationId });
  return { f, run, owned, args, op, request, outbox, expiry: outbox.leaseExpiresAt as number, expectedRequestHash: await f.hash(requestCanonical) };
}
describe("durable Agent execution product boundaries", () => {
  it("start claims/enqueues one Workflow atomically; duplicate start keeps same attempt and changed delivery contract denies", async () => {
    const f = await fixture(); const run = await f.run();
    expect(await f.call(runtime.start, { runId: run.runId })).toMatchObject({ state: "ready", attemptNumber: 1 });
    await f.call(runtime.start, { runId: run.runId }); expect(starts).toHaveLength(1);
    expect(f.effects.saves).toBe(1); expect(f.db.table("runtimeAgentExecutions")).toHaveLength(1);
    await expect(f.call(runtime.start, { runId: run.runId, streaming: false })).rejects.toThrow(); expect(starts).toHaveLength(1);
  });
  it("start preserves the claim's oversized-prefix terminal disposition instead of rolling it back", async () => {
    const f = await fixture();
    const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "bounded-prefix", expectedPreviousVersion: 0,
      definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, maxContextTokens: 20 } } });
    const run = await f.call<{ runId: string }>(runs.submit, { request: { ...f.request("oversized"), agentId: published.agentId, agentVersion: published.version, parts: [{ type: "text", text: "x".repeat(1000) }] } });
    expect(await f.call(runtime.start, { runId: run.runId })).toMatchObject({ state: "failed", failureCode: "CONTEXT_LIMIT_EXCEEDED" });
    expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("failed"); expect(f.db.table("runtimeRunOutbox")[0].state).toBe("complete");
    expect(starts).toEqual([]); expect(f.db.table("runtimeAgentExecutions")).toEqual([]); expect(f.db.table("runtimeModelOperations")).toEqual([]);
  });
  it("observe keeps an unstarted queued run nonterminal without manufacturing output or an execution", async () => {
    const f = await fixture(); const run = await f.run(); const writes = f.db.writes;
    expect(await f.call(runtime.observe, { runId: run.runId, afterSequence: 7 })).toMatchObject({
      state: "not_started", run: { responseStatus: "queued", attemptNumber: 0 }, parts: [], cursor: 7, approvals: [],
    });
    expect(f.db.writes).toBe(writes); expect(starts).toEqual([]); expect(f.db.table("runtimeAgentExecutions")).toEqual([]);
  });
  it.each(["failed", "cancelled"])("observe delivers the real %s disposition when no Agent execution exists", async status => {
    const f = await fixture();
    let run: { runId: string };
    if (status === "failed") {
      const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "observed-overflow", expectedPreviousVersion: 0,
        definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, maxContextTokens: 20 } } });
      run = await f.call(runs.submit, { request: { ...f.request("observed-overflow"), agentId: published.agentId, agentVersion: published.version, parts: [{ type: "text", text: "x".repeat(1000) }] } });
      await f.call(runtime.start, { runId: run.runId });
    } else {
      run = await f.run(); await f.call(runtime.cancel, { runId: run.runId });
    }
    const writes = f.db.writes;
    expect(await f.call(runtime.observe, { runId: run.runId, finalOnly: true })).toMatchObject({
      state: status, run: { responseStatus: status, attemptNumber: 0, ...(status === "failed" ? { failureCode: "CONTEXT_LIMIT_EXCEEDED" } : {}) },
      parts: [], cursor: 0, approvals: [],
    });
    expect(f.db.writes).toBe(writes); expect(starts).toEqual([]); expect(f.db.table("runtimeAgentExecutions")).toEqual([]);
    expect(f.db.table("runtimeAgentOperations")).toEqual([]); expect(f.db.table("runtimeModelOperations")).toEqual([]);
  });
  it("native schemas reject the former model/tool extra fields without changing their validators", async () => {
    const f = await fixture(); const { args } = await started(f);
    expect(() => assertNativeArgs(runtime.hydrateExecution, args)).not.toThrow();
    expect(() => assertNativeArgs(runtime.hydrateExecution, { ...args, ordinal: 0 })).toThrow("Unknown native field: ordinal");
    expect(() => assertNativeArgs(runtime.beginOperation, { ...args, kind: "tool", ordinal: 0, requestCanonical: "{}", call: {} })).toThrow("Unknown native field: call");
    expect(() => assertNativeArgs(runtime.finishOperation, { ...args, operationId: "owned", nativeMessageIds: ["id"], resultCanonical: "{}", ordinal: 0 })).toThrow("Unknown native field: ordinal");
  });
  it.each(["no-jwt", "revoked", "foreign", "definition-revoked", "conversation-tombstone"])("start rejects %s before Workflow or model effects", async kind => {
    const f = await fixture(); const run = await f.run();
    if (kind === "no-jwt") f.identity(null);
    if (kind === "revoked") f.grant.revokedAt = Date.now();
    if (kind === "foreign") f.grant.memorySpaceId = "other";
    if (kind === "definition-revoked") f.db.table("runtimeAgentDefinitions")[0].revokedAt = Date.now();
    if (kind === "conversation-tombstone") f.db.table("runtimeConversations")[0].tombstonedAt = Date.now();
    await expect(f.call(runtime.start, { runId: run.runId })).rejects.toThrow(); expect(starts).toEqual([]); expect(f.db.table("runtimeAgentOperations")).toEqual([]);
  });
  it("future queued request remains durable and only dispatches after the current head retires", async () => {
    const f = await fixture(); const first = await started(f); const next = await f.run("second", first.run.conversationId);
    expect(await f.call(runtime.start, { runId: next.runId })).toMatchObject({ state: "queued" }); expect(starts).toHaveLength(1);
    await f.call(runtime.cancel, { runId: first.run.runId });
    await f.call(runs.recoverQueue, { reference: f.reference, conversationId: first.run.conversationId });
    expect(f.scheduled.some(row => row.name === "runtimeAgent:dispatchReady")).toBe(true);
    await f.call(runtime.dispatchReady, { reference: f.reference, runId: next.runId }); expect(starts).toHaveLength(2);
  });
  it("private selected canonical history retains typed calls/results, while public history omits private tool payloads", async () => {
    const f = await fixture(); const run = await f.run(); const conversation = f.db.table("runtimeConversations")[0];
    const input = f.native.messages.get(run.inputMessageIds[0])!;
    const toolMessages = [
      { ...input, _id: "call", stepOrder: 1, message: { role: "assistant", content: [{ type: "tool-call", toolCallId: "tc", toolName: "memory_recall", input: { text: "TOOL_INPUT_SENTINEL", limit: 1 } }] } },
      { ...input, _id: "result", stepOrder: 2, message: { role: "tool", content: [{ type: "tool-result", toolCallId: "tc", toolName: "memory_recall", output: { type: "json", value: { context: "TOOL_RESULT_SENTINEL" } } }] } },
    ];
    for (const message of toolMessages) f.native.messages.set(message._id, message);
    await transcript.registerMessages(f.ctx, conversation as never, f.reference, toolMessages as unknown as MessageDoc[], { trustedToolMessages: true });
    f.db.table("runtimeRuns")[0].responseStatus = "complete";
    const next = await f.run("next", run.conversationId);
    const claim = await f.call<{ attemptNumber: number; leaseVersion: number }>(runs.claimNext, { reference: f.reference, conversationId: next.conversationId });
    const row = f.db.table("runtimeRuns").find(row => row.runId === next.runId)!; const current = f.db.table("runtimeConversations")[0];
    const snapshot = JSON.parse(row.snapshotCanonical as string);
    const privateMessages = await transcript.hydratePrivateCutoff(f.ctx, current as never, row as never, snapshot);
    expect(JSON.stringify(privateMessages)).toContain("TOOL_INPUT_SENTINEL"); expect(JSON.stringify(privateMessages)).toContain("TOOL_RESULT_SENTINEL");
    const publicMessages = await f.call(transcript.messages, { conversationId: next.conversationId });
    expect(JSON.stringify(publicMessages)).not.toMatch(/TOOL_INPUT_SENTINEL|TOOL_RESULT_SENTINEL/);
    f.native.messages.get("call")!.message = { role: "assistant", content: [{ type: "tool-call", toolCallId: "tc", toolName: "memory_recall", input: { text: "CHANGED", limit: 1 } }] };
    await expect(f.call(runs.hydrate, { reference: f.reference, runId: next.runId, ...claim })).rejects.toThrow();
  });
  it.each(["different-order", "at-anchor", "before-anchor"] as const)("atomic Agent ledger fence rejects a saved pin matching native position %s outside the run anchor", async fault => {
    const f = await fixture(), { args } = await started(f), { id, native } = await savedFinal(f, args);
    const owned = f.db.table("runtimeAgentExecutions")[0], run = f.db.table("runtimeRuns")[0];
    const snapshot = JSON.parse(run.snapshotCanonical as string);
    const position = fault === "different-order" ? { order: snapshot.anchor.order + 1, stepOrder: 1 }
      : { order: snapshot.anchor.order, stepOrder: snapshot.anchor.stepOrder + (fault === "at-anchor" ? 0 : -1) };
    Object.assign(native, position); Object.assign(f.native.messages.get(id)!, position);
    const pins = owned.savedMessagePins as { id: string; order: number; stepOrder: number }[];
    Object.assign(pins.find(pin => pin.id === id)!, position);
    const denied = guardAgentRunBudget(f.ctx, f.reference, run.runAccountId as never);
    if (fault === "before-anchor") await expect(denied).rejects.toThrow();
    else await expect(denied).rejects.toMatchObject({ data: { code: "STALE_TRANSCRIPT" } });
  });
  it("source/manual edits fence every delegated operation and finalization before effects", async () => {
    const f = await fixture(); const { run, args } = await started(f);
    const { id } = await savedFinal(f, args);
    const conversation = f.db.table("runtimeConversations")[0];
    await f.call(transcript.setPolicy, { conversationId: run.conversationId, expectedRevision: conversation.historyRevision, manualWriteLocked: false });
    await expect(f.call(runtime.beginOperation, { ...args, kind: "model", ordinal: 1, requestCanonical: "{}" })).rejects.toThrow();
    await expect(f.call(runtime.finalize, { ...args, finalMessageIds: [id] })).rejects.toThrow(); expect(f.db.table("runtimeAgentIngestion")).toEqual([]);
  });
  it.each(["edit", "remove"])("unlocked %s cannot orphan a canonical assistant tool call and its result", async kind => {
    const f = await fixture(); const run = await f.run(); const conversation = f.db.table("runtimeConversations")[0];
    const input = f.native.messages.get(run.inputMessageIds[0])!;
    const pair = [
      { ...input, _id: "paired-call", stepOrder: 1, message: { role: "assistant", content: [{ type: "tool-call", toolCallId: "paired", toolName: "memory_recall", input: { text: "query", limit: 1 } }] } },
      { ...input, _id: "paired-result", stepOrder: 2, message: { role: "tool", content: [{ type: "tool-result", toolCallId: "paired", toolName: "memory_recall", output: { type: "json", value: { context: "private" } } }] } },
    ];
    for (const message of pair) f.native.messages.set(message._id, message);
    await transcript.registerMessages(f.ctx, conversation as never, f.reference, pair as unknown as MessageDoc[], { trustedToolMessages: true });
    await f.call(transcript.setPolicy, { conversationId: run.conversationId, expectedRevision: conversation.historyRevision, manualWriteLocked: false });
    const before = f.canonical([...f.native.messages.values()]); const revision = conversation.historyRevision;
    const args = { conversationId: run.conversationId, expectedRevision: revision, messageId: "paired-call", expectedMessageRevision: 1 };
    await expect(kind === "edit" ? f.call(transcript.edit, { ...args, parts: [{ type: "text", text: "replace call" }] }) : f.call(transcript.removeMessage, args)).rejects.toThrow("TOOL_HISTORY_EDIT_DENIED");
    expect(f.canonical([...f.native.messages.values()])).toBe(before); expect(conversation.historyRevision).toBe(revision);
    expect(f.effects.edits).toBe(0); expect(f.effects.deletes).toBe(0);
  });
  it("started/unknown paid work cannot be readmitted; completed exact replay is reusable and changed input denies", async () => {
    const f = await fixture(); const { args } = await started(f); const { id, op } = await savedFinal(f, args);
    expect(await f.call(runtime.beginOperation, { ...args, kind: "model", ordinal: 0, requestCanonical: "{}" })).toMatchObject({ state: "complete", nativeMessageIds: [id] });
    await expect(f.call(runtime.beginOperation, { ...args, kind: "model", ordinal: 0, requestCanonical: '{"changed":1}' })).rejects.toThrow();
    const next = await f.call<{ operationId: string }>(runtime.beginOperation, { ...args, kind: "model", ordinal: 1, requestCanonical: "{}" });
    await f.call(runtime.startOperation, { ...args, operationId: next.operationId });
    await expect(f.call(runtime.beginOperation, { ...args, kind: "model", ordinal: 1, requestCanonical: "{}" })).rejects.toThrow();
    await f.call(runtime.endInterrupted, { ...args, cancelled: false }); expect(f.db.table("runtimeAgentExecutions")[0].state).toBe("unknown");
    expect(f.db.table("runtimeAgentOperations").find(row => row.operationId === next.operationId)?.state).toBe("unknown"); expect(op.operationId).not.toBe(next.operationId);
  });
  it("finalization registers canonical messages and one ingestion receipt atomically/idempotently", async () => {
    const f = await fixture(); const { args } = await started(f); const { id } = await savedFinal(f, args);
    const first = await f.call(runtime.finalize, { ...args, finalMessageIds: [id] });
    expect(await f.call(runtime.finalize, { ...args, finalMessageIds: [id] })).toEqual(first);
    expect(f.db.table("runtimeAgentIngestion")).toHaveLength(1); expect(f.db.table("runtimeTranscriptMessages").filter(row => row.nativeMessageId === id)).toHaveLength(1);
    expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("complete");
    await expect(f.call(runtime.finalize, { ...args, finalMessageIds: ["different"] })).rejects.toThrow(); expect(f.effects.saves).toBe(1);
  });
  it("component-save gap recovers exact server generation without a model/tool retry; stale/cancelled gaps cannot attach", async () => {
    const f = await fixture(); const { run, args } = await started(f); const { id } = await savedFinal(f, args);
    f.db.table("runtimeAgentExecutions")[0].savedMessageIds = [];
    f.db.table("runtimeAgentOperations")[0].state = "started";
    await f.call(runtime.endInterrupted, { ...args, cancelled: false });
    expect(await f.call(runtime.reconcile, { runId: run.runId })).toMatchObject({ receiptId: expect.stringMatching(/^agent-ingestion:/) });
    expect(f.db.table("runtimeAgentIngestion")).toHaveLength(1); expect(f.db.table("runtimeRuns")[0].outputMessageIds).toEqual([id]); expect(starts).toHaveLength(1);
  });
  it("current-generation reconciliation ignores retained failed/unregistered holes and stops at older orders", async () => {
    const f = await fixture(); const { run, args } = await started(f); const { id } = await savedFinal(f, args);
    const input = f.native.messages.get((f.db.table("runtimeRuns")[0].inputMessageIds as string[])[0])!;
    for (let index = 0; index < 1010; index++) f.native.messages.set(`old-failed:${index}`, { ...input, _id: `old-failed:${index}`, order: -2, status: "failed" });
    for (let index = 0; index < 110; index++) f.native.messages.set(`old-success:${index}`, { ...input, _id: `old-success:${index}`, order: -1 });
    f.db.table("runtimeAgentExecutions")[0].savedMessageIds = []; f.db.table("runtimeAgentOperations")[0].state = "started";
    await f.call(runtime.endInterrupted, { ...args, cancelled: false });
    const first = await f.call(runtime.reconcile, { runId: run.runId }); expect(first).toMatchObject({ receiptId: expect.any(String) });
    expect(f.db.table("runtimeRuns")[0].outputMessageIds).toEqual([id]); expect(f.db.table("runtimeAgentIngestion")).toHaveLength(1);
    expect(await f.call(runtime.reconcile, { runId: run.runId })).toEqual(first); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  });
  it.each([[false, "changed"], [false, "tombstoned"], [true, "changed"], [true, "tombstoned"]] as const)("later private hydration retains source provenance (fork=%s, %s)", async (forked, change) => {
    const f = await fixture(); const first = await started(f);
    const source = f.db.seed("runtimeMemorySources", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
      ownerPrincipalId: f.reference.principalId, lineage: { sourceId: "recalled-x", sourceEventId: "event-x", sourceRevision: 1, role: "user", trust: "user_assertion" },
      content: "private recalled X", contentHash: await f.hash("private recalled X"), createdAt: Date.now() });
    const witness = { sourceId: "recalled-x", sourceEventId: "event-x", sourceRevision: 1, contentHash: source.contentHash as string };
    first.owned.sourceWitnesses = [witness]; const final = await savedFinal(f, first.args);
    const tool = { ...final.native, _id: "tool:history", order: final.native.order as number, stepOrder: 2, message: { role: "tool", content: [{ type: "tool-result", toolCallId: "tc", toolName: "memory_recall", output: { type: "json", value: { context: "PRIVATE_RECALLED_X" } } }] } };
    f.native.messages.set("tool:history", tool);
    first.owned.savedMessageIds = [...first.owned.savedMessageIds as string[], "tool:history"];
    first.owned.savedMessagePins = [...first.owned.savedMessagePins as object[], { id: tool._id, order: tool.order, stepOrder: tool.stepOrder, canonicalContentHash: await transcript.canonicalMessageHash(tool as unknown as MessageDoc) }];
    await f.call(runtime.finalize, { ...first.args, finalMessageIds: [final.id] });
    let conversationId = first.run.conversationId;
    if (forked) {
      const conversation = f.db.table("runtimeConversations")[0];
      conversationId = (await f.call<{ conversationId: string }>(transcript.fork, { conversationId, clientRequestId: "source-fork", expectedRevision: conversation.historyRevision })).conversationId;
    }
    const next = await f.run("B", conversationId); await f.call(runtime.start, { runId: next.runId });
    const owned = f.db.table("runtimeAgentExecutions").find(row => row.runId === next.runId)!;
    const args = { reference: f.reference, runId: next.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
    expect(JSON.stringify(await f.call(runtime.hydrateExecution, args))).toContain("PRIVATE_RECALLED_X");
    if (change === "changed") source.contentHash = "changed"; else source.tombstonedAt = Date.now();
    await expect(f.call(runtime.hydrateExecution, args)).rejects.toThrow();
    const row = f.db.table("runtimeRuns").find(row => row.runId === next.runId)!;
    await expect(guardAgentRunBudget(f.ctx, f.reference, row.runAccountId as never)).rejects.toThrow(); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  });
  it("observers replay scoped saved deltas with independent cursors; final-only withholds until completion and strips secrets", async () => {
    const f = await fixture(); const { run, args } = await started(f);
    await f.call(runtime.recordOutput, { ...args, parts: [{ type: "text-delta", text: "safe", id: "t", providerMetadata: { secret: "SECRET" } }, { type: "reasoning-delta", text: "REASONING" }, { type: "tool-input-delta", inputTextDelta: "TOOL_SECRET" }] });
    const first = await f.call<{ parts: unknown[]; cursor: number }>(runtime.observe, { runId: run.runId });
    expect(first.parts).toHaveLength(1); expect(JSON.stringify(first)).not.toMatch(/SECRET|REASONING|private memory|HIDDEN/);
    expect(await f.call(runtime.observe, { runId: run.runId })).toEqual(first);
    expect(await f.call(runtime.observe, { runId: run.runId, afterSequence: first.cursor })).toMatchObject({ parts: [] });
    expect(await f.call(runtime.observe, { runId: run.runId, finalOnly: true })).toMatchObject({ parts: [] });
    const { id } = await savedFinal(f, args); await f.call(runtime.finalize, { ...args, finalMessageIds: [id] });
    expect(await f.call(runtime.observe, { runId: run.runId, finalOnly: true })).toMatchObject({ state: "complete", parts: [
      { sequence: first.cursor + 1, part: { type: "text", text: "public final" } }, { sequence: first.cursor + 2, part: { type: "status", state: "complete" } }] });
    f.identity(null); await expect(f.call(runtime.observe, { runId: run.runId })).rejects.toThrow();
  });
  it("cancel retires Workflow/budget/output delivery and obsolete attempts cannot finalize", async () => {
    const f = await fixture(); const { run, args } = await started(f); const { id } = await savedFinal(f, args);
    await f.call(runtime.cancel, { runId: run.runId }); expect(cancellations).toEqual(["workflow:1"]);
    expect(f.db.table("runtimeAgentExecutions")[0].state).toBe("cancelled");
    await expect(f.call(runtime.finalize, { ...args, finalMessageIds: [id] })).rejects.toThrow(); await expect(f.call(runtime.recordOutput, { ...args, parts: [{ type: "text", text: "late" }] })).rejects.toThrow();
    await expect(f.call(runtime.reconcile, { runId: run.runId })).rejects.toThrow();
  });
  it("corrupted definition cannot enter context dispatch", async () => {
    const f = await fixture(); const { args } = await started(f);
    // Authoritative stored definition is digest-bound; a current byte change is denied before context dispatch.
    f.db.table("runtimeAgentDefinitions")[0].definitionCanonical = "{}";
    await expect(f.call(runtime.startContext, args)).rejects.toThrow(); expect(f.db.table("runtimeAgentOperations")).toEqual([]);
  });
  it("strict facts barrier waits and then reports the pinned deadline before embedding dispatch", async () => {
    installIngestionMockRoot();
    const f = await fixture({ maxContextTokens: 16384 }); const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, {
      memorySpaceId: "space-a", clientMutationId: "strict", expectedPreviousVersion: 0,
      definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, memoryMode: "strict", requiredStages: ["facts"], barrier: { deadlineMs: 100, onFailure: "fail" } } } });
    const run = await f.call<{ runId: string }>(runs.submit, { request: { ...f.request("strict-input"), agentId: published.agentId, agentVersion: published.version } });
    await f.call(runtime.start, { runId: run.runId }); const owned = f.db.table("runtimeAgentExecutions")[0];
    const args = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion };
    await f.call(runtime.startContext, args);
    expect(await f.call(runtime.contextBarrier, args)).toMatchObject({ state: "waiting", remainingMs: 100 });
    jest.mocked(Date.now).mockReturnValue(Date.now() + 101);
    expect(await f.call(runtime.contextBarrier, args)).toMatchObject({ state: "failed", failureCode: "MEMORY_BARRIER_TIMEOUT" });
    await f.call(runtime.failContext, { ...args, failureCode: "MEMORY_BARRIER_TIMEOUT" });
    await f.call(runtime.endInterrupted, { ...args, cancelled: false });
    expect(f.db.table("runtimeRuns")[0]).toMatchObject({ responseStatus: "failed", contextCompleteness: "incomplete", failureCode: "MEMORY_BARRIER_TIMEOUT" });
    expect(f.db.table("runtimeModelOperations")).toEqual([]);
  });
  it("strict readiness and pending context resolve against the owned run budget before model effects", async () => {
    installIngestionMockRoot();
    const f = await fixture({ maxContextTokens: 16384 }); const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, {
      memorySpaceId: "space-a", clientMutationId: "context-budget", expectedPreviousVersion: 0,
      definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, memoryMode: "strict", requiredStages: ["vectors"], barrier: { deadlineMs: 100, onFailure: "fail" } } } });
    const run = await f.call<{ runId: string }>(runs.submit, { request: { ...f.request("context-budget-input"), agentId: published.agentId, agentVersion: published.version } });
    await f.call(runtime.start, { runId: run.runId }); const owned = f.db.table("runtimeAgentExecutions")[0];
    const args = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion };
    await f.call(runtime.startContext, args);
    const runBudgetId = f.db.table("runtimeRuns")[0].runBudgetId;
    expect(await f.call(runtime.contextBarrier, args)).toMatchObject({ state: "waiting" });
    const account = f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run" && row.runBudgetId === runBudgetId)!;
    await f.db.patch("runtimeBudgetAccounts", account._id, { cancelled: true });
    await expect(f.call(runtime.contextBarrier, args)).rejects.toThrow("RUN_CANCELLED");
    await f.db.patch("runtimeBudgetAccounts", account._id, { cancelled: false });
    const originalQuery = f.ctx.runQuery.bind(f.ctx); const selections: Record<string, unknown>[] = [];
    f.ctx.runQuery = (async (ref: unknown, input: unknown) => {
      if ((ref as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")]) return await originalQuery(ref as never, input as never);
      const name = getFunctionName(ref as never); const selected = input as Record<string, unknown>;
      if (name === "runtimeModelPolicy:embeddingProfile") {
        selections.push({ name, ...selected });
        throw new Error("CONTROLLED_STOP_BEFORE_RECALL");
      }
      return await originalQuery(ref as never, input as never);
    }) as unknown as typeof f.ctx.runQuery;
    await expect(f.call(runtime.prepareContext, args)).rejects.toThrow("CONTROLLED_STOP_BEFORE_RECALL");
    expect(selections).toHaveLength(1);
    expect(selections[0]).toMatchObject({ name: "runtimeModelPolicy:embeddingProfile", reference: f.reference, operationKey: "embedding.query", runBudgetId });
    expect(f.db.table("runtimeModelOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  });
  it("explicit tool approval requires the current scoped admin, exact request hash and pinned history; resumes one durable event", async () => {
    installMockRoot({ tools: true }); const f = await fixture(); f.grant.capabilities = [...f.grant.capabilities as string[], "tool"];
    const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "tool-agent", expectedPreviousVersion: 0,
      definitionInput: { ...f.definitionInput, tools: [{ toolId: "memory.remember", toolVersion: 1, registryHash: await definitions.executableRegistryHash(), requiredCapability: "tool", approval: "explicit" }],
        policies: [{ policyId: "tool-agent", version: 1, rules: { limits: { toolSteps: 4 } } }] } });
    const run = await f.call<{ runId: string }>(runs.submit, { request: { ...f.request("tool-input"), agentId: published.agentId, agentVersion: published.version } });
    await f.call(runtime.start, { runId: run.runId }); const owned = f.db.table("runtimeAgentExecutions")[0];
    const args = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
    await f.call(runtime.saveContext, { ...args, context: "", witnesses: [], completeness: "complete" });
    const requestCanonical = f.canonical({ text: "Remember controlled text" });
    const op = await f.call<{ operationId: string; state: string }>(runtime.beginOperation, { ...args, kind: "tool", ordinal: 0, toolCallId: "tc", toolName: "memory_remember", requestCanonical });
    expect(op.state).toBe("waiting_approval"); await f.call(runtime.waitForApproval, { ...args, operationId: op.operationId });
    await expect(f.call(runtime.approveTool, { runId: run.runId, operationId: op.operationId, expectedRequestHash: "wrong" })).rejects.toThrow(); expect(events).toEqual([]);
    await expect(f.call(runs.approve, { runId: run.runId, expectedDefinitionHash: f.db.table("runtimeRuns")[0].definitionHash })).rejects.toThrow("USE_TOOL_APPROVAL");
    const expectedRequestHash = await f.hash(requestCanonical);
    expect(await f.call(runtime.approveTool, { runId: run.runId, operationId: op.operationId, expectedRequestHash })).toEqual({ approved: true }); expect(events).toHaveLength(1);
    expect(f.db.table("runtimeAgentOperations")[0].approvalActor).toEqual(f.reference);
    await expect(f.call(runtime.approveTool, { runId: run.runId, operationId: op.operationId, expectedRequestHash })).rejects.toThrow(); expect(events).toHaveLength(1);
    expect(JSON.stringify(await f.call(runtime.observe, { runId: run.runId }))).not.toContain("Remember controlled text");
  });
  it("expired active approval cannot renew, then its owned timer cancels once and makes the next queued run ready", async () => {
    const { f, run, owned, args, op, request, expiry, expectedRequestHash } = await approvalWait(true);
    const next = await f.call<{ runId: string }>(runs.submit, { request: request("next", run.conversationId) });
    const timer = f.scheduled.find(item => item.name === "runtimeAgent:expireApproval")!;
    expect(timer.args).toEqual({ ...args, leaseExpiresAt: expiry });
    jest.spyOn(Date, "now").mockReturnValue(expiry);
    const before = f.db.writes;
    await expect(f.call(runtime.approveTool, { runId: run.runId, operationId: op.operationId, expectedRequestHash })).rejects.toThrow("LEASE_EXPIRED");
    expect(f.db.writes).toBe(before); expect(events).toEqual([]);
    await f.call(runtime.expireApproval, timer.args);
    expect(f.db.table("runtimeRuns")[0]).toMatchObject({ responseStatus: "cancelled", failureCode: "APPROVAL_EXPIRED" });
    expect(f.db.table("runtimeRunAttempts")[0]).toMatchObject({ status: "cancelled", failureCode: "APPROVAL_EXPIRED" });
    expect(f.db.table("runtimeRunOutbox")[0].state).toBe("complete"); expect(cancellations).toEqual([owned.workflowId]);
    const recovery = f.scheduled.find(item => item.name === "runs:recoverOwnedQueue")!;
    expect(await f.call(runs.recoverOwnedQueue, recovery.args)).toEqual({ readyRunId: next.runId });
    const writes = f.db.writes, parts = f.db.table("runtimeAgentOutput").length;
    await f.call(runtime.expireApproval, timer.args);
    await f.call(runtime.onWorkflowComplete, { workflowId: owned.workflowId, context: args, result: { kind: "canceled" } });
    expect(f.db.writes).toBe(writes); expect(f.db.table("runtimeAgentOutput")).toHaveLength(parts); expect(cancellations).toHaveLength(1);
    await expect(f.call(runtime.startOperation, { ...args, operationId: op.operationId })).rejects.toThrow(); expect(f.db.table("runtimeModelOperations")).toEqual([]);
  });
  it("current unexpired tool approval keeps its durable wait positive and a stale expiry callback cannot cancel renewed work", async () => {
    const { f, run, owned, args, op, expiry, expectedRequestHash } = await approvalWait();
    jest.spyOn(Date, "now").mockReturnValue(Date.now() + 1000);
    expect(await f.call(runtime.approveTool, { runId: run.runId, operationId: op.operationId, expectedRequestHash })).toEqual({ approved: true });
    expect(f.db.table("runtimeRunOutbox")[0].leaseExpiresAt).toBeGreaterThan(expiry); expect(events).toHaveLength(1);
    const writes = f.db.writes;
    await f.call(runtime.expireApproval, { ...args, leaseExpiresAt: expiry });
    expect(f.db.writes).toBe(writes); expect(cancellations).toEqual([]); expect((await f.db.get("runtimeAgentExecutions", owned._id))!.state).toBe("running");
  });
  it("queue recovery retires an expired active approval but leaves intentional unclaimed input approval pending", async () => {
    const { f, run, request, expiry } = await approvalWait(true);
    const next = await f.call<{ runId: string }>(runs.submit, { request: request("recovered", run.conversationId) });
    jest.spyOn(Date, "now").mockReturnValue(expiry);
    expect(await f.call(runs.recoverQueue, { reference: f.reference, conversationId: run.conversationId })).toEqual({ readyRunId: next.runId });
    expect(f.db.table("runtimeAgentExecutions")[0].state).toBe("cancelled");
    const created = await f.call<{ conversationId: string }>(transcript.create, { memorySpaceId: "space-a", clientRequestId: "pre-run", requireApproval: true });
    const waiting = await f.call<{ runId: string }>(runs.submit, { request: request("pre-run", created.conversationId) });
    expect(await f.call(runs.recoverQueue, { reference: f.reference, conversationId: created.conversationId })).toEqual({ readyRunId: null });
    const row = f.db.table("runtimeRuns").find(item => item.runId === waiting.runId)!;
    expect(row).toMatchObject({ responseStatus: "waiting_approval", attemptNumber: 0 });
    expect(await f.call(runs.approve, { runId: waiting.runId, expectedDefinitionHash: row.definitionHash })).toMatchObject({ responseStatus: "queued" });
  });
  it("expiry cleanup survives an obsolete owner grant and recovers a later queued row under its own current authority", async () => {
    const { f, run, args, request, expiry } = await approvalWait(true);
    f.grant.version = 2;
    const next = await f.call<{ runId: string }>(runs.submit, { request: request("new-authority", run.conversationId) });
    const nextRow = f.db.table("runtimeRuns").find(item => item.runId === next.runId)!;
    expect(nextRow.authorityReference).toMatchObject({ grantVersion: 2 });
    jest.spyOn(Date, "now").mockReturnValue(expiry);
    await f.call(runtime.expireApproval, { ...args, leaseExpiresAt: expiry });
    expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("cancelled"); expect(cancellations).toHaveLength(1);
    const callback = f.scheduled.find(item => item.name === "runs:recoverOwnedQueue")!;
    expect(await f.call(runs.recoverOwnedQueue, callback.args)).toEqual({ readyRunId: next.runId });
    expect(f.db.table("runtimeRuns").find(item => item.runId === next.runId)!.responseStatus).toBe("queued"); expect(f.db.table("runtimeModelOperations")).toEqual([]);
  });
  it("current owner can read status and cancel after definition revocation while executable paths stay closed", async () => {
    const f = await fixture(); const { run, args, owned } = await started(f); const row = f.db.table("runtimeRuns")[0];
    await f.call(definitions.revokeVersion, { memorySpaceId: "space-a", agentId: row.agentId, version: row.agentVersion, expectedDefinitionHash: row.definitionHash, reason: "Controlled revoke" });
    expect(await f.call(runs.get, { runId: run.runId })).toMatchObject({ responseStatus: "running" });
    expect(await f.call(runtime.observe, { runId: run.runId })).toMatchObject({ run: { responseStatus: "running" } });
    await expect(f.call(runtime.hydrateExecution, args)).rejects.toThrow("POLICY_DENIED");
    await expect(f.call(runtime.startOperation, { ...args, operationId: "obsolete" })).rejects.toThrow("POLICY_DENIED");
    expect(await f.call(runtime.cancel, { runId: run.runId })).toEqual({ cancelled: true });
    expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("cancelled"); expect(f.db.table("runtimeAgentExecutions")[0].state).toBe("cancelled");
    expect(cancellations).toEqual([owned.workflowId]); expect(f.db.table("runtimeBudgetAccounts").find(account => account._id === row.runAccountId)!.cancelled).toBe(true);
    expect(f.db.table("runtimeModelOperations")).toEqual([]);
  });
  it.each(["no-jwt", "foreign-space"])("definition-revoked metadata/cancellation still denies %s without effects", async mode => {
    const f = await fixture(); const { run } = await started(f); const row = f.db.table("runtimeRuns")[0];
    await f.call(definitions.revokeVersion, { memorySpaceId: "space-a", agentId: row.agentId, version: row.agentVersion, expectedDefinitionHash: row.definitionHash, reason: "Controlled revoke" });
    if (mode === "no-jwt") f.identity(null);
    const selector = { runId: run.runId, ...(mode === "foreign-space" ? { memorySpaceId: "other-space" } : {}) }; const before = f.db.writes;
    await expect(f.call(runs.get, selector)).rejects.toThrow(); await expect(f.call(runtime.observe, selector)).rejects.toThrow(); await expect(f.call(runtime.cancel, selector)).rejects.toThrow();
    expect(f.db.writes).toBe(before); expect(cancellations).toEqual([]); expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("running");
  });
  it("a legitimately renewed owner grant cancels the captured budget without changing paid or uncertain accounting", async () => {
    const f = await fixture(); const { run, owned } = await started(f); const row = f.db.table("runtimeRuns")[0];
    const budget = f.db.table("runtimeBudgetAccounts").find(account => account._id === row.runAccountId)!;
    budget.reservedUnits = 17; budget.uncertainUnits = 11; budget.activeConcurrency = 1;
    const accounting = { reservedUnits: budget.reservedUnits, uncertainUnits: budget.uncertainUnits, activeConcurrency: budget.activeConcurrency };
    const current = await f.call<{ grantVersion: number; grantId: string }>(auth.provision, { issuer: "https://host.test", subject: "user-a", actorKind: "user", metadataUserId: "user-a",
      tenantId: "tenant-a", memorySpaceId: "space-a", capabilities: ["read", "write", "run", "admin"], resourceAccess: "own", expiresAt: Date.now() + 100_000 });
    expect(current.grantVersion).toBe(2); expect(current.grantId).not.toBe(f.reference.grantId);
    expect(await f.call(runs.get, { runId: run.runId })).toMatchObject({ responseStatus: "running" });
    expect(await f.call(runtime.cancel, { runId: run.runId })).toEqual({ cancelled: true });
    expect(f.db.table("runtimeBudgetAccounts").find(account => account._id === row.runAccountId)).toMatchObject({ ...accounting, cancelled: true });
    expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("cancelled"); expect(cancellations).toEqual([owned.workflowId]); expect(f.db.table("runtimeModelOperations")).toEqual([]);
    const recovery = f.scheduled.find(item => item.name === "runs:recoverOwnedQueue")!;
    expect((recovery.args as { reference: { grantId: string } }).reference.grantId).toBe(current.grantId);
  });
  it.each(["no-jwt", "foreign-space"])("renewed owner budget cancellation still denies %s without accounting or Workflow effects", async mode => {
    const f = await fixture(); const { run } = await started(f);
    await f.call(auth.provision, { issuer: "https://host.test", subject: "user-a", actorKind: "user", metadataUserId: "user-a", tenantId: "tenant-a", memorySpaceId: "space-a",
      capabilities: ["read", "write", "run", "admin"], resourceAccess: "own", expiresAt: Date.now() + 100_000 });
    if (mode === "no-jwt") f.identity(null);
    const before = f.db.writes, budgets = f.canonical(f.db.table("runtimeBudgetAccounts"));
    await expect(f.call(runtime.cancel, { runId: run.runId, ...(mode === "foreign-space" ? { memorySpaceId: "other-space" } : {}) })).rejects.toThrow();
    expect(f.db.writes).toBe(before); expect(f.canonical(f.db.table("runtimeBudgetAccounts"))).toBe(budgets); expect(cancellations).toEqual([]);
  });
  it.each(["changed", "tombstoned"])("dynamic tool-recalled source %s is denied before next paid admission and finalization", async kind => {
    const f = await fixture(); const { args } = await started(f); const source = f.db.table("runtimeMemorySources")[0];
    const lineage = source.lineage as { sourceId: string; sourceEventId: string; sourceRevision: number };
    f.db.seed("runtimeAgentOperations", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, runId: args.runId, attemptNumber: 1,
      operationId: "controlled-tool", semanticId: "controlled", kind: "tool", ordinal: 0, toolCallId: "tc", toolName: "memory_recall", requestCanonical: "{}", state: "started", nativeMessageIds: [], createdAt: Date.now() });
    await f.call(runtime.rememberToolSources, { ...args, operationId: "controlled-tool", witnesses: [{ ...lineage, contentHash: source.contentHash }] });
    expect(f.db.table("runtimeAgentExecutions")[0].sourceWitnesses).toHaveLength(1);
    expect(await f.call(runtime.hydrateExecution, args)).toMatchObject({ run: { runId: args.runId } });
    if (kind === "changed") source.contentHash = "changed"; else source.tombstonedAt = Date.now();
    await expect(f.call(runtime.beginOperation, { ...args, kind: "model", ordinal: 1, requestCanonical: "{}" })).rejects.toThrow();
    expect(f.db.table("runtimeModelOperations")).toEqual([]);
    await expect(f.call(runtime.finalize, { ...args, finalMessageIds: ["late"] })).rejects.toThrow(); expect(f.db.table("runtimeAgentIngestion")).toEqual([]);
  });
  it.each(["body", "position"])("saved private tool/model %s mutation cannot reach a later native admission", async kind => {
    const f = await fixture(); const { args } = await started(f); const { native } = await savedFinal(f, args);
    const run = f.db.table("runtimeRuns")[0];
    await guardAgentRunBudget(f.ctx, f.reference, run.runAccountId as never);
    if (kind === "body") native.message = { role: "assistant", content: "changed private result" }; else native.stepOrder = 10;
    await expect(guardAgentRunBudget(f.ctx, f.reference, run.runAccountId as never)).rejects.toThrow("STALE_TRANSCRIPT");
    await expect(f.call(runtime.hydrateExecution, args)).rejects.toThrow("STALE_TRANSCRIPT");
  });
  it.each(["cancel", "edit", "revoke", "expired"])("the ledger transaction rejects %s after an earlier action-side hydration", async kind => {
    const f = await fixture(); const { run, args } = await started(f); const row = f.db.table("runtimeRuns")[0];
    await f.call(runtime.hydrateExecution, args);
    if (kind === "cancel") await f.call(runtime.cancel, { runId: run.runId });
    if (kind === "edit") { const c = f.db.table("runtimeConversations")[0]; await f.call(transcript.setPolicy, { conversationId: run.conversationId, expectedRevision: c.historyRevision, manualWriteLocked: false }); }
    if (kind === "revoke") f.grant.revokedAt = Date.now();
    if (kind === "expired") f.db.table("runtimeRunOutbox")[0].leaseExpiresAt = Date.now() - 1;
    await expect(guardAgentRunBudget(f.ctx, f.reference, row.runAccountId as never)).rejects.toThrow();
    expect(f.db.table("runtimeModelOperations")).toEqual([]);
  });
  it("standalone model/memory budgets retain their original contract without transcript reads", async () => {
    const f = await fixture(); const query = jest.fn<() => Promise<never>>(() => Promise.reject(new Error("Unexpected component read")));
    await guardAgentRunBudget({ db: f.ctx.db, runQuery: query as never }, f.reference, "standalone-account" as never); expect(query).not.toHaveBeenCalled();
  });
  it("duplicate completion callbacks keep one terminal output and gap reconciliation supplies final-only text", async () => {
    const f = await fixture(); const { run, args } = await started(f); const { id } = await savedFinal(f, args);
    f.db.table("runtimeAgentExecutions")[0].savedMessageIds = []; f.db.table("runtimeAgentOperations")[0].state = "started";
    await f.call(runtime.endInterrupted, { ...args, cancelled: false }); const count = f.db.table("runtimeAgentOutput").length;
    await f.call(runtime.onWorkflowComplete, { workflowId: "workflow:1", context: args, result: { kind: "failed", error: "RAW_PROVIDER_SECRET" } });
    expect(f.db.table("runtimeAgentOutput")).toHaveLength(count);
    await f.call(runtime.reconcile, { runId: run.runId });
    const delivery = await f.call<{ parts: { part: unknown }[] }>(runtime.observe, { runId: run.runId, finalOnly: true });
    expect(delivery.parts.map(item => item.part)).toEqual([{ type: "text", text: "public final" }, { type: "status", state: "complete" }]);
    await f.call(runtime.onWorkflowComplete, { workflowId: "workflow:1", context: args, result: { kind: "canceled" } });
    expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("complete"); expect(f.db.table("runtimeRuns")[0].outputMessageIds).toEqual([id]);
  });
  it("Workflow uses fresh immutable ordinals and never retries model, context or tool actions", async () => {
    const actions: { name: string; ordinal?: number; retry: boolean }[] = [], waits: unknown[] = [], finals: unknown[] = [];
    const step = { runAction: async (ref: unknown, args: Record<string, unknown>, options: { retry: boolean }) => {
      const name = getFunctionName(ref as never); actions.push({ name, ordinal: args.ordinal as number | undefined, retry: options.retry });
      return name === "runtimeAgent:modelStep" ? args.ordinal === 0 ? { savedMessageIds: ["call"], calls: [{ toolCallId: "tc", toolName: "memory_remember", inputCanonical: '{"text":"remember"}' }], final: false }
        : { savedMessageIds: ["final"], calls: [], final: true } : null;
    }, runMutation: async (ref: unknown, args: unknown) => { const name = getFunctionName(ref as never); if (name === "runtimeAgent:finalize") finals.push(args); if (name === "runtimeAgent:contextBarrier") return { state: "ready", remainingMs: 0 }; return { state: "waiting_approval", operationId: "owned-tool" }; },
    awaitEvent: async (args: unknown) => { waits.push(args); return "approved"; } };
    const handler = (runtime.executeTurn as unknown as { _handler: (step: unknown, args: unknown) => Promise<null> })._handler;
    expect(await handler(step, { reference: {}, runId: "r", attemptNumber: 1, leaseVersion: 1 })).toBeNull();
    expect(actions.map(item => [item.name, item.ordinal, item.retry])).toEqual([["runtimeAgent:prepareContext", undefined, false], ["runtimeAgent:modelStep", 0, false], ["runtimeAgent:toolStep", 0, false], ["runtimeAgent:modelStep", 1, false]]);
    expect(waits).toHaveLength(1); expect(finals).toHaveLength(1);
    const failed = jest.fn(async () => { throw new Error("ambiguous paid failure"); });
    await expect(handler({ ...step, runAction: failed }, {})).rejects.toThrow("ambiguous paid failure"); expect(failed).toHaveBeenCalledTimes(1);
  });
  it("tool source commits recheck cancellation in the effect transaction, after an earlier approved check", async () => {
    installMockRoot({ tools: true }); const f = await fixture(); f.grant.capabilities = [...f.grant.capabilities as string[], "tool"];
    const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "atomic-tool", expectedPreviousVersion: 0,
      definitionInput: { ...f.definitionInput, tools: [{ toolId: "memory.remember", toolVersion: 1, registryHash: await definitions.executableRegistryHash(), requiredCapability: "tool", approval: "none" }], policies: [{ policyId: "atomic", version: 1, rules: { limits: { toolSteps: 4 } } }] } });
    const run = await f.call<{ runId: string }>(runs.submit, { request: { ...f.request("atomic-input"), agentId: published.agentId, agentVersion: published.version } });
    await f.call(runtime.start, { runId: run.runId }); const owned = f.db.table("runtimeAgentExecutions")[0];
    const args = { reference: f.reference, runId: run.runId, attemptNumber: 1, leaseVersion: owned.leaseVersion as number };
    const originalSource = f.db.table("runtimeMemorySources")[0];
    const lineage = originalSource.lineage as { sourceId: string; sourceEventId: string; sourceRevision: number };
    const initialWitnesses = [{ sourceId: lineage.sourceId, sourceEventId: lineage.sourceEventId, sourceRevision: lineage.sourceRevision,
      contentHash: originalSource.contentHash, permissions: ["canViewFacts"] }];
    await f.call(runtime.saveContext, { ...args, context: "", witnesses: initialWitnesses, completeness: "complete" });
    const op = await f.call<{ operationId: string }>(runtime.beginOperation, { ...args, kind: "tool", ordinal: 0, toolCallId: "tc", toolName: "memory_remember", requestCanonical: f.canonical({ text: "controlled write" }) });
    await f.call(runtime.startOperation, { ...args, operationId: op.operationId }); await f.call(runtime.checkActiveTool, { ...args, operationId: op.operationId });
    const oldUserLineage = await prepareSourceContent(memoryScope(f.reference), explicitSourceLineage(memoryScope(f.reference), op.operationId), "controlled write", { now: () => Date.now() });
    const beforeWrite = f.db.table("runtimeMemorySources").length;
    await expect(f.call(runtime.writeToolSource, { ...args, operationId: op.operationId, source: oldUserLineage.source })).rejects.toThrow("TOOL_DENIED");
    expect(f.db.table("runtimeMemorySources")).toHaveLength(beforeWrite);
    const prepared = await prepareSourceContent(memoryScope(f.reference), tools.serverToolSourceLineage(memoryScope(f.reference), op.operationId), "controlled write", { now: () => Date.now() });
    expect(prepared.source.lineage).toEqual({ ...oldUserLineage.source.lineage, role: "tool", trust: "verified_tool_evidence", operationId: op.operationId });
    expect(await f.call(runtime.writeToolSource, { ...args, operationId: op.operationId, source: prepared.source })).toMatchObject({ created: true });
    const stored = f.db.table("runtimeMemorySources").find(source => (source.lineage as { sourceId: string }).sourceId === prepared.source.lineage.sourceId)!;
    expect(stored.contextSourceWitnesses).toEqual(initialWitnesses);
    // A later execution witness expansion must not mutate this source's captured ancestry or create a self-cycle.
    const laterExecution = f.db.table("runtimeAgentExecutions").find(execution => execution.runId === run.runId)!;
    (laterExecution.sourceWitnesses as unknown[]).push({ sourceId: prepared.source.lineage.sourceId, sourceEventId: prepared.source.lineage.sourceEventId,
      sourceRevision: prepared.source.lineage.sourceRevision, contentHash: prepared.source.contentHash, permissions: ["canViewMemories"] });
    expect(stored.contextSourceWitnesses).toEqual(initialWitnesses);
    expect(await f.call(memory.readSource, { reference: f.reference, capability: "write", sourceId: prepared.source.lineage.sourceId })).toMatchObject({ contextSourceWitnesses: initialWitnesses });
    const before = f.db.table("runtimeMemorySources").length; await f.call(runtime.cancel, { runId: run.runId });
    await expect(f.call(runtime.writeToolSource, { ...args, operationId: op.operationId, source: prepared.source })).rejects.toThrow(); expect(f.db.table("runtimeMemorySources")).toHaveLength(before);
  });
});
describe("closed server tool contract", () => {
  it("registered tools expose exact schemas and no SDK execute callback", () => {
    const installed = tools.serverTools(["memory.recall", "memory.remember"]);
    expect(Object.keys(installed)).toEqual(["memory_recall", "memory_remember"]); expect(installed.memory_recall.execute).toBeUndefined(); expect(installed.memory_remember.execute).toBeUndefined();
    expect(tools.validateToolInput("memory.recall", { text: "query", limit: 2 })).toEqual({ text: "query", limit: 2 });
  });
  it.each([{}, { text: "" }, { text: "ok", limit: 11 }, { text: "ok", limit: 1, tenantId: "other" }, { text: "ok", limit: true }, { text: "ok", limit: 1.5 }])("tool input rejects malformed/extra/foreign control %p", value => {
    expect(() => tools.validateToolInput("memory.recall", value)).toThrow();
  });
  it("tool input rejects getters before invocation and unknown native names cannot select callbacks", () => {
    const getter = jest.fn(() => "secret"); const input = { limit: 1 }; Object.defineProperty(input, "text", { enumerable: true, get: getter });
    expect(() => tools.validateToolInput("memory.recall", input)).toThrow(); expect(getter).not.toHaveBeenCalled(); expect(() => tools.semanticToolName("arbitrary_tool")).toThrow();
  });
});
