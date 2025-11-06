"""
Manual cleanup verification test.

This test creates data, shows what exists, cleans it up, and verifies it's gone.
Run this to manually verify cleanup helpers are working correctly.
"""

import pytest
from tests.helpers import TestCleanup, create_test_memory_input, create_test_conversation_input


@pytest.mark.asyncio
async def test_manual_cleanup_verification(cortex_client, test_ids):
    """
    Manual verification of cleanup helper functionality.
    
    This test:
    1. Creates test data in all layers
    2. Shows what exists
    3. Runs cleanup
    4. Verifies data is gone
    """
    memory_space_id = test_ids["memory_space_id"]
    user_id = test_ids["user_id"]
    
    cleanup = TestCleanup(cortex_client)
    
    print("\n" + "=" * 70)
    print("MANUAL CLEANUP VERIFICATION")
    print("=" * 70)
    
    # ========================================================================
    # STEP 1: Create test data
    # ========================================================================
    print("\n📝 STEP 1: Creating test data...")
    
    # Create conversation
    conv_input = create_test_conversation_input(
        memory_space_id=memory_space_id,
        user_id=user_id,
        participant_id=test_ids["agent_id"],
    )
    conv = await cortex_client.conversations.create(conv_input)
    conv_id = conv.get("conversation_id") if isinstance(conv, dict) else conv.conversation_id
    print(f"  ✓ Created conversation: {conv_id}")
    
    # Create memory
    memory_input = create_test_memory_input(content="Manual verification test memory")
    memory = await cortex_client.vector.store(memory_space_id, memory_input)
    mem_id = memory.get("memory_id") if isinstance(memory, dict) else memory.memory_id
    print(f"  ✓ Created memory: {mem_id}")
    
    # Create user
    await cortex_client.users.update(user_id, {"name": "Cleanup Verification User"})
    print(f"  ✓ Created user: {user_id}")
    
    # ========================================================================
    # STEP 2: Verify data exists
    # ========================================================================
    print("\n🔍 STEP 2: Verifying data exists...")
    
    # Check conversation
    found_conv = await cortex_client.conversations.get(conv_id)
    assert found_conv is not None
    print(f"  ✓ Conversation exists: {conv_id}")
    
    # Check memory
    found_mem = await cortex_client.vector.get(memory_space_id, mem_id)
    assert found_mem is not None
    print(f"  ✓ Memory exists: {mem_id}")
    
    # Check user
    found_user = await cortex_client.users.get(user_id)
    assert found_user is not None
    print(f"  ✓ User exists: {user_id}")
    
    # Count items in memory space
    conv_count = await cortex_client.conversations.count(memory_space_id=memory_space_id)
    print(f"\n📊 Memory space {memory_space_id}:")
    print(f"  - Conversations: {conv_count}")
    
    # ========================================================================
    # STEP 3: Run cleanup
    # ========================================================================
    print("\n🧹 STEP 3: Running cleanup...")
    
    # Purge memory space
    purge_result = await cleanup.purge_memory_space(memory_space_id, delete_all=True)
    print(f"  Purged from memory space:")
    print(f"    - Conversations: {purge_result['conversations']}")
    print(f"    - Memories: {purge_result['memories']}")
    print(f"    - Facts: {purge_result['facts']}")
    print(f"    - Immutable: {purge_result['immutable']}")
    print(f"    - Mutable: {purge_result['mutable']}")
    
    # Purge user
    user_count = await cleanup.purge_users(prefix="test-user-")
    print(f"  Purged users: {user_count}")
    
    # ========================================================================
    # STEP 4: Verify data is gone
    # ========================================================================
    print("\n✅ STEP 4: Verifying data is gone...")
    
    # Check conversation
    found_conv = await cortex_client.conversations.get(conv_id)
    if found_conv is None:
        print(f"  ✓ Conversation deleted: {conv_id}")
    else:
        print(f"  ⚠ Conversation still exists: {conv_id}")
    
    # Check memory
    try:
        found_mem = await cortex_client.vector.get(memory_space_id, mem_id)
        if found_mem is None:
            print(f"  ✓ Memory deleted: {mem_id}")
        else:
            print(f"  ⚠ Memory still exists: {mem_id}")
    except Exception as e:
        print(f"  ✓ Memory deleted (not found): {mem_id}")
    
    # Check user
    found_user = await cortex_client.users.get(user_id)
    if found_user is None:
        print(f"  ✓ User deleted: {user_id}")
    else:
        print(f"  ⚠ User still exists: {user_id}")
    
    # Verify empty
    verification = await cleanup.verify_empty(memory_space_id)
    print(f"\n📊 Verification results:")
    print(f"  - Conversations empty: {verification['conversations_empty']} (count: {verification['conversations_count']})")
    print(f"  - Memories empty: {verification['memories_empty']} (count: {verification['memories_count']})")
    print(f"  - Facts empty: {verification['facts_empty']} (count: {verification['facts_count']})")
    print(f"  - Immutable empty: {verification['immutable_empty']} (count: {verification['immutable_count']})")
    print(f"  - Mutable empty: {verification['mutable_empty']} (count: {verification['mutable_count']})")
    
    # ========================================================================
    # STEP 5: Summary
    # ========================================================================
    print("\n" + "=" * 70)
    
    all_empty = all([
        verification['conversations_empty'],
        verification['memories_empty'],
        verification['facts_empty'],
        verification['immutable_empty'],
        verification['mutable_empty'],
    ])
    
    if all_empty:
        print("✅ SUCCESS: All test data cleaned up correctly!")
    else:
        print("⚠ WARNING: Some data remains:")
        if not verification['conversations_empty']:
            print(f"  - Conversations: {verification['conversations_count']} remain")
        if not verification['memories_empty']:
            print(f"  - Memories: {verification['memories_count']} remain")
        if not verification['facts_empty']:
            print(f"  - Facts: {verification['facts_count']} remain")
        if not verification['immutable_empty']:
            print(f"  - Immutable: {verification['immutable_count']} remain")
        if not verification['mutable_empty']:
            print(f"  - Mutable: {verification['mutable_count']} remain")
    
    print("=" * 70 + "\n")
    
    # Final assertion
    assert all_empty, f"Cleanup did not remove all data: {verification}"


