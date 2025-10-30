/**
 * Cross-Layer Integrity Tests (v0.6.1)
 *
 * Tests to ensure references between layers are valid and bidirectional
 * relationships are maintained correctly.
 */

import { Cortex } from "../src";
import { ConvexClient } from "convex/browser";
import { TestCleanup } from "./helpers/cleanup";

describe("Cross-Layer Reference Integrity", () => {
  let cortex: Cortex;
  let client: ConvexClient;
  let cleanup: TestCleanup;
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
  const TEST_MEMSPACE_ID = "cross-layer-test";
  const TEST_USER_ID = "user-cross-layer";

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

  describe("Conversation References", () => {
    it("conversationRef points to actual conversation", async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: { userId: TEST_USER_ID },
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
        participants: { userId: TEST_USER_ID },
      });

      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: convNew.conversationId,
        userId: TEST_USER_ID,
        userName: "Test User",
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
      if (userMem!.conversationRef!.messageIds) {
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
        participants: { userId: TEST_USER_ID },
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
        const conv = await cortex.conversations.get(fact.sourceRef.conversationId);
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
        participants: { userId: TEST_USER_ID },
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
        participants: { userId: TEST_USER_ID },
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
      if (actualParent && 'contextId' in actualParent) {
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
      if (updatedParent && 'childIds' in updatedParent) {
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
        participants: { userId: TEST_USER_ID },
      });

      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: convRef.conversationId,
        userId: TEST_USER_ID,
        userName: "Test User",
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
        participants: { userId: TEST_USER_ID },
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
        participants: { userId: TEST_USER_ID },
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
});

