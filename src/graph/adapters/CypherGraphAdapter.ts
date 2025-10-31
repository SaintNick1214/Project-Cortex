/**
 * Cypher Graph Adapter
 *
 * Implementation of GraphAdapter interface for Neo4j and Memgraph databases
 * using the Bolt protocol and Cypher query language.
 */

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
} from "../types";
import {
  GraphDatabaseError,
  GraphConnectionError,
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

  // ============================================================================
  // Connection Management
  // ============================================================================

  async connect(config: GraphConnectionConfig): Promise<void> {
    try {
      this.config = config;

      // Create driver with connection pooling
      this.driver = neo4j.driver(
        config.uri,
        neo4j.auth.basic(config.username, config.password),
        {
          maxConnectionPoolSize: config.maxConnectionPoolSize || 50,
          connectionAcquisitionTimeout:
            config.connectionTimeout || 60000, // 60 seconds
          maxTransactionRetryTime: 30000, // 30 seconds
        },
      );

      // Verify connection
      await this.driver.verifyConnectivity();

      // Detect database type (Neo4j uses elementId(), Memgraph uses id())
      await this.detectDatabaseType();
    } catch (error) {
      throw new GraphConnectionError(
        `Failed to connect to graph database: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
      this.config = null;
    }
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
   * Detect database type and set appropriate ID function
   */
  private async detectDatabaseType(): Promise<void> {
    const session = this.getSession();
    try {
      // Try elementId() - if it fails, we're on Memgraph
      await session.run("CREATE (n:__TEST__) RETURN elementId(n) as id");
      await session.run("MATCH (n:__TEST__) DELETE n");
      this.useElementId = true;
    } catch {
      // elementId() not supported, use id() instead (Memgraph)
      this.useElementId = false;
      // Clean up if test node was created
      try {
        await session.run("MATCH (n:__TEST__) DELETE n");
      } catch {
        // Ignore cleanup errors
      }
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

      return result.records[0].get("id");
    } catch (error) {
      throw this.handleError(error, `Failed to create node with label ${node.label}`);
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

      const result = await session.run(query, { id });

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
        id,
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

      await session.run(query, { id });
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
        id: record.get("id"),
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
        fromId: edge.from,
        toId: edge.to,
        properties: this.serializeProperties(edge.properties || {}),
      });

      if (result.records.length === 0) {
        throw new GraphDatabaseError(
          `Failed to create edge: nodes not found (from: ${edge.from}, to: ${edge.to})`,
        );
      }

      return result.records[0].get("id");
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

      await session.run(query, { id });
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
        id: record.get("id"),
        type,
        from: record.get("fromId"),
        to: record.get("toId"),
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

      const params: Record<string, any> = { startId: config.startId };

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
        id: record.get("id"),
        label: (record.get("labels") as string[])[0] || "Node",
        properties: this.deserializeProperties(record.get("connected").properties),
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

      const direction = config.direction || "BOTH";
      let relPattern: string;

      if (direction === "OUTGOING") {
        relPattern = `-[${relTypes}*..${config.maxHops}]->`;
      } else if (direction === "INCOMING") {
        relPattern = `<-[${relTypes}*..${config.maxHops}]-`;
      } else {
        relPattern = `-[${relTypes}*..${config.maxHops}]-`;
      }

      const idFunc = this.getIdFunction();
      const query = `
        MATCH (start), (end)
        WHERE ${idFunc}(start) = $fromId AND ${idFunc}(end) = $toId
        MATCH path = shortestPath((start)${relPattern}(end))
        RETURN path
      `;

      const result = await session.run(query, {
        fromId: config.fromId,
        toId: config.toId,
      });

      if (result.records.length === 0) {
        return null;
      }

      const pathObj = result.records[0].get("path");

      // Extract nodes from path
      const nodes: GraphNode[] = pathObj.segments.map((segment: any) => {
        const node = segment.start;
        return {
          id: node.elementId,
          label: node.labels[0] || "Node",
          properties: this.deserializeProperties(node.properties),
        };
      });

      // Add last node
      if (pathObj.segments.length > 0) {
        const lastSegment = pathObj.segments[pathObj.segments.length - 1];
        const endNode = lastSegment.end;
        nodes.push({
          id: endNode.elementId,
          label: endNode.labels[0] || "Node",
          properties: this.deserializeProperties(endNode.properties),
        });
      }

      // Extract relationships from path
      const relationships: GraphEdge[] = pathObj.segments.map((segment: any) => {
        const rel = segment.relationship;
        return {
          id: rel.elementId,
          type: rel.type,
          from: segment.start.elementId,
          to: segment.end.elementId,
          properties: this.deserializeProperties(rel.properties),
        };
      });

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
            const data = op.data as { id: string; properties: Record<string, any> };
            const idFunc = this.getIdFunction();
            await tx.run(
              `MATCH (n) WHERE ${idFunc}(n) = $id SET n += $properties`,
              {
                id: data.id,
                properties: this.serializeProperties(data.properties),
              },
            );
            break;
          }

          case "DELETE_NODE": {
            const data = op.data as { id: string };
            const idFunc = this.getIdFunction();
            await tx.run(
              `MATCH (n) WHERE ${idFunc}(n) = $id DETACH DELETE n`,
              { id: data.id },
            );
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
                fromId: edge.from,
                toId: edge.to,
                properties: this.serializeProperties(edge.properties || {}),
              },
            );
            break;
          }

          case "DELETE_EDGE": {
            const data = op.data as { id: string };
            const idFunc = this.getIdFunction();
            await tx.run(
              `MATCH ()-[r]->() WHERE ${idFunc}(r) = $id DELETE r`,
              { id: data.id },
            );
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

    const message =
      error instanceof Error ? error.message : String(error);

    throw new GraphDatabaseError(
      `${context}: ${message}`,
      undefined,
      error instanceof Error ? error : undefined,
    );
  }
}

