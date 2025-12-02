/**
 * Cortex SDK Resilience Types
 *
 * Type definitions for the overload protection system including:
 * - Token Bucket Rate Limiter
 * - Semaphore Concurrency Limiter
 * - Priority Queue
 * - Circuit Breaker
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Priority Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Request priority levels for queue ordering
 *
 * - critical: GDPR/security operations (never dropped)
 * - high: Real-time conversation storage
 * - normal: Standard reads/writes
 * - low: Bulk operations, exports
 * - background: Async sync, analytics
 */
export type Priority = "critical" | "high" | "normal" | "low" | "background";

/**
 * Priority order for queue processing (highest first)
 */
export const PRIORITY_ORDER: Priority[] = [
  "critical",
  "high",
  "normal",
  "low",
  "background",
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Rate Limiter Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Token Bucket Rate Limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum burst capacity (tokens) - default: 100 */
  bucketSize?: number;

  /** Token refill rate per second - default: 50 */
  refillRate?: number;
}

/**
 * Default rate limiter configuration
 */
export const DEFAULT_RATE_LIMITER_CONFIG: Required<RateLimiterConfig> = {
  bucketSize: 100,
  refillRate: 50,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Concurrency Limiter Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Semaphore Concurrency Limiter configuration
 */
export interface ConcurrencyConfig {
  /** Maximum concurrent requests - default: 20 */
  maxConcurrent?: number;

  /** Maximum requests waiting in queue - default: 1000 */
  queueSize?: number;

  /** Maximum wait time for a permit (ms) - default: 30000 */
  timeout?: number;
}

/**
 * Default concurrency configuration
 */
export const DEFAULT_CONCURRENCY_CONFIG: Required<ConcurrencyConfig> = {
  maxConcurrent: 20,
  queueSize: 1000,
  timeout: 30000,
};

/**
 * Semaphore permit returned when acquiring
 */
export interface SemaphorePermit {
  /** Release the permit back to the semaphore */
  release: () => void;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Circuit Breaker Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Circuit breaker states
 */
export type CircuitState = "closed" | "open" | "half-open";

/**
 * Circuit Breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit - default: 5 */
  failureThreshold?: number;

  /** Number of successes in half-open to close circuit - default: 2 */
  successThreshold?: number;

  /** Time to wait in open state before half-open (ms) - default: 30000 */
  timeout?: number;

  /** Max test requests allowed in half-open state - default: 3 */
  halfOpenMax?: number;
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  halfOpenMax: 3,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Priority Queue Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Priority Queue configuration
 */
export interface QueueConfig {
  /** Maximum queue size per priority level */
  maxSize?: Partial<Record<Priority, number>>;
}

/**
 * Default queue size limits per priority
 */
export const DEFAULT_QUEUE_SIZES: Record<Priority, number> = {
  critical: 100,
  high: 500,
  normal: 1000,
  low: 2000,
  background: 5000,
};

/**
 * A queued request waiting for execution
 */
export interface QueuedRequest<T = unknown> {
  /** Unique request ID */
  id: string;

  /** The operation to execute */
  operation: () => Promise<T>;

  /** Request priority */
  priority: Priority;

  /** Operation name for logging/metrics */
  operationName: string;

  /** When the request was queued */
  queuedAt: number;

  /** Number of execution attempts */
  attempts: number;

  /** Promise resolve function */
  resolve: (value: T) => void;

  /** Promise reject function */
  reject: (error: Error) => void;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Resilience Configuration
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Main resilience layer configuration
 */
export interface ResilienceConfig {
  /** Enable/disable resilience layer - default: true */
  enabled?: boolean;

  /** Token bucket rate limiter settings */
  rateLimiter?: RateLimiterConfig;

  /** Semaphore concurrency limiter settings */
  concurrency?: ConcurrencyConfig;

  /** Circuit breaker settings */
  circuitBreaker?: CircuitBreakerConfig;

  /** Priority queue settings */
  queue?: QueueConfig;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Monitoring Hooks
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /** Called when circuit breaker opens */
  onCircuitOpen?: (failures: number) => void;

  /** Called when circuit breaker closes */
  onCircuitClose?: () => void;

  /** Called when circuit breaker enters half-open state */
  onCircuitHalfOpen?: () => void;

  /** Called when a queue is full and request is dropped */
  onQueueFull?: (priority: Priority) => void;

  /** Called when request is throttled (waiting for rate limit) */
  onThrottle?: (waitTimeMs: number) => void;

  /** Called periodically with current metrics */
  onMetrics?: (metrics: ResilienceMetrics) => void;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Metrics Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Rate limiter metrics
 */
export interface RateLimiterMetrics {
  /** Current available tokens */
  tokensAvailable: number;

  /** Total requests that had to wait */
  requestsThrottled: number;

  /** Average wait time for throttled requests (ms) */
  avgWaitTimeMs: number;
}

/**
 * Concurrency limiter metrics
 */
export interface ConcurrencyMetrics {
  /** Currently executing requests */
  active: number;

  /** Requests waiting for a permit */
  waiting: number;

  /** Peak concurrent requests reached */
  maxReached: number;

  /** Requests that timed out waiting */
  timeouts: number;
}

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  /** Current circuit state */
  state: CircuitState;

  /** Consecutive failures count */
  failures: number;

  /** Last failure timestamp */
  lastFailureAt?: number;

  /** Last state change timestamp */
  lastStateChangeAt: number;

  /** Total times circuit has opened */
  totalOpens: number;
}

/**
 * Priority queue metrics
 */
export interface QueueMetrics {
  /** Total requests in queue */
  total: number;

  /** Queue size by priority */
  byPriority: Record<Priority, number>;

  /** Total requests processed from queue */
  processed: number;

  /** Total requests dropped (queue full) */
  dropped: number;

  /** Oldest request age in queue (ms) */
  oldestRequestAgeMs?: number;
}

/**
 * Combined resilience metrics
 */
export interface ResilienceMetrics {
  /** Rate limiter statistics */
  rateLimiter: RateLimiterMetrics;

  /** Concurrency limiter statistics */
  concurrency: ConcurrencyMetrics;

  /** Circuit breaker statistics */
  circuitBreaker: CircuitBreakerMetrics;

  /** Queue statistics */
  queue: QueueMetrics;

  /** Metrics collection timestamp */
  timestamp: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Error Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitOpenError extends Error {
  constructor(
    message: string = "Circuit breaker is open - request rejected",
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "CircuitOpenError";
  }
}

/**
 * Error thrown when queue is full
 */
export class QueueFullError extends Error {
  constructor(
    public readonly priority: Priority,
    public readonly queueSize: number,
  ) {
    super(
      `Queue full for priority '${priority}' (size: ${queueSize}) - request dropped`,
    );
    this.name = "QueueFullError";
  }
}

/**
 * Error thrown when semaphore acquire times out
 */
export class AcquireTimeoutError extends Error {
  constructor(
    public readonly timeoutMs: number,
    public readonly waitingCount: number,
  ) {
    super(
      `Timed out waiting for permit after ${timeoutMs}ms (${waitingCount} requests waiting)`,
    );
    this.name = "AcquireTimeoutError";
  }
}

/**
 * Error thrown when rate limit is exceeded and waiting is disabled
 */
export class RateLimitExceededError extends Error {
  constructor(
    public readonly tokensAvailable: number,
    public readonly refillInMs: number,
  ) {
    super(
      `Rate limit exceeded (${tokensAvailable} tokens available, refill in ${refillInMs}ms)`,
    );
    this.name = "RateLimitExceededError";
  }
}
