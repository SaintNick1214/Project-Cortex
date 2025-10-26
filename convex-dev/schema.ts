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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1b: Immutable Store (ACID, Versioned, Shared)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  immutable: defineTable({
    // Identity (composite key: type + id)
    type: v.string(), // Entity type: 'kb-article', 'policy', 'audit-log', 'feedback', 'user'
    id: v.string(), // Type-specific logical ID

    // Data (flexible, immutable once stored)
    data: v.any(),

    // GDPR support (optional)
    userId: v.optional(v.string()), // Links to user for cascade deletion

    // Versioning
    version: v.number(), // Current version number (starts at 1)
    previousVersions: v.array(
      v.object({
        version: v.number(),
        data: v.any(),
        timestamp: v.number(),
        metadata: v.optional(v.any()),
      })
    ),

    // Metadata (flexible)
    metadata: v.optional(
      v.object({
        publishedBy: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        importance: v.optional(v.number()),
      })
    ),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type_id", ["type", "id"]) // Unique lookup
    .index("by_type", ["type"]) // List by type
    .index("by_userId", ["userId"]) // GDPR cascade
    .index("by_created", ["createdAt"]), // Chronological

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Layer 1c: Mutable Store (ACID, No Versioning, Shared)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  mutable: defineTable({
    // Composite key: namespace + key
    namespace: v.string(), // Logical grouping: 'inventory', 'config', 'counters', etc.
    key: v.string(), // Unique key within namespace

    // Value (flexible, mutable)
    value: v.any(),

    // GDPR support (optional)
    userId: v.optional(v.string()), // Links to user for cascade deletion

    // Metadata (optional)
    metadata: v.optional(v.any()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),

    // Access tracking
    accessCount: v.number(),
    lastAccessed: v.optional(v.number()),
  })
    .index("by_namespace_key", ["namespace", "key"]) // Unique lookup
    .index("by_namespace", ["namespace"]) // List by namespace
    .index("by_userId", ["userId"]) // GDPR cascade
    .index("by_updated", ["updatedAt"]), // Recent changes

  // TODO: Add remaining tables (memories, contexts, agents)
});
