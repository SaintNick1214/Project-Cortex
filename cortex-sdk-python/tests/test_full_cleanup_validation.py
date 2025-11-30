"""
Full cleanup validation test.

Creates comprehensive test data, shows what exists, cleans it up,
and verifies everything is gone. Run this to validate cleanup is 100% working.
"""

import pytest

from tests.helpers import (
    TestCleanup,
    create_test_conversation_input,
    create_test_memory_input,
    generate_test_user_id,
)


@pytest.mark.asyncio
async def test_full_cleanup_validation(cortex_client, ctx):
    """
    Comprehensive cleanup validation test.
    
    Creates data in all layers, shows exact state before/after cleanup.
    Uses ctx for proper test isolation.
    """
    memory_space_id = ctx.memory_space_id()
    user_id = ctx.user_id()

    cleanup = TestCleanup(cortex_client)

    print("\n" + "=" * 80)
    print("FULL CLEANUP VALIDATION TEST")
    print("=" * 80)
    print(f"\nMemory Space: {memory_space_id}")
    print(f"User ID: {user_id}")

    # ============================================================================
    # PHASE 1: CREATE TEST DATA
    # ============================================================================
    print("\n" + "-" * 80)
    print("PHASE 1: Creating Test Data")
    print("-" * 80)

    created_items = {
        "conversations": [],
        "memories": [],
        "users": [],
    }

    # Create 3 conversations
    print("\n📝 Creating 3 conversations...")
    for i in range(3):
        conv_input = create_test_conversation_input(
            memory_space_id=memory_space_id,
            user_id=user_id,
            participant_id=f"agent-{i}",
        )
        conv = await cortex_client.conversations.create(conv_input)
        conv_id = conv.get("conversation_id") if isinstance(conv, dict) else conv.conversation_id
        created_items["conversations"].append(conv_id)
        print(f"   {i+1}. Created: {conv_id}")

    # Create 3 memories
    print("\n🧠 Creating 3 memories...")
    for i in range(3):
        memory_input = create_test_memory_input(
            content=f"Test memory {i+1}",
            importance=50 + i*10,
            tags=[f"test-{i+1}"],
        )
        memory = await cortex_client.vector.store(memory_space_id, memory_input)
        mem_id = memory.get("memory_id") if isinstance(memory, dict) else memory.memory_id
        created_items["memories"].append(mem_id)
        print(f"   {i+1}. Created: {mem_id}")

    # Create 3 users
    print("\n👥 Creating 3 test users...")
    for i in range(3):
        uid = ctx.user_id(f"user-{i}")
        await cortex_client.users.update(uid, {"name": f"Test User {i+1}"})
        created_items["users"].append(uid)
        print(f"   {i+1}. Created: {uid}")

    # ============================================================================
    # PHASE 2: VERIFY DATA EXISTS
    # ============================================================================
    print("\n" + "-" * 80)
    print("PHASE 2: Verifying Data Exists (BEFORE Cleanup)")
    print("-" * 80)

    # Count conversations
    conv_count = await cortex_client.conversations.count(memory_space_id=memory_space_id)
    print(f"\n📊 Conversations in {memory_space_id}: {conv_count}")

    # List conversations
    convs = await cortex_client.conversations.list(memory_space_id=memory_space_id, limit=100)
    for i, conv in enumerate(convs[:5], 1):
        cid = conv.get("conversation_id") if isinstance(conv, dict) else conv.conversation_id
        print(f"   {i}. {cid}")

    # Count memories
    mem_list = await cortex_client.vector.list(memory_space_id=memory_space_id, limit=100)
    memories = mem_list if isinstance(mem_list, list) else mem_list.get("memories", [])
    print(f"\n📊 Memories in {memory_space_id}: {len(memories)}")
    for i, mem in enumerate(memories[:5], 1):
        mid = mem.get("memory_id") if isinstance(mem, dict) else mem.memory_id
        content = mem.get("content") if isinstance(mem, dict) else mem.content
        print(f"   {i}. {mid}: {content[:40]}...")

    # Count users (only count THIS test run's users)
    user_list = await cortex_client.users.list(limit=1000)
    users = user_list.get("users", [])
    test_users = [u for u in users if (u.id if hasattr(u, 'id') else u.get("id")).startswith(ctx.run_id)]
    print(f"\n📊 Total users: {len(users)}, This run's users: {len(test_users)}")
    for i, u in enumerate(test_users[:5], 1):
        uid = u.id if hasattr(u, 'id') else u.get("id")
        name = u.data.get("name") if hasattr(u, 'data') else u.get("data", {}).get("name")
        print(f"   {i}. {uid}: {name}")

    # ============================================================================
    # PHASE 3: RUN CLEANUP
    # ============================================================================
    print("\n" + "-" * 80)
    print("PHASE 3: Running Cleanup")
    print("-" * 80)

    # Cleanup memory space
    print(f"\n🧹 Cleaning up memory space: {memory_space_id}")
    space_result = await cleanup.purge_memory_space(memory_space_id, delete_all=True)
    print("   Results:")
    print(f"     - Conversations deleted: {space_result['conversations']}")
    print(f"     - Memories deleted: {space_result['memories']}")
    print(f"     - Facts deleted: {space_result['facts']}")
    print(f"     - Immutable deleted: {space_result['immutable']}")
    print(f"     - Mutable deleted: {space_result['mutable']}")

    # Cleanup users (only this run's users)
    print(f"\n🧹 Cleaning up this run's users (prefix: {ctx.run_id})...")
    user_count = await cleanup.purge_users(prefix=ctx.run_id)
    print(f"   Users deleted: {user_count}")

    # ============================================================================
    # PHASE 4: VERIFY DATA IS GONE
    # ============================================================================
    print("\n" + "-" * 80)
    print("PHASE 4: Verifying Data is Gone (AFTER Cleanup)")
    print("-" * 80)

    # Check conversations
    conv_count_after = await cortex_client.conversations.count(memory_space_id=memory_space_id)
    print(f"\n📊 Conversations in {memory_space_id}: {conv_count_after}")
    if conv_count_after == 0:
        print("   ✅ All conversations deleted")
    else:
        print(f"   ⚠️ {conv_count_after} conversations remain")

    # Check memories
    mem_list_after = await cortex_client.vector.list(memory_space_id=memory_space_id, limit=100)
    memories_after = mem_list_after if isinstance(mem_list_after, list) else mem_list_after.get("memories", [])
    print(f"\n📊 Memories in {memory_space_id}: {len(memories_after)}")
    if len(memories_after) == 0:
        print("   ✅ All memories deleted")
    else:
        print(f"   ⚠️ {len(memories_after)} memories remain")
        for i, mem in enumerate(memories_after[:3], 1):
            mid = mem.get("memory_id") if isinstance(mem, dict) else mem.memory_id
            print(f"      {i}. {mid}")

    # Check users (only this run's users)
    user_list_after = await cortex_client.users.list(limit=1000)
    users_after = user_list_after.get("users", [])
    test_users_after = [u for u in users_after if (u.id if hasattr(u, 'id') else u.get("id")).startswith(ctx.run_id)]
    print(f"\n📊 Total users: {len(users_after)}, This run's users: {len(test_users_after)}")
    if len(test_users_after) == 0:
        print("   ✅ All this run's users deleted")
    else:
        print(f"   ⚠️ {len(test_users_after)} users from this run remain:")
        for i, u in enumerate(test_users_after[:5], 1):
            uid = u.id if hasattr(u, 'id') else u.get("id")
            print(f"      {i}. {uid}")

    # Verify empty
    verification = await cleanup.verify_empty(memory_space_id)

    print("\n" + "-" * 80)
    print("VERIFICATION RESULTS")
    print("-" * 80)

    # Conversations
    if verification['conversations_empty']:
        print("   Conversations: ✅ EMPTY")
    else:
        print(f"   Conversations: ⚠️  {verification['conversations_count']} remain")

    # Memories
    if verification['memories_empty']:
        print("   Memories:      ✅ EMPTY")
    else:
        print(f"   Memories:      ⚠️  {verification['memories_count']} remain")

    # Facts
    if verification['facts_empty']:
        print("   Facts:         ✅ EMPTY")
    else:
        print(f"   Facts:         ⚠️  {verification['facts_count']} remain")

    # Immutable
    if verification['immutable_empty']:
        print("   Immutable:     ✅ EMPTY")
    else:
        print(f"   Immutable:     ⚠️  {verification['immutable_count']} remain")

    # Mutable
    if verification['mutable_empty']:
        print("   Mutable:       ✅ EMPTY")
    else:
        print(f"   Mutable:       ⚠️  {verification['mutable_count']} remain")

    # Test Users
    if len(test_users_after) == 0:
        print("   Test Users:    ✅ EMPTY")
    else:
        print(f"   Test Users:    ⚠️  {len(test_users_after)} remain")

    # ============================================================================
    # PHASE 5: SUMMARY
    # ============================================================================
    print("\n" + "=" * 80)

    all_clean = (
        verification['conversations_empty'] and
        verification['memories_empty'] and
        verification['facts_empty'] and
        verification['immutable_empty'] and
        verification['mutable_empty'] and
        len(test_users_after) == 0
    )

    if all_clean:
        print("✅ SUCCESS: All test data cleaned up perfectly!")
        print(f"   - Created: {len(created_items['conversations'])} conversations, {len(created_items['memories'])} memories, {len(created_items['users'])} users")
        print(f"   - Deleted: {space_result['conversations']} conversations, {space_result['memories']} memories, {user_count} users")
        print("   - Remaining: 0 (all clean!)")
    else:
        print("⚠️ ISSUES FOUND - Some data remains:")
        if not verification['conversations_empty']:
            print(f"   - Conversations: {verification['conversations_count']} remain")
        if not verification['memories_empty']:
            print(f"   - Memories: {verification['memories_count']} remain")
        if not verification['facts_empty']:
            print(f"   - Facts: {verification['facts_count']} remain")
        if not verification['immutable_empty']:
            print(f"   - Immutable: {verification['immutable_count']} remain")
        if not verification['mutable_empty']:
            print(f"   - Mutable: {verification['mutable_count']} remain")
        if len(test_users_after) > 0:
            print(f"   - Test Users: {len(test_users_after)} remain")

    print("=" * 80 + "\n")

    # Assert all clean
    assert all_clean, "Cleanup incomplete - some data remains"

