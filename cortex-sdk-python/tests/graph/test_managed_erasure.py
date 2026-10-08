"""Read-only preparation, original delivery, minimal disposal resume and owned I/O."""

import asyncio
import json
import threading
from dataclasses import replace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from convex import ConvexError

from cortex.graph import erasure
from cortex.graph.erasure import (
    GraphErasureEvidence,
    GraphErasureItem,
    GraphErasureProgressError,
    PreparedGraphErasureItem,
    erase_graph_item,
    prepare_graph_erasure,
    verify_graph_erasure,
)
from cortex.graph.erasure_transport import create_graph_erasure_transport
from cortex.graph.errors import GraphDatabaseError, GraphJobUnresolved
from cortex.graph.identity import (
    decode_native_json,
    graph_job_from_wire,
    graph_wire,
    identity_properties,
)
from cortex.types import GraphApplyResult, GraphJobReceipt, GraphQueryResult


@pytest.fixture
def job():
    data=decode_native_json((Path(__file__).parent/'managed_job_vectors.json').read_text())
    return graph_job_from_wire(data[0])


@pytest.fixture
def item(job):
    return GraphErasureItem(job.identity,job.source_revision,job.ownership_revision,
        job.reference_generation,1,GraphErasureEvidence('fixed-target',job.reference_generation,
            job.identity.physical_source_id,True))


def receipt(item):
    return GraphJobReceipt('original-delete','original-generation',item.identity,item.source_revision+1)


def status(item, *, revision=0, count=0, complete=False):
    value=graph_wire(receipt(item))
    return {**value,'kind':'status','state':'synced','requestDigest':'1'*64,
        'projectionDigest':'2'*64,'disposalRevision':revision,'disposedJobCount':count,'complete':complete}


def absent(item):
    return {'absent':True,'tombstoned':True}


@pytest.mark.asyncio
async def test_prepare_reads_only_and_exact_source_legacy_preflight(monkeypatch,item):
    monkeypatch.setattr(erasure,'assert_managed_graph_compatibility',AsyncMock())
    adapter=type('Adapter',(),{'managed_read':AsyncMock(side_effect=[
        GraphQueryResult([{'node':identity_properties(item.identity)}],1),GraphQueryResult([],0),GraphQueryResult([],0)]),
        'managed_transaction':AsyncMock(side_effect=AssertionError('preparation must not write'))})()
    transport=type('Transport',(),{'preflight':AsyncMock(return_value={
        'kind':'preflight','checked':0,'isDone':True,'continueCursor':'end'})})()
    prepared=await prepare_graph_erasure([item],adapter=adapter,disposal_transport=transport)
    assert prepared[0].item is item and prepared[0].adapter is adapter
    assert [call.args[1] for call in transport.preflight.await_args_list]==['source','legacy']
    adapter.managed_transaction.assert_not_awaited()
    assert adapter.managed_read.await_count==3


