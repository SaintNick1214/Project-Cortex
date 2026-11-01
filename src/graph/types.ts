/**
 * Graph Database Integration - Type Definitions
 *
 * Defines interfaces for graph database operations, supporting Neo4j, Memgraph,
 * and other Cypher-compatible graph databases.
 */

/**
 * Graph node representation
 */
export interface GraphNode {
  /** Node label (e.g., 'Context', 'Memory', 'Fact') */
  label: string;

  /** Node properties (key-value pairs) */
  properties: Record<string, unknown>;

  /** Optional node ID (set by graph database after creation) */
  id?: string;
}

/**
 * Graph edge (relationship) representation
 */
export interface GraphEdge {
  /** Relationship type (e.g., 'CHILD_OF', 'MENTIONS', 'SENT_TO') */
  type: string;

  /** Source node ID */
  from: string;

  /** Target node ID */
  to: string;

  /** Optional relationship properties */
  properties?: Record<string, unknown>;

  /** Optional edge ID (set by graph database after creation) */
  id?: string;
}

/**
 * Cypher query with parameters
 */
export interface GraphQuery {
  /** Cypher query string */
  cypher: string;

  /** Query parameters (for parameterized queries) */
  params?: Record<string, unknown>;
}

/**
 * Path between nodes in graph
 */
export interface GraphPath {
  /** Nodes in the path */
  nodes: GraphNode[];

  /** Relationships in the path */
  relationships: GraphEdge[];

  /** Path length (number of hops) */
  length: number;
}

/**
 * Graph database connection configuration
 */
export interface GraphConnectionConfig {
  /** Bolt URI (e.g., 'bolt://localhost:7687', 'neo4j+s://cloud.neo4j.io') */
  uri: string;

  /** Username for authentication */
  username: string;

  /** Password for authentication */
  password: string;

  /** Optional database name (Neo4j 4.0+) */
  database?: string;

  /** Optional connection pool configuration */
  maxConnectionPoolSize?: number;

  /** Optional connection timeout (ms) */
  connectionTimeout?: number;
}

/**
 * Result from a graph query
 */
export interface GraphQueryResult {
  /** Records returned by the query */
  records: Record<string, unknown>[];

  /** Number of records returned */
  count: number;

  /** Optional query statistics (nodes created, relationships created, etc.) */
  stats?: QueryStatistics;
}

/**
 * Query execution statistics
 */
export interface QueryStatistics {
  /** Number of nodes created */
  nodesCreated?: number;

  /** Number of nodes deleted */
  nodesDeleted?: number;

  /** Number of relationships created */
  relationshipsCreated?: number;

  /** Number of relationships deleted */
  relationshipsDeleted?: number;

  /** Number of properties set */
  propertiesSet?: number;

  /** Number of labels added */
  labelsAdded?: number;

  /** Number of labels removed */
  labelsRemoved?: number;

  /** Number of indexes added */
  indexesAdded?: number;

  /** Number of constraints added */
  constraintsAdded?: number;
}

/**
 * Batch operation for graph write
 */
export interface GraphOperation {
  /** Operation type */
  type:
    | "CREATE_NODE"
    | "UPDATE_NODE"
    | "DELETE_NODE"
    | "CREATE_EDGE"
    | "DELETE_EDGE";

  /** Operation data */
  data:
    | GraphNode
    | GraphEdge
    | { id: string; properties?: Record<string, unknown> };
}

/**
 * Graph traversal configuration
 */
export interface TraversalConfig {
  /** Starting node ID */
  startId: string;

  /** Relationship types to follow (empty = all types) */
  relationshipTypes?: string[];

  /** Maximum depth to traverse */
  maxDepth: number;

  /** Optional direction: 'OUTGOING', 'INCOMING', or 'BOTH' */
  direction?: "OUTGOING" | "INCOMING" | "BOTH";

  /** Optional filter predicate (Cypher WHERE clause) */
  filter?: string;

