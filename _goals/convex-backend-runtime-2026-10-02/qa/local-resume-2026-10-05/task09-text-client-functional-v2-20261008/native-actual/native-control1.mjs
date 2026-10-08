import assert from 'node:assert/strict';
import {readFile,writeFile,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext,qa,denied} from './common.mjs';
const c=await openOwnedContext(),scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId};
const old=JSON.parse(await readFile(join(qa,'native2-calls.json'))).records.find(x=>x.label==='held-initial-tool-turn').result;
const {CortexRuntimeClient}=await import(pathToFileURL(join(c.host,'node_modules/@cortexmemory/sdk/dist/client-runtime/index.js')));
let jwt=c.token('cortex-owner');const client=new CortexRuntimeClient({deploymentUrl:c.handoff.url,scope,fetchToken:async()=>jwt}),outcomes=[];
const state=()=>c.admin.query('ingestionQualification:state',scope);
const counts=s=>({attempts:s.runtimeModelAttempts.length,operations:s.runtimeModelOperations.length,events:s.runtimeIngestionEvents.length,transcript:s.runtimeTranscriptMessages.length});
try{
 await c.verifyTarget('native-control1-target-verified');const before=await state();const handle=await client.attach(old.runId);
 const initial=await client.get(handle),initialObservation=await client.observe(handle,{finalOnly:true});assert.equal(initial.runId,old.runId);assert.equal(initialObservation.state,'unknown');
 jwt=c.token('cortex-owner');await client.refreshAuth();const fresh=await client.session(),after=await client.get(handle);assert.equal(fresh.principalId,handle.principalId);assert.equal(after.runId,initial.runId);assert.equal(after.definitionHash,initial.definitionHash);outcomes.push({name:'same-scope current JWT refresh preserves exact pinned native run',status:'PASS',session:fresh,run:after});
 const errors=[];for(const http of [c.anonymous,c.foreign]){const e=await denied(()=>http.query('runtimeAgent:observe',{memorySpaceId:c.memorySpaceId,runId:handle.runId}));const error=c.publicError(e);assert.match(JSON.stringify(error),/UNAUTHENTICATED|FORBIDDEN/);errors.push(error);}outcomes.push({name:'no JWT and foreign identity cannot observe the existing run',status:'PASS',errors});
 jwt=c.token('foreign-user');await client.refreshAuth();const wrong=c.publicError(await denied(()=>client.get(handle)));assert.match(JSON.stringify(wrong),/FORBIDDEN|AUTHORITY_CHANGED|SCOPE|UNAUTHENTICATED/);outcomes.push({name:'changed-principal refresh cannot deliver the prior cached handle',status:'PASS',error:wrong});
 jwt=c.token('cortex-owner');await client.refreshAuth();assert.equal((await client.get(handle)).runId,handle.runId);
 const second=new CortexRuntimeClient({deploymentUrl:c.handoff.url,scope,fetchToken:async()=>c.token('cortex-owner')});try{const attached=await second.attach(handle.runId);assert.deepEqual(attached,handle);const observed=await second.observe(attached,{finalOnly:true});assert.deepEqual(observed,initialObservation);outcomes.push({name:'second native SDK observer attaches without submitting or starting another run',status:'PASS',state:observed.state,handle:attached});}finally{await second.close();}
 const actual=await c.owner.mutation('runtimeAgent:reconcile',{memorySpaceId:c.memorySpaceId,runId:handle.runId});assert.equal(actual.reconciled,false);outcomes.push({name:'unknown no-save model turn reconciliation does not invent output or paid retry',status:'PASS',result:actual});
 const afterState=await state();assert.deepEqual(counts(afterState),counts(before));
 for(const [name,subject] of [['task09-owner-refresh-jwt.txt','cortex-owner'],['task09-foreign-jwt.txt','foreign-user']]){const p=join(c.handoff.privateDirectory,name);await writeFile(p,c.token(subject),{mode:0o600});await chmod(p,0o600);}
 await c.publish('native-control1',{status:'PASS',outcomes,before:counts(before),after:counts(afterState),noNewModelCalls:true,exactUnknownInitialPreserved:true});await c.publish('native-control1-state',afterState);console.log(JSON.stringify({status:'PASS',outcomes:outcomes.length,counts:counts(afterState)}));
}catch(error){await c.publish('native-control1-failure',{outcomes,error:c.publicError(error)});throw error;}
finally{const errors=[];try{await client.close();}catch(error){errors.push(c.publicError(error));}try{await c.close();}catch(error){errors.push(c.publicError(error));}await c.publish('native-control1-cleanup',{clientsClosed:true,errors});if(errors.length)throw new AggregateError(errors,'Task09 control cleanup');}
