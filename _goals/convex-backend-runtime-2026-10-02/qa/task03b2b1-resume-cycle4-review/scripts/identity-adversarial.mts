import assert from 'node:assert/strict';
import {ConvexError} from '/workspace/Project-Cortex/work/resume/registry/candidate/node_modules/convex/dist/esm/values/index.js';
import {fixture,invoke,seedAgent,seedSpace,seedContext} from '/workspace/Project-Cortex/work/resume/registry/candidate/tests/unit/runtimeRegistryAuth/fixture.ts';
import {snapshot} from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/runtimeRegistryAuth.ts';
import * as agents from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/agents.ts';
import * as spaces from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/memorySpaces.ts';
import * as contexts from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/contexts.ts';
const scope={tenantId:'tenant-a',memorySpaceId:'space-a'};
const edits=[{table:'agents',reg:agents.update,seed:seedAgent,args:{agentId:'agent-a',name:'Changed'},nth:4},{table:'memorySpaces',reg:spaces.update,seed:seedSpace,args:{name:'Changed'},nth:5},{table:'contexts',reg:contexts.update,seed:seedContext,args:{contextId:'context-a',description:'Changed'},nth:4}];
const creates=[{table:'agents',reg:agents.register,args:{agentId:'new',name:'New'}},{table:'memorySpaces',reg:spaces.register,args:{type:'personal'}},{table:'contexts',reg:contexts.create,args:{purpose:'New'}}];
const envelopes=[['UNAUTHENTICATED','Verified identity required'],['FORBIDDEN','Access denied'],['INVALID_INPUT','Invalid authority configuration'],['CAPABILITY_NOT_READY','Access denied or invalid registry input']];
const observations=[];
const identity={issuer:'https://host.test',subject:'user-a',tokenIdentifier:'https://host.test|user-a'};
for(const entry of [...edits.map(e=>({...e,stage:'initial'})),...edits.map(e=>({...e,stage:'optionalRead'})),...creates.map(e=>({...e,stage:'postInsert'}))])for(const mode of ['property-getter','synchronous-call','rejected-thenable']){
 const f=fixture();if(entry.seed)entry.seed(f);if(entry.stage==='postInsert'&&entry.table==='contexts')seedSpace(f);
 const before=snapshot([...f.db.rows]);let calls=0,reached=false,attempts=0;f.db.beforeWrite=()=>attempts++;
 const fault=()=>new ConvexError({version:1,code:'FORBIDDEN',message:'Access denied',retryable:false,outcome:'not_dispatched'});
 const inject=()=>entry.stage==='initial'||entry.stage==='optionalRead'&&calls===entry.nth||entry.stage==='postInsert'&&f.db.writes>0;
 if(mode==='property-getter') Object.defineProperty(f.ctx.auth,'getUserIdentity',{get(){calls++;if(inject()){reached=true;throw fault();}return async()=>identity;}});
 else f.ctx.auth.getUserIdentity=()=>{calls++;if(inject()){reached=true;if(mode==='synchronous-call')throw fault();return {then(_resolve,reject){reject(fault());}};}return Promise.resolve(identity);};
 let result,error;try{result=await f.db.transaction(()=>invoke(entry.reg,f.ctx,{...scope,...entry.args}));}catch(e){error=e;}
 assert(reached);assert(error instanceof ConvexError);assert.deepEqual(error.data,{version:1,code:'REGISTRY_OPERATION_FAILED',message:'Registry operation failed',retryable:false,outcome:entry.stage==='postInsert'?'rolled_back':'failed'});
 assert.equal(attempts,entry.stage==='postInsert'?1:0);assert.equal(f.db.writes,0);assert.equal(snapshot([...f.db.rows]),before);assert.equal(result,undefined);
 observations.push({table:entry.table,stage:entry.stage,mode,reached,attempts,commits:f.db.writes,error:error.data});
}
assert.equal(observations.length,27);console.log(JSON.stringify({count:27,passed:27,observations},null,2));
