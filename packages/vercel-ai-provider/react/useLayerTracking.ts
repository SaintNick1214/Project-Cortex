/**
 * React hook for tracking Cortex memory layer orchestration
 *
 * This hook provides state management for memory layer visualization,
 * automatically parsing layer events from the AI SDK stream.
 *
 * Supports dual-phase tracking for the two phases of memory orchestration:
 * - **Recall phase**: Retrieves context from memory (memorySpace, user, agent, context layers)
 * - **Remember phase**: Stores new memories (conversation, vector, facts, graph layers)
 *
 * @example
 * ```typescript
 * import { useLayerTracking } from '@cortexmemory/vercel-ai-provider/react';
 * import { useChat } from '@ai-sdk/react';
 *
 * function ChatComponent() {
 *   const {
 *     recallLayers,
 *     rememberLayers,
 *     isRecalling,
 *     isRemembering,
 *     isOrchestrating,
 *     handleDataPart
 *   } = useLayerTracking();
 *
 *   const { messages, sendMessage } = useChat({
 *     onData: handleDataPart,
 *   });
 *
 *   return (
 *     <>
 *       {isRecalling && <p>Recalling memories...</p>}
 *       <RecallVisualization layers={recallLayers} />
 *       {isRemembering && <p>Storing new memories...</p>}
 *       <RememberVisualization layers={rememberLayers} />
 *       <Messages messages={messages} />
 *     </>
 *   );
 * }
 * ```
 */

import { useState, useCallback, useMemo } from "react";
import type {
  MemoryLayer,
  LayerStatus,
  RevisionAction,
} from "@cortexmemory/sdk";

// Re-export types from SDK for convenience
export type { MemoryLayer, LayerStatus, RevisionAction };

/**
 * Phase of memory orchestration
 */
export type OrchestrationPhase = "recall" | "remember";

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
  /** Phase this layer update belongs to (recall or remember) */
  phase?: OrchestrationPhase;
}

/**
 * Data part received from the stream for phase start events
 */
export interface PhaseStartData {
  orchestrationId?: string;
}

/**
 * Data part received from the stream for phase complete events
 */
export interface PhaseCompleteData {
  orchestrationId?: string;
  totalLatencyMs?: number;
}

/**
 * Combined state tracking both recall and remember phases
 */
export interface DualPhaseTrackingState {
  /** State for recall phase layers */
  recallState: LayerTrackingState;
  /** State for remember phase layers */
  rememberState: LayerTrackingState;
}

/**
 * All memory layer types
 */
export const ALL_LAYERS: MemoryLayer[] = [
  "memorySpace",
  "user",
  "agent",
  "context",
  "conversation",
  "vector",
  "facts",
  "graph",
];

/**
 * Layers involved in the recall phase (retrieving context from memory)
 */
export const RECALL_LAYERS: MemoryLayer[] = [
  "vector",
  "facts",
  "graph",
  "context",
];

/**
 * Layers involved in the remember phase (storing new memories)
 */
