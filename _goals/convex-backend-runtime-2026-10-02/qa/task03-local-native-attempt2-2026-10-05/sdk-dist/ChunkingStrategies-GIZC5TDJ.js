import "./chunk-3RG5ZIWI.js";

// src/memory/streaming/ChunkingStrategies.ts
var ResponseChunker = class {
  /**
   * Chunk content based on the specified strategy
   */
  async chunkContent(content, config) {
    switch (config.strategy) {
      case "token":
        return this.chunkByTokens(
          content,
          config.maxChunkSize,
          config.overlapSize
        );
      case "sentence":
        return this.chunkBySentences(
          content,
          config.maxChunkSize,
          config.preserveBoundaries
        );
      case "paragraph":
        return this.chunkByParagraphs(
          content,
          config.maxChunkSize,
          config.preserveBoundaries
        );
      case "fixed":
        return this.chunkByFixed(
          content,
          config.maxChunkSize,
          config.overlapSize
        );
      case "semantic":
        console.warn(
          "Semantic chunking requires embeddings, falling back to sentence-based"
        );
        return this.chunkBySentences(
          content,
          config.maxChunkSize,
          config.preserveBoundaries
        );
      default:
        throw new Error(`Unknown chunking strategy: ${config.strategy}`);
    }
  }
  /**
   * Chunk by token count (approximate - 1 token ≈ 4 characters)
   */
  chunkByTokens(content, maxTokens, overlapTokens = 0) {
    const chunks = [];
    const maxChars = maxTokens * 4;
    const overlapChars = overlapTokens * 4;
    if (overlapChars >= maxChars) {
      throw new Error("overlapTokens must be smaller than maxTokens");
    }
    let startOffset = 0;
    let chunkIndex = 0;
    const stepSize = maxChars - overlapChars;
    if (stepSize <= 0) {
      throw new Error("Invalid chunking configuration");
    }
    while (startOffset < content.length) {
      const endOffset = Math.min(startOffset + maxChars, content.length);
      const chunkContent = content.substring(startOffset, endOffset);
      chunks.push({
        content: chunkContent,
        chunkIndex,
        startOffset,
        endOffset,
        metadata: {
          chunkIndex,
          startOffset,
          endOffset,
          hasOverlap: overlapTokens > 0 && startOffset > 0
        }
      });
      if (endOffset >= content.length) {
        break;
      }
      startOffset += stepSize;
      chunkIndex++;
      if (chunkIndex > 1e5) {
        throw new Error("Chunking exceeded maximum iterations");
      }
    }
    chunks.forEach((chunk) => {
      chunk.metadata.totalChunks = chunks.length;
    });
    return chunks;
  }
  /**
   * Chunk by sentences
   */
  chunkBySentences(content, maxSentences, _preserveBoundaries = true) {
    const chunks = [];
    const sentenceRegex = /[.!?]+\s+/g;
    const sentences = [];
    let lastIndex = 0;
    let match;
    while ((match = sentenceRegex.exec(content)) !== null) {
      sentences.push(
        content.substring(lastIndex, match.index + match[0].length)
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < content.length) {
      sentences.push(content.substring(lastIndex));
    }
    if (sentences.length === 0) {
      return [
        {
          content,
          chunkIndex: 0,
          startOffset: 0,
          endOffset: content.length,
          metadata: {
            chunkIndex: 0,
            totalChunks: 1,
            startOffset: 0,
            endOffset: content.length,
            hasOverlap: false
          }
        }
      ];
    }
    let currentChunk = [];
    let currentStartOffset = 0;
    let chunkIndex = 0;
    for (let i = 0; i < sentences.length; i++) {
      currentChunk.push(sentences[i]);
      if (currentChunk.length >= maxSentences || i === sentences.length - 1) {
        const chunkContent = currentChunk.join("");
        const endOffset = currentStartOffset + chunkContent.length;
        chunks.push({
          content: chunkContent,
          chunkIndex,
          startOffset: currentStartOffset,
          endOffset,
          metadata: {
            chunkIndex,
            startOffset: currentStartOffset,
            endOffset,
            hasOverlap: false
          }
        });
        currentStartOffset = endOffset;
        currentChunk = [];
        chunkIndex++;
      }
    }
    chunks.forEach((chunk) => {
      chunk.metadata.totalChunks = chunks.length;
    });
    return chunks;
  }
  /**
   * Chunk by paragraphs
   */
  chunkByParagraphs(content, maxParagraphs, _preserveBoundaries = true) {
    const chunks = [];
    const paragraphs = content.split(/\n\n+/);
    if (paragraphs.length === 0) {
      return [
        {
          content,
          chunkIndex: 0,
          startOffset: 0,
          endOffset: content.length,
          metadata: {
            chunkIndex: 0,
            totalChunks: 1,
            startOffset: 0,
            endOffset: content.length,
            hasOverlap: false
          }
        }
      ];
    }
    let currentChunk = [];
    let currentStartOffset = 0;
    let chunkIndex = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      currentChunk.push(paragraphs[i]);
      if (currentChunk.length >= maxParagraphs || i === paragraphs.length - 1) {
        const chunkContent = currentChunk.join("\n\n");
        const endOffset = currentStartOffset + chunkContent.length;
        chunks.push({
          content: chunkContent,
          chunkIndex,
          startOffset: currentStartOffset,
          endOffset,
          metadata: {
            chunkIndex,
            startOffset: currentStartOffset,
            endOffset,
            hasOverlap: false
          }
        });
        currentStartOffset = endOffset + 2;
        currentChunk = [];
        chunkIndex++;
      }
    }
    chunks.forEach((chunk) => {
      chunk.metadata.totalChunks = chunks.length;
    });
    return chunks;
  }
  /**
   * Chunk by fixed character size
   */
  chunkByFixed(content, maxSize, overlapSize = 0) {
    if (content.length === 0) {
      return [
        {
          content: "",
          chunkIndex: 0,
          startOffset: 0,
          endOffset: 0,
          metadata: {
            chunkIndex: 0,
            totalChunks: 1,
            startOffset: 0,
            endOffset: 0,
            hasOverlap: false
          }
        }
      ];
    }
    if (overlapSize >= maxSize) {
      throw new Error("overlapSize must be smaller than maxChunkSize");
    }
    const chunks = [];
    let startOffset = 0;
    let chunkIndex = 0;
    const stepSize = maxSize - overlapSize;
    if (stepSize <= 0) {
      throw new Error("Invalid chunking configuration");
    }
    while (startOffset < content.length) {
      const endOffset = Math.min(startOffset + maxSize, content.length);
      const chunkContent = content.substring(startOffset, endOffset);
      chunks.push({
        content: chunkContent,
        chunkIndex,
        startOffset,
        endOffset,
        metadata: {
          chunkIndex,
          startOffset,
          endOffset,
          hasOverlap: overlapSize > 0 && startOffset > 0
        }
      });
      if (endOffset >= content.length) {
        break;
      }
      startOffset += stepSize;
      chunkIndex++;
      if (chunkIndex > 1e5) {
        throw new Error(
          "Chunking exceeded maximum iterations - possible infinite loop"
        );
      }
    }
    chunks.forEach((chunk) => {
      chunk.metadata.totalChunks = chunks.length;
    });
    return chunks;
  }
  /**
   * Chunk by semantic similarity (requires embeddings)
   * This is a placeholder - would need embedding generation
   */
  async chunkBySemantic(content, _embeddings) {
    return this.chunkBySentences(content, 10, true);
  }
};
function estimateOptimalChunkSize(contentLength, strategy) {
  switch (strategy) {
    case "token":
      return 500;
    case "sentence":
      return contentLength > 1e4 ? 10 : 5;
    case "paragraph":
      return contentLength > 5e3 ? 3 : 2;
    case "fixed":
      return 2e3;
    case "semantic":
      return 10;
    default:
      return 2e3;
  }
}
function shouldChunkContent(contentLength, threshold = 1e4) {
  return contentLength > threshold;
}
export {
  ResponseChunker,
  estimateOptimalChunkSize,
  shouldChunkContent
};
