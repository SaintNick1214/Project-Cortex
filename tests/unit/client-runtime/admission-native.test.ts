/** Real registered handlers on the existing controlled transactional/component fixture.
 * Native Convex OCC, Workflow execution and timing still require the disposable service lane. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getFunctionName, makeFunctionReference } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { RuntimeRun, RuntimeStartResult } from "../../../src/client-runtime/types";
import { assertNativeArgs } from "../runtimeAgent/native-arguments";

jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start(ctx: MutationCtx, _ref: unknown, args: Record<string, unknown>) {
    // This insertion shares the fixture's existing parent rollback, like native Workflow scheduling.
    return await ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("runtimeAgent:executeTurn"), { args });
  }
} }));
const { installMockRoot, transcriptFixture, transcript, runs, invoke, clone } = await import("../runtimeTranscript/fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const client = await import("../../../convex-dev/runtimeClient");
const definitions = await import("../../../convex-dev/agentDefinitions");
type Admission = { version: 1; run: RuntimeRun; start: RuntimeStartResult };
const initialTrace = process.env.CORTEX_RUNTIME_LATENCY_TRACE;
beforeEach(() => { installMockRoot(); });
afterEach(() => {
  if (initialTrace === undefined) delete process.env.CORTEX_RUNTIME_LATENCY_TRACE;
  else process.env.CORTEX_RUNTIME_LATENCY_TRACE = initialTrace;
  jest.restoreAllMocks();
});
async function fixture(options: { maxContextTokens?: number } = {}) {
  const f = await transcriptFixture(options), original = f.ctx.runMutation.bind(f.ctx);
  const calls: { name: string; args: unknown }[] = [];
  f.ctx.runMutation = (async (ref: unknown, args: unknown) => {
    let name = ""; try { name = getFunctionName(ref as never); } catch { /* Original native component route. */ }
    const registration = name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime]
      : name.startsWith("runs:") ? runs[name.split(":")[1] as keyof typeof runs] : undefined;
    if (!registration) return await original(ref as never, args as never);
    calls.push({ name, args }); assertNativeArgs(registration, args);
    return await invoke(registration, f.ctx, args);
  }) as typeof f.ctx.runMutation;
  const admit = async (request = f.request(), options: { streaming?: boolean; tenantId?: string; memorySpaceId?: string } = {}) => {
    const args = { request, ...options }; assertNativeArgs(client.submitAndStart, args);
    return await f.call<Admission>(client.submitAndStart, args);
  };
  const workflows = () => f.scheduled.filter(row => row.name === "runtimeAgent:executeTurn");
  const snapshot = () => clone({ rows: f.db.rows, native: f.native, scheduled: f.scheduled, effects: f.effects, writes: f.db.writes });
  return { ...f, admit, calls, workflows, snapshot };
}
function afterWorkflow(f: Awaited<ReturnType<typeof fixture>>, change: () => void) {
  const native = f.ctx.scheduler.runAfter.bind(f.ctx.scheduler), reached = { value: false };
  f.ctx.scheduler.runAfter = async (delay, ref, ...args) => {
    const result = await native(delay, ref, ...args);
    if (getFunctionName(ref) === "runtimeAgent:executeTurn") { reached.value = true; change(); }
    return result;
  };
  return reached;
}
describe("combined native run admission", () => {
  it("opt-in submit/start/get mutation spans preserve exact registered result and transactional effects", async () => {
    const f = await fixture(), rollback = new Error("REFERENCE_ROLLBACK"); let expected: Admission | undefined, after: unknown;
    delete process.env.CORTEX_RUNTIME_LATENCY_TRACE;
    await expect(f.transaction(async () => { expected = await f.admit(); after = f.snapshot(); throw rollback; })).rejects.toBe(rollback);
    process.env.CORTEX_RUNTIME_LATENCY_TRACE = "1";
    const output = jest.spyOn(console, "log").mockImplementation(() => {}), now = jest.spyOn(performance, "now");
    let tick = 100; now.mockImplementation(() => ++tick);
    const actual = await f.admit(); expect(actual).toEqual(expected); expect(f.snapshot()).toEqual(after);
    const spans = output.mock.calls.map(([value]) => JSON.parse(value as string) as { phase: string; durationMs?: number });
    expect(spans.filter(row => row.phase.startsWith("admission.")).map(row => row.phase)).toEqual([
      "admission.submit.begin", "admission.submit.end", "admission.start.begin", "admission.start.end", "admission.get.begin", "admission.get.end",
    ]);
    expect(spans.filter(row => row.phase.startsWith("admission.") && row.phase.endsWith(".end"))).toEqual([
      expect.objectContaining({ phase: "admission.submit.end", durationMs: 1 }),
      expect.objectContaining({ phase: "admission.start.end", durationMs: expect.any(Number) }),
      expect.objectContaining({ phase: "admission.get.end", durationMs: 1 }),
    ]);
    expect(spans.find(row => row.phase === "admission.start.end")!.durationMs).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(spans)).not.toContain(f.request().parts[0]!.text);
    expect(JSON.stringify(actual)).not.toContain("durationMs");
    expect(f.effects.saves).toBe(1); expect(f.workflows()).toHaveLength(1);
  });
  it("an enabled failed start span preserves original failure and complete parent rollback", async () => {
    const f = await fixture(), before = f.snapshot(), failure = new Error("ORIGINAL_WORKFLOW_FAILURE");
    const reached = afterWorkflow(f, () => { throw failure; });
    process.env.CORTEX_RUNTIME_LATENCY_TRACE = "1";
    const output = jest.spyOn(console, "log").mockImplementation(() => {});
    await expect(f.admit()).rejects.toBe(failure); expect(reached.value).toBe(true); expect(f.snapshot()).toEqual(before);
    expect(output.mock.calls.map(([value]) => JSON.parse(value as string).phase).filter((phase: string) => phase.startsWith("admission."))).toEqual([
      "admission.submit.begin", "admission.submit.end", "admission.start.begin", "admission.start.failed",
    ]);
    expect(output.mock.calls.flat().join()).not.toContain(failure.message);
  });
  it("directly composes the original submit/start/get bodies with exact selectors and one durable attempt/account", async () => {
    const f = await fixture(), request = f.request();
    const result = await f.admit(request, { tenantId: "tenant-a", memorySpaceId: "space-a", streaming: false });
    expect(result).toMatchObject({ version: 1, run: { responseStatus: "running", attemptNumber: 1 }, start: { runId: result.run.runId, attemptNumber: 1, state: "ready" } });
    expect(f.calls.filter(call => ["runs:submit", "runtimeAgent:start", "runs:get"].includes(call.name))).toEqual([]);
    expect(f.calls.filter(call => call.name === "runs:claimNext")).toEqual([
      { name: "runs:claimNext", args: { reference: f.reference, conversationId: result.run.conversationId, leaseMs: 300_000 } },
    ]);
    expect(f.effects.saves).toBe(1); expect(f.db.table("runtimeRunAttempts")).toHaveLength(1);
    expect(f.workflows()).toHaveLength(1); expect(f.db.table("runtimeAgentExecutions")).toMatchObject([{ streaming: false }]);
    const row = f.db.table("runtimeRuns")[0];
    expect(result.run.scope).toEqual({ tenantId: "tenant-a", memorySpaceId: "space-a" });
    expect(row).toMatchObject({ tenantId: "tenant-a", memorySpaceId: "space-a", executionRequested: true, streamingRequested: false });
    expect(row.authorityReference).toEqual(f.reference); expect(row.runAccountId).toBeTruthy(); expect(row.snapshotCanonical).toBeTruthy();
    expect(f.db.table("runtimeRunOutbox")).toMatchObject([{ state: "claimed", runId: result.run.runId }]);
    expect(f.db.table("runtimeConversations")[0].manualWriteLocked).toBe(true);
  });
  it("same request and streaming contract dedupe without saving, rebudgeting or redispatching", async () => {
    const f = await fixture(), first = await f.admit(), before = f.snapshot();
    expect(await f.admit()).toEqual(first);
    expect(f.effects).toEqual(before.effects); expect(f.workflows()).toHaveLength(1);
    expect(f.db.table("runtimeRuns")[0].runAccountId).toBe(before.rows.get("runtimeRuns")![0].runAccountId);
    expect(f.db.table("runtimeAgentExecutions")).toHaveLength(1);
  });
  it.each(["payload", "streaming"])("changed %s on request replay rolls back all native effects", async kind => {
    const f = await fixture(); await f.admit(); const before = f.snapshot();
    const request = kind === "payload" ? { ...f.request(), parts: [{ type: "text" as const, text: "changed" }] } : f.request();
    await expect(f.admit(request, kind === "streaming" ? { streaming: false } : {})).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    expect(f.snapshot()).toEqual(before);
  });
  it("approval-required input stays unapproved, requests execution and resumes only after explicit native approval", async () => {
    const f = await fixture();
    const conversation = await f.call<{ conversationId: string }>(transcript.create, { memorySpaceId: "space-a", clientRequestId: "approval-conversation", requireApproval: true });
    const result = await f.admit(f.request("approval", conversation.conversationId));
    expect(result).toMatchObject({ run: { responseStatus: "waiting_approval", attemptNumber: 0 }, start: { state: "queued", attemptNumber: 0 } });
    expect(f.db.table("runtimeRuns")[0]).toMatchObject({ executionRequested: true, streamingRequested: true });
    expect(f.workflows()).toEqual([]); expect(f.db.table("runtimeTranscriptMessages")).toMatchObject([{ approved: false }]);
    expect(f.calls.some(call => call.name === "runs:approve")).toBe(false);
    await f.call(runs.approve, { runId: result.run.runId, expectedDefinitionHash: result.run.definitionHash });
    expect(f.db.table("runtimeTranscriptMessages")).toMatchObject([{ approved: true }]);
    await f.call(runtime.start, { runId: result.run.runId }); expect(f.workflows()).toHaveLength(1);
    expect(f.db.table("runtimeRuns")[0].responseStatus).toBe("running");
  });
  it("a prior unstarted queue head cannot be claimed under a new handle; parent admission rolls back", async () => {
    const f = await fixture(), head = await f.run("head"), before = f.snapshot();
    await expect(f.admit(f.request("next", head.conversationId))).rejects.toThrow("QUEUE_NOT_READY");
    expect(f.snapshot()).toEqual(before); expect(f.db.table("runtimeRuns")).toHaveLength(1);
    expect(f.db.table("runtimeRuns")[0]).toMatchObject({ runId: head.runId, responseStatus: "queued", attemptNumber: 0 });
    expect(f.workflows()).toEqual([]);
  });
  it.each(["running", "waiting_approval"] as const)("a prior %s head preserves the new durable queued request without dispatch", async status => {
    const f = await fixture();
    const conversation = await f.call<{ conversationId: string }>(transcript.create, { memorySpaceId: "space-a", clientRequestId: "prior-head", requireApproval: status === "waiting_approval" });
    const head = await f.admit(f.request("head", conversation.conversationId));
    if (status === "waiting_approval") {
      const conversationRow = f.db.table("runtimeConversations")[0];
      await f.call(transcript.setPolicy, { conversationId: conversation.conversationId, expectedRevision: conversationRow.historyRevision, requireApproval: false });
    }
    const count = f.workflows().length, next = await f.admit(f.request("next", head.run.conversationId));
    expect(next).toMatchObject({ run: { responseStatus: "queued", attemptNumber: 0 }, start: { state: "queued", attemptNumber: 0 } });
    expect(f.workflows()).toHaveLength(count); expect(f.db.table("runtimeRuns")[1]).toMatchObject({ executionRequested: true, streamingRequested: true });
    expect(f.db.table("runtimeRunOutbox")[1]).toMatchObject({ state: "pending", runId: next.run.runId });
  });
  it("oversized prefix commits its supported failed disposition and leaves no Workflow/model operation", async () => {
    const f = await fixture();
    const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "bounded-prefix", expectedPreviousVersion: 0,
      definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context, maxContextTokens: 20 } } });
    const result = await f.admit({ ...f.request(), agentId: published.agentId, agentVersion: published.version, parts: [{ type: "text", text: "x".repeat(1000) }] });
    expect(result).toMatchObject({ run: { responseStatus: "failed", failureCode: "CONTEXT_LIMIT_EXCEEDED" }, start: { state: "failed", failureCode: "CONTEXT_LIMIT_EXCEEDED" } });
    expect(f.db.table("runtimeRunOutbox")[0].state).toBe("complete"); expect(f.workflows()).toEqual([]);
    expect(f.db.table("runtimeAgentExecutions")).toEqual([]); expect(f.db.table("runtimeModelOperations")).toEqual([]);
  });
  it.each(["invalid", "cross_scope", "revoked", "unauthenticated", "read_missing", "write_missing", "run_missing"])("%s denies and preserves all prior state", async kind => {
    const f = await fixture();
    if (kind === "revoked") f.grant.revokedAt = Date.now();
    if (kind === "unauthenticated") f.identity(null);
    if (kind.endsWith("_missing")) f.grant.capabilities = (f.grant.capabilities as string[]).filter(capability => capability !== kind.replace("_missing", ""));
    const before = f.snapshot();
    const request = kind === "invalid" ? { ...f.request(), model: "injected" } : f.request();
    await expect(f.admit(request, kind === "cross_scope" ? { tenantId: "foreign", memorySpaceId: "space-a" } : {})).rejects.toThrow();
    expect(f.snapshot()).toEqual(before); expect(f.workflows()).toEqual([]); expect(f.db.table("runtimeRuns")).toEqual([]);
  });
  it("a revoked grant between submit and start cannot leave transcript, budget, outbox or Workflow effects", async () => {
    const f = await fixture(), native = f.db.get.bind(f.db), before = f.snapshot(); let reached = false;
    f.db.get = async (table, id) => {
      const row = await native(table, id);
      // submit's final DB read follows its final authority check. Mutate the
      // actual grant before start's own fresh authority lookup, not a helper mock.
      if (table === "runtimeRuns" && row?.responseStatus === "queued" && !row.executionRequested) {
        reached = true; f.grant.revokedAt = Date.now();
      }
      return row;
    };
    await expect(f.admit()).rejects.toThrow("FORBIDDEN"); expect(reached).toBe(true); expect(f.snapshot()).toEqual(before);
  });
  it("an altered returned identity after native start rolls back the parent including Workflow insertion", async () => {
    const f = await fixture(), before = f.snapshot();
    const reached = afterWorkflow(f, () => { f.db.table("runtimeRuns")[0].definitionHash = "unknown"; });
    // Actual getHandler projects the changed DB row. The final tuple fence
    // catches it after real start/claim/scheduling have already succeeded.
    await expect(f.admit()).rejects.toThrow("TRANSCRIPT_CONFLICT");
    expect(reached.value).toBe(true); expect(f.snapshot()).toEqual(before);
  });
  it("a grant expiring exactly now rejects admission without effects", async () => {
    const f = await fixture(); f.grant.expiresAt = Date.now(); const before = f.snapshot();
    await expect(f.admit()).rejects.toThrow("FORBIDDEN"); expect(f.snapshot()).toEqual(before);
  });
  it.each(["read_missing", "grant_expired", "conversation_expired", "conversation_tombstoned", "run_tombstoned", "conversation_epoch"])(
    "%s after Workflow insertion is freshly denied and rolls back every effect", async kind => {
      const f = await fixture(), before = f.snapshot();
      const reached = afterWorkflow(f, () => {
        if (kind === "read_missing") f.grant.capabilities = (f.grant.capabilities as string[]).filter(cap => cap !== "read");
        if (kind === "grant_expired") f.grant.expiresAt = Date.now();
        if (kind === "conversation_expired") f.db.table("runtimeConversations")[0].retentionUntil = Date.now();
        if (kind === "conversation_tombstoned") f.db.table("runtimeConversations")[0].tombstonedAt = Date.now();
        if (kind === "run_tombstoned") f.db.table("runtimeRuns")[0].tombstonedAt = Date.now();
        if (kind === "conversation_epoch") f.db.table("runtimeConversations")[0].epoch = 2;
      });
      await expect(f.admit()).rejects.toThrow(kind === "conversation_epoch" ? "STALE_TRANSCRIPT" : "FORBIDDEN");
      expect(reached.value).toBe(true); expect(f.snapshot()).toEqual(before);
    });
  it.each(["retired_definition", "changed_definition", "edited_input"])("%s before native claim is denied by the unchanged start/claim bodies", async kind => {
    const f = await fixture(), native = f.db.get.bind(f.db), before = f.snapshot(); let reached = false;
    f.db.get = async (table, id) => {
      const row = await native(table, id);
      if (table === "runtimeRuns" && row?.responseStatus === "queued" && !row.executionRequested) {
        reached = true;
        if (kind === "retired_definition") f.db.table("runtimeAgentDefinitions")[0].revokedAt = Date.now();
        if (kind === "changed_definition") f.db.table("runtimeRuns")[0].definitionHash = "unknown";
        if (kind === "edited_input") {
          const message = f.native.messages.get((row.inputMessageIds as string[])[0])!;
          message.message = { role: "user", content: [{ type: "text", text: "Edited after submit" }] };
        }
      }
      return row;
    };
    await expect(f.admit()).rejects.toThrow(); expect(reached).toBe(true); expect(f.snapshot()).toEqual(before);
    expect(f.workflows()).toEqual([]);
  });
  it.each(["native_save", "native_claim", "workflow_schedule"])("%s failure after native writes rolls back the complete parent", async kind => {
    const f = await fixture(), before = f.snapshot(); let reached = false;
    if (kind === "workflow_schedule") {
      const native = f.ctx.scheduler.runAfter.bind(f.ctx.scheduler);
      f.ctx.scheduler.runAfter = async (delay, ref, ...args) => {
        const result = await native(delay, ref, ...args);
        if (getFunctionName(ref) === "runtimeAgent:executeTurn") {
          reached = true; expect(f.db.table("runtimeAgentExecutions")).toHaveLength(1); expect(f.workflows()).toHaveLength(1);
          throw new Error("INJECTED_NATIVE_FAILURE");
        }
        return result;
      };
    } else {
      const native = f.ctx.runMutation.bind(f.ctx);
      f.ctx.runMutation = async (ref, ...args) => {
        const result = await native(ref, ...args);
        const path = (ref as Partial<Record<symbol, string>>)[Symbol.for("toReferencePath")];
        let name = ""; if (!path) name = getFunctionName(ref);
        if ((kind === "native_save" && path?.endsWith("/addMessages")) || (kind === "native_claim" && name === "runs:claimNext")) {
          reached = true; expect(f.effects.saves).toBe(1);
          expect(f.db.table("runtimeBudgetAccounts").some(row => row.kind === "run")).toBe(true);
          if (kind === "native_claim") expect(f.db.table("runtimeRunAttempts")).toHaveLength(1);
          throw new Error("INJECTED_NATIVE_FAILURE");
        }
        return result;
      };
    }
    await expect(f.admit()).rejects.toThrow("INJECTED_NATIVE_FAILURE"); expect(reached).toBe(true); expect(f.snapshot()).toEqual(before);
  });
  it("legacy submit/start remains compatible with subsequent same-request combined admission", async () => {
    const f = await fixture(), submitted = await f.run(); await f.call(runtime.start, { runId: submitted.runId });
    const result = await f.admit(); expect(result.run.runId).toBe(submitted.runId);
    expect(f.effects.saves).toBe(1); expect(f.workflows()).toHaveLength(1); expect(f.db.table("runtimeAgentExecutions")).toHaveLength(1);
  });
});
