"""
Storage validation utilities for Cortex Python SDK tests.

Provides functions to validate SDK responses against Convex storage.
"""

from typing import Any, Dict, Optional

from cortex import Cortex


async def validate_conversation_storage(
    cortex_client: Cortex, conversation_id: str, expected_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Validate conversation exists in Convex storage.

    Args:
        cortex_client: Cortex SDK instance
        conversation_id: Conversation ID to validate
        expected_data: Optional expected fields to validate

    Returns:
        Dictionary with validation results
    """
    result = {
        "exists": False,
        "matches": False,
        "data": None,
        "errors": [],
    }

    try:
        # Query Convex storage directly
        stored = await cortex_client.client.query(
            "conversations:get", {"conversationId": conversation_id}
        )

        if stored:
            result["exists"] = True
            result["data"] = stored

            # Validate expected data if provided
            if expected_data:
                matches = True
                for key, expected_value in expected_data.items():
                    stored_value = stored.get(key)
                    if stored_value != expected_value:
                        matches = False
                        result["errors"].append(
                            f"Field '{key}': expected {expected_value}, got {stored_value}"
                        )

                result["matches"] = matches
            else:
                result["matches"] = True

    except Exception as e:
        result["errors"].append(f"Storage validation failed: {str(e)}")

    return result


async def validate_memory_storage(
    cortex_client: Cortex,
    memory_space_id: str,
    memory_id: str,
    expected_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Validate memory exists in Convex storage.

    Args:
        cortex_client: Cortex SDK instance
        memory_space_id: Memory space ID
        memory_id: Memory ID to validate
        expected_data: Optional expected fields to validate

    Returns:
        Dictionary with validation results
    """
    result = {
        "exists": False,
        "matches": False,
        "data": None,
        "errors": [],
    }

    try:
        # Query Convex storage directly
        stored = await cortex_client.client.query(
            "memories:get", {"memorySpaceId": memory_space_id, "memoryId": memory_id}
        )

        if stored:
            result["exists"] = True
            result["data"] = stored

            # Validate expected data if provided
            if expected_data:
                matches = True
                for key, expected_value in expected_data.items():
                    stored_value = stored.get(key)
                    if stored_value != expected_value:
                        matches = False
                        result["errors"].append(
                            f"Field '{key}': expected {expected_value}, got {stored_value}"
                        )

                result["matches"] = matches
            else:
                result["matches"] = True

    except Exception as e:
        result["errors"].append(f"Storage validation failed: {str(e)}")

    return result


async def validate_fact_storage(
    cortex_client: Cortex,
    memory_space_id: str,
    fact_id: str,
    expected_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Validate fact exists in Convex storage.

    Args:
        cortex_client: Cortex SDK instance
        memory_space_id: Memory space ID
        fact_id: Fact ID to validate
        expected_data: Optional expected fields to validate

    Returns:
        Dictionary with validation results
    """
    result = {
        "exists": False,
        "matches": False,
        "data": None,
        "errors": [],
    }

    try:
        # Query Convex storage directly
        stored = await cortex_client.client.query(
            "facts:get", {"memorySpaceId": memory_space_id, "factId": fact_id}
        )

        if stored:
            result["exists"] = True
            result["data"] = stored

            # Validate expected data if provided
            if expected_data:
                matches = True
                for key, expected_value in expected_data.items():
                    stored_value = stored.get(key)
                    if stored_value != expected_value:
                        matches = False
                        result["errors"].append(
                            f"Field '{key}': expected {expected_value}, got {stored_value}"
                        )

                result["matches"] = matches
            else:
                result["matches"] = True

    except Exception as e:
        result["errors"].append(f"Storage validation failed: {str(e)}")

    return result


async def validate_user_storage(
    cortex_client: Cortex, user_id: str, expected_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Validate user exists in Convex storage.

    Args:
        cortex_client: Cortex SDK instance
        user_id: User ID to validate
        expected_data: Optional expected fields to validate

    Returns:
        Dictionary with validation results
    """
    result = {
        "exists": False,
        "matches": False,
        "data": None,
        "errors": [],
    }

    try:
        # Query Convex storage directly
        stored = await cortex_client.client.query("users:get", {"userId": user_id})

        if stored:
            result["exists"] = True
            result["data"] = stored

            # Validate expected data if provided
            if expected_data:
                matches = True
                for key, expected_value in expected_data.items():
                    stored_value = stored.get(key)
                    if stored_value != expected_value:
                        matches = False
                        result["errors"].append(
                            f"Field '{key}': expected {expected_value}, got {stored_value}"
                        )

                result["matches"] = matches
            else:
                result["matches"] = True

    except Exception as e:
        result["errors"].append(f"Storage validation failed: {str(e)}")

    return result

