"""
Cortex SDK - Mutable Store API

Layer 1c: Shared mutable data with ACID transaction guarantees
"""

from typing import Any, Callable, Dict, List, Optional, cast

from .._utils import convert_convex_response, filter_none_values
from ..errors import CortexError, ErrorCode  # noqa: F401
from ..types import (
    CountMutableFilter,
    DeleteMutableOptions,
    ListMutableFilter,
    MutableOperation,
    MutableRecord,
    PurgeManyMutableFilter,
    PurgeNamespaceOptions,
    SetMutableOptions,
    TransactionResult,
)
from .validators import (
    MutableValidationError,
    validate_amount,
    validate_count_filter,
    validate_key,
    validate_key_format,
    validate_list_filter,
    validate_namespace,
    validate_namespace_format,
    validate_operations_array,
    validate_purge_filter,
    validate_purge_namespace_options,
    validate_transaction_operations,
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
        metadata: Optional[Dict[str, Any]] = None,
        options: Optional[SetMutableOptions] = None,
    ) -> MutableRecord:
        """
        Set a key to a value (creates or overwrites).

        Args:
            namespace: Logical grouping (e.g., 'inventory', 'config')
            key: Unique key within namespace
            value: JSON-serializable value
            user_id: Optional user link (enables GDPR cascade)
            metadata: Optional metadata dictionary
            options: Optional settings (syncToGraph)

        Returns:
            Mutable record

        Example:
            >>> record = await cortex.mutable.set('inventory', 'widget-qty', 100)
            >>> record = await cortex.mutable.set(
            ...     'config', 'timeout', 30,
            ...     metadata={'unit': 'seconds'}
            ... )
        """
        # Client-side validation
        validate_namespace(namespace)
        validate_namespace_format(namespace)
        validate_key(key)
        validate_key_format(key)
        validate_value_size(value)

        if user_id is not None:
            validate_user_id(user_id)

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "mutable:set",
                filter_none_values({
                    "namespace": namespace,
                    "key": key,
                    "value": value,
                    "userId": user_id,
                    "metadata": metadata,
                }),
            ),
            "mutable:set",
        )

        # Sync to graph if requested
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                await self.graph_adapter.create_node({
                    "label": "Mutable",
                    "properties": {
                        "namespace": namespace,
                        "key": key,
                        "value": value,
                        "userId": user_id,
                        "metadata": metadata,
                    },
                })
            except Exception as e:
                import warnings
                warnings.warn(f"Failed to sync mutable to graph: {e}")

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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "mutable:get", filter_none_values({"namespace": namespace, "key": key})
            ),
            "mutable:get",
        )

        # Return just the value, not the full record (use get_record for full record)
        return result["value"] if result else None

    async def update(
        self, namespace: str, key: str, updater: Callable[[Any], Any]
    ) -> MutableRecord:
        """
        Atomic update using updater function.

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

        # Get current value
        current_value = await self.get(namespace, key)

        # Apply updater function
        new_value = updater(current_value)

        # Use backend update mutation with "custom" operation
        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "mutable:update",
                filter_none_values({
                    "namespace": namespace,
                    "key": key,
                    "operation": "custom",
                    "operand": new_value,
                }),
            ),
            "mutable:update",
        )

        return MutableRecord(**convert_convex_response(result))

    async def increment(
        self, namespace: str, key: str, amount: int = 1
    ) -> MutableRecord:
        """
        Increment a numeric value atomically.

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

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "mutable:update",
                filter_none_values({
                    "namespace": namespace,
                    "key": key,
                    "operation": "increment",
                    "operand": amount,
                }),
            ),
            "mutable:increment",
        )

        return MutableRecord(**convert_convex_response(result))

    async def decrement(
        self, namespace: str, key: str, amount: int = 1
    ) -> MutableRecord:
        """
        Decrement a numeric value atomically.

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

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "mutable:update",
                filter_none_values({
                    "namespace": namespace,
                    "key": key,
                    "operation": "decrement",
                    "operand": amount,
                }),
            ),
            "mutable:decrement",
        )

        return MutableRecord(**convert_convex_response(result))

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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "mutable:get", filter_none_values({"namespace": namespace, "key": key})
            ),
            "mutable:get",
        )

        if not result:
            return None

        return MutableRecord(**convert_convex_response(result))

    async def delete(
        self,
        namespace: str,
        key: str,
        options: Optional[DeleteMutableOptions] = None,
    ) -> Dict[str, Any]:
        """
        Delete a key.

        Args:
            namespace: Namespace
            key: Key
            options: Optional settings (syncToGraph)

        Returns:
            Deletion result with deleted, namespace, key

        Example:
            >>> await cortex.mutable.delete('inventory', 'discontinued-widget')
        """
        # Client-side validation
        validate_namespace(namespace)
        validate_namespace_format(namespace)
        validate_key(key)
        validate_key_format(key)

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "mutable:deleteKey", filter_none_values({"namespace": namespace, "key": key})
            ),
            "mutable:delete",
        )

        # Delete from graph if requested
        if options and options.sync_to_graph and self.graph_adapter:
            try:
                # Find and delete the mutable node from graph
                from ..graph import delete_mutable_from_graph
                await delete_mutable_from_graph(namespace, key, self.graph_adapter)
            except Exception as e:
                import warnings
                warnings.warn(f"Failed to delete mutable from graph: {e}")

        return cast(Dict[str, Any], result)

    async def purge(
        self,
        namespace: str,
        key: str,
    ) -> Dict[str, Any]:
        """
        Purge a key (alias for delete - for API consistency).

        Args:
            namespace: Namespace
            key: Key

        Returns:
            Deletion result with deleted, namespace, key

        Example:
            >>> await cortex.mutable.purge('inventory', 'discontinued-item')
        """
        # Client-side validation (same as delete)
        validate_namespace(namespace)
        validate_namespace_format(namespace)
        validate_key(key)
        validate_key_format(key)

        return await self.delete(namespace, key)

    async def list(self, filter: ListMutableFilter) -> List[MutableRecord]:
        """
        List keys in namespace.

        Args:
            filter: Filter options for listing keys
                - namespace: Required namespace to list
                - key_prefix: Filter by key prefix
                - user_id: Filter by user
                - limit: Max results (default: 100)
                - offset: Pagination offset
                - updated_after: Filter by updatedAt > timestamp
                - updated_before: Filter by updatedAt < timestamp
                - sort_by: Sort by "key" | "updatedAt" | "accessCount"
                - sort_order: Sort order "asc" | "desc"

        Returns:
            List of matching MutableRecord objects

        Example:
            >>> from cortex.types import ListMutableFilter
            >>> items = await cortex.mutable.list(ListMutableFilter(
            ...     namespace='inventory',
            ...     key_prefix='widget-',
            ...     sort_by='updatedAt',
            ...     sort_order='desc',
            ...     limit=50,
            ... ))
        """
        # Client-side validation
        validate_list_filter(filter)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "mutable:list",
                filter_none_values({
                    "namespace": filter.namespace,
                    "keyPrefix": filter.key_prefix,
                    "userId": filter.user_id,
                    "limit": filter.limit,
                    "offset": filter.offset,
                    "updatedAfter": filter.updated_after,
                    "updatedBefore": filter.updated_before,
                    "sortBy": filter.sort_by,
                    "sortOrder": filter.sort_order,
                }),
            ),
            "mutable:list",
        )

        return [MutableRecord(**convert_convex_response(record)) for record in result]

    async def count(self, filter: CountMutableFilter) -> int:
        """
        Count keys in namespace.

        Args:
            filter: Filter options for counting keys
                - namespace: Required namespace to count
                - user_id: Filter by user
                - key_prefix: Filter by key prefix
                - updated_after: Filter by updatedAt > timestamp
                - updated_before: Filter by updatedAt < timestamp

        Returns:
            Count of matching keys

        Example:
            >>> from cortex.types import CountMutableFilter
            >>> count = await cortex.mutable.count(CountMutableFilter(
            ...     namespace='inventory',
            ...     updated_after=last_24_hours_timestamp,
            ... ))
        """
        # Client-side validation
        validate_count_filter(filter)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "mutable:count",
                filter_none_values({
                    "namespace": filter.namespace,
                    "userId": filter.user_id,
                    "keyPrefix": filter.key_prefix,
                    "updatedAfter": filter.updated_after,
                    "updatedBefore": filter.updated_before,
                }),
            ),
            "mutable:count",
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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "mutable:exists", filter_none_values({"namespace": namespace, "key": key})
            ),
            "mutable:exists",
        )

        return bool(result)

    async def purge_namespace(
        self,
        namespace: str,
        options: Optional[PurgeNamespaceOptions] = None,
    ) -> Dict[str, Any]:
        """
        Purge all keys in a namespace.

        Args:
            namespace: Namespace to purge
            options: Optional settings
                - dry_run: If True, returns what would be deleted without deleting

        Returns:
            Purge result with deleted count, namespace, and optionally keys (in dryRun mode)

        Example:
            >>> from cortex.types import PurgeNamespaceOptions
            >>> # Preview what would be deleted
            >>> preview = await cortex.mutable.purge_namespace(
            ...     'temp-cache',
            ...     PurgeNamespaceOptions(dry_run=True)
            ... )
            >>> print(f"Would delete {preview['deleted']} keys")
            >>>
            >>> # Actually delete
            >>> result = await cortex.mutable.purge_namespace('temp-cache')
            >>> print(f"Deleted {result['deleted']} keys")
        """
        # Client-side validation
        validate_namespace(namespace)
        validate_namespace_format(namespace)
        validate_purge_namespace_options(options)

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "mutable:purgeNamespace",
                filter_none_values({
                    "namespace": namespace,
                    "dryRun": options.dry_run if options else None,
                }),
            ),
            "mutable:purgeNamespace",
        )

        return cast(Dict[str, Any], result)

    async def purge_many(self, filter: PurgeManyMutableFilter) -> Dict[str, Any]:
        """
        Bulk delete keys matching filters.

        Args:
            filter: Filter options for deleting keys
                - namespace: Required namespace to purge from
                - key_prefix: Filter by key prefix
                - user_id: Filter by user
                - updated_before: Delete keys updated before this timestamp
                - last_accessed_before: Delete keys last accessed before this timestamp

        Returns:
            Result with deleted count, namespace, and deleted keys

        Example:
            >>> from cortex.types import PurgeManyMutableFilter
            >>> # Delete keys with prefix
            >>> await cortex.mutable.purge_many(PurgeManyMutableFilter(
            ...     namespace='cache',
            ...     key_prefix='temp-',
            ... ))
            >>>
            >>> # Delete old keys
            >>> await cortex.mutable.purge_many(PurgeManyMutableFilter(
            ...     namespace='cache',
            ...     updated_before=thirty_days_ago_timestamp,
            ... ))
            >>>
            >>> # Delete inactive keys
            >>> await cortex.mutable.purge_many(PurgeManyMutableFilter(
            ...     namespace='sessions',
            ...     last_accessed_before=seven_days_ago_timestamp,
            ... ))
        """
        # Client-side validation
        validate_purge_filter(filter)

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "mutable:purgeMany",
                filter_none_values({
                    "namespace": filter.namespace,
                    "keyPrefix": filter.key_prefix,
                    "userId": filter.user_id,
                    "updatedBefore": filter.updated_before,
                    "lastAccessedBefore": filter.last_accessed_before,
                }),
            ),
            "mutable:purgeMany",
        )

        return cast(Dict[str, Any], result)

    async def transaction(
        self,
        operations: List[MutableOperation],
    ) -> TransactionResult:
        """
        Execute multiple operations atomically.

        Args:
            operations: Array of operations to execute atomically
                Each operation has:
                - op: "set" | "update" | "delete" | "increment" | "decrement"
                - namespace: Target namespace
                - key: Target key
                - value: Value for set/update operations
                - amount: Amount for increment/decrement operations

        Returns:
            TransactionResult with success, operations_executed, and results

        Example:
            >>> from cortex.types import MutableOperation
            >>> await cortex.mutable.transaction([
            ...     MutableOperation(op='increment', namespace='counters', key='sales', amount=1),
            ...     MutableOperation(op='decrement', namespace='inventory', key='widget-qty', amount=1),
            ...     MutableOperation(op='set', namespace='state', key='last-sale', value=timestamp),
            ... ])
        """
        # Client-side validation
        validate_operations_array(operations)
        validate_transaction_operations(operations)

        # Convert operations to backend format
        ops_for_backend = [
            filter_none_values({
                "op": op.op,
                "namespace": op.namespace,
                "key": op.key,
                "value": op.value,
                "amount": op.amount,
            })
            for op in operations
        ]

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "mutable:transaction",
                {"operations": ops_for_backend},
            ),
            "mutable:transaction",
        )

        return TransactionResult(
            success=result["success"],
            operations_executed=result["operationsExecuted"],
            results=result.get("results", []),
        )

