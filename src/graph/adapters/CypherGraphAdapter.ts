/**
 * Cypher Graph Adapter
 *
 * Implementation of GraphAdapter interface for Neo4j and Memgraph databases
 * using the Bolt protocol and Cypher query language.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
// Neo4j driver types use `any` extensively - these are external library limitations

import neo4j, { Driver, Session, Integer } from "neo4j-driver";
import type {
  GraphAdapter,
  GraphNode,
  GraphEdge,
  GraphQuery,
  GraphPath,
  GraphConnectionConfig,
  GraphQueryResult,
  TraversalConfig,
  ShortestPathConfig,
  GraphOperation,
  ManagedGraphTransaction,
} from "../types";
import {
  GraphDatabaseError,
  GraphConnectionError,
  GraphAuthenticationError,
  GraphQueryError,
  GraphNotFoundError,
} from "../types";

/**
 * CypherGraphAdapter - Neo4j and Memgraph compatible graph database adapter
 *
 * Supports both Neo4j Community and Memgraph using the standard Bolt protocol.
 * Can be used interchangeably by just changing the connection URI.
 */
export class CypherGraphAdapter implements GraphAdapter {
  private driver: Driver | null = null;
  private config: GraphConnectionConfig | null = null;
  private useElementId: boolean = true; // Neo4j uses elementId(), Memgraph uses id()
  private managedEngine: "neo4j" | "memgraph" | undefined;

  async managedDialect(): Promise<"neo4j" | "memgraph"> {
    if (!this.driver) throw new GraphConnectionError("Not connected to graph database");
    if (!this.managedEngine) {
      // Memgraph can implement elementId while retaining its own schema syntax. ID capability is not engine identity.
      const response = await this.managedRead("CALL dbms.components() YIELD name RETURN name");
      if (response.records.some(row => row.name === "Memgraph")) this.managedEngine = "memgraph";
      else if (response.records.some(row => row.name === "Neo4j Kernel")) this.managedEngine = "neo4j";
      else throw new GraphDatabaseError("Managed schema setup supports the verified Neo4j/Memgraph dialects only.", "GRAPH_SCHEMA_MIGRATION_REQUIRED");
    }
    return this.managedEngine;
  }

  async managedRead(cypher: string, params: Record<string, unknown> = {}): Promise<GraphQueryResult> {
    const session = this.getSession();
    const plain = (value: unknown): unknown => {
      if (neo4j.isInt(value)) {
        if (!value.inSafeRange()) throw new GraphDatabaseError("Managed numeric result is not representable.", "GRAPH_RESULT_BUDGET");
        return value.toNumber();
      }
      if (Array.isArray(value)) return value.map(plain);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
      return value;
    };
    try {
      const response = await session.run(cypher, params, {timeout:10000});
      const records = response.records.map(record => Object.fromEntries(record.keys.map(key => [String(key), plain(record.get(key))])));
      if (records.length>257 || Buffer.byteLength(JSON.stringify(records),"utf8")>1024*1024)
        throw new GraphDatabaseError("Managed read result exceeds its finite budget.","GRAPH_RESULT_BUDGET");
      return {records,count:records.length};
    } catch(error) {
      if(error instanceof GraphDatabaseError)throw error;
      const nativeCode = (error as {code?:string})?.code;
      throw Object.assign(new GraphDatabaseError("Managed graph read failed. Check the selected connection and schema.","GRAPH_READ_FAILED"),
        {nativeCode: typeof nativeCode === "string" && /^[A-Za-z0-9_.-]{1,128}$/.test(nativeCode) ? nativeCode : undefined});
    } finally { await session.close(); }
  }

