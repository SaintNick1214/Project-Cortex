"""Real owned graph runtime evidence. Required prerequisites fail rather than skip."""
import json
import os
from pathlib import Path
from uuid import uuid4

import pytest
from neo4j import AsyncGraphDatabase

from cortex import Cortex, CortexConfig
from cortex.graph.adapters import CypherGraphAdapter
from cortex.graph.config import GraphConnectionOptions
from cortex.graph.errors import GraphAuthenticationError
from cortex.types import GraphConfig, GraphConnectionConfig, GraphEdge, GraphNode, RecallParams, RegisterMemorySpaceParams, RememberParams, StoreFactParams, TraversalConfig

assert 'CORTEX_GRAPH_PROOF_ROOT' in os.environ, 'Set CORTEX_GRAPH_PROOF_ROOT to the prepared owned graph fixture.'
ROOT=Path(os.environ['CORTEX_GRAPH_PROOF_ROOT'])
assert os.environ.get('HOME') == os.environ.get('CORTEX_TEST_HOME_ROOT')
assert os.environ['HOME'].startswith(str(ROOT)+'/')
assert os.environ['CONVEX_URL_PY'] == 'http://127.0.0.1:43210'
CONFIGS=json.loads((ROOT/'connection.json').read_text())
SENTINELS=json.loads((ROOT/'sentinels.json').read_text())

async def sentinel(engine):
    config=CONFIGS[engine]
    assert config['uri'] in ('bolt://127.0.0.1:45387','bolt://127.0.0.1:45388')
    async with AsyncGraphDatabase.driver(config['uri'],auth=(config['username'],config['password'])) as driver:
        async with driver.session() as session:
            result=await session.run('MATCH(n:__TEST__ {owner:$owner}) RETURN id(n) AS id, properties(n) AS properties',owner='task15-unrelated-sentinel')
            assert await result.data() == [SENTINELS[engine]]

@pytest.mark.asyncio
@pytest.mark.parametrize('engine',['neo4j','memgraph'])
async def test_sentinel_and_authentication(engine):
    await sentinel(engine)
    adapter=CypherGraphAdapter(); await adapter.connect(GraphConnectionConfig(**CONFIGS[engine])); await adapter.disconnect()
    with pytest.raises(GraphAuthenticationError):
        await adapter.connect(GraphConnectionConfig(**{**CONFIGS[engine],'password':'deliberately-wrong-task15-password'}))
    assert not await adapter.is_connected()
    await sentinel(engine)

@pytest.mark.asyncio
@pytest.mark.parametrize('engine',['neo4j','memgraph'])
async def test_crud_traversal_exact_cleanup(engine):
    adapter=CypherGraphAdapter(); await adapter.connect(GraphConnectionConfig(**CONFIGS[engine]))
    owner='task15-py-'+str(uuid4()); ids=[]
    try:
        one=await adapter.create_node(GraphNode(label='Task15Owned',properties={'owner':owner,'name':'first','version':1})); ids.append(one)
        two=await adapter.create_node(GraphNode(label='Task15Owned',properties={'owner':owner,'name':'second'})); ids.append(two)
        assert (await adapter.get_node(one)).properties['name']=='first'
        await adapter.update_node(one,{'version':2}); assert (await adapter.get_node(one)).properties['version']==2
        edge=await adapter.create_edge(GraphEdge(type='TASK15_LINK',from_node=one,to_node=two,properties={'owner':owner}))
        traversal=TraversalConfig(start_id=one,relationship_types=['TASK15_LINK'],max_depth=1,direction='OUTGOING')
        assert any(node.id==two for node in await adapter.traverse(traversal))
        await adapter.delete_edge(edge); assert not await adapter.traverse(traversal)
        await adapter.delete_node(one); assert await adapter.get_node(one) is None
    finally:
        for node_id in ids: await adapter.delete_node(node_id)
        assert not await adapter.find_nodes('Task15Owned',{'owner':owner})
        await adapter.disconnect(); await sentinel(engine)

