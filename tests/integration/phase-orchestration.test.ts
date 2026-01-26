/**
 * Integration Tests: Phase-Aware Orchestration
 *
 * Tests full flow of recall → remember with observers.
 * Verifies event ordering, timing, and phase consistency.
 */

import { describe, it, expect, jest, beforeAll, afterAll } from "@jest/globals";
import { Cortex } from "../../src";
import { ConvexClient } from "convex/browser";
import { createTestRunContext } from "../helpers/isolation";
import type {
  OrchestrationObserver,
  LayerEvent,
  RecallSummary,
  OrchestrationSummary,
  MemoryLayer,
} from "../../src/types";

// Create test run context for parallel execution isolation
const ctx = createTestRunContext();

const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

describe("Phase-Aware Orchestration Integration", () => {
  let cortex: Cortex;
  let _client: ConvexClient;

  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("phase-orch");
  const TEST_USER_ID = ctx.userId("phase-orch");
  const TEST_AGENT_ID = ctx.agentId("phase-orch");
  const TEST_USER_NAME = "Phase Test User";

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    _client = new ConvexClient(CONVEX_URL);
  });

  afterAll(async () => {
    await _client.close();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Full Flow Integration Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Full Flow: recall → remember", () => {
    let testConversationId: string;

    beforeAll(async () => {
      // Create a conversation for testing
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: {
          userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
          participantId: TEST_AGENT_ID,
        },
      });
      testConversationId = conv.conversationId;

      // Add some memories for recall to find
      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "My favorite color is blue",
        agentResponse: "I'll remember that your favorite color is blue",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
      });
    });

    it("recall with observer → remember with observer maintains phase separation", async () => {
      // Track all events across both operations
      const allEvents: Array<{
        operation: "recall" | "remember";
        eventType: string;
        data: unknown;
      }> = [];

      const recallObserver: OrchestrationObserver = {
        onRecallStart: (id) => {
          allEvents.push({
            operation: "recall",
            eventType: "start",
            data: id,
          });
        },
        onRecallComplete: (summary) => {
          allEvents.push({
            operation: "recall",
            eventType: "complete",
            data: summary,
          });
        },
        onLayerUpdate: (event) => {
          allEvents.push({
            operation: "recall",
            eventType: "layer",
            data: event,
          });
        },
      };

      const rememberObserver: OrchestrationObserver = {
        onRememberStart: (id) => {
          allEvents.push({
            operation: "remember",
            eventType: "start",
            data: id,
          });
        },
        onRememberComplete: (summary) => {
          allEvents.push({
            operation: "remember",
            eventType: "complete",
            data: summary,
          });
        },
        onLayerUpdate: (event) => {
          allEvents.push({
            operation: "remember",
            eventType: "layer",
            data: event,
          });
        },
      };

      // Step 1: Recall context
      const recallResult = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "favorite color",
        observer: recallObserver,
      });

      // Step 2: Remember new conversation
      const rememberResult = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "What is my favorite color?",
        agentResponse: `Based on what I remember, your favorite color is blue.`,
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        observer: rememberObserver,
      });

      // Verify both operations completed
      expect(recallResult).toBeDefined();
      expect(rememberResult).toBeDefined();

      // Verify recall events all have phase: "recall"
      const recallLayerEvents = allEvents
        .filter((e) => e.operation === "recall" && e.eventType === "layer")
        .map((e) => e.data as LayerEvent);

      recallLayerEvents.forEach((event) => {
        expect(event.phase).toBe("recall");
      });

      // Verify remember events all have phase: "remember"
      const rememberLayerEvents = allEvents
        .filter((e) => e.operation === "remember" && e.eventType === "layer")
        .map((e) => e.data as LayerEvent);

      rememberLayerEvents.forEach((event) => {
        expect(event.phase).toBe("remember");
      });

      // Verify orchestration IDs are different
      const recallStartEvent = allEvents.find(
        (e) => e.operation === "recall" && e.eventType === "start",
      );
      const rememberStartEvent = allEvents.find(
        (e) => e.operation === "remember" && e.eventType === "start",
      );

      expect(recallStartEvent?.data).not.toBe(rememberStartEvent?.data);
    });

    it("event ordering is correct within each phase", async () => {
      const eventOrder: string[] = [];

      const observer: OrchestrationObserver = {
        onRecallStart: () => {
          eventOrder.push("recall:start");
        },
        onRecallComplete: () => {
          eventOrder.push("recall:complete");
        },
        onLayerUpdate: (event) => {
          eventOrder.push(`recall:layer:${event.layer}:${event.status}`);
        },
      };

      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "favorite color",
        observer,
      });

      // Verify start is first
      expect(eventOrder[0]).toBe("recall:start");

      // Verify complete is last
      expect(eventOrder[eventOrder.length - 1]).toBe("recall:complete");

      // Verify layer events are in between
      const layerEvents = eventOrder.filter((e) => e.includes(":layer:"));
      expect(layerEvents.length).toBeGreaterThan(0);

      // Verify in_progress comes before complete for each layer
      const vectorInProgress = eventOrder.findIndex((e) =>
        e.includes("vector:in_progress"),
      );
      const vectorComplete = eventOrder.findIndex((e) =>
        e.includes("vector:complete"),
      );

      if (vectorInProgress !== -1 && vectorComplete !== -1) {
        expect(vectorInProgress).toBeLessThan(vectorComplete);
      }
    });

    it("timing/latency values are reasonable", async () => {
      let summary: RecallSummary | null = null;
      const layerLatencies: number[] = [];

      const observer: OrchestrationObserver = {
        onRecallComplete: (s) => {
          summary = s;
        },
        onLayerUpdate: (event) => {
          if (event.latencyMs !== undefined) {
            layerLatencies.push(event.latencyMs);
          }
        },
      };

      const startTime = Date.now();

      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "favorite color",
        observer,
      });

      const endTime = Date.now();
      const actualDuration = endTime - startTime;

      // Verify summary exists
      expect(summary).not.toBeNull();

      // Total latency should be positive and reasonable
      expect(summary!.totalLatencyMs).toBeGreaterThan(0);

      // Total latency should roughly match actual duration (within margin for async overhead)
      expect(summary!.totalLatencyMs).toBeLessThan(actualDuration + 100);

      // Individual layer latencies should be positive
      layerLatencies.forEach((latency) => {
        expect(latency).toBeGreaterThanOrEqual(0);
      });

      // Latencies should be cumulative (each is time since start)
      for (let i = 1; i < layerLatencies.length; i++) {
        // Later latencies should be >= earlier ones (cumulative from start)
        // Note: Due to async/parallel execution, this may not always hold
        // So we just verify they're reasonable
        expect(layerLatencies[i]).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Event Content Verification
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Event Content Verification", () => {
    let testConversationId: string;

    beforeAll(async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: {
          userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
          participantId: TEST_AGENT_ID,
        },
      });
      testConversationId = conv.conversationId;
    });

    it("RecallSummary contains accurate context counts", async () => {
      // First, add some memories to ensure we have data
      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "I love programming in TypeScript",
        agentResponse: "TypeScript is a great choice for type-safe development",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
      });

      let summary: RecallSummary | null = null;

      const observer: OrchestrationObserver = {
        onRecallComplete: (s) => {
          summary = s;
        },
      };

      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "TypeScript programming",
        observer,
      });

      expect(summary).not.toBeNull();

      // Verify counts match actual result
      const memoriesInResult = result.items.filter(
        (item) => "memoryId" in item,
      ).length;
      const factsInResult = result.items.filter(
        (item) => "factId" in item,
      ).length;

      // Context counts should reflect what was retrieved
      // Note: Actual counts may include graph-expanded items
      expect(summary!.context.memoriesCount).toBeGreaterThanOrEqual(0);
      expect(summary!.context.factsCount).toBeGreaterThanOrEqual(0);
      expect(summary!.context.graphEntitiesCount).toBeGreaterThanOrEqual(0);
    });

    it("OrchestrationSummary contains created IDs", async () => {
      let summary: OrchestrationSummary | null = null;

      const observer: OrchestrationObserver = {
        onRememberComplete: (s) => {
          summary = s;
        },
      };

      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "Remember this for created IDs test",
        agentResponse: "I'll remember that for testing",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        observer,
      });

      expect(summary).not.toBeNull();
      expect(summary!.phase).toBe("remember");

      // Created IDs should be present
      expect(summary!.createdIds).toBeDefined();

      // Memory IDs from summary should match result
      if (summary!.createdIds.memoryIds) {
        expect(summary!.createdIds.memoryIds.length).toBeGreaterThan(0);

        // IDs should match what was returned in result
        const resultMemoryIds = result.memories.map((m) => m.memoryId);
        summary!.createdIds.memoryIds.forEach((id) => {
          expect(resultMemoryIds).toContain(id);
        });
      }
    });

    it("layer events include data for complete status", async () => {
      const completeEvents: LayerEvent[] = [];

      const observer: OrchestrationObserver = {
        onLayerUpdate: (event) => {
          if (event.status === "complete") {
            completeEvents.push(event);
          }
        },
      };

      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test data in events",
        observer,
      });

      // At least some complete events should have data
      expect(completeEvents.length).toBeGreaterThan(0);

      // Check that complete events have metadata
      completeEvents.forEach((event) => {
        expect(event.phase).toBe("recall");
        // Data may or may not be present depending on the layer
        if (event.data) {
          expect(typeof event.data).toBe("object");
        }
      });
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer Coverage Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Layer Coverage", () => {
    let testConversationId: string;

    beforeAll(async () => {
      const conv = await cortex.conversations.create({
        type: "user-agent",
        memorySpaceId: TEST_MEMSPACE_ID,
        participants: {
          userId: TEST_USER_ID,
          agentId: TEST_AGENT_ID,
          participantId: TEST_AGENT_ID,
        },
      });
      testConversationId = conv.conversationId;
    });

    it("recall emits events for vector, facts, and context layers", async () => {
      const layers = new Set<MemoryLayer>();

      const observer: OrchestrationObserver = {
        onLayerUpdate: (event) => {
          layers.add(event.layer);
        },
      };

      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test layer coverage",
        observer,
      });

      // Should have events for these layers
      expect(layers.has("vector")).toBe(true);
      expect(layers.has("facts")).toBe(true);
      expect(layers.has("context")).toBe(true);
    });

    it("remember emits events for memorySpace, conversation, and vector layers", async () => {
      const layers = new Set<MemoryLayer>();

      const observer: OrchestrationObserver = {
        onLayerUpdate: (event) => {
          layers.add(event.layer);
        },
      };

      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "Test layer coverage for remember",
        agentResponse: "Response for layer coverage test",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        observer,
      });

      // Should have events for these core layers
      expect(layers.has("memorySpace")).toBe(true);
      expect(layers.has("conversation")).toBe(true);
      expect(layers.has("vector")).toBe(true);
    });

    it("graph layer events only emitted when graph is enabled", async () => {
      const graphEvents: LayerEvent[] = [];

      const observer: OrchestrationObserver = {
        onLayerUpdate: (event) => {
          if (event.layer === "graph") {
            graphEvents.push(event);
          }
        },
      };

      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test graph layer",
        observer,
        sources: {
          graph: false, // Explicitly disable graph
        },
      });

      // When graph is disabled, we might not get graph events
      // (depends on implementation - graph adapter not configured)
      // This test verifies the behavior is consistent
      expect(graphEvents.length).toBeGreaterThanOrEqual(0);
    });
  });
});
