/** Public SOURCE/MOCK author control only. Every operator substituted, no case body runs. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';
const Q='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/task03-local-native-attempt6-2026-10-06';
const A=path.dirname(new URL(import.meta.url).pathname),ledger=JSON.parse(readFileSync(Q+'/path-ledger.json')),manifest=JSON.parse(readFileSync(Q+'/cases/metadata-worker-domain.json'));
let substitutions=0;
const ctx={run:'foundation-'+'0'.repeat(32),scopes:{tenantId:'SOURCE_TA',memorySpaceId:'SOURCE_SA',writerMemorySpaceId:'SOURCE_SW',foreignTenantId:'SOURCE_TB',foreignMemorySpaceId:'SOURCE_SB'},principals:Object.fromEntries(['reader','writer','foreign','revoked','deleted','admin'].map(x=>[x,'SOURCE_'+x])),operator:async(name,args)=>{assert.equal(name,'seed');assert.ok(args.rows.length<=320);substitutions++;return args.rows.map((r,i)=>({table:r.table,id:'SOURCE_ONLY_'+i}));},discoverOwnedEffects:async()=>{throw Error('No case body may run');}};
async function author(file){
 const source=readFileSync(Q+'/cases/'+file,'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'').replaceAll('import.meta.url',JSON.stringify('file://'+Q+'/cases/'+file));
 const sandbox=vm.createContext({assert,createHash,URL,readFileSync:url=>{const p=new URL(url).pathname;if(p===Q+'/path-ledger.json')return JSON.stringify(ledger);assert.equal(p,Q+'/cases/metadata-worker-domain.json');return JSON.stringify(manifest);},authDenial:()=>{throw Error('No assertion/case body may execute');},ctx});
 new vm.Script(source+'\n globalThis.authorPrepare=prepare;').runInContext(sandbox,{timeout:2000});return await sandbox.authorPrepare(ctx);
}
const suites=[await author('mf-registry-artifacts.mjs'),await author('metadata-worker-domain.mjs')],functional={};
for(const suite of suites)for(const c of suite.cases){assert.equal(Object.hasOwn(functional,c.id),false);functional[c.id]=c.paths??[c.path];}
assert.equal(Object.keys(functional).length,130);assert.equal(substitutions,1);
const negative={},negativeSnapshots={},visibility={},closure={},policy={},authority={},lifecycle={};
for(const row of ledger.cases){
 if(row.visibility==='public'){for(const alias of ['noJWT','forgedJWT','wrongIssuer','wrongAudience','expiredJWT','ungranted','foreign'])negative['negative:'+alias+':'+row.path]=[row.path];negativeSnapshots['negative-effects:'+row.path]=[row.path];}
 else for(const alias of ['noJWT','reader'])visibility['visibility:'+alias+':'+row.path]=[row.path];
 if(row.safeClosure)for(const mode of row.group==='stats'?['owned']:['owned','foreign','ownerless','missing'])closure['closure:'+mode+':'+row.path]=[row.path];
 if(row.group==='model-policy-delta')policy['policy-delta:no-effect:'+row.path]=[row.path];
}
const coverage=JSON.parse(readFileSync(Q+'/lifecycle-coverage.json'));
for(const id of coverage.requiredFoundationAuthorityCases)authority[id]=['mutable:get','mutable:set','runtimeAuth:revokeMembership','runtimeAuth:deleteScope'];
for(const {id}of coverage.requiredFoundationCases)lifecycle[id]=['mutable:get','mutable:set','runtimeAuth:revokeGrant'];
for(const [name,value,n]of [['negative',negative,1400],['negativeSnapshots',negativeSnapshots,200],['visibility',visibility,150],['closure',closure,262],['policy',policy,16],['authority',authority,8],['lifecycle',lifecycle,6]])assert.equal(Object.keys(value).length,n,name);
const result={scope:'PUBLIC_SOURCE_DERIVED_EXPECTATIONS_ONLY_NOT_ACTUAL_OUTCOMES',ledgerCases:ledger.cases,negative,negativeSnapshots,visibility,closure,functional,policy,authority,lifecycle,sourceMockOperatorSubstitutions:substitutions,actualDispatches:0,privateReads:0,actualNativeAcceptance:false};
writeFileSync(A+'/expected-native-cases.json',JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({scope:result.scope,functional:Object.keys(functional).length,negative:Object.keys(negative).length,actualDispatches:0}));