  /** Optional filter parameters */
  filterParams?: Record<string, unknown>;
}

/**
 * Shortest path query configuration
 */
export interface ShortestPathConfig {
  /** Source node ID */
  fromId: string;

  /** Target node ID */
  toId: string;

  /** Maximum number of hops to search */
  maxHops: number;

  /** Optional relationship types to follow */
  relationshipTypes?: string[];

  /** Optional direction */
  direction?: "OUTGOING" | "INCOMING" | "BOTH";
}

/**
 * Graph database adapter interface
 *
 * Provides a unified interface for graph database operations,
 * supporting Neo4j, Memgraph, and other Cypher-compatible databases.
 */
export interface GraphAdapter {
  /** Capability observed by the accepted read-only elementId/id probe. */
  managedDialect?(): Promise<"neo4j" | "memgraph">;
  managedRead?(cypher: string, params?: Record<string, unknown>): Promise<GraphQueryResult>;
  /** Explicit bounded transaction; managed services supply only fixed statements. */
  managedTransaction?<T>(operation: (transaction: ManagedGraphTransaction) => Promise<T>): Promise<T>;
  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connect to the graph database
   *
   * @param config Connection configuration
   * @returns Promise that resolves when connected
   */
  connect(config: GraphConnectionConfig): Promise<void>;

  /**
   * Disconnect from the graph database
   *
   * @returns Promise that resolves when disconnected
   */
  disconnect(): Promise<void>;

  /**
   * Test the database connection
   *
   * @returns Promise that resolves to true if connected, false otherwise
   */
  isConnected(): Promise<boolean>;

  // ============================================================================
  // Node Operations
  // ============================================================================

  /**
   * Create a node in the graph
   *
   * @param node Node to create
   * @returns Promise that resolves to the created node ID
   */
  createNode(node: GraphNode): Promise<string>;

  /**
   * Merge (upsert) a node in the graph
   *
   * Uses MERGE semantics: creates if not exists, matches if exists.
   * Updates properties on existing nodes.
   * This is idempotent and safe for concurrent operations.
   *
   * @param node Node to merge
   * @param matchProperties Properties to match on (for finding existing node)
   * @returns Promise that resolves to the node ID (existing or newly created)
   */
  mergeNode(
    node: GraphNode,
    matchProperties: Record<string, unknown>,
  ): Promise<string>;

  /**
   * Get a node by ID
   *
   * @param id Node ID
   * @returns Promise that resolves to the node, or null if not found
   */
  getNode(id: string): Promise<GraphNode | null>;

  /**
   * Update a node's properties
   *
   * @param id Node ID
   * @param properties Properties to update
   * @returns Promise that resolves when updated
   */
  updateNode(id: string, properties: Record<string, unknown>): Promise<void>;

  /**
   * Delete a node
   *
   * @param id Node ID
   * @param detach If true, also deletes connected relationships
   * @returns Promise that resolves when deleted
   */
  deleteNode(id: string, detach?: boolean): Promise<void>;

  /**
   * Find nodes by label and properties
   *
   * @param label Node label
   * @param properties Properties to match
   * @param limit Maximum number of results
   * @returns Promise that resolves to matching nodes
   */
  findNodes(
    label: string,
    properties?: Record<string, unknown>,
    limit?: number,
  ): Promise<GraphNode[]>;

  // ============================================================================
  // Edge Operations
  // ============================================================================

  /**
   * Create an edge (relationship) between two nodes
   *
   * @param edge Edge to create
   * @returns Promise that resolves to the created edge ID
   */
  createEdge(edge: GraphEdge): Promise<string>;

  /**
   * Delete an edge
   *
   * @param id Edge ID
   * @returns Promise that resolves when deleted
   */
  deleteEdge(id: string): Promise<void>;

