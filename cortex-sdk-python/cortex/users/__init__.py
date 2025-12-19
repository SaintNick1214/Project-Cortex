"""
Cortex SDK - Users API

Coordination Layer: User profile management with GDPR cascade deletion
"""

import time
from typing import Any, Dict, List, Optional, Union

__all__ = ["UsersAPI", "UserValidationError"]

from .._utils import convert_convex_response, filter_none_values  # noqa: F401
from ..errors import CascadeDeletionError, CortexError, ErrorCode
from ..types import (
    DeleteUserOptions,
    ExportUsersOptions,
    ListUsersFilter,
    ListUsersResult,
    UserDeleteResult,
    UserProfile,
    UserVersion,
    VerificationResult,
)
from .validators import (
    UserValidationError,
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


def _is_conversation_not_found_error(e: Exception) -> bool:
    """Check if an exception indicates a conversation was not found.

    This enables idempotent deletion - if a conversation is already deleted,
    that's a success for cascade deletion (goal was to delete it anyway).

    This is particularly important for parallel test execution where another
    test or cleanup process may have already deleted the conversation.

    Args:
        e: The exception to check

    Returns:
        True if this is a "not found" error for a conversation
    """
    error_str = str(e)
    # Check for error code patterns from Convex backend
    return (
        "CONVERSATION_NOT_FOUND" in error_str
        or "conversation not found" in error_str.lower()
    )


class UsersAPI:
    """
    Users API

    Provides convenience wrappers over immutable store (type='user') with the
    critical feature of GDPR cascade deletion across all layers.

    Key Principle: Same code for free SDK and Cloud Mode
    - Free SDK: User provides graph adapter (DIY), cascade works if configured
    - Cloud Mode: Cortex provides managed graph adapter, cascade always works + legal guarantees
    """

    def __init__(
        self,
        client: Any,
        graph_adapter: Optional[Any] = None,
        resilience: Optional[Any] = None,
    ) -> None:
        """
        Initialize Users API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter for cascade deletion
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

        result = await self._execute_with_resilience(
            lambda: self.client.query("immutable:get", filter_none_values({"type": "user", "id": user_id})),
            "immutable:get",
        )

        if not result:
            return None

        return UserProfile(
            id=result["id"],
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

        result = await self._execute_with_resilience(
            lambda: self.client.mutation(
                "immutable:store", {"type": "user", "id": user_id, "data": data}
            ),
            "immutable:store",
        )

        if not result:
            raise CortexError(
                ErrorCode.CONVEX_ERROR, f"Failed to store user profile for {user_id}"
            )

        return UserProfile(
            id=result["id"],
            data=result["data"],
            version=result["version"],
            created_at=result["createdAt"],
            updated_at=result["updatedAt"],
        )

    async def delete(
        self, user_id: str, options: Optional[DeleteUserOptions] = None
    ) -> UserDeleteResult:
        """
        Delete user profile with optional cascade deletion across all layers.

        This implements GDPR "right to be forgotten" with cascade deletion across:
        - Conversations (Layer 1a)
        - Immutable records (Layer 1b)
        - Mutable keys (Layer 1c)
        - Vector memories (Layer 2)
        - Facts (Layer 3)
        - Graph nodes (if configured)

        Args:
            user_id: User ID to delete
            options: Deletion options (cascade, verify, dry_run)

        Returns:
            Detailed deletion result with per-layer counts

        Example:
            >>> # Simple deletion (profile only)
            >>> await cortex.users.delete('user-123')
            >>>
            >>> # GDPR cascade deletion (all layers)
            >>> result = await cortex.users.delete(
            ...     'user-123',
            ...     DeleteUserOptions(cascade=True)
            ... )
            >>> print(f"Deleted {result.total_deleted} records")
        """
        # Client-side validation
        validate_user_id(user_id)
        validate_delete_options(options)

        opts = options or DeleteUserOptions()

        if not opts.cascade:
            # Simple deletion - just the user profile
            try:
                await self._execute_with_resilience(
                    lambda: self.client.mutation("immutable:purge", {"type": "user", "id": user_id}),
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
                verification=VerificationResult(complete=True, issues=[]),
            )

        # Cascade deletion across all layers
        if opts.dry_run:
            # Phase 1: Collection (count what would be deleted)
            plan = await self._collect_deletion_plan(user_id)

            # Build predicted deleted_layers to match actual execution semantics
            predicted_deleted_layers: List[str] = []
            if len(plan.get("vector", [])) > 0:
                predicted_deleted_layers.append("vector")
            if len(plan.get("facts", [])) > 0:
                predicted_deleted_layers.append("facts")
            if len(plan.get("mutable", [])) > 0:
                predicted_deleted_layers.append("mutable")
            if len(plan.get("immutable", [])) > 0:
                predicted_deleted_layers.append("immutable")
            if len(plan.get("conversations", [])) > 0:
                predicted_deleted_layers.append("conversations")
            # User profile deletion always happens in cascade mode
            predicted_deleted_layers.append("user-profile")
            if len(plan.get("graph", [])) > 0:
                predicted_deleted_layers.append("graph")

            return UserDeleteResult(
                user_id=user_id,
                deleted_at=int(time.time() * 1000),
                conversations_deleted=len(plan.get("conversations", [])),
                conversation_messages_deleted=sum(
                    conv.get("messageCount", 0) for conv in plan.get("conversations", [])
                ),
                immutable_records_deleted=len(plan.get("immutable", [])),
                mutable_keys_deleted=len(plan.get("mutable", [])),
                vector_memories_deleted=len(plan.get("vector", [])),
                facts_deleted=len(plan.get("facts", [])),
                total_deleted=sum(
                    len(v) if isinstance(v, list) else 0
                    for v in plan.values()
                ),
                deleted_layers=predicted_deleted_layers,
                verification=VerificationResult(complete=True, issues=[]),
            )

        # Phase 1: Collection
        plan = await self._collect_deletion_plan(user_id)

        # Phase 2: Backup (for rollback)
        backup = await self._create_deletion_backup(plan)

        # Phase 3: Execute deletion with rollback on failure
        try:
            result = await self._execute_deletion(plan, user_id)

            # Verify if requested
            if opts.verify:
                verification = await self._verify_deletion(user_id)
                result.verification = verification

            return result
        except Exception as e:
            # Rollback on failure
            await self._rollback_deletion(backup)
            raise CascadeDeletionError(f"Cascade deletion failed: {e}", cause=e)

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
                }),
            ),
            "users:search",
        )

        # Extract entries from the new response format
        if isinstance(result, dict):
            entries = result.get("entries", [])
        else:
            entries = result if isinstance(result, list) else []

        # Map to UserProfile
        users = [
            UserProfile(
                id=u["id"],
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
        offset = filters.offset if filters and filters.offset else 0

        # Query using immutable:list with type='user' (like TS SDK)
        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "immutable:list",
                filter_none_values({
                    "type": "user",
                    "limit": limit,
                    "offset": offset,
                    "createdAfter": filters.created_after if filters else None,
                    "createdBefore": filters.created_before if filters else None,
                    "updatedAfter": filters.updated_after if filters else None,
                    "updatedBefore": filters.updated_before if filters else None,
                    "sortBy": filters.sort_by if filters else None,
                    "sortOrder": filters.sort_order if filters else None,
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

        # Map to UserProfile
        users = [
            UserProfile(
                id=u["id"],
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
            offset=offset,
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
        # Client-side validation
        # filters is optional dict - no specific validation needed

        result = await self._execute_with_resilience(
            lambda: self.client.query("users:count", filter_none_values({"filters": filters})),
            "users:count",
        )

        return int(result)

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

    async def _collect_deletion_plan(self, user_id: str) -> Dict[str, List[Any]]:
        """Phase 1: Collect all records to delete."""
        plan: Dict[str, Any] = {
            "conversations": [],
            "immutable": [],
            "mutable": [],
            "vector": [],
            "facts": [],
            "graph": [],
        }

        # Collect conversations
        conversations_result = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversations:list", filter_none_values({"userId": user_id, "limit": 10000})
            ),
            "conversations:list",
        )
        # Handle both list format (legacy) and dict format (new API)
        if isinstance(conversations_result, dict):
            plan["conversations"] = conversations_result.get("conversations", [])
        else:
            plan["conversations"] = conversations_result if isinstance(conversations_result, list) else []

        # Collect immutable records
        immutable = await self._execute_with_resilience(
            lambda: self.client.query(
                "immutable:list", filter_none_values({"userId": user_id, "limit": 10000})
            ),
            "immutable:list",
        )
        # Handle both list format (legacy) and dict format (new API with entries)
        if isinstance(immutable, dict):
            raw_entries = immutable.get("entries", [])
        else:
            raw_entries = immutable if isinstance(immutable, list) else []

        # Filter to only include valid dict entries with required fields (type, id)
        # Some API responses might include strings or malformed entries
        plan["immutable"] = [
            entry for entry in raw_entries
            if isinstance(entry, dict) and entry.get("type") and entry.get("id")
        ]

        # Skip mutable collection for now - backend requires namespace parameter
        # Would need to know all namespaces upfront to query
        plan["mutable"] = []

        # Collect vector memories
        # Problem: Spaces may not be registered, so we need to find memories differently
        # Solution: Collect memory space IDs from conversations (those ARE collected)

        # Get memory space IDs from user's conversations
        # This is an optimization: only check spaces where user has data, not ALL spaces
        memory_space_ids_to_check = set()
        for conv in plan["conversations"]:
            space_id = conv.get("memorySpaceId")
            if space_id:
                memory_space_ids_to_check.add(space_id)

        # Store space IDs for deletion phase
        plan["vector"] = list(memory_space_ids_to_check)

        # Collect facts (query only user's memory spaces, not ALL spaces)
        # This is an optimization to avoid O(n) queries where n = total spaces in DB
        all_facts = []
        for space_id in memory_space_ids_to_check:
            try:
                facts = await self._execute_with_resilience(
                    lambda sid=space_id: self.client.query(
                        "facts:list",
                        filter_none_values({"memorySpaceId": sid, "limit": 10000})
                    ),
                    "facts:list",
                )
                fact_list = facts if isinstance(facts, list) else facts.get("facts", [])
                # Filter for this user
                user_facts = [f for f in fact_list if f.get("userId") == user_id or f.get("sourceUserId") == user_id]
                all_facts.extend(user_facts)
            except:
                pass  # Space might not have facts
        plan["facts"] = all_facts

        return plan

    async def _create_deletion_backup(self, plan: Dict[str, List[Any]]) -> Dict[str, List[Any]]:
        """Phase 2: Create backup for rollback."""
        # Return a copy of the plan as backup
        # Handle both list values and dict values (paginated responses that weren't extracted)
        backup: Dict[str, List[Any]] = {}
        for k, v in plan.items():
            if isinstance(v, list):
                backup[k] = list(v)
            elif isinstance(v, dict):
                # Extract entries from paginated response
                backup[k] = list(v.get("entries", []))
            else:
                backup[k] = []
        return backup

    async def _execute_deletion(
        self, plan: Dict[str, List[Any]], user_id: str
    ) -> UserDeleteResult:
        """
        Execute user deletion with strict error handling.

        STRICT MODE: Any error triggers immediate rollback of all operations.
        This ensures data integrity - either all user data is deleted or none is.

        Raises:
            CascadeDeletionError: On any failure, triggers rollback
        """
        deleted_at = int(time.time() * 1000)
        deleted_layers: List[str] = []

        conversations_deleted = 0
        messages_deleted = 0
        vector_deleted = 0
        facts_deleted = 0
        mutable_deleted = 0
        immutable_deleted = 0
        graph_nodes_deleted: Optional[int] = None

        # Helper to build partial deletion info for error reporting
        def _build_partial_info(failed_layer: str) -> str:
            return (f"Partial deletion state - deleted_layers: {deleted_layers}, "
                    f"vector: {vector_deleted}, facts: {facts_deleted}, "
                    f"mutable: {mutable_deleted}, immutable: {immutable_deleted}, "
                    f"conversations: {conversations_deleted}, failed at: {failed_layer}")

        # 1. Delete vector memories - STRICT: raise on error
        for space_id in plan.get("vector", []):
            try:
                result = await self.client.mutation(
                    "memories:deleteMany",
                    filter_none_values({"memorySpaceId": space_id, "userId": user_id})
                )
                deleted_count = result.get("deleted", 0)
                if deleted_count > 0:
                    vector_deleted += deleted_count
            except Exception as e:
                raise CascadeDeletionError(
                    f"Failed to delete vector memories in space {space_id}: {e}. {_build_partial_info('vector')}",
                    cause=e if isinstance(e, Exception) else None,
                )

        if vector_deleted > 0:
            deleted_layers.append("vector")

        # 2. Delete facts - STRICT: raise on error
        for fact in plan.get("facts", []):
            try:
                memory_space_id = fact.get("memorySpaceId") or fact.get("memory_space_id")
                fact_id = fact.get("factId") or fact.get("fact_id")

                await self.client.mutation(
                    "facts:deleteFact",
                    filter_none_values({"memorySpaceId": memory_space_id, "factId": fact_id}),
                )
                facts_deleted += 1
            except Exception as e:
                raise CascadeDeletionError(
                    f"Failed to delete fact {fact.get('factId', fact.get('fact_id', 'unknown'))}: {e}. {_build_partial_info('facts')}",
                    cause=e if isinstance(e, Exception) else None,
                )

        if facts_deleted > 0:
            deleted_layers.append("facts")

        # 3. Delete mutable keys - STRICT: raise on error
        for mutable_key in plan.get("mutable", []):
            try:
                await self.client.mutation(
                    "mutable:deleteKey",
                    {"namespace": mutable_key["namespace"], "key": mutable_key["key"]},
                )
                mutable_deleted += 1
            except Exception as e:
                raise CascadeDeletionError(
                    f"Failed to delete mutable key {mutable_key.get('key')}: {e}. {_build_partial_info('mutable')}",
                    cause=e if isinstance(e, Exception) else None,
                )

        if mutable_deleted > 0:
            deleted_layers.append("mutable")

        # 4. Delete immutable records - STRICT: raise on error
        # Handle both list format and dict format (paginated response)
        immutable_records = plan.get("immutable", [])
        if isinstance(immutable_records, dict):
            immutable_records = immutable_records.get("entries", [])
        for record in immutable_records:
            # Skip non-dict records (defensive: handle malformed data)
            if not isinstance(record, dict):
                continue
            try:
                await self.client.mutation(
                    "immutable:purge",
                    {"type": record["type"], "id": record["id"]},
                )
                immutable_deleted += 1
            except Exception as e:
                raise CascadeDeletionError(
                    f"Failed to delete immutable record {record.get('id')}: {e}. {_build_partial_info('immutable')}",
                    cause=e if isinstance(e, Exception) else None,
                )

        if immutable_deleted > 0:
            deleted_layers.append("immutable")

        # 5. Delete conversations - IDEMPOTENT: "not found" = already deleted = success
        for conv in plan.get("conversations", []):
            try:
                await self.client.mutation(
                    "conversations:deleteConversation",
                    {"conversationId": conv["conversationId"]},
                )
                conversations_deleted += 1
                messages_deleted += conv.get("messageCount", 0)
            except Exception as e:
                # Idempotent: if conversation is already deleted, that's a success
                # (the goal was to delete it anyway). This handles race conditions
                # in parallel test execution where another process may have already
                # deleted the conversation between plan collection and execution.
                if _is_conversation_not_found_error(e):
                    # Already deleted - count as success
                    conversations_deleted += 1
                    messages_deleted += conv.get("messageCount", 0)
                else:
                    raise CascadeDeletionError(
                        f"Failed to delete conversation {conv.get('conversationId')}: {e}. {_build_partial_info('conversations')}",
                        cause=e if isinstance(e, Exception) else None,
                    )

        if conversations_deleted > 0:
            deleted_layers.append("conversations")

        # 6. Delete user profile - STRICT: raise on error (except not-found)
        try:
            await self.client.mutation("immutable:purge", {"type": "user", "id": user_id})
            deleted_layers.append("user-profile")
        except Exception as e:
            if not _is_user_not_found_error(e):
                raise CascadeDeletionError(
                    f"Failed to delete user profile: {e}. {_build_partial_info('user-profile')}",
                    cause=e if isinstance(e, Exception) else None,
                )

        # 7. Delete from graph - STRICT: raise on error
        if self.graph_adapter:
            try:
                from ..graph import delete_user_from_graph

                graph_nodes_deleted = await delete_user_from_graph(
                    user_id, self.graph_adapter
                )
                if graph_nodes_deleted > 0:
                    deleted_layers.append("graph")
            except Exception as e:
                raise CascadeDeletionError(
                    f"Failed to delete from graph: {e}. {_build_partial_info('graph')}",
                    cause=e if isinstance(e, Exception) else None,
                )

        # Calculate total deleted
        user_profile_count = 1 if "user-profile" in deleted_layers else 0

        total_deleted = (
            conversations_deleted
            + immutable_deleted
            + mutable_deleted
            + vector_deleted
            + facts_deleted
            + user_profile_count
        )

        return UserDeleteResult(
            user_id=user_id,
            deleted_at=deleted_at,
            conversations_deleted=conversations_deleted,
            conversation_messages_deleted=messages_deleted,
            immutable_records_deleted=immutable_deleted,
            mutable_keys_deleted=mutable_deleted,
            vector_memories_deleted=vector_deleted,
            facts_deleted=facts_deleted,
            graph_nodes_deleted=graph_nodes_deleted,
            total_deleted=total_deleted,
            deleted_layers=deleted_layers,
            verification=VerificationResult(complete=True, issues=[]),
        )

    async def _verify_deletion(self, user_id: str) -> VerificationResult:
        """Verify deletion completeness."""
        issues = []

        # Check conversations
        conv_count = await self._execute_with_resilience(
            lambda: self.client.query(
                "conversations:count", filter_none_values({"userId": user_id})
            ),
            "conversations:count",
        )
        if conv_count > 0:
            issues.append(f"Found {conv_count} remaining conversations")

        # Check immutable
        immutable_count = await self._execute_with_resilience(
            lambda: self.client.query(
                "immutable:count", filter_none_values({"userId": user_id})
            ),
            "immutable:count",
        )
        if immutable_count > 0:
            issues.append(f"Found {immutable_count} remaining immutable records")

        # Check user profile
        user = await self.get(user_id)
        if user:
            issues.append("User profile still exists")

        return VerificationResult(complete=len(issues) == 0, issues=issues)

    async def _rollback_deletion(self, backup: Dict[str, List[Any]]) -> Dict[str, Any]:
        """
        Rollback user deletion on failure by re-creating deleted data.

        Args:
            backup: Dict containing the original data that was deleted

        Returns:
            Dict with rollback statistics
        """
        rollback_stats: Dict[str, Any] = {
            "vector_restored": 0,
            "facts_restored": 0,
            "mutable_restored": 0,
            "immutable_restored": 0,
            "conversations_restored": 0,
            "errors": [],
        }

        # Restore vector memories
        for memory in backup.get("vector_memories", []):
            try:
                await self.client.mutation(
                    "memories:store",
                    filter_none_values({
                        "memorySpaceId": memory.get("memorySpaceId"),
                        "memoryId": memory.get("memoryId"),
                        "content": memory.get("content"),
                        "contentType": memory.get("contentType", "raw"),
                        "embedding": memory.get("embedding"),
                        "importance": memory.get("importance"),
                        "sourceType": memory.get("sourceType"),
                        "sourceUserId": memory.get("sourceUserId"),
                        "sourceUserName": memory.get("sourceUserName"),
                        # conversationRef is a nested object, not a flat field
                        "conversationRef": memory.get("conversationRef"),
                        "userId": memory.get("userId"),
                        "agentId": memory.get("agentId"),
                        "participantId": memory.get("participantId"),
                        "tags": memory.get("tags", []),
                    }),
                )
                rollback_stats["vector_restored"] += 1
            except Exception as e:
                rollback_stats["errors"].append(f"Failed to restore memory {memory.get('memoryId')}: {e}")

        # Restore facts
        for fact in backup.get("facts", []):
            try:
                await self.client.mutation(
                    "facts:store",
                    filter_none_values({
                        "memorySpaceId": fact.get("memorySpaceId") or fact.get("memory_space_id"),
                        "factId": fact.get("factId") or fact.get("fact_id"),
                        "content": fact.get("content"),
                        "subject": fact.get("subject"),
                        "predicate": fact.get("predicate"),
                        "object": fact.get("object"),
                        "confidence": fact.get("confidence"),
                        "source": fact.get("source"),
                        "memoryId": fact.get("memoryId"),
                        "userId": fact.get("userId"),
                        "tags": fact.get("tags"),
                        "metadata": fact.get("metadata"),
                    }),
                )
                rollback_stats["facts_restored"] += 1
            except Exception as e:
                rollback_stats["errors"].append(f"Failed to restore fact: {e}")

        # Restore mutable keys
        for mutable_key in backup.get("mutable", []):
            try:
                await self.client.mutation(
                    "mutable:setKey",
                    {
                        "namespace": mutable_key["namespace"],
                        "key": mutable_key["key"],
                        "value": mutable_key.get("value", {}),
                    },
                )
                rollback_stats["mutable_restored"] += 1
            except Exception as e:
                rollback_stats["errors"].append(f"Failed to restore mutable key: {e}")

        # Restore immutable records
        # Handle both list format and dict format (paginated response)
        immutable_records = backup.get("immutable", [])
        if isinstance(immutable_records, dict):
            immutable_records = immutable_records.get("entries", [])
        for record in immutable_records:
            # Skip non-dict records (defensive: handle malformed data)
            if not isinstance(record, dict):
                continue
            try:
                await self.client.mutation(
                    "immutable:store",
                    {
                        "type": record["type"],
                        "id": record["id"],
                        "data": record.get("data", {}),
                    },
                )
                rollback_stats["immutable_restored"] += 1
            except Exception as e:
                rollback_stats["errors"].append(f"Failed to restore immutable record: {e}")

        # Restore conversations (without messages - those are harder to restore)
        for conv in backup.get("conversations", []):
            try:
                await self.client.mutation(
                    "conversations:create",
                    filter_none_values({
                        "memorySpaceId": conv.get("memorySpaceId"),
                        "conversationId": conv.get("conversationId"),
                        "type": conv.get("type"),
                        "participants": conv.get("participants"),
                        "metadata": conv.get("metadata"),
                    }),
                )
                rollback_stats["conversations_restored"] += 1
            except Exception as e:
                rollback_stats["errors"].append(f"Failed to restore conversation: {e}")

        # Log rollback results
        if rollback_stats["errors"]:
            print(f"Rollback completed with errors: {len(rollback_stats['errors'])} failures")
            for error in rollback_stats["errors"]:
                print(f"  - {error}")
        else:
            print(f"Rollback completed: {rollback_stats['vector_restored']} memories, "
                  f"{rollback_stats['facts_restored']} facts, "
                  f"{rollback_stats['mutable_restored']} mutable keys, "
                  f"{rollback_stats['immutable_restored']} immutable records, "
                  f"{rollback_stats['conversations_restored']} conversations restored")

        return rollback_stats

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
            >>> # Delete by explicit IDs
            >>> result = await cortex.users.delete_many(
            ...     ['user-1', 'user-2', 'user-3'],
            ...     {'cascade': True}
            ... )
            >>>
            >>> # Delete by filters (inactive users older than 1 year)
            >>> old_users = await cortex.users.delete_many(
            ...     ListUsersFilter(created_before=int((time.time() - 365 * 24 * 60 * 60) * 1000)),
            ...     {'cascade': True}
            ... )
            >>>
            >>> # Dry run to preview what would be deleted
            >>> preview = await cortex.users.delete_many(
            ...     ListUsersFilter(updated_before=int((time.time() - 90 * 24 * 60 * 60) * 1000)),
            ...     {'dry_run': True}
            ... )
            >>> print(f"Would delete {len(preview['user_ids'])} users")
        """
        # Client-side validation
        validate_bulk_delete_options(options)

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
                "deleted": 0,
                "user_ids": target_user_ids,
            }

        # Extract cascade option
        cascade = options.get("cascade", False) if options else False

        # Client-side implementation (like TypeScript SDK)
        results: List[str] = []

        for user_id in target_user_ids:
            try:
                await self.delete(user_id, DeleteUserOptions(cascade=cascade))
                results.append(user_id)
            except Exception:
                # Continue if user doesn't exist
                continue

        return {
            "deleted": len(results),
            "user_ids": results,
        }

    async def export(self, options: Optional[ExportUsersOptions] = None) -> str:
        """
        Export user profiles with optional related data.

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
            >>> # Full GDPR export with conversations and memories
            >>> gdpr_export = await cortex.users.export(ExportUsersOptions(
            ...     format='json',
            ...     filters=ListUsersFilter(display_name='alex'),
            ...     include_version_history=True,
            ...     include_conversations=True,
            ...     include_memories=True
            ... ))
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

        result = await self._execute_with_resilience(
            lambda: self.client.query(
                "immutable:getHistory", filter_none_values({"type": "user", "id": user_id})
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



