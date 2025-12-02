/**
 * Priority Queue
 *
 * In-memory queue that orders requests by priority level.
 * Higher priority requests are processed before lower priority ones.
 *
 * Features:
 * - Separate queues per priority level
 * - Configurable max size per priority
 * - Starvation prevention (optional aging)
 * - FIFO within same priority level
 */

import {
  DEFAULT_QUEUE_SIZES,
  PRIORITY_ORDER,
  QueueFullError,
  type Priority,
  type QueueConfig,
  type QueuedRequest,
  type QueueMetrics,
} from "./types";

export class PriorityQueue<T = unknown> {
  private queues: Map<Priority, Array<QueuedRequest<T>>>;
  private limits: Record<Priority, number>;

  // Metrics tracking
  private processed: number = 0;
  private dropped: number = 0;

  constructor(config: QueueConfig = {}) {
    // Initialize queue for each priority level
    this.queues = new Map();
    for (const priority of PRIORITY_ORDER) {
      this.queues.set(priority, []);
    }

    // Merge limits with defaults
    this.limits = { ...DEFAULT_QUEUE_SIZES, ...config.maxSize };
  }

  /**
   * Add a request to the queue
   *
   * @param request The request to queue
   * @returns true if queued, false if queue was full
   * @throws QueueFullError if queue is full for the given priority
   */
  enqueue(request: QueuedRequest<T>): boolean {
    const queue = this.queues.get(request.priority)!;
    const limit = this.limits[request.priority];

    // Check if queue is full
    if (queue.length >= limit) {
      this.dropped++;
      throw new QueueFullError(request.priority, queue.length);
    }

    queue.push(request);
    return true;
  }

  /**
   * Try to add a request without throwing
   *
   * @param request The request to queue
   * @returns true if queued, false if queue was full
   */
  tryEnqueue(request: QueuedRequest<T>): boolean {
    const queue = this.queues.get(request.priority)!;
    const limit = this.limits[request.priority];

    if (queue.length >= limit) {
      this.dropped++;
      return false;
    }

    queue.push(request);
    return true;
  }

  /**
   * Remove and return the highest priority request
   *
   * @returns The next request to process, or undefined if queue is empty
   */
  dequeue(): QueuedRequest<T> | undefined {
    // Process in priority order (critical first, background last)
    for (const priority of PRIORITY_ORDER) {
      const queue = this.queues.get(priority)!;

      if (queue.length > 0) {
        this.processed++;
        return queue.shift();
      }
    }

    return undefined;
  }

  /**
   * Peek at the highest priority request without removing it
   *
   * @returns The next request that would be dequeued, or undefined if empty
   */
  peek(): QueuedRequest<T> | undefined {
    for (const priority of PRIORITY_ORDER) {
      const queue = this.queues.get(priority)!;

      if (queue.length > 0) {
        return queue[0];
      }
    }

    return undefined;
  }

  /**
   * Get total number of queued requests
   */
  size(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * Get queue size broken down by priority
   */
  sizeByPriority(): Record<Priority, number> {
    const result: Record<Priority, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
      background: 0,
    };

    for (const [priority, queue] of this.queues.entries()) {
      result[priority] = queue.length;
    }

    return result;
  }

  /**
   * Check if the queue is empty
   */
  isEmpty(): boolean {
    return this.size() === 0;
  }

  /**
   * Check if a specific priority queue has capacity
   */
  hasCapacity(priority: Priority): boolean {
    const queue = this.queues.get(priority)!;
    return queue.length < this.limits[priority];
  }

  /**
   * Get the age of the oldest request in the queue (ms)
   */
  getOldestRequestAge(): number | undefined {
    let oldest: number | undefined;
    const now = Date.now();

    for (const queue of this.queues.values()) {
      if (queue.length > 0) {
        const age = now - queue[0].queuedAt;
        if (oldest === undefined || age > oldest) {
          oldest = age;
        }
      }
    }

    return oldest;
  }

  /**
   * Remove all expired requests (older than maxAge)
   *
   * @param maxAgeMs Maximum age in milliseconds
   * @returns Number of requests removed
   */
  removeExpired(maxAgeMs: number): number {
    const now = Date.now();
    let removed = 0;

    for (const [_, queue] of this.queues.entries()) {
      const toRemove: number[] = [];

      for (let i = 0; i < queue.length; i++) {
        if (now - queue[i].queuedAt > maxAgeMs) {
          toRemove.push(i);
        }
      }

      // Remove from end to preserve indices
      for (let i = toRemove.length - 1; i >= 0; i--) {
        const request = queue.splice(toRemove[i], 1)[0];
        request.reject(new Error(`Request expired after ${maxAgeMs}ms in queue`));
        removed++;
      }
    }

    return removed;
  }

  /**
   * Cancel a specific request by ID
   *
   * @param requestId The request ID to cancel
   * @returns true if found and cancelled, false otherwise
   */
  cancel(requestId: string): boolean {
    for (const [_, queue] of this.queues.entries()) {
      const index = queue.findIndex((r) => r.id === requestId);

      if (index !== -1) {
        const [request] = queue.splice(index, 1);
        request.reject(new Error("Request cancelled"));
        return true;
      }
    }

    return false;
  }

  /**
   * Get current metrics
   */
  getMetrics(): QueueMetrics {
    return {
      total: this.size(),
      byPriority: this.sizeByPriority(),
      processed: this.processed,
      dropped: this.dropped,
      oldestRequestAgeMs: this.getOldestRequestAge(),
    };
  }

  /**
   * Clear all queues and reject all pending requests
   */
  clear(): void {
    for (const [_, queue] of this.queues.entries()) {
      while (queue.length > 0) {
        const request = queue.shift()!;
        request.reject(new Error("Queue cleared"));
      }
    }
  }

  /**
   * Reset metrics (but keep queued requests)
   */
  resetMetrics(): void {
    this.processed = 0;
    this.dropped = 0;
  }
}
