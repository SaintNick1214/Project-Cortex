/**
 * Async Semaphore Concurrency Limiter
 *
 * Limits the number of concurrent in-flight requests using a semaphore pattern.
 * Requests beyond the limit wait in a queue until a permit becomes available.
 *
 * Behavior:
 * - maxConcurrent permits available at any time
 * - Requests acquire a permit before executing, release after
 * - Excess requests wait in a queue (up to queueSize)
 * - Optional timeout prevents indefinite waiting
 */

import {
  AcquireTimeoutError,
  DEFAULT_CONCURRENCY_CONFIG,
  type ConcurrencyConfig,
  type ConcurrencyMetrics,
  type SemaphorePermit,
} from "./types";

interface WaitingRequest {
  resolve: (permit: SemaphorePermit) => void;
  reject: (error: Error) => void;
  timeoutId?: ReturnType<typeof setTimeout>;
}

export class Semaphore {
  private availablePermits: number;
  private readonly maxPermits: number;
  private readonly queueLimit: number;
  private readonly defaultTimeout: number;
  private waiting: WaitingRequest[] = [];

  // Metrics tracking
  private maxReached: number = 0;
  private timeouts: number = 0;

  constructor(config: ConcurrencyConfig = {}) {
    const merged = { ...DEFAULT_CONCURRENCY_CONFIG, ...config };
    this.maxPermits = merged.maxConcurrent;
    this.queueLimit = merged.queueSize;
    this.defaultTimeout = merged.timeout;
    this.availablePermits = this.maxPermits;
  }

  /**
   * Acquire a permit, waiting if necessary
   *
   * @param timeout Maximum time to wait (ms). Uses default if not provided.
   * @returns A permit that must be released when done
   * @throws AcquireTimeoutError if timeout is reached
   * @throws Error if queue is full
   */
  async acquire(timeout?: number): Promise<SemaphorePermit> {
    // Fast path: permit available immediately
    if (this.availablePermits > 0) {
      this.availablePermits--;
      this.updateMaxReached();
      return this.createPermit();
    }

    // Check queue limit
    if (this.waiting.length >= this.queueLimit) {
      throw new Error(
        `Semaphore queue full (${this.queueLimit} requests waiting)`,
      );
    }

    // Wait for a permit
    const effectiveTimeout = timeout ?? this.defaultTimeout;

    return new Promise<SemaphorePermit>((resolve, reject) => {
      const request: WaitingRequest = { resolve, reject };

      // Set timeout if specified
      if (effectiveTimeout > 0) {
        request.timeoutId = setTimeout(() => {
          // Remove from queue
          const index = this.waiting.indexOf(request);
          if (index !== -1) {
            this.waiting.splice(index, 1);
          }

          this.timeouts++;
          reject(
            new AcquireTimeoutError(effectiveTimeout, this.waiting.length),
          );
        }, effectiveTimeout);
      }

      this.waiting.push(request);
    });
  }

  /**
   * Try to acquire a permit without waiting
   *
   * @returns A permit if available, undefined otherwise
   */
  tryAcquire(): SemaphorePermit | undefined {
    if (this.availablePermits > 0) {
      this.availablePermits--;
      this.updateMaxReached();
      return this.createPermit();
    }

    return undefined;
  }

  /**
   * Create a permit object with release function
   */
  private createPermit(): SemaphorePermit {
    let released = false;

    return {
      release: () => {
        if (released) {
          console.warn("Semaphore permit released multiple times");
          return;
        }

        released = true;
        this.release();
      },
    };
  }

  /**
   * Release a permit back to the semaphore
   * (Called internally by permit.release())
   */
  private release(): void {
    // If there are waiting requests, give permit to next in line
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;

      // Clear timeout if set
      if (next.timeoutId) {
        clearTimeout(next.timeoutId);
      }

      // Give them a new permit (don't increase availablePermits)
      this.updateMaxReached();
      next.resolve(this.createPermit());
    } else {
      // No waiting requests, return permit to pool
      this.availablePermits++;
    }
  }

  /**
   * Update max concurrent reached metric
   */
  private updateMaxReached(): void {
    const active = this.maxPermits - this.availablePermits;
    if (active > this.maxReached) {
      this.maxReached = active;
    }
  }

  /**
   * Get number of currently active (acquired) permits
   */
  getActiveCount(): number {
    return this.maxPermits - this.availablePermits;
  }

  /**
   * Get number of requests waiting for a permit
   */
  getWaitingCount(): number {
    return this.waiting.length;
  }

  /**
   * Get available permits
   */
  getAvailableCount(): number {
    return this.availablePermits;
  }

  /**
   * Get current metrics
   */
  getMetrics(): ConcurrencyMetrics {
    return {
      active: this.getActiveCount(),
      waiting: this.waiting.length,
      maxReached: this.maxReached,
      timeouts: this.timeouts,
    };
  }

  /**
   * Reset semaphore to initial state
   * WARNING: This will reject all waiting requests
   */
  reset(): void {
    // Reject all waiting requests
    const waitingCopy = [...this.waiting];
    this.waiting = [];

    for (const request of waitingCopy) {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      request.reject(new Error("Semaphore reset"));
    }

    // Reset permits and metrics
    this.availablePermits = this.maxPermits;
    this.maxReached = 0;
    this.timeouts = 0;
  }
}
