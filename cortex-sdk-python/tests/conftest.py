"""
Pytest configuration and fixtures for Cortex SDK tests

Supports dual-deployment testing strategy:
- LOCAL: Test against local Convex dev server (http://127.0.0.1:3210)
- MANAGED: Test against managed Convex deployment (cloud)
- AUTO: Auto-detect and use available deployment(s)

Set via environment variable:
    export CONVEX_TEST_MODE=local    # Test LOCAL only
    export CONVEX_TEST_MODE=managed  # Test MANAGED only
    export CONVEX_TEST_MODE=auto     # Auto-detect (default)

Or use the test runner script:
    python scripts/run-python-tests.py --mode=local
    python scripts/run-python-tests.py --mode=managed
    python scripts/run-python-tests.py --mode=both
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
    load_dotenv(env_file, override=True)

# Configure CONVEX_URL based on test mode (like TypeScript SDK)
test_mode = os.getenv("CONVEX_TEST_MODE", "auto")
has_local_config = bool(os.getenv("LOCAL_CONVEX_URL"))
has_managed_config = bool(os.getenv("CLOUD_CONVEX_URL"))

if test_mode == "local":
    if os.getenv("LOCAL_CONVEX_URL"):
        os.environ["CONVEX_URL"] = os.getenv("LOCAL_CONVEX_URL")
    print(f"\n🧪 [Python SDK] Testing against LOCAL Convex: {os.getenv('CONVEX_URL')}")
    print("   Note: Vector search not supported in local mode\n")
elif test_mode == "managed":
    if os.getenv("CLOUD_CONVEX_URL"):
        os.environ["CONVEX_URL"] = os.getenv("CLOUD_CONVEX_URL")
    print(f"\n🧪 [Python SDK] Testing against MANAGED Convex: {os.getenv('CONVEX_URL')}")
    print("   Note: Vector search fully supported in managed mode\n")
elif test_mode == "auto":
    # Auto-detect which deployment is available
    if has_local_config and not has_managed_config:
        os.environ["CONVEX_URL"] = os.getenv("LOCAL_CONVEX_URL")
        print(f"\n🧪 [Python SDK] Auto-detected LOCAL Convex: {os.getenv('CONVEX_URL')}")
    elif has_managed_config and not has_local_config:
        os.environ["CONVEX_URL"] = os.getenv("CLOUD_CONVEX_URL")
        print(f"\n🧪 [Python SDK] Auto-detected MANAGED Convex: {os.getenv('CONVEX_URL')}")
    elif has_local_config and has_managed_config:
        # Both present - default to LOCAL (test runner will handle dual testing)
        os.environ["CONVEX_URL"] = os.getenv("LOCAL_CONVEX_URL")
        print(f"\n⚠️  [Python SDK] Both configs detected, defaulting to LOCAL: {os.getenv('CONVEX_URL')}")
        print("   Use 'python scripts/run-python-tests.py' to run both suites\n")

from cortex import Cortex, CortexConfig
from tests.helpers import TestCleanup, embeddings_available


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


@pytest.fixture
async def cleanup_helper(cortex_client) -> TestCleanup:
    """
    Fixture providing TestCleanup instance for test data cleanup.
    
    Usage:
        async def test_something(cortex_client, cleanup_helper):
            # ... create test data ...
            await cleanup_helper.purge_all()
    """
    return TestCleanup(cortex_client)


@pytest.fixture
async def direct_convex_client(cortex_client):
    """
    Fixture providing direct access to AsyncConvexClient for storage validation.
    
    Usage:
        async def test_something(cortex_client, direct_convex_client):
            result = await cortex_client.conversations.create(...)
            stored = await direct_convex_client.query("conversations:get", {...})
            assert stored is not None
    """
    return cortex_client.client


@pytest.fixture
def test_ids():
    """
    Fixture providing multiple unique test IDs at once.
    
    Returns:
        Dictionary with various test IDs
    """
    import time
    import random
    timestamp = int(time.time() * 1000)
    rand = random.randint(1000, 9999)
    
    return {
        "user_id": f"test-user-{timestamp}-{rand}",
        "memory_space_id": f"test-space-{timestamp}-{rand}",
        "conversation_id": f"test-conv-{timestamp}-{rand}",
        "agent_id": f"test-agent-{timestamp}-{rand}",
    }


@pytest.fixture
def embeddings_available_fixture():
    """
    Fixture that checks if embeddings can be generated.
    
    Returns:
        True if OPENAI_API_KEY is set, False otherwise
    """
    return embeddings_available()

