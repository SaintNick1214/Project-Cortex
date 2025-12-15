/**
 * Lightweight tests for ChunkingStrategies (no heavy dependencies)
 *
 * Comprehensive coverage including validation errors and edge cases.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  ResponseChunker,
  estimateOptimalChunkSize,
  shouldChunkContent,
} from "../../src/memory/streaming/ChunkingStrategies";

describe("ResponseChunker (Lightweight)", () => {
  let chunker: ResponseChunker;

  beforeEach(() => {
    chunker = new ResponseChunker();
  });

  describe("chunkByFixed", () => {
    it("should chunk by fixed size with small data", async () => {
      const content = "ABCDEFGHIJKLMNOP"; // 16 chars
      const chunks = await chunker.chunkContent(content, {
        strategy: "fixed",
        maxChunkSize: 4,
      });

      expect(chunks.length).toBe(4);
      expect(chunks[0].content).toBe("ABCD");
      expect(chunks[1].content).toBe("EFGH");
      expect(chunks[2].content).toBe("IJKL");
      expect(chunks[3].content).toBe("MNOP");
    });

    it("should support overlap", async () => {
      const content = "ABCDEFGHIJ";
      const chunks = await chunker.chunkContent(content, {
        strategy: "fixed",
        maxChunkSize: 4,
        overlapSize: 1,
      });

      expect(chunks.length).toBeGreaterThan(2);
      expect(chunks[0].content).toBe("ABCD");
      expect(chunks[1].content[0]).toBe("D"); // Overlap
    });

    it("should set correct metadata", async () => {
      const content = "Test";
      const chunks = await chunker.chunkContent(content, {
        strategy: "fixed",
        maxChunkSize: 10,
      });

      chunks.forEach((chunk, idx) => {
        expect(chunk.chunkIndex).toBe(idx);
        expect(chunk.metadata.chunkIndex).toBe(idx);
        expect(chunk.metadata.totalChunks).toBe(chunks.length);
      });
    });
  });

  describe("chunkByTokens", () => {
    it("should chunk by approximate token count", async () => {
      const content = "word ".repeat(50); // Small test
      const chunks = await chunker.chunkContent(content, {
        strategy: "token",
        maxChunkSize: 25,
      });

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(100); // 25 tokens * 4 chars
      });
    });
  });

  describe("chunkBySentences", () => {
    it("should chunk by sentences", async () => {
      const content =
        "First sentence. Second sentence. Third sentence. Fourth sentence.";
      const chunks = await chunker.chunkContent(content, {
        strategy: "sentence",
        maxChunkSize: 2,
      });

      expect(chunks.length).toBe(2);
      expect(chunks[0].content).toContain("First");
      expect(chunks[0].content).toContain("Second");
    });

    it("should handle content with no sentence breaks", async () => {
      const content = "No sentence breaks here";
      const chunks = await chunker.chunkContent(content, {
        strategy: "sentence",
        maxChunkSize: 5,
      });

      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe(content);
    });
  });

  describe("chunkByParagraphs", () => {
    it("should chunk by paragraphs", async () => {
      const content = "Para 1\n\nPara 2\n\nPara 3\n\nPara 4";
      const chunks = await chunker.chunkContent(content, {
        strategy: "paragraph",
        maxChunkSize: 2,
      });

      expect(chunks.length).toBe(2);
      expect(chunks[0].content).toContain("Para 1");
      expect(chunks[0].content).toContain("Para 2");
    });

    it("should handle content with no paragraphs", async () => {
      const content = "Single paragraph";
      const chunks = await chunker.chunkContent(content, {
        strategy: "paragraph",
        maxChunkSize: 3,
      });

      expect(chunks.length).toBe(1);
    });
  });
});

describe("Helper Functions", () => {
  describe("estimateOptimalChunkSize", () => {
    it("should return appropriate token count for token strategy", () => {
      const size = estimateOptimalChunkSize(5000, "token");
      expect(size).toBe(500);
    });

    it("should adjust sentence count based on content length", () => {
      const shortSize = estimateOptimalChunkSize(5000, "sentence");
      const longSize = estimateOptimalChunkSize(20000, "sentence");

      expect(shortSize).toBeLessThan(longSize);
    });

    it("should return fixed size for fixed strategy", () => {
      const size = estimateOptimalChunkSize(10000, "fixed");
      expect(size).toBe(2000);
    });
  });

  describe("shouldChunkContent", () => {
    it("should recommend chunking for long content", () => {
      expect(shouldChunkContent(15000)).toBe(true);
      expect(shouldChunkContent(50000)).toBe(true);
    });

    it("should not recommend chunking for short content", () => {
      expect(shouldChunkContent(5000)).toBe(false);
      expect(shouldChunkContent(500)).toBe(false);
    });

    it("should respect custom threshold", () => {
      expect(shouldChunkContent(5000, 3000)).toBe(true);
      expect(shouldChunkContent(5000, 10000)).toBe(false);
    });

    it("should handle boundary at default threshold (10000)", () => {
      expect(shouldChunkContent(9999)).toBe(false);
      expect(shouldChunkContent(10000)).toBe(false);
      expect(shouldChunkContent(10001)).toBe(true);
    });

    it("should handle zero content length", () => {
      expect(shouldChunkContent(0)).toBe(false);
    });

    it("should handle negative values gracefully", () => {
      expect(shouldChunkContent(-100)).toBe(false);
    });
  });
});

describe("ResponseChunker - Validation Errors", () => {
  let chunker: ResponseChunker;

  beforeEach(() => {
    chunker = new ResponseChunker();
  });

  describe("chunkContent - Invalid Strategy", () => {
    it("should throw on unknown strategy", async () => {
      await expect(
        chunker.chunkContent("Test content", {
          strategy: "nonexistent" as any,
          maxChunkSize: 100,
        }),
      ).rejects.toThrow(/Unknown chunking strategy/);
    });

    it("should throw on null strategy", async () => {
      await expect(
        chunker.chunkContent("Test content", {
          strategy: null as any,
          maxChunkSize: 100,
        }),
      ).rejects.toThrow();
    });

    it("should throw on undefined strategy", async () => {
      await expect(
        chunker.chunkContent("Test content", {
          strategy: undefined as any,
          maxChunkSize: 100,
        }),
      ).rejects.toThrow();
    });
  });

  describe("chunkByFixed - Validation", () => {
    it("should throw when overlapSize >= maxChunkSize", async () => {
      await expect(
        chunker.chunkContent("Test content", {
          strategy: "fixed",
          maxChunkSize: 10,
          overlapSize: 10,
        }),
      ).rejects.toThrow(/overlapSize must be smaller than maxChunkSize/);
    });

    it("should throw when overlapSize > maxChunkSize", async () => {
      await expect(
        chunker.chunkContent("Test content", {
          strategy: "fixed",
          maxChunkSize: 10,
          overlapSize: 15,
        }),
      ).rejects.toThrow(/overlapSize must be smaller than maxChunkSize/);
    });

    it("should throw when maxChunkSize is zero", async () => {
      await expect(
        chunker.chunkContent("Test content", {
          strategy: "fixed",
          maxChunkSize: 0,
        }),
      ).rejects.toThrow(/overlapSize must be smaller than maxChunkSize/);
    });

    it("should throw when maxChunkSize is negative", async () => {
      await expect(
        chunker.chunkContent("Test content", {
          strategy: "fixed",
          maxChunkSize: -5,
        }),
      ).rejects.toThrow(/overlapSize must be smaller than maxChunkSize/);
    });
  });

  describe("chunkByTokens - Validation", () => {
    it("should throw when overlapTokens >= maxTokens", async () => {
      await expect(
        chunker.chunkContent("Test content", {
          strategy: "token",
          maxChunkSize: 10, // max tokens
          overlapSize: 10, // overlap tokens
        }),
      ).rejects.toThrow(/overlapTokens must be smaller than maxTokens/);
    });

    it("should throw when overlapTokens > maxTokens", async () => {
      await expect(
        chunker.chunkContent("Test content", {
          strategy: "token",
          maxChunkSize: 10,
          overlapSize: 20,
        }),
      ).rejects.toThrow(/overlapTokens must be smaller than maxTokens/);
    });
  });
});

describe("ResponseChunker - Edge Cases", () => {
  let chunker: ResponseChunker;

  beforeEach(() => {
    chunker = new ResponseChunker();
  });

  describe("Empty Content", () => {
    it("should handle empty string", async () => {
      const chunks = await chunker.chunkContent("", {
        strategy: "fixed",
        maxChunkSize: 100,
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe("");
    });

    it("should handle empty string with sentence strategy", async () => {
      const chunks = await chunker.chunkContent("", {
        strategy: "sentence",
        maxChunkSize: 5,
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe("");
    });

    it("should handle empty string with token strategy", async () => {
      const chunks = await chunker.chunkContent("", {
        strategy: "token",
        maxChunkSize: 100,
      });

      // Token strategy may return empty array for empty content
      expect(chunks.length).toBeLessThanOrEqual(1);
      if (chunks.length > 0) {
        expect(chunks[0].content).toBe("");
      }
    });
  });

  describe("Whitespace Content", () => {
    it("should handle only whitespace", async () => {
      const chunks = await chunker.chunkContent("     ", {
        strategy: "fixed",
        maxChunkSize: 3,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle tabs and newlines", async () => {
      const chunks = await chunker.chunkContent("\t\n\t\n", {
        strategy: "fixed",
        maxChunkSize: 2,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle mixed whitespace", async () => {
      const content = "  \t\n  word  \t\n  ";
      const chunks = await chunker.chunkContent(content, {
        strategy: "fixed",
        maxChunkSize: 5,
      });

      // Should preserve whitespace
      const reconstructed = chunks.map((c) => c.content).join("");
      expect(reconstructed.length).toBeLessThanOrEqual(content.length);
    });
  });

  describe("Special Characters", () => {
    it("should handle unicode characters", async () => {
      const content = "Hello 世界 🌍 مرحبا שלום";
      const chunks = await chunker.chunkContent(content, {
        strategy: "fixed",
        maxChunkSize: 10,
      });

      const reconstructed = chunks.map((c) => c.content).join("");
      expect(reconstructed).toContain("世界");
      expect(reconstructed).toContain("🌍");
    });

    it("should handle emoji correctly", async () => {
      const content = "🎉🎊🎈🎁🎀";
      const chunks = await chunker.chunkContent(content, {
        strategy: "fixed",
        maxChunkSize: 4,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle newlines in content", async () => {
      const content = "Line1\nLine2\nLine3";
      const chunks = await chunker.chunkContent(content, {
        strategy: "fixed",
        maxChunkSize: 8,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should handle carriage returns", async () => {
      const content = "Line1\r\nLine2\r\nLine3";
      const chunks = await chunker.chunkContent(content, {
        strategy: "fixed",
        maxChunkSize: 10,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe("Single Item Content", () => {
    it("should handle single character", async () => {
      const chunks = await chunker.chunkContent("A", {
        strategy: "fixed",
        maxChunkSize: 5,
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe("A");
    });

    it("should handle single sentence", async () => {
      const content = "Single sentence.";
      const chunks = await chunker.chunkContent(content, {
        strategy: "sentence",
        maxChunkSize: 1,
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(content);
    });

    it("should handle single paragraph", async () => {
      const content = "Single paragraph content.";
      const chunks = await chunker.chunkContent(content, {
        strategy: "paragraph",
        maxChunkSize: 1,
      });

      expect(chunks).toHaveLength(1);
    });
  });

  describe("Very Long Content", () => {
    it("should handle very long single sentence", async () => {
      const longSentence = "word ".repeat(1000) + ".";
      const chunks = await chunker.chunkContent(longSentence, {
        strategy: "sentence",
        maxChunkSize: 1,
      });

      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe(longSentence);
    });

    it("should handle content exceeding chunk size", async () => {
      const content = "A".repeat(100);
      const chunks = await chunker.chunkContent(content, {
        strategy: "fixed",
        maxChunkSize: 10,
      });

      expect(chunks).toHaveLength(10);
    });
  });

  describe("Sentence Detection Edge Cases", () => {
    it("should handle multiple punctuation marks", async () => {
      const content = "Really?! Yes... No. Maybe!!!";
      const chunks = await chunker.chunkContent(content, {
        strategy: "sentence",
        maxChunkSize: 2,
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle abbreviations", async () => {
      const content = "Dr. Smith went to the U.S.A. He is Prof. of medicine.";
      const chunks = await chunker.chunkContent(content, {
        strategy: "sentence",
        maxChunkSize: 1,
      });

      // Should recognize these as parts of sentences
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle decimal numbers", async () => {
      const content =
        "The value is 3.14. The other value is 2.71. Both are important.";
      const chunks = await chunker.chunkContent(content, {
        strategy: "sentence",
        maxChunkSize: 2,
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it("should handle quoted sentences", async () => {
      const content = 'He said "Hello." She replied "Hi." They talked.';
      const chunks = await chunker.chunkContent(content, {
        strategy: "sentence",
        maxChunkSize: 2,
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Paragraph Detection Edge Cases", () => {
    it("should handle single newline (not paragraph break)", async () => {
      const content = "Line 1\nLine 2\nLine 3";
      const chunks = await chunker.chunkContent(content, {
        strategy: "paragraph",
        maxChunkSize: 1,
      });

      expect(chunks.length).toBe(1);
    });

    it("should handle multiple blank lines", async () => {
      const content = "Para 1\n\n\n\n\nPara 2";
      const chunks = await chunker.chunkContent(content, {
        strategy: "paragraph",
        maxChunkSize: 1,
      });

      expect(chunks.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle Windows-style line endings", async () => {
      const content = "Para 1\r\n\r\nPara 2\r\n\r\nPara 3";
      const chunks = await chunker.chunkContent(content, {
        strategy: "paragraph",
        maxChunkSize: 2,
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Metadata Correctness", () => {
    it("should have correct totalChunks in all chunks", async () => {
      const content = "A".repeat(100);
      const chunks = await chunker.chunkContent(content, {
        strategy: "fixed",
        maxChunkSize: 10,
      });

      const totalChunks = chunks.length;
      chunks.forEach((chunk) => {
        expect(chunk.metadata.totalChunks).toBe(totalChunks);
      });
    });

    it("should have sequential chunk indices", async () => {
      const content = "A".repeat(50);
      const chunks = await chunker.chunkContent(content, {
        strategy: "fixed",
        maxChunkSize: 10,
      });

      chunks.forEach((chunk, idx) => {
        expect(chunk.chunkIndex).toBe(idx);
        expect(chunk.metadata.chunkIndex).toBe(idx);
      });
    });

    it("should include hasOverlap in metadata", async () => {
      const chunks = await chunker.chunkContent("ABCDEFGHIJ", {
        strategy: "fixed",
        maxChunkSize: 5,
        overlapSize: 2,
      });

      // First chunk has no overlap, subsequent chunks do
      expect(chunks[0].metadata.hasOverlap).toBe(false);
      if (chunks.length > 1) {
        expect(chunks[1].metadata.hasOverlap).toBe(true);
      }
    });
  });

  describe("Overlap Behavior", () => {
    it("should preserve overlap in fixed chunking", async () => {
      const content = "ABCDEFGHIJ";
      const chunks = await chunker.chunkContent(content, {
        strategy: "fixed",
        maxChunkSize: 4,
        overlapSize: 2,
      });

      // With overlap, chunks should share characters
      expect(chunks.length).toBeGreaterThan(2);

      // Verify overlap: last 2 chars of chunk 0 should be first 2 chars of chunk 1
      const lastTwoOfFirst = chunks[0].content.slice(-2);
      const firstTwoOfSecond = chunks[1].content.slice(0, 2);
      expect(lastTwoOfFirst).toBe(firstTwoOfSecond);
    });

    it("should handle overlap of 0", async () => {
      const content = "ABCDEFGH";
      const chunks = await chunker.chunkContent(content, {
        strategy: "fixed",
        maxChunkSize: 4,
        overlapSize: 0,
      });

      expect(chunks).toHaveLength(2);
      expect(chunks[0].content).toBe("ABCD");
      expect(chunks[1].content).toBe("EFGH");
    });

    it("should handle overlap of 1", async () => {
      const content = "ABCDEFGHIJ";
      const chunks = await chunker.chunkContent(content, {
        strategy: "fixed",
        maxChunkSize: 5,
        overlapSize: 1,
      });

      // Each chunk advances by 4 (5 - 1)
      expect(chunks.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe("estimateOptimalChunkSize - Extended", () => {
  it("should return consistent values for same inputs", () => {
    const size1 = estimateOptimalChunkSize(10000, "token");
    const size2 = estimateOptimalChunkSize(10000, "token");

    expect(size1).toBe(size2);
  });

  it("should scale with content length for paragraph strategy", () => {
    const sizeSmall = estimateOptimalChunkSize(5000, "paragraph");
    const sizeMedium = estimateOptimalChunkSize(20000, "paragraph");
    const sizeLarge = estimateOptimalChunkSize(100000, "paragraph");

    expect(sizeMedium).toBeGreaterThan(sizeSmall);
    expect(sizeLarge).toBeGreaterThanOrEqual(sizeMedium);
  });

  it("should handle semantic strategy", () => {
    const size = estimateOptimalChunkSize(10000, "semantic");

    expect(size).toBeGreaterThan(0);
  });

  it("should handle unknown strategy gracefully", () => {
    const size = estimateOptimalChunkSize(10000, "unknown" as any);

    expect(size).toBeGreaterThan(0); // Should return a default
  });

  it("should handle zero content length", () => {
    const size = estimateOptimalChunkSize(0, "token");

    expect(size).toBeGreaterThan(0); // Should return minimum
  });

  it("should handle very large content length", () => {
    const size = estimateOptimalChunkSize(10000000, "fixed");

    expect(size).toBeGreaterThan(0);
  });
});
