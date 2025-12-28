# Resilience Layer

> **Last Updated**: 2025-12-01
> **Version**: v0.16.0+

Built-in protection against server overload with automatic rate limiting, concurrency control, and circuit breakers.

## Overview

The Cortex Resilience Layer provides enterprise-grade protection against traffic spikes and backend overload. It sits between your application and Convex, ensuring your SDK never overwhelms the database—even under extreme burst conditions.

### Key Features

- ✅ **Token Bucket Rate Limiter** - Smooths bursty traffic into sustainable flow
- ✅ **Concurrency Limiter** - Respects [Convex platform limits](https://docs.convex.dev/production/state/limits)
- ✅ **Priority Queue** - Critical operations execute first when under pressure
- ✅ **Circuit Breaker** - Fast-fails when backend is unhealthy, auto-recovers
- ✅ **Zero Configuration** - Works out-of-the-box with sensible defaults
- ✅ **Full Observability** - Real-time metrics for monitoring

## Why Resilience Matters

Without protection, a traffic spike can cascade into database overload:

```
❌ Without Resilience Layer:

100 agents burst → 100 concurrent queries → Convex rejects (limit: 16)
                                          → Errors cascade
                                          → Retries make it worse
                                          → System goes down
```

```
✅ With Resilience Layer:

100 agents burst → Rate limiter smooths → 16 execute (Convex limit)
                                        → 84 queue with priority
                                        → All complete successfully
                                        → System stays healthy
```

## Convex Platform Limits

The resilience layer is tuned to respect [Convex's documented limits](https://docs.convex.dev/production/state/limits):

| Resource                 | Free/Starter | Professional |
| ------------------------ | ------------ | ------------ |
| Concurrent Queries       | **16**       | 256          |
| Concurrent Mutations     | **16**       | 256          |
| Concurrent Actions       | **64**       | 256-1000     |
| Query/Mutation Execution | 1 second     | 1 second     |
| Function Calls/Month     | 1,000,000    | 25,000,000   |

**Default preset uses Free plan limits (16 concurrent)** to work safely on any Convex deployment.

## Quick Start

### Zero Configuration (Recommended)

Resilience is enabled by default with sensible settings:

```typescript
import { Cortex } from "@cortexmemory/sdk";

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  // Resilience enabled by default with 'default' preset
});

// All operations automatically protected
await cortex.memory.remember({
  memorySpaceId: "my-agent",
  conversationId: "conv-123",
  userMessage: "Hello!",
  agentResponse: "Hi there!",
  userId: "user-1",
  userName: "User",
});
```

### Environment Variable Configuration

Set the `CONVEX_PLAN` environment variable to automatically configure concurrency limits based on your Convex subscription:

```bash
# .env or .env.local
CONVEX_PLAN=free          # 16 concurrent queries/mutations (default)
CONVEX_PLAN=starter       # 16 concurrent queries/mutations
CONVEX_PLAN=professional  # 256 concurrent queries/mutations
```

The SDK reads this variable and applies the appropriate preset automatically:

```typescript
import {
  Cortex,
  getPresetForPlan,
  getDetectedPlanTier,
} from "@cortexmemory/sdk";

// Auto-detect from CONVEX_PLAN env var
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  resilience: getPresetForPlan(), // Reads CONVEX_PLAN automatically
});

// Check detected plan tier
console.log(`Using ${getDetectedPlanTier()} plan limits`);
```

You can also get the specific limits for programmatic use:

```typescript
import { getPlanLimits } from "@cortexmemory/sdk";

const limits = getPlanLimits(); // Uses CONVEX_PLAN env var
console.log(limits);
// {
//   concurrentQueries: 16,    // or 256 for professional
//   concurrentMutations: 16,  // or 256 for professional
//   concurrentActions: 64,    // or 256 for professional
//   maxNodeActions: 64        // or 1000 for professional
// }
```

### Using Presets

Choose a preset that matches your use case:

```typescript
import { Cortex, ResiliencePresets } from "@cortexmemory/sdk";

// For real-time chat agents (conservative, fast-fail)
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  resilience: ResiliencePresets.realTimeAgent,
});

// For batch processing (Professional plan required)
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  resilience: ResiliencePresets.batchProcessing,
});

// For multi-agent swarms (Professional plan required)
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  resilience: ResiliencePresets.hiveMode,
});

// Disable resilience (not recommended)
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  resilience: ResiliencePresets.disabled,
});
```

### Custom Configuration

Fine-tune each protection layer:

```typescript
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  resilience: {
    enabled: true,

    // Token bucket rate limiter
    rateLimiter: {
      bucketSize: 100, // Max burst capacity
      refillRate: 50, // Tokens per second
    },

    // Concurrency control
    concurrency: {
      maxConcurrent: 16, // Convex free plan limit
      queueSize: 1000, // Pending request queue
      timeout: 30000, // 30s acquire timeout
    },

    // Circuit breaker
    circuitBreaker: {
      failureThreshold: 5, // Open after 5 failures
      successThreshold: 2, // Close after 2 successes
      timeout: 30000, // 30s before recovery attempt
      halfOpenMax: 3, // Test requests in half-open
    },

    // Priority queue sizes
    queue: {
      maxSize: {
        critical: 100,
        high: 500,
        normal: 1000,
        low: 2000,
        background: 5000,
      },
    },

    // Event callbacks
    onCircuitOpen: () => console.warn("Circuit opened!"),
    onCircuitClose: () => console.log("Circuit recovered"),
  },
});
```

## Available Presets

### `default` - Convex Free/Starter Plan

Safe defaults that respect Convex's 16 concurrent query/mutation limit.

| Setting           | Value      | Rationale                |
| ----------------- | ---------- | ------------------------ |
| Max Concurrent    | 16         | Convex free plan limit   |
| Bucket Size       | 100        | Allow reasonable burst   |
| Refill Rate       | 50/sec     | ~1.3M ops/month capacity |
| Circuit Threshold | 5 failures | Balance sensitivity      |

```typescript
resilience: ResiliencePresets.default;
```

### `realTimeAgent` - Low Latency Chat

Conservative settings for responsive real-time interactions.

| Setting           | Value | Rationale                  |
| ----------------- | ----- | -------------------------- |
| Max Concurrent    | 8     | Half of limit for headroom |
| Bucket Size       | 30    | Small burst, fast response |
| Timeout           | 5s    | Fail fast for UX           |
| Circuit Threshold | 3     | Trip quickly on issues     |

```typescript
resilience: ResiliencePresets.realTimeAgent;
```

### `batchProcessing` - Bulk Operations

High throughput for data migrations and bulk imports.

⚠️ **Requires Convex Professional plan** (256 concurrent limit)

| Setting        | Value  | Rationale                  |
| -------------- | ------ | -------------------------- |
| Max Concurrent | 64     | Professional plan capacity |
| Bucket Size    | 500    | Large burst for batches    |
| Timeout        | 60s    | Long operations allowed    |
| Queue Size     | 10,000 | Handle large batches       |

```typescript
resilience: ResiliencePresets.batchProcessing;
```

### `hiveMode` - Multi-Agent Swarms

Extreme concurrency for coordinated agent swarms.

⚠️ **Requires Convex Professional plan with increased limits**

| Setting        | Value  | Rationale              |
| -------------- | ------ | ---------------------- |
| Max Concurrent | 128    | High swarm capacity    |
| Bucket Size    | 1000   | Massive burst handling |
| Timeout        | 120s   | Complex coordination   |
| Queue Size     | 50,000 | Absorb swarm bursts    |

```typescript
resilience: ResiliencePresets.hiveMode;
```

## Architecture

The resilience layer consists of four protection mechanisms executed in order:

```
Request → [Rate Limiter] → [Concurrency Limiter] → [Circuit Breaker] → Convex
              ↓                    ↓                      ↓
         Smooth burst        Queue excess           Fast-fail if
         into tokens         requests               unhealthy
```

### Layer 1: Token Bucket Rate Limiter

Controls the **rate** of requests entering the system.

```typescript
// Bucket starts full (100 tokens)
// Each request consumes 1 token
// Tokens refill at 50/sec

// Burst of 100 requests:
// - First 100: immediate (bucket drains)
// - Next requests: wait for refill (~20ms each)
```

**When it activates:** Traffic exceeds sustained rate

**Behavior:** Requests wait for tokens (doesn't reject)

### Layer 2: Concurrency Limiter (Semaphore)

Controls **how many** requests execute simultaneously.

```typescript
// Max 16 concurrent (Convex free plan limit)
// Excess requests queue with priority

// 50 simultaneous requests:
// - 16 execute immediately
// - 34 queue by priority
// - As permits release, queued requests execute
```

**When it activates:** Concurrent requests exceed limit

**Behavior:** Excess requests queue (with timeout)

### Layer 3: Priority Queue

Orders queued requests by importance.

| Priority     | Operations                         | Queue Size |
| ------------ | ---------------------------------- | ---------- |
| `critical`   | Circuit breaker recovery tests     | 100        |
| `high`       | User-facing reads (search, recall) | 500        |
| `normal`     | Standard writes (remember)         | 1000       |
| `low`        | Analytics, background sync         | 2000       |
| `background` | Cleanup, maintenance               | 5000       |

```typescript
// Under load, critical operations execute first
// Background tasks wait until system is healthy
```

**Automatic priority assignment:** Operations are classified automatically based on type.

### Layer 4: Circuit Breaker

Prevents cascading failures when backend is unhealthy.

```
CLOSED (normal) → 5 failures → OPEN (fast-fail)
                                    ↓
                              30s timeout
                                    ↓
                              HALF-OPEN (test)
                                    ↓
                    2 successes → CLOSED
                    failure → OPEN
```

**States:**

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Backend unhealthy, reject non-critical requests immediately
- **HALF-OPEN**: Testing recovery, allow limited requests

## Monitoring

### Get Real-Time Metrics

```typescript
const metrics = cortex.getResilienceMetrics();

console.log(metrics);
// {
//   rateLimiter: {
//     availableTokens: 87,
//     bucketSize: 100,
//     refillRate: 50
//   },
//   concurrency: {
//     active: 12,
//     waiting: 5,
//     maxConcurrent: 16,
//     queueSize: 1000
//   },
//   circuitBreaker: {
//     state: 'closed',
//     failures: 0,
//     successes: 42,
//     lastFailure: null
//   },
//   queue: {
//     critical: 0,
//     high: 2,
//     normal: 3,
//     low: 0,
//     background: 0,
//     total: 5
//   }
// }
```

### Monitor in Production

```typescript
// Periodic health check
setInterval(() => {
  const metrics = cortex.getResilienceMetrics();

  // Alert if circuit opens
  if (metrics.circuitBreaker.state === "open") {
    alertOps("Circuit breaker OPEN - backend unhealthy");
  }

  // Alert if queue backing up
  if (metrics.queue.total > 500) {
    alertOps(`Queue depth: ${metrics.queue.total}`);
  }

  // Alert if approaching concurrency limit
  if (metrics.concurrency.active >= 14) {
    alertOps(`High concurrency: ${metrics.concurrency.active}/16`);
  }
}, 5000);
```

### Graceful Shutdown

```typescript
// Wait for in-flight requests to complete
await cortex.shutdown();

// Or force immediate shutdown
cortex.forceShutdown();
```

## Error Handling

The resilience layer throws specific errors you can catch:

```typescript
import {
  CircuitOpenError,
  QueueFullError,
  AcquireTimeoutError,
  RateLimitExceededError,
} from "@cortexmemory/sdk";

try {
  await cortex.memory.remember({...});
} catch (error) {
  if (error instanceof CircuitOpenError) {
    // Backend is unhealthy, circuit breaker tripped
    console.error('Service unavailable, try again later');
    // Show user-friendly error, don't retry immediately
  } else if (error instanceof QueueFullError) {
    // Too many pending requests
    console.error('System overloaded, request rejected');
    // Implement backpressure in your app
  } else if (error instanceof AcquireTimeoutError) {
    // Waited too long for a permit
    console.error('Request timed out waiting for capacity');
    // Consider increasing timeout or reducing load
  } else if (error instanceof RateLimitExceededError) {
    // Rate limit exceeded (rare with token bucket)
    console.error('Rate limit exceeded');
  } else {
    // Other errors (network, validation, etc.)
    throw error;
  }
}
```

## Python SDK

The resilience layer is also available in the Python SDK:

```python
from cortex import Cortex, CortexConfig
from cortex.resilience import (
    ResilienceConfig,
    ResiliencePresets,
    RateLimiterConfig,
    ConcurrencyConfig,
    CircuitBreakerConfig,
)

# Using preset
cortex = Cortex(CortexConfig(
    convex_url=os.environ["CONVEX_URL"],
    resilience=ResiliencePresets.default(),
))

# Custom configuration
cortex = Cortex(CortexConfig(
    convex_url=os.environ["CONVEX_URL"],
    resilience=ResilienceConfig(
        enabled=True,
        rate_limiter=RateLimiterConfig(bucket_size=100, refill_rate=50),
        concurrency=ConcurrencyConfig(max_concurrent=16, queue_size=1000, timeout=30),
        circuit_breaker=CircuitBreakerConfig(
            failure_threshold=5,
            success_threshold=2,
            timeout=30,
            half_open_max=3,
        ),
    ),
))

# Get metrics
metrics = cortex.get_resilience_metrics()
print(f"Active: {metrics.concurrency.active}/{metrics.concurrency.max_concurrent}")
```

## Best Practices

### 1. Start with Defaults

The default preset is tuned for Convex free plan limits. Only customize if you have specific requirements.

```typescript
// ✅ Good: Let defaults handle it
const cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });

// ❌ Avoid: Over-customizing without measurement
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  resilience: {
    concurrency: { maxConcurrent: 100 }, // Will hit Convex limits!
  },
});
```

### 2. Match Preset to Convex Plan

```typescript
// Free/Starter plan: Use default or realTimeAgent
resilience: ResiliencePresets.default;

// Professional plan: Can use batchProcessing or hiveMode
resilience: ResiliencePresets.batchProcessing;
```

### 3. Monitor Circuit Breaker State

```typescript
// React to circuit state changes
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  resilience: {
    ...ResiliencePresets.default,
    onCircuitOpen: () => {
      // Log, alert, update health endpoint
      console.error("Circuit OPEN - Convex may be having issues");
      metrics.increment("circuit_breaker.open");
    },
    onCircuitClose: () => {
      console.log("Circuit CLOSED - Service recovered");
      metrics.increment("circuit_breaker.close");
    },
  },
});
```

### 4. Implement Backpressure

When queue is full, propagate backpressure to callers:

```typescript
async function handleRequest(req) {
  const metrics = cortex.getResilienceMetrics();

  // Reject early if system is overloaded
  if (metrics.queue.total > 800) {
    return { status: 503, message: 'Service temporarily unavailable' };
  }

  try {
    await cortex.memory.remember({...});
    return { status: 200 };
  } catch (error) {
    if (error instanceof QueueFullError) {
      return { status: 503, message: 'Service overloaded' };
    }
    throw error;
  }
}
```

### 5. Use Graceful Shutdown

```typescript
// In your server shutdown handler
process.on("SIGTERM", async () => {
  console.log("Shutting down gracefully...");

  // Stop accepting new requests
  server.close();

  // Wait for in-flight Cortex operations
  await cortex.shutdown();

  process.exit(0);
});
```

## FAQ

**Q: Does the resilience layer add latency?**

A: Minimal overhead (~1-2ms) under normal load. Under heavy load, requests queue rather than fail—this is intentional protection.

**Q: Can I disable resilience for specific operations?**

A: Currently, resilience applies to all operations. If you need direct access, use the Convex client directly (not recommended).

**Q: What happens when circuit breaker opens?**

A: Non-critical requests fail immediately with `CircuitOpenError`. Critical operations (circuit recovery tests) still attempt. After the timeout, the circuit enters half-open state and tests recovery.

**Q: How do I know if I'm hitting Convex limits?**

A: Monitor the concurrency metrics. If `active` frequently hits `maxConcurrent` and `waiting` grows, you're at capacity. Consider:

- Upgrading to Convex Professional plan
- Optimizing your query patterns
- Adding caching

**Q: Does this work with Convex's built-in rate limiting?**

A: Yes! The resilience layer adds client-side protection that complements Convex's server-side limits. It prevents your requests from even reaching Convex when you'd be rejected.

**Q: How do priorities work?**

A: Operations are automatically assigned priorities:

- `critical`: Internal circuit breaker recovery
- `high`: User-facing reads (search, recall, getConversation)
- `normal`: Writes (remember, update)
- `low`: Analytics, non-urgent operations
- `background`: Cleanup, maintenance tasks

**Q: Can I set priority manually?**

A: Not currently. Priorities are assigned automatically based on operation type. This ensures consistent behavior.

## See Also

- [Performance Guide](../04-architecture/08-performance.md) - Optimization strategies
- [Hive Mode](./10-hive-mode.md) - Multi-agent coordination
- [Convex Limits](https://docs.convex.dev/production/state/limits) - Official Convex documentation
- [Error Handling](../05-reference/02-error-handling.md) - Complete error reference
