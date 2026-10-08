"""Captured partial identity, one-send uncertainty and stream wiring controls."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from convex import ConvexError

from cortex.graph import erasure
from cortex.graph.errors import (
    GraphCommittedPartial,
    GraphDatabaseError,
    GraphPrimaryOutcomeUnknown,
)
from cortex.graph.identity import graph_wire, primary_graph_identity
from cortex.memory import MemoryAPI
from cortex.memory.streaming.error_recovery import StreamErrorRecovery
from cortex.memory.streaming.progressive_graph_sync import ProgressiveGraphSync
from cortex.memory.streaming.progressive_storage_handler import (
    ProgressiveStorageHandler,
)
from cortex.memory.streaming_types import (
    FailureStrategy,
    RecoveryOptions,
    StreamContext,
    StreamingOptions,
)
from cortex.types import (
    AuthContext,
    GraphJobReceipt,
    GraphScope,
    GraphSyncPolicy,
    RememberResult,
    RememberStreamParams,
)


def source(revision=1, **updates):
    return {'_id': 'actual-partial', 'memoryId': 'logical-partial', 'sourceRevision': revision,
            'referenceGeneration': 'captured-generation', 'ownershipRevision': 1, **updates}


def receipt(revision=1, **scope):
    identity = primary_graph_identity('Memory', scope.get('physical', 'actual-partial'),
                                      GraphScope(True, scope.get('tenant', 'tenant'), scope.get('space', 'space')))
    return GraphJobReceipt(f'original-job-{revision}', f'job-gen-{revision}', identity, revision)


def envelope(revision=1, **updates):
    return {'graphVersion': 2, 'primaryResult': source(revision, **updates), 'graphJobs': [graph_wire(receipt(revision))]}


@pytest.fixture
def compatible(monkeypatch):
    check = AsyncMock()
    monkeypatch.setattr(erasure, 'assert_managed_graph_compatibility', check)
    return check


def handler(client, graph=True):
    return ProgressiveStorageHandler(client, 'space', 'conversation', 'user', 0,
        tenant_id='tenant', graph_adapter=object() if graph else None,
        graph_sync_policy=GraphSyncPolicy('background'), sync_to_graph=graph)


@pytest.mark.asyncio
async def test_scoped_guarded_partial_finalized_distinct_and_no_raw_graph(compatible):
    client = MagicMock(mutation=AsyncMock(side_effect=[envelope(1), envelope(2), envelope(3)]))
    storage = handler(client)
    adapter = MagicMock()
    sync = ProgressiveGraphSync(adapter, 0, storage)
    await storage.initialize_partial_memory()
    await sync.initialize_partial_node({'memoryId': 'logical-partial'})
    await storage.update_partial_content('one', 1, True)
    await sync.update_partial_node('one', StreamContext('space', 'conversation', 'user', 'User'))
    await storage.finalize_memory('complete')
    sync.record_finalized_partial()
    with pytest.raises(GraphDatabaseError, match='GRAPH_PARTIAL_SELECTION_CHANGED'):
        await sync.finalize_node({'_id': 'separate-final-memory'})
    await storage.rollback()
    await sync.rollback()
    assert client.mutation.await_count == 3
    for call, rev in zip(client.mutation.await_args_list[1:], [1, 2]):
        args = call.args[1]
        assert args['expectedPhysicalId'] == 'actual-partial' and args['expectedSourceRevision'] == rev
        assert args['expectedReferenceGeneration'] == 'captured-generation'
        assert args['tenantId'] == 'tenant' and args['memorySpaceId'] == 'space'
    evidence = storage.get_partial_source_evidence()
    assert evidence.source_revision == 3 and evidence.graph_jobs == [receipt(1), receipt(2), receipt(3)]
    assert evidence.physical_source_id == 'actual-partial' and storage.is_complete()
    assert len(sync.get_sync_events()) == 3 and all(event.event_type == 'queued' for event in sync.get_sync_events())
    adapter.create_node.assert_not_called()
    adapter.update_node.assert_not_called()
    adapter.delete_node.assert_not_called()


@pytest.mark.asyncio
async def test_lost_primary_no_resend_no_rollback(compatible):
    client = MagicMock(mutation=AsyncMock(side_effect=[envelope(), OSError('lost response')]))
    storage = handler(client)
    await storage.initialize_partial_memory()
    with pytest.raises(GraphPrimaryOutcomeUnknown):
        await storage.update_partial_content('one', 1, True)
    assert storage.is_outcome_unknown() and not storage.is_ready()
    await storage.rollback()
    with pytest.raises(GraphDatabaseError, match='GRAPH_PARTIAL_OUTCOME_UNKNOWN'):
        await storage.update_partial_content('two', 2, True)
    assert client.mutation.await_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize('finalizing', [False, True])
async def test_known_committed_graph_failure_retains_original_handle_and_jobs(monkeypatch, finalizing):
    storage = handler(MagicMock())
    write = AsyncMock(side_effect=[{**source(), 'graphJobs': [receipt()]}, GraphCommittedPartial(source(2), [receipt(2)], 'unknown', 'GRAPH_ACK_UNKNOWN')])
    monkeypatch.setattr(storage, '_write', write)
    await storage.initialize_partial_memory()
    with pytest.raises(GraphCommittedPartial):
        if finalizing:
            await storage.finalize_memory('done')
        else:
            await storage.update_partial_content('one', 1, True)
    assert storage.is_complete() == finalizing
    assert storage.is_outcome_unknown() and storage.get_partial_source_evidence().graph_jobs == [receipt(), receipt(2)]
    await storage.rollback()
    assert write.await_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize('change', [{'_id': 'replacement'}, {'memoryId': 'replacement'}, {'referenceGeneration': 'replacement'}])
async def test_physical_selection_cannot_change(compatible, change):
    client = MagicMock(mutation=AsyncMock(side_effect=[envelope(), envelope(2, **change)]))
    storage = handler(client)
    await storage.initialize_partial_memory()
    with pytest.raises(GraphDatabaseError, match='GRAPH_PARTIAL_SELECTION_CHANGED'):
        await storage.update_partial_content('one', 1, True)
    assert storage.get_partial_source_evidence().physical_source_id == 'actual-partial'


@pytest.mark.parametrize('scope', [{'tenant': 'foreign'}, {'space': 'foreign'}, {'physical': 'foreign'}])
def test_foreign_partial_receipt_refused_before_adoption(scope):
    storage = handler(MagicMock())
    with pytest.raises(GraphDatabaseError, match='GRAPH_SCOPE_MISMATCH'):
        storage._adopt(source(), [receipt(**scope)])
    assert storage.get_partial_source_evidence() is None


@pytest.mark.asyncio
async def test_off_delete_requires_physical_guard_and_preserves_history():
    client = MagicMock(mutation=AsyncMock(side_effect=[source(), source(2), None]))
    storage = handler(client, False)
    await storage.initialize_partial_memory()
    await storage.update_partial_content('one', 1, True)
    await storage.rollback()
    sent = client.mutation.await_args.args[1]
    assert sent['expectedPhysicalId'] == 'actual-partial' and sent['expectedSourceRevision'] == 2 and sent['expectedPartial'] is True
    assert storage.was_deleted() and not storage.is_ready() and storage.get_partial_memory_id() is None
    assert len(storage.get_update_history()) == 1
    await storage.rollback()
    assert client.mutation.await_count == 3


@pytest.mark.asyncio
async def test_server_refusal_stays_known_no_hidden_retry(compatible):
    client = MagicMock(mutation=AsyncMock(side_effect=[envelope(), ConvexError('refused', {'code': 'REFERENCE_CHANGED'})]))
    storage = handler(client)
    await storage.initialize_partial_memory()
    with pytest.raises(GraphDatabaseError, match='REFERENCE_CHANGED'):
        await storage.update_partial_content('one', 1, True)
    assert not storage.is_outcome_unknown() and client.mutation.await_count == 2


@pytest.mark.asyncio
@pytest.mark.parametrize('unknown,finalized', [(True, False), (False, True)])
async def test_recovery_cannot_delete_unknown_or_finalized(unknown, finalized):
    client = MagicMock(mutation=AsyncMock())
    storage = handler(client, False)
    storage._adopt(source())
    storage._unknown = unknown
    storage.is_finalized = finalized
    context = StreamContext('space', 'conversation', 'user', 'User', partial_memory_id='logical-partial', partial_outcome_unknown=unknown)
    result = await StreamErrorRecovery(client, partial_storage=storage).handle_stream_error(RuntimeError('original'), context, RecoveryOptions(FailureStrategy.ROLLBACK))
    assert not result.success and isinstance(result.error, GraphDatabaseError)
    client.mutation.assert_not_awaited()


async def chunks():
    yield 'one '
    yield 'two'


def memory_api(client):
    return MemoryAPI(client, graph_adapter=object(), auth_context=AuthContext(user_id='user', tenant_id='tenant'), graph_sync_policy=GraphSyncPolicy('background'))


@pytest.mark.asyncio
async def test_stream_guard_required_before_any_primary(compatible):
    client = MagicMock(mutation=AsyncMock())
    api = memory_api(client)
    with pytest.raises(GraphDatabaseError, match='GRAPH_PARTIAL_STORAGE_REQUIRED'):
        await api.remember_stream(RememberStreamParams('space', 'conversation', 'ask', chunks(), agent_id='agent'), StreamingOptions(progressive_graph_sync=True))
    client.mutation.assert_not_awaited()


@pytest.mark.asyncio
async def test_stream_persistence_error_escapes_warning_hooks_no_final_write(compatible):
    client = MagicMock(mutation=AsyncMock(side_effect=[envelope(), OSError('lost original')]))
    api = memory_api(client)
    api.remember = AsyncMock()
    with pytest.raises(GraphPrimaryOutcomeUnknown):
        await api.remember_stream(RememberStreamParams('space', 'conversation', 'ask', chunks(), agent_id='agent', skip_layers=['conversations']),
            StreamingOptions(store_partial_response=True, progressive_graph_sync=True, partial_response_interval=-1))
    api.remember.assert_not_awaited()
    assert client.mutation.await_count == 2


@pytest.mark.asyncio
async def test_stream_final_partial_distinct_from_final_memory(compatible):
    client = MagicMock(mutation=AsyncMock(side_effect=[envelope(1), envelope(2), envelope(3), envelope(4)]))
    api = memory_api(client)
    api.remember = AsyncMock(return_value=RememberResult({'conversationId': 'conversation'}, [{'_id': 'final'}], []))
    result = await api.remember_stream(RememberStreamParams('space', 'conversation', 'ask', chunks(), agent_id='agent', skip_layers=['conversations']),
        StreamingOptions(store_partial_response=True, progressive_graph_sync=True, partial_response_interval=-1))
    assert result.full_response == 'one two' and result.memories == [{'_id': 'final'}]
    assert result.progressive_processing.partial_source.physical_source_id == 'actual-partial'
    assert result.progressive_processing.partial_source.source_revision == 4
    assert len(result.progressive_processing.graph_sync_events) == 4
    assert api.remember.await_args.args[1].sync_to_graph is True
    assert client.mutation.await_count == 4


def test_nested_policy_reaches_all_named_writers():
    api = memory_api(MagicMock())
    assert all(nested._graph_sync_policy.mode == 'background' for nested in [api.vector, api.facts, api.conversations, api.memory_spaces])


@pytest.mark.asyncio
async def test_ordinary_space_admission_uses_scoped_writer_and_propagates_unknown():
    api = memory_api(MagicMock())
    api.memory_spaces.get = AsyncMock(return_value=None)
    original = GraphPrimaryOutcomeUnknown("memorySpaces:register", GraphScope(True, "tenant", "space"), "original", {})
    api.memory_spaces.register = AsyncMock(side_effect=original)
    with pytest.raises(GraphPrimaryOutcomeUnknown) as caught:
        await api._ensure_memory_space_exists("space", True)
    assert caught.value is original
    api.memory_spaces.get.assert_awaited_once_with("space")
    assert api.memory_spaces.register.await_count == 1
    assert api.memory_spaces.register.await_args.kwargs == {"sync_to_graph": True}
