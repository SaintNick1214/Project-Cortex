/**
 * Adaptive Stream Processor
 * 
 * Analyzes stream characteristics in real-time and adjusts processing
 * strategy for optimal performance:
 * - Fast streams: Batch processing, reduced overhead
 * - Slow streams: Immediate processing, optimize for latency
 * - Bursty streams: Dynamic buffering
 * - Long streams: Enable chunking automatically
 */

import type {
  StreamType,
  ProcessingStrategy,
  StreamMetrics,
} from "../../types/streaming";
import type { MetricsCollector } from "./StreamMetrics";

/**
 * Adapts processing strategy based on stream characteristics
 */
export class AdaptiveStreamProcessor {
  private chunkSizeHistory: number[] = [];
  private processingTimeHistory: number[] = [];
  private currentStrategy: ProcessingStrategy;
  private readonly maxHistorySize: number = 50;

  constructor(initialStrategy?: ProcessingStrategy) {
    this.currentStrategy = initialStrategy || this.getDefaultStrategy();
  }

  /**
   * Adjust processing strategy based on current metrics
   */
  async adjustProcessingStrategy(
    metrics: StreamMetrics,
    metricsCollector: MetricsCollector,
  ): Promise<ProcessingStrategy> {
    // Detect stream type
    const streamType = metricsCollector.detectStreamType();

    // Get optimal strategy for this stream type
    const newStrategy = this.optimizeForType(streamType, metrics);

    // Update current strategy if changed
    if (this.hasStrategyChanged(newStrategy)) {
      this.currentStrategy = newStrategy;
    }

    return this.currentStrategy;
  }

  /**
   * Detect stream type based on metrics
   */
  detectStreamType(metrics: StreamMetrics): StreamType {
    const { chunksPerSecond, averageChunkSize, totalChunks } = metrics;

    // Fast: High throughput
    if (chunksPerSecond > 10) {
      return 'fast';
    }

    // Slow: Low throughput
    if (chunksPerSecond < 1 && totalChunks > 5) {
      return 'slow';
    }

    // Bursty: High variance in chunk sizes
    const chunkStats = this.calculateVariance(this.chunkSizeHistory);
    if (chunkStats.coefficient > 0.5) {
      return 'bursty';
    }

    // Steady: Consistent throughput and chunk sizes
    return 'steady';
  }

  /**
   * Optimize strategy for detected stream type
   */
  private optimizeForType(
    streamType: StreamType,
    metrics: StreamMetrics,
  ): ProcessingStrategy {
    switch (streamType) {
      case 'fast':
        return this.getFastStreamStrategy(metrics);
      
      case 'slow':
        return this.getSlowStreamStrategy(metrics);
      
      case 'bursty':
        return this.getBurstyStreamStrategy(metrics);
      
      case 'steady':
        return this.getSteadyStreamStrategy(metrics);
      
      default:
        return this.getDefaultStrategy();
    }
  }

  /**
   * Strategy for fast streams - batch processing
   */
  private getFastStreamStrategy(metrics: StreamMetrics): ProcessingStrategy {
    return {
      bufferSize: 10, // Buffer 10 chunks before processing
      factExtractionFrequency: 1000, // Extract every 1000 chars
      partialUpdateInterval: 5000, // Update every 5 seconds
      enablePredictiveLoading: true,
    };
  }

  /**
   * Strategy for slow streams - immediate processing
   */
  private getSlowStreamStrategy(metrics: StreamMetrics): ProcessingStrategy {
    return {
      bufferSize: 1, // Process immediately
      factExtractionFrequency: 300, // Extract every 300 chars
      partialUpdateInterval: 2000, // Update every 2 seconds
      enablePredictiveLoading: false,
    };
  }

  /**
   * Strategy for bursty streams - dynamic buffering
   */
  private getBurstyStreamStrategy(metrics: StreamMetrics): ProcessingStrategy {
    return {
      bufferSize: 5, // Medium buffering
      factExtractionFrequency: 500, // Extract every 500 chars
      partialUpdateInterval: 3000, // Update every 3 seconds
      enablePredictiveLoading: false,
    };
  }

  /**
   * Strategy for steady streams - balanced approach
   */
  private getSteadyStreamStrategy(metrics: StreamMetrics): ProcessingStrategy {
    return {
      bufferSize: 3, // Small buffer
      factExtractionFrequency: 500, // Extract every 500 chars
      partialUpdateInterval: 3000, // Update every 3 seconds
      enablePredictiveLoading: true,
    };
  }

