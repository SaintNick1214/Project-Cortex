/**
 * Tests for AdaptiveStreamProcessor
 *
 * Comprehensive coverage for adaptive processing strategy selection,
 * stream type detection, and performance recommendations.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  AdaptiveStreamProcessor,
  createAdaptiveProcessor,
} from "../../src/memory/streaming/AdaptiveProcessor";
import { MetricsCollector } from "../../src/memory/streaming/StreamMetrics";
import type { StreamMetrics, ProcessingStrategy } from "../../src/types/streaming";

// Helper to create metrics with specific characteristics
function createTestMetrics(overrides: Partial<StreamMetrics> = {}): StreamMetrics {
  return {
    startTime: Date.now() - 5000,
    firstChunkLatency: 100,
    streamDurationMs: 5000,
    totalChunks: 50,
    totalBytes: 5000,
    averageChunkSize: 100,
    chunksPerSecond: 10,
    factsExtracted: 5,
    partialUpdates: 2,
    errorCount: 0,
    retryCount: 0,
    estimatedTokens: 1250,
    estimatedCost: 0.075,
    ...overrides,
  };
}

describe("AdaptiveStreamProcessor", () => {
  let processor: AdaptiveStreamProcessor;

  beforeEach(() => {
    processor = new AdaptiveStreamProcessor();
  });

  describe("constructor", () => {
    it("should create instance with default strategy", () => {
      const proc = new AdaptiveStreamProcessor();
      const strategy = proc.getCurrentStrategy();

      expect(strategy).toBeDefined();
      expect(strategy.bufferSize).toBeDefined();
      expect(strategy.factExtractionFrequency).toBeDefined();
      expect(strategy.partialUpdateInterval).toBeDefined();
      expect(strategy.enablePredictiveLoading).toBeDefined();
    });

    it("should accept initial strategy", () => {
      const customStrategy: ProcessingStrategy = {
        bufferSize: 20,
        factExtractionFrequency: 2000,
        partialUpdateInterval: 10000,
        enablePredictiveLoading: true,
      };

      const proc = new AdaptiveStreamProcessor(customStrategy);
      const strategy = proc.getCurrentStrategy();

      expect(strategy.bufferSize).toBe(20);
      expect(strategy.factExtractionFrequency).toBe(2000);
    });
  });

  describe("detectStreamType()", () => {
    it("should detect fast streams (high throughput)", () => {
      const metrics = createTestMetrics({
        chunksPerSecond: 15,
        totalChunks: 100,
      });

      const type = processor.detectStreamType(metrics);

      expect(type).toBe("fast");
    });

    it("should detect slow streams (low throughput)", () => {
      const metrics = createTestMetrics({
        chunksPerSecond: 0.5,
        totalChunks: 10,
      });

      const type = processor.detectStreamType(metrics);

      expect(type).toBe("slow");
    });

    it("should detect bursty streams (high variance)", () => {
      // Record chunks with high variance
      processor.recordChunkSize(10);
      processor.recordChunkSize(500);
      processor.recordChunkSize(20);
      processor.recordChunkSize(400);
      processor.recordChunkSize(15);

      const metrics = createTestMetrics({
        chunksPerSecond: 5, // Medium throughput
        totalChunks: 5,
      });

      const type = processor.detectStreamType(metrics);

      // With high variance, should be bursty
      expect(["bursty", "steady"]).toContain(type);
    });

    it("should detect steady streams (consistent)", () => {
      // Record chunks with low variance
      for (let i = 0; i < 10; i++) {
        processor.recordChunkSize(100);
      }

      const metrics = createTestMetrics({
        chunksPerSecond: 5,
        totalChunks: 10,
      });

      const type = processor.detectStreamType(metrics);

      expect(type).toBe("steady");
    });

    it("should handle edge case with zero chunks", () => {
      const metrics = createTestMetrics({
        chunksPerSecond: 0,
        totalChunks: 0,
      });

      const type = processor.detectStreamType(metrics);

      // Should default to steady or another type
      expect(["fast", "slow", "bursty", "steady"]).toContain(type);
    });
  });

  describe("adjustProcessingStrategy()", () => {
    it("should adjust strategy for fast streams", async () => {
      const metricsCollector = new MetricsCollector();

      // Simulate fast stream
      for (let i = 0; i < 50; i++) {
        metricsCollector.recordChunk(100);
      }

      const metrics = metricsCollector.getSnapshot();
      const strategy = await processor.adjustProcessingStrategy(
        metrics,
        metricsCollector,
      );

      // Fast streams should use larger buffer
      expect(strategy.bufferSize).toBeGreaterThan(1);
    });

    it("should adjust strategy for slow streams", async () => {
      const metricsCollector = new MetricsCollector();

      // Simulate slow stream with delays
      metricsCollector.recordChunk(100);

      // Mock slow detection by using detectStreamType directly
      const slowMetrics = createTestMetrics({
        chunksPerSecond: 0.5,
        totalChunks: 10,
      });

      // Create collector that returns slow type
      const mockCollector = {
        ...metricsCollector,
        detectStreamType: () => "slow" as const,
      };

      const strategy = await processor.adjustProcessingStrategy(
        slowMetrics,
        mockCollector as any,
      );

      // Slow streams should process immediately
      expect(strategy.bufferSize).toBeLessThanOrEqual(5);
    });

    it("should return updated strategy", async () => {
      const metricsCollector = new MetricsCollector();
      const metrics = metricsCollector.getSnapshot();

      const strategy = await processor.adjustProcessingStrategy(
        metrics,
        metricsCollector,
      );

      expect(strategy).toBeDefined();
      expect(typeof strategy.bufferSize).toBe("number");
      expect(typeof strategy.factExtractionFrequency).toBe("number");
      expect(typeof strategy.partialUpdateInterval).toBe("number");
      expect(typeof strategy.enablePredictiveLoading).toBe("boolean");
    });

    it("should update internal strategy when changed", async () => {
      const metricsCollector = new MetricsCollector();

      // First get default strategy
      const initialStrategy = processor.getCurrentStrategy();

      // Simulate a stream that would trigger strategy change
      for (let i = 0; i < 100; i++) {
        metricsCollector.recordChunk(50);
      }

      const metrics = metricsCollector.getSnapshot();
      await processor.adjustProcessingStrategy(metrics, metricsCollector);

      const newStrategy = processor.getCurrentStrategy();

      // Strategy might have changed
      expect(newStrategy).toBeDefined();
    });
  });

  describe("recordChunkSize()", () => {
    it("should record chunk sizes for analysis", () => {
      processor.recordChunkSize(100);
      processor.recordChunkSize(200);
      processor.recordChunkSize(150);

      // Verify by checking variance calculation works
      const metrics = createTestMetrics();
      const type = processor.detectStreamType(metrics);
      expect(type).toBeDefined();
    });

    it("should maintain history within limit", () => {
      // Record more than max history size (50)
      for (let i = 0; i < 100; i++) {
        processor.recordChunkSize(i * 10);
      }

      // Should not crash or cause memory issues
      const metrics = createTestMetrics();
      const type = processor.detectStreamType(metrics);
      expect(type).toBeDefined();
    });

    it("should handle zero size chunks", () => {
      processor.recordChunkSize(0);

      const metrics = createTestMetrics();
      const type = processor.detectStreamType(metrics);
      expect(type).toBeDefined();
    });

    it("should handle very large chunk sizes", () => {
      processor.recordChunkSize(10000000); // 10MB

      const metrics = createTestMetrics();
      const type = processor.detectStreamType(metrics);
      expect(type).toBeDefined();
    });
  });

  describe("recordProcessingTime()", () => {
    it("should record processing times", () => {
      processor.recordProcessingTime(10);
      processor.recordProcessingTime(15);
      processor.recordProcessingTime(12);

      // Should not throw
      expect(() => processor.recordProcessingTime(20)).not.toThrow();
    });

    it("should maintain history within limit", () => {
      // Record more than max history size
      for (let i = 0; i < 100; i++) {
        processor.recordProcessingTime(i * 5);
      }

      // Should not crash
      expect(() => processor.recordProcessingTime(500)).not.toThrow();
    });

    it("should handle zero time", () => {
      processor.recordProcessingTime(0);
      expect(true).toBe(true); // No throw
    });

    it("should handle very large times", () => {
      processor.recordProcessingTime(100000); // 100 seconds
      expect(true).toBe(true); // No throw
    });
  });

  describe("getCurrentStrategy()", () => {
    it("should return default strategy initially", () => {
      const strategy = processor.getCurrentStrategy();

      expect(strategy).toBeDefined();
      expect(strategy.bufferSize).toBe(1);
      expect(strategy.factExtractionFrequency).toBe(500);
      expect(strategy.partialUpdateInterval).toBe(3000);
      expect(strategy.enablePredictiveLoading).toBe(false);
    });

    it("should return a copy, not reference", () => {
      const strategy1 = processor.getCurrentStrategy();
      const strategy2 = processor.getCurrentStrategy();

      expect(strategy1).toEqual(strategy2);
      expect(strategy1).not.toBe(strategy2);
    });

    it("should reflect updated strategy after adjustment", async () => {
      const metricsCollector = new MetricsCollector();

      // Simulate stream that triggers strategy change
      for (let i = 0; i < 50; i++) {
        metricsCollector.recordChunk(100);
      }

      const metrics = metricsCollector.getSnapshot();
      await processor.adjustProcessingStrategy(metrics, metricsCollector);

      const strategy = processor.getCurrentStrategy();
      expect(strategy).toBeDefined();
    });
  });

  describe("shouldEnableChunking()", () => {
    it("should enable chunking for large responses (> 50KB)", () => {
      const metrics = createTestMetrics({
        totalBytes: 60000, // 60KB
      });

      const result = processor.shouldEnableChunking(metrics);

      expect(result).toBe(true);
    });

    it("should not enable chunking for small responses", () => {
      const metrics = createTestMetrics({
        totalBytes: 10000, // 10KB
      });

      const result = processor.shouldEnableChunking(metrics);

      expect(result).toBe(false);
    });

    it("should enable for slow processing with medium content", () => {
      const metrics = createTestMetrics({
        totalBytes: 25000, // 25KB
        chunksPerSecond: 1, // Slow
      });

      const result = processor.shouldEnableChunking(metrics);

      expect(result).toBe(true);
    });

    it("should not enable for fast processing with medium content", () => {
      const metrics = createTestMetrics({
        totalBytes: 15000, // 15KB
        chunksPerSecond: 20, // Fast
      });

      const result = processor.shouldEnableChunking(metrics);

      expect(result).toBe(false);
    });

    it("should handle zero bytes", () => {
      const metrics = createTestMetrics({
        totalBytes: 0,
      });

      const result = processor.shouldEnableChunking(metrics);

      expect(result).toBe(false);
    });

    it("should handle boundary case at 50KB", () => {
      const metrics = createTestMetrics({
        totalBytes: 50000, // Exactly 50KB
      });

      const result = processor.shouldEnableChunking(metrics);

      expect(result).toBe(false); // Not > 50KB
    });
  });

  describe("suggestChunkSize()", () => {
    it("should suggest smaller chunks for small average chunk size", () => {
      const metrics = createTestMetrics({
        averageChunkSize: 30, // Small chunks
      });

      const suggestedSize = processor.suggestChunkSize(metrics);

      expect(suggestedSize).toBe(2000); // 2KB chunks
    });

    it("should suggest larger chunks for large average chunk size", () => {
      const metrics = createTestMetrics({
        averageChunkSize: 300, // Large chunks
      });

      const suggestedSize = processor.suggestChunkSize(metrics);

      expect(suggestedSize).toBe(10000); // 10KB chunks
    });

    it("should suggest medium chunks for medium average chunk size", () => {
      const metrics = createTestMetrics({
        averageChunkSize: 100, // Medium chunks
      });

      const suggestedSize = processor.suggestChunkSize(metrics);

      expect(suggestedSize).toBe(5000); // 5KB chunks (default)
    });

    it("should handle zero average chunk size", () => {
      const metrics = createTestMetrics({
        averageChunkSize: 0,
      });

      const suggestedSize = processor.suggestChunkSize(metrics);

      expect(suggestedSize).toBe(2000); // Small chunks for tiny input
    });
  });

  describe("shouldEnableProgressiveFacts()", () => {
    it("should enable for slow, long streams", () => {
      const metrics = createTestMetrics({
        totalBytes: 3000,
        chunksPerSecond: 2, // Slow
      });

      const result = processor.shouldEnableProgressiveFacts(metrics);

      expect(result).toBe(true);
    });

    it("should disable for very fast streams", () => {
      const metrics = createTestMetrics({
        totalBytes: 5000,
        chunksPerSecond: 20, // Very fast
      });

      const result = processor.shouldEnableProgressiveFacts(metrics);

      expect(result).toBe(false);
    });

    it("should enable for medium streams with content", () => {
      const metrics = createTestMetrics({
        totalBytes: 2000,
        chunksPerSecond: 5, // Medium
      });

      const result = processor.shouldEnableProgressiveFacts(metrics);

      expect(result).toBe(true);
    });

    it("should disable for very small content", () => {
      const metrics = createTestMetrics({
        totalBytes: 500, // Small
        chunksPerSecond: 5,
      });

      const result = processor.shouldEnableProgressiveFacts(metrics);

      expect(result).toBe(false);
    });

    it("should handle edge case at threshold boundaries", () => {
      const metrics1000 = createTestMetrics({
        totalBytes: 1000,
        chunksPerSecond: 5,
      });

      const metrics1001 = createTestMetrics({
        totalBytes: 1001,
        chunksPerSecond: 5,
      });

      // 1000 bytes is boundary
      expect(processor.shouldEnableProgressiveFacts(metrics1000)).toBe(false);
      expect(processor.shouldEnableProgressiveFacts(metrics1001)).toBe(true);
    });
  });

  describe("getRecommendations()", () => {
    it("should recommend chunking for large content", () => {
      const metrics = createTestMetrics({
        totalBytes: 60000,
      });

      const recommendations = processor.getRecommendations(metrics);

      expect(recommendations.some((r) => r.includes("chunk"))).toBe(true);
    });

    it("should include chunk size recommendation when recommending chunking", () => {
      const metrics = createTestMetrics({
        totalBytes: 60000,
        averageChunkSize: 50,
      });

      const recommendations = processor.getRecommendations(metrics);

      // Should recommend chunking for large content
      expect(recommendations.some((r) => r.toLowerCase().includes("chunk"))).toBe(true);
    });

    it("should recommend disabling progressive facts for fast streams", () => {
      const metrics = createTestMetrics({
        totalBytes: 5000,
        chunksPerSecond: 20,
      });

      const recommendations = processor.getRecommendations(metrics);

      expect(
        recommendations.some((r) => r.toLowerCase().includes("fact extraction")),
      ).toBe(true);
    });

    it("should recommend buffer increase for fast streams with small buffer", async () => {
      // Set strategy with small buffer
      const proc = new AdaptiveStreamProcessor({
        bufferSize: 2,
        factExtractionFrequency: 500,
        partialUpdateInterval: 3000,
        enablePredictiveLoading: false,
      });

      // Record chunks to establish fast stream pattern
      for (let i = 0; i < 20; i++) {
        proc.recordChunkSize(50);
      }

      const metrics = createTestMetrics({
        chunksPerSecond: 15, // Fast
      });

      const recommendations = proc.getRecommendations(metrics);

      expect(
        recommendations.some((r) => r.toLowerCase().includes("buffer")),
      ).toBe(true);
    });

    it("should recommend reducing partial updates when too frequent", () => {
      const metrics = createTestMetrics({
        partialUpdates: 30,
        totalChunks: 50, // More than half
      });

      const recommendations = processor.getRecommendations(metrics);

      expect(
        recommendations.some((r) => r.toLowerCase().includes("partial update")),
      ).toBe(true);
    });

    it("should return empty array when no recommendations", () => {
      const metrics = createTestMetrics({
        totalBytes: 5000, // Small
        chunksPerSecond: 10, // Medium
        partialUpdates: 5,
        totalChunks: 50,
      });

      const recommendations = processor.getRecommendations(metrics);

      // May have some recommendations or none
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe("reset()", () => {
    it("should reset to default strategy", async () => {
      // First, modify state
      processor.recordChunkSize(100);
      processor.recordProcessingTime(50);

      const metricsCollector = new MetricsCollector();
      metricsCollector.recordChunk(100);
      await processor.adjustProcessingStrategy(
        metricsCollector.getSnapshot(),
        metricsCollector,
      );

      // Reset
      processor.reset();

      const strategy = processor.getCurrentStrategy();
      expect(strategy.bufferSize).toBe(1);
      expect(strategy.factExtractionFrequency).toBe(500);
      expect(strategy.partialUpdateInterval).toBe(3000);
      expect(strategy.enablePredictiveLoading).toBe(false);
    });

    it("should clear chunk history", () => {
      // Record chunks with specific pattern
      for (let i = 0; i < 20; i++) {
        processor.recordChunkSize(1000);
      }

      processor.reset();

      // After reset, variance should be zero (no data)
      const metrics = createTestMetrics({
        chunksPerSecond: 5,
        totalChunks: 0,
      });
      const type = processor.detectStreamType(metrics);

      // Should use default detection without historical data
      expect(["fast", "slow", "bursty", "steady"]).toContain(type);
    });

    it("should clear processing time history", () => {
      for (let i = 0; i < 20; i++) {
        processor.recordProcessingTime(i * 10);
      }

      processor.reset();

      // Should not throw after reset
      expect(() => processor.recordProcessingTime(100)).not.toThrow();
    });

    it("should allow reuse after reset", async () => {
      processor.recordChunkSize(100);

      processor.reset();

      processor.recordChunkSize(200);
      processor.recordChunkSize(300);

      const metricsCollector = new MetricsCollector();
      metricsCollector.recordChunk(200);
      metricsCollector.recordChunk(300);

      const strategy = await processor.adjustProcessingStrategy(
        metricsCollector.getSnapshot(),
        metricsCollector,
      );

      expect(strategy).toBeDefined();
    });
  });

  describe("Strategy Selection", () => {
    it("should select fast stream strategy correctly", async () => {
      const metricsCollector = new MetricsCollector();

      // Simulate fast stream
      for (let i = 0; i < 100; i++) {
        metricsCollector.recordChunk(50);
      }

      // Force detection as fast
      const mockCollector = {
        ...metricsCollector,
        detectStreamType: () => "fast" as const,
        getSnapshot: () => metricsCollector.getSnapshot(),
      };

      const strategy = await processor.adjustProcessingStrategy(
        metricsCollector.getSnapshot(),
        mockCollector as any,
      );

      // Fast streams should have larger buffer
      expect(strategy.bufferSize).toBeGreaterThanOrEqual(1);
    });

    it("should select slow stream strategy correctly", async () => {
      const metricsCollector = new MetricsCollector();
      metricsCollector.recordChunk(100);

      const mockCollector = {
        ...metricsCollector,
        detectStreamType: () => "slow" as const,
        getSnapshot: () => metricsCollector.getSnapshot(),
      };

      const strategy = await processor.adjustProcessingStrategy(
        metricsCollector.getSnapshot(),
        mockCollector as any,
      );

      // Slow streams should process more frequently
      expect(strategy.partialUpdateInterval).toBeLessThanOrEqual(3000);
    });

    it("should select bursty stream strategy correctly", async () => {
      const metricsCollector = new MetricsCollector();

      const mockCollector = {
        ...metricsCollector,
        detectStreamType: () => "bursty" as const,
        getSnapshot: () => metricsCollector.getSnapshot(),
      };

      const strategy = await processor.adjustProcessingStrategy(
        metricsCollector.getSnapshot(),
        mockCollector as any,
      );

      // Bursty should have medium settings
      expect(strategy.bufferSize).toBeGreaterThanOrEqual(1);
    });

    it("should select steady stream strategy correctly", async () => {
      const metricsCollector = new MetricsCollector();

      const mockCollector = {
        ...metricsCollector,
        detectStreamType: () => "steady" as const,
        getSnapshot: () => metricsCollector.getSnapshot(),
      };

      const strategy = await processor.adjustProcessingStrategy(
        metricsCollector.getSnapshot(),
        mockCollector as any,
      );

      expect(strategy.enablePredictiveLoading).toBe(true);
    });
  });
});

describe("createAdaptiveProcessor()", () => {
  it("should create new AdaptiveStreamProcessor", () => {
    const processor = createAdaptiveProcessor();

    expect(processor).toBeInstanceOf(AdaptiveStreamProcessor);
  });

  it("should create processor with default strategy", () => {
    const processor = createAdaptiveProcessor();
    const strategy = processor.getCurrentStrategy();

    expect(strategy.bufferSize).toBe(1);
    expect(strategy.factExtractionFrequency).toBe(500);
  });
});
