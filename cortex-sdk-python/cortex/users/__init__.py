"""
Cortex SDK - Users API

Coordination Layer: User profiles and explicit supported-primary erasure
"""

import time
from typing import Any, AsyncGenerator, Dict, List, Optional, Union, cast

__all__ = ["UsersAPI", "UserValidationError"]

from .._utils import convert_convex_response, filter_none_values  # noqa: F401
from ..errors import CortexError, ErrorCode
from ..types import (
    AuthContext,
    DeleteUserOptions,
    ErasureReceipt,
    ExportUsersOptions,
    ListUsersFilter,
    ListUsersResult,
    UserDeleteResult,
    UserExportEvent,
    UserProfile,
    UserVersion,
    VerificationResult,
)
from .erasure import (
    DomainErasureError,
    ErasureTransport,
    create_erasure_transport,
    execute_erasure,
    prepare_erasure,
)
from .export import (
    UserExportTransport,
    export_user_data,
    resolve_user_export_identity,
    serialize_user_export_event,
)
from .validators import (
    UserValidationError,
    resolve_domain_scope,
    validate_bulk_delete_options,
    validate_bulk_update_options,
    validate_data,
    validate_delete_options,
    validate_export_format,  # noqa: F401 - Re-exported for public API
    validate_export_options,
    validate_limit,  # noqa: F401 - Re-exported for public API
    validate_list_users_filter,
    validate_offset,  # noqa: F401 - Re-exported for public API
    validate_timestamp,
    validate_user_count_filter,
    validate_user_count_result,
    validate_user_id,
    validate_user_ids_array,
    validate_version_number,
)


def _is_user_not_found_error(e: Exception) -> bool:
    """Check if an exception indicates a user/immutable entry was not found.

    This handles the Convex error format which includes the error code
    in the exception message. We check for patterns that indicate the
    user profile doesn't exist.

    Args:
        e: The exception to check

    Returns:
        True if this is a "not found" error for a user/immutable entry
    """
    error_str = str(e)
    # Check for error code patterns from Convex backend
    return (
        "IMMUTABLE_ENTRY_NOT_FOUND" in error_str
        or "USER_NOT_FOUND" in error_str
        or "immutable entry not found" in error_str.lower()
        or "user not found" in error_str.lower()
    )




