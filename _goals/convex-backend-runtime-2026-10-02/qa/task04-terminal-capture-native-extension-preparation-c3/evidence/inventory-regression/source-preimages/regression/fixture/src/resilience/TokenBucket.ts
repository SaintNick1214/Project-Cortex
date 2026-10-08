/**
 * Token Bucket Rate Limiter
 *
 * Implements the classic token bucket algorithm to smooth burst traffic.
 * Tokens are consumed on each request and refill over time.
 *
 * Behavior:
 * - Bucket starts full (bucketSize tokens)
 * - Each request consumes 1 token
 * - Tokens refill at refillRate per second
 * - Burst traffic up to bucketSize passes immediately
 * - Sustained traffic is smoothed to refillRate
 */

import {
  DEFAULT_RATE_LIMITER_CONFIG,
  RateLimitExceededError,
  type RateLimiterConfig,
  type RateLimiterMetrics,
} from "./types";

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly bucketSize: number;
  private readonly refillRate: number;

  // Metrics tracking
  private requestsThrottled: number = 0;
  private totalWaitTimeMs: number = 0;

  constructor(config: RateLimiterConfig = {}) {
    const merged = { ...DEFAULT_RATE_LIMITER_CONFIG, ...config };
    this.bucketSize = merged.bucketSize;
    this.refillRate = merged.refillRate;
    this.tokens = this.bucketSize; // Start with full bucket
    this.lastRefill = Date.now();
  }

  /**
   * Refill tokens based on time elapsed since last refill
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = (elapsed / 1000) * this.refillRate;

    this.tokens = Math.min(this.bucketSize, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Try to acquire a token without waiting
   *
   * @returns true if token was acquired, false if bucket is empty
   */
  tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Acquire a token, waiting if necessary
   *
   * @param timeout Maximum time to wait (ms). If not provided, waits indefinitely.
   * @throws RateLimitExceededError if timeout is reached
   */
  async acquire(timeout?: number): Promise<void> {
    this.refill();

    // Fast path: token available immediately
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate time until next token is available
    const tokensNeeded = 1 - this.tokens;
    const waitTimeMs = (tokensNeeded / this.refillRate) * 1000;

    // Check timeout
    if (timeout !== undefined && waitTimeMs > timeout) {
      throw new RateLimitExceededError(
        Math.floor(this.tokens),
        Math.ceil(waitTimeMs),
      );
    }

    // Track throttling metrics
    this.requestsThrottled++;
    this.totalWaitTimeMs += waitTimeMs;

    // Wait for token to become available
    await this.sleep(waitTimeMs);

    // Refill and consume token
    this.refill();
    this.tokens -= 1;
  }

  /**
   * Get the number of tokens currently available
   */
  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Get time until next token is available (ms)
   */
  getTimeUntilNextToken(): number {
    this.refill();

    if (this.tokens >= 1) {
      return 0;
    }

    const tokensNeeded = 1 - this.tokens;
    return Math.ceil((tokensNeeded / this.refillRate) * 1000);
  }

  /**
   * Get current metrics
   */
  getMetrics(): RateLimiterMetrics {
    this.refill();

    return {
      tokensAvailable: Math.floor(this.tokens),
      requestsThrottled: this.requestsThrottled,
      avgWaitTimeMs:
        this.requestsThrottled > 0
          ? this.totalWaitTimeMs / this.requestsThrottled
          : 0,
    };
  }

  /**
   * Reset the bucket to full and clear metrics
   */
  reset(): void {
    this.tokens = this.bucketSize;
    this.lastRefill = Date.now();
    this.requestsThrottled = 0;
    this.totalWaitTimeMs = 0;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
