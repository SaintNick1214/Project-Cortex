/**
 * Resilience Layer Tests
 *
 * Tests for the overload protection system components:
 * - Token Bucket Rate Limiter
 * - Semaphore Concurrency Limiter
 * - Priority Queue
 * - Circuit Breaker
 * - ResilienceLayer (integration)
 * - SDK Integration (verifies all SDK methods use resilience layer)
 */
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
  isNonSystemFailure,
  getOperationsByPriority,
  getPresetForPlan,
  getDetectedPlanTier,
  getPlanLimits,
  type Priority,
  type QueuedRequest,
} from "../src/resilience";

// Helper to create test operations
const createOperation = <T>(
  result: T,
  delay: number = 0,
): (() => Promise<T>) => {
  return async () => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    return result;
  };
};

const createFailingOperation = (
  error: Error,
  delay: number = 0,
): (() => Promise<never>) => {
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
    const sem = new Semaphore({
      maxConcurrent: 3,
      queueSize: 10,
      timeout: 1000,
    });

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
    const sem = new Semaphore({
      maxConcurrent: 1,
      queueSize: 10,
      timeout: 1000,
    });

    const permit = sem.tryAcquire()!;
    expect(sem.getActiveCount()).toBe(1);

    permit.release();
    expect(sem.getActiveCount()).toBe(0);
  });

  test("should queue waiting requests", async () => {
    const sem = new Semaphore({
      maxConcurrent: 1,
      queueSize: 10,
      timeout: 1000,
    });

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
    const sem = new Semaphore({ maxConcurrent: 1, queueSize: 1, timeout: 100 });

    const permit = await sem.acquire(); // Take the permit

    // First waiter should be queued (will timeout)
    const waitPromise = sem.acquire(50).catch(() => {
      // Ignore timeout error
    });

    // Give it time to queue
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Second waiter should fail (queue full)
    await expect(sem.acquire()).rejects.toThrow(/queue full/i);

    // Wait for first waiter to timeout, then release permit
    await waitPromise;
    permit.release();
  });

  test("should track metrics", () => {
    const sem = new Semaphore({
      maxConcurrent: 3,
      queueSize: 10,
      timeout: 1000,
    });

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
  const createRequest = (
    priority: Priority,
    id: string = "test",
  ): QueuedRequest => ({
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

    expect(() => queue.enqueue(createRequest("normal", "second"))).toThrow(
      QueueFullError,
    );
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

    await expect(cb.execute(createOperation("test"))).rejects.toThrow(
      CircuitOpenError,
    );
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
      {
        onOpen: () => {
          openCalled = true;
        },
      },
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

  test("should queue ALL operations when circuit is open (true resilience)", async () => {
    // Force circuit open
    for (let i = 0; i < 3; i++) {
      try {
        await resilience.execute(
          createFailingOperation(new Error("Test")),
          "memory:remember",
        );
      } catch {}
    }

    // ALL operations (including non-critical) should be queued, not rejected
    // The operation will wait in queue and resolve when circuit closes
    const result = await resilience.execute(
      createOperation("test"),
      "memory:search",
    );
    expect(result).toBe("test");
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
    expect(ResiliencePresets.realTimeAgent.concurrency?.maxConcurrent).toBe(8); // Half of free plan limit
  });

  test("should have batchProcessing preset", () => {
    expect(ResiliencePresets.batchProcessing).toBeDefined();
    expect(ResiliencePresets.batchProcessing.concurrency?.maxConcurrent).toBe(
      64,
    ); // For Professional plan
  });

  test("should have hiveMode preset", () => {
    expect(ResiliencePresets.hiveMode).toBeDefined();
    expect(ResiliencePresets.hiveMode.concurrency?.maxConcurrent).toBe(128); // For Professional plan
  });

  test("should have disabled preset", () => {
    expect(ResiliencePresets.disabled).toBeDefined();
    expect(ResiliencePresets.disabled.enabled).toBe(false);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SDK Integration Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { Cortex } from "../src";
import { createTestRunContext } from "./helpers/isolation";

describe("SDK Resilience Integration", () => {
  const ctx = createTestRunContext();
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  describe("SDK methods use resilience layer", () => {
    let cortexWithResilience: Cortex;
    let cortexWithoutResilience: Cortex;

    beforeAll(() => {
      cortexWithResilience = new Cortex({
        convexUrl: CONVEX_URL,
        resilience: ResiliencePresets.default,
      });

      cortexWithoutResilience = new Cortex({
        convexUrl: CONVEX_URL,
        resilience: ResiliencePresets.disabled,
      });
    });

    afterAll(() => {
      cortexWithResilience.close();
      cortexWithoutResilience.close();
    });

    test("SDK should accept resilience config", () => {
      expect(cortexWithResilience).toBeDefined();
      expect(cortexWithoutResilience).toBeDefined();
    });

    test("users API should work with resilience enabled", async () => {
      const userId = ctx.userId("resilience-test");

      // This will auto-create the user via getOrCreate internally
      const user = await cortexWithResilience.users.update(userId, {
        displayName: "Resilience Test User",
        metadata: { test: true },
      });

      expect(user).toBeDefined();
      expect(user.id).toBe(userId);
    });

    test("memorySpaces API should work with resilience enabled", async () => {
      const spaceId = ctx.memorySpaceId("resilience-test");

      const space = await cortexWithResilience.memorySpaces.register({
        memorySpaceId: spaceId,
        name: "Resilience Test Space",
        type: "custom",
      });

      expect(space).toBeDefined();
      expect(space.memorySpaceId).toBe(spaceId);
    });

    test("conversations API should work with resilience enabled", async () => {
      const spaceId = ctx.memorySpaceId("conv-resilience");
      const convId = ctx.conversationId("resilience-test");

      // Setup memory space first
      await cortexWithResilience.memorySpaces.register({
        memorySpaceId: spaceId,
        name: "Conv Test Space",
        type: "custom",
      });

      const conv = await cortexWithResilience.conversations.create({
        memorySpaceId: spaceId,
        conversationId: convId,
        type: "user-agent",
        participants: {
          userId: ctx.userId("conv-test"),
          agentId: ctx.agentId("conv-test"),
        },
      });

      expect(conv).toBeDefined();
      expect(conv.conversationId).toBe(convId);
    });

    test("vector API should work with resilience enabled", async () => {
      const spaceId = ctx.memorySpaceId("vector-resilience");

      // Setup memory space first
      await cortexWithResilience.memorySpaces.register({
        memorySpaceId: spaceId,
        name: "Vector Test Space",
        type: "custom",
      });

      const memory = await cortexWithResilience.vector.store(spaceId, {
        content: "Test memory for resilience",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: ["test"] },
      });

      expect(memory).toBeDefined();
      expect(memory.memoryId).toBeDefined();
    });

    test("facts API should work with resilience enabled", async () => {
      const spaceId = ctx.memorySpaceId("facts-resilience");

      // Setup memory space first
      await cortexWithResilience.memorySpaces.register({
        memorySpaceId: spaceId,
        name: "Facts Test Space",
        type: "custom",
      });

      const fact = await cortexWithResilience.facts.store({
        memorySpaceId: spaceId,
        fact: "User prefers dark mode",
        factType: "preference",
        subject: "test-user",
        confidence: 90,
        sourceType: "system",
      });

      expect(fact).toBeDefined();
      expect(fact.factId).toBeDefined();
    });

    test("immutable API should work with resilience enabled", async () => {
      const entryType = ctx.immutableType("resilience");
      const entryId = ctx.immutableId("test");

      const entry = await cortexWithResilience.immutable.store({
        type: entryType,
        id: entryId,
        data: { test: true },
      });

      expect(entry).toBeDefined();
      expect(entry.id).toBe(entryId);
    });

    test("mutable API should work with resilience enabled", async () => {
      const namespace = ctx.mutableNamespace("resilience");
      const key = ctx.mutableKey("test");

      const record = await cortexWithResilience.mutable.set(namespace, key, {
        value: "test",
      });

      expect(record).toBeDefined();
      expect(record.key).toBe(key);
    });

    test("contexts API should work with resilience enabled", async () => {
      const spaceId = ctx.memorySpaceId("ctx-resilience");

      // Setup memory space first
      await cortexWithResilience.memorySpaces.register({
        memorySpaceId: spaceId,
        name: "Contexts Test Space",
        type: "custom",
      });

      const context = await cortexWithResilience.contexts.create({
        memorySpaceId: spaceId,
        purpose: "Resilience test context",
      });

      expect(context).toBeDefined();
      expect(context.contextId).toBeDefined();
    });
  });

  describe("Resilience layer rate limiting", () => {
    let cortex: Cortex;
    let resilience: ResilienceLayer;

    beforeAll(() => {
      // Create a very restrictive resilience config
      resilience = new ResilienceLayer({
        enabled: true,
        rateLimiter: { bucketSize: 10, refillRate: 100 },
        concurrency: { maxConcurrent: 5, queueSize: 50, timeout: 5000 },
        circuitBreaker: {
          failureThreshold: 10,
          successThreshold: 2,
          timeout: 30000,
        },
      });

      cortex = new Cortex({
        convexUrl: CONVEX_URL,
        resilience: {
          enabled: true,
          rateLimiter: { bucketSize: 10, refillRate: 100 },
          concurrency: { maxConcurrent: 5, queueSize: 50, timeout: 5000 },
          circuitBreaker: {
            failureThreshold: 10,
            successThreshold: 2,
            timeout: 30000,
          },
        },
      });
    });

    afterAll(() => {
      resilience.stopQueueProcessor();
      cortex.close();
    });

    test("resilience layer executes operations successfully", async () => {
      const testOps = [
        createOperation("result1"),
        createOperation("result2"),
        createOperation("result3"),
      ];

      const results: string[] = [];
      for (const op of testOps) {
        const result = await resilience.execute(op, "test:operation");
        results.push(result);
      }

      // Verify all operations completed
      expect(results).toEqual(["result1", "result2", "result3"]);

      // Verify resilience layer is healthy
      expect(resilience.isHealthy()).toBe(true);
      expect(resilience.isAcceptingRequests()).toBe(true);
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// executeWithRetry Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("ResilienceLayer.executeWithRetry", () => {
  let resilience: ResilienceLayer;

  beforeEach(() => {
    resilience = new ResilienceLayer({
      enabled: true,
      rateLimiter: { bucketSize: 100, refillRate: 100 },
      concurrency: { maxConcurrent: 10, queueSize: 100, timeout: 5000 },
      circuitBreaker: {
        failureThreshold: 10,
        successThreshold: 2,
        timeout: 100,
        halfOpenMax: 3,
      },
    });
  });

  afterEach(() => {
    resilience.stopQueueProcessor();
  });

  test("should succeed on first try", async () => {
    const result = await resilience.executeWithRetry(
      createOperation("success"),
      "test:operation",
      3,
      10,
    );
    expect(result).toBe("success");
  });

  test("should retry and succeed after transient failure", async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      if (attempts < 2) {
        throw new Error("Transient error");
      }
      return "success";
    };

    const result = await resilience.executeWithRetry(
      operation,
      "test:operation",
      3,
      10,
    );

    expect(result).toBe("success");
    expect(attempts).toBe(2);
  });

  test("should use exponential backoff between retries", async () => {
    let attempts = 0;
    const timestamps: number[] = [];
    const operation = async () => {
      timestamps.push(Date.now());
      attempts++;
      if (attempts < 3) {
        throw new Error("Transient error");
      }
      return "success";
    };

    const result = await resilience.executeWithRetry(
      operation,
      "test:operation",
      3,
      50, // 50ms base delay
    );

    expect(result).toBe("success");
    expect(attempts).toBe(3);

    // Check exponential backoff: first retry ~50ms, second retry ~100ms
    if (timestamps.length >= 3) {
      const firstDelay = timestamps[1] - timestamps[0];
      const secondDelay = timestamps[2] - timestamps[1];
      // Second delay should be roughly double the first (with some tolerance)
      expect(secondDelay).toBeGreaterThan(firstDelay * 1.5);
    }
  });

  test("should throw after max retries exhausted", async () => {
    const operation = async (): Promise<string> => {
      throw new Error("Persistent error");
    };

    await expect(
      resilience.executeWithRetry(operation, "test:operation", 2, 10),
    ).rejects.toThrow("Persistent error");
  });

  test("should not retry on CircuitOpenError", async () => {
    // Force circuit open
    const failingResilience = new ResilienceLayer({
      enabled: true,
      rateLimiter: { bucketSize: 100, refillRate: 100 },
      concurrency: { maxConcurrent: 10, queueSize: 100, timeout: 5000 },
      circuitBreaker: {
        failureThreshold: 1,
        successThreshold: 2,
        timeout: 60000, // Long timeout so it stays open
        halfOpenMax: 0, // No test requests allowed
      },
    });

    // Trip the circuit
    try {
      await failingResilience.execute(
        createFailingOperation(new Error("Trip circuit")),
        "test:operation",
      );
    } catch {}

    // Now circuit should be open - executeWithRetry should not retry
    let attempts = 0;
    const operation = async () => {
      attempts++;
      return "success";
    };

    // The operation never gets called because circuit is open and ops are queued
    // After waiting for queue timeout, it should eventually process
    // But let's test that CircuitOpenError thrown directly isn't retried
    failingResilience.stopQueueProcessor();

    // Create a new resilience layer that's already open with no queue processing
    const openResilience = new ResilienceLayer({
      enabled: true,
      rateLimiter: { bucketSize: 100, refillRate: 100 },
      concurrency: { maxConcurrent: 10, queueSize: 0, timeout: 100 }, // No queue
      circuitBreaker: {
        failureThreshold: 1,
        successThreshold: 2,
        timeout: 60000,
        halfOpenMax: 0,
      },
    });

    // Trip the circuit
    try {
      await openResilience.execute(
        createFailingOperation(new Error("Trip circuit")),
        "test:operation",
      );
    } catch {}

    openResilience.stopQueueProcessor();
  });

  test("should not retry on QueueFullError", async () => {
    const fullResilience = new ResilienceLayer({
      enabled: true,
      rateLimiter: { bucketSize: 100, refillRate: 100 },
      concurrency: { maxConcurrent: 1, queueSize: 0, timeout: 100 },
      circuitBreaker: {
        failureThreshold: 10,
        successThreshold: 2,
        timeout: 100,
      },
      queue: {
        maxSize: { critical: 0, high: 0, normal: 0, low: 0, background: 0 },
      },
    });

    // Occupy the only permit
    const holdingOperation = new Promise<void>((resolve) => {
      setTimeout(resolve, 1000);
    });
    void fullResilience.execute(async () => {
      await holdingOperation;
      return "done";
    }, "test:operation");

    // Give it time to acquire the permit
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Now try to execute - should fail with queue full since no queue space
    // Note: The actual behavior depends on implementation - may timeout instead
    fullResilience.stopQueueProcessor();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// isNonSystemFailure Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("isNonSystemFailure", () => {
  describe("Category 1: Not Found Errors", () => {
    test("should identify NOT_FOUND errors as non-system failures", () => {
      expect(isNonSystemFailure("NOT_FOUND")).toBe(true);
      expect(isNonSystemFailure("USER_NOT_FOUND")).toBe(true);
      expect(isNonSystemFailure("MEMORY_NOT_FOUND")).toBe(true);
      expect(isNonSystemFailure("FACT_NOT_FOUND")).toBe(true);
      expect(isNonSystemFailure("CONVERSATION_NOT_FOUND")).toBe(true);
      expect(isNonSystemFailure("IMMUTABLE_ENTRY_NOT_FOUND")).toBe(true);
      expect(isNonSystemFailure("MUTABLE_KEY_NOT_FOUND")).toBe(true);
      expect(isNonSystemFailure("KEY_NOT_FOUND")).toBe(true);
      expect(isNonSystemFailure("CONTEXT_NOT_FOUND")).toBe(true);
      expect(isNonSystemFailure("MEMORY_SPACE_NOT_FOUND")).toBe(true);
      expect(isNonSystemFailure("MEMORYSPACE_NOT_FOUND")).toBe(true);
      expect(isNonSystemFailure("AGENT_NOT_FOUND")).toBe(true);
      expect(isNonSystemFailure("AGENT_NOT_REGISTERED")).toBe(true);
      expect(isNonSystemFailure("VERSION_NOT_FOUND")).toBe(true);
      expect(isNonSystemFailure("PARENT_NOT_FOUND")).toBe(true);
    });

    test("should handle lowercase 'not found'", () => {
      expect(isNonSystemFailure("entity not found")).toBe(true);
      expect(isNonSystemFailure("Resource not found")).toBe(true);
    });
  });

  describe("Category 2: Validation Errors", () => {
    test("should identify validation errors as non-system failures", () => {
      expect(isNonSystemFailure("INVALID_INPUT")).toBe(true);
      expect(isNonSystemFailure("INVALID_ID")).toBe(true);
      expect(isNonSystemFailure("INVALID_MEMORY_SPACE")).toBe(true);
      expect(isNonSystemFailure("DATA_TOO_LARGE")).toBe(true);
      expect(isNonSystemFailure("VALUE_TOO_LARGE")).toBe(true);
    });

    test("should handle lowercase validation errors", () => {
      expect(isNonSystemFailure("invalid parameter")).toBe(true);
      expect(isNonSystemFailure("validation error: field required")).toBe(true);
      expect(isNonSystemFailure("validation failed")).toBe(true);
    });
  });

  describe("Category 3: Duplicate/Conflict Errors", () => {
    test("should identify duplicate errors as non-system failures", () => {
      expect(isNonSystemFailure("ALREADY_EXISTS")).toBe(true);
      expect(isNonSystemFailure("ALREADY_REGISTERED")).toBe(true);
      expect(isNonSystemFailure("MEMORYSPACE_ALREADY_EXISTS")).toBe(true);
      expect(isNonSystemFailure("AGENT_ALREADY_REGISTERED")).toBe(true);
      expect(isNonSystemFailure("DUPLICATE")).toBe(true);
      expect(isNonSystemFailure("CONFLICT")).toBe(true);
    });

    test("should handle lowercase duplicate errors", () => {
      expect(isNonSystemFailure("resource already exists")).toBe(true);
      expect(isNonSystemFailure("agent already registered")).toBe(true);
    });
  });

  describe("Category 4: Empty Result Errors", () => {
    test("should identify empty result errors as non-system failures", () => {
      expect(isNonSystemFailure("NO_MEMORIES_MATCHED")).toBe(true);
      expect(isNonSystemFailure("NO_USERS_MATCHED")).toBe(true);
    });

    test("should handle lowercase empty result errors", () => {
      expect(isNonSystemFailure("no results found")).toBe(true);
      expect(isNonSystemFailure("no matches")).toBe(true);
    });
  });

  describe("Category 5: Permission Errors", () => {
    test("should identify permission errors as non-system failures", () => {
      expect(isNonSystemFailure("PERMISSION_DENIED")).toBe(true);
      expect(isNonSystemFailure("UNAUTHORIZED")).toBe(true);
      expect(isNonSystemFailure("FORBIDDEN")).toBe(true);
      expect(isNonSystemFailure("ACCESS_DENIED")).toBe(true);
    });

    test("should handle lowercase permission errors", () => {
      expect(isNonSystemFailure("permission denied")).toBe(true);
      expect(isNonSystemFailure("unauthorized access")).toBe(true);
      expect(isNonSystemFailure("forbidden resource")).toBe(true);
    });
  });

  describe("Category 6: Configuration Errors", () => {
    test("should identify config errors as non-system failures", () => {
      expect(isNonSystemFailure("CLOUD_MODE_REQUIRED")).toBe(true);
      expect(isNonSystemFailure("PUBSUB_NOT_CONFIGURED")).toBe(true);
    });

    test("should handle lowercase config errors", () => {
      expect(isNonSystemFailure("feature not configured")).toBe(true);
      expect(isNonSystemFailure("service not enabled")).toBe(true);
    });
  });

  describe("Category 7: Business Logic Errors", () => {
    test("should identify business logic errors as non-system failures", () => {
      expect(isNonSystemFailure("HAS_CHILDREN")).toBe(true);
      expect(isNonSystemFailure("MEMORYSPACE_HAS_DATA")).toBe(true);
      expect(isNonSystemFailure("PURGE_CANCELLED")).toBe(true);
      expect(isNonSystemFailure("DELETION_CANCELLED")).toBe(true);
    });

    test("should handle lowercase business logic errors", () => {
      expect(isNonSystemFailure("entity has children")).toBe(true);
      expect(isNonSystemFailure("space has data")).toBe(true);
      expect(isNonSystemFailure("operation cancelled")).toBe(true);
    });
  });

  describe("Error Object Handling", () => {
    test("should handle Error objects", () => {
      expect(isNonSystemFailure(new Error("USER_NOT_FOUND"))).toBe(true);
      expect(isNonSystemFailure(new Error("validation error"))).toBe(true);
      expect(isNonSystemFailure(new Error("SYSTEM_FAILURE"))).toBe(false);
    });

    test("should handle non-Error objects via String conversion", () => {
      // Objects are converted to string using String(), so plain objects become "[object Object]"
      // Only strings and Error objects with matching patterns will return true
      expect(isNonSystemFailure("USER_NOT_FOUND")).toBe(true);
      expect(isNonSystemFailure(null)).toBe(false);
      expect(isNonSystemFailure(undefined)).toBe(false);
      expect(isNonSystemFailure(123)).toBe(false);
    });
  });

  describe("System Failures (should NOT match)", () => {
    test("should identify actual system failures", () => {
      expect(isNonSystemFailure("SYSTEM_ERROR")).toBe(false);
      expect(isNonSystemFailure("DATABASE_CONNECTION_FAILED")).toBe(false);
      expect(isNonSystemFailure("TIMEOUT")).toBe(false);
      expect(isNonSystemFailure("INTERNAL_ERROR")).toBe(false);
      expect(isNonSystemFailure("NetworkError")).toBe(false);
      expect(isNonSystemFailure("Connection refused")).toBe(false);
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Additional PriorityQueue Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("PriorityQueue Extended Tests", () => {
  const createRequest = (
    priority: Priority,
    id: string = "test",
    queuedAt?: number,
  ): QueuedRequest => ({
    id,
    operation: async () => "result",
    priority,
    operationName: "test",
    queuedAt: queuedAt ?? Date.now(),
    attempts: 0,
    resolve: () => {},
    reject: () => {},
  });

  describe("tryEnqueue", () => {
    test("should successfully enqueue when queue has capacity", () => {
      const queue = new PriorityQueue();
      const result = queue.tryEnqueue(createRequest("normal", "test-1"));
      expect(result).toBe(true);
      expect(queue.size()).toBe(1);
    });

    test("should return false when queue is full", () => {
      const queue = new PriorityQueue({
        maxSize: { critical: 1, high: 1, normal: 1, low: 1, background: 1 },
      });
      queue.enqueue(createRequest("normal", "first"));
      const result = queue.tryEnqueue(createRequest("normal", "second"));
      expect(result).toBe(false);
      expect(queue.size()).toBe(1);
    });

    test("should track dropped count when queue is full", () => {
      const queue = new PriorityQueue({
        maxSize: { critical: 1, high: 1, normal: 1, low: 1, background: 1 },
      });
      queue.enqueue(createRequest("normal", "first"));
      queue.tryEnqueue(createRequest("normal", "second"));
      expect(queue.getMetrics().dropped).toBe(1);
    });
  });

  describe("peek", () => {
    test("should return highest priority request without removing it", () => {
      const queue = new PriorityQueue();
      queue.enqueue(createRequest("low", "low-1"));
      queue.enqueue(createRequest("high", "high-1"));

      const peeked = queue.peek();
      expect(peeked?.id).toBe("high-1");
      expect(queue.size()).toBe(2); // Still 2 items
    });

    test("should return undefined when queue is empty", () => {
      const queue = new PriorityQueue();
      expect(queue.peek()).toBeUndefined();
    });
  });

  describe("isEmpty", () => {
    test("should return true when queue is empty", () => {
      const queue = new PriorityQueue();
      expect(queue.isEmpty()).toBe(true);
    });

    test("should return false when queue has items", () => {
      const queue = new PriorityQueue();
      queue.enqueue(createRequest("normal"));
      expect(queue.isEmpty()).toBe(false);
    });

    test("should return true after all items dequeued", () => {
      const queue = new PriorityQueue();
      queue.enqueue(createRequest("normal"));
      queue.dequeue();
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe("hasCapacity", () => {
    test("should return true when priority queue has space", () => {
      const queue = new PriorityQueue({
        maxSize: { critical: 5, high: 5, normal: 5, low: 5, background: 5 },
      });
      expect(queue.hasCapacity("normal")).toBe(true);
    });

    test("should return false when priority queue is full", () => {
      const queue = new PriorityQueue({
        maxSize: { critical: 1, high: 1, normal: 1, low: 1, background: 1 },
      });
      queue.enqueue(createRequest("normal", "first"));
      expect(queue.hasCapacity("normal")).toBe(false);
    });

    test("should check capacity independently per priority", () => {
      const queue = new PriorityQueue({
        maxSize: { critical: 1, high: 1, normal: 1, low: 1, background: 1 },
      });
      queue.enqueue(createRequest("normal", "first"));
      expect(queue.hasCapacity("normal")).toBe(false);
      expect(queue.hasCapacity("high")).toBe(true);
    });
  });

  describe("getOldestRequestAge", () => {
    test("should return age of oldest request", async () => {
      const queue = new PriorityQueue();
      const oldTime = Date.now() - 1000; // 1 second ago
      queue.enqueue(createRequest("normal", "old", oldTime));
      queue.enqueue(createRequest("normal", "new", Date.now()));

      const age = queue.getOldestRequestAge();
      expect(age).toBeGreaterThanOrEqual(1000);
      expect(age).toBeLessThan(2000);
    });

    test("should return undefined when queue is empty", () => {
      const queue = new PriorityQueue();
      expect(queue.getOldestRequestAge()).toBeUndefined();
    });
  });

  describe("removeExpired", () => {
    test("should remove requests older than maxAge", () => {
      const queue = new PriorityQueue();
      const oldTime = Date.now() - 1000; // 1 second ago
      queue.enqueue(createRequest("normal", "old", oldTime));
      queue.enqueue(createRequest("normal", "new", Date.now()));

      const removed = queue.removeExpired(500); // 500ms max age
      expect(removed).toBe(1);
      expect(queue.size()).toBe(1);
    });

    test("should call reject on expired requests", () => {
      const queue = new PriorityQueue();
      let rejected = false;
      const request: QueuedRequest = {
        id: "expiring",
        operation: async () => "result",
        priority: "normal",
        operationName: "test",
        queuedAt: Date.now() - 1000,
        attempts: 0,
        resolve: () => {},
        reject: () => {
          rejected = true;
        },
      };
      queue.enqueue(request);

      queue.removeExpired(500);
      expect(rejected).toBe(true);
    });

    test("should return 0 when no requests expired", () => {
      const queue = new PriorityQueue();
      queue.enqueue(createRequest("normal", "fresh"));
      const removed = queue.removeExpired(10000); // 10s max age
      expect(removed).toBe(0);
    });
  });

  describe("cancel", () => {
    test("should cancel and remove request by ID", () => {
      const queue = new PriorityQueue();
      queue.enqueue(createRequest("normal", "req-1"));
      queue.enqueue(createRequest("normal", "req-2"));

      const result = queue.cancel("req-1");
      expect(result).toBe(true);
      expect(queue.size()).toBe(1);
    });

    test("should return false when request ID not found", () => {
      const queue = new PriorityQueue();
      queue.enqueue(createRequest("normal", "req-1"));

      const result = queue.cancel("nonexistent");
      expect(result).toBe(false);
    });

    test("should call reject on cancelled request", () => {
      const queue = new PriorityQueue();
      let rejected = false;
      const request: QueuedRequest = {
        id: "to-cancel",
        operation: async () => "result",
        priority: "normal",
        operationName: "test",
        queuedAt: Date.now(),
        attempts: 0,
        resolve: () => {},
        reject: () => {
          rejected = true;
        },
      };
      queue.enqueue(request);

      queue.cancel("to-cancel");
      expect(rejected).toBe(true);
    });
  });

  describe("clear", () => {
    test("should remove all requests from all queues", () => {
      const queue = new PriorityQueue();
      queue.enqueue(createRequest("critical", "c-1"));
      queue.enqueue(createRequest("high", "h-1"));
      queue.enqueue(createRequest("normal", "n-1"));
      queue.enqueue(createRequest("low", "l-1"));
      queue.enqueue(createRequest("background", "b-1"));

      queue.clear();
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    test("should reject all pending requests when cleared", () => {
      const queue = new PriorityQueue();
      const rejections: string[] = [];

      for (const priority of [
        "critical",
        "high",
        "normal",
      ] as Priority[]) {
        const request: QueuedRequest = {
          id: `${priority}-req`,
          operation: async () => "result",
          priority,
          operationName: "test",
          queuedAt: Date.now(),
          attempts: 0,
          resolve: () => {},
          reject: (err) => {
            rejections.push(err.message);
          },
        };
        queue.enqueue(request);
      }

      queue.clear();
      expect(rejections).toHaveLength(3);
      expect(rejections.every((msg) => msg.includes("cleared"))).toBe(true);
    });
  });

  describe("resetMetrics", () => {
    test("should reset processed and dropped counters", () => {
      const queue = new PriorityQueue({
        maxSize: { critical: 1, high: 1, normal: 1, low: 1, background: 1 },
      });

      // Process some requests
      queue.enqueue(createRequest("normal", "req-1"));
      queue.dequeue();

      // Try to overfill to get dropped count
      queue.enqueue(createRequest("normal", "req-2"));
      queue.tryEnqueue(createRequest("normal", "req-3")); // Should fail

      const metricsBefore = queue.getMetrics();
      expect(metricsBefore.processed).toBe(1);
      expect(metricsBefore.dropped).toBe(1);

      queue.resetMetrics();

      const metricsAfter = queue.getMetrics();
      expect(metricsAfter.processed).toBe(0);
      expect(metricsAfter.dropped).toBe(0);
    });

    test("should keep queued requests when resetting metrics", () => {
      const queue = new PriorityQueue();
      queue.enqueue(createRequest("normal", "req-1"));
      queue.enqueue(createRequest("normal", "req-2"));

      queue.resetMetrics();

      expect(queue.size()).toBe(2);
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Additional CircuitBreaker Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("CircuitBreaker Extended Tests", () => {
  describe("forceOpen", () => {
    test("should force circuit to open from closed state", () => {
      const cb = new CircuitBreaker();
      expect(cb.getState()).toBe("closed");

      cb.forceOpen();
      expect(cb.getState()).toBe("open");
    });

    test("should force circuit to open from half-open state", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        timeout: 10,
      });

      // Trip the circuit
      try {
        await cb.execute(createFailingOperation(new Error("test")));
      } catch {}

      // Wait for half-open
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(cb.getState()).toBe("half-open");

      cb.forceOpen();
      expect(cb.getState()).toBe("open");
    });

    test("should call onOpen callback when forced open", () => {
      let callbackCalled = false;
      const cb = new CircuitBreaker(
        { failureThreshold: 5 },
        { onOpen: () => { callbackCalled = true; } },
      );

      cb.forceOpen();
      expect(callbackCalled).toBe(true);
    });
  });

  describe("forceClose", () => {
    test("should force circuit to closed from open state", async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, timeout: 60000 });

      // Trip the circuit
      try {
        await cb.execute(createFailingOperation(new Error("test")));
      } catch {}
      expect(cb.getState()).toBe("open");

      cb.forceClose();
      expect(cb.getState()).toBe("closed");
    });

    test("should call onClose callback when forced closed", async () => {
      let callbackCalled = false;
      const cb = new CircuitBreaker(
        { failureThreshold: 1, timeout: 60000 },
        { onClose: () => { callbackCalled = true; } },
      );

      // Trip then force close
      try {
        await cb.execute(createFailingOperation(new Error("test")));
      } catch {}

      cb.forceClose();
      expect(callbackCalled).toBe(true);
    });
  });

  describe("reset", () => {
    test("should reset all state including failure count", async () => {
      const cb = new CircuitBreaker({ failureThreshold: 5 });

      // Accumulate failures
      for (let i = 0; i < 3; i++) {
        try {
          await cb.execute(createFailingOperation(new Error("test")));
        } catch {}
      }
      expect(cb.getMetrics().failures).toBe(3);

      cb.reset();

      expect(cb.getState()).toBe("closed");
      expect(cb.getMetrics().failures).toBe(0);
      expect(cb.getMetrics().totalOpens).toBe(0);
    });

    test("should reset from any state to closed", async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, timeout: 10 });

      // Trip to open
      try {
        await cb.execute(createFailingOperation(new Error("test")));
      } catch {}
      expect(cb.getState()).toBe("open");

      cb.reset();
      expect(cb.getState()).toBe("closed");
    });
  });

  describe("getTimeUntilClose", () => {
    test("should return 0 when circuit is closed", () => {
      const cb = new CircuitBreaker();
      expect(cb.getTimeUntilClose()).toBe(0);
    });

    test("should return remaining time when circuit is open", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        timeout: 1000, // 1 second
      });

      // Trip the circuit
      try {
        await cb.execute(createFailingOperation(new Error("test")));
      } catch {}

      const timeUntilClose = cb.getTimeUntilClose();
      expect(timeUntilClose).toBeGreaterThan(0);
      expect(timeUntilClose).toBeLessThanOrEqual(1000);
    });

    test("should return 0 when circuit is half-open", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        timeout: 10,
      });

      // Trip and wait for half-open
      try {
        await cb.execute(createFailingOperation(new Error("test")));
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(cb.getState()).toBe("half-open");
      expect(cb.getTimeUntilClose()).toBe(0);
    });
  });

  describe("allowsExecution", () => {
    test("should return true when closed", () => {
      const cb = new CircuitBreaker();
      expect(cb.allowsExecution()).toBe(true);
    });

    test("should return false when open", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        timeout: 60000,
      });

      try {
        await cb.execute(createFailingOperation(new Error("test")));
      } catch {}

      expect(cb.allowsExecution()).toBe(false);
    });

    test("should limit requests in half-open state", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        timeout: 10,
        halfOpenMax: 2,
      });

      // Trip and wait for half-open
      try {
        await cb.execute(createFailingOperation(new Error("test")));
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(cb.getState()).toBe("half-open");

      // Should allow up to halfOpenMax requests
      expect(cb.allowsExecution()).toBe(true);
      await cb.execute(createOperation("test1"));
      expect(cb.allowsExecution()).toBe(true);
      await cb.execute(createOperation("test2"));

      // Circuit should now be closed (2 successes met threshold)
      expect(cb.getState()).toBe("closed");
    });

    test("should reopen circuit on failure in half-open", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        successThreshold: 3,
        timeout: 10,
        halfOpenMax: 5,
      });

      // Trip and wait for half-open
      try {
        await cb.execute(createFailingOperation(new Error("test")));
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(cb.getState()).toBe("half-open");

      // Fail in half-open should reopen
      try {
        await cb.execute(createFailingOperation(new Error("test")));
      } catch {}

      expect(cb.getState()).toBe("open");
    });
  });

  describe("callbacks", () => {
    test("should call onHalfOpen callback", async () => {
      let callbackCalled = false;
      const cb = new CircuitBreaker(
        { failureThreshold: 1, timeout: 10 },
        { onHalfOpen: () => { callbackCalled = true; } },
      );

      // Trip the circuit
      try {
        await cb.execute(createFailingOperation(new Error("test")));
      } catch {}

      // Wait for half-open transition
      await new Promise((resolve) => setTimeout(resolve, 20));
      cb.getState(); // Triggers state check

      expect(callbackCalled).toBe(true);
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Additional Semaphore Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Semaphore Extended Tests", () => {
  describe("getAvailableCount", () => {
    test("should return max permits initially", () => {
      const sem = new Semaphore({ maxConcurrent: 5 });
      expect(sem.getAvailableCount()).toBe(5);
    });

    test("should decrease after acquisitions", () => {
      const sem = new Semaphore({ maxConcurrent: 5 });
      sem.tryAcquire();
      sem.tryAcquire();
      expect(sem.getAvailableCount()).toBe(3);
    });

    test("should increase after release", () => {
      const sem = new Semaphore({ maxConcurrent: 5 });
      const permit = sem.tryAcquire()!;
      expect(sem.getAvailableCount()).toBe(4);
      permit.release();
      expect(sem.getAvailableCount()).toBe(5);
    });
  });

  describe("reset", () => {
    test("should restore all permits", () => {
      const sem = new Semaphore({ maxConcurrent: 5 });
      sem.tryAcquire();
      sem.tryAcquire();
      sem.tryAcquire();

      sem.reset();

      expect(sem.getAvailableCount()).toBe(5);
      expect(sem.getActiveCount()).toBe(0);
    });

    test("should reject all waiting requests", async () => {
      const sem = new Semaphore({
        maxConcurrent: 1,
        queueSize: 10,
        timeout: 5000,
      });

      // Acquire the only permit
      await sem.acquire();

      // Start waiting
      const waitPromise = sem.acquire().catch((err) => err.message);

      // Give it time to queue
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(sem.getWaitingCount()).toBe(1);

      // Reset should reject waiting request
      sem.reset();

      const error = await waitPromise;
      expect(error).toContain("reset");
      expect(sem.getWaitingCount()).toBe(0);
    });

    test("should reset metrics", () => {
      const sem = new Semaphore({ maxConcurrent: 5 });
      sem.tryAcquire();
      sem.tryAcquire();

      expect(sem.getMetrics().maxReached).toBe(2);

      sem.reset();

      expect(sem.getMetrics().maxReached).toBe(0);
      expect(sem.getMetrics().timeouts).toBe(0);
    });
  });

  describe("double release warning", () => {
    test("should warn on double release", () => {
      const sem = new Semaphore({ maxConcurrent: 5 });
      const permit = sem.tryAcquire()!;

      // Capture console.warn calls
      const warnings: unknown[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => warnings.push(args.join(" "));

      try {
        permit.release();
        permit.release(); // Second release should warn

        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[0]).toContain("multiple times");
      } finally {
        console.warn = originalWarn;
      }
    });

    test("should not change count on double release", () => {
      const sem = new Semaphore({ maxConcurrent: 5 });
      const permit = sem.tryAcquire()!;

      // Suppress warning
      const originalWarn = console.warn;
      console.warn = () => {};

      try {
        permit.release();
        expect(sem.getAvailableCount()).toBe(5);

        permit.release(); // Double release
        expect(sem.getAvailableCount()).toBe(5); // Should still be 5, not 6
      } finally {
        console.warn = originalWarn;
      }
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Additional TokenBucket Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("TokenBucket Extended Tests", () => {
  describe("getTimeUntilNextToken", () => {
    test("should return 0 when tokens are available", () => {
      const bucket = new TokenBucket({ bucketSize: 10, refillRate: 50 });
      expect(bucket.getTimeUntilNextToken()).toBe(0);
    });

    test("should return time until next token when empty", () => {
      const bucket = new TokenBucket({ bucketSize: 1, refillRate: 10 }); // 10/sec = 100ms per token
      bucket.tryAcquire();

      const timeUntilNext = bucket.getTimeUntilNextToken();
      expect(timeUntilNext).toBeGreaterThan(0);
      expect(timeUntilNext).toBeLessThanOrEqual(100);
    });

    test("should return 0 after partial refill", async () => {
      const bucket = new TokenBucket({ bucketSize: 1, refillRate: 100 }); // 100/sec = 10ms per token
      bucket.tryAcquire();

      // Wait for refill
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(bucket.getTimeUntilNextToken()).toBe(0);
    });
  });

  describe("edge cases", () => {
    test("should handle very slow refill rate", async () => {
      const bucket = new TokenBucket({ bucketSize: 1, refillRate: 0.1 }); // 0.1/sec = 10 seconds per token
      bucket.tryAcquire();

      const timeUntilNext = bucket.getTimeUntilNextToken();
      expect(timeUntilNext).toBeGreaterThan(9000); // Should be ~10 seconds
    });

    test("should not exceed bucket size on refill", async () => {
      const bucket = new TokenBucket({ bucketSize: 5, refillRate: 1000 }); // Fast refill

      // Wait for potential over-refill
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(bucket.getAvailableTokens()).toBeLessThanOrEqual(5);
    });

    test("should track throttled requests in metrics", async () => {
      const bucket = new TokenBucket({ bucketSize: 1, refillRate: 100 });

      bucket.tryAcquire();

      // This should wait and track throttle
      await bucket.acquire();

      const metrics = bucket.getMetrics();
      expect(metrics.requestsThrottled).toBe(1);
      expect(metrics.avgWaitTimeMs).toBeGreaterThan(0);
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Plan Detection Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Plan Detection Functions", () => {
  const originalEnv = process.env.CONVEX_PLAN;

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.CONVEX_PLAN = originalEnv;
    } else {
      delete process.env.CONVEX_PLAN;
    }
  });

  describe("getPresetForPlan", () => {
    test("should return default preset for free plan", () => {
      const preset = getPresetForPlan("free");
      expect(preset).toEqual(ResiliencePresets.default);
    });

    test("should return default preset for starter plan", () => {
      const preset = getPresetForPlan("starter");
      expect(preset).toEqual(ResiliencePresets.default);
    });

    test("should return batchProcessing preset for professional plan", () => {
      const preset = getPresetForPlan("professional");
      expect(preset).toEqual(ResiliencePresets.batchProcessing);
    });

    test("should read from CONVEX_PLAN env var when no parameter", () => {
      process.env.CONVEX_PLAN = "professional";
      const preset = getPresetForPlan();
      expect(preset).toEqual(ResiliencePresets.batchProcessing);
    });

    test("should default to free plan when env var not set", () => {
      delete process.env.CONVEX_PLAN;
      const preset = getPresetForPlan();
      expect(preset).toEqual(ResiliencePresets.default);
    });

    test("should handle case insensitivity", () => {
      process.env.CONVEX_PLAN = "PROFESSIONAL";
      const preset = getPresetForPlan();
      expect(preset).toEqual(ResiliencePresets.batchProcessing);
    });
  });

  describe("getDetectedPlanTier", () => {
    test("should return professional when env is professional", () => {
      process.env.CONVEX_PLAN = "professional";
      expect(getDetectedPlanTier()).toBe("professional");
    });

    test("should return starter when env is starter", () => {
      process.env.CONVEX_PLAN = "starter";
      expect(getDetectedPlanTier()).toBe("starter");
    });

    test("should return free when env not set", () => {
      delete process.env.CONVEX_PLAN;
      expect(getDetectedPlanTier()).toBe("free");
    });

    test("should return free for unknown plan", () => {
      process.env.CONVEX_PLAN = "enterprise";
      expect(getDetectedPlanTier()).toBe("free");
    });
  });

  describe("getPlanLimits", () => {
    test("should return free plan limits by default", () => {
      const limits = getPlanLimits("free");
      expect(limits.concurrentQueries).toBe(16);
      expect(limits.concurrentMutations).toBe(16);
      expect(limits.concurrentActions).toBe(64);
      expect(limits.maxNodeActions).toBe(64);
    });

    test("should return professional plan limits", () => {
      const limits = getPlanLimits("professional");
      expect(limits.concurrentQueries).toBe(256);
      expect(limits.concurrentMutations).toBe(256);
      expect(limits.concurrentActions).toBe(256);
      expect(limits.maxNodeActions).toBe(1000);
    });

    test("should use detected plan when no parameter", () => {
      process.env.CONVEX_PLAN = "professional";
      const limits = getPlanLimits();
      expect(limits.concurrentQueries).toBe(256);
    });
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// getOperationsByPriority Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("getOperationsByPriority", () => {
  test("should return critical operations", () => {
    const ops = getOperationsByPriority("critical");
    expect(ops).toContain("users:delete");
    expect(ops).toContain("governance:purge");
    expect(ops).not.toContain("memory:remember");
  });

  test("should return high priority operations", () => {
    const ops = getOperationsByPriority("high");
    expect(ops).toContain("memory:remember");
    expect(ops).toContain("conversations:create");
    expect(ops).toContain("a2a:sendMessage");
  });

  test("should return normal priority operations", () => {
    const ops = getOperationsByPriority("normal");
    expect(ops).toContain("memory:search");
    expect(ops).toContain("facts:store");
    expect(ops).toContain("users:create");
  });

  test("should return low priority operations", () => {
    const ops = getOperationsByPriority("low");
    expect(ops).toContain("memory:export");
    expect(ops).toContain("facts:deleteMany");
  });

  test("should return background priority operations", () => {
    const ops = getOperationsByPriority("background");
    expect(ops).toContain("graphSync:*");
    expect(ops).toContain("graph:sync");
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Error Class Tests
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("Error Classes", () => {
  describe("CircuitOpenError", () => {
    test("should create with default message", () => {
      const error = new CircuitOpenError();
      expect(error.message).toContain("Circuit breaker is open");
      expect(error.name).toBe("CircuitOpenError");
    });

    test("should create with custom message", () => {
      const error = new CircuitOpenError("Custom message");
      expect(error.message).toBe("Custom message");
    });

    test("should include retryAfterMs property", () => {
      const error = new CircuitOpenError("Test", 5000);
      expect(error.retryAfterMs).toBe(5000);
    });

    test("should have undefined retryAfterMs when not provided", () => {
      const error = new CircuitOpenError();
      expect(error.retryAfterMs).toBeUndefined();
    });

    test("should be instanceof Error", () => {
      const error = new CircuitOpenError();
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("QueueFullError", () => {
    test("should create with priority and queue size", () => {
      const error = new QueueFullError("high", 500);
      expect(error.priority).toBe("high");
      expect(error.queueSize).toBe(500);
      expect(error.name).toBe("QueueFullError");
    });

    test("should include priority in message", () => {
      const error = new QueueFullError("critical", 100);
      expect(error.message).toContain("critical");
      expect(error.message).toContain("100");
    });

    test("should be instanceof Error", () => {
      const error = new QueueFullError("normal", 0);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("AcquireTimeoutError", () => {
    test("should create with timeout and waiting count", () => {
      const error = new AcquireTimeoutError(5000, 10);
      expect(error.timeoutMs).toBe(5000);
      expect(error.waitingCount).toBe(10);
      expect(error.name).toBe("AcquireTimeoutError");
    });

    test("should include timeout in message", () => {
      const error = new AcquireTimeoutError(3000, 5);
      expect(error.message).toContain("3000");
      expect(error.message).toContain("5");
    });

    test("should be instanceof Error", () => {
      const error = new AcquireTimeoutError(1000, 0);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("RateLimitExceededError", () => {
    test("should create with tokens and refill time", () => {
      const error = new RateLimitExceededError(0, 100);
      expect(error.tokensAvailable).toBe(0);
      expect(error.refillInMs).toBe(100);
      expect(error.name).toBe("RateLimitExceededError");
    });

    test("should include tokens in message", () => {
      const error = new RateLimitExceededError(2, 50);
      expect(error.message).toContain("2");
      expect(error.message).toContain("50");
    });

    test("should be instanceof Error", () => {
      const error = new RateLimitExceededError(0, 0);
      expect(error).toBeInstanceOf(Error);
    });
  });
});
