"""Connection probes must be read-only and distinguish capability from failures."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from cortex.graph.adapters.cypher import CypherGraphAdapter
from cortex.graph.errors import GraphConnectionError
from cortex.types import GraphConnectionConfig

CONFIG = GraphConnectionConfig(uri="bolt://secret:private-password@localhost", username="secret", password="private-password")

@pytest.mark.asyncio
@pytest.mark.parametrize("failure", [None, "Unknown function elementId", "authentication failed private-password", "network elementId failed", "invalid syntax elementId"])
async def test_read_only_probe_failure_distinction(failure):
    result = MagicMock(consume=AsyncMock())
    async def run(query):
        if failure and "elementId" in query:
            raise RuntimeError(failure)
        return result
    session = MagicMock(run=AsyncMock(side_effect=run), close=AsyncMock())
    driver = MagicMock(verify_connectivity=AsyncMock(), close=AsyncMock(), session=MagicMock(return_value=session))
    with patch("cortex.graph.adapters.cypher.AsyncGraphDatabase.driver", return_value=driver):
        adapter = CypherGraphAdapter()
        if failure and not failure.startswith("Unknown function"):
            with pytest.raises(GraphConnectionError) as error:
                await adapter.connect(CONFIG)
            assert "private-password" not in str(error.value) and error.value.cause is None
            driver.close.assert_awaited_once()
            assert not await adapter.is_connected()
        else:
            await adapter.connect(CONFIG)
            await adapter.disconnect()
        queries = [call.args[0] for call in session.run.await_args_list]
        expected = ["RETURN 1 as test", "RETURN elementId(null) AS id"]
        if failure and failure.startswith("Unknown function"):
            expected.append("RETURN id(null) AS id")
        assert queries == expected
        assert session.close.await_count == 2
        driver.close.assert_awaited_once()

@pytest.mark.asyncio
async def test_failed_reachability_driver_cleanup():
    driver = MagicMock(verify_connectivity=AsyncMock(side_effect=RuntimeError("private-password refused")), close=AsyncMock())
    with patch("cortex.graph.adapters.cypher.AsyncGraphDatabase.driver", return_value=driver):
        adapter = CypherGraphAdapter()
        with pytest.raises(GraphConnectionError, match="connection failed"):
            await adapter.connect(CONFIG)
        driver.session.assert_not_called()
        driver.close.assert_awaited_once()
