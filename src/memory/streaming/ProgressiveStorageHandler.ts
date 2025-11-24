/**
 * Progressive Storage Handler
 *
 * Manages partial memory updates during streaming to enable:
 * - Incremental storage as content arrives
 * - Resumability in case of failures
 * - Real-time access to in-progress memories
 * - Rollback capabilities
 */

import type { ConvexClient } from "convex/browser";
import { api } from "../../../convex-dev/_generated/api";
import type { PartialUpdate } from "../../types/streaming";

/**
 * Handles progressive storage of streaming content
 */
export class ProgressiveStorageHandler {
  private readonly client: ConvexClient;
  private readonly memorySpaceId: string;
  private readonly conversationId: string;
  private readonly userId: string;
  private readonly updateInterval: number;

  private partialMemoryId: string | null = null;
  private lastUpdateTime: number = 0;
  private updateHistory: PartialUpdate[] = [];
  private isInitialized: boolean = false;
  private isFinalized: boolean = false;

  constructor(
    client: ConvexClient,
    memorySpaceId: string,
    conversationId: string,
    userId: string,
    updateInterval: number = 3000, // Default: update every 3 seconds
  ) {
    this.client = client;
    this.memorySpaceId = memorySpaceId;
    this.conversationId = conversationId;
    this.userId = userId;
    this.updateInterval = updateInterval;
  }

  /**
   * Initialize partial memory storage
   * Creates the initial partial memory record
   */
  async initializePartialMemory(params: {
    participantId?: string;
    userMessage: string;
    importance?: number;
    tags?: string[];
  }): Promise<string> {
    if (this.isInitialized) {
      throw new Error("Partial memory already initialized");
    }

    try {
      // Create initial partial memory with placeholder content
      const result = await this.client.mutation(
        api.memories.storePartialMemory,
        {
          memorySpaceId: this.memorySpaceId,
          participantId: params.participantId,
          conversationId: this.conversationId,
          userId: this.userId,
          content: "[Streaming in progress...]",
          isPartial: true,
          metadata: {
            userMessage: params.userMessage,
            streamStartTime: Date.now(),
          },
          importance: params.importance || 50,
          tags: [...(params.tags || []), "streaming", "partial"],
        },
      );

      this.partialMemoryId = result.memoryId;
      this.isInitialized = true;
      this.lastUpdateTime = Date.now();

      return this.partialMemoryId;
    } catch (error) {
      throw new Error(
        `Failed to initialize partial memory: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Update partial memory content
   * Only updates if enough time has passed since last update
   */
  async updatePartialContent(
    content: string,
    chunkNumber: number,
    force: boolean = false,
  ): Promise<boolean> {
    if (!this.isInitialized || !this.partialMemoryId) {
      throw new Error("Partial memory not initialized");
    }

    if (this.isFinalized) {
      return false; // Already finalized, no more updates
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;

    // Only update if interval has passed or forced
    if (!force && timeSinceLastUpdate < this.updateInterval) {
      return false;
    }

    try {
      await this.client.mutation(api.memories.updatePartialMemory, {
        memoryId: this.partialMemoryId,
        content,
        metadata: {
          lastUpdateTime: now,
          currentChunk: chunkNumber,
          contentLength: content.length,
        },
      });

      this.lastUpdateTime = now;
      this.updateHistory.push({
        timestamp: now,
        memoryId: this.partialMemoryId,
        contentLength: content.length,
        chunkNumber,
      });

      return true;
    } catch (error) {
      console.warn("Failed to update partial memory:", error);
      return false;
    }
  }

  /**
   * Finalize the partial memory with complete content
   * Marks the memory as complete and removes partial flags
   */
  async finalizeMemory(
    fullContent: string,
    embedding?: number[],
  ): Promise<void> {
    if (!this.isInitialized || !this.partialMemoryId) {
      throw new Error("Partial memory not initialized");
    }

    if (this.isFinalized) {
      return; // Already finalized
    }

    try {
      await this.client.mutation(api.memories.finalizePartialMemory, {
        memoryId: this.partialMemoryId,
        content: fullContent,
        embedding,
        metadata: {
          streamCompleteTime: Date.now(),
          totalUpdates: this.updateHistory.length,
          finalContentLength: fullContent.length,
        },
      });

      this.isFinalized = true;
    } catch (error) {
      throw new Error(
        `Failed to finalize partial memory: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Rollback/delete the partial memory
   * Used when stream fails and we want to clean up
   */
  async rollback(): Promise<void> {
    if (!this.partialMemoryId) {
      return; // Nothing to rollback
    }

    try {
      await this.client.mutation(api.memories.deleteMemory, {
        memorySpaceId: this.memorySpaceId,
        memoryId: this.partialMemoryId,
      });

      this.partialMemoryId = null;
      this.isInitialized = false;
      this.isFinalized = false;
      this.updateHistory = [];
    } catch (error) {
      console.warn("Failed to rollback partial memory:", error);
      // Don't throw - best effort cleanup
    }
  }

  /**
   * Check if update should happen based on interval
   */
  shouldUpdate(): boolean {
    if (!this.isInitialized || this.isFinalized) {
      return false;
    }

    const timeSinceLastUpdate = Date.now() - this.lastUpdateTime;
    return timeSinceLastUpdate >= this.updateInterval;
  }

  /**
   * Get the partial memory ID
   */
  getPartialMemoryId(): string | null {
    return this.partialMemoryId;
  }

  /**
   * Get update history
   */
  getUpdateHistory(): PartialUpdate[] {
    return [...this.updateHistory];
  }

  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.isInitialized && !this.isFinalized;
  }

  /**
   * Check if finalized
   */
  isComplete(): boolean {
    return this.isFinalized;
  }
}

/**
 * Helper to estimate optimal update interval based on stream characteristics
 */
export function calculateOptimalUpdateInterval(
  averageChunkSize: number,
  chunksPerSecond: number,
): number {
  // If stream is very fast, update less frequently to reduce load
  if (chunksPerSecond > 10) {
    return 5000; // 5 seconds
  }

  // If stream is slow, update more frequently for better progress tracking
  if (chunksPerSecond < 1) {
    return 1000; // 1 second
  }

  // Default: 3 seconds
  return 3000;
}
