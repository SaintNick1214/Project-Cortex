/**
 * Progressive Graph Synchronization
 *
 * Syncs partial memories to graph database during streaming:
 * - Creates partial nodes on stream initialization
 * - Updates node properties as content grows
 * - Finalizes nodes and relationships on completion
 * - Handles failures gracefully
 */

import type { GraphAdapter } from "../../graph/types";
import type { MemoryEntry } from "../../types";
import type { GraphSyncEvent, StreamContext } from "../../types/streaming";

/**
 * Manages progressive graph synchronization during streaming
 */
export class ProgressiveGraphSync {
  private readonly graphAdapter: GraphAdapter;
  private partialNodeId: string | null = null;
  private syncEvents: GraphSyncEvent[] = [];
  private readonly syncInterval: number;
  private lastSyncTime: number = 0;

  constructor(graphAdapter: GraphAdapter, syncInterval: number = 5000) {
    this.graphAdapter = graphAdapter;
    this.syncInterval = syncInterval;
  }

  /**
   * Initialize partial memory node in graph
   */
  async initializePartialNode(
    partialMemory: Partial<MemoryEntry> & { memoryId: string },
  ): Promise<string> {
    try {
      // Create node with streaming properties
      // Note: Using single label 'Memory' as multiple labels may not be supported
      const nodeId = await this.graphAdapter.createNode({
        label: "Memory",
        properties: {
          memoryId: partialMemory.memoryId,
          memorySpaceId: partialMemory.memorySpaceId,
          userId: partialMemory.userId,
          contentPreview: this.truncateContent(
            partialMemory.content || "",
            100,
          ),
          isPartial: true,
          isStreaming: true,
          streamStartTime: Date.now(),
          createdAt: Date.now(),
        },
      });

      this.partialNodeId = nodeId;
      this.lastSyncTime = Date.now();

      this.recordSyncEvent({
        timestamp: Date.now(),
        eventType: "node-created",
        nodeId,
        details: "Created partial memory node",
      });

      return nodeId;
    } catch (error) {
      console.warn("Failed to initialize partial graph node:", error);
      throw error;
    }
  }

  /**
   * Update partial node with current content
   */
  async updatePartialNode(
    content: string,
    context: StreamContext,
  ): Promise<void> {
    if (!this.partialNodeId) {
      return; // Not initialized
    }

    // Check if enough time has passed since last sync
    const now = Date.now();
    if (now - this.lastSyncTime < this.syncInterval) {
      return; // Too soon to sync again
    }

    try {
      await this.graphAdapter.updateNode(this.partialNodeId, {
        contentPreview: this.truncateContent(content, 100),
        contentLength: content.length,
        chunkCount: context.chunkCount,
        estimatedTokens: context.estimatedTokens,
        lastUpdatedAt: now,
      });

      this.lastSyncTime = now;

      this.recordSyncEvent({
        timestamp: now,
        eventType: "node-updated",
        nodeId: this.partialNodeId,
        details: `Updated with ${context.chunkCount} chunks, ${content.length} chars`,
      });
    } catch (error) {
      console.warn("Failed to update partial graph node:", error);
      // Don't throw - graph sync is non-critical
    }
  }

  /**
   * Finalize node when stream completes
   */
  async finalizeNode(completeMemory: MemoryEntry): Promise<void> {
    if (!this.partialNodeId) {
      return; // Not initialized
    }

    try {
      // Update node to mark as complete
      await this.graphAdapter.updateNode(this.partialNodeId, {
        contentPreview: this.truncateContent(completeMemory.content, 100),
        contentLength: completeMemory.content.length,
        isPartial: false,
        isStreaming: false,
        streamCompleteTime: Date.now(),
        importance: completeMemory.importance,
        tags: completeMemory.tags,
      });

      // Note: removeLabel and createRelationship methods not available in GraphAdapter
      // Full relationship creation should be handled by the standard graph sync flow

      this.recordSyncEvent({
        timestamp: Date.now(),
        eventType: "finalized",
        nodeId: this.partialNodeId,
        details:
          "Finalized memory node (relationships handled by standard sync)",
      });
    } catch (error) {
      console.warn("Failed to finalize graph node:", error);
      // Don't throw - best effort
    }
  }

  /**
   * Rollback/cleanup on failure
   */
  async rollback(): Promise<void> {
    if (!this.partialNodeId) {
      return;
    }

    try {
      await this.graphAdapter.deleteNode(this.partialNodeId);
      this.partialNodeId = null;
    } catch (error) {
      console.warn("Failed to rollback graph node:", error);
      // Best effort cleanup
    }
  }

  /**
   * Check if sync should happen based on interval
   */
  shouldSync(): boolean {
    if (!this.partialNodeId) {
      return false;
    }

    return Date.now() - this.lastSyncTime >= this.syncInterval;
  }

  /**
   * Get all sync events
   */
  getSyncEvents(): GraphSyncEvent[] {
    return [...this.syncEvents];
  }

  /**
   * Get the partial node ID
   */
  getPartialNodeId(): string | null {
    return this.partialNodeId;
  }

  /**
   * Record a sync event
   */
  private recordSyncEvent(event: GraphSyncEvent): void {
    this.syncEvents.push(event);
  }

  /**
   * Truncate content for preview
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    return content.substring(0, maxLength) + "...";
  }

  /**
   * Reset sync state
   */
  reset(): void {
    this.partialNodeId = null;
    this.syncEvents = [];
    this.lastSyncTime = 0;
  }
}

/**
 * Helper to create a progressive graph sync instance
 */
export function createProgressiveGraphSync(
  graphAdapter: GraphAdapter,
  syncInterval?: number,
): ProgressiveGraphSync {
  return new ProgressiveGraphSync(graphAdapter, syncInterval);
}
