/**
 * CLI Memory Space Commands Integration Tests
 *
 * Tests CLI memory space commands against a real Convex instance
 */

import { Cortex } from "@cortexmemory/sdk";
import { cleanupTestData } from "./setup";

describe("CLI Memory Space Commands", () => {
  let cortex: Cortex;
  const CONVEX_URL = process.env.CONVEX_URL!;
  const TIMESTAMP = Date.now();
  const TEST_PREFIX = `cli-test-spaces-${TIMESTAMP}`;

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    await cleanupTestData(TEST_PREFIX);
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    try {
      await cleanupTestData(TEST_PREFIX);
    } finally {
      // Ensure client is closed even if cleanup fails
      try {
        cortex.close();
      } catch (error) {
        console.warn("⚠️  Error closing cortex client:", error);
      }
    }
  }, 60000); // 60 second timeout for cleanup

  describe("spaces create (register)", () => {
    it("should create a new memory space", async () => {
      const spaceId = `${TEST_PREFIX}-create`;

      const space = await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        name: "Create Test Space",
        type: "project",
        metadata: { test: true },
      });

      expect(space.memorySpaceId).toBe(spaceId);
      expect(space.name).toBe("Create Test Space");
      expect(space.type).toBe("project");
      expect(space.status).toBe("active");
    });

    it("should create different space types", async () => {
      const types = ["personal", "team", "project", "custom"] as const;

      for (const type of types) {
        const spaceId = `${TEST_PREFIX}-type-${type}`;

        const space = await cortex.memorySpaces.register({
          memorySpaceId: spaceId,
          name: `${type} Space`,
          type,
        });

        expect(space.type).toBe(type);
      }
    });
  });

  describe("spaces list", () => {
    beforeAll(async () => {
      // Create test spaces
      for (let i = 0; i < 3; i++) {
        await cortex.memorySpaces.register({
          memorySpaceId: `${TEST_PREFIX}-list-${i}`,
          name: `List Test ${i}`,
          type: "project",
        });
      }
    });

    it("should list memory spaces", async () => {
      const spaces = await cortex.memorySpaces.list({ limit: 100 });

      expect(spaces.length).toBeGreaterThanOrEqual(3);
    });

    it("should filter by type", async () => {
      const spaces = await cortex.memorySpaces.list({
        type: "project",
        limit: 100,
      });

      spaces.forEach((s) => {
        expect(s.type).toBe("project");
      });
    });

    it("should filter by status", async () => {
      const spaces = await cortex.memorySpaces.list({
        status: "active",
        limit: 100,
      });

      spaces.forEach((s) => {
        expect(s.status).toBe("active");
      });
    });

    it("should respect limit", async () => {
      const spaces = await cortex.memorySpaces.list({ limit: 2 });

      expect(spaces.length).toBeLessThanOrEqual(2);
    });
  });

  describe("spaces get", () => {
    const spaceId = `${TEST_PREFIX}-get`;

    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        name: "Get Test Space",
        type: "team",
        metadata: { key: "value" },
      });
    });

    it("should get a memory space by ID", async () => {
      const space = await cortex.memorySpaces.get(spaceId);

      expect(space).not.toBeNull();
      expect(space!.memorySpaceId).toBe(spaceId);
      expect(space!.name).toBe("Get Test Space");
      expect(space!.type).toBe("team");
    });

    it("should return null for non-existent space", async () => {
      const space = await cortex.memorySpaces.get("non-existent-space");

      expect(space).toBeNull();
    });
  });

  describe("spaces update", () => {
    const spaceId = `${TEST_PREFIX}-update`;

    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        name: "Original Name",
        type: "project",
      });
    });

    it("should update space name", async () => {
      const updated = await cortex.memorySpaces.update(spaceId, {
        name: "Updated Name",
      });

      expect(updated.name).toBe("Updated Name");
    });

    it("should update space metadata", async () => {
      const updated = await cortex.memorySpaces.update(spaceId, {
        metadata: { updated: true },
      });

      expect(updated.metadata?.updated).toBe(true);
    });
  });

  describe("spaces count", () => {
    it("should count memory spaces", async () => {
      const count = await cortex.memorySpaces.count();

      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThan(0);
    });

    it("should count by type", async () => {
      const count = await cortex.memorySpaces.count({ type: "project" });

      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("spaces stats (getStats)", () => {
    const spaceId = `${TEST_PREFIX}-stats`;

    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        name: "Stats Test Space",
        type: "project",
      });

      // Add some data
      await cortex.vector.store(spaceId, {
        content: "Stats test memory",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: ["stats"] },
      });
    });

    it("should return space statistics", async () => {
      const stats = await cortex.memorySpaces.getStats(spaceId);

      expect(stats.memorySpaceId).toBe(spaceId);
      expect(typeof stats.totalMemories).toBe("number");
      expect(typeof stats.totalConversations).toBe("number");
      expect(typeof stats.totalFacts).toBe("number");
    });
  });

  describe("spaces archive", () => {
    const spaceId = `${TEST_PREFIX}-archive`;

    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        name: "Archive Test Space",
        type: "project",
      });
    });

    it("should archive a memory space", async () => {
      const archived = await cortex.memorySpaces.archive(spaceId, {
        reason: "Test archive",
      });

      expect(archived.status).toBe("archived");
    });
  });

  describe("spaces reactivate", () => {
    const spaceId = `${TEST_PREFIX}-reactivate`;

    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        name: "Reactivate Test Space",
        type: "project",
      });

      await cortex.memorySpaces.archive(spaceId);
    });

    it("should reactivate an archived space", async () => {
      const reactivated = await cortex.memorySpaces.reactivate(spaceId);

      expect(reactivated.status).toBe("active");
    });
  });

  describe("spaces participants", () => {
    const spaceId = `${TEST_PREFIX}-participants`;

    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        name: "Participants Test Space",
        type: "team",
      });
    });

    it("should add a participant", async () => {
      const updated = await cortex.memorySpaces.addParticipant(spaceId, {
        id: "user-1",
        type: "user",
        joinedAt: Date.now(),
      });

      expect(updated.participants?.length).toBeGreaterThanOrEqual(1);
      expect(updated.participants?.some((p) => p.id === "user-1")).toBe(true);
    });

    it("should remove a participant", async () => {
      // Add another participant first
      await cortex.memorySpaces.addParticipant(spaceId, {
        id: "user-2",
        type: "user",
        joinedAt: Date.now(),
      });

      const updated = await cortex.memorySpaces.removeParticipant(
        spaceId,
        "user-2",
      );

      expect(updated.participants?.some((p) => p.id === "user-2")).toBe(false);
    });
  });

  describe("spaces search", () => {
    beforeAll(async () => {
      await cortex.memorySpaces.register({
        memorySpaceId: `${TEST_PREFIX}-search-alpha`,
        name: "Alpha Team Space",
        type: "team",
      });

      await cortex.memorySpaces.register({
        memorySpaceId: `${TEST_PREFIX}-search-beta`,
        name: "Beta Project Space",
        type: "project",
      });
    });

    it("should search spaces by name", async () => {
      const results = await cortex.memorySpaces.search("Alpha", { limit: 10 });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((s) => s.name?.includes("Alpha"))).toBe(true);
    });
  });

  describe("spaces delete", () => {
    it("should delete a memory space", async () => {
      const spaceId = `${TEST_PREFIX}-delete`;

      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        name: "Delete Test Space",
        type: "project",
      });

      const result = await cortex.memorySpaces.delete(spaceId);

      expect(result.deleted).toBe(true);

      // Verify deleted
      const deleted = await cortex.memorySpaces.get(spaceId);
      expect(deleted).toBeNull();
    });

    it("should cascade delete with all data", async () => {
      const spaceId = `${TEST_PREFIX}-cascade`;

      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        name: "Cascade Delete Space",
        type: "project",
      });

      // Add some data
      await cortex.vector.store(spaceId, {
        content: "Memory in cascade space",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: [] },
      });

      const result = await cortex.memorySpaces.delete(spaceId, {
        cascade: true,
      });

      expect(result.deleted).toBe(true);
    });
  });
});
