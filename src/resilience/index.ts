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
import { getPriority } from "./priorities";
import { Semaphore } from "./Semaphore";
import { TokenBucket } from "./TokenBucket";
import {
  CircuitOpenError,
  QueueFullError,
  DEFAULT_RETRY_CONFIG,
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
export {
  getPriority,
  isCritical,
  OPERATION_PRIORITIES,
  getOperationsByPriority,
} from "./priorities";

/**
 * Check if an error is NOT a system failure and should not trip the circuit breaker.
 *
 * The circuit breaker should only trip on actual infrastructure/system failures,
 * not on expected application-level errors. This function identifies errors that
 * indicate the system is working correctly but the operation couldn't complete
 * for business/validation reasons.
 *
 * Categories of non-system failures:
 * 1. Idempotent "not found" errors - Entity already deleted/doesn't exist
 * 2. Validation errors - Invalid input from client
 * 3. Duplicate/conflict errors - Idempotent create operations
 * 4. Empty result errors - Query returned no results (expected)
 * 5. Permission errors - Auth/authorization issues (not infrastructure)
 * 6. Configuration errors - Feature not configured (not infrastructure)
 * 7. Business logic errors - Constraints like HAS_CHILDREN
 *
 * @param error The error to check
 * @returns True if this is NOT a system failure (should not trip circuit breaker)
 */
export function isNonSystemFailure(error: unknown): boolean {
  const errorStr = String(error);
  const errorLower = errorStr.toLowerCase();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Category 1: Idempotent "not found" errors
  // Deleting something already deleted = success, not failure
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const notFoundPatterns = [
    "IMMUTABLE_ENTRY_NOT_FOUND",
    "USER_NOT_FOUND",
    "CONVERSATION_NOT_FOUND",
    "MEMORY_NOT_FOUND",
    "FACT_NOT_FOUND",
    "MUTABLE_KEY_NOT_FOUND",
    "KEY_NOT_FOUND",
    "CONTEXT_NOT_FOUND",
    "MEMORY_SPACE_NOT_FOUND",
    "MEMORYSPACE_NOT_FOUND",
    "AGENT_NOT_FOUND",
    "AGENT_NOT_REGISTERED",
    "VERSION_NOT_FOUND",
    "PARENT_NOT_FOUND",
    "NOT_FOUND",
    "not found",
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Category 2: Validation errors (client bugs, not system failures)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const validationPatterns = [
    "INVALID_", // Catches all INVALID_* errors
    "DATA_TOO_LARGE",
    "VALUE_TOO_LARGE",
    "invalid ",
    "validation error",
    "validation failed",
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Category 3: Idempotent "already exists" errors
  // Creating something that exists = idempotent success
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const duplicatePatterns = [
    "ALREADY_EXISTS",
    "ALREADY_REGISTERED",
    "MEMORYSPACE_ALREADY_EXISTS",
    "AGENT_ALREADY_REGISTERED",
    "DUPLICATE",
    "CONFLICT",
    "already exists",
    "already registered",
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Category 4: Empty result errors (expected, not failures)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const emptyResultPatterns = [
    "NO_MEMORIES_MATCHED",
    "NO_USERS_MATCHED",
    "no results",
    "no matches",
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Category 5: Permission/auth errors (not infrastructure failures)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const permissionPatterns = [
    "PERMISSION_DENIED",
    "UNAUTHORIZED",
    "FORBIDDEN",
    "ACCESS_DENIED",
    "permission denied",
    "unauthorized",
    "forbidden",
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Category 6: Configuration errors (feature not enabled, not infra)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const configPatterns = [
    "CLOUD_MODE_REQUIRED",
    "PUBSUB_NOT_CONFIGURED",
    "not configured",
    "not enabled",
  ];

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Category 7: Business logic constraints (not system failures)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const businessLogicPatterns = [
    "HAS_CHILDREN",
    "MEMORYSPACE_HAS_DATA",
    "PURGE_CANCELLED",
    "DELETION_CANCELLED",
    "has children",
    "has data",
    "cancelled",
  ];

  // Combine all patterns
  const allPatterns = [
    ...notFoundPatterns,
    ...validationPatterns,
    ...duplicatePatterns,
    ...emptyResultPatterns,
    ...permissionPatterns,
    ...configPatterns,
    ...businessLogicPatterns,
  ];

  // Check if any pattern matches
  return allPatterns.some(
    (pattern) =>
      errorStr.includes(pattern) || errorLower.includes(pattern.toLowerCase()),
  );
}

// Backwards compatibility alias
export const isIdempotentNotFoundError = isNonSystemFailure;

/**
 * Check if an error is retryable (transient error that may succeed on retry).
 *
 * Retryable errors include:
 * - Generic "Server Error" from Convex (transient backend issues)
 * - Rate limiting errors
 * - Timeout errors
 * - Network/connection errors
 *
 * Non-retryable errors (won't succeed on retry):
 * - Validation errors (client bugs)
 * - Not found errors (data doesn't exist)
 * - Permission errors (auth issues)
 * - Business logic errors (constraints)
 *
 * @param error The error to check
 * @returns True if the error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  // Non-system failures should NOT be retried - they indicate
  // the request is invalid and will fail every time
  if (isNonSystemFailure(error)) {
    return false;
  }

  const errorStr = String(error);
  const errorLower = errorStr.toLowerCase();

  // Patterns that indicate transient/retryable errors
  const retryablePatterns = [
    // Generic server errors (often transient)
    "Server Error",
    "server error",
    "Internal Server Error",
    "internal server error",
    // Rate limiting
    "rate limit",
    "too many requests",
    "429",
    "throttl",
    // Timeouts
    "timeout",
    "timed out",
    "request timed out",
    "deadline exceeded",
    // Network issues
    "connection",
    "network",
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    // Temporary unavailability
    "temporarily unavailable",
    "service unavailable",
    "503",
    "502",
    "504",
    // Convex-specific transient errors
    "overloaded",
    "try again",
    "retry",
  ];

  return retryablePatterns.some(
    (pattern) =>
      errorStr.includes(pattern) || errorLower.includes(pattern.toLowerCase()),
  );
}

/**
 * Calculate retry delay with exponential backoff and optional jitter
 *
 * @param attempt Current attempt number (0-indexed)
 * @param baseDelayMs Base delay in milliseconds
 * @param maxDelayMs Maximum delay cap
 * @param exponentialBase Base for exponential calculation
 * @param jitter Whether to add random jitter
 * @returns Delay in milliseconds
 */
function calculateRetryDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  exponentialBase: number,
  jitter: boolean,
): number {
  // Calculate exponential delay
  const delay = baseDelayMs * Math.pow(exponentialBase, attempt);

  // Cap at maximum
  const cappedDelay = Math.min(delay, maxDelayMs);

  // Add jitter if enabled (random factor between 0.5 and 1.5)
  if (jitter) {
    const jitterFactor = 0.5 + Math.random();
    return Math.floor(cappedDelay * jitterFactor);
  }

  return Math.floor(cappedDelay);
}

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
   * Includes automatic retry (3 attempts) for transient failures.
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
    retry: {
      maxRetries: 3, // Retry up to 3 times
      baseDelayMs: 500, // Start with 0.5s delay
      maxDelayMs: 10000, // Cap at 10s
      exponentialBase: 2.0, // Double delay each attempt
      jitter: true, // Prevent thundering herd
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
    retry: {
      maxRetries: 2, // Fewer retries for real-time UX
      baseDelayMs: 200, // Shorter delays for responsiveness
      maxDelayMs: 2000, // Cap at 2s for real-time
      exponentialBase: 2.0,
      jitter: true,
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
    retry: {
      maxRetries: 5, // More retries for batch resilience
      baseDelayMs: 1000, // Longer base delay for batch
      maxDelayMs: 30000, // Higher cap for batch operations
      exponentialBase: 2.0,
      jitter: true,
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
    retry: {
      maxRetries: 4, // Good retry coverage for swarm coordination
      baseDelayMs: 500,
      maxDelayMs: 15000,
      exponentialBase: 2.0,
      jitter: true, // Critical for swarms to avoid thundering herd
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
// Plan-Based Preset Selection
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Convex plan tier type
 */
export type ConvexPlanTier = "free" | "starter" | "professional";

/**
 * Get the appropriate resilience preset based on Convex plan tier.
 *
 * Reads from CONVEX_PLAN environment variable if not specified.
 * Defaults to 'free' plan limits for safety.
 *
 * @param plan Optional plan tier override. If not provided, reads from CONVEX_PLAN env var.
 * @returns The appropriate ResilienceConfig for the plan tier
 *
 * @example
 * ```typescript
 * // Auto-detect from CONVEX_PLAN env var
 * const config = getPresetForPlan();
 *
 * // Explicit plan tier
 * const proConfig = getPresetForPlan('professional');
 *
 * // Use with ResilienceLayer
 * const resilience = new ResilienceLayer(getPresetForPlan());
 * ```
 */
export function getPresetForPlan(plan?: ConvexPlanTier): ResilienceConfig {
  const effectivePlan =
    plan || (process.env.CONVEX_PLAN as ConvexPlanTier | undefined) || "free";

  switch (effectivePlan.toLowerCase()) {
    case "professional":
      // Professional plan: 256 concurrent queries/mutations
      // Use batchProcessing preset which allows higher throughput
      return ResiliencePresets.batchProcessing;

    case "free":
    case "starter":
    default:
      // Free/Starter plan: 16 concurrent queries/mutations
      return ResiliencePresets.default;
  }
}

/**
 * Get the detected Convex plan tier from environment.
 *
 * @returns The detected plan tier, defaulting to 'free'
 */
export function getDetectedPlanTier(): ConvexPlanTier {
  const envPlan = process.env.CONVEX_PLAN?.toLowerCase();
  if (envPlan === "professional") return "professional";
  if (envPlan === "starter") return "starter";
  return "free";
}

/**
 * Get concurrency limits for a given Convex plan tier.
 *
 * Based on https://docs.convex.dev/production/state/limits
 *
 * @param plan The Convex plan tier
 * @returns Object with concurrency limits
 */
export function getPlanLimits(plan?: ConvexPlanTier): {
  concurrentQueries: number;
  concurrentMutations: number;
  concurrentActions: number;
  maxNodeActions: number;
} {
  const effectivePlan = plan || getDetectedPlanTier();

  if (effectivePlan === "professional") {
    return {
      concurrentQueries: 256,
      concurrentMutations: 256,
      concurrentActions: 256,
      maxNodeActions: 1000,
    };
  }

  // Free/Starter plan limits
  return {
    concurrentQueries: 16,
    concurrentMutations: 16,
    concurrentActions: 64,
    maxNodeActions: 64,
  };
}

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
   * Execute an operation through all resilience layers with automatic retry
   * for transient failures (timeouts, rate limits, server errors).
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
      // Queue ALL operations when circuit is open - this is true resilience
      // Critical operations get higher priority, but all operations wait for circuit reset
      // Operations will be retried automatically when the circuit closes
      return this.enqueueAndWait(operation, priority, operationName);
    }

    // Get retry configuration (defaults if not specified)
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...this.config.retry };
    const maxAttempts = retryConfig.maxRetries + 1;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await this._executeSingleAttempt(operation);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on circuit open - it's a protective mechanism
        if (error instanceof CircuitOpenError) {
          throw error;
        }

        // Don't retry on queue full - system is overloaded
        if (error instanceof QueueFullError) {
          throw error;
        }

        // Check if this error is retryable
        if (!isRetryableError(error)) {
          // Non-retryable errors (validation, not found, etc.) - fail immediately
          throw lastError;
        }

        // Check if we have retries left
        if (attempt < maxAttempts - 1) {
          const delay = calculateRetryDelay(
            attempt,
            retryConfig.baseDelayMs,
            retryConfig.maxDelayMs,
            retryConfig.exponentialBase,
            retryConfig.jitter,
          );

          // Call retry hook if configured (allow monitoring)
          if (this.config.onRetry) {
            try {
              this.config.onRetry(attempt + 1, lastError, delay);
            } catch {
              // Don't let hook errors affect retry logic
            }
          }

          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted - throw the last error
    throw lastError || new Error("Max retries exceeded");
  }

  /**
   * Execute a single attempt through rate limiting, concurrency, and circuit breaker
   */
  private async _executeSingleAttempt<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
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
      // Only record as failure if it's a true system failure.
      // Non-system failures (validation errors, not found, duplicates, etc.)
      // should not trip the circuit breaker as they indicate the system
      // is working correctly, just rejecting invalid/expected operations.
      if (!isNonSystemFailure(error)) {
        this.circuitBreaker.recordFailure(
          error instanceof Error ? error : new Error(String(error)),
        );
      }

      // Handle ConvexError - extract data and include in error message
      // ConvexError has a `data` property containing the actual error code/message
      if (
        error &&
        typeof error === "object" &&
        "data" in error &&
        (error as { data: unknown }).data !== undefined
      ) {
        const convexError = error as { data: unknown; message?: string };
        const errorData =
          typeof convexError.data === "string"
            ? convexError.data
            : JSON.stringify(convexError.data);
        throw new Error(errorData);
      }

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
      // Only record as failure if it's a true system failure
      if (!isNonSystemFailure(error)) {
        this.circuitBreaker.recordFailure(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
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
