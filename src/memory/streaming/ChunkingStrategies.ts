/**
 * Chunking Strategies
 *
 * Different approaches for breaking long responses into chunks:
 * - Token-based: Split by token count
 * - Sentence-based: Split by sentences
 * - Paragraph-based: Split by paragraphs
 * - Fixed-size: Split by character count
 * - Semantic: Split by meaning (requires embeddings)
 */

import type {
  ChunkStrategy,
  ChunkingConfig,
  ContentChunk,
} from "../../types/streaming";

/**
 * Main chunking class that handles different strategies
 */
export class ResponseChunker {
  /**
   * Chunk content based on the specified strategy
   */
  async chunkContent(
    content: string,
    config: ChunkingConfig,
  ): Promise<ContentChunk[]> {
    switch (config.strategy) {
      case "token":
        return this.chunkByTokens(
          content,
          config.maxChunkSize,
          config.overlapSize,
        );

      case "sentence":
        return this.chunkBySentences(
          content,
          config.maxChunkSize,
          config.preserveBoundaries,
        );

      case "paragraph":
        return this.chunkByParagraphs(
          content,
          config.maxChunkSize,
          config.preserveBoundaries,
        );

      case "fixed":
        return this.chunkByFixed(
          content,
          config.maxChunkSize,
          config.overlapSize,
        );

      case "semantic":
        // Semantic chunking would require embeddings - fallback to sentence for now
        console.warn(
          "Semantic chunking requires embeddings, falling back to sentence-based",
        );
        return this.chunkBySentences(
          content,
          config.maxChunkSize,
          config.preserveBoundaries,
        );

      default:
        throw new Error(`Unknown chunking strategy: ${config.strategy}`);
    }
  }

  /**
   * Chunk by token count (approximate - 1 token ≈ 4 characters)
   */
  private chunkByTokens(
    content: string,
    maxTokens: number,
    overlapTokens: number = 0,
  ): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    const maxChars = maxTokens * 4; // Approximate character count
    const overlapChars = overlapTokens * 4;

    // Validate overlap
    if (overlapChars >= maxChars) {
      throw new Error("overlapTokens must be smaller than maxTokens");
    }

    let startOffset = 0;
    let chunkIndex = 0;
    const stepSize = maxChars - overlapChars;

