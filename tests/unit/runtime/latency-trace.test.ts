import { afterEach, expect, it, jest } from "@jest/globals";
import { createHash } from "node:crypto";
import { traceRuntimeMutationSpan, traceRuntimePhase } from "../../../convex-dev/runtimeLatencyTrace";
import type { RuntimeLatencyMetadata } from "../../../convex-dev/runtimeLatencyTrace";
// The installed runtime environment is the same one applied around real handlers.
import { setupEnvironment } from "../../../node_modules/@convex-dev/workflow/dist/client/environment.js";

const initial = process.env.CORTEX_RUNTIME_LATENCY_TRACE;
afterEach(() => {
  if (initial === undefined) delete process.env.CORTEX_RUNTIME_LATENCY_TRACE;
  else process.env.CORTEX_RUNTIME_LATENCY_TRACE = initial;
  jest.restoreAllMocks();
});
it.each([undefined, "0", "true"])("tracing is disabled without the exact opt-in flag %s", flag => {
  if (flag === undefined) delete process.env.CORTEX_RUNTIME_LATENCY_TRACE;
  else process.env.CORTEX_RUNTIME_LATENCY_TRACE = flag;
  const output = jest.spyOn(console, "log").mockImplementation(() => {});
  traceRuntimePhase("private caller request", 1, "model.begin", { semanticId: "secret request namespace" });
  expect(output).not.toHaveBeenCalled();
});
it("keeps known opaque run/account joins while hashing caller semantic correlation and excluding extra secret fields", () => {
  process.env.CORTEX_RUNTIME_LATENCY_TRACE = "1";
  const output = jest.spyOn(console, "log").mockImplementation(() => {});
  const runId = `run:${"a".repeat(64)}`, runBudgetId = "b".repeat(64);
  const semanticId = 'embedding.query:["caller-request-secret","private-namespace"]';
  const metadata = { runBudgetId, semanticId, operationKey: "embedding.query", durationMs: 14, bytes: 42, status: 200,
    apiKey: "sk-sensitive-provider-secret", prompt: "private prompt", body: { text: "private output" } };
  traceRuntimePhase(runId, 1, "ledger.resolve.end", metadata);
  expect(output).toHaveBeenCalledTimes(1);
  const serialized = output.mock.calls[0][0] as string;
  expect(JSON.parse(serialized)).toEqual({ runId, attemptNumber: 1, phase: "ledger.resolve.end", at: expect.any(Number), runBudgetId,
    semanticId: `sha256:${createHash("sha256").update(semanticId).digest("hex")}`, operationKey: "embedding.query", durationMs: 14, bytes: 42, status: 200 });
  for (const secret of [semanticId, "caller-request-secret", "private-namespace", metadata.apiKey, metadata.prompt, metadata.body.text]) expect(serialized).not.toContain(secret);
});
it("hashes nonopaque run/account correlation synchronously and keeps deterministic joins", () => {
  process.env.CORTEX_RUNTIME_LATENCY_TRACE = "1";
  const output = jest.spyOn(console, "log").mockImplementation(() => {});
  const id = "caller-selected-run-key/private-value", budget = "caller-selected-budget-key", semantic = "cortex/private-request";
  const metadata: RuntimeLatencyMetadata = { runBudgetId: budget, semanticId: semantic };
  expect(traceRuntimePhase(id, 2, "claim.begin", metadata)).toBeUndefined();
  traceRuntimePhase(id, 2, "claim.end", metadata);
  const first = JSON.parse(output.mock.calls[0][0] as string) as { runId: string; runBudgetId: string; semanticId: string };
  const second = JSON.parse(output.mock.calls[1][0] as string) as typeof first;
  for (const [field, value] of Object.entries({ runId: id, runBudgetId: budget, semanticId: semantic })) {
    expect(first[field as keyof typeof first]).toBe(`sha256:${createHash("sha256").update(value).digest("hex")}`);
    expect(second[field as keyof typeof first]).toBe(first[field as keyof typeof first]);
    expect(output.mock.calls[0][0]).not.toContain(value);
  }
});
it("defaults tracing off in the actual Workflow0.4.8 deterministic environment and reaches the next product step", () => {
  process.env.CORTEX_RUNTIME_LATENCY_TRACE = "1";
  const output = jest.spyOn(console, "log").mockImplementation(() => {});
  const originalProcess = process;
  let absentProcess = false, nextStepReached = false, failure: unknown;
  const restore = setupEnvironment(() => ({ now: 1234, latest: true }), "latency-workflow-regression");
  try {
    absentProcess = typeof process === "undefined";
    traceRuntimePhase(`run:${"a".repeat(64)}`, 1, "barrier.begin");
    nextStepReached = true;
  } catch (error) { failure = error; }
  finally { restore(); }
  expect(absentProcess).toBe(true); expect(failure).toBeUndefined(); expect(nextStepReached).toBe(true);
  expect(process).toBe(originalProcess); expect(output).not.toHaveBeenCalled();
  traceRuntimePhase(`run:${"a".repeat(64)}`, 1, "context.indexed-probe.begin");
  expect(output).toHaveBeenCalledTimes(1);
});
it("does not swallow errors from native trace dependencies when tracing is enabled", () => {
  process.env.CORTEX_RUNTIME_LATENCY_TRACE = "1";
  const denied = new Error("TRACE_OUTPUT_FAILURE");
  jest.spyOn(console, "log").mockImplementation(() => { throw denied; });
  expect(() => traceRuntimePhase(`run:${"a".repeat(64)}`, 1, "context.indexed-probe.begin")).toThrow(denied);
});

