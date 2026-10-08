import {readFile,readFileSync,writeFile} from 'node:fs';
import {spawn} from 'node:child_process';
import {dirname,join} from 'node:path';
const q=dirname(new URL(import.meta.url).pathname);
const authority=JSON.parse(readFileSync(join(q,'authority2.stdout'),'utf8'));
const reference=Object.fromEntries(['principalId','principalVersion','membershipId','membershipVersion','grantId','grantVersion','tenantId','tenantEpoch','memorySpaceId','memorySpaceEpoch'].map(k=>[k,authority[k]]));
const pointer=JSON.parse(readFileSync(join(q,'fixture-pointer.json'),'utf8'));
async function call(label,fn,args,allowedFailure=false){
  const c=spawn(process.execPath,[join(q,'run-fixture.mjs'),'run',label,fn,JSON.stringify(args)],{stdio:'inherit'});
  const exit=await new Promise((resolve,reject)=>{c.once('error',reject);c.once('close',resolve);});
  if(exit!==0){if(allowedFailure)return{childExit:exit};throw new Error(`Call failed: ${label}`);}
  return JSON.parse(readFileSync(join(q,label+'.stdout'),'utf8'));
}
const source=await call('source2','qualification:prepare',{reference});const runId=pointer.operation+'-repair2';
const chat=await call('chat2','qualification:exercise',{reference,runId,mode:'chat'});
const parent=chat.after.operations.find(o=>o.operationKey==='agent.respond')?._id;
if(!parent)throw new Error('Default chat produced no admitted parent');
await call('chat-replay2','qualification:exercise',{reference,runId,mode:'chat'});
await call('title2','qualification:exercise',{reference,runId,mode:'title',parentOperationId:parent});
await call('embedding2','qualification:exercise',{reference,runId,mode:'embedding'});
await call('embedding-replay2','qualification:exercise',{reference,runId,mode:'embedding'});
await call('embedding-memory2','qualification:exercise',{reference,runId,mode:'embeddingMemory',source});
await call('extract2','qualification:exercise',{reference,runId,mode:'extract',source});
await call('unknown-cost2','qualification:exercise',{reference,runId,mode:'unknown'});
await call('unknown-replay-denied2','qualification:exercise',{reference,runId,mode:'unknown'});
// Hosted Convex OCC/ownership race: same semantic request cannot dispatch twice.
await Promise.all(['a','b'].map(label=>call('dedup-'+label,'qualification:exercise',{reference,runId:runId+'-dedup',mode:'chat'})));
// Three separately billed identities contend for the same concurrency=2 capacity.
await Promise.all(['a','b','c'].map(label=>call('concurrency-'+label,'qualification:exercise',{reference,runId:runId+'-concurrency',mode:'chat',semanticId:'race-'+label})));
await call('state-before-quota','qualification:state',{reference});
await call('exhaust','qualification:exhaust',{reference});
await call('quota-denied','qualification:exercise',{reference,runId,mode:'chat',semanticId:'after-exhaust'});
await call('final-state2','qualification:state',{reference});
