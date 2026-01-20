/**
 * Cortex SDK - Artifacts API
 *
 * Layer 5: Versioned artifact management with full undo/redo support
 *
 * Artifacts are versioned, content-addressable documents that support:
 * - Multiple content types (text, code, sheet, image, diagram, html, custom)
 * - Full undo/redo with version history
 * - Streaming content generation
 * - File attachments
 * - Graph database integration
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../convex-dev/_generated/api";
import type {
  Artifact,
  ArtifactVersion,
  StreamingState,
  CreateArtifactOptions,
  UpdateArtifactOptions,
  ListArtifactsFilter,
  CountArtifactsFilter,
  DeleteArtifactResult,
  GetArtifactHistoryOptions,
  StartStreamingParams,
  AppendContentParams,
  StreamingSessionParams,
  FinalizeStreamingParams,
} from "../types";
import type { GraphAdapter } from "../graph/types";
import type { ResilienceLayer } from "../resilience";
import type { AuthContext } from "../auth/types";
import {
  validateArtifactId,
  validateArtifactIdFormat,
  validateContent,
  validateContentSize,
  validateStreamingState,
  validateCreateOptions,
  validateUpdateOptions,
  validateListFilter,
  validateCountFilter,
  validateHistoryOptions,
  validateVersion,
  validateSessionId,
  validateStartStreamingParams,
  validateAppendContentParams,
} from "./validators";

// Export validation error for users who want to catch it specifically
export { ArtifactValidationError } from "./validators";


export class ArtifactsAPI {
  constructor(
    private readonly client: ConvexClient,
    private readonly graphAdapter?: GraphAdapter,
    private readonly resilience?: ResilienceLayer,
    private readonly authContext?: AuthContext,
  ) {}

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Private Helpers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Execute an operation through the resilience layer (if available)
   */
  private async executeWithResilience<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    if (this.resilience) {
      return this.resilience.execute(operation, operationName);
    }
    return operation();
  }

  /**
   * Handle ConvexError from direct Convex calls
   */
  private handleConvexError(error: unknown): never {
    if (
      error &&
      typeof error === "object" &&
      "data" in error &&
      (error as { data: unknown }).data !== undefined
    ) {
      const convexError = error as { data: unknown };
      const errorData =
        typeof convexError.data === "string"
          ? convexError.data
          : JSON.stringify(convexError.data);
      throw new Error(errorData);
    }
    throw error;
  }

  /**
   * Sync artifact to graph database (if configured)
   */
  private async syncToGraph(artifact: Artifact): Promise<void> {
    if (!this.graphAdapter) return;

    try {
      await this.graphAdapter.createNode({
        label: "Artifact",
        properties: {
          artifactId: artifact.artifactId,
          title: artifact.title,
          kind: artifact.kind,
          streamingState: artifact.streamingState,
          version: artifact.version,
          memorySpaceId: artifact.memorySpaceId,
          userId: artifact.userId,
          agentId: artifact.agentId,
          createdAt: artifact.createdAt,
          updatedAt: artifact.updatedAt,
        },
      });

      // Create edges (relationships) if references exist
      if (artifact.conversationRef?.conversationId) {
        await this.graphAdapter.createEdge({
          from: artifact.artifactId,
          to: artifact.conversationRef.conversationId,
          type: "DERIVED_FROM",
        });
      }

      if (artifact.memoryRefs && artifact.memoryRefs.length > 0) {
        for (const memRef of artifact.memoryRefs) {
          await this.graphAdapter.createEdge({
            from: artifact.artifactId,
            to: memRef.memoryId,
            type: "DERIVED_FROM",
            properties: { relevance: memRef.relevance },
          });
        }
      }
    } catch (error) {
      console.warn("Failed to sync artifact to graph:", error);
    }
  }

  /**
   * Update artifact in graph database
   */
  private async updateInGraph(
    artifactId: string,
    properties: Record<string, unknown>,
  ): Promise<void> {
    if (!this.graphAdapter) return;

    try {
      await this.graphAdapter.updateNode(artifactId, properties);
    } catch (error) {
      console.warn("Failed to update artifact in graph:", error);
    }
  }

  /**
   * Delete artifact from graph database
   */
  private async deleteFromGraph(artifactId: string): Promise<void> {
    if (!this.graphAdapter) return;

    try {
      await this.graphAdapter.deleteNode(artifactId, true);
    } catch (error) {
      console.warn("Failed to delete artifact from graph:", error);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Core CRUD Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Create a new artifact
   *
   * @example
   * ```typescript
   * const artifact = await cortex.artifacts.create({
   *   memorySpaceId: 'user-123-space',
   *   title: 'Code Snippet',
   *   content: 'function hello() { return "world"; }',
   *   kind: 'code',
   *   tags: ['javascript', 'function'],
   * });
   * console.log(artifact.artifactId); // "art-abc123def456"
   * ```
   */
  async create(options: CreateArtifactOptions): Promise<Artifact> {
    // Client-side validation
    validateCreateOptions(options);

    const result = await this.executeWithResilience(
      () =>
        this.client.mutation(api.artifacts.create, {
          memorySpaceId: options.memorySpaceId,
          title: options.title,
          content: options.content,
          kind: options.kind ?? "text",
          streamingState: options.streamingState ?? "draft",
          artifactId: options.artifactId,
          tenantId: options.tenantId ?? this.authContext?.tenantId,
          userId: options.userId,
          participantId: options.participantId,
          description: options.description,
          metadata: options.metadata,
          tags: options.tags ?? [],
          conversationRef: options.conversationRef,
          language: options.kindConfig?.language,
          mimeType: options.kindConfig?.mimeType,
        }),
      "artifacts:create",
    );

    const artifact = result as Artifact;

    // Sync to graph
    await this.syncToGraph(artifact);

    return artifact;
  }

  /**
   * Get an artifact by ID
   *
   * @example
   * ```typescript
   * const artifact = await cortex.artifacts.get('art-abc123def456');
   * if (artifact) {
   *   console.log(artifact.title, artifact.content);
   * }
   * ```
   */
  async get(artifactId: string): Promise<Artifact | null> {
    // Client-side validation
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.artifacts.get, {
          artifactId,
          tenantId: this.authContext?.tenantId,
        }),
      "artifacts:get",
    );

    return result as Artifact | null;
  }

  /**
   * Update an artifact's content (creates a new version)
   *
   * @example
   * ```typescript
   * const updated = await cortex.artifacts.update(
   *   'art-abc123def456',
   *   'function hello() { return "updated world"; }',
   *   { changeSummary: 'Fixed return value' }
   * );
   * console.log(updated.version); // 2
   * ```
   */
  async update(
    artifactId: string,
    content: string,
    options?: UpdateArtifactOptions,
  ): Promise<Artifact> {
    // Client-side validation
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);
    validateContent(content);
    validateContentSize(content);
    if (options) {
      validateUpdateOptions(options);
    }

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.artifacts.update, {
            artifactId,
            content,
            tenantId: this.authContext?.tenantId,
            title: options?.title,
            metadata: options?.metadata,
            tags: options?.tags,
            changeSummary: options?.changeSummary,
          }),
        "artifacts:update",
      );

      const artifact = result as Artifact;

      // Update graph with new version info
      await this.updateInGraph(artifactId, {
        version: artifact.version,
        updatedAt: artifact.updatedAt,
      });

      return artifact;
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  /**
   * Delete an artifact
   *
   * @param artifactId - The artifact ID to delete
   * @param hard - If true, permanently deletes. If false (default), soft deletes.
   *
   * @example
   * ```typescript
   * const result = await cortex.artifacts.delete('art-abc123def456');
   * console.log(result.deleted); // true
   * ```
   */
  async delete(
    artifactId: string,
    hard = false,
  ): Promise<DeleteArtifactResult> {
    // Client-side validation
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.artifacts.deleteArtifact, {
            artifactId,
            tenantId: this.authContext?.tenantId,
            hard,
          }),
        "artifacts:delete",
      );

      // Remove from graph if hard delete
      if (hard) {
        await this.deleteFromGraph(artifactId);
      } else {
        await this.updateInGraph(artifactId, { isDeleted: true });
      }

      return result as DeleteArtifactResult;
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  /**
   * List artifacts with filtering
   *
   * @example
   * ```typescript
   * const artifacts = await cortex.artifacts.list({
   *   memorySpaceId: 'user-123-space',
   *   streamingState: 'final',
   *   tags: ['important'],
   *   sortBy: 'updatedAt',
   *   sortOrder: 'desc',
   *   limit: 20,
   * });
   * ```
   */
  async list(filter: ListArtifactsFilter): Promise<Artifact[]> {
    // Client-side validation
    validateListFilter(filter);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.artifacts.list, {
          memorySpaceId: filter.memorySpaceId,
          tenantId: filter.tenantId ?? this.authContext?.tenantId,
          userId: filter.userId,
          participantId: filter.participantId,
          kind: filter.kind,
          streamingState: filter.streamingState,
          tags: filter.tags,
          createdAfter: filter.createdAfter,
          createdBefore: filter.createdBefore,
          updatedAfter: filter.updatedAfter,
          updatedBefore: filter.updatedBefore,
          limit: filter.limit,
          offset: filter.offset,
          sortBy: filter.sortBy,
          sortOrder: filter.sortOrder,
          includeDeleted: filter.includeDeleted,
        }),
      "artifacts:list",
    );

    const listResult = result as { artifacts: Artifact[] };
    return listResult.artifacts;
  }

  /**
   * Count artifacts matching filter
   *
   * @example
   * ```typescript
   * const count = await cortex.artifacts.count({
   *   memorySpaceId: 'user-123-space',
   *   streamingState: 'final',
   * });
   * console.log(`${count} finalized artifacts`);
   * ```
   */
  async count(filter: CountArtifactsFilter): Promise<number> {
    // Client-side validation
    validateCountFilter(filter);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.artifacts.count, {
          memorySpaceId: filter.memorySpaceId,
          tenantId: filter.tenantId ?? this.authContext?.tenantId,
          userId: filter.userId,
          kind: filter.kind,
          streamingState: filter.streamingState,
          includeDeleted: filter.includeDeleted,
          createdAfter: filter.createdAfter,
          createdBefore: filter.createdBefore,
        }),
      "artifacts:count",
    );

    return result;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Undo/Redo Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Undo the last change to an artifact
   *
   * Restores the artifact to its previous version using the version pointer.
   * Does not delete version history - moves the pointer backward.
   *
   * @example
   * ```typescript
   * // Make changes
   * await cortex.artifacts.update('art-abc123', 'version 2 content');
   * await cortex.artifacts.update('art-abc123', 'version 3 content');
   *
   * // Undo to version 2
   * const undone = await cortex.artifacts.undo('art-abc123');
   * console.log(undone.content); // "version 2 content"
   * ```
   *
   * @throws Error if no previous version exists (UNDO_NOT_AVAILABLE)
   */
  async undo(artifactId: string): Promise<{
    success: boolean;
    artifactId: string;
    previousVersion: number;
    currentVersion: number;
    canUndo: boolean;
    canRedo: boolean;
  }> {
    // Client-side validation
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.artifacts.undo, {
            artifactId,
            tenantId: this.authContext?.tenantId,
          }),
        "artifacts:undo",
      );

      return result as {
        success: boolean;
        artifactId: string;
        previousVersion: number;
        currentVersion: number;
        canUndo: boolean;
        canRedo: boolean;
      };
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  /**
   * Redo a previously undone change
   *
   * Restores the artifact to a more recent version after undo.
   * Moves the version pointer forward.
   *
   * @example
   * ```typescript
   * // After undoing
   * await cortex.artifacts.undo('art-abc123');
   *
   * // Redo to restore
   * const redone = await cortex.artifacts.redo('art-abc123');
   * console.log(redone.content); // Back to latest version content
   * ```
   *
   * @throws Error if no newer version exists (REDO_NOT_AVAILABLE)
   */
  async redo(artifactId: string): Promise<{
    success: boolean;
    artifactId: string;
    previousVersion: number;
    currentVersion: number;
    canUndo: boolean;
    canRedo: boolean;
  }> {
    // Client-side validation
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.artifacts.redo, {
            artifactId,
            tenantId: this.authContext?.tenantId,
          }),
        "artifacts:redo",
      );

      return result as {
        success: boolean;
        artifactId: string;
        previousVersion: number;
        currentVersion: number;
        canUndo: boolean;
        canRedo: boolean;
      };
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  /**
   * Get the version history of an artifact
   *
   * @example
   * ```typescript
   * const history = await cortex.artifacts.getHistory('art-abc123');
   * for (const version of history) {
   *   console.log(`v${version.version}: ${version.changeSummary || 'No note'}`);
   * }
   * ```
   */
  async getHistory(
    artifactId: string,
    options?: GetArtifactHistoryOptions,
  ): Promise<ArtifactVersion[]> {
    // Client-side validation
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);
    if (options) {
      validateHistoryOptions(options);
    }

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.artifacts.getHistory, {
          artifactId,
          tenantId: this.authContext?.tenantId,
          limit: options?.limit,
          offset: options?.offset,
          sortOrder: options?.sortOrder,
        }),
      "artifacts:getHistory",
    );

    const historyResult = result as { history: ArtifactVersion[] } | null;
    return historyResult?.history ?? [];
  }

  /**
   * Get a specific version of an artifact
   *
   * @example
   * ```typescript
   * const v2 = await cortex.artifacts.getVersion('art-abc123', 2);
   * console.log(v2.content);
   * ```
   */
  async getVersion(
    artifactId: string,
    version: number,
  ): Promise<ArtifactVersion | null> {
    // Client-side validation
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);
    validateVersion(version);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.artifacts.getVersion, {
          artifactId,
          version,
          tenantId: this.authContext?.tenantId,
        }),
      "artifacts:getVersion",
    );

    return result as ArtifactVersion | null;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Streaming Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Start a streaming session for an artifact
   *
   * Transitions the artifact to "streaming" state and returns a session ID
   * for appending content chunks.
   *
   * @example
   * ```typescript
   * const { sessionId, artifact } = await cortex.artifacts.startStreaming({
   *   artifactId: 'art-abc123',
   * });
   *
   * // Now append content chunks...
   * await cortex.artifacts.appendContent({
   *   artifactId: 'art-abc123',
   *   sessionId,
   *   chunk: 'First chunk of content...',
   * });
   * ```
   */
  async startStreaming(params: StartStreamingParams): Promise<{
    success: boolean;
    sessionId: string;
    artifactId: string;
    startedAt: number;
    previousState: StreamingState;
    currentState: StreamingState;
  }> {
    // Client-side validation
    validateStartStreamingParams(params);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.artifacts.startStreaming, {
            artifactId: params.artifactId,
            tenantId: this.authContext?.tenantId,
          }),
        "artifacts:startStreaming",
      );

      return result as {
        success: boolean;
        sessionId: string;
        artifactId: string;
        startedAt: number;
        previousState: StreamingState;
        currentState: StreamingState;
      };
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  /**
   * Append a content chunk to a streaming artifact
   *
   * @example
   * ```typescript
   * await cortex.artifacts.appendContent({
   *   artifactId: 'art-abc123',
   *   sessionId: 'session-xyz',
   *   chunk: 'More content...',
   * });
   * ```
   */
  async appendContent(params: AppendContentParams): Promise<{
    success: boolean;
    artifactId: string;
    sessionId: string;
    chunkIndex?: number;
    chunkBytes: number;
    totalBytesReceived: number;
    contentLength: number;
    progress?: number;
    timestamp: number;
  }> {
    // Client-side validation
    validateAppendContentParams(params);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.artifacts.appendContent, {
            artifactId: params.artifactId,
            sessionId: params.sessionId,
            chunk: params.chunk,
            tenantId: this.authContext?.tenantId,
          }),
        "artifacts:appendContent",
      );

      return result as {
        success: boolean;
        artifactId: string;
        sessionId: string;
        chunkIndex?: number;
        chunkBytes: number;
        totalBytesReceived: number;
        contentLength: number;
        progress?: number;
        timestamp: number;
      };
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  /**
   * Pause an active streaming session
   *
   * Transitions the artifact to "paused" state. Can be resumed later.
   */
  async pauseStreaming(params: StreamingSessionParams): Promise<{
    success: boolean;
    artifactId: string;
    sessionId: string;
    pausedAt: number;
    previousState: string;
    currentState: string;
    bytesReceived: number;
    contentPreserved: boolean;
  }> {
    // Client-side validation
    validateArtifactId(params.artifactId);
    validateArtifactIdFormat(params.artifactId);
    validateSessionId(params.sessionId);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.artifacts.pauseStreaming, {
            artifactId: params.artifactId,
            sessionId: params.sessionId,
            tenantId: this.authContext?.tenantId,
          }),
        "artifacts:pauseStreaming",
      );

      return result as {
        success: boolean;
        artifactId: string;
        sessionId: string;
        pausedAt: number;
        previousState: string;
        currentState: string;
        bytesReceived: number;
        contentPreserved: boolean;
      };
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  /**
   * Resume a paused streaming session
   *
   * Transitions the artifact back to "streaming" state.
   */
  async resumeStreaming(params: StreamingSessionParams): Promise<{
    success: boolean;
    artifactId: string;
    sessionId: string;
    resumedAt: number;
    previousState: string;
    currentState: string;
    bytesReceived: number;
  }> {
    // Client-side validation
    validateArtifactId(params.artifactId);
    validateArtifactIdFormat(params.artifactId);
    validateSessionId(params.sessionId);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.artifacts.resumeStreaming, {
            artifactId: params.artifactId,
            sessionId: params.sessionId,
            tenantId: this.authContext?.tenantId,
          }),
        "artifacts:resumeStreaming",
      );

      return result as {
        success: boolean;
        artifactId: string;
        sessionId: string;
        resumedAt: number;
        previousState: string;
        currentState: string;
        bytesReceived: number;
      };
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  /**
   * Cancel an active streaming session
   *
   * Transitions the artifact to "draft" state and discards streaming progress.
   */
  async cancelStreaming(params: StreamingSessionParams): Promise<{
    success: boolean;
    artifactId: string;
    sessionId: string;
    cancelledAt: number;
    previousState: StreamingState;
    currentState: string;
    contentPreserved: boolean;
    bytesReceived: number;
    contentLength: number;
  }> {
    // Client-side validation
    validateArtifactId(params.artifactId);
    validateArtifactIdFormat(params.artifactId);
    validateSessionId(params.sessionId);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.artifacts.cancelStreaming, {
            artifactId: params.artifactId,
            sessionId: params.sessionId,
            tenantId: this.authContext?.tenantId,
          }),
        "artifacts:cancelStreaming",
      );

      return result as {
        success: boolean;
        artifactId: string;
        sessionId: string;
        cancelledAt: number;
        previousState: StreamingState;
        currentState: string;
        contentPreserved: boolean;
        bytesReceived: number;
        contentLength: number;
      };
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  /**
   * Finalize a streaming session
   *
   * Completes streaming and transitions the artifact to "final" state.
   * Creates a new version in the history.
   *
   * @example
   * ```typescript
   * const final = await cortex.artifacts.finalizeStreaming({
   *   artifactId: 'art-abc123',
   *   sessionId: 'session-xyz',
   *   changeSummary: 'AI-generated code completion',
   * });
   * console.log(final.streamingState); // "final"
   * ```
   */
  async finalizeStreaming(params: FinalizeStreamingParams): Promise<{
    success: boolean;
    artifactId: string;
    sessionId: string;
    finalizedAt: number;
    previousState: string;
    currentState: string;
    contentLength: number;
    bytesReceived: number;
    totalDurationMs: number;
    versionCreated: boolean;
    version: number;
  }> {
    // Client-side validation
    validateArtifactId(params.artifactId);
    validateArtifactIdFormat(params.artifactId);
    validateSessionId(params.sessionId);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.artifacts.finalizeStreaming, {
            artifactId: params.artifactId,
            sessionId: params.sessionId,
            changeSummary: params.changeSummary,
            tenantId: this.authContext?.tenantId,
          }),
        "artifacts:finalizeStreaming",
      );

      const finalizeResult = result as {
        success: boolean;
        artifactId: string;
        sessionId: string;
        finalizedAt: number;
        previousState: string;
        currentState: string;
        contentLength: number;
        bytesReceived: number;
        totalDurationMs: number;
        versionCreated: boolean;
        version: number;
      };

      // Update graph with final state
      await this.updateInGraph(params.artifactId, {
        streamingState: "final",
        version: finalizeResult.version,
        updatedAt: finalizeResult.finalizedAt,
      });

      return finalizeResult;
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Status Management
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Set the streaming state of an artifact
   *
   * Directly sets the streaming state. Use with caution - prefer the
   * streaming methods (startStreaming, finalizeStreaming) for proper
   * state transitions.
   *
   * @example
   * ```typescript
   * // Mark as error state
   * await cortex.artifacts.setStreamingState('art-abc123', 'error');
   * ```
   */
  async setStreamingState(
    artifactId: string,
    streamingState: StreamingState,
  ): Promise<{
    success: boolean;
    artifactId: string;
    previousState: StreamingState;
    currentState: StreamingState;
    updatedAt: number;
  }> {
    // Client-side validation
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);
    validateStreamingState(streamingState);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.artifacts.setStreamingState, {
            artifactId,
            streamingState,
            tenantId: this.authContext?.tenantId,
          }),
        "artifacts:setStreamingState",
      );

      const stateResult = result as {
        success: boolean;
        artifactId: string;
        previousState: StreamingState;
        currentState: StreamingState;
        updatedAt: number;
      };

      // Update graph with new state
      await this.updateInGraph(artifactId, { streamingState });

      return stateResult;
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // File Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Upload a file and attach it to an artifact
   *
   * Handles the full upload flow: generates upload URL, uploads file,
   * and attaches the reference to the artifact.
   *
   * @example
   * ```typescript
   * const artifact = await cortex.artifacts.uploadFile({
   *   artifactId: 'art-abc123',
   *   file: imageBlob,
   *   filename: 'diagram.png',
   *   mimeType: 'image/png',
   * });
   * console.log(artifact.attachedFiles.length); // 1
   * ```
   */
  async uploadFile(params: {
    artifactId: string;
    file: Blob;
    filename: string;
    mimeType: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    artifactId: string;
    fileRef: {
      storageId: string;
      mimeType: string;
      size: number;
      checksum?: string;
      originalFilename?: string;
    };
    version: number;
    updatedAt: number;
  }> {
    // Client-side validation
    validateArtifactId(params.artifactId);
    validateArtifactIdFormat(params.artifactId);

    try {
      // Step 1: Generate upload URL
      const { uploadUrl } = await this.executeWithResilience(
        () =>
          this.client.mutation(api.artifacts.generateArtifactUploadUrl, {
            artifactId: params.artifactId,
            mimeType: params.mimeType,
            filename: params.filename,
            tenantId: this.authContext?.tenantId,
          }),
        "artifacts:generateUploadUrl",
      );

      // Step 2: Upload the file
      const response = await fetch(uploadUrl as string, {
        method: "POST",
        headers: { "Content-Type": params.mimeType },
        body: params.file,
      });

      if (!response.ok) {
        throw new Error(`File upload failed: ${response.statusText}`);
      }

      // Get the storageId from the response
      const { storageId } = (await response.json()) as { storageId: string };

      // Step 3: Complete the upload with file reference
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.artifacts.completeArtifactUpload, {
            artifactId: params.artifactId,
            storageId: storageId as unknown as import("convex/values").GenericId<"_storage">,
            mimeType: params.mimeType,
            size: params.file.size,
            originalFilename: params.filename,
            tenantId: this.authContext?.tenantId,
          }),
        "artifacts:completeUpload",
      );

      return result as {
        success: boolean;
        artifactId: string;
        fileRef: {
          storageId: string;
          mimeType: string;
          size: number;
          checksum?: string;
          originalFilename?: string;
        };
        version: number;
        updatedAt: number;
      };
    } catch (error) {
      this.handleConvexError(error);
    }
  }

  /**
   * Get a signed URL for an attached file
   *
   * @example
   * ```typescript
   * const url = await cortex.artifacts.getFileUrl('art-abc123', 'file-xyz');
   * // Use url to display or download the file
   * ```
   */
  async getFileUrl(artifactId: string): Promise<string | null> {
    // Client-side validation
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);

    const result = await this.executeWithResilience(
      () =>
        this.client.query(api.artifacts.getArtifactFileUrl, {
          artifactId,
          tenantId: this.authContext?.tenantId,
        }),
      "artifacts:getFileUrl",
    );

    const fileResult = result as { url: string } | null;
    return fileResult?.url ?? null;
  }

  /**
   * Detach a file from an artifact
   *
   * Removes the file reference. The file may still exist in storage
   * depending on retention policy.
   *
   * @example
   * ```typescript
   * const artifact = await cortex.artifacts.detachFile(
   *   'art-abc123',
   *   'file-xyz789'
   * );
   * ```
   */
  async detachFile(
    artifactId: string,
    deleteFile = false,
  ): Promise<{
    success: boolean;
    artifactId: string;
    previousFileRef: {
      storageId: string;
      mimeType: string;
      size: number;
      originalFilename?: string;
    };
    fileDeleted: boolean;
    version: number;
    updatedAt: number;
  }> {
    // Client-side validation
    validateArtifactId(artifactId);
    validateArtifactIdFormat(artifactId);

    try {
      const result = await this.executeWithResilience(
        () =>
          this.client.mutation(api.artifacts.detachFile, {
            artifactId,
            deleteFile,
            tenantId: this.authContext?.tenantId,
          }),
        "artifacts:detachFile",
      );

      return result as {
        success: boolean;
        artifactId: string;
        previousFileRef: {
          storageId: string;
          mimeType: string;
          size: number;
          originalFilename?: string;
        };
        fileDeleted: boolean;
        version: number;
        updatedAt: number;
      };
    } catch (error) {
      this.handleConvexError(error);
    }
  }
}
