import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { authDenial } from '../scripts/native-engine.mjs';

export const family = 'mf-registry-artifacts';
const ledger = JSON.parse(readFileSync(new URL('../path-ledger.json', import.meta.url)));
export const registeredPaths = ledger.cases.filter(c => ['memories','facts','agents','memorySpaces','contexts','artifacts'].includes(c.path.split(':')[0])).map(c => c.path);
const hash = value => createHash('sha256').update(value).digest('hex');
const denial = authDenial;
const mfMissing = code => (result,error) => { assert.equal(result,undefined); assert.ok(error); assert.equal(error.data,code); };
const staleEnvelope = Object.freeze({version:1,code:'STALE_SOURCE',message:'Source is missing, corrupt, stale or deleted',retryable:false,outcome:'not_dispatched'});
const stale = (result,error) => { assert.equal(result,undefined); assert.ok(error); assert.deepEqual(error.data,staleEnvelope); };

export function offlineDenialControls() {
  const forbidden={version:1,code:'FORBIDDEN',message:'Access denied',retryable:false,outcome:'not_dispatched'};
  denial(undefined,{data:forbidden}); stale(undefined,{data:staleEnvelope});
  const malformed=[{code:'FORBIDDEN'},'FORBIDDEN',{...forbidden,message:'private diagnostic'},{...forbidden,private:'secret'},{...forbidden,version:2},{...forbidden,retryable:true}];
  for(const data of malformed) assert.throws(()=>denial(undefined,{data}));
  for(const data of [{code:'STALE_SOURCE'},{...staleEnvelope,message:'private diagnostic'},{...staleEnvelope,private:'secret'},{...staleEnvelope,outcome:'failed'}]) assert.throws(()=>stale(undefined,{data}));
  return {scope:'OFFLINE_DENIAL_ASSERTIONS',positiveControls:2,malformedRejected:malformed.length+4,serviceCalls:0};
}
const hidden = (result, error) => { if (error) denial(result,error); else assert.equal(result,null); };
const success = (result,error) => { assert.equal(error,undefined); assert.ok(result && typeof result === 'object'); };

