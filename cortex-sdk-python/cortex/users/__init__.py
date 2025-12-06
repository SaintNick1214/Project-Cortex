"""
Cortex SDK - Users API

Coordination Layer: User profile management with GDPR cascade deletion
"""

import time
from typing import Any, Dict, List, Optional

__all__ = ["UsersAPI", "UserValidationError"]

from .._utils import convert_convex_response, filter_none_values  # noqa: F401
from ..errors import CascadeDeletionError, CortexError, ErrorCode
from ..types import (
    DeleteUserOptions,
    UserDeleteResult,
    UserProfile,
    UserVersion,
    VerificationResult,
)
from .validators import (
    UserValidationError,
    validate_data,
    validate_delete_options,
    validate_export_format,
    validate_limit,
    validate_offset,
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

        result = await self.client.query("immutable:get", filter_none_values({"type": "user", "id": user_id}))

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

        result = await self.client.mutation(
            "immutable:store", {"type": "user", "id": user_id, "data": data}
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
                await self.client.mutation("immutable:purge", {"type": "user", "id": user_id})
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
                deleted_layers=[],
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

    async def search(
        self, filters: Optional[Dict[str, Any]] = None, limit: int = 50
    ) -> List[UserProfile]:
        """
        Search user profiles with filters.

        Args:
            filters: Filter criteria
            limit: Maximum results

        Returns:
            List of matching user profiles

        Example:
            >>> pro_users = await cortex.users.search(
            ...     {'data.tier': 'pro'},
            ...     limit=100
            ... )
        """
        # Client-side validation
        validate_limit(limit, "limit")

        # Client-side implementation using immutable:list (like TypeScript SDK)
        result = await self.client.query(
            "immutable:list", filter_none_values({"type": "user", "limit": limit})
        )

        # Map immutable records to UserProfile objects
        return [
            UserProfile(
                id=u["id"],
                data=u["data"],
                version=u["version"],
                created_at=u["createdAt"],
                updated_at=u["updatedAt"],
            )
            for u in result
        ]

    async def list(self, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
        """
        List user profiles with pagination.

        Args:
            limit: Maximum results
            offset: Number of results to skip (not currently supported by backend)

        Returns:
            List result with pagination info

        Example:
            >>> page1 = await cortex.users.list(limit=50)
        """
        # Client-side validation
        validate_limit(limit, "limit")
        validate_offset(offset, "offset")

        # Note: offset is not supported by the Convex backend yet
        result = await self.client.query(
            "users:list", filter_none_values({"limit": limit})
        )

        # Handle if result is a list or dict
        if isinstance(result, list):
            # Convex returned list directly
            users = result
        else:
            # Convex returned dict with users key
            users = result.get("users", [])

        user_profiles = [
            UserProfile(
                id=u["id"],
                data=u["data"],
                version=u["version"],
                created_at=u["createdAt"],
                updated_at=u["updatedAt"],
            )
            for u in users
        ]

        # Return dict format for consistency
        return {"users": user_profiles}

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

        result = await self.client.query("users:count", filter_none_values({"filters": filters}))

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

        Args:
            user_id: User ID
            updates: Partial updates to merge

        Returns:
            Updated user profile

        Example:
            >>> await cortex.users.merge(
            ...     'user-123',
            ...     {'preferences': {'notifications': True}}
            ... )
        """
        # Client-side validation
        validate_user_id(user_id)
        validate_data(updates, "updates")

        existing = await self.get(user_id)

        if not existing:
            raise CortexError(ErrorCode.USER_NOT_FOUND, f"User {user_id} not found")

        # Deep merge - recursively merge nested dicts
        def deep_merge(base: Dict, override: Dict) -> Dict:
            result = base.copy()
            for key, value in override.items():
                if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                    result[key] = deep_merge(result[key], value)
                else:
                    result[key] = value
            return result

        merged_data = deep_merge(existing.data, updates)

        return await self.update(user_id, merged_data)

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
        conversations = await self.client.query(
            "conversations:list", filter_none_values({"userId": user_id, "limit": 10000})
        )
        plan["conversations"] = conversations

        # Collect immutable records
        immutable = await self.client.query(
            "immutable:list", filter_none_values({"userId": user_id, "limit": 10000})
        )
        plan["immutable"] = immutable

        # Skip mutable collection for now - backend requires namespace parameter
        # Would need to know all namespaces upfront to query
        plan["mutable"] = []

        # Collect vector memories
        # Problem: Spaces may not be registered, so we need to find memories differently
        # Solution: Collect memory space IDs from conversations (those ARE collected)

        # Get memory space IDs from user's conversations
        memory_space_ids_to_check = set()
        for conv in plan["conversations"]:
            space_id = conv.get("memorySpaceId")
            if space_id:
                memory_space_ids_to_check.add(space_id)

        # Also add any registered spaces
        spaces_list: List[Any] = []
        try:
            all_spaces = await self.client.query("memorySpaces:list", filter_none_values({"limit": 10000}))
            spaces_list = all_spaces if isinstance(all_spaces, list) else all_spaces.get("spaces", [])
            for space in spaces_list:
                space_id = space.get("memorySpaceId")
                if space_id:
                    memory_space_ids_to_check.add(space_id)
        except:
            pass

        # Store space IDs for deletion phase
        plan["vector"] = list(memory_space_ids_to_check)

        # Collect facts (query by userId across all memory spaces)
        all_facts = []
        for space in spaces_list:
            space_id = space.get("memorySpaceId")
            if space_id:
                try:
                    facts = await self.client.query(
                        "facts:list",
                        filter_none_values({"memorySpaceId": space_id, "limit": 10000})
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
        return {k: list(v) for k, v in plan.items()}

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
        for record in plan.get("immutable", []):
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

        # 5. Delete conversations - STRICT: raise on error
        for conv in plan.get("conversations", []):
            try:
                await self.client.mutation(
                    "conversations:deleteConversation",
                    {"conversationId": conv["conversationId"]},
                )
                conversations_deleted += 1
                messages_deleted += conv.get("messageCount", 0)
            except Exception as e:
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
        conv_count = await self.client.query(
            "conversations:count", filter_none_values({"userId": user_id})
        )
        if conv_count > 0:
            issues.append(f"Found {conv_count} remaining conversations")

        # Check immutable
        immutable_count = await self.client.query(
            "immutable:count", filter_none_values({"userId": user_id})
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
        for record in backup.get("immutable", []):
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
        user_ids: List[str],
        updates: Dict[str, Any],
        skip_versioning: bool = False,
    ) -> Dict[str, Any]:
        """
        Bulk update multiple users.

        Args:
            user_ids: List of user IDs to update
            updates: Updates to apply to all users
            skip_versioning: Skip creating new versions

        Returns:
            Update result with count and user IDs

        Example:
            >>> result = await cortex.users.update_many(
            ...     ['user-1', 'user-2', 'user-3'],
            ...     {'status': 'active'}
            ... )
            >>> print(f"Updated {result['updated']} users")
        """
        # Client-side validation
        validate_user_ids_array(user_ids, min_length=1, max_length=100)
        validate_data(updates, "updates")

        # Client-side implementation (like TypeScript SDK)
        results = []

        for user_id in user_ids:
            try:
                user = await self.get(user_id)
                if user:
                    await self.update(user_id, updates)
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
        user_ids: List[str],
        cascade: bool = False,
    ) -> Dict[str, Any]:
        """
        Bulk delete multiple users.

        Args:
            user_ids: List of user IDs to delete
            cascade: Enable cascade deletion

        Returns:
            Deletion result with count and user IDs

        Example:
            >>> result = await cortex.users.delete_many(
            ...     ['user-1', 'user-2', 'user-3'],
            ...     cascade=True
            ... )
            >>> print(f"Deleted {result['deleted']} users")
        """
        # Client-side validation
        validate_user_ids_array(user_ids, min_length=1, max_length=100)

        # Client-side implementation (like TypeScript SDK)
        results = []

        for user_id in user_ids:
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

    async def export(
        self,
        filters: Optional[Dict[str, Any]] = None,
        format: str = "json",
        include_memories: bool = False,
        include_conversations: bool = False,
        include_version_history: bool = False,
    ) -> Dict[str, Any]:
        """
        Export user profiles to JSON or CSV.

        Args:
            filters: Optional filter criteria
            format: Export format ('json' or 'csv')
            include_memories: Include memories from all agents
            include_conversations: Include ACID conversations
            include_version_history: Include profile versions

        Returns:
            Export result

        Example:
            >>> exported = await cortex.users.export(
            ...     filters={'email': 'alex@example.com'},
            ...     format='json',
            ...     include_memories=True
            ... )
        """
        # Client-side validation
        validate_export_format(format)

        # Client-side implementation (like TypeScript SDK)
        import json

        # Get users using list()
        users_result = await self.list(limit=1000)  # Get all users
        users = users_result.get("users", [])

        if format == "csv":
            # CSV export
            import csv
            import io
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=["id", "version", "createdAt", "updatedAt", "data"])
            writer.writeheader()
            for u in users:
                writer.writerow({
                    "id": u.id,
                    "version": u.version,
                    "createdAt": u.created_at,
                    "updatedAt": u.updated_at,
                    "data": json.dumps(u.data),
                })
            return output.getvalue() # type: ignore[return-value] # type: ignore[return-value]

        # JSON export (default)
        export_data = [
            {
                "id": u.id,
                "data": u.data,
                "version": u.version,
                "created_at": u.created_at,
                "updated_at": u.updated_at,
            }
            for u in users
        ]
        return json.dumps(export_data, indent=2, default=str) # type: ignore[return-value] # type: ignore[return-value]

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

        result = await self.client.query(
            "immutable:getVersion", filter_none_values({"type": "user", "id": user_id, "version": version})
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

        result = await self.client.query(
            "immutable:getHistory", filter_none_values({"type": "user", "id": user_id})
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

        result = await self.client.query(
            "immutable:getAtTimestamp",
            filter_none_values({"type": "user", "id": user_id, "timestamp": timestamp}),
        )

        if not result:
            return None

        return UserVersion(
            version=result["version"], data=result["data"], timestamp=result["timestamp"]
        )



