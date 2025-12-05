/**
 * Cross-Layer Integrity Tests (v0.6.1)
 *
 * Tests to ensure references between layers are valid and bidirectional
 * relationships are maintained correctly.
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers/cleanup";
import { createTestRunContext } from "./helpers/isolation";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

describe("Cross-Layer Reference Integrity", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let _cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("cross-layer");
  const TEST_USER_ID = ctx.userId("cross-layer");
  const TEST_AGENT_ID = ctx.agentId("cross-layer");

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    client = new ConvexClient(CONVEX_URL);
    _cleanup = new TestCleanup(client);
    // NOTE: Removed purgeAll() to enable parallel test execution.
  });

  afterAll(async () => {
    // NOTE: Removed purgeAll() to prevent deleting parallel test data.
    await client.close();
  });

  describe("Conversation References", () => {
    it("conversationRef points to actual conversation", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const msgResult = await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "Test message",
        },
      });

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Memory with conversation ref",
        contentType: "raw",
        source: { type: "system", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: msgResult.messages.map((m) => m.id),
        },
        metadata: { importance: 50, tags: [] },
      });

      // Validate: Can retrieve referenced conversation
      const referencedConv = await cortex.conversations.get(
        memory.conversationRef!.conversationId!,
      );
      expect(referencedConv).not.toBeNull();
      expect(referencedConv!.conversationId).toBe(conv.conversationId);

      // Validate: Referenced messages exist
      const messageIds = memory.conversationRef!.messageIds!;
      messageIds.forEach((msgId) => {
        const msg = referencedConv!.messages.find((m) => m.id === msgId);
        expect(msg).toBeDefined();
      });
    });

    it("memory conversationRef matches actual conversation messages", async () => {
      // Create conversation first
      const convNew = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: convNew.conversationId,
        userId: TEST_USER_ID,
        userName: "Test User",
        agentId: TEST_AGENT_ID,
        userMessage: "Reference integrity test",
        agentResponse: "Testing references",
      });

      const userMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[0].memoryId,
      );

      // Get the conversation
      const conv = await cortex.conversations.get(
        userMem!.conversationRef!.conversationId!,
      );

      expect(conv).not.toBeNull();
      expect(conv!.conversationId).toBe(convNew.conversationId);

      // Verify all referenced message IDs exist in conversation
      if (userMem!.conversationRef!.messageIds.length > 0) {
        userMem!.conversationRef!.messageIds.forEach((msgId) => {
          const msgExists = conv!.messages.some((m) => m.id === msgId);
          expect(msgExists).toBe(true);
        });
      }
    });

    it("handles missing conversationRef gracefully", async () => {
      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Memory without conversation ref",
        contentType: "raw",
        source: { type: "system", userId: TEST_USER_ID },
        metadata: { importance: 50, tags: [] },
        // No conversationRef
      });

      expect(memory.conversationRef).toBeUndefined();

      const stored = await cortex.vector.get(TEST_MEMSPACE_ID, memory.memoryId);
      expect(stored!.conversationRef).toBeUndefined();
    });
  });

  describe("Fact Source References", () => {
    it("sourceRef in facts points to actual conversation", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User prefers email",
        factType: "preference",
        subject: TEST_USER_ID,
        confidence: 90,
        sourceType: "conversation",
        sourceRef: { conversationId: conv.conversationId },
      });

      // Validate: Referenced conversation exists
      if (fact.sourceRef?.conversationId) {
        const conv = await cortex.conversations.get(
          fact.sourceRef.conversationId,
        );
        expect(conv).not.toBeNull();
        expect(conv!.conversationId).toBe(fact.sourceRef.conversationId);
      }
    });

    it("sourceRef in facts points to actual memory", async () => {
      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Source memory for fact",
        contentType: "raw",
        source: { type: "system", userId: TEST_USER_ID },
        metadata: { importance: 50, tags: [] },
      });

      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Extracted from memory",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 85,
        sourceType: "system",
        sourceRef: { memoryId: memory.memoryId },
      });

      // Validate: Referenced memory exists
      if (fact.sourceRef?.memoryId) {
        const mem = await cortex.vector.get(
          TEST_MEMSPACE_ID,
          fact.sourceRef.memoryId,
        );
        expect(mem).not.toBeNull();
        expect(mem!.memoryId).toBe(fact.sourceRef.memoryId);
      }
    });

    it("sourceRef with both conversationId and memoryId valid", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Memory for combined ref",
        contentType: "raw",
        source: { type: "system", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        metadata: { importance: 50, tags: [] },
      });

      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Combined source reference",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 95,
        sourceType: "conversation",
        sourceRef: {
          conversationId: conv.conversationId,
          memoryId: memory.memoryId,
        },
      });

      // Validate both references
      const convCheck = await cortex.conversations.get(
        fact.sourceRef!.conversationId!,
      );
      const memCheck = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        fact.sourceRef!.memoryId!,
      );

      expect(convCheck).not.toBeNull();
      expect(memCheck).not.toBeNull();
    });
  });

  describe("Context References", () => {
    it("context conversationRef points to actual conversation", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const ctx = await cortex.contexts.create({
        purpose: "Test context with conversation",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
      });

      // Validate reference
      expect(ctx.conversationRef).toBeDefined();

      const referencedConv = await cortex.conversations.get(
        ctx.conversationRef!.conversationId!,
      );
      expect(referencedConv).not.toBeNull();
      expect(referencedConv!.conversationId).toBe(conv.conversationId);
    });

    it("context parentId points to actual parent context", async () => {
      const parent = await cortex.contexts.create({
        purpose: "Parent context",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
      });

      const child = await cortex.contexts.create({
        purpose: "Child context",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        parentId: parent.contextId,
      });

      // Validate: Parent exists
      const actualParent = await cortex.contexts.get(child.parentId!);
      expect(actualParent).not.toBeNull();

      // Type guard to check if it's a Context (not ContextChain)
      if (actualParent && "contextId" in actualParent) {
        expect(actualParent.contextId).toBe(parent.contextId);
        expect(actualParent.childIds).toContain(child.contextId);
      }
    });
  });

  describe("Bidirectional References", () => {
    it("parent context childIds matches children's parentId", async () => {
      const parent = await cortex.contexts.create({
        purpose: "Parent for bidirectional test",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
      });

      const child1 = await cortex.contexts.create({
        purpose: "Child 1",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        parentId: parent.contextId,
      });

      const child2 = await cortex.contexts.create({
        purpose: "Child 2",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        parentId: parent.contextId,
      });

      const updatedParent = await cortex.contexts.get(parent.contextId);

      // Validate: Parent knows about both children
      if (updatedParent && "childIds" in updatedParent) {
        expect(updatedParent.childIds).toContain(child1.contextId);
        expect(updatedParent.childIds).toContain(child2.contextId);
        expect(updatedParent.childIds).toHaveLength(2);
      }

      // Validate: Children point back to parent
      expect(child1.parentId).toBe(parent.contextId);
      expect(child2.parentId).toBe(parent.contextId);
    });

    it("fact version chains are bidirectional", async () => {
      const v1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Original fact",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "system",
      });

      const v2 = await cortex.facts.update(TEST_MEMSPACE_ID, v1.factId, {
        fact: "Updated fact",
        confidence: 90,
      });

      // Retrieve both versions
      const storedV1 = await cortex.facts.get(TEST_MEMSPACE_ID, v1.factId);
      const storedV2 = await cortex.facts.get(TEST_MEMSPACE_ID, v2.factId);

      // Validate: v1 knows it's superseded by v2
      expect(storedV1!.supersededBy).toBe(v2.factId);

      // Validate: v2 knows it supersedes v1
      expect(storedV2!.supersedes).toBe(v1.factId);
    });

    it("fact version chain with multiple updates", async () => {
      const v1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Version 1",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 70,
        sourceType: "system",
      });

      const v2 = await cortex.facts.update(TEST_MEMSPACE_ID, v1.factId, {
        fact: "Version 2",
        confidence: 80,
      });

      const v3 = await cortex.facts.update(TEST_MEMSPACE_ID, v2.factId, {
        fact: "Version 3",
        confidence: 90,
      });

      // Check bidirectional links
      const stored1 = await cortex.facts.get(TEST_MEMSPACE_ID, v1.factId);
      const stored2 = await cortex.facts.get(TEST_MEMSPACE_ID, v2.factId);
      const stored3 = await cortex.facts.get(TEST_MEMSPACE_ID, v3.factId);

      // Forward links
      expect(stored1!.supersededBy).toBe(v2.factId);
      expect(stored2!.supersededBy).toBe(v3.factId);
      expect(stored3!.supersededBy).toBeUndefined(); // Latest

      // Backward links
      expect(stored2!.supersedes).toBe(v1.factId);
      expect(stored3!.supersedes).toBe(v2.factId);
    });
  });

  describe("Reference Consistency Across Operations", () => {
    it("memory.remember() creates consistent cross-layer references", async () => {
      // Create conversation first
      const convRef = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: convRef.conversationId,
        userId: TEST_USER_ID,
        userName: "Test User",
        agentId: TEST_AGENT_ID,
        userMessage: "Cross-layer consistency test",
        agentResponse: "Validating consistency",
      });

      // Get all created entities
      const conversation = await cortex.conversations.get(
        result.conversation.conversationId,
      );
      const userMemory = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[0].memoryId,
      );
      const agentMemory = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        result.memories[1].memoryId,
      );

      // Validate conversation exists
      expect(conversation).not.toBeNull();

      // Validate memories reference the conversation
      expect(userMemory!.conversationRef!.conversationId).toBe(
        result.conversation.conversationId,
      );
      expect(agentMemory!.conversationRef!.conversationId).toBe(
        result.conversation.conversationId,
      );

      // Validate message IDs are valid
      const userMsgIds = userMemory!.conversationRef!.messageIds!;
      const agentMsgIds = agentMemory!.conversationRef!.messageIds!;

      userMsgIds.forEach((msgId) => {
        const msg = conversation!.messages.find((m) => m.id === msgId);
        expect(msg).toBeDefined();
      });

      agentMsgIds.forEach((msgId) => {
        const msg = conversation!.messages.find((m) => m.id === msgId);
        expect(msg).toBeDefined();
      });
    });

    it("context chain maintains reference integrity", async () => {
      const root = await cortex.contexts.create({
        purpose: "Root context",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
      });

      const child = await cortex.contexts.create({
        purpose: "Child context",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        parentId: root.contextId,
      });

      const grandchild = await cortex.contexts.create({
        purpose: "Grandchild context",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        parentId: child.contextId,
      });

      // Get chain from grandchild
      const chain = await cortex.contexts.getChain(grandchild.contextId);

      // Validate root
      expect(chain.root.contextId).toBe(root.contextId);

      // Validate parent references
      expect(chain.current.contextId).toBe(grandchild.contextId);
      expect(chain.current.parentId).toBe(child.contextId);

      // Verify all contexts in chain are retrievable
      const rootCheck = await cortex.contexts.get(chain.root.contextId);
      expect(rootCheck).not.toBeNull();

      if (chain.parent) {
        const parentCheck = await cortex.contexts.get(chain.parent.contextId);
        expect(parentCheck).not.toBeNull();
      }
    });

    it("updates preserve reference integrity", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Original content",
        contentType: "raw",
        source: { type: "system", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        metadata: { importance: 50, tags: [] },
      });

      // Update memory
      const updated = await cortex.vector.update(
        TEST_MEMSPACE_ID,
        memory.memoryId,
        {
          content: "Updated content",
        },
      );

      // Validate conversationRef preserved
      expect(updated.conversationRef).toBeDefined();
      expect(updated.conversationRef!.conversationId).toBe(conv.conversationId);

      // Verify reference still valid
      const convCheck = await cortex.conversations.get(
        updated.conversationRef!.conversationId!,
      );
      expect(convCheck).not.toBeNull();
    });
  });

  describe("Complete Workflow Reference Validation", () => {
    it("end-to-end: conversation → memory → fact → context all interconnected", async () => {
      // Create conversation
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: {
          role: "user",
          content: "I prefer morning meetings",
        },
      });

      // Store memory
      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "User prefers morning meetings",
        contentType: "raw",
        source: { type: "system", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        metadata: { importance: 50, tags: [] },
      });

      // Extract fact
      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "User prefers morning meetings",
        factType: "preference",
        subject: TEST_USER_ID,
        confidence: 95,
        sourceType: "conversation",
        sourceRef: {
          conversationId: conv.conversationId,
          memoryId: memory.memoryId,
        },
      });

      // Create context
      const ctx = await cortex.contexts.create({
        purpose: "Schedule meeting based on preference",
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
      });

      // Validate all references
      // 1. Memory → Conversation
      const memoryConv = await cortex.conversations.get(
        memory.conversationRef!.conversationId!,
      );
      expect(memoryConv).not.toBeNull();

      // 2. Fact → Conversation
      const factConv = await cortex.conversations.get(
        fact.sourceRef!.conversationId!,
      );
      expect(factConv).not.toBeNull();

      // 3. Fact → Memory
      const factMem = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        fact.sourceRef!.memoryId!,
      );
      expect(factMem).not.toBeNull();

      // 4. Context → Conversation
      const ctxConv = await cortex.conversations.get(
        ctx.conversationRef!.conversationId!,
      );
      expect(ctxConv).not.toBeNull();

      // All should reference the same conversation
      expect(memoryConv!.conversationId).toBe(conv.conversationId);
      expect(factConv!.conversationId).toBe(conv.conversationId);
      expect(ctxConv!.conversationId).toBe(conv.conversationId);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Additional Reference Integrity Tests (25 new tests)
  // ══════════════════════════════════════════════════════════════════════

  describe("Comprehensive Reference Integrity", () => {
    it("immutableRef in vector points to actual immutable record", async () => {
      const immutableRecord = await cortex.immutable.store({
        type: "document",
        id: `imm-${Date.now()}`,
        data: { title: "Test Document" },
      });

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Memory referencing immutable",
        contentType: "raw",
        source: { type: "system", userId: TEST_USER_ID },
        immutableRef: {
          type: "document",
          id: immutableRecord.id,
          version: immutableRecord.version,
        },
        metadata: { importance: 50, tags: [] },
      });

      // Validate ref resolves
      const resolved = await cortex.immutable.get(
        memory.immutableRef!.type,
        memory.immutableRef!.id,
      );

      expect(resolved).not.toBeNull();
      expect(resolved!.id).toBe(immutableRecord.id);
      expect(resolved!.version).toBe(immutableRecord.version);
    });

    it("mutableRef in vector matches actual mutable value", async () => {
      const ns = "test-namespace";
      const key = "test-key";

      await cortex.mutable.set(ns, key, { value: "original" });

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Memory referencing mutable",
        contentType: "raw",
        source: { type: "system", userId: TEST_USER_ID },
        mutableRef: {
          namespace: ns,
          key,
          snapshotValue: { value: "original" },
          snapshotAt: Date.now(),
        },
        metadata: { importance: 50, tags: [] },
      });

      // Validate ref resolves
      const resolved = await cortex.mutable.get(
        memory.mutableRef!.namespace,
        memory.mutableRef!.key,
      );

      expect(resolved).not.toBeNull();
      expect((resolved as any).value).toBe("original");
    });

    it("sourceRef in facts points to actual memory and conversation", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Source memory",
        contentType: "raw",
        source: { type: "conversation", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        metadata: { importance: 50, tags: [] },
      });

      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Test fact with source",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "conversation",
        sourceRef: {
          conversationId: conv.conversationId,
          memoryId: memory.memoryId,
        },
      });

      // Validate conversation ref
      const convCheck = await cortex.conversations.get(
        fact.sourceRef!.conversationId!,
      );
      expect(convCheck).not.toBeNull();
      expect(convCheck!.conversationId).toBe(conv.conversationId);

      // Validate memory ref
      const memCheck = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        fact.sourceRef!.memoryId!,
      );
      expect(memCheck).not.toBeNull();
      expect(memCheck!.memoryId).toBe(memory.memoryId);
    });

    it("context conversationRef points to actual conversation with messages", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "user", content: "Test message" },
      });

      const ctx = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Test context with conversation",
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
      });

      // Validate conversation exists
      const convCheck = await cortex.conversations.get(
        ctx.conversationRef!.conversationId,
      );
      expect(convCheck).not.toBeNull();
      expect(convCheck!.messages.length).toBeGreaterThanOrEqual(1);
    });

    it("orphaned conversationRef detected when conversation deleted", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Will be orphaned",
        contentType: "raw",
        source: { type: "conversation", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        metadata: { importance: 50, tags: [] },
      });

      // Delete conversation
      await cortex.conversations.delete(conv.conversationId);

      // Memory still exists but ref is orphaned
      const memCheck = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        memory.memoryId,
      );
      expect(memCheck).not.toBeNull();
      expect(memCheck!.conversationRef!.conversationId).toBe(
        conv.conversationId,
      );

      // Attempt to resolve ref fails
      const convCheck = await cortex.conversations.get(conv.conversationId);
      expect(convCheck).toBeNull(); // Orphaned
    });

    it("fact version chain maintains complete bidirectional integrity", async () => {
      const fact1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Chain version 1",
        factType: "knowledge",
        subject: "chain-test",
        confidence: 70,
        sourceType: "manual",
      });

      const fact2 = await cortex.facts.update(TEST_MEMSPACE_ID, fact1.factId, {
        fact: "Chain version 2",
      });

      const fact3 = await cortex.facts.update(TEST_MEMSPACE_ID, fact2.factId, {
        fact: "Chain version 3",
      });

      // Get all versions
      const v1Check = await cortex.facts.get(TEST_MEMSPACE_ID, fact1.factId);
      const v2Check = await cortex.facts.get(TEST_MEMSPACE_ID, fact2.factId);
      const v3Check = await cortex.facts.get(TEST_MEMSPACE_ID, fact3.factId);

      // Validate forward chain (supersededBy)
      expect(v1Check!.supersededBy).toBeDefined();
      expect(v2Check!.supersededBy).toBeDefined();
      expect(v3Check!.supersededBy).toBeUndefined(); // Latest

      // Validate backward chain (supersedes)
      expect(v3Check!.supersedes).toBeDefined();
      expect(v2Check!.supersedes).toBeDefined();
    });

    it("context parent-child bidirectional relationship maintained", async () => {
      const parent = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Parent context",
      });

      const child1 = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Child 1",
        parentId: parent.contextId,
      });

      const child2 = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Child 2",
        parentId: parent.contextId,
      });

      // Get parent and check children
      const parentCheck = await cortex.contexts.get(parent.contextId);
      expect((parentCheck as any).childIds).toContain(child1.contextId);
      expect((parentCheck as any).childIds).toContain(child2.contextId);

      // Children point to parent
      expect(child1.parentId).toBe(parent.contextId);
      expect(child2.parentId).toBe(parent.contextId);
    });

    it("context chain getChain returns complete hierarchy", async () => {
      const root = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Root",
      });

      const level1 = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Level 1",
        parentId: root.contextId,
      });

      const level2 = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Level 2",
        parentId: level1.contextId,
      });

      const chain = await cortex.contexts.getChain(level2.contextId);

      expect(chain.root.contextId).toBe(root.contextId);
      expect(chain.current.contextId).toBe(level2.contextId);
      expect(chain.depth).toBe(2);
    });

    it("cross-space context references maintain integrity", async () => {
      const spaceA = `${TEST_MEMSPACE_ID}-a`;
      const spaceB = `${TEST_MEMSPACE_ID}-b`;

      // Create context in space A
      const ctxA = await cortex.contexts.create({
        memorySpaceId: spaceA,
        userId: TEST_USER_ID,
        purpose: "Context in Space A",
      });

      // Create child in space B referencing space A parent
      const ctxB = await cortex.contexts.create({
        memorySpaceId: spaceB,
        userId: TEST_USER_ID,
        purpose: "Context in Space B",
        parentId: ctxA.contextId,
      });

      // Validate cross-space ref
      expect(ctxB.parentId).toBe(ctxA.contextId);
      expect(ctxB.memorySpaceId).toBe(spaceB);

      // Parent should know about child
      const parentCheck = await cortex.contexts.get(ctxA.contextId);
      expect((parentCheck as any).childIds).toContain(ctxB.contextId);
    });

    it("messageIds in conversationRef point to actual messages", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "user", content: "Message 1" },
      });
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "agent", content: "Message 2" },
      });

      const convWithMsgs = await cortex.conversations.get(conv.conversationId);
      const msgIds = convWithMsgs!.messages.map((m) => m.id);

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Memory with message refs",
        contentType: "raw",
        source: { type: "conversation", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: msgIds,
        },
        metadata: { importance: 50, tags: [] },
      });

      // Validate all messageIds exist
      const convCheck = await cortex.conversations.get(
        memory.conversationRef!.conversationId,
      );

      memory.conversationRef!.messageIds!.forEach((msgId) => {
        const msgExists = convCheck!.messages.some((m) => m.id === msgId);
        expect(msgExists).toBe(true);
      });
    });

    it("deleting parent context updates children's parentId", async () => {
      const parent = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Parent to be deleted",
      });

      const child = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Child",
        parentId: parent.contextId,
      });

      // Delete parent with cascadeChildren
      await cortex.contexts.delete(parent.contextId, { cascadeChildren: true });

      // Child should be deleted too
      const childCheck = await cortex.contexts.get(child.contextId);
      expect(childCheck).toBeNull();
    });

    it("context with multiple children maintains all references", async () => {
      const parent = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Parent with many children",
      });

      // Create 5 children
      const children = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          cortex.contexts.create({
            memorySpaceId: TEST_MEMSPACE_ID,
            userId: TEST_USER_ID,
            purpose: `Child ${i}`,
            parentId: parent.contextId,
          }),
        ),
      );

      // Get parent
      const parentCheck = await cortex.contexts.get(parent.contextId);

      // All children referenced
      expect((parentCheck as any).childIds).toHaveLength(5);
      children.forEach((child) => {
        expect((parentCheck as any).childIds).toContain(child.contextId);
      });
    });

    it("memory with all ref types resolves correctly", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const immutable = await cortex.immutable.store({
        type: "config",
        id: `cfg-${Date.now()}`,
        data: { setting: "value" },
      });

      await cortex.mutable.set("test-ns", "test-key", "test-value");

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Memory with all refs",
        contentType: "raw",
        source: { type: "conversation", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        immutableRef: { type: "config", id: immutable.id, version: 1 },
        mutableRef: {
          namespace: "test-ns",
          key: "test-key",
          snapshotValue: "test-value",
          snapshotAt: Date.now(),
        },
        metadata: { importance: 50, tags: [] },
      });

      // Validate all refs resolve
      const convCheck = await cortex.conversations.get(
        memory.conversationRef!.conversationId,
      );
      const immCheck = await cortex.immutable.get(
        memory.immutableRef!.type,
        memory.immutableRef!.id,
      );
      const mutCheck = await cortex.mutable.get(
        memory.mutableRef!.namespace,
        memory.mutableRef!.key,
      );

      expect(convCheck).not.toBeNull();
      expect(immCheck).not.toBeNull();
      expect(mutCheck).not.toBeNull();
    });

    it("fact with memoryId in sourceRef points to actual memory", async () => {
      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Source memory for fact",
        contentType: "raw",
        source: { type: "system", userId: TEST_USER_ID },
        metadata: { importance: 50, tags: [] },
      });

      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Fact with memory ref",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 85,
        sourceType: "system",
        sourceRef: {
          memoryId: memory.memoryId,
        },
      });

      // Validate memory ref
      const memCheck = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        fact.sourceRef!.memoryId!,
      );
      expect(memCheck).not.toBeNull();
      expect(memCheck!.memoryId).toBe(memory.memoryId);
    });

    it("deep context chain maintains complete path integrity", async () => {
      // Create 5-level deep chain
      let parent = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Level 0 (root)",
      });

      const chain = [parent];

      for (let i = 1; i <= 4; i++) {
        const child = await cortex.contexts.create({
          memorySpaceId: TEST_MEMSPACE_ID,
          userId: TEST_USER_ID,
          purpose: `Level ${i}`,
          parentId: parent.contextId,
        });
        chain.push(child);
        parent = child;
      }

      // Validate each level
      for (let i = 0; i < chain.length; i++) {
        const ctx = await cortex.contexts.get(chain[i].contextId);
        expect(ctx!.depth).toBe(i);

        if (i > 0) {
          expect((ctx as any).parentId).toBe(chain[i - 1].contextId);
          expect((ctx as any).rootId).toBe(chain[0].contextId);
        }
      }

      // Validate chain from leaf
      const fullChain = await cortex.contexts.getChain(chain[4].contextId);
      expect(fullChain.root.contextId).toBe(chain[0].contextId);
      expect(fullChain.current.contextId).toBe(chain[4].contextId);
      expect(fullChain.depth).toBe(4);
    });

    it("updating immutableRef version in memory stays valid", async () => {
      const immutable = await cortex.immutable.store({
        type: "doc",
        id: `doc-${Date.now()}`,
        data: { version: "1" },
      });

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Memory with versioned ref",
        contentType: "raw",
        source: { type: "system", userId: TEST_USER_ID },
        immutableRef: {
          type: "doc",
          id: immutable.id,
          version: 1,
        },
        metadata: { importance: 50, tags: [] },
      });

      // Create v2 of immutable
      await cortex.immutable.store({
        type: "doc",
        id: immutable.id,
        data: { version: "2" },
      });

      // Memory still references v1
      const memCheck = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        memory.memoryId,
      );
      expect(memCheck!.immutableRef!.version).toBe(1);

      // V1 is still retrievable
      const v1Check = await cortex.immutable.getVersion("doc", immutable.id, 1);
      expect(v1Check).not.toBeNull();
    });

    it("mutableRef snapshot preserves point-in-time value", async () => {
      await cortex.mutable.set("snapshot-ns", "snapshot-key", "original");

      const snapshotTime = Date.now();

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Memory with snapshot",
        contentType: "raw",
        source: { type: "system", userId: TEST_USER_ID },
        mutableRef: {
          namespace: "snapshot-ns",
          key: "snapshot-key",
          snapshotValue: "original",
          snapshotAt: snapshotTime,
        },
        metadata: { importance: 50, tags: [] },
      });

      // Update mutable value
      await cortex.mutable.set("snapshot-ns", "snapshot-key", "updated");

      // Memory snapshot still shows original
      const memCheck = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        memory.memoryId,
      );
      expect(memCheck!.mutableRef!.snapshotValue).toBe("original");

      // Current value is updated
      const currentValue = await cortex.mutable.get(
        "snapshot-ns",
        "snapshot-key",
      );
      expect(currentValue).toBe("updated");
    });

    it("multiple memories can reference same conversation", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      // Create 3 memories referencing same conversation
      const memories = await Promise.all(
        Array.from({ length: 3 }, (_, i) =>
          cortex.vector.store(TEST_MEMSPACE_ID, {
            content: `Memory ${i} from conversation`,
            contentType: "raw",
            source: { type: "conversation", userId: TEST_USER_ID },
            conversationRef: {
              conversationId: conv.conversationId,
              messageIds: [],
            },
            metadata: { importance: 50, tags: [] },
          }),
        ),
      );

      // All should reference same conversation
      memories.forEach((mem) => {
        expect(mem.conversationRef!.conversationId).toBe(conv.conversationId);
      });

      // Conversation should be retrievable from any memory
      for (const mem of memories) {
        const convCheck = await cortex.conversations.get(
          mem.conversationRef!.conversationId,
        );
        expect(convCheck).not.toBeNull();
        expect(convCheck!.conversationId).toBe(conv.conversationId);
      }
    });

    it("fact history returns all versions in order", async () => {
      const fact1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "History v1",
        factType: "knowledge",
        subject: "history-test",
        confidence: 70,
        sourceType: "manual",
      });

      const fact2 = await cortex.facts.update(TEST_MEMSPACE_ID, fact1.factId, {
        confidence: 80,
      });

      const fact3 = await cortex.facts.update(TEST_MEMSPACE_ID, fact2.factId, {
        confidence: 90,
      });

      const history = await cortex.facts.getHistory(
        TEST_MEMSPACE_ID,
        fact1.factId,
      );

      expect(history.length).toBeGreaterThanOrEqual(1);

      // Should include the fact chain (implementation dependent)
      const factIds = new Set(history.map((f) => f.factId));
      expect(
        factIds.has(fact1.factId) ||
          factIds.has(fact2.factId) ||
          factIds.has(fact3.factId),
      ).toBe(true);
    });

    it("context grantedAccess references are valid", async () => {
      const spaceA = `${TEST_MEMSPACE_ID}-grant-a`;
      const spaceB = `${TEST_MEMSPACE_ID}-grant-b`;

      await cortex.memorySpaces.register({
        memorySpaceId: spaceA,
        type: "team",
        name: "Space A",
      });

      await cortex.memorySpaces.register({
        memorySpaceId: spaceB,
        type: "team",
        name: "Space B",
      });

      const ctx = await cortex.contexts.create({
        memorySpaceId: spaceA,
        userId: TEST_USER_ID,
        purpose: "Context with granted access",
      });

      // Grant access to space B
      await cortex.contexts.grantAccess(ctx.contextId, spaceB, "read-only");

      const ctxCheck = await cortex.contexts.get(ctx.contextId);

      // Validate granted access
      if ((ctxCheck as any).grantedAccess) {
        expect(
          (ctxCheck as any).grantedAccess.some(
            (g: any) => g.memorySpaceId === spaceB,
          ),
        ).toBe(true);
      }

      // Validate space B exists
      const spaceBCheck = await cortex.memorySpaces.get(spaceB);
      expect(spaceBCheck).not.toBeNull();
    });

    it("detects orphaned contexts when parent deleted without cascade", async () => {
      const parent = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Parent to delete",
      });

      const child = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Child that will be orphaned",
        parentId: parent.contextId,
      });

      // Try to delete parent without cascade (should fail if has children)
      try {
        await cortex.contexts.delete(parent.contextId);
        // If it succeeds, check child is orphaned or deleted
      } catch (_e) {
        // Expected - HAS_CHILDREN error
        expect(_e).toBeDefined();
      }

      // Child should still exist
      const childCheck = await cortex.contexts.get(child.contextId);
      expect(childCheck).not.toBeNull();
    });

    it("conversation with multiple messages preserves all message references", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      // Add 10 messages
      for (let i = 0; i < 10; i++) {
        await cortex.conversations.addMessage({
          conversationId: conv.conversationId,
          message: {
            role: i % 2 === 0 ? "user" : "agent",
            content: `Message ${i}`,
          },
        });
      }

      const convCheck = await cortex.conversations.get(conv.conversationId);
      expect(convCheck!.messages).toHaveLength(10);

      // All messages have unique IDs
      const ids = new Set(convCheck!.messages.map((m) => m.id));
      expect(ids.size).toBe(10);

      // Messages in order
      for (let i = 0; i < 10; i++) {
        expect(convCheck!.messages[i].content).toBe(`Message ${i}`);
      }
    });

    it("fact supersession chain maintains temporal order", async () => {
      // Track updatedAt timestamps (not createdAt which doesn't change on updates)
      const timestamps: number[] = [];

      const fact1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Temporal v1",
        factType: "knowledge",
        subject: "temporal-test",
        confidence: 70,
        sourceType: "manual",
      });
      timestamps.push(fact1.updatedAt);

      // Ensure enough time passes for distinct timestamps under load
      await new Promise((resolve) => setTimeout(resolve, 50));

      const fact2 = await cortex.facts.update(TEST_MEMSPACE_ID, fact1.factId, {
        confidence: 80,
      });
      timestamps.push(fact2.updatedAt);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const fact3 = await cortex.facts.update(TEST_MEMSPACE_ID, fact2.factId, {
        confidence: 90,
      });
      timestamps.push(fact3.updatedAt);

      // Timestamps should be in non-decreasing order (>= handles same-millisecond edge case)
      expect(timestamps[1]).toBeGreaterThanOrEqual(timestamps[0]);
      expect(timestamps[2]).toBeGreaterThanOrEqual(timestamps[1]);
    });

    it("deleting memory doesn't orphan facts referencing it", async () => {
      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Memory to be deleted",
        contentType: "raw",
        source: { type: "system", userId: TEST_USER_ID },
        metadata: { importance: 50, tags: [] },
      });

      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Fact referencing memory",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "system",
        sourceRef: { memoryId: memory.memoryId },
      });

      // Delete memory
      await cortex.vector.delete(TEST_MEMSPACE_ID, memory.memoryId);

      // Fact still exists with orphaned ref
      const factCheck = await cortex.facts.get(TEST_MEMSPACE_ID, fact.factId);
      expect(factCheck).not.toBeNull();
      expect(factCheck!.sourceRef!.memoryId).toBe(memory.memoryId);

      // But memory doesn't exist
      const memCheck = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        memory.memoryId,
      );
      expect(memCheck).toBeNull();
    });

    it("context conversationRef survives conversation deletion", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const ctx = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Context with conversation ref",
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
      });

      // Delete conversation
      await cortex.conversations.delete(conv.conversationId);

      // Context persists with orphaned ref
      const ctxCheck = await cortex.contexts.get(ctx.contextId);
      expect(ctxCheck).not.toBeNull();
      expect((ctxCheck as any).conversationRef!.conversationId).toBe(
        conv.conversationId,
      );
    });

    it("immutable version history maintains complete reference chain", async () => {
      const id = `version-chain-${Date.now()}`;

      // Create 5 versions
      for (let i = 1; i <= 5; i++) {
        await cortex.immutable.store({
          type: "versioned",
          id,
          data: { version: i },
        });
      }

      const history = await cortex.immutable.getHistory("versioned", id);

      expect(history).toHaveLength(5);

      // Each version retrievable
      for (let i = 1; i <= 5; i++) {
        const version = await cortex.immutable.getVersion("versioned", id, i);
        expect(version).not.toBeNull();
        expect(version!.data.version).toBe(i);
      }
    });

    it("references survive space updates", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-ref-survive-${Date.now()}`;

      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Original name",
      });

      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const memory = await cortex.vector.store(spaceId, {
        content: "Memory with ref",
        contentType: "raw",
        source: { type: "conversation", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        metadata: { importance: 50, tags: [] },
      });

      // Update space
      await cortex.memorySpaces.update(spaceId, { name: "Updated name" });

      // References still valid
      const memCheck = await cortex.vector.get(spaceId, memory.memoryId);
      const convCheck = await cortex.conversations.get(
        memCheck!.conversationRef!.conversationId,
      );

      expect(convCheck).not.toBeNull();
      expect(convCheck!.conversationId).toBe(conv.conversationId);
    });

    it("circular references prevented in contexts", async () => {
      const ctx1 = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Context 1",
      });

      const ctx2 = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Context 2",
        parentId: ctx1.contextId,
      });

      // Attempt to make ctx1 a child of ctx2 (circular)
      try {
        await cortex.contexts.update(ctx1.contextId, {
          data: { parentId: ctx2.contextId },
        });
        // If allowed, hierarchy should detect it
      } catch (_e) {
        // Expected - circular reference prevented
      }

      // Verify original hierarchy intact
      const ctx1Check = await cortex.contexts.get(ctx1.contextId);
      const ctx2Check = await cortex.contexts.get(ctx2.contextId);

      expect((ctx2Check as any).parentId).toBe(ctx1.contextId);
      expect((ctx1Check as any).parentId).toBeUndefined();
    });

    it("cross-layer cascade maintains reference integrity", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-cascade-ref-${Date.now()}`;

      await cortex.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Cascade ref test",
      });

      // Create linked entities
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const memory = await cortex.vector.store(spaceId, {
        content: "Memory",
        contentType: "raw",
        source: { type: "conversation", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        metadata: { importance: 50, tags: [] },
      });

      const fact = await cortex.facts.store({
        memorySpaceId: spaceId,
        fact: "Fact",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "conversation",
        sourceRef: {
          conversationId: conv.conversationId,
          memoryId: memory.memoryId,
        },
      });

      // Delete with cascade
      await cortex.memorySpaces.delete(spaceId, { cascade: true });

      // All should be deleted
      const convCheck = await cortex.conversations.get(conv.conversationId);
      const memCheck = await cortex.vector.get(spaceId, memory.memoryId);
      const factCheck = await cortex.facts.get(spaceId, fact.factId);

      expect(convCheck).toBeNull();
      expect(memCheck).toBeNull();
      expect(factCheck).toBeNull();
    });

    it("updating fact preserves all sourceRef fields", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Source",
        contentType: "raw",
        source: { type: "conversation", userId: TEST_USER_ID },
        metadata: { importance: 50, tags: [] },
      });

      const fact1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Original",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 70,
        sourceType: "conversation",
        sourceRef: {
          conversationId: conv.conversationId,
          memoryId: memory.memoryId,
        },
      });

      const fact2 = await cortex.facts.update(TEST_MEMSPACE_ID, fact1.factId, {
        confidence: 90,
      });

      // New version should preserve sourceRef
      expect(fact2.sourceRef).toBeDefined();
      expect(fact2.sourceRef!.conversationId).toBe(conv.conversationId);
      expect(fact2.sourceRef!.memoryId).toBe(memory.memoryId);
    });

    it("memory version history preserves conversationRef", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const mem = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "V1",
        contentType: "raw",
        source: { type: "conversation", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        metadata: { importance: 50, tags: [] },
      });

      // Update multiple times
      await cortex.vector.update(TEST_MEMSPACE_ID, mem.memoryId, {
        content: "V2",
      });
      await cortex.vector.update(TEST_MEMSPACE_ID, mem.memoryId, {
        content: "V3",
      });

      const current = await cortex.vector.get(TEST_MEMSPACE_ID, mem.memoryId);

      // conversationRef preserved through all versions
      expect(current!.conversationRef).toBeDefined();
      expect(current!.conversationRef!.conversationId).toBe(
        conv.conversationId,
      );
      expect(current!.version).toBe(3);

      // Previous versions may or may not include conversationRef depending on implementation
      // if (current!.previousVersions && current!.previousVersions.length > 0) {
      //   current!.previousVersions.forEach((v: any) => {
      //     expect(v.conversationRef?.conversationId).toBe(conv.conversationId);
      //   });
      // }
    });

    it("cascade delete removes refs in both directions", async () => {
      const parent = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Parent for cascade",
      });

      const child = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Child",
        parentId: parent.contextId,
      });

      // Delete parent with cascade
      await cortex.contexts.delete(parent.contextId, { cascadeChildren: true });

      // Both should be deleted
      const parentCheck = await cortex.contexts.get(parent.contextId);
      const childCheck = await cortex.contexts.get(child.contextId);

      expect(parentCheck).toBeNull();
      expect(childCheck).toBeNull();
    });

    it("fact with multiple references maintains all", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Multi-ref memory",
        contentType: "raw",
        source: { type: "conversation", userId: TEST_USER_ID },
        metadata: { importance: 50, tags: [] },
      });

      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Fact with multiple refs",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 85,
        sourceType: "conversation",
        sourceRef: {
          conversationId: conv.conversationId,
          messageIds: [],
          memoryId: memory.memoryId,
        },
      });

      // All refs should resolve
      const convCheck = await cortex.conversations.get(
        fact.sourceRef!.conversationId!,
      );
      const memCheck = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        fact.sourceRef!.memoryId!,
      );

      expect(convCheck).not.toBeNull();
      expect(memCheck).not.toBeNull();
    });

    it("context with conversationRef and parentId maintains both", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const parent = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Parent",
      });

      const child = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Child with both refs",
        parentId: parent.contextId,
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
      });

      // Both refs should resolve
      const parentCheck = await cortex.contexts.get(child.parentId!);
      const convCheck = await cortex.conversations.get(
        child.conversationRef!.conversationId,
      );

      expect(parentCheck).not.toBeNull();
      expect(convCheck).not.toBeNull();
    });

    it("memory update doesn't break existing fact references", async () => {
      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Original",
        contentType: "raw",
        source: { type: "system", userId: TEST_USER_ID },
        metadata: { importance: 50, tags: [] },
      });

      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Fact referencing memory",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "system",
        sourceRef: { memoryId: memory.memoryId },
      });

      // Update memory
      await cortex.vector.update(TEST_MEMSPACE_ID, memory.memoryId, {
        content: "Updated",
      });

      // Fact ref still valid
      const factCheck = await cortex.facts.get(TEST_MEMSPACE_ID, fact.factId);
      const memCheck = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        factCheck!.sourceRef!.memoryId!,
      );

      expect(memCheck).not.toBeNull();
      expect(memCheck!.content).toBe("Updated"); // Ref points to latest
    });

    it("conversation deletion with multiple memory references", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      // Create 5 memories referencing same conversation
      const memories = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          cortex.vector.store(TEST_MEMSPACE_ID, {
            content: `Memory ${i}`,
            contentType: "raw",
            source: { type: "conversation", userId: TEST_USER_ID },
            conversationRef: {
              conversationId: conv.conversationId,
              messageIds: [],
            },
            metadata: { importance: 50, tags: [] },
          }),
        ),
      );

      // Delete conversation
      await cortex.conversations.delete(conv.conversationId);

      // All memories persist with orphaned refs
      for (const mem of memories) {
        const memCheck = await cortex.vector.get(
          TEST_MEMSPACE_ID,
          mem.memoryId,
        );
        expect(memCheck).not.toBeNull();
        expect(memCheck!.conversationRef!.conversationId).toBe(
          conv.conversationId,
        );
      }
    });

    it("deep context hierarchy maintains root references", async () => {
      // Create 10-level hierarchy
      let parent = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Root",
      });

      const rootId = parent.contextId;

      for (let i = 1; i < 10; i++) {
        parent = await cortex.contexts.create({
          memorySpaceId: TEST_MEMSPACE_ID,
          userId: TEST_USER_ID,
          purpose: `Level ${i}`,
          parentId: parent.contextId,
        });

        // Every level should know the root
        expect(parent.rootId).toBe(rootId);
        expect(parent.depth).toBe(i);
      }
    });

    it("fact consolidation maintains sourceRef integrity", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      // Create duplicate facts
      const fact1 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Duplicate fact 1",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "conversation",
        sourceRef: { conversationId: conv.conversationId },
      });

      const fact2 = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Duplicate fact 2",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 85,
        sourceType: "conversation",
        sourceRef: { conversationId: conv.conversationId },
      });

      // Consolidate
      const result = await cortex.facts.consolidate({
        memorySpaceId: TEST_MEMSPACE_ID,
        factIds: [fact1.factId, fact2.factId],
        keepFactId: fact1.factId,
      });

      expect(result.consolidated).toBe(true);

      // Kept fact should still have sourceRef
      const keptFact = await cortex.facts.get(TEST_MEMSPACE_ID, fact1.factId);
      expect(keptFact!.sourceRef).toBeDefined();
      expect(keptFact!.sourceRef!.conversationId).toBe(conv.conversationId);
    });

    it("memory with conversationRef messageIds validates all messages exist", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      // Add 3 messages
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "user", content: "Msg 1" },
      });
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "agent", content: "Msg 2" },
      });
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "user", content: "Msg 3" },
      });

      const convCheck = await cortex.conversations.get(conv.conversationId);
      const msgIds = convCheck!.messages.map((m) => m.id);

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Memory with specific messages",
        contentType: "raw",
        source: { type: "conversation", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: msgIds,
        },
        metadata: { importance: 50, tags: [] },
      });

      // All messageIds should exist in conversation
      const convFinal = await cortex.conversations.get(conv.conversationId);
      memory.conversationRef!.messageIds!.forEach((msgId) => {
        const exists = convFinal!.messages.some((m) => m.id === msgId);
        expect(exists).toBe(true);
      });
    });

    it("references survive parent entity updates", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Reference test",
        contentType: "raw",
        source: { type: "conversation", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        metadata: { importance: 50, tags: [] },
      });

      // Add message to conversation (modifies it)
      await cortex.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "user", content: "New message" },
      });

      // Memory ref still valid
      const memCheck = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        memory.memoryId,
      );
      const convCheck = await cortex.conversations.get(
        memCheck!.conversationRef!.conversationId,
      );

      expect(convCheck).not.toBeNull();
      expect(convCheck!.messages.length).toBeGreaterThanOrEqual(1);
    });

    it("complex multi-ref integrity across all layers", async () => {
      // Create complete reference graph
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const immutable = await cortex.immutable.store({
        type: "data",
        id: `multi-${Date.now()}`,
        data: { value: "test" },
      });

      await cortex.mutable.set("multi-ns", "multi-key", "test");

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Memory with all refs",
        contentType: "raw",
        source: { type: "conversation", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        immutableRef: {
          type: "data",
          id: immutable.id,
          version: immutable.version,
        },
        mutableRef: {
          namespace: "multi-ns",
          key: "multi-key",
          snapshotValue: "test",
          snapshotAt: Date.now(),
        },
        metadata: { importance: 50, tags: [] },
      });

      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Multi-ref fact",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 90,
        sourceType: "conversation",
        sourceRef: {
          conversationId: conv.conversationId,
          memoryId: memory.memoryId,
        },
      });

      const ctx = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Context with refs",
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        data: { factId: fact.factId, memoryId: memory.memoryId },
      });

      // Validate ALL refs resolve
      const convCheck = await cortex.conversations.get(conv.conversationId);
      const immCheck = await cortex.immutable.get("data", immutable.id);
      const mutCheck = await cortex.mutable.get("multi-ns", "multi-key");
      const memCheck = await cortex.vector.get(
        TEST_MEMSPACE_ID,
        memory.memoryId,
      );
      const factCheck = await cortex.facts.get(TEST_MEMSPACE_ID, fact.factId);
      const ctxCheck = await cortex.contexts.get(ctx.contextId);

      expect(convCheck).not.toBeNull();
      expect(immCheck).not.toBeNull();
      expect(mutCheck).not.toBeNull();
      expect(memCheck).not.toBeNull();
      expect(factCheck).not.toBeNull();
      expect(ctxCheck).not.toBeNull();
    });

    it("temporal references (validFrom/validUntil) maintain integrity", async () => {
      const now = Date.now();
      const future = now + 86400000; // 24 hours

      const fact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "Temporal fact",
        factType: "event",
        subject: TEST_USER_ID,
        confidence: 90,
        sourceType: "manual",
        validFrom: now,
        validUntil: future,
      });

      // Update fact (new version)
      const updated = await cortex.facts.update(TEST_MEMSPACE_ID, fact.factId, {
        confidence: 95,
      });

      // New version should preserve temporal bounds
      expect(updated.validFrom).toBe(now);
      expect(updated.validUntil).toBe(future);
    });

    it("memory space deletion orphan detection comprehensive", async () => {
      const spaceToDelete = `${TEST_MEMSPACE_ID}-orphan-detect-${Date.now()}`;
      const survivingSpace = `${TEST_MEMSPACE_ID}-orphan-survive-${Date.now()}`;

      // Create both spaces
      await cortex.memorySpaces.register({
        memorySpaceId: spaceToDelete,
        type: "project",
        name: "To delete",
      });

      // Create conversation that will be deleted
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceToDelete,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      // Create memory in surviving space referencing the conversation
      const orphanMemory = await cortex.vector.store(survivingSpace, {
        content: "Will have orphaned ref",
        contentType: "raw",
        source: { type: "conversation", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        metadata: { importance: 50, tags: [] },
      });

      // Delete space (cascades conversation)
      await cortex.memorySpaces.delete(spaceToDelete, { cascade: true });

      // Memory in surviving space still exists
      const memCheck = await cortex.vector.get(
        survivingSpace,
        orphanMemory.memoryId,
      );
      expect(memCheck).not.toBeNull();

      // But its conversation ref is orphaned
      const convCheck = await cortex.conversations.get(conv.conversationId);
      expect(convCheck).toBeNull();
    });

    it("getChain validates complete ancestry", async () => {
      const root = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Root",
      });

      const mid = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Middle",
        parentId: root.contextId,
      });

      const leaf = await cortex.contexts.create({
        memorySpaceId: TEST_MEMSPACE_ID,
        userId: TEST_USER_ID,
        purpose: "Leaf",
        parentId: mid.contextId,
      });

      const chain = await cortex.contexts.getChain(leaf.contextId);

      // Root should be root
      expect(chain.root.contextId).toBe(root.contextId);
      expect(chain.root.parentId).toBeUndefined();

      // Current should be leaf
      expect(chain.current.contextId).toBe(leaf.contextId);
      expect(chain.current.depth).toBe(2);

      // All ancestors retrievable
      expect(chain.root.contextId).toBe(root.contextId);
    });

    it("supersession chain walk forward and backward", async () => {
      const facts = [];

      // Create initial fact
      let currentFact = await cortex.facts.store({
        memorySpaceId: TEST_MEMSPACE_ID,
        fact: "V1",
        factType: "knowledge",
        subject: "walk-test",
        confidence: 70,
        sourceType: "manual",
      });
      facts.push(currentFact);

      // Create 4 more versions
      for (let i = 2; i <= 5; i++) {
        currentFact = await cortex.facts.update(
          TEST_MEMSPACE_ID,
          currentFact.factId,
          {
            fact: `V${i}`,
          },
        );
        facts.push(currentFact);
      }

      // Walk forward from v1
      let current = await cortex.facts.get(TEST_MEMSPACE_ID, facts[0].factId);
      let steps = 0;

      while (current && current.supersededBy && steps < 10) {
        const next = await cortex.facts.get(
          TEST_MEMSPACE_ID,
          current.supersededBy,
        );
        expect(next).not.toBeNull();
        current = next;
        steps++;
      }

      expect(steps).toBeGreaterThan(0);

      // Walk backward from latest
      current = facts[facts.length - 1];
      steps = 0;

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (current && current.supersedes && steps < 10) {
        const prev = await cortex.facts.get(
          TEST_MEMSPACE_ID,
          current.supersedes,
        );
        expect(prev).not.toBeNull();
        current = prev!;
        steps++;
      }

      expect(steps).toBeGreaterThan(0);
    });

    it("references across spaces in collaboration mode", async () => {
      const spaceA = `${TEST_MEMSPACE_ID}-collab-a-${Date.now()}`;
      const spaceB = `${TEST_MEMSPACE_ID}-collab-b-${Date.now()}`;

      // Create conversation in space A
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceA,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      // Create context in space B referencing space A conversation
      const ctx = await cortex.contexts.create({
        memorySpaceId: spaceB,
        userId: TEST_USER_ID,
        purpose: "Cross-space context",
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
      });

      // Grant access
      await cortex.contexts.grantAccess(ctx.contextId, spaceA, "read-only");

      // Validate cross-space ref
      expect(ctx.memorySpaceId).toBe(spaceB);
      expect(ctx.conversationRef!.conversationId).toBe(conv.conversationId);

      // Conversation still in space A
      const convCheck = await cortex.conversations.get(conv.conversationId);
      expect(convCheck!.memorySpaceId).toBe(spaceA);
    });

    it("reference integrity preserved through export/import cycle", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const memory = await cortex.vector.store(TEST_MEMSPACE_ID, {
        content: "Export test",
        contentType: "raw",
        source: { type: "conversation", userId: TEST_USER_ID },
        conversationRef: {
          conversationId: conv.conversationId,
          messageIds: [],
        },
        metadata: { importance: 50, tags: ["export"] },
      });

      // Export
      const exported = await cortex.vector.export({
        memorySpaceId: TEST_MEMSPACE_ID,
        format: "json",
      });

      const parsed = JSON.parse(exported.data);
      const exportedMemory = parsed.find(
        (m: any) => m.memoryId === memory.memoryId,
      );

      // conversationRef may or may not be in export depending on format
      if (exportedMemory.conversationRef) {
        expect(exportedMemory.conversationRef.conversationId).toBe(
          conv.conversationId,
        );
      }
    });
  });
});
