/**
 * Governance API Tests
 *
 * Comprehensive tests for data retention, purging, and compliance rules.
 */

import { Cortex } from "../src";
import { TestCleanup } from "./helpers/cleanup";
import type {
  GovernancePolicy,
  ComplianceTemplate,
} from "../src/types";

describe("Governance API", () => {
  let cortex: Cortex;
  let cleanup: TestCleanup;

  beforeAll(() => {
    if (!process.env.CONVEX_URL) {
      throw new Error("CONVEX_URL environment variable is required for tests");
    }

    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL });
    cleanup = new TestCleanup(cortex.getClient());
  });

  afterAll(async () => {
    await cleanup.purgeAll();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Core Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Policy Management", () => {
    it("should set organization-wide policy", async () => {
      const policy: GovernancePolicy = {
        organizationId: "test-org-001",
        conversations: {
          retention: {
            deleteAfter: "7y",
            archiveAfter: "1y",
            purgeOnUserRequest: true,
          },
          purging: {
            autoDelete: true,
            deleteInactiveAfter: "2y",
          },
        },
        immutable: {
          retention: {
            defaultVersions: 20,
            byType: {
              "audit-log": { versionsToKeep: -1 },
              "kb-article": { versionsToKeep: 50 },
            },
          },
          purging: {
            autoCleanupVersions: true,
          },
        },
        mutable: {
          retention: {
            purgeInactiveAfter: "2y",
          },
          purging: {
            autoDelete: false,
          },
        },
        vector: {
          retention: {
            defaultVersions: 10,
            byImportance: [
              { range: [0, 20], versions: 1 },
              { range: [21, 40], versions: 3 },
              { range: [41, 70], versions: 10 },
              { range: [71, 89], versions: 20 },
              { range: [90, 100], versions: 30 },
            ],
          },
          purging: {
            autoCleanupVersions: true,
            deleteOrphaned: false,
          },
        },
        compliance: {
          mode: "GDPR",
          dataRetentionYears: 7,
          requireJustification: [90, 100],
          auditLogging: true,
        },
      };

      const result = await cortex.governance.setPolicy(policy);

      expect(result.success).toBe(true);
      expect(result.policyId).toBeDefined();
      expect(result.scope.organizationId).toBe("test-org-001");
      expect(result.appliedAt).toBeGreaterThan(0);
    });

    it("should get organization-wide policy", async () => {
      const policy = await cortex.governance.getPolicy({
        organizationId: "test-org-001",
      });

      expect(policy).toBeDefined();
      expect(policy.conversations).toBeDefined();
      expect(policy.immutable).toBeDefined();
      expect(policy.mutable).toBeDefined();
      expect(policy.vector).toBeDefined();
      expect(policy.compliance).toBeDefined();
    });

    it("should set memory-space-specific policy override", async () => {
      const overridePolicy: Partial<GovernancePolicy> = {
        vector: {
          retention: {
            defaultVersions: -1, // Unlimited for this space
            byImportance: [
              { range: [0, 100], versions: -1 },
            ],
          },
          purging: {
            autoCleanupVersions: false,
            deleteOrphaned: false,
          },
        },
      };

      await cortex.governance.setAgentOverride(
        "audit-agent-space",
        overridePolicy,
      );

      const spacePolicy = await cortex.governance.getPolicy({
        memorySpaceId: "audit-agent-space",
      });

      expect(spacePolicy).toBeDefined();
      expect(spacePolicy.vector.retention.defaultVersions).toBe(-1);
    });

    it("should replace existing org policy when setting new one", async () => {
      const policy1: GovernancePolicy = {
        organizationId: "test-org-002",
        conversations: {
          retention: { deleteAfter: "5y", purgeOnUserRequest: true },
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
          mode: "Custom",
          dataRetentionYears: 5,
          requireJustification: [],
          auditLogging: true,
        },
      };

      await cortex.governance.setPolicy(policy1);

      const policy2: GovernancePolicy = {
        ...policy1,
        conversations: {
          retention: { deleteAfter: "7y", purgeOnUserRequest: true },
          purging: { autoDelete: true },
        },
      };

      await cortex.governance.setPolicy(policy2);

      const retrieved = await cortex.governance.getPolicy({
        organizationId: "test-org-002",
      });

      expect(retrieved.conversations.retention.deleteAfter).toBe("7y");
    });
  });

  describe("Compliance Templates", () => {
    const templates: ComplianceTemplate[] = ["GDPR", "HIPAA", "SOC2", "FINRA"];

    templates.forEach((template) => {
      it(`should get ${template} template`, async () => {
        const policy = await cortex.governance.getTemplate(template);

        expect(policy).toBeDefined();
        expect(policy.conversations).toBeDefined();
        expect(policy.immutable).toBeDefined();
        expect(policy.mutable).toBeDefined();
        expect(policy.vector).toBeDefined();
        expect(policy.compliance).toBeDefined();
        expect(policy.compliance.mode).toBe(template);
      });
    });

    it("should apply GDPR template to organization", async () => {
      const gdprPolicy = await cortex.governance.getTemplate("GDPR");

      const result = await cortex.governance.setPolicy({
        ...gdprPolicy,
        organizationId: "test-org-gdpr",
      });

      expect(result.success).toBe(true);

      const retrieved = await cortex.governance.getPolicy({
        organizationId: "test-org-gdpr",
      });

      expect(retrieved.compliance.mode).toBe("GDPR");
      expect(retrieved.conversations.retention.deleteAfter).toBe("7y");
      expect(retrieved.conversations.retention.purgeOnUserRequest).toBe(true);
    });

    it("should apply HIPAA template with enhanced retention", async () => {
      const hipaaPolicy = await cortex.governance.getTemplate("HIPAA");

      expect(hipaaPolicy.compliance.mode).toBe("HIPAA");
      expect(hipaaPolicy.conversations.retention.deleteAfter).toBe("6y");
      expect(hipaaPolicy.immutable.retention.byType["audit-log"].versionsToKeep).toBe(
        -1,
      );
    });

    it("should customize template before applying", async () => {
      const soc2Policy = await cortex.governance.getTemplate("SOC2");

      // Customize vector retention
      const customPolicy: GovernancePolicy = {
        ...soc2Policy,
        organizationId: "test-org-custom-soc2",
        vector: {
          ...soc2Policy.vector,
          retention: {
            ...soc2Policy.vector.retention,
            defaultVersions: 20, // Override default
          },
        },
      };

      const result = await cortex.governance.setPolicy(customPolicy);

      expect(result.success).toBe(true);

      const retrieved = await cortex.governance.getPolicy({
        organizationId: "test-org-custom-soc2",
      });

      expect(retrieved.vector.retention.defaultVersions).toBe(20);
      expect(retrieved.compliance.mode).toBe("SOC2");
    });
  });

  describe("Policy Enforcement", () => {
    it("should manually enforce policy", async () => {
      // Set up a policy first
      const policy = await cortex.governance.getTemplate("GDPR");
      await cortex.governance.setPolicy({
        ...policy,
        organizationId: "test-org-enforce",
      });

      // Enforce it
      const result = await cortex.governance.enforce({
        layers: ["vector", "immutable"],
        rules: ["retention", "purging"],
        scope: { organizationId: "test-org-enforce" },
      });

      expect(result.enforcedAt).toBeGreaterThan(0);
      expect(result.versionsDeleted).toBeGreaterThanOrEqual(0);
      expect(result.recordsPurged).toBeGreaterThanOrEqual(0);
      expect(result.storageFreed).toBeGreaterThanOrEqual(0);
      expect(result.affectedLayers).toContain("vector");
      expect(result.affectedLayers).toContain("immutable");
    });

    it("should enforce policy with all layers", async () => {
      const policy = await cortex.governance.getTemplate("GDPR");
      await cortex.governance.setPolicy({
        ...policy,
        organizationId: "test-org-enforce-all",
      });

      const result = await cortex.governance.enforce({
        layers: ["conversations", "immutable", "mutable", "vector"],
        rules: ["retention", "purging"],
        scope: { organizationId: "test-org-enforce-all" },
      });

      expect(result.affectedLayers.length).toBe(4);
    });

    it("should enforce policy for memory space", async () => {
      const policy = await cortex.governance.getTemplate("GDPR");
      await cortex.governance.setPolicy({
        ...policy,
        memorySpaceId: "test-space-enforce",
      });

      const result = await cortex.governance.enforce({
        layers: ["vector"],
        rules: ["retention"],
        scope: { memorySpaceId: "test-space-enforce" },
      });

      expect(result.enforcedAt).toBeGreaterThan(0);
    });

    it("should throw error when enforcing without policy", async () => {
      await expect(
        cortex.governance.enforce({
          scope: { organizationId: "non-existent-org" },
        }),
      ).rejects.toThrow("No active policy found for scope");
    });
  });

  describe("Policy Simulation", () => {
    it("should simulate policy impact", async () => {
      const impact = await cortex.governance.simulate({
        organizationId: "test-org-simulate",
        vector: {
          retention: {
            defaultVersions: 5,
            byImportance: [
              { range: [0, 30], versions: 1 },
              { range: [31, 100], versions: 5 },
            ],
          },
          purging: {
            autoCleanupVersions: true,
            deleteOrphaned: true,
          },
        },
      });

      expect(impact.versionsAffected).toBeGreaterThanOrEqual(0);
      expect(impact.recordsAffected).toBeGreaterThanOrEqual(0);
      expect(impact.storageFreed).toBeGreaterThanOrEqual(0);
      expect(impact.costSavings).toBeGreaterThanOrEqual(0);
      expect(impact.breakdown).toBeDefined();
    });

    it("should show detailed breakdown by layer", async () => {
      const impact = await cortex.governance.simulate({
        organizationId: "test-org-simulate-detailed",
        conversations: {
          retention: { deleteAfter: "1y", purgeOnUserRequest: true },
          purging: { autoDelete: true, deleteInactiveAfter: "6m" },
        },
      });

      expect(impact.breakdown.conversations).toBeDefined();
      expect(impact.breakdown.conversations?.affected).toBeGreaterThanOrEqual(0);
      expect(impact.breakdown.conversations?.storageMB).toBeGreaterThanOrEqual(0);
    });

    it("should calculate cost savings", async () => {
      const impact = await cortex.governance.simulate({
        vector: {
          retention: {
            defaultVersions: 3,
            byImportance: [{ range: [0, 100], versions: 3 }],
          },
          purging: {
            autoCleanupVersions: true,
            deleteOrphaned: true,
          },
        },
      });

      expect(impact.costSavings).toBeGreaterThanOrEqual(0);
      expect(typeof impact.costSavings).toBe("number");
    });
  });

  describe("Compliance Reporting", () => {
    it("should generate compliance report", async () => {
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      const report = await cortex.governance.getComplianceReport({
        organizationId: "test-org-report",
        period: {
          start: new Date(thirtyDaysAgo),
          end: new Date(now),
        },
      });

      expect(report.organizationId).toBe("test-org-report");
      expect(report.generatedAt).toBeGreaterThan(0);
      expect(report.period.start).toBe(thirtyDaysAgo);
      expect(report.period.end).toBe(now);

      // Conversations section
      expect(report.conversations.total).toBeGreaterThanOrEqual(0);
      expect(report.conversations.deleted).toBeGreaterThanOrEqual(0);
      expect(report.conversations.archived).toBeGreaterThanOrEqual(0);
      expect(report.conversations.complianceStatus).toMatch(
        /COMPLIANT|NON_COMPLIANT|WARNING/,
      );

      // Immutable section
      expect(report.immutable.entities).toBeGreaterThanOrEqual(0);
      expect(report.immutable.totalVersions).toBeGreaterThanOrEqual(0);
      expect(report.immutable.complianceStatus).toMatch(
        /COMPLIANT|NON_COMPLIANT|WARNING/,
      );

      // Vector section
      expect(report.vector.memories).toBeGreaterThanOrEqual(0);
      expect(report.vector.versionsDeleted).toBeGreaterThanOrEqual(0);
      expect(report.vector.complianceStatus).toMatch(
        /COMPLIANT|NON_COMPLIANT|WARNING/,
      );

      // Data retention section
      expect(report.dataRetention.oldestRecord).toBeGreaterThan(0);
      expect(typeof report.dataRetention.withinPolicy).toBe("boolean");

      // User requests section
      expect(report.userRequests.deletionRequests).toBeGreaterThanOrEqual(0);
      expect(report.userRequests.fulfilled).toBeGreaterThanOrEqual(0);
      expect(report.userRequests.avgFulfillmentTime).toBeDefined();
    });

    it("should generate report for memory space", async () => {
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      const report = await cortex.governance.getComplianceReport({
        memorySpaceId: "test-space-report",
        period: {
          start: new Date(sevenDaysAgo),
          end: new Date(now),
        },
      });

      expect(report.memorySpaceId).toBe("test-space-report");
      expect(report.period.start).toBe(sevenDaysAgo);
    });
  });

  describe("Enforcement Statistics", () => {
    it("should get 30-day enforcement stats", async () => {
      const stats = await cortex.governance.getEnforcementStats({
        period: "30d",
        organizationId: "test-org-stats",
      });

      expect(stats.period.start).toBeGreaterThan(0);
      expect(stats.period.end).toBeGreaterThan(0);

      // Layer-specific stats
      expect(stats.conversations.purged).toBeGreaterThanOrEqual(0);
      expect(stats.conversations.archived).toBeGreaterThanOrEqual(0);

      expect(stats.immutable.versionsDeleted).toBeGreaterThanOrEqual(0);
      expect(stats.immutable.entitiesPurged).toBeGreaterThanOrEqual(0);

      expect(stats.vector.versionsDeleted).toBeGreaterThanOrEqual(0);
      expect(stats.vector.memoriesPurged).toBeGreaterThanOrEqual(0);

      expect(stats.mutable.keysDeleted).toBeGreaterThanOrEqual(0);

      // Aggregate stats
      expect(stats.storageFreed).toBeGreaterThanOrEqual(0);
      expect(stats.costSavings).toBeGreaterThanOrEqual(0);
    });

    it("should support different time periods", async () => {
      const periods = ["7d", "30d", "90d", "1y"];

      for (const period of periods) {
        const stats = await cortex.governance.getEnforcementStats({
          period,
          organizationId: "test-org-stats-periods",
        });

        expect(stats.period.start).toBeGreaterThan(0);
        expect(stats.period.end).toBeGreaterThan(stats.period.start);
      }
    });

    it("should calculate storage and cost savings", async () => {
      const stats = await cortex.governance.getEnforcementStats({
        period: "90d",
        organizationId: "test-org-stats-savings",
      });

      expect(typeof stats.storageFreed).toBe("number");
      expect(typeof stats.costSavings).toBe("number");
      expect(stats.storageFreed).toBeGreaterThanOrEqual(0);
      expect(stats.costSavings).toBeGreaterThanOrEqual(0);
    });

    it("should get stats for memory space", async () => {
      const stats = await cortex.governance.getEnforcementStats({
        period: "30d",
        memorySpaceId: "test-space-stats",
      });

      expect(stats.period.start).toBeGreaterThan(0);
    });
  });

  describe("Integration Scenarios", () => {
    it("should support full GDPR compliance workflow", async () => {
      const orgId = "test-org-gdpr-workflow";

      // 1. Apply GDPR template
      const gdprPolicy = await cortex.governance.getTemplate("GDPR");
      await cortex.governance.setPolicy({
        ...gdprPolicy,
        organizationId: orgId,
      });

      // 2. Verify policy is applied
      const policy = await cortex.governance.getPolicy({ organizationId: orgId });
      expect(policy.compliance.mode).toBe("GDPR");

      // 3. Simulate impact
      const simulation = await cortex.governance.simulate({
        ...policy,
        organizationId: orgId,
      });
      expect(simulation.versionsAffected).toBeGreaterThanOrEqual(0);

      // 4. Enforce policy
      const enforcement = await cortex.governance.enforce({
        scope: { organizationId: orgId },
      });
      expect(enforcement.enforcedAt).toBeGreaterThan(0);

      // 5. Generate compliance report
      const now = Date.now();
      const report = await cortex.governance.getComplianceReport({
        organizationId: orgId,
        period: {
          start: new Date(now - 30 * 24 * 60 * 60 * 1000),
          end: new Date(now),
        },
      });
      expect(report.conversations.complianceStatus).toBeDefined();
    });

    it("should support memory-space-specific overrides", async () => {
      // 1. Set org policy
      const orgPolicy = await cortex.governance.getTemplate("SOC2");
      await cortex.governance.setPolicy({
        ...orgPolicy,
        organizationId: "test-org-override",
      });

      // 2. Override for audit agent (unlimited retention)
      await cortex.governance.setAgentOverride("audit-agent", {
        vector: {
          retention: {
            defaultVersions: -1,
            byImportance: [{ range: [0, 100], versions: -1 }],
          },
          purging: {
            autoCleanupVersions: false,
            deleteOrphaned: false,
          },
        },
      });

      // 3. Override for temp agent (minimal retention)
      await cortex.governance.setAgentOverride("temp-agent", {
        vector: {
          retention: {
            defaultVersions: 1,
            byImportance: [{ range: [0, 100], versions: 1 }],
          },
          purging: {
            autoCleanupVersions: true,
            deleteOrphaned: true,
          },
        },
        conversations: {
          retention: {
            deleteAfter: "7d",
            purgeOnUserRequest: true,
          },
          purging: {
            autoDelete: true,
          },
        },
      });

      // 4. Verify overrides
      const auditPolicy = await cortex.governance.getPolicy({
        memorySpaceId: "audit-agent",
      });
      expect(auditPolicy.vector.retention.defaultVersions).toBe(-1);

      const tempPolicy = await cortex.governance.getPolicy({
        memorySpaceId: "temp-agent",
      });
      expect(tempPolicy.vector.retention.defaultVersions).toBe(1);
      expect(tempPolicy.conversations.retention.deleteAfter).toBe("7d");
    });

    it("should support test-before-apply pattern", async () => {
      const orgId = "test-org-test-before-apply";

      // 1. Get current policy
      const currentPolicy = await cortex.governance.getPolicy({
        organizationId: orgId,
      });

      // 2. Test new aggressive policy
      const aggressivePolicy: Partial<GovernancePolicy> = {
        vector: {
          retention: {
            defaultVersions: 3,
            byImportance: [{ range: [0, 50], versions: 1 }, { range: [51, 100], versions: 3 }],
          },
          purging: {
            autoCleanupVersions: true,
            deleteOrphaned: true,
          },
        },
      };

      const simulation = await cortex.governance.simulate({
        ...currentPolicy,
        ...aggressivePolicy,
        organizationId: orgId,
      });

      // 3. Decide based on impact
      if (simulation.costSavings > 10) {
        // Apply if savings are good
        await cortex.governance.setPolicy({
          ...currentPolicy,
          ...aggressivePolicy,
          organizationId: orgId,
        });
      }

      expect(simulation.costSavings).toBeGreaterThanOrEqual(0);
    });
  });
});
