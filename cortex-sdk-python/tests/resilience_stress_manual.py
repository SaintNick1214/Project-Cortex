#!/usr/bin/env python3
"""
Resilience Layer Stress Tests (MANUAL)

These tests actually hit the Convex database to verify resilience mechanisms
work under real load conditions. They are NOT meant for CI pipelines.

Run manually with:
    python tests/resilience_stress_manual.py

Prerequisites:
    - Convex dev server running
    - Environment variables configured (CONVEX_URL or LOCAL_CONVEX_URL)

WARNING: These tests will create significant load on your database!
"""

import asyncio
import os
import sys
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

from cortex import Cortex, CortexConfig, RememberParams
from cortex.resilience import (
    AcquireTimeoutError,
    CircuitBreakerConfig,
    CircuitOpenError,
    ConcurrencyConfig,
    QueueFullError,
    RateLimitExceededError,
    RateLimiterConfig,
    ResilienceConfig,
    ResiliencePresets,
)

# Load environment
load_dotenv(".env.local")
load_dotenv(".env")

CONVEX_URL = os.getenv("LOCAL_CONVEX_URL") or os.getenv("CONVEX_URL")

if not CONVEX_URL:
    print("❌ No CONVEX_URL found in environment")
    sys.exit(1)


def format_duration(ms: float) -> str:
    """Format duration in milliseconds to human readable."""
    if ms < 1000:
        return f"{ms:.0f}ms"
    return f"{ms / 1000:.2f}s"


