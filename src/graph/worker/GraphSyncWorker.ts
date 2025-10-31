/**
 * Graph Sync Worker
 *
 * Real-time graph database synchronization using Convex reactive queries.
 * Subscribes to sync queue and automatically syncs entities when queue changes.
 */

/* eslint-disable no-console */
// Console logging is intentional for sync worker monitoring and debugging

import { ConvexClient } from "convex/browser";
import type { GraphAdapter } from "../types";
import {
  syncMemoryToGraph,
  syncFactToGraph,
  syncContextToGraph,
  syncConversationToGraph,
  syncMemorySpaceToGraph,
  syncMemoryRelationships,
  syncFactRelationships,
  syncContextRelationships,
  syncConversationRelationships,
  deleteMemoryFromGraph,
  deleteFactFromGraph,
  deleteContextFromGraph,
  deleteConversationFromGraph,
  deleteMemorySpaceFromGraph,
} from "../sync";

/**
 * Sync queue item from Convex
 */
interface SyncQueueItem {
  _id: string;
  table: string;
  entityId: string;
  operation: "insert" | "update" | "delete";
  entity?: any;
  synced: boolean;
  syncedAt?: number;
  failedAttempts?: number;
  lastError?: string;
  priority?: string;
  createdAt: number;
}

/**
 * Worker configuration options
 */
export interface GraphSyncWorkerOptions {
  /** Maximum items to process per batch (default: 100) */
  batchSize?: number;

  /** Maximum retry attempts for failed syncs (default: 3) */
  retryAttempts?: number;

  /** Enable verbose logging (default: false) */
  verbose?: boolean;
}

/**
 * Sync health metrics
 */
export interface SyncHealthMetrics {
  /** Is worker running? */
  isRunning: boolean;

  /** Total items processed */
  totalProcessed: number;

  /** Items successfully synced */
  successCount: number;

  /** Items that failed */
  failureCount: number;

  /** Average sync time per item (ms) */
  avgSyncTimeMs: number;

  /** Last sync timestamp */
  lastSyncAt?: number;

  /** Current queue size (unsynced items) */
  queueSize: number;
}

/**
 * GraphSyncWorker - Real-time graph synchronization
 *
 * Uses Convex reactive queries (client.onUpdate) to automatically sync
 * entities to graph database when they're added to the sync queue.
 *
 * This is NOT polling - it's truly reactive. The callback fires
 * automatically when the query result changes.
 */
export class GraphSyncWorker {
  private client: ConvexClient;
  private adapter: GraphAdapter;
  private options: Required<GraphSyncWorkerOptions>;
  private running: boolean = false;
  private unsubscribe?: () => void;

  // Metrics
  private metrics: SyncHealthMetrics = {
    isRunning: false,
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    avgSyncTimeMs: 0,
    queueSize: 0,
  };

  private syncTimes: number[] = [];

  constructor(
    client: ConvexClient,
    adapter: GraphAdapter,
    options?: GraphSyncWorkerOptions,
  ) {
    this.client = client;
    this.adapter = adapter;
    this.options = {
      batchSize: options?.batchSize || 100,
      retryAttempts: options?.retryAttempts || 3,
      verbose: options?.verbose || false,
    };
  }

  /**
   * Start the sync worker
   *
   * Subscribes to sync queue reactively - callback fires automatically
   * when items are added to the queue!
   */
  async start(): Promise<void> {
    if (this.running) {
      if (this.options.verbose) {
        console.log("GraphSyncWorker already running");
      }
      return;
    }

    // Verify graph adapter is connected
    const connected = await this.adapter.isConnected();
    if (!connected) {
      throw new Error(
        "GraphSyncWorker: Graph adapter not connected. Call adapter.connect() first.",
      );
    }

    this.running = true;
    this.metrics.isRunning = true;

    if (this.options.verbose) {
      console.log(
        `GraphSyncWorker: Starting (batch size: ${this.options.batchSize})`,
      );
    }

    // Subscribe to sync queue reactively (NOT polling!)
    // This uses Convex's reactive query system - the callback fires
    // automatically when the query result changes
    this.unsubscribe = this.client.onUpdate(
      // Note: In a real app, import from generated API
      // For now, we'll use a type assertion
      "graphSync:getUnsyncedItems" as any,
      { limit: this.options.batchSize },
      async (items: SyncQueueItem[]) => {
        if (!this.running) return;

        this.metrics.queueSize = items.length;

        if (items.length > 0) {
          await this.processBatch(items);
        }
      },
    );

    if (this.options.verbose) {
      console.log("GraphSyncWorker: Subscribed to sync queue (reactive)");
    }
  }

