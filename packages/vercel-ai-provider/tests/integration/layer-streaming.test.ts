/**
 * Integration Tests: Layer Streaming
 *
 * Tests the integration between createLayerStreamObserver and the
 * CortexMemoryProvider, verifying that layer events flow correctly
 * through the streaming pipeline.
 */

import {
  createLayerStreamObserver,
  LAYER_STREAM_EVENTS,
  type StreamWriter,
} from "../../src/streaming-helpers";
import { CortexMemoryProvider } from "../../src/provider";
import {
  createTestConfig,
  createMockLLM,
  createMockStream,
  consumeStream,
} from "../helpers/test-utils";
import type { LayerEvent, OrchestrationSummary, MemoryLayer } from "../../src/types";

/**
 * Create a valid LayerEvent for testing with required phase field
 */
function createTestLayerEvent(
  layer: MemoryLayer,
  status: "pending" | "in_progress" | "complete" | "error" | "skipped" = "complete",
  phase: "recall" | "remember" = "remember"
): LayerEvent {
  return {
    layer,
    status,
    timestamp: Date.now(),
    phase,
  };
}

/**
 * Create a minimal valid OrchestrationSummary for testing
 */
function createTestSummary(
  overrides: Partial<OrchestrationSummary> = {}
): OrchestrationSummary {
  const defaultLayers: Record<MemoryLayer, LayerEvent> = {
    memorySpace: createTestLayerEvent("memorySpace"),
    user: createTestLayerEvent("user"),
    agent: createTestLayerEvent("agent"),
    context: createTestLayerEvent("context", "complete", "recall"),
    conversation: createTestLayerEvent("conversation"),
    vector: createTestLayerEvent("vector"),
    facts: createTestLayerEvent("facts"),
    graph: createTestLayerEvent("graph"),
  };

  return {
    orchestrationId: "test-orch-id",
    phase: "remember",
    totalLatencyMs: 100,
    layers: defaultLayers,
    createdIds: {},
    ...overrides,
  };
}

// Mock Cortex SDK
const mockCortex = {
  memory: {
    recall: jest.fn().mockResolvedValue({
      context: "",
      totalResults: 0,
      queryTimeMs: 10,
      sources: {
        vector: { count: 0, items: [] },
        facts: { count: 0, items: [] },
        graph: { count: 0, items: [] },
      },
    }),
    rememberStream: jest.fn().mockResolvedValue({
      fullResponse: "Test response",
      conversation: { conversationId: "conv-1", messageIds: ["msg-1"] },
      memories: [],
      facts: [],
      streamMetrics: { totalChunks: 1, streamDurationMs: 100 },
    }),
  },
  close: jest.fn(),
};

