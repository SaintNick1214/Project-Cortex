/**
 * Governance API Tests
 *
 * Comprehensive tests for data retention, purging, and compliance rules.
 */

import { Cortex } from "../src";
import { TestCleanup } from "./helpers/cleanup";
import type { GovernancePolicy, ComplianceTemplate } from "../src/types";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const _ctx = createTestRunContext();

describe("Governance API", () => {
  let cortex: Cortex;
  let _cleanup: TestCleanup;

  beforeAll(() => {
    if (!process.env.CONVEX_URL) {
      throw new Error("CONVEX_URL environment variable is required for tests");
    }

    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL });
    _cleanup = new TestCleanup(cortex.getClient());
  });

  afterAll(async () => {
    // NOTE: Removed purgeAll() for parallel execution compatibility.
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
            byImportance: [{ range: [0, 100], versions: -1 }],
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Client-Side Validation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
          organizationId: "test-org-validation",
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
          organizationId: "test-org-validation",
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
          organizationId: "test-org-validation",
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
          organizationId: "test-org-validation",
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
          organizationId: "test-org-missing-conversations",
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
          organizationId: "test-org-missing-immutable",
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
          organizationId: "test-org-missing-mutable",
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
          organizationId: "test-org-missing-vector",
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
          organizationId: "test-org-missing-compliance",
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
          organizationId: "test-org-missing-conv-retention",
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
          organizationId: "test-org-missing-conv-purging",
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
          organizationId: "test-org-missing-imm-retention",
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
          organizationId: "test-org-missing-imm-purging",
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
          organizationId: "test-org-missing-mut-retention",
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
          organizationId: "test-org-missing-mut-purging",
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
          organizationId: "test-org-missing-vec-retention",
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
          organizationId: "test-org-missing-vec-purging",
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
          organizationId: "test-org-both-scopes",
          memorySpaceId: "test-space-both-scopes",
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
          organizationId: "test-org-minimal",
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
        await expect(
          cortex.governance.setPolicy(null as any),
        ).rejects.toThrow(/Policy is required|Cannot read/);
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
            scope: { organizationId: "test-org" },
            layers: ["invalid-layer" as any],
          }),
        ).rejects.toThrow("Invalid layer");
      });

      it("should throw on invalid rule names", async () => {
        await expect(
          cortex.governance.enforce({
            scope: { organizationId: "test-org" },
            rules: ["invalid-rule" as any],
          }),
        ).rejects.toThrow("Invalid rule");
      });

      it("should throw on empty layers array", async () => {
        await expect(
          cortex.governance.enforce({
            scope: { organizationId: "test-org" },
            layers: [],
          }),
        ).rejects.toThrow("Layers array cannot be empty");
      });

      it("should throw on empty rules array", async () => {
        await expect(
          cortex.governance.enforce({
            scope: { organizationId: "test-org" },
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
            organizationId: "test-org",
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
            organizationId: "test-org",
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
            organizationId: "test-org",
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
            organizationId: "test-org",
          }),
        ).rejects.toThrow("Invalid period");
      });

      it("should accept valid period formats", async () => {
        const validPeriods = ["7d", "30d", "90d", "1y"];

        for (const period of validPeriods) {
          // Should not throw
          const stats = await cortex.governance.getEnforcementStats({
            period,
            organizationId: "test-org-stats-valid",
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
          cortex.governance.setAgentOverride("test-space", {
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
          cortex.governance.setAgentOverride("test-space-invalid-version", {
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
          cortex.governance.setAgentOverride("test-space-invalid-imm-version", {
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
          cortex.governance.setAgentOverride("test-space-overlap", {
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
          cortex.governance.setAgentOverride("test-space-invalid-bounds", {
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
          cortex.governance.setAgentOverride("test-space-negative-min", {
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
          cortex.governance.setAgentOverride("test-space-min-gte-max", {
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
            organizationId: "test-org",
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
            organizationId: "test-org",
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
            organizationId: "test-org-sim-imm-version",
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
            organizationId: "test-org-sim-overlap",
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
            organizationId: "test-org-sim-bounds",
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
            organizationId: "test-org-sim-neg",
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
            organizationId: "test-org-sim-min-gte-max",
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
            organizationId: "test-org-sim-non-num",
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
      it("should return default GDPR template when no policy exists", async () => {
        // Query for a non-existent organization that definitely has no policy
        const policy = await cortex.governance.getPolicy({
          organizationId: "non-existent-org-for-fallback-test",
        });

        // Should fall back to GDPR template
        expect(policy).toBeDefined();
        expect(policy.compliance).toBeDefined();
        expect(policy.compliance.mode).toBe("GDPR");
        expect(policy.conversations).toBeDefined();
        expect(policy.immutable).toBeDefined();
        expect(policy.mutable).toBeDefined();
        expect(policy.vector).toBeDefined();
      });

      it("should return default GDPR when called with empty scope", async () => {
        // Empty scope should return default GDPR template
        const policy = await cortex.governance.getPolicy();

        expect(policy).toBeDefined();
        expect(policy.compliance.mode).toBe("GDPR");
      });

      it("should prioritize memory-space policy over org policy", async () => {
        const orgId = "test-org-priority-" + Date.now();
        const spaceId = "test-space-priority-" + Date.now();

        // 1. Set org-level policy with SOC2 template
        const soc2Policy = await cortex.governance.getTemplate("SOC2");
        await cortex.governance.setPolicy({
          ...soc2Policy,
          organizationId: orgId,
        });

        // 2. Set space-level override with different retention
        await cortex.governance.setAgentOverride(spaceId, {
          vector: {
            retention: {
              defaultVersions: 999, // Distinctive value
              byImportance: [{ range: [0, 100], versions: 999 }],
            },
            purging: {
              autoCleanupVersions: false,
              deleteOrphaned: false,
            },
          },
        });

        // 3. Query for space - should get space-level override
        const spacePolicy = await cortex.governance.getPolicy({
          memorySpaceId: spaceId,
        });

        expect(spacePolicy.vector.retention.defaultVersions).toBe(999);

        // 4. Query for org - should get org-level policy
        const orgPolicy = await cortex.governance.getPolicy({
          organizationId: orgId,
        });

        expect(orgPolicy.compliance.mode).toBe("SOC2");
        // SOC2 template has defaultVersions: 15
        expect(orgPolicy.vector.retention.defaultVersions).toBe(15);
      });
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Additional Validation Edge Cases
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    describe("validateImportanceRanges edge cases", () => {
      it("should accept touching but non-overlapping ranges", async () => {
        const policy: GovernancePolicy = {
          organizationId: "test-org-touching-ranges",
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
          organizationId: "test-org-empty-ranges",
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
          organizationId: "test-org-non-array-ranges",
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
          organizationId: "test-org-malformed-tuple",
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
          organizationId: "test-org-non-numeric-range",
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
          organizationId: "test-org-string-version",
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
          organizationId: "test-org-unlimited-versions",
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

      it("should accept version count of 0", async () => {
        const policy: GovernancePolicy = {
          organizationId: "test-org-zero-versions",
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

        // Should succeed - 0 is valid
        const result = await cortex.governance.setPolicy(policy);
        expect(result.success).toBe(true);
      });
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
      expect(
        hipaaPolicy.immutable.retention.byType["audit-log"].versionsToKeep,
      ).toBe(-1);
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
      // Note: This tests BACKEND validation (policy existence check)
      // Client-side validation tests are in "Client-Side Validation" suite above
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
      expect(impact.breakdown.conversations?.affected).toBeGreaterThanOrEqual(
        0,
      );
      expect(impact.breakdown.conversations?.storageMB).toBeGreaterThanOrEqual(
        0,
      );
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
      const policy = await cortex.governance.getPolicy({
        organizationId: orgId,
      });
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
            byImportance: [
              { range: [0, 50], versions: 1 },
              { range: [51, 100], versions: 3 },
            ],
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

    it("should support multi-tier policy hierarchy (org → space → agent)", async () => {
      const ts = Date.now();
      const orgId = `test-org-hierarchy-${ts}`;
      const spaceId1 = `space-tier1-${ts}`;
      const spaceId2 = `space-tier2-${ts}`;
      const agentSpaceId = `agent-special-${ts}`;

      // 1. Set organization-wide policy (base layer)
      const gdprPolicy = await cortex.governance.getTemplate("GDPR");
      await cortex.governance.setPolicy({
        ...gdprPolicy,
        organizationId: orgId,
      });

      // 2. Override for first space (moderate retention)
      await cortex.governance.setAgentOverride(spaceId1, {
        vector: {
          retention: {
            defaultVersions: 25, // More than org default
            byImportance: [{ range: [0, 100], versions: 25 }],
          },
          purging: {
            autoCleanupVersions: true,
            deleteOrphaned: false,
          },
        },
      });

      // 3. Override for agent space (unlimited retention - audit agent)
      await cortex.governance.setAgentOverride(agentSpaceId, {
        vector: {
          retention: {
            defaultVersions: -1, // Unlimited
            byImportance: [{ range: [0, 100], versions: -1 }],
          },
          purging: {
            autoCleanupVersions: false,
            deleteOrphaned: false,
          },
        },
        immutable: {
          retention: {
            defaultVersions: -1, // Keep all versions
            byType: {
              "audit-log": { versionsToKeep: -1 },
            },
          },
          purging: {
            autoCleanupVersions: false,
          },
        },
      });

      // 4. Verify hierarchy - org level
      const orgPolicy = await cortex.governance.getPolicy({
        organizationId: orgId,
      });
      expect(orgPolicy.compliance.mode).toBe("GDPR");
      expect(orgPolicy.vector.retention.defaultVersions).toBe(10); // GDPR default

      // 5. Verify hierarchy - space level (overridden)
      const space1Policy = await cortex.governance.getPolicy({
        memorySpaceId: spaceId1,
      });
      expect(space1Policy.vector.retention.defaultVersions).toBe(25);

      // 6. Verify hierarchy - agent level (max override)
      const agentPolicy = await cortex.governance.getPolicy({
        memorySpaceId: agentSpaceId,
      });
      expect(agentPolicy.vector.retention.defaultVersions).toBe(-1);
      expect(agentPolicy.immutable.retention.defaultVersions).toBe(-1);

      // 7. Verify non-overridden space falls back to defaults
      const space2Policy = await cortex.governance.getPolicy({
        memorySpaceId: spaceId2,
      });
      // Falls back to GDPR default since no specific override
      expect(space2Policy.compliance.mode).toBe("GDPR");
    });

    it("should handle concurrent enforcement calls without conflict", async () => {
      const ts = Date.now();
      const orgIds = [
        `concurrent-org-1-${ts}`,
        `concurrent-org-2-${ts}`,
        `concurrent-org-3-${ts}`,
      ];

      // Setup: Create policies for each org
      const gdprPolicy = await cortex.governance.getTemplate("GDPR");

      for (const orgId of orgIds) {
        await cortex.governance.setPolicy({
          ...gdprPolicy,
          organizationId: orgId,
        });
      }

      // Execute: Run enforcement concurrently for all orgs
      const enforcePromises = orgIds.map((orgId) =>
        cortex.governance.enforce({
          layers: ["vector", "immutable"],
          rules: ["retention"],
          scope: { organizationId: orgId },
        }),
      );

      // Should all succeed without conflict
      const results = await Promise.all(enforcePromises);

      // Verify: All enforcements completed successfully
      expect(results.length).toBe(3);
      for (const result of results) {
        expect(result.enforcedAt).toBeGreaterThan(0);
        expect(result.affectedLayers).toContain("vector");
        expect(result.affectedLayers).toContain("immutable");
      }
    });

    it("should track enforcement history via stats", async () => {
      const ts = Date.now();
      const orgId = `enforcement-history-${ts}`;

      // Setup: Create and apply policy
      const policy = await cortex.governance.getTemplate("SOC2");
      await cortex.governance.setPolicy({
        ...policy,
        organizationId: orgId,
      });

      // Execute: Enforce multiple times
      await cortex.governance.enforce({
        layers: ["vector"],
        rules: ["retention"],
        scope: { organizationId: orgId },
      });

      await cortex.governance.enforce({
        layers: ["immutable"],
        rules: ["purging"],
        scope: { organizationId: orgId },
      });

      // Verify: Stats reflect enforcement history
      const stats = await cortex.governance.getEnforcementStats({
        period: "7d",
        organizationId: orgId,
      });

      expect(stats.period.start).toBeGreaterThan(0);
      expect(stats.period.end).toBeGreaterThan(stats.period.start);
      // Stats should include aggregated data from enforcements
      expect(stats.vector).toBeDefined();
      expect(stats.immutable).toBeDefined();
    });

    it("should generate accurate compliance report after enforcement", async () => {
      const ts = Date.now();
      const orgId = `compliance-report-${ts}`;

      // Setup: Create HIPAA policy (strict compliance)
      const hipaaPolicy = await cortex.governance.getTemplate("HIPAA");
      await cortex.governance.setPolicy({
        ...hipaaPolicy,
        organizationId: orgId,
      });

      // Execute: Run full enforcement
      await cortex.governance.enforce({
        layers: ["conversations", "immutable", "mutable", "vector"],
        rules: ["retention", "purging"],
        scope: { organizationId: orgId },
      });

      // Generate compliance report
      const now = Date.now();
      const report = await cortex.governance.getComplianceReport({
        organizationId: orgId,
        period: {
          start: new Date(now - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          end: new Date(now),
        },
      });

      // Verify: Report structure is complete
      expect(report.organizationId).toBe(orgId);
      expect(report.generatedAt).toBeGreaterThan(0);
      expect(report.conversations).toBeDefined();
      expect(report.immutable).toBeDefined();
      expect(report.vector).toBeDefined();
      expect(report.dataRetention).toBeDefined();
      expect(report.userRequests).toBeDefined();

      // All sections should have compliance status
      expect(report.conversations.complianceStatus).toMatch(
        /COMPLIANT|NON_COMPLIANT|WARNING/,
      );
      expect(report.immutable.complianceStatus).toMatch(
        /COMPLIANT|NON_COMPLIANT|WARNING/,
      );
      expect(report.vector.complianceStatus).toMatch(
        /COMPLIANT|NON_COMPLIANT|WARNING/,
      );
    });

    it("should apply FINRA template for financial compliance", async () => {
      const ts = Date.now();
      const orgId = `finra-org-${ts}`;

      // FINRA has strictest retention requirements
      const finraPolicy = await cortex.governance.getTemplate("FINRA");

      // Verify FINRA template characteristics
      expect(finraPolicy.compliance.mode).toBe("FINRA");
      expect(finraPolicy.conversations.retention.purgeOnUserRequest).toBe(
        false,
      ); // FINRA doesn't allow purge on request
      expect(finraPolicy.immutable.retention.defaultVersions).toBe(-1); // Unlimited

      // Apply FINRA policy
      const result = await cortex.governance.setPolicy({
        ...finraPolicy,
        organizationId: orgId,
      });

      expect(result.success).toBe(true);

      // Retrieve and verify
      const retrieved = await cortex.governance.getPolicy({
        organizationId: orgId,
      });

      expect(retrieved.compliance.mode).toBe("FINRA");
      expect(retrieved.conversations.retention.purgeOnUserRequest).toBe(false);
      expect(retrieved.immutable.retention.defaultVersions).toBe(-1);
      expect(retrieved.vector.purging.autoCleanupVersions).toBe(false);
    });
  });
});