  /**
   * Find edges by type and properties
   *
   * @param type Edge type
   * @param properties Properties to match
   * @param limit Maximum number of results
   * @returns Promise that resolves to matching edges
   */
  findEdges(
    type: string,
    properties?: Record<string, unknown>,
    limit?: number,
  ): Promise<GraphEdge[]>;

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * Execute a raw Cypher query
   *
   * @param query Query object or Cypher string
   * @param params Optional query parameters
   * @returns Promise that resolves to query results
   */
  query(
    query: GraphQuery | string,
    params?: Record<string, unknown>,
  ): Promise<GraphQueryResult>;

  /**
   * Traverse the graph from a starting node
   *
   * @param config Traversal configuration
   * @returns Promise that resolves to connected nodes
   */
  traverse(config: TraversalConfig): Promise<GraphNode[]>;

  /**
   * Find the shortest path between two nodes
   *
   * @param config Shortest path configuration
   * @returns Promise that resolves to the path, or null if no path exists
   */
  findPath(config: ShortestPathConfig): Promise<GraphPath | null>;

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Execute multiple operations in a single transaction
   *
   * @param operations Array of operations to execute
   * @returns Promise that resolves when all operations complete
   */
  batchWrite(operations: GraphOperation[]): Promise<void>;

  // ============================================================================
  // Utility Operations
  // ============================================================================

  /**
   * Count nodes in the database
   *
   * @param label Optional label to filter by
   * @returns Promise that resolves to the count
   */
  countNodes(label?: string): Promise<number>;

  /**
   * Count edges in the database
   *
   * @param type Optional type to filter by
   * @returns Promise that resolves to the count
   */
  countEdges(type?: string): Promise<number>;

  /**
   * Clear all data from the database
   *
   * WARNING: This deletes all nodes and relationships!
   *
   * @returns Promise that resolves when cleared
   */
  clearDatabase(): Promise<void>;
}

export interface ManagedGraphTransaction {
  query(cypher: string, params?: Record<string, unknown>): Promise<GraphQueryResult>;
}
export type GraphKind = "Memory" | "Fact" | "Context" | "Conversation" | "MemorySpace" | "Immutable" | "Mutable" | "Artifact";
export type GraphTable = "memories" | "facts" | "contexts" | "conversations" | "memorySpaces" | "immutable" | "mutable" | "artifacts";
export interface GraphScope { tenantKnown: true; tenantId: string | null; memorySpaceId: string | null }
export interface GraphIdentity extends GraphScope {
  schemaVersion: 2; kind: GraphKind; physicalSourceId: string; key: string; tupleJson: string;
}
export interface GraphReference {
  role: string; slot: string; relationship: string; identity: GraphIdentity;
  sourceRevision: number; ownershipRevision: number; referenceGeneration: string;
}
export interface GraphDerivedNode {
  kind: "User" | "Agent" | "Participant" | "Entity"; logicalId: string; entityType?: string;
  relationship: string; properties: Record<string, unknown>;
}
export interface GraphProjection {
  identity: GraphIdentity; sourceRevision: number; properties: Record<string, unknown>;
  references: GraphReference[]; derived: GraphDerivedNode[];
  derivedRelations?: Array<{subject:{name:string;type:string};object:{name:string;type:string};predicate:string}>;
}
export interface GraphJobReceipt { id: string; generation: string; identity: GraphIdentity; sourceRevision: number }
export interface GraphJob {
  _id: string; schemaVersion: 2; table: GraphTable; identity: GraphIdentity; sourceRevision: number;
  operation: "insert" | "update" | "delete"; graphInvocationId: string; requestDigest: string;
  projectionJson?: string; projectionDigest?: string; requestJson?: string; sourceDigest?: string; suppressedJobs?: GraphJobReceipt[];
  generation: string; attemptToken: string; referenceGeneration: string; ownershipRevision: number;
  state: "pending" | "synced" | "failed" | "suppressed"; failedAttempts: number;
  projection: GraphProjection; createdAt: number; priority?: "high" | "normal" | "low";
}
export interface GraphSyncPolicy { mode: "inline" | "background" }
export interface GraphApplyResult {
  disposition: "applied" | "idempotent" | "suppressed";
  nodesCreated: number; nodesDeleted: number; relationshipsCreated: number; relationshipsDeleted: number;
  absentTargets: string[];
}
export class GraphJobUnresolved extends Error {
  readonly code = "GRAPH_JOB_UNRESOLVED";
  constructor(public readonly receipt?: GraphJobReceipt) {
    super("The original graph job is missing, expired or contradictory. Do not resend the primary mutation."); this.name = "GraphJobUnresolved";
  }
}
export class GraphPrimaryOutcomeUnknown extends Error {
  readonly code = "GRAPH_PRIMARY_OUTCOME_UNKNOWN";
  readonly outcome = "unknown";
  constructor(public readonly domain: string, public readonly scope: GraphScope,
    public readonly invocationId: string, public readonly intent: unknown, public readonly knownPhysicalSourceIds: string[] = []) {
    super("The graph-enabled primary response was lost. Its outcome is unknown; inspect and replan without automatically resending it."); this.name = "GraphPrimaryOutcomeUnknown";
  }
}
export class GraphCommittedPartial<T = unknown> extends Error {
  readonly code = "GRAPH_COMMITTED_PARTIAL"; readonly knownCommitted = true;
  constructor(public readonly primaryResult: T, public readonly jobs: GraphJobReceipt[],
    public readonly graphOutcome: "failed" | "unknown", public readonly reason: string) {
    super("Primary data committed; graph delivery or acknowledgement is incomplete. Retry only the original graph jobs."); this.name = "GraphCommittedPartial";
  }
}

