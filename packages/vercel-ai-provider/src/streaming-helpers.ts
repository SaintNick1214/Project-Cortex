/**
 * Streaming helpers for Cortex Memory layer visualization
 *
 * These utilities reduce boilerplate when integrating memory layer events
 * into Vercel AI SDK's streaming responses for real-time UI updates.
 *
 * @example
 * ```typescript
 * import { createLayerStreamObserver } from '@cortexmemory/vercel-ai-provider';
 *
 * const { observer, emitTo } = createLayerStreamObserver();
 *
 * return createUIMessageStreamResponse({
 *   stream: createUIMessageStream({
 *     execute: async ({ writer }) => {
 *       emitTo(writer);
 *       const cortexMemory = await createCortexMemoryAsync({
 *         layerObserver: observer,
 *         // ...config
 *       });
 *       // ...
 *     },
 *   }),
 * });
 * ```
 */

import type {
  OrchestrationObserver,
  LayerEvent,
  OrchestrationSummary,
  RecallSummary,
} from "./types";

/**
 * Stream writer interface compatible with Vercel AI SDK's UIMessageStreamWriter
 *
 * This interface matches the write method signature from the AI SDK's
 * createUIMessageStream, allowing layer events to be sent to the client.
 *
 * The type field uses a template literal to match the AI SDK's expected format.
 */
export interface StreamWriter {
  write(part: {
    type: `data-${string}`;
    data: unknown;
    transient?: boolean;
  }): void;
}

/**
 * Result of createLayerStreamObserver
 * @deprecated Use PhaseStreamObserverResult with createRecallStreamObserver/createRememberStreamObserver
 */
export interface LayerStreamObserverResult {
  /**
   * OrchestrationObserver to pass to createCortexMemoryAsync's layerObserver config
   */
  observer: OrchestrationObserver;

  /**
   * Connect the observer to a stream writer
   *
   * Call this with the writer from createUIMessageStream's execute callback
   * to enable layer events to be written to the stream.
   *
   * @param writer - The UIMessageStreamWriter from the AI SDK
   */
  emitTo: (writer: StreamWriter) => void;
}

/**
 * Result of phase-aware stream observer factories
 */
export interface PhaseStreamObserverResult {
  /**
   * OrchestrationObserver to pass to recall/remember operations
   */
  observer: OrchestrationObserver;

  /**
   * The orchestration phase this observer handles
   */
  phase: OrchestrationPhase;

  /**
   * Connect the observer to a stream writer
   *
   * Call this with the writer from createUIMessageStream's execute callback
   * to enable layer events to be written to the stream.
   *
   * @param writer - The UIMessageStreamWriter from the AI SDK
   */
  emitTo: (writer: StreamWriter) => void;
}

/**
 * Create a layer stream observer that emits memory orchestration events to a stream
 *
 * @deprecated Use createRecallStreamObserver() and createRememberStreamObserver() for phase-aware events.
 * This function emits legacy events without phase information.
 *
 * This helper creates an OrchestrationObserver that writes layer events directly
 * to a Vercel AI SDK stream writer. Events are marked as transient so they don't
 * persist in message history.
 *
 * **Event Types Emitted:**
 * - `data-orchestration-start` - Emitted when memory orchestration begins
 * - `data-layer-update` - Emitted for each layer status change (pending → in_progress → complete)
 * - `data-orchestration-complete` - Emitted when all layers have finished processing
 *
 * @returns Object containing the observer and emitTo function
 *
 * @example
 * ```typescript
 * // In your API route
 * import { createLayerStreamObserver, createCortexMemoryAsync } from '@cortexmemory/vercel-ai-provider';
 * import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
 *
 * export async function POST(req: Request) {
 *   const { observer, emitTo } = createLayerStreamObserver();
 *
 *   return createUIMessageStreamResponse({
 *     stream: createUIMessageStream({
 *       execute: async ({ writer }) => {
 *         // Connect observer to stream
 *         emitTo(writer);
 *
 *         // Create memory-augmented model
 *         const cortexMemory = await createCortexMemoryAsync({
 *           convexUrl: process.env.CONVEX_URL!,
 *           memorySpaceId: 'my-space',
 *           userId: 'user-123',
 *           agentId: 'my-agent',
 *           layerObserver: observer, // Pass observer here
 *         });
 *
 *         // Stream response
 *         const result = streamText({
 *           model: cortexMemory(openai('gpt-4o-mini')),
 *           messages,
 *         });
 *
 *         writer.merge(result.toUIMessageStream());
 *       },
 *     }),
 *   });
 * }
 * ```
 */
