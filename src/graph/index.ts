/**
 * Graph Database Integration Module
 *
 * Provides graph database integration for Cortex, supporting Neo4j, Memgraph,
 * and other Cypher-compatible databases.
 *
 * @module graph
 */

// Export all types
export type * from "./types";

// Export error classes
export {
  GraphDatabaseError,
  GraphConnectionError,
  GraphAuthenticationError,
  GraphQueryError,
  GraphNotFoundError,
} from "./types";

// Export adapters
export { CypherGraphAdapter } from "./adapters/CypherGraphAdapter";

// Export sync utilities
export * from "./sync";

// Export schema utilities
export {
  initializeGraphSchema,
  verifyGraphSchema,
  dropGraphSchema,
} from "./schema/initSchema";

// Export sync worker
export { GraphSyncWorker } from "./worker/GraphSyncWorker";
export type {
  GraphSyncWorkerOptions,
  SyncHealthMetrics,
} from "./worker/GraphSyncWorker";
