/**
 * Sync Utilities Tests
 *
 * Unit tests for graph sync utility functions that sync Cortex entities to graph database.
 */

import { CypherGraphAdapter } from "../../src/graph";
import type { GraphAdapter } from "../../src/graph";
import {
  syncContextToGraph,
  syncConversationToGraph,
  syncMemoryToGraph,
  syncFactToGraph,
  syncMemorySpaceToGraph,
  findGraphNodeId,
  ensureUserNode,
  ensureAgentNode,
  ensureParticipantNode,
  ensureEntityNode,
  ensureEnrichedEntityNode,
} from "../../src/graph/sync/syncUtils";
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

describeIfEnabled("Sync Utilities", () => {
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

  // ============================================================================
  // syncContextToGraph Tests
  // ============================================================================
  describe("syncContextToGraph()", () => {
    it("should sync context with all properties", async () => {
      const context: Context = {
        _id: "ctx-doc-id" as any,
        contextId: `ctx-${timestamp}`,
        memorySpaceId: `space-${timestamp}`,
        purpose: "Test context for graph sync",
        status: "active",
        depth: 0,
        childIds: [],
        userId: "user-123",
        parentId: undefined,
        rootId: undefined,
        participants: ["participant-1"],
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completedAt: undefined,
      };

      const nodeId = await syncContextToGraph(context, adapter);

      expect(nodeId).toBeDefined();

      // Verify node was created with correct properties
      const node = await adapter.getNode(nodeId);
      expect(node).not.toBeNull();
      expect(node!.label).toBe("Context");
      expect(node!.properties.contextId).toBe(context.contextId);
      expect(node!.properties.memorySpaceId).toBe(context.memorySpaceId);
      expect(node!.properties.purpose).toBe(context.purpose);
      expect(node!.properties.status).toBe("active");
      expect(node!.properties.depth).toBe(0);
      expect(node!.properties.userId).toBe("user-123");
    });

    it("should handle context with null optional fields", async () => {
      const context: Context = {
        _id: "ctx-null-doc" as any,
        contextId: `ctx-null-${timestamp}`,
        memorySpaceId: `space-${timestamp}`,
        purpose: "Test minimal context",
        status: "active",
        depth: 0,
        childIds: [],
        participants: [],
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const nodeId = await syncContextToGraph(context, adapter);
      const node = await adapter.getNode(nodeId);

      // Properties can be null or undefined depending on graph driver behavior
      expect(node!.properties.userId ?? null).toBeNull();
      expect(node!.properties.parentId ?? null).toBeNull();
    });

    it("should update existing context on re-sync (merge)", async () => {
      const contextId = `ctx-merge-${timestamp}`;
      const context1: Context = {
        _id: "ctx-merge-doc" as any,
        contextId,
        memorySpaceId: `space-${timestamp}`,
        purpose: "Initial purpose",
        status: "active",
        depth: 0,
        childIds: [],
        participants: [],
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await syncContextToGraph(context1, adapter);

      const context2: Context = {
        ...context1,
        purpose: "Updated purpose",
        status: "completed",
        version: 2,
        updatedAt: Date.now() + 1000,
      };

      await syncContextToGraph(context2, adapter);

      // Should only have one node
      const nodes = await adapter.findNodes("Context", { contextId }, 10);
      expect(nodes.length).toBe(1);
      expect(nodes[0].properties.purpose).toBe("Updated purpose");
      expect(nodes[0].properties.status).toBe("completed");
    });
  });

  // ============================================================================
  // syncConversationToGraph Tests
  // ============================================================================
  describe("syncConversationToGraph()", () => {
    it("should sync conversation with all properties", async () => {
      const conversation: Conversation = {
        _id: "conv-doc-id" as any,
        conversationId: `conv-${timestamp}`,
        memorySpaceId: `space-${timestamp}`,
        type: "user-agent",
        participants: {
          userId: "user-456",
          agentId: "agent-789",
        },
        messageCount: 5,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const nodeId = await syncConversationToGraph(conversation, adapter);

      expect(nodeId).toBeDefined();

      const node = await adapter.getNode(nodeId);
      expect(node!.label).toBe("Conversation");
      expect(node!.properties.conversationId).toBe(conversation.conversationId);
      expect(node!.properties.type).toBe("user-agent");
      expect(node!.properties.userId).toBe("user-456");
      expect(node!.properties.agentId).toBe("agent-789");
      expect(node!.properties.messageCount).toBe(5);
    });

    it("should handle conversation with participant ID (Hive Mode)", async () => {
      const conversation: Conversation = {
        _id: "conv-hive-doc" as any,
        conversationId: `conv-hive-${timestamp}`,
        memorySpaceId: `space-${timestamp}`,
        participantId: "participant-hive-1",
        type: "user-agent",
        participants: {},
        messageCount: 0,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const nodeId = await syncConversationToGraph(conversation, adapter);
      const node = await adapter.getNode(nodeId);

      expect(node!.properties.participantId).toBe("participant-hive-1");
    });
  });

  // ============================================================================
  // syncMemoryToGraph Tests
  // ============================================================================
  describe("syncMemoryToGraph()", () => {
    it("should sync memory with content truncation", async () => {
      // Create a long content string (>200 chars)
      const longContent = "A".repeat(500);

      const memory: MemoryEntry = {
        _id: "mem-doc-id" as any,
        memoryId: `mem-${timestamp}`,
        memorySpaceId: `space-${timestamp}`,
        content: longContent,
        contentType: "raw",
        sourceType: "conversation",
        sourceTimestamp: Date.now(),
        importance: 85,
        tags: ["test", "important"],
        version: 1,
        previousVersions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        accessCount: 0,
      };

      const nodeId = await syncMemoryToGraph(memory, adapter);

      const node = await adapter.getNode(nodeId);
      expect(node!.label).toBe("Memory");
      // Content should be truncated to 200 chars
      const content = node!.properties.content as string;
      expect(content.length).toBe(200);
      expect(content).toBe("A".repeat(200));
    });

    it("should preserve all memory properties", async () => {
      const memory: MemoryEntry = {
        _id: "mem-full-doc" as any,
        memoryId: `mem-full-${timestamp}`,
        memorySpaceId: `space-${timestamp}`,
        participantId: "participant-1",
        userId: "user-mem",
        agentId: "agent-mem",
        content: "Test memory content",
        contentType: "raw",
        sourceType: "conversation",
        sourceTimestamp: Date.now(),
        sourceUserId: "source-user",
        importance: 75,
        tags: ["tag1", "tag2"],
        version: 2,
        previousVersions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        accessCount: 5,
      };

      const nodeId = await syncMemoryToGraph(memory, adapter);
      const node = await adapter.getNode(nodeId);

      expect(node!.properties.memoryId).toBe(memory.memoryId);
      expect(node!.properties.participantId).toBe("participant-1");
      expect(node!.properties.userId).toBe("user-mem");
      expect(node!.properties.agentId).toBe("agent-mem");
      expect(node!.properties.contentType).toBe("raw");
      expect(node!.properties.sourceType).toBe("conversation");
      expect(node!.properties.sourceUserId).toBe("source-user");
      expect(node!.properties.importance).toBe(75);
      expect(node!.properties.version).toBe(2);
    });
  });

  // ============================================================================
  // syncFactToGraph Tests
  // ============================================================================
  describe("syncFactToGraph()", () => {
    it("should sync fact with all properties", async () => {
      const fact: FactRecord = {
        _id: "fact-doc-id" as any,
        factId: `fact-${timestamp}`,
        memorySpaceId: `space-${timestamp}`,
        fact: "John works at Acme Corp",
        factType: "relationship",
        subject: "John",
        predicate: "works_at",
        object: "Acme Corp",
        confidence: 95,
        sourceType: "conversation",
        tags: ["employment"],
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const nodeId = await syncFactToGraph(fact, adapter);

      const node = await adapter.getNode(nodeId);
      expect(node!.label).toBe("Fact");
      expect(node!.properties.factId).toBe(fact.factId);
      expect(node!.properties.fact).toBe("John works at Acme Corp");
      expect(node!.properties.factType).toBe("relationship");
      expect(node!.properties.subject).toBe("John");
      expect(node!.properties.predicate).toBe("works_at");
      expect(node!.properties.object).toBe("Acme Corp");
      expect(node!.properties.confidence).toBe(95);
    });

    it("should handle fact versioning properties", async () => {
      const fact: FactRecord = {
        _id: "fact-ver-doc" as any,
        factId: `fact-ver-${timestamp}`,
        memorySpaceId: `space-${timestamp}`,
        fact: "Updated fact",
        factType: "knowledge",
        confidence: 80,
        sourceType: "manual",
        tags: [],
        version: 3,
        supersededBy: "fact-new-123",
        supersedes: "fact-old-456",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const nodeId = await syncFactToGraph(fact, adapter);
      const node = await adapter.getNode(nodeId);

      expect(node!.properties.version).toBe(3);
      expect(node!.properties.supersededBy).toBe("fact-new-123");
      expect(node!.properties.supersedes).toBe("fact-old-456");
    });

    it("should handle fact with participant (Hive Mode)", async () => {
      const fact: FactRecord = {
        _id: "fact-hive-doc" as any,
        factId: `fact-hive-${timestamp}`,
        memorySpaceId: `space-${timestamp}`,
        participantId: "participant-fact-1",
        fact: "Hive mode fact",
        factType: "identity",
        confidence: 100,
        sourceType: "conversation",
        tags: [],
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const nodeId = await syncFactToGraph(fact, adapter);
      const node = await adapter.getNode(nodeId);

      expect(node!.properties.participantId).toBe("participant-fact-1");
    });
  });

  // ============================================================================
  // syncMemorySpaceToGraph Tests
  // ============================================================================
  describe("syncMemorySpaceToGraph()", () => {
    it("should sync memory space with all properties", async () => {
      const memorySpace: MemorySpace = {
        _id: "space-doc-id" as any,
        memorySpaceId: `space-full-${timestamp}`,
        name: "Test Memory Space",
        type: "team",
        status: "active",
        participants: [
          { id: "p1", type: "user", joinedAt: Date.now() },
          { id: "p2", type: "user", joinedAt: Date.now() },
        ],
        metadata: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const nodeId = await syncMemorySpaceToGraph(memorySpace, adapter);

      const node = await adapter.getNode(nodeId);
      expect(node!.label).toBe("MemorySpace");
      expect(node!.properties.memorySpaceId).toBe(memorySpace.memorySpaceId);
      expect(node!.properties.name).toBe("Test Memory Space");
      expect(node!.properties.type).toBe("team");
      expect(node!.properties.status).toBe("active");
      expect(node!.properties.participantCount).toBe(2);
    });

    it("should handle memory space with null name", async () => {
      const memorySpace: MemorySpace = {
        _id: "space-noname-doc" as any,
        memorySpaceId: `space-noname-${timestamp}`,
        type: "personal",
        status: "active",
        participants: [],
        metadata: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const nodeId = await syncMemorySpaceToGraph(memorySpace, adapter);
      const node = await adapter.getNode(nodeId);

      // Properties can be null or undefined depending on graph driver behavior
      expect(node!.properties.name ?? null).toBeNull();
      expect(node!.properties.participantCount).toBe(0);
    });
  });

  // ============================================================================
  // findGraphNodeId Tests
  // ============================================================================
  describe("findGraphNodeId()", () => {
    it("should find Context node by contextId", async () => {
      const contextId = `ctx-find-${timestamp}`;
      await adapter.mergeNode(
        {
          label: "Context",
          properties: { contextId, purpose: "Test" },
        },
        { contextId },
      );

      const nodeId = await findGraphNodeId("Context", contextId, adapter);
      expect(nodeId).not.toBeNull();
    });

    it("should find Conversation node by conversationId", async () => {
      const conversationId = `conv-find-${timestamp}`;
      await adapter.mergeNode(
        {
          label: "Conversation",
          properties: { conversationId, type: "test" },
        },
        { conversationId },
      );

      const nodeId = await findGraphNodeId(
        "Conversation",
        conversationId,
        adapter,
      );
      expect(nodeId).not.toBeNull();
    });

    it("should find Memory node by memoryId", async () => {
      const memoryId = `mem-find-${timestamp}`;
      await adapter.mergeNode(
        {
          label: "Memory",
          properties: { memoryId, content: "Test" },
        },
        { memoryId },
      );

      const nodeId = await findGraphNodeId("Memory", memoryId, adapter);
      expect(nodeId).not.toBeNull();
    });

    it("should find Fact node by factId", async () => {
      const factId = `fact-find-${timestamp}`;
      await adapter.mergeNode(
        {
          label: "Fact",
          properties: { factId, fact: "Test" },
        },
        { factId },
      );

      const nodeId = await findGraphNodeId("Fact", factId, adapter);
      expect(nodeId).not.toBeNull();
    });

    it("should find MemorySpace node by memorySpaceId", async () => {
      const memorySpaceId = `space-find-${timestamp}`;
      await adapter.mergeNode(
        {
          label: "MemorySpace",
          properties: { memorySpaceId, type: "personal" },
        },
        { memorySpaceId },
      );

      const nodeId = await findGraphNodeId(
        "MemorySpace",
        memorySpaceId,
        adapter,
      );
      expect(nodeId).not.toBeNull();
    });

    it("should find User node by userId", async () => {
      const userId = `user-find-${timestamp}`;
      await adapter.mergeNode(
        {
          label: "User",
          properties: { userId },
        },
        { userId },
      );

      const nodeId = await findGraphNodeId("User", userId, adapter);
      expect(nodeId).not.toBeNull();
    });

    it("should find Agent node by agentId", async () => {
      const agentId = `agent-find-${timestamp}`;
      await adapter.mergeNode(
        {
          label: "Agent",
          properties: { agentId },
        },
        { agentId },
      );

      const nodeId = await findGraphNodeId("Agent", agentId, adapter);
      expect(nodeId).not.toBeNull();
    });

    it("should find Participant node by participantId", async () => {
      const participantId = `part-find-${timestamp}`;
      await adapter.mergeNode(
        {
          label: "Participant",
          properties: { participantId },
        },
        { participantId },
      );

      const nodeId = await findGraphNodeId(
        "Participant",
        participantId,
        adapter,
      );
      expect(nodeId).not.toBeNull();
    });

    it("should return null for non-existent node", async () => {
      const nodeId = await findGraphNodeId(
        "Context",
        "non-existent-id",
        adapter,
      );
      expect(nodeId).toBeNull();
    });

    it("should throw for unknown label", async () => {
      await expect(
        findGraphNodeId("UnknownLabel", "some-id", adapter),
      ).rejects.toThrow(/Unknown label/);
    });
  });

  // ============================================================================
  // Ensure Node Tests
  // ============================================================================
  describe("ensureUserNode()", () => {
    it("should create user node if not exists", async () => {
      const userId = `user-ensure-${timestamp}`;
      const nodeId = await ensureUserNode(userId, adapter);

      expect(nodeId).toBeDefined();

      const node = await adapter.getNode(nodeId);
      expect(node!.label).toBe("User");
      expect(node!.properties.userId).toBe(userId);
    });

    it("should return existing user node (idempotent)", async () => {
      const userId = `user-idem-${timestamp}`;

      const _nodeId1 = await ensureUserNode(userId, adapter);
      const _nodeId2 = await ensureUserNode(userId, adapter);

      // Should find the same node
      const nodes = await adapter.findNodes("User", { userId }, 10);
      expect(nodes.length).toBe(1);
    });
  });

  describe("ensureAgentNode()", () => {
    it("should create agent node if not exists", async () => {
      const agentId = `agent-ensure-${timestamp}`;
      const nodeId = await ensureAgentNode(agentId, adapter);

      expect(nodeId).toBeDefined();

      const node = await adapter.getNode(nodeId);
      expect(node!.label).toBe("Agent");
      expect(node!.properties.agentId).toBe(agentId);
    });

    it("should return existing agent node (idempotent)", async () => {
      const agentId = `agent-idem-${timestamp}`;

      await ensureAgentNode(agentId, adapter);
      await ensureAgentNode(agentId, adapter);

      const nodes = await adapter.findNodes("Agent", { agentId }, 10);
      expect(nodes.length).toBe(1);
    });
  });

  describe("ensureParticipantNode()", () => {
    it("should create participant node if not exists", async () => {
      const participantId = `part-ensure-${timestamp}`;
      const nodeId = await ensureParticipantNode(participantId, adapter);

      expect(nodeId).toBeDefined();

      const node = await adapter.getNode(nodeId);
      expect(node!.label).toBe("Participant");
      expect(node!.properties.participantId).toBe(participantId);
    });
  });

  describe("ensureEntityNode()", () => {
    it("should create entity node with name and type", async () => {
      const entityName = "John Doe";
      const entityType = "person";

      const nodeId = await ensureEntityNode(entityName, entityType, adapter);

      const node = await adapter.getNode(nodeId);
      expect(node!.label).toBe("Entity");
      expect(node!.properties.name).toBe("John Doe");
      expect(node!.properties.type).toBe("person");
    });

    it("should return existing entity by name (idempotent)", async () => {
      const entityName = `Entity-${timestamp}`;

      await ensureEntityNode(entityName, "type1", adapter);
      await ensureEntityNode(entityName, "type2", adapter);

      const nodes = await adapter.findNodes("Entity", { name: entityName }, 10);
      expect(nodes.length).toBe(1);
    });
  });

  describe("ensureEnrichedEntityNode()", () => {
    it("should create enriched entity with fullValue", async () => {
      const nodeId = await ensureEnrichedEntityNode(
        "Alex",
        "preferred_name",
        "Alexander Johnson",
        adapter,
      );

      const node = await adapter.getNode(nodeId);
      expect(node!.label).toBe("Entity");
      expect(node!.properties.name).toBe("Alex");
      expect(node!.properties.entityType).toBe("preferred_name");
      expect(node!.properties.fullValue).toBe("Alexander Johnson");
    });

    it("should handle null fullValue", async () => {
      const nodeId = await ensureEnrichedEntityNode(
        "SimpleEntity",
        "basic",
        undefined,
        adapter,
      );

      const node = await adapter.getNode(nodeId);
      // Properties can be null or undefined depending on graph driver behavior
      expect(node!.properties.fullValue ?? null).toBeNull();
    });

    it("should update existing entity with new properties", async () => {
      const entityName = `Enriched-${timestamp}`;

      await ensureEnrichedEntityNode(entityName, "type1", undefined, adapter);
      await ensureEnrichedEntityNode(
        entityName,
        "type2",
        "Full Value",
        adapter,
      );

      const nodes = await adapter.findNodes("Entity", { name: entityName }, 10);
      expect(nodes.length).toBe(1);
      // Properties should be updated
      expect(nodes[0].properties.entityType).toBe("type2");
      expect(nodes[0].properties.fullValue).toBe("Full Value");
    });
  });
});

// Skip message when not enabled
if (!GRAPH_TESTING_ENABLED) {
  describe("Sync Utilities", () => {
    it("should skip tests when graph databases not configured", () => {
      console.log("\n⚠️  Sync utility tests skipped");
      console.log("   To enable, set GRAPH_TESTING_ENABLED=true\n");
      expect(true).toBe(true);
    });
  });
}