    // Safety check
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
          hasOverlap: overlapTokens > 0 && startOffset > 0,
        },
      });

      // Move to next chunk with overlap
      if (endOffset >= content.length) {
        break;
      }

      startOffset += stepSize;
      chunkIndex++;

      // Safety: prevent infinite loops
      if (chunkIndex > 100000) {
        throw new Error("Chunking exceeded maximum iterations");
      }
    }

    // Update total chunks count in metadata
    chunks.forEach((chunk) => {
      chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
  }

  /**
   * Chunk by sentences
   */
  private chunkBySentences(
    content: string,
    maxSentences: number,
    preserveBoundaries: boolean = true,
  ): ContentChunk[] {
    const chunks: ContentChunk[] = [];

    // Split into sentences (simple regex - can be improved)
    const sentenceRegex = /[.!?]+\s+/g;
    const sentences: string[] = [];
    let lastIndex = 0;
    let match;

    while ((match = sentenceRegex.exec(content)) !== null) {
      sentences.push(
        content.substring(lastIndex, match.index + match[0].length),
      );
      lastIndex = match.index + match[0].length;
    }

    // Add remaining content as last sentence
    if (lastIndex < content.length) {
      sentences.push(content.substring(lastIndex));
    }

    if (sentences.length === 0) {
      // No sentence breaks found, treat entire content as one chunk
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
            hasOverlap: false,
          },
        },
      ];
    }

    // Group sentences into chunks
    let currentChunk: string[] = [];
    let currentStartOffset = 0;
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      currentChunk.push(sentences[i]);

      // Create chunk when we reach maxSentences or end of content
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
            hasOverlap: false,
          },
        });

        currentStartOffset = endOffset;
        currentChunk = [];
        chunkIndex++;
      }
    }

    // Update total chunks count
    chunks.forEach((chunk) => {
      chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
  }

  /**
   * Chunk by paragraphs
   */
  private chunkByParagraphs(
    content: string,
    maxParagraphs: number,
    preserveBoundaries: boolean = true,
  ): ContentChunk[] {
    const chunks: ContentChunk[] = [];

    // Split by double newlines (paragraph breaks)
    const paragraphs = content.split(/\n\n+/);

    if (paragraphs.length === 0) {
      // No paragraph breaks, treat as single chunk
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
            hasOverlap: false,
          },
        },
      ];
    }

    // Group paragraphs into chunks
    let currentChunk: string[] = [];
    let currentStartOffset = 0;
    let chunkIndex = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      currentChunk.push(paragraphs[i]);

      // Create chunk when we reach maxParagraphs or end of content
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
            hasOverlap: false,
          },
        });

        currentStartOffset = endOffset + 2; // Account for removed \n\n
        currentChunk = [];
        chunkIndex++;
      }
    }

    // Update total chunks count
    chunks.forEach((chunk) => {
      chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
  }

  /**
   * Chunk by fixed character size
   */
  private chunkByFixed(
    content: string,
    maxSize: number,
    overlapSize: number = 0,
  ): ContentChunk[] {
    // Handle empty content
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
            hasOverlap: false,
          },
        },
      ];
    }

    // Validate overlap is smaller than chunk size
    if (overlapSize >= maxSize) {
      throw new Error("overlapSize must be smaller than maxChunkSize");
    }

    const chunks: ContentChunk[] = [];
    let startOffset = 0;
    let chunkIndex = 0;
    const stepSize = maxSize - overlapSize;

    // Safety check for infinite loop
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
          hasOverlap: overlapSize > 0 && startOffset > 0,
        },
      });

      // Move to next chunk with overlap
      // If we're at the end, break to avoid infinite loop
      if (endOffset >= content.length) {
        break;
      }

      startOffset += stepSize;
      chunkIndex++;

      // Additional safety: prevent infinite loops
      if (chunkIndex > 100000) {
        throw new Error(
          "Chunking exceeded maximum iterations - possible infinite loop",
        );
      }
    }

    // Update total chunks count
    chunks.forEach((chunk) => {
      chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
  }

  /**
   * Chunk by semantic similarity (requires embeddings)
   * This is a placeholder - would need embedding generation
   */
  private async chunkBySemantic(
    content: string,
    embeddings: number[][],
  ): Promise<ContentChunk[]> {
    // This would require:
    // 1. Generate embeddings for sliding windows of text
    // 2. Calculate similarity between adjacent windows
    // 3. Split where similarity drops below threshold
    //
    // For now, fallback to sentence-based chunking
    return this.chunkBySentences(content, 10, true);
  }
}

/**
 * Helper to estimate optimal chunk size based on content length
 */
export function estimateOptimalChunkSize(
  contentLength: number,
  strategy: ChunkStrategy,
): number {
  switch (strategy) {
    case "token":
      // Aim for ~500 tokens per chunk
      return 500;

    case "sentence":
      // Aim for 5-10 sentences per chunk
      return contentLength > 10000 ? 10 : 5;

    case "paragraph":
      // Aim for 2-3 paragraphs per chunk
      return contentLength > 5000 ? 3 : 2;

    case "fixed":
      // Aim for 2000 characters per chunk
      return 2000;

    case "semantic":
      // Similar to sentence-based
      return 10;

    default:
      return 2000;
  }
}

/**
 * Helper to determine if content should be chunked
 */
export function shouldChunkContent(
  contentLength: number,
  threshold: number = 10000, // 10K chars ~= 2500 tokens
): boolean {
  return contentLength > threshold;
}
