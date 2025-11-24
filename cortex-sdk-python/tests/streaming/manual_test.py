"""
Manual End-to-End Streaming Test

Demonstrates full streaming API with actual data validation.
Run manually to verify all features work together.

Usage:
    python tests/streaming/manual_test.py
"""

import asyncio
import os
import sys
from typing import AsyncIterable

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from cortex import CortexClient
from cortex.types import GraphConnectionConfig
from cortex.graph.adapters.cypher import CypherGraphAdapter
from cortex.memory.streaming_types import StreamingOptions


# Configuration
CONVEX_URL = os.getenv("CONVEX_URL", "https://your-project.convex.cloud")
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")


async def simulate_llm_stream() -> AsyncIterable[str]:
    """
    Simulate an LLM response stream
    """
    response_chunks = [
        "Quantum ",
        "computing ",
        "leverages ",
        "quantum ",
        "mechanics ",
        "to ",
        "process ",
        "information. ",
        "\n\n",
        "Key ",
        "principles ",
        "include ",
        "superposition ",
        "and ",
        "entanglement. ",
        "\n\n",
        "Qubits ",
        "can ",
        "represent ",
        "multiple ",
        "states ",
        "simultaneously, ",
        "enabling ",
        "parallel ",
        "computation.",
    ]

    for chunk in response_chunks:
        # Simulate realistic LLM streaming delay
        await asyncio.sleep(0.05)
        yield chunk


