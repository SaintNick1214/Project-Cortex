/**
 * Sync Relationships Tests
 *
 * Unit tests for graph relationship sync functions that create edges between Cortex entities.
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
// Import only syncA2ARelationships which is tested directly
import { syncA2ARelationships } from "../../src/graph/sync/syncRelationships";
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

describeIfEnabled("Sync Relationships", () => {
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

  // Helper to create prerequisite nodes
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

  async function _createConversation(
    id: string,
    memorySpaceId: string,
  ): Promise<string> {
    const conv: Conversation = {
      _id: "doc-id" as any,
      conversationId: id,
      memorySpaceId,
      type: "user-agent",
      participants: { userId: "user-1", agentId: "agent-1" },
      messageCount: 0,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return await syncConversationToGraph(conv, adapter);
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

  // ============================================================================
  // syncContextRelationships Tests
  // ============================================================================
  describe("syncContextRelationships()", () => {
    it("should sync context with userId property", async () => {
      const memorySpaceId = `space-ctx-user-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const context = makeContext(`ctx-user-${timestamp}`, memorySpaceId, {
        userId: "user-involved",
      });

      const _nodeId = await syncContextToGraph(context, adapter);

      // Verify context node exists with userId
      const nodes = await adapter.findNodes(
        "Context",
        { contextId: context.contextId },
        10,
      );
      expect(nodes.length).toBe(1);
      expect(nodes[0].properties.userId).toBe("user-involved");
    });
  });

  // ============================================================================
  // syncConversationRelationships Tests
  // ============================================================================
  describe("syncConversationRelationships()", () => {
    it("should sync conversation with user participant info", async () => {
      const memorySpaceId = `space-conv-user-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const conversation: Conversation = {
        _id: "doc-id" as any,
        conversationId: `conv-user-${timestamp}`,
        memorySpaceId,
        type: "user-agent",
        participants: { userId: "conv-user-1" },
        messageCount: 0,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const _nodeId = await syncConversationToGraph(conversation, adapter);

      // Verify conversation node exists with userId
      const convNodes = await adapter.findNodes(
        "Conversation",
        { conversationId: conversation.conversationId },
        10,
      );
      expect(convNodes.length).toBe(1);
      expect(convNodes[0].properties.userId).toBe("conv-user-1");
    });

    it("should sync conversation with participantId", async () => {
      const memorySpaceId = `space-conv-hive-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const conversation: Conversation = {
        _id: "doc-id" as any,
        conversationId: `conv-hive-${timestamp}`,
        memorySpaceId,
        participantId: "hive-participant-1",
        type: "user-agent",
        participants: {},
        messageCount: 0,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const _nodeId = await syncConversationToGraph(conversation, adapter);

      // Verify conversation node has participantId
      const convNodes = await adapter.findNodes(
        "Conversation",
        { conversationId: conversation.conversationId },
        10,
      );
      expect(convNodes.length).toBe(1);
      expect(convNodes[0].properties.participantId).toBe("hive-participant-1");
    });
  });

  // ============================================================================
  // syncMemoryRelationships Tests
  // ============================================================================
  describe("syncMemoryRelationships()", () => {
    it("should sync memory node", async () => {
      const memorySpaceId = `space-mem-inspace-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const memory: MemoryEntry = {
        _id: "doc-id" as any,
        memoryId: `mem-inspace-${timestamp}`,
        memorySpaceId,
        content: "Memory in space",
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

      const _nodeId = await syncMemoryToGraph(memory, adapter);

      // Verify memory node exists
      const memNodes = await adapter.findNodes(
        "Memory",
        { memoryId: memory.memoryId },
        10,
      );
      expect(memNodes.length).toBe(1);
    });

    it("should sync memory with participantId", async () => {
      const memorySpaceId = `space-mem-hive-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const memory: MemoryEntry = {
        _id: "doc-id" as any,
        memoryId: `mem-hive-${timestamp}`,
        memorySpaceId,
        participantId: "hive-mem-participant",
        content: "Hive mode memory",
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

      const _nodeId = await syncMemoryToGraph(memory, adapter);

      // Verify memory node has participantId
      const memNodes = await adapter.findNodes(
        "Memory",
        { memoryId: memory.memoryId },
        10,
      );
      expect(memNodes.length).toBe(1);
      expect(memNodes[0].properties.participantId).toBe("hive-mem-participant");
    });
  });

  // ============================================================================
  // syncFactRelationships Tests
  // ============================================================================
  describe("syncFactRelationships()", () => {
    it("should sync fact node with correct properties", async () => {
      const memorySpaceId = `space-fact-inspace-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const fact: FactRecord = {
        _id: "doc-id" as any,
        factId: `fact-inspace-${timestamp}`,
        memorySpaceId,
        fact: "Fact in space",
        factType: "knowledge",
        confidence: 100,
        sourceType: "manual",
        tags: [],
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const _nodeId = await syncFactToGraph(fact, adapter);

      // Verify fact node exists
      const factNodes = await adapter.findNodes(
        "Fact",
        { factId: fact.factId },
        10,
      );
      expect(factNodes.length).toBe(1);
      expect(factNodes[0].properties.factType).toBe("knowledge");
      expect(factNodes[0].properties.confidence).toBe(100);
    });

    it("should sync fact with subject and object properties", async () => {
      const memorySpaceId = `space-fact-mention-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const fact: FactRecord = {
        _id: "doc-id" as any,
        factId: `fact-mention-${timestamp}`,
        memorySpaceId,
        fact: "John works at Acme",
        factType: "relationship",
        subject: "John",
        predicate: "works_at",
        object: "Acme",
        confidence: 95,
        sourceType: "conversation",
        tags: [],
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const _nodeId = await syncFactToGraph(fact, adapter);

      // Verify fact node has subject and object
      const factNodes = await adapter.findNodes(
        "Fact",
        { factId: fact.factId },
        10,
      );
      expect(factNodes.length).toBe(1);
      expect(factNodes[0].properties.subject).toBe("John");
      expect(factNodes[0].properties.object).toBe("Acme");
    });

    it("should sync fact with participantId", async () => {
      const memorySpaceId = `space-fact-hive-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const fact: FactRecord = {
        _id: "doc-id" as any,
        factId: `fact-hive-${timestamp}`,
        memorySpaceId,
        participantId: "hive-fact-participant",
        fact: "Hive mode fact",
        factType: "identity",
        confidence: 100,
        sourceType: "conversation",
        tags: [],
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const _nodeId = await syncFactToGraph(fact, adapter);

      // Verify fact node has participantId
      const factNodes = await adapter.findNodes(
        "Fact",
        { factId: fact.factId },
        10,
      );
      expect(factNodes.length).toBe(1);
      expect(factNodes[0].properties.participantId).toBe(
        "hive-fact-participant",
      );
    });
  });

  // ============================================================================
  // syncA2ARelationships Tests
  // ============================================================================
  describe("syncA2ARelationships()", () => {
    it("should not throw for A2A memory with from/to space info", async () => {
      const fromSpaceId = `space-a2a-from-${timestamp}`;
      const toSpaceId = `space-a2a-to-${timestamp}`;

      await createMemorySpace(fromSpaceId);
      await createMemorySpace(toSpaceId);

      // Create A2A memory with extended properties
      type A2AMemory = MemoryEntry & {
        toMemorySpace?: string;
        fromMemorySpace?: string;
        messageId?: string;
      };

      const a2aMemory: A2AMemory = {
        _id: "doc-id" as any,
        memoryId: `mem-a2a-${timestamp}`,
        memorySpaceId: toSpaceId,
        content: "A2A message content",
        contentType: "raw",
        sourceType: "a2a",
        sourceTimestamp: Date.now(),
        importance: 80,
        tags: ["a2a"],
        version: 1,
        previousVersions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        accessCount: 0,
        fromMemorySpace: fromSpaceId,
        toMemorySpace: toSpaceId,
        messageId: "a2a-msg-1",
      };

      // Should not throw when called with valid A2A memory
      await expect(
        syncA2ARelationships(a2aMemory, adapter),
      ).resolves.not.toThrow();
    });

    it("should skip non-A2A memories", async () => {
      const memorySpaceId = `space-non-a2a-${timestamp}`;
      await createMemorySpace(memorySpaceId);

      const regularMemory: MemoryEntry = {
        _id: "doc-id" as any,
        memoryId: `mem-regular-${timestamp}`,
        memorySpaceId,
        content: "Regular memory",
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

      // Should complete without creating edges for non-A2A memory
      await expect(
        syncA2ARelationships(regularMemory, adapter),
      ).resolves.not.toThrow();

      // No SENT_TO edge should be created
      const edges = await adapter.findEdges("SENT_TO", {}, 10);
      expect(edges.length).toBe(0);
    });
  });
});

// Skip message when not enabled
if (!GRAPH_TESTING_ENABLED) {
  describe("Sync Relationships", () => {
    it("should skip tests when graph databases not configured", () => {
      console.log("\n⚠️  Sync relationship tests skipped");
      console.log("   To enable, set GRAPH_TESTING_ENABLED=true\n");
      expect(true).toBe(true);
    });
  });
}
