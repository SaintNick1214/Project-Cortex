import { describe, expect, it } from "@jest/globals";
import * as governance from "../../../convex-dev/governance";
import { fixture, invoke, policy } from "./fixture";
const publicCalls = [
  ["setPolicy", { policy }], ["setAgentOverride", { memorySpaceId: "space-a", overrides: {} }],
  ["getPolicy", {}], ["getTemplate", { template: "GDPR" }], ["simulate", { options: {} }],
  ["getComplianceReport", {}], ["getEnforcementStats", {}],
] as const;
const registration = (key: string) => (governance as unknown as Record<string, unknown>)[key];
async function createPolicy(f: ReturnType<typeof fixture>) {
  return await invoke<{ policyId: string }>(governance.setPolicy, f.ctx, { policy });
}
describe("seven guarded governance registrations", () => {
  it.each(publicCalls)("%s admits verified admin and produces a scoped policy-only outcome", async (key, args) => {
    const f = fixture(["admin"]); // Admin does not need/read private fact content.
    f.db.seed("facts", { fact: "private data" });
    const result = await invoke<Record<string, unknown>>(registration(key), f.ctx, args);
    if (key === "setPolicy" || key === "setAgentOverride") {
      expect(f.db.table("governancePolicies")).toHaveLength(1);
      expect(f.db.table("governancePolicies")[0]).toMatchObject({ tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.principal._id, appliedBy: f.principal._id });
    } else if (key === "getPolicy" || key === "getTemplate") {
      expect(result).toMatchObject({ organizationId: "tenant-a", memorySpaceId: "space-a" });
    } else {
      expect(result).toMatchObject({ simulation: true, status: "RETENTION_EXECUTION_NOT_IMPLEMENTED", storageFreed: 0 });
    }
    expect(f.db.traces.some((trace) => ["facts", "memories", "runtimeMemorySources"].includes(trace.table))).toBe(false);
  });
  it.each(publicCalls)("%s denies missing identity and performs no writes", async (key, args) => {
    const f = fixture();
    await expect(invoke(registration(key), f.anonymous, args)).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
    expect(f.db.writes).toBe(0);
  });
  it.each(publicCalls)("%s denies mismatched trusted tenant even with forged JWT/admin metadata", async (key, args) => {
    const f = fixture();
    await expect(invoke(registration(key), f.ctx, { ...args, tenantId: "tenant-b" })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.writes).toBe(0);
  });
  it.each(publicCalls)("%s requires admin independently of read/tool/write", async (key, args) => {
    const f = fixture(["read", "tool", "write"]);
    await expect(invoke(registration(key), f.ctx, args)).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });
  it("selects trusted scope before replacing a policy when a foreign row was inserted first", async () => {
    const f = fixture();
    const foreign = f.db.seed("governancePolicies", { tenantId: "tenant-b", organizationId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: "foreign", policy: { private: true }, isActive: true });
    const own = await createPolicy(f);
    const updated = await invoke<{ policyId: string }>(governance.setPolicy, f.ctx, { policy: { ...policy, compliance: { ...policy.compliance, mode: "Custom" } } });
    expect(f.db.table("governancePolicies").find((row) => row._id === foreign._id)?.isActive).toBe(true);
    expect(f.db.table("governancePolicies").find((row) => row._id === own.policyId)?.isActive).toBe(false);
    expect(f.db.table("governancePolicies").find((row) => row._id === updated.policyId)?.policy).toMatchObject({ compliance: { mode: "Custom" } });
    expect(f.db.traces.filter((trace) => trace.table === "governancePolicies").every((trace) => trace.keys.some(([key, value]) => key === "tenantId" && value === "tenant-a"))).toBe(true);
  });
  it("supports omitted tenant-only scope without forcing a concrete space", async () => {
    const f = fixture(["admin"], true);
    const tenantPolicy = { ...policy, memorySpaceId: undefined };
    await invoke(governance.setPolicy, f.ctx, { policy: tenantPolicy });
    expect(await invoke(governance.getPolicy, f.ctx, {})).toMatchObject({ organizationId: "tenant-a" });
    expect(f.db.table("governancePolicies")[0]?.memorySpaceId).toBeUndefined();
  });
  it("denies omitted selectors when trusted scopes are ambiguous", async () => {
    const f = fixture();
    f.db.seed("runtimeAuthScopes", { tenantId: "tenant-a", memorySpaceId: "space-b", epoch: 1 });
    f.db.seed("runtimeAuthGrants", { ...f.grant, _id: "runtimeAuthGrants:other", memorySpaceId: "space-b" });
    await expect(invoke(governance.getPolicy, f.ctx, {})).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
  });
  it.each(["setPolicy", "setAgentOverride", "simulate"])("%s rejects forged nested authority/scope metadata and rolls back", async (key) => {
    const f = fixture();
    const bad = { ...policy, compliance: { ...policy.compliance, principalId: "foreign", tenantId: "tenant-b", role: "admin" } };
    const args = key === "setPolicy" ? { policy: bad } : key === "simulate" ? { options: bad } : { memorySpaceId: "space-a", overrides: bad };
    await expect(f.db.transaction(async () => await invoke(registration(key), f.ctx, args))).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
    expect(f.db.writes).toBe(0); expect(f.db.table("governancePolicies")).toHaveLength(0);
  });
  it("rejects scope mismatch in overrides before touching an org policy", async () => {
    const f = fixture();
    await expect(invoke(governance.setAgentOverride, f.ctx, { memorySpaceId: "space-a", overrides: { organizationId: "tenant-b" } })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.table("governancePolicies")).toHaveLength(0);
  });
  it("current caller may read policy after creator's pinned grant was revoked", async () => {
    const f = fixture(); const created = await createPolicy(f);
    const row = f.db.table("governancePolicies")[0]!;
    row.authority = { ...f.reference, grantId: "runtimeAuthGrants:revoked-creator", grantVersion: 1 };
    expect(await invoke(governance.getPolicy, f.ctx, {})).toMatchObject(policy);
    await expect(invoke(governance.enforce, f.ctx, { policyId: created.policyId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.table("governanceEnforcement")).toHaveLength(0);
  });
  it("internal enforce rechecks stored admin and only commits a simulation audit", async () => {
    const f = fixture(["admin"]); const created = await createPolicy(f);
    const result = await invoke(governance.enforce, f.anonymous, { policyId: created.policyId });
    expect(result).toMatchObject({ simulation: true, recordsPurged: 0, versionsDeleted: 0 });
    expect(f.db.table("governanceEnforcement")[0]).toMatchObject({ policyId: created.policyId, simulation: true, ownerPrincipalId: f.principal._id, authority: f.reference, recordsPurged: 0 });
    expect(await invoke(governance.getEnforcementStats, f.ctx, {})).toMatchObject({ simulations: 1, recordsPurged: 0 });
    expect(await invoke(governance.getComplianceReport, f.ctx, {})).toMatchObject({ simulations: 1, recordsPurged: 0 });
  });
  it("enforce blocks revocation between policy reads and simulation commit with atomic rollback", async () => {
    const f = fixture(); const created = await createPolicy(f);
    let selected = 0;
    f.db.beforeRead = (table) => { if (table === "governancePolicies" && ++selected === 2) f.grant.revokedAt = Date.now(); };
    const before = f.db.writes;
    await expect(f.db.transaction(async () => await invoke(governance.enforce, f.ctx, { policyId: created.policyId }))).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.table("governanceEnforcement")).toHaveLength(0); expect(f.db.writes).toBe(before);
  });
  it("policy/enforcement counts ignore foreign first rows and missing owner rows", async () => {
    const f = fixture(); const created = await createPolicy(f);
    f.db.seed("governanceEnforcement", { tenantId: "tenant-b", memorySpaceId: "space-a", executedAt: Date.now(), simulation: true, recordsPurged: 1000 });
    await invoke(governance.enforce, f.ctx, { policyId: created.policyId });
    expect(await invoke(governance.getComplianceReport, f.ctx, {})).toMatchObject({ simulations: 1, recordsPurged: 0 });
    f.db.table("governancePolicies")[0]!.ownerPrincipalId = undefined;
    expect(await invoke(governance.getPolicy, f.ctx, {})).toMatchObject({ organizationId: "tenant-a", memorySpaceId: "space-a" });
    expect(f.db.table("governancePolicies")[0]!.ownerPrincipalId).toBeUndefined();
  });
});
