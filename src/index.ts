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

export interface CortexConfig {
  convexUrl: string;
}

export class Cortex {
  private readonly client: ConvexClient;

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

  constructor(config: CortexConfig) {
    // Initialize Convex client
    this.client = new ConvexClient(config.convexUrl);

    // Initialize API modules
    this.conversations = new ConversationsAPI(this.client);
    this.immutable = new ImmutableAPI(this.client);
    this.mutable = new MutableAPI(this.client);
    this.vector = new VectorAPI(this.client);
    this.facts = new FactsAPI(this.client);
    this.contexts = new ContextsAPI(this.client);
    this.memorySpaces = new MemorySpacesAPI(this.client);
    this.memory = new MemoryAPI(this.client);
  }

  /**
   * Close the connection to Convex
   */
  close(): void {
    void this.client.close();
  }
}

// Re-export types
export type * from "./types";
