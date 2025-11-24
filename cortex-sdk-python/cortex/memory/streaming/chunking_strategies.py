"""
Chunking Strategies

Different approaches for breaking long responses into chunks:
- Token-based: Split by token count
- Sentence-based: Split by sentences
- Paragraph-based: Split by paragraphs
- Fixed-size: Split by character count
- Semantic: Split by meaning (requires embeddings)

Python implementation matching TypeScript src/memory/streaming/ChunkingStrategies.ts
"""

import re
from typing import List

from ..streaming_types import ChunkingConfig, ChunkStrategy, ContentChunk


class ResponseChunker:
    """Main chunking class that handles different strategies"""

    async def chunk_content(
        self, content: str, config: ChunkingConfig
    ) -> List[ContentChunk]:
        """Chunk content based on the specified strategy"""
        if config.strategy == ChunkStrategy.TOKEN:
            return self._chunk_by_tokens(
                content, config.max_chunk_size, config.overlap_size
            )

        elif config.strategy == ChunkStrategy.SENTENCE:
            return self._chunk_by_sentences(
                content, config.max_chunk_size, config.preserve_boundaries
            )

        elif config.strategy == ChunkStrategy.PARAGRAPH:
            return self._chunk_by_paragraphs(
                content, config.max_chunk_size, config.preserve_boundaries
            )

        elif config.strategy == ChunkStrategy.FIXED:
            return self._chunk_by_fixed(
                content, config.max_chunk_size, config.overlap_size
            )

        elif config.strategy == ChunkStrategy.SEMANTIC:
            # Semantic chunking would require embeddings - fallback to sentence for now
            print(
                "Warning: Semantic chunking requires embeddings, falling back to sentence-based"
            )
            return self._chunk_by_sentences(
                content, config.max_chunk_size, config.preserve_boundaries
            )

        else:
            raise ValueError(f"Unknown chunking strategy: {config.strategy}")

    def _chunk_by_tokens(
        self, content: str, max_tokens: int, overlap_tokens: int = 0
    ) -> List[ContentChunk]:
        """Chunk by token count (approximate - 1 token ≈ 4 characters)"""
        chunks: List[ContentChunk] = []
        max_chars = max_tokens * 4  # Approximate character count
        overlap_chars = overlap_tokens * 4

        # Validate overlap
        if overlap_chars >= max_chars:
            raise ValueError("overlap_tokens must be smaller than max_tokens")

        start_offset = 0
        chunk_index = 0
        step_size = max_chars - overlap_chars

        # Safety check
        if step_size <= 0:
            raise ValueError("Invalid chunking configuration")

        while start_offset < len(content):
            end_offset = min(start_offset + max_chars, len(content))
            chunk_content = content[start_offset:end_offset]

            chunks.append(
                ContentChunk(
                    content=chunk_content,
                    chunk_index=chunk_index,
                    start_offset=start_offset,
                    end_offset=end_offset,
                    metadata={
                        "chunkIndex": chunk_index,
                        "startOffset": start_offset,
                        "endOffset": end_offset,
                        "hasOverlap": overlap_tokens > 0 and start_offset > 0,
                    },
                )
            )

            # Move to next chunk with overlap
            if end_offset >= len(content):
                break

            start_offset += step_size
            chunk_index += 1

            # Safety: prevent infinite loops
            if chunk_index > 100000:
                raise RuntimeError("Chunking exceeded maximum iterations")

        # Update total chunks count in metadata
        for chunk in chunks:
            chunk.metadata["totalChunks"] = len(chunks)

        return chunks

    def _chunk_by_sentences(
        self, content: str, max_sentences: int, preserve_boundaries: bool = True
    ) -> List[ContentChunk]:
        """Chunk by sentences"""
        chunks: List[ContentChunk] = []

        # Split into sentences (simple regex - can be improved)
        sentence_regex = re.compile(r"[.!?]+\s+")
        sentences: List[str] = []
        last_index = 0

        for match in sentence_regex.finditer(content):
            sentences.append(content[last_index : match.end()])
            last_index = match.end()

        # Add remaining content as last sentence
        if last_index < len(content):
            sentences.append(content[last_index:])

        if len(sentences) == 0:
            # No sentence breaks found, treat entire content as one chunk
            return [
                ContentChunk(
                    content=content,
                    chunk_index=0,
                    start_offset=0,
                    end_offset=len(content),
                    metadata={
                        "chunkIndex": 0,
                        "totalChunks": 1,
                        "startOffset": 0,
                        "endOffset": len(content),
                        "hasOverlap": False,
                    },
                )
            ]

        # Group sentences into chunks
        current_chunk: List[str] = []
        current_start_offset = 0
        chunk_index = 0

        for i, sentence in enumerate(sentences):
            current_chunk.append(sentence)

            # Create chunk when we reach max_sentences or end of content
            if len(current_chunk) >= max_sentences or i == len(sentences) - 1:
                chunk_content = "".join(current_chunk)
                end_offset = current_start_offset + len(chunk_content)

                chunks.append(
                    ContentChunk(
                        content=chunk_content,
                        chunk_index=chunk_index,
                        start_offset=current_start_offset,
                        end_offset=end_offset,
                        metadata={
                            "chunkIndex": chunk_index,
                            "startOffset": current_start_offset,
                            "endOffset": end_offset,
                            "hasOverlap": False,
                        },
                    )
                )

                current_start_offset = end_offset
                current_chunk = []
                chunk_index += 1

        # Update total chunks count
        for chunk in chunks:
            chunk.metadata["totalChunks"] = len(chunks)

        return chunks

    def _chunk_by_paragraphs(
        self, content: str, max_paragraphs: int, preserve_boundaries: bool = True
    ) -> List[ContentChunk]:
        """Chunk by paragraphs"""
        chunks: List[ContentChunk] = []

        # Split by double newlines (paragraph breaks)
        paragraphs = re.split(r"\n\n+", content)

        if len(paragraphs) == 0:
            # No paragraph breaks, treat as single chunk
            return [
                ContentChunk(
                    content=content,
                    chunk_index=0,
                    start_offset=0,
                    end_offset=len(content),
                    metadata={
                        "chunkIndex": 0,
                        "totalChunks": 1,
                        "startOffset": 0,
                        "endOffset": len(content),
                        "hasOverlap": False,
                    },
                )
            ]

        # Group paragraphs into chunks
        current_chunk: List[str] = []
        current_start_offset = 0
        chunk_index = 0

        for i, paragraph in enumerate(paragraphs):
            current_chunk.append(paragraph)

            # Create chunk when we reach max_paragraphs or end of content
            if len(current_chunk) >= max_paragraphs or i == len(paragraphs) - 1:
                chunk_content = "\n\n".join(current_chunk)
                end_offset = current_start_offset + len(chunk_content)

                chunks.append(
                    ContentChunk(
                        content=chunk_content,
                        chunk_index=chunk_index,
                        start_offset=current_start_offset,
                        end_offset=end_offset,
                        metadata={
                            "chunkIndex": chunk_index,
                            "startOffset": current_start_offset,
                            "endOffset": end_offset,
                            "hasOverlap": False,
                        },
                    )
                )

                current_start_offset = end_offset + 2  # Account for removed \n\n
                current_chunk = []
                chunk_index += 1

        # Update total chunks count
        for chunk in chunks:
            chunk.metadata["totalChunks"] = len(chunks)

        return chunks

    def _chunk_by_fixed(
        self, content: str, max_size: int, overlap_size: int = 0
    ) -> List[ContentChunk]:
        """Chunk by fixed character size"""
        # Handle empty content
        if len(content) == 0:
            return [
                ContentChunk(
                    content="",
                    chunk_index=0,
                    start_offset=0,
                    end_offset=0,
                    metadata={
                        "chunkIndex": 0,
                        "totalChunks": 1,
                        "startOffset": 0,
                        "endOffset": 0,
                        "hasOverlap": False,
                    },
                )
            ]

        # Validate overlap is smaller than chunk size
        if overlap_size >= max_size:
            raise ValueError("overlap_size must be smaller than max_chunk_size")

        chunks: List[ContentChunk] = []
        start_offset = 0
        chunk_index = 0
        step_size = max_size - overlap_size

        # Safety check for infinite loop
        if step_size <= 0:
            raise ValueError("Invalid chunking configuration")

        while start_offset < len(content):
            end_offset = min(start_offset + max_size, len(content))
            chunk_content = content[start_offset:end_offset]

            chunks.append(
                ContentChunk(
                    content=chunk_content,
                    chunk_index=chunk_index,
                    start_offset=start_offset,
                    end_offset=end_offset,
                    metadata={
                        "chunkIndex": chunk_index,
                        "startOffset": start_offset,
                        "endOffset": end_offset,
                        "hasOverlap": overlap_size > 0 and start_offset > 0,
                    },
                )
            )

            # Move to next chunk with overlap
            # If we're at the end, break to avoid infinite loop
            if end_offset >= len(content):
                break

            start_offset += step_size
            chunk_index += 1

            # Additional safety: prevent infinite loops
            if chunk_index > 100000:
                raise RuntimeError(
                    "Chunking exceeded maximum iterations - possible infinite loop"
                )

        # Update total chunks count
        for chunk in chunks:
            chunk.metadata["totalChunks"] = len(chunks)

        return chunks


def estimate_optimal_chunk_size(
    content_length: int, strategy: ChunkStrategy
) -> int:
    """Helper to estimate optimal chunk size based on content length"""
    if strategy == ChunkStrategy.TOKEN:
        # Aim for ~500 tokens per chunk
        return 500

    elif strategy == ChunkStrategy.SENTENCE:
        # Aim for 5-10 sentences per chunk
        return 10 if content_length > 10000 else 5

    elif strategy == ChunkStrategy.PARAGRAPH:
        # Aim for 2-3 paragraphs per chunk
        return 3 if content_length > 5000 else 2

    elif strategy == ChunkStrategy.FIXED:
        # Aim for 2000 characters per chunk
        return 2000

    elif strategy == ChunkStrategy.SEMANTIC:
        # Similar to sentence-based
        return 10

    else:
        return 2000


def should_chunk_content(content_length: int, threshold: int = 10000) -> bool:
    """Helper to determine if content should be chunked"""
    return content_length > threshold  # 10K chars ~= 2500 tokens
