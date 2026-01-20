/**
 * AI tool definitions for artifact operations
 *
 * These tools enable AI models to create, update, and manage artifacts
 * during conversations using the Vercel AI SDK tool format.
 *
 * @example
 * ```typescript
 * import { createArtifactTools } from '@cortexmemory/vercel-ai-provider';
 * import { streamText } from 'ai';
 *
 * const result = streamText({
 *   model: openai('gpt-4o'),
 *   messages,
 *   tools: createArtifactTools({ storage: artifactStorage }),
 *   system: 'You can create code, documents, and diagrams as artifacts.',
 * });
 * ```
 */

import { z } from "zod";
import {
  ArtifactKindSchema,
  CreateArtifactInputSchema,
  UpdateArtifactInputSchema,
  AppendToArtifactInputSchema,
  GetArtifactInputSchema,
  ListArtifactsInputSchema,
  ARTIFACT_STREAM_EVENTS,
  type CortexArtifact,
  type ArtifactConfig,
  type CreateArtifactResult,
  type UpdateArtifactResult,
  type AppendToArtifactResult,
  type GetArtifactResult,
  type ListArtifactsResult,
} from "./types";
import type { StreamWriter } from "../streaming-helpers";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Artifact Storage Interface
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Storage interface for artifact operations
 *
 * Implement this interface to provide custom storage backends for artifacts.
 * The default implementation uses Cortex Memory.
 */
