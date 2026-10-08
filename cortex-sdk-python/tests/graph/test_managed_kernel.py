"""Outcome controls for the managed Python kernel (no live subject main)."""

import copy
import hashlib
import json
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from convex.values import json_to_convex

from cortex.graph.erasure import (
    _node_properties,
    apply_graph_job,
    deliver_graph_job,
    graph_off_result,
)
from cortex.graph.errors import GraphDatabaseError, GraphJobUnresolved
from cortex.graph.identity import (
    assert_identity_properties,
    canonical_subtree,
    equivalent,
    graph_job_from_wire,
    graph_wire,
    identity_properties,
    primary_graph_identity,
    validate_graph_job,
)
from cortex.graph.schema.init_schema import (
    drop_graph_schema,
    initialize_graph_schema,
    verify_graph_schema,
)
from cortex.types import GraphJobReceipt, GraphQueryResult, GraphScope

VECTORS = json_to_convex(json.loads(Path(__file__).with_name('managed_job_vectors.json').read_text(), parse_int=float))


@pytest.mark.parametrize('row', VECTORS, ids=['numeric-unicode-special', 'artifact-kind', 'mutable-key'])
def test_actual_ts_canonical_job_and_display(row):
    job = graph_job_from_wire(row)
    assert graph_wire(job.projection) == row['projection'] or equivalent(graph_wire(job.projection), row['projection'])
    assert primary_graph_identity(job.identity.kind, job.identity.physical_source_id, job.identity) == job.identity
    props = _node_properties(job)
    assert props['key'] == job.identity.key and props['kind'] == job.identity.kind
    assert props['projectionJson'] == canonical_subtree(job.projection_json, ['properties'])
    assert hashlib.sha256(job.projection_json.encode()).hexdigest() == job.projection_digest
    if job.identity.kind == 'Memory':
        assert '1e+30' in props['projectionJson'] and '1e-7' in props['projectionJson']
        assert props['nested'] == canonical_subtree(job.projection_json, ['properties', 'nested'])
    if job.identity.kind == 'Artifact':
        assert props['artifactKind'] == 'text'
    if job.identity.kind == 'Mutable':
        assert props['mutableKey'] == 'logical-key'


@pytest.mark.parametrize('field', ['projection_json', 'projection_digest', 'request_json', 'request_digest', 'source_digest', 'source_revision', 'ownership_revision', 'generation', 'attempt_token'])
def test_contradictory_captured_job_refused(field):
    job = graph_job_from_wire(VECTORS[1])
    setattr(job, field, 0 if field.endswith('revision') else '' if field in ('generation', 'attempt_token') else 'contradictory')
    with pytest.raises(GraphDatabaseError):
        validate_graph_job(job)


@pytest.mark.parametrize('scope', [GraphScope(False, None, 's'), GraphScope(True, None, None), GraphScope(True, 1, 's')])
def test_unknown_inapplicable_scope_refused(scope):
    with pytest.raises(GraphDatabaseError):
        primary_graph_identity('Memory', 'source', scope)


def test_exact_scope_physical_and_legacy_refusal():
    values = [primary_graph_identity('Memory', source, GraphScope(True, tenant, space)) for tenant, space, source in [('A','s','same'), ('B','s','same'), (None,'s','same'), ('A','other','same'), ('A','s','replacement')]]
    assert len({value.key for value in values}) == 5
    with pytest.raises(GraphDatabaseError, match='legacy'):
        assert_identity_properties({'key': values[0].key}, values[0])
    assert_identity_properties(identity_properties(values[0]), values[0])


@pytest.mark.parametrize('value', [0, None, False, {'count': 0}, [1]])
def test_graph_off_unchanged_primary(value):
    assert graph_off_result(value) is value


@pytest.mark.parametrize('version', [None, False, 2])
def test_graph_off_never_discards_jobs(version):
    with pytest.raises(GraphDatabaseError) as error:
        graph_off_result({'graphVersion': version, 'primaryResult': 1, 'graphJobs': []})
    assert error.value.code == 'GRAPH_POLICY_MISMATCH'