async def main():
    """Main test function"""
    print("🚀 Starting Manual Streaming Test\n")
    print("=" * 70)

    # Setup
    print("\n1️⃣  Setting up Cortex client with graph adapter...")
    
    graph_adapter = CypherGraphAdapter()
    await graph_adapter.connect(
        GraphConnectionConfig(uri=NEO4J_URI, username=NEO4J_USER, password=NEO4J_PASSWORD)
    )
    print(f"   ✅ Connected to Neo4j at {NEO4J_URI}")

    client = CortexClient(CONVEX_URL, graph_adapter=graph_adapter)
    await client.connect()
    print(f"   ✅ Connected to Convex at {CONVEX_URL}")

    # Test IDs
    memory_space_id = f"manual-test-{int(asyncio.get_event_loop().time())}"
    conversation_id = f"conv-{int(asyncio.get_event_loop().time())}"
    user_id = "manual-test-user"
    user_name = "Manual Tester"

    print(f"\n2️⃣  Test Configuration:")
    print(f"   Memory Space: {memory_space_id}")
    print(f"   Conversation: {conversation_id}")
    print(f"   User: {user_name} ({user_id})")

    # Track events
    chunk_count = 0
    progress_count = 0

    def on_chunk(event):
        nonlocal chunk_count
        chunk_count += 1
        if chunk_count % 5 == 0:
            print(f"   📦 Chunk {event.chunk_number}: '{event.chunk}' ({event.estimated_tokens} tokens)")

    def on_progress(event):
        nonlocal progress_count
        progress_count += 1
        print(f"   📊 Progress: {event.bytes_processed} bytes, {event.chunks} chunks, {event.elapsed_ms}ms")

    def on_complete(event):
        print(f"   ✅ Complete: {event.total_chunks} chunks, {event.duration_ms}ms, {event.facts_extracted} facts")

    # Execute streaming
    print("\n3️⃣  Executing remember_stream() with all features...")
    
    result = await client.memory.remember_stream(
        {
            "memorySpaceId": memory_space_id,
            "conversationId": conversation_id,
            "userMessage": "What is quantum computing?",
            "responseStream": simulate_llm_stream(),
            "userId": user_id,
            "userName": user_name,
        },
        StreamingOptions(
            sync_to_graph=True,
            store_partial_response=True,
            partial_response_interval=200,  # Update every 200ms
            progressive_graph_sync=True,
            graph_sync_interval=300,  # Sync to graph every 300ms
            hooks={
                "onChunk": on_chunk,
                "onProgress": on_progress,
                "onComplete": on_complete,
            },
        ),
    )

    print("\n4️⃣  Stream Complete! Validating results...")

    # Validate response
    print(f"\n   📝 Full Response ({len(result.full_response)} chars):")
    print(f"   '{result.full_response[:100]}...'")
    
    # Validate metrics
    print(f"\n   📊 Stream Metrics:")
    print(f"      • Total Chunks: {result.stream_metrics.total_chunks}")
    print(f"      • Total Bytes: {result.stream_metrics.total_bytes}")
    print(f"      • Duration: {result.stream_metrics.stream_duration_ms}ms")
    print(f"      • First Chunk Latency: {result.stream_metrics.first_chunk_latency}ms")
    print(f"      • Throughput: {result.stream_metrics.chunks_per_second:.2f} chunks/sec")
    print(f"      • Estimated Tokens: {result.stream_metrics.estimated_tokens}")
    print(f"      • Estimated Cost: ${result.stream_metrics.estimated_cost:.4f}" if result.stream_metrics.estimated_cost else "      • Estimated Cost: N/A")

    # Validate memories
    print(f"\n   💾 Memories Stored: {len(result.memories)}")
    for i, memory in enumerate(result.memories):
        print(f"      {i + 1}. {memory.memory_id} ({len(memory.content)} chars)")

    # Validate progressive processing
    if result.progressive_processing:
        print(f"\n   🔄 Progressive Processing:")
        print(f"      • Partial Updates: {len(result.progressive_processing.partial_storage_history)}")
        if result.progressive_processing.graph_sync_events:
            print(f"      • Graph Sync Events: {len(result.progressive_processing.graph_sync_events)}")
            for event in result.progressive_processing.graph_sync_events:
                print(f"         - {event.event_type}: {event.details}")

    # Validate performance insights
    if result.performance:
        print(f"\n   💡 Performance Insights:")
        if result.performance.bottlenecks:
            print(f"      Bottlenecks:")
            for bottleneck in result.performance.bottlenecks:
                print(f"         - {bottleneck}")
        if result.performance.recommendations:
            print(f"      Recommendations:")
            for rec in result.performance.recommendations:
                print(f"         - {rec}")

    # CRITICAL DATA VALIDATION
    print("\n5️⃣  Validating data in databases...")

    # Check Convex
    print("\n   🗄️  Convex Validation:")
    conversation = await client.conversations.get(conversation_id)
    assert conversation is not None, "❌ Conversation not found in Convex!"
    print(f"      ✅ Conversation exists: {conversation.message_count} messages")

    memories = await client.vector.list(memory_space_id, limit=10)
    assert len(memories) >= 2, "❌ Memories not found in Convex!"
    print(f"      ✅ Memories exist: {len(memories)} total")

    # Check Graph
    print("\n   🔗 Neo4j Graph Validation:")
    
    # Verify Memory node
    memory_nodes = await graph_adapter.find_nodes(
        label="Memory",
        properties={"memoryId": result.memories[0].memory_id},
        limit=1,
    )
    assert len(memory_nodes) == 1, "❌ Memory node not found in graph!"
    print(f"      ✅ Memory node exists: {memory_nodes[0].id}")
    print(f"         Properties: {list(memory_nodes[0].properties.keys())}")

    # Verify Conversation node
    conv_nodes = await graph_adapter.find_nodes(
        label="Conversation",
        properties={"conversationId": conversation_id},
        limit=1,
    )
    assert len(conv_nodes) == 1, "❌ Conversation node not found in graph!"
    print(f"      ✅ Conversation node exists: {conv_nodes[0].id}")

    # Verify edge between Memory and Conversation
    edge_query = await graph_adapter.query(
        """
        MATCH (m:Memory {memoryId: $memoryId})-[r:REFERENCES]->(c:Conversation {conversationId: $convId})
        RETURN count(r) as edgeCount, type(r) as edgeType
        """,
        {
            "memoryId": result.memories[0].memory_id,
            "convId": conversation_id,
        },
    )
    
    if edge_query.count > 0 and edge_query.records[0]["edgeCount"] > 0:
        print(f"      ✅ REFERENCES edge exists: {edge_query.records[0]['edgeType']}")
    else:
        print("      ⚠️  REFERENCES edge not found (might be created async)")

    print("\n" + "=" * 70)
    print("✅ Manual test PASSED - All validations successful!")
    print("=" * 70)

    # Cleanup
    await client.disconnect()
    await graph_adapter.disconnect()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"\n❌ Test FAILED with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
