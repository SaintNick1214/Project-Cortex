/** Actual original claim/admission bodies with transactional native peers.
 * Nested control is the former V8 child mutation; no cloud latency/OCC claim. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { getFunctionName, makeFunctionReference } from "convex/server";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import { createAuthorityReader } from "../../../convex-dev/runtimeAuth";
import { assertNativeArgs } from "./native-arguments";

jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start(ctx: MutationCtx, _ref: unknown, args: Record<string, unknown>) {
    return ctx.scheduler.runAfter(0, makeFunctionReference<"mutation">("runtimeAgent:executeTurnV8"), { args });
  }
} }));
const { installMockRoot, transcriptFixture, transcript, runs, invoke, clone, definitions, clock } = await import("../runtimeTranscript/fixture");
let nestedControl = false;
let beforeClaim: ((ctx: MutationCtx) => Promise<void>) | undefined;
let afterClaim: (() => Promise<void>) | undefined;
jest.unstable_mockModule("../../../convex-dev/runs", () => ({ ...runs,
  claimNextV8Handler: async (ctx: MutationCtx, args: Parameters<typeof runs.claimNextV8Handler>[1]) => {
    await beforeClaim?.(ctx);
    const value: Awaited<ReturnType<typeof runs.claimNextV8Handler>> = nestedControl
      ? await ctx.runMutation(makeFunctionReference<"mutation", Parameters<typeof runs.claimNextV8Handler>[1], Awaited<ReturnType<typeof runs.claimNextV8Handler>>>("runs:claimNextV8"), args)
      : await runs.claimNextV8Handler(ctx, args);
    await afterClaim?.();
    return value;
  },
}));
const agent = await import("../../../convex-dev/runtimeAgent");
const client = await import("../../../convex-dev/runtimeClient");
beforeEach(() => { installMockRoot(); nestedControl = false; beforeClaim = undefined; afterClaim = undefined; });
afterEach(() => { jest.restoreAllMocks(); });
async function fixture(options: { strict?: boolean; maxMessages?: number } = {}) {
  const f = await transcriptFixture(), oldMutation = f.ctx.runMutation.bind(f.ctx), calls: string[] = [];
  f.ctx.runMutation = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { return oldMutation(ref, args); }
    const value = name.startsWith("runs:") ? runs[name.split(":")[1] as keyof typeof runs]
      : name.startsWith("runtimeAgent:") ? agent[name.split(":")[1] as keyof typeof agent] : undefined;
    if (!value) return oldMutation(ref, args);
    calls.push(name); assertNativeArgs(value, args);
    return f.transaction(() => invoke(value, f.ctx, args));
  }) as MutationCtx["runMutation"];
  const published = await f.call<{ agentId: string; version: number }>(definitions.publishVersion, {
    memorySpaceId: "space-a", clientMutationId: "native-claim-v8", expectedPreviousVersion: 0,
    definitionInput: { ...f.definitionInput, context: { ...f.definitionInput.context,
      handlerId: "cortex.transcript.relevant", handlerVersion: 1, registryHash: await definitions.executableRegistryHashV3(),
      memoryMode: options.strict ? "strict" : "indexed-plus-pending", inputSelection: { version: 1, recentMessages: 4,
        relevantMemories: 4, relevantFacts: 4, pendingEntries: 4, maxMessages: options.maxMessages ?? 16 } } },
  });
  const request = (key = "claim-input", conversationId?: string) => ({ ...f.request(key, conversationId), agentId: published.agentId, agentVersion: published.version });
  const admit = async (input = request()) => f.call<Awaited<ReturnType<typeof client.submitAndStartEnvelopeHandler>>>(client.submitAndStartEnvelope, { request: input });
  const state = () => clone({ rows: f.db.rows, writes: f.db.writes, sequence: f.db.sequence, native: f.native, effects: f.effects, scheduled: f.scheduled });
  const restore = (old: ReturnType<typeof state>) => {
    f.db.rows = clone(old.rows); f.db.writes = old.writes; f.db.sequence = old.sequence;
    Object.assign(f.native, clone(old.native)); Object.assign(f.effects, old.effects);
    f.scheduled.splice(0, f.scheduled.length, ...clone(old.scheduled));
  };
  return { ...f, get grant() { return f.grant; }, request, admit, state, restore, calls };
}
it.each([false, true])("ordinary/strict=%s V8 composition preserves the nested result/effects, one claim and replay", async strict => {
  const f = await fixture({ strict }), before = f.state(); nestedControl = true;
  const expected = await f.admit(), effects = f.state(); expect(f.calls).toContain("runs:claimNextV8");
  f.restore(before); f.calls.length = 0; nestedControl = false;
  expect(await f.admit()).toEqual(expected); expect(f.state()).toEqual(effects);
  expect(f.calls).not.toContain("runs:claimNextV8");
  expect(f.db.table("runtimeRunAttempts")).toHaveLength(1); expect(f.db.table("runtimeAgentExecutions")).toHaveLength(1);
  expect(f.db.table("runtimeRunOutbox")[0]).toMatchObject({ state: "claimed", leaseVersion: 1, leaseExpiresAt: clock + 300_000 });
  expect(f.scheduled.filter(row => row.name === (strict ? "runtimeAgent:executeTurnV8" : "runtimeAgent:executeDirectV8"))).toHaveLength(1);
  const committed = f.state(); nestedControl = true;
  const replay = await f.admit(), replayEffects = f.state(); f.restore(committed); nestedControl = false;
  // Original start rewrites executionRequested on replay. Preserve that write,
  // while proving the same durable rows and exactly one claim/dispatch remain.
  expect(await f.admit()).toEqual(replay); expect(f.state()).toEqual(replayEffects);
  expect(f.db.writes).toBe(committed.writes + 1);
  expect(f.effects.saves).toBe(1); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  expect(await f.call(runs.claimNextV8, { reference: f.reference, conversationId: expected.admission.run.conversationId })).toBeNull();
});
it("a later queued request cannot claim or schedule its earlier head under another identity", async () => {
  const f = await fixture(), head = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: f.request("head") });
  const next = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: f.request("next", head.conversationId) });
  const before = f.state();
  for (const control of [true, false]) {
    nestedControl = control;
    await expect(f.call(agent.start, { runId: next.runId })).rejects.toThrow("QUEUE_NOT_READY"); expect(f.state()).toEqual(before);
  }
  await f.call(agent.start, { runId: head.runId });
  expect(await f.call(agent.start, { runId: next.runId })).toMatchObject({ state: "queued", attemptNumber: 0 });
  expect(f.db.table("runtimeRunAttempts")).toHaveLength(1);
});
it("approval remains required and claim succeeds only after the original approval mutation", async () => {
  const f = await fixture(), conversation = await f.call<{ conversationId: string }>(transcript.create, { memorySpaceId: "space-a", clientRequestId: "approval", requireApproval: true });
  const request = f.request("approval", conversation.conversationId), waiting = await f.admit(request);
  expect(waiting.admission).toMatchObject({ run: { responseStatus: "waiting_approval", attemptNumber: 0 }, start: { state: "queued" } });
  expect(f.db.table("runtimeRunAttempts")).toHaveLength(0);
  await f.call(runs.approve, { runId: waiting.admission.run.runId, expectedDefinitionHash: waiting.admission.run.definitionHash });
  expect(await f.call(agent.start, { runId: waiting.admission.run.runId })).toMatchObject({ state: "ready", attemptNumber: 1 });
  expect(f.db.table("runtimeRunAttempts")).toHaveLength(1); expect(f.scheduled.filter(row => row.name === "runtimeAgent:executeDirectV8")).toHaveLength(1);
});
it("oversized selected prefix retains the same committed terminal disposition and no execution", async () => {
  const f = await fixture({ maxMessages: 1 }), conversation = await f.call<{ conversationId: string }>(transcript.create, { memorySpaceId: "space-a", clientRequestId: "overflow" });
  let row = f.db.table("runtimeConversations")[0]!;
  await f.call(transcript.setPolicy, { conversationId: conversation.conversationId, expectedRevision: row.historyRevision, manualWriteLocked: false });
  row = f.db.table("runtimeConversations")[0]!;
  await f.call(transcript.append, { conversationId: conversation.conversationId, expectedRevision: row.historyRevision, role: "user", parts: [{ type: "text", text: "Earlier canonical input" }] });
  const request = f.request("overflow", conversation.conversationId), before = f.state(); nestedControl = true;
  const expected = await f.admit(request), effects = f.state(); f.restore(before); nestedControl = false;
  expect(await f.admit(request)).toEqual(expected); expect(f.state()).toEqual(effects);
  expect(expected.admission).toMatchObject({ run: { responseStatus: "failed", failureCode: "CONTEXT_LIMIT_EXCEEDED" }, start: { state: "failed", failureCode: "CONTEXT_LIMIT_EXCEEDED" } });
  expect(f.db.table("runtimeRunOutbox")[0]).toMatchObject({ state: "complete" });
  expect(f.db.table("runtimeAgentExecutions")).toHaveLength(0); expect(f.db.table("runtimeRunAttempts")).toHaveLength(0);
  expect(f.db.table("runtimeBudgetAccounts").find(value => value.kind === "run")).toMatchObject({ cancelled: true });
});
it.each(["grant", "definition", "canonical-bridge", "outbox-lease"])("%s writer inside the native claim interval invalidates raw rows and rolls back on refusal", async fault => {
  const f = await fixture(), before = f.state(); let reached = 0;
  beforeClaim = async ctx => {
    reached++; expect(await createAuthorityReader(ctx).getGrant(f.reference.grantId)).toMatchObject({ revokedAt: undefined });
    if (fault === "grant") await ctx.db.patch("runtimeAuthGrants", f.grant._id as never, { revokedAt: clock });
    if (fault === "definition") {
      const row = f.db.table("runtimeAgentDefinitions").find(value => value.agentId === f.request().agentId)!;
      await ctx.db.patch("runtimeAgentDefinitions", row._id as never, { revokedAt: clock });
    }
    if (fault === "outbox-lease") await ctx.db.patch("runtimeRunOutbox", f.db.table("runtimeRunOutbox")[0]!._id as never, { state: "claimed", leaseVersion: 2 });
    if (fault === "canonical-bridge") await ctx.db.patch("runtimeTranscriptMessages", f.db.table("runtimeTranscriptMessages")[0]!._id as never, { contentHash: "f".repeat(64) });
  };
  for (const control of [true, false]) {
    nestedControl = control; await expect(f.admit()).rejects.toThrow(); expect(f.state()).toEqual(before);
  }
  expect(reached).toBe(2); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it.each(["after-claim", "dispatch-schedule"])("%s opaque failure rolls back claim, input, budget, outbox and schedules exactly as nested control", async phase => {
  const f = await fixture(), before = f.state(), failure = Error("ORIGINAL_NATIVE_FAILURE"); let reached = 0;
  if (phase === "after-claim") afterClaim = async () => { reached++; expect(f.db.table("runtimeRunAttempts")).toHaveLength(1); throw failure; };
  if (phase === "dispatch-schedule") {
    const schedule = f.ctx.scheduler.runAfter.bind(f.ctx.scheduler);
    f.ctx.scheduler.runAfter = async (delay, ref, ...args) => { const result = await schedule(delay, ref, ...args);
      if (getFunctionName(ref) === "runtimeAgent:executeDirectV8") { reached++; throw failure; } return result; };
  }
  for (const control of [true, false]) {
    nestedControl = control; await expect(f.admit()).rejects.toBe(failure); expect(f.state()).toEqual(before);
  }
  expect(reached).toBe(2);
});
it("the exposed native claim retains exact lease validation and current definition refusal", async () => {
  const f = await fixture(), run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: f.request() }), before = f.state();
  await expect(f.call(runs.claimNextV8, { reference: f.reference, conversationId: run.conversationId, leaseMs: 300001 })).rejects.toThrow("INVALID_INPUT");
  expect(f.state()).toEqual(before);
  const definition = f.db.table("runtimeAgentDefinitions").find(value => value.agentId === run.agentId)!; definition.revokedAt = clock;
  await expect(f.call(runs.claimNextV8, { reference: f.reference, conversationId: run.conversationId, leaseMs: 300000 })).rejects.toThrow();
  expect(f.db.table("runtimeRunAttempts")).toHaveLength(0);
});

it("managed input remains manually locked while its approved original V8 claim can proceed", async () => {
  const f = await fixture(), run = await f.call<ReturnType<typeof runs.publicRun>>(runs.submit, { request: f.request() });
  const conversation = f.db.table("runtimeConversations")[0]!, before = f.state();
  expect(conversation.manualWriteLocked).toBe(true);
  await expect(f.call(transcript.append, { conversationId: run.conversationId, expectedRevision: conversation.historyRevision,
    role: "user", parts: [{ type: "text", text: "Unapproved manual input" }] })).rejects.toThrow("TRANSCRIPT_LOCKED");
  expect(f.state()).toEqual(before);
  expect(await f.call(agent.start, { runId: run.runId })).toMatchObject({ state: "ready", attemptNumber: 1 });
  expect(f.db.table("runtimeTranscriptMessages")).toHaveLength(1); expect(f.db.table("runtimeRunAttempts")).toHaveLength(1);
});
