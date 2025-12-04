/**
 * Cortex SDK Resilience Layer
 *
 * Main entry point for the overload protection system.
 * Provides a unified interface that combines:
 * - Token Bucket Rate Limiter (Layer 1)
 * - Semaphore Concurrency Limiter (Layer 2)
 * - Priority Queue (Layer 3)
 * - Circuit Breaker (Layer 4)
 *
 * Usage:
 * ```typescript
 * const resilience = new ResilienceLayer(ResiliencePresets.default);
 *
 * // Execute an operation through all layers
 * const result = await resilience.execute(
 *   () => convexClient.mutation(...),
 *   'memory:remember'
 * );
 * ```
 */

import { CircuitBreaker } from "./CircuitBreaker";
import { PriorityQueue } from "./PriorityQueue";
import { getPriority, isCritical } from "./priorities";
import { Semaphore } from "./Semaphore";
import { TokenBucket } from "./TokenBucket";
import {
  CircuitOpenError,
  QueueFullError,
  type Priority,
  type QueuedRequest,
  type ResilienceConfig,
  type ResilienceMetrics,
} from "./types";

// Re-export all types and classes
export * from "./types";
export { TokenBucket } from "./TokenBucket";
export { Semaphore } from "./Semaphore";
export { PriorityQueue } from "./PriorityQueue";
export { CircuitBreaker } from "./CircuitBreaker";
export { getPriority, isCritical, OPERATION_PRIORITIES } from "./priorities";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Presets
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Pre-configured resilience settings for common use cases.
 *
 * Based on Convex platform limits:
 * @see https://docs.convex.dev/production/state/limits
 *
 * Free/Starter Plan:
 *   - Concurrent queries: 16
 *   - Concurrent mutations: 16
 *   - Concurrent actions: 64
 *   - Function calls: 1M/month
 *
 * Professional Plan:
 *   - Concurrent queries: 256
 *   - Concurrent mutations: 256
 *   - Concurrent actions: 256-1000
 *   - Function calls: 25M/month
 */
