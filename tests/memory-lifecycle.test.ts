/**
 * Memory API Lifecycle Tests
 *
 * Multi-step integration tests for Memory API lifecycle workflows:
 * - remember → update → delete
 * - remember → archive → restore
 * - store → update (multiple) → getHistory
 * - deleteMany with facts cascade
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { api as _api } from "../convex-dev/_generated/api";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

describe("Memory Lifecycle Integration", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("lifecycle");
  const TEST_USER_ID = ctx.userId("lifecycle");
  const TEST_AGENT_ID = ctx.agentId("lifecycle");

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
  });

  afterAll(async () => {
    await client.close();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // remember → update → delete Lifecycle
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("remember → update → delete lifecycle", () => {
    it("completes full lifecycle with fact extraction", async () => {
      // Step 1: Create conversation for remember
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: {
          userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
          participantId: TEST_AGENT_ID,
        },
      });

      // Step 2: Remember with fact extraction
      const extractFacts = async (content: string) => [
        {
          fact: `Lifecycle fact: ${content.substring(0, 30)}`,
          factType: "preference" as const,
          confidence: 85,
          tags: ["lifecycle-test"],
        },
      ];

      const remembered = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: conv.conversationId,
        userMessage: "My favorite color is blue",
        agentResponse: "I'll remember that!",
        userId: TEST_USER_ID,
        userName: "Test User",
        agentId: TEST_AGENT_ID,
        extractFacts,
      });

      expect(remembered.memories.length).toBeGreaterThanOrEqual(1);
      expect(remembered.facts.length).toBeGreaterThanOrEqual(1);
      const userMemoryId = remembered.memories[0].memoryId;
      const originalFactId = remembered.facts[0].factId;

      // Verify memory is accessible
      const afterRemember = await cortex.memory.get(
        TEST_MEMSPACE_ID,
        userMemoryId,
      );
      expect(afterRemember).not.toBeNull();

      // Step 3: Update memory content
      const updated = await cortex.memory.update(
        TEST_MEMSPACE_ID,
        userMemoryId,
        { content: "My favorite color is now green" },
      );

      expect(updated.memory.content).toContain("green");
      expect(updated.memory.version).toBeGreaterThanOrEqual(2);

      // Verify version chain
      const history = await cortex.memory.getHistory(
        TEST_MEMSPACE_ID,
        userMemoryId,
      );
      expect(history.length).toBeGreaterThanOrEqual(2);

      // Step 4: Delete memory (should cascade to facts)
      const deleted = await cortex.memory.delete(
        TEST_MEMSPACE_ID,
        userMemoryId,
        {
          cascadeDeleteFacts: true,
        },
      );

      expect(deleted.deleted).toBe(true);
      expect(deleted.memoryId).toBe(userMemoryId);

      // Verify memory is gone
      const afterDelete = await cortex.memory.get(
        TEST_MEMSPACE_ID,
        userMemoryId,
      );
      expect(afterDelete).toBeNull();

      // Verify fact was cascade deleted (should be null or marked invalid)
      const factAfterDelete = await cortex.facts.get(
        TEST_MEMSPACE_ID,
        originalFactId,
      );
      if (factAfterDelete) {
        expect(factAfterDelete.validUntil).toBeDefined();
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // remember → archive → restore Lifecycle
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("remember → archive → restore lifecycle", () => {
    it("archives and restores memory preserving integrity", async () => {
      // Step 1: Create conversation
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: {
          userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
          participantId: TEST_AGENT_ID,
        },
      });

      // Step 2: Remember
      const remembered = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: conv.conversationId,
        userMessage: "Archive lifecycle test message",
        agentResponse: "Understood",
        userId: TEST_USER_ID,
        userName: "Test User",
        agentId: TEST_AGENT_ID,
      });

      const memoryId = remembered.memories[0].memoryId;
      const originalMemory = (await cortex.memory.get(
        TEST_MEMSPACE_ID,
        memoryId,
      )) as any;
      expect(originalMemory).not.toBeNull();
      const originalImportance = originalMemory!.importance;

      // Step 3: Archive memory
      const archiveResult = await cortex.memory.archive(
        TEST_MEMSPACE_ID,
        memoryId,
      );
      expect(archiveResult.archived).toBe(true);
      expect(archiveResult.restorable).toBe(true);

      // Verify archived state
      const archivedMemory = (await cortex.memory.get(
        TEST_MEMSPACE_ID,
        memoryId,
      )) as any;
      expect(archivedMemory).not.toBeNull();
      expect(archivedMemory!.tags).toContain("archived");
      expect(archivedMemory!.importance).toBeLessThan(originalImportance);

      // Step 4: Restore from archive
      const restoreResult = await cortex.memory.restoreFromArchive(
        TEST_MEMSPACE_ID,
        memoryId,
      );
      expect(restoreResult.restored).toBe(true);

      // Verify restored state
      const restoredMemory = (await cortex.memory.get(
        TEST_MEMSPACE_ID,
        memoryId,
      )) as any;
      expect(restoredMemory).not.toBeNull();
      expect(restoredMemory!.tags).not.toContain("archived");
      // Importance should be restored to a reasonable value (50+)
      expect(restoredMemory!.importance).toBeGreaterThanOrEqual(50);

      // Cleanup
      await cortex.memory.delete(TEST_MEMSPACE_ID, memoryId);
    });

    it("throws error when trying to restore non-archived memory", async () => {
      // Create a non-archived memory
      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Non-archived memory",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: ["restore-error-test"] },
      });

      // Try to restore - should fail
      await expect(
        cortex.memory.restoreFromArchive(TEST_MEMSPACE_ID, memory.memoryId),
      ).rejects.toThrow(/MEMORY_NOT_ARCHIVED|not archived/i);

      // Cleanup
      await cortex.memory.delete(TEST_MEMSPACE_ID, memory.memoryId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // store → update (multiple) → getHistory Lifecycle
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("store → update (multiple) → getHistory lifecycle", () => {
    it("maintains version chain integrity across multiple updates", async () => {
      // Step 1: Store initial memory
      const storeResult = await cortex.memory.store(TEST_MEMSPACE_ID, {
        content: "Version 1: Initial content",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: ["version-chain-test"] },
      });

      const memoryId = storeResult.memory.memoryId;
      expect(storeResult.memory.version).toBe(1);

      // Step 2: Multiple sequential updates
      const updateContents = [
        "Version 2: First update",
        "Version 3: Second update",
        "Version 4: Third update",
        "Version 5: Final update",
      ];

      for (let i = 0; i < updateContents.length; i++) {
        const updateResult = await cortex.memory.update(
          TEST_MEMSPACE_ID,
          memoryId,
          { content: updateContents[i] },
        );
        expect(updateResult.memory.content).toBe(updateContents[i]);
        expect(updateResult.memory.version).toBe(i + 2);
      }

      // Step 3: Verify history
      const history = await cortex.memory.getHistory(
        TEST_MEMSPACE_ID,
        memoryId,
      );
      expect(history.length).toBe(5);

      // Verify version order and content
      expect(history[0].content).toBe("Version 1: Initial content");
      expect(history[0].version).toBe(1);

      for (let i = 0; i < updateContents.length; i++) {
        expect(history[i + 1].content).toBe(updateContents[i]);
        expect(history[i + 1].version).toBe(i + 2);
      }

      // Step 4: Verify getVersion retrieves correct versions
      for (let v = 1; v <= 5; v++) {
        const versionResult = await cortex.memory.getVersion(
          TEST_MEMSPACE_ID,
          memoryId,
          v,
        );
        expect(versionResult).not.toBeNull();
        expect(versionResult!.version).toBe(v);
      }

      // Non-existent version should return null
      const noVersion = await cortex.memory.getVersion(
        TEST_MEMSPACE_ID,
        memoryId,
        99,
      );
      expect(noVersion).toBeNull();

      // Cleanup
      await cortex.memory.delete(TEST_MEMSPACE_ID, memoryId);
    });

    it("preserves metadata through version chain", async () => {
      const memory = await cortex.memory.store(TEST_MEMSPACE_ID, {
        content: "Metadata preservation test V1",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 70, tags: ["preserve-meta-test", "important"] },
      });

      // Verify initial metadata
      const initialMem = (await cortex.memory.get(
        TEST_MEMSPACE_ID,
        memory.memory.memoryId,
      )) as any;
      expect(initialMem.importance).toBe(70);
      expect(initialMem.tags).toContain("preserve-meta-test");

      // Update content but not metadata
      await cortex.memory.update(TEST_MEMSPACE_ID, memory.memory.memoryId, {
        content: "Metadata preservation test V2",
      });

      // Update importance
      await cortex.memory.update(TEST_MEMSPACE_ID, memory.memory.memoryId, {
        importance: 90,
      });

      // Verify history has correct version count
      const history = await cortex.memory.getHistory(
        TEST_MEMSPACE_ID,
        memory.memory.memoryId,
      );
      expect(history.length).toBe(3);
      expect(history[0].content).toBe("Metadata preservation test V1");
      expect(history[1].content).toBe("Metadata preservation test V2");
      // V3 keeps V2 content (importance-only update preserves content)
      expect(history[2].content).toBe("Metadata preservation test V2");

      // Verify latest memory has updated importance via get()
      const latestMem = (await cortex.memory.get(
        TEST_MEMSPACE_ID,
        memory.memory.memoryId,
      )) as any;
      expect(latestMem.importance).toBe(90);
      expect(latestMem.tags).toContain("preserve-meta-test"); // Tags preserved

      // Cleanup
      await cortex.memory.delete(TEST_MEMSPACE_ID, memory.memory.memoryId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // deleteMany with Facts Cascade
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("deleteMany with facts cascade", () => {
    it("cascade deletes facts for all deleted memories", async () => {
      const extractFacts = async (content: string) => [
        {
          fact: `Bulk fact: ${content.substring(0, 20)}`,
          factType: "knowledge" as const,
          confidence: 80,
          tags: ["bulk-cascade-test"],
        },
      ];

      // Create multiple memories with facts
      const memoryIds: string[] = [];
      const factIds: string[] = [];

      for (let i = 0; i < 5; i++) {
        const result = await cortex.memory.store(TEST_MEMSPACE_ID, {
          content: `Bulk delete test memory ${i}`,
          contentType: "raw",
          userId: `user-bulk-cascade-${ctx.runId}`,
          source: { type: "system", timestamp: Date.now() },
          metadata: { importance: 30, tags: ["bulk-cascade-test"] },
          extractFacts,
        });
        memoryIds.push(result.memory.memoryId);
        if (result.facts.length > 0) {
          factIds.push(result.facts[0].factId);
        }
      }

      expect(memoryIds.length).toBe(5);
      expect(factIds.length).toBe(5);

      // Delete all (cascade is automatic for deleteMany)
      const deleteResult = await cortex.memory.deleteMany({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: `user-bulk-cascade-${ctx.runId}`,
      });

      expect(deleteResult.deleted).toBeGreaterThanOrEqual(5);

      // Verify memories are gone
      for (const memId of memoryIds) {
        const mem = await cortex.memory.get(TEST_MEMSPACE_ID, memId);
        expect(mem).toBeNull();
      }

      // Verify facts are deleted or invalidated
      for (const factId of factIds) {
        const fact = await cortex.facts.get(TEST_MEMSPACE_ID, factId);
        if (fact) {
          // If fact still exists, it should be marked as invalid
          expect(fact.validUntil).toBeDefined();
        }
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Cross-Layer Integrity in Lifecycle
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("cross-layer integrity in lifecycle", () => {
    it("maintains conversation reference through update lifecycle", async () => {
      // Create conversation
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: {
          userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
          participantId: TEST_AGENT_ID,
        },
      });

      // Remember (creates conversation-linked memory)
      const remembered = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: conv.conversationId,
        userMessage: "Cross-layer integrity test",
        agentResponse: "Confirmed",
        userId: TEST_USER_ID,
        userName: "Test User",
        agentId: TEST_AGENT_ID,
      });

      const memoryId = remembered.memories[0].memoryId;

      // Update multiple times
      for (let i = 0; i < 3; i++) {
        await cortex.memory.update(TEST_MEMSPACE_ID, memoryId, {
          content: `Updated cross-layer ${i}`,
        });
      }

      // Verify history contains all versions
      const history = await cortex.memory.getHistory(
        TEST_MEMSPACE_ID,
        memoryId,
      );
      expect(history.length).toBeGreaterThanOrEqual(4); // Original + 3 updates

      // Verify conversation reference is maintained on current memory
      const currentMem = (await cortex.memory.get(
        TEST_MEMSPACE_ID,
        memoryId,
      )) as any;
      expect(currentMem).not.toBeNull();
      expect(currentMem.conversationRef).toBeDefined();
      expect(currentMem.conversationRef.conversationId).toBe(
        conv.conversationId,
      );

      // Verify get with includeConversation works after updates
      const enriched = await cortex.memory.get(TEST_MEMSPACE_ID, memoryId, {
        includeConversation: true,
      });
      expect(enriched).not.toBeNull();
      // When includeConversation is true, result is EnrichedMemory with conversation property
      expect((enriched as any).memory).toBeDefined();
      expect((enriched as any).conversation).toBeDefined();

      // Cleanup
      await cortex.memory.delete(TEST_MEMSPACE_ID, memoryId);
      await cortex.conversations.delete(conv.conversationId);
    });
  });
});
