"""
Embedding generation utilities for Cortex Python SDK tests.

Provides functions for generating embeddings for testing, with graceful fallbacks.
"""

import os
import random
from typing import List, Optional


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


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Enriched Fact Extraction for Bullet-Proof Retrieval
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENRICHED_FACT_EXTRACTION_PROMPT = """You are a fact extraction assistant optimized for retrieval. Extract key facts from this conversation with rich metadata to enable semantic search.

For each fact, provide:
1. fact: The core fact statement (clear, concise, third-person)
2. factType: Category (preference, identity, knowledge, relationship, event, observation)
3. category: Specific sub-category for search (e.g., "addressing_preference", "contact_info", "work_info")
4. searchAliases: Array of alternative search terms that should find this fact
5. semanticContext: A sentence explaining when/how to use this information
6. entities: Array of extracted entities with {name, type, fullValue?}
7. relations: Array of {subject, predicate, object} triples
8. confidence: 0-100 confidence score

Example input:
User: "My name is Alexander Johnson and I prefer to be called Alex"
Agent: "Got it, I'll call you Alex!"

Example output:
[{
  "fact": "User prefers to be called Alex",
  "factType": "identity",
  "category": "addressing_preference",
  "searchAliases": ["name", "nickname", "what to call", "address as", "greet", "refer to", "how to address"],
  "semanticContext": "Use 'Alex' when addressing, greeting, or referring to this user",
  "entities": [
    {"name": "Alex", "type": "preferred_name", "fullValue": "Alexander Johnson"},
    {"name": "Alexander Johnson", "type": "full_name"}
  ],
  "relations": [
    {"subject": "user", "predicate": "prefers_to_be_called", "object": "Alex"},
    {"subject": "user", "predicate": "full_name_is", "object": "Alexander Johnson"}
  ],
  "confidence": 95
}]

Now extract facts from this conversation:
User: {user_message}
Agent: {agent_response}

Return ONLY a valid JSON array. If no facts to extract, return [].
"""


async def extract_facts_enriched(
    user_message: str, agent_response: str, max_retries: int = 3
) -> Optional[List[dict]]:
    """
    Extract enriched facts from a conversation for bullet-proof retrieval.
    
    This function extracts facts with rich metadata including:
    - searchAliases: Alternative search terms
    - semanticContext: Usage context sentence
    - entities: Extracted entities with types
    - relations: Subject-predicate-object triples
    
    Args:
        user_message: The user's message
        agent_response: The agent's response
        max_retries: Maximum number of retries on transient failures (default: 3)
        
    Returns:
        List of enriched fact dictionaries, or None if API unavailable
        
    Example:
        >>> facts = await extract_facts_enriched(
        ...     "My name is Alexander Johnson and I prefer to be called Alex",
        ...     "Got it, I'll call you Alex!"
        ... )
        >>> print(facts[0]["searchAliases"])
        ["name", "nickname", "what to call", "address as", ...]
    """
    import asyncio
    import json

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        print("Warning: OPENAI_API_KEY not set for enriched fact extraction")
        return None

    prompt = ENRICHED_FACT_EXTRACTION_PROMPT.format(
        user_message=user_message,
        agent_response=agent_response
    )

    for attempt in range(max_retries):
        try:
            from openai import OpenAI

            client = OpenAI(api_key=api_key, timeout=60.0)

            response = client.chat.completions.create(
                model="gpt-4.1-nano",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a fact extraction assistant. Return only valid JSON.",
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
                temperature=0.2,  # Low temperature for consistency
            )

            content = response.choices[0].message.content
            
            # Parse JSON response
            try:
                # Handle potential markdown code blocks
                if content.startswith("```"):
                    content = content.split("```")[1]
                    if content.startswith("json"):
                        content = content[4:]
                content = content.strip()
                
                facts = json.loads(content)
                
                # Validate structure
                if not isinstance(facts, list):
                    print(f"Warning: Expected list, got {type(facts)}")
                    return []
                
                # Validate each fact has required fields
                validated_facts = []
                for fact in facts:
                    if isinstance(fact, dict) and "fact" in fact:
                        # Ensure all expected fields exist with defaults
                        validated_fact = {
                            "fact": fact.get("fact", ""),
                            "factType": fact.get("factType", "knowledge"),
                            "category": fact.get("category", "general"),
                            "searchAliases": fact.get("searchAliases", []),
                            "semanticContext": fact.get("semanticContext", ""),
                            "entities": fact.get("entities", []),
                            "relations": fact.get("relations", []),
                            "confidence": fact.get("confidence", 70),
                        }
                        validated_facts.append(validated_fact)
                
                return validated_facts

            except json.JSONDecodeError as e:
                print(f"Warning: Failed to parse JSON response: {e}")
                print(f"  Response was: {content[:200]}...")
                return []

        except ImportError:
            print("Warning: openai package not installed")
            return None

        except Exception as e:
            error_msg = str(e)
            print(f"Warning: Enriched fact extraction failed (attempt {attempt + 1}/{max_retries}): {error_msg}")

            is_retryable = any(keyword in error_msg.lower() for keyword in [
                "rate limit", "timeout", "connection", "503", "502", "500"
            ])

            if is_retryable and attempt < max_retries - 1:
                wait_time = 2 ** attempt
                print(f"  Retrying in {wait_time}s...")
                await asyncio.sleep(wait_time)
                continue

            return None

    print(f"Error: Enriched fact extraction failed after {max_retries} attempts")
    return None


def build_enriched_content(fact: dict) -> str:
    """
    Build concatenated searchable content from an enriched fact.
    
    This creates a single string with maximum semantic surface area
    for embedding generation, combining:
    - The core fact
    - Category information
    - Search aliases
    - Semantic context
    
    Args:
        fact: Enriched fact dictionary
        
    Returns:
        Concatenated string optimized for embedding
        
    Example:
        >>> content = build_enriched_content({
        ...     "fact": "User prefers to be called Alex",
        ...     "category": "addressing_preference",
        ...     "searchAliases": ["name", "nickname"],
        ...     "semanticContext": "Use 'Alex' when addressing this user"
        ... })
        >>> "addressing" in content
        True
    """
    parts = [fact.get("fact", "")]
    
    category = fact.get("category")
    if category:
        parts.append(f"Category: {category}")
    
    aliases = fact.get("searchAliases", [])
    if aliases:
        parts.append(f"Search terms: {', '.join(aliases)}")
    
    context = fact.get("semanticContext")
    if context:
        parts.append(f"Context: {context}")
    
    return "\n".join(parts)

