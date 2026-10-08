"""Automatic graph tuple selection and ownership contract, with no service calls."""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from cortex.client import Cortex
from cortex.graph.config import GraphConnectionOptions, resolve_graph_connection
from cortex.types import CortexConfig, GraphConfig

CONNECTION = GraphConnectionOptions(uri="bolt://127.0.0.1:45387", username="owned", password="private-password")

@pytest.fixture(autouse=True)
def clean_environment(monkeypatch):
    for key in ("CORTEX_GRAPH_SYNC", "NEO4J_URI", "NEO4J_USERNAME", "NEO4J_PASSWORD", "MEMGRAPH_URI", "MEMGRAPH_USERNAME", "MEMGRAPH_PASSWORD"):
        monkeypatch.delenv(key, raising=False)

@pytest.mark.parametrize("provider", ["neo4j", "memgraph"])
def test_provider_tuple(provider):
    prefix = provider.upper()
    result = resolve_graph_connection(env={"CORTEX_GRAPH_SYNC": "true", f"{prefix}_URI": CONNECTION.uri, f"{prefix}_USERNAME": CONNECTION.username, f"{prefix}_PASSWORD": CONNECTION.password})
    assert (result.uri, result.username, result.password) == (CONNECTION.uri, CONNECTION.username, CONNECTION.password)

def test_explicit_off_and_opt_in():
    assert resolve_graph_connection(env={"NEO4J_URI": CONNECTION.uri}) is None
    assert resolve_graph_connection(False, env={"CORTEX_GRAPH_SYNC": "true"}) is None

def test_ambiguous_missing_and_mixed_tuples():
    for values, match in [({}, "no URI"), ({"NEO4J_URI": CONNECTION.uri, "MEMGRAPH_URI": CONNECTION.uri}, "ambiguous"), ({"MEMGRAPH_URI": CONNECTION.uri, "NEO4J_USERNAME": "wrong", "NEO4J_PASSWORD": "secret"}, "incomplete")]:
        with pytest.raises(ValueError, match=match):
            resolve_graph_connection(True, env=values)

def test_explicit_selected_provider_and_untyped_uri():
    result = resolve_graph_connection(True, GraphConnectionOptions(type="memgraph"), {"NEO4J_URI": "wrong", "NEO4J_USERNAME": "wrong", "NEO4J_PASSWORD": "wrong", "MEMGRAPH_URI": CONNECTION.uri, "MEMGRAPH_USERNAME": CONNECTION.username, "MEMGRAPH_PASSWORD": CONNECTION.password})
    assert result.username == CONNECTION.username and result.password == CONNECTION.password
    with pytest.raises(ValueError, match="incomplete") as error:
        resolve_graph_connection(True, GraphConnectionOptions(uri="bolt://secret:private-password@localhost"), {"NEO4J_USERNAME": "wrong", "NEO4J_PASSWORD": "wrong"})
    assert "private-password" not in str(error.value)
    assert resolve_graph_connection(True, CONNECTION, {}).password == CONNECTION.password

@pytest.mark.asyncio
async def test_explicit_off_never_creates_driver(monkeypatch):
    monkeypatch.setenv("CORTEX_GRAPH_SYNC", "true")
    with patch("cortex.graph.adapters.CypherGraphAdapter") as factory:
        assert await Cortex._auto_configure_graph(False) is None
        factory.assert_not_called()

@pytest.mark.asyncio
async def test_connection_failure_is_honest():
    with patch("cortex.graph.adapters.CypherGraphAdapter") as factory:
        factory.return_value.connect = AsyncMock(side_effect=RuntimeError("connection failed"))
        with pytest.raises(RuntimeError, match="connection failed"):
            await Cortex._auto_configure_graph(True, CONNECTION)

def bare_cortex(adapter=None):
    cortex = object.__new__(Cortex)
    cortex._owned_graph_adapter = adapter
    cortex._cleanup_task = None
    cortex._worker_task = None
    cortex.sync_worker = MagicMock()
    cortex._resilience = MagicMock(shutdown=AsyncMock())
    cortex.client = MagicMock(close=AsyncMock())
    return cortex

@pytest.mark.asyncio
@pytest.mark.parametrize("first", ["close", "shutdown"])
async def test_exactly_once_concurrent_disposal(first):
    adapter = MagicMock(disconnect=AsyncMock())
    cortex = bare_cortex(adapter)
    await asyncio.gather(getattr(cortex, first)(), cortex.close(), cortex.shutdown())
    await cortex.close()
    adapter.disconnect.assert_awaited_once()
    cortex.client.close.assert_awaited_once()

