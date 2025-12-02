/**
 * Circuit Breaker
 *
 * Implements the circuit breaker pattern to prevent cascading failures.
 * When too many failures occur, the circuit "opens" and fails fast.
 *
 * States:
 * - CLOSED: Normal operation, counting failures
 * - OPEN: All requests fail immediately, waiting for timeout
 * - HALF-OPEN: Testing with limited requests to see if system recovered
 *
 * Behavior:
 * - Starts in CLOSED state
 * - Opens after failureThreshold consecutive failures
 * - Waits timeout ms in OPEN state, then transitions to HALF-OPEN
 * - In HALF-OPEN, allows halfOpenMax test requests
 * - If successThreshold successes in HALF-OPEN, transitions to CLOSED
 * - Any failure in HALF-OPEN transitions back to OPEN
 */

import {
  CircuitOpenError,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  type CircuitBreakerConfig,
  type CircuitBreakerMetrics,
  type CircuitState,
} from "./types";

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures: number = 0;
  private successes: number = 0;
  private halfOpenAttempts: number = 0;
  private lastFailureAt?: number;
  private lastStateChangeAt: number;
  private openedAt?: number;

  // Configuration
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly halfOpenMax: number;

  // Metrics
  private totalOpens: number = 0;

  // Event callbacks
  private onOpen?: (failures: number) => void;
  private onClose?: () => void;
  private onHalfOpen?: () => void;

  constructor(
    config: CircuitBreakerConfig = {},
    callbacks?: {
      onOpen?: (failures: number) => void;
      onClose?: () => void;
      onHalfOpen?: () => void;
    },
  ) {
    const merged = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.failureThreshold = merged.failureThreshold;
    this.successThreshold = merged.successThreshold;
    this.timeout = merged.timeout;
    this.halfOpenMax = merged.halfOpenMax;
    this.lastStateChangeAt = Date.now();

    // Set callbacks
    this.onOpen = callbacks?.onOpen;
    this.onClose = callbacks?.onClose;
    this.onHalfOpen = callbacks?.onHalfOpen;
  }

  /**
   * Check if circuit is currently open (not accepting requests)
   */
  isOpen(): boolean {
    // Check if we should transition from open to half-open
    if (this.state === "open") {
      const elapsed = Date.now() - (this.openedAt ?? 0);
      if (elapsed >= this.timeout) {
        this.transitionTo("half-open");
      }
    }

    return this.state === "open";
  }

  /**
   * Check if circuit allows execution
   */
  allowsExecution(): boolean {
    // Update state if needed
    this.isOpen();

    switch (this.state) {
      case "closed":
        return true;

      case "open":
        return false;

      case "half-open":
        // Allow limited requests in half-open
        return this.halfOpenAttempts < this.halfOpenMax;
    }
  }

  /**
   * Execute a function through the circuit breaker
   *
   * @param fn The function to execute
   * @returns The result of the function
   * @throws CircuitOpenError if circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.allowsExecution()) {
      const retryAfter = this.openedAt
        ? this.timeout - (Date.now() - this.openedAt)
        : this.timeout;

      throw new CircuitOpenError(
        "Circuit breaker is open - request rejected",
        Math.max(0, retryAfter),
      );
    }

    // Track half-open attempts
    if (this.state === "half-open") {
      this.halfOpenAttempts++;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Record a successful execution
   */
  recordSuccess(): void {
    switch (this.state) {
      case "closed":
        // Reset failure count on success
        this.failures = 0;
        break;

      case "half-open":
        this.successes++;

        // Check if we should close the circuit
        if (this.successes >= this.successThreshold) {
          this.transitionTo("closed");
        }
        break;

      case "open":
        // Shouldn't happen, but ignore
        break;
    }
  }

  /**
   * Record a failed execution
   */
  recordFailure(_error: Error): void {
    this.lastFailureAt = Date.now();

    switch (this.state) {
      case "closed":
        this.failures++;

        // Check if we should open the circuit
        if (this.failures >= this.failureThreshold) {
          this.transitionTo("open");
        }
        break;

      case "half-open":
        // Any failure in half-open reopens the circuit
        this.transitionTo("open");
        break;

      case "open":
        // Already open, just update timestamp
        break;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    // Check for state transition
    this.isOpen();
    return this.state;
  }

  /**
   * Get time until circuit might close (ms)
   * Returns 0 if circuit is closed
   */
  getTimeUntilClose(): number {
    if (this.state === "closed") {
      return 0;
    }

    if (this.state === "open" && this.openedAt) {
      const elapsed = Date.now() - this.openedAt;
      return Math.max(0, this.timeout - elapsed);
    }

    // Half-open: depends on test results
    return 0;
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    // Update state if needed
    this.isOpen();

    return {
      state: this.state,
      failures: this.failures,
      lastFailureAt: this.lastFailureAt,
      lastStateChangeAt: this.lastStateChangeAt,
      totalOpens: this.totalOpens,
    };
  }

  /**
   * Manually reset circuit to closed state
   */
  reset(): void {
    this.transitionTo("closed");
    this.failures = 0;
    this.successes = 0;
    this.halfOpenAttempts = 0;
    this.lastFailureAt = undefined;
    this.totalOpens = 0;
  }

  /**
   * Force circuit to open state (for testing/maintenance)
   */
  forceOpen(): void {
    this.transitionTo("open");
  }

  /**
   * Force circuit to closed state (for testing/recovery)
   */
  forceClose(): void {
    this.transitionTo("closed");
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) {
      return;
    }

    const previousState = this.state;
    this.state = newState;
    this.lastStateChangeAt = Date.now();

    // Reset state-specific counters
    switch (newState) {
      case "closed":
        this.failures = 0;
        this.successes = 0;
        this.halfOpenAttempts = 0;
        this.onClose?.();
        break;

      case "open":
        this.openedAt = Date.now();
        this.successes = 0;
        this.halfOpenAttempts = 0;

        // Only count as open if transitioning from non-open state
        if (previousState !== "open") {
          this.totalOpens++;
        }

        this.onOpen?.(this.failures);
        break;

      case "half-open":
        this.successes = 0;
        this.halfOpenAttempts = 0;
        this.onHalfOpen?.();
        break;
    }
  }
}
