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
} from "./types";

/**
 * Stream writer interface compatible with Vercel AI SDK's UIMessageStreamWriter
 *
 * This interface matches the write method signature from the AI SDK's
 * createUIMessageStream, allowing layer events to be sent to the client.
 */
export interface StreamWriter {
  write(part: {
    type: string;
    data: unknown;
    transient?: boolean;
  }): void;
}

/**
 * Result of createLayerStreamObserver
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
 * Create a layer stream observer that emits memory orchestration events to a stream
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

  const observer: OrchestrationObserver = {
    onOrchestrationStart: (orchestrationId: string) => {
      writer?.write({
        type: "data-orchestration-start",
        data: { orchestrationId },
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
          latencyMs: event.latencyMs,
          data: event.data,
          error: event.error,
          revisionAction: event.revisionAction,
          supersededFacts: event.supersededFacts,
        },
        transient: true,
      });
    },

    onOrchestrationComplete: (summary: OrchestrationSummary) => {
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
 * Data part types emitted by createLayerStreamObserver
 *
 * Use these type names to parse layer events on the client side.
 */
export const LAYER_STREAM_EVENTS = {
  ORCHESTRATION_START: "data-orchestration-start",
  LAYER_UPDATE: "data-layer-update",
  ORCHESTRATION_COMPLETE: "data-orchestration-complete",
} as const;

/**
 * Type for orchestration start event data
 */
export interface OrchestrationStartData {
  orchestrationId: string;
}

/**
 * Type for layer update event data
 */
export interface LayerUpdateData {
  layer: string;
  status: string;
  timestamp: number;
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
