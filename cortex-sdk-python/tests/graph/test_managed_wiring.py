"""Primary one-send policy, exact receipts, owned worker and two-pass rebuild."""

import asyncio
import copy
import hashlib
import json
from dataclasses import replace
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from convex import ConvexError
from convex.values import json_to_convex

from cortex.artifacts import ArtifactsAPI
from cortex.contexts import ContextsAPI
from cortex.conversations import ConversationsAPI
from cortex.facts import FactsAPI
from cortex.graph import erasure
from cortex.graph.batch_sync import (
    GraphRebuildPartialError,
    graph_rebuild_pages,
    initial_graph_sync,
)
from cortex.graph.errors import (
    GraphCommittedPartial,
    GraphDatabaseError,
    GraphPrimaryOutcomeUnknown,
)
from cortex.graph.identity import graph_job_from_wire, graph_wire
from cortex.graph.worker.sync_worker import GraphSyncWorker
from cortex.immutable import ImmutableAPI
from cortex.memory_spaces import MemorySpacesAPI
from cortex.mutable import MutableAPI
from cortex.types import (
    BatchSyncOptions,
    GraphJobReceipt,
    GraphScope,
    GraphSyncPolicy,
    GraphSyncWorkerOptions,
)
from cortex.vector import VectorAPI


@pytest.fixture
def job():
    return graph_job_from_wire(json_to_convex(json.loads((Path(__file__).parent / 'managed_job_vectors.json').read_text(), parse_int=float))[0])


@pytest.fixture
def compatible(monkeypatch):
    check = AsyncMock()
    monkeypatch.setattr(erasure, 'assert_managed_graph_compatibility', check)
    return check


def receipt(job):
    return GraphJobReceipt(job.id, job.generation, job.identity, job.source_revision)


@pytest.mark.asyncio
@pytest.mark.parametrize('api_type,name', [(VectorAPI,'memories:store'),(FactsAPI,'facts:store'),(ConversationsAPI,'conversations:create'),(ContextsAPI,'contexts:create'),(MemorySpacesAPI,'memorySpaces:register'),(ImmutableAPI,'immutable:store'),(MutableAPI,'mutable:set'),(ArtifactsAPI,'artifacts:create')])
async def test_api_named_writer_preserves_primary_and_original_jobs(api_type, name, compatible, job):
    client = type('Client', (), {})()
    client.mutation = AsyncMock(return_value={'graphVersion':2, 'primaryResult':{'physical':'original'},'graphJobs':[graph_wire(receipt(job))]})
    resilience = type('Resilience', (), {'execute':AsyncMock(side_effect=AssertionError('must not retry primary'))})()
    api = api_type(client, graph_adapter=object(), resilience=resilience, graph_sync_policy=GraphSyncPolicy('background'))
    result = await api._execute_with_resilience(lambda:api._mutate_graph(name, {'tenantId':'tenant','memorySpaceId':'space'}), name, graph_write=None)
    assert result['physical'] == 'original' and result['graphJobs'] == [receipt(job)] and result['graphDisposition'] == 'queued'
    client.mutation.assert_awaited_once()
    sent = client.mutation.await_args.args[1]
    assert isinstance(sent['queueGraph']['graphInvocationId'], str)
    assert sent['tenantId'] == 'tenant'
    resilience.execute.assert_not_awaited()
    compatible.assert_awaited_once()


@pytest.mark.asyncio
async def test_off_explicit_false_and_missing_adapter(compatible):
    client = type('Client', (), {'mutation':AsyncMock(return_value={'original':True})})()
    result = await erasure.write_graph_mutation(client, object(), None, 'mutable:set', {'key':'x'}, False)
    assert result == {'original':True} and client.mutation.await_args.args[1] == {'key':'x'}
    compatible.assert_not_awaited()
    with pytest.raises(GraphDatabaseError, match='GRAPH_ADAPTER_REQUIRED'):
        await erasure.write_graph_mutation(client, None, None, 'mutable:set', {}, True)
    assert client.mutation.await_count == 1


