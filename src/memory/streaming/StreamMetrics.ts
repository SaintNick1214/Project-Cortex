/**
 * Stream Metrics Collection and Reporting
 * 
 * Tracks comprehensive performance metrics during streaming operations
 * including timing, throughput, processing stats, and cost estimates.
 */

import type { StreamMetrics } from "../../types/streaming";

/**
 * Collects and aggregates streaming metrics in real-time
 */
export class MetricsCollector {
  private startTime: number;
  private firstChunkTime: number | null = null;
  private chunkSizes: number[] = [];
  private chunkTimestamps: number[] = [];
  private factsCount: number = 0;
  private partialUpdateCount: number = 0;
  private errorCount: number = 0;
  private retryCount: number = 0;
  private tokenEstimate: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Record a received chunk
   */
  recordChunk(size: number): void {
    const now = Date.now();
    
    // Record first chunk latency
    if (this.firstChunkTime === null) {
      this.firstChunkTime = now;
    }
    
    this.chunkSizes.push(size);
    this.chunkTimestamps.push(now);
    
    // Rough token estimate (1 token ≈ 4 chars)
    this.tokenEstimate += Math.ceil(size / 4);
  }

  /**
   * Record fact extraction
   */
  recordFactExtraction(count: number): void {
    this.factsCount += count;
  }

  /**
   * Record partial storage update
   */
  recordPartialUpdate(): void {
    this.partialUpdateCount++;
  }

  /**
   * Record an error occurrence
   */
  recordError(error: Error): void {
    this.errorCount++;
  }

  /**
   * Record a retry attempt
   */
  recordRetry(): void {
    this.retryCount++;
  }

  /**
   * Get current metrics snapshot
   */
  getSnapshot(): StreamMetrics {
    const now = Date.now();
    const duration = now - this.startTime;
    const totalBytes = this.chunkSizes.reduce((sum, size) => sum + size, 0);
    const totalChunks = this.chunkSizes.length;

    return {
      // Timing
      startTime: this.startTime,
      firstChunkLatency: this.firstChunkTime 
        ? this.firstChunkTime - this.startTime 
        : 0,
      streamDurationMs: duration,
      
      // Throughput
      totalChunks,
      totalBytes,
      averageChunkSize: totalChunks > 0 ? totalBytes / totalChunks : 0,
      chunksPerSecond: duration > 0 ? (totalChunks / duration) * 1000 : 0,
      
      // Processing
      factsExtracted: this.factsCount,
      partialUpdates: this.partialUpdateCount,
      errorCount: this.errorCount,
      retryCount: this.retryCount,
      
      // Estimates
      estimatedTokens: this.tokenEstimate,
      estimatedCost: this.calculateCost(this.tokenEstimate),
    };
  }

  /**
   * Calculate estimated cost based on tokens
   * Using GPT-4 pricing as baseline: ~$0.03/1K input tokens, $0.06/1K output tokens
   */
  private calculateCost(tokens: number): number | undefined {
    if (tokens === 0) return undefined;
    
    // Assume output tokens, more expensive
    const costPer1K = 0.06;
    return (tokens / 1000) * costPer1K;
  }

  /**
   * Get chunk size statistics
   */
  getChunkStats(): {
    min: number;
    max: number;
    median: number;
    stdDev: number;
  } {
    if (this.chunkSizes.length === 0) {
      return { min: 0, max: 0, median: 0, stdDev: 0 };
    }

    const sorted = [...this.chunkSizes].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // Calculate standard deviation
    const mean = this.chunkSizes.reduce((sum, size) => sum + size, 0) / this.chunkSizes.length;
    const variance = this.chunkSizes.reduce((sum, size) => sum + Math.pow(size - mean, 2), 0) / this.chunkSizes.length;
    const stdDev = Math.sqrt(variance);

    return { min, max, median, stdDev };
  }

  /**
   * Get timing statistics
   */
  getTimingStats(): {
    averageInterChunkDelay: number;
    minDelay: number;
    maxDelay: number;
  } {
    if (this.chunkTimestamps.length < 2) {
      return { averageInterChunkDelay: 0, minDelay: 0, maxDelay: 0 };
    }

    const delays: number[] = [];
    for (let i = 1; i < this.chunkTimestamps.length; i++) {
      delays.push(this.chunkTimestamps[i] - this.chunkTimestamps[i - 1]);
    }

    const averageInterChunkDelay = delays.reduce((sum, d) => sum + d, 0) / delays.length;
    const minDelay = Math.min(...delays);
    const maxDelay = Math.max(...delays);

    return { averageInterChunkDelay, minDelay, maxDelay };
  }

  /**
   * Detect stream characteristics
   */
  detectStreamType(): 'fast' | 'slow' | 'bursty' | 'steady' {
    const timingStats = this.getTimingStats();
    const chunkStats = this.getChunkStats();

    // Fast: Short inter-chunk delays (< 50ms average)
    if (timingStats.averageInterChunkDelay < 50) {
      return 'fast';
    }

    // Slow: Long inter-chunk delays (> 500ms average)
    if (timingStats.averageInterChunkDelay > 500) {
      return 'slow';
    }

    // Bursty: High variance in chunk sizes or timing
    const timingVariance = (timingStats.maxDelay - timingStats.minDelay) / timingStats.averageInterChunkDelay;
    if (timingVariance > 2 || chunkStats.stdDev > chunkStats.median) {
      return 'bursty';
    }

    // Steady: Consistent timing and chunk sizes
    return 'steady';
  }

  /**
   * Reset metrics (useful for testing or reuse)
   */
  reset(): void {
    this.startTime = Date.now();
    this.firstChunkTime = null;
    this.chunkSizes = [];
    this.chunkTimestamps = [];
    this.factsCount = 0;
    this.partialUpdateCount = 0;
    this.errorCount = 0;
    this.retryCount = 0;
    this.tokenEstimate = 0;
  }

  /**
   * Generate performance insights based on metrics
   */
  generateInsights(): {
    bottlenecks: string[];
    recommendations: string[];
  } {
    const metrics = this.getSnapshot();
    const bottlenecks: string[] = [];
    const recommendations: string[] = [];

    // Analyze first chunk latency
    if (metrics.firstChunkLatency > 2000) {
      bottlenecks.push('High first chunk latency (> 2s)');
      recommendations.push('Consider optimizing LLM prompt or switching to a faster model');
    }

    // Analyze throughput
    if (metrics.chunksPerSecond < 1 && metrics.totalChunks > 10) {
      bottlenecks.push('Low throughput (< 1 chunk/second)');
      recommendations.push('Stream may be slow, consider using progressive storage');
    }

    // Analyze error rate
    const errorRate = metrics.totalChunks > 0 ? metrics.errorCount / metrics.totalChunks : 0;
    if (errorRate > 0.1) {
      bottlenecks.push(`High error rate (${(errorRate * 100).toFixed(1)}%)`);
      recommendations.push('Implement retry logic or check network stability');
    }

    // Analyze fact extraction
    if (metrics.factsExtracted === 0 && metrics.totalBytes > 1000) {
      recommendations.push('No facts extracted - consider enabling progressive fact extraction');
    }

    // Analyze partial updates
    if (metrics.partialUpdates === 0 && metrics.streamDurationMs > 5000) {
      recommendations.push('Long stream with no partial updates - enable progressive storage for better resilience');
    }

    // Cost warnings
    if (metrics.estimatedCost && metrics.estimatedCost > 1) {
      recommendations.push(`High estimated cost ($${metrics.estimatedCost.toFixed(2)}) - consider response length limits`);
    }

    return { bottlenecks, recommendations };
  }
}
