import {fixture, invoke, seedSpace, seedContext} from '/workspace/Project-Cortex/work/resume/registry/candidate/tests/unit/runtimeRegistryAuth/fixture.ts';
import * as contexts from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/contexts.ts';
const f=fixture();seedSpace(f);const scope={tenantId:'tenant-a',memorySpaceId:'space-a'};
for(let i=0;i<100;i++)seedContext(f,{contextId:'node-'+i,rootId:'node-0',parentId:i===0?undefined:'node-'+(i-1),depth:i,childIds:i===99?[]:['node-'+(i+1)]});
const before=await invoke(contexts.getChain,f.ctx,{...scope,contextId:'node-99'});
const created=await f.db.transaction(()=>invoke(contexts.create,f.ctx,{...scope,purpose:'One beyond graph limit',parentId:'node-99'}));
let afterError;try{await invoke(contexts.getChain,f.ctx,{...scope,contextId:created.contextId});}catch(e){afterError={type:e.constructor.name,message:e.message,data:e.data};}
console.log(JSON.stringify({name:'100-node-create-boundary',beforeTotalNodes:before.totalNodes,created,afterError,totalPersistedNodes:f.db.table('contexts').length,writes:f.db.writes},null,2));
