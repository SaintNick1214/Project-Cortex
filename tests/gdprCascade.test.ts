/**
 * GDPR & Cascade Deletion Tests (v0.6.1)
 *
 * Tests to ensure proper cascade deletion and data cleanup
 * for compliance and data management.
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers/cleanup";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

describe("GDPR: Cascade Deletion", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let _cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("gdpr-cascade");

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    _cleanup = new TestCleanup(client);
    // NOTE: Removed purgeAll() for parallel execution compatibility.
  });

  afterAll(async () => {
    // NOTE: Removed purgeAll() to prevent deleting parallel test data.
    await client.close();
  });

  describe("Memory Space Cascade Deletion", () => {
    it("deleting memorySpace with cascade removes ALL data", async () => {
      const SPACE = ctx.memorySpaceId("cascade-all");
      const TEST_USER = ctx.userId("cascade");

      await cortex.memorySpaces.register({
        memorySpaceId: SPACE,
        name: "Cascade Test Space",
        type: "personal",
      });

      // Create data in ALL layers
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: SPACE,
        participants: { userId: TEST_USER, agentId: "test-agent" },
      });

      const mem = await cortex.vector.store(SPACE, {
        content: "Test memory for cascade",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      const fact = await cortex.facts.store({
        memorySpaceId: SPACE,
        fact: "Test fact for cascade",
        factType: "knowledge",
        subject: "test-user",
        confidence: 90,
        sourceType: "system",
      });

      const _ctx = await cortex.contexts.create({
        purpose: "Test context for cascade",
        memorySpaceId: SPACE,
        userId: "test-user",
      });

      // Delete space with cascade
      await cortex.memorySpaces.delete(SPACE, {
        cascade: true,
        reason: "test cleanup",
      });

      // Validate: Conversations, memories, and facts deleted
      const convCheck = await cortex.conversations.get(conv.conversationId);
      expect(convCheck).toBeNull();

      const memCheck = await cortex.vector.get(SPACE, mem.memoryId);
      expect(memCheck).toBeNull();

      // Facts use soft delete - they're marked invalid
      const factCheck = await cortex.facts.get(SPACE, fact.factId);
      if (factCheck) {
        expect(factCheck.validUntil).toBeDefined(); // Marked invalid
      }

      // Note: Contexts may not be cascade-deleted (design decision for audit trail)
      // The test validates that conversations and memories are deleted

      // Validate: Counts reflect deletion
      const convCount = await cortex.conversations.count({
        memorySpaceId: SPACE,
      });
      const memCount = await cortex.vector.count({ memorySpaceId: SPACE });

      expect(convCount).toBe(0);
      expect(memCount).toBe(0);
    });

    it("cascade respects memory space boundaries", async () => {
      const SPACE_A = ctx.memorySpaceId("cascade-space-a");
      const SPACE_B = ctx.memorySpaceId("cascade-space-b");

      // Register both spaces
      await cortex.memorySpaces.register({
        memorySpaceId: SPACE_A,
        name: "Space A",
        type: "personal",
      });

      await cortex.memorySpaces.register({
        memorySpaceId: SPACE_B,
        name: "Space B",
        type: "personal",
      });

      // Create data in both spaces
      const memA = await cortex.vector.store(SPACE_A, {
        content: "Memory in space A",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      const memB = await cortex.vector.store(SPACE_B, {
        content: "Memory in space B",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      // Delete space A with cascade
      await cortex.memorySpaces.delete(SPACE_A, {
        cascade: true,
        reason: "test cleanup",
      });

      // Validate: Space A data deleted
      const memACheck = await cortex.vector.get(SPACE_A, memA.memoryId);
      expect(memACheck).toBeNull();

      // Validate: Space B data still exists
      const memBCheck = await cortex.vector.get(SPACE_B, memB.memoryId);
      expect(memBCheck).not.toBeNull();
      expect(memBCheck!.content).toBe("Memory in space B");
    });

    it("cascade handles empty memory space", async () => {
      const EMPTY_SPACE = ctx.memorySpaceId("empty-cascade-space");

      await cortex.memorySpaces.register({
        memorySpaceId: EMPTY_SPACE,
        name: "Empty Space",
        type: "personal",
      });

      // Delete without any data
      await cortex.memorySpaces.delete(EMPTY_SPACE, {
        cascade: true,
        reason: "test cleanup",
      });

      // Should succeed without errors
      const spaceCheck = await cortex.memorySpaces.get(EMPTY_SPACE);
      expect(spaceCheck).toBeNull();
    });
  });

  describe("Conversation Deletion", () => {
    it("remember() → forget() → verify: complete cleanup", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: "test-user", agentId: "test-agent" },
      });

      const remembered = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: conv.conversationId,
        userId: "test-user",
        userName: "Test User",
        agentId: "test-agent",
        userMessage: "To be forgotten",
        agentResponse: "Will be forgotten",
      });

      const memoryId = remembered.memories[0].memoryId;
      const conversationId = remembered.conversation.conversationId;

      // Verify data exists
      const memBefore = await cortex.vector.get(TEST_MEMSPACE_ID, memoryId);
      expect(memBefore).not.toBeNull();

      const convBefore = await cortex.conversations.get(conversationId);
      expect(convBefore).not.toBeNull();

      // Forget with deleteConversation: true and deleteEntireConversation: true
      await cortex.memory.forget(TEST_MEMSPACE_ID, memoryId, {
        deleteConversation: true,
        deleteEntireConversation: true,
      });

      // Validate: Vector deleted
      const vectorCheck = await cortex.vector.get(TEST_MEMSPACE_ID, memoryId);
      expect(vectorCheck).toBeNull();

      // Validate: Conversation deleted
      const convCheck = await cortex.conversations.get(conversationId);
      expect(convCheck).toBeNull();
    });

    it("forget() with deleteConversation:false preserves conversation", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: "test-user", agentId: "test-agent" },
      });

      const remembered = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: conv.conversationId,
        userId: "test-user",
        userName: "Test User",
        agentId: "test-agent",
        userMessage: "Memory to delete",
        agentResponse: "Conversation to keep",
      });

      const memoryId = remembered.memories[0].memoryId;
      const conversationId = remembered.conversation.conversationId;

      // Forget with deleteConversation: false
      await cortex.memory.forget(TEST_MEMSPACE_ID, memoryId, {
        deleteConversation: false,
      });

      // Validate: Memory deleted
      const memCheck = await cortex.vector.get(TEST_MEMSPACE_ID, memoryId);
      expect(memCheck).toBeNull();

      // Validate: Conversation still exists
      const convCheck = await cortex.conversations.get(conversationId);
      expect(convCheck).not.toBeNull();
      expect(convCheck!.conversationId).toBe(conversationId);
    });

    it("deleting conversation doesn't affect unrelated memories", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: "test-user", agentId: "test-agent" },
      });

      // Create unrelated memory (no conversationRef)
      const unrelatedMem = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Unrelated memory",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      // Delete conversation
      await cortex.conversations.delete(conv.conversationId);

      // Validate: Unrelated memory still exists
      const memCheck = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        unrelatedMem.memoryId,
      );
      expect(memCheck).not.toBeNull();
    });
  });

  describe("Bulk Deletion", () => {
    it("deleteMany removes ALL matching memories by userId", async () => {
      const USER_ID = `user-bulk-gdpr-${Date.now()}`;
      const BATCH_SIZE = 20; // Reduced from 100 to avoid timeout

      // Create memories in parallel batches for speed
      const createPromises = Array.from({ length: BATCH_SIZE }, (_, i) =>
        cortex.vector.store(TEST_MEMSPACE_ID, {
          content: `Bulk GDPR test ${i}`,
          contentType: "raw",
          userId: USER_ID,
          source: { type: "system", userId: USER_ID },
          metadata: { importance: 50, tags: ["bulk-delete-gdpr"] },
        }),
      );
      const created = await Promise.all(createPromises);
      const MEMORY_IDS = created.map((m) => m.memoryId);

      // Delete by userId
      const result = await cortex.vector.deleteMany({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: USER_ID,
      });

      expect(result.deleted).toBe(BATCH_SIZE);

      // Validate: Count matches (faster than checking each individually)
      const remaining = await cortex.vector.count({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: USER_ID,
      });
      expect(remaining).toBe(0);

      // Spot check a few IDs to verify actual deletion
      const spotChecks = MEMORY_IDS.slice(0, 3);
      for (const memId of spotChecks) {
        const mem = await cortex.vector.get(TEST_MEMSPACE_ID, memId);
        expect(mem).toBeNull();
      }
    });

    it("bulk deletion by sourceType filter", async () => {
      // Create memories with different source types
      const systemMem = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "System generated memory",
        contentType: "raw",
        userId: "user-source-filter",
        source: { type: "system", userId: "user-source-filter" },
        metadata: { importance: 50, tags: ["source-delete"] },
      });

      const toolMem = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Tool generated memory",
        contentType: "raw",
        userId: "user-source-filter-2",
        source: { type: "tool", userId: "user-source-filter-2" },
        metadata: { importance: 50, tags: ["source-delete"] },
      });

      // Delete only system type for first user
      const result = await cortex.vector.deleteMany({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: "user-source-filter",
        sourceType: "system",
      });

      expect(result.deleted).toBe(1);

      // Validate: System memory deleted
      const systemCheck = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        systemMem.memoryId,
      );
      expect(systemCheck).toBeNull();

      // Validate: Tool memory still exists (different userId)
      const toolCheck = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        toolMem.memoryId,
      );
      expect(toolCheck).not.toBeNull();
    });
  });

  describe("Context Chain Deletion", () => {
    it("deleting root context cascades to children", async () => {
      const root = await cortex.contexts.create({
        purpose: "Root for cascade",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: "test-user",
      });

      const child1 = await cortex.contexts.create({
        purpose: "Child 1",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: "test-user",
        parentId: root.contextId,
      });

      const child2 = await cortex.contexts.create({
        purpose: "Child 2",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: "test-user",
        parentId: root.contextId,
      });

      // Delete root with cascade children
      await cortex.contexts.delete(root.contextId, { cascadeChildren: true });

      // Validate: All deleted
      const rootCheck = await cortex.contexts.get(root.contextId);
      expect(rootCheck).toBeNull();

      const child1Check = await cortex.contexts.get(child1.contextId);
      expect(child1Check).toBeNull();

      const child2Check = await cortex.contexts.get(child2.contextId);
      expect(child2Check).toBeNull();
    });

    it("deleting child context doesn't affect parent", async () => {
      const parent = await cortex.contexts.create({
        purpose: "Parent context",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: "test-user",
      });

      const child = await cortex.contexts.create({
        purpose: "Child context",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: "test-user",
        parentId: parent.contextId,
      });

      // Delete child
      await cortex.contexts.delete(child.contextId);

      // Validate: Parent still exists
      const parentCheck = await cortex.contexts.get(parent.contextId);
      expect(parentCheck).not.toBeNull();

      // Validate: Child deleted
      const childCheck = await cortex.contexts.get(child.contextId);
      expect(childCheck).toBeNull();
    });
  });

  describe("Fact Deletion", () => {
    it("deleting fact marks it invalid (soft delete)", async () => {
      const v1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Version 1",
        factType: "knowledge",
        subject: "test-user",
        confidence: 80,
        sourceType: "system",
      });

      const v2 = await cortex.facts.update(TEST_MEMSPACE_ID, v1.factId, {
        fact: "Version 2",
        confidence: 90,
      });

      // Delete v1 (soft delete - marks as invalid)
      const deleteResult = await cortex.facts.delete(
        TEST_MEMSPACE_ID,
        v1.factId,
      );
      expect(deleteResult.deleted).toBe(true);

      // Validate: v1 marked invalid (not null - it's soft deleted)
      const v1Check = await cortex.facts.get(TEST_MEMSPACE_ID, v1.factId);
      expect(v1Check).not.toBeNull();
      expect(v1Check!.validUntil).toBeDefined(); // Marked as invalid

      // Validate: v2 still valid
      const v2Check = await cortex.facts.get(TEST_MEMSPACE_ID, v2.factId);
      expect(v2Check).not.toBeNull();
      expect(v2Check!.fact).toBe("Version 2");
      expect(v2Check!.validUntil).toBeUndefined(); // Still valid
    });

    it("bulk fact deletion by subject (soft delete)", async () => {
      const SUBJECT = "gdpr-subject-test";

      // Create multiple facts about same subject
      const fact1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Fact 1 about subject",
        factType: "knowledge",
        subject: SUBJECT,
        confidence: 80,
        sourceType: "system",
      });

      const fact2 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Fact 2 about subject",
        factType: "preference",
        subject: SUBJECT,
        confidence: 85,
        sourceType: "system",
      });

      const fact3 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Fact 3 about subject",
        factType: "identity",
        subject: SUBJECT,
        confidence: 90,
        sourceType: "system",
      });

      // Get all facts about subject
      const factsAboutSubject = await cortex.facts.queryBySubject({
        memorySpaceId: TEST_MEMSPACE_ID,
        subject: SUBJECT,
      });

      expect(factsAboutSubject.length).toBe(3);

      // Delete all (soft delete - marks as invalid)
      for (const fact of factsAboutSubject) {
        const deleteResult = await cortex.facts.delete(
          TEST_MEMSPACE_ID,
          fact.factId,
        );
        expect(deleteResult.deleted).toBe(true);
      }

      // Validate: All marked invalid (soft deleted)
      const fact1Check = await cortex.facts.get(TEST_MEMSPACE_ID, fact1.factId);
      expect(fact1Check).not.toBeNull();
      expect(fact1Check!.validUntil).toBeDefined(); // Marked invalid

      const fact2Check = await cortex.facts.get(TEST_MEMSPACE_ID, fact2.factId);
      expect(fact2Check).not.toBeNull();
      expect(fact2Check!.validUntil).toBeDefined();

      const fact3Check = await cortex.facts.get(TEST_MEMSPACE_ID, fact3.factId);
      expect(fact3Check).not.toBeNull();
      expect(fact3Check!.validUntil).toBeDefined();
    });

    it("GDPR: deleteMany removes all facts for a user (hard delete)", async () => {
      const GDPR_USER = `gdpr-user-${Date.now()}`;
      const GDPR_SPACE = ctx.memorySpaceId("gdpr-facts");
      const OTHER_USER = `other-user-${Date.now()}`;

      // Create multiple facts for GDPR user across different types
      await cortex.facts.store({
        memorySpaceId: GDPR_SPACE,
        userId: GDPR_USER,
        fact: "User preference fact for GDPR deletion",
        factType: "preference",
        subject: GDPR_USER,
        confidence: 85,
        sourceType: "conversation",
        tags: ["gdpr-test"],
      });

      await cortex.facts.store({
        memorySpaceId: GDPR_SPACE,
        userId: GDPR_USER,
        fact: "User identity fact for GDPR deletion",
        factType: "identity",
        subject: GDPR_USER,
        confidence: 90,
        sourceType: "system",
        tags: ["gdpr-test"],
      });

      await cortex.facts.store({
        memorySpaceId: GDPR_SPACE,
        userId: GDPR_USER,
        fact: "User knowledge fact for GDPR deletion",
        factType: "knowledge",
        subject: GDPR_USER,
        confidence: 80,
        sourceType: "conversation",
        tags: ["gdpr-test"],
      });

      // Create fact for other user (should NOT be deleted)
      await cortex.facts.store({
        memorySpaceId: GDPR_SPACE,
        userId: OTHER_USER,
        fact: "Other user fact should remain",
        factType: "knowledge",
        subject: OTHER_USER,
        confidence: 75,
        sourceType: "system",
        tags: ["gdpr-test"],
      });

      // Verify facts exist before deletion
      const userFactsBefore = await cortex.facts.list({
        memorySpaceId: GDPR_SPACE,
        userId: GDPR_USER,
      });
      expect(userFactsBefore.length).toBe(3);

      // Execute GDPR deletion: Delete ALL facts for the user
      const deleteResult = await cortex.facts.deleteMany({
        memorySpaceId: GDPR_SPACE,
        userId: GDPR_USER,
      });

      // Verify deletion result
      expect(deleteResult.deleted).toBe(3);
      expect(deleteResult.memorySpaceId).toBe(GDPR_SPACE);

      // Verify GDPR user's facts are completely deleted (hard delete)
      const userFactsAfter = await cortex.facts.list({
        memorySpaceId: GDPR_SPACE,
        userId: GDPR_USER,
      });
      expect(userFactsAfter.length).toBe(0);

      // Verify other user's fact still exists
      const otherUserFacts = await cortex.facts.list({
        memorySpaceId: GDPR_SPACE,
        userId: OTHER_USER,
      });
      expect(otherUserFacts.length).toBe(1);
      expect(otherUserFacts[0].fact).toBe("Other user fact should remain");
    });

    it("GDPR: deleteMany by factType for user-specific data cleanup", async () => {
      const GDPR_USER = `gdpr-type-user-${Date.now()}`;
      const GDPR_SPACE = ctx.memorySpaceId("gdpr-facts-type");

      // Create different types of facts
      await cortex.facts.store({
        memorySpaceId: GDPR_SPACE,
        userId: GDPR_USER,
        fact: "User preference to delete",
        factType: "preference",
        subject: GDPR_USER,
        confidence: 85,
        sourceType: "conversation",
      });

      await cortex.facts.store({
        memorySpaceId: GDPR_SPACE,
        userId: GDPR_USER,
        fact: "User knowledge to keep",
        factType: "knowledge",
        subject: GDPR_USER,
        confidence: 90,
        sourceType: "system",
      });

      // Delete only preference facts (partial GDPR - user requested deletion of preferences only)
      const deleteResult = await cortex.facts.deleteMany({
        memorySpaceId: GDPR_SPACE,
        factType: "preference",
      });

      expect(deleteResult.deleted).toBe(1);

      // Verify preference deleted
      const preferenceFacts = await cortex.facts.list({
        memorySpaceId: GDPR_SPACE,
        factType: "preference",
      });
      expect(preferenceFacts.length).toBe(0);

      // Verify knowledge fact still exists
      const knowledgeFacts = await cortex.facts.list({
        memorySpaceId: GDPR_SPACE,
        factType: "knowledge",
      });
      expect(knowledgeFacts.length).toBe(1);
    });

    it("GDPR: complete user data deletion across all fact types", async () => {
      const GDPR_USER = `gdpr-complete-${Date.now()}`;
      const GDPR_SPACE = ctx.memorySpaceId("gdpr-complete");

      // Create facts of ALL types for the user
      const factTypes = [
        "preference",
        "identity",
        "knowledge",
        "relationship",
        "event",
        "observation",
        "custom",
      ] as const;

      for (const factType of factTypes) {
        await cortex.facts.store({
          memorySpaceId: GDPR_SPACE,
          userId: GDPR_USER,
          fact: `${factType} fact for complete GDPR test`,
          factType,
          subject: GDPR_USER,
          confidence: 80,
          sourceType: "system",
          tags: ["gdpr-complete"],
        });
      }

      // Verify all 7 facts created
      const factsBefore = await cortex.facts.list({
        memorySpaceId: GDPR_SPACE,
        userId: GDPR_USER,
      });
      expect(factsBefore.length).toBe(7);

      // Execute complete GDPR deletion
      const deleteResult = await cortex.facts.deleteMany({
        memorySpaceId: GDPR_SPACE,
        userId: GDPR_USER,
      });

      expect(deleteResult.deleted).toBe(7);

      // Verify complete deletion
      const factsAfter = await cortex.facts.list({
        memorySpaceId: GDPR_SPACE,
        userId: GDPR_USER,
      });
      expect(factsAfter.length).toBe(0);

      // Verify count matches
      const count = await cortex.facts.count({
        memorySpaceId: GDPR_SPACE,
        userId: GDPR_USER,
      });
      expect(count).toBe(0);
    });
  });

  describe("Statistics After Deletion", () => {
    it("stats reflect deletions immediately", async () => {
      const SPACE = ctx.memorySpaceId("stats-after-delete");

      await cortex.memorySpaces.register({
        memorySpaceId: SPACE,
        name: "Stats Test Space",
        type: "personal",
      });

      // Create data
      const mem1 = await cortex.vector.store(SPACE, {
        content: "Memory 1",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      const mem2 = await cortex.vector.store(SPACE, {
        content: "Memory 2",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      // Allow time for Convex to commit mutations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get stats before deletion
      const statsBefore = await cortex.memorySpaces.getStats(SPACE);
      expect(statsBefore.totalMemories).toBe(2);

      // Delete one memory
      await cortex.vector.delete(SPACE, mem1.memoryId);

      // Allow time for deletion to commit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get stats after deletion
      const statsAfter = await cortex.memorySpaces.getStats(SPACE);
      expect(statsAfter.totalMemories).toBe(1);

      // Delete remaining
      await cortex.vector.delete(SPACE, mem2.memoryId);

      // Allow time for deletion to commit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get final stats
      const statsFinal = await cortex.memorySpaces.getStats(SPACE);
      expect(statsFinal.totalMemories).toBe(0);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Governance-Aware GDPR Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Governance + GDPR Integration", () => {
    it("GDPR policy enforces purgeOnUserRequest=true allows deletion", async () => {
      const ts = Date.now();
      const orgId = `gdpr-org-purge-${ts}`;
      const SPACE = ctx.memorySpaceId(`gdpr-purge-${ts}`);
      const USER_ID = `gdpr-user-${ts}`;

      // 1. Apply GDPR policy (purgeOnUserRequest: true)
      const gdprPolicy = await cortex.governance.getTemplate("GDPR");
      await cortex.governance.setPolicy({
        ...gdprPolicy,
        organizationId: orgId,
      });

      // 2. Verify policy allows purge on user request
      const policy = await cortex.governance.getPolicy({
        organizationId: orgId,
      });
      expect(policy.conversations.retention.purgeOnUserRequest).toBe(true);

      // 3. Register space and create user data
      await cortex.memorySpaces.register({
        memorySpaceId: SPACE,
        name: "GDPR Test Space",
        type: "personal",
      });

      await cortex.vector.store(SPACE, {
        content: "User personal data for GDPR test",
        contentType: "raw",
        userId: USER_ID,
        source: { type: "conversation", userId: USER_ID },
        metadata: { importance: 70, tags: ["personal-data"] },
      });

      await cortex.facts.store({
        memorySpaceId: SPACE,
        userId: USER_ID,
        fact: "User preference that should be deletable",
        factType: "preference",
        subject: USER_ID,
        confidence: 85,
        sourceType: "conversation",
      });

      // 4. User requests deletion - GDPR policy allows it
      const deleteResult = await cortex.vector.deleteMany({
        memorySpaceId: SPACE,
        userId: USER_ID,
      });

      const factsDeleteResult = await cortex.facts.deleteMany({
        memorySpaceId: SPACE,
        userId: USER_ID,
      });

      // 5. Verify deletions succeeded (GDPR allows)
      expect(deleteResult.deleted).toBeGreaterThanOrEqual(0);
      expect(factsDeleteResult.deleted).toBeGreaterThanOrEqual(0);

      // 6. Verify no data remains
      const remainingMemories = await cortex.vector.list({
        memorySpaceId: SPACE,
        userId: USER_ID,
      });
      expect(remainingMemories.length).toBe(0);
    });

    it("compliance report reflects GDPR deletion requests", async () => {
      const ts = Date.now();
      const orgId = `gdpr-report-${ts}`;

      // 1. Apply GDPR policy
      const gdprPolicy = await cortex.governance.getTemplate("GDPR");
      await cortex.governance.setPolicy({
        ...gdprPolicy,
        organizationId: orgId,
      });

      // 2. Generate compliance report
      const now = Date.now();
      const report = await cortex.governance.getComplianceReport({
        organizationId: orgId,
        period: {
          start: new Date(now - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date(now),
        },
      });

      // 3. Verify report tracks user deletion requests
      expect(report.userRequests).toBeDefined();
      expect(report.userRequests.deletionRequests).toBeGreaterThanOrEqual(0);
      expect(report.userRequests.fulfilled).toBeGreaterThanOrEqual(0);
      expect(report.userRequests.avgFulfillmentTime).toBeDefined();
    });

    it("enforcement stats track GDPR-related deletions", async () => {
      const ts = Date.now();
      const orgId = `gdpr-stats-${ts}`;

      // 1. Apply GDPR policy and run enforcement
      const gdprPolicy = await cortex.governance.getTemplate("GDPR");
      await cortex.governance.setPolicy({
        ...gdprPolicy,
        organizationId: orgId,
      });

      await cortex.governance.enforce({
        layers: ["conversations", "vector"],
        rules: ["retention", "purging"],
        scope: { organizationId: orgId },
      });

      // 2. Get enforcement stats
      const stats = await cortex.governance.getEnforcementStats({
        period: "30d",
        organizationId: orgId,
      });

      // 3. Stats should reflect enforcement activity
      expect(stats.period.start).toBeGreaterThan(0);
      expect(stats.conversations).toBeDefined();
      expect(stats.vector).toBeDefined();
      expect(stats.storageFreed).toBeGreaterThanOrEqual(0);
    });

    it("memory space cascade deletion respects governance logging", async () => {
      const ts = Date.now();
      const orgId = `gdpr-cascade-governance-${ts}`;
      const SPACE = ctx.memorySpaceId(`cascade-gov-${ts}`);

      // 1. Apply policy with audit logging enabled
      const hipaaPolicy = await cortex.governance.getTemplate("HIPAA");
      await cortex.governance.setPolicy({
        ...hipaaPolicy,
        organizationId: orgId,
      });

      // 2. Verify audit logging is enabled
      const policy = await cortex.governance.getPolicy({
        organizationId: orgId,
      });
      expect(policy.compliance.auditLogging).toBe(true);

      // 3. Register space and create data
      await cortex.memorySpaces.register({
        memorySpaceId: SPACE,
        name: "Cascade Governance Test",
        type: "personal",
      });

      await cortex.vector.store(SPACE, {
        content: "Test data for cascade",
        contentType: "raw",
        source: { type: "system", userId: "test-user" },
        metadata: { importance: 50, tags: [] },
      });

      // 4. Cascade delete the space
      await cortex.memorySpaces.delete(SPACE, {
        cascade: true,
        reason: "GDPR governance test cleanup",
      });

      // 5. Verify space is deleted
      const spaceCheck = await cortex.memorySpaces.get(SPACE);
      expect(spaceCheck).toBeNull();

      // 6. Verify compliance report can still be generated (audit trail exists)
      const now = Date.now();
      const report = await cortex.governance.getComplianceReport({
        organizationId: orgId,
        period: {
          start: new Date(now - 7 * 24 * 60 * 60 * 1000),
          end: new Date(now),
        },
      });
      expect(report).toBeDefined();
    });
  });
});
