"""
Test cleanup utilities for Cortex Python SDK tests.

Provides cleanup classes for test data management:
1. BatchDeleter - Reusable batch delete using Convex deleteMany mutations
2. TestCleanup - Legacy global cleanup (purges data by prefix patterns)
3. ScopedCleanup - New parallel-safe cleanup (purges only data with matching run ID)
"""

from dataclasses import dataclass
from typing import Dict, Optional

from cortex import Cortex

from .isolation import TestRunContext


class BatchDeleter:
    """
    Reusable batch delete using Convex deleteMany mutations.

    Provides efficient batch deletion for entities that support deleteMany
    with memorySpaceId filter. This reduces N delete calls to a single
    mutation call per entity type.

    Supported entity types:
    - conversations: conversations:deleteMany
    - contexts: contexts:deleteMany
    - memories: memories:deleteMany
    - facts: facts:deleteMany
    """

    BATCH_MUTATIONS = {
        "conversations": "conversations:deleteMany",
        "contexts": "contexts:deleteMany",
        "memories": "memories:deleteMany",
        "facts": "facts:deleteMany",
    }

    def __init__(self, cortex_client: Cortex):
        """
        Initialize BatchDeleter.

        Args:
            cortex_client: Cortex SDK instance
        """
        self.cortex = cortex_client

    async def delete_by_memory_space(
        self,
        entity_type: str,
        memory_space_id: str,
    ) -> int:
        """
        Delete all entities of a type in a memory space.

        Args:
            entity_type: Type of entity (conversations, contexts, memories, facts)
            memory_space_id: Memory space to delete from

        Returns:
            Number of entities deleted

        Raises:
            ValueError: If entity_type doesn't support deleteMany
        """
        mutation = self.BATCH_MUTATIONS.get(entity_type)
        if not mutation:
            raise ValueError(
                f"No deleteMany mutation for {entity_type}. "
                f"Supported types: {list(self.BATCH_MUTATIONS.keys())}"
            )

        result = await self.cortex.client.mutation(
            mutation,
            {"memorySpaceId": memory_space_id}
        )
        return result.get("deleted", 0) if isinstance(result, dict) else 0

    async def delete_all_in_space(self, memory_space_id: str) -> Dict[str, int]:
        """
        Batch delete all supported entities in a memory space.

        Calls deleteMany for each supported entity type, reducing
        potentially hundreds of individual delete calls to just 4 mutations.

        Args:
            memory_space_id: Memory space to delete from

        Returns:
            Dictionary mapping entity type to count deleted
        """
        totals: Dict[str, int] = {}
        for entity_type in self.BATCH_MUTATIONS:
            try:
                totals[entity_type] = await self.delete_by_memory_space(
                    entity_type, memory_space_id
                )
            except Exception:
                totals[entity_type] = 0
        return totals

    @classmethod
    def supported_types(cls) -> list:
        """Return list of entity types that support batch deletion."""
        return list(cls.BATCH_MUTATIONS.keys())