async function withClock<T>(clock: PropertyDescriptor, execute: () => Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(globalThis, "performance")!;
  Object.defineProperty(globalThis, "performance", { configurable: true, ...clock });
  try { return await execute(); } finally { Object.defineProperty(globalThis, "performance", original); }
}
const run = `run:${"c".repeat(64)}`;
it.each([undefined, "0", "true"])("mutation spans with opt-in %s never access a clock and preserve the callback result", async flag => {
  if (flag === undefined) delete process.env.CORTEX_RUNTIME_LATENCY_TRACE;
  else process.env.CORTEX_RUNTIME_LATENCY_TRACE = flag;
  const clock = jest.fn(() => { throw new Error("DISABLED_CLOCK_ACCESS"); }), output = jest.spyOn(console, "log").mockImplementation(() => {});
  const result = { retained: "private callback payload" }, execute = jest.fn(async () => result);
  await withClock({ get: clock }, async () => { expect(await traceRuntimeMutationSpan(run, 1, "admission.submit", execute)).toBe(result); });
  expect(execute).toHaveBeenCalledTimes(1); expect(clock).not.toHaveBeenCalled(); expect(output).not.toHaveBeenCalled();
});
it("mutation spans skip clocks and logs when Workflow removes process, without swallowing the original error", async () => {
  process.env.CORTEX_RUNTIME_LATENCY_TRACE = "1";
  const output = jest.spyOn(console, "log").mockImplementation(() => {}), failure = new Error("ORIGINAL_CALLBACK_FAILURE");
  const clock = jest.fn(() => { throw new Error("ABSENT_PROCESS_CLOCK_ACCESS"); }), execute = jest.fn(async () => { throw failure; });
  await withClock({ get: clock }, async () => {
    const restore = setupEnvironment(() => ({ now: 1234, latest: true }), "latency-mutation-span-process-regression");
    let caught: unknown;
    try { await traceRuntimeMutationSpan(run, 1, "admission.start", execute); } catch (error) { caught = error; } finally { restore(); }
    expect(caught).toBe(failure);
  });
  expect(execute).toHaveBeenCalledTimes(1); expect(clock).not.toHaveBeenCalled(); expect(output).not.toHaveBeenCalled();
});
it("mutation spans measure only their original callback with an advancing performance clock and fixed Date.now", async () => {
  process.env.CORTEX_RUNTIME_LATENCY_TRACE = "1"; jest.spyOn(Date, "now").mockReturnValue(1234);
  const order: string[] = [], now = jest.fn(() => { order.push("clock"); return order.length === 2 ? 40 : 47.25; });
  const output = jest.spyOn(console, "log").mockImplementation(value => { order.push(JSON.parse(value as string).phase); });
  const result = { private: "not trace metadata" }, execute = jest.fn(async () => { order.push("original callback"); return result; });
  await withClock({ value: { now } }, async () => { expect(await traceRuntimeMutationSpan(run, 2, "admission.get", execute)).toBe(result); });
  expect(order).toEqual(["admission.get.begin", "clock", "original callback", "clock", "admission.get.end"]);
  expect(execute).toHaveBeenCalledTimes(1); expect(now).toHaveBeenCalledTimes(2);
  expect(output.mock.calls.map(([value]) => JSON.parse(value as string))).toEqual([
    { runId: run, attemptNumber: 2, phase: "admission.get.begin", at: 1234 },
    { runId: run, attemptNumber: 2, phase: "admission.get.end", at: 1234, durationMs: 7.25 },
  ]);
  expect(output.mock.calls.flat().join()).not.toContain(result.private);
});
it.each(["absent", "throwing", "nonfinite_start", "nonfinite_end", "regressing", "overflow"])("mutation clock %s remains unavailable rather than reporting zero", async kind => {
  process.env.CORTEX_RUNTIME_LATENCY_TRACE = "1";
  const output = jest.spyOn(console, "log").mockImplementation(() => {}), execute = jest.fn(async () => "retained");
  const values = kind === "nonfinite_start" ? [Number.NaN] : kind === "nonfinite_end" ? [5, Number.POSITIVE_INFINITY]
    : kind === "overflow" ? [-Number.MAX_VALUE, Number.MAX_VALUE] : [5, 4];
  const now = jest.fn(() => { if (kind === "throwing") throw new Error("CLOCK_UNAVAILABLE"); return values.shift(); });
  await withClock({ value: kind === "absent" ? undefined : { now } }, async () => {
    expect(await traceRuntimeMutationSpan(run, 1, "admission.start", execute)).toBe("retained");
  });
  expect(execute).toHaveBeenCalledTimes(1);
  expect(output.mock.calls.map(([value]) => JSON.parse(value as string))).toEqual([
    { runId: run, attemptNumber: 1, phase: "admission.start.begin", at: expect.any(Number) },
    { runId: run, attemptNumber: 1, phase: "admission.start.end", at: expect.any(Number) },
  ]);
});
it("mutation spans rethrow the identical callback rejection and record its bounded failure duration without the error content", async () => {
  process.env.CORTEX_RUNTIME_LATENCY_TRACE = "1";
  const output = jest.spyOn(console, "log").mockImplementation(() => {}), failure = new Error("PRIVATE_FAILURE_CONTENT");
  const execute = jest.fn(async () => { throw failure; }), values = [20, 24.5];
  await withClock({ value: { now: () => values.shift() } }, async () => {
    await expect(traceRuntimeMutationSpan(run, 1, "admission.start", execute)).rejects.toBe(failure);
  });
  expect(execute).toHaveBeenCalledTimes(1);
  expect(JSON.parse(output.mock.calls[1][0] as string)).toEqual({ runId: run, attemptNumber: 1, phase: "admission.start.failed", at: expect.any(Number), durationMs: 4.5 });
  expect(output.mock.calls.flat().join()).not.toContain(failure.message);
});
it.each(["begin", "end", "failed"])("enabled mutation %s trace-output failure still propagates", async stage => {
  process.env.CORTEX_RUNTIME_LATENCY_TRACE = "1";
  const failure = new Error("TRACE_OUTPUT_FAILURE"), original = new Error("ORIGINAL_CALLBACK_FAILURE");
  const execute = jest.fn(async () => { if (stage === "failed") throw original; return "value"; });
  const output = jest.spyOn(console, "log").mockImplementation(value => { if (JSON.parse(value as string).phase.endsWith(`.${stage}`)) throw failure; });
  await expect(traceRuntimeMutationSpan(run, 1, "admission.submit", execute)).rejects.toBe(failure);
  expect(execute).toHaveBeenCalledTimes(stage === "begin" ? 0 : 1);
  expect(output).toHaveBeenCalledTimes(stage === "begin" ? 1 : 2);
});
it("turning tracing off during the callback prevents any later clock read", async () => {
  process.env.CORTEX_RUNTIME_LATENCY_TRACE = "1";
  const output = jest.spyOn(console, "log").mockImplementation(() => {}), now = jest.fn(() => 10);
  await withClock({ value: { now } }, async () => {
    expect(await traceRuntimeMutationSpan(run, 1, "admission.get", async () => { delete process.env.CORTEX_RUNTIME_LATENCY_TRACE; return "retained"; })).toBe("retained");
  });
  expect(now).toHaveBeenCalledTimes(1); expect(output).toHaveBeenCalledTimes(1);
});
