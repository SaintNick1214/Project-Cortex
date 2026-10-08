"""Compatibility import for the single managed worker implementation."""

from .worker.sync_worker import GraphSyncWorker

__all__ = ["GraphSyncWorker"]
