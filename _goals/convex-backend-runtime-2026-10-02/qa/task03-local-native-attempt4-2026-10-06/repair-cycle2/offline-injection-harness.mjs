/** Evaluate ACTUAL operational modules with effect-blocked import/process boundaries.
 * No service, files outside QA, signing, process spawning or credentials are available. */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const q=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const run='foundation-'+'a'.repeat(32);
const emptyPolicy=['runtimeModelPolicies','runtimeModelQualifications','runtimeBudgetAccounts','runtimeModelOperations','runtimeModelAttempts'].map(table=>({table,count:0}));
export async function executeCleanup(source,scenario={}){
 const outputs=[],receipts=[],rpc=[];let mutations=0,storageCalls=0;
 const ledger={run,refs:[{table:'mutable',id:'OFFLINE_OWNED_ROW'}],files:[{slot:'owned',catalogId:'OFFLINE_OWNED_CATALOG',id:'OFFLINE_OWNED_STORAGE'}]};
 class Client{constructor(){}setAdminAuth(value){assert.equal(value,'OFFLINE_NONCREDENTIAL');}async mutation(path,args){rpc.push({kind:'mutation',path});assert.equal(args.run,run);if(path==='qualificationOwned:cleanupStorage'){storageCalls++;if(scenario.storageThrows||(scenario.storageVerificationThrows&&storageCalls>1))throw Error('INJECTED_STORAGE_FAILURE');return {deleted:scenario.storageRemains?true:storageCalls===1};}if(path==='qualificationOwned:cleanup'){mutations++;if(scenario.rowsCleanupThrows)throw Error('INJECTED_ROW_FAILURE');}assert.ok(['qualificationOwned:cleanupStorage','qualificationOwned:cleanup'].includes(path));return {deleted:true};}async query(path,args){rpc.push({kind:'query',path});assert.equal(args.run,run);if(path==='qualificationOwned:snapshot'){if(scenario.rowsSnapshotThrows)throw Error('INJECTED_SNAPSHOT_FAILURE');return [{table:'mutable',id:'OFFLINE_OWNED_ROW',row:scenario.rowsRemain?{}:null}];}assert.equal(path,'qualificationDelta:policySnapshot');if(scenario.policyThrows)throw Error('INJECTED_POLICY_FAILURE');return scenario.policy??emptyPolicy;}}
 const processBoundary={argv:['OFFLINE_NODE','cleanup.mjs',run],exitCode:undefined,stdout:{write:line=>outputs.push(line)}};
 const context=vm.createContext({process:processBoundary,URL,AbortSignal,console:{log(){throw Error('UNEXPECTED_LOG');}},globalThis:undefined});context.globalThis=context;context.fetch=()=>{throw Error('EFFECT_BLOCKED');};
 const imports={
  'convex/browser':{ConvexHttpClient:Client},'convex/server':{makeFunctionReference:path=>path},
  'node:fs':{readFileSync:path=>{assert.ok(path.endsWith('/owned-'+run+'.json'));return JSON.stringify(ledger);}},'node:path':{resolve},'node:crypto':{randomUUID:()=> 'offline-only'},
  './guard.mjs':{livePreflight:()=>({target:{deploymentUrl:'https://offline.invalid'},values:{CONVEX_DEPLOY_KEY:'OFFLINE_NONCREDENTIAL'}}),scratch:'/OFFLINE_PRIVATE_NOT_A_REAL_PATH',canonical:path=>path,appendRedactedReceipt:(name,value)=>receipts.push(JSON.parse(JSON.stringify(value)))}
 };
 const m=new vm.SourceTextModule(source,{context,identifier:'actual-cleanup.mjs'});await m.link(specifier=>{assert.ok(Object.hasOwn(imports,specifier),specifier);const values=imports[specifier];return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);},{context});});await m.evaluate({timeout:3000});assert.equal(outputs.length,1);return {exitCode:processBoundary.exitCode,output:JSON.parse(outputs[0]),receipts,rpc,mutations,externalEffects:0};
}
export async function executeDriver(source,scenario={}){
 const outputs=[],receipts=[],calls=[];const qualify=scenario.qualify??{code:1,timedOut:false,overflow:false,stdout:JSON.stringify({status:'FAIL',cleanupComplete:false}),stderr:''};const clean=scenario.clean??{code:0,timedOut:false,overflow:false,stdout:JSON.stringify({status:'PASS',cleanupComplete:true}),stderr:''};
 class Owner{records=new Set();spawned=0;verifiedGroups=0;async run(args){calls.push({entry:args[0].endsWith('cleanup.mjs')?'cleanup':'qualify'});this.spawned++;if(scenario.nonterminal)this.records.add('UNVERIFIED_OWNED_GROUP');else this.verifiedGroups++;return this.spawned===1?qualify:clean;}async reapAll(){if(scenario.reapThrows)throw Error('INJECTED_REAP_FAILURE');}}
 const processBoundary={env:{PATH:'OFFLINE'},execPath:'OFFLINE_NODE',exitCode:undefined,stdout:{write:line=>outputs.push(line)}};const context=vm.createContext({process:processBoundary,console:{log(){throw Error('UNEXPECTED_LOG');}}});
 const imports={'node:path':{resolve},'node:fs':{readdirSync:path=>{assert.equal(path,'/OFFLINE_PRIVATE_NOT_A_REAL_PATH');return ['owned-'+run+'.json'];}},'node:crypto':{randomUUID:()=> 'offline-only'},'./guard.mjs':{livePreflight:()=>({values:{CONVEX_DEPLOY_KEY:'OFFLINE_NONCREDENTIAL'},target:{}}),repo:'/OFFLINE_REPO',scratch:'/OFFLINE_PRIVATE_NOT_A_REAL_PATH',preparation:'/OFFLINE_QA',appendRedactedReceipt:(name,value)=>receipts.push(JSON.parse(JSON.stringify(value))),verifyCodegen:()=>'/OFFLINE_CODEGEN',safeProcessFailure:result=>result.code===0?'none':'injected_qualification_failure'},'./process-owner.mjs':{ProcessOwner:Owner},'./child-toolchain.mjs':{childToolchain:()=>({path:'/OFFLINE_REPO/node_modules/.bin:OFFLINE',home:'/OFFLINE_HOME'})}};
 const m=new vm.SourceTextModule(source,{context,identifier:'actual-driver.mjs'});await m.link(specifier=>{assert.ok(Object.hasOwn(imports,specifier),specifier);const values=imports[specifier];return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value] of Object.entries(values))this.setExport(key,value);},{context});});await m.evaluate({timeout:3000});assert.equal(outputs.length,1);return {exitCode:processBoundary.exitCode,output:JSON.parse(outputs[0]),receipts,calls,externalEffects:0};
}
if(process.argv[2]==='reproduce-original'){
 const cleanup=await executeCleanup(readFileSync(resolve(q,'repair-cycle2/preimages/scripts/cleanup.mjs'),'utf8'),{policyThrows:true});assert.equal(cleanup.exitCode,0);assert.deepEqual(cleanup.output,{status:'FAIL',cleanupComplete:true});
 const driver=await executeDriver(readFileSync(resolve(q,'repair-cycle2/preimages/scripts/driver.mjs'),'utf8'),{clean:{code:cleanup.exitCode,timedOut:false,overflow:false,stdout:JSON.stringify(cleanup.output),stderr:''}});assert.equal(driver.receipts[0].counts.cleanupRecoveryVerified,1);assert.equal(driver.output.status,'FAIL');
 console.log(JSON.stringify({phase:'FAILED_FIRST_CANDIDATE_ACTUAL_SOURCE_REPRODUCTION',cleanup,driver,defectConfirmed:true,serviceCalls:0,privateFilesRead:false}));
}