@pytest.mark.asyncio
async def test_cleanup_is_awaited_and_cancellation_does_not_cancel_owner():
    gate = asyncio.Event()
    adapter = MagicMock(disconnect=AsyncMock(side_effect=gate.wait))
    cortex = bare_cortex(adapter)
    waiter = asyncio.create_task(cortex.close())
    await asyncio.sleep(0)
    waiter.cancel()
    with pytest.raises(asyncio.CancelledError):
        await waiter
    assert not cortex._cleanup_task.done()
    gate.set()
    await cortex.shutdown()
    adapter.disconnect.assert_awaited_once()

@pytest.mark.asyncio
async def test_cleanup_failure_is_redacted_and_all_resources_attempted():
    adapter = MagicMock(disconnect=AsyncMock(side_effect=RuntimeError("private-password bolt://secret:password@host")))
    cortex = bare_cortex(adapter)
    cortex._resilience.shutdown.side_effect = RuntimeError("failed drain")
    with pytest.raises(RuntimeError, match="Cortex resource cleanup failed") as error:
        await cortex.shutdown()
    assert "private-password" not in str(error.value)
    with pytest.raises(RuntimeError, match="Cortex resource cleanup failed"):
        await cortex.close()
    adapter.disconnect.assert_awaited_once()
    cortex.client.close.assert_awaited_once()

@pytest.mark.asyncio
async def test_failed_construction_releases_owned_graph():
    adapter = MagicMock(disconnect=AsyncMock())
    with patch.object(Cortex, "_auto_configure_graph", AsyncMock(return_value=GraphConfig(adapter=adapter))), patch.object(Cortex, "__init__", side_effect=ValueError("construction sentinel")):
        with pytest.raises(ValueError, match="construction sentinel"):
            await Cortex.create(CortexConfig(convex_url="http://127.0.0.1:43210"), graph_enabled=True)
    adapter.disconnect.assert_awaited_once()

@pytest.mark.asyncio
async def test_manual_adapter_precedence_and_retained_usability():
    adapter = MagicMock(disconnect=AsyncMock(), is_connected=AsyncMock(return_value=True))
    with patch.object(Cortex, "_auto_configure_graph", AsyncMock()) as automatic, patch.object(Cortex, "__init__", return_value=None):
        cortex = await Cortex.create(CortexConfig(convex_url="http://127.0.0.1:43210", graph=GraphConfig(adapter=adapter)), graph_enabled=False)
    automatic.assert_not_awaited()
    assert cortex._owned_graph_adapter is None
    # Constructor normally supplies these state fields; retain the observed ownership.
    cortex._cleanup_task = None
    cortex._worker_task = None; cortex.sync_worker = None
    cortex._resilience = MagicMock(); cortex.client = MagicMock(close=AsyncMock())
    await cortex.close()
    adapter.disconnect.assert_not_awaited()
    assert await adapter.is_connected()

@pytest.mark.asyncio
async def test_pending_worker_cannot_restart_after_disposal():
    cortex = bare_cortex()
    gate = asyncio.Event()
    cortex._worker_task = asyncio.create_task(gate.wait())
    await cortex.close()
    assert cortex._worker_task.cancelled()
    cortex.sync_worker.stop.assert_called_once()

@pytest.mark.asyncio
async def test_optional_graph_dependency_error_is_actionable():
    with patch("cortex.graph.adapters.CypherGraphAdapter", side_effect=ImportError("neo4j unavailable")):
        with pytest.raises(ImportError, match=r"cortex-memory\[graph\]"):
            await Cortex._auto_configure_graph(True, CONNECTION)

@pytest.mark.asyncio
async def test_worker_stop_failure_still_cancels_task_and_releases_resources():
    adapter = MagicMock(disconnect=AsyncMock())
    cortex = bare_cortex(adapter)
    cortex.sync_worker.stop.side_effect = RuntimeError("failed stop")
    cortex._worker_task = asyncio.create_task(asyncio.Event().wait())
    with pytest.raises(RuntimeError, match="Cortex resource cleanup failed"):
        await cortex.shutdown()
    assert cortex._worker_task.cancelled()
    adapter.disconnect.assert_awaited_once()
    cortex.client.close.assert_awaited_once()
