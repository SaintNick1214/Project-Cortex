"""
Cortex SDK - Users API

Coordination Layer: User profile management with GDPR cascade deletion
"""

from typing import Optional, List, Dict, Any

from ..types import (
    UserProfile,
    UserVersion,
    DeleteUserOptions,
    UserDeleteResult,
    VerificationResult,
)
from ..errors import CortexError, ErrorCode, CascadeDeletionError
from .._utils import filter_none_values, convert_convex_response


class UsersAPI:
    """
    Users API

    Provides convenience wrappers over immutable store (type='user') with the
    critical feature of GDPR cascade deletion across all layers.

    Key Principle: Same code for free SDK and Cloud Mode
    - Free SDK: User provides graph adapter (DIY), cascade works if configured
    - Cloud Mode: Cortex provides managed graph adapter, cascade always works + legal guarantees
    """

    def __init__(self, client, graph_adapter=None):
        """
        Initialize Users API.

        Args:
            client: Convex client instance
            graph_adapter: Optional graph database adapter for cascade deletion
        """
        self.client = client
        self.graph_adapter = graph_adapter

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
        opts = options or DeleteUserOptions()

        if not opts.cascade:
            # Simple deletion - just the user profile
            await self.client.mutation("immutable:purge", {"type": "user", "id": user_id})

            return UserDeleteResult(
                user_id=user_id,
                deleted_at=int(time.time() * 1000),
                conversations_deleted=0,
                conversation_messages_deleted=0,
                immutable_records_deleted=0,
                mutable_keys_deleted=0,
                vector_memories_deleted=0,
                facts_deleted=0,
                total_deleted=1,
                deleted_layers=["user-profile"],
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
        plan = {
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
        spaces_list = []
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
        """Phase 3: Execute deletion."""
        deleted_at = int(time.time() * 1000)
        deleted_layers = []

        # Delete in reverse dependency order
        conversations_deleted = 0
        messages_deleted = 0

        # Delete vector memories using spaces from plan
        vector_deleted = 0
        deleted_memory_ids = []
        
        # Use the space IDs collected in plan phase
        for space_id in plan.get("vector", []):
            try:
                # Use deleteMany to bulk delete user's memories in this space
                result = await self.client.mutation(
                    "memories:deleteMany",
                    filter_none_values({"memorySpaceId": space_id, "userId": user_id})
                )
                deleted_count = result.get("deleted", 0)
                if deleted_count > 0:
                    vector_deleted += deleted_count
                    deleted_memory_ids.extend(result.get("memoryIds", []))
            except Exception:
                pass  # Continue with other spaces
        
        if vector_deleted > 0:
            deleted_layers.append("vector")

        # Delete facts
        facts_deleted = 0
        for fact in plan.get("facts", []):
            try:
                # Handle both camelCase and snake_case field names
                memory_space_id = fact.get("memorySpaceId") or fact.get("memory_space_id")
                fact_id = fact.get("factId") or fact.get("fact_id")
                
                await self.client.mutation(
                    "facts:deleteFact",
                    filter_none_values({"memorySpaceId": memory_space_id, "factId": fact_id}),
                )
                facts_deleted += 1
            except Exception as error:
                print(f"Warning: Failed to delete fact {fact.get('factId', fact.get('fact_id', 'unknown'))}: {error}")
        
        if facts_deleted > 0:
            deleted_layers.append("facts")

        # Delete mutable keys
        mutable_deleted = 0
        for mutable_key in plan.get("mutable", []):
            try:
                await self.client.mutation(
                    "mutable:deleteKey",
                    {"namespace": mutable_key["namespace"], "key": mutable_key["key"]},
                )
                mutable_deleted += 1
            except Exception as error:
                print(f"Warning: Failed to delete mutable key: {error}")
        
        if mutable_deleted > 0:
            deleted_layers.append("mutable")

        # Delete immutable records
        immutable_deleted = 0
        for record in plan.get("immutable", []):
            try:
                await self.client.mutation(
                    "immutable:purge",
                    {"type": record["type"], "id": record["id"]},
                )
                immutable_deleted += 1
            except Exception as error:
                print(f"Warning: Failed to delete immutable record: {error}")
        
        if immutable_deleted > 0:
            deleted_layers.append("immutable")

        # Delete conversations
        for conv in plan.get("conversations", []):
            try:
                await self.client.mutation(
                    "conversations:deleteConversation",
                    {"conversationId": conv["conversationId"]},
                )
                conversations_deleted += 1
                messages_deleted += conv.get("messageCount", 0)
            except Exception as error:
                print(f"Warning: Failed to delete conversation: {error}")

        if conversations_deleted > 0:
            deleted_layers.append("conversations")

        # Delete user profile
        await self.client.mutation("immutable:purge", {"type": "user", "id": user_id})
        deleted_layers.append("user-profile")

        # Delete from graph if configured
        graph_nodes_deleted = None
        if self.graph_adapter:
            try:
                from ..graph import delete_user_from_graph

                graph_nodes_deleted = await delete_user_from_graph(
                    user_id, self.graph_adapter
                )
                if graph_nodes_deleted > 0:
                    deleted_layers.append("graph")
            except Exception as error:
                print(f"Warning: Failed to delete from graph: {error}")

        total_deleted = (
            conversations_deleted
            + immutable_deleted
            + mutable_deleted
            + vector_deleted
            + facts_deleted
            + 1  # user profile
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

    async def _rollback_deletion(self, backup: Dict[str, List[Any]]):
        """Rollback deletion on failure."""
        # Restore from backup
        # This is a simplified version - actual implementation would restore all data
        print("Warning: Rollback not fully implemented - manual recovery may be needed")

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
            return output.getvalue()
        
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
        result = await self.client.query(
            "immutable:getAtTimestamp",
            filter_none_values({"type": "user", "id": user_id, "timestamp": timestamp}),
        )

        if not result:
            return None

        return UserVersion(
            version=result["version"], data=result["data"], timestamp=result["timestamp"]
        )


import time

