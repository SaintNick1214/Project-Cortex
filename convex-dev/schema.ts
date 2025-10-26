/**
 * Cortex SDK - Convex Schema
 * 
 * Layer 1: ACID Stores
 * - conversations (Layer 1a) - Immutable conversation history
 * - immutable (Layer 1b) - Versioned immutable data
 * - mutable (Layer 1c) - Live operational data
 * 
 * Layer 2: Vector Index
 * - memories - Searchable knowledge with embeddings
 * 
 * Coordination:
 * - contexts - Hierarchical context chains
 * - agents - Agent registry (optional)
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1a: Conversations (ACID, Immutable)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  conversations: defineTable({
    // Identity
    conversationId: v.string(), // Unique ID (e.g., "conv-abc123")

    // Type: user-agent (user ↔ agent) or agent-agent (agent ↔ agent)
    type: v.union(v.literal("user-agent"), v.literal("agent-agent")),

    // Participants (based on type)
    participants: v.object({
      // user-agent conversations
      userId: v.optional(v.string()),
      agentId: v.optional(v.string()),

      // agent-agent conversations
      agentIds: v.optional(v.array(v.string())),
    }),

    // Messages (append-only, immutable)
    messages: v.array(
      v.object({
        id: v.string(), // Message ID
        role: v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
        content: v.string(),
        timestamp: v.number(),

        // Optional fields
        agentId: v.optional(v.string()), // Which agent sent this
        metadata: v.optional(v.any()), // Flexible metadata
      })
    ),

    // Statistics
    messageCount: v.number(),

    // Metadata (flexible)
    metadata: v.optional(v.any()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_conversationId", ["conversationId"]) // Unique lookup
    .index("by_type", ["type"]) // List by type
    .index("by_user", ["participants.userId"]) // User's conversations
    .index("by_agent", ["participants.agentId"]) // Agent's conversations
    .index("by_agent_user", ["participants.agentId", "participants.userId"]) // Specific pair
    .index("by_created", ["createdAt"]), // Chronological ordering

  // TODO: Add remaining tables (immutable, mutable, memories, contexts, agents)
});
