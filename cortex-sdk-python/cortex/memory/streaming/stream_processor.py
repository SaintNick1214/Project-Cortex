"""
Stream Processor

Core stream processing with hook support, chunk handling,
and integration with metrics collection.

Python implementation matching TypeScript src/memory/streaming/StreamProcessor.ts
"""

import asyncio
from typing import Any, AsyncIterable, Optional

from ..streaming_types import (
    ChunkEvent,
    ProgressEvent,
    StreamCompleteEvent,
    StreamContext,
    StreamError,
    StreamHooks,
    StreamingOptions,
)
from .stream_metrics import MetricsCollector


class StreamProcessor:
    """Core stream processor that handles chunk iteration with hooks"""

    def __init__(
        self,
        context: StreamContext,
        hooks: Optional[StreamHooks] = None,
        metrics: Optional[MetricsCollector] = None,
    ) -> None:
        self.context = context
        self.hooks = hooks or StreamHooks()
        self.metrics = metrics or MetricsCollector()
        self.accumulated_content = ""
        self.chunk_number = 0
        self.progress_callback_counter = 0

    async def process_stream(
        self,
        stream: AsyncIterable[str],
        options: Optional[StreamingOptions] = None,
    ) -> str:
        """Process a stream and return the complete content"""
        opts = options or StreamingOptions()

        try:
            # Process async iterable chunks
            await self._process_async_iterable(stream, opts)

            # Emit completion event
            if self.hooks.on_complete:
                complete_event = StreamCompleteEvent(
                    full_response=self.accumulated_content,
                    total_chunks=self.chunk_number,
                    duration_ms=self.metrics.get_snapshot().stream_duration_ms,
                    facts_extracted=self.metrics.get_snapshot().facts_extracted,
                )
                await self._safely_call_hook(self.hooks.on_complete, complete_event)

            return self.accumulated_content

        except Exception as error:
            # Emit error event
            if self.hooks.on_error:
                from ..streaming_types import ErrorContext

                stream_error = StreamError(
                    code="STREAM_PROCESSING_ERROR",
                    message=str(error),
                    recoverable=False,
                    partial_data_saved=False,
                    context=ErrorContext(
                        phase="streaming",
                        chunk_number=self.chunk_number,
                        bytes_processed=len(self.accumulated_content),
                    ),
                    original_error=error,
                )
                await self._safely_call_hook(self.hooks.on_error, stream_error)
            raise

    async def _process_async_iterable(
        self, iterable: AsyncIterable[str], options: StreamingOptions
    ) -> None:
        """Process an AsyncIterable"""
        async for chunk in iterable:
            if chunk:
                await self._process_chunk(chunk, options)

    async def _process_chunk(
        self, chunk: str, options: StreamingOptions
    ) -> None:
        """Process a single chunk"""
        import time

        # Update state
        self.chunk_number += 1
        self.accumulated_content += chunk

        # Record metrics
        self.metrics.record_chunk(len(chunk))

        # Update context
        self.context.chunk_count = self.chunk_number
        self.context.accumulated_text = self.accumulated_content
        self.context.estimated_tokens = self.metrics.get_snapshot().estimated_tokens
        self.context.elapsed_ms = (
            int(time.time() * 1000) - self.metrics.get_snapshot().start_time
        )

        # Emit chunk event
        if self.hooks.on_chunk:
            chunk_event = ChunkEvent(
                chunk=chunk,
                chunk_number=self.chunk_number,
                accumulated=self.accumulated_content,
                timestamp=int(time.time() * 1000),
                estimated_tokens=self.metrics.get_snapshot().estimated_tokens,
            )
            await self._safely_call_hook(self.hooks.on_chunk, chunk_event)

        # Emit progress event (every 10 chunks or as configured)
        progress_interval = 5 if options.progressive_fact_extraction else 10
        if self.chunk_number % progress_interval == 0 and self.hooks.on_progress:
            self.progress_callback_counter += 1
            metrics_snapshot = self.metrics.get_snapshot()
            progress_event = ProgressEvent(
                bytes_processed=len(self.accumulated_content),
                chunks=self.chunk_number,
                elapsed_ms=metrics_snapshot.stream_duration_ms,
                estimated_completion=self._estimate_completion(metrics_snapshot),
                current_phase="streaming",
            )
            await self._safely_call_hook(self.hooks.on_progress, progress_event)

    def _estimate_completion(self, metrics: Any) -> Optional[int]:
        """Estimate completion time based on current metrics"""
        # Simple heuristic: if we have at least 5 chunks, estimate based on throughput
        if self.chunk_number < 5:
            return None

        # Disabled for now as it requires more sophisticated prediction
        return None

    async def _safely_call_hook(self, hook_fn: Any, *args: Any) -> None:
        """Safely call a hook, catching and logging errors without stopping processing"""
        try:
            result = hook_fn(*args)
            if asyncio.iscoroutine(result):
                await result
        except Exception as error:
            print(f"Warning: Error in stream hook: {error}")
            # Don't rethrow - hooks shouldn't break the stream

    def get_metrics(self) -> MetricsCollector:
        """Get current metrics"""
        return self.metrics

    def get_accumulated_content(self) -> str:
        """Get accumulated content so far"""
        return self.accumulated_content

    def get_chunk_number(self) -> int:
        """Get current chunk number"""
        return self.chunk_number

    def get_context(self) -> StreamContext:
        """Get stream context"""
        return self.context


def create_stream_context(
    memory_space_id: str,
    conversation_id: str,
    user_id: str,
    user_name: str,
    partial_memory_id: Optional[str] = None,
) -> StreamContext:
    """Helper to create a StreamContext"""

    return StreamContext(
        memory_space_id=memory_space_id,
        conversation_id=conversation_id,
        user_id=user_id,
        user_name=user_name,
        accumulated_text="",
        chunk_count=0,
        estimated_tokens=0,
        elapsed_ms=0,
        partial_memory_id=partial_memory_id,
        extracted_fact_ids=[],
        metrics=None,  # Will be populated by processor
    )
