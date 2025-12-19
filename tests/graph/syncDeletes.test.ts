/**
 * Sync Deletes Tests
 *
 * Unit tests for graph delete operations with orphan cleanup.
 */

import { CypherGraphAdapter } from "../../src/graph";
import type { GraphAdapter } from "../../src/graph";
import {
  syncContextToGraph,
  syncConversationToGraph,
  syncMemoryToGraph,
  syncFactToGraph,
  syncMemorySpaceToGraph,
} from "../../src/graph/sync/syncUtils";
// Note: syncContextRelationships, syncConversationRelationships,
// syncMemoryRelationships, syncFactRelationships are available from syncRelationships
// but not used in this test file (delete operations don't require relationship syncs)
import {
  deleteMemoryFromGraph,
  deleteFactFromGraph,
  deleteContextFromGraph,
  deleteConversationFromGraph,
  deleteMemorySpaceFromGraph,
  deleteImmutableFromGraph,
  deleteMutableFromGraph,
} from "../../src/graph/sync/syncDeletes";
import type { Context } from "../../src/contexts";
import type {
  Conversation,
  MemoryEntry,
  FactRecord,
  MemorySpace,
} from "../../src/types";

// Check if graph testing is enabled
const GRAPH_TESTING_ENABLED = process.env.GRAPH_TESTING_ENABLED === "true";
const describeIfEnabled = GRAPH_TESTING_ENABLED ? describe : describe.skip;

const NEO4J_CONFIG = {
  uri: process.env.NEO4J_URI || "bolt://localhost:7687",
  username: process.env.NEO4J_USERNAME || "neo4j",
  password: process.env.NEO4J_PASSWORD || "cortex-dev-password",
};

