"""
Test data generators for Cortex Python SDK tests.

Provides functions to generate unique IDs and sample test data.
"""

import random
import time
from typing import Any, Dict, List, Optional

from cortex import (
    ConversationParticipants,
    CreateConversationInput,
    MemoryMetadata,
    MemorySource,
    StoreMemoryInput,
)


def generate_test_user_id() -> str:
    """
    Generate a unique test user ID.

    Returns:
        Unique user ID with test prefix
    """
    timestamp = int(time.time() * 1000)
    rand = random.randint(1000, 9999)
    return f"test-user-{timestamp}-{rand}"


def generate_test_memory_space_id() -> str:
    """
    Generate a unique test memory space ID.

    Returns:
        Unique memory space ID with test prefix
    """
    timestamp = int(time.time() * 1000)
    rand = random.randint(1000, 9999)
    return f"test-space-{timestamp}-{rand}"


def generate_e2e_test_memory_space_id() -> str:
    """
    Generate a unique e2e-test memory space ID.

    Returns:
        Unique memory space ID with e2e-test prefix
    """
    timestamp = int(time.time() * 1000)
    rand = random.randint(1000, 9999)
    return f"e2e-test-space-{timestamp}-{rand}"


def generate_test_conversation_id() -> str:
    """
    Generate a unique test conversation ID.

    Returns:
        Unique conversation ID with test prefix
    """
    timestamp = int(time.time() * 1000)
    rand = random.randint(1000, 9999)
    return f"test-conv-{timestamp}-{rand}"


def generate_test_agent_id() -> str:
    """
    Generate a unique test agent ID.

    Returns:
        Unique agent ID with test prefix
    """
    timestamp = int(time.time() * 1000)
    rand = random.randint(1000, 9999)
    return f"test-agent-{timestamp}-{rand}"


def generate_test_memory_id() -> str:
    """
    Generate a unique test memory ID.

    Returns:
        Unique memory ID with test prefix
    """
    timestamp = int(time.time() * 1000)
    rand = random.randint(1000, 9999)
    return f"mem-test-{timestamp}-{rand}"


def generate_test_fact_id() -> str:
    """
    Generate a unique test fact ID.

    Returns:
        Unique fact ID with test prefix
    """
    timestamp = int(time.time() * 1000)
    rand = random.randint(1000, 9999)
    return f"fact-test-{timestamp}-{rand}"


def create_test_memory_input(
    content: str = "Test memory content",
    importance: int = 50,
    tags: Optional[List[str]] = None,
) -> StoreMemoryInput:
    """
    Create sample memory input data for testing.

    Args:
        content: Memory content (default: "Test memory content")
        importance: Importance score 0-100 (default: 50)
        tags: Optional list of tags

    Returns:
        StoreMemoryInput object
    """
    return StoreMemoryInput(
        content=content,
        content_type="raw",
        source=MemorySource(type="system", timestamp=int(time.time() * 1000)),
        metadata=MemoryMetadata(importance=importance, tags=tags or ["test"]),
    )


def create_test_fact_input(
    fact: str = "Test fact",
    fact_type: str = "observation",
    confidence: int = 95,
) -> Dict[str, Any]:
    """
    Create sample fact input data for testing.

    Args:
        fact: Fact content (default: "Test fact")
        fact_type: Type of fact (default: "observation")
        confidence: Confidence score 0-100 (default: 95)

    Returns:
        Dictionary with fact input data
    """
    return {
        "fact": fact,
        "fact_type": fact_type,
        "confidence": confidence,
        "source": {"type": "system", "timestamp": int(time.time() * 1000)},
        "metadata": {"tags": ["test"]},
    }


def create_test_conversation_input(
    memory_space_id: str,
    user_id: Optional[str] = None,
    participant_id: Optional[str] = None,
    agent_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
) -> CreateConversationInput:
    """
    Create sample conversation input for testing.

    Args:
        memory_space_id: Memory space ID
        user_id: Optional user ID (generates one if not provided)
        participant_id: Optional participant ID (generates one if not provided)
        agent_id: Optional agent ID (defaults to participant_id if not provided)
        conversation_id: Optional conversation ID (generates one if not provided)

    Returns:
        CreateConversationInput object
    """
    generated_participant = participant_id or generate_test_agent_id()
    return CreateConversationInput(
        memory_space_id=memory_space_id,
        conversation_id=conversation_id,
        type="user-agent",
        participants=ConversationParticipants(
            user_id=user_id or generate_test_user_id(),
            agent_id=agent_id or generated_participant,
            participant_id=generated_participant,
        ),
    )


def create_test_user_profile(name: str = "Test User") -> Dict[str, Any]:
    """
    Create sample user profile data for testing.

    Args:
        name: User name (default: "Test User")

    Returns:
        Dictionary with user profile data
    """
    return {
        "name": name,
        "preferences": {"theme": "dark", "language": "en"},
        "metadata": {"test": True, "created": int(time.time() * 1000)},
    }


def create_test_immutable_data(
    data_type: str = "snapshot", value: Any = "test-value"
) -> Dict[str, Any]:
    """
    Create sample immutable record data for testing.

    Args:
        data_type: Type of data (default: "snapshot")
        value: Data value (default: "test-value")

    Returns:
        Dictionary with immutable record data
    """
    return {
        "data_type": data_type,
        "value": value,
        "metadata": {"test": True, "timestamp": int(time.time() * 1000)},
    }


def create_test_mutable_data(value: Any = "test-value") -> Dict[str, Any]:
    """
    Create sample mutable record data for testing.

    Args:
        value: Data value (default: "test-value")

    Returns:
        Dictionary with mutable record data
    """
    return {
        "value": value,
        "metadata": {"test": True, "timestamp": int(time.time() * 1000)},
    }