class TestCleanup:
    """Helper class for cleaning up test data."""

    def __init__(self, cortex_client: Cortex):
        """
        Initialize cleanup helper.

        Args:
            cortex_client: Cortex SDK instance
        """
        self.cortex = cortex_client

    async def purge_conversations(
        self, memory_space_id: Optional[str] = None, memory_space_prefixes: tuple = ("test-", "e2e-test-")
    ) -> int:
        """
        Purge test conversations.

        Args:
            memory_space_id: Optional specific memory space ID to purge
            memory_space_prefixes: Memory space prefixes to filter (default: ("test-", "e2e-test-"))
                If memory_space_id is provided, this is ignored.

        Returns:
            Number of conversations deleted
        """
        count = 0
        try:
            if memory_space_id:
                # Delete all conversations in specific memory space
                result = await self.cortex.conversations.list(
                    memory_space_id=memory_space_id, limit=1000
                )
                conversations = result if isinstance(result, list) else result.get("conversations", [])

                for conv in conversations:
                    conv_id = conv.get("conversation_id") if isinstance(conv, dict) else conv.conversation_id
                    if conv_id:
                        try:
                            await self.cortex.conversations.delete(conv_id)
                            count += 1
                        except Exception:
                            pass
            else:
                # List all conversations and filter by memory space prefix
                result = await self.cortex.conversations.list(limit=1000)
                conversations = result if isinstance(result, list) else result.get("conversations", [])

                for conv in conversations:
                    space_id = conv.get("memory_space_id") if isinstance(conv, dict) else conv.memory_space_id
                    conv_id = conv.get("conversation_id") if isinstance(conv, dict) else conv.conversation_id

                    # Delete if memory_space_id starts with any test prefix
                    if space_id and any(space_id.startswith(prefix) for prefix in memory_space_prefixes) and conv_id:
                        try:
                            await self.cortex.conversations.delete(conv_id)
                            count += 1
                        except Exception:
                            pass

        except Exception:
            # If listing fails, it's okay - might be no data
            pass

        return count

    async def purge_memories(
        self, memory_space_id: str, delete_all: bool = True
    ) -> int:
        """
        Purge memories from vector layer.

        Args:
            memory_space_id: Memory space ID
            delete_all: If True, delete ALL memories in space (default: True)
                If False, only delete memories with "mem-test-" prefix

        Returns:
            Number of memories deleted
        """
        count = 0
        try:
            # List memories in the space
            result = await self.cortex.vector.list(
                memory_space_id=memory_space_id, limit=1000
            )

            memories = result if isinstance(result, list) else result.get("memories", [])

            # Delete memories
            for mem in memories:
                mem_id = mem.get("memory_id") if isinstance(mem, dict) else mem.memory_id

                # If delete_all, delete everything. Otherwise only test prefix
                should_delete = delete_all or (mem_id and mem_id.startswith("mem-test-"))

                if mem_id and should_delete:
                    try:
                        await self.cortex.vector.delete(memory_space_id, mem_id)
                        count += 1
                    except Exception:
                        pass

        except Exception:
            pass

        return count

    async def purge_facts(
        self, memory_space_id: str, delete_all: bool = True
    ) -> int:
        """
        Purge facts from facts layer.

        Args:
            memory_space_id: Memory space ID
            delete_all: If True, delete ALL facts in space (default: True)
                If False, only delete facts with "fact-test-" prefix

        Returns:
            Number of facts deleted
        """
        count = 0
        try:
            # List facts
            result = await self.cortex.facts.list(
                memory_space_id=memory_space_id, limit=1000
            )

            facts = result if isinstance(result, list) else result.get("facts", [])

            # Delete facts
            for fact in facts:
                fact_id = fact.get("fact_id") if isinstance(fact, dict) else getattr(fact, "fact_id", None)

                # If delete_all, delete everything. Otherwise only test prefix
                should_delete = delete_all or (fact_id and fact_id.startswith("fact-test-"))

                if fact_id and should_delete:
                    try:
                        await self.cortex.facts.delete(memory_space_id, fact_id)
                        count += 1
                    except Exception:
                        pass

        except Exception:
            pass

        return count

    async def purge_immutable(
        self, memory_space_id: str, delete_all: bool = True
    ) -> int:
        """
        Purge immutable records.

        Args:
            memory_space_id: Memory space ID
            delete_all: If True, delete ALL immutable records in space (default: True)
                If False, only delete records with "test-" prefix

        Returns:
            Number of records purged
        """
        count = 0
        try:
            # List immutable records
            result = await self.cortex.immutable.list(
                memory_space_id=memory_space_id, limit=1000
            )

            records = result if isinstance(result, list) else result.get("records", [])

            # Purge records
            for record in records:
                record_id = record.get("record_id") if isinstance(record, dict) else record.record_id

                # If delete_all, delete everything. Otherwise only test prefix
                should_delete = delete_all or (record_id and record_id.startswith("test-"))

                if record_id and should_delete:
                    try:
                        await self.cortex.immutable.purge(memory_space_id, record_id)
                        count += 1
                    except Exception:
                        pass

        except Exception:
            pass

        return count

    async def purge_mutable(
        self, memory_space_id: str, key_prefix: Optional[str] = None
    ) -> int:
        """
        Purge mutable records.

        Args:
            memory_space_id: Memory space ID
            key_prefix: Optional key prefix to filter (e.g., "test-")
                If None, deletes ALL mutable records in the space

        Returns:
            Number of records deleted
        """
        count = 0
        try:
            # List mutable records
            result = await self.cortex.mutable.list(
                memory_space_id=memory_space_id, limit=1000
            )

            records = result if isinstance(result, list) else result.get("records", [])

            # Delete records
            for record in records:
                key = record.get("key") if isinstance(record, dict) else record.key

                # If key_prefix specified, filter by it. Otherwise delete all
                should_delete = (key_prefix is None) or (key and key.startswith(key_prefix))

                if key and should_delete:
                    try:
                        await self.cortex.mutable.delete(memory_space_id, key)
                        count += 1
                    except Exception:
                        pass

        except Exception:
            pass

        return count

    async def purge_users(self, prefix: str = "test-user-") -> int:
        """
        Purge test users.

        Args:
            prefix: User ID prefix to filter (default: "test-user-")

        Returns:
            Number of users deleted
        """
        count = 0
        try:
            # List users
            result = await self.cortex.users.list(limit=1000)

            users = result if isinstance(result, list) else result.get("users", [])

            # Delete users with test prefix
            for user in users:
                user_id = user.get("id") if isinstance(user, dict) else user.id
                if user_id and user_id.startswith(prefix):
                    try:
                        await self.cortex.users.delete(user_id)
                        count += 1
                    except Exception:
                        pass

        except Exception:
            pass

        return count

    async def purge_memory_space(self, memory_space_id: str, delete_all: bool = True) -> dict:
        """
        Purge all data in a memory space.

        Args:
            memory_space_id: Memory space ID to purge
            delete_all: If True, delete ALL data in space (default: True)

        Returns:
            Dictionary with counts of deleted items
        """
        result = {
            "conversations": 0,
            "memories": 0,
            "facts": 0,
            "immutable": 0,
            "mutable": 0,
        }

        # Purge all layers - use memory_space_id filtering
        # VERBOSE: Show what we're doing
        import os
        verbose = os.getenv("CLEANUP_VERBOSE") == "true"

        if verbose:
            print(f"    Purging conversations in {memory_space_id}...")
        result["conversations"] = await self.purge_conversations(memory_space_id)
        if verbose and result["conversations"] > 0:
            print(f"      Deleted {result['conversations']} conversations")

        if verbose:
            print(f"    Purging memories in {memory_space_id}...")
        result["memories"] = await self.purge_memories(memory_space_id, delete_all=delete_all)
        if verbose and result["memories"] > 0:
            print(f"      Deleted {result['memories']} memories")

        if verbose:
            print(f"    Purging facts in {memory_space_id}...")
        result["facts"] = await self.purge_facts(memory_space_id, delete_all=delete_all)
        if verbose and result["facts"] > 0:
            print(f"      Deleted {result['facts']} facts")

        if verbose:
            print(f"    Purging immutable in {memory_space_id}...")
        result["immutable"] = await self.purge_immutable(memory_space_id, delete_all=delete_all)
        if verbose and result["immutable"] > 0:
            print(f"      Deleted {result['immutable']} immutable")

        if verbose:
            print(f"    Purging mutable in {memory_space_id}...")
        result["mutable"] = await self.purge_mutable(memory_space_id, key_prefix=None if delete_all else "test-")
        if verbose and result["mutable"] > 0:
            print(f"      Deleted {result['mutable']} mutable")

        return result

    async def purge_all(self, memory_space_id: Optional[str] = None) -> dict:
        """
        Purge all test data across all layers.

        Args:
            memory_space_id: Optional memory space ID to filter by

        Returns:
            Dictionary with counts of deleted items
        """
        import os

        result = {
            "conversations": 0,
            "memories": 0,
            "facts": 0,
            "immutable": 0,
            "mutable": 0,
            "users": 0,
            "memory_spaces": 0,
        }

        if memory_space_id:
            # Purge specific memory space
            space_result = await self.purge_memory_space(memory_space_id)
            result.update(space_result)
        else:
            # All known test prefixes used across test suite
            test_prefixes = (
                "test-", "e2e-test-", "state-test-", "streaming-", "edge-", "bulk-",
                "filter-", "hive-", "cross-", "seq-", "stats-", "param-",
                "remember-", "space-", "create-", "ctx-", "conv-", "fact-",
                "user-", "agent-", "imm-", "mut-", "collab-", "integrity-",
                "boundary-", "operation-", "transition-", "propagation-", "company-", "org-",
            )

            # Find ALL test memory spaces and purge each one
            try:
                spaces_result = await self.cortex.memory_spaces.list(limit=1000)
                all_spaces = spaces_result.get("spaces", []) if isinstance(spaces_result, dict) else spaces_result

                for space in all_spaces:
                    space_id = space.memory_space_id if hasattr(space, 'memory_space_id') else space.get('memory_space_id')

                    # Only purge test spaces
                    if space_id and any(space_id.startswith(prefix) for prefix in test_prefixes):
                        try:
                            # First, purge all data IN the space
                            space_result = await self.purge_memory_space(space_id, delete_all=True)
                            deleted = sum(space_result.values())
                            if deleted > 0:
                                print(f"  Purged space {space_id}: {deleted} items")

                            result["conversations"] += space_result.get("conversations", 0)
                            result["memories"] += space_result.get("memories", 0)
                            result["facts"] += space_result.get("facts", 0)
                            result["immutable"] += space_result.get("immutable", 0)
                            result["mutable"] += space_result.get("mutable", 0)

                            # Then delete the memory space itself
                            try:
                                await self.cortex.memory_spaces.delete(space_id)
                                result["memory_spaces"] += 1
                            except Exception as e:
                                print(f"    Warning: Failed to delete space {space_id}: {e}")
                        except Exception as e:
                            print(f"  Warning: Failed to purge {space_id}: {e}")
            except Exception as e:
                print(f"  Warning: Failed to list memory spaces: {e}")

            # CRITICAL: Clean up orphaned data that references deleted memory spaces

            # Orphaned conversations
            try:
                print("  Cleaning up orphaned conversations...")
                all_convs = await self.cortex.conversations.list(limit=1000)
                convs_list = all_convs.get("conversations", []) if isinstance(all_convs, dict) else all_convs

                for conv in convs_list:
                    space_id = conv.get("memory_space_id") if isinstance(conv, dict) else conv.memory_space_id
                    conv_id = conv.get("conversation_id") if isinstance(conv, dict) else conv.conversation_id

                    if space_id and conv_id and any(space_id.startswith(prefix) for prefix in test_prefixes):
                        try:
                            await self.cortex.conversations.delete(conv_id)
                            result["conversations"] += 1
                        except:
                            pass
            except Exception as e:
                print(f"  Warning: Failed orphan conversation cleanup: {e}")

            # Orphaned contexts
            try:
                print("  Cleaning up orphaned contexts...")
                all_ctx = await self.cortex.contexts.list(limit=1000)
                ctx_list = all_ctx.get("contexts", []) if isinstance(all_ctx, dict) else all_ctx

                verbose = os.getenv("CLEANUP_VERBOSE") == "true"
                deleted_ctx = 0

                # Sort contexts by depth (deepest first) to handle parent/child relationships
                # Contexts without depth info go last
                sorted_ctx = sorted(
                    ctx_list,
                    key=lambda c: (c.get("depth") if isinstance(c, dict) else getattr(c, "depth", 0)) or 0,
                    reverse=True  # Deepest (children) first
                )

                for ctx in sorted_ctx:
                    space_id = ctx.get("memory_space_id") if isinstance(ctx, dict) else ctx.memory_space_id
                    ctx_id = ctx.get("id") if isinstance(ctx, dict) else ctx.id

                    # Match by prefix OR contains "-test-" OR contains "test" at all
                    is_test_context = any([
                        space_id and any(space_id.startswith(prefix) for prefix in test_prefixes),
                        space_id and '-test-' in space_id,
                        space_id and 'test' in space_id.lower(),
                    ])

                    if is_test_context and ctx_id:
                        try:
                            if verbose:
                                print(f"    Deleting context {ctx_id} (space: {space_id})...")
                            # Use cascade delete to handle children
                            from cortex.types import DeleteContextOptions
                            await self.cortex.contexts.delete(
                                ctx_id,
                                DeleteContextOptions(cascade_children=True)
                            )
                            deleted_ctx += 1
                        except Exception as e:
                            if verbose:
                                print(f"    Failed to delete context {ctx_id}: {e}")

                result["conversations"] += deleted_ctx  # Count as conversation cleanup
                if deleted_ctx > 0:
                    print(f"    Deleted {deleted_ctx} contexts")
            except Exception as e:
                print(f"  Warning: Failed orphan context cleanup: {e}")

            # Immutable entries with test type/id
            try:
                print("  Cleaning up test immutable entries...")
                all_imm = await self.cortex.immutable.list(limit=1000)
                imm_list = all_imm if isinstance(all_imm, list) else []

                for imm in imm_list:
                    # Check if type or id indicates test data
                    imm_type = imm.type if hasattr(imm, 'type') else imm.get('type')
                    imm_id = imm.id if hasattr(imm, 'id') else imm.get('id')

                    # Known test types from test suite
                    test_types = (
                        'kb-article', 'feedback', 'config', 'audit-log', 'survey',
                        'user', 'document', 'numeric-test', 'boolean-test', 'rapid-version',
                        'large-meta', 'policy', 'type-a', 'type-b', 'no-purge-needed',
                        'version-cleanup', 'search-propagation', 'other-type'
                    )

                    # Known test IDs or patterns
                    test_id_patterns = (
                        'refund', 'warranty', 'shipping', 'return', 'terms', 'feedback',
                        'article', 'settings', 'changes', 'journey', 'seq-', 'shared-id',
                        'pruned-entry', 'entry-', 'gdpr-', '-guide', '-policy'
                    )

                    # Match by type, ID pattern, or contains "test"
                    is_test = any([
                        imm_type and imm_type in test_types,
                        imm_type and any(imm_type.startswith(p) for p in test_prefixes),
                        imm_id and any(imm_id.startswith(p) for p in test_prefixes),
                        imm_id and any(pattern in str(imm_id) for pattern in test_id_patterns),
                        imm_type and '-test' in str(imm_type),
                        imm_id and '-test' in str(imm_id),
                    ])

                    if is_test and imm_type and imm_id:
                        try:
                            await self.cortex.immutable.purge(imm_type, imm_id)
                            result["immutable"] += 1
                        except:
                            pass
            except Exception as e:
                print(f"  Warning: Failed immutable cleanup: {e}")

            # Test agents
            try:
                print("  Cleaning up test agents...")
                all_agents = await self.cortex.agents.list(limit=1000)
                agents_list = all_agents if isinstance(all_agents, list) else []

                for agent in agents_list:
                    agent_id = agent.get("id") if isinstance(agent, dict) else agent.id

                    # Match test agents by prefix or pattern
                    is_test_agent = any([
                        agent_id and any(agent_id.startswith(prefix) for prefix in test_prefixes),
                        agent_id and 'dry-run' in agent_id,
                        agent_id and 'preserve' in agent_id,
                        agent_id and 'inactive' in agent_id,
                    ])

                    if is_test_agent and agent_id:
                        try:
                            await self.cortex.agents.unregister(agent_id)
                            result["users"] += 1  # Count as user cleanup
                        except:
                            pass
            except Exception as e:
                print(f"  Warning: Failed agent cleanup: {e}")

            # CRITICAL: Use backend purgeAll to delete ALL orphaned memories and facts
            # These are unreachable via SDK because their memory_space_id may not exist
            try:
                print("  Purging ALL memories via backend purgeAll...")
                mem_result = await self.cortex.client.mutation("memories:purgeAll", {})
                deleted_mems = mem_result.get("deleted", 0) if isinstance(mem_result, dict) else 0
                result["memories"] += int(deleted_mems)
                if deleted_mems > 0:
                    print(f"    Deleted {deleted_mems} memories")
            except Exception as e:
                print(f"  Warning: Failed to purge all memories: {e}")

            try:
                print("  Purging ALL facts via backend purgeAll...")
                fact_result = await self.cortex.client.mutation("facts:purgeAll", {})
                deleted_facts = fact_result.get("deleted", 0) if isinstance(fact_result, dict) else 0
                result["facts"] += int(deleted_facts)
                if deleted_facts > 0:
                    print(f"    Deleted {deleted_facts} facts")
            except Exception as e:
                print(f"  Warning: Failed to purge all facts: {e}")

            # Mutable doesn't have purgeAll, so purge known test namespaces
            try:
                print("  Purging mutable test namespaces...")
                test_namespaces = ['config', 'test-namespace', 'app-state', 'inventory', 'settings', 'counters', 'session']

                for ns in test_namespaces:
                    try:
                        # Purge entire namespace
                        purge_result = await self.cortex.mutable.purge_namespace(ns)
                        deleted = purge_result.get("deleted", 0) if isinstance(purge_result, dict) else 0
                        if deleted > 0:
                            result["mutable"] += int(deleted)
                            print(f"    Purged namespace '{ns}': {deleted} items")
                    except:
                        pass
            except Exception as e:
                print(f"  Warning: Failed to purge mutable namespaces: {e}")

            # Also purge users with test prefixes
            result["users"] += await self.purge_users()

        return result

    async def verify_empty(
        self, memory_space_id: str
    ) -> dict:
        """
        Verify that a memory space is empty.

        Args:
            memory_space_id: Memory space ID to check

        Returns:
            Dictionary indicating if each layer is empty and counts
        """
        result = {
            "conversations_empty": True,
            "conversations_count": 0,
            "memories_empty": True,
            "memories_count": 0,
            "facts_empty": True,
            "facts_count": 0,
            "immutable_empty": True,
            "immutable_count": 0,
            "mutable_empty": True,
            "mutable_count": 0,
        }

        try:
            # Check conversations
            convs = await self.cortex.conversations.list(
                memory_space_id=memory_space_id, limit=10
            )
            conversations = convs if isinstance(convs, list) else convs.get("conversations", [])
            result["conversations_count"] = len(conversations)
            result["conversations_empty"] = len(conversations) == 0

            # Check memories
            mems = await self.cortex.vector.list(
                memory_space_id=memory_space_id, limit=10
            )
            memories = mems if isinstance(mems, list) else mems.get("memories", [])
            result["memories_count"] = len(memories)
            result["memories_empty"] = len(memories) == 0

            # Check facts
            fcts = await self.cortex.facts.list(
                memory_space_id=memory_space_id, limit=10
            )
            facts = fcts if isinstance(fcts, list) else fcts.get("facts", [])
            result["facts_count"] = len(facts)
            result["facts_empty"] = len(facts) == 0

            # Check immutable
            imm = await self.cortex.immutable.list(
                memory_space_id=memory_space_id, limit=10
            )
            immutable = imm if isinstance(imm, list) else imm.get("records", [])
            result["immutable_count"] = len(immutable)
            result["immutable_empty"] = len(immutable) == 0

            # Check mutable
            mut = await self.cortex.mutable.list(
                memory_space_id=memory_space_id, limit=10
            )
            mutable = mut if isinstance(mut, list) else mut.get("records", [])
            result["mutable_count"] = len(mutable)
            result["mutable_empty"] = len(mutable) == 0

        except Exception:
            pass

        return result