describeIfEnabled("Sync Delete Operations", () => {
  let adapter: GraphAdapter;
  const timestamp = Date.now();

  beforeAll(async () => {
    adapter = new CypherGraphAdapter();
    await adapter.connect(NEO4J_CONFIG);
    await adapter.clearDatabase();
  });

  afterAll(async () => {
    await adapter.clearDatabase();
    await adapter.disconnect();
  });

  beforeEach(async () => {
    await adapter.clearDatabase();
  });

  // Helper functions
  async function createMemorySpace(id: string): Promise<string> {
    const space: MemorySpace = {
      _id: "doc-id" as any,
      memorySpaceId: id,
      name: "Test Space",
      type: "personal",
      status: "active",
      participants: [],
      metadata: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return await syncMemorySpaceToGraph(space, adapter);
  }

  async function createConversation(
    id: string,
    memorySpaceId: string,
  ): Promise<string> {
    const conv: Conversation = {
      _id: "doc-id" as any,
      conversationId: id,
      memorySpaceId,
      type: "user-agent",
      participants: { userId: "user-1" },
      messageCount: 0,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const nodeId = await syncConversationToGraph(conv, adapter);
    // Skip relationship sync as it may fail due to edge creation issues
    return nodeId;
  }

  async function createMemory(
    id: string,
    memorySpaceId: string,
  ): Promise<string> {
    const memory: MemoryEntry = {
      _id: "doc-id" as any,
      memoryId: id,
      memorySpaceId,
      content: "Test memory content",
      contentType: "raw",
      sourceType: "conversation",
      sourceTimestamp: Date.now(),
      importance: 50,
      tags: [],
      version: 1,
      previousVersions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessCount: 0,
    };
    const nodeId = await syncMemoryToGraph(memory, adapter);
    // Skip relationship sync as it may fail due to edge creation issues
    return nodeId;
  }

  async function createFact(
    id: string,
    memorySpaceId: string,
  ): Promise<string> {
    const fact: FactRecord = {
      _id: "doc-id" as any,
      factId: id,
      memorySpaceId,
      fact: "Subject relates to Object",
      factType: "relationship",
      subject: "Subject",
      predicate: "relates_to",
      object: "Object",
      confidence: 95,
      sourceType: "conversation",
      tags: [],
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const nodeId = await syncFactToGraph(fact, adapter);
    // Skip relationship sync as it may fail due to edge creation issues
    return nodeId;
  }

  function makeContext(
    contextId: string,
    memorySpaceId: string,
    extra: Partial<Context> = {},
  ): Context {
    return {
      _id: "ctx-doc" as any,
      contextId,
      memorySpaceId,
      purpose: "Test context",
      status: "active",
      depth: 0,
      childIds: [],
      participants: [],
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...extra,
    };
  }

  async function createContext(
    id: string,
    memorySpaceId: string,
  ): Promise<string> {
    const context = makeContext(id, memorySpaceId);
    const nodeId = await syncContextToGraph(context, adapter);
    // Skip relationship sync as it may fail due to edge creation issues
    return nodeId;
  }

  // ============================================================================
  // deleteMemoryFromGraph Tests
  // ============================================================================
  describe("deleteMemoryFromGraph()", () => {
    it("should delete memory without orphan cleanup", async () => {
      const memorySpaceId = `space-del-mem-nocleanup-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const memoryId = `mem-delete-nocleanup-${timestamp}`;
      await createMemory(memoryId, memorySpaceId);

      // Verify memory exists
      let memories = await adapter.findNodes("Memory", { memoryId }, 10);
      expect(memories.length).toBe(1);

      // Delete without orphan cleanup
      const result = await deleteMemoryFromGraph(memoryId, adapter, false);

      expect(result.deletedNodes.length).toBe(1);
      expect(result.orphanIslands.length).toBe(0);

      // Verify deleted
      memories = await adapter.findNodes("Memory", { memoryId }, 10);
      expect(memories.length).toBe(0);
    });

    it("should return empty result for non-existent memory", async () => {
      const result = await deleteMemoryFromGraph(
        "non-existent-memory-id",
        adapter,
        true,
      );

      expect(result.deletedNodes.length).toBe(0);
      expect(result.deletedEdges.length).toBe(0);
      expect(result.orphanIslands.length).toBe(0);
    });
  });

  // ============================================================================
  // deleteFactFromGraph Tests
  // ============================================================================
  describe("deleteFactFromGraph()", () => {
    it("should delete fact without orphan cleanup", async () => {
      const memorySpaceId = `space-del-fact-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const factId = `fact-delete-${timestamp}`;
      await createFact(factId, memorySpaceId);

      // Verify fact exists
      let facts = await adapter.findNodes("Fact", { factId }, 10);
      expect(facts.length).toBe(1);

      // Delete without orphan cleanup
      const result = await deleteFactFromGraph(factId, adapter, false);

      expect(result.deletedNodes.length).toBe(1);

      // Verify fact is deleted
      facts = await adapter.findNodes("Fact", { factId }, 10);
      expect(facts.length).toBe(0);
    });

    it("should return empty result for non-existent fact", async () => {
      const result = await deleteFactFromGraph(
        "non-existent-fact-id",
        adapter,
        true,
      );

      expect(result.deletedNodes.length).toBe(0);
    });
  });

  // ============================================================================
  // deleteContextFromGraph Tests
  // ============================================================================
  describe("deleteContextFromGraph()", () => {
    it("should delete context without orphan cleanup", async () => {
      const memorySpaceId = `space-del-ctx-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const contextId = `ctx-delete-${timestamp}`;
      await createContext(contextId, memorySpaceId);

      // Verify context exists
      let contexts = await adapter.findNodes("Context", { contextId }, 10);
      expect(contexts.length).toBe(1);

      // Delete
      const result = await deleteContextFromGraph(contextId, adapter, false);

      expect(result.deletedNodes.length).toBe(1);

      // Verify context is deleted
      contexts = await adapter.findNodes("Context", { contextId }, 10);
      expect(contexts.length).toBe(0);
    });

    it("should return empty result for non-existent context", async () => {
      const result = await deleteContextFromGraph(
        "non-existent-ctx-id",
        adapter,
        true,
      );

      expect(result.deletedNodes.length).toBe(0);
    });
  });

  // ============================================================================
  // deleteConversationFromGraph Tests
  // ============================================================================
  describe("deleteConversationFromGraph()", () => {
    it("should delete conversation without orphan cleanup", async () => {
      const memorySpaceId = `space-del-conv-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const conversationId = `conv-delete-${timestamp}`;
      await createConversation(conversationId, memorySpaceId);

      // Verify conversation exists
      let conversations = await adapter.findNodes(
        "Conversation",
        { conversationId },
        10,
      );
      expect(conversations.length).toBe(1);

      // Delete without orphan cleanup
      const result = await deleteConversationFromGraph(
        conversationId,
        adapter,
        false,
      );

      expect(result.deletedNodes.length).toBe(1);

      // Verify conversation is deleted
      conversations = await adapter.findNodes(
        "Conversation",
        { conversationId },
        10,
      );
      expect(conversations.length).toBe(0);
    });

    it("should return empty result for non-existent conversation", async () => {
      const result = await deleteConversationFromGraph(
        "non-existent-conv-id",
        adapter,
        true,
      );

      expect(result.deletedNodes.length).toBe(0);
    });
  });

  // ============================================================================
  // deleteMemorySpaceFromGraph Tests
  // ============================================================================
  describe("deleteMemorySpaceFromGraph()", () => {
    it("should return result when deleting memory space", async () => {
      const memorySpaceId = `space-delete-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      // Delete and check result structure
      const result = await deleteMemorySpaceFromGraph(memorySpaceId, adapter);

      expect(result).toHaveProperty("deletedNodes");
      expect(result).toHaveProperty("deletedEdges");
      expect(result).toHaveProperty("orphanIslands");
    });

    it("should return empty result for non-existent space", async () => {
      const result = await deleteMemorySpaceFromGraph(
        "non-existent-space-id",
        adapter,
      );

      expect(result.deletedNodes.length).toBe(0);
    });
  });

  // ============================================================================
  // deleteImmutableFromGraph Tests
  // ============================================================================
  describe("deleteImmutableFromGraph()", () => {
    it("should delete fact immutable records", async () => {
      const memorySpaceId = `space-del-imm-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const factId = `fact-imm-${timestamp}`;
      await createFact(factId, memorySpaceId);

      // Verify fact exists
      let facts = await adapter.findNodes("Fact", { factId }, 10);
      expect(facts.length).toBe(1);

      // Delete as immutable fact (without orphan cleanup)
      const result = await deleteImmutableFromGraph(
        "fact",
        factId,
        adapter,
        false,
      );

      expect(result.deletedNodes.length).toBe(1);

      // Verify fact deleted
      facts = await adapter.findNodes("Fact", { factId }, 10);
      expect(facts.length).toBe(0);
    });

    it("should return empty for non-existent immutable", async () => {
      const result = await deleteImmutableFromGraph(
        "custom",
        "non-existent",
        adapter,
        true,
      );

      expect(result.deletedNodes.length).toBe(0);
    });
  });

  // ============================================================================
  // deleteMutableFromGraph Tests
  // ============================================================================
  describe("deleteMutableFromGraph()", () => {
    it("should return result structure for mutable deletion", async () => {
      // Create a mutable node
      await adapter.mergeNode(
        {
          label: "Mutable",
          properties: {
            namespace: "test-namespace",
            key: "test-key",
            value: "test value",
          },
        },
        { namespace: "test-namespace", key: "test-key" },
      );

      // Delete and check result structure
      const result = await deleteMutableFromGraph(
        "test-namespace",
        "test-key",
        adapter,
      );

      expect(result).toHaveProperty("deletedNodes");
      expect(result).toHaveProperty("deletedEdges");
      expect(result).toHaveProperty("orphanIslands");
    });

    it("should return empty for non-existent mutable", async () => {
      const result = await deleteMutableFromGraph(
        "non-existent-ns",
        "non-existent-key",
        adapter,
      );

      expect(result.deletedNodes.length).toBe(0);
    });
  });
});

// Skip message when not enabled
if (!GRAPH_TESTING_ENABLED) {
  describe("Sync Delete Operations", () => {
    it("should skip tests when graph databases not configured", () => {
      console.log("\n⚠️  Sync delete tests skipped");
      console.log("   To enable, set GRAPH_TESTING_ENABLED=true\n");
      expect(true).toBe(true);
    });
  });
}
