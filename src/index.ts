/**
 * Cortex SDK - Main Entry Point
 *
 * Open-source SDK for AI agents with persistent memory
 * Built on Convex for reactive TypeScript queries
 */

import { ConvexClient } from "convex/browser";
import { ConversationsAPI } from "./conversations";
import { ImmutableAPI } from "./immutable";
import { MutableAPI } from "./mutable";
import { VectorAPI } from "./vector";
import { MemoryAPI } from "./memory";
import { FactsAPI } from "./facts";
import { MemorySpacesAPI } from "./memorySpaces";
import { ContextsAPI } from "./contexts";
import { UsersAPI } from "./users";
import { AgentsAPI } from "./agents";
import type { GraphAdapter } from "./graph/types";
import { GraphSyncWorker, type GraphSyncWorkerOptions } from "./graph/worker/GraphSyncWorker";

/**
 * Graph database configuration
 */
export interface GraphConfig {
  /** Pre-configured graph adapter */
  adapter: GraphAdapter;

  /** Enable orphan cleanup on deletes (default: true) */
  orphanCleanup?: boolean;

  /** Auto-start sync worker for real-time synchronization (default: false) */
  autoSync?: boolean;

  /** Sync worker configuration options */
  syncWorkerOptions?: GraphSyncWorkerOptions;
}

/**
 * Cortex SDK configuration
 */
export interface CortexConfig {
  /** Convex deployment URL */
  convexUrl: string;

  /** Optional graph database integration */
  graph?: GraphConfig;
}

export class Cortex {
  private readonly client: ConvexClient;
  private syncWorker?: GraphSyncWorker;

  // Layer 1a: Conversations
  public conversations: ConversationsAPI;

  // Layer 1b: Immutable Store
  public immutable: ImmutableAPI;

  // Layer 1c: Mutable Store
  public mutable: MutableAPI;

  // Layer 2: Vector Memory
  public vector: VectorAPI;

  // Layer 3: Facts Store
  public facts: FactsAPI;

  // Layer 4: Context Chains
  public contexts: ContextsAPI;

  // Layer 4: Memory Spaces Registry
  public memorySpaces: MemorySpacesAPI;

  // Layer 4: Memory Convenience API
  public memory: MemoryAPI;

  // Coordination: User Management
  public users: UsersAPI;

  // Coordination: Agent Registry (Optional)
  public agents: AgentsAPI;

  constructor(config: CortexConfig) {
    // Initialize Convex client
    this.client = new ConvexClient(config.convexUrl);

    // Get graph adapter if configured
    const graphAdapter = config.graph?.adapter;

    // Initialize API modules with graph adapter
    this.conversations = new ConversationsAPI(this.client, graphAdapter);
    this.immutable = new ImmutableAPI(this.client, graphAdapter);
    this.mutable = new MutableAPI(this.client, graphAdapter);
    this.vector = new VectorAPI(this.client, graphAdapter);
    this.facts = new FactsAPI(this.client, graphAdapter);
    this.contexts = new ContextsAPI(this.client, graphAdapter);
    this.memorySpaces = new MemorySpacesAPI(this.client, graphAdapter);
    this.memory = new MemoryAPI(this.client, graphAdapter);
    this.users = new UsersAPI(this.client, graphAdapter);
    this.agents = new AgentsAPI(this.client, graphAdapter);

    // Start graph sync worker if enabled
    if (config.graph?.autoSync && graphAdapter) {
      this.syncWorker = new GraphSyncWorker(
        this.client,
        graphAdapter,
        config.graph.syncWorkerOptions,
      );

      // Start worker asynchronously (don't block constructor)
      void this.syncWorker.start().catch((error) => {
        console.error("Failed to start graph sync worker:", error);
      });
    }
  }

  /**
   * Get graph sync worker (if running)
   */
  getGraphSyncWorker(): GraphSyncWorker | undefined {
    return this.syncWorker;
  }

  /**
   * Close the connection to Convex and stop graph sync worker
   */
  close(): void {
    if (this.syncWorker) {
      this.syncWorker.stop();
    }
    void this.client.close();
  }
}

// Re-export types
export type * from "./types";

// Re-export graph types and classes
export type * from "./graph/types";
export type { GraphSyncWorkerOptions, SyncHealthMetrics } from "./graph/worker/GraphSyncWorker";
export { GraphSyncWorker } from "./graph/worker/GraphSyncWorker";
