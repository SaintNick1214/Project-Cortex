/**
 * Artifacts API - CRUD Integration Tests
 *
 * Tests the complete CRUD lifecycle for artifacts:
 * - Create artifact via SDK, verify in database
 * - Update artifact, verify version history created
 * - Delete artifact (soft/hard), verify flags
 * - List/count artifacts with filters
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 *
 * Test IDs: INT-CRUD-001 through INT-CRUD-003
 */

import { Cortex } from "../../../src";
import { ConvexClient } from "convex/browser";
import { api } from "../../../convex-dev/_generated/api";
import { createNamedTestRunContext } from "../../helpers/isolation";
import { generateTenantId, createTenantAuthContext } from "../../helpers/tenancy";

// Skip tests if no Convex URL configured
const describeWithConvex = process.env.CONVEX_URL ? describe : describe.skip;

describeWithConvex("Artifacts CRUD Integration", () => {
  // Create unique test run context for parallel-safe execution
  const ctx = createNamedTestRunContext("artifacts-crud");

  let cortex: Cortex;
  let client: ConvexClient;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  // Multi-tenancy: Generate tenant-specific IDs
  const TEST_TENANT_ID = generateTenantId("artifacts-crud");
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

  // Helper to generate unique artifact IDs
  const artifactId = (suffix: string): string => {
    return `art-${ctx.runId}-${suffix}`;
  };

  beforeAll(async () => {
    console.log(`\n🧪 Artifacts CRUD Integration Tests - Run ID: ${ctx.runId}\n`);
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
  // INT-CRUD-001: Create Artifact via SDK, Verify in Database
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("INT-CRUD-001: Create artifact via SDK", () => {
    it("should create artifact with minimal fields", async () => {
      const spaceId = await setupTestSpace("create-minimal");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Hello, World!",
        title: "Minimal Test",
      });

      // Validate SDK response
      expect(artifact.artifactId).toMatch(/^art-/);
      expect(artifact.kind).toBe("text");
      expect(artifact.content).toBe("Hello, World!");
      expect(artifact.version).toBe(1);
      expect(artifact.versionPointer).toBe(1);
      expect(artifact.streamingState).toBe("draft");

      // Verify database state directly
      const stored = await client.query(api.artifacts.get, {
        artifactId: artifact.artifactId,
        tenantId: TEST_TENANT_ID,
      });

      expect(stored).not.toBeNull();
      expect(stored!.artifactId).toBe(artifact.artifactId);
      expect(stored!.content).toBe("Hello, World!");
      expect(stored!.version).toBe(1);
      expect(stored!.versionPointer).toBe(1);
      expect(stored!.streamingState).toBe("draft");
      expect(stored!.versionHistory).toHaveLength(1);
    });

    it("should create artifact with all optional fields", async () => {
      const spaceId = await setupTestSpace("create-full");
      const convId = ctx.conversationId("full");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "code",
        content: "function hello() { return 'world'; }",
        title: "Hello Function",
        tags: ["function", "example", "javascript"],
        conversationRef: {
          conversationId: convId,
          messageId: "msg-1",
        },
        metadata: { author: "test", version: "1.0" },
        description: "A simple hello function",
      });

      expect(artifact.title).toBe("Hello Function");
      expect(artifact.tags).toContain("function");
      expect(artifact.tags).toContain("example");
      expect(artifact.tags).toContain("javascript");
      expect(artifact.conversationRef?.conversationId).toBe(convId);
      expect(artifact.conversationRef?.messageId).toBe("msg-1");
      expect(artifact.metadata?.author).toBe("test");
      expect(artifact.description).toBe("A simple hello function");
    });

    it("should create artifact with custom artifactId", async () => {
      const spaceId = await setupTestSpace("create-custom-id");
      const customId = artifactId("custom-123");

      const artifact = await cortex.artifacts.create({
        artifactId: customId,
        memorySpaceId: spaceId,
        kind: "text",
        content: "Custom ID artifact",
        title: "Custom ID Test",
      });

      expect(artifact.artifactId).toBe(customId);

      // Verify we can retrieve by custom ID
      const retrieved = await cortex.artifacts.get(customId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.artifactId).toBe(customId);
    });

    it("should reject duplicate artifactId", async () => {
      const spaceId = await setupTestSpace("create-duplicate");
      const customId = artifactId("duplicate");

      // Create first artifact
      await cortex.artifacts.create({
        artifactId: customId,
        memorySpaceId: spaceId,
        kind: "text",
        content: "First artifact",
        title: "First Artifact",
      });

      // Attempt to create duplicate
      await expect(
        cortex.artifacts.create({
          artifactId: customId,
          memorySpaceId: spaceId,
          kind: "text",
          content: "Duplicate artifact",
          title: "Duplicate Artifact",
        }),
      ).rejects.toThrow();
    });

    it("should auto-generate artifactId matching pattern", async () => {
      const spaceId = await setupTestSpace("create-autoid");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Auto-generated ID",
        title: "Auto ID Test",
      });

      // Should match art-{timestamp}-{random} pattern
      expect(artifact.artifactId).toMatch(/^art-\d+-[a-z0-9]+$/);
    });

    it("should create artifacts with different kinds", async () => {
      const spaceId = await setupTestSpace("create-kinds");

      const kinds: Array<"text" | "code" | "sheet" | "image" | "diagram" | "html"> = [
        "text",
        "code",
        "sheet",
        "image",
        "diagram",
        "html",
      ];

      for (const kind of kinds) {
        const artifact = await cortex.artifacts.create({
          memorySpaceId: spaceId,
          kind,
          content: `Content for ${kind}`,
          title: `${kind} Kind Test`,
        });

        expect(artifact.kind).toBe(kind);
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INT-CRUD-002: Update Artifact, Verify Version History Created
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("INT-CRUD-002: Update artifact, verify version history", () => {
    it("should create new version on content update", async () => {
      const spaceId = await setupTestSpace("update-content");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Version 1 content",
        title: "Test Document",
      });

      const updated = await cortex.artifacts.update(artifact.artifactId, "Version 2 content");

      expect(updated.version).toBe(2);
      expect(updated.versionPointer).toBe(2);
      expect(updated.content).toBe("Version 2 content");
      expect(updated.title).toBe("Test Document"); // Title unchanged

      // Verify version history
      const history = await cortex.artifacts.getHistory(artifact.artifactId);
      expect(history.length).toBe(2);
      expect(history[0].version).toBe(1);
      expect(history[0].content).toBe("Version 1 content");
      expect(history[1].version).toBe(2);
      expect(history[1].content).toBe("Version 2 content");
    });

    it("should update title along with content", async () => {
      const spaceId = await setupTestSpace("update-title");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Initial content",
        title: "Original Title",
      });

      const updated = await cortex.artifacts.update(artifact.artifactId, "Updated content", {
        title: "New Title",
      });

      expect(updated.version).toBe(2);
      expect(updated.content).toBe("Updated content");
      expect(updated.title).toBe("New Title");
    });

    it("should record changeSummary in version history", async () => {
      const spaceId = await setupTestSpace("update-summary");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Initial content with typos",
        title: "Change Summary Test",
      });

      await cortex.artifacts.update(artifact.artifactId, "Fixed content without typos", {
        changeSummary: "Fixed spelling errors",
      });

      const history = await cortex.artifacts.getHistory(artifact.artifactId);
      expect(history[1].changeSummary).toBe("Fixed spelling errors");
    });

    it("should handle multiple sequential updates", async () => {
      const spaceId = await setupTestSpace("update-sequential");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "v1",
        title: "Sequential Updates Test",
      });

      await cortex.artifacts.update(artifact.artifactId, "v2");
      await cortex.artifacts.update(artifact.artifactId, "v3");
      const final = await cortex.artifacts.update(artifact.artifactId, "v4");

      expect(final.version).toBe(4);
      expect(final.versionPointer).toBe(4);

      const history = await cortex.artifacts.getHistory(artifact.artifactId);
      expect(history.length).toBe(4);
      expect(history[3].content).toBe("v4");
    });

    it("should update tags", async () => {
      const spaceId = await setupTestSpace("update-tags");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Content",
        title: "Update Tags Test",
        tags: ["initial", "draft"],
      });

      const updated = await cortex.artifacts.update(artifact.artifactId, "Updated content", {
        tags: ["final", "reviewed"],
      });

      expect(updated.tags).toContain("final");
      expect(updated.tags).toContain("reviewed");
      expect(updated.tags).not.toContain("initial");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INT-CRUD-003: Delete Artifact, Verify Soft Delete Flags
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("INT-CRUD-003: Delete artifact, verify soft delete", () => {
    it("should soft delete artifact by default", async () => {
      const spaceId = await setupTestSpace("delete-soft");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "To be soft deleted",
        title: "Soft Delete Test",
      });

      const result = await cortex.artifacts.delete(artifact.artifactId);

      expect(result.deleted).toBe(true);
      expect(result.versionsPurged).toBeUndefined(); // Soft delete doesn't purge versions

      // Verify soft delete flags in database
      const deleted = await cortex.artifacts.get(artifact.artifactId);
      expect(deleted).not.toBeNull();
      expect(deleted?.isDeleted).toBe(true);
      expect(deleted?.deletedAt).toBeDefined();
    });

    it("should exclude soft-deleted from list by default", async () => {
      const spaceId = await setupTestSpace("delete-list");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Will be deleted",
        title: "Delete List Test",
      });

      await cortex.artifacts.delete(artifact.artifactId);

      // Default list should not include deleted
      const list = await cortex.artifacts.list({ memorySpaceId: spaceId });
      expect(list.some((a) => a.artifactId === artifact.artifactId)).toBe(false);

      // With includeDeleted should include
      const listWithDeleted = await cortex.artifacts.list({
        memorySpaceId: spaceId,
        includeDeleted: true,
      });
      expect(listWithDeleted.some((a) => a.artifactId === artifact.artifactId)).toBe(true);
    });

    it("should hard delete artifact when requested", async () => {
      const spaceId = await setupTestSpace("delete-hard");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "To be permanently deleted",
        title: "Hard Delete Test",
      });

      const result = await cortex.artifacts.delete(artifact.artifactId, true);

      expect(result.deleted).toBe(true);
      expect(result.versionsPurged).toBeDefined(); // Hard delete purges versions

      // Verify record is gone
      const deleted = await cortex.artifacts.get(artifact.artifactId);
      expect(deleted).toBeNull();
    });

    it("should prevent updates to soft-deleted artifact", async () => {
      const spaceId = await setupTestSpace("delete-update");

      const artifact = await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Initial content",
        title: "Delete Update Test",
      });

      await cortex.artifacts.delete(artifact.artifactId);

      // Attempt to update should fail
      await expect(cortex.artifacts.update(artifact.artifactId, "Updated content")).rejects.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // List and Count Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("List and Count operations", () => {
    it("should list artifacts by memorySpaceId", async () => {
      const spaceId = await setupTestSpace("list-space");

      await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Artifact 1",
        title: "List Test 1",
      });
      await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Artifact 2",
        title: "List Test 2",
      });
      await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "code",
        content: "Artifact 3",
        title: "List Test 3",
      });

      const list = await cortex.artifacts.list({ memorySpaceId: spaceId });
      expect(list.length).toBe(3);
    });

    it("should filter list by kind", async () => {
      const spaceId = await setupTestSpace("list-kind");

      await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Text artifact",
        title: "Kind Filter Text",
      });
      await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "code",
        content: "Code artifact",
        title: "Kind Filter Code 1",
      });
      await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "code",
        content: "Another code artifact",
        title: "Kind Filter Code 2",
      });

      const codeOnly = await cortex.artifacts.list({
        memorySpaceId: spaceId,
        kind: "code",
      });
      expect(codeOnly.length).toBe(2);
      expect(codeOnly.every((a) => a.kind === "code")).toBe(true);
    });

    it("should filter list by tags", async () => {
      const spaceId = await setupTestSpace("list-tags");

      await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Important doc",
        title: "Tag Filter Important",
        tags: ["important", "doc"],
      });
      await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Draft",
        title: "Tag Filter Draft",
        tags: ["draft"],
      });
      await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "Important draft",
        title: "Tag Filter Important Draft",
        tags: ["important", "draft"],
      });

      const importantOnly = await cortex.artifacts.list({
        memorySpaceId: spaceId,
        tags: ["important"],
      });
      expect(importantOnly.length).toBe(2);
    });

    it("should count artifacts correctly", async () => {
      const spaceId = await setupTestSpace("count");

      await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "A1",
        title: "Count Test 1",
      });
      await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "text",
        content: "A2",
        title: "Count Test 2",
      });
      await cortex.artifacts.create({
        memorySpaceId: spaceId,
        kind: "code",
        content: "A3",
        title: "Count Test 3",
      });

      const totalCount = await cortex.artifacts.count({ memorySpaceId: spaceId });
      expect(totalCount).toBe(3);

      const textCount = await cortex.artifacts.count({
        memorySpaceId: spaceId,
        kind: "text",
      });
      expect(textCount).toBe(2);
    });

    it("should respect limit and offset", async () => {
      const spaceId = await setupTestSpace("list-pagination");

      // Create 5 artifacts
      for (let i = 0; i < 5; i++) {
        await cortex.artifacts.create({
          memorySpaceId: spaceId,
          kind: "text",
          content: `Artifact ${i}`,
          title: `Pagination Test ${i}`,
        });
      }

      const page1 = await cortex.artifacts.list({
        memorySpaceId: spaceId,
        limit: 2,
        offset: 0,
      });
      expect(page1.length).toBe(2);

      const page2 = await cortex.artifacts.list({
        memorySpaceId: spaceId,
        limit: 2,
        offset: 2,
      });
      expect(page2.length).toBe(2);

      const page3 = await cortex.artifacts.list({
        memorySpaceId: spaceId,
        limit: 2,
        offset: 4,
      });
      expect(page3.length).toBe(1);
    });
  });
});
