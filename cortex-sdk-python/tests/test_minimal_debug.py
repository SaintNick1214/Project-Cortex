import pytest

@pytest.mark.asyncio
async def test_full_collect(cortex_client, ctx):
    """Debug full _collect_deletion_plan step by step."""
    print(f"\nctx.run_id: {ctx.run_id}")
    user_id = ctx.user_id("test")
    print(f"User ID: {user_id}")
    
    print("Creating user...")
    await cortex_client.users.update(user_id, {"displayName": "Test"})
    print("User created")
    
    print("\n1. conversations:list...")
    conversations_result = await cortex_client.users._execute_with_resilience(
        lambda: cortex_client.client.query(
            "conversations:list", {"userId": user_id, "limit": 100}
        ),
        "conversations:list",
    )
    if isinstance(conversations_result, dict):
        conversations = conversations_result.get("conversations", [])
    else:
        conversations = conversations_result if isinstance(conversations_result, list) else []
    print(f"   Conversations: {len(conversations)}")
    
    print("\n2. immutable:list...")
    immutable = await cortex_client.users._execute_with_resilience(
        lambda: cortex_client.client.query(
            "immutable:list", {"userId": user_id, "limit": 100}
        ),
        "immutable:list",
    )
    print(f"   Immutable count: {len(immutable) if isinstance(immutable, list) else 'dict'}")
    
    print("\n3. memorySpaces:list...")
    all_spaces = await cortex_client.users._execute_with_resilience(
        lambda: cortex_client.client.query("memorySpaces:list", {"limit": 100}),
        "memorySpaces:list",
    )
    spaces_list = all_spaces if isinstance(all_spaces, list) else all_spaces.get("spaces", [])
    print(f"   Spaces count: {len(spaces_list)}")
    
    memory_space_ids_to_check = set()
    for conv in conversations:
        space_id = conv.get("memorySpaceId")
        if space_id:
            memory_space_ids_to_check.add(space_id)
    for space in spaces_list:
        space_id = space.get("memorySpaceId")
        if space_id:
            memory_space_ids_to_check.add(space_id)
    print(f"   Total space IDs to check: {len(memory_space_ids_to_check)}")
    
    print("\n4. Collecting facts from spaces...")
    all_facts = []
    for i, space in enumerate(spaces_list):
        space_id = space.get("memorySpaceId")
        if space_id:
            print(f"   Checking space {i+1}/{len(spaces_list)}: {space_id[:50]}...")
            try:
                facts = await cortex_client.users._execute_with_resilience(
                    lambda sid=space_id: cortex_client.client.query(
                        "facts:list",
                        {"memorySpaceId": sid, "limit": 100}
                    ),
                    "facts:list",
                )
                fact_list = facts if isinstance(facts, list) else facts.get("facts", [])
                user_facts = [f for f in fact_list if f.get("userId") == user_id or f.get("sourceUserId") == user_id]
                all_facts.extend(user_facts)
                print(f"      Found {len(user_facts)} facts for user")
            except Exception as e:
                print(f"      Error: {e}")
    print(f"   Total facts: {len(all_facts)}")
    
    # Cleanup
    print("\nCleaning up...")
    await cortex_client.users.delete(user_id)
    print("Done")
