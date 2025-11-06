"""
Embedding generation utilities for Cortex Python SDK tests.

Provides functions for generating embeddings for testing, with graceful fallbacks.
"""

import os
from typing import Optional, List
import random


def embeddings_available() -> bool:
    """
    Check if embeddings can be generated.

    Returns:
        True if OPENAI_API_KEY is set, False otherwise
    """
    return bool(os.getenv("OPENAI_API_KEY"))


def generate_mock_embedding(text: str, dimensions: int = 1536) -> List[float]:
    """
    Generate a mock embedding vector for testing without API.

    Creates a deterministic pseudo-random vector based on text hash.

    Args:
        text: Text to generate embedding for
        dimensions: Number of dimensions (default: 1536)

    Returns:
        List of floats representing the embedding
    """
    # Use text hash as seed for deterministic output
    seed = hash(text) % (2**32)
    random.seed(seed)

    # Generate normalized vector
    embedding = [random.gauss(0, 1) for _ in range(dimensions)]

    # Normalize to unit length
    magnitude = sum(x**2 for x in embedding) ** 0.5
    if magnitude > 0:
        embedding = [x / magnitude for x in embedding]

    return embedding


async def generate_embedding(
    text: str, dimensions: int = 1536, use_mock: bool = False
) -> Optional[List[float]]:
    """
    Generate an embedding vector for the given text.

    Uses OpenAI's text-embedding-3-small model if API key is available,
    otherwise returns None or a mock embedding if use_mock=True.

    Args:
        text: Text to generate embedding for
        dimensions: Number of dimensions (default: 1536)
        use_mock: If True, generate mock embedding when API unavailable

    Returns:
        List of floats representing the embedding, or None if unavailable
    """
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        if use_mock:
            return generate_mock_embedding(text, dimensions)
        return None

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)

        response = client.embeddings.create(
            model="text-embedding-3-small", input=text, dimensions=dimensions
        )

        return response.data[0].embedding

    except ImportError:
        # OpenAI package not installed
        if use_mock:
            return generate_mock_embedding(text, dimensions)
        return None

    except Exception as e:
        # API call failed
        if use_mock:
            return generate_mock_embedding(text, dimensions)
        return None


async def generate_embeddings_batch(
    texts: List[str], dimensions: int = 1536, use_mock: bool = False
) -> List[Optional[List[float]]]:
    """
    Generate embeddings for multiple texts.

    Args:
        texts: List of texts to generate embeddings for
        dimensions: Number of dimensions (default: 1536)
        use_mock: If True, generate mock embeddings when API unavailable

    Returns:
        List of embeddings (or None for each failed generation)
    """
    embeddings = []

    for text in texts:
        embedding = await generate_embedding(text, dimensions, use_mock)
        embeddings.append(embedding)

    return embeddings

