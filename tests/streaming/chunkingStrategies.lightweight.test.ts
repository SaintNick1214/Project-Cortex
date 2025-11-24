/**
 * Lightweight tests for ChunkingStrategies (no heavy dependencies)
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
  });
});
