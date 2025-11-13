"""
Advanced OpenAI Integration Tests for Memory API

Port of: memory.test.ts - "Advanced: Real-World Embedding & Recall"
These tests require OPENAI_API_KEY and are skipped if not available.
"""

import pytest
from cortex import RememberParams, SearchOptions
from tests.helpers import embeddings_available


@pytest.mark.asyncio
async def test_openai_stores_multiple_facts_with_real_embeddings(
    cortex_client, test_memory_space_id, test_user_id, test_conversation_id, cleanup_helper
):
    """
    Port of: memory.test.ts - "stores multiple facts with real embeddings and summarization"
    
    Scenario: Customer support conversation with 5 key facts.
    Validates that embeddings are generated and summarization works.
    """
    if not embeddings_available():
        pytest.skip("OPENAI_API_KEY not set")
    
    from tests.helpers import generate_embedding, summarize_conversation
    
    # Scenario: Customer support conversation with 5 key facts
    conversations = [
        {
            "user": "My name is Alexander Johnson and I prefer to be called Alex",
            "agent": "Got it, I'll call you Alex!",
            "fact": "user-name",
        },
        {
            "user": "My email is alex.johnson@techcorp.com for any updates",
            "agent": "I've noted your email address",
            "fact": "user-email",
        },
        {
            "user": "The API password for production is SecurePass2024!",
            "agent": "I'll remember that password securely",
            "fact": "api-password",
        },
        {
            "user": "We need the new feature deployed by Friday 5pm EST",
            "agent": "Noted - deployment deadline is Friday at 5pm EST",
            "fact": "deadline",
        },
        {
            "user": "I prefer dark mode theme and minimal notifications",
            "agent": "I'll set dark mode and reduce notifications",
            "fact": "preferences",
        },
    ]
    
    stored_memories = []
    
    # Store each with embeddings and summarization
    for conv in conversations:
        result = await cortex_client.memory.remember(
            RememberParams(
                memory_space_id=test_memory_space_id,
                conversation_id=test_conversation_id,
                user_message=conv["user"],
                agent_response=conv["agent"],
                user_id=test_user_id,
                user_name="Alex Johnson",
                generate_embedding=generate_embedding,
                extract_content=summarize_conversation,
                importance=100 if conv["fact"] == "api-password" else 70,
                tags=[conv["fact"], "customer-support"],
            )
        )
        
        stored_memories.append({
            "fact": conv["fact"],
            "memory_id": result.memories[0].memory_id,
        })
        
        # Verify embeddings were stored
        assert result.memories[0].embedding is not None
        assert len(result.memories[0].embedding) == 1536
        assert result.memories[0].content_type == "summarized"
    
    assert len(stored_memories) == 5
    
    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_openai_recalls_facts_using_semantic_search(
    cortex_client, test_memory_space_id, test_user_id, test_conversation_id, cleanup_helper
):
    """
    Port of: memory.test.ts - "recalls facts using semantic search (not keyword matching)"
    
    Test semantic understanding - queries don't match exact words but find correct facts.
    Note: This test requires MANAGED mode as LOCAL doesn't support vector search.
    """
    import os
    
    if not embeddings_available():
        pytest.skip("OPENAI_API_KEY not set")
    
    # Skip if running in LOCAL mode (no vector search support)
    convex_url = os.getenv("CONVEX_URL", "")
    if "localhost" in convex_url or "127.0.0.1" in convex_url:
        pytest.skip("Semantic search requires MANAGED mode (LOCAL doesn't support vector search)")
    
    from tests.helpers import generate_embedding, summarize_conversation
    
    # First store the facts
    conversations = [
        {"user": "My name is Alexander Johnson and I prefer to be called Alex", "agent": "Got it, I'll call you Alex!", "fact": "user-name"},
        {"user": "My email is alex.johnson@techcorp.com for any updates", "agent": "I've noted your email address", "fact": "user-email"},
        {"user": "The API password for production is SecurePass2024!", "agent": "I'll remember that password securely", "fact": "api-password"},
        {"user": "We need the new feature deployed by Friday 5pm EST", "agent": "Noted - deployment deadline is Friday at 5pm EST", "fact": "deadline"},
        {"user": "I prefer dark mode theme and minimal notifications", "agent": "I'll set dark mode and reduce notifications", "fact": "preferences"},
    ]
    
    for conv in conversations:
        await cortex_client.memory.remember(
            RememberParams(
                memory_space_id=test_memory_space_id,
                conversation_id=test_conversation_id,
                user_message=conv["user"],
                agent_response=conv["agent"],
                user_id=test_user_id,
                user_name="Alex Johnson",
                generate_embedding=generate_embedding,
                extract_content=summarize_conversation,
                importance=100 if conv["fact"] == "api-password" else 70,
                tags=[conv["fact"], "customer-support"],
            )
        )
    
    # Test semantic understanding (queries don't match exact words)
    searches = [
        {"query": "what should I address the user as", "expect_in_content": "Alex"},
        {"query": "how do I contact them electronically", "expect_in_content": "email"},
        {"query": "production system credentials", "expect_in_content": "password"},
        {"query": "when is the deployment due", "expect_in_content": "Friday"},
        {"query": "UI appearance settings", "expect_in_content": "dark mode"},
    ]
    
    for search in searches:
        results = await cortex_client.memory.search(
            test_memory_space_id,
            search["query"],
            SearchOptions(
                embedding=await generate_embedding(search["query"]),
                user_id=test_user_id,
                limit=10,  # Get more results to handle edge cases in similarity scoring
            ),
        )
        
        # Should find the relevant fact (semantic match, not keyword)
        assert len(results) > 0
        
        # Validate the TOP result (results[0]) contains the expected content
        # This ensures semantic search ranks the most relevant result first
        top_result = results[0]
        
        # If top result doesn't match, log for debugging
        if search["expect_in_content"].lower() not in top_result.content.lower():
            query_text = search['query']
            expect_text = search['expect_in_content']
            print(f"  Warning: Query '{query_text}' - Top result does not contain '{expect_text}'")
            for i, r in enumerate(results[:3]):
                has_match = "MATCH" if search["expect_in_content"].lower() in r.content.lower() else ""
                score = getattr(r, "_score", None) or getattr(r, "score", None)
                score_str = f"{score:.3f}" if score is not None else "N/A"
                content_preview = r.content[:80] if len(r.content) > 80 else r.content
                print(f"    {i + 1}. '{content_preview}...' (score: {score_str}) {has_match}")
        
        # Strict validation: Top result MUST contain expected content
        assert search["expect_in_content"].lower() in top_result.content.lower()
        
        # Log for visibility
        score = getattr(top_result, "_score", None) or getattr(top_result, "score", None)
        score_str = f"{score:.3f}" if score is not None else "N/A"
        query_text = search['query']
        content_preview = top_result.content[:60] if len(top_result.content) > 60 else top_result.content
        print(f"  Success: Query '{query_text}' found in '{content_preview}...' (score: {score_str})")
    
    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_openai_enriches_search_results_with_conversation_context(
    cortex_client, test_memory_space_id, test_user_id, test_conversation_id, cleanup_helper
):
    """
    Port of: memory.test.ts - "enriches search results with full conversation context"
    
    Validates that enrichConversation returns full ACID source with conversation details.
    """
    if not embeddings_available():
        pytest.skip("OPENAI_API_KEY not set")
    
    from tests.helpers import generate_embedding, summarize_conversation
    
    # Store one memory with conversation
    await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="The API password for production is SecurePass2024!",
            agent_response="I'll remember that password securely",
            user_id=test_user_id,
            user_name="Alex Johnson",
            generate_embedding=generate_embedding,
            extract_content=summarize_conversation,
            importance=100,
            tags=["api-password", "customer-support"],
        )
    )
    
    results = await cortex_client.memory.search(
        test_memory_space_id,
        "password",
        SearchOptions(
            embedding=await generate_embedding("password credentials"),
            enrich_conversation=True,
            user_id=test_user_id,
        ),
    )
    
    assert len(results) > 0
    
    enriched = results[0]
    
    # Check if it's enriched structure (has .memory attribute)
    if hasattr(enriched, "memory"):
        # Enriched structure exists
        assert enriched.memory is not None
        
        # Conversation may or may not exist (depends on conversationRef)
        if hasattr(enriched, "conversation") and enriched.conversation:
            assert enriched.conversation is not None
            assert hasattr(enriched, "source_messages")
            assert len(enriched.source_messages) > 0
            
            mem_content = enriched.memory.content[:40] if len(enriched.memory.content) > 40 else enriched.memory.content
            first_msg = enriched.source_messages[0]
            msg_content = first_msg.get("content") if isinstance(first_msg, dict) else first_msg.content
            src_content = msg_content[:40] if len(msg_content) > 40 else msg_content
            print(f"  Enriched Vector: '{mem_content}...'")
            print(f"  ACID source: '{src_content}...'")
        else:
            # No conversation (system memory or conversation deleted)
            mem_content = enriched.memory.content[:40] if len(enriched.memory.content) > 40 else enriched.memory.content
            print(f"  Enriched (no conversation): '{mem_content}...'")
    else:
        # Direct structure (no enrichment wrapper)
        assert enriched.content is not None
        content_preview = enriched.content[:40] if len(enriched.content) > 40 else enriched.content
        print(f"  Direct result: '{content_preview}...'")
    
    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_openai_validates_summarization_quality(
    cortex_client, test_memory_space_id, test_user_id, test_conversation_id, cleanup_helper
):
    """
    Port of: memory.test.ts - "validates summarization quality"
    
    Validates that GPT-4o-mini produces concise, accurate summaries.
    """
    if not embeddings_available():
        pytest.skip("OPENAI_API_KEY not set")
    
    from tests.helpers import generate_embedding, summarize_conversation
    
    # Store one memory with summarization
    result = await cortex_client.memory.remember(
        RememberParams(
            memory_space_id=test_memory_space_id,
            conversation_id=test_conversation_id,
            user_message="My name is Alexander Johnson and I prefer to be called Alex",
            agent_response="Got it, I'll call you Alex!",
            user_id=test_user_id,
            user_name="Alex Johnson",
            generate_embedding=generate_embedding,
            extract_content=summarize_conversation,
            importance=70,
            tags=["user-name", "customer-support"],
        )
    )
    
    memory_id = result.memories[0].memory_id
    
    # Get the summarized memory
    memory = await cortex_client.vector.get(test_memory_space_id, memory_id)
    
    assert memory is not None
    assert memory.content_type == "summarized"
    
    # Summarized content should be concise
    original = "My name is Alexander Johnson and I prefer to be called Alex"
    
    assert len(memory.content) < len(original) * 1.5
    assert "alex" in memory.content.lower()
    
    print(f"  Original: '{original}'")
    print(f"  Summarized: '{memory.content}'")
    
    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)


