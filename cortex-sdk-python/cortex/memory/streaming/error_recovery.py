"""
Error Recovery System

Handles stream failures with multiple recovery strategies:
- Store partial data for later recovery
- Rollback to last known good state
- Retry with exponential backoff
- Best-effort continuation

Includes resume token generation for interrupted streams.

Python implementation matching TypeScript src/memory/streaming/ErrorRecovery.ts
"""

import asyncio
import hashlib
import secrets
from typing import Any, Callable, Optional, TypeVar

from ..streaming_types import (
    FailureStrategy,
    RecoveryOptions,
    RecoveryResult,
    ResumeContext,
    StreamContext,
    StreamError,
)

T = TypeVar("T")


class StreamErrorRecovery:
    """Handles error recovery for streaming operations"""

    def __init__(self, client: Any) -> None:
        self.client = client
        self.resume_token_ttl = 3600000  # 1 hour in milliseconds

    async def handle_stream_error(
        self,
        error: Exception,
        context: StreamContext,
        options: RecoveryOptions,
    ) -> RecoveryResult:
        """Handle a stream error and attempt recovery"""
        print(f"Warning: Stream error occurred: {error}")

        if options.strategy == FailureStrategy.STORE_PARTIAL:
            return await self._store_partial_on_failure(context, options)

        elif options.strategy == FailureStrategy.ROLLBACK:
            return await self._rollback_to_last_state(context)

        elif options.strategy == FailureStrategy.RETRY:
            return await self._retry_strategy(context, options)

        elif options.strategy == FailureStrategy.BEST_EFFORT:
            return await self._best_effort_strategy(context, options)

        else:
            return RecoveryResult(
                success=False, strategy=options.strategy, error=error
            )

    async def _store_partial_on_failure(
        self, context: StreamContext, options: RecoveryOptions
    ) -> RecoveryResult:
        """Store partial data on failure"""
        import time

        try:
            # Generate resume token if requested
            resume_token: Optional[str] = None
            if options.preserve_partial_data:
                resume_token = await self.generate_resume_token(
                    ResumeContext(
                        resume_token="",  # Will be filled in
                        last_processed_chunk=context.chunk_count,
                        accumulated_content=context.accumulated_text,
                        partial_memory_id=context.partial_memory_id or "",
                        facts_extracted=context.extracted_fact_ids,
                        timestamp=int(time.time() * 1000),
                        checksum=self._calculate_checksum(context.accumulated_text),
                    )
                )

            return RecoveryResult(
                success=True,
                strategy=FailureStrategy.STORE_PARTIAL,
                partial_memory_id=context.partial_memory_id or "",
                resume_token=resume_token,
            )

        except Exception as error:
            return RecoveryResult(
                success=False, strategy=FailureStrategy.STORE_PARTIAL, error=error
            )

    async def _rollback_to_last_state(
        self, context: StreamContext
    ) -> RecoveryResult:
        """Rollback to last known good state"""
        try:
            # Delete partial memory if it exists
            if context.partial_memory_id:
                await self.client.mutation(
                    "memories:deleteMemory",
                    {
                        "memorySpaceId": context.memory_space_id,
                        "memoryId": context.partial_memory_id,
                    },
                )

            return RecoveryResult(success=True, strategy=FailureStrategy.ROLLBACK)

        except Exception as error:
            return RecoveryResult(
                success=False, strategy=FailureStrategy.ROLLBACK, error=error
            )

    async def _retry_strategy(
        self, context: StreamContext, options: RecoveryOptions
    ) -> RecoveryResult:
        """Retry strategy (placeholder - actual retry logic in caller)"""
        # The actual retry logic should be handled by the caller
        # This just returns a result indicating retry should be attempted
        return RecoveryResult(success=False, strategy=FailureStrategy.RETRY)

    async def _best_effort_strategy(
        self, context: StreamContext, options: RecoveryOptions
    ) -> RecoveryResult:
        """Best-effort strategy - try to save what we can"""
        try:
            # Try to store partial content if we have any
            if context.accumulated_text and len(context.accumulated_text) > 0:
                result = await self._store_partial_on_failure(context, options)
                return result

            return RecoveryResult(success=False, strategy=FailureStrategy.BEST_EFFORT)

        except Exception as error:
            return RecoveryResult(
                success=False, strategy=FailureStrategy.BEST_EFFORT, error=error
            )

    async def retry_with_backoff(
        self,
        operation: Callable[[], T],
        max_retries: int = 3,
        base_delay: int = 1000,
    ) -> T:
        """Retry an operation with exponential backoff"""
        last_error: Optional[Exception] = None

        for attempt in range(max_retries):
            try:
                result = operation()
                if asyncio.iscoroutine(result):
                    result_awaited: T = await result  # type: ignore
                    return result_awaited
                return result  # type: ignore

            except Exception as error:
                last_error = error

                if attempt < max_retries - 1:
                    # Calculate exponential backoff delay
                    delay = base_delay * (2**attempt)
                    await asyncio.sleep(delay / 1000)  # Convert to seconds

        raise last_error or Exception("Max retries exceeded")

    async def generate_resume_token(self, context: ResumeContext) -> str:
        """Generate a resume token for interrupted streams"""
        import time

        # Create a unique token
        token = f"resume_{int(time.time() * 1000)}_{secrets.token_hex(16)}"

        # Store resume context in mutable store with TTL
        try:
            await self.client.mutation(
                "mutable:set",
                {
                    "namespace": "resume-tokens",
                    "key": token,
                    "value": {
                        "resumeToken": token,
                        "lastProcessedChunk": context.last_processed_chunk,
                        "accumulatedContent": context.accumulated_content,
                        "partialMemoryId": context.partial_memory_id,
                        "factsExtracted": context.facts_extracted,
                        "timestamp": context.timestamp,
                        "checksum": context.checksum,
                        "expiresAt": int(time.time() * 1000) + self.resume_token_ttl,
                    },
                },
            )

            return token

        except Exception as error:
            raise Exception(f"Failed to generate resume token: {error}")

    async def validate_resume_token(self, token: str) -> Optional[ResumeContext]:
        """Validate and retrieve resume context from token"""
        import time

        try:
            stored = await self.client.query(
                "mutable:get", {"namespace": "resume-tokens", "key": token}
            )

            if not stored or not stored.get("value"):
                return None

            context_data = stored["value"]

            # Check if expired
            if context_data.get("expiresAt", 0) < int(time.time() * 1000):
                return None

            # Validate checksum
            calculated_checksum = self._calculate_checksum(
                context_data.get("accumulatedContent", "")
            )
            if calculated_checksum != context_data.get("checksum"):
                print("Warning: Resume context checksum mismatch")
                return None

            return ResumeContext(
                resume_token=context_data.get("resumeToken", ""),
                last_processed_chunk=context_data.get("lastProcessedChunk", 0),
                accumulated_content=context_data.get("accumulatedContent", ""),
                partial_memory_id=context_data.get("partialMemoryId", ""),
                facts_extracted=context_data.get("factsExtracted", []),
                timestamp=context_data.get("timestamp", 0),
                checksum=context_data.get("checksum", ""),
            )

        except Exception as error:
            print(f"Error: Failed to validate resume token: {error}")
            return None

    async def delete_resume_token(self, token: str) -> None:
        """Delete a resume token (cleanup)"""
        try:
            # TODO: Implement mutable.delete mutation in Convex
            print("Warning: Resume token cleanup not yet implemented")
            # await self.client.mutation(
            #     "mutable:delete",
            #     {"namespace": "resume-tokens", "key": token}
            # )
        except Exception as error:
            print(f"Warning: Failed to delete resume token: {error}")
            # Non-critical - tokens will expire anyway

    def _calculate_checksum(self, content: str) -> str:
        """Calculate checksum for content verification"""
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def create_stream_error(
        self,
        error: Exception,
        context: StreamContext,
        phase: str,
    ) -> StreamError:
        """Create a StreamError from a generic error"""
        from ..streaming_types import ErrorContext

        return StreamError(
            code=self._error_code_from_error(error),
            message=str(error),
            recoverable=self._is_recoverable(error),
            partial_data_saved=bool(context.partial_memory_id),
            context=ErrorContext(
                phase=phase,  # type: ignore
                chunk_number=context.chunk_count,
                bytes_processed=len(context.accumulated_text),
                partial_memory_id=context.partial_memory_id,
            ),
            original_error=error,
        )

    def _is_recoverable(self, error: Exception) -> bool:
        """Determine if an error is recoverable"""
        recoverable_patterns = [
            "ECONNRESET",
            "ETIMEDOUT",
            "ENOTFOUND",
            "Network",
            "timeout",
        ]

        error_str = str(error)
        return any(pattern in error_str for pattern in recoverable_patterns)

    def _error_code_from_error(self, error: Exception) -> str:
        """Get error code from error"""
        if hasattr(error, "code"):
            return str(error.code)
        return "UNKNOWN_ERROR"


class ResumableStreamError(Exception):
    """Resumable error class"""

    def __init__(self, original_error: Exception, resume_token: str) -> None:
        self.original_error = original_error
        self.resume_token = resume_token
        super().__init__(
            f"Stream interrupted: {original_error}. Resume with token: {resume_token}"
        )
