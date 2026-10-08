/** Controlled native guards, separate from disposable JWT/browser acceptance. */
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import { transcriptFixture, installIngestionMockRoot } from "../runtimeTranscript/fixture";
const { session } = await import("../../../convex-dev/runtimeClient");
const { defaultProfile } = await import("../../../convex-dev/runtimeMemory");

beforeEach(() => { installIngestionMockRoot(); });
afterEach(() => { jest.restoreAllMocks(); });

test("bootstrap pins verified scope and model-free profile metadata; runs pin their definition", async () => {
  const f = await transcriptFixture({ maxContextTokens: 16384 });
  expect(await f.call(session, {})).toEqual({ version: 1, tenantId: "tenant-a", memorySpaceId: "space-a",
    principalId: f.reference.principalId, userId: "user-a" });
  expect(await f.call(defaultProfile, {})).toMatchObject({ version: 1, profile: {
    profileId: "cortex-text-small-1536-v1", dimensions: 1536, indexName: "by_default_embedding_v1" } });
  const run = await f.run();
  expect(run.scope).toEqual({ tenantId: "tenant-a", memorySpaceId: "space-a" });
  expect(run.definitionHash).toBe(f.published.definitionHash);
});

test("labels cannot select a foreign tenant or space; missing identity cannot bootstrap", async () => {
  const f = await transcriptFixture({ maxContextTokens: 16384 });
  await expect(f.call(session, { tenantId: "tenant-foreign", memorySpaceId: "space-a" })).rejects.toThrow();
  await expect(f.call(defaultProfile, { memorySpaceId: "space-foreign" })).rejects.toThrow();
  const { runs } = await import("../runtimeTranscript/fixture");
  const before = { writes: f.db.writes, budgets: f.effects.budgets, saves: f.effects.saves };
  await expect(f.call(runs.submit, { request: f.request(), tenantId: "tenant-foreign", memorySpaceId: "space-a" })).rejects.toThrow();
  expect({ writes: f.db.writes, budgets: f.effects.budgets, saves: f.effects.saves }).toEqual(before);
  f.identity(null);
  await expect(f.call(session, {})).rejects.toThrow("UNAUTHENTICATED");
  await expect(f.call(defaultProfile, {})).rejects.toThrow("UNAUTHENTICATED");
});

test("revocation immediately denies both bootstrap and default-profile reads", async () => {
  const f = await transcriptFixture({ maxContextTokens: 16384 });
  await f.call(session, {});
  await f.db.patch("runtimeAuthGrants", f.reference.grantId, { revokedAt: Date.now(), version: 2 });
  await expect(f.call(session, {})).rejects.toThrow();
  await expect(f.call(defaultProfile, {})).rejects.toThrow();
});

test("equal external space names across two tenants still select the exact verified definition", async () => {
  const f = await transcriptFixture({ maxContextTokens: 16384 });
  const { definitions } = await import("../runtimeTranscript/fixture");
  const member = f.db.seed("runtimeAuthMemberships", { principalId: f.reference.principalId, tenantId: "tenant-b", version: 1 });
  f.db.seed("runtimeAuthScopes", { tenantId: "tenant-b", epoch: 1 });
  f.db.seed("runtimeAuthScopes", { tenantId: "tenant-b", memorySpaceId: "space-a", epoch: 1 });
  f.db.seed("runtimeAuthGrants", { principalId: f.reference.principalId, membershipId: member._id, tenantId: "tenant-b",
    memorySpaceId: "space-a", tenantEpoch: 1, memorySpaceEpoch: 1, capabilities: ["read", "run"], resourceAccess: "own", version: 1 });
  const selector = { agentId: f.published.agentId, version: f.published.version, memorySpaceId: "space-a" };
  await expect(f.call(definitions.get, selector)).rejects.toThrow();
  expect(await f.call(definitions.get, { ...selector, tenantId: "tenant-a" })).toMatchObject({ definitionHash: f.published.definitionHash });
  await expect(f.call(definitions.get, { ...selector, tenantId: "tenant-b" })).rejects.toThrow();
  expect(await f.call(session, { tenantId: "tenant-b", memorySpaceId: "space-a" })).toMatchObject({ tenantId: "tenant-b", memorySpaceId: "space-a" });
});
