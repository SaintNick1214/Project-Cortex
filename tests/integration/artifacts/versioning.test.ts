/**
 * Artifacts API - Version History Integration Tests
 *
 * Tests the complete version history functionality:
 * - Undo/redo operations end-to-end
 * - Version pointer management
 * - Version branching (update after undo)
 * - Version snapshot integrity
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 *
 * Test IDs: INT-CRUD-004, INT-VH-001 through INT-VH-003
 */

import { Cortex } from "../../../src";
import { ConvexClient } from "convex/browser";
import { createNamedTestRunContext } from "../../helpers/isolation";
import { generateTenantId, createTenantAuthContext } from "../../helpers/tenancy";

// Skip tests if no Convex URL configured
const describeWithConvex = process.env.CONVEX_URL ? describe : describe.skip;

describeWithConvex("Artifacts Version History Integration", () => {
  // Create unique test run context for parallel-safe execution
  const ctx = createNamedTestRunContext("artifacts-versioning");

  let cortex: Cortex;
  let client: ConvexClient;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  // Multi-tenancy: Generate tenant-specific IDs
  const TEST_TENANT_ID = generateTenantId("artifacts-versioning");
  const TEST_USER_ID = `user_${ctx.runId}`;

  // Track created spaces for cleanup
  const createdSpaces: string[] = [];

  // Helper to create and track memory spaces
  const setupTestSpace = async (suffix: string): Promise<string> => {
    const spaceId = ctx.memorySpaceId(suffix);
    await cortex.memorySpaces.register({
      memorySpaceId: spaceId,
      name: `Test Space ${suffix}`,
      type: "project",
    });
    createdSpaces.push(spaceId);
    return spaceId;
  };

  beforeAll(async () => {
    console.log(`\n🧪 Artifacts Versioning Integration Tests - Run ID: ${ctx.runId}\n`);
    console.log(`   TenantId: ${TEST_TENANT_ID}\n`);

    // Initialize SDK with auth context for multi-tenancy
    const authContext = createTenantAuthContext(TEST_TENANT_ID, TEST_USER_ID);
    cortex = new Cortex({ convexUrl: CONVEX_URL, auth: authContext });

    // Direct client for storage validation
    client = new ConvexClient(CONVEX_URL);

    console.log("✅ Test isolation setup complete\n");
  });

  afterAll(async () => {
    console.log(`\n🧹 Cleaning up test run ${ctx.runId}...`);

    // Cascade cleanup all test data via memory space deletion
    for (const spaceId of createdSpaces) {
      try {
        await cortex.memorySpaces.delete(spaceId, {
          cascade: true,
          reason: "Test cleanup",
        });
      } catch {
        // Ignore cleanup errors
      }
    }

    cortex.close();
    await client.close();
    console.log(`✅ Test run ${ctx.runId} cleanup complete\n`);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INT-CRUD-004: Undo/Redo Operations End-to-End
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("INT-CRUD-004: Undo/Redo operations", () => {
    it("should undo and redo through version history", async () => {
      const spaceId = await setupTestSpace("undo-redo");

      // Create initial artifact
      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Version 1",
        title: "Undo Redo Test",
      });

      // Update 3 times
      await cortex.artifacts.update(artifact.artifactId, "Version 2");
      await cortex.artifacts.update(artifact.artifactId, "Version 3");
      await cortex.artifacts.update(artifact.artifactId, "Version 4");

      // Verify at v4
      let current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.content).toBe("Version 4");
      expect(current?.version).toBe(4);
      expect(current?.versionPointer).toBe(4);

      // Undo twice (v4 → v3 → v2)
      const undo1 = await cortex.artifacts.undo(artifact.artifactId);
      expect(undo1.success).toBe(true);
      expect(undo1.previousVersion).toBe(4);
      expect(undo1.currentVersion).toBe(3);

      const afterUndo1 = await cortex.artifacts.get(artifact.artifactId);
      expect(afterUndo1?.content).toBe("Version 3");

      const undo2 = await cortex.artifacts.undo(artifact.artifactId);
      expect(undo2.success).toBe(true);
      expect(undo2.currentVersion).toBe(2);

      // Verify content is from v2
      current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.content).toBe("Version 2");
      expect(current?.versionPointer).toBe(2);
      expect(current?.version).toBe(4); // Total versions unchanged

      // Redo once (v2 → v3)
      const redo1 = await cortex.artifacts.redo(artifact.artifactId);
      expect(redo1.success).toBe(true);
      expect(redo1.currentVersion).toBe(3);

      current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.content).toBe("Version 3");
      expect(current?.versionPointer).toBe(3);
    });

    it("should reject undo at version 1", async () => {
      const spaceId = await setupTestSpace("undo-v1");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Only version",
        title: "Undo V1 Test",
      });

      // Undo should fail - already at first version
      await expect(cortex.artifacts.undo(artifact.artifactId)).rejects.toThrow();
    });

    it("should reject redo at latest version", async () => {
      const spaceId = await setupTestSpace("redo-latest");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "V1",
        title: "Redo Latest Test",
      });
      await cortex.artifacts.update(artifact.artifactId, "V2");

      // Already at latest - redo should fail
      await expect(cortex.artifacts.redo(artifact.artifactId)).rejects.toThrow();
    });

    it("should support multiple undo/redo cycles", async () => {
      const spaceId = await setupTestSpace("undo-redo-cycles");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "A",
        title: "Undo Redo Cycles Test",
      });

      await cortex.artifacts.update(artifact.artifactId, "B");
      await cortex.artifacts.update(artifact.artifactId, "C");

      // Cycle 1: Undo all, redo all
      await cortex.artifacts.undo(artifact.artifactId);
      await cortex.artifacts.undo(artifact.artifactId);
      let current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.content).toBe("A");

      await cortex.artifacts.redo(artifact.artifactId);
      await cortex.artifacts.redo(artifact.artifactId);
      current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.content).toBe("C");

      // Cycle 2: Partial undo/redo
      await cortex.artifacts.undo(artifact.artifactId);
      current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.content).toBe("B");

      await cortex.artifacts.redo(artifact.artifactId);
      current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.content).toBe("C");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INT-VH-001: Comprehensive Version Navigation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("INT-VH-001: Version history comprehensive", () => {
    it("should track complete version navigation", async () => {
      const spaceId = await setupTestSpace("version-nav");

      // Flow: Create v1, Update to v2, v3, v4, Undo ×2, Redo ×1
      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "A",
        title: "Version Nav Test",
      });

      await cortex.artifacts.update(artifact.artifactId, "B");
      await cortex.artifacts.update(artifact.artifactId, "C");
      await cortex.artifacts.update(artifact.artifactId, "D");

      // Navigate back: D → C → B
      await cortex.artifacts.undo(artifact.artifactId);
      await cortex.artifacts.undo(artifact.artifactId);

      // Navigate forward: B → C
      await cortex.artifacts.redo(artifact.artifactId);

      // Verify final state
      const final = await cortex.artifacts.get(artifact.artifactId);
      expect(final?.version).toBe(4);
      expect(final?.versionPointer).toBe(3);
      expect(final?.content).toBe("C");

      // Verify history entries
      const history = await cortex.artifacts.getHistory(artifact.artifactId);
      expect(history.length).toBe(4);
      expect(history[0].content).toBe("A");
      expect(history[1].content).toBe("B");
      expect(history[2].content).toBe("C");
      expect(history[3].content).toBe("D");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INT-VH-002: Version Branching (Update After Undo)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("INT-VH-002: Version branching", () => {
    it("should create new branch when updating after undo", async () => {
      const spaceId = await setupTestSpace("version-branch");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "v1",
        title: "Version Branch Test",
      });

      await cortex.artifacts.update(artifact.artifactId, "v2");
      await cortex.artifacts.update(artifact.artifactId, "v3-original");

      // Undo to v2
      await cortex.artifacts.undo(artifact.artifactId);
      const current = await cortex.artifacts.get(artifact.artifactId);
      expect(current?.content).toBe("v2");

      // Create new branch from v2 (this discards v3-original)
      await cortex.artifacts.update(artifact.artifactId, "v3-branch");

      // Verify branch state
      const final = await cortex.artifacts.get(artifact.artifactId);
      expect(final?.version).toBe(3);
      expect(final?.versionPointer).toBe(3);
      expect(final?.content).toBe("v3-branch");

      // Verify history - original v3 should be replaced
      const history = await cortex.artifacts.getHistory(artifact.artifactId);
      expect(history.length).toBe(3);
      expect(history[2].content).toBe("v3-branch");

      // Cannot redo - we're at latest after branch
      await expect(cortex.artifacts.redo(artifact.artifactId)).rejects.toThrow();
    });

    it("should handle multiple branches", async () => {
      const spaceId = await setupTestSpace("version-multi-branch");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "root",
        title: "Multi Branch Test",
      });

      await cortex.artifacts.update(artifact.artifactId, "branch-a");

      // First branch
      await cortex.artifacts.undo(artifact.artifactId);
      await cortex.artifacts.update(artifact.artifactId, "branch-b");

      // Second branch
      await cortex.artifacts.undo(artifact.artifactId);
      await cortex.artifacts.update(artifact.artifactId, "branch-c");

      const final = await cortex.artifacts.get(artifact.artifactId);
      expect(final?.content).toBe("branch-c");
      expect(final?.version).toBe(2); // Versions truncated to 2

      const history = await cortex.artifacts.getHistory(artifact.artifactId);
      expect(history.length).toBe(2);
      expect(history[1].content).toBe("branch-c");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INT-VH-003: Version Snapshot Integrity
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("INT-VH-003: Version snapshot integrity", () => {
    it("should preserve complete snapshots in history", async () => {
      const spaceId = await setupTestSpace("version-snapshots");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Content 1",
        title: "Title 1",
      });

      await cortex.artifacts.update(artifact.artifactId, "Content 2", {
        title: "Title 2",
      });

      await cortex.artifacts.update(artifact.artifactId, "Content 3");
      // title unchanged in v3

      // Verify each version snapshot
      const v1 = await cortex.artifacts.getVersion(artifact.artifactId, 1);
      expect(v1?.content).toBe("Content 1");
      expect(v1?.title).toBe("Title 1");

      const v2 = await cortex.artifacts.getVersion(artifact.artifactId, 2);
      expect(v2?.content).toBe("Content 2");
      expect(v2?.title).toBe("Title 2");

      const v3 = await cortex.artifacts.getVersion(artifact.artifactId, 3);
      expect(v3?.content).toBe("Content 3");
      expect(v3?.title).toBe("Title 2"); // Inherited from v2
    });

    it("should return null for non-existent version", async () => {
      const spaceId = await setupTestSpace("version-nonexistent");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Only one version",
        title: "Version Nonexistent Test",
      });

      const v999 = await cortex.artifacts.getVersion(artifact.artifactId, 999);
      expect(v999).toBeNull();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // History Query Options
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("History query options", () => {
    it("should limit history results", async () => {
      const spaceId = await setupTestSpace("history-limit");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "v1",
        title: "History Limit Test",
      });

      for (let i = 2; i <= 10; i++) {
        await cortex.artifacts.update(artifact.artifactId, `v${i}`);
      }

      const limited = await cortex.artifacts.getHistory(artifact.artifactId, {
        limit: 3,
      });
      expect(limited.length).toBe(3);
    });

    it("should filter history by limit", async () => {
      const spaceId = await setupTestSpace("history-range");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "v1",
        title: "History Range Test",
      });

      for (let i = 2; i <= 5; i++) {
        await cortex.artifacts.update(artifact.artifactId, `v${i}`);
      }

      const ranged = await cortex.artifacts.getHistory(artifact.artifactId, {
        limit: 4,
      });

      // Should return at most 4 versions
      expect(ranged.length).toBeLessThanOrEqual(4);
    });
  });
});