class UsersAPI:
    """
    Users API

    Provides convenience wrappers over immutable store (type='user') with the
    supported exclusive-primary erasure through explicit maintenance transport.

    Cascade requires the fixed administrator erasure transport and exact tenant scope.
    The returned receipt discloses shared/foreign/operational/provenance residuals.
    A configured graph needs its matching explicit graph participant. This API does
    not guarantee universal physical erasure or legal compliance.
    """

    def __init__(
        self,
        client: Any,
        graph_adapter: Optional[Any] = None,
        resilience: Optional[Any] = None,
        auth_context: Optional[AuthContext] = None,
    ) -> None:
        """
        Initialize Users API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter for cascade deletion
            resilience: Optional resilience layer for overload protection
            auth_context: Optional auth context for multi-tenancy
        """
        self.client = client
        self.graph_adapter = graph_adapter
        self._resilience = resilience
        self._auth_context = auth_context

    def create_export_transport(self, *, url: str, deployment_key: str, timeout: float = 30, socket_timeout: float = 5) -> UserExportTransport:
        """Explicit administration; does not alter the ordinary SDK identity."""
        return UserExportTransport(url, deployment_key, timeout, socket_timeout)

    def create_erasure_transport(self, *, url: str, deployment_key: str,
                                 timeout: float = 30, socket_timeout: float = 5) -> ErasureTransport:
        """Explicit fixed administrator authority, separate from export and user auth."""
        return create_erasure_transport(url=url, deployment_key=deployment_key,
                                        timeout=timeout, socket_timeout=socket_timeout)

    def serialize_export_event(self, event: UserExportEvent) -> str:
        """Canonical JSON text for export_data events; raw values stay unchanged.

        Persist this text rather than plain json.dumps for matching TypeScript
        and Python number/string formatting. Publish only after a validated
        terminal manifest; serialization does not grant completion or access.
        """
        return serialize_user_export_event(event)

    def export_data(
        self,
        user_id: str,
        *,
        transport: UserExportTransport,
        tenant_id: Optional[str] = None,
        page_size: int = 100,
    ) -> AsyncGenerator[UserExportEvent, None]:
        """Stream supported raw records and binaries with deployment administration.

        Only the terminal complete manifest certifies a successful stream. Reads
        are rolling observations, not a global snapshot. Closing or cancelling
        the iterator releases its owned resources; the SDK never publishes files.
        """
        identity = resolve_user_export_identity(user_id, tenant_id, self._tenant_id)
        return cast(AsyncGenerator[UserExportEvent, None], export_user_data(identity, transport, page_size))

    async def _execute_with_resilience(
        self, operation: Any, operation_name: str
    ) -> Any:
        """Execute an operation through the resilience layer (if available)."""
        if self._resilience:
            return await self._resilience.execute(operation, operation_name)
        return await operation()

    @property
    def _tenant_id(self) -> Optional[str]:
        """Get tenant_id from auth context (for multi-tenancy)."""
        return self._auth_context.tenant_id if self._auth_context else None

    async def get(self, user_id: str) -> Optional[UserProfile]:
        """
        Get user profile by ID.

        Args:
            user_id: User ID to retrieve

        Returns:
            User profile if found, None otherwise

        Example:
            >>> user = await cortex.users.get('user-123')
            >>> if user:
            ...     print(user.data['displayName'])
        """
        # Client-side validation
        validate_user_id(user_id)

        tenant_id = resolve_domain_scope(self._tenant_id)

        result = await self._execute_with_resilience(
            lambda: self.client.query("immutable:get", filter_none_values({
                "type": "user",
                "id": user_id,
                "tenantId": tenant_id,  # Multi-tenancy: scope to tenant
            })),
            "immutable:get",
        )

        if not result:
            return None

        if result.get("tenantId") != tenant_id:
            return None

        return UserProfile(
            id=result["id"],
            tenant_id=result.get("tenantId"),  # Include tenantId in response
            data=result["data"],
            version=result["version"],
            created_at=result["createdAt"],
            updated_at=result["updatedAt"],
        )

    async def update(self, user_id: str, data: Dict[str, Any]) -> UserProfile:
        """
        Update user profile (creates new version).

        Args:
            user_id: User ID
            data: User data to store

        Returns:
            Updated user profile

        Example:
            >>> updated = await cortex.users.update(
            ...     'user-123',
            ...     {
            ...         'displayName': 'Alex Johnson',
            ...         'email': 'alex@example.com',
            ...         'preferences': {'theme': 'dark'}
            ...     }
            ... )
        """
        # Client-side validation
        validate_user_id(user_id)
        validate_data(data, "data")

        tenant_id = resolve_domain_scope(self._tenant_id)

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "immutable:store", filter_none_values({
                    "type": "user",
                    "id": user_id,
                    "data": data,
                    "tenantId": tenant_id,  # Inject tenantId from auth context
                })
            ),
            "immutable:store",
        )

        if not result:
            raise CortexError(
                ErrorCode.CONVEX_ERROR, f"Failed to store user profile for {user_id}"
            )

        return UserProfile(
            id=result["id"],
            tenant_id=result.get("tenantId"),  # Include tenantId in response
            data=result["data"],
            version=result["version"],
            created_at=result["createdAt"],
            updated_at=result["updatedAt"],
        )

    async def delete(
        self, user_id: str, options: Optional[DeleteUserOptions] = None
    ) -> UserDeleteResult:
        """
        Delete a profile or its explicitly selected supported exclusive primary scope.

        Cascade requires a separate administrator transport and exact tenant scope.
        Shared/foreign/operational/provenance residuals are disclosed in the erasure
        receipt. A configured graph requires a matching explicit graph participant;
        completion is not universal physical erasure or an automatic legal guarantee.

        Args:
            user_id: User ID to delete
            options: Deletion options (cascade, verify, dry_run)

        Returns:
            Detailed deletion result with per-layer counts

        Example:
            >>> # Simple deletion (profile only)
            >>> await cortex.users.delete('user-123')
            >>>
            >>> import os
            >>> # Preview supported erasure, with residuals disclosed in its receipt.
            >>> transport = cortex.users.create_erasure_transport(
            ...     url=os.environ['CONVEX_URL'],
            ...     deployment_key=os.environ['CONVEX_DEPLOY_KEY'])
            >>> try:
            ...     result = await cortex.users.delete('user-123', DeleteUserOptions(
            ...         cascade=True, tenant_id='team-a', erasure_transport=transport,
            ...         dry_run=True))
            ...     print(result.erasure)  # Not universal physical erasure.
            ... finally:
            ...     transport.close()
        """
        # Client-side validation
        validate_user_id(user_id)
        validate_delete_options(options)

        opts = DeleteUserOptions(**options) if isinstance(options, dict) else options or DeleteUserOptions()
        tenant_id = resolve_domain_scope(self._tenant_id, opts.tenant_id)

        if not opts.cascade:
            # Simple deletion - just the user profile
            total_deleted = 0
            if not opts.dry_run:
                try:
                    await self._execute_with_resilience(
                        lambda: self.client.mutation("immutable:purge", filter_none_values({
                            "type": "user",
                            "id": user_id,
                            "tenantId": tenant_id,  # Multi-tenancy: scope to tenant
                        })),
                        "immutable:purge",
                    )
                    total_deleted = 1
                except Exception as e:
                    # Only ignore "not found" errors - user profile may not exist
                    if _is_user_not_found_error(e):
                        total_deleted = 0
                    else:
                        # Re-raise unexpected errors (connection issues, permission errors, etc.)
                        raise

            complete = False
            if not opts.dry_run and opts.verify:
                remaining = await self._execute_with_resilience(
                    lambda: self.client.query("immutable:get", filter_none_values({
                        "type": "user",
                        "id": user_id,
                        "tenantId": tenant_id,
                    })),
                    "immutable:get",
                )
                complete = remaining is None

            return UserDeleteResult(
                user_id=user_id,
                deleted_at=int(time.time() * 1000),
                conversations_deleted=0,
                conversation_messages_deleted=0,
                immutable_records_deleted=0,
                mutable_keys_deleted=0,
                vector_memories_deleted=0,
                facts_deleted=0,
                total_deleted=total_deleted,
                deleted_layers=["user-profile"] if total_deleted > 0 else [],
                verification=VerificationResult(complete=complete, issues=[], scope="user-profile"),
            )

        domain = {"kind": "user", "userId": user_id}
        if tenant_id is not None:
            domain["tenantId"] = tenant_id
        prepared = await prepare_erasure(domain, opts, self.graph_adapter)
        return self._erasure_user_result(user_id, await execute_erasure(prepared, self.client))

    @staticmethod
    def _erasure_user_result(user_id: str, receipt: ErasureReceipt) -> UserDeleteResult:
        """Compatibility fields count received native commits only."""
        def count(table: str) -> int:
            return receipt.per_table[table]["deleted"]
        roots = {row["id"] for row in receipt.planned if row["table"] == "immutable" and row["action"] == "root"}
        profiles_deleted = sum(int(item["deleted"]) for item in receipt.outcomes
                               if item["table"] == "immutable" and item["id"] in roots and item["state"] == "committed")
        immutable_records_deleted = max(0, count("immutable") - profiles_deleted)
        deleted_layers = ["vector" if table == "memories" else table for table, value in receipt.per_table.items()
                          if value["deleted"] > 0 and (table != "immutable" or immutable_records_deleted > 0)]
        if receipt.graph["nodesDeleted"] > 0:
            deleted_layers.append("graph")
        if profiles_deleted > 0:
            deleted_layers.append("user-profile")
        return UserDeleteResult(
            user_id=user_id, deleted_at=receipt.ended_at,
            conversations_deleted=count("conversations"),
            conversation_messages_deleted=sum(int(item["messages"]) for item in receipt.outcomes),
            immutable_records_deleted=immutable_records_deleted, mutable_keys_deleted=count("mutable"),
            vector_memories_deleted=count("memories"), facts_deleted=count("facts"),
            total_deleted=receipt.total_deleted, graph_nodes_deleted=receipt.graph["nodesDeleted"],
            deleted_layers=deleted_layers,
            verification=VerificationResult(complete=receipt.verification["complete"], issues=receipt.errors),
            erasure=receipt)

    async def search(self, filters: Optional[ListUsersFilter] = None) -> List[UserProfile]:
        """
        Search user profiles with filters.

        Args:
            filters: Filter, sorting, and pagination options

        Returns:
            Array of matching user profiles

        Example:
            >>> # Search with date filter
            >>> recent_users = await cortex.users.search(ListUsersFilter(
            ...     created_after=int((time.time() - 30 * 24 * 60 * 60) * 1000),
            ...     limit=100
            ... ))
            >>>
            >>> # Search by displayName (client-side filter)
            >>> alex_users = await cortex.users.search(ListUsersFilter(
            ...     display_name='alex',
            ...     limit=50
            ... ))
            >>>
            >>> # Search with sorting
            >>> sorted_users = await cortex.users.search(ListUsersFilter(
            ...     sort_by='updatedAt',
            ...     sort_order='desc'
            ... ))
        """
        # Client-side validation
        validate_list_users_filter(filters)

        # Extract filter values with defaults
        limit = filters.limit if filters and filters.limit else 50

        # Determine tenant_id: use filter if provided, otherwise use auth context
        tenant_id = (filters.tenant_id if filters and filters.tenant_id else None) or self._tenant_id

        # Query using immutable:list with type='user' (like TS SDK)
        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "immutable:list",
                filter_none_values({
                    "type": "user",
                    "limit": limit,
                    "offset": filters.offset if filters else None,
                    "createdAfter": filters.created_after if filters else None,
                    "createdBefore": filters.created_before if filters else None,
                    "updatedAfter": filters.updated_after if filters else None,
                    "updatedBefore": filters.updated_before if filters else None,
                    "sortBy": filters.sort_by if filters else None,
                    "sortOrder": filters.sort_order if filters else None,
                    "tenantId": tenant_id,  # Multi-tenancy: scope to tenant
                }),
            ),
            "users:search",
        )

        # Extract entries from the new response format
        if isinstance(result, dict):
            entries = result.get("entries", [])
        else:
            entries = result if isinstance(result, list) else []

        # Map to UserProfile (including tenantId for multi-tenancy)
        users = [
            UserProfile(
                id=u["id"],
                tenant_id=u.get("tenantId"),  # Include tenantId for multi-tenancy
                data=u.get("data", {}),
                version=u.get("version", 1),
                created_at=u.get("createdAt", 0),
                updated_at=u.get("updatedAt", 0),
            )
            for u in entries
        ]

        # Apply client-side filters for nested data properties
        if filters and filters.display_name:
            search_name = filters.display_name.lower()
            users = [
                u for u in users
                if u.data.get("displayName", "").lower().find(search_name) >= 0
            ]

        if filters and filters.email:
            search_email = filters.email.lower()
            users = [
                u for u in users
                if u.data.get("email", "").lower().find(search_email) >= 0
            ]

        return users

    async def list(self, filters: Optional[ListUsersFilter] = None) -> ListUsersResult:
        """
        List user profiles with pagination, filtering, and sorting.

        Args:
            filters: Filter and pagination options

        Returns:
            ListUsersResult with pagination metadata

        Example:
            >>> # Basic listing with limit
            >>> result = await cortex.users.list(ListUsersFilter(limit=50))
            >>> print(f"Found {result.total} users, showing {len(result.users)}")
            >>>
            >>> # With date filters and sorting
            >>> recent = await cortex.users.list(ListUsersFilter(
            ...     created_after=int((time.time() - 7 * 24 * 60 * 60) * 1000),
            ...     sort_by='createdAt',
            ...     sort_order='desc',
            ...     limit=20
            ... ))
            >>>
            >>> # Pagination
            >>> page2 = await cortex.users.list(ListUsersFilter(limit=10, offset=10))
        """
        # Client-side validation
        validate_list_users_filter(filters)

        # Extract filter values with defaults
        limit = filters.limit if filters and filters.limit else 50

        # Determine tenant_id: use filter if provided, otherwise use auth context
        tenant_id = resolve_domain_scope(self._tenant_id, filters.tenant_id if filters else None)

        # Query using immutable:list with type='user' (like TS SDK)
        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "immutable:list",
                filter_none_values({
                    "type": "user",
                    "limit": limit,
                    "offset": filters.offset if filters else None,
                    "createdAfter": filters.created_after if filters else None,
                    "createdBefore": filters.created_before if filters else None,
                    "updatedAfter": filters.updated_after if filters else None,
                    "updatedBefore": filters.updated_before if filters else None,
                    "sortBy": filters.sort_by if filters else None,
                    "sortOrder": filters.sort_order if filters else None,
                    "tenantId": tenant_id,  # Inject tenantId for tenant isolation
                }),
            ),
            "users:list",
        )

        # Extract entries from the new response format
        if isinstance(result, dict):
            entries = result.get("entries", [])
            total = result.get("total", len(entries))
            has_more = result.get("hasMore", False)
        else:
            # Handle if result is a list directly
            entries = result if isinstance(result, list) else []
            total = len(entries)
            has_more = False

        # Map to UserProfile (including tenantId for multi-tenancy)
        users = [
            UserProfile(
                id=u["id"],
                tenant_id=u.get("tenantId"),  # Include tenantId for multi-tenancy
                data=u.get("data", {}),
                version=u.get("version", 1),
                created_at=u.get("createdAt", 0),
                updated_at=u.get("updatedAt", 0),
            )
            for u in entries
        ]

        # Apply client-side filters for nested data properties
        if filters and filters.display_name:
            search_name = filters.display_name.lower()
            users = [
                u for u in users
                if u.data.get("displayName", "").lower().find(search_name) >= 0
            ]

        if filters and filters.email:
            search_email = filters.email.lower()
            users = [
                u for u in users
                if u.data.get("email", "").lower().find(search_email) >= 0
            ]

        return ListUsersResult(
            users=users,
            total=total,
            limit=limit,
            offset=filters.offset if filters and filters.offset else 0,
            has_more=has_more,
        )

    async def count(self, filters: Optional[Dict[str, Any]] = None) -> int:
        """
        Count users matching filters.

        Args:
            filters: Optional filter criteria

        Returns:
            Count of matching users

        Example:
            >>> total = await cortex.users.count()
        """
        args = validate_user_count_filter(filters, self._tenant_id)
        result = await self._execute_with_resilience(
            lambda: self.client.query("immutable:count", {"type": "user", **args}),
            "users:count",
        )
        return validate_user_count_result(result)

    async def exists(self, user_id: str) -> bool:
        """
        Check if a user profile exists.

        Args:
            user_id: User ID

        Returns:
            True if user exists, False otherwise

        Example:
            >>> if await cortex.users.exists('user-123'):
            ...     user = await cortex.users.get('user-123')
        """
        # Client-side validation
        validate_user_id(user_id)

        user = await self.get(user_id)
        return user is not None

    async def get_or_create(
        self, user_id: str, defaults: Optional[Dict[str, Any]] = None
    ) -> UserProfile:
        """
        Get user profile or create default if doesn't exist.

        Args:
            user_id: User ID
            defaults: Default data if creating

        Returns:
            User profile

        Example:
            >>> user = await cortex.users.get_or_create(
            ...     'user-123',
            ...     {'displayName': 'Guest User', 'tier': 'free'}
            ... )
        """
        # Client-side validation
        validate_user_id(user_id)
        if defaults is not None:
            validate_data(defaults, "defaults")

        user = await self.get(user_id)

        if user:
            return user

        return await self.update(user_id, defaults or {})

    async def merge(
        self, user_id: str, updates: Dict[str, Any]
    ) -> UserProfile:
        """
        Merge partial updates with existing profile.

        This is an alias for update() with merge behavior. If the user doesn't
        exist, just stores the updates (creates the user).

        Args:
            user_id: User ID
            updates: Partial updates to merge with existing data

        Returns:
            Updated user profile

        Example:
            >>> # Existing: { displayName: 'Alex', preferences: { theme: 'dark', language: 'en' } }
            >>> await cortex.users.merge('user-123', {
            ...     'preferences': {'notifications': True}  # Adds notifications, keeps theme and language
            ... })
            >>> # Result: { displayName: 'Alex', preferences: { theme: 'dark', language: 'en', notifications: True } }
        """
        # Client-side validation
        validate_user_id(user_id)
        validate_data(updates, "updates")

        existing = await self.get(user_id)

        if not existing:
            # Match TS behavior: if user doesn't exist, just store the updates
            return await self.update(user_id, updates)

        # Deep merge existing data with updates
        merged_data = self._deep_merge(existing.data, updates)

        return await self.update(user_id, merged_data)

    def _deep_merge(
        self, target: Dict[str, Any], source: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Helper: Deep merge two dictionaries."""
        result = target.copy()

        for key, value in source.items():
            if (
                key in result
                and isinstance(result[key], dict)
                and isinstance(value, dict)
            ):
                # Recursively merge nested dicts
                result[key] = self._deep_merge(result[key], value)
            else:
                # Overwrite with source value
                result[key] = value

        return result

    # Helper methods for cascade deletion

    async def update_many(
        self,
        user_ids_or_filters: Union[List[str], ListUsersFilter],
        updates: Dict[str, Any],
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Bulk update multiple users by explicit IDs or filters.

        Args:
            user_ids_or_filters: Array of user IDs OR ListUsersFilter object
            updates: Updates to apply to matching users (must have 'data' key)
            options: Update options (skip_versioning, dry_run)

        Returns:
            Update result with count and affected user_ids

        Example:
            >>> # Update by explicit IDs
            >>> result = await cortex.users.update_many(
            ...     ['user-1', 'user-2', 'user-3'],
            ...     {'data': {'status': 'active'}}
            ... )
            >>>
            >>> # Update by filters (all users created in last 7 days)
            >>> filtered = await cortex.users.update_many(
            ...     ListUsersFilter(created_after=int((time.time() - 7 * 24 * 60 * 60) * 1000)),
            ...     {'data': {'welcomeEmailSent': True}}
            ... )
            >>>
            >>> # Dry run to preview
            >>> preview = await cortex.users.update_many(
            ...     ListUsersFilter(display_name='alex'),
            ...     {'data': {'verified': True}},
            ...     {'dry_run': True}
            ... )
            >>> print(f"Would update {len(preview['user_ids'])} users")
        """
        # Validate updates
        if not updates or "data" not in updates:
            raise UserValidationError(
                "updates.data is required", "MISSING_DATA", "updates.data"
            )
        validate_data(updates["data"], "updates.data")
        validate_bulk_update_options(options)

        # Determine if we're using userIds array or filters
        target_user_ids: List[str]

        if isinstance(user_ids_or_filters, list):
            # Explicit userIds array
            validate_user_ids_array(user_ids_or_filters, min_length=1, max_length=100)
            target_user_ids = user_ids_or_filters
        else:
            # Filter-based selection - search for matching users
            validate_list_users_filter(user_ids_or_filters)
            matching_users = await self.search(user_ids_or_filters)
            target_user_ids = [u.id for u in matching_users]

            # Limit to 100 users for safety
            if len(target_user_ids) > 100:
                raise UserValidationError(
                    f"Filter matched {len(target_user_ids)} users, maximum is 100. Add more specific filters or use limit.",
                    "TOO_MANY_MATCHES",
                    "filters",
                )

        # Check for dry run
        if options and options.get("dry_run"):
            return {
                "updated": 0,
                "user_ids": target_user_ids,
            }

        # Client-side implementation (like TypeScript SDK)
        results: List[str] = []

        for user_id in target_user_ids:
            try:
                user = await self.get(user_id)
                if user:
                    await self.update(user_id, updates["data"])
                    results.append(user_id)
            except Exception:
                # Continue on error
                continue

        return {
            "updated": len(results),
            "user_ids": results,
        }

    async def delete_many(
        self,
        user_ids_or_filters: Union[List[str], ListUsersFilter],
        options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Bulk delete multiple users by explicit IDs or filters.

        Args:
            user_ids_or_filters: Array of user IDs OR ListUsersFilter object
            options: Delete options (cascade, dry_run)

        Returns:
            Delete result with count and affected user_ids

        Example:
            >>> import os
            >>> transport = cortex.users.create_erasure_transport(
            ...     url=os.environ['CONVEX_URL'],
            ...     deployment_key=os.environ['CONVEX_DEPLOY_KEY'])
            >>> try:
            ...     preview = await cortex.users.delete_many(['user-1', 'user-2'],
            ...         {'cascade': True, 'tenant_id': 'team-a',
            ...          'erasure_transport': transport, 'dry_run': True})
            ...     print(preview)  # Per-user supported-scope receipts and residuals.
            ... finally:
            ...     transport.close()
        """
        validate_bulk_delete_options(options)
        validate_delete_options(options)
        opts = DeleteUserOptions(**(options or {}))
        tenant_id = resolve_domain_scope(self._tenant_id, opts.tenant_id)
        target_user_ids: List[str] = []
        if isinstance(user_ids_or_filters, list):
            validate_user_ids_array(user_ids_or_filters, min_length=1, max_length=100)
            target_user_ids = list(user_ids_or_filters)
        else:
            from dataclasses import replace
            validate_list_users_filter(user_ids_or_filters)
            resolve_domain_scope(tenant_id, user_ids_or_filters.tenant_id)
            offset = 0
            while True:
                if opts.cancel_event is not None and opts.cancel_event.is_set():
                    raise DomainErasureError("ERASURE_CANCELLED", "bulkDiscovery")
                page = await self.list(replace(user_ids_or_filters, tenant_id=tenant_id, limit=500, offset=offset))
                target_user_ids.extend(user.id for user in page.users)
                if not page.has_more:
                    break
                offset += 500
            target_user_ids = list(dict.fromkeys(target_user_ids))
        outcomes: List[UserDeleteResult] = []
        unstarted = list(target_user_ids)
        committed: List[str] = []
        prepared = []
        if opts.cascade:
            # Every selected user's whole-domain preflight precedes the first write.
            for user_id in target_user_ids:
                domain = {"kind": "user", "userId": user_id}
                if tenant_id is not None:
                    domain["tenantId"] = tenant_id
                prepared.append(await prepare_erasure(domain, opts, self.graph_adapter))
        for index, user_id in enumerate(target_user_ids):
            try:
                result = (self._erasure_user_result(user_id, await execute_erasure(prepared[index], self.client))
                          if opts.cascade else await self.delete(user_id, opts))
                outcomes.append(result)
                unstarted.pop(0)
                if result.total_deleted:
                    committed.append(user_id)
            except DomainErasureError as error:
                if error.receipt is not None and (error.receipt.executed or error.receipt.outcomes or error.receipt.unknown):
                    unstarted.pop(0)
                error.outcomes, error.unstarted = outcomes, unstarted
                error.deleted, error.user_ids = len(committed), committed
                raise
        return {"deleted": len(committed), "user_ids": target_user_ids if opts.dry_run else committed,
                "complete": all(result.verification.complete for result in outcomes),
                "outcomes": outcomes, "unstarted": unstarted}

    async def export(self, options: Optional[ExportUsersOptions] = None) -> str:
        """
        Legacy aggregate profile export with optional related data.

        Results follow legacy list limits and optional reads can be omitted.
        Use export_data for the complete supported records and binary stream.

        Args:
            options: Export options including format and what to include

        Returns:
            Exported data as JSON or CSV string

        Example:
            >>> # Basic JSON export
            >>> json_str = await cortex.users.export(ExportUsersOptions(format='json'))
            >>>
            >>> # Export with version history
            >>> with_history = await cortex.users.export(ExportUsersOptions(
            ...     format='json',
            ...     include_version_history=True
            ... ))
            >>>
        """
        import json

        # Client-side validation
        validate_export_options(options)

        # Default to JSON format if no options provided
        export_format = options.format if options else "json"
        filters = options.filters if options else None
        include_version_history = options.include_version_history if options else False
        include_conversations = options.include_conversations if options else False
        include_memories = options.include_memories if options else False

        # Get users using list() with filters
        result = await self.list(filters)
        users = result.users

        # Build export data structure
        export_data: List[Dict[str, Any]] = []

        for user in users:
            user_data: Dict[str, Any] = {
                "id": user.id,
                "data": user.data,
                "version": user.version,
                "createdAt": user.created_at,
                "updatedAt": user.updated_at,
            }

            # Include version history if requested
            if include_version_history:
                try:
                    history = await self.get_history(user.id)
                    user_data["versionHistory"] = [
                        {
                            "version": v.version,
                            "data": v.data,
                            "timestamp": v.timestamp,
                        }
                        for v in history
                    ]
                except Exception:
                    # Skip if history unavailable
                    pass

            # Include conversations if requested
            if include_conversations:
                try:
                    convos_result = await self.client.query(
                        "conversations:list",
                        filter_none_values({"userId": user.id}),
                    )
                    # Handle both array and paginated result formats
                    convos = (
                        convos_result
                        if isinstance(convos_result, list)
                        else convos_result.get("conversations", [])
                    )
                    user_data["conversations"] = convos
                except Exception:
                    # Skip if conversations unavailable
                    pass

            # Include memories if requested
            if include_memories:
                try:
                    all_memories: List[Any] = []

                    # Get memory space IDs from conversations
                    if user_data.get("conversations"):
                        memory_space_ids = set()
                        for convo in user_data["conversations"]:
                            if convo.get("memorySpaceId"):
                                memory_space_ids.add(convo["memorySpaceId"])

                        # Query memories from each memory space
                        for memory_space_id in memory_space_ids:
                            try:
                                memories = await self.client.query(
                                    "memories:list",
                                    filter_none_values({
                                        "memorySpaceId": memory_space_id,
                                        "userId": user.id,
                                    }),
                                )
                                if isinstance(memories, list):
                                    all_memories.extend(memories)
                            except Exception:
                                # Skip unavailable memory spaces
                                pass

                    user_data["memories"] = all_memories
                except Exception:
                    # Skip if memories unavailable
                    pass

            export_data.append(user_data)

        if export_format == "csv":
            # CSV export - flatten structure
            import csv
            import io

            headers = [
                "id",
                "version",
                "createdAt",
                "updatedAt",
                "data",
            ]
            if include_version_history:
                headers.append("versionHistoryCount")
            if include_conversations:
                headers.append("conversationsCount")
            if include_memories:
                headers.append("memoriesCount")

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(headers)

            for u in export_data:
                row = [
                    u["id"],
                    str(u["version"]),
                    str(u["createdAt"]),
                    str(u["updatedAt"]),
                    json.dumps(u["data"]),
                ]
                if include_version_history:
                    row.append(str(len(u.get("versionHistory", []))))
                if include_conversations:
                    row.append(str(len(u.get("conversations", []))))
                if include_memories:
                    row.append(str(len(u.get("memories", []))))
                writer.writerow(row)

            return output.getvalue()

        # JSON export (default)
        return json.dumps(export_data, indent=2, default=str)

    async def get_version(
        self, user_id: str, version: int
    ) -> Optional[UserVersion]:
        """
        Get a specific version of a user profile.

        Args:
            user_id: User ID
            version: Version number

        Returns:
            User version if found, None otherwise

        Example:
            >>> v1 = await cortex.users.get_version('user-123', 1)
        """
        # Client-side validation
        validate_user_id(user_id)
        validate_version_number(version, "version")

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "immutable:getVersion", filter_none_values({"type": "user", "id": user_id, "version": version})
            ),
            "immutable:getVersion",
        )

        if not result:
            return None

        return UserVersion(
            version=result["version"],
            data=result["data"],
            timestamp=result["timestamp"],
        )

    async def get_history(self, user_id: str) -> List[UserVersion]:
        """
        Get all versions of a user profile.

        Args:
            user_id: User ID

        Returns:
            List of all profile versions

        Example:
            >>> history = await cortex.users.get_history('user-123')
        """
        # Client-side validation
        validate_user_id(user_id)

        tenant_id = resolve_domain_scope(self._tenant_id)

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "immutable:getHistory", filter_none_values({"type": "user", "id": user_id, "tenantId": tenant_id})
            ),
            "immutable:getHistory",
        )

        return [
            UserVersion(version=v["version"], data=v["data"], timestamp=v["timestamp"])
            for v in result
        ]

    async def get_at_timestamp(
        self, user_id: str, timestamp: int
    ) -> Optional[UserVersion]:
        """
        Get user profile state at a specific point in time.

        Args:
            user_id: User ID
            timestamp: Point in time (Unix timestamp in ms)

        Returns:
            Profile version at that time if found, None otherwise

        Example:
            >>> august_profile = await cortex.users.get_at_timestamp(
            ...     'user-123', 1609459200000
            ... )
        """
        # Client-side validation
        validate_user_id(user_id)
        validate_timestamp(timestamp, "timestamp")

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "immutable:getAtTimestamp",
                filter_none_values({"type": "user", "id": user_id, "timestamp": timestamp}),
            ),
            "immutable:getAtTimestamp",
        )

        if not result:
            return None

        return UserVersion(
            version=result["version"], data=result["data"], timestamp=result["timestamp"]
        )
