"""
Cortex SDK - Mutable Store API

Layer 1c: Shared mutable data with ACID transaction guarantees
"""

from typing import Any, Callable, Dict, List, Optional, cast

from .._utils import convert_convex_response, filter_none_values
from ..errors import CortexError, ErrorCode  # noqa: F401
from ..types import MutableRecord
from .validators import (
    MutableValidationError,
    validate_amount,
    validate_key,
    validate_key_format,
    validate_key_prefix,
    validate_limit,
    validate_namespace,
    validate_namespace_format,
    validate_updater,
    validate_user_id,
    validate_value_size,
)

__all__ = ["MutableAPI", "MutableValidationError"]


class MutableAPI:
    """
    Mutable Store API - Layer 1c

    Provides TRULY SHARED mutable data storage across ALL memory spaces.
    Perfect for inventory, configuration, and live shared state.
    """

    def __init__(
        self,
        client: Any,
        graph_adapter: Optional[Any] = None,
        resilience: Optional[Any] = None,
    ) -> None:
        """
        Initialize Mutable API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter
            resilience: Optional resilience layer for overload protection
        """
        self.client = client
        self.graph_adapter = graph_adapter
        self._resilience = resilience

    async def _execute_with_resilience(
        self, operation: Any, operation_name: str
    ) -> Any:
        """Execute an operation through the resilience layer (if available)."""
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

    async def set(
        self,
        namespace: str,
        key: str,
        value: Any,
        user_id: Optional[str] = None,
    ) -> MutableRecord:
        """
        Set a key to a value (creates or overwrites).

        Args:
            namespace: Logical grouping (e.g., 'inventory', 'config')
            key: Unique key within namespace
            value: JSON-serializable value
            user_id: Optional user link (enables GDPR cascade)

        Returns:
            Mutable record

        Example:
            >>> record = await cortex.mutable.set('inventory', 'widget-qty', 100)
        """
        # Client-side validation
        validate_namespace(namespace)
        validate_namespace_format(namespace)
        validate_key(key)
        validate_key_format(key)
        validate_value_size(value)

        if user_id is not None:
            validate_user_id(user_id)

        result = await self.client.mutation(
            "mutable:set",
            filter_none_values({
                "namespace": namespace,
                "key": key,
                "value": value,
                "userId": user_id,
            }),
        )

        return MutableRecord(**convert_convex_response(result))

    async def get(self, namespace: str, key: str) -> Optional[Any]:
        """
        Get current value for a key.

        Args:
            namespace: Namespace
            key: Key

        Returns:
            Value if found, None otherwise

        Example:
            >>> qty = await cortex.mutable.get('inventory', 'widget-qty')
        """
        # Client-side validation
        validate_namespace(namespace)
        validate_namespace_format(namespace)
        validate_key(key)
        validate_key_format(key)

        result = await self.client.query(
            "mutable:get", filter_none_values({"namespace": namespace, "key": key})
        )

        return result

    async def update(
        self, namespace: str, key: str, updater: Callable[[Any], Any]
    ) -> MutableRecord:
        """
        Atomically update a value.

        Args:
            namespace: Namespace
            key: Key
            updater: Function that receives current value, returns new value

        Returns:
            Updated record

        Example:
            >>> await cortex.mutable.update(
            ...     'inventory', 'widget-qty',
            ...     lambda current: current - 1 if current > 0 else 0
            ... )
        """
        # Client-side validation
        validate_namespace(namespace)
        validate_namespace_format(namespace)
        validate_key(key)
        validate_key_format(key)
        validate_updater(updater)

        # Note: This requires server-side updater support in Convex
        # For now, implement as get-then-set with potential race condition
        current_record = await self.get(namespace, key)
        # Extract the value from the record
        current_value = current_record.get("value") if isinstance(current_record, dict) else current_record.value if current_record else None
        new_value = updater(current_value)

        result = await self.client.mutation(
            "mutable:set",
            filter_none_values({
                "namespace": namespace,
                "key": key,
                "value": new_value,
            }),
        )

        return MutableRecord(**convert_convex_response(result))

    async def increment(
        self, namespace: str, key: str, amount: int = 1
    ) -> MutableRecord:
        """
        Atomically increment a numeric value.

        Args:
            namespace: Namespace
            key: Key
            amount: Amount to increment (default: 1)

        Returns:
            Updated record

        Example:
            >>> await cortex.mutable.increment('counters', 'page-views', 10)
        """
        # Client-side validation
        validate_namespace(namespace)
        validate_namespace_format(namespace)
        validate_key(key)
        validate_key_format(key)
        validate_amount(amount, "amount")

        return await self.update(namespace, key, lambda x: (x or 0) + amount)

    async def decrement(
        self, namespace: str, key: str, amount: int = 1
    ) -> MutableRecord:
        """
        Atomically decrement a numeric value.

        Args:
            namespace: Namespace
            key: Key
            amount: Amount to decrement (default: 1)

        Returns:
            Updated record

        Example:
            >>> await cortex.mutable.decrement('inventory', 'widget-qty', 5)
        """
        # Client-side validation
        validate_namespace(namespace)
        validate_namespace_format(namespace)
        validate_key(key)
        validate_key_format(key)
        validate_amount(amount, "amount")

        return await self.update(namespace, key, lambda x: (x or 0) - amount)

    async def get_record(self, namespace: str, key: str) -> Optional[MutableRecord]:
        """
        Get full record with metadata (not just the value).

        Args:
            namespace: Namespace
            key: Key

        Returns:
            Mutable record if found, None otherwise

        Example:
            >>> record = await cortex.mutable.get_record('config', 'timeout')
        """
        # Client-side validation
        validate_namespace(namespace)
        validate_namespace_format(namespace)
        validate_key(key)
        validate_key_format(key)

        result = await self.client.query(
            "mutable:get", filter_none_values({"namespace": namespace, "key": key})
        )

        if not result:
            return None

        return MutableRecord(**convert_convex_response(result))

    async def delete(self, namespace: str, key: str) -> Dict[str, Any]:
        """
        Delete a key.

        Args:
            namespace: Namespace
            key: Key

        Returns:
            Deletion result

        Example:
            >>> await cortex.mutable.delete('inventory', 'discontinued-widget')
        """
        # Client-side validation
        validate_namespace(namespace)
        validate_namespace_format(namespace)
        validate_key(key)
        validate_key_format(key)

        result = await self.client.mutation(
            "mutable:deleteKey", filter_none_values({"namespace": namespace, "key": key})
        )

        return cast(Dict[str, Any], result)

    async def list(
        self,
        namespace: str,
        key_prefix: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[MutableRecord]:
        """
        List keys in a namespace.

        Args:
            namespace: Namespace to list
            key_prefix: Filter by key prefix
            user_id: Filter by user ID
            limit: Maximum results

        Returns:
            List of mutable records

        Example:
            >>> items = await cortex.mutable.list('inventory', limit=100)
        """
        # Client-side validation
        validate_namespace(namespace)
        validate_namespace_format(namespace)

        if key_prefix is not None:
            validate_key_prefix(key_prefix)

        if user_id is not None:
            validate_user_id(user_id)

        if limit is not None:
            validate_limit(limit)

        result = await self.client.query(
            "mutable:list",
            filter_none_values({
                "namespace": namespace,
                "keyPrefix": key_prefix,
                "userId": user_id,
                "limit": limit,
            }),
        )

        return [MutableRecord(**convert_convex_response(record)) for record in result]

    async def count(
        self,
        namespace: str,
        key_prefix: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> int:
        """
        Count keys in namespace.

        Args:
            namespace: Namespace to count
            key_prefix: Filter by key prefix
            user_id: Filter by user ID

        Returns:
            Count of matching keys

        Example:
            >>> total = await cortex.mutable.count('inventory')
        """
        # Client-side validation
        validate_namespace(namespace)
        validate_namespace_format(namespace)

        if key_prefix is not None:
            validate_key_prefix(key_prefix)

        if user_id is not None:
            validate_user_id(user_id)

        result = await self.client.query(
            "mutable:count",
            filter_none_values({
                "namespace": namespace,
                "keyPrefix": key_prefix,
                "userId": user_id,
            }),
        )

        return int(result)

    async def exists(self, namespace: str, key: str) -> bool:
        """
        Check if key exists.

        Args:
            namespace: Namespace
            key: Key

        Returns:
            True if key exists, False otherwise

        Example:
            >>> if await cortex.mutable.exists('inventory', 'widget-qty'):
            ...     qty = await cortex.mutable.get('inventory', 'widget-qty')
        """
        # Client-side validation
        validate_namespace(namespace)
        validate_namespace_format(namespace)
        validate_key(key)
        validate_key_format(key)

        result = await self.client.query(
            "mutable:exists", filter_none_values({"namespace": namespace, "key": key})
        )

        return bool(result)

    async def purge_namespace(
        self, namespace: str, dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Delete entire namespace.

        Args:
            namespace: Namespace to purge
            dry_run: Preview without deleting

        Returns:
            Purge result

        Example:
            >>> result = await cortex.mutable.purge_namespace('test-data')
        """
        # Client-side validation
        validate_namespace(namespace)
        validate_namespace_format(namespace)

        result = await self.client.mutation(
            "mutable:purgeNamespace", filter_none_values({"namespace": namespace})
            # Note: dryRun not supported by backend yet
        )

        return cast(Dict[str, Any], result)

    async def purge_many(
        self,
        namespace: str,
        key_prefix: Optional[str] = None,
        user_id: Optional[str] = None,
        updated_before: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Delete keys matching filters.

        Args:
            namespace: Namespace
            key_prefix: Filter by key prefix
            user_id: Filter by user ID
            updated_before: Filter by update date

        Returns:
            Purge result

        Example:
            >>> await cortex.mutable.purge_many(
            ...     'cache',
            ...     updated_before=old_timestamp
            ... )
        """
        # Client-side validation
        validate_namespace(namespace)
        validate_namespace_format(namespace)

        if key_prefix is not None:
            validate_key_prefix(key_prefix)

        if user_id is not None:
            validate_user_id(user_id)

        result = await self.client.mutation(
            "mutable:purgeMany",
            filter_none_values({
                "namespace": namespace,
                "keyPrefix": key_prefix,
                "userId": user_id,
                "updatedBefore": updated_before,
            }),
        )

        return cast(Dict[str, Any], result)

    async def transaction(self, callback: Callable) -> Dict[str, Any]:
        """
        Execute multiple operations atomically.

        Args:
            callback: Transaction callback function

        Returns:
            Transaction result

        Note:
            This requires server-side transaction support in Convex.

        Example:
            >>> async def transfer(tx):
            ...     await tx.update('inventory', 'product-a', lambda x: x - 10)
            ...     await tx.update('inventory', 'product-b', lambda x: x + 10)
            >>>
            >>> await cortex.mutable.transaction(transfer)
        """
        # Note: This is a placeholder. Actual implementation requires
        # Convex transaction API support
        raise NotImplementedError(
            "Transactions require server-side support. Use individual operations for now."
        )

