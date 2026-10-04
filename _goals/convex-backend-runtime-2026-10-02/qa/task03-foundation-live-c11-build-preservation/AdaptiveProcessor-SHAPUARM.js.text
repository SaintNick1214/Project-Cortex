import "./chunk-3RG5ZIWI.js";

// src/memory/streaming/AdaptiveProcessor.ts
var AdaptiveStreamProcessor = class {
  chunkSizeHistory = [];
  processingTimeHistory = [];
  currentStrategy;
  maxHistorySize = 50;
  constructor(initialStrategy) {
    this.currentStrategy = initialStrategy || this.getDefaultStrategy();
  }
  /**
   * Adjust processing strategy based on current metrics
   */
  async adjustProcessingStrategy(metrics, metricsCollector) {
    const streamType = metricsCollector.detectStreamType();
    const newStrategy = this.optimizeForType(streamType, metrics);
    if (this.hasStrategyChanged(newStrategy)) {
      this.currentStrategy = newStrategy;
    }
    return this.currentStrategy;
  }
  /**
   * Detect stream type based on metrics
   */
  detectStreamType(metrics) {
    const { chunksPerSecond, totalChunks } = metrics;
    if (chunksPerSecond > 10) {
      return "fast";
    }
    if (chunksPerSecond < 1 && totalChunks > 5) {
      return "slow";
    }
    const chunkStats = this.calculateVariance(this.chunkSizeHistory);
    if (chunkStats.coefficient > 0.5) {
      return "bursty";
    }
    return "steady";
  }
  /**
   * Optimize strategy for detected stream type
   */
  optimizeForType(streamType, metrics) {
    switch (streamType) {
      case "fast":
        return this.getFastStreamStrategy(metrics);
      case "slow":
        return this.getSlowStreamStrategy(metrics);
      case "bursty":
        return this.getBurstyStreamStrategy(metrics);
      case "steady":
        return this.getSteadyStreamStrategy(metrics);
      default:
        return this.getDefaultStrategy();
    }
  }
  /**
   * Strategy for fast streams - batch processing
   */
  getFastStreamStrategy(_metrics) {
    return {
      bufferSize: 10,
      // Buffer 10 chunks before processing
      factExtractionFrequency: 1e3,
      // Extract every 1000 chars
      partialUpdateInterval: 5e3,
      // Update every 5 seconds
      enablePredictiveLoading: true
    };
  }
  /**
   * Strategy for slow streams - immediate processing
   */
  getSlowStreamStrategy(_metrics) {
    return {
      bufferSize: 1,
      // Process immediately
      factExtractionFrequency: 300,
      // Extract every 300 chars
      partialUpdateInterval: 2e3,
      // Update every 2 seconds
      enablePredictiveLoading: false
    };
  }
  /**
   * Strategy for bursty streams - dynamic buffering
   */
  getBurstyStreamStrategy(_metrics) {
    return {
      bufferSize: 5,
      // Medium buffering
      factExtractionFrequency: 500,
      // Extract every 500 chars
      partialUpdateInterval: 3e3,
      // Update every 3 seconds
      enablePredictiveLoading: false
    };
  }
  /**
   * Strategy for steady streams - balanced approach
   */
  getSteadyStreamStrategy(_metrics) {
    return {
      bufferSize: 3,
      // Small buffer
      factExtractionFrequency: 500,
      // Extract every 500 chars
      partialUpdateInterval: 3e3,
      // Update every 3 seconds
      enablePredictiveLoading: true
    };
  }
  /**
   * Default processing strategy
   */
  getDefaultStrategy() {
    return {
      bufferSize: 1,
      factExtractionFrequency: 500,
      partialUpdateInterval: 3e3,
      enablePredictiveLoading: false
    };
  }
  /**
   * Check if strategy has meaningfully changed
   */
  hasStrategyChanged(newStrategy) {
    return newStrategy.bufferSize !== this.currentStrategy.bufferSize || newStrategy.factExtractionFrequency !== this.currentStrategy.factExtractionFrequency || newStrategy.partialUpdateInterval !== this.currentStrategy.partialUpdateInterval;
  }
  /**
   * Record chunk size for analysis
   */
  recordChunkSize(size) {
    this.chunkSizeHistory.push(size);
    if (this.chunkSizeHistory.length > this.maxHistorySize) {
      this.chunkSizeHistory.shift();
    }
  }
  /**
   * Record processing time for analysis
   */
  recordProcessingTime(timeMs) {
    this.processingTimeHistory.push(timeMs);
    if (this.processingTimeHistory.length > this.maxHistorySize) {
      this.processingTimeHistory.shift();
    }
  }
  /**
   * Calculate variance and coefficient of variation
   */
  calculateVariance(values) {
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
  getCurrentStrategy() {
    return { ...this.currentStrategy };
  }
  /**
   * Predict if content should be chunked based on characteristics
   */
  shouldEnableChunking(metrics) {
    if (metrics.totalBytes > 5e4) {
      return true;
    }
    if (metrics.chunksPerSecond < 2 && metrics.totalBytes > 2e4) {
      return true;
    }
    return false;
  }
  /**
   * Suggest optimal chunk size based on stream characteristics
   */
  suggestChunkSize(metrics) {
    const avgChunkSize = metrics.averageChunkSize;
    if (avgChunkSize < 50) {
      return 2e3;
    }
    if (avgChunkSize > 200) {
      return 1e4;
    }
    return 5e3;
  }
  /**
   * Determine if we should enable progressive fact extraction
   */
  shouldEnableProgressiveFacts(metrics) {
    if (metrics.totalBytes > 2e3 && metrics.chunksPerSecond < 5) {
      return true;
    }
    if (metrics.chunksPerSecond > 15) {
      return false;
    }
    return metrics.totalBytes > 1e3;
  }
  /**
   * Get performance recommendations based on analysis
   */
  getRecommendations(metrics) {
    const recommendations = [];
    if (this.shouldEnableChunking(metrics)) {
      recommendations.push(
        `Enable chunked storage with ${this.suggestChunkSize(metrics)} char chunks`
      );
    }
    if (!this.shouldEnableProgressiveFacts(metrics)) {
      recommendations.push(
        "Consider disabling progressive fact extraction to improve throughput"
      );
    }
    const streamType = this.detectStreamType(metrics);
    if (streamType === "fast" && this.currentStrategy.bufferSize < 5) {
      recommendations.push(
        "Increase buffer size to improve batching efficiency"
      );
    }
    if (metrics.partialUpdates > metrics.totalChunks / 2) {
      recommendations.push(
        "Reduce partial update frequency to lower database load"
      );
    }
    return recommendations;
  }
  /**
   * Reset processor state
   */
  reset() {
    this.chunkSizeHistory = [];
    this.processingTimeHistory = [];
    this.currentStrategy = this.getDefaultStrategy();
  }
};
function createAdaptiveProcessor() {
  return new AdaptiveStreamProcessor();
}
export {
  AdaptiveStreamProcessor,
  createAdaptiveProcessor
};
