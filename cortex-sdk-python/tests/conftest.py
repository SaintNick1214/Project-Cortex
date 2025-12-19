"""
Pytest Configuration

Shared fixtures and configuration for all Python SDK tests.

PARALLEL-SAFE: Uses TestRunContext for isolated test data.
Each test module gets its own run ID to prevent conflicts.

PARALLEL EXECUTION: Tests run with pytest-xdist (-n auto) for 4-5x speedup.

Priority for Convex URL:
  1. CONVEX_URL_PY (Python-dedicated instance, used in CI)
  2. CONVEX_URL (fallback for local development)
  3. .env.local files
"""

import asyncio
import os
import time
from pathlib import Path
from typing import AsyncGenerator

import pytest
from dotenv import load_dotenv


def pytest_report_header(config):
    """Print parallel execution info in pytest header."""
    import multiprocessing
    cpu_count = multiprocessing.cpu_count()
    
    # Check if xdist is being used
    num_workers = getattr(config.option, "numprocesses", None)
    if num_workers:
        # Handle 'auto' mode
        if num_workers == "auto":
            return [f"🚀 parallel: -n auto → {cpu_count} workers ({cpu_count} CPU cores detected)"]
        else:
            return [f"🚀 parallel: {num_workers} workers ({cpu_count} CPU cores available)"]
    else:
        return ["⚠️  serial execution (use -n auto for ~4x speedup)"]

# Python tests use CONVEX_URL_PY for dedicated database isolation
# This ALWAYS takes priority over any other CONVEX_URL (including from .env files)
if os.environ.get("CONVEX_URL_PY"):
    # Force override CONVEX_URL with Python-specific value
    os.environ["CONVEX_URL"] = os.environ["CONVEX_URL_PY"]

# Check if CONVEX_URL is already set from CONVEX_URL_PY
convex_url_already_set = bool(os.environ.get("CONVEX_URL_PY"))

# Load .env.local from project root only if CONVEX_URL is not already set from CI
# Note: override=False means command-line env vars take precedence over .env.local
if not convex_url_already_set:
    project_root = Path(__file__).parent.parent.parent
    env_file = project_root / ".env.local"
    if env_file.exists():
        load_dotenv(env_file, override=False)

from cortex import Cortex, CortexConfig  # noqa: E402
from tests.helpers import (  # noqa: E402
    ScopedCleanup,
    TestCleanup,
    TestRunContext,
    create_named_test_run_context,
)


def generate_test_id(prefix=""):
    """Generate unique test ID based on timestamp + random suffix."""
    import random
    return f"{prefix}{int(time.time() * 1000)}-{random.randint(1000, 9999)}"


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


# Cleanup helper fixture (legacy - for backwards compatibility)
@pytest.fixture(scope="function")
async def cleanup_helper(cortex_client):
    """TestCleanup helper for tests that need cleanup."""
    return TestCleanup(cortex_client)


# ============================================================================
# PARALLEL-SAFE TEST ISOLATION FIXTURES
# ============================================================================
# Use these fixtures for tests that need to run in parallel without conflicts.

@pytest.fixture(scope="module")
def test_run_context(request) -> TestRunContext:
    """
    Create a unique test run context for parallel-safe test execution.

    This fixture is scoped to the module level, meaning all tests in a module
    share the same run ID. This allows tests within a module to share data
    while maintaining isolation from other modules running in parallel.

    Example:
        def test_something(test_run_context, cortex_client):
            user_id = test_run_context.user_id("alice")
            await cortex_client.users.update(user_id, {"name": "Alice"})
    """
    # Extract module name from test file path for better debugging
    module_name = request.module.__name__.split('.')[-1].replace('test_', '')
    ctx = create_named_test_run_context(module_name)
    print(f"\n🧪 Test Run Context Created: {ctx.run_id}\n")
    return ctx


@pytest.fixture(scope="module")
async def module_cortex_client(test_config) -> AsyncGenerator[Cortex, None]:
    """
    Module-scoped Cortex client for fixtures that need module-level persistence.

    Use this for module-scoped fixtures like scoped_cleanup. For individual
    test functions, use the function-scoped cortex_client fixture instead.
    """
    convex_url = test_config["convex_url"]
    client = Cortex(CortexConfig(convex_url=convex_url))

    yield client

    # Cleanup
    try:
        await client.close()
    except Exception:
        pass


@pytest.fixture(scope="module")
async def scoped_cleanup(module_cortex_client, test_run_context) -> AsyncGenerator[ScopedCleanup, None]:
    """
    Scoped cleanup helper for parallel-safe test isolation.

    This cleanup only deletes data created by this test run, identified
    by the run ID prefix. This enables safe parallel test execution.

    Note: Uses module_cortex_client (module-scoped) instead of cortex_client
    (function-scoped) to avoid pytest scope mismatch errors.

    Example:
        @pytest.fixture(scope="module")
        async def setup_teardown(scoped_cleanup, cortex_client, test_run_context):
            # Setup: create test data
            yield
            # Teardown: cleanup only this run's data
            await scoped_cleanup.cleanup_all()
    """
    cleanup = ScopedCleanup(module_cortex_client, test_run_context)
    yield cleanup

    # Auto-cleanup at end of module
    print(f"\n🧹 Cleaning up test run {test_run_context.run_id}...")
    result = await cleanup.cleanup_all()
    print(f"✅ Cleaned up {result.total} entities\n")


@pytest.fixture(scope="function")
def ctx(test_run_context) -> TestRunContext:
    """
    Convenience alias for test_run_context.

    Shorter name for use in test functions:
        def test_something(ctx, cortex_client):
            user_id = ctx.user_id("test")
    """
    return test_run_context


# Individual ID fixtures using the test run context for parallel safety
@pytest.fixture(scope="function")
def isolated_memory_space_id(test_run_context):
    """Generate unique memory space ID using test run context."""
    return test_run_context.memory_space_id()


@pytest.fixture(scope="function")
def isolated_user_id(test_run_context):
    """Generate unique user ID using test run context."""
    return test_run_context.user_id()


@pytest.fixture(scope="function")
def isolated_agent_id(test_run_context):
    """Generate unique agent ID using test run context."""
    return test_run_context.agent_id()


@pytest.fixture(scope="function")
def isolated_conversation_id(test_run_context):
    """Generate unique conversation ID using test run context."""
    return test_run_context.conversation_id()


@pytest.fixture(scope="function")
def isolated_context_id(test_run_context):
    """Generate unique context ID using test run context."""
    return test_run_context.context_id()


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
