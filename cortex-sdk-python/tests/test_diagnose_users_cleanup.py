"""
Diagnostic test to understand why users aren't being purged.
"""

import pytest

from tests.helpers import TestCleanup, generate_test_user_id


@pytest.mark.asyncio
async def test_diagnose_users_list(cortex_client):
    """Diagnose what happens when we list users."""
    user_id = generate_test_user_id()

    print("\n" + "=" * 70)
    print("DIAGNOSTIC: Users List & Cleanup")
    print("=" * 70)

    # Create a test user
    print(f"\n1. Creating user: {user_id}")
    await cortex_client.users.update(user_id, {"name": "Diagnostic Test User"})

    # Verify it exists
    print("2. Verifying user exists...")
    user = await cortex_client.users.get(user_id)
    assert user is not None
    print(f"   ✓ User exists: {user_id}")

    # Try to list users
    print("\n3. Listing users...")
    try:
        result = await cortex_client.users.list(limit=1000)
        print("   ✓ users.list() succeeded")
        print(f"   Type of result: {type(result)}")
        print(f"   Result keys: {result.keys() if isinstance(result, dict) else 'N/A'}")

        users = result if isinstance(result, list) else result.get("users", [])
        print(f"   Number of users: {len(users)}")

        # Show first few users
        test_users = [u for u in users if (u.get("id") if isinstance(u, dict) else u.id).startswith("test-user-")]
        print(f"   Test users found: {len(test_users)}")

        for i, u in enumerate(test_users[:3], 1):
            uid = u.get("id") if isinstance(u, dict) else u.id
            print(f"     {i}. {uid}")

        # Check if our user is in the list
        our_user = [u for u in users if (u.get("id") if isinstance(u, dict) else u.id) == user_id]
        if our_user:
            print(f"   ✓ Our user {user_id} is in the list")
        else:
            print(f"   ⚠ Our user {user_id} NOT in the list!")

    except Exception as e:
        print(f"   ❌ users.list() failed with error: {e}")
        print(f"   Error type: {type(e)}")
        import traceback
        traceback.print_exc()

    # Try cleanup
    print("\n4. Testing cleanup...")
    cleanup = TestCleanup(cortex_client)

    try:
        count = await cleanup.purge_users(prefix="test-user-")
        print(f"   Purged {count} users")

        if count == 0:
            print("   ⚠ No users were purged - investigating why...")

            # Try listing again to see what's there
            result2 = await cortex_client.users.list(limit=1000)
            users2 = result2 if isinstance(result2, list) else result2.get("users", [])
            test_users2 = [u for u in users2 if (u.get("id") if isinstance(u, dict) else u.id).startswith("test-user-")]
            print(f"   Still {len(test_users2)} test users in database")

    except Exception as e:
        print(f"   ❌ Cleanup failed: {e}")
        import traceback
        traceback.print_exc()

    # Final check
    print("\n5. Final verification...")
    user_check = await cortex_client.users.get(user_id)
    if user_check is None:
        print(f"   ✓ User {user_id} was deleted")
    else:
        print(f"   ⚠ User {user_id} still exists")

    print("\n" + "=" * 70 + "\n")