  /**
   * Default processing strategy
   */
  private getDefaultStrategy(): ProcessingStrategy {
    return {
      bufferSize: 1,
      factExtractionFrequency: 500,
      partialUpdateInterval: 3000,
      enablePredictiveLoading: false,
    };
  }

  /**
   * Check if strategy has meaningfully changed
   */
  private hasStrategyChanged(newStrategy: ProcessingStrategy): boolean {
    return (
      newStrategy.bufferSize !== this.currentStrategy.bufferSize ||
      newStrategy.factExtractionFrequency !== this.currentStrategy.factExtractionFrequency ||
      newStrategy.partialUpdateInterval !== this.currentStrategy.partialUpdateInterval
    );
  }

  /**
   * Record chunk size for analysis
   */
  recordChunkSize(size: number): void {
    this.chunkSizeHistory.push(size);
    
    // Keep history size manageable
    if (this.chunkSizeHistory.length > this.maxHistorySize) {
      this.chunkSizeHistory.shift();
    }
  }

  /**
   * Record processing time for analysis
   */
  recordProcessingTime(timeMs: number): void {
    this.processingTimeHistory.push(timeMs);
    
    // Keep history size manageable
    if (this.processingTimeHistory.length > this.maxHistorySize) {
      this.processingTimeHistory.shift();
    }
  }

  /**
   * Calculate variance and coefficient of variation
   */
  private calculateVariance(values: number[]): {
    variance: number;
    stdDev: number;
    coefficient: number;
  } {
    if (values.length === 0) {
      return { variance: 0, stdDev: 0, coefficient: 0 };
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const coefficient = mean !== 0 ? stdDev / mean : 0;

    return { variance, stdDev, coefficient };
  }

  /**
   * Get current strategy
   */
  getCurrentStrategy(): ProcessingStrategy {
    return { ...this.currentStrategy };
  }

  /**
   * Predict if content should be chunked based on characteristics
   */
  shouldEnableChunking(metrics: StreamMetrics): boolean {
    // Enable chunking for very long streams
    if (metrics.totalBytes > 50000) { // > 50KB
      return true;
    }

    // Enable if processing is slow and content is growing
    if (metrics.chunksPerSecond < 2 && metrics.totalBytes > 20000) {
      return true;
    }

    return false;
  }

  /**
   * Suggest optimal chunk size based on stream characteristics
   */
  suggestChunkSize(metrics: StreamMetrics): number {
    const avgChunkSize = metrics.averageChunkSize;

    // If chunks are small, suggest smaller memory chunks
    if (avgChunkSize < 50) {
      return 2000; // 2KB chunks
    }

    // If chunks are large, suggest larger memory chunks
    if (avgChunkSize > 200) {
      return 10000; // 10KB chunks
    }

    // Default
    return 5000; // 5KB chunks
  }

  /**
   * Determine if we should enable progressive fact extraction
   */
  shouldEnableProgressiveFacts(metrics: StreamMetrics): boolean {
    // Enable for slow, long streams where facts would be valuable early
    if (metrics.totalBytes > 2000 && metrics.chunksPerSecond < 5) {
      return true;
    }

    // Disable for very fast streams to reduce overhead
    if (metrics.chunksPerSecond > 15) {
      return false;
    }

    // Enable by default for medium streams
    return metrics.totalBytes > 1000;
  }

  /**
   * Get performance recommendations based on analysis
   */
  getRecommendations(metrics: StreamMetrics): string[] {
    const recommendations: string[] = [];

    // Chunking recommendation
    if (this.shouldEnableChunking(metrics)) {
      recommendations.push(
        `Enable chunked storage with ${this.suggestChunkSize(metrics)} char chunks`
      );
    }

    // Fact extraction recommendation
    if (!this.shouldEnableProgressiveFacts(metrics)) {
      recommendations.push(
        'Consider disabling progressive fact extraction to improve throughput'
      );
    }

    // Buffer size recommendation
    const streamType = this.detectStreamType(metrics);
    if (streamType === 'fast' && this.currentStrategy.bufferSize < 5) {
      recommendations.push(
        'Increase buffer size to improve batching efficiency'
      );
    }

    // Update interval recommendation
    if (metrics.partialUpdates > metrics.totalChunks / 2) {
      recommendations.push(
        'Reduce partial update frequency to lower database load'
      );
    }

    return recommendations;
  }

  /**
   * Reset processor state
   */
  reset(): void {
    this.chunkSizeHistory = [];
    this.processingTimeHistory = [];
    this.currentStrategy = this.getDefaultStrategy();
  }
}

/**
 * Helper to create an adaptive processor with sensible defaults
 */
export function createAdaptiveProcessor(): AdaptiveStreamProcessor {
  return new AdaptiveStreamProcessor();
}
