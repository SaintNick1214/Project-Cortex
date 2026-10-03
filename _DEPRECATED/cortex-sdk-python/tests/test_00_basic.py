"""
Basic connectivity and import tests.

These tests verify the SDK can be imported and basic connections work.
Run these first to validate your setup.
"""

import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

# Load .env.local
project_root = Path(__file__).parent.parent.parent
env_file = project_root / ".env.local"
if env_file.exists():
    load_dotenv(env_file)


def test_environment_variables():
    """Test that environment variables are loaded."""
    convex_url = os.getenv("CONVEX_URL")
    print(f"\nCONVEX_URL: {convex_url}")

    assert convex_url is not None, (
        "CONVEX_URL not set. Check that .env.local exists in project root "
        f"({project_root}/.env.local)"
    )
    print("✅ Environment variables loaded")


def test_imports():
    """Test that all main modules can be imported."""
    try:
        from cortex import (
            A2ASendParams,
            ContextInput,
            Cortex,
            CortexConfig,
            DeleteUserOptions,
            FactRecord,
            RememberParams,
            SearchOptions,
        )
        print("✅ All main imports successful")
    except ImportError as e:
        pytest.fail(f"Import failed: {e}")


def test_convex_client_import():
    """Test that convex package is installed."""
    try:
        from convex import ConvexClient
        print("✅ Convex client available")
    except ImportError:
        pytest.fail(
            "convex package not installed. Run: pip install convex\n"
            "Or: pip install -e '.[dev]'"
        )


@pytest.mark.asyncio
async def test_cortex_initialization():
    """Test that Cortex can be initialized."""
    from cortex import Cortex, CortexConfig

    convex_url = os.getenv("CONVEX_URL")

    try:
        cortex = Cortex(CortexConfig(convex_url=convex_url))

        # Verify basic structure
        assert cortex.client is not None
        assert cortex.memory is not None
        assert cortex.conversations is not None
        assert cortex.users is not None

        await cortex.close()
        print("✅ Cortex initialized and closed successfully")

    except Exception as e:
        pytest.fail(f"Cortex initialization failed: {e}")


@pytest.mark.asyncio
async def test_convex_connection():
    """Test basic connection to Convex backend."""
    from cortex import Cortex, CortexConfig
    from cortex.types import ListConversationsFilter

    convex_url = os.getenv("CONVEX_URL")
    cortex = Cortex(CortexConfig(convex_url=convex_url))

    try:
        # Try a simple query - list conversations
        # This should work even if no conversations exist (returns empty list)
        result = await cortex.conversations.list(ListConversationsFilter(limit=1))

        print("✅ Convex connection successful")
        print(f"   Conversations found: {len(result.conversations)}")

        assert hasattr(result, 'conversations')

    except Exception as e:
        print(f"❌ Convex connection failed: {e}")
        print(f"   Error type: {type(e).__name__}")
        print(f"   Make sure Convex backend is running at: {convex_url}")
        print("   Start with: npm run dev:local (from project root)")
        raise
    finally:
        await cortex.close()

