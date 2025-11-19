"""
Utility functions for Cortex SDK
"""

import re
from typing import Any, Dict


def filter_none_values(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Filter out None values from arguments.

    Convex doesn't accept None/null for optional parameters - they should be omitted.

    Args:
        args: Dictionary that may contain None values

    Returns:
        Dictionary with None values removed

    Example:
        >>> filter_none_values({"a": 1, "b": None, "c": "test"})
        {"a": 1, "c": "test"}
    """
    return {k: v for k, v in args.items() if v is not None}


def camel_to_snake(name: str) -> str:
    """
    Convert camelCase to snake_case.

    Args:
        name: camelCase string

    Returns:
        snake_case string

    Example:
        >>> camel_to_snake("conversationId")
        "conversation_id"
        >>> camel_to_snake("memorySpaceId")
        "memory_space_id"
    """
    # Insert underscore before uppercase letters and convert to lowercase
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).lower()


def convert_convex_response(data: Any) -> Any:
    """
    Convert Convex response to Python-friendly format.

    - Converts camelCase to snake_case
    - Removes Convex internal fields (_creationTime, etc., except _id)
    - Recursively processes nested dicts and lists

    Args:
        data: Response data from Convex

    Returns:
        Converted data ready for dataclass instantiation

    Example:
        >>> convert_convex_response({
        ...     "_id": "123",
        ...     "_creationTime": 456,
        ...     "conversationId": "conv-1",
        ...     "memorySpaceId": "space-1"
        ... })
        {
            "_id": "123",
            "conversation_id": "conv-1",
            "memory_space_id": "space-1"
        }
    """
    if isinstance(data, dict):
        converted = {}
        for key, value in data.items():
            # Skip Convex internal fields except _id and _score
            # _score is added by vector search for similarity ranking
            if key.startswith("_") and key not in ("_id", "_score"):
                continue

            # Convert key to snake_case
            new_key = camel_to_snake(key)

            # Recursively convert nested structures
            converted[new_key] = convert_convex_response(value)

        return converted

    elif isinstance(data, list):
        return [convert_convex_response(item) for item in data]

    else:
        return data

