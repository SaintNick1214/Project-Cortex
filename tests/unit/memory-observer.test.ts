/**
 * Unit Tests: Memory Orchestration Observer
 *
 * Tests observer callbacks for phase-aware orchestration.
 * Uses mock observers to capture and verify events.
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
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

describe("Memory Orchestration Observer", () => {
  let cortex: Cortex;
  let _client: ConvexClient;

  // Use ctx-scoped IDs for parallel execution isolation
  const TEST_MEMSPACE_ID = ctx.memorySpaceId("observer");
  const TEST_USER_ID = ctx.userId("observer");
  const TEST_AGENT_ID = ctx.agentId("observer");
  const TEST_USER_NAME = "Test Observer User";

  // Mock observer that captures all events
  interface MockObserverState {
    recallStartCalls: string[];
    recallCompleteCalls: RecallSummary[];
    rememberStartCalls: string[];
    rememberCompleteCalls: OrchestrationSummary[];
    layerUpdateCalls: LayerEvent[];
  }

  let observerState: MockObserverState;

  function createMockObserver(): OrchestrationObserver {
    return {
      onRecallStart: jest.fn((id: string) => {
        observerState.recallStartCalls.push(id);
      }),
      onRecallComplete: jest.fn((summary: RecallSummary) => {
        observerState.recallCompleteCalls.push(summary);
      }),
      onRememberStart: jest.fn((id: string) => {
        observerState.rememberStartCalls.push(id);
      }),
      onRememberComplete: jest.fn((summary: OrchestrationSummary) => {
        observerState.rememberCompleteCalls.push(summary);
      }),
      onLayerUpdate: jest.fn((event: LayerEvent) => {
        observerState.layerUpdateCalls.push(event);
      }),
    };
  }

  beforeEach(() => {
    // Reset observer state before each test
    observerState = {
      recallStartCalls: [],
      recallCompleteCalls: [],
      rememberStartCalls: [],
      rememberCompleteCalls: [],
      layerUpdateCalls: [],
    };
  });

  beforeAll(async () => {
    cortex = new Cortex({ convexUrl: CONVEX_URL });
    _client = new ConvexClient(CONVEX_URL);
  });

  afterAll(async () => {
    await _client.close();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // recall() Observer Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("recall() observer callbacks", () => {
    it("observer.onRecallStart is called with orchestrationId", async () => {
      const observer = createMockObserver();

      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test query",
        observer,
      });

      // Verify onRecallStart was called
      expect(observerState.recallStartCalls).toHaveLength(1);

      // Verify orchestrationId format
      const orchestrationId = observerState.recallStartCalls[0];
      expect(orchestrationId).toMatch(/^orch-\d+-[a-z0-9]+$/);
    });

    it("vector layer event emitted with phase: 'recall'", async () => {
      const observer = createMockObserver();

      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test query",
        observer,
      });

      // Find vector layer events
      const vectorEvents = observerState.layerUpdateCalls.filter(
        (e) => e.layer === "vector",
      );

      // Should have at least in_progress and complete events
      expect(vectorEvents.length).toBeGreaterThanOrEqual(1);

      // All vector events should have phase: "recall"
      vectorEvents.forEach((event) => {
        expect(event.phase).toBe("recall");
        expect(event.layer).toBe("vector");
        expect(["in_progress", "complete", "error", "skipped"]).toContain(
          event.status,
        );
      });
    });

    it("facts layer event emitted with phase: 'recall'", async () => {
      const observer = createMockObserver();

      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test query",
        observer,
      });

      // Find facts layer events
      const factsEvents = observerState.layerUpdateCalls.filter(
        (e) => e.layer === "facts",
      );

      // Should have at least in_progress and complete events
      expect(factsEvents.length).toBeGreaterThanOrEqual(1);

      // All facts events should have phase: "recall"
      factsEvents.forEach((event) => {
        expect(event.phase).toBe("recall");
        expect(event.layer).toBe("facts");
      });
    });

    it("context layer event emitted with phase: 'recall'", async () => {
      const observer = createMockObserver();

      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test query",
        observer,
      });

      // Find context layer events
      const contextEvents = observerState.layerUpdateCalls.filter(
        (e) => e.layer === "context",
      );

      // Context layer should have events (in_progress and complete)
      expect(contextEvents.length).toBeGreaterThanOrEqual(1);

      // All context events should have phase: "recall"
      contextEvents.forEach((event) => {
        expect(event.phase).toBe("recall");
        expect(event.layer).toBe("context");
      });
    });

    it("observer.onRecallComplete called with RecallSummary", async () => {
      const observer = createMockObserver();

      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test query",
        observer,
      });

      // Verify onRecallComplete was called
      expect(observerState.recallCompleteCalls).toHaveLength(1);

      const summary = observerState.recallCompleteCalls[0];

      // Verify RecallSummary structure
      expect(summary.orchestrationId).toMatch(/^orch-\d+-[a-z0-9]+$/);
      expect(summary.phase).toBe("recall");
      expect(typeof summary.totalLatencyMs).toBe("number");
      expect(summary.totalLatencyMs).toBeGreaterThan(0);

      // Verify context structure
      expect(summary.context).toBeDefined();
      expect(typeof summary.context.memoriesCount).toBe("number");
      expect(typeof summary.context.factsCount).toBe("number");
      expect(typeof summary.context.graphEntitiesCount).toBe("number");
    });

    it("recall works without observer (backward compat)", async () => {
      // Call recall without observer
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test query",
        // No observer
      });

      // Should still return valid result
      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);
    });

    it("observer errors don't fail recall operation", async () => {
      // Create an observer that throws errors
      const throwingObserver: OrchestrationObserver = {
        onRecallStart: () => {
          throw new Error("Observer start error");
        },
        onRecallComplete: () => {
          throw new Error("Observer complete error");
        },
        onLayerUpdate: () => {
          throw new Error("Observer layer error");
        },
      };

      // Suppress console.warn during this test
      const originalWarn = console.warn;
      console.warn = jest.fn();

      try {
        // Recall should complete despite observer errors
        const result = await cortex.memory.recall({
          memorySpaceId: TEST_MEMSPACE_ID,
          query: "test query",
          observer: throwingObserver,
        });

        // Result should be valid
        expect(result).toBeDefined();
        expect(result.items).toBeDefined();
      } finally {
        console.warn = originalWarn;
      }
    });

    it("layer events include timing information", async () => {
      const observer = createMockObserver();

      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test query",
        observer,
      });

      // Find complete events (they have latency info)
      const completeEvents = observerState.layerUpdateCalls.filter(
        (e) => e.status === "complete",
      );

      // At least some complete events should exist
      expect(completeEvents.length).toBeGreaterThan(0);

      completeEvents.forEach((event) => {
        expect(event.timestamp).toBeDefined();
        expect(typeof event.timestamp).toBe("number");

        // latencyMs should be present for complete events
        if (event.latencyMs !== undefined) {
          expect(typeof event.latencyMs).toBe("number");
          expect(event.latencyMs).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it("orchestrationId is consistent across all events", async () => {
      const observer = createMockObserver();

      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test query",
        observer,
      });

      const startId = observerState.recallStartCalls[0];
      const completeId = observerState.recallCompleteCalls[0]?.orchestrationId;

      // IDs should match
      expect(startId).toBe(completeId);
    });

    it("events are emitted in correct order", async () => {
      const observer = createMockObserver();
      const eventOrder: string[] = [];

      // Override observer to track order
      observer.onRecallStart = jest.fn(() => {
        eventOrder.push("start");
      });
      observer.onLayerUpdate = jest.fn((event: LayerEvent) => {
        eventOrder.push(`layer:${event.layer}:${event.status}`);
      });
      observer.onRecallComplete = jest.fn(() => {
        eventOrder.push("complete");
      });

      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test query",
        observer,
      });

      // Start should be first
      expect(eventOrder[0]).toBe("start");

      // Complete should be last
      expect(eventOrder[eventOrder.length - 1]).toBe("complete");

      // Layer events should be in between
      expect(eventOrder.length).toBeGreaterThan(2);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // remember() Observer Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("remember() observer callbacks", () => {
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
    });

    it("observer.onRememberStart is called (not onOrchestrationStart)", async () => {
      const observer = createMockObserver();

      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "Test message for observer",
        agentResponse: "Test response for observer",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        observer,
      });

      // onRememberStart should be called
      expect(observerState.rememberStartCalls).toHaveLength(1);
      expect(observerState.rememberStartCalls[0]).toMatch(
        /^orch-\d+-[a-z0-9]+$/,
      );

      // onRecallStart should NOT be called
      expect(observerState.recallStartCalls).toHaveLength(0);
    });

    it("all layer events include phase: 'remember'", async () => {
      const observer = createMockObserver();

      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "Test message for phases",
        agentResponse: "Test response for phases",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        observer,
      });

      // All layer events should have phase: "remember"
      expect(observerState.layerUpdateCalls.length).toBeGreaterThan(0);

      observerState.layerUpdateCalls.forEach((event) => {
        expect(event.phase).toBe("remember");
      });
    });

    it("observer.onRememberComplete called (not onOrchestrationComplete)", async () => {
      const observer = createMockObserver();

      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "Test message for complete",
        agentResponse: "Test response for complete",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        observer,
      });

      // onRememberComplete should be called
      expect(observerState.rememberCompleteCalls).toHaveLength(1);

      const summary = observerState.rememberCompleteCalls[0];
      expect(summary.orchestrationId).toMatch(/^orch-\d+-[a-z0-9]+$/);
      expect(summary.phase).toBe("remember");
      expect(typeof summary.totalLatencyMs).toBe("number");

      // onRecallComplete should NOT be called
      expect(observerState.recallCompleteCalls).toHaveLength(0);
    });

    it("remember works without observer", async () => {
      const result = await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "Test without observer",
        agentResponse: "Response without observer",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        // No observer
      });

      // Should still return valid result
      expect(result).toBeDefined();
      expect(result.conversation).toBeDefined();
      expect(result.memories).toBeDefined();
    });

    it("emits layer events for key remember layers", async () => {
      const observer = createMockObserver();

      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "Test for layer events",
        agentResponse: "Response for layer events",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        observer,
      });

      // Get unique layers from events
      const layers = new Set(
        observerState.layerUpdateCalls.map((e) => e.layer),
      );

      // Should include core remember layers
      expect(layers.has("memorySpace")).toBe(true);
      expect(layers.has("conversation")).toBe(true);
      expect(layers.has("vector")).toBe(true);
    });

    it("layer events progress from in_progress to complete", async () => {
      const observer = createMockObserver();

      await cortex.memory.remember({
        memorySpaceId: TEST_MEMSPACE_ID,
        conversationId: testConversationId,
        userMessage: "Test for status progression",
        agentResponse: "Response for status progression",
        userId: TEST_USER_ID,
        userName: TEST_USER_NAME,
        agentId: TEST_AGENT_ID,
        observer,
      });

      // Group events by layer
      const eventsByLayer = new Map<MemoryLayer, LayerEvent[]>();
      observerState.layerUpdateCalls.forEach((event) => {
        const existing = eventsByLayer.get(event.layer) || [];
        existing.push(event);
        eventsByLayer.set(event.layer, existing);
      });

      // For each layer with multiple events, verify order
      eventsByLayer.forEach((events, layer) => {
        if (events.length >= 2) {
          const firstEvent = events[0];
          const lastEvent = events[events.length - 1];

          // First event should be in_progress or similar starting status
          expect(["pending", "in_progress"]).toContain(firstEvent.status);

          // Last event should be a terminal status
          expect(["complete", "error", "skipped"]).toContain(lastEvent.status);
        }
      });
    });

    it("observer errors don't fail remember operation", async () => {
      // Create an observer that throws errors
      const throwingObserver: OrchestrationObserver = {
        onRememberStart: () => {
          throw new Error("Observer start error");
        },
        onRememberComplete: () => {
          throw new Error("Observer complete error");
        },
        onLayerUpdate: () => {
          throw new Error("Observer layer error");
        },
      };

      // Suppress console.warn during this test
      const originalWarn = console.warn;
      console.warn = jest.fn();

      try {
        // Remember should complete despite observer errors
        const result = await cortex.memory.remember({
          memorySpaceId: TEST_MEMSPACE_ID,
          conversationId: testConversationId,
          userMessage: "Test with throwing observer",
          agentResponse: "Response with throwing observer",
          userId: TEST_USER_ID,
          userName: TEST_USER_NAME,
          agentId: TEST_AGENT_ID,
          observer: throwingObserver,
        });

        // Result should be valid
        expect(result).toBeDefined();
        expect(result.conversation).toBeDefined();
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Edge Cases and Error Handling
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Edge Cases", () => {
    it("handles async observer methods", async () => {
      let asyncStartCalled = false;
      let asyncCompleteCalled = false;

      const asyncObserver: OrchestrationObserver = {
        onRecallStart: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          asyncStartCalled = true;
        },
        onRecallComplete: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          asyncCompleteCalled = true;
        },
      };

      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test async observer",
        observer: asyncObserver,
      });

      // Give async callbacks time to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(asyncStartCalled).toBe(true);
      expect(asyncCompleteCalled).toBe(true);
    });

    it("handles partial observer (only some methods defined)", async () => {
      let layerUpdateCount = 0;

      const partialObserver: OrchestrationObserver = {
        // Only define onLayerUpdate
        onLayerUpdate: () => {
          layerUpdateCount++;
        },
        // Other methods not defined
      };

      await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test partial observer",
        observer: partialObserver,
      });

      // Layer updates should still be called
      expect(layerUpdateCount).toBeGreaterThan(0);
    });

    it("empty observer object is valid", async () => {
      const emptyObserver: OrchestrationObserver = {};

      // Should not throw
      const result = await cortex.memory.recall({
        memorySpaceId: TEST_MEMSPACE_ID,
        query: "test empty observer",
        observer: emptyObserver,
      });

      expect(result).toBeDefined();
    });
  });
});