def print_metrics(cortex: Cortex) -> None:
    """Print current resilience metrics."""
    metrics = cortex.get_resilience_metrics()
    print("\n📊 Current Metrics:")
    print(
        f"   Rate Limiter: {metrics.rate_limiter.tokens_available}/{metrics.rate_limiter.bucket_size} tokens"
    )
    print(
        f"   Concurrency: {metrics.concurrency.active}/{metrics.concurrency.max} active, {metrics.concurrency.waiting} waiting"
    )
    print(f"   Queue: {metrics.queue.total} pending")
    print(
        f"   Circuit: {metrics.circuit_breaker.state} ({metrics.circuit_breaker.failures} failures)"
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 1: Burst Test - Rate Limiter Stress
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def test_burst_rate_limiting():
    """Test rate limiting under burst load."""
    print("\n" + "═" * 70)
    print("🔥 TEST 1: BURST RATE LIMITING")
    print("═" * 70)
    print("Testing: Fire 200 concurrent search calls with bucket size of 20")
    print("Expected: First 20 succeed immediately, rest wait for refill or timeout\n")

    cortex = Cortex(
        CortexConfig(
            convex_url=CONVEX_URL,
            resilience=ResilienceConfig(
                enabled=True,
                rate_limiter=RateLimiterConfig(
                    bucket_size=20,  # Only allow 20 burst
                    refill_rate=10,  # Refill 10/sec
                ),
                concurrency=ConcurrencyConfig(
                    max_concurrent=50,  # Allow high concurrency
                    queue_size=500,
                    timeout=30.0,
                ),
                circuit_breaker=CircuitBreakerConfig(
                    failure_threshold=100,  # High threshold so it doesn't trip
                    timeout=60.0,
                ),
            ),
        )
    )

    test_space_id = f"stress-test-{int(time.time() * 1000)}"
    num_calls = 200

    results = {"succeeded": 0, "rate_limited": 0, "errors": 0, "durations": []}

    async def make_call(i: int):
        call_start = time.time()
        try:
            await cortex.memory.search(test_space_id, f"test query {i}")
            results["succeeded"] += 1
            return {"status": "success", "duration": (time.time() - call_start) * 1000}
        except RateLimitExceededError:
            results["rate_limited"] += 1
            return {
                "status": "rate-limited",
                "duration": (time.time() - call_start) * 1000,
            }
        except Exception:
            results["errors"] += 1
            return {"status": "error", "duration": (time.time() - call_start) * 1000}

    print(f"📤 Firing {num_calls} concurrent search calls...")
    start = time.time()

    call_results = await asyncio.gather(*[make_call(i) for i in range(num_calls)])
    total_time = (time.time() - start) * 1000

    # Analyze timing
    durations = sorted([r["duration"] for r in call_results])
    p50 = durations[len(durations) // 2]
    p95 = durations[int(len(durations) * 0.95)]
    p99 = durations[int(len(durations) * 0.99)]

    print("\n📈 Results:")
    print(f"   Total time: {format_duration(total_time)}")
    print(f"   Succeeded: {results['succeeded']}/{num_calls}")
    print(f"   Rate limited: {results['rate_limited']}/{num_calls}")
    print(f"   Errors: {results['errors']}/{num_calls}")
    print(
        f"   Latency p50: {format_duration(p50)}, p95: {format_duration(p95)}, p99: {format_duration(p99)}"
    )

    print_metrics(cortex)

    if results["succeeded"] <= 20 or results["rate_limited"] > 0:
        print("\n✅ Rate limiter is working - requests were throttled")
    else:
        print("\n⚠️  Rate limiter may not be working as expected")

    await cortex.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 2: Concurrency Saturation - Queue Behavior
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def test_concurrency_saturation():
    """Test concurrency limiting and queue behavior."""
    print("\n" + "═" * 70)
    print("🚦 TEST 2: CONCURRENCY SATURATION (Convex Free Plan Limit)")
    print("═" * 70)
    print("Testing: Fire 50 operations with max 16 concurrent (Convex free plan limit)")
    print("Expected: 16 execute immediately, rest queue, never exceed 16\n")
    print("📖 Convex Limits: https://docs.convex.dev/production/state/limits")
    print("   - Free plan: 16 concurrent queries/mutations\n")

    cortex = Cortex(
        CortexConfig(
            convex_url=CONVEX_URL,
            resilience=ResilienceConfig(
                enabled=True,
                rate_limiter=RateLimiterConfig(bucket_size=200, refill_rate=100),
                concurrency=ConcurrencyConfig(
                    max_concurrent=16,  # Convex free plan limit!
                    queue_size=100,
                    timeout=60.0,
                ),
                circuit_breaker=CircuitBreakerConfig(failure_threshold=100, timeout=60.0),
            ),
        )
    )

    test_space_id = f"stress-test-{int(time.time() * 1000)}"
    num_calls = 50
    max_queue_depth = 0
    max_concurrent = 0

    async def monitor():
        nonlocal max_queue_depth, max_concurrent
        while True:
            metrics = cortex.get_resilience_metrics()
            if metrics.concurrency.active > max_concurrent:
                max_concurrent = metrics.concurrency.active
            if metrics.concurrency.waiting > max_queue_depth:
                max_queue_depth = metrics.concurrency.waiting
            print(
                f"\r   Active: {metrics.concurrency.active}/16, Queued: {metrics.concurrency.waiting}  ",
                end="",
            )
            await asyncio.sleep(0.05)

    async def make_call(i: int):
        try:
            await cortex.memory.remember(
                RememberParams(
                    memory_space_id=test_space_id,
                    conversation_id=f"stress-conv-{i}",
                    user_message=f"Stress test message {i}",
                    agent_response=f"Response to stress test {i}",
                    user_id="stress-test-user",
                    user_name="Stress Tester",
                )
            )
            return {"status": "success"}
        except Exception:
            return {"status": "error"}

    print(f"📤 Firing {num_calls} concurrent remember calls...\n")
    start = time.time()

    # Start monitor task
    monitor_task = asyncio.create_task(monitor())

    try:
        results = await asyncio.gather(*[make_call(i) for i in range(num_calls)])
    finally:
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass

    total_time = (time.time() - start) * 1000
    succeeded = sum(1 for r in results if r["status"] == "success")
    failed = sum(1 for r in results if r["status"] == "error")

    print("\n\n📈 Results:")
    print(f"   Total time: {format_duration(total_time)}")
    print(f"   Succeeded: {succeeded}/{num_calls}")
    print(f"   Failed: {failed}/{num_calls}")
    print(f"   Max concurrent observed: {max_concurrent}")
    print(f"   Max queue depth observed: {max_queue_depth}")
    print(f"   Effective throughput: {succeeded / (total_time / 1000):.1f} ops/sec")

    print_metrics(cortex)

    # Verify concurrency limiting worked - respects Convex free plan limit of 16
    if max_concurrent <= 16:
        print(
            "\n✅ Concurrency limiter is working - never exceeded 16 concurrent (Convex free plan limit)"
        )
    else:
        print(
            f"\n⚠️  Concurrency limiter may not be working - saw {max_concurrent} concurrent (exceeds Convex limit of 16!)"
        )

    # Cleanup
    try:
        await cortex.memory_spaces.delete(test_space_id)
    except Exception:
        pass

    await cortex.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 3: Circuit Breaker Trip & Recovery
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def test_circuit_breaker_trip_and_recovery():
    """Test circuit breaker tripping and recovery."""
    print("\n" + "═" * 70)
    print("🔌 TEST 3: CIRCUIT BREAKER TRIP & RECOVERY")
    print("═" * 70)
    print("Testing: Cause 5 failures to trip circuit, then verify recovery")
    print("Expected: Circuit opens, rejects requests, then recovers\n")

    circuit_opened = False
    circuit_closed = False

    def on_circuit_open(failures: int):
        nonlocal circuit_opened
        print(f"\n🔴 CIRCUIT OPENED after {failures} failures")
        circuit_opened = True

    def on_circuit_close():
        nonlocal circuit_closed
        print("\n🟢 CIRCUIT CLOSED - recovered")
        circuit_closed = True

    cortex = Cortex(
        CortexConfig(
            convex_url=CONVEX_URL,
            resilience=ResilienceConfig(
                enabled=True,
                rate_limiter=RateLimiterConfig(bucket_size=100, refill_rate=50),
                concurrency=ConcurrencyConfig(
                    max_concurrent=20, queue_size=100, timeout=30.0
                ),
                circuit_breaker=CircuitBreakerConfig(
                    failure_threshold=5,
                    success_threshold=2,
                    timeout=5.0,  # 5 second recovery
                    half_open_max=3,
                ),
                on_circuit_open=on_circuit_open,
                on_circuit_close=on_circuit_close,
            ),
        )
    )

    print("Phase 1: Causing failures to trip circuit...")

    for i in range(7):
        try:
            # Empty memory space ID will fail
            await cortex.memory.search("", f"query {i}")
            print(f"   Call {i + 1}: Succeeded (unexpected)")
        except CircuitOpenError:
            print(f"   Call {i + 1}: REJECTED (circuit open)")
        except Exception:
            print(f"   Call {i + 1}: Failed (backend error)")
        print_metrics(cortex)

    print("\nPhase 2: Verifying circuit rejects requests...")

    for i in range(3):
        start = time.time()
        try:
            await cortex.memory.search("test-space", f"query {i}")
            print(f"   Call {i + 1}: Succeeded in {(time.time() - start) * 1000:.0f}ms")
        except CircuitOpenError:
            print(
                f"   Call {i + 1}: REJECTED in {(time.time() - start) * 1000:.0f}ms (circuit open) ✅"
            )
        except Exception:
            print(
                f"   Call {i + 1}: Failed in {(time.time() - start) * 1000:.0f}ms (backend error)"
            )

    print("\nPhase 3: Waiting for circuit recovery timeout (5 seconds)...")

    for i in range(6):
        await asyncio.sleep(1)
        metrics = cortex.get_resilience_metrics()
        print(f"   {i + 1}s - Circuit state: {metrics.circuit_breaker.state}")
        if metrics.circuit_breaker.state == "half-open":
            print("   Circuit is now half-open!")
            break

    print("\nPhase 4: Testing recovery with successful calls...")

    test_space_id = f"recovery-test-{int(time.time() * 1000)}"
    for i in range(3):
        try:
            await cortex.memory.search(test_space_id, f"recovery query {i}")
            print(f"   Recovery call {i + 1}: Succeeded ✅")
        except Exception as e:
            print(f"   Recovery call {i + 1}: Failed - {e}")
        print_metrics(cortex)

    print("\n📈 Final State:")
    print_metrics(cortex)

    if circuit_opened and circuit_closed:
        print("\n✅ Circuit breaker working - opened on failures, recovered after timeout")
    elif circuit_opened:
        print("\n⚠️  Circuit opened but did not close - may need more recovery time")
    else:
        print(
            "\n⚠️  Circuit did not trip - backend validation may prevent failures reaching circuit"
        )

    await cortex.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 4: Priority Queue Under Load
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def test_priority_queue_under_load():
    """Test priority queue ordering under load."""
    print("\n" + "═" * 70)
    print("🎯 TEST 4: PRIORITY QUEUE UNDER LOAD")
    print("═" * 70)
    print("Testing: Fire mix of low/normal/high priority operations")
    print("Expected: High priority operations complete before low priority\n")

    cortex = Cortex(
        CortexConfig(
            convex_url=CONVEX_URL,
            resilience=ResilienceConfig(
                enabled=True,
                rate_limiter=RateLimiterConfig(bucket_size=100, refill_rate=20),
                concurrency=ConcurrencyConfig(
                    max_concurrent=3,  # Very low to create queue
                    queue_size=200,
                    timeout=60.0,
                ),
                circuit_breaker=CircuitBreakerConfig(failure_threshold=100, timeout=60.0),
            ),
        )
    )

    test_space_id = f"priority-test-{int(time.time() * 1000)}"
    completion_order: List[Dict[str, Any]] = []
    start = time.time()

    print(
        "📤 Firing operations: 10 search (low) → 5 remember (high) → 10 search (low)...\n"
    )

    async def low_priority_call(i: int):
        try:
            await cortex.memory.search(test_space_id, f"low query {i}")
            completion_order.append(
                {"type": "low", "index": i, "time": (time.time() - start) * 1000}
            )
        except Exception:
            completion_order.append(
                {"type": "low-err", "index": i, "time": (time.time() - start) * 1000}
            )

    async def high_priority_call(i: int):
        try:
            await cortex.memory.remember(
                RememberParams(
                    memory_space_id=test_space_id,
                    conversation_id=f"priority-conv-{i}",
                    user_message=f"High priority message {i}",
                    agent_response=f"Response {i}",
                    user_id="priority-test-user",
                    user_name="Priority Tester",
                )
            )
            completion_order.append(
                {"type": "high", "index": i, "time": (time.time() - start) * 1000}
            )
        except Exception:
            completion_order.append(
                {"type": "high-err", "index": i, "time": (time.time() - start) * 1000}
            )

    operations = []

    # First batch: low priority
    for i in range(10):
        operations.append(low_priority_call(i))

    await asyncio.sleep(0.01)

    # Second batch: high priority (added after low but should execute first)
    for i in range(5):
        operations.append(high_priority_call(i))

    await asyncio.sleep(0.01)

    # Third batch: more low priority
    for i in range(10, 20):
        operations.append(low_priority_call(i))

    # Monitor progress
    async def monitor():
        while True:
            high = sum(1 for o in completion_order if o["type"].startswith("high"))
            low = sum(1 for o in completion_order if o["type"].startswith("low"))
            print(f"\r   Completed: High={high}/5, Low={low}/20  ", end="")
            await asyncio.sleep(0.1)

    monitor_task = asyncio.create_task(monitor())

    try:
        await asyncio.gather(*operations)
    finally:
        monitor_task.cancel()
        try:
            await monitor_task
        except asyncio.CancelledError:
            pass

    total_time = (time.time() - start) * 1000

    # Analyze
    high_completions = [o for o in completion_order if o["type"] == "high"]
    low_completions = [o for o in completion_order if o["type"] == "low"]

    avg_high_time = (
        sum(o["time"] for o in high_completions) / len(high_completions)
        if high_completions
        else 0
    )
    avg_low_time = (
        sum(o["time"] for o in low_completions) / len(low_completions)
        if low_completions
        else 0
    )

    print("\n\n📈 Results:")
    print(f"   Total time: {format_duration(total_time)}")
    print(f"   High priority completed: {len(high_completions)}/5")
    print(f"   Low priority completed: {len(low_completions)}/20")
    print(f"   Avg high priority time: {format_duration(avg_high_time)}")
    print(f"   Avg low priority time: {format_duration(avg_low_time)}")

    print("\n   Completion order (first 15):")
    for i, o in enumerate(completion_order[:15]):
        print(f"     {i + 1}. {o['type']} #{o['index']} at {format_duration(o['time'])}")

    print_metrics(cortex)

    if avg_high_time < avg_low_time:
        print(
            "\n✅ Priority queue is working - high priority operations completed faster"
        )
    else:
        print(
            "\n⚠️  Priority queue may not be optimally ordering - high priority didn't clearly beat low"
        )

    # Cleanup
    try:
        await cortex.memory_spaces.delete(test_space_id)
    except Exception:
        pass

    await cortex.close()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Test 5: Graceful Shutdown Under Load
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def test_graceful_shutdown():
    """Test graceful shutdown with pending operations."""
    print("\n" + "═" * 70)
    print("🛑 TEST 5: GRACEFUL SHUTDOWN UNDER LOAD")
    print("═" * 70)
    print("Testing: Start operations, then call shutdown with pending work")
    print("Expected: Shutdown waits for pending operations to complete\n")

    cortex = Cortex(
        CortexConfig(
            convex_url=CONVEX_URL,
            resilience=ResilienceConfig(
                enabled=True,
                rate_limiter=RateLimiterConfig(bucket_size=50, refill_rate=10),
                concurrency=ConcurrencyConfig(
                    max_concurrent=5, queue_size=100, timeout=30.0
                ),
            ),
        )
    )

    test_space_id = f"shutdown-test-{int(time.time() * 1000)}"

    async def make_call(i: int):
        try:
            await cortex.memory.search(test_space_id, f"shutdown query {i}")
            return "success"
        except Exception:
            return "failed"

    print("📤 Starting 20 operations...")

    # Start operations
    operations = [make_call(i) for i in range(20)]

    await asyncio.sleep(0.1)

    print("🛑 Calling shutdown while operations in flight...")
    print_metrics(cortex)

    shutdown_start = time.time()
    await cortex.shutdown(timeout_s=10.0)
    shutdown_duration = (time.time() - shutdown_start) * 1000

    # Check results
    results = await asyncio.gather(*operations, return_exceptions=True)
    succeeded = sum(1 for r in results if r == "success")
    failed = sum(1 for r in results if r == "failed")
    exceptions = sum(1 for r in results if isinstance(r, Exception))

    print("\n📈 Results:")
    print(f"   Shutdown duration: {format_duration(shutdown_duration)}")
    print(f"   Operations succeeded: {succeeded}/20")
    print(f"   Operations failed: {failed}/20")
    print(f"   Operations with exceptions: {exceptions}/20")

    if shutdown_duration > 50 and succeeded > 0:
        print("\n✅ Graceful shutdown is working - waited for pending operations")
    else:
        print("\n⚠️  Graceful shutdown may not be waiting - check operation completion")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Main Runner
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


async def main():
    print("╔" + "═" * 68 + "╗")
    print("║" + " " * 15 + "RESILIENCE LAYER STRESS TESTS" + " " * 24 + "║")
    print("║" + " " * 20 + "(MANUAL - NOT FOR CI)" + " " * 27 + "║")
    print("╚" + "═" * 68 + "╝")
    print(f"\n🎯 Target: {CONVEX_URL}")
    print("⚠️  WARNING: These tests create significant database load!\n")

    start_time = time.time()

    try:
        await test_burst_rate_limiting()
        await asyncio.sleep(2)  # Cooldown

        await test_concurrency_saturation()
        await asyncio.sleep(2)

        await test_circuit_breaker_trip_and_recovery()
        await asyncio.sleep(2)

        await test_priority_queue_under_load()
        await asyncio.sleep(2)

        await test_graceful_shutdown()

    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback

        traceback.print_exc()

    total_time = (time.time() - start_time) * 1000

    print("\n" + "═" * 70)
    print("📊 ALL STRESS TESTS COMPLETE")
    print("═" * 70)
    print(f"Total execution time: {format_duration(total_time)}")
    print("\nReview the output above to verify resilience mechanisms are working.")
    print("Look for ✅ indicators for passing behaviors.\n")


if __name__ == "__main__":
    asyncio.run(main())
