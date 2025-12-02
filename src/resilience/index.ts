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
 * Pre-configured resilience settings for common use cases
 */
export const ResiliencePresets = {
  /**
   * Default balanced configuration
   * Good for most use cases
   */
  default: {
    enabled: true,
    rateLimiter: {
      bucketSize: 100,
      refillRate: 50,
    },
    concurrency: {
      maxConcurrent: 20,
      queueSize: 1000,
      timeout: 30000,
    },
    circuitBreaker: {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
      halfOpenMax: 3,
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
   * Real-time agent configuration
   * Optimized for low latency conversation storage
   */
  realTimeAgent: {
    enabled: true,
    rateLimiter: {
      bucketSize: 50,
      refillRate: 30,
    },
    concurrency: {
      maxConcurrent: 10,
      queueSize: 100,
      timeout: 5000,
    },
    circuitBreaker: {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 10000,
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
   * Batch processing configuration
   * High throughput for bulk operations
   */
  batchProcessing: {
    enabled: true,
    rateLimiter: {
      bucketSize: 500,
      refillRate: 100,
    },
    concurrency: {
      maxConcurrent: 50,
      queueSize: 10000,
      timeout: 60000,
    },
    circuitBreaker: {
      failureThreshold: 10,
      successThreshold: 3,
      timeout: 60000,
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
   * Hive Mode configuration
   * Extreme concurrency for multi-agent swarms
   */
  hiveMode: {
    enabled: true,
    rateLimiter: {
      bucketSize: 1000,
      refillRate: 200,
    },
    concurrency: {
      maxConcurrent: 100,
      queueSize: 50000,
      timeout: 120000,
    },
    circuitBreaker: {
      failureThreshold: 20,
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
   * Bypasses all resilience mechanisms
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

      // Trigger queue processing
      this.processQueueBatch();
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
      request.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
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
        this.processQueueBatch();
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
    while (
      !this.queue.isEmpty() &&
      Date.now() - startTime < timeoutMs
    ) {
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