/**
 * Error thrown when graph database operations fail
 */
export class GraphDatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "GraphDatabaseError";
    Object.setPrototypeOf(this, GraphDatabaseError.prototype);
  }
}

/**
 * Error thrown when connection to graph database fails
 */
export class GraphConnectionError extends GraphDatabaseError {
  constructor(message: string, cause?: Error) {
    super(message, "CONNECTION_ERROR", cause);
    this.name = "GraphConnectionError";
    Object.setPrototypeOf(this, GraphConnectionError.prototype);
  }
}

/**
 * Error thrown when graph database authentication fails
 *
 * This is a specific subclass of GraphConnectionError for auth failures,
 * allowing consumers to catch and handle authentication issues specifically.
 *
 * @example
 * ```typescript
 * try {
 *   await adapter.connect(config);
 * } catch (error) {
 *   if (error instanceof GraphAuthenticationError) {
 *     console.error("Check your NEO4J_PASSWORD in .env");
 *   }
 * }
 * ```
 */
export class GraphAuthenticationError extends GraphConnectionError {
  constructor(
    message: string,
    public readonly uri: string,
    public readonly username: string,
    cause?: Error,
  ) {
    super(message, cause);
    this.name = "GraphAuthenticationError";
    Object.setPrototypeOf(this, GraphAuthenticationError.prototype);
  }
}

/**
 * Error thrown when a graph query fails
 */
export class GraphQueryError extends GraphDatabaseError {
  constructor(
    message: string,
    public readonly query?: string,
    cause?: Error,
  ) {
    super(message, "QUERY_ERROR", cause);
    this.name = "GraphQueryError";
    Object.setPrototypeOf(this, GraphQueryError.prototype);
  }
}

/**
 * Error thrown when a node or edge is not found
 */
export class GraphNotFoundError extends GraphDatabaseError {
  constructor(resourceType: "node" | "edge" | "path", identifier: string) {
    super(`${resourceType} not found: ${identifier}`, "NOT_FOUND");
    this.name = "GraphNotFoundError";
    Object.setPrototypeOf(this, GraphNotFoundError.prototype);
  }
}
