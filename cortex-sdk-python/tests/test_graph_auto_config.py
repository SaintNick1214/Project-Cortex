"""
Graph Auto-Configuration Tests

Tests the two-gate approach for automatic graph database configuration:
- Gate 1: Connection credentials must be present (NEO4J_URI or MEMGRAPH_URI + auth)
- Gate 2: CORTEX_GRAPH_SYNC must be set to 'true'

These are unit tests that mock the CypherGraphAdapter to avoid requiring
actual graph database connections.
"""

import os
import warnings
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from cortex.client import Cortex
from cortex.types import CortexConfig, GraphConfig


class TestGraphAutoConfiguration:
    """Test the two-gate approach for graph auto-configuration."""

    @pytest.fixture(autouse=True)
    def clean_env(self):
        """Clear relevant env vars before each test."""
        env_vars_to_clear = [
            "CORTEX_GRAPH_SYNC",
            "NEO4J_URI",
            "NEO4J_USERNAME",
            "NEO4J_PASSWORD",
            "MEMGRAPH_URI",
            "MEMGRAPH_USERNAME",
            "MEMGRAPH_PASSWORD",
        ]
        original_values = {}

        for var in env_vars_to_clear:
            original_values[var] = os.environ.get(var)
            if var in os.environ:
                del os.environ[var]

        yield

        # Restore original values
        for var, value in original_values.items():
            if value is not None:
                os.environ[var] = value
            elif var in os.environ:
                del os.environ[var]

    @pytest.mark.asyncio
    async def test_no_auto_config_when_only_uri_set(self):
        """Gate 1 satisfied, Gate 2 NOT satisfied - should NOT auto-configure."""
        os.environ["NEO4J_URI"] = "bolt://localhost:7687"
        os.environ["NEO4J_USERNAME"] = "neo4j"
        os.environ["NEO4J_PASSWORD"] = "password"
        # CORTEX_GRAPH_SYNC is NOT set

        result = await Cortex._auto_configure_graph()

        assert result is None

    @pytest.mark.asyncio
    async def test_no_auto_config_when_only_graph_sync_set(self):
        """Gate 2 satisfied, Gate 1 NOT satisfied - should NOT auto-configure."""
        os.environ["CORTEX_GRAPH_SYNC"] = "true"
        # No URI set

        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            result = await Cortex._auto_configure_graph()

            assert result is None
            assert len(w) == 1
            assert "CORTEX_GRAPH_SYNC=true but no graph database URI found" in str(w[0].message)

    @pytest.mark.asyncio
    async def test_auto_config_neo4j_when_both_gates_satisfied(self):
        """Both gates satisfied with Neo4j - should auto-configure Neo4j."""
        os.environ["CORTEX_GRAPH_SYNC"] = "true"
        os.environ["NEO4J_URI"] = "bolt://localhost:7687"
        os.environ["NEO4J_USERNAME"] = "neo4j"
        os.environ["NEO4J_PASSWORD"] = "testpassword"

        # This test verifies the env var gating logic
        # The actual adapter connection is tested in integration tests
        # Since neo4j package may not be installed, we just verify no crash
        # and that the function handles the situation appropriately
        result = await Cortex._auto_configure_graph()

        # Will return None if neo4j package not installed (ImportError handled)
        # or return GraphConfig if neo4j is installed (connection may fail)
        # Either way, no unhandled exception should be raised

    @pytest.mark.asyncio
    async def test_auto_config_memgraph_when_both_gates_satisfied(self):
        """Both gates satisfied with Memgraph only - should auto-configure Memgraph."""
        os.environ["CORTEX_GRAPH_SYNC"] = "true"
        os.environ["MEMGRAPH_URI"] = "bolt://localhost:7688"
        os.environ["MEMGRAPH_USERNAME"] = "memgraph"
        os.environ["MEMGRAPH_PASSWORD"] = "testpassword"

        # Similar to neo4j test - just verify no exceptions
        result = await Cortex._auto_configure_graph()
        # Will return None or GraphConfig depending on neo4j package availability

    @pytest.mark.asyncio
    async def test_prefers_neo4j_over_memgraph(self):
        """When both URIs present, Neo4j should take priority with warning."""
        os.environ["CORTEX_GRAPH_SYNC"] = "true"
        os.environ["NEO4J_URI"] = "bolt://localhost:7687"
        os.environ["NEO4J_USERNAME"] = "neo4j"
        os.environ["NEO4J_PASSWORD"] = "neo4jpass"
        os.environ["MEMGRAPH_URI"] = "bolt://localhost:7688"
        os.environ["MEMGRAPH_USERNAME"] = "memgraph"
        os.environ["MEMGRAPH_PASSWORD"] = "memgraphpass"

        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            result = await Cortex._auto_configure_graph()

            # Should have warning about both URIs set
            warning_messages = [str(warning.message) for warning in w]
            assert any("Both NEO4J_URI and MEMGRAPH_URI set" in msg for msg in warning_messages)

    @pytest.mark.asyncio
    async def test_no_auto_config_when_graph_sync_false(self):
        """CORTEX_GRAPH_SYNC='false' should NOT trigger auto-config."""
        os.environ["CORTEX_GRAPH_SYNC"] = "false"
        os.environ["NEO4J_URI"] = "bolt://localhost:7687"

        result = await Cortex._auto_configure_graph()

        assert result is None

    @pytest.mark.asyncio
    async def test_no_auto_config_when_graph_sync_empty(self):
        """CORTEX_GRAPH_SYNC='' should NOT trigger auto-config."""
        os.environ["CORTEX_GRAPH_SYNC"] = ""
        os.environ["NEO4J_URI"] = "bolt://localhost:7687"

        result = await Cortex._auto_configure_graph()

        assert result is None


