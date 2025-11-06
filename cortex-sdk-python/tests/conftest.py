"""
Pytest configuration and fixtures for Cortex SDK tests
"""

import pytest
import os
import asyncio
from typing import AsyncGenerator
from pathlib import Path

# Load environment variables from .env.local in project root
from dotenv import load_dotenv

# Load from project root .env.local
project_root = Path(__file__).parent.parent.parent
env_file = project_root / ".env.local"
if env_file.exists():
    load_dotenv(env_file)

from cortex import Cortex, CortexConfig


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def cortex_client() -> AsyncGenerator[Cortex, None]:
    """
    Fixture for Cortex client.

    Automatically initializes and cleans up Cortex instance for tests.
    Uses CONVEX_URL from environment (.env.local is auto-loaded above).
    """
    # Get CONVEX_URL from environment (loaded from .env.local)
    convex_url = os.getenv("CONVEX_URL")
    
    if not convex_url:
        pytest.fail(
            "CONVEX_URL not set. Make sure .env.local exists in project root "
            "or set CONVEX_URL environment variable."
        )

    config = CortexConfig(convex_url=convex_url)
    client = Cortex(config)

    yield client

    # Cleanup
    await client.close()


@pytest.fixture
async def cortex_with_graph() -> AsyncGenerator[Cortex, None]:
    """
    Fixture for Cortex client with graph integration.

    Only runs if graph database is configured.
    """
    convex_url = os.getenv("CONVEX_URL", "http://localhost:3210")
    neo4j_uri = os.getenv("NEO4J_URI")

    if not neo4j_uri:
        pytest.skip("NEO4J_URI not configured")

    from cortex import GraphConfig, GraphConnectionConfig
    from cortex.graph import CypherGraphAdapter, initialize_graph_schema

    # Setup graph adapter
    graph = CypherGraphAdapter()
    await graph.connect(
        GraphConnectionConfig(
            uri=neo4j_uri,
            username=os.getenv("NEO4J_USER", "neo4j"),
            password=os.getenv("NEO4J_PASSWORD", "password"),
        )
    )

    # Initialize schema
    try:
        await initialize_graph_schema(graph)
    except:
        pass  # Schema might already exist

    # Create Cortex with graph
    config = CortexConfig(
        convex_url=convex_url, graph=GraphConfig(adapter=graph, auto_sync=False)
    )
    client = Cortex(config)

    yield client

    # Cleanup
    await client.close()
    await graph.disconnect()


@pytest.fixture
def test_user_id():
    """Generate unique test user ID."""
    import time
    import random
    return f"test-user-{int(time.time())}-{random.randint(1000, 9999)}"


@pytest.fixture
def test_memory_space_id():
    """Generate unique test memory space ID."""
    import time
    import random
    return f"test-space-{int(time.time())}-{random.randint(1000, 9999)}"


@pytest.fixture
def test_conversation_id():
    """Generate unique test conversation ID."""
    import time
    import random
    return f"test-conv-{int(time.time())}-{random.randint(1000, 9999)}"