@pytest.mark.asyncio
async def test_preparation_refuses_missing_transport_bad_evidence_and_manual_edge(monkeypatch,item):
    monkeypatch.setattr(erasure,'assert_managed_graph_compatibility',AsyncMock())
    adapter=type('Adapter',(),{'managed_read':AsyncMock()})()
    with pytest.raises(GraphDatabaseError,match='GRAPH_ERASURE_TRANSPORT_REQUIRED'):
        await prepare_graph_erasure([item],adapter=adapter,disposal_transport=None)
    transport=type('Transport',(),{'preflight':AsyncMock()})()
    with pytest.raises(GraphDatabaseError,match='GRAPH_IDENTITY_REQUIRED'):
        await prepare_graph_erasure([replace(item,evidence=replace(item.evidence,scope_known=False))],adapter=adapter,disposal_transport=transport)
    adapter.managed_read.assert_not_awaited()
    adapter.managed_read.side_effect=[GraphQueryResult([],0),GraphQueryResult([{'type':'MANUAL','edge':{},'endpoint':{},'labels':[]}],1)]
    with pytest.raises(GraphDatabaseError,match='GRAPH_ERASURE_BLOCKED'):
        await prepare_graph_erasure([item],adapter=adapter,disposal_transport=transport)
    transport.preflight.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize('owned',[
    GraphQueryResult([{'edge':{'schemaVersion':1,'ownerTuple':'untrusted'}}],1),
    GraphQueryResult([{'edge':{'schemaVersion':2,'ownerTuple':'untrusted'}}],1),
    GraphQueryResult([],65),
])
async def test_preparation_blocks_nonincident_owned_relations_before_primary_or_disposal(monkeypatch,item,owned):
    monkeypatch.setattr(erasure,'assert_managed_graph_compatibility',AsyncMock())
    adapter=type('Adapter',(),{'managed_read':AsyncMock(side_effect=[
        GraphQueryResult([{'node':identity_properties(item.identity)}],1),
        GraphQueryResult([],0),owned]),
        'managed_transaction':AsyncMock(side_effect=AssertionError('preflight must not write'))})()
    transport=type('Transport',(),{'preflight':AsyncMock()})()
    with pytest.raises(GraphDatabaseError,match='GRAPH_ERASURE_BLOCKED'):
        await prepare_graph_erasure([item],adapter=adapter,disposal_transport=transport)
    assert adapter.managed_read.await_args_list[-1].args==(
        'MATCH ()-[r]->() WHERE r.ownerKey=$key RETURN properties(r) AS edge LIMIT 65',
        {'key':item.identity.key})
    adapter.managed_transaction.assert_not_awaited()
    transport.preflight.assert_not_awaited()


@pytest.mark.asyncio
async def test_preflight_split_and_empty_ranges_advance(item):
    pages=[{'kind':'preflight','checked':4,'isDone':False,'continueCursor':'discard','pageStatus':'SplitRequired','splitCursor':'s'},
        {'kind':'preflight','checked':0,'isDone':False,'continueCursor':'s'},
        {'kind':'preflight','checked':1,'isDone':True,'continueCursor':'end'},
        {'kind':'preflight','checked':0,'isDone':True,'continueCursor':'end'}]
    transport=type('Transport',(),{'preflight':AsyncMock(side_effect=pages)})()
    await erasure._preflight_copies(item,transport)
    assert [call.args[2] for call in transport.preflight.await_args_list]==[
        {'cursor':None,'endCursor':None},{'cursor':None,'endCursor':'s'},
        {'cursor':'s','endCursor':None},{'cursor':None,'endCursor':None}]


@pytest.mark.asyncio
@pytest.mark.parametrize('page',[{'kind':'preflight','checked':False,'isDone':True,'continueCursor':'end'},
    {'kind':'preflight','checked':0,'isDone':False,'continueCursor':''},
    {'kind':'preflight','checked':0,'isDone':False,'continueCursor':'x','pageStatus':'SplitRequired','splitCursor':None}])
async def test_invalid_preflight_never_continues(item,page):
    transport=type('Transport',(),{'preflight':AsyncMock(return_value=page)})()
    with pytest.raises(GraphDatabaseError,match='GRAPH_ERASURE_INVALID_PAGE'):
        await erasure._preflight_copies(item,transport)
    transport.preflight.assert_awaited_once()


@pytest.mark.asyncio
async def test_minimal_disposed_status_resumes_without_full_payload_or_primary(monkeypatch,item):
    monkeypatch.setattr(erasure,'_graph_erasure_state',AsyncMock(return_value=absent(item)))
    delivery=AsyncMock();monkeypatch.setattr(erasure,'deliver_graph_job',delivery)
    client=type('Client',(),{'query':AsyncMock(side_effect=AssertionError('stripped job must not be loaded')),'mutation':AsyncMock()})()
    transport=type('Transport',(),{'status':AsyncMock(return_value=status(item,revision=3,count=12,complete=True)),'dispose':AsyncMock()})()
    result=await erase_graph_item(PreparedGraphErasureItem(item,object(),transport),client=client,jobs=[receipt(item)])
    assert result.disposal.complete and result.disposal.disposed_job_count==12
    delivery.assert_not_awaited();client.query.assert_not_awaited();client.mutation.assert_not_awaited();transport.dispose.assert_not_awaited()


