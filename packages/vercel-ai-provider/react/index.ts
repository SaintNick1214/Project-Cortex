/**
 * React-specific exports for Cortex Memory Provider
 *
 * This subpath provides React hooks and utilities for building
 * memory-aware UI components with the Vercel AI SDK.
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
 *       {isOrchestrating && <MemoryLoadingIndicator />}
 *       <LayerVisualization layers={layers} />
 *       <Messages messages={messages} />
 *     </>
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

// Hook exports
export { useLayerTracking, generateSampleLayerData, ALL_LAYERS } from "./useLayerTracking";

// Type exports
export type {
  LayerState,
  LayerTrackingState,
  LayerUpdateData,
  UseLayerTrackingResult,
  MemoryLayer,
  LayerStatus,
  RevisionAction,
} from "./useLayerTracking";

// Re-export streaming helper types that are useful on the client
export type {
  OrchestrationStartData,
  LayerUpdateData as StreamLayerUpdateData,
  OrchestrationCompleteData,
} from "../src/streaming-helpers";

export { LAYER_STREAM_EVENTS } from "../src/streaming-helpers";
