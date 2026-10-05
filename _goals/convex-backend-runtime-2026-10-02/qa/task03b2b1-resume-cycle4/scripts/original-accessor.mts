import assert from 'node:assert/strict';
import {fixture, invoke, seedAgent, seedSpace, seedContext} from '/workspace/Project-Cortex/work/resume/registry/candidate/tests/unit/runtimeRegistryAuth/fixture.ts';
import * as agents from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/agents.ts';
import * as memorySpaces from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/memorySpaces.ts';
import * as contexts from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/contexts.ts';
import {ConvexError} from '/workspace/Project-Cortex/work/resume/registry/candidate/node_modules/convex/dist/esm/values/index.js';
const scope={tenantId:'tenant-a',memorySpaceId:'space-a'};
const specific={register:{agentId:'new-agent',name:'New',type:'personal'},update:{name:'Updated',description:'Updated'},updateMany:{agentIds:['agent-a'],name:'Bulk',updates:{status:'completed'}},unregisterMany:{agentIds:['agent-a']},create:{purpose:'New'},addParticipant:{participant:{id:'label-b',type:'user',joinedAt:1000},participantId:'label-b'},removeParticipant:{participantId:'label-b'},grantAccess:{targetMemorySpaceId:'space-a',scope:'read-only'},deleteSpace:{cascade:true,reason:'owned'},search:{query:'space'},updateParticipants:{add:[]},getByConversation:{conversationId:'conversation-a'},findByParticipant:{participantId:'p'},getVersion:{version:1},getAtTimestamp:{timestamp:1000},exportContexts:{format:'json'}};
const selected=Object.entries({agents,memorySpaces,contexts}).flatMap(([module,values])=>Object.entries(values).filter(([name])=>!['computeStats','getStats'].includes(name)).map(([name,reg])=>({module,name,reg,path:module+':'+name})));
function args(entry){if(entry.name==='purgeAll')return {};const fields=JSON.parse(entry.reg.exportArgs()).value;return Object.fromEntries(Object.entries({...scope,agentId:'agent-a',contextId:'context-a',...(specific[entry.name]??{})}).filter(([k])=>Object.hasOwn(fields,k)));}
const marker='private-document-id-and-driver-payload-accessor-escape';
function accessorError(kind,field='code'){
 const error=kind==='message'?new Error('original opaque driver error'):new ConvexError({version:1,code:'FORBIDDEN',message:'Access denied',retryable:false,outcome:'not_dispatched'});
 const target=kind==='field'?error.data:error;
 const property=kind==='message'?'message':kind==='data'?'data':field;
 Object.defineProperty(target,property,{configurable:true,enumerable:true,get(){throw new Error(marker);}});
 return error;
}
const outcomes=[];
for(const entry of selected){
 const f=fixture();let reached=false;
 f.db.beforeRead=()=>{reached=true;throw accessorError('message');};
 let caught;try{await f.db.transaction(()=>invoke(entry.reg,f.ctx,args(entry)));}catch(e){caught=e;}
 assert.equal(reached,true);assert.equal(f.db.writes,0);assert(caught);assert.equal(caught.message,marker);assert.equal(caught instanceof ConvexError,false);
 outcomes.push({path:entry.path,seam:'initial driver read Error.message getter',reached,writes:f.db.writes,errorType:caught.constructor.name,errorMessage:caught.message,errorData:caught.data??null,structuredBoundary:false,privateOutputLeak:true});
}
for(const entry of selected.filter(e=>e.reg.isMutation===true)){
 const f=fixture();seedSpace(f);seedAgent(f);seedContext(f);if(entry.module==='memorySpaces'&&entry.name==='register')f.db.rows.set('memorySpaces',[]);
 let attempts=0;f.db.beforeWrite=()=>{attempts++;throw accessorError('message');};
 let caught;try{await f.db.transaction(()=>invoke(entry.reg,f.ctx,args(entry)));}catch(e){caught=e;}
 assert.equal(attempts,1);assert.equal(f.db.writes,0);assert(caught);assert.equal(caught.message,marker);assert.equal(caught instanceof ConvexError,false);
 outcomes.push({path:entry.path,seam:'actual first driver write Error.message getter',attempts,writes:f.db.writes,errorType:caught.constructor.name,errorMessage:caught.message,errorData:caught.data??null,structuredBoundary:false,privateOutputLeak:true});
}
for(const [module,reg,seed,callArgs] of [['agents',agents.update,seedAgent,{agentId:'agent-a',name:'New'}],['memorySpaces',memorySpaces.update,seedSpace,{name:'New'}],['contexts',contexts.update,seedContext,{contextId:'context-a',description:'New'}]]){
 for(const kind of ['data','field'])for(const stage of ['canonicalRead','firstWrite','postEffectReload']){
  const f=fixture();seed(f);let reached=false;let attempts=0;
  if(stage==='firstWrite')f.db.beforeWrite=()=>{reached=true;attempts++;throw accessorError(kind);};
  else f.db.beforeRead=(table)=>{if(table===module&&(stage==='canonicalRead'||f.db.writes>0)){reached=true;throw accessorError(kind);}};
  let caught;try{await f.db.transaction(()=>invoke(reg,f.ctx,{...scope,...callArgs}));}catch(e){caught=e;}
  assert.equal(reached,true);assert.equal(f.db.writes,0);assert(caught);assert.equal(caught.message,marker);assert.equal(caught instanceof ConvexError,false);
  outcomes.push({path:module+':update',seam:stage+' ConvexError.'+(kind==='data'?'data getter':'data.code getter'),reached,attempts,writes:f.db.writes,errorType:caught.constructor.name,errorMessage:caught.message,errorData:caught.data??null,structuredBoundary:false,privateOutputLeak:true});
 }
}
console.log(JSON.stringify({classification:'Synthetic hostile/accessor-bearing runtime exceptions at actual registered handlers; installed unique is ordinary Error and already covered by passing native probes. No live transport claim.',count:outcomes.length,outcomes},null,2));
