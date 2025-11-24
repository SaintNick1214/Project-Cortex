/**
 * Manual test script for streaming functionality
 * Run with: npx tsx tests/streaming/manual-test.ts
 */

import { Cortex } from "../../src";

async function main() {
  console.log("🧪 Testing RememberStream API...\n");

  const cortex = new Cortex({
    convexUrl: process.env.CONVEX_URL || "http://127.0.0.1:3210",
  });

  // Test 1: Basic streaming
  console.log("📝 Test 1: Basic streaming");
  async function* testStream1() {
    yield "Hello ";
    yield "from ";
    yield "streaming ";
    yield "API!";
  }

  try {
    const result1 = await cortex.memory.rememberStream({
      memorySpaceId: "manual-test-space",
      conversationId: `manual-test-${Date.now()}`,
      userMessage: "Say hello",
      responseStream: testStream1(),
      userId: "manual-test-user",
      userName: "Manual Tester",
    });

    console.log("✅ Basic streaming test passed");
    console.log(`   Full response: "${result1.fullResponse}"`);
    console.log(`   Chunks processed: ${result1.streamMetrics.totalChunks}`);
    console.log(`   Memories created: ${result1.memories.length}`);
    console.log(`   Stream duration: ${result1.streamMetrics.streamDurationMs}ms\n`);
  } catch (error) {
    console.error("❌ Basic streaming test failed:", error);
    process.exit(1);
  }

  // Test 2: Streaming with hooks
  console.log("📝 Test 2: Streaming with hooks");
  let chunkCount = 0;
  let progressUpdates = 0;

  async function* testStream2() {
    for (let i = 0; i < 12; i++) {
      yield `chunk${i} `;
    }
  }

  try {
    const result2 = await cortex.memory.rememberStream(
      {
        memorySpaceId: "manual-test-space",
        conversationId: `manual-hooks-${Date.now()}`,
        userMessage: "Test hooks",
        responseStream: testStream2(),
        userId: "manual-test-user",
        userName: "Manual Tester",
      },
      {
        hooks: {
          onChunk: (event) => {
            chunkCount++;
          },
          onProgress: (event) => {
            progressUpdates++;
          },
          onComplete: (event) => {
            console.log(`   Stream completed: ${event.totalChunks} chunks`);
          },
        },
      },
    );

    console.log("✅ Hooks test passed");
    console.log(`   Chunks received via hook: ${chunkCount}`);
    console.log(`   Progress updates: ${progressUpdates}`);
    console.log(`   Metrics show ${result2.streamMetrics.totalChunks} total chunks\n`);
  } catch (error) {
    console.error("❌ Hooks test failed:", error);
    process.exit(1);
  }

  // Test 3: Performance metrics
  console.log("📝 Test 3: Performance metrics");
  async function* testStream3() {
    yield "A".repeat(100);
    yield "B".repeat(200);
    yield "C".repeat(150);
  }

  try {
    const result3 = await cortex.memory.rememberStream({
      memorySpaceId: "manual-test-space",
      conversationId: `manual-metrics-${Date.now()}`,
      userMessage: "Test metrics",
      responseStream: testStream3(),
      userId: "manual-test-user",
      userName: "Manual Tester",
    });

    console.log("✅ Metrics test passed");
    console.log("   Stream Metrics:");
    console.log(`     - Total chunks: ${result3.streamMetrics.totalChunks}`);
    console.log(`     - Total bytes: ${result3.streamMetrics.totalBytes}`);
    console.log(`     - Average chunk size: ${result3.streamMetrics.averageChunkSize.toFixed(2)}`);
    console.log(`     - Estimated tokens: ${result3.streamMetrics.estimatedTokens}`);
    console.log(`     - First chunk latency: ${result3.streamMetrics.firstChunkLatency}ms`);
    
    if (result3.performance) {
      console.log("   Performance Insights:");
      if (result3.performance.bottlenecks.length > 0) {
        console.log(`     - Bottlenecks: ${result3.performance.bottlenecks.join(", ")}`);
      } else {
        console.log("     - No bottlenecks detected");
      }
      if (result3.performance.recommendations.length > 0) {
        console.log(`     - Recommendations: ${result3.performance.recommendations.join(", ")}`);
      }
    }
    console.log();
  } catch (error) {
    console.error("❌ Metrics test failed:", error);
    process.exit(1);
  }

  // Test 4: Error handling
  console.log("📝 Test 4: Error handling (empty stream)");
  async function* emptyStream() {
    // Yields nothing
  }

  try {
    await cortex.memory.rememberStream({
      memorySpaceId: "manual-test-space",
      conversationId: `manual-empty-${Date.now()}`,
      userMessage: "Empty test",
      responseStream: emptyStream(),
      userId: "manual-test-user",
      userName: "Manual Tester",
    });
    console.error("❌ Empty stream test should have thrown an error");
    process.exit(1);
  } catch (error) {
    console.log("✅ Error handling test passed");
    console.log(`   Correctly rejected empty stream: ${(error as Error).message}\n`);
  }

  console.log("═══════════════════════════════════════════════════");
  console.log("🎉 All manual tests passed!");
  console.log("═══════════════════════════════════════════════════");
  
  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