/** Authoring only: service/operator dispatch belongs to the reviewed parent driver. */
export async function prepare(ctx) {
  assert.match(ctx.run,/^foundation-[a-f0-9]{32}$/);
  const p = ctx.run + ':'; const now = Date.now(); const s = ctx.scopes; const refs = []; const cases = []; const rows = [];
  const add = (id,path,identity,args,check,effects='unchanged') => {
    assert.ok(registeredPaths.includes(path),`Unregistered ${path}`);
    cases.push({id:`${family}:${id}`,path,identity,args,assert:check,effects,refs});
  };
  const common = (owner,scope=s) => ({tenantId:scope.tenantId,memorySpaceId:scope.memorySpaceId,...(owner ? {ownerPrincipalId:owner} : {}),createdAt:now,updatedAt:now});
  const rowFor = (table,id,owner,scope=s,extra={}) => {
    const c=common(owner,scope); const secret=p+'private-'+table+'-'+id;
    if(table==='memories'||table==='facts') {
      const resourceType=table==='memories'?'memory':'fact';
      const sourceId=`manual:${JSON.stringify([scope.tenantId,scope.memorySpaceId,resourceType,id])}`;
      const lineage={sourceId,sourceEventId:sourceId,sourceRevision:1,role:'user',trust:'user_assertion'};
      if(owner) rows.push({table:'runtimeMemorySources',value:{tenantId:scope.tenantId,memorySpaceId:scope.memorySpaceId,ownerPrincipalId:owner,lineage,content:secret,contentHash:hash(secret),createdAt:now}});
      const shared={...c,...(owner?{lineage,manualSourceBinding:{resourceType,resourceId:id}}:{}),tags:[],version:1};
      return table==='memories'? {...shared,memoryId:id,content:secret,contentType:'raw',sourceType:'system',sourceTimestamp:now,importance:50,accessCount:0,previousVersions:[],...extra}:
        {...shared,factId:id,fact:secret,factType:'preference',confidence:80,sourceType:'manual',extractionPolicyVersion:'manual-assertion-v1',...extra};
    }
    if(table==='agents') { const agent={...c}; delete agent.createdAt; return {...agent,agentId:id,name:secret,status:'active',metadata:{secret},config:{secret},registeredAt:now,...extra}; }
    if(table==='contexts') return {...c,contextId:id,rootId:id,purpose:secret,depth:0,childIds:[],status:'active',participants:[scope.memorySpaceId],grantedAccess:[],data:{secret},version:1,previousVersions:[],...extra};
    if(table==='memorySpaces') return {...c,type:'personal',name:secret,participants:[],metadata:{secret},status:'active',...extra};
    return {...c,artifactId:id,kind:'text',content:secret,title:secret,tags:[],streamingState:'final',version:2,versionPointer:2,versionHistory:[{version:1,content:p+'old-private-'+id,title:'Old',timestamp:now,changeType:'create'},{version:2,content:secret,title:secret,timestamp:now,changeType:'update'}],...extra};
  };
  const configurations = [
    ['memories','memoryId','get','update',{importance:51}],
    ['facts','factId','get','updateInPlace',{confidence:81}],
    ['agents','agentId','get','update',{name:p+'updated-agent'}],
    ['contexts','contextId','get','update',{description:p+'updated-context'}],
    ['artifacts','artifactId','get','update',{title:p+'updated-artifact'}],
  ];
  for(const [table,key,get,update,patch] of configurations) {
    for(const mode of ['owned','writeOnly','foreign','ownerless','crossTenant','crossSpace','tombstone','revoked','deleted']) {
      const id=p+table+'-'+mode; const identity=mode==='writeOnly'?'writer':mode==='revoked'||mode==='deleted'?mode:'reader';
      const owner=mode==='ownerless'?undefined:ctx.principals[mode==='foreign'?'foreign':identity];
      const scope=mode==='writeOnly'?{tenantId:s.tenantId,memorySpaceId:s.writerMemorySpaceId}:mode==='crossTenant'?{tenantId:s.foreignTenantId,memorySpaceId:s.memorySpaceId}:mode==='crossSpace'?{tenantId:s.tenantId,memorySpaceId:s.foreignMemorySpaceId}:s;
      const row=rowFor(table,id,owner,scope,mode==='tombstone'?{tombstonedAt:now}:{}); rows.push({table,value:row});
      const args={memorySpaceId:mode==='writeOnly'?s.writerMemorySpaceId:s.memorySpaceId,[key]:id}; if(!['memories','facts'].includes(table)) args.tenantId=s.tenantId;
      if(mode==='owned') {
        add(`${table}:owned-read`,`${table}:${get}`,'reader',args,(r,e)=>{success(r,e);assert.equal(r[key],id);assert.equal(r.ownerPrincipalId,owner);assert.equal(r[table==='facts'?'fact':table==='memories'?'content':table==='contexts'?'purpose':table==='agents'?'name':'content'],row[table==='facts'?'fact':table==='memories'?'content':table==='contexts'?'purpose':table==='agents'?'name':'content']);});
        add(`${table}:readable-write`,`${table}:${update}`,'reader',{...args,...patch},(r,e)=>{success(r,e);assert.equal(r[key],id);assert.equal(r.ownerPrincipalId,owner);for(const [field,value] of Object.entries(patch)) assert.deepEqual(r[field],value);},'tracked');
      } else if(mode==='writeOnly') {
        add(`${table}:write-only-no-read`,`${table}:${get}`,'writer',args,denial);
        add(`${table}:write-only-receipt`,`${table}:${update}`,'writer',{...args,...patch},(r,e)=>{
          success(r,e);
          assert.deepEqual(r,table==='memories'?{mutationReceipt:true,operation:'update',memoryId:id}:table==='facts'?{mutationReceipt:true,operation:'updateInPlace',factId:id}:table==='artifacts'?{success:true,artifactId:id}:{accepted:true,resourceType:table,resourceId:id});
        },'tracked');
      } else {
        const mf = table==='memories'||table==='facts';
        const missing = ['foreign','ownerless','crossTenant','crossSpace'].includes(mode);
        add(`${table}:${mode}-read`,`${table}:${get}`,identity,args,mf&&mode==='tombstone'?stale:hidden);
        add(`${table}:${mode}-write`,`${table}:${update}`,identity,{...args,...patch},mf&&missing?mfMissing(table==='memories'?'MEMORY_NOT_FOUND':'FACT_NOT_FOUND'):mf&&mode==='tombstone'?stale:denial);
      }
      if(table==='artifacts') add(`artifacts:${mode}-retained-version`,'artifacts:getVersion',identity,{...args,version:1},mode==='owned'?(r,e)=>{success(r,e);assert.equal(r.content,p+'old-private-'+id);}:mode==='writeOnly'?denial:hidden);
    }
  }
  for(const table of ['memories','facts']) {
    const key=table==='memories'?'memoryId':'factId';const args={memorySpaceId:s.memorySpaceId,[key]:p+table+'-absent'};
    add(`${table}:absent-read-control`,`${table}:get`,'reader',args,(r,e)=>{assert.equal(e,undefined);assert.equal(r,null);});
    add(`${table}:absent-write-control`,`${table}:${table==='memories'?'update':'updateInPlace'}`,'reader',{...args,...(table==='memories'?{importance:51}:{confidence:81})},mfMissing(table==='memories'?'MEMORY_NOT_FOUND':'FACT_NOT_FOUND'));
  }
  // A valid root with a foreign share target: same caller, valid native input, no graph edit.
  const shareId=p+'contexts-share-source'; rows.push({table:'contexts',value:rowFor('contexts',shareId,ctx.principals.reader)});
  rows.push({table:'memorySpaces',value:rowFor('memorySpaces',s.memorySpaceId,ctx.principals.reader)});
  rows.push({table:'memorySpaces',value:rowFor('memorySpaces',s.foreignMemorySpaceId,ctx.principals.foreign,{tenantId:s.tenantId,memorySpaceId:s.foreignMemorySpaceId})});
  add('contexts:foreign-share-target','contexts:grantAccess','reader',{tenantId:s.tenantId,memorySpaceId:s.memorySpaceId,contextId:shareId,targetMemorySpaceId:s.foreignMemorySpaceId,scope:'read-only'},denial);
  add('memorySpaces:owned-read','memorySpaces:get','reader',{tenantId:s.tenantId,memorySpaceId:s.memorySpaceId},(r,e)=>{success(r,e);assert.equal(r.ownerPrincipalId,ctx.principals.reader);assert.equal(r.memorySpaceId,s.memorySpaceId);});
  add('memorySpaces:foreign-read','memorySpaces:get','reader',{tenantId:s.tenantId,memorySpaceId:s.foreignMemorySpaceId},denial);
  add('memorySpaces:foreign-write','memorySpaces:update','reader',{tenantId:s.tenantId,memorySpaceId:s.foreignMemorySpaceId,name:p+'forbidden-change'},denial);
  if(s.writerMemorySpaceId) {
    rows.push({table:'memorySpaces',value:rowFor('memorySpaces',s.writerMemorySpaceId,ctx.principals.writer,{tenantId:s.tenantId,memorySpaceId:s.writerMemorySpaceId})});
    add('memorySpaces:write-only-no-read','memorySpaces:get','writer',{tenantId:s.tenantId,memorySpaceId:s.writerMemorySpaceId},denial);
    add('memorySpaces:write-only-receipt','memorySpaces:update','writer',{tenantId:s.tenantId,memorySpaceId:s.writerMemorySpaceId,name:p+'writer-space'},(r,e)=>{success(r,e);assert.deepEqual(r,{accepted:true,resourceType:'memorySpaces',resourceId:s.writerMemorySpaceId});},'tracked');
  }
  // Retained resource tombstones reject recreate attempts; use seeded fences so every ID is cleanup-owned.
  for(const [table,type,key,path] of [['artifacts','artifact','artifactId','artifacts:create'],['agents','context','agentId','agents:register']]) {
    if(table==='agents') continue; // Agents have no runtimeResourceType; their retained-row tombstone is covered above.
    const id=p+table+'-final-deleted'; rows.push({table:'runtimeAuthTombstones',value:{tenantId:s.tenantId,memorySpaceId:s.memorySpaceId,resourceType:type,resourceId:id,deletedAt:now}});
    add(`${table}:final-tombstone-recreate`,path,'reader',{tenantId:s.tenantId,memorySpaceId:s.memorySpaceId,[key]:id,content:p+'resurrection'},denial);
  }
  // Actual delete followed by later read/update: distinct service transactions, never an injected in-mutation race.
  for(const [table,key,get,update,patch] of configurations) {
    const id=p+table+'-owned'; const args={memorySpaceId:s.memorySpaceId,[key]:id};
    if(!['memories','facts'].includes(table)) args.tenantId=s.tenantId;
    const path={memories:'deleteMemory',facts:'deleteFact',agents:'unregister',contexts:'deleteContext',artifacts:'deleteArtifact'}[table];
    if(table==='contexts') continue; // Dedicated graph-cascade delete belongs to registry lifecycle coverage.
    add(`${table}:actual-delete`,`${table}:${path}`,'reader',args,async(r,e)=>{success(r,e);assert.equal(r.deleted,true);assert.equal(r[key],id);await ctx.discoverOwnedEffects();},'tracked');
    add(`${table}:later-read-after-delete`,`${table}:${get}`,'reader',args,denial);
    add(`${table}:later-write-after-delete`,`${table}:${update}`,'reader',{...args,...patch},denial);
  }
  const seeded=await ctx.operator('seed',{rows}); refs.push(...seeded);
  return {family,registeredPaths,cases,refs,gaps:['Actual delete requires discoverOwnedEffects and complete tracked-ref cleanup; neither is executed by this authoring check.','No actual interleaved single-mutation race is claimed.','Subscriptions/background/source-to-derived lifecycle remain parent or later-task gates.']};
}