@pytest.mark.asyncio
async def test_deliver_terminal_and_unresolved_no_effect():
    row = copy.deepcopy(VECTORS[1]); job = graph_job_from_wire(row)
    receipt = GraphJobReceipt(job.id, job.generation, job.identity, job.source_revision)
    client = AsyncMock(); adapter = AsyncMock()
    for state, disposition in [('synced','idempotent'), ('suppressed','suppressed')]:
        row['state'] = state; client.query.return_value = row
        assert (await deliver_graph_job(client, adapter, receipt)).disposition == disposition
    row['state'] = 'failed'; client.query.return_value = row
    with pytest.raises(GraphDatabaseError) as error:
        await deliver_graph_job(client, adapter, receipt)
    assert error.value.code == 'GRAPH_JOB_FAILED'
    client.query.side_effect = RuntimeError('lost response')
    with pytest.raises(GraphJobUnresolved):
        await deliver_graph_job(client, adapter, receipt)
    adapter.managed_transaction.assert_not_called(); client.mutation.assert_not_called()


@pytest.mark.asyncio
async def test_unproven_old_numeric_job_refused_before_adapter():
    row = copy.deepcopy(VECTORS[1]); row.pop('projectionJson')
    with pytest.raises(GraphDatabaseError) as error:
        graph_job_from_wire(row)
    assert error.value.code == 'GRAPH_JOB_UNRESOLVED'
    job = graph_job_from_wire(VECTORS[1]); job.projection_digest = 'bad'
    adapter = AsyncMock()
    with pytest.raises(GraphDatabaseError):
        await apply_graph_job(adapter, job)
    adapter.managed_read.assert_not_called(); adapter.managed_transaction.assert_not_called()


@pytest.mark.asyncio
async def test_schema_conflict_and_unsafe_global_drop_zero_effect():
    adapter = AsyncMock(); adapter.managed_dialect.return_value = 'neo4j'
    adapter.managed_read.side_effect = lambda text: GraphQueryResult([{'name':'cortex_v2_memory_key','type':'WRONG'}],1) if 'CONSTRAINTS' in text else GraphQueryResult([],0)
    for operation in [verify_graph_schema, initialize_graph_schema]:
        with pytest.raises(GraphDatabaseError) as error:
            await operation(adapter)
        assert error.value.code == 'GRAPH_SCHEMA_CONFLICT'
    with pytest.raises(GraphDatabaseError):
        await drop_graph_schema(adapter)
    adapter.query.assert_not_called()


@pytest.mark.asyncio
async def test_schema_missing_is_not_success():
    adapter = AsyncMock(); adapter.managed_dialect.return_value = 'memgraph'
    adapter.managed_read.return_value = GraphQueryResult([],0)
    result = await verify_graph_schema(adapter)
    assert result['valid'] is False and len(result['missing']) == 39
    adapter.query.assert_not_called()


@pytest.mark.asyncio
async def test_received_job_delivery_ack_and_ack_failure_retains_original_job():
    from unittest.mock import patch

    from cortex.types import GraphApplyResult
    row = copy.deepcopy(VECTORS[1]); job = graph_job_from_wire(row)
    receipt = GraphJobReceipt(job.id, job.generation, job.identity, job.source_revision)
    client = AsyncMock(); client.query.return_value = row
    adapter = AsyncMock()
    with patch('cortex.graph.erasure.apply_graph_job', new=AsyncMock(return_value=GraphApplyResult())) as apply:
        assert (await deliver_graph_job(client, adapter, receipt)).disposition == 'applied'
        client.mutation.assert_awaited_once_with('graphSync:markSynced', {'id':job.id, 'generation':job.generation, 'attemptToken':job.attempt_token, 'tenantId':job.identity.tenant_id})
        client.mutation.side_effect = RuntimeError('ack lost')
        with pytest.raises(RuntimeError, match='ack lost'):
            await deliver_graph_job(client, adapter, receipt)
        assert apply.await_count == 2  # Explicit graph-only deliveries, never a primary invocation.
    assert all(call.args[0] == 'graphSync:markSynced' for call in client.mutation.await_args_list)