@pytest.mark.asyncio
async def test_primary_lost_no_resend_and_known_server_refusal(compatible):
    client = type('Client', (), {'mutation':AsyncMock(side_effect=OSError('lost'))})()
    with pytest.raises(GraphPrimaryOutcomeUnknown) as failure:
        await erasure.write_graph_mutation(client, object(), None, 'mutable:set', {'key':'x'})
    assert failure.value.intent == {'key':'x'}
    client.mutation.assert_awaited_once()
    client.mutation = AsyncMock(side_effect=ConvexError('refusal', 'REFUSED'))
    with pytest.raises(ConvexError):
        await erasure.write_graph_mutation(client, object(), None, 'mutable:set', {'key':'x'})
    client.mutation.assert_awaited_once()


@pytest.mark.asyncio
async def test_delivery_partial_retains_committed_result_and_jobs(compatible, monkeypatch, job):
    client = type('Client', (), {'mutation':AsyncMock(return_value={'graphVersion':2,'primaryResult':{'deleted':True},'graphJobs':[graph_wire(receipt(job))]})})()
    deliver = AsyncMock(side_effect=GraphDatabaseError('lost','GRAPH_TRANSACTION_OUTCOME_UNKNOWN'))
    monkeypatch.setattr(erasure,'deliver_graph_job',deliver)
    with pytest.raises(GraphCommittedPartial) as failure:
        await erasure.write_graph_mutation(client, object(), None, 'mutable:deleteKey', {'key':'x'})
    assert failure.value.primary_result == {'deleted':True} and failure.value.jobs == [receipt(job)] and failure.value.graph_outcome == 'unknown'
    client.mutation.assert_awaited_once()
    deliver.assert_awaited_once()


@pytest.mark.asyncio
async def test_selected_committed_partial_and_cancel_before_send(monkeypatch, job):
    send = AsyncMock(side_effect=GraphCommittedPartial({'deleted':True},[receipt(job)],'failed','GRAPH_ACK_UNKNOWN'))
    monkeypatch.setattr(erasure,'write_graph_mutation',send)
    rows = [{'physicalId':'first','fingerprint':'fp'}, {'physicalId':'second','fingerprint':'fp2'}]
    from cortex._domain_paging import DomainOperationPartialError
    with pytest.raises(DomainOperationPartialError) as failure:
        await erasure.mutate_graph_selected(object(),'memories',rows,{},None,object())
    assert failure.value.partial['confirmedPhysicalIds'] == ['first']
    assert failure.value.partial['unstartedPhysicalIds'] == ['second']
    assert failure.value.partial['outcomes'][0]['graphJobs'] == [receipt(job)]
    cancelled = asyncio.Event();cancelled.set()
    opts = type('Opts',(),{'cancel_event':cancelled})()
    with pytest.raises(DomainOperationPartialError) as failure:
        await erasure.mutate_graph_selected(object(),'memories',rows,{},opts,object())
    assert failure.value.partial['outcomes'][0]['disposition'] == 'unstarted'
    assert send.await_count == 1


@pytest.mark.parametrize('explicit',[0,1,'true',[],{}])
def test_invalid_graph_option_refused(explicit):
    with pytest.raises(GraphDatabaseError, match='GRAPH_POLICY_INVALID'):
        erasure.requested_graph(object(), explicit)


