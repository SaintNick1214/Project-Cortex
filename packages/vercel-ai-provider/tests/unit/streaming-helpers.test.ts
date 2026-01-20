/**
 * Unit Tests: Streaming Helpers
 *
 * Tests for createLayerStreamObserver and related utilities
 */

import {
  createLayerStreamObserver,
  LAYER_STREAM_EVENTS,
  type StreamWriter,
} from "../../src/streaming-helpers";
import type { LayerEvent, OrchestrationSummary, MemoryLayer } from "../../src/types";

/**
 * Create a minimal valid OrchestrationSummary for testing
 */
function createTestSummary(
  overrides: Partial<OrchestrationSummary> = {}
): OrchestrationSummary {
  const defaultLayers: Record<MemoryLayer, LayerEvent> = {
    memorySpace: { layer: "memorySpace", status: "complete", timestamp: Date.now() },
    user: { layer: "user", status: "complete", timestamp: Date.now() },
    agent: { layer: "agent", status: "complete", timestamp: Date.now() },
    conversation: { layer: "conversation", status: "complete", timestamp: Date.now() },
    vector: { layer: "vector", status: "complete", timestamp: Date.now() },
    facts: { layer: "facts", status: "complete", timestamp: Date.now() },
    graph: { layer: "graph", status: "complete", timestamp: Date.now() },
  };

  return {
    orchestrationId: "test-orch-id",
    totalLatencyMs: 100,
    layers: defaultLayers,
    createdIds: {},
    ...overrides,
  };
}

