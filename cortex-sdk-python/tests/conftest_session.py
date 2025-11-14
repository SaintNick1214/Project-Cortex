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
    
    # Run async cleanup
    from cortex import Cortex, CortexConfig
    from tests.helpers import TestCleanup
    
    async def cleanup():
        client = Cortex(CortexConfig(convex_url=convex_url))
        cleanup_helper = TestCleanup(client)
        try:
            await cleanup_helper.purge_all()
            print("✅ [Cleanup] Database ready for tests\n")
        except Exception as e:
            print(f"⚠️  [Cleanup] Pre-test cleanup failed: {e}\n")
        finally:
            await client.close()
    
    # Run the async cleanup
    asyncio.run(cleanup())


def pytest_sessionfinish(session, exitstatus):
    """
    Called after all tests complete.
    Always runs database cleanup to prevent data bloat.
    """
    convex_url = os.getenv("CONVEX_URL")
    if not convex_url:
        return
    
    print("\n🧹 [Cleanup] Purging all test data after test run...")
    
    # Run async cleanup
    from cortex import Cortex, CortexConfig
    from tests.helpers import TestCleanup
    
    async def cleanup():
        client = Cortex(CortexConfig(convex_url=convex_url))
        cleanup_helper = TestCleanup(client)
        try:
            await cleanup_helper.purge_all()
            print("✅ [Cleanup] Database cleaned - test data removed\n")
        except Exception as e:
            print(f"⚠️  [Cleanup] Post-test cleanup failed: {e}\n")
        finally:
            await client.close()
    
    # Run the async cleanup
    asyncio.run(cleanup())