@pytest.mark.asyncio
async def test_worker_exact_tenant_stop_joins_active_delivery(monkeypatch, job):
    from cortex.graph.worker import sync_worker
    monkeypatch.setattr(sync_worker,'assert_managed_graph_compatibility',AsyncMock())
    started = asyncio.Event();release = asyncio.Event()
    async def deliver(*args):
        started.set();await release.wait()
    monkeypatch.setattr(sync_worker,'deliver_graph_job',deliver)
    client = type('Client',(),{'query':AsyncMock(return_value=[graph_wire(job)]),'mutation':AsyncMock()})()
    worker = GraphSyncWorker(client,object(),tenant_id=job.identity.tenant_id)
    await worker.start();await asyncio.wait_for(started.wait(),1)
    stopping = asyncio.create_task(worker.stop());await asyncio.sleep(0)
    assert not stopping.done()
    release.set();await asyncio.wait_for(stopping,1)
    metrics = worker.get_metrics()
    assert metrics.success_count == 1 and metrics.total_processed == 1 and not metrics.is_running and metrics.queue_size == 0
    assert client.query.await_args.args[1]['tenantId'] == job.identity.tenant_id
    client.mutation.assert_not_awaited()


@pytest.mark.asyncio
async def test_worker_scope_transport_and_failed_ack_are_not_success(monkeypatch, job):
    from cortex.graph.worker import sync_worker
    client = type('Client',(),{'query':AsyncMock(return_value=[graph_wire(job)]),'mutation':AsyncMock(side_effect=OSError('lost ack'))})()
    worker = GraphSyncWorker(client,object(),tenant_id='foreign')
    worker._running = True
    await worker.process_once()
    assert worker.get_metrics().last_error_code == 'GRAPH_SCOPE_MISMATCH' and worker.get_metrics().total_processed == 0
    worker.tenant_id = job.identity.tenant_id
    monkeypatch.setattr(sync_worker,'deliver_graph_job',AsyncMock(side_effect=GraphDatabaseError('refused','GRAPH_REFERENCE_CHANGED')))
    await worker.process_once()
    metrics = worker.get_metrics()
    assert metrics.success_count == 0 and metrics.failure_count == 1 and metrics.last_error_code == 'GRAPH_FAILURE_ACK_UNRESOLVED'
    args = client.mutation.await_args.args[1]
    assert args['generation'] == job.generation and args['attemptToken'] == job.attempt_token and args['errorCode'] == 'GRAPH_REFERENCE_CHANGED'
    client.query.side_effect = OSError('lost')
    await worker.process_once()
    assert worker.get_metrics().last_error_code == 'GRAPH_QUEUE_TRANSPORT_FAILED'


@pytest.mark.parametrize('options',[GraphSyncWorkerOptions(batch_size=129),GraphSyncWorkerOptions(retry_attempts=True),GraphSyncWorkerOptions(verbose=1)])
def test_invalid_worker_bounds(options):
    with pytest.raises(GraphDatabaseError, match='GRAPH_WORKER_OPTIONS_INVALID'):
        GraphSyncWorker(object(),object(),options)


@pytest.mark.asyncio
async def test_split_required_discards_provisional_rows_and_ends_subrange():
    calls=[]
    responses=[{'page':['discard'],'isDone':False,'continueCursor':'ignored','pageStatus':'SplitRequired','splitCursor':'s','schemaVersion':2},
               {'page':['left'],'isDone':False,'continueCursor':'s','schemaVersion':2},
               {'page':['right'],'isDone':True,'continueCursor':'end','schemaVersion':2}]
    async def load(range_):calls.append(range_);return responses.pop(0)
    pages=[page async for page in graph_rebuild_pages(load)]
    assert [p['page'] for p in pages] == [['left'],['right']]
    assert calls[1]['endCursor'] == 's' and calls[2]['cursor'] == 's'


@pytest.mark.asyncio
async def test_nonadvancing_rebuild_refused():
    async def load(range_):return {'page':[],'isDone':False,'continueCursor':'','schemaVersion':2}
    with pytest.raises(GraphDatabaseError, match='GRAPH_REBUILD_NONADVANCING_CURSOR'):
        [p async for p in graph_rebuild_pages(load)]


