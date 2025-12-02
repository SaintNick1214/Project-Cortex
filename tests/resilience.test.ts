/**
 * Resilience Layer Tests
 *
 * Tests for the overload protection system components:
 * - Token Bucket Rate Limiter
 * - Semaphore Concurrency Limiter
 * - Priority Queue
 * - Circuit Breaker
 * - ResilienceLayer (integration)
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import {
  TokenBucket,
  Semaphore,
  PriorityQueue,
  CircuitBreaker,
  ResilienceLayer,
  ResiliencePresets,
  CircuitOpenError,
  QueueFullError,
  AcquireTimeoutError,
  RateLimitExceededError,
  getPriority,
  isCritical,
  type Priority,
  type QueuedRequest,
} from "../src/resilience";

// Helper to create test operations
const createOperation = <T>(result: T, delay: number = 0): (() => Promise<T>) => {
  return async () => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    return result;
  };
};

const createFailingOperation = (error: Error, delay: number = 0): (() => Promise<never>) => {
  return async () => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    throw error;
  };
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Token Bucket Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("TokenBucket", () => {
  test("should start with full bucket", () => {
    const bucket = new TokenBucket({ bucketSize: 10, refillRate: 5 });
    expect(bucket.getAvailableTokens()).toBe(10);
  });

  test("should allow burst up to bucket size", () => {
    const bucket = new TokenBucket({ bucketSize: 5, refillRate: 10 });

    // Should be able to acquire 5 tokens immediately
    for (let i = 0; i < 5; i++) {
      expect(bucket.tryAcquire()).toBe(true);
    }

    // 6th should fail
    expect(bucket.tryAcquire()).toBe(false);
  });

  test("should refill tokens over time", async () => {
    const bucket = new TokenBucket({ bucketSize: 10, refillRate: 100 }); // 100/sec = 1 per 10ms

    // Drain all tokens
    for (let i = 0; i < 10; i++) {
      bucket.tryAcquire();
    }

    expect(bucket.getAvailableTokens()).toBe(0);

    // Wait for refill
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should have some tokens back
    expect(bucket.getAvailableTokens()).toBeGreaterThan(0);
  });

  test("should wait for token when acquiring async", async () => {
    const bucket = new TokenBucket({ bucketSize: 1, refillRate: 100 });

    bucket.tryAcquire(); // Use the only token

    const start = Date.now();
    await bucket.acquire(); // Should wait ~10ms for refill
    const elapsed = Date.now() - start;

    // Should have waited some time (at least 5ms to account for timing variance)
    expect(elapsed).toBeGreaterThan(5);
  });

  test("should throw on timeout", async () => {
    const bucket = new TokenBucket({ bucketSize: 1, refillRate: 1 }); // Very slow refill

    bucket.tryAcquire();

    await expect(bucket.acquire(10)).rejects.toThrow(RateLimitExceededError);
  });

  test("should track metrics", () => {
    const bucket = new TokenBucket({ bucketSize: 10, refillRate: 50 });

    bucket.tryAcquire();
    bucket.tryAcquire();

    const metrics = bucket.getMetrics();
    expect(metrics.tokensAvailable).toBe(8);
  });

  test("should reset correctly", () => {
    const bucket = new TokenBucket({ bucketSize: 10, refillRate: 50 });

    bucket.tryAcquire();
    bucket.tryAcquire();

    bucket.reset();

    expect(bucket.getAvailableTokens()).toBe(10);
    expect(bucket.getMetrics().requestsThrottled).toBe(0);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Semaphore Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Semaphore", () => {
  test("should allow up to maxPermits concurrent acquisitions", async () => {
    const sem = new Semaphore({ maxConcurrent: 3, queueSize: 10, timeout: 1000 });

    const p1 = sem.tryAcquire();
    const p2 = sem.tryAcquire();
    const p3 = sem.tryAcquire();
    const p4 = sem.tryAcquire();

    expect(p1).not.toBeUndefined();
    expect(p2).not.toBeUndefined();
    expect(p3).not.toBeUndefined();
    expect(p4).toBeUndefined();

    expect(sem.getActiveCount()).toBe(3);
  });

  test("should release permit properly", async () => {
    const sem = new Semaphore({ maxConcurrent: 1, queueSize: 10, timeout: 1000 });

    const permit = sem.tryAcquire()!;
    expect(sem.getActiveCount()).toBe(1);

    permit.release();
    expect(sem.getActiveCount()).toBe(0);
  });

  test("should queue waiting requests", async () => {
    const sem = new Semaphore({ maxConcurrent: 1, queueSize: 10, timeout: 1000 });

    const permit1 = await sem.acquire();
    expect(sem.getWaitingCount()).toBe(0);

    // Start waiting for permit
    const waitPromise = sem.acquire();
    // Give it time to queue
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(sem.getWaitingCount()).toBe(1);

    // Release first permit
    permit1.release();

    // Waiting request should now have permit
    const permit2 = await waitPromise;
    expect(sem.getActiveCount()).toBe(1);
    permit2.release();
  });

  test("should timeout waiting requests", async () => {
    const sem = new Semaphore({ maxConcurrent: 1, queueSize: 10, timeout: 50 });

    const permit = await sem.acquire();

    // This should timeout
    await expect(sem.acquire(50)).rejects.toThrow(AcquireTimeoutError);

    permit.release();
  });

  test("should throw when queue is full", async () => {
    const sem = new Semaphore({ maxConcurrent: 1, queueSize: 1, timeout: 1000 });

    await sem.acquire(); // Take the permit

    // First waiter should be queued
    const wait1 = sem.acquire();

    // Give it time to queue
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Second waiter should fail (queue full)
    await expect(sem.acquire()).rejects.toThrow(/queue full/i);

    // Cleanup
    sem.reset();
  });

  test("should track metrics", () => {
    const sem = new Semaphore({ maxConcurrent: 3, queueSize: 10, timeout: 1000 });

    sem.tryAcquire();
    sem.tryAcquire();

    const metrics = sem.getMetrics();
    expect(metrics.active).toBe(2);
    expect(metrics.waiting).toBe(0);
    expect(metrics.maxReached).toBe(2);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Priority Queue Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("PriorityQueue", () => {
  const createRequest = (priority: Priority, id: string = "test"): QueuedRequest => ({
    id,
    operation: async () => "result",
    priority,
    operationName: "test",
    queuedAt: Date.now(),
    attempts: 0,
    resolve: () => {},
    reject: () => {},
  });

  test("should process in priority order", () => {
    const queue = new PriorityQueue();

    queue.enqueue(createRequest("low", "low-1"));
    queue.enqueue(createRequest("high", "high-1"));
    queue.enqueue(createRequest("normal", "normal-1"));
    queue.enqueue(createRequest("critical", "critical-1"));

    expect(queue.dequeue()?.id).toBe("critical-1");
    expect(queue.dequeue()?.id).toBe("high-1");
    expect(queue.dequeue()?.id).toBe("normal-1");
    expect(queue.dequeue()?.id).toBe("low-1");
  });

  test("should maintain FIFO within priority", () => {
    const queue = new PriorityQueue();

    queue.enqueue(createRequest("normal", "first"));
    queue.enqueue(createRequest("normal", "second"));
    queue.enqueue(createRequest("normal", "third"));

    expect(queue.dequeue()?.id).toBe("first");
    expect(queue.dequeue()?.id).toBe("second");
    expect(queue.dequeue()?.id).toBe("third");
  });

  test("should throw when queue is full", () => {
    const queue = new PriorityQueue({
      maxSize: { critical: 1, high: 1, normal: 1, low: 1, background: 1 },
    });

    queue.enqueue(createRequest("normal", "first"));

    expect(() => queue.enqueue(createRequest("normal", "second"))).toThrow(QueueFullError);
  });

  test("should track size by priority", () => {
    const queue = new PriorityQueue();

    queue.enqueue(createRequest("high", "h1"));
    queue.enqueue(createRequest("high", "h2"));
    queue.enqueue(createRequest("normal", "n1"));

    const sizes = queue.sizeByPriority();
    expect(sizes.high).toBe(2);
    expect(sizes.normal).toBe(1);
    expect(sizes.low).toBe(0);
  });

  test("should track metrics", () => {
    const queue = new PriorityQueue();

    queue.enqueue(createRequest("normal"));
    queue.dequeue();

    const metrics = queue.getMetrics();
    expect(metrics.processed).toBe(1);
    expect(metrics.total).toBe(0);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Circuit Breaker Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("CircuitBreaker", () => {
  test("should start in closed state", () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe("closed");
    expect(cb.isOpen()).toBe(false);
  });

  test("should open after threshold failures", async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
    });

    const failingOp = createFailingOperation(new Error("Test error"));

    // Fail 3 times
    for (let i = 0; i < 3; i++) {
      try {
        await cb.execute(failingOp);
      } catch {}
    }

    expect(cb.getState()).toBe("open");
    expect(cb.isOpen()).toBe(true);
  });

  test("should reject requests when open", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1 });

    const failingOp = createFailingOperation(new Error("Test error"));
    try {
      await cb.execute(failingOp);
    } catch {}

    await expect(cb.execute(createOperation("test"))).rejects.toThrow(CircuitOpenError);
  });

  test("should transition to half-open after timeout", async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      timeout: 50,
    });

    const failingOp = createFailingOperation(new Error("Test error"));
    try {
      await cb.execute(failingOp);
    } catch {}

    expect(cb.getState()).toBe("open");

    // Wait for timeout
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Should now be half-open
    expect(cb.getState()).toBe("half-open");
  });

  test("should close after successes in half-open", async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      successThreshold: 2,
      timeout: 50,
      halfOpenMax: 3,
    });

    // Open the circuit
    const failingOp = createFailingOperation(new Error("Test error"));
    try {
      await cb.execute(failingOp);
    } catch {}

    // Wait for timeout
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Execute successful operations
    await cb.execute(createOperation("test1"));
    await cb.execute(createOperation("test2"));

    expect(cb.getState()).toBe("closed");
  });

  test("should call onOpen callback", async () => {
    let openCalled = false;
    const cb = new CircuitBreaker(
      { failureThreshold: 1 },
      { onOpen: () => { openCalled = true; } },
    );

    const failingOp = createFailingOperation(new Error("Test error"));
    try {
      await cb.execute(failingOp);
    } catch {}

    expect(openCalled).toBe(true);
  });

  test("should track metrics", async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });

    const failingOp = createFailingOperation(new Error("Test error"));
    for (let i = 0; i < 2; i++) {
      try {
        await cb.execute(failingOp);
      } catch {}
    }

    const metrics = cb.getMetrics();
    expect(metrics.failures).toBe(2);
    expect(metrics.state).toBe("closed");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Priority Mapping Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Priority Mapping", () => {
  test("should return correct priorities for known operations", () => {
    expect(getPriority("users:delete")).toBe("critical");
    expect(getPriority("memory:remember")).toBe("high");
    expect(getPriority("memory:search")).toBe("normal");
    expect(getPriority("memory:export")).toBe("low");
    expect(getPriority("graph:sync")).toBe("background");
  });

  test("should match wildcard patterns", () => {
    expect(getPriority("graphSync:anything")).toBe("background");
    expect(getPriority("graphSync:somethingElse")).toBe("background");
  });

  test("should return normal for unknown operations", () => {
    expect(getPriority("unknown:operation")).toBe("normal");
    expect(getPriority("foo:bar")).toBe("normal");
  });

  test("should correctly identify critical operations", () => {
    expect(isCritical("users:delete")).toBe(true);
    expect(isCritical("governance:purge")).toBe(true);
    expect(isCritical("memory:remember")).toBe(false);
    expect(isCritical("memory:search")).toBe(false);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ResilienceLayer Integration Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("ResilienceLayer", () => {
  let resilience: ResilienceLayer;

  beforeEach(() => {
    resilience = new ResilienceLayer({
      enabled: true,
      rateLimiter: { bucketSize: 10, refillRate: 100 },
      concurrency: { maxConcurrent: 5, queueSize: 100, timeout: 1000 },
      circuitBreaker: {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 100,
        halfOpenMax: 2,
      },
    });
  });

  afterEach(() => {
    resilience.stopQueueProcessor();
  });

  test("should execute operations through all layers", async () => {
    const result = await resilience.execute(
      createOperation("success"),
      "memory:remember",
    );

    expect(result).toBe("success");
  });

  test("should pass through when disabled", async () => {
    const disabled = new ResilienceLayer({ enabled: false });

    const result = await disabled.execute(
      createOperation("success"),
      "memory:remember",
    );

    expect(result).toBe("success");
    disabled.stopQueueProcessor();
  });

  test("should report healthy when circuit is closed", () => {
    expect(resilience.isHealthy()).toBe(true);
    expect(resilience.isAcceptingRequests()).toBe(true);
  });

  test("should get combined metrics", () => {
    const metrics = resilience.getMetrics();

    expect(metrics.rateLimiter).toBeDefined();
    expect(metrics.concurrency).toBeDefined();
    expect(metrics.circuitBreaker).toBeDefined();
    expect(metrics.queue).toBeDefined();
    expect(metrics.timestamp).toBeGreaterThan(0);
  });

  test("should reset all layers", async () => {
    // Execute some operations
    await resilience.execute(createOperation("test1"), "memory:remember");
    await resilience.execute(createOperation("test2"), "memory:remember");

    resilience.reset();

    // Metrics should be reset
    const metrics = resilience.getMetrics();
    expect(metrics.concurrency.maxReached).toBe(0);
  });

  test("should reject non-critical operations when circuit is open", async () => {
    // Force circuit open
    for (let i = 0; i < 3; i++) {
      try {
        await resilience.execute(
          createFailingOperation(new Error("Test")),
          "memory:remember",
        );
      } catch {}
    }

    // Non-critical should be rejected
    await expect(
      resilience.execute(createOperation("test"), "memory:search"),
    ).rejects.toThrow(CircuitOpenError);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Presets Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("ResiliencePresets", () => {
  test("should have default preset", () => {
    expect(ResiliencePresets.default).toBeDefined();
    expect(ResiliencePresets.default.enabled).toBe(true);
  });

  test("should have realTimeAgent preset", () => {
    expect(ResiliencePresets.realTimeAgent).toBeDefined();
    expect(ResiliencePresets.realTimeAgent.concurrency?.maxConcurrent).toBe(10);
  });

  test("should have batchProcessing preset", () => {
    expect(ResiliencePresets.batchProcessing).toBeDefined();
    expect(ResiliencePresets.batchProcessing.concurrency?.maxConcurrent).toBe(50);
  });

  test("should have hiveMode preset", () => {
    expect(ResiliencePresets.hiveMode).toBeDefined();
    expect(ResiliencePresets.hiveMode.concurrency?.maxConcurrent).toBe(100);
  });

  test("should have disabled preset", () => {
    expect(ResiliencePresets.disabled).toBeDefined();
    expect(ResiliencePresets.disabled.enabled).toBe(false);
  });
});