@pytest.mark.asyncio
async def test_list_all_data_in_space(cortex_client, test_ids):
    """
    Helper test to see what data exists in a memory space.
    
    Run this to inspect current state of test data.
    """
    memory_space_id = test_ids["memory_space_id"]
    
    print("\n" + "=" * 70)
    print(f"DATA INSPECTION: {memory_space_id}")
    print("=" * 70)
    
    # List conversations
    try:
        convs = await cortex_client.conversations.list(memory_space_id=memory_space_id, limit=100)
        conversations = convs if isinstance(convs, list) else convs.get("conversations", [])
        print(f"\n📋 Conversations ({len(conversations)}):")
        for i, conv in enumerate(conversations[:5], 1):  # Show first 5
            conv_id = conv.get("conversation_id") if isinstance(conv, dict) else conv.conversation_id
            space = conv.get("memory_space_id") if isinstance(conv, dict) else conv.memory_space_id
            print(f"  {i}. {conv_id} (space: {space})")
        if len(conversations) > 5:
            print(f"  ... and {len(conversations) - 5} more")
    except Exception as e:
        print(f"\n📋 Conversations: Error listing - {e}")
    
    # List memories
    try:
        mems = await cortex_client.vector.list(memory_space_id=memory_space_id, limit=100)
        memories = mems if isinstance(mems, list) else mems.get("memories", [])
        print(f"\n🧠 Memories ({len(memories)}):")
        for i, mem in enumerate(memories[:5], 1):
            mem_id = mem.get("memory_id") if isinstance(mem, dict) else mem.memory_id
            content = mem.get("content") if isinstance(mem, dict) else mem.content
            print(f"  {i}. {mem_id}: {content[:50]}...")
        if len(memories) > 5:
            print(f"  ... and {len(memories) - 5} more")
    except Exception as e:
        print(f"\n🧠 Memories: Error listing - {e}")
    
    # List facts
    try:
        fcts = await cortex_client.facts.list(memory_space_id=memory_space_id, limit=100)
        facts = fcts if isinstance(fcts, list) else fcts.get("facts", [])
        print(f"\n📌 Facts ({len(facts)}):")
        for i, fact in enumerate(facts[:5], 1):
            fact_id = fact.get("fact_id") if isinstance(fact, dict) else getattr(fact, "fact_id", "unknown")
            fact_text = fact.get("fact") if isinstance(fact, dict) else getattr(fact, "fact", "unknown")
            print(f"  {i}. {fact_id}: {fact_text}")
        if len(facts) > 5:
            print(f"  ... and {len(facts) - 5} more")
    except Exception as e:
        print(f"\n📌 Facts: Error listing - {e}")
    
    # List immutable
    try:
        imm = await cortex_client.immutable.list(memory_space_id=memory_space_id, limit=100)
        immutable = imm if isinstance(imm, list) else imm.get("records", [])
        print(f"\n💾 Immutable ({len(immutable)}):")
        for i, rec in enumerate(immutable[:5], 1):
            rec_id = rec.get("record_id") if isinstance(rec, dict) else rec.record_id
            print(f"  {i}. {rec_id}")
        if len(immutable) > 5:
            print(f"  ... and {len(immutable) - 5} more")
    except Exception as e:
        print(f"\n💾 Immutable: Error listing - {e}")
    
    # List mutable
    try:
        mut = await cortex_client.mutable.list(memory_space_id=memory_space_id, limit=100)
        mutable = mut if isinstance(mut, list) else mut.get("records", [])
        print(f"\n🔄 Mutable ({len(mutable)}):")
        for i, rec in enumerate(mutable[:5], 1):
            key = rec.get("key") if isinstance(rec, dict) else rec.key
            value = rec.get("value") if isinstance(rec, dict) else rec.value
            print(f"  {i}. {key}: {value}")
        if len(mutable) > 5:
            print(f"  ... and {len(mutable) - 5} more")
    except Exception as e:
        print(f"\n🔄 Mutable: Error listing - {e}")
    
    print("\n" + "=" * 70 + "\n")

