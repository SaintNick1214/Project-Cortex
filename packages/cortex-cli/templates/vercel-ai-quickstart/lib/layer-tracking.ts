"use client";

import { useState, useCallback } from "react";

// Layer types (defined locally to avoid import issues before npm install)
export type MemoryLayer =
  | "memorySpace"
  | "user"
  | "agent"
  | "conversation"
  | "vector"
  | "facts"
  | "graph";

export type LayerStatus =
  | "pending"
  | "in_progress"
  | "complete"
  | "error"
  | "skipped";

/**
 * Revision action taken by the belief revision system (v0.24.0+)
 * - ADD: New fact was created (no conflicts)
 * - UPDATE: Existing fact was updated with new information
 * - SUPERSEDE: Old fact was superseded by contradicting information
 * - NONE: No action taken (duplicate or irrelevant)
 */
export type RevisionAction = "ADD" | "UPDATE" | "SUPERSEDE" | "NONE";

export interface LayerState {
  status: LayerStatus;
  latencyMs?: number;
  data?: {
    id?: string;
    preview?: string;
    metadata?: Record<string, unknown>;
  };
  startedAt?: number;
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

export interface LayerTrackingState {
  layers: Record<string, LayerState>;
  isOrchestrating: boolean;
  orchestrationStartTime?: number;
}

const initialLayerState: LayerState = {
  status: "pending",
};

const allLayers: MemoryLayer[] = [
  "memorySpace",
  "user",
  "agent",
  "conversation",
  "vector",
  "facts",
  "graph",
];

export function useLayerTracking() {
  const [state, setState] = useState<LayerTrackingState>({
    layers: Object.fromEntries(
      allLayers.map((layer) => [layer, { ...initialLayerState }]),
    ),
    isOrchestrating: false,
  });

  const startOrchestration = useCallback(() => {
    const now = Date.now();
    setState({
      layers: Object.fromEntries(
        allLayers.map((layer) => [
          layer,
          { status: "pending" as LayerStatus, startedAt: now },
        ]),
      ),
      isOrchestrating: true,
      orchestrationStartTime: now,
    });
  }, []);

  const updateLayer = useCallback(
    (
      layer: MemoryLayer,
      status: LayerStatus,
      data?: LayerState["data"],
      revisionInfo?: {
        action?: RevisionAction;
        supersededFacts?: string[];
      },
    ) => {
      setState((prev: LayerTrackingState) => {
        const now = Date.now();
        const layerState = prev.layers[layer];
        const latencyMs = layerState?.startedAt
          ? now - layerState.startedAt
          : prev.orchestrationStartTime
            ? now - prev.orchestrationStartTime
            : undefined;

        // Check if all layers are complete
        const updatedLayers: Record<string, LayerState> = {
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

        const isStillOrchestrating = Object.values(updatedLayers).some(
          (l: LayerState) =>
            l.status === "pending" || l.status === "in_progress",
        );

        return {
          ...prev,
          layers: updatedLayers,
          isOrchestrating: isStillOrchestrating,
        };
      });
    },
    [],
  );

  const resetLayers = useCallback(() => {
    setState({
      layers: Object.fromEntries(
        allLayers.map((layer) => [layer, { ...initialLayerState }]),
      ),
      isOrchestrating: false,
    });
  }, []);

  return {
    layers: state.layers,
    isOrchestrating: state.isOrchestrating,
    startOrchestration,
    updateLayer,
    resetLayers,
  };
}

/**
 * Generate sample data for layer previews (used in demos)
 */
export function generateSampleLayerData(
  layer: MemoryLayer,
  userMessage?: string,
): LayerState["data"] {
  switch (layer) {
    case "memorySpace":
      return {
        id: "quickstart-demo",
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
        id: "quickstart-assistant",
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
