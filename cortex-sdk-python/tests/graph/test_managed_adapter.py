"""Explicit managed transaction/driver closure and finite refusal outcomes."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from cortex.graph.adapters.cypher import CypherGraphAdapter
from cortex.graph.erasure import apply_graph_job
from cortex.graph.errors import GraphDatabaseError
from cortex.graph.identity import graph_job_from_wire
from cortex.types import GraphApplyResult, GraphQueryResult
from tests.graph.test_managed_kernel import VECTORS


class Response:
    def __init__(self, rows):
        self.rows = rows
        self.consume = AsyncMock(return_value=MagicMock(counters=MagicMock(nodes_created=1, nodes_deleted=0, relationships_created=0, relationships_deleted=0)))

    def __aiter__(self):
        async def records():
            for row in self.rows:
                yield row
        return records()


def fixture_adapter():
    adapter = CypherGraphAdapter()
    response = Response([{'count': 1}])
    tx = MagicMock(run=AsyncMock(return_value=response), commit=AsyncMock(), rollback=AsyncMock())
    session = MagicMock(begin_transaction=AsyncMock(return_value=tx), run=AsyncMock(return_value=response), close=AsyncMock())
    adapter._get_session = MagicMock(return_value=session)
    return adapter, session, tx


@pytest.mark.asyncio
async def test_commit_stats_and_session_close():
    adapter, session, tx = fixture_adapter()
    async def operation(selected):
        return await selected.query('RETURN $n AS count', {'n': 1})
    result = await adapter.managed_transaction(operation)
    assert result.count == 1 and result.stats.nodes_created == 1
    tx.commit.assert_awaited_once(); tx.rollback.assert_not_awaited(); session.close.assert_awaited_once()
    session.begin_transaction.assert_awaited_once_with(timeout=10)


@pytest.mark.asyncio
@pytest.mark.parametrize('where', ['begin', 'query', 'commit'])
async def test_failures_close_and_commit_unknown(where):
    adapter, session, tx = fixture_adapter()
    error = RuntimeError('private-password must not escape'); error.code = 'Unclassified.Error'
    {'begin': session.begin_transaction, 'query': tx.run, 'commit': tx.commit}[where].side_effect = error
    async def operation(selected):
        return await selected.query('RETURN 1')
    with pytest.raises(GraphDatabaseError) as caught:
        await adapter.managed_transaction(operation)
    assert caught.value.code == ('GRAPH_TRANSACTION_OUTCOME_UNKNOWN' if where == 'commit' else 'GRAPH_TRANSACTION_FAILED')
    assert 'private-password' not in str(caught.value) and caught.value.cause is None
    assert caught.value.native_code == 'Unclassified.Error'
    session.close.assert_awaited_once()
    assert tx.rollback.await_count == (0 if where == 'begin' else 1)


@pytest.mark.asyncio
async def test_request_cap_rolls_back_without_257th_send():
    adapter, session, tx = fixture_adapter()
    async def operation(selected):
        for _ in range(257):
            await selected.query('RETURN 1')
    with pytest.raises(GraphDatabaseError) as caught:
        await adapter.managed_transaction(operation)
    assert caught.value.code == 'GRAPH_TRANSACTION_BUDGET' and tx.run.await_count == 256
    tx.rollback.assert_awaited_once(); tx.commit.assert_not_awaited(); session.close.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('rows', [[{'n': i} for i in range(258)], [{'n': 2**53}], [{'value': 'a' * (1024*1024)}]])
async def test_read_budget_refusal_closes(rows):
    adapter, session, tx = fixture_adapter(); session.run.return_value = Response(rows)
    with pytest.raises(GraphDatabaseError) as caught:
        await adapter.managed_read('RETURN 1')
    assert caught.value.code == 'GRAPH_RESULT_BUDGET'
    session.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_engine_identity_separate_from_element_id_capability():
    adapter = CypherGraphAdapter(); adapter._driver = MagicMock(); adapter._use_element_id = True
    adapter.managed_read = AsyncMock(return_value=GraphQueryResult([{'name':'Memgraph'}],1))
    assert await adapter.managed_dialect() == 'memgraph'
    assert await adapter.managed_dialect() == 'memgraph'
    adapter.managed_read.assert_awaited_once()
    driver = adapter._driver; driver.close = AsyncMock()
    await adapter.disconnect()
    assert adapter._managed_engine is None; driver.close.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('code, expected', [('GRAPH_TRANSACTION_CONFLICT',3), ('GRAPH_TRANSACTION_OUTCOME_UNKNOWN',1), ('GRAPH_TRANSACTION_FAILED',1)])
async def test_only_graph_conflicts_retry_bounded(code, expected):
    adapter = AsyncMock(); job = graph_job_from_wire(VECTORS[1])
    adapter.managed_transaction.side_effect = GraphDatabaseError('observed', code)
    with patch('cortex.graph.erasure.assert_managed_graph_compatibility', new=AsyncMock()):
        with pytest.raises(GraphDatabaseError) as caught:
            await apply_graph_job(adapter, job)
    assert caught.value.code == code and adapter.managed_transaction.await_count == expected
