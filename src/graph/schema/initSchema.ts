/**
 * Graph Schema Initialization
 *
 * Creates constraints and indexes for optimal graph database performance
 */

import type { GraphAdapter } from "../types";
import { GraphDatabaseError } from "../types";

/**
 * Initialize graph database schema
 *
 * Creates unique constraints and performance indexes for all node types.
 * This should be run once after connecting to a new graph database.
 *
 * @example
 * ```typescript
 * const adapter = new CypherGraphAdapter();
 * await adapter.connect({ uri: 'bolt://localhost:7687', ... });
 * await initializeGraphSchema(adapter);
 * ```
 */
export async function initializeGraphSchema(
  adapter: GraphAdapter,
): Promise<void> {
  console.log("📐 Initializing graph schema...");

  try {
    // Create unique constraints (these also create indexes)
    await createUniqueConstraints(adapter);

    // Create additional performance indexes
    await createPerformanceIndexes(adapter);

    console.log("✅ Graph schema initialized successfully");
  } catch (error) {
    throw new GraphDatabaseError(
      `Failed to initialize graph schema: ${error instanceof Error ? error.message : String(error)}`,
      "SCHEMA_INIT_ERROR",
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Create unique constraints for all entity IDs
 *
 * These constraints ensure data integrity and automatically create indexes
 */
async function createUniqueConstraints(adapter: GraphAdapter): Promise<void> {
  console.log("  Creating unique constraints...");

  const constraints = [
    // MemorySpace
    {
      label: "MemorySpace",
      property: "memorySpaceId",
      name: "memory_space_id",
    },

    // Context
    {
      label: "Context",
      property: "contextId",
      name: "context_id",
    },

    // Conversation
    {
      label: "Conversation",
      property: "conversationId",
      name: "conversation_id",
    },

    // Memory
    {
      label: "Memory",
      property: "memoryId",
      name: "memory_id",
    },

    // Fact
    {
      label: "Fact",
      property: "factId",
      name: "fact_id",
    },

    // User
    {
      label: "User",
      property: "userId",
      name: "user_id",
    },

    // Participant (Hive Mode)
    {
      label: "Participant",
      property: "participantId",
      name: "participant_id",
    },

    // Entity
    {
      label: "Entity",
      property: "name",
      name: "entity_name",
    },
  ];

  for (const constraint of constraints) {
    try {
      await adapter.query({
        cypher: `
          CREATE CONSTRAINT ${constraint.name} IF NOT EXISTS
          FOR (n:${constraint.label})
          REQUIRE n.${constraint.property} IS UNIQUE
        `,
      });

      console.log(`    ✓ ${constraint.label}.${constraint.property}`);
    } catch (_error) {
      // Constraint may already exist, which is fine
      console.log(
        `    ~ ${constraint.label}.${constraint.property} (already exists)`,
      );
    }
  }
}

/**
 * Create performance indexes for frequently queried properties
 *
 * These indexes improve query performance for common access patterns
 */
async function createPerformanceIndexes(adapter: GraphAdapter): Promise<void> {
  console.log("  Creating performance indexes...");

  const indexes = [
    // Context indexes
    { label: "Context", property: "status", name: "context_status" },
    { label: "Context", property: "depth", name: "context_depth" },
    { label: "Context", property: "memorySpaceId", name: "context_memory_space" },
    { label: "Context", property: "userId", name: "context_user" },
    { label: "Context", property: "parentId", name: "context_parent" },

    // Conversation indexes
    { label: "Conversation", property: "type", name: "conversation_type" },
    {
      label: "Conversation",
      property: "memorySpaceId",
      name: "conversation_memory_space",
    },
    { label: "Conversation", property: "userId", name: "conversation_user" },

    // Memory indexes
    { label: "Memory", property: "importance", name: "memory_importance" },
    { label: "Memory", property: "sourceType", name: "memory_source_type" },
    { label: "Memory", property: "memorySpaceId", name: "memory_memory_space" },
    { label: "Memory", property: "userId", name: "memory_user" },
    { label: "Memory", property: "contentType", name: "memory_content_type" },

    // Fact indexes
    { label: "Fact", property: "factType", name: "fact_type" },
    { label: "Fact", property: "confidence", name: "fact_confidence" },
    { label: "Fact", property: "subject", name: "fact_subject" },
    { label: "Fact", property: "memorySpaceId", name: "fact_memory_space" },
    { label: "Fact", property: "sourceType", name: "fact_source_type" },

    // MemorySpace indexes
    { label: "MemorySpace", property: "type", name: "memory_space_type" },
    { label: "MemorySpace", property: "status", name: "memory_space_status" },

    // Entity indexes
    { label: "Entity", property: "type", name: "entity_type" },

    // Participant indexes (Hive Mode)
    { label: "Participant", property: "type", name: "participant_type" },
  ];

  for (const index of indexes) {
    try {
      await adapter.query({
        cypher: `
          CREATE INDEX ${index.name} IF NOT EXISTS
          FOR (n:${index.label})
          ON (n.${index.property})
        `,
      });

      console.log(`    ✓ ${index.label}.${index.property}`);
    } catch (_error) {
      // Index may already exist or not supported by the database
      console.log(
        `    ~ ${index.label}.${index.property} (already exists or not supported)`,
      );
    }
  }
}

/**
 * Verify schema is properly initialized
 *
 * Checks if all constraints and indexes are in place
 */
export async function verifyGraphSchema(adapter: GraphAdapter): Promise<{
  valid: boolean;
  constraints: string[];
  indexes: string[];
  missing: string[];
}> {
  try {
    // Query for existing constraints
    const constraintsResult = await adapter.query({
      cypher: "SHOW CONSTRAINTS",
    });

    // Query for existing indexes
    const indexesResult = await adapter.query({
      cypher: "SHOW INDEXES",
    });

    const constraints = constraintsResult.records.map((r) => r.name || "unknown");
    const indexes = indexesResult.records.map((r) => r.name || "unknown");

    // Check for required constraints
    const requiredConstraints = [
      "memory_space_id",
      "context_id",
      "conversation_id",
      "memory_id",
      "fact_id",
      "user_id",
    ];

    const missing = requiredConstraints.filter(
      (name) => !constraints.includes(name),
    );

    return {
      valid: missing.length === 0,
      constraints,
      indexes,
      missing,
    };
  } catch (error) {
    // Some graph databases may not support SHOW CONSTRAINTS/INDEXES
    console.warn("Could not verify schema (may not be supported):", error);
    return {
      valid: false,
      constraints: [],
      indexes: [],
      missing: ["verification not supported"],
    };
  }
}

/**
 * Drop all constraints and indexes
 *
 * WARNING: This removes all schema constraints and indexes!
 * Use only for testing or when resetting the database.
 */
export async function dropGraphSchema(adapter: GraphAdapter): Promise<void> {
  console.log("⚠️  Dropping graph schema (constraints and indexes)...");

  try {
    // Get all constraints
    const constraintsResult = await adapter.query({
      cypher: "SHOW CONSTRAINTS",
    });

    // Drop each constraint
    for (const record of constraintsResult.records) {
      const name = record.name;
      if (name) {
        try {
          await adapter.query({
            cypher: `DROP CONSTRAINT ${name} IF EXISTS`,
          });
          console.log(`  ✓ Dropped constraint: ${name}`);
        } catch (error) {
          console.log(`  ✗ Failed to drop constraint ${name}:`, error);
        }
      }
    }

    // Get all indexes
    const indexesResult = await adapter.query({
      cypher: "SHOW INDEXES",
    });

    // Drop each index (except constraint-backed indexes)
    for (const record of indexesResult.records) {
      const name = record.name;
      const type = record.type;

      // Skip constraint-backed indexes (they're dropped with constraints)
      if (name && type !== "UNIQUENESS") {
        try {
          await adapter.query({
            cypher: `DROP INDEX ${name} IF EXISTS`,
          });
          console.log(`  ✓ Dropped index: ${name}`);
        } catch (error) {
          console.log(`  ✗ Failed to drop index ${name}:`, error);
        }
      }
    }

    console.log("✅ Schema dropped");
  } catch (error) {
    throw new GraphDatabaseError(
      `Failed to drop graph schema: ${error instanceof Error ? error.message : String(error)}`,
      "SCHEMA_DROP_ERROR",
      error instanceof Error ? error : undefined,
    );
  }
}

