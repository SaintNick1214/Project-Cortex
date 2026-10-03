import {it,expect} from '@jest/globals';
import {computeStats} from '../../../convex-dev/agents';
import {getStats} from '../../../convex-dev/memorySpaces';
import {fixture,invoke,seedAgent,seedSpace} from '../../../tests/unit/runtimeRegistryAuth/fixture';
const calls=[{registration:computeStats,args:{tenantId:'tenant-a',memorySpaceId:'space-a',agentId:'agent-a'},table:'agents'}, {registration:getStats,args:{tenantId:'tenant-a',memorySpaceId:'space-a'},table:'memorySpaces'}];
for(const c of calls){
 it(c.table+' private presence differential, bytes/getters and effect lookups',async()=>{
  const results:unknown[]=[];
  for(const mode of ['absent','foreign','ownerless','owned','deleted']){
   const f=fixture();seedAgent(f);seedSpace(f);let touched=0;let effects=0;
   for(const t of ['memories','facts','conversations','runtimeMemorySources']) if(mode!=='absent'){
    const row=f.db.seed(t,{tenantId:'tenant-a',memorySpaceId:'space-a',ownerPrincipalId:mode==='foreign'?'foreign':mode==='ownerless'?undefined:f.principal._id,...(mode==='deleted'?{tombstonedAt:123}:{}),sourceBytes:new ArrayBuffer(8)});
    Object.defineProperty(row,'private',{get(){touched++;throw new Error('PRIVATE SECRET');}});
   }
   const query=f.db.query.bind(f.db);f.db.query=((table:string)=>{if(['memories','facts','conversations','runtimeMemorySources'].includes(table)){touched++;throw new Error('PRIVATE QUERY');}return query(table);}) as typeof f.db.query;
   for(const key of ['storage','scheduler','runQuery','runMutation','runAction','fetch','mintToken'])Object.defineProperty(f.ctx,key,{get(){effects++;throw new Error('EFFECT LOOKUP');}});
   let result:unknown;try{await invoke(c.registration,f.ctx,c.args);throw new Error('unexpected success');}catch(e){result=(e as {data:unknown}).data;}
   expect(result).toEqual({version:1,code:'CAPABILITY_NOT_READY',message:'Access denied or invalid registry input',retryable:false,outcome:'not_dispatched'});
   expect(touched).toBe(0);expect(effects).toBe(0);expect(f.db.writes).toBe(0);results.push(result);
  }
  for(const r of results)expect(r).toEqual(results[0]);
 });
 it(c.table+' READ-only retains original admin requirement',async()=>{
  const f=fixture(['read']);seedAgent(f);seedSpace(f);
  await expect(invoke(c.registration,f.ctx,c.args)).rejects.toMatchObject({data:{code:c.table==='agents'?'FORBIDDEN':'CAPABILITY_NOT_READY'}});
 });
 it(c.table+' missing canonical target and late deletion deny',async()=>{
  const missing=fixture();await expect(invoke(c.registration,missing.ctx,c.args)).rejects.toMatchObject({data:{code:'FORBIDDEN'}});
  for(const change of ['scope','target','principal','membership']){
   const f=fixture();seedAgent(f);seedSpace(f);let reads=0;
   f.db.beforeRead=t=>{if(t===c.table&&++reads===2){if(change==='target')f.db.table(c.table)[0].tombstonedAt=123;else if(change==='scope')f.db.table('runtimeAuthScopes').find(r=>r.memorySpaceId==='space-a')!.deletedAt=123;else if(change==='principal')f.principal.deletedAt=123;else f.membership.revokedAt=123;}};
   await expect(invoke(c.registration,f.ctx,c.args)).rejects.toMatchObject({data:{code:'FORBIDDEN'}});expect(reads).toBeGreaterThanOrEqual(2);
  }
 });
 it(c.table+' opaque native control failures',async()=>{
  for(const t of ['runtimeAuthPrincipals','runtimeAuthMemberships','runtimeAuthGrants','runtimeAuthScopes','runtimeAuthTombstones']){
   const f=fixture();seedAgent(f);seedSpace(f);let getters=0;const fault=Object.defineProperty(new Error('PRIVATE SECRET'),'data',{get(){getters++;throw new Error('PRIVATE GETTER');}});
   f.db.beforeRead=table=>{if(table===t)throw fault;};
   await expect(invoke(c.registration,f.ctx,c.args)).rejects.toMatchObject({data:{code:'REGISTRY_OPERATION_FAILED',message:'Registry operation failed',outcome:'failed'}});expect(getters).toBe(0);
  }
 });
}
