/**
 * Performance Metrics Collection for Stress Testing
 *
 * Provides utilities for tracking and reporting performance metrics
 * during extreme multi-turn conversation stress tests.
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface TimingEntry {
  operation: string;
  durationMs: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface OperationStats {
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms: number;
  p90Ms: number;
  p99Ms: number;
}

export interface TestMetrics {
  testName: string;
  startTime: number;
  endTime?: number;
  totalDurationMs?: number;
  turnCount: number;
  factStats: {
    created: number;
    updated: number;
    superseded: number;
    duplicatesAvoided: number;
    expected: number;
  };
  operationTimings: Record<string, TimingEntry[]>;
  operationStats: Record<string, OperationStats>;
  errors: string[];
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

export interface AggregateMetrics {
  testCount: number;
  totalTurns: number;
  totalDurationMs: number;
  avgTurnDurationMs: number;
  tests: Record<string, TestMetrics>;
  globalOperationStats: Record<string, OperationStats>;
  errorCount: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Metrics Collector Class
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class MetricsCollector {
  private metrics: TestMetrics;
  private activeTimers: Map<string, number> = new Map();

  constructor(testName: string) {
    this.metrics = {
      testName,
      startTime: Date.now(),
      turnCount: 0,
      factStats: {
        created: 0,
        updated: 0,
        superseded: 0,
        duplicatesAvoided: 0,
        expected: 0,
      },
      operationTimings: {},
      operationStats: {},
      errors: [],
    };
  }

  /**
   * Start timing an operation
   */
  startTimer(operationId: string): void {
    this.activeTimers.set(operationId, performance.now());
  }

  /**
   * Stop timing an operation and record the duration
   */
  stopTimer(
    operationId: string,
    operation: string,
    metadata?: Record<string, unknown>,
  ): number {
    const startTime = this.activeTimers.get(operationId);
    if (!startTime) {
      console.warn(`Timer ${operationId} was not started`);
      return 0;
    }

    const durationMs = performance.now() - startTime;
    this.activeTimers.delete(operationId);

    this.recordTiming(operation, durationMs, metadata);
    return durationMs;
  }

  /**
   * Record a timing entry
   */
  recordTiming(
    operation: string,
    durationMs: number,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.metrics.operationTimings[operation]) {
      this.metrics.operationTimings[operation] = [];
    }

    this.metrics.operationTimings[operation].push({
      operation,
      durationMs,
      timestamp: Date.now(),
      metadata,
    });
  }

  /**
   * Time an async operation and record the result
   */
  async timeOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>,
  ): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const durationMs = performance.now() - startTime;
      this.recordTiming(operation, durationMs, metadata);
      return result;
    } catch (error) {
      const durationMs = performance.now() - startTime;
      this.recordTiming(operation, durationMs, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Increment turn count
   */
  incrementTurn(): void {
    this.metrics.turnCount++;
  }

  /**
   * Record fact operations
   */
  recordFactCreated(): void {
    this.metrics.factStats.created++;
  }

  recordFactUpdated(): void {
    this.metrics.factStats.updated++;
  }

  recordFactSuperseded(): void {
    this.metrics.factStats.superseded++;
  }

  recordDuplicateAvoided(): void {
    this.metrics.factStats.duplicatesAvoided++;
  }

  setExpectedFacts(count: number): void {
    this.metrics.factStats.expected = count;
  }

  /**
   * Record an error
   */
  recordError(error: string | Error): void {
    const message = error instanceof Error ? error.message : error;
    this.metrics.errors.push(message);
  }

  /**
   * Capture current memory usage
   */
  captureMemoryUsage(): void {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const usage = process.memoryUsage();
      this.metrics.memoryUsage = {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
      };
    }
  }

  /**
   * Calculate statistics for all recorded operations
   */
  private calculateStats(): void {
    for (const [operation, timings] of Object.entries(this.metrics.operationTimings)) {
      if (timings.length === 0) continue;

      const durations = timings.map((t) => t.durationMs).sort((a, b) => a - b);
      const count = durations.length;
      const totalMs = durations.reduce((sum, d) => sum + d, 0);

      this.metrics.operationStats[operation] = {
        count,
        totalMs,
        minMs: durations[0],
        maxMs: durations[count - 1],
        avgMs: totalMs / count,
        p50Ms: this.percentile(durations, 50),
        p90Ms: this.percentile(durations, 90),
        p99Ms: this.percentile(durations, 99),
      };
    }
  }

  /**
   * Calculate percentile value
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  /**
   * Finalize metrics and return the results
   */
  finalize(): TestMetrics {
    this.metrics.endTime = Date.now();
    this.metrics.totalDurationMs = this.metrics.endTime - this.metrics.startTime;
    this.captureMemoryUsage();
    this.calculateStats();
    return this.metrics;
  }

  /**
   * Get current metrics (without finalizing)
   */
  getSnapshot(): TestMetrics {
    const snapshot = { ...this.metrics };
    snapshot.totalDurationMs = Date.now() - this.metrics.startTime;
    return snapshot;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Aggregate Metrics Collector
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class AggregateMetricsCollector {
  private tests: Map<string, TestMetrics> = new Map();
  private startTime: number = Date.now();

  /**
   * Add a test's metrics
   */
  addTestMetrics(metrics: TestMetrics): void {
    this.tests.set(metrics.testName, metrics);
  }

  /**
   * Calculate aggregate statistics
   */
  finalize(): AggregateMetrics {
    const testArray = Array.from(this.tests.values());

    const totalTurns = testArray.reduce((sum, t) => sum + t.turnCount, 0);
    const totalDurationMs = Date.now() - this.startTime;
    const errorCount = testArray.reduce((sum, t) => sum + t.errors.length, 0);

    // Aggregate operation timings across all tests
    const allTimings: Record<string, TimingEntry[]> = {};
    for (const test of testArray) {
      for (const [operation, timings] of Object.entries(test.operationTimings)) {
        if (!allTimings[operation]) {
          allTimings[operation] = [];
        }
        allTimings[operation].push(...timings);
      }
    }

    // Calculate global operation stats
    const globalOperationStats: Record<string, OperationStats> = {};
    for (const [operation, timings] of Object.entries(allTimings)) {
      if (timings.length === 0) continue;

      const durations = timings.map((t) => t.durationMs).sort((a, b) => a - b);
      const count = durations.length;
      const totalMs = durations.reduce((sum, d) => sum + d, 0);

      globalOperationStats[operation] = {
        count,
        totalMs,
        minMs: durations[0],
        maxMs: durations[count - 1],
        avgMs: totalMs / count,
        p50Ms: this.percentile(durations, 50),
        p90Ms: this.percentile(durations, 90),
        p99Ms: this.percentile(durations, 99),
      };
    }

    return {
      testCount: this.tests.size,
      totalTurns,
      totalDurationMs,
      avgTurnDurationMs: totalTurns > 0 ? totalDurationMs / totalTurns : 0,
      tests: Object.fromEntries(this.tests),
      globalOperationStats,
      errorCount,
    };
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Report Formatter
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function formatTestReport(metrics: TestMetrics): string {
  const lines: string[] = [];

  lines.push("═".repeat(80));
  lines.push(`TEST: ${metrics.testName}`);
  lines.push("═".repeat(80));

  // Duration and turns
  lines.push("");
  lines.push("📊 Overview:");
  lines.push(`   Total Duration: ${formatDuration(metrics.totalDurationMs || 0)}`);
  lines.push(`   Turns Processed: ${metrics.turnCount}`);
  lines.push(
    `   Avg Time/Turn: ${formatDuration((metrics.totalDurationMs || 0) / Math.max(1, metrics.turnCount))}`,
  );

  // Fact statistics
  lines.push("");
  lines.push("📝 Fact Statistics:");
  lines.push(`   Created: ${metrics.factStats.created}`);
  lines.push(`   Updated: ${metrics.factStats.updated}`);
  lines.push(`   Superseded: ${metrics.factStats.superseded}`);
  lines.push(`   Duplicates Avoided: ${metrics.factStats.duplicatesAvoided}`);
  if (metrics.factStats.expected > 0) {
    lines.push(`   Expected: ${metrics.factStats.expected}`);
  }

  // Operation stats
  if (Object.keys(metrics.operationStats).length > 0) {
    lines.push("");
    lines.push("⏱️  Operation Timings:");
    for (const [operation, stats] of Object.entries(metrics.operationStats)) {
      lines.push(`   ${operation}:`);
      lines.push(`      Count: ${stats.count}`);
      lines.push(`      Avg: ${formatDuration(stats.avgMs)}`);
      lines.push(`      P50: ${formatDuration(stats.p50Ms)}`);
      lines.push(`      P90: ${formatDuration(stats.p90Ms)}`);
      lines.push(`      P99: ${formatDuration(stats.p99Ms)}`);
      lines.push(`      Min: ${formatDuration(stats.minMs)}`);
      lines.push(`      Max: ${formatDuration(stats.maxMs)}`);
    }
  }

  // Memory usage
  if (metrics.memoryUsage) {
    lines.push("");
    lines.push("💾 Memory Usage:");
    lines.push(`   Heap Used: ${formatBytes(metrics.memoryUsage.heapUsed)}`);
    lines.push(`   Heap Total: ${formatBytes(metrics.memoryUsage.heapTotal)}`);
    lines.push(`   External: ${formatBytes(metrics.memoryUsage.external)}`);
  }

  // Errors
  if (metrics.errors.length > 0) {
    lines.push("");
    lines.push("❌ Errors:");
    for (const error of metrics.errors.slice(0, 10)) {
      lines.push(`   - ${error}`);
    }
    if (metrics.errors.length > 10) {
      lines.push(`   ... and ${metrics.errors.length - 10} more`);
    }
  }

  lines.push("");
  lines.push("═".repeat(80));

  return lines.join("\n");
}

export function formatAggregateReport(aggregate: AggregateMetrics): string {
  const lines: string[] = [];

  lines.push("╔".padEnd(79, "═") + "╗");
  lines.push("║" + " STRESS TEST AGGREGATE REPORT ".padStart(45).padEnd(78) + "║");
  lines.push("╚".padEnd(79, "═") + "╝");

  // Overview
  lines.push("");
  lines.push("📊 Overall Summary:");
  lines.push(`   Tests Run: ${aggregate.testCount}`);
  lines.push(`   Total Turns: ${aggregate.totalTurns}`);
  lines.push(`   Total Duration: ${formatDuration(aggregate.totalDurationMs)}`);
  lines.push(`   Avg Time/Turn: ${formatDuration(aggregate.avgTurnDurationMs)}`);
  lines.push(`   Total Errors: ${aggregate.errorCount}`);

  // Global operation stats
  if (Object.keys(aggregate.globalOperationStats).length > 0) {
    lines.push("");
    lines.push("⏱️  Global Operation Statistics:");
    for (const [operation, stats] of Object.entries(aggregate.globalOperationStats)) {
      lines.push(`   ${operation}: ${stats.count} calls, avg ${formatDuration(stats.avgMs)}, p99 ${formatDuration(stats.p99Ms)}`);
    }
  }

  // Per-test summary
  lines.push("");
  lines.push("📋 Per-Test Summary:");
  for (const [testName, metrics] of Object.entries(aggregate.tests)) {
    const status = metrics.errors.length === 0 ? "✅" : "❌";
    lines.push(
      `   ${status} ${testName}: ${metrics.turnCount} turns, ${formatDuration(metrics.totalDurationMs || 0)}`,
    );
  }

  lines.push("");
  lines.push("═".repeat(80));

  return lines.join("\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Utility Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}min`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Rate Limiter for API Calls
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number = 100, refillRate: number = 50) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  async acquire(cost: number = 1): Promise<void> {
    this.refill();

    while (this.tokens < cost) {
      const waitTime = ((cost - this.tokens) / this.refillRate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      this.refill();
    }

    this.tokens -= cost;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}