@pytest.mark.asyncio
@pytest.mark.parametrize('engine',['neo4j','memgraph'])
async def test_sdk_sync_persistence_recall_owned_shutdown(engine):
    space='task15-py-'+engine+'-'+str(uuid4()); conversation=space+'-conversation'; user=space+'-user'; agent=space+'-agent'; entities=[space+'-A',space+'-B',space+'-C']
    cortex=await Cortex.create(CortexConfig(convex_url=os.environ['CONVEX_URL_PY']),graph_enabled=True,graph_connection=GraphConnectionOptions(**CONFIGS[engine]))
    inspector=CypherGraphAdapter(); await inspector.connect(GraphConnectionConfig(**CONFIGS[engine]))
    try:
        await cortex.memory_spaces.register(RegisterMemorySpaceParams(memory_space_id=space,type='personal',name=space))
        result=await cortex.memory.remember(RememberParams(memory_space_id=space,conversation_id=conversation,user_message='Task15 sapphire bicycle preference',agent_response='Sapphire bicycle recorded',user_id=user,user_name=user,agent_id=agent))
        assert len(result.memories)>=2
        assert len(await inspector.find_nodes('Memory',{'memorySpaceId':space}))==2
        assert len(await inspector.find_nodes('Conversation',{'conversationId':conversation}))==1
        relationships=await inspector.query('MATCH(m:Memory {memorySpaceId:$space})-[:REFERENCES]->(c:Conversation {conversationId:$conversation}) RETURN count(m) AS count',{'space':space,'conversation':conversation})
        assert relationships.records[0]['count']==2
        await cortex.facts.store(StoreFactParams(memory_space_id=space,fact='sapphire bicycle relates the first two entities',fact_type='relationship',subject=entities[0],predicate='knows',object=entities[1],confidence=95,source_type='manual'))
        await cortex.facts.store(StoreFactParams(memory_space_id=space,fact=entities[1]+' navigates '+entities[2],fact_type='relationship',subject=entities[1],predicate='knows',object=entities[2],confidence=95,source_type='manual'))
        recalled=await cortex.memory.recall(RecallParams(memory_space_id=space,query='sapphire bicycle',user_id=user,limit=10))
        assert recalled.total_results>0 and 'sapphire' in str(recalled).lower()
        assert recalled.sources.graph["count"]>0 and recalled.graph_expansion_applied
    finally:
        await cortex.memory_spaces.delete(space,cascade=True,reason='task15 owned proof cleanup',confirm_id=space)
        await inspector.query('MATCH(n) WHERE n.memorySpaceId=$space OR n.conversationId=$conversation OR n.userId=$user OR n.agentId=$agent OR n.name IN $entities DETACH DELETE n',{'space':space,'conversation':conversation,'user':user,'agent':agent,'entities':entities})
        assert await cortex.memory_spaces.get(space) is None
        await cortex.users.delete(user)
        await cortex.agents.unregister(agent)
        await cortex.shutdown(); await cortex.close(); await inspector.disconnect(); await sentinel(engine)

@pytest.mark.asyncio
@pytest.mark.parametrize('engine',['neo4j','memgraph'])
async def test_simulated_unsupported_capability_real_fallback_preserves_sentinel(engine):
    adapter=CypherGraphAdapter()
    original_session=adapter._get_session
    def get_session():
        session=original_session()
        original_run=session.run
        async def run(query, *args, **kwargs):
            if query=='RETURN elementId(null) AS id':
                error = RuntimeError("Function 'elementId' doesn't exist.")
                error.code = 'Memgraph.ClientError.MemgraphError.MemgraphError'
                raise error
            return await original_run(query, *args, **kwargs)
        session.run=run
        return session
    adapter._get_session=get_session
    await adapter.connect(GraphConnectionConfig(**CONFIGS[engine]))
    owner='task15-py-fallback-'+str(uuid4())
    node_id=await adapter.create_node(GraphNode(label='Task15Owned',properties={'owner':owner}))
    try:
        assert (await adapter.get_node(node_id)).properties['owner']==owner
        await sentinel(engine)
    finally:
        await adapter.delete_node(node_id); await adapter.disconnect(); await sentinel(engine)

@pytest.mark.asyncio
@pytest.mark.parametrize('engine',['neo4j','memgraph'])
async def test_caller_owned_adapter_usable_after_sdk_disposal(engine):
    adapter=CypherGraphAdapter(); await adapter.connect(GraphConnectionConfig(**CONFIGS[engine]))
    cortex=await Cortex.create(CortexConfig(convex_url=os.environ['CONVEX_URL_PY'],graph=GraphConfig(adapter=adapter)),graph_enabled=False)
    await cortex.shutdown(); await cortex.close()
    node_id=await adapter.create_node(GraphNode(label='Task15Owned',properties={'owner':'task15-manual-'+str(uuid4())}))
    try:
        assert (await adapter.get_node(node_id)).label=='Task15Owned'
    finally:
        await adapter.delete_node(node_id); await adapter.disconnect(); await sentinel(engine)
