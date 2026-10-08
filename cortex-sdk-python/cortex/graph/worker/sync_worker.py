"""Exact-scope managed queue worker; Python uses explicit bounded polling."""

import asyncio
import re
import time
from typing import Any, Optional

from ...types import GraphJobReceipt, GraphSyncWorkerOptions, SyncHealthMetrics
from ..erasure import deliver_graph_job
from ..errors import GraphDatabaseError
from ..identity import graph_job_from_wire, safe_integer
from ..schema.init_schema import assert_managed_graph_compatibility


class GraphSyncWorker:
    """One owned drain, original immutable jobs, and an awaited stop."""

    def __init__(self, client: Any, graph_adapter: Any,
                 options: Optional[GraphSyncWorkerOptions] = None,
                 *, tenant_id: Optional[str] = None) -> None:
        self.client, self.graph_adapter = client, graph_adapter
        self.options = options or GraphSyncWorkerOptions()
        if not safe_integer(self.options.batch_size) or not 1 <= self.options.batch_size <= 128 or not safe_integer(self.options.retry_attempts) or not 1 <= self.options.retry_attempts <= 10 or type(self.options.verbose) is not bool or tenant_id is not None and not isinstance(tenant_id, str):
            raise GraphDatabaseError("Invalid bounded graph worker options.", "GRAPH_WORKER_OPTIONS_INVALID")
        self.tenant_id = tenant_id
        self._running = False
        self._task: Optional[asyncio.Task[None]] = None
        self._startup_task: Optional[asyncio.Task[None]] = None
        self._stop_requested = False
        self._wake = asyncio.Event()
        self._total_time = 0.0
        self._metrics = SyncHealthMetrics(False, 0, 0, 0, 0, 0)

    @property
    def is_running(self) -> bool:
        return self._running

    async def start(self) -> None:
        if self._running:
            return
        if self._startup_task is not None:
            await asyncio.shield(self._startup_task)
            return
        self._stop_requested = False
        async def begin() -> None:
            await assert_managed_graph_compatibility(self.graph_adapter)
            if self._stop_requested:
                return
            self._running = True
            self._metrics.is_running = True
            self._wake.clear()
            self._task = asyncio.create_task(self._poll())
        startup = asyncio.create_task(begin())
        self._startup_task = startup
        try:
            await asyncio.shield(startup)
        finally:
            if startup.done() and self._startup_task is startup:
                self._startup_task = None

    async def process_once(self) -> None:
        """One exact bounded queue read; useful to applications with owned scheduling."""
        args = {"limit": self.options.batch_size, **({"tenantId": self.tenant_id} if self.tenant_id is not None else {})}
        try:
            values = await self.client.query("graphSync:getUnsyncedItems", args)
        except Exception:
            self._metrics.last_error_code = "GRAPH_QUEUE_TRANSPORT_FAILED"
            return
        try:
            if not isinstance(values, list) or len(values) > self.options.batch_size:
                raise GraphDatabaseError("Invalid native graph queue batch.", "GRAPH_JOB_UNRESOLVED")
            jobs = [graph_job_from_wire(value) for value in values]
            if any(job.identity.tenant_id != self.tenant_id for job in jobs):
                raise GraphDatabaseError("Foreign graph queue item.", "GRAPH_SCOPE_MISMATCH")
        except GraphDatabaseError as error:
            self._metrics.last_error_code = error.code
            return
        self._metrics.queue_size = len(jobs)
        for job in jobs:
            if not self._running:
                break
            start = time.monotonic()
            receipt = GraphJobReceipt(job.id, job.generation, job.identity, job.source_revision)
            try:
                await deliver_graph_job(self.client, self.graph_adapter, receipt)
                self._metrics.success_count += 1
                self._metrics.last_error_code = None
            except Exception as error:
                self._metrics.failure_count += 1
                code = getattr(error, "code", None) or "GRAPH_ACK_UNKNOWN"
                self._metrics.last_error_code = code
                try:
                    await self.client.mutation("graphSync:markFailed", {
                        "id": job.id, "generation": job.generation, "attemptToken": job.attempt_token,
                        **({"tenantId": self.tenant_id} if self.tenant_id is not None else {}),
                        "errorCode": code if re.fullmatch(r"[A-Z0-9_]{1,96}", code) else "GRAPH_DELIVERY_FAILED",
                        "maxAttempts": self.options.retry_attempts,
                    })
                except Exception:
                    self._metrics.last_error_code = "GRAPH_FAILURE_ACK_UNRESOLVED"
            finally:
                self._metrics.total_processed += 1
                self._total_time += (time.monotonic() - start) * 1000
                self._metrics.avg_sync_time_ms = self._total_time / self._metrics.total_processed
                self._metrics.last_sync_at = int(time.time() * 1000)
                self._metrics.queue_size -= 1

    async def _poll(self) -> None:
        try:
            while self._running:
                await self.process_once()
                if self._running:
                    try:
                        await asyncio.wait_for(self._wake.wait(), timeout=1)
                    except asyncio.TimeoutError:
                        pass
        except Exception:
            self._metrics.last_error_code = "GRAPH_WORKER_DRAIN_FAILED"

    async def stop(self) -> None:
        self._stop_requested = True
        self._running = False
        self._metrics.is_running = False
        self._wake.set()
        if self._startup_task is not None:
            await asyncio.shield(self._startup_task)
            self._startup_task = None
        if self._task is not None:
            await asyncio.shield(self._task)
            self._task = None
        self._metrics.queue_size = 0

    def get_metrics(self) -> SyncHealthMetrics:
        from dataclasses import replace

        return replace(self._metrics)