@pytest.mark.asyncio
@pytest.mark.parametrize('dialect', ['neo4j','memgraph'])
async def test_complete_fixed_schema_is_idempotent_and_drop_preserves_custom(dialect):
    from cortex.graph.identity import MANAGED_KINDS
    constraints, indexes = [], []
    for kind in MANAGED_KINDS:
        label = 'CortexV2' + kind
        if dialect == 'neo4j':
            constraints.append({'name':'cortex_v2_'+kind.lower()+'_key','type':'NODE_PROPERTY_UNIQUENESS','entityType':'NODE','labelsOrTypes':[label],'properties':['key']})
            indexes.extend([{'name':'cortex_v2_'+kind.lower()+'_'+('scope' if prop == 'tenantValue' else 'key_index'),'entityType':'NODE','state':'ONLINE','labelsOrTypes':[label],'properties':[prop]} for prop in ['key','tenantValue']])
        else:
            constraints.append({'constraint type':'unique','label':label,'properties':['key']})
            indexes.extend([{'label':label,'property':[prop],'index type':'label+property'} for prop in ['key','tenantValue']])
    constraints.append({'name':'custom_keep','label':'CustomKeep','type':'CUSTOM'})
    indexes.append({'name':'custom_keep_index','label':'CustomKeep'})
    adapter = AsyncMock(); adapter.managed_dialect.return_value = dialect
    adapter.is_connected.return_value = True
    adapter.managed_read.side_effect = lambda text: GraphQueryResult(constraints,len(constraints)) if 'CONSTRAINT' in text else GraphQueryResult(indexes,len(indexes))
    assert (await verify_graph_schema(adapter))['valid'] is True
    await initialize_graph_schema(adapter); adapter.query.assert_not_called()
    await drop_graph_schema(adapter, {'managedVersion':2})
    commands = [call.args[0] for call in adapter.query.await_args_list]
    assert len(commands) == (26 if dialect == 'neo4j' else 39)
    assert all('custom' not in text and 'CustomKeep' not in text for text in commands)


@pytest.mark.asyncio
@pytest.mark.parametrize('foreign_revision',[None,-1,2])
async def test_successful_source_set_refreshes_only_same_source_reference(monkeypatch,foreign_revision):
    from dataclasses import replace

    from cortex.graph import erasure
    from cortex.types import GraphProjection, GraphReference

    job=graph_job_from_wire(VECTORS[1])
    identity=primary_graph_identity('Context','self-root',GraphScope(True,'tenant','space'))
    target=identity if foreign_revision is None else primary_graph_identity('Context','other-root',identity)
    reference=GraphReference('root','root','CHILD_OF',target,1,1,'fixed-ref')
    job=replace(job,identity=identity,source_revision=1,ownership_revision=1,reference_generation='fixed-ref',
        projection=GraphProjection(identity,1,{},[reference],[]),source_digest='1'*64)
    states={identity.key:{**identity_properties(identity),'sourceRevision':-1,'tombstoned':False}}
    if foreign_revision is not None:
        states[target.key]={**identity_properties(target),'sourceRevision':foreign_revision,'tombstoned':False,'ownershipRevision':1,'referenceGeneration':'fixed-ref'}
    monkeypatch.setattr(erasure,'_gate',AsyncMock(side_effect=lambda tx,identity:states[identity.key]))
    queries=[]
    async def query(text,args=None):
        queries.append((text,args))
        if 'RETURN properties(n) AS node' in text:
            return GraphQueryResult([],0)
        return GraphQueryResult([{'key':identity.key}],1)
    tx=type('Transaction',(),{'query':staticmethod(query)})()
    if foreign_revision is None:
        assert (await erasure._apply(tx,job)).disposition=='applied'
        set_index=next(i for i,(text,_) in enumerate(queries) if 's.activeDigest=$digest' in text)
        edge_index=next(i for i,(text,_) in enumerate(queries) if 'MERGE (a)-[r:' in text)
        assert set_index<edge_index and states[identity.key]['sourceRevision']==1
        assert states[identity.key]['ownershipRevision']==1 and states[identity.key]['referenceGeneration']=='fixed-ref'
    else:
        expected='GRAPH_TARGET_NOT_DELIVERED' if foreign_revision==-1 else 'GRAPH_REFERENCE_CHANGED'
        with pytest.raises(GraphDatabaseError,match=expected):
            await erasure._apply(tx,job)
        assert states[target.key]['sourceRevision']==foreign_revision
        assert not any('MERGE (a)-[r:' in text for text,_ in queries)
