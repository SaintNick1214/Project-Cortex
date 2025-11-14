"""
Cortex SDK - Cypher Graph Adapter

Neo4j/Memgraph adapter using the official Neo4j Python driver
"""

from typing import Optional, List, Dict, Any

from neo4j import AsyncGraphDatabase

from ...types import (
    GraphNode,
    GraphEdge,
    GraphPath,
    GraphConnectionConfig,
    GraphQueryResult,
    TraversalConfig,
    ShortestPathConfig,
)
from ...errors import CortexError, ErrorCode


class CypherGraphAdapter:
    """
    Cypher Graph Adapter for Neo4j and Memgraph.

    Uses the official Neo4j Python driver with async support.
    """

    def __init__(self):
        """Initialize the Cypher adapter."""
        self.driver = None
        self._connected = False

    async def connect(self, config: GraphConnectionConfig) -> None:
        """
        Connect to the graph database.

        Args:
            config: Connection configuration

        Raises:
            CortexError: If connection fails

        Example:
            >>> adapter = CypherGraphAdapter()
            >>> await adapter.connect(
            ...     GraphConnectionConfig(
            ...         uri='bolt://localhost:7687',
            ...         username='neo4j',
            ...         password='password'
            ...     )
            ... )
        """
        try:
            self.driver = AsyncGraphDatabase.driver(
                config.uri,
                auth=(config.username, config.password),
                max_connection_pool_size=config.max_connection_pool_size or 50,
            )

            # Verify connectivity
            async with self.driver.session(database=config.database) as session:
                await session.run("RETURN 1")

            self._connected = True

        except Exception as e:
            raise CortexError(
                ErrorCode.GRAPH_CONNECTION_ERROR,
                f"Failed to connect to graph database: {e}",
                details={"config": config.uri},
            )

    async def disconnect(self) -> None:
        """
        Disconnect from the graph database.

        Example:
            >>> await adapter.disconnect()
        """
        if self.driver:
            await self.driver.close()
            self._connected = False

    async def create_node(self, node: GraphNode) -> str:
        """
        Create a node and return its ID.

        Args:
            node: Node to create

        Returns:
            Node ID in graph

        Example:
            >>> node_id = await adapter.create_node(
            ...     GraphNode(
            ...         label='Memory',
            ...         properties={'memoryId': 'mem-123', 'content': '...'}
            ...     )
            ... )
        """
        if not self._connected:
            raise CortexError(
                ErrorCode.GRAPH_CONNECTION_ERROR, "Not connected to graph database"
            )

        async with self.driver.session() as session:
            result = await session.run(
                f"CREATE (n:{node.label} $props) RETURN id(n) as id",
                props=node.properties,
            )
            record = await result.single()
            return str(record["id"])

    async def update_node(self, node_id: str, properties: Dict[str, Any]) -> None:
        """
        Update node properties.

        Args:
            node_id: Node ID
            properties: Properties to update

        Example:
            >>> await adapter.update_node(node_id, {'status': 'completed'})
        """
        if not self._connected:
            raise CortexError(
                ErrorCode.GRAPH_CONNECTION_ERROR, "Not connected to graph database"
            )

        async with self.driver.session() as session:
            # Build SET clause for each property
            set_clauses = ", ".join([f"n.{key} = ${key}" for key in properties.keys()])

            await session.run(
                f"""
                MATCH (n)
                WHERE id(n) = $nodeId
                SET {set_clauses}
                """,
                nodeId=node_id,
                **properties,
            )

    async def delete_node(self, node_id: str) -> None:
        """
        Delete a node.

        Args:
            node_id: Node ID to delete

        Example:
            >>> await adapter.delete_node(node_id)
        """
        if not self._connected:
            raise CortexError(
                ErrorCode.GRAPH_CONNECTION_ERROR, "Not connected to graph database"
            )

        async with self.driver.session() as session:
            await session.run(
                """
                MATCH (n)
                WHERE id(n) = $nodeId
                DETACH DELETE n
                """,
                nodeId=node_id,
            )

    async def create_edge(self, edge: GraphEdge) -> str:
        """
        Create an edge and return its ID.

        Args:
            edge: Edge to create

        Returns:
            Edge ID in graph

        Example:
            >>> edge_id = await adapter.create_edge(
            ...     GraphEdge(
            ...         type='REFERENCES',
            ...         from_node=memory_id,
            ...         to_node=conversation_id,
            ...         properties={'messageIds': ['msg-1', 'msg-2']}
            ...     )
            ... )
        """
        if not self._connected:
            raise CortexError(
                ErrorCode.GRAPH_CONNECTION_ERROR, "Not connected to graph database"
            )

        async with self.driver.session() as session:
            props_clause = "$props" if edge.properties else "{}"

            result = await session.run(
                f"""
                MATCH (a), (b)
                WHERE id(a) = $from AND id(b) = $to
                CREATE (a)-[r:{edge.type} {props_clause}]->(b)
                RETURN id(r) as id
                """,
                **{"from": edge.from_node, "to": edge.to_node, "props": edge.properties or {}},
            )

            record = await result.single()
            return str(record["id"]) if record else ""

    async def delete_edge(self, edge_id: str) -> None:
        """
        Delete an edge.

        Args:
            edge_id: Edge ID to delete

        Example:
            >>> await adapter.delete_edge(edge_id)
        """
        if not self._connected:
            raise CortexError(
                ErrorCode.GRAPH_CONNECTION_ERROR, "Not connected to graph database"
            )

        async with self.driver.session() as session:
            await session.run(
                """
                MATCH ()-[r]-()
                WHERE id(r) = $edgeId
                DELETE r
                """,
                edgeId=edge_id,
            )

    async def query(
        self, cypher: str, params: Optional[Dict[str, Any]] = None
    ) -> GraphQueryResult:
        """
        Execute a Cypher query.

        Args:
            cypher: Cypher query string
            params: Query parameters

        Returns:
            Query result

        Example:
            >>> result = await adapter.query(
            ...     "MATCH (m:Memory) WHERE m.importance >= $min RETURN m LIMIT 10",
            ...     {'min': 80}
            ... )
        """
        if not self._connected:
            raise CortexError(
                ErrorCode.GRAPH_CONNECTION_ERROR, "Not connected to graph database"
            )

        try:
            async with self.driver.session() as session:
                result = await session.run(cypher, params or {})
                records = [record.data() async for record in result]

                return GraphQueryResult(records=records, count=len(records))

        except Exception as e:
            raise CortexError(
                ErrorCode.GRAPH_QUERY_ERROR,
                f"Graph query failed: {e}",
                details={"query": cypher, "params": params},
            )

    async def find_nodes(
        self, label: str, properties: Dict[str, Any], limit: int = 1
    ) -> List[GraphNode]:
        """
        Find nodes by label and properties.

        Args:
            label: Node label
            properties: Properties to match
            limit: Maximum results

        Returns:
            List of matching nodes

        Example:
            >>> nodes = await adapter.find_nodes(
            ...     'Memory',
            ...     {'memoryId': 'mem-123'},
            ...     1
            ... )
        """
        # Build WHERE clause
        where_clauses = [f"n.{key} = ${key}" for key in properties.keys()]
        where_str = " AND ".join(where_clauses)

        result = await self.query(
            f"""
            MATCH (n:{label})
            {"WHERE " + where_str if where_str else ""}
            RETURN id(n) as id, labels(n) as labels, properties(n) as properties
            LIMIT {limit}
            """,
            properties,
        )

        return [
            GraphNode(
                label=record["labels"][0] if record["labels"] else label,
                properties=record["properties"],
                id=str(record["id"]),
            )
            for record in result.records
        ]

    async def traverse(self, config: TraversalConfig) -> List[GraphNode]:
        """
        Multi-hop graph traversal.

        Args:
            config: Traversal configuration

        Returns:
            List of connected nodes

        Example:
            >>> connected = await adapter.traverse(
            ...     TraversalConfig(
            ...         start_id=node_id,
            ...         relationship_types=['CHILD_OF', 'PARENT_OF'],
            ...         max_depth=5,
            ...         direction='BOTH'
            ...     )
            ... )
        """
        rel_types_str = "|".join(config.relationship_types)
        direction = "<-" if config.direction == "INCOMING" else "->"
        if config.direction == "BOTH":
            direction = "-"

        result = await self.query(
            f"""
            MATCH (start)
            WHERE id(start) = $startId
            MATCH (start){direction}[:{rel_types_str}*1..{config.max_depth}]{direction}(connected)
            RETURN DISTINCT id(connected) as id, labels(connected) as labels, properties(connected) as properties
            """,
            {"startId": config.start_id},
        )

        return [
            GraphNode(
                label=record["labels"][0] if record["labels"] else "",
                properties=record["properties"],
                id=str(record["id"]),
            )
            for record in result.records
        ]

    async def find_path(self, config: ShortestPathConfig) -> Optional[GraphPath]:
        """
        Find shortest path between nodes.

        Args:
            config: Path configuration

        Returns:
            Shortest path if found, None otherwise

        Note:
            Not supported in Memgraph - use traverse() instead

        Example:
            >>> path = await adapter.find_path(
            ...     ShortestPathConfig(
            ...         from_id=alice_id,
            ...         to_id=bob_id,
            ...         max_hops=10
            ...     )
            ... )
        """
        rel_filter = ""
        if config.relationship_types:
            rel_types_str = "|".join(config.relationship_types)
            rel_filter = f"[:{rel_types_str}*1..{config.max_hops}]"
        else:
            rel_filter = f"[*1..{config.max_hops}]"

        result = await self.query(
            f"""
            MATCH (start), (end)
            WHERE id(start) = $fromId AND id(end) = $toId
            MATCH path = shortestPath((start)-{rel_filter}-(end))
            RETURN 
                [node IN nodes(path) | {{id: id(node), label: labels(node)[0], properties: properties(node)}}] as nodes,
                [rel IN relationships(path) | {{id: id(rel), type: type(rel), properties: properties(rel)}}] as relationships,
                length(path) as length
            LIMIT 1
            """,
            {"fromId": config.from_id, "toId": config.to_id},
        )

        if result.count == 0:
            return None

        record = result.records[0]

        return GraphPath(
            nodes=[GraphNode(**{**n, "id": str(n["id"])}) for n in record["nodes"]],
            relationships=[
                GraphEdge(
                    type=r["type"],
                    from_node="",  # Not included in result
                    to_node="",  # Not included in result
                    id=str(r["id"]),
                    properties=r.get("properties"),
                )
                for r in record["relationships"]
            ],
            length=record["length"],
        )

