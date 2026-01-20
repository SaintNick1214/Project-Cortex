/**
 * React hook for tracking Cortex memory layer orchestration
 *
 * This hook provides state management for memory layer visualization,
 * automatically parsing layer events from the AI SDK stream.
 *
 * @example
 * ```typescript
 * import { useLayerTracking } from '@cortexmemory/vercel-ai-provider/react';
 * import { useChat } from '@ai-sdk/react';
 *
 * function ChatComponent() {
 *   const { layers, isOrchestrating, handleDataPart } = useLayerTracking();
 *
 *   const { messages, sendMessage } = useChat({
 *     onData: handleDataPart,
 *   });
 *
 *   return (
 *     <>
 *       <LayerVisualization layers={layers} isOrchestrating={isOrchestrating} />
 *       <Messages messages={messages} />
 *     </>
 *   );
 * }
 * ```
 */

import { useState, useCallback } from "react";
import type {
  MemoryLayer,
  LayerStatus,
  RevisionAction,
} from "@cortexmemory/sdk";

// Re-export types from SDK for convenience
export type { MemoryLayer, LayerStatus, RevisionAction };

/**
 * State for a single memory layer
 */
export interface LayerState {
  /** Current status of this layer */
  status: LayerStatus;
  /** Time taken for this layer to complete (ms) */
  latencyMs?: number;
  /** Data returned by this layer */
  data?: {
    id?: string;
    preview?: string;
    metadata?: Record<string, unknown>;
  };
  /** Timestamp when layer started processing */
  startedAt?: number;
  /** Timestamp when layer completed */
  completedAt?: number;
  /**
   * Revision action taken (v0.24.0+)
   * Only present for facts layer when belief revision is enabled
   */
  revisionAction?: RevisionAction;
  /**
   * Facts that were superseded by this action (v0.24.0+)
   * Only present when revisionAction is "SUPERSEDE"
   */
  supersededFacts?: string[];
}

/**
 * Complete state for layer tracking
 */
export interface LayerTrackingState {
  /** State for each memory layer */
  layers: Record<MemoryLayer, LayerState>;
  /** Whether orchestration is currently in progress */
  isOrchestrating: boolean;
  /** Timestamp when current orchestration started */
  orchestrationStartTime?: number;
  /** ID of current orchestration */
  orchestrationId?: string;
}

/**
 * Data part received from the stream for layer updates
 */
export interface LayerUpdateData {
  layer: MemoryLayer;
  status: LayerStatus;
  timestamp: number;
  latencyMs?: number;
  data?: LayerState["data"];
  error?: { message: string; code?: string };
  revisionAction?: RevisionAction;
  supersededFacts?: string[];
}

/**
 * All memory layer types
 */
export const ALL_LAYERS: MemoryLayer[] = [
  "memorySpace",
  "user",
  "agent",
  "conversation",
  "vector",
  "facts",
  "graph",
];

const initialLayerState: LayerState = {
  status: "pending",
};

/**
 * Create initial state with all layers set to pending
 */
function createInitialState(): LayerTrackingState {
  return {
    layers: Object.fromEntries(
      ALL_LAYERS.map((layer) => [layer, { ...initialLayerState }])
    ) as Record<MemoryLayer, LayerState>,
    isOrchestrating: false,
  };
}

/**
 * Return type of useLayerTracking hook
 */
export interface UseLayerTrackingResult {
  /** Current state of all layers */
  layers: Record<MemoryLayer, LayerState>;
  /** Whether orchestration is currently in progress */
  isOrchestrating: boolean;
  /** ID of current orchestration (if any) */
  orchestrationId?: string;
  /** Start a new orchestration cycle (resets all layers) */
  startOrchestration: (orchestrationId?: string) => void;
  /** Update a specific layer's state */
  updateLayer: (
    layer: MemoryLayer,
    status: LayerStatus,
    data?: LayerState["data"],
    revisionInfo?: {
      action?: RevisionAction;
      supersededFacts?: string[];
    }
  ) => void;
  /** Reset all layers to initial state */
  resetLayers: () => void;
  /**
   * Handle data parts from useChat's onData callback
   *
   * Pass this directly to useChat's onData option to automatically
   * parse and handle layer events from the stream.
   *
   * @example
   * ```typescript
   * const { handleDataPart } = useLayerTracking();
   * const { messages } = useChat({ onData: handleDataPart });
   * ```
   */
  handleDataPart: (dataPart: unknown) => void;
}