class Transport:
    def __init__(self, job):self.job=job;self.calls=[];self.closed=False
    async def source_page(self,args,**options):
        self.calls.append(('nodes',args))
        return {'schemaVersion':2,'page':[graph_wire(self.job)] if args['kind'] == self.job.identity.kind else [],'isDone':True,'continueCursor':'end'}
    async def edge_page(self,args,**options):
        self.calls.append(('edges',args))
        return {'schemaVersion':2,'page':[],'snapshot':graph_wire(self.job),'isDone':True,'continueCursor':'end'}
    def close(self):self.closed=True


@pytest.mark.asyncio
async def test_two_pass_rebuild_exact_scope_unlimited_and_transport_closed(monkeypatch, job):
    from cortex.graph import batch_sync
    from cortex.types import GraphApplyResult
    transport=Transport(job);apply=AsyncMock(return_value=GraphApplyResult(nodes_created=1))
    monkeypatch.setattr(batch_sync,'assert_managed_graph_compatibility',AsyncMock())
    monkeypatch.setattr(batch_sync,'apply_graph_rebuild_snapshot',apply)
    result=await initial_graph_sync(object(),object(),BatchSyncOptions(transport=transport,tenant_id=job.identity.tenant_id,memory_space_id=job.identity.memory_space_id))
    assert result.complete and not result.limited and result.confirmed_physical_ids[job.table] == [job.identity.physical_source_id]
    phases=[call.args[2] for call in apply.await_args_list]
    assert phases == ['nodes','edges'] and transport.closed
    assert all(call[0]=='nodes' for call in transport.calls[:-1]) and transport.calls[-1][0]=='edges'
    assert result.excluded_kinds == ['immutable','mutable']


@pytest.mark.asyncio
async def test_rebuild_partial_preserves_confirmed_nodes_and_no_false_completion(monkeypatch, job):
    from cortex.graph import batch_sync
    from cortex.types import GraphApplyResult
    transport=Transport(job)
    monkeypatch.setattr(batch_sync,'assert_managed_graph_compatibility',AsyncMock())
    apply=AsyncMock(side_effect=[GraphApplyResult(nodes_created=1),GraphDatabaseError('changed','GRAPH_REFERENCE_CHANGED')])
    monkeypatch.setattr(batch_sync,'apply_graph_rebuild_snapshot',apply)
    with pytest.raises(GraphRebuildPartialError) as failure:
        await initial_graph_sync(object(),object(),BatchSyncOptions(transport=transport,tenant_id=job.identity.tenant_id,memory_space_id=job.identity.memory_space_id))
    result=failure.value.result
    assert getattr(result,job.table).synced == 1 and getattr(result,job.table).failed == 1 and not result.complete
    assert result.confirmed_physical_ids[job.table] == [job.identity.physical_source_id]
    assert failure.value.original_error.code == 'GRAPH_REFERENCE_CHANGED' and transport.closed


def canonical_fact_receipt(args, job):
    # Exact official-JS numeric spelling is an explicit controlled reference,
    # not a Python float serializer or a claim of actual native authority.
    request_json='{"historyIntent":{"operationId":"fixed","phase":"update"},"memorySpaceId":"space","metadata":{"fraction":0.001,"large":1e+30},"tenantId":"tenant"}'
    assert args == json.loads(request_json)
    payload={'operationId':'fixed','phase':'update','eventId':'event','requestDigest':hashlib.sha256(request_json.encode()).hexdigest()}
    pending={'version':1,'payload':payload,'absentFields':['userId'],'payloadDigest':'retained-old-payload-digest'}
    return {'committed':True,'events':[{'eventId':'event','_id':'anchor','pending':pending,'requestJson':request_json}],
            'affectedFactIds':['original-physical'],'resultFactId':'original-physical','graphJobs':[graph_wire(receipt(job))]}


