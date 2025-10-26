/**
 * Cortex SDK - Main Entry Point
 * 
 * Open-source SDK for AI agents with persistent memory
 * Built on Convex for reactive TypeScript queries
 */

import { ConvexClient } from "convex/browser";
import { ConversationsAPI } from "./conversations";

export interface CortexConfig {
  convexUrl: string;
}

export class Cortex {
  private client: ConvexClient;

  // Layer 1a: Conversations
  public conversations: ConversationsAPI;

  constructor(config: CortexConfig) {
    // Initialize Convex client
    this.client = new ConvexClient(config.convexUrl);

    // Initialize API modules
    this.conversations = new ConversationsAPI(this.client);
  }

  /**
   * Close the connection to Convex
   */
  async close(): Promise<void> {
    this.client.close();
  }
}

// Re-export types
export * from "./types";