export const REMEMBER_LAYERS: MemoryLayer[] = [
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
 * Create initial state for a specific phase (recall or remember)
 */
function createInitialPhaseState(
  phaseLayers: MemoryLayer[]
): LayerTrackingState {
  return {
    layers: Object.fromEntries(
      ALL_LAYERS.map((layer) => [
        layer,
        phaseLayers.includes(layer)
          ? { ...initialLayerState }
          : { status: "skipped" as LayerStatus },
      ])
    ) as Record<MemoryLayer, LayerState>,
    isOrchestrating: false,
  };
}

/**
 * Create initial dual-phase state
 */
function createInitialDualPhaseState(): DualPhaseTrackingState {
  return {
    recallState: createInitialPhaseState(RECALL_LAYERS),
    rememberState: createInitialPhaseState(REMEMBER_LAYERS),
  };
}

/**
 * Return type of useLayerTracking hook
 */
export interface UseLayerTrackingResult {
  // ─────────────────────────────────────────────────────────────
  // Phase-Specific State (New API)
  // ─────────────────────────────────────────────────────────────

  /** Current state of recall phase layers */
  recallLayers: Record<MemoryLayer, LayerState>;
  /** Current state of remember phase layers */
  rememberLayers: Record<MemoryLayer, LayerState>;
  /** Whether recall phase is currently in progress */
  isRecalling: boolean;
  /** Whether remember phase is currently in progress */
  isRemembering: boolean;
  /** ID of current recall orchestration (if any) */
  recallOrchestrationId?: string;
  /** ID of current remember orchestration (if any) */
  rememberOrchestrationId?: string;

  // ─────────────────────────────────────────────────────────────
  // Backward-Compatible State (Existing API)
  // ─────────────────────────────────────────────────────────────

  /**
   * Current state of all layers (combined view)
   * @deprecated Use recallLayers and rememberLayers for phase-specific tracking
   */
  layers: Record<MemoryLayer, LayerState>;
  /**
   * Whether any orchestration is currently in progress (recall OR remember)
   * This is true if either isRecalling or isRemembering is true
   */
  isOrchestrating: boolean;
  /**
   * ID of current orchestration (recall phase takes precedence)
   * @deprecated Use recallOrchestrationId or rememberOrchestrationId
   */
  orchestrationId?: string;

  // ─────────────────────────────────────────────────────────────
  // Phase-Specific Methods (New API)
  // ─────────────────────────────────────────────────────────────

  /** Start the recall phase orchestration cycle */
  startRecall: (orchestrationId?: string) => void;
  /** Start the remember phase orchestration cycle */
  startRemember: (orchestrationId?: string) => void;
  /** Reset recall phase layers to initial state */
  resetRecall: () => void;
  /** Reset remember phase layers to initial state */
  resetRemember: () => void;
  /**
   * Update a specific layer's state in a specific phase
   */
  updatePhaseLayer: (
    phase: OrchestrationPhase,
    layer: MemoryLayer,
    status: LayerStatus,
    data?: LayerState["data"],
    revisionInfo?: {
      action?: RevisionAction;
      supersededFacts?: string[];
    }
  ) => void;

  // ─────────────────────────────────────────────────────────────
  // Backward-Compatible Methods (Existing API)
  // ─────────────────────────────────────────────────────────────

  /**
   * Start a new orchestration cycle (resets all layers)
   * @deprecated Use startRecall or startRemember for phase-specific control
   */
  startOrchestration: (orchestrationId?: string) => void;
  /**
   * Update a specific layer's state
   * @deprecated Use updatePhaseLayer for phase-specific updates
   */
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
 * Supports dual-phase tracking for recall and remember phases.
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
 *     recallLayers,
 *     rememberLayers,
 *     isRecalling,
 *     isRemembering,
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
 *       {isRecalling && <p>Recalling memories...</p>}
 *       <RecallVisualization layers={recallLayers} />
 *       {isRemembering && <p>Storing new memories...</p>}
 *       <RememberVisualization layers={rememberLayers} />
 *       <button onClick={resetLayers}>Clear Status</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useLayerTracking(): UseLayerTrackingResult {
  const [dualState, setDualState] = useState<DualPhaseTrackingState>(
    createInitialDualPhaseState
  );

  /**
   * Start the recall phase orchestration cycle
   */
  const startRecall = useCallback((orchestrationId?: string) => {
    const now = Date.now();
    setDualState((prev) => ({
      ...prev,
      recallState: {
        layers: Object.fromEntries(
          ALL_LAYERS.map((layer) => [
            layer,
            RECALL_LAYERS.includes(layer)
              ? { status: "pending" as LayerStatus, startedAt: now }
              : { status: "skipped" as LayerStatus },
          ])
        ) as Record<MemoryLayer, LayerState>,
        isOrchestrating: true,
        orchestrationStartTime: now,
        orchestrationId,
      },
    }));
  }, []);

  /**
   * Start the remember phase orchestration cycle
   */
  const startRemember = useCallback((orchestrationId?: string) => {
    const now = Date.now();
    setDualState((prev) => ({
      ...prev,
      rememberState: {
        layers: Object.fromEntries(
          ALL_LAYERS.map((layer) => [
            layer,
            REMEMBER_LAYERS.includes(layer)
              ? { status: "pending" as LayerStatus, startedAt: now }
              : { status: "skipped" as LayerStatus },
          ])
        ) as Record<MemoryLayer, LayerState>,
        isOrchestrating: true,
        orchestrationStartTime: now,
        orchestrationId,
      },
    }));
  }, []);

  /**
   * Update a specific layer's state in a specific phase
   */
  const updatePhaseLayer = useCallback(
    (
      phase: OrchestrationPhase,
      layer: MemoryLayer,
      status: LayerStatus,
      data?: LayerState["data"],
      revisionInfo?: {
        action?: RevisionAction;
        supersededFacts?: string[];
      }
    ) => {
      setDualState((prev: DualPhaseTrackingState) => {
        const phaseState =
          phase === "recall" ? prev.recallState : prev.rememberState;
        const phaseLayers =
          phase === "recall" ? RECALL_LAYERS : REMEMBER_LAYERS;

        const now = Date.now();
        const layerState = phaseState.layers[layer];
        const latencyMs = layerState?.startedAt
          ? now - layerState.startedAt
          : phaseState.orchestrationStartTime
            ? now - phaseState.orchestrationStartTime
            : undefined;

        // Build updated layers
        const updatedLayers: Record<MemoryLayer, LayerState> = {
          ...phaseState.layers,
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

        // Check if any layers in this phase are still processing
        const isStillOrchestrating = phaseLayers.some((l) => {
          const layerStatus = updatedLayers[l]?.status;
          return layerStatus === "pending" || layerStatus === "in_progress";
        });

        const updatedPhaseState: LayerTrackingState = {
          ...phaseState,
          layers: updatedLayers,
          isOrchestrating: isStillOrchestrating,
        };

        if (phase === "recall") {
          return { ...prev, recallState: updatedPhaseState };
        } else {
          return { ...prev, rememberState: updatedPhaseState };
        }
      });
    },
    []
  );

  /**
   * Reset recall phase layers to initial state
   */
  const resetRecall = useCallback(() => {
    setDualState((prev) => ({
      ...prev,
      recallState: createInitialPhaseState(RECALL_LAYERS),
    }));
  }, []);

  /**
   * Reset remember phase layers to initial state
   */
  const resetRemember = useCallback(() => {
    setDualState((prev) => ({
      ...prev,
      rememberState: createInitialPhaseState(REMEMBER_LAYERS),
    }));
  }, []);

  /**
   * Reset all layers to initial state
   */
  const resetLayers = useCallback(() => {
    setDualState(createInitialDualPhaseState());
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Backward-Compatible Methods
  // ─────────────────────────────────────────────────────────────

  /**
   * Start a new orchestration cycle (resets all layers)
   * @deprecated Use startRecall or startRemember for phase-specific control
   */
  const startOrchestration = useCallback(
    (orchestrationId?: string) => {
      // For backward compatibility, start both phases
      startRecall(orchestrationId);
    },
    [startRecall]
  );

  /**
   * Update a specific layer's state
   * @deprecated Use updatePhaseLayer for phase-specific updates
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
      // Determine which phase this layer belongs to
      const phase: OrchestrationPhase = RECALL_LAYERS.includes(layer)
        ? "recall"
        : "remember";
      updatePhaseLayer(phase, layer, status, data, revisionInfo);
    },
    [updatePhaseLayer]
  );

  /**
   * Handle data parts from useChat's onData callback
   */
  const handleDataPart = useCallback(
    (dataPart: unknown) => {
      const part = dataPart as { type?: string; data?: unknown };

      if (!part || typeof part !== "object" || !part.type) {
        return;
      }

      // ─────────────────────────────────────────────────────────────
      // Phase-Aware Events (New)
      // ─────────────────────────────────────────────────────────────

      // Handle recall phase start
      if (part.type === "data-recall-start") {
        const data = part.data as PhaseStartData | undefined;
        startRecall(data?.orchestrationId);
        return;
      }

      // Handle recall phase complete
      if (part.type === "data-recall-complete") {
        // Recall complete is informational - isRecalling is automatically
        // set to false when all recall layers complete
        return;
      }

      // Handle remember phase start
      if (part.type === "data-remember-start") {
        const data = part.data as PhaseStartData | undefined;
        startRemember(data?.orchestrationId);
        return;
      }

      // Handle remember phase complete
      if (part.type === "data-remember-complete") {
        // Remember complete is informational - isRemembering is automatically
        // set to false when all remember layers complete
        return;
      }

      // Handle layer update - route to correct phase
      if (part.type === "data-layer-update") {
        const event = part.data as LayerUpdateData;
        if (event && event.layer && event.status) {
          // Determine phase from event.phase field or infer from layer
          const phase: OrchestrationPhase =
            event.phase ||
            (RECALL_LAYERS.includes(event.layer) ? "recall" : "remember");
          updatePhaseLayer(phase, event.layer, event.status, event.data, {
            action: event.revisionAction,
            supersededFacts: event.supersededFacts,
          });
        }
        return;
      }

      // ─────────────────────────────────────────────────────────────
      // Legacy Events (Backward Compatibility)
      // ─────────────────────────────────────────────────────────────

      // Handle legacy orchestration start (treat as recall start)
      if (part.type === "data-orchestration-start") {
        const data = part.data as { orchestrationId?: string } | undefined;
        startRecall(data?.orchestrationId);
        return;
      }

      // Handle legacy orchestration complete
      if (part.type === "data-orchestration-complete") {
        // Orchestration complete is informational
        return;
      }
    },
    [startRecall, startRemember, updatePhaseLayer]
  );

  // ─────────────────────────────────────────────────────────────
  // Computed Values
  // ─────────────────────────────────────────────────────────────

  // Combine layers for backward compatibility
  const combinedLayers = useMemo(() => {
    const combined: Record<MemoryLayer, LayerState> = {} as Record<
      MemoryLayer,
      LayerState
    >;
    for (const layer of ALL_LAYERS) {
      if (RECALL_LAYERS.includes(layer)) {
        combined[layer] = dualState.recallState.layers[layer];
      } else {
        combined[layer] = dualState.rememberState.layers[layer];
      }
    }
    return combined;
  }, [dualState]);

  const isRecalling = dualState.recallState.isOrchestrating;
  const isRemembering = dualState.rememberState.isOrchestrating;
  const isOrchestrating = isRecalling || isRemembering;

  return {
    // Phase-specific state (new API)
    recallLayers: dualState.recallState.layers,
    rememberLayers: dualState.rememberState.layers,
    isRecalling,
    isRemembering,
    recallOrchestrationId: dualState.recallState.orchestrationId,
    rememberOrchestrationId: dualState.rememberState.orchestrationId,

    // Backward-compatible state (existing API)
    layers: combinedLayers,
    isOrchestrating,
    orchestrationId:
      dualState.recallState.orchestrationId ||
      dualState.rememberState.orchestrationId,

    // Phase-specific methods (new API)
    startRecall,
    startRemember,
    resetRecall,
    resetRemember,
    updatePhaseLayer,

    // Backward-compatible methods (existing API)
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
    case "context":
      return {
        id: `ctx-${Date.now()}`,
        preview: "Retrieved relevant memories",
        metadata: { vectorMatches: 3, factMatches: 2 },
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
