"""
Session-level hooks for test setup and cleanup.

This module provides pytest hooks that run BEFORE and AFTER all tests.

IMPORTANT: Session-level purge_all() is DISABLED for parallel test execution.
When multiple test suites run in parallel (e.g., 5 Python SDK test suites in CI),
session-level purges will delete data created by OTHER parallel suites, causing
race conditions and test failures.

The CI pipeline performs a global database purge BEFORE starting parallel tests,
so session-level cleanup is redundant. Individual tests use TestRunContext for
isolated, non-conflicting IDs.

To enable session cleanup for local single-suite runs, set:
    ENABLE_SESSION_CLEANUP=true
"""

import asyncio
import os


def _is_session_cleanup_enabled():
    """
    Check if session-level cleanup is enabled.

    Disabled by default for parallel execution safety.
    Set ENABLE_SESSION_CLEANUP=true to enable for local single-suite runs.
    """
    return os.getenv("ENABLE_SESSION_CLEANUP", "").lower() in ("true", "1", "yes")


def pytest_sessionstart(session):
    """
    Called before test collection.

    NOTE: Session-level purge is DISABLED by default for parallel execution.
    The CI pipeline performs a global purge before starting all parallel tests.
    """
    if not _is_session_cleanup_enabled():
        print("\n📝 [Cleanup] Session-level cleanup DISABLED (parallel-safe mode)")
        print("   Set ENABLE_SESSION_CLEANUP=true for local single-suite runs\n")
        return

    convex_url = os.getenv("CONVEX_URL")
    if not convex_url:
        return

    print("\n🧹 [Cleanup] Purging all test data before test run...")

    # Run async cleanup with timeout
    from cortex import Cortex, CortexConfig
    from tests.helpers import TestCleanup

    async def cleanup():
        client = Cortex(CortexConfig(convex_url=convex_url))
        cleanup_helper = TestCleanup(client)
        try:
            # Add timeout to prevent infinite hangs
            await asyncio.wait_for(cleanup_helper.purge_all(), timeout=60.0)
            print("✅ [Cleanup] Database ready for tests\n")
        except asyncio.TimeoutError:
            print("⚠️  [Cleanup] Timeout after 60s - proceeding with tests\n")
        except Exception as e:
            print(f"⚠️  [Cleanup] Pre-test cleanup failed: {e}\n")
        finally:
            try:
                await client.close()
            except:
                pass

    # Run the async cleanup
    try:
        asyncio.run(cleanup())
    except Exception as e:
        print(f"⚠️  [Cleanup] Failed to run cleanup: {e}\n")


def pytest_sessionfinish(session, exitstatus):
    """
    Called after all tests complete.

    NOTE: Session-level purge is DISABLED by default for parallel execution.
    The CI pipeline performs cleanup separately after all parallel tests complete.
    """
    if not _is_session_cleanup_enabled():
        # Silent - already notified at session start
        return

    convex_url = os.getenv("CONVEX_URL")
    if not convex_url:
        return

    print("\n🧹 [Cleanup] Purging all test data after test run...")

    # Run async cleanup with timeout
    from cortex import Cortex, CortexConfig
    from tests.helpers import TestCleanup

    async def cleanup():
        client = Cortex(CortexConfig(convex_url=convex_url))
        cleanup_helper = TestCleanup(client)
        try:
            # Add timeout to prevent infinite hangs
            await asyncio.wait_for(cleanup_helper.purge_all(), timeout=60.0)
            print("✅ [Cleanup] Database cleaned - test data removed\n")
        except asyncio.TimeoutError:
            print("⚠️  [Cleanup] Timeout after 60s - some data may remain\n")
        except Exception as e:
            print(f"⚠️  [Cleanup] Post-test cleanup failed: {e}\n")
        finally:
            try:
                await client.close()
            except:
                pass

    # Run the async cleanup
    try:
        asyncio.run(cleanup())
    except Exception as e:
        print(f"⚠️  [Cleanup] Failed to run cleanup: {e}\n")

