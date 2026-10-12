/** Real scoped repository + domain recall; only the paid embedding port is controlled. */
import { beforeEach, afterEach, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { ActionCtx } from "../../../convex-dev/_generated/server";
import { DEFAULT_EMBEDDING_PROFILE } from "../../../src/domain/profile";
const bindings: unknown[] = [];
const embed = jest.fn(async () => ({ profile: DEFAULT_EMBEDDING_PROFILE, vectors: [Array.from({ length: 1536 }, (_, index) => index === 0 ? 1 : 0)] }));
jest.unstable_mockModule("../../../convex-dev/runtimeMemoryGateway", () => ({ createGatewayMemoryModel: (_ctx: unknown, _repository: unknown, binding: unknown) => {
  bindings.push(binding); return { embed, extract: async () => { throw new Error("Unexpected extraction"); }, resolve: async () => { throw new Error("Unexpected conflict inference"); } };
} }));
jest.unstable_mockModule("@convex-dev/workflow", () => ({ WorkflowManager: class { define(value: unknown) { return value; } } }));
const { transcriptFixture, installIngestionMockRoot, invoke } = await import("../runtimeTranscript/fixture");
const memory = await import("../../../convex-dev/runtimeMemory");
const runtime = await import("../../../convex-dev/runtimeAgent");
const { executeServerTool } = await import("../../../convex-dev/runtimeAgentTools");
beforeEach(() => { installIngestionMockRoot(); bindings.length = 0; embed.mockClear(); });
afterEach(() => { jest.restoreAllMocks(); });
async function setup() {
  const f = await transcriptFixture({ maxContextTokens: 16384 }); await f.run(); f.grant.capabilities = [...f.grant.capabilities as string[], "tool"];
  const source = f.db.table("runtimeMemorySources")[0];
  f.db.seed("facts", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId,
    factId: "tool-fact", fact: "User prefers green tea", factType: "preference", subject: "user", predicate: "prefers", object: "green tea",
    confidence: 90, tags: [], entities: [], relations: [], sourceType: "manual", lineage: source.lineage, extractionPolicyVersion: "controlled-v1",
    version: 1, createdAt: Date.now(), updatedAt: Date.now() });
  const original = f.ctx.runQuery.bind(f.ctx); let afterFacts: (() => void) | undefined;
  const ctx = { ...f.ctx, vectorSearch: async () => [], runQuery: async (reference: unknown, args: unknown) => {
    let name = ""; try { name = getFunctionName(reference as never); } catch { /* Component references retain native routing. */ }
    const registration = name.startsWith("runtimeMemory:") ? memory[name.split(":")[1] as keyof typeof memory]
      : name === "runtimeAgent:checkToolAuthority" ? runtime.checkToolAuthority : undefined;
    const result = registration ? await invoke(registration, f.ctx, args) : await original(reference as never, args as never);
    if (name === "runtimeMemory:readFacts") afterFacts?.(); return result;
  } } as unknown as ActionCtx;
  const check = jest.fn(async () => {});
  const binding = { reference: f.reference, runBudgetId: "shared-run", operationId: "owned-tool", parentOperationId: "model-parent" as never,
    checkCurrent: check, writeSource: jest.fn(async () => { throw new Error("Recall must not write sources"); }), commitDerived: jest.fn(async () => { throw new Error("Recall must not write derived memory"); }) };
  return { f, source, ctx, binding, afterFacts: (fn: () => void) => { afterFacts = fn; } };
}
it("dynamic recall records exact source witnesses and threads the primary native operation into the same run budget", async () => {
  const { source, ctx, binding } = await setup();
  const result = await executeServerTool(ctx, binding, "memory.recall", { text: "preferred drink", limit: 2 });
  expect(result.result).toMatchObject({ context: expect.stringContaining("green tea"), profileId: DEFAULT_EMBEDDING_PROFILE.profileId });
  const lineage = source.lineage as { sourceId: string; sourceEventId: string; sourceRevision: number };
  expect(result.witnesses).toEqual([{ sourceId: lineage.sourceId, sourceEventId: lineage.sourceEventId, sourceRevision: lineage.sourceRevision,
    contentHash: source.contentHash, permissions: ["canViewFacts"] }]);
  expect(bindings).toEqual([{ runBudgetId: "shared-run", parentOperationId: "model-parent" }]); expect(embed).toHaveBeenCalledTimes(1);
  expect(binding.checkCurrent).toHaveBeenCalled(); expect(binding.writeSource).not.toHaveBeenCalled(); expect(binding.commitDerived).not.toHaveBeenCalled();
});
it.each(["revision", "tombstone"])("a %s between the consumed fact read and witness collection withholds context after the single embedding", async kind => {
  const { source, ctx, binding, afterFacts } = await setup();
  afterFacts(() => { if (kind === "revision") source.lineage = { ...(source.lineage as object), sourceRevision: 2 }; else source.tombstonedAt = Date.now(); });
  // Transcript currentness (including a mismatched source revision) is an authority fence.
  await expect(executeServerTool(ctx, binding, "memory.recall", { text: "preferred drink", limit: 2 })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  expect(embed).toHaveBeenCalledTimes(1); expect(binding.writeSource).not.toHaveBeenCalled(); expect(binding.commitDerived).not.toHaveBeenCalled();
});
it("deferred current-attempt denial precedes a secondary model call and repository effects", async () => {
  const { ctx, binding } = await setup(); binding.checkCurrent.mockImplementation(async () => { throw new Error("CANCELLED"); });
  await expect(executeServerTool(ctx, binding, "memory.recall", { text: "preferred drink", limit: 2 })).rejects.toThrow("CANCELLED");
  expect(embed).not.toHaveBeenCalled(); expect(binding.writeSource).not.toHaveBeenCalled();
});
