import assert from 'node:assert/strict';
import {fixture,invoke,seedSpace,seedAgent,seedContext} from '/workspace/Project-Cortex/work/resume/registry/candidate/tests/unit/runtimeRegistryAuth/fixture.ts';
import * as agents from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/agents.ts';
import * as memorySpaces from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/memorySpaces.ts';
import * as contexts from '/workspace/Project-Cortex/work/resume/registry/candidate/convex-dev/contexts.ts';
const scope={tenantId:'tenant-a',memorySpaceId:'space-a'};
const specific={register:{agentId:'new-agent',name:'New',type:'personal'},update:{name:'Updated',description:'Updated',data:{b:true}},updateMany:{agentIds:['agent-a'],updates:{status:'completed'}},unregisterMany:{agentIds:['agent-a']},create:{purpose:'New'},addParticipant:{participant:{id:'p',type:'user',joinedAt:1000},participantId:'p'},removeParticipant:{participantId:'p'},grantAccess:{targetMemorySpaceId:'space-a',scope:'read-only'},deleteSpace:{cascade:true,reason:'owned'},search:{query:'space'},updateParticipants:{add:[]},getByConversation:{conversationId:'conversation-a'},findByParticipant:{participantId:'p'},getVersion:{version:1},getAtTimestamp:{timestamp:1000},exportContexts:{format:'json'}};
const outcomes=[];
for(const [module,values] of Object.entries({agents,memorySpaces,contexts}))for(const [name,reg] of Object.entries(values)){
 if(['computeStats','getStats','purgeAll'].includes(name))continue;
 const fields=JSON.parse(reg.exportArgs()).value;
 const args=Object.fromEntries(Object.entries({...scope,agentId:'agent-a',contextId:'context-a',...(specific[name]??{})}).filter(([k])=>Object.hasOwn(fields,k)));
 for(const scenario of ['forged-issuer-valid-subject','deleted-principal','revoked-membership','revoked-grant','tenant-epoch-change','actual-space-deleted']){
  const f=fixture();seedSpace(f);seedAgent(f);seedContext(f);
  if(scenario==='forged-issuer-valid-subject')f.ctx.auth.getUserIdentity=async()=>({issuer:'https://attacker.test',subject:'user-a'});
  if(scenario==='deleted-principal')f.principal.deletedAt=1000;
  if(scenario==='revoked-membership')f.membership.revokedAt=1000;
  if(scenario==='revoked-grant')f.grant.revokedAt=1000;
  if(scenario==='tenant-epoch-change')f.db.table('runtimeAuthScopes').find(r=>r.memorySpaceId===undefined).epoch=2;
  if(scenario==='actual-space-deleted')f.db.table('runtimeAuthScopes').find(r=>r.memorySpaceId==='space-a').deletedAt=1000;
  let error;try{await f.db.transaction(()=>invoke(reg,f.ctx,args));}catch(e){error=e;}
  assert.equal(error?.data?.code,'FORBIDDEN');assert.equal(f.db.writes,0);assert.equal(f.db.traces.filter(t=>['agents','memorySpaces','contexts','conversations'].includes(t.table)).length,0);
  outcomes.push({path:module+':'+name,scenario,code:error.data.code,writes:f.db.writes,domainHydration:0});
 }
}
assert.equal(outcomes.length,43*6);
console.log(JSON.stringify({count:outcomes.length,publicRegistrations:43,outcomes},null,2));