export function createLayerStreamObserver(): LayerStreamObserverResult {
  let writer: StreamWriter | null = null;

  // Legacy observer - emits both recall and remember events as generic orchestration events
  // For phase-aware tracking, use createRecallStreamObserver and createRememberStreamObserver
  const observer: OrchestrationObserver = {
    onRecallStart: (orchestrationId: string) => {
      writer?.write({
        type: "data-orchestration-start",
        data: { orchestrationId },
        transient: true,
      });
    },

    onRememberStart: (orchestrationId: string) => {
      // Legacy mode: don't emit a second start event, just track remember phase start
      // The original single-phase API only had one start event
    },

    onLayerUpdate: (event: LayerEvent) => {
      writer?.write({
        type: "data-layer-update",
        data: {
          layer: event.layer,
          status: event.status,
          timestamp: event.timestamp,
          // Legacy observer does not include phase - use phase-aware observers for phase info
          latencyMs: event.latencyMs,
          data: event.data,
          error: event.error,
          revisionAction: event.revisionAction,
          supersededFacts: event.supersededFacts,
        },
        transient: true,
      });
    },

    onRecallComplete: () => {
      // Legacy mode: don't emit complete on recall - wait for remember complete
    },

    onRememberComplete: (summary: OrchestrationSummary) => {
      writer?.write({
        type: "data-orchestration-complete",
        data: {
          orchestrationId: summary.orchestrationId,
          totalLatencyMs: summary.totalLatencyMs,
          createdIds: summary.createdIds,
        },
        transient: true,
      });
    },
  };

  return {
    observer,
    emitTo: (w: StreamWriter) => {
      writer = w;
    },
  };
}

/**
 * Create a phase-aware stream observer for the recall phase (memory retrieval)
 *
 * This helper creates an OrchestrationObserver that writes phase-aware layer events
 * directly to a Vercel AI SDK stream writer during memory recall operations.
 *
 * **Event Types Emitted:**
 * - `data-recall-start` - Emitted when memory recall begins
 * - `data-layer-update` - Emitted for each layer status change (includes phase: "recall")
 * - `data-recall-complete` - Emitted when recall completes with retrieval results
 *
 * @returns Object containing the observer, phase identifier, and emitTo function
 *
 * @example
 * ```typescript
 * import { createRecallStreamObserver, createRememberStreamObserver } from '@cortexmemory/vercel-ai-provider';
 *
 * export async function POST(req: Request) {
 *   const recallObserver = createRecallStreamObserver();
 *   const rememberObserver = createRememberStreamObserver();
 *
 *   return createUIMessageStreamResponse({
 *     stream: createUIMessageStream({
 *       execute: async ({ writer }) => {
 *         // Connect both observers to the same writer
 *         recallObserver.emitTo(writer);
 *         rememberObserver.emitTo(writer);
 *
 *         // Use recallObserver for recall operations
 *         // Use rememberObserver for remember operations
 *       },
 *     }),
 *   });
 * }
 * ```
 */
export function createRecallStreamObserver(): PhaseStreamObserverResult {
  let writer: StreamWriter | null = null;
  const phase: OrchestrationPhase = "recall";

  const observer: OrchestrationObserver = {
    onRecallStart: (orchestrationId: string) => {
      writer?.write({
        type: "data-recall-start",
        data: { orchestrationId, phase } satisfies RecallStartData,
        transient: true,
      });
    },

    onLayerUpdate: (event: LayerEvent) => {
      writer?.write({
        type: "data-layer-update",
        data: {
          layer: event.layer,
          status: event.status,
          timestamp: event.timestamp,
          phase, // Phase-aware layer updates
          latencyMs: event.latencyMs,
          data: event.data,
          error: event.error,
          revisionAction: event.revisionAction,
          supersededFacts: event.supersededFacts,
        } satisfies LayerUpdateData,
        transient: true,
      });
    },

    onRecallComplete: (summary) => {
      writer?.write({
        type: "data-recall-complete",
        data: {
          orchestrationId: summary.orchestrationId,
          phase,
          totalLatencyMs: summary.totalLatencyMs,
          // Include recall-specific context metadata
          context: summary.context,
        } satisfies RecallCompleteData,
        transient: true,
      });
    },
  };

  return {
    observer,
    phase,
    emitTo: (w: StreamWriter) => {
      writer = w;
    },
  };
}

/**
 * Create a phase-aware stream observer for the remember phase (memory storage)
 *
 * This helper creates an OrchestrationObserver that writes phase-aware layer events
 * directly to a Vercel AI SDK stream writer during memory storage operations.
 *
 * **Event Types Emitted:**
 * - `data-remember-start` - Emitted when memory storage begins
 * - `data-layer-update` - Emitted for each layer status change (includes phase: "remember")
 * - `data-remember-complete` - Emitted when storage completes with created IDs
 *
 * @returns Object containing the observer, phase identifier, and emitTo function
 *
 * @example
 * ```typescript
 * import { createRecallStreamObserver, createRememberStreamObserver } from '@cortexmemory/vercel-ai-provider';
 *
 * export async function POST(req: Request) {
 *   const recallObserver = createRecallStreamObserver();
 *   const rememberObserver = createRememberStreamObserver();
 *
 *   return createUIMessageStreamResponse({
 *     stream: createUIMessageStream({
 *       execute: async ({ writer }) => {
 *         // Connect both observers to the same writer
 *         recallObserver.emitTo(writer);
 *         rememberObserver.emitTo(writer);
 *
 *         // Use recallObserver for recall operations
 *         // Use rememberObserver for remember operations
 *       },
 *     }),
 *   });
 * }
 * ```
 */
