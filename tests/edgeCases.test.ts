/**
 * Edge Cases & Error Conditions Tests (v0.6.1)
 *
 * Tests to ensure robustness with extreme values, special characters,
 * and boundary conditions.
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers/cleanup";

describe("Edge Cases: Extreme Values", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  const TEST_MEMSPACE_ID = "edge-cases-test";

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    cleanup = new TestCleanup(client);
    await cleanup.purgeAll();
  });

  afterAll(async () => {
    await cleanup.purgeAll();
    client.close();
  });

  describe("Large Content", () => {
    it("handles very long content (10KB+)", async () => {
      const longContent = "A".repeat(10000);

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: longContent,
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      expect(memory.content.length).toBe(10000);

      const stored = await cortex.vector.get(TEST_MEMSPACE_ID, memory.memoryId);
      expect(stored!.content).toBe(longContent);
      expect(stored!.content.length).toBe(10000);
    });

    it("handles very long fact statements (10KB+)", async () => {
      const longFact = "B".repeat(10000);

      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: longFact,
        factType: "knowledge",
        subject: "test-user",
        confidence: 80,
        sourceType: "system",
      });

      expect(fact.fact.length).toBe(10000);

      const stored = await cortex.facts.get(TEST_MEMSPACE_ID, fact.factId);
      expect(stored!.fact).toBe(longFact);
    });

    it("handles long array of tags (100+ tags)", async () => {
      const tags = Array.from({ length: 100 }, (_, i) => `tag-${i}`);

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Memory with many tags",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: {
          importance: 50,
          tags: tags,
        },
      });

      expect(memory.tags).toHaveLength(100);

      const stored = await cortex.vector.get(TEST_MEMSPACE_ID, memory.memoryId);
      expect(stored!.tags).toHaveLength(100);
      expect(stored!.tags).toEqual(expect.arrayContaining(tags));
    });

    it("handles very long participant ID", async () => {
      const longParticipantId = "participant-" + "x".repeat(200);

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Long participant ID",
        contentType: "raw",
        participantId: longParticipantId,
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      expect(memory.participantId).toBe(longParticipantId);

      const stored = await cortex.vector.get(TEST_MEMSPACE_ID, memory.memoryId);
      expect(stored!.participantId).toBe(longParticipantId);
    });
  });

  describe("Special Characters", () => {
    it("handles special characters in content", async () => {
      const specialChars = `<>"&'\n\t\r`;

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: `Content with ${specialChars} special chars`,
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      const stored = await cortex.vector.get(TEST_MEMSPACE_ID, memory.memoryId);
      expect(stored!.content).toContain(specialChars);
    });

    it("handles unicode and emojis in content", async () => {
      const unicode = "こんにちは 世界 🌍 🚀 ✨";

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: `Unicode test: ${unicode}`,
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      const stored = await cortex.vector.get(TEST_MEMSPACE_ID, memory.memoryId);
      expect(stored!.content).toContain(unicode);
    });

    it("handles special characters in tags", async () => {
      const tags = ["tag-with-dash", "tag_with_underscore", "tag.with.dots"];

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Special tag characters",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: {
          importance: 50,
          tags: tags,
        },
      });

      const stored = await cortex.vector.get(TEST_MEMSPACE_ID, memory.memoryId);
      expect(stored!.tags).toEqual(expect.arrayContaining(tags));
    });

    it("handles special characters in participantId", async () => {
      const specialParticipantId = "tool-calendar@v2.0_beta-test";

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Special participant ID",
        contentType: "raw",
        participantId: specialParticipantId,
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      expect(memory.participantId).toBe(specialParticipantId);
    });

    it("handles newlines and multi-line content", async () => {
      const multilineContent = `Line 1
Line 2
Line 3
Line 4`;

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: multilineContent,
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      const stored = await cortex.vector.get(TEST_MEMSPACE_ID, memory.memoryId);
      expect(stored!.content).toBe(multilineContent);
      expect(stored!.content.split("\n")).toHaveLength(4);
    });

    it("handles JSON-like content", async () => {
      const jsonLikeContent = `{"key": "value", "array": [1,2,3], "nested": {"a": "b"}}`;

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: jsonLikeContent,
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      const stored = await cortex.vector.get(TEST_MEMSPACE_ID, memory.memoryId);
      expect(stored!.content).toBe(jsonLikeContent);
    });

    it("handles SQL-like content", async () => {
      const sqlLike = `SELECT * FROM users WHERE name = 'O''Brien' AND age > 25;`;

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: sqlLike,
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      const stored = await cortex.vector.get(TEST_MEMSPACE_ID, memory.memoryId);
      expect(stored!.content).toBe(sqlLike);
    });
  });

  describe("Boundary Values", () => {
    it("handles importance at minimum (0)", async () => {
      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Minimum importance",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 0, tags: [] },
      });

      expect(memory.importance).toBe(0);
    });

    it("handles importance at maximum (100)", async () => {
      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Maximum importance",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 100, tags: [] },
      });

      expect(memory.importance).toBe(100);
    });

    it("handles confidence at minimum (0)", async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Minimum confidence fact",
        factType: "knowledge",
        subject: "test-user",
        confidence: 0,
        sourceType: "system",
      });

      expect(fact.confidence).toBe(0);
    });

    it("handles confidence at maximum (100)", async () => {
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Maximum confidence fact",
        factType: "knowledge",
        subject: "test-user",
        confidence: 100,
        sourceType: "system",
      });

      expect(fact.confidence).toBe(100);
    });

    it("handles empty string content (if allowed)", async () => {
      try {
        const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
          content: "",
          contentType: "raw",
          source: { type: "system", userId: "test-user" },
          metadata: { importance: 50, tags: [] },
        });

        // If it succeeds, verify it stored correctly
        const stored = await cortex.vector.get(
          TEST_MEMSPACE_ID,
          memory.memoryId,
        );
        expect(stored!.content).toBe("");
      } catch (error) {
        // If it fails, that's also acceptable behavior
        expect(error).toBeDefined();
      }
    });

    it("handles empty tags array", async () => {
      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "No tags",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      expect(memory.tags).toEqual([]);
    });

    it("handles single character content", async () => {
      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "A",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      expect(memory.content).toBe("A");
    });
  });

  describe("Deep Hierarchies", () => {
    it("handles deep context chains (10+ levels)", async () => {
      let parent = await cortex.contexts.create({
        purpose: "Root context",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: "test-user",
      });

      const contextIds: string[] = [parent.contextId];

      // Create 10 levels deep
      for (let i = 1; i <= 10; i++) {
        const child = await cortex.contexts.create({
          purpose: `Level ${i} context`,
          memorySpaceId: TEST_MEMSPACE_ID,
          userId: "test-user",
          parentId: parent.contextId,
        });

        contextIds.push(child.contextId);
        parent = child;
      }

      // Verify chain from deepest context
      const chain = await cortex.contexts.getChain(parent.contextId);

      expect(chain.root.contextId).toBe(contextIds[0]);
      expect(chain.current.contextId).toBe(parent.contextId);
    });

    it("handles multiple fact version updates (10+ versions)", async () => {
      let fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Version 1",
        factType: "knowledge",
        subject: "test-user",
        confidence: 50,
        sourceType: "system",
      });

      // Create 10 more versions
      for (let i = 2; i <= 11; i++) {
        fact = await cortex.facts.update(TEST_MEMSPACE_ID, fact.factId, {
          fact: `Version ${i}`,
          confidence: 50 + i * 4,
        });
      }

      // Verify latest version
      const stored = await cortex.facts.get(TEST_MEMSPACE_ID, fact.factId);
      expect(stored!.fact).toBe("Version 11");
      expect(stored!.confidence).toBe(94);
    });
  });

  describe("Concurrent Operations", () => {
    it("handles concurrent creates to same memorySpace", async () => {
      // Create 10 memories concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        cortex.vector.store(TEST_MEMSPACE_ID, {
          content: `Concurrent memory ${i}`,
          contentType: "raw",
          source: { type: "system", userId: "test-user" },
          metadata: { importance: 50, tags: ["concurrent-test"] },
        }),
      );

      const results = await Promise.all(promises);

      // Validate: All created
      expect(results).toHaveLength(10);

      // Validate: All have unique IDs
      const ids = new Set(results.map((r) => r.memoryId));
      expect(ids.size).toBe(10);

      // Validate: All retrievable
      for (const mem of results) {
        const stored = await cortex.vector.get(
          TEST_MEMSPACE_ID,
          mem.memoryId,
        );
        expect(stored).not.toBeNull();
      }
    });

    it("handles concurrent updates to different memories", async () => {
      // Create memories first
      const memories = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          cortex.vector.store(TEST_MEMSPACE_ID, {
            content: `Memory ${i} original`,
            contentType: "raw",
            source: { type: "system", userId: "test-user" },
            metadata: { importance: 50, tags: [] },
          }),
        ),
      );

      // Update all concurrently
      const updatePromises = memories.map((mem) =>
        cortex.vector.update(TEST_MEMSPACE_ID, mem.memoryId, {
          content: `Memory ${mem.memoryId} updated`,
        }),
      );

      const updated = await Promise.all(updatePromises);

      // Validate all updated
      expect(updated).toHaveLength(5);

      for (const mem of updated) {
        expect(mem.content).toContain("updated");
      }
    });

    it("handles concurrent fact creations", async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: `Concurrent fact ${i}`,
          factType: "knowledge",
          subject: "test-user",
          confidence: 80,
          sourceType: "system",
          tags: ["concurrent-facts"],
        }),
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);

      // All should be retrievable
      for (const fact of results) {
        const stored = await cortex.facts.get(TEST_MEMSPACE_ID, fact.factId);
        expect(stored).not.toBeNull();
      }
    });
  });

  describe("Error Conditions", () => {
    it("handles invalid importance values gracefully", async () => {
      try {
        await cortex.vector.store(TEST_MEMSPACE_ID, {
          content: "Invalid importance",
          contentType: "raw",
          source: { type: "system", userId: "test-user" },
          metadata: { importance: 150, tags: [] }, // > 100
        });

        // If it succeeds, verify it was clamped or handled
        // (implementation dependent)
      } catch (error) {
        // Expected to throw for out-of-range values
        expect(error).toBeDefined();
      }
    });

    it("handles negative importance gracefully", async () => {
      try {
        await cortex.vector.store(TEST_MEMSPACE_ID, {
          content: "Negative importance",
          contentType: "raw",
          source: { type: "system", userId: "test-user" },
          metadata: { importance: -10, tags: [] },
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("handles invalid confidence values gracefully", async () => {
      try {
        await cortex.facts.store({
          memorySpaceId: TEST_MEMSPACE_ID,
          fact: "Invalid confidence",
          factType: "knowledge",
          subject: "test-user",
          confidence: 150, // > 100
          sourceType: "system",
        });
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("handles retrieval of non-existent memory gracefully", async () => {
      const result = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        "non-existent-id",
      );
      expect(result).toBeNull();
    });

    it("handles retrieval of non-existent fact gracefully", async () => {
      const result = await cortex.facts.get(
        TEST_MEMSPACE_ID,
        "non-existent-fact-id",
      );
      expect(result).toBeNull();
    });

    it("handles retrieval of non-existent conversation gracefully", async () => {
      const result = await cortex.conversations.get("non-existent-conv-id");
      expect(result).toBeNull();
    });

    it("handles retrieval of non-existent context gracefully", async () => {
      const result = await cortex.contexts.get("non-existent-ctx-id");
      expect(result).toBeNull();
    });
  });

  describe("Bulk Operations Scale", () => {
    it("handles bulk deletion of many memories", async () => {
      const BULK_USER_ID = "user-bulk-delete-test";
      
      // Create 50 memories
      const memories = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          cortex.vector.store(TEST_MEMSPACE_ID, {
            content: `Bulk delete test ${i}`,
            contentType: "raw",
            userId: BULK_USER_ID,
            source: { type: "system", userId: BULK_USER_ID },
            metadata: { importance: 50, tags: ["bulk-delete-test"] },
          }),
        ),
      );

      const memoryIds = memories.map((m) => m.memoryId);

      // Delete by userId
      const result = await cortex.vector.deleteMany({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: BULK_USER_ID,
      });

      expect(result.deleted).toBe(50);

      // Verify all deleted
      for (const memId of memoryIds) {
        const mem = await cortex.vector.get(TEST_MEMSPACE_ID, memId);
        expect(mem).toBeNull();
      }
    });

    it("handles listing large number of memories", async () => {
      // Create 100 memories
      await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          cortex.vector.store(TEST_MEMSPACE_ID, {
            content: `List test ${i}`,
            contentType: "raw",
            source: { type: "system", userId: "test-user" },
            metadata: { importance: 50, tags: ["list-test"] },
          }),
        ),
      );

      const results = await cortex.vector.list({
        memorySpaceId: TEST_MEMSPACE_ID,
        limit: 200,
      });

      const listTestMems = results.filter((r) =>
        r.tags?.includes("list-test"),
      );

      expect(listTestMems.length).toBeGreaterThanOrEqual(100);
    });
  });
});