@pytest.mark.asyncio
async def test_unacknowledged_delivers_only_original_delete_then_disposes(monkeypatch,item,job):
    delete=replace(job,id='original-delete',generation='original-generation',operation='delete',source_revision=item.source_revision+1)
    parser=AsyncMock()
    monkeypatch.setattr(erasure,'graph_job_from_wire',lambda value:delete)
    delivery=AsyncMock(return_value=GraphApplyResult(nodes_deleted=1));monkeypatch.setattr(erasure,'deliver_graph_job',delivery)
    monkeypatch.setattr(erasure,'_graph_erasure_state',AsyncMock(return_value=absent(item)))
    client=type('Client',(),{'query':AsyncMock(return_value={'captured':'original'}),'mutation':AsyncMock()})()
    transport=type('Transport',(),{'status':AsyncMock(side_effect=[ConvexError('not yet',{'code':'GRAPH_ERASURE_NOT_ACKNOWLEDGED'}),status(item)]),
        'dispose':AsyncMock(side_effect=[status(item,revision=1,count=8),status(item,revision=2,count=10,complete=True)])})()
    result=await erase_graph_item(PreparedGraphErasureItem(item,object(),transport),client=client,jobs=[receipt(item)])
    assert result.nodes_deleted==1 and result.disposal.disposed_job_count==10
    assert [call.args[2] for call in transport.dispose.await_args_list]==[0,1]
    delivery.assert_awaited_once();client.mutation.assert_not_awaited()
    assert client.query.await_args.args==('graphSync:getGraphJob',{'id':'original-delete','generation':'original-generation','tenantId':item.identity.tenant_id})


@pytest.mark.asyncio
async def test_unknown_disposal_preserves_status_and_resumes_current_revision(monkeypatch,item):
    monkeypatch.setattr(erasure,'_graph_erasure_state',AsyncMock(return_value=absent(item)))
    client=type('Client',(),{'query':AsyncMock(),'mutation':AsyncMock()})()
    transport=type('Transport',(),{'status':AsyncMock(side_effect=[status(item,revision=4,count=20),status(item,revision=5,count=28)]),
        'dispose':AsyncMock(side_effect=[GraphDatabaseError('response lost','GRAPH_ERASURE_RESPONSE_UNKNOWN'),status(item,revision=6,count=30,complete=True)])})()
    prepared=PreparedGraphErasureItem(item,object(),transport)
    with pytest.raises(GraphErasureProgressError) as failure:
        await erase_graph_item(prepared,client=client,jobs=[receipt(item)])
    assert failure.value.disposal_outcome=='unknown' and failure.value.disposal_status.disposal_revision==4
    result=await erase_graph_item(prepared,client=client,jobs=[receipt(item)])
    assert result.disposal.complete and [call.args[2] for call in transport.dispose.await_args_list]==[4,5]
    client.query.assert_not_awaited();client.mutation.assert_not_awaited()


@pytest.mark.asyncio
async def test_graph_not_absent_blocks_disposal_and_wrong_status_refused(monkeypatch,item):
    monkeypatch.setattr(erasure,'_graph_erasure_state',AsyncMock(return_value={'absent':False,'tombstoned':True}))
    transport=type('Transport',(),{'status':AsyncMock(return_value=status(item)),'dispose':AsyncMock()})()
    with pytest.raises(GraphErasureProgressError) as failure:
        await erase_graph_item(PreparedGraphErasureItem(item,object(),transport),client=object(),jobs=[receipt(item)])
    assert failure.value.reason=='GRAPH_ERASURE_NOT_VERIFIED' and failure.value.disposal_outcome=='failed'
    transport.dispose.assert_not_awaited()
    for changed in [{'sourceRevision':item.source_revision},{'generation':'foreign'},{'complete':1},{'disposedJobCount':-1}]:
        with pytest.raises(GraphJobUnresolved):
            erasure._disposal_status({**status(item),**changed},item,receipt(item))