/**
 * React hook for tracking Cortex memory layer orchestration
 *
 * Provides state management and event handling for visualizing
 * memory layer status in real-time during AI conversations.
 *
 * @returns Object containing layer state and handler functions
 *
 * @example
 * ```typescript
 * import { useLayerTracking } from '@cortexmemory/vercel-ai-provider/react';
 * import { useChat } from '@ai-sdk/react';
 *
 * function ChatComponent() {
 *   const {
 *     layers,
 *     isOrchestrating,
 *     handleDataPart,
 *     resetLayers
 *   } = useLayerTracking();
 *
 *   const { messages, sendMessage } = useChat({
 *     onData: handleDataPart,
 *   });
 *
 *   return (
 *     <div>
 *       {isOrchestrating && <p>Processing memory...</p>}
 *       <LayerVisualization layers={layers} />
 *       <button onClick={resetLayers}>Clear Status</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useLayerTracking(): UseLayerTrackingResult {
  const [state, setState] = useState<LayerTrackingState>(createInitialState);

  /**
   * Start a new orchestration cycle
   */
  const startOrchestration = useCallback((orchestrationId?: string) => {
    const now = Date.now();
    setState({
      layers: Object.fromEntries(
        ALL_LAYERS.map((layer) => [
          layer,
          { status: "pending" as LayerStatus, startedAt: now },
        ])
      ) as Record<MemoryLayer, LayerState>,
      isOrchestrating: true,
      orchestrationStartTime: now,
      orchestrationId,
    });
  }, []);

  /**
   * Update a specific layer's state
   */
  const updateLayer = useCallback(
    (
      layer: MemoryLayer,
      status: LayerStatus,
      data?: LayerState["data"],
      revisionInfo?: {
        action?: RevisionAction;
        supersededFacts?: string[];
      }
    ) => {
      setState((prev: LayerTrackingState) => {
        const now = Date.now();
        const layerState = prev.layers[layer];
        const latencyMs = layerState?.startedAt
          ? now - layerState.startedAt
          : prev.orchestrationStartTime
            ? now - prev.orchestrationStartTime
            : undefined;

        // Build updated layers
        const updatedLayers: Record<MemoryLayer, LayerState> = {
          ...prev.layers,
          [layer]: {
            ...layerState,
            status,
            latencyMs,
            data,
            completedAt: status === "complete" ? now : layerState?.completedAt,
            // Belief revision info (v0.24.0+)
            revisionAction: revisionInfo?.action,
            supersededFacts: revisionInfo?.supersededFacts,
          },
        };

        // Check if any layers are still processing
        const isStillOrchestrating = Object.values(updatedLayers).some(
          (l: LayerState) =>
            l.status === "pending" || l.status === "in_progress"
        );

        return {
          ...prev,
          layers: updatedLayers,
          isOrchestrating: isStillOrchestrating,
        };
      });
    },
    []
  );

  /**
   * Reset all layers to initial state
   */
  const resetLayers = useCallback(() => {
    setState(createInitialState());
  }, []);

  /**
   * Handle data parts from useChat's onData callback
   */
  const handleDataPart = useCallback(
    (dataPart: unknown) => {
      const part = dataPart as { type?: string; data?: unknown };

      if (!part || typeof part !== "object" || !part.type) {
        return;
      }

      // Handle orchestration start
      if (part.type === "data-orchestration-start") {
        const data = part.data as { orchestrationId?: string } | undefined;
        startOrchestration(data?.orchestrationId);
        return;
      }

      // Handle layer update
      if (part.type === "data-layer-update") {
        const event = part.data as LayerUpdateData;
        if (event && event.layer && event.status) {
          updateLayer(event.layer, event.status, event.data, {
            action: event.revisionAction,
            supersededFacts: event.supersededFacts,
          });
        }
        return;
      }

      // Handle orchestration complete
      if (part.type === "data-orchestration-complete") {
        // Orchestration complete is informational - isOrchestrating
        // is automatically set to false when all layers complete
        return;
      }
    },
    [startOrchestration, updateLayer]
  );

  return {
    layers: state.layers,
    isOrchestrating: state.isOrchestrating,
    orchestrationId: state.orchestrationId,
    startOrchestration,
    updateLayer,
    resetLayers,
    handleDataPart,
  };
}

/**
 * Generate sample data for layer previews (useful for demos/testing)
 */
export function generateSampleLayerData(
  layer: MemoryLayer,
  userMessage?: string
): LayerState["data"] {
  switch (layer) {
    case "memorySpace":
      return {
        id: "demo-space",
        preview: "Memory space for demo",
        metadata: { isolation: "full" },
      };
    case "user":
      return {
        id: "demo-user",
        preview: "Demo User",
        metadata: { memories: 5 },
      };
    case "agent":
      return {
        id: "demo-assistant",
        preview: "Cortex Demo Assistant",
      };
    case "conversation":
      return {
        id: `conv-${Date.now()}`,
        preview: userMessage?.slice(0, 50) || "New conversation",
        metadata: { messages: 2 },
      };
    case "vector":
      return {
        id: `mem-${Date.now()}`,
        preview: "Embedded content...",
        metadata: { dimensions: 1536, importance: 75 },
      };
    case "facts":
      return {
        id: `fact-${Date.now()}`,
        preview: "Extracted facts from conversation",
        metadata: { count: 3, types: ["identity", "preference"] },
      };
    case "graph":
      return {
        id: `graph-sync-${Date.now()}`,
        preview: "Entity relationships",
        metadata: { nodes: 4, edges: 3 },
      };
    default:
      return undefined;
  }
}
