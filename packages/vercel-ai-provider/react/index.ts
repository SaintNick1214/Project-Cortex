/**
 * React-specific exports for Cortex Memory Provider
 *
 * This subpath provides React hooks and utilities for building
 * memory-aware UI components with the Vercel AI SDK.
 *
 * @example
 * ```typescript
 * import { useLayerTracking, useArtifacts } from '@cortexmemory/vercel-ai-provider/react';
 * import { useChat } from '@ai-sdk/react';
 *
 * function ChatComponent() {
 *   const { layers, isOrchestrating, handleDataPart: handleLayerData } = useLayerTracking();
 *   const { artifactList, activeArtifact, handleDataPart: handleArtifactData } = useArtifacts();
 *
 *   // Combined handler for both layer and artifact events
 *   const handleData = (dataPart: unknown) => {
 *     handleLayerData(dataPart);
 *     handleArtifactData(dataPart);
 *   };
 *
 *   const { messages, sendMessage } = useChat({
 *     onData: handleData,
 *   });
 *
 *   return (
 *     <>
 *       {isOrchestrating && <MemoryLoadingIndicator />}
 *       <LayerVisualization layers={layers} />
 *       <Messages messages={messages} />
 *       <ArtifactPanel artifacts={artifactList} active={activeArtifact} />
 *     </>
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Layer Tracking Hook Exports
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export {
  useLayerTracking,
  generateSampleLayerData,
  ALL_LAYERS,
  RECALL_LAYERS,
  REMEMBER_LAYERS,
} from "./useLayerTracking";

export type {
  LayerState,
  LayerTrackingState,
  LayerUpdateData,
  UseLayerTrackingResult,
  MemoryLayer,
  LayerStatus,
  RevisionAction,
  // New dual-phase types
  OrchestrationPhase,
  PhaseStartData,
  PhaseCompleteData,
  DualPhaseTrackingState,
} from "./useLayerTracking";

// Re-export streaming helper types that are useful on the client
export type {
  OrchestrationStartData,
  LayerUpdateData as StreamLayerUpdateData,
  OrchestrationCompleteData,
} from "../src/streaming-helpers";

export { LAYER_STREAM_EVENTS } from "../src/streaming-helpers";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Artifact Hook Exports
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export {
  useArtifacts,
  useArtifact,
  createCombinedDataHandler,
} from "./useArtifacts";

export type {
  // State types
  ArtifactState,
  // useArtifacts types
  UseArtifactsOptions,
  UseArtifactsResult,
  // useArtifact types
  UseArtifactOptions,
  UseArtifactResult,
  // Re-exported from artifacts module
  CortexArtifact,
  StreamingState,
  ArtifactKind,
} from "./useArtifacts";

// Re-export artifact stream event constants
export { ARTIFACT_STREAM_EVENTS } from "../src/artifacts";
