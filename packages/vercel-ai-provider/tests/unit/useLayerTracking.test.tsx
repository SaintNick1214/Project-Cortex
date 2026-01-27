/**
 * Unit Tests: useLayerTracking Hook
 *
 * Tests for the React hook that manages layer tracking state
 */

import { renderHook, act } from "@testing-library/react";
import {
  useLayerTracking,
  ALL_LAYERS,
  generateSampleLayerData,
  type LayerState,
} from "../../react/useLayerTracking";
import type { MemoryLayer, LayerStatus } from "@cortexmemory/sdk";

describe("useLayerTracking", () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Initial State
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("initial state", () => {
    it("should have all layers with pending status", () => {
      const { result } = renderHook(() => useLayerTracking());

      expect(Object.keys(result.current.layers)).toHaveLength(ALL_LAYERS.length);

      for (const layer of ALL_LAYERS) {
        expect(result.current.layers[layer]).toBeDefined();
        expect(result.current.layers[layer].status).toBe("pending");
      }
    });

    it("should have isOrchestrating set to false", () => {
      const { result } = renderHook(() => useLayerTracking());

      expect(result.current.isOrchestrating).toBe(false);
    });

    it("should not have an orchestrationId", () => {
      const { result } = renderHook(() => useLayerTracking());

      expect(result.current.orchestrationId).toBeUndefined();
    });

    it("should have all required methods", () => {
      const { result } = renderHook(() => useLayerTracking());

      expect(typeof result.current.startOrchestration).toBe("function");
      expect(typeof result.current.updateLayer).toBe("function");
      expect(typeof result.current.resetLayers).toBe("function");
      expect(typeof result.current.handleDataPart).toBe("function");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // startOrchestration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("startOrchestration", () => {
    it("should set isOrchestrating to true", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration();
      });

      expect(result.current.isOrchestrating).toBe(true);
    });

    it("should reset all layers to pending", () => {
      const { result } = renderHook(() => useLayerTracking());

      // First, update some layers
      act(() => {
        result.current.updateLayer("vector", "complete");
        result.current.updateLayer("facts", "complete");
      });

      // Then start new orchestration
      act(() => {
        result.current.startOrchestration();
      });

      for (const layer of ALL_LAYERS) {
        expect(result.current.layers[layer].status).toBe("pending");
      }
    });

    it("should set orchestrationId when provided", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration("orch-123");
      });

      expect(result.current.orchestrationId).toBe("orch-123");
    });

    it("should set startedAt timestamp on recall layers", () => {
      const { result } = renderHook(() => useLayerTracking());
      const beforeStart = Date.now();

      act(() => {
        result.current.startOrchestration();
      });

      const afterStart = Date.now();

      // startOrchestration now only starts recall phase
      // So only recall layers should have startedAt
      const recallLayers = ["vector", "facts", "graph", "context"] as const;
      for (const layer of recallLayers) {
        const startedAt = result.current.recallLayers[layer].startedAt;
        expect(startedAt).toBeDefined();
        expect(startedAt).toBeGreaterThanOrEqual(beforeStart);
        expect(startedAt).toBeLessThanOrEqual(afterStart);
      }
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // updateLayer
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("updateLayer", () => {
    it("should update a single layer status", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration();
      });

      act(() => {
        result.current.updateLayer("vector", "in_progress");
      });

      expect(result.current.layers.vector.status).toBe("in_progress");
    });

    it("should not affect other layers", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration();
      });

      act(() => {
        result.current.updateLayer("vector", "complete");
      });

      // Other layers should still be pending
      expect(result.current.layers.facts.status).toBe("pending");
      expect(result.current.layers.graph.status).toBe("pending");
      expect(result.current.layers.conversation.status).toBe("pending");
    });

    it("should calculate latencyMs from layer startedAt", async () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration();
      });

      // Wait a bit to ensure measurable latency
      await new Promise((resolve) => setTimeout(resolve, 50));

      act(() => {
        result.current.updateLayer("vector", "complete");
      });

      expect(result.current.layers.vector.latencyMs).toBeDefined();
      expect(result.current.layers.vector.latencyMs).toBeGreaterThanOrEqual(40);
    });

    it("should include data when provided", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration();
      });

      const data: LayerState["data"] = {
        id: "vec-123",
        preview: "Memory content preview",
        metadata: { score: 0.95 },
      };

      act(() => {
        result.current.updateLayer("vector", "complete", data);
      });

      expect(result.current.layers.vector.data).toEqual(data);
    });

    it("should include revisionAction when provided", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration();
      });

      act(() => {
        result.current.updateLayer("facts", "complete", undefined, {
          action: "SUPERSEDE",
          supersededFacts: ["fact-old-1"],
        });
      });

      expect(result.current.layers.facts.revisionAction).toBe("SUPERSEDE");
      expect(result.current.layers.facts.supersededFacts).toEqual([
        "fact-old-1",
      ]);
    });

    it("should set completedAt when status is complete", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration();
      });

      const beforeComplete = Date.now();

      act(() => {
        result.current.updateLayer("vector", "complete");
      });

      const afterComplete = Date.now();

      const completedAt = result.current.layers.vector.completedAt;
      expect(completedAt).toBeDefined();
      expect(completedAt).toBeGreaterThanOrEqual(beforeComplete);
      expect(completedAt).toBeLessThanOrEqual(afterComplete);
    });

    it("should not set completedAt for non-complete status", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration();
      });

      act(() => {
        result.current.updateLayer("vector", "in_progress");
      });

      expect(result.current.layers.vector.completedAt).toBeUndefined();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // isOrchestrating auto-detection
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("isOrchestrating auto-detection", () => {
    it("should remain true while any layer is pending", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration();
      });

      // Complete all but one layer
      const layersToComplete = ALL_LAYERS.slice(0, -1);
      for (const layer of layersToComplete) {
        act(() => {
          result.current.updateLayer(layer, "complete");
        });
      }

      expect(result.current.isOrchestrating).toBe(true);
    });

    it("should remain true while any layer is in_progress", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration();
      });

      // Set one to in_progress, others to complete
      act(() => {
        result.current.updateLayer("vector", "in_progress");
      });

      for (const layer of ALL_LAYERS.filter((l) => l !== "vector")) {
        act(() => {
          result.current.updateLayer(layer, "complete");
        });
      }

      expect(result.current.isOrchestrating).toBe(true);
    });

    it("should become false when all recall layers are complete", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration(); // Only starts recall phase
      });

      // Complete all recall layers (which startOrchestration affects)
      const recallLayers = ["vector", "facts", "graph", "context"] as const;
      for (const layer of recallLayers) {
        act(() => {
          result.current.updateLayer(layer, "complete");
        });
      }

      // isOrchestrating should be false when recall is done
      // (remember phase was never started by startOrchestration)
      expect(result.current.isOrchestrating).toBe(false);
    });

    it("should become false when recall layers are complete or skipped", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration(); // Only starts recall phase
      });

      // Some complete, some skipped for recall layers
      const recallLayers = ["vector", "facts", "graph", "context"] as const;
      for (let i = 0; i < recallLayers.length; i++) {
        const status: LayerStatus = i % 2 === 0 ? "complete" : "skipped";
        act(() => {
          result.current.updateLayer(recallLayers[i], status);
        });
      }

      expect(result.current.isOrchestrating).toBe(false);
    });

    it("should become false when recall layers have errors", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration(); // Only starts recall phase
      });

      // Complete some, error on one, skip rest for recall layers
      const recallLayers = ["vector", "facts", "graph", "context"] as const;
      for (let i = 0; i < recallLayers.length; i++) {
        const status: LayerStatus =
          i === 0 ? "error" : i % 2 === 0 ? "complete" : "skipped";
        act(() => {
          result.current.updateLayer(recallLayers[i], status);
        });
      }

      expect(result.current.isOrchestrating).toBe(false);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // resetLayers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("resetLayers", () => {
    it("should reset all layers to pending", () => {
      const { result } = renderHook(() => useLayerTracking());

      // Modify state
      act(() => {
        result.current.startOrchestration("orch-1");
      });
      for (const layer of ALL_LAYERS) {
        act(() => {
          result.current.updateLayer(layer, "complete", { id: `${layer}-id` });
        });
      }

      // Reset
      act(() => {
        result.current.resetLayers();
      });

      for (const layer of ALL_LAYERS) {
        expect(result.current.layers[layer].status).toBe("pending");
        expect(result.current.layers[layer].data).toBeUndefined();
        expect(result.current.layers[layer].latencyMs).toBeUndefined();
      }
    });

    it("should set isOrchestrating to false", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration();
      });

      expect(result.current.isOrchestrating).toBe(true);

      act(() => {
        result.current.resetLayers();
      });

      expect(result.current.isOrchestrating).toBe(false);
    });

    it("should clear orchestrationId", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration("orch-to-clear");
      });

      expect(result.current.orchestrationId).toBe("orch-to-clear");

      act(() => {
        result.current.resetLayers();
      });

      expect(result.current.orchestrationId).toBeUndefined();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // handleDataPart
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("handleDataPart", () => {
    it("should handle orchestration-start event", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.handleDataPart({
          type: "data-orchestration-start",
          data: { orchestrationId: "orch-from-stream" },
        });
      });

      expect(result.current.isOrchestrating).toBe(true);
      expect(result.current.orchestrationId).toBe("orch-from-stream");
    });

    it("should handle layer-update event", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration();
      });

      act(() => {
        result.current.handleDataPart({
          type: "data-layer-update",
          data: {
            layer: "vector",
            status: "complete",
            timestamp: Date.now(),
            latencyMs: 100,
            data: { id: "vec-123", preview: "Test memory" },
          },
        });
      });

      expect(result.current.layers.vector.status).toBe("complete");
      expect(result.current.layers.vector.data?.id).toBe("vec-123");
    });

    it("should handle layer-update with revision info", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration();
      });

      act(() => {
        result.current.handleDataPart({
          type: "data-layer-update",
          data: {
            layer: "facts",
            status: "complete",
            timestamp: Date.now(),
            revisionAction: "SUPERSEDE",
            supersededFacts: ["old-fact-1", "old-fact-2"],
          },
        });
      });

      expect(result.current.layers.facts.revisionAction).toBe("SUPERSEDE");
      expect(result.current.layers.facts.supersededFacts).toEqual([
        "old-fact-1",
        "old-fact-2",
      ]);
    });

    it("should handle orchestration-complete event gracefully", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration();
      });

      // This event is informational - shouldn't throw
      expect(() => {
        act(() => {
          result.current.handleDataPart({
            type: "data-orchestration-complete",
            data: {
              orchestrationId: "orch-done",
              totalLatencyMs: 500,
            },
          });
        });
      }).not.toThrow();
    });

    it("should ignore unknown event types", () => {
      const { result } = renderHook(() => useLayerTracking());
      const initialState = { ...result.current };

      act(() => {
        result.current.handleDataPart({
          type: "unknown-event-type",
          data: { foo: "bar" },
        });
      });

      // State should be unchanged
      expect(result.current.isOrchestrating).toBe(initialState.isOrchestrating);
    });

    it("should ignore null/undefined data parts", () => {
      const { result } = renderHook(() => useLayerTracking());

      expect(() => {
        act(() => {
          result.current.handleDataPart(null);
        });
      }).not.toThrow();

      expect(() => {
        act(() => {
          result.current.handleDataPart(undefined);
        });
      }).not.toThrow();
    });

    it("should ignore data parts without type", () => {
      const { result } = renderHook(() => useLayerTracking());

      expect(() => {
        act(() => {
          result.current.handleDataPart({ data: { foo: "bar" } });
        });
      }).not.toThrow();
    });

    it("should handle layer-update with missing optional fields", () => {
      const { result } = renderHook(() => useLayerTracking());

      act(() => {
        result.current.startOrchestration();
      });

      act(() => {
        result.current.handleDataPart({
          type: "data-layer-update",
          data: {
            layer: "vector",
            status: "in_progress",
            timestamp: Date.now(),
            // No latencyMs, data, revisionAction, etc.
          },
        });
      });

      expect(result.current.layers.vector.status).toBe("in_progress");
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // generateSampleLayerData
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("generateSampleLayerData", () => {
    it("should generate data for all layer types", () => {
      for (const layer of ALL_LAYERS) {
        const data = generateSampleLayerData(layer);
        expect(data).toBeDefined();
        expect(data?.id).toBeDefined();
        expect(data?.preview).toBeDefined();
      }
    });

    it("should include user message in conversation preview", () => {
      const data = generateSampleLayerData(
        "conversation",
        "Hello, how are you?"
      );
      expect(data?.preview).toContain("Hello");
    });

    it("should truncate long conversation previews", () => {
      const longMessage =
        "This is a very long message that should be truncated when used as a preview";
      const data = generateSampleLayerData("conversation", longMessage);
      expect(data?.preview?.length).toBeLessThanOrEqual(50);
    });

    it("should return undefined for unknown layer types", () => {
      const data = generateSampleLayerData("unknown" as MemoryLayer);
      expect(data).toBeUndefined();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ALL_LAYERS constant
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("ALL_LAYERS", () => {
    it("should contain all expected layer types", () => {
      expect(ALL_LAYERS).toContain("memorySpace");
      expect(ALL_LAYERS).toContain("user");
      expect(ALL_LAYERS).toContain("agent");
      expect(ALL_LAYERS).toContain("context");
      expect(ALL_LAYERS).toContain("conversation");
      expect(ALL_LAYERS).toContain("vector");
      expect(ALL_LAYERS).toContain("facts");
      expect(ALL_LAYERS).toContain("graph");
    });

    it("should have 8 layers (including context)", () => {
      expect(ALL_LAYERS).toHaveLength(8);
    });
  });
});
