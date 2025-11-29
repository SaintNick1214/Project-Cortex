/**
 * CLI User Commands Integration Tests
 *
 * Tests CLI user commands against a real Convex instance
 */

import { Cortex } from "@cortexmemory/sdk";
import { cleanupTestData } from "./setup";

describe("CLI User Commands", () => {
  let cortex: Cortex;
  const CONVEX_URL = process.env.CONVEX_URL!;
  const TEST_PREFIX = "cli-test-users";

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    await cleanupTestData(TEST_PREFIX);
  });

  afterAll(async () => {
    await cleanupTestData(TEST_PREFIX);
    cortex.close();
  });

  describe("users list", () => {
    beforeAll(async () => {
      // Create test users
      for (let i = 0; i < 3; i++) {
        await cortex.users.update(`${TEST_PREFIX}-user-${i}`, {
          name: `Test User ${i}`,
          email: `user${i}@test.example`,
        });
      }
    });

    it("should list users", async () => {
      const users = await cortex.users.list({ limit: 100 });

      expect(users.length).toBeGreaterThanOrEqual(3);
    });

    it("should respect limit", async () => {
      const users = await cortex.users.list({ limit: 2 });

      expect(users.length).toBeLessThanOrEqual(2);
    });
  });

  describe("users get", () => {
    const userId = `${TEST_PREFIX}-get-user`;

    beforeAll(async () => {
      await cortex.users.update(userId, {
        name: "Get Test User",
        email: "get@test.example",
      });
    });

    it("should get a user profile", async () => {
      const user = await cortex.users.get(userId);

      expect(user).not.toBeNull();
      expect(user!.id).toBe(userId);
      expect(user!.data.name).toBe("Get Test User");
    });

    it("should return null for non-existent user", async () => {
      const user = await cortex.users.get("non-existent-user-id");

      expect(user).toBeNull();
    });
  });

  describe("users update", () => {
    const userId = `${TEST_PREFIX}-update-user`;

    beforeAll(async () => {
      await cortex.users.update(userId, { name: "Original Name" });
    });

    it("should update user profile", async () => {
      const updated = await cortex.users.update(userId, {
        name: "Updated Name",
        newField: "new value",
      });

      expect(updated.data.name).toBe("Updated Name");
      expect(updated.data.newField).toBe("new value");
    });

    it("should increment version on update", async () => {
      const before = await cortex.users.get(userId);
      const beforeVersion = before!.version;

      await cortex.users.update(userId, { updated: true });

      const after = await cortex.users.get(userId);
      expect(after!.version).toBe(beforeVersion + 1);
    });
  });

  describe("users exists", () => {
    const userId = `${TEST_PREFIX}-exists-user`;

    beforeAll(async () => {
      await cortex.users.update(userId, { name: "Exists Test" });
    });

    it("should return true for existing user", async () => {
      const exists = await cortex.users.exists(userId);

      expect(exists).toBe(true);
    });

    it("should return false for non-existent user", async () => {
      const exists = await cortex.users.exists("definitely-not-a-user");

      expect(exists).toBe(false);
    });
  });

  describe("users count", () => {
    it("should count users", async () => {
      const count = await cortex.users.count();

      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThan(0);
    });
  });

  describe("users getHistory", () => {
    const userId = `${TEST_PREFIX}-history-user`;

    beforeAll(async () => {
      // Create user and update multiple times
      await cortex.users.update(userId, { version1: true });
      await cortex.users.update(userId, { version2: true });
      await cortex.users.update(userId, { version3: true });
    });

    it("should return version history", async () => {
      const history = await cortex.users.getHistory(userId);

      expect(history.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("users delete", () => {
    it("should delete a user", async () => {
      const userId = `${TEST_PREFIX}-delete-user`;
      await cortex.users.update(userId, { name: "To Delete" });

      // Verify exists
      const exists = await cortex.users.exists(userId);
      expect(exists).toBe(true);

      // Delete
      const result = await cortex.users.delete(userId);

      expect(result.deleted || result.totalDeleted > 0).toBe(true);

      // Verify deleted
      const afterDelete = await cortex.users.exists(userId);
      expect(afterDelete).toBe(false);
    });

    it("should cascade delete user data when requested", async () => {
      const userId = `${TEST_PREFIX}-cascade-user`;
      const spaceId = `${TEST_PREFIX}-cascade-space`;

      // Create user
      await cortex.users.update(userId, { name: "Cascade Test" });

      // Create space and memories for user
      try {
        await cortex.memorySpaces.register({
          memorySpaceId: spaceId,
          name: "Cascade Test Space",
          type: "personal",
        });
      } catch {
        // May already exist
      }

      await cortex.vector.store(spaceId, {
        content: "User memory",
        contentType: "raw",
        userId: userId,
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: [] },
      });

      // Cascade delete
      const result = await cortex.users.delete(userId, {
        cascade: true,
        verify: true,
      });

      expect(result.deleted || result.totalDeleted > 0).toBe(true);

      // Cleanup space
      try {
        await cortex.memorySpaces.delete(spaceId, { cascade: true });
      } catch {
        // Ignore
      }
    });
  });

  describe("users deleteMany", () => {
    beforeAll(async () => {
      // Create users to bulk delete
      for (let i = 0; i < 3; i++) {
        await cortex.users.update(`${TEST_PREFIX}-bulk-${i}`, {
          name: `Bulk Delete ${i}`,
        });
      }
    });

    it("should delete multiple users", async () => {
      const userIds = [
        `${TEST_PREFIX}-bulk-0`,
        `${TEST_PREFIX}-bulk-1`,
        `${TEST_PREFIX}-bulk-2`,
      ];

      const result = await cortex.users.deleteMany(userIds);

      expect(result.deleted).toBeGreaterThanOrEqual(3);
    });
  });
});
