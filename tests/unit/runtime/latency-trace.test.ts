import { afterEach, expect, it, jest } from "@jest/globals";
import { createHash } from "node:crypto";
import { traceRuntimePhase } from "../../../convex-dev/runtimeLatencyTrace";
import type { RuntimeLatencyMetadata } from "../../../convex-dev/runtimeLatencyTrace";

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