export const ResiliencePresets = {
  /**
   * Default configuration for Convex Free/Starter plan
   *
   * Respects Convex's 16 concurrent query/mutation limit.
   * Good for most single-agent use cases.
   */
  default: {
    enabled: true,
    rateLimiter: {
      bucketSize: 100, // Allow burst of 100 calls
      refillRate: 50, // Sustain ~50 ops/sec (well under 1M/month)
    },
    concurrency: {
      maxConcurrent: 16, // Convex free plan limit for queries/mutations
      queueSize: 1000, // Queue excess requests
      timeout: 30000, // 30s timeout (queries/mutations must complete in 1s anyway)
    },
    circuitBreaker: {
      failureThreshold: 5, // Open after 5 consecutive failures
      successThreshold: 2, // Close after 2 successes in half-open
      timeout: 30000, // 30s before attempting recovery
      halfOpenMax: 3, // Allow 3 test requests in half-open
    },
    queue: {
      maxSize: {
        critical: 100,
        high: 500,
        normal: 1000,
        low: 2000,
        background: 5000,
      },
    },
  } as ResilienceConfig,

  /**
   * Real-time agent configuration for Convex Free/Starter plan
   *
   * Optimized for low latency conversation storage.
   * Uses conservative limits to ensure fast response times.
   */
  realTimeAgent: {
    enabled: true,
    rateLimiter: {
      bucketSize: 30, // Small burst for responsive UX
      refillRate: 20, // Modest sustained rate
    },
    concurrency: {
      maxConcurrent: 8, // Half of free plan limit for headroom
      queueSize: 100, // Small queue - prefer fast failure
      timeout: 5000, // 5s timeout - fail fast for real-time
    },
    circuitBreaker: {
      failureThreshold: 3, // Trip quickly on issues
      successThreshold: 2,
      timeout: 10000, // Quick recovery attempt
      halfOpenMax: 2,
    },
    queue: {
      maxSize: {
        critical: 50,
        high: 100,
        normal: 200,
        low: 100,
        background: 50,
      },
    },
  } as ResilienceConfig,

  /**
   * Batch processing configuration for Convex Professional plan
   *
   * High throughput for bulk operations.
   * ⚠️ Requires Professional plan (256 concurrent limit)
   */
  batchProcessing: {
    enabled: true,
    rateLimiter: {
      bucketSize: 500, // Large burst for batch imports
      refillRate: 100, // High sustained throughput
    },
    concurrency: {
      maxConcurrent: 64, // Professional plan allows 256, use 64 for safety
      queueSize: 10000, // Large queue for batch jobs
      timeout: 60000, // 1 minute timeout for batch operations
    },
    circuitBreaker: {
      failureThreshold: 10, // More tolerant of transient failures
      successThreshold: 3,
      timeout: 60000, // Longer recovery for batch context
      halfOpenMax: 5,
    },
    queue: {
      maxSize: {
        critical: 200,
        high: 1000,
        normal: 5000,
        low: 10000,
        background: 20000,
      },
    },
  } as ResilienceConfig,

  /**
   * Hive Mode configuration for Convex Professional plan
   *
   * Extreme concurrency for multi-agent swarms sharing one database.
   * ⚠️ Requires Professional plan with increased limits.
   * Contact Convex support for limits beyond default Professional tier.
   */
  hiveMode: {
    enabled: true,
    rateLimiter: {
      bucketSize: 1000, // Large burst for swarm coordination
      refillRate: 200, // High sustained for many agents
    },
    concurrency: {
      maxConcurrent: 128, // High concurrency for swarms
      queueSize: 50000, // Very large queue for burst absorption
      timeout: 120000, // 2 minute timeout for complex coordination
    },
    circuitBreaker: {
      failureThreshold: 20, // Very tolerant - swarms have natural backoff
      successThreshold: 5,
      timeout: 30000,
      halfOpenMax: 10,
    },
    queue: {
      maxSize: {
        critical: 500,
        high: 5000,
        normal: 20000,
        low: 30000,
        background: 50000,
      },
    },
  } as ResilienceConfig,

  /**
   * Disabled configuration
   *
   * Bypasses all resilience mechanisms.
   * ⚠️ Not recommended for production - may hit Convex rate limits.
   */
  disabled: {
    enabled: false,
  } as ResilienceConfig,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Resilience Layer
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Main resilience layer that orchestrates all protection mechanisms
 */
export class ResilienceLayer {
  private readonly enabled: boolean;
  private readonly tokenBucket: TokenBucket;
  private readonly semaphore: Semaphore;
  private readonly queue: PriorityQueue;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly config: ResilienceConfig;

  // Queue processing state
  private isProcessingQueue: boolean = false;
  private queueProcessorInterval?: ReturnType<typeof setInterval>;

  // Request counter for unique IDs
  private requestCounter: number = 0;

  constructor(config: ResilienceConfig = ResiliencePresets.default) {
    this.config = config;
    this.enabled = config.enabled !== false;

    // Initialize all layers
    this.tokenBucket = new TokenBucket(config.rateLimiter);
    this.semaphore = new Semaphore(config.concurrency);
    this.queue = new PriorityQueue(config.queue);
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker, {
      onOpen: config.onCircuitOpen,
      onClose: config.onCircuitClose,
      onHalfOpen: config.onCircuitHalfOpen,
    });

    // Start queue processor if enabled
    if (this.enabled) {
      this.startQueueProcessor();
    }
  }

  /**
   * Execute an operation through all resilience layers
   *
   * @param operation The async operation to execute
   * @param operationName Operation identifier for priority mapping
   * @returns The result of the operation
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    // Bypass if disabled
    if (!this.enabled) {
      return operation();
    }

    const priority = getPriority(operationName);

    // Layer 4: Check circuit breaker
    if (this.circuitBreaker.isOpen()) {
      // Critical operations always get queued, never rejected
      if (isCritical(operationName)) {
        return this.enqueueAndWait(operation, priority, operationName);
      }

      // For non-critical, check if circuit is open
      const metrics = this.circuitBreaker.getMetrics();
      const retryAfter = this.circuitBreaker.getTimeUntilClose();

      throw new CircuitOpenError(
        `Circuit breaker is open (${metrics.failures} failures). Retry after ${retryAfter}ms`,
        retryAfter,
      );
    }

    // Layer 1: Rate limiting - wait for token
    await this.tokenBucket.acquire(this.config.concurrency?.timeout);

    // Layer 2: Concurrency limiting - acquire permit
    const permit = await this.semaphore.acquire();

    try {
      // Execute the operation
      const result = await operation();

      // Record success
      this.circuitBreaker.recordSuccess();

      return result;
    } catch (error) {
      // Record failure
      this.circuitBreaker.recordFailure(
        error instanceof Error ? error : new Error(String(error)),
      );

      throw error;
    } finally {
      // Release permit
      permit.release();

      // Trigger queue processing (fire and forget)
      void this.processQueueBatch();
    }
  }

  /**
   * Execute with automatic retry on transient failures
   *
   * @param operation The operation to execute
   * @param operationName Operation identifier
   * @param maxRetries Maximum retry attempts
   * @param retryDelayMs Delay between retries (ms)
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
    retryDelayMs: number = 1000,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(operation, operationName);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on circuit open (it will stay open)
        if (error instanceof CircuitOpenError) {
          throw error;
        }

        // Don't retry on queue full
        if (error instanceof QueueFullError) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = retryDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error("Max retries exceeded");
  }

  /**
   * Enqueue an operation and wait for execution
   */
  private enqueueAndWait<T>(
    operation: () => Promise<T>,
    priority: Priority,
    operationName: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: `req_${Date.now()}_${++this.requestCounter}`,
        operation,
        priority,
        operationName,
        queuedAt: Date.now(),
        attempts: 0,
        resolve: resolve as (value: unknown) => void,
        reject,
      };

      try {
        this.queue.enqueue(request as QueuedRequest);
      } catch (error) {
        if (error instanceof QueueFullError) {
          this.config.onQueueFull?.(priority);
        }
        reject(error);
      }
    });
  }

  /**
   * Process queued requests
   */
  private async processQueueBatch(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Process while there's capacity
      while (!this.queue.isEmpty() && this.circuitBreaker.allowsExecution()) {
        // Check if we can acquire resources
        if (!this.tokenBucket.tryAcquire()) {
          break;
        }

        const permit = this.semaphore.tryAcquire();
        if (!permit) {
          // Return token we just acquired
          // (tokenBucket doesn't have a release, but tokens auto-refill)
          break;
        }

        // Get next request from queue
        const request = this.queue.dequeue();
        if (!request) {
          permit.release();
          break;
        }

        // Execute in background
        this.executeQueuedRequest(request, permit).catch(() => {
          // Errors handled in executeQueuedRequest
        });
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Execute a queued request
   */
  private async executeQueuedRequest(
    request: QueuedRequest,
    permit: { release: () => void },
  ): Promise<void> {
    try {
      const result = await request.operation();
      this.circuitBreaker.recordSuccess();
      request.resolve(result);
    } catch (error) {
      this.circuitBreaker.recordFailure(
        error instanceof Error ? error : new Error(String(error)),
      );
      request.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      permit.release();
    }
  }

  /**
   * Start background queue processor
   */
  private startQueueProcessor(): void {
    // Process queue every 100ms if there are items
    this.queueProcessorInterval = setInterval(() => {
      if (!this.queue.isEmpty()) {
        void this.processQueueBatch();
      }
    }, 100);
  }

  /**
   * Stop background queue processor
   */
  stopQueueProcessor(): void {
    if (this.queueProcessorInterval) {
      clearInterval(this.queueProcessorInterval);
      this.queueProcessorInterval = undefined;
    }
  }

  /**
   * Get current metrics from all layers
   */
  getMetrics(): ResilienceMetrics {
    return {
      rateLimiter: this.tokenBucket.getMetrics(),
      concurrency: this.semaphore.getMetrics(),
      circuitBreaker: this.circuitBreaker.getMetrics(),
      queue: this.queue.getMetrics(),
      timestamp: Date.now(),
    };
  }

  /**
   * Check if the system is healthy
   */
  isHealthy(): boolean {
    if (!this.enabled) {
      return true;
    }

    const state = this.circuitBreaker.getState();
    return state === "closed";
  }

  /**
   * Check if the system is accepting requests
   */
  isAcceptingRequests(): boolean {
    if (!this.enabled) {
      return true;
    }

    return this.circuitBreaker.allowsExecution();
  }

  /**
   * Reset all layers to initial state
   */
  reset(): void {
    this.tokenBucket.reset();
    this.semaphore.reset();
    this.queue.clear();
    this.circuitBreaker.reset();
  }

  /**
   * Graceful shutdown - wait for pending operations
   *
   * @param timeoutMs Maximum time to wait for pending operations
   */
  async shutdown(timeoutMs: number = 30000): Promise<void> {
    // Stop accepting new requests
    this.stopQueueProcessor();

    // Wait for queue to drain
    const startTime = Date.now();
    while (!this.queue.isEmpty() && Date.now() - startTime < timeoutMs) {
      await this.sleep(100);
    }

    // Clear any remaining
    if (!this.queue.isEmpty()) {
      console.warn(
        `Shutdown timeout: ${this.queue.size()} requests still in queue`,
      );
      this.queue.clear();
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
