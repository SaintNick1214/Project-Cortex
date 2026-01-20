/**
 * React hooks for tracking Cortex artifacts
 *
 * These hooks provide state management for artifact visualization,
 * automatically parsing artifact events from the AI SDK stream.
 *
 * @example
 * ```typescript
 * import { useArtifacts, useArtifact } from '@cortexmemory/vercel-ai-provider/react';
 * import { useChat } from '@ai-sdk/react';
 *
 * function ChatWithArtifacts() {
 *   const { artifactList, activeArtifact, handleDataPart } = useArtifacts({
 *     onArtifactComplete: (artifact) => {
 *       console.log('Artifact completed:', artifact.title);
 *     },
 *   });
 *
 *   const { messages, sendMessage } = useChat({
 *     onData: handleDataPart,
 *   });
 *
 *   return (
 *     <div className="flex">
 *       <ChatMessages messages={messages} />
 *       <ArtifactPanel artifacts={artifactList} active={activeArtifact} />
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useCallback, useRef } from "react";
import type {
  CortexArtifact,
  StreamingState,
  ArtifactKind,
} from "../src/artifacts/types";
import { ARTIFACT_STREAM_EVENTS } from "../src/artifacts/types";

// Re-export types for convenience
export type { CortexArtifact, StreamingState, ArtifactKind };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * State for a tracked artifact
 */
export interface ArtifactState {
  /** Partial artifact data (may be incomplete during streaming) */
  artifact: Partial<CortexArtifact>;
  /** Current streaming state */
  status: StreamingState;
  /** Progress (0-1) during streaming */
  progress: number;
  /** Error if any */
  error?: { message: string; code?: string };
  /** Whether artifact is currently streaming */
  isStreaming: boolean;
}

/**
 * Options for useArtifacts hook
 */
export interface UseArtifactsOptions {
  /** Called when a new artifact is created */
  onArtifactCreate?: (artifact: Partial<CortexArtifact>) => void;

  /** Called when an artifact is updated */
  onArtifactUpdate?: (artifact: Partial<CortexArtifact>) => void;

  /** Called when an artifact completes streaming */
  onArtifactComplete?: (artifact: CortexArtifact) => void;

  /** Called on artifact error */
  onArtifactError?: (
    artifactId: string,
    error: { message: string; code?: string }
  ) => void;
}

/**
 * Return type of useArtifacts hook
 */
export interface UseArtifactsResult {
  /** All tracked artifacts by ID */
  artifacts: Map<string, ArtifactState>;

  /** Array of all artifacts (convenience) */
  artifactList: ArtifactState[];

  /** Currently streaming artifact (if any) */
  activeArtifact: ArtifactState | null;

  /** Most recently completed artifact */
  latestArtifact: ArtifactState | null;

  /** Filter artifacts by kind */
  getByKind: (kind: ArtifactKind) => ArtifactState[];

  /** Get specific artifact by ID */
  getById: (id: string) => ArtifactState | undefined;

  /** Get all artifacts (alias for artifacts) */
  getAll: () => Map<string, ArtifactState>;

  /** Handle data part from useChat's onData callback */
  handleDataPart: (dataPart: unknown) => void;

  /** Clear all tracked artifacts */
  clearArtifacts: () => void;
}

/**
 * Options for useArtifact hook
 */
export interface UseArtifactOptions {
  /** Artifact ID to track */
  artifactId: string;

  /** Called when artifact content updates */
  onUpdate?: (
    artifact: Partial<CortexArtifact>,
    prevArtifact: Partial<CortexArtifact>
  ) => void;

  /** Called when artifact completes */
  onComplete?: (artifact: CortexArtifact) => void;

  /** Called on error */
  onError?: (error: { message: string; code?: string }) => void;

  /** Called on progress updates */
  onProgress?: (progress: number) => void;
}

/**
 * Return type of useArtifact hook
 */
export interface UseArtifactResult {
  /** Current artifact data (partial during streaming) */
  data: Partial<CortexArtifact> | null;

  /** Current status */
  status: StreamingState | "idle";

  /** Progress (0-1) during streaming */
  progress: number;

  /** Whether artifact is currently streaming */
  isStreaming: boolean;

  /** Whether artifact is complete */
  isComplete: boolean;

  /** Error if any */
  error: { message: string; code?: string } | null;