describe("Streaming Helpers", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // createLayerStreamObserver
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("createLayerStreamObserver", () => {
    it("should create observer with correct structure", () => {
      const { observer, emitTo } = createLayerStreamObserver();

      expect(observer).toBeDefined();
      expect(typeof observer.onOrchestrationStart).toBe("function");
      expect(typeof observer.onLayerUpdate).toBe("function");
      expect(typeof observer.onOrchestrationComplete).toBe("function");
      expect(typeof emitTo).toBe("function");
    });

    it("should not throw when writer is not connected", () => {
      const { observer } = createLayerStreamObserver();

      // These should not throw even without a connected writer
      expect(() => observer.onOrchestrationStart?.("test-id")).not.toThrow();
      expect(() =>
        observer.onLayerUpdate?.({
          layer: "vector",
          status: "in_progress",
          timestamp: Date.now(),
        })
      ).not.toThrow();
      expect(() =>
        observer.onOrchestrationComplete?.(createTestSummary())
      ).not.toThrow();
    });

    it("should emit events after emitTo is called", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const mockWriter: StreamWriter = {
        write: jest.fn(),
      };

      emitTo(mockWriter);

      observer.onOrchestrationStart?.("test-id");

      expect(mockWriter.write).toHaveBeenCalledTimes(1);
    });

    it("should allow multiple emitTo calls, using the latest writer", () => {
      const { observer, emitTo } = createLayerStreamObserver();

      const mockWriter1: StreamWriter = { write: jest.fn() };
      const mockWriter2: StreamWriter = { write: jest.fn() };

      emitTo(mockWriter1);
      observer.onOrchestrationStart?.("id-1");

      expect(mockWriter1.write).toHaveBeenCalledTimes(1);
      expect(mockWriter2.write).toHaveBeenCalledTimes(0);

      // Switch to second writer
      emitTo(mockWriter2);
      observer.onOrchestrationStart?.("id-2");

      expect(mockWriter1.write).toHaveBeenCalledTimes(1); // Still 1
      expect(mockWriter2.write).toHaveBeenCalledTimes(1); // Now 1
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // onOrchestrationStart
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("onOrchestrationStart", () => {
    it("should write correct event format", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const mockWriter: StreamWriter = { write: jest.fn() };
      emitTo(mockWriter);

      observer.onOrchestrationStart?.("orch-123");

      expect(mockWriter.write).toHaveBeenCalledWith({
        type: "data-orchestration-start",
        data: { orchestrationId: "orch-123" },
        transient: true,
      });
    });

    it("should set transient flag to true", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const mockWriter: StreamWriter = { write: jest.fn() };
      emitTo(mockWriter);

      observer.onOrchestrationStart?.("test-id");

      const call = (mockWriter.write as jest.Mock).mock.calls[0][0];
      expect(call.transient).toBe(true);
    });

    it("should use correct event type constant", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const mockWriter: StreamWriter = { write: jest.fn() };
      emitTo(mockWriter);

      observer.onOrchestrationStart?.("test-id");

      const call = (mockWriter.write as jest.Mock).mock.calls[0][0];
      expect(call.type).toBe(LAYER_STREAM_EVENTS.ORCHESTRATION_START);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // onLayerUpdate
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("onLayerUpdate", () => {
    it("should write correct event format for minimal event", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const mockWriter: StreamWriter = { write: jest.fn() };
      emitTo(mockWriter);

      const event: LayerEvent = {
        layer: "vector",
        status: "in_progress",
        timestamp: 1234567890,
      };

      observer.onLayerUpdate?.(event);

      expect(mockWriter.write).toHaveBeenCalledWith({
        type: "data-layer-update",
        data: {
          layer: "vector",
          status: "in_progress",
          timestamp: 1234567890,
          latencyMs: undefined,
          data: undefined,
          error: undefined,
          revisionAction: undefined,
          supersededFacts: undefined,
        },
        transient: true,
      });
    });

    it("should include all optional fields when provided", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const mockWriter: StreamWriter = { write: jest.fn() };
      emitTo(mockWriter);

      const event: LayerEvent = {
        layer: "facts",
        status: "complete",
        timestamp: 1234567890,
        latencyMs: 150,
        data: {
          id: "fact-123",
          preview: "User prefers dark mode",
          metadata: { confidence: 0.95 },
        },
        revisionAction: "SUPERSEDE",
        supersededFacts: ["fact-old-1", "fact-old-2"],
      };

      observer.onLayerUpdate?.(event);

      const call = (mockWriter.write as jest.Mock).mock.calls[0][0];
      expect(call.data.layer).toBe("facts");
      expect(call.data.status).toBe("complete");
      expect(call.data.latencyMs).toBe(150);
      expect(call.data.data.id).toBe("fact-123");
      expect(call.data.data.preview).toBe("User prefers dark mode");
      expect(call.data.revisionAction).toBe("SUPERSEDE");
      expect(call.data.supersededFacts).toEqual(["fact-old-1", "fact-old-2"]);
    });

    it("should include error field when provided", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const mockWriter: StreamWriter = { write: jest.fn() };
      emitTo(mockWriter);

      const event: LayerEvent = {
        layer: "graph",
        status: "error",
        timestamp: 1234567890,
        error: {
          message: "Connection failed",
          code: "GRAPH_CONNECTION_ERROR",
        },
      };

      observer.onLayerUpdate?.(event);

      const call = (mockWriter.write as jest.Mock).mock.calls[0][0];
      expect(call.data.error).toEqual({
        message: "Connection failed",
        code: "GRAPH_CONNECTION_ERROR",
      });
    });

    it("should use correct event type constant", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const mockWriter: StreamWriter = { write: jest.fn() };
      emitTo(mockWriter);

      observer.onLayerUpdate?.({
        layer: "vector",
        status: "complete",
        timestamp: Date.now(),
      });

      const call = (mockWriter.write as jest.Mock).mock.calls[0][0];
      expect(call.type).toBe(LAYER_STREAM_EVENTS.LAYER_UPDATE);
    });

    it("should handle all layer types", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const mockWriter: StreamWriter = { write: jest.fn() };
      emitTo(mockWriter);

      const layers = [
        "memorySpace",
        "user",
        "agent",
        "conversation",
        "vector",
        "facts",
        "graph",
      ] as const;

      for (const layer of layers) {
        observer.onLayerUpdate?.({
          layer,
          status: "complete",
          timestamp: Date.now(),
        });
      }

      expect(mockWriter.write).toHaveBeenCalledTimes(layers.length);

      // Verify each layer was written
      const writtenLayers = (mockWriter.write as jest.Mock).mock.calls.map(
        (call) => call[0].data.layer
      );
      expect(writtenLayers).toEqual(layers);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // onOrchestrationComplete
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("onOrchestrationComplete", () => {
    it("should write correct event format for minimal summary", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const mockWriter: StreamWriter = { write: jest.fn() };
      emitTo(mockWriter);

      const summary = createTestSummary({
        orchestrationId: "orch-456",
        totalLatencyMs: 250,
        createdIds: {},
      });

      observer.onOrchestrationComplete?.(summary);

      expect(mockWriter.write).toHaveBeenCalledWith({
        type: "data-orchestration-complete",
        data: {
          orchestrationId: "orch-456",
          totalLatencyMs: 250,
          createdIds: {},
        },
        transient: true,
      });
    });

    it("should include createdIds when provided", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const mockWriter: StreamWriter = { write: jest.fn() };
      emitTo(mockWriter);

      const summary = createTestSummary({
        orchestrationId: "orch-789",
        totalLatencyMs: 300,
        createdIds: {
          conversationId: "conv-123",
          memoryIds: ["mem-1"],
          factIds: ["fact-1", "fact-2"],
        },
      });

      observer.onOrchestrationComplete?.(summary);

      const call = (mockWriter.write as jest.Mock).mock.calls[0][0];
      expect(call.data.createdIds).toEqual({
        conversationId: "conv-123",
        memoryIds: ["mem-1"],
        factIds: ["fact-1", "fact-2"],
      });
    });

    it("should use correct event type constant", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const mockWriter: StreamWriter = { write: jest.fn() };
      emitTo(mockWriter);

      observer.onOrchestrationComplete?.(createTestSummary({
        orchestrationId: "test",
        totalLatencyMs: 100,
      }));

      const call = (mockWriter.write as jest.Mock).mock.calls[0][0];
      expect(call.type).toBe(LAYER_STREAM_EVENTS.ORCHESTRATION_COMPLETE);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Full Lifecycle
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("full orchestration lifecycle", () => {
    it("should emit events in correct order", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const mockWriter: StreamWriter = { write: jest.fn() };
      emitTo(mockWriter);

      // Simulate full orchestration
      observer.onOrchestrationStart?.("orch-lifecycle");

      observer.onLayerUpdate?.({
        layer: "memorySpace",
        status: "in_progress",
        timestamp: Date.now(),
      });
      observer.onLayerUpdate?.({
        layer: "memorySpace",
        status: "complete",
        timestamp: Date.now(),
      });

      observer.onLayerUpdate?.({
        layer: "vector",
        status: "in_progress",
        timestamp: Date.now(),
      });
      observer.onLayerUpdate?.({
        layer: "vector",
        status: "complete",
        timestamp: Date.now(),
      });

      observer.onOrchestrationComplete?.(createTestSummary({
        orchestrationId: "orch-lifecycle",
        totalLatencyMs: 500,
      }));

      // Should have 6 events: 1 start + 4 layer updates + 1 complete
      expect(mockWriter.write).toHaveBeenCalledTimes(6);

      // Verify order by type
      const calls = (mockWriter.write as jest.Mock).mock.calls;
      expect(calls[0][0].type).toBe("data-orchestration-start");
      expect(calls[1][0].type).toBe("data-layer-update");
      expect(calls[2][0].type).toBe("data-layer-update");
      expect(calls[3][0].type).toBe("data-layer-update");
      expect(calls[4][0].type).toBe("data-layer-update");
      expect(calls[5][0].type).toBe("data-orchestration-complete");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LAYER_STREAM_EVENTS constants
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("LAYER_STREAM_EVENTS", () => {
    it("should have correct constant values", () => {
      expect(LAYER_STREAM_EVENTS.ORCHESTRATION_START).toBe(
        "data-orchestration-start"
      );
      expect(LAYER_STREAM_EVENTS.LAYER_UPDATE).toBe("data-layer-update");
      expect(LAYER_STREAM_EVENTS.ORCHESTRATION_COMPLETE).toBe(
        "data-orchestration-complete"
      );
    });
  });
});
