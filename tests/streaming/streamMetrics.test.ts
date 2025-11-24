/**
 * Tests for StreamMetrics and MetricsCollector
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { MetricsCollector } from "../../src/memory/streaming/StreamMetrics";

describe("MetricsCollector", () => {
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector();
  });

  describe("recordChunk", () => {
    it("should record chunk sizes", () => {
      metrics.recordChunk(100);
      metrics.recordChunk(200);
      metrics.recordChunk(150);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalChunks).toBe(3);
      expect(snapshot.totalBytes).toBe(450);
      expect(snapshot.averageChunkSize).toBe(150);
    });

    it("should record first chunk latency", (done) => {
      setTimeout(() => {
        metrics.recordChunk(100);
        const snapshot = metrics.getSnapshot();
        expect(snapshot.firstChunkLatency).toBeGreaterThanOrEqual(0);
        done();
      }, 50);
    });

    it("should estimate tokens (1 token ≈ 4 chars)", () => {
      metrics.recordChunk(400); // ~100 tokens
      const snapshot = metrics.getSnapshot();
      expect(snapshot.estimatedTokens).toBe(100);
    });
  });

  describe("recordFactExtraction", () => {
    it("should track facts extracted", () => {
      metrics.recordFactExtraction(5);
      metrics.recordFactExtraction(3);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.factsExtracted).toBe(8);
    });
  });

  describe("recordError", () => {
    it("should count errors", () => {
      metrics.recordError(new Error("Test error 1"));
      metrics.recordError(new Error("Test error 2"));

      const snapshot = metrics.getSnapshot();
      expect(snapshot.errorCount).toBe(2);
    });
  });

  describe("getSnapshot", () => {
    it("should return complete metrics snapshot", () => {
      metrics.recordChunk(100);
      metrics.recordChunk(200);
      metrics.recordFactExtraction(3);
      metrics.recordError(new Error("Test"));

      const snapshot = metrics.getSnapshot();
      
      expect(snapshot).toHaveProperty('startTime');
      expect(snapshot).toHaveProperty('firstChunkLatency');
      expect(snapshot).toHaveProperty('streamDurationMs');
      expect(snapshot).toHaveProperty('totalChunks');
      expect(snapshot).toHaveProperty('totalBytes');
      expect(snapshot).toHaveProperty('averageChunkSize');
      expect(snapshot).toHaveProperty('chunksPerSecond');
      expect(snapshot).toHaveProperty('factsExtracted');
      expect(snapshot).toHaveProperty('errorCount');
      expect(snapshot).toHaveProperty('estimatedTokens');
    });

    it("should calculate chunks per second", (done) => {
      metrics.recordChunk(100);
      
      setTimeout(() => {
        metrics.recordChunk(100);
        const snapshot = metrics.getSnapshot();
        expect(snapshot.chunksPerSecond).toBeGreaterThan(0);
        done();
      }, 100);
    });
  });

  describe("getChunkStats", () => {
    it("should calculate chunk statistics", () => {
      metrics.recordChunk(100);
      metrics.recordChunk(200);
      metrics.recordChunk(150);
      metrics.recordChunk(250);

      const stats = metrics.getChunkStats();
      expect(stats.min).toBe(100);
      expect(stats.max).toBe(250);
      // Median of [100, 150, 200, 250] is 200 (element at index 2 when sorted)
      expect(stats.median).toBe(200);
      expect(stats.stdDev).toBeGreaterThan(0);
    });

    it("should handle empty chunks", () => {
      const stats = metrics.getChunkStats();
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.stdDev).toBe(0);
    });
  });

  describe("detectStreamType", () => {
    it("should detect fast streams", () => {
      // Simulate fast stream: many chunks quickly
      for (let i = 0; i < 20; i++) {
        metrics.recordChunk(50);
      }
      
      const type = metrics.detectStreamType();
      expect(type).toBe('fast');
    });

    it("should detect slow streams", (done) => {
      metrics.recordChunk(100);
      
      setTimeout(() => {
        metrics.recordChunk(100);
        setTimeout(() => {
          metrics.recordChunk(100);
          const type = metrics.detectStreamType();
          expect(type).toBe('slow');
          done();
        }, 600);
      }, 600);
    }, 2000);
  });

  describe("generateInsights", () => {
    it("should recommend progressive storage for long streams", (done) => {
      // Simulate long slow stream
      metrics.recordChunk(100);
      
      setTimeout(() => {
        for (let i = 0; i < 5; i++) {
          metrics.recordChunk(100);
        }
        
        const insights = metrics.generateInsights();
        expect(insights.recommendations.length).toBeGreaterThan(0);
        done();
      }, 6000);
    }, 7000);

    it("should detect high error rate", () => {
      for (let i = 0; i < 10; i++) {
        metrics.recordChunk(100);
        if (i % 3 === 0) {
          metrics.recordError(new Error("Test"));
        }
      }

      const insights = metrics.generateInsights();
      const hasErrorWarning = insights.bottlenecks.some(b => b.includes('error rate'));
      expect(hasErrorWarning).toBe(true);
    });

    it("should recommend fact extraction", () => {
      for (let i = 0; i < 30; i++) {
        metrics.recordChunk(50); // 1500 total bytes
      }

      const insights = metrics.generateInsights();
      const hasFacts = metrics.getSnapshot().factsExtracted > 0;
      if (!hasFacts) {
        const hasRecommendation = insights.recommendations.some(r => 
          r.includes('fact extraction')
        );
        expect(hasRecommendation).toBe(true);
      }
    });
  });

  describe("reset", () => {
    it("should reset all metrics", () => {
      metrics.recordChunk(100);
      metrics.recordFactExtraction(5);
      metrics.recordError(new Error("Test"));

      metrics.reset();

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalChunks).toBe(0);
      expect(snapshot.totalBytes).toBe(0);
      expect(snapshot.factsExtracted).toBe(0);
      expect(snapshot.errorCount).toBe(0);
    });
  });
});