  async managedTransaction<T>(operation: (transaction: ManagedGraphTransaction) => Promise<T>): Promise<T> {
    const session = this.getSession();
    const tx = session.beginTransaction({timeout: 10000});
    let committed = false, committing = false, requests = 0, parameterBytes = 0;
    const plain = (value: unknown): unknown => {
      if (neo4j.isInt(value)) {
        if (!value.inSafeRange()) throw new GraphDatabaseError("Managed graph numeric result exceeds safe integer range.", "GRAPH_RESULT_BUDGET");
        return value.toNumber();
      }
      if (Array.isArray(value)) return value.map(plain);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
      return value;
    };
    try {
      const result = await operation({query: async (cypher, params = {}) => {
        parameterBytes += Buffer.byteLength(JSON.stringify(params), "utf8");
        if (++requests > 256 || parameterBytes > 1024 * 1024)
          throw new GraphDatabaseError("Managed graph transaction request budget exceeded.", "GRAPH_TRANSACTION_BUDGET");
        // Maps stay maps for fixed SET/MERGE statements. Payloads are already canonical JSON properties.
        const response = await tx.run(cypher, params);
        const records = response.records.map((record) => Object.fromEntries(record.keys.map((key) => [String(key), plain(record.get(key))])));
        if (records.length > 257 || Buffer.byteLength(JSON.stringify(records), "utf8") > 1024 * 1024)
          throw new GraphDatabaseError("Managed graph transaction result budget exceeded.", "GRAPH_RESULT_BUDGET");
        const counters = response.summary.counters.updates();
        return {records, count: records.length, stats: {
          nodesCreated: counters.nodesCreated, nodesDeleted: counters.nodesDeleted,
          relationshipsCreated: counters.relationshipsCreated, relationshipsDeleted: counters.relationshipsDeleted,
        }};
      }});
      committing = true;
      await tx.commit();
      committed = true;
      return result;
    } catch (error) {
      if (error instanceof GraphDatabaseError) throw error;
      const code = (error as {code?: string})?.code ?? "", message = error instanceof Error ? error.message : "";
      // These are the actual A0 serialization/SourceState uniqueness refusals, not timeouts.
      const conflict = code.startsWith("Neo.TransientError.") ||
        (code.startsWith("Memgraph.TransientError.") && /serialization|conflict/i.test(message)) ||
        (code === "Memgraph.ClientError.MemgraphError.MemgraphError" &&
          /Unable to commit due to unique constraint violation on :CortexV2SourceState\(key\)/.test(message));
      throw Object.assign(new GraphDatabaseError(conflict ? "Managed graph transaction conflicted; a fresh graph-only attempt is permitted." :
        "Managed graph transaction failed; no primary mutation may be resent.",
      conflict ? "GRAPH_TRANSACTION_CONFLICT" : committing ? "GRAPH_TRANSACTION_OUTCOME_UNKNOWN" : "GRAPH_TRANSACTION_FAILED"),
        {nativeCode: /^[A-Za-z0-9_.-]{1,128}$/.test(code) ? code : undefined});
    } finally {
      if (!committed) try { await tx.rollback(); } catch { /* A failed commit can already have closed the native transaction. */ }
      await session.close();
    }
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(config: GraphConnectionConfig): Promise<void> {
    if (this.driver) throw new GraphConnectionError("Graph adapter is already connected. Disconnect before reconnecting.");
    try {
      this.config = config;

      // Create driver with connection pooling
      this.driver = neo4j.driver(
        config.uri,
        neo4j.auth.basic(config.username, config.password),
        {
          maxConnectionPoolSize: config.maxConnectionPoolSize || 50,
          connectionAcquisitionTimeout: config.connectionTimeout || 60000, // 60 seconds
          maxTransactionRetryTime: 30000, // 30 seconds
        },
      );

      // Verify connection (just checks server reachability)
      await this.driver.verifyConnectivity();

      // Verify authentication with an actual query
      // verifyConnectivity() only checks reachability, not auth
      await this.verifyAuthentication();

      // Detect database type (Neo4j uses elementId(), Memgraph uses id())
      await this.detectDatabaseType();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: string })?.code;
      try { await this.disconnect(); } catch { /* The original connection diagnosis takes priority. */ }
      throw this.createConnectionError(errorMessage, errorCode);
    }
  }

  /**
   * Create appropriate error type based on connection failure diagnosis
   */
  private createConnectionError(
    errorMessage: string,
    errorCode: string | undefined,
  ): GraphConnectionError {
    const lowerMessage = errorMessage.toLowerCase();
    // Never retain raw driver errors/cause, usernames or credential-bearing URIs.
    if (lowerMessage.includes("authentication") || lowerMessage.includes("unauthorized") ||
        lowerMessage.includes("credentials") || errorCode?.includes("Security.")) {
      return new GraphAuthenticationError(
        "Graph database authentication failed. Check the selected provider's username and password.",
        "[redacted]", "[redacted]",
      );
    }
    return new GraphConnectionError(
      "Graph database connection failed. Check the selected provider's URI, readiness and network access.",
    );
  }

  async disconnect(): Promise<void> {
    const driver = this.driver;
    this.driver = null;
    this.config = null;
    this.managedEngine = undefined;
    if (driver) await driver.close();
  }

  async isConnected(): Promise<boolean> {
    if (!this.driver) {
      return false;
    }

    try {
      await this.driver.verifyConnectivity();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify authentication by running a simple query
   *
   * verifyConnectivity() only checks if the server is reachable, not
   * if credentials are valid. This method runs a simple query to
   * verify authentication works, failing fast with a clear error
   * if credentials are invalid.
   */
  private async verifyAuthentication(): Promise<void> {
    const session = this.getSession();
    try {
      // Run a minimal query that requires authentication
      await session.run("RETURN 1 as test");
    } finally {
      await session.close();
    }
  }

  /**
   * Detect database type and set appropriate ID function
   */
  private async detectDatabaseType(): Promise<void> {
    const session = this.getSession();
    try {
      // A null argument tests parsing/capability without creating or touching nodes.
      await session.run("RETURN elementId(null) AS id");
      this.useElementId = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = (error as { code?: string })?.code;
      const unsupported = /elementid/i.test(message) &&
        /unknown function|unrecognized function|not (?:yet )?(?:supported|implemented|defined)|does not exist|doesn't exist/i.test(message) &&
        (!code || /SyntaxError|SemanticError|Unsupported/i.test(code) ||
          code === "Memgraph.ClientError.MemgraphError.MemgraphError");
      if (!unsupported) throw error;
      // Verify the fallback as well; auth/network failures must propagate.
      await session.run("RETURN id(null) AS id");
      this.useElementId = false;
    } finally {
      await session.close();
    }
  }

  /**
   * Get the appropriate ID function for the connected database
   */
  private getIdFunction(): string {
    return this.useElementId ? "elementId" : "id";
  }

  /**
   * Convert ID to appropriate type for database queries
   * Neo4j uses string IDs (elementId), Memgraph uses integer IDs (id)
   */
  private convertIdForQuery(id: string): string | number {
    return !this.useElementId ? parseInt(id, 10) : id;
  }

  // ============================================================================
  // Node Operations
  // ============================================================================

  async createNode(node: GraphNode): Promise<string> {
    const session = this.getSession();

    try {
      // Use parameterized query for security and performance
      const idFunc = this.getIdFunction();
      const query = `
        CREATE (n:${this.escapeLabel(node.label)} $properties)
        RETURN ${idFunc}(n) as id
      `;

      const result = await session.run(query, {
        properties: this.serializeProperties(node.properties),
      });

      if (result.records.length === 0) {
        throw new GraphDatabaseError("Failed to create node: no ID returned");
      }

      const idValue = result.records[0].get("id");
      // Convert Neo4j Integer to string if needed
      return typeof idValue === "object" &&
        idValue !== null &&
        "toString" in idValue
        ? idValue.toString()
        : String(idValue);
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to create node with label ${node.label}`,
      );
    } finally {
      await session.close();
    }
  }

  async mergeNode(
    node: GraphNode,
    matchProperties: Record<string, unknown>,
  ): Promise<string> {
    const session = this.getSession();

    try {
      const idFunc = this.getIdFunction();

      // Build MERGE clause with match properties
      const matchPropEntries = Object.entries(matchProperties);
      const matchPropStr = matchPropEntries
        .map(([key]) => `${key}: $match_${key}`)
        .join(", ");

      // Build SET clause for updating all other properties
      const setPropEntries = Object.entries(node.properties).filter(
        ([key]) => !(key in matchProperties),
      );
      const setClause =
        setPropEntries.length > 0
          ? `ON CREATE SET n += $createProps ON MATCH SET n += $updateProps`
          : "";

      const query = `
        MERGE (n:${this.escapeLabel(node.label)} {${matchPropStr}})
        ${setClause}
        RETURN ${idFunc}(n) as id
      `;

      // Build parameters
      const params: Record<string, unknown> = {};

      // Add match properties with prefix
      for (const [key, value] of matchPropEntries) {
        params[`match_${key}`] = this.serializeValue(value);
      }

      // Add create/update properties if there are any non-match properties
      if (setPropEntries.length > 0) {
        const extraProps = Object.fromEntries(
          setPropEntries.map(([key, value]) => [
            key,
            this.serializeValue(value),
          ]),
        );
        params.createProps = extraProps;
        params.updateProps = extraProps;
      }

      const result = await session.run(query, params);

      if (result.records.length === 0) {
        throw new GraphDatabaseError("Failed to merge node: no ID returned");
      }

      const idValue = result.records[0].get("id");
      return typeof idValue === "object" &&
        idValue !== null &&
        "toString" in idValue
        ? idValue.toString()
        : String(idValue);
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to merge node with label ${node.label}`,
      );
    } finally {
      await session.close();
    }
  }

  async getNode(id: string): Promise<GraphNode | null> {
    const session = this.getSession();

    try {
      const idFunc = this.getIdFunction();
      const query = `
        MATCH (n)
        WHERE ${idFunc}(n) = $id
        RETURN n, labels(n) as labels
      `;

      const result = await session.run(query, {
        id: this.convertIdForQuery(id),
      });

      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      const node = record.get("n");
      const labels = record.get("labels") as string[];

      return {
        id,
        label: labels[0] || "Node",
        properties: this.deserializeProperties(node.properties),
      };
    } catch (error) {
      throw this.handleError(error, `Failed to get node ${id}`);
    } finally {
      await session.close();
    }
  }

  async updateNode(id: string, properties: Record<string, any>): Promise<void> {
    const session = this.getSession();

    try {
      const idFunc = this.getIdFunction();
      const query = `
        MATCH (n)
        WHERE ${idFunc}(n) = $id
        SET n += $properties
        RETURN n
      `;

      const result = await session.run(query, {
        id: this.convertIdForQuery(id),
        properties: this.serializeProperties(properties),
      });

      if (result.records.length === 0) {
        throw new GraphNotFoundError("node", id);
      }
    } catch (error) {
      throw this.handleError(error, `Failed to update node ${id}`);
    } finally {
      await session.close();
    }
  }

  async deleteNode(id: string, detach: boolean = true): Promise<void> {
    const session = this.getSession();

    try {
      const idFunc = this.getIdFunction();
      const query = detach
        ? `
          MATCH (n)
          WHERE ${idFunc}(n) = $id
          DETACH DELETE n
        `
        : `
          MATCH (n)
          WHERE ${idFunc}(n) = $id
          DELETE n
        `;

      await session.run(query, { id: this.convertIdForQuery(id) });
    } catch (error) {
      throw this.handleError(error, `Failed to delete node ${id}`);
    } finally {
      await session.close();
    }
  }

  async findNodes(
    label: string,
    properties?: Record<string, any>,
    limit: number = 100,
  ): Promise<GraphNode[]> {
    const session = this.getSession();

    try {
      let query = `
        MATCH (n:${this.escapeLabel(label)})
      `;

      const params: Record<string, any> = {};

      if (properties && Object.keys(properties).length > 0) {
        const whereClauses: string[] = [];
        for (const [key, value] of Object.entries(properties)) {
          whereClauses.push(`n.${this.escapeProperty(key)} = $${key}`);
          params[key] = this.serializeValue(value);
        }
        query += ` WHERE ${whereClauses.join(" AND ")}`;
      }

      const idFunc = this.getIdFunction();
      query += `
        RETURN ${idFunc}(n) as id, n, labels(n) as labels
        LIMIT ${limit}
      `;

      const result = await session.run(query, params);

      return result.records.map((record) => ({
        id: String(record.get("id")),
        label: (record.get("labels") as string[])[0] || label,
        properties: this.deserializeProperties(record.get("n").properties),
      }));
    } catch (error) {
      throw this.handleError(error, `Failed to find nodes with label ${label}`);
    } finally {
      await session.close();
    }
  }

  // ============================================================================
  // Edge Operations
  // ============================================================================

  async createEdge(edge: GraphEdge): Promise<string> {
    const session = this.getSession();

    try {
      const idFunc = this.getIdFunction();
      const query = `
        MATCH (from), (to)
        WHERE ${idFunc}(from) = $fromId AND ${idFunc}(to) = $toId
        CREATE (from)-[r:${this.escapeLabel(edge.type)} $properties]->(to)
        RETURN ${idFunc}(r) as id
      `;

      const result = await session.run(query, {
        fromId: this.convertIdForQuery(edge.from),
        toId: this.convertIdForQuery(edge.to),
        properties: this.serializeProperties(edge.properties || {}),
      });

      if (result.records.length === 0) {
        throw new GraphDatabaseError(
          `Failed to create edge: nodes not found (from: ${edge.from}, to: ${edge.to})`,
        );
      }

      const idValue = result.records[0].get("id");
      // Convert Neo4j Integer to string if needed
      return typeof idValue === "object" &&
        idValue !== null &&
        "toString" in idValue
        ? idValue.toString()
        : String(idValue);
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to create edge ${edge.type} from ${edge.from} to ${edge.to}`,
      );
    } finally {
      await session.close();
    }
  }

  async deleteEdge(id: string): Promise<void> {
    const session = this.getSession();

    try {
      const idFunc = this.getIdFunction();
      const query = `
        MATCH ()-[r]->()
        WHERE ${idFunc}(r) = $id
        DELETE r
      `;

      await session.run(query, { id: this.convertIdForQuery(id) });
    } catch (error) {
      throw this.handleError(error, `Failed to delete edge ${id}`);
    } finally {
      await session.close();
    }
  }

  async findEdges(
    type: string,
    properties?: Record<string, any>,
    limit: number = 100,
  ): Promise<GraphEdge[]> {
    const session = this.getSession();

    try {
      let query = `
        MATCH (from)-[r:${this.escapeLabel(type)}]->(to)
      `;

      const params: Record<string, any> = {};

      if (properties && Object.keys(properties).length > 0) {
        const whereClauses: string[] = [];
        for (const [key, value] of Object.entries(properties)) {
          whereClauses.push(`r.${this.escapeProperty(key)} = $${key}`);
          params[key] = this.serializeValue(value);
        }
        query += ` WHERE ${whereClauses.join(" AND ")}`;
      }

      const idFunc = this.getIdFunction();
      query += `
        RETURN ${idFunc}(r) as id, r, ${idFunc}(from) as fromId, ${idFunc}(to) as toId
        LIMIT ${limit}
      `;

      const result = await session.run(query, params);

      return result.records.map((record) => ({
        id: String(record.get("id")),
        type,
        from: String(record.get("fromId")),
        to: String(record.get("toId")),
        properties: this.deserializeProperties(record.get("r").properties),
      }));
    } catch (error) {
      throw this.handleError(error, `Failed to find edges with type ${type}`);
    } finally {
      await session.close();
    }
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  async query(
    query: GraphQuery | string,
    params?: Record<string, any>,
  ): Promise<GraphQueryResult> {
    const session = this.getSession();

    try {
      const cypher = typeof query === "string" ? query : query.cypher;
      const queryParams =
        typeof query === "string"
          ? params || {}
          : { ...query.params, ...params };

      const result = await session.run(
        cypher,
        this.serializeProperties(queryParams),
      );

      // Extract records
      const records = result.records.map((record) => {
        const obj: Record<string, any> = {};
        for (const key of record.keys) {
          const keyStr = String(key);
          obj[keyStr] = this.deserializeValue(record.get(keyStr));
        }
        return obj;
      });

      // Extract statistics if available
      const stats = result.summary.counters;
      const queryStats = {
        nodesCreated: stats.updates().nodesCreated,
        nodesDeleted: stats.updates().nodesDeleted,
        relationshipsCreated: stats.updates().relationshipsCreated,
        relationshipsDeleted: stats.updates().relationshipsDeleted,
        propertiesSet: stats.updates().propertiesSet,
        labelsAdded: stats.updates().labelsAdded,
        labelsRemoved: stats.updates().labelsRemoved,
        indexesAdded: stats.updates().indexesAdded,
        constraintsAdded: stats.updates().constraintsAdded,
      };

      return {
        records,
        count: records.length,
        stats: queryStats,
      };
    } catch (error) {
      const cypherStr = typeof query === "string" ? query : query.cypher;
      throw new GraphQueryError(
        `Query failed: ${error instanceof Error ? error.message : String(error)}`,
        cypherStr,
        error instanceof Error ? error : undefined,
      );
    } finally {
      await session.close();
    }
  }

  async traverse(config: TraversalConfig): Promise<GraphNode[]> {
    const session = this.getSession();

    try {
      // Build relationship pattern
      const relTypes =
        config.relationshipTypes && config.relationshipTypes.length > 0
          ? `:${config.relationshipTypes.join("|")}`
          : "";

      const direction = config.direction || "BOTH";
      let relPattern: string;

      if (direction === "OUTGOING") {
        relPattern = `-[${relTypes}*1..${config.maxDepth}]->`;
      } else if (direction === "INCOMING") {
        relPattern = `<-[${relTypes}*1..${config.maxDepth}]-`;
      } else {
        relPattern = `-[${relTypes}*1..${config.maxDepth}]-`;
      }

      const idFunc = this.getIdFunction();
      let query = `
        MATCH (start)
        WHERE ${idFunc}(start) = $startId
        MATCH path = (start)${relPattern}(connected)
      `;

      const params: Record<string, any> = {
        startId: this.convertIdForQuery(config.startId), // FIX: Convert ID for Memgraph
      };

      if (config.filter) {
        query += ` WHERE ${config.filter}`;
        if (config.filterParams) {
          Object.assign(params, config.filterParams);
        }
      }

      query += `
        RETURN DISTINCT ${idFunc}(connected) as id, connected, labels(connected) as labels
      `;

      const result = await session.run(query, this.serializeProperties(params));

      return result.records.map((record) => ({
        id: String(record.get("id")),
        label: (record.get("labels") as string[])[0] || "Node",
        properties: this.deserializeProperties(
          record.get("connected").properties,
        ),
      }));
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to traverse from node ${config.startId}`,
      );
    } finally {
      await session.close();
    }
  }

  async findPath(config: ShortestPathConfig): Promise<GraphPath | null> {
    const session = this.getSession();

    try {
      // Build relationship pattern
      const relTypes =
        config.relationshipTypes && config.relationshipTypes.length > 0
          ? `:${config.relationshipTypes.join("|")}`
          : "";

      // Engine dialect is independent of the numeric/element ID capability.
      const memgraph = await this.managedDialect() === "memgraph";
      const expansion = memgraph ? `*BFS ..${config.maxHops}` : `*..${config.maxHops}`;
      const direction = config.direction || "BOTH";
      let relPattern: string;

      if (direction === "OUTGOING") {
        relPattern = `-[${relTypes}${expansion}]->`;
      } else if (direction === "INCOMING") {
        relPattern = `<-[${relTypes}${expansion}]-`;
      } else {
        relPattern = `-[${relTypes}${expansion}]-`;
      }

      const idFunc = this.getIdFunction();
      const query = `
        MATCH (start), (end)
        WHERE ${idFunc}(start) = $fromId AND ${idFunc}(end) = $toId
        ${memgraph ? `MATCH path = (start)${relPattern}(end)` : `MATCH path = shortestPath((start)${relPattern}(end))`}
        RETURN path
      `;

      const result = await session.run(query, {
        fromId: this.convertIdForQuery(config.fromId),
        toId: this.convertIdForQuery(config.toId),
      });

      if (result.records.length === 0) {
        return null;
      }

      const pathObj = result.records[0].get("path");

      // Extract nodes from path
      const nodes: GraphNode[] = pathObj.segments.map((segment: any) => {
        const node = segment.start;
        return {
          id: this.useElementId ? node.elementId : String(node.identity),
          label: node.labels[0] || "Node",
          properties: this.deserializeProperties(node.properties),
        };
      });

      // Add last node
      if (pathObj.segments.length > 0) {
        const lastSegment = pathObj.segments[pathObj.segments.length - 1];
        const endNode = lastSegment.end;
        nodes.push({
          id: this.useElementId ? endNode.elementId : String(endNode.identity),
          label: endNode.labels[0] || "Node",
          properties: this.deserializeProperties(endNode.properties),
        });
      }

      // Extract relationships from path
      const relationships: GraphEdge[] = pathObj.segments.map(
        (segment: any) => {
          const rel = segment.relationship;
          return {
            id: this.useElementId ? rel.elementId : String(rel.identity),
            type: rel.type,
            from: this.useElementId ? segment.start.elementId : String(segment.start.identity),
            to: this.useElementId ? segment.end.elementId : String(segment.end.identity),
            properties: this.deserializeProperties(rel.properties),
          };
        },
      );

      return {
        nodes,
        relationships,
        length: pathObj.length,
      };
    } catch (error) {
      throw this.handleError(
        error,
        `Failed to find path from ${config.fromId} to ${config.toId}`,
      );
    } finally {
      await session.close();
    }
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  async batchWrite(operations: GraphOperation[]): Promise<void> {
    const session = this.getSession();

    try {
      const tx = session.beginTransaction();

      for (const op of operations) {
        switch (op.type) {
          case "CREATE_NODE": {
            const node = op.data as GraphNode;
            const idFunc = this.getIdFunction();
            await tx.run(
              `CREATE (n:${this.escapeLabel(node.label)} $properties) RETURN ${idFunc}(n) as id`,
              { properties: this.serializeProperties(node.properties) },
            );
            break;
          }

          case "UPDATE_NODE": {
            const data = op.data as {
              id: string;
              properties: Record<string, any>;
            };
            const idFunc = this.getIdFunction();
            await tx.run(
              `MATCH (n) WHERE ${idFunc}(n) = $id SET n += $properties`,
              {
                id: this.convertIdForQuery(data.id),
                properties: this.serializeProperties(data.properties),
              },
            );
            break;
          }

          case "DELETE_NODE": {
            const data = op.data as { id: string };
            const idFunc = this.getIdFunction();
            await tx.run(`MATCH (n) WHERE ${idFunc}(n) = $id DETACH DELETE n`, {
              id: this.convertIdForQuery(data.id),
            });
            break;
          }

          case "CREATE_EDGE": {
            const edge = op.data as GraphEdge;
            const idFunc = this.getIdFunction();
            await tx.run(
              `
              MATCH (from), (to)
              WHERE ${idFunc}(from) = $fromId AND ${idFunc}(to) = $toId
              CREATE (from)-[r:${this.escapeLabel(edge.type)} $properties]->(to)
              RETURN ${idFunc}(r) as id
            `,
              {
                fromId: this.convertIdForQuery(edge.from),
                toId: this.convertIdForQuery(edge.to),
                properties: this.serializeProperties(edge.properties || {}),
              },
            );
            break;
          }

          case "DELETE_EDGE": {
            const data = op.data as { id: string };
            const idFunc = this.getIdFunction();
            await tx.run(`MATCH ()-[r]->() WHERE ${idFunc}(r) = $id DELETE r`, {
              id: this.convertIdForQuery(data.id),
            });
            break;
          }
        }
      }

      await tx.commit();
    } catch (error) {
      throw this.handleError(error, `Batch write failed`);
    } finally {
      await session.close();
    }
  }

  // ============================================================================
  // Utility Operations
  // ============================================================================

  async countNodes(label?: string): Promise<number> {
    const session = this.getSession();

    try {
      const query = label
        ? `MATCH (n:${this.escapeLabel(label)}) RETURN count(n) as count`
        : `MATCH (n) RETURN count(n) as count`;

      const result = await session.run(query);
      return this.toNumber(result.records[0].get("count"));
    } catch (error) {
      throw this.handleError(error, `Failed to count nodes`);
    } finally {
      await session.close();
    }
  }

  async countEdges(type?: string): Promise<number> {
    const session = this.getSession();

    try {
      const query = type
        ? `MATCH ()-[r:${this.escapeLabel(type)}]->() RETURN count(r) as count`
        : `MATCH ()-[r]->() RETURN count(r) as count`;

      const result = await session.run(query);
      return this.toNumber(result.records[0].get("count"));
    } catch (error) {
      throw this.handleError(error, `Failed to count edges`);
    } finally {
      await session.close();
    }
  }

  async clearDatabase(): Promise<void> {
    const session = this.getSession();

    try {
      await session.run(`MATCH (n) DETACH DELETE n`);
    } catch (error) {
      throw this.handleError(error, `Failed to clear database`);
    } finally {
      await session.close();
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private getSession(): Session {
    if (!this.driver) {
      throw new GraphConnectionError("Not connected to graph database");
    }

    return this.config?.database
      ? this.driver.session({ database: this.config.database })
      : this.driver.session();
  }

  private escapeLabel(label: string): string {
    // Remove invalid characters from label
    return label.replace(/[^a-zA-Z0-9_]/g, "_");
  }

  private escapeProperty(property: string): string {
    // Escape property name with backticks if needed
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(property)) {
      return property;
    }
    return `\`${property.replace(/`/g, "``")}\``;
  }

  private serializeValue(value: any): any {
    if (value instanceof Date) {
      return value.getTime();
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.serializeValue(v));
    }
    if (value && typeof value === "object" && !(value instanceof Integer)) {
      // Don't serialize nested objects (not supported by most graph DBs)
      return JSON.stringify(value);
    }
    return value;
  }

  private serializeProperties(
    properties: Record<string, any>,
  ): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(properties)) {
      result[key] = this.serializeValue(value);
    }
    return result;
  }

  private deserializeValue(value: any): any {
    if (value instanceof Integer) {
      return value.toNumber();
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.deserializeValue(v));
    }
    if (value && typeof value === "object") {
      // Handle Neo4j node/relationship objects
      if (value.properties) {
        return this.deserializeProperties(value.properties);
      }
      // Try to parse as JSON (for stringified objects)
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
    }
    return value;
  }

  private deserializeProperties(
    properties: Record<string, any>,
  ): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(properties)) {
      result[key] = this.deserializeValue(value);
    }
    return result;
  }

  private toNumber(value: any): number {
    if (value instanceof Integer) {
      return value.toNumber();
    }
    return Number(value);
  }

  private handleError(error: unknown, context: string): never {
    if (error instanceof GraphDatabaseError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);

    throw new GraphDatabaseError(
      `${context}: ${message}`,
      undefined,
      error instanceof Error ? error : undefined,
    );
  }
}