  /** Handle data part from useChat's onData callback */
  handleDataPart: (dataPart: unknown) => void;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// useArtifacts Hook
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * React hook for tracking multiple artifacts from AI responses
 *
 * @param options - Configuration options and callbacks
 * @returns Object containing artifact state and handler functions
 *
 * @example
 * ```tsx
 * import { useArtifacts } from '@cortexmemory/vercel-ai-provider/react';
 * import { useChat } from '@ai-sdk/react';
 *
 * function ChatWithArtifacts() {
 *   const { artifacts, activeArtifact, handleDataPart } = useArtifacts({
 *     onArtifactComplete: (artifact) => {
 *       console.log('Artifact completed:', artifact.title);
 *     },
 *   });
 *
 *   const { messages, sendMessage } = useChat({
 *     onData: handleDataPart,
 *   });
 *
 *   return (
 *     <div className="flex">
 *       <ChatMessages messages={messages} />
 *       <ArtifactPanel
 *         artifacts={Array.from(artifacts.values())}
 *         activeArtifact={activeArtifact}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useArtifacts(
  options: UseArtifactsOptions = {}
): UseArtifactsResult {
  const [artifacts, setArtifacts] = useState<Map<string, ArtifactState>>(
    new Map()
  );
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [latestArtifactId, setLatestArtifactId] = useState<string | null>(null);

  // Store callbacks in refs to avoid stale closures
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  const handleDataPart = useCallback(
    (dataPart: unknown) => {
      const part = dataPart as { type?: string; data?: unknown };
      if (!part || typeof part !== "object" || !part.type) return;

      const data = part.data as {
        artifactId?: string;
        artifact?: Partial<CortexArtifact>;
        chunk?: string;
        progress?: number;
        error?: { message: string; code?: string };
      };

      if (!data?.artifactId) return;
      const artifactId = data.artifactId;

      setArtifacts((prev) => {
        const next = new Map(prev);
        const existing = next.get(artifactId);

        switch (part.type) {
          case ARTIFACT_STREAM_EVENTS.CREATE: {
            const newState: ArtifactState = {
              artifact: data.artifact || {},
              status: "streaming",
              progress: 0,
              isStreaming: true,
            };
            next.set(artifactId, newState);
            setActiveArtifactId(artifactId);
            callbacksRef.current.onArtifactCreate?.(data.artifact || {});
            break;
          }

          case ARTIFACT_STREAM_EVENTS.APPEND:
          case ARTIFACT_STREAM_EVENTS.UPDATE: {
            if (existing) {
              const updated: ArtifactState = {
                ...existing,
                artifact: { ...existing.artifact, ...data.artifact },
              };
              next.set(artifactId, updated);
              callbacksRef.current.onArtifactUpdate?.(data.artifact || {});
            }
            break;
          }

          case ARTIFACT_STREAM_EVENTS.PROGRESS: {
            if (existing && data.progress !== undefined) {
              next.set(artifactId, {
                ...existing,
                progress: data.progress,
              });
            }
            break;
          }

          case ARTIFACT_STREAM_EVENTS.COMPLETE: {
            if (existing) {
              const completed: ArtifactState = {
                ...existing,
                artifact: { ...existing.artifact, ...data.artifact },
                status: "final",
                progress: 1,
                isStreaming: false,
              };
              next.set(artifactId, completed);
              setLatestArtifactId(artifactId);
              setActiveArtifactId((current) =>
                current === artifactId ? null : current
              );
              callbacksRef.current.onArtifactComplete?.(
                completed.artifact as CortexArtifact
              );
            }
            break;
          }

          case ARTIFACT_STREAM_EVENTS.ERROR: {
            if (existing) {
              next.set(artifactId, {
                ...existing,
                status: "error",
                error: data.error,
                isStreaming: false,
              });
              setActiveArtifactId((current) =>
                current === artifactId ? null : current
              );
              callbacksRef.current.onArtifactError?.(artifactId, data.error!);
            }
            break;
          }
        }

        return next;
      });
    },
    [] // No dependencies - we use refs for callbacks
  );

  const clearArtifacts = useCallback(() => {
    setArtifacts(new Map());
    setActiveArtifactId(null);
    setLatestArtifactId(null);
  }, []);

  const getByKind = useCallback(
    (kind: ArtifactKind): ArtifactState[] => {
      return Array.from(artifacts.values()).filter(
        (state) => state.artifact.kind === kind
      );
    },
    [artifacts]
  );

  const getById = useCallback(
    (id: string): ArtifactState | undefined => {
      return artifacts.get(id);
    },
    [artifacts]
  );

  const getAll = useCallback((): Map<string, ArtifactState> => {
    return artifacts;
  }, [artifacts]);

  return {
    artifacts,
    artifactList: Array.from(artifacts.values()),
    activeArtifact: activeArtifactId
      ? artifacts.get(activeArtifactId) || null
      : null,
    latestArtifact: latestArtifactId
      ? artifacts.get(latestArtifactId) || null
      : null,
    getByKind,
    getById,
    getAll,
    handleDataPart,
    clearArtifacts,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// useArtifact Hook
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * React hook for tracking a single artifact by ID
 *
 * @param options - Configuration options including artifact ID and callbacks
 * @returns Object containing artifact state and handler function
 *
 * @example
 * ```tsx
 * import { useArtifact } from '@cortexmemory/vercel-ai-provider/react';
 * import { useChat } from '@ai-sdk/react';
 *
 * function CodeArtifactViewer({ artifactId }: { artifactId: string }) {
 *   const { data, status, progress, isStreaming, handleDataPart } = useArtifact({
 *     artifactId,
 *     onComplete: (artifact) => {
 *       console.log('Code artifact ready:', artifact.content);
 *     },
 *   });
 *
 *   // Connect to useChat
 *   const { messages } = useChat({
 *     onData: handleDataPart,
 *   });
 *
 *   if (!data) return null;
 *
 *   return (
 *     <div>
 *       <h3>{data.title}</h3>
 *       {isStreaming && <ProgressBar value={progress} />}
 *       <CodeBlock
 *         language={data.language}
 *         code={data.content || ''}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useArtifact(options: UseArtifactOptions): UseArtifactResult {
  const { artifactId } = options;

  const [data, setData] = useState<Partial<CortexArtifact> | null>(null);
  const [status, setStatus] = useState<StreamingState | "idle">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<{ message: string; code?: string } | null>(
    null
  );

  const callbacksRef = useRef(options);
  callbacksRef.current = options;
  const prevDataRef = useRef<Partial<CortexArtifact> | null>(null);

  const handleDataPart = useCallback(
    (dataPart: unknown) => {
      const part = dataPart as { type?: string; data?: unknown };
      if (!part || typeof part !== "object" || !part.type) return;

      const eventData = part.data as {
        artifactId?: string;
        artifact?: Partial<CortexArtifact>;
        chunk?: string;
        progress?: number;
        error?: { message: string; code?: string };
      };

      // Only process events for our artifact
      if (eventData?.artifactId !== artifactId) return;

      switch (part.type) {
        case ARTIFACT_STREAM_EVENTS.CREATE: {
          setData(eventData.artifact || {});
          setStatus("streaming");
          setProgress(0);
          setError(null);
          prevDataRef.current = eventData.artifact || {};
          break;
        }

        case ARTIFACT_STREAM_EVENTS.APPEND:
        case ARTIFACT_STREAM_EVENTS.UPDATE: {
          setData((prev) => {
            const updated = { ...prev, ...eventData.artifact };
            if (callbacksRef.current.onUpdate) {
              callbacksRef.current.onUpdate(updated, prevDataRef.current || {});
            }
            prevDataRef.current = updated;
            return updated;
          });
          break;
        }

        case ARTIFACT_STREAM_EVENTS.PROGRESS: {
          if (eventData.progress !== undefined) {
            setProgress(eventData.progress);
            callbacksRef.current.onProgress?.(eventData.progress);
          }
          break;
        }

        case ARTIFACT_STREAM_EVENTS.COMPLETE: {
          setData((prev) => {
            const completed = { ...prev, ...eventData.artifact };
            callbacksRef.current.onComplete?.(completed as CortexArtifact);
            return completed;
          });
          setStatus("final");
          setProgress(1);
          break;
        }

        case ARTIFACT_STREAM_EVENTS.ERROR: {
          setStatus("error");
          setError(eventData.error || { message: "Unknown error" });
          callbacksRef.current.onError?.(
            eventData.error || { message: "Unknown error" }
          );
          break;
        }
      }
    },
    [artifactId]
  );

  return {
    data,
    status,
    progress,
    isStreaming: status === "streaming",
    isComplete: status === "final",
    error,
    handleDataPart,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Helper: Combined Data Handler
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a combined data handler for both layer and artifact events
 *
 * Use this when you need to handle both layer tracking and artifact events
 * from the same stream.
 *
 * @param handlers - Object containing individual handlers
 * @returns Combined handler function
 *
 * @example
 * ```tsx
 * import { useLayerTracking, useArtifacts, createCombinedDataHandler } from '@cortexmemory/vercel-ai-provider/react';
 * import { useChat } from '@ai-sdk/react';
 *
 * function ChatComponent() {
 *   const { handleDataPart: handleLayerData } = useLayerTracking();
 *   const { handleDataPart: handleArtifactData } = useArtifacts();
 *
 *   const handleData = createCombinedDataHandler({
 *     onLayerData: handleLayerData,
 *     onArtifactData: handleArtifactData,
 *   });
 *
 *   const { messages } = useChat({
 *     onData: handleData,
 *   });
 *
 *   // ...
 * }
 * ```
 */
export function createCombinedDataHandler(handlers: {
  onLayerData?: (dataPart: unknown) => void;
  onArtifactData?: (dataPart: unknown) => void;
}): (dataPart: unknown) => void {
  return (dataPart: unknown) => {
    handlers.onLayerData?.(dataPart);
    handlers.onArtifactData?.(dataPart);
  };
}