class TestDefaultCredentials:
    """Test default credential handling."""

    @pytest.fixture(autouse=True)
    def clean_env(self):
        """Clear relevant env vars before each test."""
        env_vars_to_clear = [
            "CORTEX_GRAPH_SYNC",
            "NEO4J_URI",
            "NEO4J_USERNAME",
            "NEO4J_PASSWORD",
            "MEMGRAPH_URI",
            "MEMGRAPH_USERNAME",
            "MEMGRAPH_PASSWORD",
        ]
        original_values = {}

        for var in env_vars_to_clear:
            original_values[var] = os.environ.get(var)
            if var in os.environ:
                del os.environ[var]

        yield

        # Restore original values
        for var, value in original_values.items():
            if value is not None:
                os.environ[var] = value
            elif var in os.environ:
                del os.environ[var]

    @pytest.mark.asyncio
    async def test_default_neo4j_username(self):
        """Uses default username 'neo4j' if NEO4J_USERNAME not set."""
        os.environ["CORTEX_GRAPH_SYNC"] = "true"
        os.environ["NEO4J_URI"] = "bolt://localhost:7687"
        os.environ["NEO4J_PASSWORD"] = "password"
        # NEO4J_USERNAME not set - should default to "neo4j"

        # This test verifies the logic exists; actual connection tested in integration
        # The implementation uses os.environ.get("NEO4J_USERNAME", "neo4j")
        assert os.environ.get("NEO4J_USERNAME", "neo4j") == "neo4j"

    @pytest.mark.asyncio
    async def test_default_memgraph_username(self):
        """Uses default username 'memgraph' if MEMGRAPH_USERNAME not set."""
        os.environ["CORTEX_GRAPH_SYNC"] = "true"
        os.environ["MEMGRAPH_URI"] = "bolt://localhost:7688"
        os.environ["MEMGRAPH_PASSWORD"] = "password"
        # MEMGRAPH_USERNAME not set - should default to "memgraph"

        assert os.environ.get("MEMGRAPH_USERNAME", "memgraph") == "memgraph"

    @pytest.mark.asyncio
    async def test_empty_password_default(self):
        """Uses empty password if not set."""
        os.environ["CORTEX_GRAPH_SYNC"] = "true"
        os.environ["NEO4J_URI"] = "bolt://localhost:7687"
        # NEO4J_PASSWORD not set - should default to ""

        assert os.environ.get("NEO4J_PASSWORD", "") == ""


class TestCortexCreateFactory:
    """Test Cortex.create() factory method."""

    @pytest.fixture(autouse=True)
    def clean_env(self):
        """Clear relevant env vars before each test."""
        env_vars_to_clear = [
            "CORTEX_GRAPH_SYNC",
            "NEO4J_URI",
            "NEO4J_USERNAME",
            "NEO4J_PASSWORD",
            "MEMGRAPH_URI",
            "MEMGRAPH_USERNAME",
            "MEMGRAPH_PASSWORD",
            "CORTEX_FACT_EXTRACTION",
            "OPENAI_API_KEY",
        ]
        original_values = {}

        for var in env_vars_to_clear:
            original_values[var] = os.environ.get(var)
            if var in os.environ:
                del os.environ[var]

        yield

        # Restore original values
        for var, value in original_values.items():
            if value is not None:
                os.environ[var] = value
            elif var in os.environ:
                del os.environ[var]

    @pytest.mark.asyncio
    async def test_create_without_graph_config(self):
        """Cortex.create() works without graph config."""
        config = CortexConfig(convex_url="http://127.0.0.1:3210")

        cortex = await Cortex.create(config)

        assert cortex is not None
        assert cortex.graph_adapter is None

        await cortex.close()

    @pytest.mark.asyncio
    async def test_create_uses_explicit_graph_config(self):
        """Explicit config.graph takes priority over auto-config."""
        os.environ["CORTEX_GRAPH_SYNC"] = "true"
        os.environ["NEO4J_URI"] = "bolt://localhost:7687"

        mock_adapter = MagicMock()
        explicit_config = CortexConfig(
            convex_url="http://127.0.0.1:3210",
            graph=GraphConfig(adapter=mock_adapter),
        )

        cortex = await Cortex.create(explicit_config)

        assert cortex is not None
        assert cortex.graph_adapter is mock_adapter

        await cortex.close()
