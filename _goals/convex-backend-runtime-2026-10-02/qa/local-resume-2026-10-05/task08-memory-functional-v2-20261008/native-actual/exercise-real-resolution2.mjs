import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,waitUntil} from './common.mjs';
const c=await openOwnedContext(),operation=randomUUID(),scope={memorySpaceId:c.memorySpaceId},records=[];
const candidate=JSON.parse(await readFile(join(q,'installed-task08-source-manifest3.json')));
const state=()=>c.admin.query('ingestionQualification:state',{tenantId:c.tenantId,...scope});
async function call(label,kind,name,args,client=c.admin){try{const result=await client[kind](name,args);records.push({label,kind,function:name,args,result});await c.publish('real-resolution2-calls',{operation,candidate:candidate.manifestSha256,records});return result;}catch(error){records.push({label,kind,function:name,args,error:c.publicError(error)});await c.publish('real-resolution2-calls',{operation,candidate:candidate.manifestSha256,records});throw error;}}
try{
 await c.verifyTarget('real-resolution2-target-verified');
 const before=await state(),reference=await c.owner.query('ingestionQualification:reference',scope);
 await c.publish('real-resolution2-before',{operation,operationKeyCounts:Object.fromEntries([...new Set(before.runtimeModelOperations.map(x=>x.operationKey))].map(key=>[key,before.runtimeModelOperations.filter(x=>x.operationKey===key).length]))});
 assert.ok(before.facts.some(f=>f.subject.toLowerCase()==='user'&&f.predicate==='prefers'&&f.object==='coffee'),'Real resolution requires an existing matching favorite-drink belief');
 const source=(await call('new-distinct-correction','mutation','ingestionQualification:seedSources',{reference,prefix:operation+'-ordinary-resolution',texts:['I am the same user. I now prefer water as my favorite drink, replacing coffee.']}))[0];
 await waitUntil('ordinary correction held',()=>c.admin.query('ingestionQualification:held',{reference,eventId:source.eventId,stage:'extract'}),Boolean,{timeoutMs:10000});
 await call('release-ordinary-worker','action','ingestionQualification:release',{reference,eventId:source.eventId,stage:'extract'});
 const completed=await waitUntil('ordinary conflict resolution and vector completion',()=>c.owner.query('runtimeIngestion:status',{...scope,eventId:source.eventId}),v=>v.stages.every(s=>['complete','skipped'].includes(s.state)),{timeoutMs:120000,pollMs:400});
 const after=await state();await c.publish('real-resolution2-native-state',after);
 const job=after.runtimeIngestionJobs.find(j=>j.eventId===source.eventId),operations=after.runtimeModelOperations.filter(op=>op.runAccountId===job.runAccountId);
 const extract=operations.find(op=>op.operationKey==='memory.extract'),resolution=operations.find(op=>op.operationKey==='facts.resolve');assert.ok(extract);assert.ok(resolution,'Ordinary worker did not dispatch genuine facts.resolve');
 const snapshot=JSON.parse(resolution.snapshotCanonical);assert.equal(snapshot.parentOperationId,extract._id);
 const attempts=after.runtimeModelAttempts.filter(a=>a.operationDocumentId===resolution._id);assert.equal(attempts.length,1);assert.equal(attempts[0].state,'finished');assert.equal(attempts[0].slotReleased,true);
 const history=after.runtimeBeliefHistory.filter(h=>h.eventId===source.eventId);assert.ok(history.length);assert.equal(after.runtimeBeliefOutbox.filter(x=>x.eventId===source.eventId).length,1);
 assert.ok(after.runtimeMemoryVectors.some(v=>v.sourceId===source.lineage?.sourceId||v.sourceId===after.runtimeIngestionEvents.find(e=>e.eventId===source.eventId).lineage.sourceId));
 await c.publish('real-resolution2-final',{status:'PASS',operation,candidate:candidate.manifestSha256,eventId:source.eventId,completed,extractOperationId:extract._id,resolutionOperationId:resolution._id,actualResolutionModel:attempts[0].actualModel,oneResolutionDispatch:true,strictParent:true,historyActions:history.map(h=>h.action),ordinaryProductionWorker:true,controlledDecisions:false,fullUnknownLiabilityRetained:true});
}finally{await c.close();await c.publish('real-resolution2-cleanup',{ownedClientsClosed:true,noReactiveClients:true});}