export function createRememberStreamObserver(): PhaseStreamObserverResult {
  let writer: StreamWriter | null = null;
  const phase: OrchestrationPhase = "remember";

  const observer: OrchestrationObserver = {
    onRememberStart: (orchestrationId: string) => {
      writer?.write({
        type: "data-remember-start",
        data: { orchestrationId, phase } satisfies RememberStartData,
        transient: true,
      });
    },

    onLayerUpdate: (event: LayerEvent) => {
      writer?.write({
        type: "data-layer-update",
        data: {
          layer: event.layer,
          status: event.status,
          timestamp: event.timestamp,
          phase, // Phase-aware layer updates
          latencyMs: event.latencyMs,
          data: event.data,
          error: event.error,
          revisionAction: event.revisionAction,
          supersededFacts: event.supersededFacts,
        } satisfies LayerUpdateData,
        transient: true,
      });
    },

    onRememberComplete: (summary: OrchestrationSummary) => {
      writer?.write({
        type: "data-remember-complete",
        data: {
          orchestrationId: summary.orchestrationId,
          phase,
          totalLatencyMs: summary.totalLatencyMs,
          createdIds: summary.createdIds,
        } satisfies RememberCompleteData,
        transient: true,
      });
    },
  };

  return {
    observer,
    phase,
    emitTo: (w: StreamWriter) => {
      writer = w;
    },
  };
}

/**
 * Data part types emitted by createLayerStreamObserver
 *
 * Use these type names to parse layer events on the client side.
 *
 * Phase-aware events (v0.30.0+):
 * - RECALL_START/RECALL_COMPLETE for memory retrieval phase
 * - REMEMBER_START/REMEMBER_COMPLETE for memory storage phase
 *
 * Legacy events (deprecated):
 * - ORCHESTRATION_START/ORCHESTRATION_COMPLETE - use phase-specific events instead
 */
export const LAYER_STREAM_EVENTS = {
  /** @deprecated Use RECALL_START or REMEMBER_START instead */
  ORCHESTRATION_START: "data-orchestration-start",
  /** @deprecated Use RECALL_COMPLETE or REMEMBER_COMPLETE instead */
  ORCHESTRATION_COMPLETE: "data-orchestration-complete",
  /** Layer update event (includes phase field in v0.30.0+) */
  LAYER_UPDATE: "data-layer-update",
  /** Recall phase started (memory retrieval) */
  RECALL_START: "data-recall-start",
  /** Recall phase completed (memory retrieval finished) */
  RECALL_COMPLETE: "data-recall-complete",
  /** Remember phase started (memory storage) */
  REMEMBER_START: "data-remember-start",
  /** Remember phase completed (memory storage finished) */
  REMEMBER_COMPLETE: "data-remember-complete",
} as const;

/**
 * Type for orchestration start event data
 */
export interface OrchestrationStartData {
  orchestrationId: string;
}

/**
 * Phase type for phase-aware orchestration
 */
export type OrchestrationPhase = "recall" | "remember";

/**
 * Type for layer update event data
 */
export interface LayerUpdateData {
  layer: string;
  status: string;
  timestamp: number;
  phase: OrchestrationPhase;
  latencyMs?: number;
  data?: {
    id?: string;
    preview?: string;
    metadata?: Record<string, unknown>;
  };
  error?: { message: string; code?: string };
  revisionAction?: string;
  supersededFacts?: string[];
}

/**
 * Type for orchestration complete event data
 * @deprecated Use RecallCompleteData or RememberCompleteData instead
 */
export interface OrchestrationCompleteData {
  orchestrationId: string;
  totalLatencyMs: number;
  createdIds?: {
    conversationId?: string;
    messageIds?: string[];
    memoryIds?: string[];
    factIds?: string[];
  };
}

/**
 * Type for recall start event data
 */
export interface RecallStartData {
  orchestrationId: string;
  phase: "recall";
}

/**
 * Type for recall complete event data
 */
export interface RecallCompleteData {
  orchestrationId: string;
  phase: "recall";
  totalLatencyMs: number;
  /** Retrieved context information */
  context?: {
    /** Formatted context string for LLM prompt */
    formatted?: string;
    /** Number of memories retrieved */
    memoriesCount: number;
    /** Number of facts retrieved */
    factsCount: number;
    /** Number of graph entities retrieved */
    graphEntitiesCount: number;
  };
}

/**
 * Type for remember start event data
 */
export interface RememberStartData {
  orchestrationId: string;
  phase: "remember";
}

/**
 * Type for remember complete event data
 */
export interface RememberCompleteData {
  orchestrationId: string;
  phase: "remember";
  totalLatencyMs: number;
  createdIds?: {
    conversationId?: string;
    messageIds?: string[];
    memoryIds?: string[];
    factIds?: string[];
  };
}
