"""
Cortex SDK - Cypher Graph Adapter

Implementation of GraphAdapter interface for Neo4j and Memgraph databases
using the Bolt protocol and Cypher query language.
"""

import json
import re
from typing import Any, Dict, List, Optional, Union

from ...types import (
    GraphConnectionConfig,
    GraphEdge,
    GraphNode,
    GraphOperation,
    GraphPath,
    GraphQuery,
    GraphQueryResult,
    QueryStatistics,
    ShortestPathConfig,
    TraversalConfig,
)
from ..errors import (
    GraphConnectionError,
    GraphDatabaseError,
    GraphNotFoundError,
    GraphQueryError,
)

# Try to import neo4j driver - it's optional
try:
    from neo4j import AsyncDriver, AsyncGraphDatabase, AsyncSession
    from neo4j.graph import Node, Path, Relationship  # noqa: F401 - Used for type hints
    HAS_NEO4J = True
except ImportError:
    HAS_NEO4J = False
    AsyncGraphDatabase = None  # type: ignore[assignment, misc]
    AsyncDriver = None  # type: ignore[assignment, misc]
    AsyncSession = None  # type: ignore[assignment, misc]


class CypherGraphAdapter:
    """
    CypherGraphAdapter - Neo4j and Memgraph compatible graph database adapter.

    Supports both Neo4j Community and Memgraph using the standard Bolt protocol.
    Can be used interchangeably by just changing the connection URI.

    Example:
        >>> adapter = CypherGraphAdapter()
        >>> await adapter.connect(GraphConnectionConfig(
        ...     uri='bolt://localhost:7687',
        ...     username='neo4j',
        ...     password='password'
        ... ))
        >>>
        >>> # Create a node
        >>> node_id = await adapter.create_node(GraphNode(
        ...     label='Person',
        ...     properties={'name': 'Alice', 'age': 30}
        ... ))
        >>>
        >>> # Query the graph
        >>> result = await adapter.query("MATCH (n:Person) RETURN n")
    """

    def __init__(self) -> None:
        """Initialize the adapter."""
        if not HAS_NEO4J:
            raise ImportError(
                "neo4j package is required for CypherGraphAdapter. "
                "Install it with: pip install neo4j"
            )
        self._driver: Optional[AsyncDriver] = None
        self._config: Optional[GraphConnectionConfig] = None
        self._use_element_id: bool = True  # Neo4j uses elementId(), Memgraph uses id()

    # ============================================================================
    # Connection Management
    # ============================================================================

    async def connect(self, config: GraphConnectionConfig) -> None:
        """
        Connect to the graph database.

        Args:
            config: Connection configuration

        Raises:
            GraphConnectionError: If connection fails
        """
        try:
            self._config = config

            # Create driver with connection pooling
            self._driver = AsyncGraphDatabase.driver(
                config.uri,
                auth=(config.username, config.password),
                max_connection_pool_size=config.max_connection_pool_size or 50,
                connection_acquisition_timeout=config.connection_timeout or 60,
            )

            # Verify connection
            await self._driver.verify_connectivity()

            # Detect database type (Neo4j uses elementId(), Memgraph uses id())
            await self._detect_database_type()

        except Exception as e:
            raise GraphConnectionError(
                f"Failed to connect to graph database: {e}",
                cause=e if isinstance(e, Exception) else None,
            )

    async def disconnect(self) -> None:
        """Disconnect from the graph database."""
        if self._driver:
            await self._driver.close()
            self._driver = None
            self._config = None

    async def is_connected(self) -> bool:
        """
        Test the database connection.

        Returns:
            True if connected, False otherwise
        """
        if not self._driver:
            return False

        try:
            await self._driver.verify_connectivity()
            return True
        except Exception:
            return False

    async def _detect_database_type(self) -> None:
        """Detect database type and set appropriate ID function."""
        session = self._get_session()
        try:
            # Try elementId() - if it fails, we're on Memgraph
            result = await session.run(
                "CREATE (n:__TEST__) RETURN elementId(n) as id"
            )
            await result.consume()
            await session.run("MATCH (n:__TEST__) DELETE n")
            self._use_element_id = True
        except Exception:
            # elementId() not supported, use id() instead (Memgraph)
            self._use_element_id = False
            # Clean up if test node was created
            try:
                await session.run("MATCH (n:__TEST__) DELETE n")
            except Exception:
                pass
        finally:
            await session.close()

    def _get_id_function(self) -> str:
        """Get the appropriate ID function for the connected database."""
        return "elementId" if self._use_element_id else "id"

    def _convert_id_for_query(self, node_id: str) -> Union[str, int]:
        """
        Convert ID to appropriate type for database queries.

        Neo4j uses string IDs (elementId), Memgraph uses integer IDs (id).
        """
        if not self._use_element_id:
            try:
                return int(node_id)
            except ValueError:
                return node_id
        return node_id

    # ============================================================================
    # Node Operations
    # ============================================================================

    async def create_node(self, node: GraphNode) -> str:
        """
        Create a node in the graph.

        Args:
            node: Node to create

        Returns:
            The created node ID

        Raises:
            GraphDatabaseError: If creation fails
        """
        session = self._get_session()

        try:
            id_func = self._get_id_function()
            query = f"""
                CREATE (n:{self._escape_label(node.label)} $properties)
                RETURN {id_func}(n) as id
            """

            result = await session.run(
                query,
                {"properties": self._serialize_properties(node.properties)},
            )
            record = await result.single()

            if not record:
                raise GraphDatabaseError("Failed to create node: no ID returned")

            return self._extract_id(record["id"])

        except Exception as e:
            raise self._handle_error(e, f"Failed to create node with label {node.label}")
        finally:
            await session.close()

    async def merge_node(
        self,
        node: GraphNode,
        match_properties: Dict[str, Any],
    ) -> str:
        """
        Merge (upsert) a node in the graph.

        Uses MERGE semantics: creates if not exists, matches if exists.
        Updates properties on existing nodes. Idempotent and safe for concurrent ops.

        Args:
            node: Node to merge
            match_properties: Properties to match on (for finding existing node)

        Returns:
            Node ID (existing or newly created)

        Raises:
            GraphDatabaseError: If merge fails
        """
        session = self._get_session()

        try:
            id_func = self._get_id_function()

            # Build MERGE clause with match properties
            match_prop_entries = list(match_properties.items())
            match_prop_str = ", ".join(
                f"{key}: $match_{key}" for key, _ in match_prop_entries
            )

            # Build SET clause for updating all other properties
            set_prop_entries = [
                (key, value)
                for key, value in node.properties.items()
                if key not in match_properties
            ]
            set_clause = (
                "ON CREATE SET n += $createProps ON MATCH SET n += $updateProps"
                if set_prop_entries
                else ""
            )

            query = f"""
                MERGE (n:{self._escape_label(node.label)} {{{match_prop_str}}})
                {set_clause}
                RETURN {id_func}(n) as id
            """

            # Build parameters
            params: Dict[str, Any] = {}

            # Add match properties with prefix
            for key, value in match_prop_entries:
                params[f"match_{key}"] = self._serialize_value(value)

            # Add create/update properties if there are any non-match properties
            if set_prop_entries:
                extra_props = {
                    key: self._serialize_value(value)
                    for key, value in set_prop_entries
                }
                params["createProps"] = extra_props
                params["updateProps"] = extra_props

            result = await session.run(query, params)
            record = await result.single()

            if not record:
                raise GraphDatabaseError("Failed to merge node: no ID returned")

            return self._extract_id(record["id"])

        except Exception as e:
            raise self._handle_error(e, f"Failed to merge node with label {node.label}")
        finally:
            await session.close()

    async def get_node(self, node_id: str) -> Optional[GraphNode]:
        """
        Get a node by ID.

        Args:
            node_id: Node ID

        Returns:
            The node, or None if not found
        """
        session = self._get_session()

        try:
            id_func = self._get_id_function()
            query = f"""
                MATCH (n)
                WHERE {id_func}(n) = $id
                RETURN n, labels(n) as labels
            """

            result = await session.run(
                query,
                {"id": self._convert_id_for_query(node_id)},
            )
            record = await result.single()

            if not record:
                return None

            neo_node = record["n"]
            labels = record["labels"]

            return GraphNode(
                id=node_id,
                label=labels[0] if labels else "Node",
                properties=self._deserialize_properties(dict(neo_node)),
            )

        except Exception as e:
            raise self._handle_error(e, f"Failed to get node {node_id}")
        finally:
            await session.close()

    async def update_node(self, node_id: str, properties: Dict[str, Any]) -> None:
        """
        Update a node's properties.

        Args:
            node_id: Node ID
            properties: Properties to update

        Raises:
            GraphNotFoundError: If node not found
        """
        session = self._get_session()

        try:
            id_func = self._get_id_function()
            query = f"""
                MATCH (n)
                WHERE {id_func}(n) = $id
                SET n += $properties
                RETURN n
            """

            result = await session.run(
                query,
                {
                    "id": self._convert_id_for_query(node_id),
                    "properties": self._serialize_properties(properties),
                },
            )
            record = await result.single()

            if not record:
                raise GraphNotFoundError("node", node_id)

        except GraphNotFoundError:
            raise
        except Exception as e:
            raise self._handle_error(e, f"Failed to update node {node_id}")
        finally:
            await session.close()

    async def delete_node(self, node_id: str, detach: bool = True) -> None:
        """
        Delete a node.

        Args:
            node_id: Node ID
            detach: If True, also deletes connected relationships
        """
        session = self._get_session()

        try:
            id_func = self._get_id_function()
            delete_clause = "DETACH DELETE n" if detach else "DELETE n"
            query = f"""
                MATCH (n)
                WHERE {id_func}(n) = $id
                {delete_clause}
            """

            await session.run(
                query,
                {"id": self._convert_id_for_query(node_id)},
            )

        except Exception as e:
            raise self._handle_error(e, f"Failed to delete node {node_id}")
        finally:
            await session.close()

    async def find_nodes(
        self,
        label: str,
        properties: Optional[Dict[str, Any]] = None,
        limit: int = 100,
    ) -> List[GraphNode]:
        """
        Find nodes by label and properties.

        Args:
            label: Node label
            properties: Properties to match
            limit: Maximum number of results

        Returns:
            List of matching nodes
        """
        session = self._get_session()

        try:
            query = f"MATCH (n:{self._escape_label(label)})"
            params: Dict[str, Any] = {}

            if properties:
                where_clauses = []
                for key, value in properties.items():
                    where_clauses.append(f"n.{self._escape_property(key)} = ${key}")
                    params[key] = self._serialize_value(value)
                query += f" WHERE {' AND '.join(where_clauses)}"

            id_func = self._get_id_function()
            query += f"""
                RETURN {id_func}(n) as id, n, labels(n) as labels
                LIMIT {limit}
            """

            result = await session.run(query, params)
            records = await result.data()

            return [
                GraphNode(
                    id=self._extract_id(record["id"]),
                    label=record["labels"][0] if record["labels"] else label,
                    properties=self._deserialize_properties(dict(record["n"])),
                )
                for record in records
            ]

        except Exception as e:
            raise self._handle_error(e, f"Failed to find nodes with label {label}")
        finally:
            await session.close()

    # ============================================================================
    # Edge Operations
    # ============================================================================

    async def create_edge(self, edge: GraphEdge) -> str:
        """
        Create an edge (relationship) between two nodes.

        Args:
            edge: Edge to create

        Returns:
            The created edge ID

        Raises:
            GraphDatabaseError: If creation fails
        """
        session = self._get_session()

        try:
            id_func = self._get_id_function()
            query = f"""
                MATCH (from), (to)
                WHERE {id_func}(from) = $fromId AND {id_func}(to) = $toId
                CREATE (from)-[r:{self._escape_label(edge.type)} $properties]->(to)
                RETURN {id_func}(r) as id
            """

            result = await session.run(
                query,
                {
                    "fromId": self._convert_id_for_query(edge.from_node),
                    "toId": self._convert_id_for_query(edge.to_node),
                    "properties": self._serialize_properties(edge.properties or {}),
                },
            )
            record = await result.single()

            if not record:
                raise GraphDatabaseError(
                    f"Failed to create edge: nodes not found (from: {edge.from_node}, to: {edge.to_node})"
                )

            return self._extract_id(record["id"])

        except Exception as e:
            raise self._handle_error(
                e,
                f"Failed to create edge {edge.type} from {edge.from_node} to {edge.to_node}",
            )
        finally:
            await session.close()

    async def delete_edge(self, edge_id: str) -> None:
        """
        Delete an edge.

        Args:
            edge_id: Edge ID
        """
        session = self._get_session()

        try:
            id_func = self._get_id_function()
            query = f"""
                MATCH ()-[r]->()
                WHERE {id_func}(r) = $id
                DELETE r
            """

            await session.run(
                query,
                {"id": self._convert_id_for_query(edge_id)},
            )

        except Exception as e:
            raise self._handle_error(e, f"Failed to delete edge {edge_id}")
        finally:
            await session.close()

    async def find_edges(
        self,
        edge_type: str,
        properties: Optional[Dict[str, Any]] = None,
        limit: int = 100,
    ) -> List[GraphEdge]:
        """
        Find edges by type and properties.

        Args:
            edge_type: Edge type
            properties: Properties to match
            limit: Maximum number of results

        Returns:
            List of matching edges
        """
        session = self._get_session()

        try:
            query = f"MATCH (from)-[r:{self._escape_label(edge_type)}]->(to)"
            params: Dict[str, Any] = {}

            if properties:
                where_clauses = []
                for key, value in properties.items():
                    where_clauses.append(f"r.{self._escape_property(key)} = ${key}")
                    params[key] = self._serialize_value(value)
                query += f" WHERE {' AND '.join(where_clauses)}"

            id_func = self._get_id_function()
            query += f"""
                RETURN {id_func}(r) as id, r, {id_func}(from) as fromId, {id_func}(to) as toId
                LIMIT {limit}
            """

            result = await session.run(query, params)
            records = await result.data()

            return [
                GraphEdge(
                    id=self._extract_id(record["id"]),
                    type=edge_type,
                    from_node=self._extract_id(record["fromId"]),
                    to_node=self._extract_id(record["toId"]),
                    properties=self._deserialize_properties(dict(record["r"])),
                )
                for record in records
            ]

        except Exception as e:
            raise self._handle_error(e, f"Failed to find edges with type {edge_type}")
        finally:
            await session.close()

    # ============================================================================
    # Query Operations
    # ============================================================================

    async def query(
        self,
        query: Union[GraphQuery, str],
        params: Optional[Dict[str, Any]] = None,
    ) -> GraphQueryResult:
        """
        Execute a raw Cypher query.

        Args:
            query: Query object or Cypher string
            params: Optional query parameters

        Returns:
            Query results
        """
        session = self._get_session()

        try:
            cypher = query.cypher if isinstance(query, GraphQuery) else query
            query_params = (
                {**(query.params or {}), **(params or {})}
                if isinstance(query, GraphQuery)
                else (params or {})
            )

            result = await session.run(
                cypher,
                self._serialize_properties(query_params),
            )

            # Extract records
            records_data = await result.data()
            records = [
                {key: self._deserialize_value(value) for key, value in record.items()}
                for record in records_data
            ]

            # Extract statistics
            summary = await result.consume()
            counters = summary.counters
            stats = QueryStatistics(
                nodes_created=counters.nodes_created,
                nodes_deleted=counters.nodes_deleted,
                relationships_created=counters.relationships_created,
                relationships_deleted=counters.relationships_deleted,
                properties_set=counters.properties_set,
                labels_added=counters.labels_added,
            )

            return GraphQueryResult(
                records=records,
                count=len(records),
                stats=stats,
            )

        except Exception as e:
            cypher_str = query.cypher if isinstance(query, GraphQuery) else query
            raise GraphQueryError(
                f"Query failed: {e}",
                query=cypher_str,
                cause=e if isinstance(e, Exception) else None,
            )
        finally:
            await session.close()

    async def traverse(self, config: TraversalConfig) -> List[GraphNode]:
        """
        Traverse the graph from a starting node.

        Args:
            config: Traversal configuration

        Returns:
            List of connected nodes
        """
        session = self._get_session()

        try:
            # Build relationship pattern
            rel_types = (
                f":{':'.join(config.relationship_types)}"
                if config.relationship_types
                else ""
            )

            direction = config.direction or "BOTH"
            if direction == "OUTGOING":
                rel_pattern = f"-[{rel_types}*1..{config.max_depth}]->"
            elif direction == "INCOMING":
                rel_pattern = f"<-[{rel_types}*1..{config.max_depth}]-"
            else:
                rel_pattern = f"-[{rel_types}*1..{config.max_depth}]-"

            id_func = self._get_id_function()
            query = f"""
                MATCH (start)
                WHERE {id_func}(start) = $startId
                MATCH path = (start){rel_pattern}(connected)
                RETURN DISTINCT {id_func}(connected) as id, connected, labels(connected) as labels
            """

            params: Dict[str, Any] = {
                "startId": self._convert_id_for_query(config.start_id),
            }

            result = await session.run(query, self._serialize_properties(params))
            records = await result.data()

            return [
                GraphNode(
                    id=self._extract_id(record["id"]),
                    label=record["labels"][0] if record["labels"] else "Node",
                    properties=self._deserialize_properties(dict(record["connected"])),
                )
                for record in records
            ]

        except Exception as e:
            raise self._handle_error(
                e, f"Failed to traverse from node {config.start_id}"
            )
        finally:
            await session.close()

    async def find_path(self, config: ShortestPathConfig) -> Optional[GraphPath]:
        """
        Find the shortest path between two nodes.

        Args:
            config: Shortest path configuration

        Returns:
            The path, or None if no path exists
        """
        session = self._get_session()

        try:
            # Build relationship pattern (undirected for shortest path)
            rel_types = (
                f":{':'.join(config.relationship_types)}"
                if config.relationship_types
                else ""
            )

            # Default to undirected (BOTH) traversal for shortest path
            rel_pattern = f"-[{rel_types}*..{config.max_hops}]-"

            id_func = self._get_id_function()
            query = f"""
                MATCH (start), (end)
                WHERE {id_func}(start) = $fromId AND {id_func}(end) = $toId
                MATCH path = shortestPath((start){rel_pattern}(end))
                RETURN path
            """

            result = await session.run(
                query,
                {
                    "fromId": self._convert_id_for_query(config.from_id),
                    "toId": self._convert_id_for_query(config.to_id),
                },
            )
            record = await result.single()

            if not record:
                return None

            path_obj = record["path"]
            nodes: List[GraphNode] = []
            relationships: List[GraphEdge] = []

            # Extract nodes and relationships from path
            for node in path_obj.nodes:
                nodes.append(
                    GraphNode(
                        id=self._extract_id(
                            node.element_id if hasattr(node, "element_id") else node.id
                        ),
                        label=list(node.labels)[0] if node.labels else "Node",
                        properties=self._deserialize_properties(dict(node)),
                    )
                )

            for rel in path_obj.relationships:
                relationships.append(
                    GraphEdge(
                        id=self._extract_id(
                            rel.element_id if hasattr(rel, "element_id") else rel.id
                        ),
                        type=rel.type,
                        from_node=self._extract_id(
                            rel.start_node.element_id
                            if hasattr(rel.start_node, "element_id")
                            else rel.start_node.id
                        ),
                        to_node=self._extract_id(
                            rel.end_node.element_id
                            if hasattr(rel.end_node, "element_id")
                            else rel.end_node.id
                        ),
                        properties=self._deserialize_properties(dict(rel)),
                    )
                )

            return GraphPath(
                nodes=nodes,
                relationships=relationships,
                length=len(relationships),
            )

        except Exception as e:
            raise self._handle_error(
                e, f"Failed to find path from {config.from_id} to {config.to_id}"
            )
        finally:
            await session.close()

    # ============================================================================
    # Batch Operations
    # ============================================================================

    async def batch_write(self, operations: List[GraphOperation]) -> None:
        """
        Execute multiple operations in a single transaction.

        Args:
            operations: Array of operations to execute

        Raises:
            GraphDatabaseError: If batch write fails
        """
        session = self._get_session()

        try:
            tx = await session.begin_transaction()

            try:
                for op in operations:
                    id_func = self._get_id_function()

                    if op.operation == "CREATE_NODE":
                        await tx.run(
                            f"CREATE (n:{self._escape_label(op.node_type or 'Node')} $properties) "
                            f"RETURN {id_func}(n) as id",
                            {"properties": self._serialize_properties(op.properties or {})},
                        )

                    elif op.operation == "UPDATE_NODE":
                        await tx.run(
                            f"MATCH (n) WHERE {id_func}(n) = $id SET n += $properties",
                            {
                                "id": self._convert_id_for_query(op.node_id or ""),
                                "properties": self._serialize_properties(op.properties or {}),
                            },
                        )

                    elif op.operation == "DELETE_NODE":
                        await tx.run(
                            f"MATCH (n) WHERE {id_func}(n) = $id DETACH DELETE n",
                            {"id": self._convert_id_for_query(op.node_id or "")},
                        )

                    elif op.operation == "CREATE_EDGE":
                        await tx.run(
                            f"""
                            MATCH (from), (to)
                            WHERE {id_func}(from) = $fromId AND {id_func}(to) = $toId
                            CREATE (from)-[r:{self._escape_label(op.edge_type or 'RELATES_TO')} $properties]->(to)
                            RETURN {id_func}(r) as id
                            """,
                            {
                                "fromId": self._convert_id_for_query(op.source_id or ""),
                                "toId": self._convert_id_for_query(op.target_id or ""),
                                "properties": self._serialize_properties(op.properties or {}),
                            },
                        )

                    elif op.operation == "DELETE_EDGE":
                        await tx.run(
                            f"MATCH ()-[r]->() WHERE {id_func}(r) = $id DELETE r",
                            {"id": self._convert_id_for_query(op.node_id or "")},
                        )

                await tx.commit()

            except Exception:
                await tx.rollback()
                raise

        except Exception as e:
            raise self._handle_error(e, "Batch write failed")
        finally:
            await session.close()

    # ============================================================================
    # Utility Operations
    # ============================================================================

    async def count_nodes(self, label: Optional[str] = None) -> int:
        """
        Count nodes in the database.

        Args:
            label: Optional label to filter by

        Returns:
            The count
        """
        session = self._get_session()

        try:
            query = (
                f"MATCH (n:{self._escape_label(label)}) RETURN count(n) as count"
                if label
                else "MATCH (n) RETURN count(n) as count"
            )

            result = await session.run(query)
            record = await result.single()
            if record is None:
                return 0
            return int(record["count"])

        except Exception as e:
            raise self._handle_error(e, "Failed to count nodes")
        finally:
            await session.close()

    async def count_edges(self, edge_type: Optional[str] = None) -> int:
        """
        Count edges in the database.

        Args:
            edge_type: Optional type to filter by

        Returns:
            The count
        """
        session = self._get_session()

        try:
            query = (
                f"MATCH ()-[r:{self._escape_label(edge_type)}]->() RETURN count(r) as count"
                if edge_type
                else "MATCH ()-[r]->() RETURN count(r) as count"
            )

            result = await session.run(query)
            record = await result.single()
            if record is None:
                return 0
            return int(record["count"])

        except Exception as e:
            raise self._handle_error(e, "Failed to count edges")
        finally:
            await session.close()

    async def clear_database(self) -> None:
        """
        Clear all data from the database.

        WARNING: This deletes all nodes and relationships!
        """
        session = self._get_session()

        try:
            await session.run("MATCH (n) DETACH DELETE n")

        except Exception as e:
            raise self._handle_error(e, "Failed to clear database")
        finally:
            await session.close()

    # ============================================================================
    # Private Helper Methods
    # ============================================================================

    def _get_session(self) -> AsyncSession:
        """Get a database session."""
        if not self._driver:
            raise GraphConnectionError("Not connected to graph database")

        return (
            self._driver.session(database=self._config.database)
            if self._config and self._config.database
            else self._driver.session()
        )

    def _escape_label(self, label: str) -> str:
        """Remove invalid characters from label."""
        return re.sub(r"[^a-zA-Z0-9_]", "_", label)

    def _escape_property(self, prop: str) -> str:
        """Escape property name with backticks if needed."""
        if re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", prop):
            return prop
        return f"`{prop.replace('`', '``')}`"

    def _serialize_value(self, value: Any) -> Any:
        """Serialize a value for storage."""
        if value is None:
            return None
        if isinstance(value, (int, float, str, bool)):
            return value
        if isinstance(value, list):
            return [self._serialize_value(v) for v in value]
        if isinstance(value, dict):
            return json.dumps(value)
        return str(value)

    def _serialize_properties(self, properties: Dict[str, Any]) -> Dict[str, Any]:
        """Serialize all properties."""
        return {key: self._serialize_value(value) for key, value in properties.items()}

    def _deserialize_value(self, value: Any) -> Any:
        """Deserialize a value from storage."""
        if value is None:
            return None
        if isinstance(value, list):
            return [self._deserialize_value(v) for v in value]
        if isinstance(value, str):
            # Try to parse as JSON
            try:
                parsed = json.loads(value)
                if isinstance(parsed, (dict, list)):
                    return parsed
            except (json.JSONDecodeError, ValueError):
                pass
        return value

    def _deserialize_properties(self, properties: Dict[str, Any]) -> Dict[str, Any]:
        """Deserialize all properties."""
        return {
            key: self._deserialize_value(value) for key, value in properties.items()
        }

    def _extract_id(self, value: Any) -> str:
        """Extract ID from various types."""
        if hasattr(value, "toString"):
            return str(value.toString())
        return str(value)

    def _handle_error(self, error: Exception, context: str) -> Exception:
        """Handle and wrap errors."""
        if isinstance(error, GraphDatabaseError):
            return error

        message = str(error)
        return GraphDatabaseError(
            f"{context}: {message}",
            cause=error,
        )


__all__ = ["CypherGraphAdapter"]
