import { readFile,writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname,join } from 'node:path';
const q=dirname(new URL(import.meta.url).pathname);
const authority=JSON.parse(await readFile(join(q,'authority.stdout')));
const reference=Object.fromEntries(['principalId','principalVersion','membershipId','membershipVersion','grantId','grantVersion','tenantId','tenantEpoch','memorySpaceId','memorySpaceEpoch'].map(k=>[k,authority[k]]));
const pointer=JSON.parse(await readFile(join(q,'fixture-pointer.json')));
await writeFile(join(q,'reference.json'),JSON.stringify(reference,null,2));
function call(label,fn,args){const r=spawnSync(process.execPath,[join(q,'run-fixture.mjs'),'run',label,fn,JSON.stringify(args)],{stdio:'inherit',timeout:130_000});if(r.status!==0)throw new Error(`Call failed: ${label}`);return JSON.parse(requireText(label));}
// All outputs are flushed before the owned child exit; reads contain no credentials.
import{readFileSync}from'node:fs';const requireText=label=>readFileSync(join(q,label+'.stdout'),'utf8');
const source=call('source','qualification:prepare',{reference});
const runId=pointer.operation+'-functional';
const chat=call('chat1','qualification:exercise',{reference,runId,mode:'chat'});
const parent=chat.after.operations.find(o=>o.operationKey==='agent.respond')?._id;
if(!parent)throw new Error('Default chat created no admitted parent operation');
call('chat-replay','qualification:exercise',{reference,runId,mode:'chat'});
call('title1','qualification:exercise',{reference,runId,mode:'title',parentOperationId:parent});
call('embedding1','qualification:exercise',{reference,runId,mode:'embedding'});
call('embedding-memory1','qualification:exercise',{reference,runId,mode:'embeddingMemory',source});
call('extract1','qualification:exercise',{reference,runId,mode:'extract',source});
call('final-state','qualification:state',{reference});
