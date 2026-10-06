import "./chunk-3RG5ZIWI.js";

// src/memory/streaming/ProgressiveGraphSync.ts
var ProgressiveGraphSync = class {
  graphAdapter;
  partialNodeId = null;
  syncEvents = [];
  syncInterval;
  lastSyncTime = 0;
  constructor(graphAdapter, syncInterval = 5e3) {
    this.graphAdapter = graphAdapter;
    this.syncInterval = syncInterval;
  }
  /**
   * Initialize partial memory node in graph
   */
  async initializePartialNode(partialMemory) {
    try {
      const nodeId = await this.graphAdapter.createNode({
        label: "Memory",
        properties: {
          memoryId: partialMemory.memoryId,
          memorySpaceId: partialMemory.memorySpaceId,
          userId: partialMemory.userId,
          contentPreview: this.truncateContent(
            partialMemory.content || "",
            100
          ),
          isPartial: true,
          isStreaming: true,
          streamStartTime: Date.now(),
          createdAt: Date.now()
        }
      });
      this.partialNodeId = nodeId;
      this.lastSyncTime = Date.now();
      this.recordSyncEvent({
        timestamp: Date.now(),
        eventType: "node-created",
        nodeId,
        details: "Created partial memory node"
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
  async updatePartialNode(content, context) {
    if (!this.partialNodeId) {
      return;
    }
    const now = Date.now();
    if (now - this.lastSyncTime < this.syncInterval) {
      return;
    }
    try {
      await this.graphAdapter.updateNode(this.partialNodeId, {
        contentPreview: this.truncateContent(content, 100),
        contentLength: content.length,
        chunkCount: context.chunkCount,
        estimatedTokens: context.estimatedTokens,
        lastUpdatedAt: now
      });
      this.lastSyncTime = now;
      this.recordSyncEvent({
        timestamp: now,
        eventType: "node-updated",
        nodeId: this.partialNodeId,
        details: `Updated with ${context.chunkCount} chunks, ${content.length} chars`
      });
    } catch (error) {
      console.warn("Failed to update partial graph node:", error);
    }
  }
  /**
   * Finalize node when stream completes
   */
  async finalizeNode(completeMemory) {
    if (!this.partialNodeId) {
      return;
    }
    try {
      await this.graphAdapter.updateNode(this.partialNodeId, {
        contentPreview: this.truncateContent(completeMemory.content, 100),
        contentLength: completeMemory.content.length,
        isPartial: false,
        isStreaming: false,
        streamCompleteTime: Date.now(),
        importance: completeMemory.importance,
        tags: completeMemory.tags
      });
      this.recordSyncEvent({
        timestamp: Date.now(),
        eventType: "finalized",
        nodeId: this.partialNodeId,
        details: "Finalized memory node (relationships handled by standard sync)"
      });
    } catch (error) {
      console.warn("Failed to finalize graph node:", error);
    }
  }
  /**
   * Rollback/cleanup on failure
   */
  async rollback() {
    if (!this.partialNodeId) {
      return;
    }
    try {
      await this.graphAdapter.deleteNode(this.partialNodeId);
      this.partialNodeId = null;
    } catch (error) {
      console.warn("Failed to rollback graph node:", error);
    }
  }
  /**
   * Check if sync should happen based on interval
   */
  shouldSync() {
    if (!this.partialNodeId) {
      return false;
    }
    return Date.now() - this.lastSyncTime >= this.syncInterval;
  }
  /**
   * Get all sync events
   */
  getSyncEvents() {
    return [...this.syncEvents];
  }
  /**
   * Get the partial node ID
   */
  getPartialNodeId() {
    return this.partialNodeId;
  }
  /**
   * Record a sync event
   */
  recordSyncEvent(event) {
    this.syncEvents.push(event);
  }
  /**
   * Truncate content for preview
   */
  truncateContent(content, maxLength) {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + "...";
  }
  /**
   * Reset sync state
   */
  reset() {
    this.partialNodeId = null;
    this.syncEvents = [];
    this.lastSyncTime = 0;
  }
};
function createProgressiveGraphSync(graphAdapter, syncInterval) {
  return new ProgressiveGraphSync(graphAdapter, syncInterval);
}
export {
  ProgressiveGraphSync,
  createProgressiveGraphSync
};
