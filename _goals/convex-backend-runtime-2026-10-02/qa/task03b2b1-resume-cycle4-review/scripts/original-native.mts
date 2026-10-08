import assert from 'node:assert/strict';
import {fixture, invoke, seedAgent, seedContext, seedSpace} from '/workspace/Project-Cortex/work/resume/registry/candidate/tests/unit/runtimeRegistryAuth/fixture.ts';
import * as agents from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/agents.ts';
import * as spaces from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/memorySpaces.ts';
import * as contexts from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/contexts.ts';
import {QueryImpl} from '/workspace/Project-Cortex/work/resume/registry/candidate/node_modules/convex/dist/esm/server/impl/query_impl.js';
const scope={tenantId:'tenant-a',memorySpaceId:'space-a'};
const results=[];
for (const [label,registration,seed,args,field] of [
  ['agent-status-bulk-retirement',agents.unregisterMany,seedAgent,{status:'active'},'agentIds'],
  ['context-filter-bulk-update',contexts.updateMany,seedContext,{updates:{status:'completed'}},'contextIds'],
  ['context-filter-bulk-retirement',contexts.deleteMany,seedContext,{},'contextIds']
]) {
 const f=fixture(['write','admin']);const row=seed(f,{agentId:'private-agent-label-not-in-request',contextId:'private-context-label-not-in-request',rootId:'private-context-label-not-in-request'});
 // Agent schema does not accept context fields; keep each row native-valid.
 if(label.startsWith('agent')) {delete row.contextId;delete row.rootId;}
 else delete row.agentId;
 const result=await f.db.transaction(()=>invoke(registration,f.ctx,{...scope,...args}));
 const serialized=JSON.stringify(result);
 results.push({name:label,capabilities:f.grant.capabilities,args:{...scope,...args},result,leaksPrivateStoredIdentifier:serialized.includes(label.startsWith('agent')?'private-agent-label-not-in-request':'private-context-label-not-in-request'),writes:f.db.writes});
}
{
 const f=fixture(['write','admin']);seedContext(f,{contextId:'known-parent',rootId:'known-parent',childIds:['private-child-label-not-in-request']});
 seedContext(f,{contextId:'private-child-label-not-in-request',rootId:'known-parent',parentId:'known-parent',depth:1});
 const result=await f.db.transaction(()=>invoke(contexts.deleteContext,f.ctx,{...scope,contextId:'known-parent',orphanChildren:true}));
 results.push({name:'write-only-orphan-child-identifier-receipt',capabilities:f.grant.capabilities,args:{...scope,contextId:'known-parent',orphanChildren:true},result,leaksPrivateStoredIdentifier:JSON.stringify(result).includes('private-child-label-not-in-request')});
}
for(const [label,registration,seed,args] of [
 ['agent-write-only-native-duplicate-error',agents.update,seedAgent,{agentId:'agent-a',name:'New'}],
 ['space-write-only-native-duplicate-error',spaces.update,seedSpace,{name:'New'}],
 ['context-write-only-native-duplicate-error',contexts.update,seedContext,{contextId:'context-a',description:'New'}]
]) {
 const f=fixture(['write','admin']);seed(f,{_id:'native-private-document-id-one'});seed(f,{_id:'native-private-document-id-two'});
 const original=f.db.query.bind(f.db);
 f.db.query=(table)=>{const builder=original(table);builder.unique=async()=>await QueryImpl.prototype.unique.call({take:async(n)=>await builder.take(n),tableNameForErrorMessages:table});return builder;};
 let error;try{await f.db.transaction(()=>invoke(registration,f.ctx,{...scope,...args}));}catch(e){error=e;}
 assert(error);assert.equal(f.db.writes,0);
 results.push({name:label,capabilities:f.grant.capabilities,errorType:error.constructor.name,errorMessage:error.message,errorData:error.data??null,leaksPrivateStoredDocumentId:error.message.includes('native-private-document-id-one'),writes:f.db.writes,nativeUniqueImplementation:'Convex1.46 QueryImpl.prototype.unique (real installed dependency); take(2) delegated to traced fixture'});
}
{
 const f=fixture(['write','admin']);seedAgent(f,{config:{private:'not-in-receipt'}});
 const result=await invoke(agents.update,f.ctx,{...scope,agentId:'agent-a',name:'New'});
 assert.deepEqual(result,{accepted:true,resourceType:'agents',resourceId:'agent-a'});
 results.push({name:'write-only-individual-safe-receipt-positive-control',result,privatePayloadAbsent:!JSON.stringify(result).includes('not-in-receipt')});
}
console.log(JSON.stringify(results,null,2));
