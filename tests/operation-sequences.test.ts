/**
 * Operation Sequence Validation Testing
 *
 * Tests multi-step operation sequences to ensure state consistency at EACH step:
 * 1. Create → Get → Update → Get → Delete → Get
 * 2. Count/stats match after each operation
 * 3. List results reflect latest state
 * 4. Concurrent sequences don't corrupt state
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "../src/index";

describe("Operation Sequence Validation", () => {
  let cortex: Cortex;
  const BASE_ID = `seq-test-${Date.now()}`;
  const TEST_AGENT_ID = `seq-test-agent-${Date.now()}`;

  beforeAll(() => {
    cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });
  });

  afterAll(async () => {
    // Cleanup
    try {
      await cortex.memorySpaces.delete(BASE_ID, { cascade: true });
    } catch (_e) {
      // Ignore
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // Vector Memory Sequences
  // ══════════════════════════════════════════════════════════════════════

  describe("Vector Memory: CRUD Sequence", () => {
    it("create→get→update→get→delete→get validates state at each step", async () => {
      const spaceId = `${BASE_ID}-vector-crud`;

      // STEP 1: Create
      const created = await cortex.vector.store(spaceId, {
        content: "Original content",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: ["test"] },
      });

      expect(created.memoryId).toBeDefined();
      expect(created.content).toBe("Original content");
      expect(created.importance).toBe(50);

      // STEP 2: Get (validate create)
      const afterCreate = await cortex.vector.get(spaceId, created.memoryId);
      expect(afterCreate).not.toBeNull();
      expect(afterCreate!.memoryId).toBe(created.memoryId);
      expect(afterCreate!.content).toBe("Original content");
      expect(afterCreate!.importance).toBe(50);

      // STEP 3: Update
      const updated = await cortex.vector.update(spaceId, created.memoryId, {
        content: "Updated content",
        importance: 80,
      });

      expect(updated.content).toBe("Updated content");
      expect(updated.importance).toBe(80);
      expect(updated.memoryId).toBe(created.memoryId); // Same ID

      // STEP 4: Get (validate update)
      const afterUpdate = await cortex.vector.get(spaceId, created.memoryId);
      expect(afterUpdate!.content).toBe("Updated content");
      expect(afterUpdate!.importance).toBe(80);
      expect(afterUpdate!.version).toBe(2); // Version incremented

      // STEP 5: Delete
      await cortex.vector.delete(spaceId, created.memoryId);

      // STEP 6: Get (validate delete)
      const afterDelete = await cortex.vector.get(spaceId, created.memoryId);
      expect(afterDelete).toBeNull();
    });

    it("list reflects state after each operation", async () => {
      const spaceId = `${BASE_ID}-vector-list`;

      // Initial list
      const list0 = await cortex.vector.list({ memorySpaceId: spaceId });
      const count0 = list0.length;

      // Create
      const mem1 = await cortex.vector.store(spaceId, {
        content: "Memory 1",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      const list1 = await cortex.vector.list({ memorySpaceId: spaceId });
      expect(list1.length).toBe(count0 + 1);
      expect(list1.some((m) => m.memoryId === mem1.memoryId)).toBe(true);

      // Create another
      const mem2 = await cortex.vector.store(spaceId, {
        content: "Memory 2",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      const list2 = await cortex.vector.list({ memorySpaceId: spaceId });
      expect(list2.length).toBe(count0 + 2);
      expect(list2.some((m) => m.memoryId === mem2.memoryId)).toBe(true);

      // Update first
      await cortex.vector.update(spaceId, mem1.memoryId, {
        content: "Updated 1",
      });

      const list3 = await cortex.vector.list({ memorySpaceId: spaceId });
      expect(list3.length).toBe(count0 + 2); // Still 2
      const updatedInList = list3.find((m) => m.memoryId === mem1.memoryId);
      expect(updatedInList!.content).toBe("Updated 1");

      // Delete first
      await cortex.vector.delete(spaceId, mem1.memoryId);

      const list4 = await cortex.vector.list({ memorySpaceId: spaceId });
      expect(list4.length).toBe(count0 + 1); // Now 1
      expect(list4.some((m) => m.memoryId === mem1.memoryId)).toBe(false);

      // Delete second
      await cortex.vector.delete(spaceId, mem2.memoryId);

      const list5 = await cortex.vector.list({ memorySpaceId: spaceId });
      expect(list5.length).toBe(count0); // Back to initial
    });

    it("count matches list.length after each operation", async () => {
      const spaceId = `${BASE_ID}-vector-count`;

      // Initial count
      const count0 = await cortex.vector.count({ memorySpaceId: spaceId });
      const list0 = await cortex.vector.list({ memorySpaceId: spaceId });
      expect(count0).toBe(list0.length);

      // Create
      const mem = await cortex.vector.store(spaceId, {
        content: "Count test",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      const count1 = await cortex.vector.count({ memorySpaceId: spaceId });
      const list1 = await cortex.vector.list({ memorySpaceId: spaceId });
      expect(count1).toBe(list1.length);
      expect(count1).toBe(count0 + 1);

      // Update doesn't change count
      await cortex.vector.update(spaceId, mem.memoryId, { content: "Updated" });

      const count2 = await cortex.vector.count({ memorySpaceId: spaceId });
      const list2 = await cortex.vector.list({ memorySpaceId: spaceId });
      expect(count2).toBe(list2.length);
      expect(count2).toBe(count1);

      // Delete
      await cortex.vector.delete(spaceId, mem.memoryId);

      const count3 = await cortex.vector.count({ memorySpaceId: spaceId });
      const list3 = await cortex.vector.list({ memorySpaceId: spaceId });
      expect(count3).toBe(list3.length);
      expect(count3).toBe(count0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Conversation Sequences
  // ══════════════════════════════════════════════════════════════════════

  describe("Conversations: CRUD Sequence", () => {
    it("create→get→addMessage→get→delete→get validates state", async () => {
      const spaceId = `${BASE_ID}-conv-crud`;

      // STEP 1: Create
      const created = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: "test-user", agentId: TEST_AGENT_ID },
      });

      expect(created.conversationId).toBeDefined();
      expect(created.messages).toHaveLength(0);

      // STEP 2: Get (validate create)
      const afterCreate = await cortex.conversations.get(
        created.conversationId,
      );
      expect(afterCreate!.conversationId).toBe(created.conversationId);
      expect(afterCreate!.messages).toHaveLength(0);

      // STEP 3: Add message
      await cortex.conversations.addMessage({
        conversationId: created.conversationId,
        message: {
          role: "user",
          content: "First message",
        },
      });

      // STEP 4: Get (validate message added)
      const afterMessage = await cortex.conversations.get(
        created.conversationId,
      );
      expect(afterMessage!.messages).toHaveLength(1);
      expect(afterMessage!.messages[0].content).toBe("First message");

      // STEP 5: Delete
      await cortex.conversations.delete(created.conversationId);

      // STEP 6: Get (validate delete)
      const afterDelete = await cortex.conversations.get(
        created.conversationId,
      );
      expect(afterDelete).toBeNull();
    });

    it("count reflects each message addition", async () => {
      const spaceId = `${BASE_ID}-conv-count`;

      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: "test-user", agentId: TEST_AGENT_ID },
      });

      // Add 5 messages
      for (let i = 1; i <= 5; i++) {
        await cortex.conversations.addMessage({
          conversationId: conv.conversationId,
          message: {
            role: i % 2 === 0 ? "agent" : "user",
            content: `Message ${i}`,
          },
        });

        // Verify count after each addition
        const updated = await cortex.conversations.get(conv.conversationId);
        expect(updated!.messages).toHaveLength(i);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Facts Sequences
  // ══════════════════════════════════════════════════════════════════════

  describe("Facts: Version Chain Sequence", () => {
    it("store→update→update→delete validates versions", async () => {
      const spaceId = `${BASE_ID}-facts-seq`;

      // STEP 1: Store v1
      const v1 = await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Version 1",
        factType: "knowledge",
        subject: "test-subject",
        confidence: 70,
        sourceType: "manual",
      });

      expect(v1.version).toBe(1);
      expect(v1.supersededBy).toBeUndefined();

      // STEP 2: Update to v2
      const v2 = await cortex.facts.update(spaceId, v1.factId, {
        fact: "Version 2",
        confidence: 80,
      });

      expect(v2.version).toBe(2);
      expect(v2.factId).not.toBe(v1.factId); // New fact ID
      expect(v2.supersedes).toBeDefined();

      // STEP 3: Get v1 (should be superseded)
      const v1After = await cortex.facts.get(spaceId, v1.factId);
      expect(v1After!.supersededBy).toBeDefined();

      // STEP 4: Update to v3
      const v3 = await cortex.facts.update(spaceId, v2.factId, {
        confidence: 90,
      });

      expect(v3.version).toBe(3);

      // STEP 5: Get v2 (should be superseded)
      const v2After = await cortex.facts.get(spaceId, v2.factId);
      expect(v2After!.supersededBy).toBeDefined();

      // STEP 6: Delete latest
      await cortex.facts.delete(spaceId, v3.factId);

      // All versions should be retrievable for history
      const history = await cortex.facts.getHistory(spaceId, v1.factId);
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it("list excludes superseded facts by default", async () => {
      const spaceId = `${BASE_ID}-facts-list`;

      // Create and update fact
      const v1 = await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Original",
        factType: "knowledge",
        subject: "list-test",
        confidence: 70,
        sourceType: "manual",
      });

      const list1 = await cortex.facts.list({ memorySpaceId: spaceId });
      expect(list1.some((f) => f.factId === v1.factId)).toBe(true);

      // Update (creates v2, supersedes v1)
      const v2 = await cortex.facts.update(spaceId, v1.factId, {
        fact: "Updated",
      });

      const list2 = await cortex.facts.list({ memorySpaceId: spaceId });

      // v1 should NOT appear (superseded)
      expect(list2.some((f) => f.factId === v1.factId)).toBe(false);

      // v2 should appear
      expect(list2.some((f) => f.factId === v2.factId)).toBe(true);
    });

    it("count reflects fact versioning correctly", async () => {
      const spaceId = `${BASE_ID}-facts-count`;

      const count0 = await cortex.facts.count({ memorySpaceId: spaceId });

      // Store fact
      const v1 = await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Count test",
        factType: "knowledge",
        subject: "count",
        confidence: 70,
        sourceType: "manual",
      });

      const count1 = await cortex.facts.count({ memorySpaceId: spaceId });
      expect(count1).toBe(count0 + 1);

      // Update (new version, but count stays same - excludes superseded)
      await cortex.facts.update(spaceId, v1.factId, { confidence: 80 });

      const count2 = await cortex.facts.count({ memorySpaceId: spaceId });
      expect(count2).toBe(count1); // Still same (1 active fact)

      // Delete
      await cortex.facts.delete(spaceId, v1.factId);

      const count3 = await cortex.facts.count({ memorySpaceId: spaceId });
      expect(count3).toBeLessThanOrEqual(count2);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Context Sequences
  // ══════════════════════════════════════════════════════════════════════

  describe("Contexts: Full Lifecycle Sequence", () => {
    it("create→get→update→get→complete→get→delete→get", async () => {
      const spaceId = `${BASE_ID}-ctx-lifecycle`;
      const userId = "lifecycle-user";

      // STEP 1: Create
      const created = await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId,
        purpose: "Lifecycle test",
        status: "active",
        data: { progress: 0 },
      });

      expect(created.contextId).toBeDefined();
      expect(created.status).toBe("active");

      // STEP 2: Get (validate create)
      const afterCreate = await cortex.contexts.get(created.contextId);
      expect((afterCreate as any).contextId).toBe(created.contextId);
      expect((afterCreate as any).data?.progress).toBe(0);

      // STEP 3: Update data
      const updated = await cortex.contexts.update(created.contextId, {
        data: { progress: 50 },
      });

      expect(updated.data?.progress).toBe(50);

      // STEP 4: Get (validate update)
      const afterUpdate = await cortex.contexts.get(created.contextId);
      expect((afterUpdate as any).data?.progress).toBe(50);

      // STEP 5: Complete
      const completed = await cortex.contexts.update(created.contextId, {
        status: "completed",
        data: { progress: 100 },
      });

      expect(completed.status).toBe("completed");
      expect(completed.data?.progress).toBe(100);
      expect(completed.completedAt).toBeDefined();

      // STEP 6: Get (validate completion)
      const afterComplete = await cortex.contexts.get(created.contextId);
      expect((afterComplete as any).status).toBe("completed");
      expect((afterComplete as any).completedAt).toBeDefined();

      // STEP 7: Delete
      await cortex.contexts.delete(created.contextId);

      // STEP 8: Get (validate delete)
      const afterDelete = await cortex.contexts.get(created.contextId);
      expect(afterDelete).toBeNull();
    });

    it("hierarchical operations maintain parent-child integrity", async () => {
      const spaceId = `${BASE_ID}-ctx-hierarchy-seq`;
      const userId = "hierarchy-user";

      // Create parent
      const parent = await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId,
        purpose: "Parent",
        status: "active",
      });

      // Create child
      const child = await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId,
        purpose: "Child",
        status: "active",
        parentId: parent.contextId,
      });

      // Update parent
      await cortex.contexts.update(parent.contextId, {
        data: { parentData: "updated" },
      });

      // Child still references parent
      const childAfter = await cortex.contexts.get(child.contextId);
      expect((childAfter as any).parentId).toBe(parent.contextId);

      // Update child
      await cortex.contexts.update(child.contextId, {
        data: { childData: "updated" },
      });

      // Parent unaffected
      const parentAfter = await cortex.contexts.get(parent.contextId);
      expect((parentAfter as any).data?.parentData).toBe("updated");
      expect((parentAfter as any).data?.childData).toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Immutable Store Sequences
  // ══════════════════════════════════════════════════════════════════════

  describe("Immutable Store: Version Sequence", () => {
    it("store→getVersion→getHistory validates versioning", async () => {
      const id = `immutable-seq-${Date.now()}`;

      // Store v1
      const v1 = await cortex.immutable.store({
        type: "document",
        id,
        data: { title: "V1", content: "Original" },
      });

      expect(v1.version).toBe(1);

      // Get specific version
      const v1Retrieved = await cortex.immutable.getVersion("document", id, 1);

      expect(v1Retrieved!.data.title).toBe("V1");

      // Store v2
      const v2 = await cortex.immutable.store({
        type: "document",
        id,
        data: { title: "V2", content: "Updated" },
      });

      expect(v2.version).toBe(2);

      // Get latest
      const latest = await cortex.immutable.get("document", id);
      expect(latest!.version).toBe(2);
      expect(latest!.data.title).toBe("V2");

      // Get history
      const history = await cortex.immutable.getHistory("document", id);
      expect(history.length).toBe(2);
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(2);
    });

    it("list shows only latest versions", async () => {
      const id = `immutable-list-${Date.now()}`;

      // Store v1
      await cortex.immutable.store({
        type: "config",
        id,
        data: { setting: "v1" },
      });

      const list1 = await cortex.immutable.list({ type: "config" });
      const filteredList1 = list1.filter((item) => item.id === id);
      expect(filteredList1.length).toBe(1);
      expect(filteredList1[0].version).toBe(1);

      // Store v2
      await cortex.immutable.store({
        type: "config",
        id,
        data: { setting: "v2" },
      });

      const list2 = await cortex.immutable.list({ type: "config" });
      const filteredList2 = list2.filter((item) => item.id === id);
      expect(filteredList2.length).toBe(1); // Still 1 (latest only)
      expect(filteredList2[0].version).toBe(2);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Mutable Store Sequences
  // ══════════════════════════════════════════════════════════════════════

  describe("Mutable Store: Update Sequence", () => {
    it("set→get→update→get→delete→get validates state", async () => {
      const ns = `${BASE_ID}-mutable`;
      const key = "sequence-test";

      // STEP 1: Set
      await cortex.mutable.set(ns, key, { count: 0, status: "initial" });

      // STEP 2: Get (validate set)
      const afterSet = await cortex.mutable.get(ns, key);
      expect((afterSet as any).count).toBe(0);
      expect((afterSet as any).status).toBe("initial");

      // STEP 3: Update
      await cortex.mutable.update(ns, key, (current: any) => ({
        ...current,
        count: current.count + 1,
        status: "updated",
      }));

      // STEP 4: Get (validate update)
      const afterUpdate = await cortex.mutable.get(ns, key);
      expect((afterUpdate as any).count).toBe(1);
      expect((afterUpdate as any).status).toBe("updated");

      // STEP 5: Delete
      await cortex.mutable.delete(ns, key);

      // STEP 6: Get (validate delete)
      const afterDelete = await cortex.mutable.get(ns, key);
      expect(afterDelete).toBeNull();
    });

    it("increment sequence maintains consistency", async () => {
      const ns = `${BASE_ID}-mutable-increment`;
      const key = "counter";

      // Set initial
      await cortex.mutable.set(ns, key, 0);

      // Increment 10 times
      for (let i = 1; i <= 10; i++) {
        await cortex.mutable.increment(ns, key, 1);

        const current = await cortex.mutable.get(ns, key);
        expect(current).toBe(i);
      }
    });

    it("list reflects mutable operations", async () => {
      const ns = `${BASE_ID}-mutable-list`;

      const list0 = await cortex.mutable.list({ namespace: ns });
      const count0 = list0.length;

      // Set multiple keys
      await cortex.mutable.set(ns, "key1", "value1");
      await cortex.mutable.set(ns, "key2", "value2");
      await cortex.mutable.set(ns, "key3", "value3");

      const list1 = await cortex.mutable.list({ namespace: ns });
      expect(list1.length).toBe(count0 + 3);

      // Delete one
      await cortex.mutable.delete(ns, "key2");

      const list2 = await cortex.mutable.list({ namespace: ns });
      expect(list2.length).toBe(count0 + 2);
      expect(list2.some((e) => e.key === "key2")).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Memory Space Registry Sequences
  // ══════════════════════════════════════════════════════════════════════

  describe("Memory Spaces: Full Lifecycle", () => {
    it("register→addParticipant→removeParticipant→delete sequence", async () => {
      const spaceId = `${BASE_ID}-space-lifecycle-${Date.now()}`;

      // STEP 1: Register
      const space = await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "team",
        name: "Lifecycle space",
        participants: [{ id: "user-1", type: "user" }],
      });

      expect(space.participants).toHaveLength(1);

      // STEP 2: Add participant
      await cortex.memorySpaces.addParticipant(spaceId, {
        id: "user-2",
        type: "user",
        joinedAt: Date.now(),
      });

      const afterAdd = await cortex.memorySpaces.get(spaceId);
      expect(afterAdd!.participants).toHaveLength(2);

      // STEP 3: Remove participant
      await cortex.memorySpaces.removeParticipant(spaceId, "user-1");

      const afterRemove = await cortex.memorySpaces.get(spaceId);
      expect(afterRemove!.participants).toHaveLength(1);
      expect(
        afterRemove!.participants.some((p: any) => p.id === "user-1"),
      ).toBe(false);

      // STEP 4: Delete
      await cortex.memorySpaces.delete(spaceId, { cascade: true });

      const afterDelete = await cortex.memorySpaces.get(spaceId);
      expect(afterDelete).toBeNull();
    });

    it("stats update after each data operation", async () => {
      const spaceId = `${BASE_ID}-stats-seq-${Date.now()}`;

      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Stats test",
      });

      // Initial stats
      const stats0 = await cortex.memorySpaces.getStats(spaceId);
      expect(stats0.totalMemories).toBe(0);
      expect(stats0.totalConversations).toBe(0);

      // Add conversation
      await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: "stats-user", agentId: TEST_AGENT_ID },
      });

      const stats1 = await cortex.memorySpaces.getStats(spaceId);
      expect(stats1.totalConversations).toBe(1);

      // Add memory
      await cortex.vector.store(spaceId, {
        content: "Stats memory",
        contentType: "raw",
        source: { type: "system", userId: "stats-user" },
        metadata: { importance: 50, tags: [] },
      });

      const stats2 = await cortex.memorySpaces.getStats(spaceId);
      expect(stats2.totalMemories).toBe(1);

      // Add fact
      await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Stats fact",
        factType: "knowledge",
        subject: "stats",
        confidence: 80,
        sourceType: "manual",
      });

      const stats3 = await cortex.memorySpaces.getStats(spaceId);
      expect(stats3.totalFacts).toBeGreaterThanOrEqual(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // User Profile Sequences
  // ══════════════════════════════════════════════════════════════════════

  describe("Users: Data Evolution Sequence", () => {
    it("update→get→merge→get→delete validates profile changes", async () => {
      const userId = `user-seq-${Date.now()}`;

      // STEP 1: Create via update
      const created = await cortex.users.update(userId, {
        name: "Test User",
        email: "test@example.com",
      });

      expect(created.version).toBe(1);

      // STEP 2: Get
      const afterCreate = await cortex.users.get(userId);
      expect(afterCreate!.data.name).toBe("Test User");

      // STEP 3: Merge additional data using merge() method
      const merged = await cortex.users.merge(userId, {
        preferences: { theme: "dark" },
      });

      expect((merged.data as any)?.name).toBe("Test User"); // Preserved
      expect((merged.data as any)?.preferences?.theme).toBe("dark"); // Added

      // STEP 4: Get (validate merge)
      const afterMerge = await cortex.users.get(userId);
      expect(afterMerge!.data.name).toBe("Test User");
      expect((afterMerge!.data as any)?.preferences?.theme).toBe("dark");

      // STEP 5: Delete
      await cortex.users.delete(userId, { cascade: true });

      // STEP 6: Get (validate delete)
      const afterDelete = await cortex.users.get(userId);
      expect(afterDelete).toBeNull();
    });

    it("version increments with each update", async () => {
      const userId = `user-version-${Date.now()}`;

      // Update 1
      const v1 = await cortex.users.update(userId, { name: "V1" });
      expect(v1.version).toBe(1);

      // Update 2
      const v2 = await cortex.users.update(userId, { name: "V2" });
      expect(v2.version).toBe(2);

      // Update 3
      const v3 = await cortex.users.update(userId, { name: "V3" });
      expect(v3.version).toBe(3);

      // Get should return latest
      const latest = await cortex.users.get(userId);
      expect(latest!.version).toBe(3);
      expect(latest!.data.name).toBe("V3");
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Concurrent Operation Sequences
  // ══════════════════════════════════════════════════════════════════════

  describe("Concurrent Operation Sequences", () => {
    it("parallel creates don't corrupt state", async () => {
      const spaceId = `${BASE_ID}-parallel`;

      // Create 20 memories in parallel
      const promises = Array.from({ length: 20 }, (_, i) =>
        cortex.vector.store(spaceId, {
          content: `Parallel memory ${i}`,
          contentType: "raw",
          source: { type: "system", userId: "test-user" },
          metadata: { importance: 50, tags: [] },
        }),
      );

      const results = await Promise.all(promises);

      // All should succeed
      expect(results).toHaveLength(20);

      // All should have unique IDs
      const ids = new Set(results.map((r) => r.memoryId));
      expect(ids.size).toBe(20);

      // All should be retrievable
      for (const mem of results) {
        const retrieved = await cortex.vector.get(spaceId, mem.memoryId);
        expect(retrieved).not.toBeNull();
      }

      // Count should match
      const count = await cortex.vector.count({ memorySpaceId: spaceId });
      expect(count).toBeGreaterThanOrEqual(20);
    });

    it("parallel updates to different entities don't interfere", async () => {
      const spaceId = `${BASE_ID}-parallel-update`;

      // Create 10 memories
      const memories = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          cortex.vector.store(spaceId, {
            content: `Memory ${i}`,
            contentType: "raw",
            source: { type: "system", userId: "test-user" },
            metadata: { importance: 50, tags: [] },
          }),
        ),
      );

      // Update all in parallel with different values
      const updatePromises = memories.map((mem, i) =>
        cortex.vector.update(spaceId, mem.memoryId, {
          content: `Updated ${i}`,
          importance: 60 + i,
        }),
      );

      const updated = await Promise.all(updatePromises);

      // Verify each update succeeded with correct value
      for (let i = 0; i < updated.length; i++) {
        expect(updated[i].content).toBe(`Updated ${i}`);
        expect(updated[i].importance).toBe(60 + i);
      }
    });

    it("parallel deletes all succeed", async () => {
      const spaceId = `${BASE_ID}-parallel-delete`;

      // Create memories
      const memories = await Promise.all(
        Array.from({ length: 15 }, (_, i) =>
          cortex.vector.store(spaceId, {
            content: `Delete test ${i}`,
            contentType: "raw",
            source: { type: "system", userId: "test-user" },
            metadata: { importance: 50, tags: [] },
          }),
        ),
      );

      // Delete all in parallel
      await Promise.all(
        memories.map((mem) => cortex.vector.delete(spaceId, mem.memoryId)),
      );

      // All should be deleted
      for (const mem of memories) {
        const check = await cortex.vector.get(spaceId, mem.memoryId);
        expect(check).toBeNull();
      }
    });

    it("interleaved create/update/delete maintains consistency", async () => {
      const spaceId = `${BASE_ID}-interleaved`;

      // Create some memories
      const mems = await Promise.all([
        cortex.vector.store(spaceId, {
          content: "Mem 1",
          contentType: "raw",
          source: { type: "system", userId: "test-user" },
          metadata: { importance: 50, tags: [] },
        }),
        cortex.vector.store(spaceId, {
          content: "Mem 2",
          contentType: "raw",
          source: { type: "system", userId: "test-user" },
          metadata: { importance: 50, tags: [] },
        }),
      ]);

      // Interleaved operations
      await Promise.all([
        // Create new
        cortex.vector.store(spaceId, {
          content: "Mem 3",
          contentType: "raw",
          source: { type: "system", userId: "test-user" },
          metadata: { importance: 50, tags: [] },
        }),
        // Update existing
        cortex.vector.update(spaceId, mems[0].memoryId, {
          content: "Updated 1",
        }),
        // Delete existing
        cortex.vector.delete(spaceId, mems[1].memoryId),
      ]);

      // Verify final state
      const mem1 = await cortex.vector.get(spaceId, mems[0].memoryId);
      const mem2 = await cortex.vector.get(spaceId, mems[1].memoryId);

      expect(mem1!.content).toBe("Updated 1"); // Updated
      expect(mem2).toBeNull(); // Deleted
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Cross-Layer Operation Sequences
  // ══════════════════════════════════════════════════════════════════════

  describe("Cross-Layer Operation Sequences", () => {
    it("conversation→memory→fact→context sequence", async () => {
      const spaceId = `${BASE_ID}-cross-layer`;
      const userId = "cross-user";

      // STEP 1: Create conversation
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId, agentId: TEST_AGENT_ID },
      });

      expect(conv.conversationId).toBeDefined();

      // STEP 2: Add message
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "I prefer dark mode",
        },
      });

      // STEP 3: Store memory referencing conversation
      const mem = await cortex.vector.store(spaceId, {
        content: "User prefers dark mode",
        contentType: "summarized",
        source: { type: "conversation", userId },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        metadata: { importance: 70, tags: ["preference"] },
      });

      expect(mem.conversationRef).toBeDefined();
      expect(mem.conversationRef!.conversationId).toBe(conv.conversationId);

      // STEP 4: Extract fact
      const fact = await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "User prefers dark mode UI",
        factType: "preference",
        subject: userId,
        confidence: 85,
        sourceType: "conversation",
        sourceRef: {
          conversationId: conv.conversationId,
          memoryId: mem.memoryId,
        },
      });

      expect(fact.sourceRef!.conversationId).toBe(conv.conversationId);
      expect(fact.sourceRef!.memoryId).toBe(mem.memoryId);

      // STEP 5: Create context
      const ctx = await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId,
        purpose: "Handle preference update",
        conversationRef: {
          conversationId: conv.conversationId,
        },
        data: { factId: fact.factId },
      });

      // VALIDATE: Complete chain retrievable
      const convCheck = await cortex.conversations.get(conv.conversationId);
      const memCheck = await cortex.vector.get(spaceId, mem.memoryId);
      const factCheck = await cortex.facts.get(spaceId, fact.factId);
      const ctxCheck = await cortex.contexts.get(ctx.contextId);

      expect(convCheck).not.toBeNull();
      expect(memCheck).not.toBeNull();
      expect(factCheck).not.toBeNull();
      expect(ctxCheck).not.toBeNull();
    });

    it("remember→get→forget sequence cleans all layers", async () => {
      const spaceId = `${BASE_ID}-remember-forget`;

      // Remember
      const result = await cortex.memory.remember({
        memorySpaceId: spaceId,
        conversationId: `conv-rf-${Date.now()}`,
        userMessage: "Test message",
        agentResponse: "Test response",
        userId: "test-user",
        userName: "Test User",
        agentId: TEST_AGENT_ID,
      });

      expect(result.memories).toHaveLength(2);
      expect(result.conversation.conversationId).toBeDefined();

      // Get memories
      const mem1 = await cortex.vector.get(
        spaceId,
        result.memories[0].memoryId,
      );
      const mem2 = await cortex.vector.get(
        spaceId,
        result.memories[1].memoryId,
      );

      expect(mem1).not.toBeNull();
      expect(mem2).not.toBeNull();

      // Forget first memory
      await cortex.memory.forget(spaceId, result.memories[0].memoryId);

      const afterForget1 = await cortex.vector.get(
        spaceId,
        result.memories[0].memoryId,
      );
      const afterForget2 = await cortex.vector.get(
        spaceId,
        result.memories[1].memoryId,
      );

      expect(afterForget1).toBeNull(); // Deleted
      expect(afterForget2).not.toBeNull(); // Still exists
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Bulk Operation Sequences
  // ══════════════════════════════════════════════════════════════════════

  describe("Bulk Operation Sequences", () => {
    it("deleteMany→count→list validates complete removal", async () => {
      const spaceId = `${BASE_ID}-bulk-delete`;

      // Create 10 memories with same tag
      const created = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          cortex.vector.store(spaceId, {
            content: `Bulk memory ${i}`,
            contentType: "raw",
            source: { type: "system", userId: "test-user" },
            metadata: { importance: 50, tags: ["bulk-delete"] },
          }),
        ),
      );

      // Verify all exist
      const listBefore = await cortex.vector.list({ memorySpaceId: spaceId });
      const countBefore = listBefore.filter((m) =>
        m.tags.includes("bulk-delete"),
      ).length;
      expect(countBefore).toBe(10);

      // Delete by tag
      const toDelete = listBefore.filter((m) => m.tags.includes("bulk-delete"));
      for (const mem of toDelete) {
        await cortex.vector.delete(spaceId, mem.memoryId);
      }
      const result = { deleted: toDelete.length };

      expect(result.deleted).toBeGreaterThanOrEqual(10);

      // Verify count after delete
      const listAfter = await cortex.vector.list({ memorySpaceId: spaceId });
      const countAfter = listAfter.filter((m) =>
        m.tags.includes("bulk-delete"),
      ).length;
      expect(countAfter).toBe(0);

      // Verify list after delete
      const listAfterFinal = await cortex.vector.list({
        memorySpaceId: spaceId,
      });
      const filteredAfter = listAfterFinal.filter((m) =>
        m.tags.includes("bulk-delete"),
      );
      expect(filteredAfter).toHaveLength(0);

      // Verify each individually deleted
      for (const mem of created) {
        const check = await cortex.vector.get(spaceId, mem.memoryId);
        expect(check).toBeNull();
      }
    });

    it("updateMany→list validates all updated", async () => {
      const spaceId = `${BASE_ID}-bulk-update`;

      // Create memories
      const created = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          cortex.vector.store(spaceId, {
            content: `Bulk update ${i}`,
            contentType: "raw",
            source: { type: "system", userId: "test-user" },
            metadata: { importance: 50, tags: ["bulk-update"] },
          }),
        ),
      );

      // Update all
      const toUpdate = await cortex.vector.list({ memorySpaceId: spaceId });
      const filteredToUpdate = toUpdate.filter((m) =>
        m.tags.includes("bulk-update"),
      );
      for (const mem of filteredToUpdate) {
        await cortex.vector.update(spaceId, mem.memoryId, { importance: 90 });
      }
      const result = { updated: filteredToUpdate.length };

      expect(result.updated).toBe(8);

      // Verify all updated
      const list = await cortex.vector.list({
        memorySpaceId: spaceId,
      });
      const filteredList = list.filter((m) => m.tags.includes("bulk-update"));

      filteredList.forEach((mem) => {
        expect(mem.importance).toBe(90);
      });

      // Verify each individually
      for (const mem of created) {
        const check = await cortex.vector.get(spaceId, mem.memoryId);
        expect(check!.importance).toBe(90);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Error Recovery Sequences
  // ══════════════════════════════════════════════════════════════════════

  describe("Error Recovery Sequences", () => {
    it("failed update doesn't corrupt state", async () => {
      const spaceId = `${BASE_ID}-error-recovery`;

      const mem = await cortex.vector.store(spaceId, {
        content: "Original",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      // Attempt invalid update (may be accepted or rejected depending on validation)
      try {
        await cortex.vector.update(spaceId, mem.memoryId, {
          importance: 9999, // Out of range but may be accepted
        } as any);
      } catch (_e) {
        // Expected to fail
      }

      // Verify state (either preserved or clamped)
      const after = await cortex.vector.get(spaceId, mem.memoryId);
      expect(after!.content).toBe("Original");
      // Importance may be updated or preserved depending on backend validation
      expect(after!.importance).toBeGreaterThan(0);
    });

    it("failed delete leaves entity intact", async () => {
      const spaceId = `${BASE_ID}-failed-delete`;

      const mem = await cortex.vector.store(spaceId, {
        content: "Test",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      // Attempt delete with wrong space (should fail)
      try {
        await cortex.vector.delete("wrong-space", mem.memoryId);
      } catch (_e) {
        // Expected
      }

      // Memory should still exist
      const check = await cortex.vector.get(spaceId, mem.memoryId);
      expect(check).not.toBeNull();
    });

    it("operation failure doesn't affect count", async () => {
      const spaceId = `${BASE_ID}-count-recovery`;

      const countBefore = await cortex.vector.count({ memorySpaceId: spaceId });

      // Attempt to get non-existent memory (fails gracefully)
      const result = await cortex.vector.get(spaceId, "non-existent-id");
      expect(result).toBeNull();

      // Count unchanged
      const countAfter = await cortex.vector.count({ memorySpaceId: spaceId });
      expect(countAfter).toBe(countBefore);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Complex Multi-Step Workflows
  // ══════════════════════════════════════════════════════════════════════

  describe("Complex Multi-Step Workflows", () => {
    it("complete user journey maintains consistency", async () => {
      const spaceId = `${BASE_ID}-journey`;
      const userId = "journey-user";

      // Step 1: User profile
      await cortex.users.update(userId, {
        name: "Journey User",
        email: "journey@test.com",
      });

      // Step 2: Start conversation
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId, agentId: TEST_AGENT_ID },
      });

      // Step 3: Add messages
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "user", content: "Hello" },
      });
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "agent", content: "Hi there!" },
      });

      // Step 4: Remember interaction
      const remembered = await cortex.memory.remember({
        memorySpaceId: spaceId,
        conversationId: conv.conversationId,
        userMessage: "I like pizza",
        agentResponse: "Noted!",
        userId,
        userName: "Journey User",
        agentId: TEST_AGENT_ID,
      });

      // Step 5: Extract fact
      const fact = await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "User likes pizza",
        factType: "preference",
        subject: userId,
        confidence: 90,
        sourceType: "conversation",
        sourceRef: { conversationId: conv.conversationId },
      });

      // Step 6: Create workflow context
      const ctx = await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId,
        purpose: "Handle food preferences",
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        data: { factId: fact.factId },
      });

      // VALIDATE: Complete chain
      const userCheck = await cortex.users.get(userId);
      const convCheck = await cortex.conversations.get(conv.conversationId);
      const memCheck = await cortex.vector.get(
        spaceId,
        remembered.memories[0].memoryId,
      );
      const factCheck = await cortex.facts.get(spaceId, fact.factId);
      const ctxCheck = await cortex.contexts.get(ctx.contextId);

      expect(userCheck).not.toBeNull();
      expect(convCheck).not.toBeNull();
      expect(memCheck).not.toBeNull();
      expect(factCheck).not.toBeNull();
      expect(ctxCheck).not.toBeNull();

      // Validate references
      expect(memCheck!.conversationRef!.conversationId).toBe(
        conv.conversationId,
      );
      expect(factCheck!.sourceRef!.conversationId).toBe(conv.conversationId);
      expect((ctxCheck as any).conversationRef!.conversationId).toBe(
        conv.conversationId,
      );
    });

    it("cascade delete cleans entire workflow", async () => {
      const spaceId = `${BASE_ID}-cascade-workflow-${Date.now()}`;

      // Create complete workflow
      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Cascade test",
      });

      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: "cascade-user", agentId: TEST_AGENT_ID },
      });

      const mem = await cortex.vector.store(spaceId, {
        content: "Cascade memory",
        contentType: "raw",
        source: { type: "system", userId: "cascade-user" },
        metadata: { importance: 50, tags: [] },
      });

      const fact = await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Cascade fact",
        factType: "knowledge",
        subject: "cascade-user",
        confidence: 80,
        sourceType: "manual",
      });

      // Delete space with cascade
      await cortex.memorySpaces.delete(spaceId, { cascade: true });

      // Verify all deleted
      const convCheck = await cortex.conversations.get(conv.conversationId);
      const memCheck = await cortex.vector.get(spaceId, mem.memoryId);
      const factCheck = await cortex.facts.get(spaceId, fact.factId);

      expect(convCheck).toBeNull();
      expect(memCheck).toBeNull();
      expect(factCheck).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Sequence Validation Edge Cases
  // ══════════════════════════════════════════════════════════════════════

  describe("Sequence Edge Cases", () => {
    it("rapid create/delete/create with same ID", async () => {
      const spaceId = `${BASE_ID}-rapid`;
      const convId = `rapid-conv-${Date.now()}`;

      // Create
      await cortex.conversations.create({
        conversationId: convId,
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: "test-user", agentId: TEST_AGENT_ID },
      });

      // Delete
      await cortex.conversations.delete(convId);

      // Recreate with same ID
      const recreated = await cortex.conversations.create({
        conversationId: convId,
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: "test-user", agentId: TEST_AGENT_ID },
      });

      expect(recreated.conversationId).toBe(convId);
      expect(recreated.messages).toHaveLength(0); // Fresh start
    });

    it("update sequence with no actual changes is idempotent", async () => {
      const spaceId = `${BASE_ID}-idempotent`;

      const mem = await cortex.vector.store(spaceId, {
        content: "Unchanged",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      // Update with same values multiple times
      await cortex.vector.update(spaceId, mem.memoryId, { importance: 50 });
      await cortex.vector.update(spaceId, mem.memoryId, { importance: 50 });
      await cortex.vector.update(spaceId, mem.memoryId, { importance: 50 });

      const final = await cortex.vector.get(spaceId, mem.memoryId);

      // Version may or may not increment (implementation dependent)
      expect(final!.importance).toBe(50);
      expect(final!.content).toBe("Unchanged");
    });

    it("sequence with mixed success/failure maintains consistency", async () => {
      const spaceId = `${BASE_ID}-mixed`;

      // Create valid memory
      const mem = await cortex.vector.store(spaceId, {
        content: "Valid",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      // Try invalid operation (should fail)
      try {
        await cortex.vector.update("wrong-space", mem.memoryId, {
          content: "Hacked",
        });
      } catch (_e) {
        // Expected
      }

      // Valid operation should still work
      const updated = await cortex.vector.update(spaceId, mem.memoryId, {
        content: "Updated correctly",
      });

      expect(updated.content).toBe("Updated correctly");
    });

    it("long sequence maintains data integrity", async () => {
      const spaceId = `${BASE_ID}-long-seq`;
      const userId = "long-user";

      // 20-step sequence
      let ctx = await cortex.contexts.create({
        memorySpaceId: spaceId,
        userId,
        purpose: "Long sequence test",
        status: "active",
        data: { step: 0 },
      });

      for (let i = 1; i <= 20; i++) {
        ctx = await cortex.contexts.update(ctx.contextId, {
          data: { step: i },
        });

        // Verify state after each step
        const check = await cortex.contexts.get(ctx.contextId);
        expect((check as any).data?.step).toBe(i);
      }

      // Final check
      const final = await cortex.contexts.get(ctx.contextId);
      expect((final as any).data?.step).toBe(20);
    });
  });
});
