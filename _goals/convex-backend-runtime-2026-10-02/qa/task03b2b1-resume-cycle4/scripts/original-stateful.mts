import assert from 'node:assert/strict';
import {fixture,invoke,seedAgent,seedSpace,seedContext} from '/workspace/Project-Cortex/work/resume/registry/candidate/tests/unit/runtimeRegistryAuth/fixture.ts';
import * as agents from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/agents.ts';
import * as memorySpaces from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/memorySpaces.ts';
import * as contexts from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/contexts.ts';
import {ConvexError} from '/workspace/Project-Cortex/work/resume/registry/candidate/node_modules/convex/dist/esm/values/index.js';
const scope={tenantId:'tenant-a',memorySpaceId:'space-a'},marker='private-driver-payload-in-public-code';
const jobs=[['agents',agents.update,seedAgent,{agentId:'agent-a',name:'New'}],['memorySpaces',memorySpaces.update,seedSpace,{name:'New'}],['contexts',contexts.update,seedContext,{contextId:'context-a',description:'New'}]];
const outcomes=[];
for(const [table,reg,seed,args] of jobs)for(const stage of ['canonicalRead','firstWrite','postEffectReload']){
 const f=fixture();seed(f);let reached=false,reads=0,attempts=0;
 const error=new ConvexError({version:1,code:'FORBIDDEN',message:'Access denied',retryable:false,outcome:'not_dispatched'});
 Object.defineProperty(error.data,'code',{enumerable:true,configurable:true,get(){reads++;return reads<=2?'FORBIDDEN':marker;}});
 if(stage==='firstWrite')f.db.beforeWrite=()=>{reached=true;attempts++;throw error;};
 else f.db.beforeRead=(name)=>{if(name===table&&(stage==='canonicalRead'||f.db.writes>0)){reached=true;throw error;}};
 let caught;try{await f.db.transaction(()=>invoke(reg,f.ctx,{...scope,...args}));}catch(e){caught=e;}
 assert.equal(reached,true);assert.equal(f.db.writes,0);assert(caught instanceof ConvexError);assert.equal(caught.data.code,marker);
 outcomes.push({path:table+':update',stage,reached,attempts,reads,committedWrites:f.db.writes,errorType:caught.constructor.name,errorData:caught.data,errorMessage:caught.message,privateOutputLeak:true,synthetic:true});
}
// Exact-looking envelope with a non-enumerable private field bypasses key-exactness and can
// be pruned at initial optional READ, turning an unexpected driver error into success.
for(const [table,reg,seed,args] of jobs){
 const f=fixture();seed(f);let reached=false;
 const error=new ConvexError({version:1,code:'FORBIDDEN',message:'Access denied',retryable:false,outcome:'not_dispatched'});
 Object.defineProperty(error.data,'privateDriverPayload',{enumerable:false,value:marker});
 let principalReads=0;
 f.db.beforeRead=(name)=>{if(name==='runtimeAuthPrincipals'){principalReads++;if(table==='agents'?principalReads===4:table==='memorySpaces'?principalReads===5:principalReads===4){reached=true;throw error;}}};
 let result,caught;try{result=await f.db.transaction(()=>invoke(reg,f.ctx,{...scope,...args}));}catch(e){caught=e;}
 assert.equal(reached,true); assert.equal(caught,undefined); assert.equal(f.db.writes,1); assert.deepEqual(result,{accepted:true,resourceType:table,resourceId:table==='agents'?'agent-a':table==='memorySpaces'?'space-a':'context-a'}); assert.equal(Object.getOwnPropertyNames(error.data).includes('privateDriverPayload'),true); outcomes.push({path:table+':update',stage:'nonenumerable-extra initial optional READ',reached,principalReads,result,errorData:caught?.data??null,writes:f.db.writes,ownDataKeys:Object.getOwnPropertyNames(error.data),unexpectedDriverFaultBecameSuccess:true,synthetic:true});
}
console.log(JSON.stringify({classification:'Synthetic stateful/accessor-bearing exception data at actual native registered handlers; no claim these shapes come from installed QueryImpl.unique.',count:outcomes.length,outcomes},null,2));