@pytest.mark.asyncio
async def test_openai_similarity_scores_are_realistic(
    cortex_client, test_memory_space_id, test_user_id, test_conversation_id, cleanup_helper
):
    """
    Port of: memory.test.ts - "similarity scores are realistic (0-1 range)"
    
    Validates that similarity scores are in valid 0-1 range.
    Note: This test requires MANAGED mode as LOCAL doesn't support vector search.
    """
    import os
    
    if not embeddings_available():
        pytest.skip("OPENAI_API_KEY not set")
    
    # Skip if running in LOCAL mode (no vector search support)
    convex_url = os.getenv("CONVEX_URL", "")
    if "localhost" in convex_url or "127.0.0.1" in convex_url:
        pytest.skip("Similarity scores require MANAGED mode (LOCAL doesn't support vector search)")
    
    from tests.helpers import generate_embedding, summarize_conversation
    
    # Store some memories first
    conversations = [
        {"user": "The API password for production is SecurePass2024!", "agent": "I'll remember that password securely"},
        {"user": "My email is alex.johnson@techcorp.com", "agent": "I've noted your email address"},
        {"user": "I prefer dark mode theme", "agent": "I'll set dark mode"},
    ]
    
    for conv in conversations:
        await cortex_client.memory.remember(
            RememberParams(
                memory_space_id=test_memory_space_id,
                conversation_id=test_conversation_id,
                user_message=conv["user"],
                agent_response=conv["agent"],
                user_id=test_user_id,
                user_name="Alex Johnson",
                generate_embedding=generate_embedding,
                extract_content=summarize_conversation,
                importance=80,
                tags=["test"],
            )
        )
    
    # Search with embedding
    results = await cortex_client.memory.search(
        test_memory_space_id,
        "API password for production environment",
        SearchOptions(
            embedding=await generate_embedding("API password for production environment"),
            user_id=test_user_id,
        ),
    )
    
    assert len(results) > 0
    
    # Validate scores are in valid range
    results_with_scores = [
        r for r in results 
        if (getattr(r, "_score", None) is not None or getattr(r, "score", None) is not None)
    ]
    
    assert len(results_with_scores) > 0
    
    for result in results_with_scores:
        score = getattr(result, "_score", None) or getattr(result, "score", None)
        
        assert score >= 0
        assert score <= 1
        content_preview = result.content[:30] if len(result.content) > 30 else result.content
        print(f"  Memory '{content_preview}...' score: {score:.4f}")
    
    # Cleanup
    await cleanup_helper.purge_memory_space(test_memory_space_id)