export interface ArtifactStorageInterface {
  create(input: {
    kind: string;
    title: string;
    content: string;
    language?: string;
    description?: string;
    mimeType?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<CortexArtifact>;

  update(input: {
    artifactId: string;
    content?: string;
    title?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): Promise<CortexArtifact>;

  append(input: {
    artifactId: string;
    content: string;
    position?: "start" | "end";
  }): Promise<CortexArtifact>;

  get(artifactId: string): Promise<CortexArtifact | null>;

  list(options?: {
    kind?: string;
    limit?: number;
  }): Promise<CortexArtifact[]>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Artifact Streamer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Helper class for streaming artifact content to the client
 */
export class ArtifactStreamer {
  private writer: StreamWriter | null = null;
  private artifactId: string;
  private artifact: Partial<CortexArtifact>;
  private contentBuffer: string = "";

  constructor(artifactId: string, initial: Partial<CortexArtifact>) {
    this.artifactId = artifactId;
    this.artifact = {
      ...initial,
      id: artifactId,
      streamingState: "streaming",
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Connect to a stream writer
   */
  connectTo(writer: StreamWriter): void {
    this.writer = writer;

    // Send initial create event
    this.writer.write({
      type: ARTIFACT_STREAM_EVENTS.CREATE,
      data: {
        artifactId: this.artifactId,
        artifact: this.artifact,
      },
    });
  }

  /**
   * Append content to the artifact (streams incrementally)
   */
  append(content: string): void {
    this.contentBuffer += content;
    this.artifact.content = this.contentBuffer;
    this.artifact.updatedAt = Date.now();

    this.writer?.write({
      type: ARTIFACT_STREAM_EVENTS.APPEND,
      data: {
        artifactId: this.artifactId,
        chunk: content,
        artifact: this.artifact,
      },
    });
  }

  /**
   * Update progress indicator
   */
  setProgress(progress: number): void {
    const clampedProgress = Math.min(1, Math.max(0, progress));
    if (!this.artifact.streamingMetadata) {
      this.artifact.streamingMetadata = {};
    }
    this.artifact.streamingMetadata.bytesReceived = Math.floor(
      clampedProgress * (this.artifact.streamingMetadata.estimatedTotal || 100)
    );

    this.writer?.write({
      type: ARTIFACT_STREAM_EVENTS.PROGRESS,
      data: {
        artifactId: this.artifactId,
        progress: clampedProgress,
      },
      transient: true, // Don't persist progress updates
    });
  }

  /**
   * Update artifact metadata/title
   */
  update(updates: Partial<CortexArtifact>): void {
    this.artifact = { ...this.artifact, ...updates, updatedAt: Date.now() };

    this.writer?.write({
      type: ARTIFACT_STREAM_EVENTS.UPDATE,
      data: {
        artifactId: this.artifactId,
        artifact: this.artifact,
      },
    });
  }

  /**
   * Mark artifact as complete
   */
  complete(finalContent?: string): CortexArtifact {
    if (finalContent !== undefined) {
      this.contentBuffer = finalContent;
    }

    const completed: CortexArtifact = {
      ...this.artifact,
      content: this.contentBuffer,
      streamingState: "final",
      updatedAt: Date.now(),
    } as CortexArtifact;

    this.writer?.write({
      type: ARTIFACT_STREAM_EVENTS.COMPLETE,
      data: {
        artifactId: this.artifactId,
        artifact: completed,
      },
    });

    return completed;
  }

  /**
   * Mark artifact as errored
   */
  error(message: string, code?: string): void {
    this.artifact.streamingState = "error";
    if (!this.artifact.streamingMetadata) {
      this.artifact.streamingMetadata = {};
    }
    this.artifact.streamingMetadata.errorMessage = message;
    this.artifact.streamingMetadata.errorCode = code;

    this.writer?.write({
      type: ARTIFACT_STREAM_EVENTS.ERROR,
      data: {
        artifactId: this.artifactId,
        error: { message, code },
        artifact: this.artifact,
      },
    });
  }

  /**
   * Get current artifact state
   */
  get current(): Partial<CortexArtifact> {
    return { ...this.artifact, content: this.contentBuffer };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Factory Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a unique artifact ID
 */
function generateArtifactId(): string {
  return `art-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a new artifact streamer
 */
export function createArtifactStreamer(
  input: Pick<
    CortexArtifact,
    "kind" | "title" | "language" | "metadata" | "memorySpaceId"
  >
): ArtifactStreamer {
  const artifactId = generateArtifactId();

  return new ArtifactStreamer(artifactId, {
    kind: input.kind,
    title: input.title,
    language: input.language,
    metadata: input.metadata,
    memorySpaceId: input.memorySpaceId,
    content: "",
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tool Context & Factory
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Context required for artifact tools
 */
export interface ArtifactToolsContext {
  /** Storage interface for artifact persistence */
  storage: ArtifactStorageInterface;

  /** Get the current active streamer (if any) */
  getStreamer?: () => ArtifactStreamer | null;

  /** Set the current active streamer */
  setStreamer?: (streamer: ArtifactStreamer | null) => void;

  /** Stream writer for real-time updates */
  writer?: StreamWriter;

  /** Memory space ID for artifact storage */
  memorySpaceId?: string;
}

/**
 * Options for creating artifact tools
 */
export interface CreateArtifactToolsOptions extends ArtifactToolsContext {
  /** Enable streaming mode for progressive artifact display */
  enableStreaming?: boolean;

  /** Artifact configuration */
  config?: ArtifactConfig;
}

/**
 * Helper to chunk content for progressive streaming
 */
function chunkContent(content: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < content.length; i += chunkSize) {
    chunks.push(content.slice(i, i + chunkSize));
  }
  return chunks.length > 0 ? chunks : [content];
}

/**
 * Create artifact tools for use with Vercel AI SDK's streamText/generateText
 *
 * These tools enable the AI to create, update, and manage artifacts
 * during the conversation.
 *
 * @param context - Context providing storage and streaming capabilities
 * @returns Object containing tool definitions
 *
 * @example
 * ```typescript
 * import { createArtifactTools } from '@cortexmemory/vercel-ai-provider';
 * import { streamText } from 'ai';
 * import { openai } from '@ai-sdk/openai';
 *
 * const tools = createArtifactTools({
 *   storage: artifactStorage,
 *   writer: streamWriter,
 * });
 *
 * const result = streamText({
 *   model: openai('gpt-4o'),
 *   messages,
 *   tools,
 *   system: `You are a helpful assistant that can create artifacts.
 *     When asked to write code, create a code artifact.
 *     When asked to create a document, create a text artifact.`,
 * });
 * ```
 */
export function createArtifactTools(options: CreateArtifactToolsOptions) {
  const {
    storage,
    getStreamer,
    setStreamer,
    writer,
    memorySpaceId,
    enableStreaming = true,
    config,
  } = options;

  return {
    /**
     * Create a new artifact
     */
    createArtifact: {
      description:
        "Create a new artifact (code file, document, diagram, etc.) that will be displayed to the user",
      parameters: CreateArtifactInputSchema,
      execute: async (
        input: z.infer<typeof CreateArtifactInputSchema>
      ): Promise<CreateArtifactResult> => {
        try {
          let completed: CortexArtifact;

          if (enableStreaming && writer && setStreamer) {
            // Create streamer for real-time updates
            const streamer = createArtifactStreamer({
              kind: input.kind,
              title: input.title,
              language: input.language,
              metadata: input.metadata,
              memorySpaceId: memorySpaceId || "default",
            });

            streamer.connectTo(writer);
            setStreamer(streamer);

            // Stream content progressively
            const chunks = chunkContent(input.content, 100);
            for (let i = 0; i < chunks.length; i++) {
              streamer.append(chunks[i]);
              streamer.setProgress((i + 1) / chunks.length);
            }

            // Complete streaming
            completed = streamer.complete();
            setStreamer(null);
          } else {
            // Non-streaming mode - just create directly
            completed = await storage.create({
              kind: input.kind,
              title: input.title,
              content: input.content,
              language: input.language,
              description: input.description,
              tags: input.tags,
              metadata: input.metadata,
            });
          }

          // Persist to storage (in streaming mode, this might be redundant but ensures persistence)
          if (enableStreaming) {
            await storage.create({
              kind: input.kind,
              title: input.title,
              content: input.content,
              language: input.language,
              description: input.description,
              tags: input.tags,
              metadata: { ...input.metadata, streamedArtifactId: completed.id },
            });
          }

          return {
            artifactId: completed.id,
            title: input.title,
            kind: input.kind,
            version: completed.version,
            message: `Created ${input.kind} artifact: "${input.title}"`,
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          throw new Error(`Failed to create artifact: ${message}`);
        }
      },
    },

    /**
     * Update an existing artifact
     */
    updateArtifact: {
      description: "Update an existing artifact with new content or metadata",
      parameters: UpdateArtifactInputSchema,
      execute: async (
        input: z.infer<typeof UpdateArtifactInputSchema>
      ): Promise<UpdateArtifactResult> => {
        try {
          const updated = await storage.update({
            artifactId: input.artifactId,
            content: input.content,
            title: input.title,
            description: input.description,
            metadata: input.metadata,
            tags: input.tags,
          });

          // Emit update event if writer is available
          writer?.write({
            type: ARTIFACT_STREAM_EVENTS.UPDATE,
            data: {
              artifactId: updated.id,
              artifact: updated,
            },
          });

          return {
            artifactId: updated.id,
            version: updated.version,
            updatedAt: updated.updatedAt,
            message: `Updated artifact to version ${updated.version}`,
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          throw new Error(`Failed to update artifact: ${message}`);
        }
      },
    },

    /**
     * Append content to an existing artifact
     */
    appendToArtifact: {
      description: "Append content to the beginning or end of an existing artifact",
      parameters: AppendToArtifactInputSchema,
      execute: async (
        input: z.infer<typeof AppendToArtifactInputSchema>
      ): Promise<AppendToArtifactResult> => {
        try {
          const updated = await storage.append({
            artifactId: input.artifactId,
            content: input.content,
            position: input.position,
          });

          // Emit append event if writer is available
          writer?.write({
            type: ARTIFACT_STREAM_EVENTS.APPEND,
            data: {
              artifactId: updated.id,
              chunk: input.content,
              artifact: updated,
            },
          });

          return {
            artifactId: updated.id,
            version: updated.version,
            bytesAdded: input.content.length,
            contentLength: updated.content.length,
            message: `Appended ${input.content.length} characters to artifact`,
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          throw new Error(`Failed to append to artifact: ${message}`);
        }
      },
    },

    /**
     * Get an artifact by ID
     */
    getArtifact: {
      description: "Retrieve an artifact by its ID to view or modify it",
      parameters: GetArtifactInputSchema,
      execute: async (
        input: z.infer<typeof GetArtifactInputSchema>
      ): Promise<GetArtifactResult> => {
        try {
          const artifact = await storage.get(input.artifactId);

          if (!artifact) {
            return { error: `Artifact not found: ${input.artifactId}` };
          }

          return {
            artifact: {
              id: artifact.id,
              kind: artifact.kind,
              title: artifact.title,
              content: artifact.content,
              language: artifact.language,
              version: artifact.version,
              createdAt: artifact.createdAt,
              updatedAt: artifact.updatedAt,
            },
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          return { error: `Failed to get artifact: ${message}` };
        }
      },
    },

    /**
     * List artifacts in the conversation
     */
    listArtifacts: {
      description: "List artifacts in the current conversation, optionally filtered by kind",
      parameters: ListArtifactsInputSchema,
      execute: async (
        input: z.infer<typeof ListArtifactsInputSchema>
      ): Promise<ListArtifactsResult> => {
        try {
          const artifacts = await storage.list({
            kind: input.kind,
            limit: input.limit,
          });

          return {
            count: artifacts.length,
            artifacts: artifacts.map((a) => ({
              id: a.id,
              kind: a.kind,
              title: a.title,
              version: a.version,
              preview:
                a.content.slice(0, 100) + (a.content.length > 100 ? "..." : ""),
            })),
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          throw new Error(`Failed to list artifacts: ${message}`);
        }
      },
    },
  };
}

/**
 * Type for the artifact tools object returned by createArtifactTools
 */
export type ArtifactTools = ReturnType<typeof createArtifactTools>;
