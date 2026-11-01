/** Actual executable-definition and native policy handlers; synthetic storage only. */
import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { semanticHash } from "../../../src/domain/profile";
const { transcriptFixture, installIngestionMockRoot, currentMockRootSelection, definitions, ledger } = await import("../runtimeTranscript/fixture");
const bootstrap = await import("../../../convex-dev/runtimeModelPolicyBootstrap");
beforeEach(() => installIngestionMockRoot()); afterEach(() => { jest.restoreAllMocks(); });
async function fixture(encoding: "full" | "compact") {
  const f = await transcriptFixture({ maxContextTokens: 16384 }), selection = currentMockRootSelection();
  const manifest = bootstrap.lookupDeploymentManifest(selection.manifestId, selection.expectedRevision)!;
  const canonical = canonicalModelJson(manifest), full = { manifestId: manifest.manifestId, revision: manifest.revision, canonical,
    hash: await semanticHash(canonical), artifactRevision: manifest.artifactRevision, evidenceHash: manifest.evidenceHash, acceptanceHash: manifest.acceptanceHash };
  const { canonical: _canonical, ...fields } = full, compact = { encoding: "compiled-root-v1", ...fields };
  for (const table of ["runtimeModelPolicies", "runtimeModelQualifications"]) for (const row of f.db.table(table)) row.root = encoding === "full" ? full : compact;
  const read = () => definitions.readCurrentExecutableDefinition(f.ctx, f.reference, { agentId: f.published.agentId, version: f.published.version }, { capability: "run" });
  const snapshot = () => canonicalModelJson({ rows: [...f.db.rows].filter(([, rows]) => rows.length), writes: f.db.writes, effects: f.effects });
  return { ...f, get grant() { return f.grant; }, full, compact, read, snapshot };
}
it.each(["full", "compact"] as const)("%s supports legitimate fresh owned executable specialization without storage effects", async encoding => {
  const f = await fixture(encoding), before = f.snapshot();
  expect(await f.read()).toMatchObject({ definitionHash: f.published.definitionHash, definition: { agentId: f.published.agentId, agentVersion: f.published.version } });
  expect(f.snapshot()).toBe(before);
  await expect(definitions.readCurrentExecutableDefinition(f.ctx, f.reference, { agentId: f.published.agentId, version: f.published.version + 1 }, { capability: "run" })).rejects.toThrow();
  expect(f.snapshot()).toBe(before);
});
it.each(["full", "compact"] as const)("%s accepts only exact compiled equivalence for a mixed tenant policy, preserving narrowing", async encoding => {
  const f = await fixture(encoding), grant = f.db.seed("runtimeAuthGrants", { principalId: f.reference.principalId, membershipId: f.reference.membershipId,
    tenantId: f.reference.tenantId, tenantEpoch: f.reference.tenantEpoch, capabilities: ["admin"], resourceAccess: "tenant", version: 1 });
  const reference = { principalId: f.reference.principalId, principalVersion: f.reference.principalVersion, membershipId: f.reference.membershipId,
    membershipVersion: f.reference.membershipVersion, grantId: grant._id, grantVersion: 1, tenantId: f.reference.tenantId, tenantEpoch: f.reference.tenantEpoch };
  await f.call(ledger.provisionTenantPolicy, { reference, policyCanonical: canonicalModelJson({ policyId: "compact-tenant-narrowing", version: 1,
    scope: "tenant", tenantId: reference.tenantId, rules: { limits: { outputTokens: 1 } } }) });
  const row = f.db.table("runtimeModelPolicies").find(row => row.scope === "tenant")!; row.root = encoding === "full" ? f.compact : f.full;
  const before = f.snapshot(); expect(await f.read()).toMatchObject({ definitionHash: f.published.definitionHash }); expect(f.snapshot()).toBe(before);
  (row.root as Record<string, unknown>).acceptanceHash = "b".repeat(64); const malformed = f.snapshot();
  await expect(f.read()).rejects.toMatchObject({ data: { code: "POLICY_DENIED" } }); expect(f.snapshot()).toBe(malformed);
});
it.each(["full", "compact"] as const)("%s bad provenance/current generation denies with the original error class and no effects", async encoding => {
  for (const fault of ["hash", "extra", "encoding", "revoked", "conflicting-duplicate", "actor-revoked"] as const) {
    const f = await fixture(encoding), policy = f.db.table("runtimeModelPolicies")[0], stored = policy.root as Record<string, unknown>;
    if (fault === "hash") stored.hash = "b".repeat(64);
    if (fault === "extra") stored.extraProof = "caller-controlled";
    if (fault === "encoding") stored.encoding = "unsupported-v2";
    if (fault === "revoked") policy.revokedAt = Date.now();
    if (fault === "conflicting-duplicate") f.db.seed("runtimeModelPolicies", { ...policy, _id: "runtimeModelPolicies:conflicting-root", root: { ...stored, manifestId: "untrusted-other" } });
    if (fault === "actor-revoked") f.grant.revokedAt = Date.now();
    const before = f.snapshot(), code = fault === "revoked" || fault === "conflicting-duplicate" ? "CAPABILITY_UNAVAILABLE" : fault === "actor-revoked" ? "FORBIDDEN" : "POLICY_DENIED";
    await expect(f.read()).rejects.toMatchObject({ data: { code } }); expect(f.snapshot()).toBe(before);
  }
});
