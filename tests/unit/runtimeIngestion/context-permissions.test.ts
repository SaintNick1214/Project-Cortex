/** Native permission fences with controlled storage; no paid/service-success claim. */
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { ContextSourcePermission } from "../../../src/domain/context-witness";
import { mergeContextWitness } from "../../../src/domain/context-witness";
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class {
  define(input: { handler: unknown }) { return { _handler: input.handler }; }
  async start() { return "controlled-workflow"; }
  async cancel() { /* Controlled no-op. */ }
  async sendEvent() { /* Controlled no-op. */ }
} }));
const { ingestionFixture, installIngestionMockRoot, invoke } = await import("./fixture");
const runtime = await import("../../../convex-dev/runtimeAgent");
const runs = await import("../../../convex-dev/runs");
const shares = await import("../../../convex-dev/conversationShares");
const memory = await import("../../../convex-dev/runtimeMemory");
const { guardAgentRunBudget } = await import("../../../convex-dev/runtimeAgentFence");
beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });

test.each<ContextSourcePermission>(["canViewFacts", "canViewMemories"])("cached %s requires that data right after a separate viewing share remains", async permission => {
  const f = await ingestionFixture(); const query = f.ctx.runQuery.bind(f.ctx), mutation = f.ctx.runMutation.bind(f.ctx);
  const route = (name: string) => name === "runs:claimNext" ? runs.claimNext
    : name.startsWith("runtimeAgent:") ? runtime[name.split(":")[1] as keyof typeof runtime] : undefined;
  f.ctx.runQuery = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { /* Component route. */ }
    const registration = route(name); return registration ? await invoke(registration, f.ctx, args) : await query(ref, args);
  }) as typeof f.ctx.runQuery;
  f.ctx.runMutation = (async (ref, args) => {
    let name = ""; try { name = getFunctionName(ref); } catch { /* Component route. */ }
    const registration = route(name); return registration ? await invoke(registration, f.ctx, args) : await mutation(ref, args);
  }) as typeof f.ctx.runMutation;
  const origin = await f.run("private-source");
  const source = f.db.table("runtimeMemorySources")[0];
  const lineage = source.lineage as { sourceId: string; sourceEventId: string; sourceRevision: number };
  const reader = f.db.seed("runtimeAuthPrincipals", { issuer: "https://host.test", subject: "reader", actorKind: "user", version: 1 });
  const member = f.db.seed("runtimeAuthMemberships", { principalId: reader._id, tenantId: f.reference.tenantId, version: 1 });
  const grant = f.db.seed("runtimeAuthGrants", { principalId: reader._id, membershipId: member._id, tenantId: f.reference.tenantId,
    memorySpaceId: f.reference.memorySpaceId, tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ["read", "write", "run"], resourceAccess: "space", version: 1 });
  const reference = { ...f.reference, principalId: reader._id, membershipId: member._id, grantId: grant._id };
  const base = { conversationId: origin.conversationId, grantedBy: "user-a", grantType: "user", grantedTo: reader._id };
  const view = { canView: true, canViewFacts: false, canViewMemories: false, canContinue: false, canFork: false, canExport: false };
  const data = await f.call<{ shareId: string }>(shares.create, { ...base, permissions: { ...view, [permission]: true } });
  await f.call(shares.create, { ...base, permissions: view }); f.identity({ issuer: "https://host.test", subject: "reader" });
  const run = await f.run("reader-run"); await f.call(runtime.start, { runId: run.runId });
  const row = f.db.table("runtimeRuns").find(item => item.runId === run.runId)!;
  const execution = f.db.table("runtimeAgentExecutions").find(item => item.runId === run.runId)!;
  const args = { reference, runId: run.runId, attemptNumber: row.attemptNumber, leaseVersion: execution.leaseVersion };
  const witness = { sourceId: lineage.sourceId, sourceEventId: lineage.sourceEventId, sourceRevision: lineage.sourceRevision,
    contentHash: source.contentHash as string, permissions: [permission] };
  await f.call(runtime.saveContext, { ...args, context: "Authorized cached evidence", witnesses: [witness], completeness: "complete" });
  await guardAgentRunBudget(f.ctx, reference, row.runAccountId as never);
  expect(await f.call(runtime.observe, { runId: run.runId })).toBeDefined();
  f.identity({ issuer: "https://host.test", subject: "user-a" }); await f.call(shares.revoke, { shareId: data.shareId });
  f.identity({ issuer: "https://host.test", subject: "reader" });
  expect(await f.call(memory.readSource, { reference, capability: "read", sourceId: lineage.sourceId })).toBeDefined();
  await expect(guardAgentRunBudget(f.ctx, reference, row.runAccountId as never)).rejects.toThrow();
  await expect(f.call(runtime.observe, { runId: run.runId })).rejects.toThrow();
  await expect(f.call(runtime.beginOperation, { ...args, kind: "model", ordinal: 0, requestCanonical: "{}" })).rejects.toThrow();
  expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});

test("combining fact and vector context preserves both rights and exact source revision", () => {
  const source = { sourceId: "source", sourceEventId: "event", sourceRevision: 1, contentHash: "hash" };
  const fact = { ...source, permissions: ["canViewFacts" as const] };
  expect(mergeContextWitness(fact, { ...source, permissions: ["canViewMemories"] })?.permissions).toEqual(["canViewFacts", "canViewMemories"]);
  expect(mergeContextWitness(fact, { ...source, sourceRevision: 2, permissions: ["canViewMemories"] })).toBeNull();
  expect(mergeContextWitness(undefined, source)?.permissions).toEqual(["canViewFacts", "canViewMemories"]);
});
