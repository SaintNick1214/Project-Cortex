"""
Session-level hooks for test setup and cleanup.

This module provides pytest hooks that run BEFORE and AFTER all tests.
"""

import asyncio
import os


def pytest_sessionstart(session):
    """
    Called before test collection.
    Always runs database cleanup to ensure clean slate.
    """
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
    Always runs database cleanup to prevent data bloat.
    """
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

