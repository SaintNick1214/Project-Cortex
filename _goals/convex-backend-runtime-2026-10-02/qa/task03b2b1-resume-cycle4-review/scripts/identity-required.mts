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
function expectedError(code='REGISTRY_OPERATION_FAILED',outcome='failed'){return {version:1,code,message:code==='REGISTRY_OPERATION_FAILED'?'Registry operation failed':'Access denied or invalid registry input',retryable:false,outcome};}
for(const entry of [...edits.map(e=>({...e,stage:'initial'})),...edits.map(e=>({...e,stage:'optionalRead'})),...creates.map(e=>({...e,stage:'postInsert'}))])for(const [code,message] of envelopes){
 const f=fixture();if(entry.seed)entry.seed(f);if(entry.stage==='postInsert'&&entry.table==='contexts')seedSpace(f);
 const before=snapshot([...f.db.rows]);let identityCalls=0,reached=false,attempts=0;f.db.beforeWrite=()=>attempts++;
 f.ctx.auth.getUserIdentity=async()=>{
  identityCalls++;
  if(entry.stage==='initial'||entry.stage==='optionalRead'&&identityCalls===entry.nth||entry.stage==='postInsert'&&f.db.writes>0){
   reached=true;throw new ConvexError({version:1,code,message,retryable:false,outcome:'not_dispatched'});
  }
  return {issuer:'https://host.test',subject:'user-a'};
 };
 let result,error;try{result=await f.db.transaction(()=>invoke(entry.reg,f.ctx,{...scope,...entry.args}));}catch(e){error=e;}
 assert(reached);assert.equal(attempts,entry.stage==='postInsert'?1:0);
 const expected=expectedError('REGISTRY_OPERATION_FAILED',entry.stage==='postInsert'?'rolled_back':'failed');
 let failure=null;
 try{assert(error instanceof ConvexError);assert.deepEqual(error.data,expected);assert.equal(f.db.writes,0);assert.equal(snapshot([...f.db.rows]),before);}catch(e){failure=e.message;}
 observations.push({table:entry.table,stage:entry.stage,injectedCode:code,reached,identityCalls,attempts,commits:f.db.writes,result:result??null,actualErrorData:error?.data??null,expectedErrorData:expected,requiredOutcomeSatisfied:!failure,assertionFailure:failure});
}
assert.equal(observations.length,36);
const mismatches=observations.filter(x=>!x.requiredOutcomeSatisfied);
console.log(JSON.stringify({count:36,reached:observations.filter(x=>x.reached).length,mismatches:mismatches.length,committedReceipts:observations.filter(x=>x.commits>0&&!x.actualErrorData).length,observations},null,2));
assert.equal(mismatches.length,0,'Identity adapter failures must remain infrastructure failures and never turn into successful receipts');
