/** Real registered maintenance handler against MemoryFixture DB; no service dispatch. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { convexToJson, jsonToConvex } from 'convex/values';
import { repo, scratch, preparation } from './guard.mjs';
import { validate } from './offline-arguments-check.mjs';
import { authDenial } from './native-engine.mjs';
const output=resolve(scratch,'offline-admin-outcome.mjs');
await build({stdin:{contents:`export {deleteRecord} from ${JSON.stringify(resolve(repo,'convex-dev/admin.ts'))}; export {memoryFixture} from ${JSON.stringify(resolve(repo,'tests/unit/runtimeMemory/fixture.ts'))}; export {default as schema} from ${JSON.stringify(resolve(repo,'convex-dev/schema.ts'))}; export * as graph from ${JSON.stringify(resolve(repo,'convex-dev/graphSync.ts'))};`,resolveDir:repo},bundle:true,platform:'node',format:'esm',packages:'external',outfile:output,logLevel:'silent'});
const {deleteRecord,memoryFixture,graph,schema:tables}=await import(pathToFileURL(output));
const native=JSON.parse(readFileSync(resolve(preparation,'native-registration-schemas.json'))),schema=native.rows.find(row=>row.path==='admin:deleteRecord').args;
const f=memoryFixture();f.grant.capabilities.push('tool');
// MemoryFixture supplies actual table selection and ID normalization; this local delete
// adapter implements only DB persistence, never an operator result or return envelope.
f.db.delete=async(table,id)=>{const rows=f.db.table(table),index=rows.findIndex(row=>row._id===id);assert.ok(index>=0);rows.splice(index,1);f.db.writes++;};
const fields={tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId,ownerPrincipalId:f.principal._id};
const lineage={sourceId:'owned-source',sourceEventId:'owned-event',sourceRevision:1,role:'user',trust:'user_assertion'};
const source=f.db.seed('runtimeMemorySources',{...fields,lineage,content:'Owned source',contentHash:'retained',createdAt:1000});
const fact=f.db.seed('facts',{...fields,factId:'owned-fact',lineage,fact:'Owned source',factType:'knowledge',confidence:90,sourceType:'manual',tags:[],version:1,createdAt:1000,updatedAt:1000,extractionPolicyVersion:'source-attributed-facts-v1'});
const tombstone=f.db.seed('runtimeAuthTombstones',{resourceType:'source',resourceId:'other-retained-source',tenantId:fields.tenantId,memorySpaceId:fields.memorySpaceId,deletedAt:1000});
const policy=f.db.seed('governancePolicies',{...fields,organizationId:fields.tenantId,isActive:true,policy:{marker:'owned'},createdAt:1000,updatedAt:1000});
const otherPolicy=f.db.seed('governancePolicies',{...fields,organizationId:fields.tenantId,isActive:true,policy:{marker:'retained'},createdAt:1000,updatedAt:1000});
const log=f.db.seed('governanceEnforcement',{policyId:policy._id,...fields,enforcementType:'manual',layers:[],rules:[],versionsDeleted:0,recordsPurged:0,storageFreed:0,executedAt:1000});
const retainedLog=f.db.seed('governanceEnforcement',{policyId:otherPolicy._id,...fields,enforcementType:'manual',layers:[],rules:[],versionsDeleted:0,recordsPurged:0,storageFreed:0,executedAt:1000});
const barrierTables=['runtimeAuthPrincipals','runtimeAuthMemberships','runtimeAuthGrants','runtimeAuthScopes','runtimeAuthTombstones','runtimeMemorySources','facts'];
const barrier=()=>barrierTables.map(table=>[table,structuredClone(f.db.table(table))]);
for(const table of ['governancePolicies','governanceEnforcement','runtimeMemorySources','facts','runtimeAuthTombstones'])for(const row of f.db.table(table)){const value={...row};delete value._id;delete value._creationTime;validate(tables.tables[table].validator.json,value);}
const before=barrier();
async function invoke(args){validate(schema,args);return jsonToConvex(convexToJson(await deleteRecord._handler(f.ctx,args)));}
const removed=await invoke({table:'governancePolicies',id:policy._id});assert.throws(()=>assert.equal(removed,true));assert.deepEqual(removed,{deleted:true});assert.equal(await f.db.get('governancePolicies',policy._id),null);assert.equal(await f.db.get('governanceEnforcement',log._id),null);assert.deepEqual(await f.db.get('governancePolicies',otherPolicy._id),otherPolicy);assert.deepEqual(await f.db.get('governanceEnforcement',retainedLog._id),retainedLog);assert.deepEqual(barrier(),before);
const writes=f.db.writes;assert.deepEqual(await invoke({table:'governancePolicies',id:policy._id}),{deleted:false});assert.equal(f.db.writes,writes);
// Real graph registration validates source/authority before producing the queue.
// Keep the independently checked content hash consistent with the canonical source.
const {createHash}=await import('node:crypto');source.contentHash=createHash('sha256').update(source.content).digest('hex');
const graphArgs={authority:f.reference,table:'facts',entityId:fact.factId,operation:'insert',source:{sourceId:lineage.sourceId,sourceEventId:lineage.sourceEventId,sourceRevision:1},expectedVersion:1,priority:'high'};
const queueId=await graph.queueForSync._handler(f.ctx,graphArgs);assert.equal(typeof queueId,'string');assert.ok(await f.db.get('graphSyncQueue',queueId));
await f.db.delete('runtimeMemorySources',source._id);const afterSource=barrier(),queueSnapshot=structuredClone(f.db.table('graphSyncQueue')),beforeDeniedWrites=f.db.writes;
for(const registration of [graph.markSynced,graph.deleteSyncItem]){let error;try{await registration._handler(f.ctx,{authority:f.reference,id:queueId});}catch(caught){error=caught;}authDenial(undefined,error);assert.equal(f.db.writes,beforeDeniedWrites);assert.deepEqual(f.db.table('graphSyncQueue'),queueSnapshot);assert.deepEqual(barrier(),afterSource);}
f.grant.revokedAt=Date.now();const afterRevoked=barrier();
const graphRemoved=await invoke({table:'graphSyncQueue',id:queueId});assert.throws(()=>assert.equal(graphRemoved,true));assert.deepEqual(graphRemoved,{deleted:true});assert.equal(await f.db.get('graphSyncQueue',queueId),null);assert.equal(await f.db.get('runtimeMemorySources',source._id),null);assert.deepEqual(barrier(),afterRevoked);assert.deepEqual(await f.db.get('runtimeAuthTombstones',tombstone._id),tombstone);
const state=structuredClone(f.db.rows),noWrites=f.db.writes;
for(const args of [{table:'governancePolicies',id:fact._id},{table:'facts',id:fact._id}]){let error;try{await invoke(args);}catch(caught){error=caught;}assert.ok(error);assert.deepEqual(error.data,{version:1,code:args.table==='facts'?'UNSUPPORTED_OPERATION':'INVALID_INPUT',message:args.table==='facts'?'Resource lifecycle is not supported by this maintenance adapter':'Access denied or invalid worker input',retryable:false,outcome:'not_dispatched'});assert.deepEqual(f.db.rows,state);assert.equal(f.db.writes,noWrites);}
const assertDeleted=value=>assert.deepEqual(value,{deleted:true});
for(const value of [true,false,{},null,{deleted:false},{deleted:1},{deleted:true,private:'unexpected'}])assert.throws(()=>assertDeleted(value));
console.log(JSON.stringify({scope:'OFFLINE_ACTUAL_NATIVE_ADMIN_OUTCOME',status:'PASS',actualRegisteredHandler:true,memoryFixtureDb:true,seedTableSchemasVerified:true,revokedGrantMaintenanceFence:true,oldBooleanAssertionsRejected:2,exactDeletedObjects:2,missingRowFalse:true,linkedPolicyLogsRemoved:true,otherPolicyLogsRetained:true,sourceDeletionBarriers:2,authSourceTombstonesPreserved:true,wrongIdAndUnsupportedNoEffects:2,malformedOutcomeNegatives:7,serviceCalls:0,signatures:0,live:'NOT_RUN'}));
