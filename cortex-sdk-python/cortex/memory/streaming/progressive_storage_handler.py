"""
Progressive Storage Handler

Manages partial memory updates during streaming to enable:
- Incremental storage as content arrives
- Resumability in case of failures
- Real-time access to in-progress memories
- Rollback capabilities

Python implementation matching TypeScript src/memory/streaming/ProgressiveStorageHandler.ts
"""

from typing import Any, List, Optional

from ..streaming_types import PartialUpdate


class ProgressiveStorageHandler:
    """Handles progressive storage of streaming content"""

    def __init__(
        self,
        client: Any,
        memory_space_id: str,
        conversation_id: str,
        user_id: str,
        update_interval: int = 3000,  # Default: update every 3 seconds
    ) -> None:
        self.client = client
        self.memory_space_id = memory_space_id
        self.conversation_id = conversation_id
        self.user_id = user_id
        self.update_interval = update_interval

        self.partial_memory_id: Optional[str] = None
        self.last_update_time = 0
        self.update_history: List[PartialUpdate] = []
        self.is_initialized = False
        self.is_finalized = False

    async def initialize_partial_memory(
        self,
        participant_id: Optional[str] = None,
        user_message: str = "",
        importance: int = 50,
        tags: Optional[List[str]] = None,
    ) -> str:
        """
        Initialize partial memory storage
        Creates the initial partial memory record
        """
        import time

        if self.is_initialized:
            raise Exception("Partial memory already initialized")

        try:
            # Create initial partial memory with placeholder content
            result = await self.client.mutation(
                "memories:storePartialMemory",
                {
                    "memorySpaceId": self.memory_space_id,
                    "participantId": participant_id if participant_id is not None else "agent",  # Default to "agent"
                    "conversationId": self.conversation_id,
                    "userId": self.user_id,
                    "content": "[Streaming in progress...]",
                    "isPartial": True,
                    "metadata": {
                        "userMessage": user_message,
                        "streamStartTime": int(time.time() * 1000),
                    },
                    "importance": importance if importance is not None else 50,  # Default to 50
                    "tags": [*(tags or []), "streaming", "partial"],
                },
            )

            self.partial_memory_id = result["memoryId"]
            self.is_initialized = True
            self.last_update_time = int(time.time() * 1000)

            return self.partial_memory_id

        except Exception as error:
            raise Exception(f"Failed to initialize partial memory: {error}")

    async def update_partial_content(
        self, content: str, chunk_number: int, force: bool = False
    ) -> bool:
        """
        Update partial memory content
        Only updates if enough time has passed since last update
        """
        import time

        if not self.is_initialized or not self.partial_memory_id:
            raise Exception("Partial memory not initialized")

        if self.is_finalized:
            return False  # Already finalized, no more updates

        now = int(time.time() * 1000)
        time_since_last_update = now - self.last_update_time

        # Only update if interval has passed or forced
        if not force and time_since_last_update < self.update_interval:
            return False

        try:
            await self.client.mutation(
                "memories:updatePartialMemory",
                {
                    "memoryId": self.partial_memory_id,
                    "content": content,
                    "metadata": {
                        "lastUpdateTime": now,
                        "currentChunk": chunk_number,
                        "contentLength": len(content),
                    },
                },
            )

            self.last_update_time = now
            self.update_history.append(
                PartialUpdate(
                    timestamp=now,
                    memory_id=self.partial_memory_id,
                    content_length=len(content),
                    chunk_number=chunk_number,
                )
            )

            return True

        except Exception as error:
            print(f"Warning: Failed to update partial memory: {error}")
            return False

    async def finalize_memory(
        self, full_content: str, embedding: Optional[List[float]] = None
    ) -> None:
        """
        Finalize the partial memory with complete content
        Marks the memory as complete and removes partial flags
        """
        import time

        if not self.is_initialized or not self.partial_memory_id:
            raise Exception("Partial memory not initialized")

        if self.is_finalized:
            return  # Already finalized

        try:
            mutation_params = {
                "memoryId": self.partial_memory_id,
                "content": full_content,
                "metadata": {
                    "streamCompleteTime": int(time.time() * 1000),
                    "totalUpdates": len(self.update_history),
                    "finalContentLength": len(full_content),
                },
            }

            # Only include embedding if provided (Convex requires array, not null)
            if embedding is not None:
                mutation_params["embedding"] = embedding  # type: ignore[assignment]

            await self.client.mutation("memories:finalizePartialMemory", mutation_params)

            self.is_finalized = True

        except Exception as error:
            raise Exception(f"Failed to finalize partial memory: {error}")

    async def rollback(self) -> None:
        """
        Rollback/delete the partial memory
        Used when stream fails and we want to clean up
        """
        if not self.partial_memory_id:
            return  # Nothing to rollback

        try:
            await self.client.mutation(
                "memories:deleteMemory",
                {
                    "memorySpaceId": self.memory_space_id,
                    "memoryId": self.partial_memory_id,
                },
            )

            self.partial_memory_id = None
            self.is_initialized = False
            self.is_finalized = False
            self.update_history = []

        except Exception as error:
            print(f"Warning: Failed to rollback partial memory: {error}")
            # Don't throw - best effort cleanup

    def should_update(self) -> bool:
        """Check if update should happen based on interval"""
        import time

        if not self.is_initialized or self.is_finalized:
            return False

        time_since_last_update = int(time.time() * 1000) - self.last_update_time
        return time_since_last_update >= self.update_interval

    def get_partial_memory_id(self) -> Optional[str]:
        """Get the partial memory ID"""
        return self.partial_memory_id

    def get_update_history(self) -> List[PartialUpdate]:
        """Get update history"""
        return list(self.update_history)

    def is_ready(self) -> bool:
        """Check if initialized"""
        return self.is_initialized and not self.is_finalized

    def is_complete(self) -> bool:
        """Check if finalized"""
        return self.is_finalized


def calculate_optimal_update_interval(
    average_chunk_size: float, chunks_per_second: float
) -> int:
    """Helper to estimate optimal update interval based on stream characteristics"""
    # If stream is very fast, update less frequently to reduce load
    if chunks_per_second > 10:
        return 5000  # 5 seconds

    # If stream is slow, update more frequently for better progress tracking
    if chunks_per_second < 1:
        return 1000  # 1 second

    # Default: 3 seconds
    return 3000
