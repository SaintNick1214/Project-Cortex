"use client";

/**
 * Layer Tracking - Re-exports from @cortexmemory/vercel-ai-provider/react
 *
 * This file re-exports the layer tracking hook and utilities from the provider
 * package, adding the "use client" directive for Next.js App Router compatibility.
 *
 * The provider package contains the full implementation including:
 * - useLayerTracking() hook for state management
 * - handleDataPart callback for automatic stream parsing
 * - Type definitions for layers, states, and events
 *
 * @example
 * ```typescript
 * import { useLayerTracking } from '@/lib/layer-tracking';
 * import { useChat } from '@ai-sdk/react';
 *
 * function ChatComponent() {
 *   const { layers, isOrchestrating, handleDataPart } = useLayerTracking();
 *   const { messages } = useChat({ onData: handleDataPart });
 *   // ...
 * }
 * ```
 */

// Re-export everything from the provider's React module
export {
  useLayerTracking,
  generateSampleLayerData,
  ALL_LAYERS,
} from "@cortexmemory/vercel-ai-provider/react";

// Re-export types
export type {
  MemoryLayer,
  LayerStatus,
  RevisionAction,
  LayerState,
  LayerTrackingState,
  LayerUpdateData,
  UseLayerTrackingResult,
} from "@cortexmemory/vercel-ai-provider/react";