jest.mock("@cortexmemory/sdk", () => ({
  Cortex: jest.fn().mockImplementation(() => mockCortex),
  CypherGraphAdapter: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe("Layer Streaming Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // createLayerStreamObserver + StreamWriter Integration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("observer + stream writer integration", () => {
    it("should write events to connected stream writer", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const writtenParts: Array<{ type: string; data: unknown; transient: boolean }> = [];

      const mockWriter: StreamWriter = {
        write: jest.fn((part) => {
          writtenParts.push(part as { type: string; data: unknown; transient: boolean });
        }),
      };

      emitTo(mockWriter);

      // Trigger events using phase-aware API
      observer.onRecallStart?.("orch-1");
      observer.onLayerUpdate?.(createTestLayerEvent("vector", "in_progress", "recall"));
      observer.onLayerUpdate?.({
        ...createTestLayerEvent("vector", "complete", "recall"),
        latencyMs: 50,
      });
      observer.onRememberComplete?.(createTestSummary({
        orchestrationId: "orch-1",
        totalLatencyMs: 100,
      }));

      expect(writtenParts).toHaveLength(4);
      expect(writtenParts[0].type).toBe(LAYER_STREAM_EVENTS.ORCHESTRATION_START);
      expect(writtenParts[1].type).toBe(LAYER_STREAM_EVENTS.LAYER_UPDATE);
      expect(writtenParts[2].type).toBe(LAYER_STREAM_EVENTS.LAYER_UPDATE);
      expect(writtenParts[3].type).toBe(LAYER_STREAM_EVENTS.ORCHESTRATION_COMPLETE);
    });

    it("should mark all events as transient", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const writtenParts: Array<{ type: string; data: unknown; transient: boolean }> = [];

      const mockWriter: StreamWriter = {
        write: (part) => {
          writtenParts.push(part as { type: string; data: unknown; transient: boolean });
        },
      };

      emitTo(mockWriter);

      observer.onRecallStart?.("test");
      observer.onLayerUpdate?.(createTestLayerEvent("vector", "complete", "recall"));
      observer.onRememberComplete?.(createTestSummary({ orchestrationId: "test", totalLatencyMs: 50 }));

      for (const part of writtenParts) {
        expect(part.transient).toBe(true);
      }
    });

    it("should preserve event order across multiple layer updates", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const writtenLayers: string[] = [];

      const mockWriter: StreamWriter = {
        write: (part) => {
          const p = part as { type: string; data: { layer?: string } };
          if (p.type === LAYER_STREAM_EVENTS.LAYER_UPDATE && p.data.layer) {
            writtenLayers.push(p.data.layer);
          }
        },
      };

      emitTo(mockWriter);

      // Simulate interleaved layer updates
      const layers = ["memorySpace", "user", "agent", "conversation", "vector", "facts", "graph"] as const;
      for (const layer of layers) {
        observer.onLayerUpdate?.(createTestLayerEvent(layer, "in_progress", "remember"));
      }

      expect(writtenLayers).toEqual(layers);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Observer with CortexMemoryProvider
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("observer with CortexMemoryProvider", () => {
    it("should pass layer observer to rememberStream", async () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const mockWriter: StreamWriter = { write: jest.fn() };
      emitTo(mockWriter);

      const config = createTestConfig({
        enableMemoryStorage: true,
        layerObserver: observer,
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test message" }] }],
        mode: { type: "regular" },
      });

      await consumeStream(result.stream);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify observer was passed to rememberStream
      const rememberStreamParams = mockCortex.memory.rememberStream.mock.calls[0]?.[0];
      expect(rememberStreamParams?.observer).toBe(observer);
    });

    it("should allow observer to receive events during streaming", async () => {
      const receivedEvents: Array<{ type: string; data: unknown }> = [];

      // Create observer that tracks events using phase-aware API
      const layerObserver = {
        onRecallStart: jest.fn((id: string) => {
          receivedEvents.push({ type: "start", data: { orchestrationId: id } });
        }),
        onLayerUpdate: jest.fn((event: LayerEvent) => {
          receivedEvents.push({ type: "layer", data: event });
        }),
        onRememberComplete: jest.fn((summary: OrchestrationSummary) => {
          receivedEvents.push({ type: "complete", data: summary });
        }),
      };

      const config = createTestConfig({
        enableMemoryStorage: true,
        layerObserver,
      });
      const mockLLM = createMockLLM();
      const provider = new CortexMemoryProvider(mockLLM, config);

      const result = await provider.doStream({
        prompt: [{ role: "user", content: [{ type: "text", text: "Test" }] }],
        mode: { type: "regular" },
      });

      await consumeStream(result.stream);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Observer callbacks should have been passed to rememberStream
      const params = mockCortex.memory.rememberStream.mock.calls[0]?.[0];
      expect(params?.observer).toBe(layerObserver);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Simulated Full Flow
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("simulated full flow", () => {
    it("should handle complete orchestration lifecycle", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const events: Array<{ type: string; data: unknown }> = [];

      const mockWriter: StreamWriter = {
        write: (part) => {
          events.push(part as { type: string; data: unknown });
        },
      };

      emitTo(mockWriter);

      // Simulate what the SDK would emit during orchestration
      observer.onRecallStart?.("orch-full-test");

      // Memory space setup
      observer.onLayerUpdate?.(createTestLayerEvent("memorySpace", "in_progress", "remember"));
      observer.onLayerUpdate?.({
        ...createTestLayerEvent("memorySpace", "complete", "remember"),
        latencyMs: 10,
        data: { id: "space-1", preview: "Test Space" },
      });

      // User lookup
      observer.onLayerUpdate?.(createTestLayerEvent("user", "in_progress", "remember"));
      observer.onLayerUpdate?.({
        ...createTestLayerEvent("user", "complete", "remember"),
        latencyMs: 5,
        data: { id: "user-1", preview: "Test User" },
      });

      // Vector search
      observer.onLayerUpdate?.(createTestLayerEvent("vector", "in_progress", "recall"));
      observer.onLayerUpdate?.({
        ...createTestLayerEvent("vector", "complete", "recall"),
        latencyMs: 80,
        data: { id: "vec-1", preview: "Found 3 memories", metadata: { count: 3 } },
      });

      // Facts with belief revision
      observer.onLayerUpdate?.(createTestLayerEvent("facts", "in_progress", "remember"));
      observer.onLayerUpdate?.({
        ...createTestLayerEvent("facts", "complete", "remember"),
        latencyMs: 120,
        data: { id: "fact-1", preview: "Extracted 2 facts" },
        revisionAction: "SUPERSEDE",
        supersededFacts: ["old-fact-1"],
      });

      // Complete
      observer.onRememberComplete?.(createTestSummary({
        orchestrationId: "orch-full-test",
        totalLatencyMs: 215,
        createdIds: {
          conversationId: "conv-1",
          memoryIds: ["mem-1"],
          factIds: ["fact-1"],
        },
      }));

      // Verify event count: 1 start + 8 layer updates + 1 complete = 10
      expect(events).toHaveLength(10);

      // Verify start event
      expect(events[0].type).toBe(LAYER_STREAM_EVENTS.ORCHESTRATION_START);

      // Verify complete event has all data
      const completeEvent = events[9] as { type: string; data: { createdIds?: unknown } };
      expect(completeEvent.type).toBe(LAYER_STREAM_EVENTS.ORCHESTRATION_COMPLETE);
      expect(completeEvent.data.createdIds).toBeDefined();
    });

    it("should handle error states in layers", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const events: Array<{ type: string; data: unknown }> = [];

      const mockWriter: StreamWriter = {
        write: (part) => {
          events.push(part as { type: string; data: unknown });
        },
      };

      emitTo(mockWriter);

      observer.onRecallStart?.("orch-error-test");

      // Graph layer fails
      observer.onLayerUpdate?.(createTestLayerEvent("graph", "in_progress", "remember"));
      observer.onLayerUpdate?.({
        ...createTestLayerEvent("graph", "error", "remember"),
        error: { message: "Graph connection timeout", code: "GRAPH_TIMEOUT" },
      });

      // Find the error event
      const errorEvent = events.find(
        (e) => (e.data as { status?: string })?.status === "error"
      ) as { type: string; data: { error?: { message: string; code: string } } } | undefined;

      expect(errorEvent).toBeDefined();
      expect(errorEvent?.data.error?.message).toBe("Graph connection timeout");
      expect(errorEvent?.data.error?.code).toBe("GRAPH_TIMEOUT");
    });

    it("should handle skipped layers", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      const events: Array<{ type: string; data: { layer?: string; status?: string } }> = [];

      const mockWriter: StreamWriter = {
        write: (part) => {
          events.push(part as { type: string; data: { layer?: string; status?: string } });
        },
      };

      emitTo(mockWriter);

      observer.onRecallStart?.("orch-skip-test");

      // Graph layer skipped (not configured)
      observer.onLayerUpdate?.(createTestLayerEvent("graph", "skipped", "remember"));

      const skippedEvent = events.find((e) => e.data?.status === "skipped");
      expect(skippedEvent).toBeDefined();
      expect(skippedEvent?.data.layer).toBe("graph");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Edge Cases
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("edge cases", () => {
    it("should handle rapid successive events", () => {
      const { observer, emitTo } = createLayerStreamObserver();
      let eventCount = 0;

      const mockWriter: StreamWriter = {
        write: () => {
          eventCount++;
        },
      };

      emitTo(mockWriter);

      // Rapid fire events
      for (let i = 0; i < 100; i++) {
        observer.onLayerUpdate?.(createTestLayerEvent(
          "vector",
          i % 2 === 0 ? "in_progress" : "complete",
          "recall"
        ));
      }

      expect(eventCount).toBe(100);
    });

    it("should handle events before writer is connected", () => {
      const { observer, emitTo } = createLayerStreamObserver();

      // These should not throw
      expect(() => observer.onRecallStart?.("pre-connect")).not.toThrow();
      expect(() =>
        observer.onLayerUpdate?.(createTestLayerEvent("vector", "complete", "recall"))
      ).not.toThrow();

      // Now connect writer
      const events: unknown[] = [];
      const mockWriter: StreamWriter = {
        write: (part) => events.push(part),
      };
      emitTo(mockWriter);

      // New events should be captured
      observer.onRecallStart?.("post-connect");
      expect(events).toHaveLength(1);
    });

    it("should handle writer being replaced mid-stream", () => {
      const { observer, emitTo } = createLayerStreamObserver();

      const events1: unknown[] = [];
      const events2: unknown[] = [];

      const writer1: StreamWriter = { write: (part) => events1.push(part) };
      const writer2: StreamWriter = { write: (part) => events2.push(part) };

      emitTo(writer1);
      observer.onRecallStart?.("event-1");

      // Switch writers mid-stream
      emitTo(writer2);
      observer.onLayerUpdate?.(createTestLayerEvent("vector", "complete", "recall"));

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
    });
  });
});