@pytest.mark.asyncio
async def test_fact_lost_response_original_numeric_request_receipt_no_primary_replay(compatible,monkeypatch,job):
    from cortex.facts.history import FactCommittedResultUnavailableError
    args={'tenantId':'tenant','memorySpaceId':'space','historyIntent':{'operationId':'fixed','phase':'update'},'metadata':{'fraction':0.001,'large':1e30}}
    original=canonical_fact_receipt(args,job);before=copy.deepcopy(original)
    client=type('Client',(),{'mutation':AsyncMock(side_effect=OSError('lost response')),'query':AsyncMock(return_value=original)})()
    deliver=AsyncMock();monkeypatch.setattr(erasure,'deliver_graph_job',deliver)
    with pytest.raises(FactCommittedResultUnavailableError) as failure:
        await erasure.write_graph_mutation(client,object(),None,'facts:update',args)
    client.mutation.assert_awaited_once();deliver.assert_awaited_once()
    assert failure.value.receipt.result_fact_id=='original-physical'
    assert failure.value.receipt.events[0].request_json==original['events'][0]['requestJson']
    assert failure.value.receipt.events[0].pending.to_wire()==original['events'][0]['pending']
    assert original==before and args['metadata']=={'fraction':0.001,'large':1e30}
    assert client.query.await_args.args==('factHistory:getOperationReceipt',{'memorySpaceId':'space','tenantId':'tenant','operationId':'fixed','phase':'update'})


@pytest.mark.asyncio
@pytest.mark.parametrize('contradiction',['missing','semantic','digest'])
async def test_fact_missing_or_contradictory_canonical_receipt_never_delivers_or_resends(contradiction,compatible,monkeypatch,job):
    from cortex.facts.history import FactCommittedReceiptUnresolvedError
    args={'tenantId':'tenant','memorySpaceId':'space','historyIntent':{'operationId':'fixed','phase':'update'},'metadata':{'fraction':0.001,'large':1e30}}
    original=canonical_fact_receipt(args,job)
    event=original['events'][0]
    if contradiction=='missing':
        event.pop('requestJson')
    elif contradiction=='semantic':
        event['requestJson']=event['requestJson'].replace('"fraction":0.001','"fraction":0.002')
    else:
        event['pending']['payload']['requestDigest']='0'*64
    client=type('Client',(),{'mutation':AsyncMock(side_effect=OSError('lost response')),'query':AsyncMock(return_value=original)})()
    deliver=AsyncMock();monkeypatch.setattr(erasure,'deliver_graph_job',deliver)
    with pytest.raises(FactCommittedReceiptUnresolvedError):
        await erasure.write_graph_mutation(client,object(),None,'facts:update',args)
    deliver.assert_not_awaited();client.mutation.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize('matching',[True,False])
async def test_selected_fact_lost_reply_reads_original_digest_receipt_without_resend(monkeypatch,matching):
    from cortex._domain_paging import DomainOperationPartialError
    original={'physicalId':'original-physical','operationId':'original-operation','requestDigest':'native-digest',
        'request':{'memorySpaceId':'space','selectedPhysicalId':'original-physical','operationId':'original-operation','expectedFingerprint':'fp'}}
    retained={'committed':True,'affectedFactIds':['original-physical'],'events':[{'pending':{'payload':{'requestDigest':'native-digest' if matching else 'foreign-digest'}}}]}
    client=type('Client',(),{'query':AsyncMock(return_value=retained)})()
    send=AsyncMock(side_effect=OSError('original response lost'));monkeypatch.setattr(erasure,'write_graph_mutation',send)
    with pytest.raises(DomainOperationPartialError) as failure:
        await erasure.mutate_graph_selected(client,'facts',[{'physicalId':'original-physical','deleteIntent':original}],{'memorySpaceId':'space'},None,object())
    assert failure.value.partial['confirmedPhysicalIds']==(['original-physical'] if matching else [])
    assert failure.value.partial['unknownPhysicalIds']==([] if matching else ['original-physical'])
    assert failure.value.partial['originalIntents']==[original]
    send.assert_awaited_once();client.query.assert_awaited_once_with('factHistory:getOperationReceipt',{'memorySpaceId':'space','operationId':'original-operation','phase':'physical_delete'})