@dataclass
class ScopedCleanupResult:
    """Result of scoped cleanup operations."""
    conversations: int = 0
    memories: int = 0
    facts: int = 0
    contexts: int = 0
    memory_spaces: int = 0
    users: int = 0
    agents: int = 0
    immutable: int = 0
    mutable: int = 0

    @property
    def total(self) -> int:
        """Total number of deleted entities."""
        return (
            self.conversations +
            self.memories +
            self.facts +
            self.contexts +
            self.memory_spaces +
            self.users +
            self.agents +
            self.immutable +
            self.mutable
        )


class ScopedCleanup:
    """
    Scoped cleanup helper for parallel test execution.

    Unlike TestCleanup which purges data by prefix patterns, ScopedCleanup
    only deletes entities that match the test run's unique prefix. This enables
    safe parallel test execution without interference between test runs.

    Example:
        >>> ctx = create_test_run_context()
        >>> cleanup = ScopedCleanup(cortex_client, ctx)
        >>>
        >>> # Create test data using ctx generators
        >>> user_id = ctx.user_id("alice")
        >>> await cortex.users.update(user_id, {"name": "Alice"})
        >>>
        >>> # Clean up only this run's data
        >>> result = await cleanup.cleanup_all()
        >>> print(f"Deleted {result.total} entities")
    """

    def __init__(self, cortex_client: Cortex, ctx: TestRunContext, verbose: bool = False):
        """
        Initialize scoped cleanup helper.

        Args:
            cortex_client: Cortex SDK instance
            ctx: Test run context containing the run ID prefix
            verbose: Whether to log cleanup operations (default: False)
        """
        self.cortex = cortex_client
        self.run_id = ctx.run_id
        self.verbose = verbose

    def _log(self, message: str) -> None:
        """Log message if verbose mode is enabled."""
        if self.verbose:
            print(message)

    def _belongs_to_run(self, entity_id: Optional[str]) -> bool:
        """Check if an entity ID belongs to this test run."""
        return entity_id is not None and entity_id.startswith(self.run_id)

    async def cleanup_conversations(self) -> int:
        """
        Cleanup conversations created by this test run.

        Returns:
            Number of conversations deleted
        """
        self._log(f"🧹 Cleaning up conversations for run {self.run_id}...")
        count = 0

        try:
            result = await self.cortex.conversations.list(limit=1000)
            conversations = result if isinstance(result, list) else result.get("conversations", [])

            for conv in conversations:
                space_id = conv.get("memory_space_id") if isinstance(conv, dict) else getattr(conv, "memory_space_id", None)
                conv_id = conv.get("conversation_id") if isinstance(conv, dict) else getattr(conv, "conversation_id", None)

                if self._belongs_to_run(space_id) or self._belongs_to_run(conv_id):
                    try:
                        await self.cortex.conversations.delete(conv_id)
                        count += 1
                    except Exception:
                        pass
        except Exception:
            pass

        self._log(f"✅ Cleaned up {count} conversations")
        return count

    async def cleanup_memory_spaces(self) -> int:
        """
        Cleanup memory spaces created by this test run.

        Returns:
            Number of memory spaces deleted
        """
        self._log(f"🧹 Cleaning up memory spaces for run {self.run_id}...")
        count = 0

        try:
            result = await self.cortex.memory_spaces.list(limit=1000)
            spaces = result.get("spaces", []) if isinstance(result, dict) else result

            for space in spaces:
                space_id = space.memory_space_id if hasattr(space, "memory_space_id") else space.get("memory_space_id")

                if self._belongs_to_run(space_id):
                    try:
                        await self.cortex.memory_spaces.delete(space_id)
                        count += 1
                    except Exception:
                        pass
        except Exception:
            pass

        self._log(f"✅ Cleaned up {count} memory spaces")
        return count

    async def cleanup_memories(self) -> int:
        """
        Cleanup memories in memory spaces belonging to this test run.

        Returns:
            Number of memories deleted
        """
        self._log(f"🧹 Cleaning up memories for run {self.run_id}...")
        count = 0

        try:
            result = await self.cortex.memory_spaces.list(limit=1000)
            spaces = result.get("spaces", []) if isinstance(result, dict) else result

            for space in spaces:
                space_id = space.memory_space_id if hasattr(space, "memory_space_id") else space.get("memory_space_id")

                if self._belongs_to_run(space_id):
                    try:
                        memories_result = await self.cortex.vector.list(memory_space_id=space_id, limit=1000)
                        memories = memories_result if isinstance(memories_result, list) else memories_result.get("memories", [])

                        for mem in memories:
                            mem_id = mem.get("memory_id") if isinstance(mem, dict) else getattr(mem, "memory_id", None)
                            if mem_id:
                                try:
                                    await self.cortex.vector.delete(space_id, mem_id)
                                    count += 1
                                except Exception:
                                    pass
                    except Exception:
                        pass
        except Exception:
            pass

        self._log(f"✅ Cleaned up {count} memories")
        return count

    async def cleanup_facts(self) -> int:
        """
        Cleanup facts in memory spaces belonging to this test run.

        Returns:
            Number of facts deleted
        """
        self._log(f"🧹 Cleaning up facts for run {self.run_id}...")
        count = 0

        try:
            result = await self.cortex.memory_spaces.list(limit=1000)
            spaces = result.get("spaces", []) if isinstance(result, dict) else result

            for space in spaces:
                space_id = space.memory_space_id if hasattr(space, "memory_space_id") else space.get("memory_space_id")

                if self._belongs_to_run(space_id):
                    try:
                        facts_result = await self.cortex.facts.list(memory_space_id=space_id, limit=1000)
                        facts = facts_result if isinstance(facts_result, list) else facts_result.get("facts", [])

                        for fact in facts:
                            fact_id = fact.get("fact_id") if isinstance(fact, dict) else getattr(fact, "fact_id", None)
                            if fact_id:
                                try:
                                    await self.cortex.facts.delete(space_id, fact_id)
                                    count += 1
                                except Exception:
                                    pass
                    except Exception:
                        pass
        except Exception:
            pass

        self._log(f"✅ Cleaned up {count} facts")
        return count

    async def cleanup_contexts(self) -> int:
        """
        Cleanup contexts created by this test run.

        Returns:
            Number of contexts deleted
        """
        self._log(f"🧹 Cleaning up contexts for run {self.run_id}...")
        count = 0

        try:
            result = await self.cortex.contexts.list(limit=1000)
            contexts = result.get("contexts", []) if isinstance(result, dict) else result

            for ctx in contexts:
                space_id = ctx.get("memory_space_id") if isinstance(ctx, dict) else getattr(ctx, "memory_space_id", None)
                ctx_id = ctx.get("id") if isinstance(ctx, dict) else getattr(ctx, "id", None)

                if self._belongs_to_run(space_id) or self._belongs_to_run(ctx_id):
                    try:
                        from cortex.types import DeleteContextOptions
                        await self.cortex.contexts.delete(ctx_id, DeleteContextOptions(cascade_children=True))
                        count += 1
                    except Exception:
                        pass
        except Exception:
            pass

        self._log(f"✅ Cleaned up {count} contexts")
        return count

    async def cleanup_users(self) -> int:
        """
        Cleanup users created by this test run.

        Returns:
            Number of users deleted
        """
        self._log(f"🧹 Cleaning up users for run {self.run_id}...")
        count = 0

        try:
            result = await self.cortex.users.list(limit=1000)
            users = result if isinstance(result, list) else result.get("users", [])

            for user in users:
                user_id = user.get("id") if isinstance(user, dict) else getattr(user, "id", None)

                if self._belongs_to_run(user_id):
                    try:
                        await self.cortex.users.delete(user_id)
                        count += 1
                    except Exception:
                        pass
        except Exception:
            pass

        self._log(f"✅ Cleaned up {count} users")
        return count

    async def cleanup_agents(self) -> int:
        """
        Cleanup agents created by this test run.

        Returns:
            Number of agents deleted
        """
        self._log(f"🧹 Cleaning up agents for run {self.run_id}...")
        count = 0

        try:
            result = await self.cortex.agents.list(limit=1000)
            agents = result if isinstance(result, list) else []

            for agent in agents:
                agent_id = agent.get("id") if isinstance(agent, dict) else getattr(agent, "id", None)

                if self._belongs_to_run(agent_id):
                    try:
                        await self.cortex.agents.unregister(agent_id)
                        count += 1
                    except Exception:
                        pass
        except Exception:
            pass

        self._log(f"✅ Cleaned up {count} agents")
        return count

    async def cleanup_immutable(self) -> int:
        """
        Cleanup immutable records created by this test run (excludes users).

        Returns:
            Number of immutable records deleted
        """
        self._log(f"🧹 Cleaning up immutable records for run {self.run_id}...")
        count = 0

        try:
            result = await self.cortex.immutable.list(limit=1000)
            records = result if isinstance(result, list) else []

            for record in records:
                rec_type = record.type if hasattr(record, "type") else record.get("type")
                rec_id = record.id if hasattr(record, "id") else record.get("id")

                # Skip users (handled separately)
                if rec_type == "user":
                    continue

                if self._belongs_to_run(rec_type) or self._belongs_to_run(rec_id):
                    try:
                        await self.cortex.immutable.purge(rec_type, rec_id)
                        count += 1
                    except Exception:
                        pass
        except Exception:
            pass

        self._log(f"✅ Cleaned up {count} immutable records")
        return count

    async def cleanup_mutable(self) -> int:
        """
        Cleanup mutable records created by this test run.

        Returns:
            Number of mutable records deleted
        """
        self._log(f"🧹 Cleaning up mutable records for run {self.run_id}...")
        count = 0

        try:
            result = await self.cortex.mutable.list(limit=1000)
            records = result if isinstance(result, list) else []

            for record in records:
                namespace = record.namespace if hasattr(record, "namespace") else record.get("namespace")
                key = record.key if hasattr(record, "key") else record.get("key")

                if self._belongs_to_run(namespace) or self._belongs_to_run(key):
                    try:
                        await self.cortex.mutable.delete(namespace, key)
                        count += 1
                    except Exception:
                        pass
        except Exception:
            pass

        self._log(f"✅ Cleaned up {count} mutable records")
        return count

    async def _get_run_memory_spaces(self) -> list:
        """
        Get all memory space IDs that belong to this test run.

        Returns:
            List of memory_space_id strings belonging to this run
        """
        memory_space_ids = []
        try:
            result = await self.cortex.memory_spaces.list(limit=1000)
            spaces = result.get("spaces", []) if isinstance(result, dict) else result

            for space in spaces:
                space_id = space.memory_space_id if hasattr(space, "memory_space_id") else space.get("memory_space_id")
                if self._belongs_to_run(space_id):
                    memory_space_ids.append(space_id)
        except Exception:
            pass

        return memory_space_ids

    async def cleanup_all(self) -> ScopedCleanupResult:
        """
        Cleanup all entities created by this test run.
        Order matters: delete dependent entities first.

        Uses BatchDeleter for efficient bulk deletion of entities that support
        deleteMany (conversations, contexts, memories, facts), then falls back
        to individual cleanup for other entity types.

        Returns:
            Summary of deleted entities
        """
        self._log(f"\n🧹 Starting scoped cleanup for run {self.run_id}...\n")

        result = ScopedCleanupResult()

        # Phase 1: Batch delete entities in memory spaces belonging to this run
        # This is much more efficient than one-by-one deletion
        memory_space_ids = await self._get_run_memory_spaces()

        if memory_space_ids:
            self._log(f"🚀 Batch deleting from {len(memory_space_ids)} memory spaces...")
            batch_deleter = BatchDeleter(self.cortex)

            for space_id in memory_space_ids:
                try:
                    totals = await batch_deleter.delete_all_in_space(space_id)
                    result.conversations += totals.get("conversations", 0)
                    result.contexts += totals.get("contexts", 0)
                    result.memories += totals.get("memories", 0)
                    result.facts += totals.get("facts", 0)
                    self._log(f"  ✓ {space_id}: {sum(totals.values())} entities")
                except Exception as e:
                    self._log(f"  ⚠ {space_id}: batch delete failed ({e}), falling back...")
                    # Fall back to individual cleanup for this space
                    pass

        # Phase 2: Cleanup any orphaned entities not in memory spaces
        # (e.g., conversations with conversation_id matching run but different space)
        orphan_convs = await self.cleanup_conversations()
        orphan_contexts = await self.cleanup_contexts()
        result.conversations += orphan_convs
        result.contexts += orphan_contexts

        # Phase 3: Individual cleanup for entities without batch support
        result.mutable = await self.cleanup_mutable()
        result.immutable = await self.cleanup_immutable()
        result.users = await self.cleanup_users()
        result.agents = await self.cleanup_agents()

        # Phase 4: Delete memory spaces last (after their contents are cleared)
        result.memory_spaces = await self.cleanup_memory_spaces()

        self._log(f"\n✅ Scoped cleanup complete. Total deleted: {result.total}\n")

        return result

    async def verify_cleanup(self) -> bool:
        """
        Verify that no entities from this test run remain in the database.

        Returns:
            True if cleanup was complete, False if orphaned entities found
        """
        remaining = await self.count_remaining()
        total = sum(remaining.values())

        if total > 0:
            print(f"⚠️  Found {total} orphaned entities for run {self.run_id}: {remaining}")
            return False

        self._log(f"✅ Cleanup verified - no orphaned entities for run {self.run_id}")
        return True

    async def count_remaining(self) -> Dict[str, int]:
        """
        Count remaining entities that belong to this test run.

        Returns:
            Dictionary with counts per entity type
        """
        result = {
            "conversations": 0,
            "memory_spaces": 0,
            "contexts": 0,
            "users": 0,
            "agents": 0,
            "immutable": 0,
            "mutable": 0,
        }

        try:
            # Count conversations
            convs = await self.cortex.conversations.list(limit=1000)
            convs_list = convs if isinstance(convs, list) else convs.get("conversations", [])
            result["conversations"] = sum(1 for c in convs_list if
                self._belongs_to_run(c.get("memory_space_id") if isinstance(c, dict) else getattr(c, "memory_space_id", None)) or
                self._belongs_to_run(c.get("conversation_id") if isinstance(c, dict) else getattr(c, "conversation_id", None))
            )

            # Count memory spaces
            spaces = await self.cortex.memory_spaces.list(limit=1000)
            spaces_list = spaces.get("spaces", []) if isinstance(spaces, dict) else spaces
            result["memory_spaces"] = sum(1 for s in spaces_list if
                self._belongs_to_run(s.memory_space_id if hasattr(s, "memory_space_id") else s.get("memory_space_id"))
            )

            # Count contexts
            ctxs = await self.cortex.contexts.list(limit=1000)
            ctxs_list = ctxs.get("contexts", []) if isinstance(ctxs, dict) else ctxs
            result["contexts"] = sum(1 for c in ctxs_list if
                self._belongs_to_run(c.get("memory_space_id") if isinstance(c, dict) else getattr(c, "memory_space_id", None)) or
                self._belongs_to_run(c.get("id") if isinstance(c, dict) else getattr(c, "id", None))
            )

            # Count users
            users = await self.cortex.users.list(limit=1000)
            users_list = users if isinstance(users, list) else users.get("users", [])
            result["users"] = sum(1 for u in users_list if
                self._belongs_to_run(u.get("id") if isinstance(u, dict) else getattr(u, "id", None))
            )

            # Count agents
            agents = await self.cortex.agents.list(limit=1000)
            agents_list = agents if isinstance(agents, list) else []
            result["agents"] = sum(1 for a in agents_list if
                self._belongs_to_run(a.get("id") if isinstance(a, dict) else getattr(a, "id", None))
            )

            # Count immutable (excluding users)
            imm = await self.cortex.immutable.list(limit=1000)
            imm_list = imm if isinstance(imm, list) else []
            result["immutable"] = sum(1 for r in imm_list if
                (r.type if hasattr(r, "type") else r.get("type")) != "user" and
                (self._belongs_to_run(r.type if hasattr(r, "type") else r.get("type")) or
                 self._belongs_to_run(r.id if hasattr(r, "id") else r.get("id")))
            )

            # Count mutable
            mut = await self.cortex.mutable.list(limit=1000)
            mut_list = mut if isinstance(mut, list) else []
            result["mutable"] = sum(1 for r in mut_list if
                self._belongs_to_run(r.namespace if hasattr(r, "namespace") else r.get("namespace")) or
                self._belongs_to_run(r.key if hasattr(r, "key") else r.get("key"))
            )
        except Exception as e:
            print(f"Error counting remaining entities: {e}")

        return result

