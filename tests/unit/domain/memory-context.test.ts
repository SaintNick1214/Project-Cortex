import { describe, expect, it } from "@jest/globals";
import { contiguousWatermark, contextSourceKey, evaluateMemoryBarrier, planPendingContext } from "../../../src/domain/memory-context";
import type { PendingContextSource } from "../../../src/domain/memory-context";
import { semanticHash } from "../../../src/domain/profile";

const scope = { tenantId: "tenant-context", memorySpaceId: "space-context" };
async function source(sequence: number, text: string, revision = 1, event = `event-${sequence}`): Promise<PendingContextSource> {
  return { ...scope, ownerPrincipalId: "owner", sequence, createdAt: sequence,
    lineage: { sourceId: `source-${event}`, sourceEventId: event, sourceRevision: revision, role: "user", trust: "user_assertion" },
    content: text, contentHash: await semanticHash(text) };
}
describe("captured scoped memory freshness", () => {
  it("reversed completion cannot cross an earlier failed or pending event", () => {
    expect(contiguousWatermark([{ sequence: 3, state: "complete" }, { sequence: 1, state: "failed" }, { sequence: 2, state: "complete" }], 3))
      .toMatchObject({ indexedThrough: 0, complete: false, hole: { sequence: 1, state: "failed" } });
    expect(contiguousWatermark([{ sequence: 2, state: "complete" }, { sequence: 1, state: "pending" }], 2))
      .toMatchObject({ indexedThrough: 0, complete: false, hole: { sequence: 1, state: "pending" } });
  });
  it("explicit skips permit progress while a missing sequence remains a hole", () => {
    expect(contiguousWatermark([{ sequence: 1, state: "skipped" }, { sequence: 2, state: "complete" }], 2))
      .toMatchObject({ indexedThrough: 2, complete: true, hole: null });
    expect(contiguousWatermark([{ sequence: 3, state: "complete" }], 3, 1))
      .toMatchObject({ indexedThrough: 1, complete: false, hole: { sequence: 2, state: "missing" } });
    expect(contiguousWatermark([], 2, 4)).toMatchObject({ indexedThrough: 4, complete: true });
  });
  it("conflicting duplicate sequence records are rejected", () => {
    expect(() => contiguousWatermark([{ sequence: 1, state: "complete" }, { sequence: 1, state: "pending" }], 1)).toThrow("CONTEXT_INCOMPLETE");
  });
  it("history dedup keeps a newer revision and captured chronology, excluding future events", async () => {
    const old = await source(1, "I prefer coffee.", 1, "preference");
    const changed = await source(3, "I now prefer jasmine.", 2, "preference");
    const other = await source(2, "The meeting is tomorrow."); const future = await source(4, "Future input.");
    const plan = await planPendingContext({ scope, cutoff: 3, sources: [changed, old, future, other, changed],
      alreadyRepresented: [contextSourceKey(scope, old.lineage)], maxSources: 32, maxBytes: 16_384 });
    expect(plan.completeness).toBe("complete");
    expect(plan.sources.map(s => s.sourceEventId)).toEqual(["event-2", "preference"]);
    expect(plan.text).toContain("I now prefer jasmine."); expect(plan.text).not.toContain("coffee"); expect(plan.text).not.toContain("Future input.");
  });
  it("assistant and tool context retain their provenance instead of becoming user assertions", async () => {
    const assistant = await source(1, "Maybe the user prefers black tea.");
    assistant.lineage = { ...assistant.lineage, role: "assistant", trust: "assistant_claim" };
    const tool = await source(2, "The verified record says jasmine.");
    tool.lineage = { ...tool.lineage, role: "tool", trust: "verified_tool_evidence", operationId: "completed-tool" };
    const plan = await planPendingContext({ scope, cutoff: 2, sources: [tool, assistant], alreadyRepresented: [], maxSources: 32, maxBytes: 16_384 });
    expect(plan.text).toContain('"trust":"assistant_claim"'); expect(plan.text).toContain('"trust":"verified_tool_evidence"');
    expect(plan.text).not.toContain('"trust":"user_assertion"');
  });
  it("tail overflow withholds the whole required tail and explicitly reports incompleteness", async () => {
    const a = await source(1, "First pending update."); const b = await source(2, "Second pending update.");
    const byCount = await planPendingContext({ scope, cutoff: 2, sources: [a, b], alreadyRepresented: [], maxSources: 1, maxBytes: 16_384 });
    expect(byCount).toEqual({ completeness: "incomplete", reason: "CONTEXT_OVERFLOW", text: "", sources: [], sourceKeys: [], withheldCount: 2 });
    const byBytes = await planPendingContext({ scope, cutoff: 2, sources: [a], alreadyRepresented: [], maxSources: 32, maxBytes: 10 });
    expect(byBytes).toMatchObject({ completeness: "incomplete", reason: "CONTEXT_OVERFLOW", text: "", sources: [] });
  });
  it("cross-scope, changed bytes and tombstoned sources cannot enter pending context", async () => {
    const a = await source(1, "Scoped pending text.");
    const args = { scope, cutoff: 1, alreadyRepresented: [], maxSources: 32, maxBytes: 16_384 };
    await expect(planPendingContext({ ...args, sources: [{ ...a, memorySpaceId: "foreign" }] })).rejects.toThrow("CONTEXT_INCOMPLETE");
    await expect(planPendingContext({ ...args, sources: [{ ...a, content: "Changed after capture." }] })).rejects.toThrow("CONTEXT_INCOMPLETE");
    await expect(planPendingContext({ ...args, sources: [{ ...a, tombstonedAt: 1 }] })).rejects.toThrow("CONTEXT_INCOMPLETE");
  });
  it("barriers wait only for requested stages, stop on holes, and enforce their deadline", () => {
    const pending = contiguousWatermark([{ sequence: 1, state: "pending" }], 1);
    const complete = contiguousWatermark([{ sequence: 1, state: "complete" }], 1);
    const args = { cutoff: 1, requiredStages: ["facts" as const], progress: { facts: complete, vectors: pending }, startedAt: 100, deadlineMs: 10, now: 105, onFailure: "fail" as const };
    expect(evaluateMemoryBarrier(args)).toEqual({ state: "ready", remainingMs: 5 });
    expect(evaluateMemoryBarrier({ ...args, requiredStages: ["vectors"] })).toEqual({ state: "waiting", remainingMs: 5 });
    expect(evaluateMemoryBarrier({ ...args, requiredStages: ["vectors"], now: 110 })).toEqual({ state: "failed", failureCode: "MEMORY_BARRIER_TIMEOUT", remainingMs: 0 });
    expect(evaluateMemoryBarrier({ ...args, progress: { facts: contiguousWatermark([{ sequence: 1, state: "failed" }], 1) } }))
      .toMatchObject({ state: "failed", failureCode: "MEMORY_STAGE_FAILED" });
    expect(evaluateMemoryBarrier({ ...args, requiredStages: ["graph"], onFailure: "incomplete" }))
      .toMatchObject({ state: "incomplete", failureCode: "CAPABILITY_UNAVAILABLE" });
  });
});
