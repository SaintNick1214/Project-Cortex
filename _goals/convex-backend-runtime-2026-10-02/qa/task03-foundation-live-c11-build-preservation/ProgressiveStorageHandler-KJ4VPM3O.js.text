import {
  api
} from "./chunk-24X3JR4G.js";
import "./chunk-3RG5ZIWI.js";

// src/memory/streaming/ProgressiveStorageHandler.ts
var ProgressiveStorageHandler = class {
  client;
  memorySpaceId;
  conversationId;
  userId;
  updateInterval;
  partialMemoryId = null;
  lastUpdateTime = 0;
  updateHistory = [];
  isInitialized = false;
  isFinalized = false;
  constructor(client, memorySpaceId, conversationId, userId, updateInterval = 3e3) {
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
  async initializePartialMemory(params) {
    if (this.isInitialized) {
      throw new Error("Partial memory already initialized");
    }
    try {
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
            streamStartTime: Date.now()
          },
          importance: params.importance || 50,
          tags: [...params.tags || [], "streaming", "partial"]
        }
      );
      this.partialMemoryId = result.memoryId;
      this.isInitialized = true;
      this.lastUpdateTime = Date.now();
      return this.partialMemoryId;
    } catch (error) {
      throw new Error(
        `Failed to initialize partial memory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  /**
   * Update partial memory content
   * Only updates if enough time has passed since last update
   */
  async updatePartialContent(content, chunkNumber, force = false) {
    if (!this.isInitialized || !this.partialMemoryId) {
      throw new Error("Partial memory not initialized");
    }
    if (this.isFinalized) {
      return false;
    }
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdateTime;
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
          contentLength: content.length
        }
      });
      this.lastUpdateTime = now;
      this.updateHistory.push({
        timestamp: now,
        memoryId: this.partialMemoryId,
        contentLength: content.length,
        chunkNumber
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
  async finalizeMemory(fullContent, embedding) {
    if (!this.isInitialized || !this.partialMemoryId) {
      throw new Error("Partial memory not initialized");
    }
    if (this.isFinalized) {
      return;
    }
    try {
      await this.client.mutation(api.memories.finalizePartialMemory, {
        memoryId: this.partialMemoryId,
        content: fullContent,
        embedding,
        metadata: {
          streamCompleteTime: Date.now(),
          totalUpdates: this.updateHistory.length,
          finalContentLength: fullContent.length
        }
      });
      this.isFinalized = true;
    } catch (error) {
      throw new Error(
        `Failed to finalize partial memory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  /**
   * Rollback/delete the partial memory
   * Used when stream fails and we want to clean up
   */
  async rollback() {
    if (!this.partialMemoryId) {
      return;
    }
    try {
      await this.client.mutation(api.memories.deleteMemory, {
        memorySpaceId: this.memorySpaceId,
        memoryId: this.partialMemoryId
      });
      this.partialMemoryId = null;
      this.isInitialized = false;
      this.isFinalized = false;
      this.updateHistory = [];
    } catch (error) {
      console.warn("Failed to rollback partial memory:", error);
    }
  }
  /**
   * Check if update should happen based on interval
   */
  shouldUpdate() {
    if (!this.isInitialized || this.isFinalized) {
      return false;
    }
    const timeSinceLastUpdate = Date.now() - this.lastUpdateTime;
    return timeSinceLastUpdate >= this.updateInterval;
  }
  /**
   * Get the partial memory ID
   */
  getPartialMemoryId() {
    return this.partialMemoryId;
  }
  /**
   * Get update history
   */
  getUpdateHistory() {
    return [...this.updateHistory];
  }
  /**
   * Check if initialized
   */
  isReady() {
    return this.isInitialized && !this.isFinalized;
  }
  /**
   * Check if finalized
   */
  isComplete() {
    return this.isFinalized;
  }
};
function calculateOptimalUpdateInterval(averageChunkSize, chunksPerSecond) {
  if (chunksPerSecond > 10) {
    return 5e3;
  }
  if (chunksPerSecond < 1) {
    return 1e3;
  }
  return 3e3;
}
export {
  ProgressiveStorageHandler,
  calculateOptimalUpdateInterval
};