@pytest.mark.asyncio
async def test_verify_uses_minimal_original_status_no_full_job(monkeypatch,item):
    monkeypatch.setattr(erasure,'assert_managed_graph_compatibility',AsyncMock())
    monkeypatch.setattr(erasure,'_graph_erasure_state',AsyncMock(return_value=absent(item)))
    transport=type('Transport',(),{'status':AsyncMock(return_value=status(item,count=11,complete=True))})()
    result=await verify_graph_erasure([item],adapter=object(),disposal_transport=transport,jobs=[receipt(item)])
    assert result=={'complete':True,'items':[{'key':item.identity.key,'absent':True,'tombstoned':True,'queueComplete':True,'disposedJobCount':11}]}
    with pytest.raises(GraphJobUnresolved):
        await verify_graph_erasure([item],adapter=object(),disposal_transport=transport,jobs=[])


@pytest.fixture
def native_server():
    records=[]
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_POST(self):
            body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            records.append((self.path,self.headers.get('Authorization')=='Convex controlled-key',body))
            data=json.dumps({'status':'success','value':{'safe':'controlled'}}).encode()
            self.send_response(200);self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever);thread.start()
    try:
        yield 'http://127.0.0.1:'+str(server.server_port),records
    finally:
        server.shutdown();server.server_close();thread.join(2);assert not thread.is_alive()


@pytest.mark.asyncio
async def test_real_fixed_disposal_modes_close_io_and_reject_extra_authority(native_server,item):
    url,records=native_server;transport=create_graph_erasure_transport(url=url,deployment_key='controlled-key')
    assert await transport.preflight(item,'source',{'cursor':None,'endCursor':None})=={'safe':'controlled'}
    await transport.status(item,receipt(item));await transport.dispose(item,receipt(item),2)
    assert transport._job is None and len(records)==3
    assert all(path=='/api/function' and authorized and body['path']=='graphSync:clearSyncedItems' for path,authorized,body in records)
    assert [body['args']['disposal']['kind'] for _,_,body in records]==['preflight','status','dispose']
    assert records[2][2]['args']['disposal']['referenceRevision']==item.reference_revision
    with pytest.raises(GraphDatabaseError,match='GRAPH_ERASURE_INVALID_PAGE'):
        await transport.preflight(item,'arbitrary',{'cursor':None,'endCursor':None})
    with pytest.raises(GraphDatabaseError,match='GRAPH_ERASURE_PROGRESS_CHANGED'):
        await transport.dispose(item,receipt(item),True)
    cancel=asyncio.Event();cancel.set()
    with pytest.raises(GraphDatabaseError,match='GRAPH_ERASURE_CANCELLED'):
        await transport.status(item,receipt(item),cancel_event=cancel)
    transport.close()
    with pytest.raises(GraphDatabaseError,match='GRAPH_ERASURE_TRANSPORT_BUSY'):
        await transport.status(item,receipt(item))
    assert len(records)==3 and transport._job is None


@pytest.mark.parametrize('url,key',[('file:///tmp/x','x'),('http://user:pass@localhost','x'),('http://localhost/path','x'),('http://localhost?secret=x','x'),('http://localhost','')])
def test_erasure_transport_requires_explicit_unambiguous_origin(url,key):
    with pytest.raises(GraphDatabaseError,match='GRAPH_ERASURE_TRANSPORT_REQUIRED'):
        create_graph_erasure_transport(url=url,deployment_key=key)
