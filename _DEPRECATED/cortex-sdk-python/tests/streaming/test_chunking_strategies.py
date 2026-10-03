"""
Chunking Strategies Tests

Tests that validate ACTUAL chunks produced, not just "no errors".
Verifies chunk content, sizes, overlaps, and boundaries.
"""

import pytest

from cortex.memory.streaming.chunking_strategies import (
    ResponseChunker,
    estimate_optimal_chunk_size,
    should_chunk_content,
)
from cortex.memory.streaming_types import ChunkingConfig, ChunkStrategy


class TestResponseChunker:
    """Test suite for ResponseChunker with actual chunk validation"""

    @pytest.mark.asyncio
    async def test_fixed_chunking_produces_correct_chunks(self):
        """
        Test: Fixed chunking splits content correctly
        Validates: Chunk count, sizes, and content
        """
        chunker = ResponseChunker()
        content = "A" * 1000  # 1000 chars

        config = ChunkingConfig(
            strategy=ChunkStrategy.FIXED,
            max_chunk_size=250,
            overlap_size=0,
            preserve_boundaries=True,
        )

        chunks = await chunker.chunk_content(content, config)

        # CRITICAL: Validate actual chunk properties
        assert len(chunks) == 4, f"Expected 4 chunks, got {len(chunks)}"

        # Validate each chunk
        for i, chunk in enumerate(chunks):
            assert chunk.chunk_index == i
            assert len(chunk.content) == 250, f"Chunk {i} has {len(chunk.content)} chars, expected 250"
            assert chunk.content == "A" * 250
            assert chunk.start_offset == i * 250
            assert chunk.end_offset == (i + 1) * 250

    @pytest.mark.asyncio
    async def test_fixed_chunking_with_overlap(self):
        """
        Test: Fixed chunking with overlap works correctly
        Validates: Overlapping content between chunks
        """
        chunker = ResponseChunker()
        content = "0123456789" * 10  # 100 chars

        config = ChunkingConfig(
            strategy=ChunkStrategy.FIXED,
            max_chunk_size=30,
            overlap_size=10,
            preserve_boundaries=False,
        )

        chunks = await chunker.chunk_content(content, config)

        # CRITICAL: Validate overlap
        assert len(chunks) > 1

        # Check that consecutive chunks overlap
        for i in range(len(chunks) - 1):
            current_end = chunks[i].content[-10:]  # Last 10 chars
            next_start = chunks[i + 1].content[:10]  # First 10 chars
            assert current_end == next_start, f"Chunks {i} and {i+1} don't overlap correctly"

    @pytest.mark.asyncio
    async def test_token_chunking_estimates_correctly(self):
        """
        Test: Token chunking uses correct estimation (1 token ≈ 4 chars)
        Validates: Chunk sizes match token limits
        """
        chunker = ResponseChunker()
        content = "word " * 200  # 1000 chars total

        config = ChunkingConfig(
            strategy=ChunkStrategy.TOKEN,
            max_chunk_size=100,  # 100 tokens = ~400 chars
            overlap_size=0,
            preserve_boundaries=False,
        )

        chunks = await chunker.chunk_content(content, config)

        # CRITICAL: Validate token-based sizing
        for chunk in chunks:
            # Each chunk should be ~400 chars (100 tokens × 4)
            assert len(chunk.content) <= 400, f"Chunk exceeds token limit: {len(chunk.content)} chars"

    @pytest.mark.asyncio
    async def test_sentence_chunking_preserves_boundaries(self):
        """
        Test: Sentence chunking respects sentence boundaries
        Validates: Chunks end at sentence boundaries
        """
        chunker = ResponseChunker()
        content = "First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence."

        config = ChunkingConfig(
            strategy=ChunkStrategy.SENTENCE,
            max_chunk_size=2,  # 2 sentences per chunk
            overlap_size=0,
            preserve_boundaries=True,
        )

        chunks = await chunker.chunk_content(content, config)

        # CRITICAL: Validate sentence boundaries
        assert len(chunks) == 3, f"Expected 3 chunks (2+2+1 sentences), got {len(chunks)}"

        # First chunk should have 2 sentences
        assert chunks[0].content.count(".") == 2
        # Second chunk should have 2 sentences
        assert chunks[1].content.count(".") == 2
        # Third chunk should have 1 sentence
        assert chunks[2].content.count(".") == 1

    @pytest.mark.asyncio
    async def test_paragraph_chunking_preserves_structure(self):
        """
        Test: Paragraph chunking preserves paragraph structure
        Validates: Chunks split at paragraph boundaries
        """
        chunker = ResponseChunker()
        content = "Para 1\n\nPara 2\n\nPara 3\n\nPara 4"

        config = ChunkingConfig(
            strategy=ChunkStrategy.PARAGRAPH,
            max_chunk_size=2,  # 2 paragraphs per chunk
            overlap_size=0,
            preserve_boundaries=True,
        )

        chunks = await chunker.chunk_content(content, config)

        # CRITICAL: Validate paragraph grouping
        assert len(chunks) == 2, f"Expected 2 chunks, got {len(chunks)}"
        assert "Para 1" in chunks[0].content
        assert "Para 2" in chunks[0].content
        assert "Para 3" in chunks[1].content
        assert "Para 4" in chunks[1].content

    @pytest.mark.asyncio
    async def test_empty_content_handling(self):
        """
        Test: Empty content produces single empty chunk
        Validates: No errors, correct empty chunk structure
        """
        chunker = ResponseChunker()
        content = ""

        config = ChunkingConfig(
            strategy=ChunkStrategy.FIXED,
            max_chunk_size=100,
            overlap_size=0,
            preserve_boundaries=False,
        )

        chunks = await chunker.chunk_content(content, config)

        # CRITICAL: Validate empty content handling
        assert len(chunks) == 1, "Empty content should produce 1 empty chunk"
        assert chunks[0].content == ""
        assert chunks[0].start_offset == 0
        assert chunks[0].end_offset == 0

    @pytest.mark.asyncio
    async def test_overlap_validation_prevents_infinite_loop(self):
        """
        Test: Overlap >= max size raises error (prevents infinite loop)
        Validates: Error handling for invalid configurations
        """
        chunker = ResponseChunker()
        content = "A" * 1000

        config = ChunkingConfig(
            strategy=ChunkStrategy.FIXED,
            max_chunk_size=100,
            overlap_size=100,  # Equal to max_size - invalid!
            preserve_boundaries=False,
        )

        # CRITICAL: Should raise error, not infinite loop
        with pytest.raises(ValueError, match="overlap.*must be smaller"):
            await chunker.chunk_content(content, config)

    def test_should_chunk_content_threshold(self):
        """
        Test: Content length threshold determines chunking need
        Validates: Correct threshold detection
        """
        # CRITICAL: Validate threshold logic
        assert should_chunk_content(5000, threshold=10000) is False
        assert should_chunk_content(10001, threshold=10000) is True
        assert should_chunk_content(10000, threshold=10000) is False

    def test_estimate_optimal_chunk_size(self):
        """
        Test: Optimal chunk size estimation is reasonable
        Validates: Size recommendations for different strategies
        """
        # CRITICAL: Validate size estimates

        # Token strategy
        token_size = estimate_optimal_chunk_size(5000, ChunkStrategy.TOKEN)
        assert token_size == 500, "Token strategy should suggest 500 tokens"

        # Fixed strategy
        fixed_size = estimate_optimal_chunk_size(5000, ChunkStrategy.FIXED)
        assert fixed_size == 2000, "Fixed strategy should suggest 2000 chars"

        # Sentence strategy (varies by content length)
        sentence_small = estimate_optimal_chunk_size(5000, ChunkStrategy.SENTENCE)
        sentence_large = estimate_optimal_chunk_size(15000, ChunkStrategy.SENTENCE)
        assert sentence_small == 5, "Small content (≤10K) should suggest 5 sentences"
        assert sentence_large == 10, "Large content (>10K) should suggest 10 sentences"

    @pytest.mark.asyncio
    async def test_chunk_metadata_completeness(self):
        """
        Test: All chunks have complete metadata
        Validates: Metadata presence and correctness
        """
        chunker = ResponseChunker()
        content = "A" * 500

        config = ChunkingConfig(
            strategy=ChunkStrategy.FIXED,
            max_chunk_size=100,
            overlap_size=20,
            preserve_boundaries=False,
        )

        chunks = await chunker.chunk_content(content, config)

        # CRITICAL: Validate metadata on every chunk
        for chunk in chunks:
            assert "chunkIndex" in chunk.metadata
            assert "startOffset" in chunk.metadata
            assert "endOffset" in chunk.metadata
            assert "totalChunks" in chunk.metadata
            assert "hasOverlap" in chunk.metadata
            assert chunk.metadata["totalChunks"] == len(chunks)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
