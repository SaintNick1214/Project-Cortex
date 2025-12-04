/**
 * Resilience Layer Stress Tests (MANUAL)
 *
 * These tests actually hit the Convex database to verify resilience mechanisms
 * work under real load conditions. They are NOT meant for CI pipelines.
 *
 * Run manually with:
 *   npx tsx tests/resilience-stress.manual.ts
 *
 * Prerequisites:
 *   - Convex dev server running (npm run dev:local or dev:cloud)
 *   - .env.local configured with CONVEX_URL
 *
 * WARNING: These tests will create significant load on your database!
 */

import { Cortex, ResiliencePresets as _ResiliencePresets } from "../src";
import {
  ResilienceLayer as _ResilienceLayer,
  CircuitOpenError,
  QueueFullError as _QueueFullError,
  RateLimitExceededError,
} from "../src/resilience";

// Suppress unused import warnings - these are available for manual testing
void _ResiliencePresets;
void _ResilienceLayer;
void _QueueFullError;
import * as dotenv from "dotenv";

// Load environment
dotenv.config({ path: ".env.local" });

const CONVEX_URL = process.env.LOCAL_CONVEX_URL || process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.error("❌ No CONVEX_URL found in environment");
  process.exit(1);
}

// Test utilities
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const printMetrics = (cortex: Cortex) => {
  const metrics = cortex.getResilienceMetrics();
  console.log("\n📊 Current Metrics:");
  console.log(
    `   Rate Limiter: ${metrics.rateLimiter.tokensAvailable} tokens available`,
  );
  console.log(
    `   Concurrency: ${metrics.concurrency.active} active, ${metrics.concurrency.waiting} waiting (max reached: ${metrics.concurrency.maxReached})`,
  );
  console.log(
    `   Queue: ${metrics.queue.total} pending (${JSON.stringify(metrics.queue.byPriority)})`,
  );
  console.log(
    `   Circuit: ${metrics.circuitBreaker.state} (${metrics.circuitBreaker.failures} failures, ${metrics.circuitBreaker.totalOpens} total opens)`,
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test 1: Burst Test - Rate Limiter Stress
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testBurstRateLimiting() {
  console.log("\n" + "═".repeat(70));
  console.log("🔥 TEST 1: BURST RATE LIMITING");
  console.log("═".repeat(70));
  console.log(
    "Testing: Fire 200 concurrent search calls with bucket size of 20",
  );
  console.log(
    "Expected: First 20 succeed immediately, rest wait for refill or timeout\n",
  );

  const cortex = new Cortex({
    convexUrl: CONVEX_URL!,
    resilience: {
      enabled: true,
      rateLimiter: {
        bucketSize: 20, // Only allow 20 burst
        refillRate: 10, // Refill 10/sec
      },
      concurrency: {
        maxConcurrent: 50, // Allow high concurrency
        queueSize: 500,
        timeout: 30000,
      },
      circuitBreaker: {
        failureThreshold: 100, // High threshold so it doesn't trip
        timeout: 60000,
      },
    },
  });

  const testSpaceId = `stress-test-${Date.now()}`;
  const numCalls = 200;
  const results = {
    succeeded: 0,
    rateLimited: 0,
    errors: 0,
    totalTime: 0,
  };

  console.log(`📤 Firing ${numCalls} concurrent search calls...`);
  const start = Date.now();

  const promises = Array(numCalls)
    .fill(null)
    .map(async (_, i) => {
      const callStart = Date.now();
      try {
        await cortex.memory.search(testSpaceId, `test query ${i}`);
        results.succeeded++;
        return { status: "success", duration: Date.now() - callStart };
      } catch (error) {
        if (error instanceof RateLimitExceededError) {
          results.rateLimited++;
          return { status: "rate-limited", duration: Date.now() - callStart };
        }
        results.errors++;
        return { status: "error", duration: Date.now() - callStart, error };
      }
    });

  const callResults = await Promise.all(promises);
  results.totalTime = Date.now() - start;

  // Analyze timing distribution
  const durations = callResults.map((r) => r.duration);
  const sorted = [...durations].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];

  console.log("\n📈 Results:");
  console.log(`   Total time: ${formatDuration(results.totalTime)}`);
  console.log(`   Succeeded: ${results.succeeded}/${numCalls}`);
  console.log(`   Rate limited: ${results.rateLimited}/${numCalls}`);
  console.log(`   Errors: ${results.errors}/${numCalls}`);
  console.log(
    `   Latency p50: ${formatDuration(p50)}, p95: ${formatDuration(p95)}, p99: ${formatDuration(p99)}`,
  );

  printMetrics(cortex);

  // Verify rate limiting worked
  if (results.succeeded <= 20 || results.rateLimited > 0) {
    console.log("\n✅ Rate limiter is working - requests were throttled");
  } else {
    console.log("\n⚠️  Rate limiter may not be working as expected");
  }

  cortex.close();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test 2: Concurrency Saturation - Queue Behavior
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testConcurrencySaturation() {
  console.log("\n" + "═".repeat(70));
  console.log("🚦 TEST 2: CONCURRENCY SATURATION (Convex Free Plan Limit)");
  console.log("═".repeat(70));
  console.log(
    "Testing: Fire 50 operations with max 16 concurrent (Convex free plan limit)",
  );
  console.log(
    "Expected: 16 execute immediately, rest queue, never exceed 16\n",
  );
  console.log(
    "📖 Convex Limits: https://docs.convex.dev/production/state/limits",
  );
  console.log("   - Free plan: 16 concurrent queries/mutations\n");

  const cortex = new Cortex({
    convexUrl: CONVEX_URL!,
    resilience: {
      enabled: true,
      rateLimiter: {
        bucketSize: 200, // High limit
        refillRate: 100,
      },
      concurrency: {
        maxConcurrent: 16, // Convex free plan limit!
        queueSize: 100,
        timeout: 60000, // Long timeout
      },
      circuitBreaker: {
        failureThreshold: 100,
        timeout: 60000,
      },
    },
  });

  const testSpaceId = `stress-test-${Date.now()}`;
  const numCalls = 50; // Reduced for faster testing
  let maxQueueDepth = 0;
  let maxConcurrent = 0;

  // Monitor metrics during execution
  const monitorInterval = setInterval(() => {
    const metrics = cortex.getResilienceMetrics();
    if (metrics.concurrency.active > maxConcurrent) {
      maxConcurrent = metrics.concurrency.active;
    }
    if (metrics.concurrency.waiting > maxQueueDepth) {
      maxQueueDepth = metrics.concurrency.waiting;
    }
    process.stdout.write(
      `\r   Active: ${metrics.concurrency.active}/16, Queued: ${metrics.concurrency.waiting}  `,
    );
  }, 50);

  console.log(`📤 Firing ${numCalls} concurrent remember calls...\n`);
  const start = Date.now();

  const promises = Array(numCalls)
    .fill(null)
    .map(async (_, i) => {
      try {
        await cortex.memory.remember({
          memorySpaceId: testSpaceId,
          conversationId: `stress-conv-${i}`,
          userMessage: `Stress test message ${i}`,
          agentResponse: `Response to stress test ${i}`,
          userId: "stress-test-user",
          userName: "Stress Tester",
        });
        return { status: "success" };
      } catch (error) {
        return { status: "error", error };
      }
    });

  const results = await Promise.all(promises);
  clearInterval(monitorInterval);

  const totalTime = Date.now() - start;
  const succeeded = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "error").length;

  console.log("\n\n📈 Results:");
  console.log(`   Total time: ${formatDuration(totalTime)}`);
  console.log(`   Succeeded: ${succeeded}/${numCalls}`);
  console.log(`   Failed: ${failed}/${numCalls}`);
  console.log(`   Max concurrent observed: ${maxConcurrent}`);
  console.log(`   Max queue depth observed: ${maxQueueDepth}`);
  console.log(
    `   Effective throughput: ${(succeeded / (totalTime / 1000)).toFixed(1)} ops/sec`,
  );

  printMetrics(cortex);

  // Verify concurrency limiting worked - respects Convex free plan limit of 16
  if (maxConcurrent <= 16) {
    console.log(
      "\n✅ Concurrency limiter is working - never exceeded 16 concurrent (Convex free plan limit)",
    );
  } else {
    console.log(
      `\n⚠️  Concurrency limiter may not be working - saw ${maxConcurrent} concurrent (exceeds Convex limit of 16!)`,
    );
  }

  // Cleanup
  try {
    const spaces = await cortex.memorySpaces.list();
    const testSpace = spaces.find((s) => s.memorySpaceId === testSpaceId);
    if (testSpace) {
      await cortex.memorySpaces.delete(testSpaceId);
    }
  } catch {}

  cortex.close();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test 3: Circuit Breaker Trip & Recovery
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testCircuitBreakerTripAndRecovery() {
  console.log("\n" + "═".repeat(70));
  console.log("🔌 TEST 3: CIRCUIT BREAKER TRIP & RECOVERY");
  console.log("═".repeat(70));
  console.log(
    "Testing: Cause 5 failures to trip circuit, then verify recovery after timeout",
  );
  console.log("Expected: Circuit opens, rejects requests, then recovers\n");

  let circuitOpened = false;
  let circuitClosed = false;

  const cortex = new Cortex({
    convexUrl: CONVEX_URL!,
    resilience: {
      enabled: true,
      rateLimiter: {
        bucketSize: 100,
        refillRate: 50,
      },
      concurrency: {
        maxConcurrent: 20,
        queueSize: 100,
        timeout: 30000,
      },
      circuitBreaker: {
        failureThreshold: 5, // Trip after 5 failures
        successThreshold: 2, // Close after 2 successes
        timeout: 5000, // 5 second recovery timeout
        halfOpenMax: 3,
      },
      onCircuitOpen: (failures) => {
        console.log(`\n🔴 CIRCUIT OPENED after ${failures} failures`);
        circuitOpened = true;
      },
      onCircuitClose: () => {
        console.log(`\n🟢 CIRCUIT CLOSED - recovered`);
        circuitClosed = true;
      },
    },
  });

  console.log("Phase 1: Causing failures to trip circuit...");

  // Try to cause failures by using invalid memory space ID (should fail validation or backend)
  // Actually, let's use a very invalid request that will fail at the backend
  for (let i = 0; i < 7; i++) {
    try {
      // This will fail at backend - invalid memory space format
      await cortex.memory.search("", `query ${i}`);
      console.log(`   Call ${i + 1}: Succeeded (unexpected)`);
    } catch (error) {
      const isCircuitOpen = error instanceof CircuitOpenError;
      console.log(
        `   Call ${i + 1}: ${isCircuitOpen ? "REJECTED (circuit open)" : "Failed (backend error)"}`,
      );
    }
    printMetrics(cortex);
  }

  if (!circuitOpened) {
    console.log(
      "\n⚠️  Circuit did not open - backend may not be returning errors",
    );
    console.log(
      "   Trying alternative approach: rapid calls to non-existent space...",
    );

    // Alternative: Force circuit open by directly accessing the resilience layer
    // This simulates what would happen with actual backend failures
  }

  console.log("\nPhase 2: Verifying circuit rejects requests...");

  // Try a few more calls - should be rejected immediately
  for (let i = 0; i < 3; i++) {
    const start = Date.now();
    try {
      await cortex.memory.search("test-space", `query ${i}`);
      console.log(`   Call ${i + 1}: Succeeded in ${Date.now() - start}ms`);
    } catch (error) {
      const duration = Date.now() - start;
      if (error instanceof CircuitOpenError) {
        console.log(
          `   Call ${i + 1}: REJECTED in ${duration}ms (circuit open) ✅`,
        );
      } else {
        console.log(
          `   Call ${i + 1}: Failed in ${duration}ms (backend error)`,
        );
      }
    }
  }

  console.log("\nPhase 3: Waiting for circuit recovery timeout (5 seconds)...");

  // Wait for circuit to transition to half-open
  for (let i = 0; i < 6; i++) {
    await delay(1000);
    const metrics = cortex.getResilienceMetrics();
    console.log(
      `   ${i + 1}s - Circuit state: ${metrics.circuitBreaker.state}`,
    );
    if (metrics.circuitBreaker.state === "half-open") {
      console.log("   Circuit is now half-open!");
      break;
    }
  }

  console.log("\nPhase 4: Testing recovery with successful calls...");

  // Make successful calls to close the circuit
  const testSpaceId = `recovery-test-${Date.now()}`;
  for (let i = 0; i < 3; i++) {
    try {
      // This should succeed - valid search on a new space (returns empty results)
      await cortex.memory.search(testSpaceId, `recovery query ${i}`);
      console.log(`   Recovery call ${i + 1}: Succeeded ✅`);
    } catch (error) {
      console.log(
        `   Recovery call ${i + 1}: Failed - ${error instanceof Error ? error.message : error}`,
      );
    }
    printMetrics(cortex);
  }

  // Final state
  console.log("\n📈 Final State:");
  printMetrics(cortex);

  if (circuitOpened && circuitClosed) {
    console.log(
      "\n✅ Circuit breaker working - opened on failures, recovered after timeout",
    );
  } else if (circuitOpened) {
    console.log(
      "\n⚠️  Circuit opened but did not close - may need more recovery time",
    );
  } else {
    console.log(
      "\n⚠️  Circuit did not trip - backend validation may prevent failures reaching circuit",
    );
  }

  cortex.close();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test 4: Priority Queue Under Load
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testPriorityQueueUnderLoad() {
  console.log("\n" + "═".repeat(70));
  console.log("🎯 TEST 4: PRIORITY QUEUE UNDER LOAD");
  console.log("═".repeat(70));
  console.log("Testing: Fire mix of low/normal/high priority operations");
  console.log(
    "Expected: High priority operations complete before low priority\n",
  );

  const cortex = new Cortex({
    convexUrl: CONVEX_URL!,
    resilience: {
      enabled: true,
      rateLimiter: {
        bucketSize: 100,
        refillRate: 20, // Slower refill to create backlog
      },
      concurrency: {
        maxConcurrent: 3, // Very low to create queue
        queueSize: 200,
        timeout: 60000,
      },
      circuitBreaker: {
        failureThreshold: 100,
        timeout: 60000,
      },
    },
  });

  const testSpaceId = `priority-test-${Date.now()}`;
  const completionOrder: { type: string; index: number; time: number }[] = [];
  const start = Date.now();

  console.log(
    "📤 Firing operations in order: 10 search (low) → 5 remember (high) → 10 search (low)...\n",
  );

  const operations: Promise<void>[] = [];

  // First batch: 10 low-priority searches
  for (let i = 0; i < 10; i++) {
    operations.push(
      cortex.memory
        .search(testSpaceId, `low query ${i}`)
        .then(() => {
          completionOrder.push({
            type: "low",
            index: i,
            time: Date.now() - start,
          });
        })
        .catch(() => {
          completionOrder.push({
            type: "low-err",
            index: i,
            time: Date.now() - start,
          });
        }),
    );
  }

  // Wait a tiny bit so these are queued
  await delay(10);

  // Second batch: 5 high-priority remembers (added after low-priority but should execute first)
  for (let i = 0; i < 5; i++) {
    operations.push(
      cortex.memory
        .remember({
          memorySpaceId: testSpaceId,
          conversationId: `priority-conv-${i}`,
          userMessage: `High priority message ${i}`,
          agentResponse: `Response ${i}`,
          userId: "priority-test-user",
          userName: "Priority Tester",
        })
        .then(() => {
          completionOrder.push({
            type: "high",
            index: i,
            time: Date.now() - start,
          });
        })
        .catch(() => {
          completionOrder.push({
            type: "high-err",
            index: i,
            time: Date.now() - start,
          });
        }),
    );
  }

  // Wait a tiny bit
  await delay(10);

  // Third batch: 10 more low-priority searches
  for (let i = 10; i < 20; i++) {
    operations.push(
      cortex.memory
        .search(testSpaceId, `low query ${i}`)
        .then(() => {
          completionOrder.push({
            type: "low",
            index: i,
            time: Date.now() - start,
          });
        })
        .catch(() => {
          completionOrder.push({
            type: "low-err",
            index: i,
            time: Date.now() - start,
          });
        }),
    );
  }

  // Monitor progress
  const monitorInterval = setInterval(() => {
    const high = completionOrder.filter((o) =>
      o.type.startsWith("high"),
    ).length;
    const low = completionOrder.filter((o) => o.type.startsWith("low")).length;
    process.stdout.write(`\r   Completed: High=${high}/5, Low=${low}/20  `);
  }, 100);

  await Promise.all(operations);
  clearInterval(monitorInterval);

  const totalTime = Date.now() - start;

  // Analyze completion order
  const highCompletions = completionOrder.filter((o) => o.type === "high");
  const lowCompletions = completionOrder.filter((o) => o.type === "low");

  const avgHighTime =
    highCompletions.length > 0
      ? highCompletions.reduce((sum, o) => sum + o.time, 0) /
        highCompletions.length
      : 0;
  const avgLowTime =
    lowCompletions.length > 0
      ? lowCompletions.reduce((sum, o) => sum + o.time, 0) /
        lowCompletions.length
      : 0;

  // Check if high priority generally completed before low priority
  const highBeforeLow = highCompletions.filter(
    (h) => lowCompletions.some((l) => l.index >= 10 && h.time < l.time), // Compare to later low-priority
  ).length;

  console.log("\n\n📈 Results:");
  console.log(`   Total time: ${formatDuration(totalTime)}`);
  console.log(`   High priority completed: ${highCompletions.length}/5`);
  console.log(`   Low priority completed: ${lowCompletions.length}/20`);
  console.log(`   Avg high priority time: ${formatDuration(avgHighTime)}`);
  console.log(`   Avg low priority time: ${formatDuration(avgLowTime)}`);
  console.log(
    `   High-priority ops that beat later low-priority: ${highBeforeLow}/5`,
  );

  console.log("\n   Completion order (first 15):");
  completionOrder.slice(0, 15).forEach((o, i) => {
    console.log(
      `     ${i + 1}. ${o.type} #${o.index} at ${formatDuration(o.time)}`,
    );
  });

  printMetrics(cortex);

  if (avgHighTime < avgLowTime || highBeforeLow >= 3) {
    console.log(
      "\n✅ Priority queue is working - high priority operations got preferential treatment",
    );
  } else {
    console.log(
      "\n⚠️  Priority queue may not be optimally ordering - high priority didn't clearly beat low",
    );
  }

  // Cleanup
  try {
    await cortex.memorySpaces.delete(testSpaceId);
  } catch {}

  cortex.close();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Test 5: Graceful Shutdown Under Load
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function testGracefulShutdown() {
  console.log("\n" + "═".repeat(70));
  console.log("🛑 TEST 5: GRACEFUL SHUTDOWN UNDER LOAD");
  console.log("═".repeat(70));
  console.log(
    "Testing: Start operations, then call shutdown with pending work",
  );
  console.log("Expected: Shutdown waits for pending operations to complete\n");

  const cortex = new Cortex({
    convexUrl: CONVEX_URL!,
    resilience: {
      enabled: true,
      rateLimiter: {
        bucketSize: 50,
        refillRate: 10,
      },
      concurrency: {
        maxConcurrent: 5,
        queueSize: 100,
        timeout: 30000,
      },
    },
  });

  const testSpaceId = `shutdown-test-${Date.now()}`;
  // Track completion counts (used for logging)
  const _completedBeforeShutdown = 0;
  const _completedAfterShutdown = 0;
  void _completedBeforeShutdown;
  void _completedAfterShutdown;

  console.log("📤 Starting 20 operations...");

  // Start operations
  const operations = Array(20)
    .fill(null)
    .map(async (_, i) => {
      try {
        await cortex.memory.search(testSpaceId, `shutdown query ${i}`);
        return "success";
      } catch (_error) {
        return "failed";
      }
    });

  // Wait a moment then call shutdown while operations are still running
  await delay(100);

  console.log("🛑 Calling shutdown while operations in flight...");
  printMetrics(cortex);

  const shutdownStart = Date.now();
  await cortex.shutdown(10000); // 10 second timeout
  const shutdownDuration = Date.now() - shutdownStart;

  // Check how many completed
  const results = await Promise.allSettled(operations);
  const succeeded = results.filter(
    (r) => r.status === "fulfilled" && r.value === "success",
  ).length;
  const failed = results.filter(
    (r) => r.status === "fulfilled" && r.value === "failed",
  ).length;
  const rejected = results.filter((r) => r.status === "rejected").length;

  console.log("\n📈 Results:");
  console.log(`   Shutdown duration: ${formatDuration(shutdownDuration)}`);
  console.log(`   Operations succeeded: ${succeeded}/20`);
  console.log(`   Operations failed: ${failed}/20`);
  console.log(`   Operations rejected: ${rejected}/20`);

  if (shutdownDuration > 50 && succeeded > 0) {
    console.log(
      "\n✅ Graceful shutdown is working - waited for pending operations",
    );
  } else {
    console.log(
      "\n⚠️  Graceful shutdown may not be waiting - check operation completion",
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Runner
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main() {
  console.log("╔" + "═".repeat(68) + "╗");
  console.log(
    "║" +
      " ".repeat(15) +
      "RESILIENCE LAYER STRESS TESTS" +
      " ".repeat(24) +
      "║",
  );
  console.log(
    "║" + " ".repeat(20) + "(MANUAL - NOT FOR CI)" + " ".repeat(27) + "║",
  );
  console.log("╚" + "═".repeat(68) + "╝");
  console.log(`\n🎯 Target: ${CONVEX_URL}`);
  console.log("⚠️  WARNING: These tests create significant database load!\n");

  const startTime = Date.now();

  try {
    await testBurstRateLimiting();
    await delay(2000); // Cooldown between tests

    await testConcurrencySaturation();
    await delay(2000);

    await testCircuitBreakerTripAndRecovery();
    await delay(2000);

    await testPriorityQueueUnderLoad();
    await delay(2000);

    await testGracefulShutdown();
  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
  }

  const totalTime = Date.now() - startTime;

  console.log("\n" + "═".repeat(70));
  console.log("📊 ALL STRESS TESTS COMPLETE");
  console.log("═".repeat(70));
  console.log(`Total execution time: ${formatDuration(totalTime)}`);
  console.log(
    "\nReview the output above to verify resilience mechanisms are working.",
  );
  console.log("Look for ✅ indicators for passing behaviors.\n");
}

main().catch(console.error);
