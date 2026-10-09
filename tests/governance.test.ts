/** Current scoped governance contract. Historical global policy/deletion catalog
 * remains visibly archived; client validation and actual supported operations stay active. */
import { Cortex } from "../src";
import type { GovernancePolicy, ComplianceTemplate } from "../src/types";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { createRuntimeFixture } from "./helpers/runtime-fixture";
import { createTestRunContext } from "./helpers/isolation";

describe("Governance current public contract", () => {
  const run = createTestRunContext();
  const tenantId = run.runId, memorySpaceId = run.memorySpaceId("governance");
  let fixture: Awaited<ReturnType<typeof createRuntimeFixture>>;
  let cortex: Cortex;
  let fallback: Awaited<ReturnType<typeof createRuntimeFixture>>;
  const scope = { organizationId: tenantId, memorySpaceId };
  beforeAll(async () => {
    fixture = await createRuntimeFixture(tenantId, memorySpaceId, run.userId("owner"));
    cortex = fixture.cortex;
    fallback = await createRuntimeFixture(tenantId + "-fallback", memorySpaceId + "-fallback", run.userId("fallback-owner"));
  });
  afterAll(async () => { await fixture?.close(); await fallback?.close(); });

  it.each<ComplianceTemplate>(["GDPR", "HIPAA", "SOC2", "FINRA"])("returns the %s template qualified to the persisted grant", async name => {
    expect(await cortex.governance.getTemplate(name)).toMatchObject({ ...scope, compliance: { mode: name } });
  });
  it("stores and replaces a scoped policy through the genuine public registration", async () => {
    const policy = await cortex.governance.getTemplate("GDPR");
    const first = await cortex.governance.setPolicy(policy);
    expect(first).toMatchObject({ success: true, scope });
    expect(first.policyId).toEqual(expect.any(String));
    const changed = { ...policy, conversations: { ...policy.conversations, retention: { ...policy.conversations.retention, deleteAfter: "8y" } } };
    await cortex.governance.setPolicy(changed);
    expect(await cortex.governance.getPolicy(scope)).toEqual(changed);
    expect((await fixture.ownedRows("governancePolicies")).filter(row => (row as {isActive:boolean}).isActive)).toHaveLength(1);
  });
  it("applies the owned space override and preserves explicit policy scope", async () => {
    await cortex.governance.setAgentOverride(memorySpaceId, { compliance: { mode: "SOC2", dataRetentionYears: 9, requireJustification: [], auditLogging: true } });
    expect(await cortex.governance.getPolicy(scope)).toMatchObject({ ...scope, compliance: { mode: "SOC2", dataRetentionYears: 9 } });
  });
  it("returns a real scoped simulation with no deletion effects", async () => {
    const before = await fixture.ownedRows("governanceEnforcement");
    const policy = await cortex.governance.getTemplate("GDPR");
    expect(await cortex.governance.simulate({ ...policy, conversations: { ...policy.conversations, retention: { ...policy.conversations.retention, deleteAfter: "30d" } } }))
      .toMatchObject({ simulation: true, estimated: false, scope, status: "RETENTION_EXECUTION_NOT_IMPLEMENTED", recordsAffected: 0, versionsAffected: 0, storageFreed: 0 });
    expect(await fixture.ownedRows("governanceEnforcement")).toEqual(before);
  });
  it("refuses direct SDK enforcement before dispatch and preserves policies/logs", async () => {
    const before = { policies: await fixture.ownedRows("governancePolicies"), logs: await fixture.ownedRows("governanceEnforcement") };
    await expect(cortex.governance.enforce({ scope, layers: ["vector"], rules: ["retention"] }))
      .rejects.toMatchObject({ code: "BACKEND_ENFORCEMENT_ONLY", retryable: false, outcome: "not_dispatched" });
    expect({ policies: await fixture.ownedRows("governancePolicies"), logs: await fixture.ownedRows("governanceEnforcement") }).toEqual(before);
  });
  it("reports actual simulation-only compliance without fabricated deletion counts", async () => {
    const end = new Date();
    expect(await cortex.governance.getComplianceReport({ ...scope, period: { start: new Date(0), end } }))
      .toMatchObject({ ...scope, simulation: true, status: "RETENTION_EXECUTION_NOT_IMPLEMENTED", recordsPurged: 0, versionsDeleted: 0, storageFreed: 0 });
    for (const period of ["7d", "30d", "90d", "1y"] as const)
      expect(await cortex.governance.getEnforcementStats({ ...scope, period }))
        .toMatchObject({ simulation: true, status: "RETENTION_EXECUTION_NOT_IMPLEMENTED", recordsPurged: 0, versionsDeleted: 0, storageFreed: 0, costSavings: 0 });
  });
  it("rejects undeclared space/foreign tenant policy access and mutation without effects", async () => {
    const before = await fixture.ownedRows("governancePolicies");
    const policy = await cortex.governance.getTemplate("GDPR");
    await expect(cortex.governance.getPolicy({ ...scope, memorySpaceId: memorySpaceId + "-foreign" })).rejects.toMatchObject({ data: { code: "FORBIDDEN", outcome: "not_dispatched" } });
    await expect(cortex.governance.setPolicy({ ...policy, organizationId: tenantId + "-foreign" })).rejects.toMatchObject({ data: { code: "FORBIDDEN", outcome: "not_dispatched" } });
    expect(await fixture.ownedRows("governancePolicies")).toEqual(before);
  });
  it("does not confer public governance authority on an ordinary ungranted client", async () => {
    const publicClient = new ConvexHttpClient(process.env.CONVEX_URL!, { logger: false });
    const before = await fixture.ownedRows("governancePolicies");
    await expect(publicClient.query(makeFunctionReference<"query">("governance:getTemplate"), { template: "GDPR", tenantId, scope }))
      .rejects.toMatchObject({ data: { code: "UNAUTHENTICATED", outcome: "not_dispatched" } });
    expect(await fixture.ownedRows("governancePolicies")).toEqual(before);
  });

  describe("Client-Side Validation", () => {
    describe("setPolicy validation", () => {
      it("should throw on missing scope", async () => {
        const policy = {
          // Missing organizationId and memorySpaceId
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow(
          "Policy must specify either organizationId or memorySpaceId",
        );
      });

      it("should throw on invalid period format", async () => {
        const policy: GovernancePolicy = {
          organizationId: tenantId,
          conversations: {
            retention: {
              deleteAfter: "7years" as any, // Invalid format
              purgeOnUserRequest: true,
            },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR",
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(cortex.governance.setPolicy(policy)).rejects.toThrow(
          "Invalid period format",
        );
      });

      it("should throw on overlapping importance ranges", async () => {
        const policy: GovernancePolicy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: {
              defaultVersions: 10,
              byImportance: [
                { range: [0, 50], versions: 5 },
                { range: [40, 80], versions: 10 }, // Overlaps with previous
              ],
            },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR",
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(cortex.governance.setPolicy(policy)).rejects.toThrow(
          "overlaps with range",
        );
      });

      it("should throw on invalid version count", async () => {
        const policy: GovernancePolicy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: {
              defaultVersions: -5, // Invalid: must be >= -1
              byType: {},
            },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR",
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(cortex.governance.setPolicy(policy)).rejects.toThrow(
          "must be >= -1",
        );
      });

      it("should throw on invalid importance range bounds", async () => {
        const policy: GovernancePolicy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: {
              defaultVersions: 10,
              byImportance: [
                { range: [0, 150], versions: 5 }, // Max > 100
              ],
            },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR",
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(cortex.governance.setPolicy(policy)).rejects.toThrow(
          "must be between 0 and 100",
        );
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // Missing Required Field Tests
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

      it("should throw when conversations field is missing", async () => {
        const policy = {
          organizationId: tenantId,
          // conversations missing
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow("must include conversations configuration");
      });

      it("should throw when immutable field is missing", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          // immutable missing
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow("must include immutable configuration");
      });

      it("should throw when mutable field is missing", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          // mutable missing
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow("must include mutable configuration");
      });

      it("should throw when vector field is missing", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          // vector missing
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow("must include vector configuration");
      });

      it("should throw when compliance field is missing", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          // compliance missing
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow("must include compliance configuration");
      });

      it("should throw when conversations.retention is missing", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            // retention missing
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow("must include retention configuration");
      });

      it("should throw when conversations.purging is missing", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            // purging missing
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow("must include purging configuration");
      });

      it("should throw when immutable.retention is missing", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            // retention missing
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow("must include retention configuration");
      });

      it("should throw when immutable.purging is missing", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            // purging missing
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow("must include purging configuration");
      });

      it("should throw when mutable.retention is missing", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            // retention missing
            purging: { autoDelete: false },
          },
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow("must include retention configuration");
      });

      it("should throw when mutable.purging is missing", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            // purging missing
          },
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow("must include purging configuration");
      });

      it("should throw when vector.retention is missing", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            // retention missing
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow("must include retention configuration");
      });

      it("should throw when vector.purging is missing", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            // purging missing
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow("must include purging configuration");
      });

      it("should succeed with both organizationId and memorySpaceId", async () => {
        const policy: GovernancePolicy = {
          organizationId: tenantId,
          memorySpaceId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR",
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        // Should not throw - both scopes provided is valid
        const result = await cortex.governance.setPolicy(policy);
        expect(result.success).toBe(true);
      });

      it("should handle policy with all optional fields undefined", async () => {
        const policy: GovernancePolicy = {
          organizationId: tenantId,
          conversations: {
            retention: {
              deleteAfter: "7y",
              // archiveAfter omitted (optional)
              purgeOnUserRequest: true,
            },
            purging: {
              autoDelete: true,
              // deleteInactiveAfter omitted (optional)
            },
          },
          immutable: {
            retention: {
              defaultVersions: 10,
              byType: {},
            },
            purging: {
              autoCleanupVersions: true,
              // purgeUnusedAfter omitted (optional)
            },
          },
          mutable: {
            retention: {
              // defaultTTL omitted (optional)
              // purgeInactiveAfter omitted (optional)
            },
            purging: {
              autoDelete: false,
              // deleteUnaccessedAfter omitted (optional)
            },
          },
          vector: {
            retention: {
              defaultVersions: 5,
              byImportance: [],
              // bySourceType omitted (optional)
            },
            purging: {
              autoCleanupVersions: true,
              deleteOrphaned: false,
            },
          },
          compliance: {
            mode: "Custom",
            dataRetentionYears: 5,
            requireJustification: [],
            auditLogging: false,
          },
        };

        // Should succeed with all optional fields omitted
        const result = await cortex.governance.setPolicy(policy);
        expect(result.success).toBe(true);
        expect(result.policyId).toBeDefined();
      });

      it("should throw when policy is null", async () => {
        await expect(cortex.governance.setPolicy(null as any)).rejects.toThrow(
          /Policy is required|Cannot read/,
        );
      });

      it("should throw when policy is undefined", async () => {
        await expect(
          cortex.governance.setPolicy(undefined as any),
        ).rejects.toThrow(/Policy is required|Cannot read/);
      });
    });

    describe("enforce validation", () => {
      it("should throw when scope is missing", async () => {
        await expect(
          cortex.governance.enforce({
            layers: ["vector"],
            rules: ["retention"],
            // Missing scope
          } as any),
        ).rejects.toThrow("Enforcement requires a scope");
      });

      it("should throw when scope is empty", async () => {
        await expect(
          cortex.governance.enforce({
            scope: {}, // Empty scope
          }),
        ).rejects.toThrow(
          "must include either organizationId or memorySpaceId",
        );
      });

      it("should throw on invalid layer names", async () => {
        await expect(
          cortex.governance.enforce({
            scope: { organizationId: tenantId },
            layers: ["invalid-layer" as any],
          }),
        ).rejects.toThrow("Invalid layer");
      });

      it("should throw on invalid rule names", async () => {
        await expect(
          cortex.governance.enforce({
            scope: { organizationId: tenantId },
            rules: ["invalid-rule" as any],
          }),
        ).rejects.toThrow("Invalid rule");
      });

      it("should throw on empty layers array", async () => {
        await expect(
          cortex.governance.enforce({
            scope: { organizationId: tenantId },
            layers: [],
          }),
        ).rejects.toThrow("Layers array cannot be empty");
      });

      it("should throw on empty rules array", async () => {
        await expect(
          cortex.governance.enforce({
            scope: { organizationId: tenantId },
            rules: [],
          }),
        ).rejects.toThrow("Rules array cannot be empty");
      });
    });

    describe("getComplianceReport validation", () => {
      it("should throw when start date is after end date", async () => {
        const now = Date.now();
        const yesterday = now - 24 * 60 * 60 * 1000;

        await expect(
          cortex.governance.getComplianceReport({
            organizationId: tenantId,
            period: {
              start: new Date(now),
              end: new Date(yesterday),
            },
          }),
        ).rejects.toThrow("Start date must be before end date");
      });

      it("should throw on invalid start date", async () => {
        await expect(
          cortex.governance.getComplianceReport({
            organizationId: tenantId,
            period: {
              start: "invalid" as any,
              end: new Date(),
            },
          }),
        ).rejects.toThrow("Start date must be a valid Date object");
      });

      it("should throw on invalid end date", async () => {
        const yesterday = Date.now() - 24 * 60 * 60 * 1000;
        await expect(
          cortex.governance.getComplianceReport({
            organizationId: tenantId,
            period: {
              start: new Date(yesterday),
              end: null as any,
            },
          }),
        ).rejects.toThrow("End date must be a valid Date object");
      });
    });

    describe("getEnforcementStats validation", () => {
      it("should throw on invalid period format", async () => {
        await expect(
          cortex.governance.getEnforcementStats({
            period: "60d", // Invalid: not in allowed list
            organizationId: tenantId,
          }),
        ).rejects.toThrow("Invalid period");
      });

      it("should accept valid period formats", async () => {
        const validPeriods = ["7d", "30d", "90d", "1y"];

        for (const period of validPeriods) {
          // Should not throw
          const stats = await cortex.governance.getEnforcementStats({
            period,
            organizationId: tenantId,
          });
          expect(stats).toBeDefined();
        }
      });
    });

    describe("setAgentOverride validation", () => {
      it("should throw when memorySpaceId is empty", async () => {
        await expect(
          cortex.governance.setAgentOverride("", {
            vector: {
              retention: { defaultVersions: 10, byImportance: [] },
              purging: { autoCleanupVersions: true, deleteOrphaned: true },
            },
          }),
        ).rejects.toThrow("memorySpaceId is required and cannot be empty");
      });

      it("should throw when memorySpaceId is only whitespace", async () => {
        await expect(
          cortex.governance.setAgentOverride("   ", {
            vector: {
              retention: { defaultVersions: 10, byImportance: [] },
              purging: { autoCleanupVersions: true, deleteOrphaned: true },
            },
          }),
        ).rejects.toThrow("memorySpaceId is required and cannot be empty");
      });

      it("should throw on invalid period in override", async () => {
        await expect(
          cortex.governance.setAgentOverride(memorySpaceId, {
            conversations: {
              retention: {
                deleteAfter: "invalid-period" as any,
                purgeOnUserRequest: true,
              },
              purging: { autoDelete: true },
            },
          }),
        ).rejects.toThrow("Invalid period format");
      });

      it("should throw on invalid version count in override", async () => {
        await expect(
          cortex.governance.setAgentOverride(memorySpaceId, {
            vector: {
              retention: {
                defaultVersions: -5, // Invalid: must be >= -1
                byImportance: [],
              },
              purging: { autoCleanupVersions: true, deleteOrphaned: true },
            },
          }),
        ).rejects.toThrow("must be >= -1");
      });

      it("should throw on invalid immutable version count in override", async () => {
        await expect(
          cortex.governance.setAgentOverride(memorySpaceId, {
            immutable: {
              retention: {
                defaultVersions: -10, // Invalid: must be >= -1
                byType: {},
              },
              purging: { autoCleanupVersions: true },
            },
          }),
        ).rejects.toThrow("must be >= -1");
      });

      it("should throw on overlapping importance ranges in override", async () => {
        await expect(
          cortex.governance.setAgentOverride(memorySpaceId, {
            vector: {
              retention: {
                defaultVersions: 10,
                byImportance: [
                  { range: [0, 50], versions: 5 },
                  { range: [40, 80], versions: 10 }, // Overlaps with previous
                ],
              },
              purging: { autoCleanupVersions: true, deleteOrphaned: true },
            },
          }),
        ).rejects.toThrow("overlaps with range");
      });

      it("should throw on invalid importance range bounds in override", async () => {
        await expect(
          cortex.governance.setAgentOverride(memorySpaceId, {
            vector: {
              retention: {
                defaultVersions: 10,
                byImportance: [
                  { range: [0, 150], versions: 5 }, // Max > 100
                ],
              },
              purging: { autoCleanupVersions: true, deleteOrphaned: true },
            },
          }),
        ).rejects.toThrow("must be between 0 and 100");
      });

      it("should throw on negative importance range minimum in override", async () => {
        await expect(
          cortex.governance.setAgentOverride(memorySpaceId, {
            vector: {
              retention: {
                defaultVersions: 10,
                byImportance: [
                  { range: [-10, 50], versions: 5 }, // Min < 0
                ],
              },
              purging: { autoCleanupVersions: true, deleteOrphaned: true },
            },
          }),
        ).rejects.toThrow("must be between 0 and 100");
      });

      it("should throw on range where min >= max in override", async () => {
        await expect(
          cortex.governance.setAgentOverride(memorySpaceId, {
            vector: {
              retention: {
                defaultVersions: 10,
                byImportance: [
                  { range: [50, 50], versions: 5 }, // min === max
                ],
              },
              purging: { autoCleanupVersions: true, deleteOrphaned: true },
            },
          }),
        ).rejects.toThrow("min < max");
      });
    });

    describe("simulate validation", () => {
      it("should throw on invalid period format in simulation", async () => {
        await expect(
          cortex.governance.simulate({
            organizationId: tenantId,
            conversations: {
              retention: {
                deleteAfter: "bad-format" as any,
                purgeOnUserRequest: true,
              },
              purging: { autoDelete: true },
            },
          }),
        ).rejects.toThrow("Invalid period format");
      });

      it("should throw on invalid version count in simulation", async () => {
        await expect(
          cortex.governance.simulate({
            organizationId: tenantId,
            vector: {
              retention: { defaultVersions: -10, byImportance: [] },
              purging: { autoCleanupVersions: true, deleteOrphaned: true },
            },
          }),
        ).rejects.toThrow("must be >= -1");
      });

      it("should throw on invalid immutable version count in simulation", async () => {
        await expect(
          cortex.governance.simulate({
            organizationId: tenantId,
            immutable: {
              retention: {
                defaultVersions: -5, // Invalid: must be >= -1
                byType: {},
              },
              purging: { autoCleanupVersions: true },
            },
          }),
        ).rejects.toThrow("must be >= -1");
      });

      it("should throw on overlapping importance ranges in simulation", async () => {
        await expect(
          cortex.governance.simulate({
            organizationId: tenantId,
            vector: {
              retention: {
                defaultVersions: 10,
                byImportance: [
                  { range: [0, 60], versions: 5 },
                  { range: [50, 100], versions: 10 }, // Overlaps with previous
                ],
              },
              purging: { autoCleanupVersions: true, deleteOrphaned: true },
            },
          }),
        ).rejects.toThrow("overlaps with range");
      });

      it("should throw on invalid importance range bounds in simulation", async () => {
        await expect(
          cortex.governance.simulate({
            organizationId: tenantId,
            vector: {
              retention: {
                defaultVersions: 10,
                byImportance: [
                  { range: [0, 200], versions: 5 }, // Max > 100
                ],
              },
              purging: { autoCleanupVersions: true, deleteOrphaned: true },
            },
          }),
        ).rejects.toThrow("must be between 0 and 100");
      });

      it("should throw on negative importance range minimum in simulation", async () => {
        await expect(
          cortex.governance.simulate({
            organizationId: tenantId,
            vector: {
              retention: {
                defaultVersions: 10,
                byImportance: [
                  { range: [-5, 50], versions: 5 }, // Min < 0
                ],
              },
              purging: { autoCleanupVersions: true, deleteOrphaned: true },
            },
          }),
        ).rejects.toThrow("must be between 0 and 100");
      });

      it("should throw on range where min >= max in simulation", async () => {
        await expect(
          cortex.governance.simulate({
            organizationId: tenantId,
            vector: {
              retention: {
                defaultVersions: 10,
                byImportance: [
                  { range: [70, 30], versions: 5 }, // min > max
                ],
              },
              purging: { autoCleanupVersions: true, deleteOrphaned: true },
            },
          }),
        ).rejects.toThrow("min < max");
      });

      it("should throw on non-number version count in importance range", async () => {
        await expect(
          cortex.governance.simulate({
            organizationId: tenantId,
            vector: {
              retention: {
                defaultVersions: 10,
                byImportance: [
                  { range: [0, 50], versions: "five" as any }, // Non-number versions
                ],
              },
              purging: { autoCleanupVersions: true, deleteOrphaned: true },
            },
          }),
        ).rejects.toThrow("number");
      });
    });

    describe("getTemplate validation", () => {
      it("should throw on invalid template name", async () => {
        await expect(
          cortex.governance.getTemplate("INVALID" as any),
        ).rejects.toThrow("Invalid compliance template");
      });
    });

    describe("getPolicy validation", () => {
      it("should throw on empty organizationId", async () => {
        await expect(
          cortex.governance.getPolicy({
            organizationId: "",
          }),
        ).rejects.toThrow(
          "must include either organizationId or memorySpaceId",
        );
      });

      it("should throw on empty memorySpaceId", async () => {
        await expect(
          cortex.governance.getPolicy({
            memorySpaceId: "   ",
          }),
        ).rejects.toThrow(
          "must include either organizationId or memorySpaceId",
        );
      });
    });

    describe("getPolicy fallback behavior", () => {
      it("returns the default GDPR policy within a genuinely granted scope with no persisted policy", async () => {
        expect(await fallback.cortex.governance.getPolicy({ organizationId: fallback.tenantId, memorySpaceId: fallback.memorySpaceId }))
          .toMatchObject({ organizationId: fallback.tenantId, memorySpaceId: fallback.memorySpaceId, compliance: { mode: "GDPR" } });
      });
      it("binds an empty policy selector to the sole persisted grant", async () => {
        expect(await fallback.cortex.governance.getPolicy())
          .toMatchObject({ organizationId: fallback.tenantId, memorySpaceId: fallback.memorySpaceId, compliance: { mode: "GDPR" } });
      });
      it("keeps policy state independent across two explicitly owned tenants/scopes", async () => {
        const first = await cortex.governance.getTemplate("SOC2");
        await cortex.governance.setPolicy(first);
        expect(await cortex.governance.getPolicy(scope)).toEqual(first);
        expect(await fallback.cortex.governance.getPolicy())
          .toMatchObject({ organizationId: fallback.tenantId, memorySpaceId: fallback.memorySpaceId, compliance: { mode: "GDPR" } });
      });
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Additional Validation Edge Cases
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    describe("validateImportanceRanges edge cases", () => {
      it("should accept touching but non-overlapping ranges", async () => {
        const policy: GovernancePolicy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: {
              defaultVersions: 10,
              byImportance: [
                { range: [0, 50], versions: 5 },
                { range: [51, 100], versions: 10 }, // Touching but not overlapping
              ],
            },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR",
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        // Should succeed - touching ranges are valid
        const result = await cortex.governance.setPolicy(policy);
        expect(result.success).toBe(true);
      });

      it("should accept empty importance ranges array", async () => {
        const policy: GovernancePolicy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: {
              defaultVersions: 10,
              byImportance: [], // Empty array is valid
            },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR",
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        // Should succeed - empty array is valid boundary case
        const result = await cortex.governance.setPolicy(policy);
        expect(result.success).toBe(true);
      });

      it("should throw when importance ranges is not an array", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: {
              defaultVersions: 10,
              byImportance: "not-an-array" as any, // Invalid: not an array
            },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow(/array/i);
      });

      it("should throw when range tuple is malformed", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: {
              defaultVersions: 10,
              byImportance: [
                { range: [0], versions: 5 }, // Invalid: tuple needs 2 elements
              ],
            },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow(/tuple|min, max/i);
      });

      it("should throw when range values are non-numeric", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: { defaultVersions: 10, byType: {} },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: {
              defaultVersions: 10,
              byImportance: [
                { range: ["zero", "fifty"] as any, versions: 5 }, // Non-numeric
              ],
            },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow(/number/i);
      });
    });

    describe("validateVersionCount edge cases", () => {
      it("should throw when version count is a string", async () => {
        const policy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: {
              defaultVersions: "ten" as any, // Invalid: string instead of number
              byType: {},
            },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: { defaultVersions: 5, byImportance: [] },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR" as const,
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        await expect(
          cortex.governance.setPolicy(policy as any),
        ).rejects.toThrow(/must be a number/i);
      });

      it("should accept version count of -1 (unlimited)", async () => {
        const policy: GovernancePolicy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: {
              defaultVersions: -1, // Unlimited
              byType: {},
            },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: {
              defaultVersions: -1, // Unlimited
              byImportance: [],
            },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR",
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        // Should succeed - -1 is valid (unlimited)
        const result = await cortex.governance.setPolicy(policy);
        expect(result.success).toBe(true);
      });

      it("rejects zero native retention versions without modifying persisted policies", async () => {
        const policy: GovernancePolicy = {
          organizationId: tenantId,
          conversations: {
            retention: { deleteAfter: "7y", purgeOnUserRequest: true },
            purging: { autoDelete: true },
          },
          immutable: {
            retention: {
              defaultVersions: 0, // Zero versions
              byType: {},
            },
            purging: { autoCleanupVersions: true },
          },
          mutable: {
            retention: {},
            purging: { autoDelete: false },
          },
          vector: {
            retention: {
              defaultVersions: 0,
              byImportance: [],
            },
            purging: { autoCleanupVersions: true, deleteOrphaned: true },
          },
          compliance: {
            mode: "GDPR",
            dataRetentionYears: 7,
            requireJustification: [],
            auditLogging: true,
          },
        };

        const before = await fixture.ownedRows("governancePolicies");
        await expect(cortex.governance.setPolicy(policy)).rejects.toMatchObject({ data: { code: "INVALID_INPUT", outcome: "not_dispatched" } });
        expect(await fixture.ownedRows("governancePolicies")).toEqual(before);
      });
    });
  });


});
