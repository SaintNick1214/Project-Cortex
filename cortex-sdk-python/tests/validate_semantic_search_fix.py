"""
Validation Script: Semantic Search Fix
Runs 20 iterations to validate consistency of role-based weighting

This script:
1. Stores test memories with user/agent roles
2. Performs semantic search 20 times
3. Measures similarity scores for each iteration
4. Validates that user messages rank higher than agent responses
5. Generates statistics on consistency
"""

import asyncio
import os
import sys
from typing import List, Dict, Any
from statistics import mean, stdev

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cortex import Cortex, CortexConfig, RememberParams, SearchOptions
from tests.helpers.embeddings import generate_embedding, summarize_conversation


async def validate_semantic_search_fix():
    """Run 20 iterations of semantic search to validate fix consistency."""
    
    # Check environment
    api_key = os.getenv("OPENAI_API_KEY")
    convex_url = os.getenv("CONVEX_URL", "")
    
    if not api_key:
        print("❌ OPENAI_API_KEY not set - cannot run validation")
        return False
    
    if "localhost" in convex_url or "127.0.0.1" in convex_url:
        print("❌ Running against LOCAL instance - validation requires MANAGED mode")
        print(f"   Current CONVEX_URL: {convex_url}")
        print("   Please set CONVEX_URL to your managed deployment")
        return False
    
    print("=" * 80)
    print("SEMANTIC SEARCH FIX VALIDATION")
    print("=" * 80)
    print(f"✅ OpenAI API Key: Set")
    print(f"✅ Convex URL: {convex_url} (MANAGED)")
    print(f"🔄 Iterations: 20")
    print()
    
    # Initialize Cortex
    cortex = Cortex(CortexConfig(convex_url=convex_url))
    
    # Test data - same as test_openai_recalls_facts_using_semantic_search
    memory_space_id = f"test-space-{int(asyncio.get_event_loop().time() * 1000)}"
    user_id = "test-user-1"
    conversation_id = f"test-conv-{int(asyncio.get_event_loop().time() * 1000)}"
    
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
    
    print("📊 STEP 1: Store test memories with role tracking")
    print("-" * 80)
    
    try:
        # Store memories
        for i, conv in enumerate(conversations, 1):
            print(f"  [{i}/5] Storing: {conv['fact']}")
            await cortex.memory.remember(
                RememberParams(
                    memory_space_id=memory_space_id,
                    conversation_id=f"{conversation_id}-{i}",
                    user_message=conv["user"],
                    agent_response=conv["agent"],
                    user_id=user_id,
                    user_name="Alex Johnson",
                    generate_embedding=generate_embedding,
                    extract_content=summarize_conversation,
                    importance=100 if conv["fact"] == "api-password" else 70,
                    tags=[conv["fact"], "validation-test"],
                )
            )
        
        print(f"\n✅ Stored {len(conversations)} conversation exchanges (10 total memories)")
        
    except Exception as e:
        print(f"\n❌ Failed to store memories: {e}")
        return False
    
    # Wait for Convex to index
    print("\n⏳ Waiting 2 seconds for indexing...")
    await asyncio.sleep(2)
    
    print("\n" + "=" * 80)
    print("📊 STEP 2: Run 20 iterations of semantic search")
    print("=" * 80)
    
    # The critical query that was failing
    query = "what should I address the user as"
    expected_content = "alex"
    
    print(f"\nQuery: '{query}'")
    print(f"Expected: Memory containing '{expected_content}' (user message)")
    print(f"Avoid: Agent responses like 'I've noted your email address'\n")
    
    # Run 20 iterations
    results_data: List[Dict[str, Any]] = []
    
    for iteration in range(1, 21):
        try:
            # Generate fresh embedding for each iteration
            query_embedding = await generate_embedding(query)
            
            # Perform search
            results = await cortex.memory.search(
                memory_space_id,
                query,
                SearchOptions(
                    embedding=query_embedding,
                    user_id=user_id,
                    limit=10,
                ),
            )
            
            if not results:
                print(f"  ❌ Iteration {iteration:2d}: No results returned")
                results_data.append({
                    "iteration": iteration,
                    "success": False,
                    "error": "No results",
                })
                continue
            
            # Analyze top result
            top_result = results[0]
            content = top_result.content.lower()
            has_expected = expected_content in content
            score = getattr(top_result, "_score", None) or getattr(top_result, "score", None)
            message_role = getattr(top_result, "message_role", None)
            
            # Find if expected content exists in results and at what rank
            expected_rank = None
            expected_score = None
            for i, r in enumerate(results):
                if expected_content in r.content.lower():
                    expected_rank = i + 1
                    expected_score = getattr(r, "_score", None) or getattr(r, "score", None)
                    break
            
            # Record data
            result_data = {
                "iteration": iteration,
                "success": has_expected,
                "top_score": score,
                "top_role": message_role,
                "top_content": top_result.content[:60],
                "expected_rank": expected_rank,
                "expected_score": expected_score,
            }
            results_data.append(result_data)
            
            # Print progress
            status = "✅" if has_expected else "❌"
            role_icon = "👤" if message_role == "user" else "🤖" if message_role == "agent" else "⚙️"
            score_str = f"{score:.4f}" if score else "N/A"
            
            print(f"  {status} Iteration {iteration:2d}: Score={score_str} Role={role_icon} '{top_result.content[:50]}...'")
            
        except Exception as e:
            print(f"  ❌ Iteration {iteration:2d}: Error - {e}")
            results_data.append({
                "iteration": iteration,
                "success": False,
                "error": str(e),
            })
    
    print("\n" + "=" * 80)
    print("📊 STEP 3: Analyze results")
    print("=" * 80)
    
    # Calculate statistics
    successful_runs = [r for r in results_data if r.get("success")]
    total_runs = len(results_data)
    success_count = len(successful_runs)
    success_rate = (success_count / total_runs * 100) if total_runs > 0 else 0
    
    # Score statistics
    scores = [r["top_score"] for r in successful_runs if r.get("top_score") is not None]
    user_scores = [r["top_score"] for r in successful_runs if r.get("top_role") == "user" and r.get("top_score") is not None]
    agent_scores = [r["top_score"] for r in results_data if r.get("top_role") == "agent" and r.get("top_score") is not None]
    
    print(f"\n🎯 Overall Success Rate: {success_count}/{total_runs} ({success_rate:.1f}%)")
    
    if scores:
        print(f"\n📈 Similarity Scores:")
        print(f"   All top results:  Mean={mean(scores):.4f}, StdDev={stdev(scores) if len(scores) > 1 else 0:.4f}")
        if user_scores:
            print(f"   User messages:    Mean={mean(user_scores):.4f}, StdDev={stdev(user_scores) if len(user_scores) > 1 else 0:.4f}")
        if agent_scores:
            print(f"   Agent responses:  Mean={mean(agent_scores):.4f}, StdDev={stdev(agent_scores) if len(agent_scores) > 1 else 0:.4f}")
    
    # Role distribution
    role_counts = {}
    for r in successful_runs:
        role = r.get("top_role", "unknown")
        role_counts[role] = role_counts.get(role, 0) + 1
    
    print(f"\n👥 Top Result Roles:")
    for role, count in sorted(role_counts.items(), key=lambda x: -x[1]):
        percentage = (count / success_count * 100) if success_count > 0 else 0
        icon = "👤" if role == "user" else "🤖" if role == "agent" else "⚙️"
        print(f"   {icon} {role:10s}: {count:2d}/{success_count} ({percentage:.1f}%)")
    
    # Expected content ranking
    expected_ranks = [r["expected_rank"] for r in results_data if r.get("expected_rank") is not None]
    if expected_ranks:
        print(f"\n🎯 '{expected_content}' Ranking:")
        print(f"   Ranked #1: {expected_ranks.count(1)}/{len(expected_ranks)} times")
        print(f"   Average rank: {mean(expected_ranks):.2f}")
        rank_distribution = {}
        for rank in expected_ranks:
            rank_distribution[rank] = rank_distribution.get(rank, 0) + 1
        print(f"   Distribution: {rank_distribution}")
    
    print("\n" + "=" * 80)
    print("📊 VALIDATION RESULT")
    print("=" * 80)
    
    # Determine if fix is valid
    fix_valid = success_rate >= 95.0  # 95% success rate threshold
    role_correct = role_counts.get("user", 0) >= (success_count * 0.9)  # 90% should be user messages
    
    if fix_valid and role_correct:
        print("\n✅ FIX VALIDATED SUCCESSFULLY!")
        print(f"   • {success_rate:.1f}% of queries found correct content")
        print(f"   • {role_counts.get('user', 0)}/{success_count} top results were user messages")
        print(f"   • Role-based weighting is working consistently")
    else:
        print("\n❌ FIX VALIDATION FAILED")
        if not fix_valid:
            print(f"   • Success rate {success_rate:.1f}% < 95% threshold")
        if not role_correct:
            print(f"   • Only {role_counts.get('user', 0)}/{success_count} top results were user messages (expected >90%)")
    
    # Cleanup
    print("\n🧹 Cleaning up test data...")
    try:
        # Use purge or deleteMany to clean up
        from cortex.types import DeleteMemorySpaceOptions
        await cortex.memory_spaces.delete(memory_space_id, DeleteMemorySpaceOptions())
        print("✅ Test data cleaned up")
    except:
        print("⚠️  Could not clean up test data automatically - please clean manually")
    
    return fix_valid and role_correct


async def main():
    """Main entry point."""
    print("\n")
    success = await validate_semantic_search_fix()
    print("\n")
    
    if success:
        print("=" * 80)
        print("🎉 VALIDATION COMPLETE - FIX IS WORKING!")
        print("=" * 80)
        sys.exit(0)
    else:
        print("=" * 80)
        print("⚠️  VALIDATION FAILED - FIX NEEDS ADJUSTMENT")
        print("=" * 80)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
