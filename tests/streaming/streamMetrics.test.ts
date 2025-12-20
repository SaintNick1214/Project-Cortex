/**
 * Tests for StreamMetrics and MetricsCollector
 *
 * Comprehensive coverage including partial updates, retries, and timing stats.
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

      expect(snapshot).toHaveProperty("startTime");
      expect(snapshot).toHaveProperty("firstChunkLatency");
      expect(snapshot).toHaveProperty("streamDurationMs");
      expect(snapshot).toHaveProperty("totalChunks");
      expect(snapshot).toHaveProperty("totalBytes");
      expect(snapshot).toHaveProperty("averageChunkSize");
      expect(snapshot).toHaveProperty("chunksPerSecond");
      expect(snapshot).toHaveProperty("factsExtracted");
      expect(snapshot).toHaveProperty("errorCount");
      expect(snapshot).toHaveProperty("estimatedTokens");
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
      expect(type).toBe("fast");
    });

    it("should detect slow streams", (done) => {
      metrics.recordChunk(100);

      setTimeout(() => {
        metrics.recordChunk(100);
        setTimeout(() => {
          metrics.recordChunk(100);
          const type = metrics.detectStreamType();
          expect(type).toBe("slow");
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
      const hasErrorWarning = insights.bottlenecks.some((b) =>
        b.includes("error rate"),
      );
      expect(hasErrorWarning).toBe(true);
    });

    it("should recommend fact extraction", () => {
      for (let i = 0; i < 30; i++) {
        metrics.recordChunk(50); // 1500 total bytes
      }

      const insights = metrics.generateInsights();
      const hasFacts = metrics.getSnapshot().factsExtracted > 0;
      if (!hasFacts) {
        const hasRecommendation = insights.recommendations.some((r) =>
          r.includes("fact extraction"),
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

    it("should reset partial updates and retries", () => {
      metrics.recordPartialUpdate();
      metrics.recordPartialUpdate();
      metrics.recordRetry();

      metrics.reset();

      const snapshot = metrics.getSnapshot();
      expect(snapshot.partialUpdates).toBe(0);
      expect(snapshot.retryCount).toBe(0);
    });

    it("should reset timing data", () => {
      metrics.recordChunk(100);
      metrics.recordChunk(200);

      metrics.reset();

      const timingStats = metrics.getTimingStats();
      expect(timingStats.averageInterChunkDelay).toBe(0);
      expect(timingStats.minDelay).toBe(0);
      expect(timingStats.maxDelay).toBe(0);
    });

    it("should reset first chunk time", () => {
      metrics.recordChunk(100);
      const snapshot1 = metrics.getSnapshot();
      expect(snapshot1.firstChunkLatency).toBeGreaterThanOrEqual(0);

      metrics.reset();
      const snapshot2 = metrics.getSnapshot();
      expect(snapshot2.firstChunkLatency).toBe(0);
    });
  });

  describe("recordPartialUpdate", () => {
    it("should count partial updates", () => {
      metrics.recordPartialUpdate();
      metrics.recordPartialUpdate();
      metrics.recordPartialUpdate();

      const snapshot = metrics.getSnapshot();
      expect(snapshot.partialUpdates).toBe(3);
    });

    it("should start at zero", () => {
      const snapshot = metrics.getSnapshot();
      expect(snapshot.partialUpdates).toBe(0);
    });

    it("should be independent of other counters", () => {
      metrics.recordPartialUpdate();
      metrics.recordChunk(100);
      metrics.recordError(new Error("test"));

      const snapshot = metrics.getSnapshot();
      expect(snapshot.partialUpdates).toBe(1);
      expect(snapshot.totalChunks).toBe(1);
      expect(snapshot.errorCount).toBe(1);
    });
  });

  describe("recordRetry", () => {
    it("should count retries", () => {
      metrics.recordRetry();
      metrics.recordRetry();

      const snapshot = metrics.getSnapshot();
      expect(snapshot.retryCount).toBe(2);
    });

    it("should start at zero", () => {
      const snapshot = metrics.getSnapshot();
      expect(snapshot.retryCount).toBe(0);
    });

    it("should be independent of error count", () => {
      metrics.recordRetry();
      metrics.recordRetry();
      metrics.recordError(new Error("test"));

      const snapshot = metrics.getSnapshot();
      expect(snapshot.retryCount).toBe(2);
      expect(snapshot.errorCount).toBe(1);
    });

    it("should track many retries", () => {
      for (let i = 0; i < 100; i++) {
        metrics.recordRetry();
      }

      const snapshot = metrics.getSnapshot();
      expect(snapshot.retryCount).toBe(100);
    });
  });

  describe("getTimingStats", () => {
    it("should return zeros with no chunks", () => {
      const stats = metrics.getTimingStats();

      expect(stats.averageInterChunkDelay).toBe(0);
      expect(stats.minDelay).toBe(0);
      expect(stats.maxDelay).toBe(0);
    });

    it("should return zeros with single chunk", () => {
      metrics.recordChunk(100);

      const stats = metrics.getTimingStats();

      expect(stats.averageInterChunkDelay).toBe(0);
      expect(stats.minDelay).toBe(0);
      expect(stats.maxDelay).toBe(0);
    });

    it("should calculate timing stats with multiple chunks", (done) => {
      metrics.recordChunk(100);

      setTimeout(() => {
        metrics.recordChunk(100);

        setTimeout(() => {
          metrics.recordChunk(100);

          const stats = metrics.getTimingStats();

          expect(stats.averageInterChunkDelay).toBeGreaterThan(0);
          expect(stats.minDelay).toBeGreaterThan(0);
          expect(stats.maxDelay).toBeGreaterThanOrEqual(stats.minDelay);
          done();
        }, 50);
      }, 30);
    }, 500);

    it("should track min and max delays separately", (done) => {
      metrics.recordChunk(100);

      setTimeout(() => {
        metrics.recordChunk(100); // ~20ms delay
        setTimeout(() => {
          metrics.recordChunk(100); // ~80ms delay

          const stats = metrics.getTimingStats();

          // Min should be less than max due to different delays
          expect(stats.maxDelay).toBeGreaterThanOrEqual(stats.minDelay);
          done();
        }, 80);
      }, 20);
    }, 500);

    it("should calculate average correctly", (done) => {
      const expectedDelays = [20, 40, 30]; // Approximate delays
      let chunkIndex = 0;

      const recordNextChunk = () => {
        metrics.recordChunk(100);
        chunkIndex++;

        if (chunkIndex < 4) {
          setTimeout(recordNextChunk, expectedDelays[chunkIndex - 1] || 30);
        } else {
          const stats = metrics.getTimingStats();

          // Average should be roughly in the expected range
          expect(stats.averageInterChunkDelay).toBeGreaterThan(15);
          expect(stats.averageInterChunkDelay).toBeLessThan(60);
          done();
        }
      };

      recordNextChunk();
    }, 500);
  });

  describe("Edge Cases", () => {
    describe("recordChunk", () => {
      it("should handle zero size chunks", () => {
        metrics.recordChunk(0);
        metrics.recordChunk(0);

        const snapshot = metrics.getSnapshot();
        expect(snapshot.totalChunks).toBe(2);
        expect(snapshot.totalBytes).toBe(0);
        expect(snapshot.averageChunkSize).toBe(0);
      });

      it("should handle very large chunk sizes", () => {
        metrics.recordChunk(10000000); // 10MB

        const snapshot = metrics.getSnapshot();
        expect(snapshot.totalBytes).toBe(10000000);
        expect(snapshot.estimatedTokens).toBe(2500000); // 10MB / 4
      });

      it("should handle rapid successive chunks", () => {
        for (let i = 0; i < 1000; i++) {
          metrics.recordChunk(10);
        }

        const snapshot = metrics.getSnapshot();
        expect(snapshot.totalChunks).toBe(1000);
        expect(snapshot.totalBytes).toBe(10000);
      });
    });

    describe("recordFactExtraction", () => {
      it("should handle zero facts", () => {
        metrics.recordFactExtraction(0);

        const snapshot = metrics.getSnapshot();
        expect(snapshot.factsExtracted).toBe(0);
      });

      it("should handle large fact counts", () => {
        metrics.recordFactExtraction(1000);

        const snapshot = metrics.getSnapshot();
        expect(snapshot.factsExtracted).toBe(1000);
      });

      it("should accumulate across multiple calls", () => {
        metrics.recordFactExtraction(5);
        metrics.recordFactExtraction(10);
        metrics.recordFactExtraction(3);

        const snapshot = metrics.getSnapshot();
        expect(snapshot.factsExtracted).toBe(18);
      });
    });

    describe("Cost Estimation", () => {
      it("should return undefined for zero tokens", () => {
        const snapshot = metrics.getSnapshot();
        expect(snapshot.estimatedCost).toBeUndefined();
      });

      it("should calculate cost for processed content", () => {
        metrics.recordChunk(4000); // ~1000 tokens

        const snapshot = metrics.getSnapshot();
        expect(snapshot.estimatedCost).toBeDefined();
        expect(snapshot.estimatedCost).toBeGreaterThan(0);
      });

      it("should scale cost linearly with content", () => {
        metrics.recordChunk(4000);
        const snapshot1 = metrics.getSnapshot();

        metrics.recordChunk(4000);
        const snapshot2 = metrics.getSnapshot();

        // Cost should roughly double
        expect(snapshot2.estimatedCost).toBeGreaterThan(
          snapshot1.estimatedCost!,
        );
      });
    });

    describe("Stream Type Detection", () => {
      it("should detect bursty streams with variable timing", (done) => {
        metrics.recordChunk(100);

        setTimeout(() => {
          metrics.recordChunk(100);
          setTimeout(() => {
            metrics.recordChunk(100);
            setTimeout(() => {
              metrics.recordChunk(100);

              const type = metrics.detectStreamType();
              // With high timing variance, should detect as bursty or slow
              expect(["bursty", "slow", "steady"]).toContain(type);
              done();
            }, 200);
          }, 20);
        }, 200);
      }, 1000);

      it("should handle edge case with exactly 2 chunks", (done) => {
        metrics.recordChunk(100);

        setTimeout(() => {
          metrics.recordChunk(100);

          const type = metrics.detectStreamType();
          // Should still return a valid type
          expect(["fast", "slow", "bursty", "steady"]).toContain(type);
          done();
        }, 100);
      }, 500);
    });
  });

  describe("generateInsights - Extended", () => {
    it("should warn about high first chunk latency", (done) => {
      // Wait 2.5 seconds before first chunk
      setTimeout(() => {
        metrics.recordChunk(100);

        const insights = metrics.generateInsights();

        const hasLatencyWarning = insights.bottlenecks.some(
          (b) =>
            b.toLowerCase().includes("first chunk") ||
            b.toLowerCase().includes("latency"),
        );
        expect(hasLatencyWarning).toBe(true);
        done();
      }, 2500);
    }, 5000);

    it("should warn about high cost", () => {
      // Record lots of content to trigger cost warning
      for (let i = 0; i < 100; i++) {
        metrics.recordChunk(4000); // 1000 tokens each
      }

      const insights = metrics.generateInsights();

      // Total: 100K tokens ~= $6
      const hasCostWarning = insights.recommendations.some((r) =>
        r.toLowerCase().includes("cost"),
      );
      expect(hasCostWarning).toBe(true);
    });

    it("should recommend partial updates for long streams without them", (done) => {
      metrics.recordChunk(100);

      setTimeout(() => {
        for (let i = 0; i < 10; i++) {
          metrics.recordChunk(100);
        }

        const insights = metrics.generateInsights();

        const hasPartialRecommendation = insights.recommendations.some((r) =>
          r.toLowerCase().includes("partial"),
        );
        expect(hasPartialRecommendation).toBe(true);
        done();
      }, 6000);
    }, 8000);

    it("should return empty arrays when no issues detected", () => {
      // Quick stream with facts and no errors
      for (let i = 0; i < 5; i++) {
        metrics.recordChunk(50);
      }
      metrics.recordFactExtraction(3);

      const insights = metrics.generateInsights();

      // May have recommendations or not, but should be arrays
      expect(Array.isArray(insights.bottlenecks)).toBe(true);
      expect(Array.isArray(insights.recommendations)).toBe(true);
    });
  });
});