@pytest.mark.asyncio
async def test_archive_graph_partial_preserves_confirmed_primary_and_original_jobs(monkeypatch,job):
    import cortex.vector as vector
    from cortex._domain_paging import DomainOperationPartialError
    monkeypatch.setattr(vector,'select',AsyncMock(return_value=[{'physicalId':'original-physical','fingerprint':'fp','document':{'memoryId':'memory-original'}}]))
    api=VectorAPI(object(),graph_adapter=object())
    send=AsyncMock(side_effect=GraphCommittedPartial({'archived':True},[receipt(job)],'unknown','GRAPH_ACK_UNKNOWN'))
    monkeypatch.setattr(api,'_mutate_graph',send)
    with pytest.raises(DomainOperationPartialError) as failure:
        await api.archive('space','memory-original')
    assert failure.value.partial['confirmedPhysicalIds']==['original-physical']
    assert failure.value.partial['unknownPhysicalIds']==[]
    assert failure.value.partial['outcomes'][0]['graphJobs']==[receipt(job)]
    send.assert_awaited_once()


@pytest.mark.asyncio
async def test_stop_waits_inflight_start_and_prevents_late_worker_activation(monkeypatch):
    from cortex.graph.worker import sync_worker
    entered=asyncio.Event();release=asyncio.Event()
    async def compatibility(adapter):
        entered.set();await release.wait()
    monkeypatch.setattr(sync_worker,'assert_managed_graph_compatibility',compatibility)
    client=type('Client',(),{'query':AsyncMock(),'mutation':AsyncMock()})()
    worker=GraphSyncWorker(client,object())
    starting=asyncio.create_task(worker.start());await asyncio.wait_for(entered.wait(),1)
    stopping=asyncio.create_task(worker.stop());await asyncio.sleep(0)
    assert not stopping.done()
    release.set();await asyncio.wait_for(asyncio.gather(starting,stopping),1)
    assert not worker.is_running and not worker.get_metrics().is_running
    assert worker._startup_task is None and worker._task is None
    client.query.assert_not_awaited();client.mutation.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("configured,explicit,expected", [("tenant",None,"tenant"),("tenant","tenant","tenant"),(None,"explicit","explicit"),(None,None,None)])
async def test_store_resolves_constructor_scope_before_one_send(configured, explicit, expected, monkeypatch):
    from cortex.types import AuthContext, MemoryMetadata, MemorySource, StoreMemoryInput

    client = type("Client", (), {"mutation": AsyncMock()})()
    api = VectorAPI(client, auth_context=AuthContext(user_id="fixture", tenant_id=configured) if configured else None)
    send = AsyncMock(return_value={"_id":"actual-source", "sourceTimestamp":1, "accessCount":0, "memoryId":"logical", "memorySpaceId":"space", "content":"selected", "contentType":"raw", "sourceType":"system", "importance":50, "tags":[], "createdAt":1, "updatedAt":1, "version":1, "previousVersions":[]})
    monkeypatch.setattr(api, "_mutate_graph", send)
    await api.store("space", StoreMemoryInput("selected", "raw", MemorySource("system", 1), MemoryMetadata(50), tenant_id=explicit))
    send.assert_awaited_once()
    assert send.await_args.args[1].get("tenantId") == expected
    assert send.await_args.args[1]["content"] == "selected"


@pytest.mark.asyncio
async def test_store_conflicting_scope_refuses_before_any_effect():
    from cortex.types import AuthContext, MemoryMetadata, MemorySource, StoreMemoryInput

    client = type("Client", (), {"mutation": AsyncMock()})()
    api = VectorAPI(client, auth_context=AuthContext(user_id="fixture", tenant_id="tenant"))
    with pytest.raises(Exception, match="TENANT"):
        await api.store("space", StoreMemoryInput("selected", "raw", MemorySource("system", 1), MemoryMetadata(50), tenant_id="foreign"))
    client.mutation.assert_not_awaited()
