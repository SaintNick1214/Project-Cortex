"""
Pytest Configuration

Shared fixtures and configuration for all Python SDK tests.
"""

import asyncio
import os
import time
import pytest
from typing import AsyncGenerator
from pathlib import Path
from dotenv import load_dotenv

# Load .env.local from project root to get graph database configuration
project_root = Path(__file__).parent.parent.parent
env_file = project_root / ".env.local"
if env_file.exists():
    load_dotenv(env_file, override=True)

from cortex import Cortex, CortexConfig
from tests.helpers import TestCleanup


def generate_test_id(prefix=""):
    """Generate unique test ID based on timestamp."""
    return f"{prefix}{int(time.time() * 1000)}"


# Configure asyncio for pytest
@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# Test environment variables
@pytest.fixture(scope="session")
def test_config():
    """Test configuration from environment"""
    return {
        "convex_url": os.getenv("CONVEX_URL", "https://your-project.convex.cloud"),
        "neo4j_uri": os.getenv("NEO4J_URI", "bolt://localhost:7687"),
        "neo4j_user": os.getenv("NEO4J_USER", "neo4j"),
        "neo4j_password": os.getenv("NEO4J_PASSWORD", "password"),
        "memgraph_uri": os.getenv("MEMGRAPH_URI", "bolt://localhost:7688"),
        "memgraph_user": os.getenv("MEMGRAPH_USER", ""),
        "memgraph_password": os.getenv("MEMGRAPH_PASSWORD", ""),
    }


# Cortex client fixture (function scope for test isolation)
@pytest.fixture(scope="function")
async def cortex_client(test_config) -> AsyncGenerator[Cortex, None]:
    """
    Cortex client fixture for tests.
    
    Creates a fresh Cortex instance for each test function.
    """
    convex_url = test_config["convex_url"]
    client = Cortex(CortexConfig(convex_url=convex_url))
    
    yield client
    
    # Cleanup
    try:
        await client.close()
    except Exception:
        pass


# Test IDs fixture for generating unique test identifiers
@pytest.fixture(scope="function")
def test_ids():
    """Generate unique test IDs for each test."""
    timestamp = generate_test_id("")
    return {
        "memory_space_id": f"test-space-{timestamp}",
        "agent_id": f"test-agent-{timestamp}",
        "user_id": f"test-user-{timestamp}",
        "conversation_id": f"test-conv-{timestamp}",
        "context_id": f"test-ctx-{timestamp}",
    }


# Individual ID fixtures for convenience
@pytest.fixture(scope="function")
def test_memory_space_id():
    """Generate unique memory space ID."""
    return f"test-space-{generate_test_id('')}"


@pytest.fixture(scope="function")
def test_user_id():
    """Generate unique user ID."""
    return f"test-user-{generate_test_id('')}"


@pytest.fixture(scope="function")
def test_agent_id():
    """Generate unique agent ID."""
    return f"test-agent-{generate_test_id('')}"


@pytest.fixture(scope="function")
def test_conversation_id():
    """Generate unique conversation ID."""
    return f"test-conv-{generate_test_id('')}"


@pytest.fixture(scope="function")
def test_context_id():
    """Generate unique context ID."""
    return f"test-ctx-{generate_test_id('')}"


# Cleanup helper fixture
@pytest.fixture(scope="function")
async def cleanup_helper(cortex_client):
    """TestCleanup helper for tests that need cleanup."""
    return TestCleanup(cortex_client)


# Embeddings availability fixture
@pytest.fixture(scope="session")
def embeddings_available_fixture():
    """Check if OpenAI embeddings are available."""
    from tests.helpers import embeddings_available
    return embeddings_available()


# Direct Convex client fixture for low-level testing
@pytest.fixture(scope="function")
async def direct_convex_client(test_config) -> AsyncGenerator:
    """
    Direct Convex client for low-level testing.
    
    Provides access to the underlying ConvexClient for tests that need
    to verify data storage at the Convex level.
    """
    from convex import ConvexClient
    
    convex_url = test_config["convex_url"]
    client = ConvexClient(convex_url)
    
    yield client
    
    # Cleanup
    try:
        client.close()
    except Exception:
        pass


# Markers for test categories
def pytest_configure(config):
    """Register custom markers"""
    config.addinivalue_line(
        "markers", "integration: Integration tests requiring live databases"
    )
    config.addinivalue_line(
        "markers", "unit: Unit tests with mocked dependencies"
    )
    config.addinivalue_line(
        "markers", "manual: Manual tests requiring manual verification"
    )
    config.addinivalue_line(
        "markers", "graph: Tests requiring graph database"
    )
    config.addinivalue_line(
        "markers", "slow: Tests that take longer to run"
    )
