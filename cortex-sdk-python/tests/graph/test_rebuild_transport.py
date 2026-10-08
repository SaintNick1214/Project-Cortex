"""Real bounded loopback administrator transport; no product service required."""

import asyncio
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from cortex.graph.errors import GraphDatabaseError
from cortex.graph.rebuild_transport import create_graph_rebuild_transport


@pytest.fixture
def native_server():
    records=[]
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args):pass
        def do_POST(self):
            body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            records.append((self.path, self.headers.get('Authorization') == 'Convex controlled-key', body))
            data=json.dumps({'status':'success','value':{'schemaVersion':2,'page':[],'isDone':True,'continueCursor':'end'}}).encode()
            self.send_response(200);self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
    thread=threading.Thread(target=server.serve_forever);thread.start()
    try:
        yield 'http://127.0.0.1:'+str(server.server_port),records
    finally:
        server.shutdown();server.server_close();thread.join(2)
        assert not thread.is_alive()


def request():
    return {'version':2,'kind':'Memory','tenantId':'controlled-tenant','memorySpaceId':'controlled-space','paginationOpts':{'cursor':None,'endCursor':None,'numItems':8}}


@pytest.mark.asyncio
async def test_real_two_fixed_queries_official_codec_closes_each_owner(native_server):
    url,records=native_server
    transport=create_graph_rebuild_transport(url=url,deployment_key='controlled-key')
    page=await transport.source_page(request())
    assert page['schemaVersion']==2 and page['page']==[] and transport._job is None
    edge={**request(),'physicalSourceId':'controlled-physical','expectedSourceRevision':2,'expectedOwnershipRevision':1,'expectedReferenceGeneration':'controlled-generation'}
    assert (await transport.edge_page(edge))['isDone'] is True and transport._job is None
    transport.close()
    assert [(path,authorized,body['path']) for path,authorized,body in records] == [('/api/function',True,'graphSync:rebuildSourcePage'),('/api/function',True,'graphSync:rebuildEdgePage')]
    assert records[1][2]['args']['expectedSourceRevision'] == 2
    with pytest.raises(GraphDatabaseError,match='GRAPH_REBUILD_TRANSPORT_BUSY'):
        await transport.source_page(request())
    assert len(records)==2


@pytest.mark.asyncio
async def test_wrong_scope_extra_function_and_cancel_refuse_before_network(native_server):
    url,records=native_server
    transport=create_graph_rebuild_transport(url=url,deployment_key='controlled-key')
    for extra in [{'tenantId':''},{'function':'arbitrary'},{'version':1}]:
        with pytest.raises(GraphDatabaseError,match='GRAPH_SCOPE_MISMATCH'):
            await transport.source_page({**request(),**extra})
    cancel=asyncio.Event();cancel.set()
    with pytest.raises(GraphDatabaseError,match='GRAPH_REBUILD_CANCELLED'):
        await transport.source_page(request(),cancel_event=cancel)
    assert not records and transport._job is None
    transport.close()


@pytest.mark.parametrize('url,key',[('file:///tmp/x','x'),('http://user:pass@localhost','x'),('http://localhost/path','x'),('http://localhost?secret=x','x'),('http://localhost','')])
def test_missing_ambiguous_target_refused(url,key):
    with pytest.raises(GraphDatabaseError,match='GRAPH_REBUILD_TRANSPORT_REQUIRED'):
        create_graph_rebuild_transport(url=url,deployment_key=key)
