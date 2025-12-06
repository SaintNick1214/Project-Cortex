"""
Cortex SDK - Cypher Graph Adapter

Neo4j/Memgraph adapter using the official Neo4j Python driver
"""

from typing import Any, Dict, List, Optional

from neo4j import AsyncGraphDatabase  # type: ignore[import]

from ...errors import CortexError, ErrorCode
from ...types import (
    GraphConnectionConfig,
    GraphEdge,
    GraphNode,
    GraphPath,
    GraphQueryResult,
    ShortestPathConfig,
    TraversalConfig,
)


class CypherGraphAdapter:
    """
    Cypher Graph Adapter for Neo4j and Memgraph.

    Uses the official Neo4j Python driver with async support.
    Automatically detects database type and handles ID differences:
    - Neo4j uses elementId() returning strings
    - Memgraph uses id() returning integers
    """

    def __init__(self) -> None:
        """Initialize the Cypher adapter."""
        self.driver: Any = None
        self._connected = False
        self.use_element_id = True  # Neo4j uses elementId(), Memgraph uses id()
        self.database: Optional[str] = None

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
            self.database = config.database
            self.driver = AsyncGraphDatabase.driver(
                config.uri,
                auth=(config.username, config.password),
                max_connection_pool_size=config.max_connection_pool_size or 50,
            )

            assert self.driver is not None

            # Verify connectivity
            async with self.driver.session(database=config.database) as session:
                await session.run("RETURN 1")

            self._connected = True

            # Detect database type (Neo4j vs Memgraph)
            await self._detect_database_type()

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

    async def _detect_database_type(self) -> None:
        """
        Detect database type and set appropriate ID function.
        Neo4j uses elementId() returning strings, Memgraph uses id() returning integers.
        """
        assert self.driver is not None
        async with self.driver.session(database=self.database) as session:
            try:
                # Use explicit transaction for atomic operation
                async with session.begin_transaction() as tx:
                    # Create test node
                    await tx.run("CREATE (n:__TEST__)")
                    # Try elementId() in separate query - if it works, we're on Neo4j
                    result = await tx.run("MATCH (n:__TEST__) RETURN elementId(n) as id")
                    await result.consume()  # Ensure query completes
                    # Clean up test node
                    await tx.run("MATCH (n:__TEST__) DELETE n")
                    await tx.commit()
                    self.use_element_id = True
            except Exception:
                # elementId() not supported, use id() instead (Memgraph)
                # Transaction will auto-rollback, but also explicitly clean up
                self.use_element_id = False
                try:
                    await session.run("MATCH (n:__TEST__) DELETE n")
                except Exception:
                    pass  # Ignore cleanup errors if node wasn't created

    def _get_id_function(self) -> str:
        """Get the appropriate ID function for the connected database."""
        return "elementId" if self.use_element_id else "id"

    def _convert_id_for_query(self, id_value: str) -> Any:
        """
        Convert ID to appropriate type for database queries.
        Neo4j uses string IDs (elementId), Memgraph uses integer IDs (id).
        """
        if not self.use_element_id:
            # Memgraph uses integer IDs
            try:
                return int(id_value)
            except (ValueError, TypeError):
                return id_value
        return id_value

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

        assert self.driver is not None
        id_func = self._get_id_function()
        async with self.driver.session(database=self.database) as session:
            result = await session.run(
                f"CREATE (n:{node.label} $props) RETURN {id_func}(n) as id",
                props=node.properties,
            )
            record = await result.single()
            if not record:
                raise RuntimeError(
                    f"Failed to create node with label '{node.label}': "
                    "no record returned from database"
                )
            return str(record["id"])

    async def merge_node(
        self, node: "GraphNode", match_properties: Dict[str, Any]
    ) -> str:
        """
        Merge (upsert) a node using MERGE semantics.

        Creates if not exists, matches if exists. Updates properties on existing nodes.
        Idempotent and safe for concurrent operations.

        Args:
            node: Node to merge
            match_properties: Properties to match on (for finding existing node)

        Returns:
            Node ID (existing or newly created)

        Example:
            >>> node_id = await adapter.merge_node(
            ...     GraphNode(
            ...         label='MemorySpace',
            ...         properties={'memorySpaceId': 'space-123', 'name': 'Main'}
            ...     ),
            ...     {'memorySpaceId': 'space-123'}
            ... )
        """
        if not self._connected:
            raise CortexError(
                ErrorCode.GRAPH_CONNECTION_ERROR, "Not connected to graph database"
            )

        assert self.driver is not None
        id_func = self._get_id_function()

        # Build MERGE clause with match properties
        match_prop_str = ", ".join(
            [f"{key}: $match_{key}" for key in match_properties.keys()]
        )

        # Build SET clause for updating all other properties
        extra_props = {
            k: v for k, v in node.properties.items() if k not in match_properties
        }

        # Build query with or without SET clause to avoid empty lines
        if extra_props:
            query = f"""
                MERGE (n:{node.label} {{{match_prop_str}}})
                ON CREATE SET n += $createProps ON MATCH SET n += $updateProps
                RETURN {id_func}(n) as id
            """
        else:
            query = f"""
                MERGE (n:{node.label} {{{match_prop_str}}})
                RETURN {id_func}(n) as id
            """

        # Build parameters
        params: Dict[str, Any] = {}
        for key, value in match_properties.items():
            params[f"match_{key}"] = value

        if extra_props:
            params["createProps"] = extra_props
            params["updateProps"] = extra_props

        async with self.driver.session(database=self.database) as session:
            result = await session.run(query, params)
            record = await result.single()
            if not record:
                raise RuntimeError(
                    f"Failed to merge node with label '{node.label}': "
                    "no record returned from database"
                )
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

        assert self.driver is not None
        id_func = self._get_id_function()
        converted_id = self._convert_id_for_query(node_id)

        async with self.driver.session(database=self.database) as session:
            # Build SET clause for each property
            set_clauses = ", ".join([f"n.{key} = ${key}" for key in properties.keys()])

            await session.run(
                f"""
                MATCH (n)
                WHERE {id_func}(n) = $nodeId
                SET {set_clauses}
                """,
                nodeId=converted_id,
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

        assert self.driver is not None
        id_func = self._get_id_function()
        converted_id = self._convert_id_for_query(node_id)

        async with self.driver.session(database=self.database) as session:
            await session.run(
                f"""
                MATCH (n)
                WHERE {id_func}(n) = $nodeId
                DETACH DELETE n
                """,
                nodeId=converted_id,
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

        assert self.driver is not None
        id_func = self._get_id_function()
        from_id = self._convert_id_for_query(edge.from_node)
        to_id = self._convert_id_for_query(edge.to_node)

        async with self.driver.session(database=self.database) as session:
            props_clause = "$props" if edge.properties else "{}"

            result = await session.run(
                f"""
                MATCH (a), (b)
                WHERE {id_func}(a) = $from AND {id_func}(b) = $to
                CREATE (a)-[r:{edge.type} {props_clause}]->(b)
                RETURN {id_func}(r) as id
                """,
                **{"from": from_id, "to": to_id, "props": edge.properties or {}},
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

        assert self.driver is not None
        id_func = self._get_id_function()
        converted_id = self._convert_id_for_query(edge_id)

        async with self.driver.session(database=self.database) as session:
            await session.run(
                f"""
                MATCH ()-[r]-()
                WHERE {id_func}(r) = $edgeId
                DELETE r
                """,
                edgeId=converted_id,
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

        assert self.driver is not None

        try:
            async with self.driver.session(database=self.database) as session:
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
        id_func = self._get_id_function()

        result = await self.query(
            f"""
            MATCH (n:{label})
            {"WHERE " + where_str if where_str else ""}
            RETURN {id_func}(n) as id, labels(n) as labels, properties(n) as properties
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

        # Build proper Cypher relationship pattern
        if config.direction == "INCOMING":
            rel_pattern = f"<-[:{rel_types_str}*1..{config.max_depth}]-"
        elif config.direction == "OUTGOING":
            rel_pattern = f"-[:{rel_types_str}*1..{config.max_depth}]->"
        else:  # BOTH
            rel_pattern = f"-[:{rel_types_str}*1..{config.max_depth}]-"

        id_func = self._get_id_function()
        converted_start_id = self._convert_id_for_query(config.start_id)

        result = await self.query(
            f"""
            MATCH (start)
            WHERE {id_func}(start) = $startId
            MATCH (start){rel_pattern}(connected)
            RETURN DISTINCT {id_func}(connected) as id, labels(connected) as labels, properties(connected) as properties
            """,
            {"startId": converted_start_id},
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

        id_func = self._get_id_function()
        from_id = self._convert_id_for_query(config.from_id)
        to_id = self._convert_id_for_query(config.to_id)

        result = await self.query(
            f"""
            MATCH (start), (end)
            WHERE {id_func}(start) = $fromId AND {id_func}(end) = $toId
            MATCH path = shortestPath((start)-{rel_filter}-(end))
            RETURN
                [node IN nodes(path) | {{id: {id_func}(node), label: labels(node)[0], properties: properties(node)}}] as nodes,
                [rel IN relationships(path) | {{id: {id_func}(rel), type: type(rel), properties: properties(rel)}}] as relationships,
                length(path) as length
            LIMIT 1
            """,
            {"fromId": from_id, "toId": to_id},
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