  /**
   * Stop the sync worker
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.metrics.isRunning = false;

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    if (this.options.verbose) {
      console.log("GraphSyncWorker: Stopped");
      console.log("Final metrics:", this.metrics);
    }
  }

  /**
   * Get current health metrics
   */
  getMetrics(): SyncHealthMetrics {
    return { ...this.metrics };
  }

  /**
   * Process a batch of sync items
   */
  private async processBatch(items: SyncQueueItem[]): Promise<void> {
    if (this.options.verbose) {
      console.log(`GraphSyncWorker: Processing ${items.length} items`);
    }

    for (const item of items) {
      await this.processItem(item);
    }
  }

  /**
   * Process a single sync item
   */
  private async processItem(item: SyncQueueItem): Promise<void> {
    const startTime = Date.now();

    try {
      // Perform sync based on operation
      if (item.operation === "delete") {
        await this.performDelete(item);
      } else {
        await this.performSync(item);
      }

      // Mark as synced
      await this.client.mutation(
        "graphSync:markSynced" as any,
        { id: item._id },
      );

      // Update metrics
      this.metrics.totalProcessed++;
      this.metrics.successCount++;
      this.metrics.lastSyncAt = Date.now();

      const syncTime = Date.now() - startTime;
      this.syncTimes.push(syncTime);

      // Keep last 100 sync times for average
      if (this.syncTimes.length > 100) {
        this.syncTimes.shift();
      }

      this.metrics.avgSyncTimeMs =
        this.syncTimes.reduce((a, b) => a + b, 0) / this.syncTimes.length;

      if (this.options.verbose) {
        console.log(
          `GraphSyncWorker: Synced ${item.table}:${item.entityId} in ${syncTime}ms`,
        );
      }
    } catch (error) {
      // Mark as failed
      await this.client.mutation(
        "graphSync:markFailed" as any,
        {
          id: item._id,
          error: error instanceof Error ? error.message : String(error),
        },
      );

      this.metrics.totalProcessed++;
      this.metrics.failureCount++;

      if (this.options.verbose) {
        console.error(
          `GraphSyncWorker: Failed to sync ${item.table}:${item.entityId}:`,
          error,
        );
      }
    }
  }

  /**
   * Perform sync operation (insert or update)
   */
  private async performSync(item: SyncQueueItem): Promise<void> {
    if (!item.entity) {
      throw new Error("Entity data required for insert/update operations");
    }

    switch (item.table) {
      case "memories": {
        const nodeId = await syncMemoryToGraph(item.entity, this.adapter);
        await syncMemoryRelationships(item.entity, nodeId, this.adapter);
        break;
      }

      case "facts": {
        const nodeId = await syncFactToGraph(item.entity, this.adapter);
        await syncFactRelationships(item.entity, nodeId, this.adapter);
        break;
      }

      case "contexts": {
        const nodeId = await syncContextToGraph(item.entity, this.adapter);
        await syncContextRelationships(item.entity, nodeId, this.adapter);
        break;
      }

      case "conversations": {
        const nodeId = await syncConversationToGraph(item.entity, this.adapter);
        await syncConversationRelationships(
          item.entity,
          nodeId,
          this.adapter,
        );
        break;
      }

      case "memorySpaces": {
        await syncMemorySpaceToGraph(item.entity, this.adapter);
        break;
      }

      default:
        throw new Error(`Unknown table type: ${item.table}`);
    }
  }

  /**
   * Perform delete operation
   */
  private async performDelete(item: SyncQueueItem): Promise<void> {
    switch (item.table) {
      case "memories":
        await deleteMemoryFromGraph(item.entityId, this.adapter, true);
        break;

      case "facts":
        await deleteFactFromGraph(item.entityId, this.adapter, true);
        break;

      case "contexts":
        await deleteContextFromGraph(item.entityId, this.adapter, true);
        break;

      case "conversations":
        await deleteConversationFromGraph(item.entityId, this.adapter, true);
        break;

      case "memorySpaces":
        await deleteMemorySpaceFromGraph(item.entityId, this.adapter);
        break;

      default:
        throw new Error(`Unknown table type: ${item.table}`);
    }
  }
}

