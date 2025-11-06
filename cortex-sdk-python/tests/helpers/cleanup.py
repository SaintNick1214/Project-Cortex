"""
Test cleanup utilities for Cortex Python SDK tests.

Provides TestCleanup class for purging test data across all layers.
"""

from typing import Optional
from cortex import Cortex


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

        except Exception as e:
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
        result["conversations"] = await self.purge_conversations(memory_space_id)
        result["memories"] = await self.purge_memories(memory_space_id, delete_all=delete_all)
        result["facts"] = await self.purge_facts(memory_space_id, delete_all=delete_all)
        result["immutable"] = await self.purge_immutable(memory_space_id, delete_all=delete_all)
        result["mutable"] = await self.purge_mutable(memory_space_id, key_prefix=None if delete_all else "test-")

        return result

    async def purge_all(self, memory_space_id: Optional[str] = None) -> dict:
        """
        Purge all test data across all layers.

        Args:
            memory_space_id: Optional memory space ID to filter by

        Returns:
            Dictionary with counts of deleted items
        """
        result = {
            "conversations": 0,
            "memories": 0,
            "facts": 0,
            "immutable": 0,
            "mutable": 0,
            "users": 0,
        }

        if memory_space_id:
            space_result = await self.purge_memory_space(memory_space_id)
            result.update(space_result)
        else:
            # Purge conversations with test- or e2e-test- prefixes
            result["conversations"] = await self.purge_conversations(
                memory_space_id=None, 
                memory_space_prefixes=("test-", "e2e-test-")
            )
            # Can't purge memories/facts without memory_space_id
            result["users"] = await self.purge_users()

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

