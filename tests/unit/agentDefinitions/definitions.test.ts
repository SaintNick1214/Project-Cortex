import { beforeEach, afterEach, describe, expect, it, jest } from "@jest/globals";
import { clone, definitions, installMockRoot, transcriptFixture } from "../runtimeTranscript/fixture";
beforeEach(installMockRoot); afterEach(() => { jest.restoreAllMocks(); });
describe("owned executable agent versions (offline native handlers)", () => {
  it("publishes explicit zero-toolSteps policy and returns only safe discovery metadata", async () => {
    const f = await transcriptFixture(); const row = f.db.table("runtimeAgentDefinitions")[0];
    expect(JSON.parse(row.definitionCanonical as string).policies[0].rules.limits.toolSteps).toBe(0);
    expect(row).toMatchObject({ ownerPrincipalId: f.principal._id, version: 1, tenantId: "tenant-a", memorySpaceId: "space-a" });
    const view = await f.call(definitions.get, { memorySpaceId: "space-a", agentId: f.published.agentId, version: 1 });
    expect(JSON.stringify(view)).not.toMatch(/HIDDEN|PROVIDER_SECRET|instructions/);
  });
  it("same publish key/payload reuses exact version; changes conflict without writes", async () => {
    const f = await transcriptFixture(); const before = f.db.writes; const args = { memorySpaceId: "space-a", clientMutationId: "publish-1", expectedPreviousVersion: 0, definitionInput: f.definitionInput };
    expect(await f.call(definitions.publishVersion, args)).toEqual(f.published); expect(f.db.writes).toBe(before);
    await expect(f.call(definitions.publishVersion, { ...args, definitionInput: { ...f.definitionInput, instructions: { text: "changed", promptVersion: "prompt-1" } } })).rejects.toThrow();
    expect(f.db.table("runtimeAgentDefinitions")).toHaveLength(1);
  });
  it("immutable older exact versions remain usable; successor OCC rejects divergent expected version", async () => {
    const f = await transcriptFixture(); const first = clone(f.db.table("runtimeAgentDefinitions")[0]);
    const second = await f.call<{ version: number }>(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "publish-2", agentId: f.published.agentId, expectedPreviousVersion: 1, definitionInput: f.definitionInput });
    expect(second.version).toBe(2); expect(f.db.table("runtimeAgentDefinitions")[0]).toEqual(first);
    expect((await definitions.readCurrentExecutableDefinition(f.ctx, f.reference, { agentId: f.published.agentId, version: 1 }, { capability: "run" })).definitionHash).toBe(f.published.definitionHash);
    await expect(f.call(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "publish-3", agentId: f.published.agentId, expectedPreviousVersion: 1, definitionInput: f.definitionInput })).rejects.toThrow();
    expect(f.db.table("runtimeAgentDefinitions")).toHaveLength(2);
  });
  it.each(["scope", "owner", "tools", "credentials", "override", "negative-tools", "unknown-rule"])("rejects untrusted/widening definition %s", async kind => {
    const f = await transcriptFixture(); const input = clone(f.definitionInput) as Record<string, unknown>;
    if (kind === "scope") input.tenantId = "foreign";
    if (kind === "owner") input.ownerPrincipalId = "foreign";
    if (kind === "credentials") input.credentials = "DO_NOT_SERIALIZE";
    if (kind === "tools") input.tools = [{ toolId: "arbitrary.http", toolVersion: 1, registryHash: await definitions.executableRegistryHash(), requiredCapability: "tool", approval: "none" }];
    if (kind === "override") input.policies = [{ ...f.definitionInput.policies[0], override: { actorPrincipalId: f.principal._id, authorizationId: "claimed", changeRevision: 1 } }];
    if (kind === "negative-tools") input.policies = [{ ...f.definitionInput.policies[0], rules: { limits: { toolSteps: -1 } } }];
    if (kind === "unknown-rule") input.policies = [{ ...f.definitionInput.policies[0], rules: { price: "fake" } }];
    await expect(f.call(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "bad", expectedPreviousVersion: 0, definitionInput: input })).rejects.toThrow();
    expect(f.db.table("runtimeAgentDefinitions")).toHaveLength(1); expect(f.native.threads.size).toBe(0);
  });
  it.each(["registryHash", "handlerVersion", "handlerId"])("requires installed context registry %s", async key => {
    const f = await transcriptFixture(); const context = { ...f.definitionInput.context, [key]: key === "handlerVersion" ? 2 : "unknown" };
    await expect(f.call(definitions.publishVersion, { memorySpaceId: "space-a", clientMutationId: "bad", expectedPreviousVersion: 0, definitionInput: { ...f.definitionInput, context } })).rejects.toThrow();
    expect(f.db.table("runtimeAgentDefinitions")).toHaveLength(1);
  });
  it("discovery registry does not satisfy an executable selector", async () => {
    const f = await transcriptFixture(); f.db.seed("agents", { agentId: "discovery-only" });
    await expect(definitions.readCurrentExecutableDefinition(f.ctx, f.reference, { agentId: "discovery-only", version: 1 }, { capability: "run" })).rejects.toThrow();
    expect(f.native.threads.size).toBe(0);
  });
  it.each(["hash", "canonical", "scope", "owner", "duplicate"])("fails closed on persisted %s corruption", async kind => {
    const f = await transcriptFixture(); const row = f.db.table("runtimeAgentDefinitions")[0];
    if (kind === "hash") row.definitionHash = "b".repeat(64);
    if (kind === "canonical") row.definitionCanonical = "{}";
    if (kind === "scope") row.memorySpaceId = "foreign";
    if (kind === "owner") row.ownerPrincipalId = "foreign";
    if (kind === "duplicate") f.db.seed("runtimeAgentDefinitions", { ...row, _id: "runtimeAgentDefinitions:duplicate" });
    await expect(f.run()).rejects.toThrow(); expect(f.native.threads.size).toBe(0); expect(f.db.table("runtimeRuns")).toHaveLength(0);
  });
  it("revocation is monotone and immediately fences admission without rewriting definition payload", async () => {
    const f = await transcriptFixture(); const original = f.db.table("runtimeAgentDefinitions")[0].definitionCanonical;
    const args = { memorySpaceId: "space-a", agentId: f.published.agentId, version: f.published.version, expectedDefinitionHash: f.published.definitionHash, reason: "withdrawn" };
    await f.call(definitions.revokeVersion, args); const row = f.db.table("runtimeAgentDefinitions")[0];
    expect(row.definitionCanonical).toBe(original); expect(row.revocationReason).toBe("withdrawn");
    await f.call(definitions.revokeVersion, { ...args, reason: "later" }); expect(f.db.table("runtimeAgentDefinitions")[0].revocationReason).toBe("withdrawn");
    await expect(f.run()).rejects.toThrow(); expect(f.db.table("runtimeRuns")).toHaveLength(0); expect(f.native.threads.size).toBe(0);
  });
  it("no JWT/non-admin/foreign selectors cannot publish", async () => {
    const f = await transcriptFixture(); const args = { memorySpaceId: "space-a", clientMutationId: "bad", expectedPreviousVersion: 0, definitionInput: f.definitionInput };
    f.identity(null); await expect(f.call(definitions.publishVersion, args)).rejects.toThrow();
    f.identity({ issuer: "https://host.test", subject: "user-a" }); f.grant.capabilities = ["read", "write", "run"];
    await expect(f.call(definitions.publishVersion, args)).rejects.toThrow();
    await expect(f.call(definitions.publishVersion, { ...args, memorySpaceId: "foreign" })).rejects.toThrow(); expect(f.db.table("runtimeAgentDefinitions")).toHaveLength(1);
  });
});
