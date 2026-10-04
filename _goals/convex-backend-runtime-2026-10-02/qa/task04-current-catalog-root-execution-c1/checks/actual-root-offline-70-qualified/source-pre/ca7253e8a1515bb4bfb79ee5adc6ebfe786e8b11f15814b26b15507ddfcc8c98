/**
 * Unit Tests: TypeScript Type Definitions
 *
 * Tests type correctness for phase-aware orchestration types.
 * These are compile-time checks that verify types are correctly defined.
 */

import { describe, it, expect } from "@jest/globals";
import type {
  LayerEvent,
  MemoryLayer,
  LayerStatus,
  OrchestrationObserver,
  RecallSummary,
  OrchestrationSummary,
} from "../../src/types";

describe("Phase-Aware Orchestration Types", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MemoryLayer Type Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("MemoryLayer", () => {
    it("includes 'context' as a valid layer type", () => {
      // Type assertion: context must be assignable to MemoryLayer
      const contextLayer: MemoryLayer = "context";
      expect(contextLayer).toBe("context");

      // Verify all expected layer types exist
      const allLayers: MemoryLayer[] = [
        "memorySpace",
        "user",
        "agent",
        "conversation",
        "vector",
        "facts",
        "graph",
        "context",
      ];

      // Verify each is a valid MemoryLayer (compile-time check)
      allLayers.forEach((layer) => {
        expect(typeof layer).toBe("string");
      });
    });

    it("includes all remember phase layers", () => {
      const rememberLayers: MemoryLayer[] = [
        "memorySpace",
        "user",
        "agent",
        "conversation",
        "vector",
        "facts",
        "graph",
      ];

      expect(rememberLayers).toHaveLength(7);
    });

    it("includes all recall phase layers", () => {
      const recallLayers: MemoryLayer[] = ["vector", "facts", "graph", "context"];

      expect(recallLayers).toHaveLength(4);
      expect(recallLayers).toContain("context");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LayerEvent Type Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("LayerEvent", () => {
    it("accepts phase field with 'recall' value", () => {
      const event: LayerEvent = {
        layer: "vector",
        status: "complete",
        timestamp: Date.now(),
        phase: "recall",
      };

      expect(event.phase).toBe("recall");
      expect(event.layer).toBe("vector");
    });

    it("accepts phase field with 'remember' value", () => {
      const event: LayerEvent = {
        layer: "conversation",
        status: "in_progress",
        timestamp: Date.now(),
        phase: "remember",
      };

      expect(event.phase).toBe("remember");
      expect(event.layer).toBe("conversation");
    });

    it("phase field is required (not optional)", () => {
      // Create a valid LayerEvent - phase is required
      const event: LayerEvent = {
        layer: "facts",
        status: "complete",
        timestamp: Date.now(),
        phase: "recall", // Required field
      };

      expect(event).toHaveProperty("phase");
      expect(["recall", "remember"]).toContain(event.phase);
    });

    it("includes optional latencyMs field", () => {
      const eventWithLatency: LayerEvent = {
        layer: "vector",
        status: "complete",
        timestamp: Date.now(),
        phase: "recall",
        latencyMs: 150,
      };

      expect(eventWithLatency.latencyMs).toBe(150);

      const eventWithoutLatency: LayerEvent = {
        layer: "vector",
        status: "complete",
        timestamp: Date.now(),
        phase: "recall",
      };

      expect(eventWithoutLatency.latencyMs).toBeUndefined();
    });

    it("includes optional data field for complete status", () => {
      const event: LayerEvent = {
        layer: "vector",
        status: "complete",
        timestamp: Date.now(),
        phase: "recall",
        data: {
          id: "mem-123",
          preview: "User preference",
          metadata: { count: 5 },
        },
      };

      expect(event.data?.id).toBe("mem-123");
      expect(event.data?.metadata).toEqual({ count: 5 });
    });

    it("includes optional error field for error status", () => {
      const event: LayerEvent = {
        layer: "graph",
        status: "error",
        timestamp: Date.now(),
        phase: "recall",
        error: {
          message: "Connection timeout",
          code: "GRAPH_TIMEOUT",
        },
      };

      expect(event.error?.message).toBe("Connection timeout");
      expect(event.error?.code).toBe("GRAPH_TIMEOUT");
    });

    it("supports all LayerStatus values", () => {
      const statuses: LayerStatus[] = [
        "pending",
        "in_progress",
        "complete",
        "error",
        "skipped",
      ];

      statuses.forEach((status) => {
        const event: LayerEvent = {
          layer: "vector",
          status,
          timestamp: Date.now(),
          phase: "recall",
        };
        expect(event.status).toBe(status);
      });
    });

    it("includes optional revisionAction for facts layer", () => {
      const event: LayerEvent = {
        layer: "facts",
        status: "complete",
        timestamp: Date.now(),
        phase: "remember",
        revisionAction: "SUPERSEDE",
        supersededFacts: ["fact-old-1", "fact-old-2"],
      };

      expect(event.revisionAction).toBe("SUPERSEDE");
      expect(event.supersededFacts).toEqual(["fact-old-1", "fact-old-2"]);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // OrchestrationObserver Type Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("OrchestrationObserver", () => {
    it("has correct onRecallStart method signature", () => {
      const observer: OrchestrationObserver = {
        onRecallStart: (orchestrationId: string) => {
          expect(typeof orchestrationId).toBe("string");
        },
      };

      // Verify the method exists and can be called
      expect(observer.onRecallStart).toBeDefined();
      void observer.onRecallStart?.("test-id");
    });

    it("has correct onRecallComplete method signature", () => {
      const observer: OrchestrationObserver = {
        onRecallComplete: (summary: RecallSummary) => {
          expect(summary.orchestrationId).toBeDefined();
          expect(summary.phase).toBe("recall");
          expect(typeof summary.totalLatencyMs).toBe("number");
        },
      };

      expect(observer.onRecallComplete).toBeDefined();

      // Call with valid RecallSummary
      const mockSummary: RecallSummary = {
        orchestrationId: "orch-123",
        phase: "recall",
        totalLatencyMs: 100,
        layers: {},
        context: {
          memoriesCount: 5,
          factsCount: 3,
          graphEntitiesCount: 2,
        },
      };
      void observer.onRecallComplete?.(mockSummary);
    });

    it("has correct onRememberStart method signature", () => {
      const observer: OrchestrationObserver = {
        onRememberStart: (orchestrationId: string) => {
          expect(typeof orchestrationId).toBe("string");
        },
      };

      expect(observer.onRememberStart).toBeDefined();
      void observer.onRememberStart?.("test-id");
    });

    it("has correct onRememberComplete method signature", () => {
      const observer: OrchestrationObserver = {
        onRememberComplete: (summary: OrchestrationSummary) => {
          expect(summary.orchestrationId).toBeDefined();
          expect(summary.phase).toBe("remember");
          expect(typeof summary.totalLatencyMs).toBe("number");
        },
      };

      expect(observer.onRememberComplete).toBeDefined();
    });

    it("has correct onLayerUpdate method signature", () => {
      const observer: OrchestrationObserver = {
        onLayerUpdate: (event: LayerEvent) => {
          expect(event.layer).toBeDefined();
          expect(event.status).toBeDefined();
          expect(event.phase).toBeDefined();
          expect(event.timestamp).toBeDefined();
        },
      };

      expect(observer.onLayerUpdate).toBeDefined();

      const mockEvent: LayerEvent = {
        layer: "vector",
        status: "complete",
        timestamp: Date.now(),
        phase: "recall",
      };
      void observer.onLayerUpdate?.(mockEvent);
    });

    it("supports async observer methods", async () => {
      let asyncCalled = false;

      const asyncObserver: OrchestrationObserver = {
        onRecallStart: async (orchestrationId: string) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          asyncCalled = true;
          expect(orchestrationId).toBeDefined();
        },
      };

      // Verify async signature is accepted
      const result = asyncObserver.onRecallStart?.("test");
      expect(result).toBeInstanceOf(Promise);
      await result;
      expect(asyncCalled).toBe(true);
    });

    it("all methods are optional", () => {
      // Empty observer should be valid
      const emptyObserver: OrchestrationObserver = {};
      expect(emptyObserver.onRecallStart).toBeUndefined();
      expect(emptyObserver.onRecallComplete).toBeUndefined();
      expect(emptyObserver.onRememberStart).toBeUndefined();
      expect(emptyObserver.onRememberComplete).toBeUndefined();
      expect(emptyObserver.onLayerUpdate).toBeUndefined();
    });

    it("can combine multiple methods", () => {
      const layerUpdates: LayerEvent[] = [];

      const fullObserver: OrchestrationObserver = {
        onRecallStart: (id) => console.log(`Recall started: ${id}`),
        onRecallComplete: (summary) =>
          console.log(`Recall done in ${summary.totalLatencyMs}ms`),
        onRememberStart: (id) => console.log(`Remember started: ${id}`),
        onRememberComplete: (summary) =>
          console.log(`Remember done in ${summary.totalLatencyMs}ms`),
        onLayerUpdate: (event) => {
          layerUpdates.push(event);
        },
      };

      // All methods should be defined
      expect(fullObserver.onRecallStart).toBeDefined();
      expect(fullObserver.onRecallComplete).toBeDefined();
      expect(fullObserver.onRememberStart).toBeDefined();
      expect(fullObserver.onRememberComplete).toBeDefined();
      expect(fullObserver.onLayerUpdate).toBeDefined();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RecallSummary Type Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("RecallSummary", () => {
    it("has correct structure with all required fields", () => {
      const summary: RecallSummary = {
        orchestrationId: "orch-recall-123",
        phase: "recall",
        totalLatencyMs: 250,
        layers: {},
        context: {
          memoriesCount: 10,
          factsCount: 5,
          graphEntitiesCount: 3,
        },
      };

      expect(summary.orchestrationId).toBe("orch-recall-123");
      expect(summary.phase).toBe("recall");
      expect(summary.totalLatencyMs).toBe(250);
      expect(summary.context.memoriesCount).toBe(10);
      expect(summary.context.factsCount).toBe(5);
      expect(summary.context.graphEntitiesCount).toBe(3);
    });

    it("phase is always 'recall'", () => {
      const summary: RecallSummary = {
        orchestrationId: "test",
        phase: "recall",
        totalLatencyMs: 100,
        layers: {},
        context: {
          memoriesCount: 0,
          factsCount: 0,
          graphEntitiesCount: 0,
        },
      };

      // Phase must be "recall" - compile-time check
      expect(summary.phase).toBe("recall");
    });

    it("includes layer events keyed by MemoryLayer", () => {
      const vectorEvent: LayerEvent = {
        layer: "vector",
        status: "complete",
        timestamp: Date.now(),
        phase: "recall",
        latencyMs: 50,
      };

      const factsEvent: LayerEvent = {
        layer: "facts",
        status: "complete",
        timestamp: Date.now(),
        phase: "recall",
        latencyMs: 30,
      };

      const summary: RecallSummary = {
        orchestrationId: "test",
        phase: "recall",
        totalLatencyMs: 100,
        layers: {
          vector: vectorEvent,
          facts: factsEvent,
        },
        context: {
          memoriesCount: 5,
          factsCount: 3,
          graphEntitiesCount: 0,
        },
      };

      expect(summary.layers.vector?.status).toBe("complete");
      expect(summary.layers.facts?.latencyMs).toBe(30);
    });

    it("context includes optional formatted field", () => {
      const summary: RecallSummary = {
        orchestrationId: "test",
        phase: "recall",
        totalLatencyMs: 100,
        layers: {},
        context: {
          formatted: "## User Preferences\n- Dark mode enabled",
          memoriesCount: 1,
          factsCount: 0,
          graphEntitiesCount: 0,
        },
      };

      expect(summary.context.formatted).toContain("Dark mode");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // OrchestrationSummary Type Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("OrchestrationSummary", () => {
    it("has correct structure for remember phase", () => {
      const summary: OrchestrationSummary = {
        orchestrationId: "orch-remember-456",
        phase: "remember",
        totalLatencyMs: 500,
        layers: {} as Record<MemoryLayer, LayerEvent>,
        createdIds: {
          conversationId: "conv-123",
          memoryIds: ["mem-1", "mem-2"],
          factIds: ["fact-1"],
        },
      };

      expect(summary.orchestrationId).toBe("orch-remember-456");
      expect(summary.phase).toBe("remember");
      expect(summary.createdIds.conversationId).toBe("conv-123");
      expect(summary.createdIds.memoryIds).toHaveLength(2);
    });

    it("phase is always 'remember'", () => {
      const summary: OrchestrationSummary = {
        orchestrationId: "test",
        phase: "remember",
        totalLatencyMs: 100,
        layers: {} as Record<MemoryLayer, LayerEvent>,
        createdIds: {},
      };

      expect(summary.phase).toBe("remember");
    });

    it("createdIds fields are optional", () => {
      const summary: OrchestrationSummary = {
        orchestrationId: "test",
        phase: "remember",
        totalLatencyMs: 100,
        layers: {} as Record<MemoryLayer, LayerEvent>,
        createdIds: {},
      };

      expect(summary.createdIds.conversationId).toBeUndefined();
      expect(summary.createdIds.memoryIds).toBeUndefined();
      expect(summary.createdIds.factIds).toBeUndefined();
    });
  });
});
