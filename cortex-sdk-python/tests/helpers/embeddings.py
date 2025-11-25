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
    text: str, dimensions: int = 1536, use_mock: bool = False, max_retries: int = 3
) -> Optional[List[float]]:
    """
    Generate an embedding vector for the given text.

    Uses OpenAI's text-embedding-3-small model if API key is available,
    otherwise returns None or a mock embedding if use_mock=True.

    Args:
        text: Text to generate embedding for
        dimensions: Number of dimensions (default: 1536)
        use_mock: If True, generate mock embedding when API unavailable
        max_retries: Maximum number of retries on transient failures (default: 3)

    Returns:
        List of floats representing the embedding, or None if unavailable
    """
    import asyncio
    
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        print("Warning: OPENAI_API_KEY not set")
        if use_mock:
            return generate_mock_embedding(text, dimensions)
        return None

    for attempt in range(max_retries):
        try:
            from openai import OpenAI

            client = OpenAI(api_key=api_key, timeout=30.0)

            response = client.embeddings.create(
                model="text-embedding-3-small", input=text, dimensions=dimensions
            )

            return response.data[0].embedding

        except ImportError:
            # OpenAI package not installed
            print("Warning: openai package not installed")
            if use_mock:
                return generate_mock_embedding(text, dimensions)
            return None

        except Exception as e:
            # API call failed - log the error
            error_msg = str(e)
            print(f"Warning: OpenAI embedding generation failed (attempt {attempt + 1}/{max_retries}): {error_msg}")
            
            # Check if it's a rate limit error or transient error that we should retry
            is_retryable = any(keyword in error_msg.lower() for keyword in [
                "rate limit", "timeout", "connection", "503", "502", "500"
            ])
            
            if is_retryable and attempt < max_retries - 1:
                # Exponential backoff: 1s, 2s, 4s
                wait_time = 2 ** attempt
                print(f"  Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
                continue
            
            # Final attempt failed or non-retryable error
            if use_mock:
                print("  Falling back to mock embedding")
                return generate_mock_embedding(text, dimensions)
            return None
    
    # All retries exhausted
    print(f"Error: OpenAI embedding generation failed after {max_retries} attempts")
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


async def summarize_conversation(
    user_message: str, agent_response: str, max_retries: int = 3
) -> Optional[str]:
    """
    Summarize a conversation using gpt-4.1-nano.
    
    Extracts key facts from the conversation in one concise sentence.
    Returns None if OpenAI API not available.
    
    Args:
        user_message: The user's message
        agent_response: The agent's response
        max_retries: Maximum number of retries on transient failures (default: 3)
        
    Returns:
        Summarized content as a string, or None if API unavailable
        
    Example:
        >>> summary = await summarize_conversation(
        ...     "My name is Alexander Johnson and I prefer to be called Alex",
        ...     "Got it, I'll call you Alex!"
        ... )
        >>> print(summary)  # "User prefers to be called Alex"
    """
    import asyncio
    
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        print("Warning: OPENAI_API_KEY not set for summarization")
        return None

    for attempt in range(max_retries):
        try:
            from openai import OpenAI

            client = OpenAI(api_key=api_key, timeout=30.0)

            response = client.chat.completions.create(
                model="gpt-4.1-nano",
                messages=[
                    {
                        "role": "system",
                        "content": "Extract key facts from this conversation in one concise sentence.",
                    },
                    {
                        "role": "user",
                        "content": f"User: {user_message}\nAgent: {agent_response}",
                    },
                ],
                temperature=0.3,
            )

            return response.choices[0].message.content

        except ImportError:
            # OpenAI package not installed
            print("Warning: openai package not installed")
            return None

        except Exception as e:
            # API call failed - log the error
            error_msg = str(e)
            print(f"Warning: OpenAI summarization failed (attempt {attempt + 1}/{max_retries}): {error_msg}")
            
            # Check if it's a rate limit error or transient error that we should retry
            is_retryable = any(keyword in error_msg.lower() for keyword in [
                "rate limit", "timeout", "connection", "503", "502", "500"
            ])
            
            if is_retryable and attempt < max_retries - 1:
                # Exponential backoff: 1s, 2s, 4s
                wait_time = 2 ** attempt
                print(f"  Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
                continue
            
            # Final attempt failed or non-retryable error
            return None
    
    # All retries exhausted
    print(f"Error: OpenAI summarization failed after {max_retries} attempts")
    return None

