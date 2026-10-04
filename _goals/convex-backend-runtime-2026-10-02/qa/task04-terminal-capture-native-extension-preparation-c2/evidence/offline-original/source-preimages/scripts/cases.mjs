/** Complete actual-native extension cases. Only parent-reviewed session can invoke these. */
import assert from 'node:assert/strict';
import {root,scratch,json,sha256,qualifierDeadline} from './guard.mjs';
import {resolve} from 'node:path';
import {peer} from './peer.mjs';
import {healthyWindow} from './window-evidence.mjs';
export {canonical,request} from './original-b-cases.mjs';
import {canonical,request} from './original-b-cases.mjs';
export const definitions=['equal-refinements','conflicting-refinements','revoked-live-origin','initial-duplicates','final-lost-response','parent-refinement-rollback','released-slot','late-original-window','facts-add-absent','facts-change-remove','unknown-intermediate','malformed-private-raw','no-checkpoint','closed-renew-ordinary','admin-compatibility','operator-compatibility','partial-marker','legacy-preserve','healthy-known-attach','attachment-current-fences','internal-publication','peer-no-replay'].map(id=>[id,id]);
export async function scenario(s,id,kind){
 const snapshot=()=>s.rpc('query','qualificationOwned:snapshot',{run:s.runId});
 const call=(name,args)=>s.rpc('mutation','runtimeModelPolicy:'+name,args);
 const same=(a,b)=>assert.equal(canonical(b),canonical(a),'QA_ZERO_EFFECT');
 const deny=async action=>{const before=await snapshot();await assert.rejects(action,e=>Boolean(e?.data?.code));same(before,await snapshot());};
 const duplicate=async(action,expected)=>{const before=await snapshot();assert.deepEqual(await action(),expected);same(before,await snapshot());};
 const created=[];
 const setup=async(suffix='',checkpoint=true,source=false)=>{
  const caseId=id+(suffix?'-'+suffix:'');const seed=await s.rpc('mutation','qualificationOwned:seed',{run:s.runId,caseId,subject:s.runId+'-'+caseId});
  await call('installDeploymentPolicy',{manifestId:'qa-task04-synthetic-v1',expectedRevision:1});
  const b=await call('ensureBudget',{reference:seed.reference,operationKey:'agent.respond',requestId:caseId,requestCanonical:canonical({text:'hello'})});
  const a=await call('admit',{reference:seed.reference,operationKey:'agent.respond',runBudgetId:b.runBudgetId,semanticId:'semantic',ordinal:0,requestCanonical:canonical(request()),...(source?{source:seed.source}:{})});assert.equal(a.status,'reserved');
  if(checkpoint)await call('checkpoint',{reference:seed.reference,attemptId:a.attemptId,requestCanonical:a.requestCanonical});
  const all=await snapshot(),attempt=all.find(x=>x.id===a.attemptId).row;const ctx={...seed,b,a,attempt,caseId};created.push(ctx);return ctx;
 };
 const bound=async c=>{const all=await snapshot(),attempt=all.find(x=>x.id===c.a.attemptId)?.row;assert.ok(attempt);const operation=all.find(x=>x.id===attempt.operationDocumentId)?.row;assert.ok(operation);return{all,attempt,operation,accounts:[attempt.tenantAccountId,attempt.runAccountId].map(key=>{const row=all.find(x=>x.id===key)?.row;assert.ok(row);return row;})};};
 const receipt=(c,cost,extra={})=>{const model=JSON.parse(c.attempt.snapshotCanonical);return canonical({version:1,dispatchIdentity:c.attempt.dispatchIdentity,receiptId:'qa-terminal-'+c.caseId,modelId:model.modelId,nativeInterface:model.nativeInterface,outcome:'confirmed',proof:'provider-terminal-v1',costSource:cost===undefined?'unavailable':'gateway-aggregate-usd-v1',...(cost===undefined?{}:{aggregateCostUsd:cost}),...extra});};
 const capture=(c,encoded)=>call('captureTerminalEvidence',{attemptId:c.a.attemptId,dispatchIdentity:c.attempt.dispatchIdentity,receiptCanonical:encoded});
 const attach=(c,evidenceId,result=canonical({text:'answer'}))=>call('attachTerminalResult',{reference:c.reference,attemptId:c.a.attemptId,evidenceId,privateResultCanonical:result});
 const control=(c,name,extra={})=>s.rpc('mutation','qualificationCapture:'+name,{run:s.runId,reference:c.reference,attemptId:c.a.attemptId,...extra});
 const fault=(c,fault)=>s.rpc('mutation','qualificationOwned:change',{run:s.runId,reference:c.reference,attemptId:c.a.attemptId,operationId:c.a.operationId,fault});
 const immutable=(a,b)=>{for(const key of ['terminalEvidenceCanonical','terminalEvidenceHash','resultAttachmentState'])assert.equal(b[key],a[key]);};
 const money=(state,cost,unknown=0,slots=0)=>{for(const r of [...state.accounts,state.operation]){assert.equal(r.reservedUnits,0);assert.equal(r.uncertainUnits,unknown);assert.equal(r.settledUnits,cost);}for(const r of state.accounts)assert.equal(r.activeConcurrency,slots);assert.equal(state.attempt.slotReleased,slots===0);};
 const unknown=async(c,extra={})=>{const encoded=receipt(c,undefined,extra),result=await capture(c,encoded),state=await bound(c);assert.equal(result.state,'uncertain');assert.equal(state.attempt.resultAttachmentState,'closed');assert.equal(state.attempt.privateResultCanonical,undefined);money(state,0,100);return{encoded,result,state};};
 const refined=async(c,initial,cost)=>{const post=await bound(c);money(post,cost);immutable(initial.state.attempt,post.attempt);assert.equal(post.attempt.state,'settled');assert.equal(post.attempt.settledCostUnits,cost);assert.equal(post.attempt.privateResultCanonical,undefined);assert.equal(post.operation.overrun,cost>100);for(const [i,r]of post.accounts.entries()){const old=initial.state.accounts[i];for(const k of ['_id','accountKey','windowStart','windowEnd'])assert.equal(r[k],old[k]);assert.equal(r.overrun,cost>100);}return post;};
 if(kind==='internal-publication'){const i=json(resolve(root,'registration-inventory.json'));for(const name of ['captureTerminalEvidence','attachTerminalResult']){const row=s.publication.functions.find(x=>x.path==='runtimeModelPolicy:'+name);assert.ok(row);assert.equal(row.type,'mutation');assert.equal(row.visibility,'internal');const expected=i.registrations.find(x=>x.path===row.path);assert.equal(canonical(row.args),canonical(expected.args));}assert.ok(i.registrations.filter(x=>x.path.startsWith('qualificationCapture:')).every(x=>x.visibility==='internal'));return;}
 if(kind==='attachment-current-fences'){
  for(const [index,mode]of ['revokeOrigin','tenant-delete','space-delete','parent-cancel','source-delete'].entries()){
   const c=await setup(String(index),true,true),first=await capture(c,receipt(c,'0.000040'));assert.equal((await bound(c)).attempt.resultAttachmentState,'pending');
   if(mode==='revokeOrigin')await control(c,mode);else await fault(c,mode);
   const before=await bound(c);assert.deepEqual(await attach(c,first.evidenceId),{attached:false,resultWithheld:true});const after=await bound(c);same(before.accounts,after.accounts);same(before.operation,after.operation);assert.equal(after.attempt.resultAttachmentState,'closed');assert.equal(after.attempt.privateResultCanonical,undefined);assert.equal(after.attempt.outputVisible,false);await duplicate(()=>attach(c,first.evidenceId),{attached:false,resultWithheld:true});
  }return;
 }
 if(kind==='partial-marker'){
  for(const variant of ['hashOnly','stateOnly']){const c=await setup(variant);await s.rpc('mutation','qualificationCapture:partialMarker',{run:s.runId,attemptId:c.a.attemptId,variant});const encoded=receipt(c,'0.000040');for(const action of [()=>capture(c,encoded),()=>attach(c,'a'.repeat(64)),()=>call('settle',{reference:c.reference,attemptId:c.a.attemptId,receiptCanonical:encoded}),()=>call('recover',{reference:c.reference,attemptId:c.a.attemptId})])await deny(action);}return;
 }
 if(kind==='legacy-preserve'){
  for(const mode of ['known','unknown']){const c=await setup(mode),encoded=receipt(c,mode==='known'?'0.000040':undefined);await call('settle',{reference:c.reference,attemptId:c.a.attemptId,receiptCanonical:mode==='known'?receipt(c,'0.000040',{privateResultCanonical:canonical({text:'answer'})}):encoded});const before=await snapshot(),result=await capture(c,encoded);same(before,await snapshot());assert.deepEqual(await attach(c,result.evidenceId,canonical({text:'different'})),{attached:false,resultWithheld:true});same(before,await snapshot());const current=await bound(c);assert.equal(current.attempt.resultAttachmentState,undefined);assert.equal(current.attempt.privateResultCanonical,mode==='known'?canonical({text:'answer'}):undefined);await deny(()=>capture(c,receipt(c,mode==='known'?'0.000041':'0.000040')));}return;
 }
 const c=await setup('',kind!=='no-checkpoint',['healthy-known-attach'].includes(kind));
 if(kind==='no-checkpoint'){await deny(()=>capture(c,receipt(c,'0.000040')));const state=await bound(c);for(const r of [...state.accounts,state.operation]){assert.equal(r.reservedUnits,100);assert.equal(r.settledUnits,0);assert.equal(r.uncertainUnits,0);}for(const r of state.accounts)assert.equal(r.activeConcurrency,1);return;}
 if(kind==='malformed-private-raw'){
  const valid=receipt(c,'0.000040');for(const extra of [{privateResultCanonical:canonical({text:'secret'})},{rawProviderResponse:'secret'},{proof:'claimed'},{dispatchIdentity:'foreign'},{usage:{inputTokens:-1}}])await deny(()=>capture(c,canonical({...JSON.parse(valid),...extra})));for(const encoded of [' '+valid,'{','"'+'x'.repeat(180001)+'"'])await deny(()=>capture(c,encoded));const state=await bound(c);assert.equal(state.attempt.terminalEvidenceHash,undefined);for(const r of state.accounts){assert.equal(r.reservedUnits,100);assert.equal(r.activeConcurrency,1);}return;
 }
 if(kind==='healthy-known-attach'){
  const encoded=receipt(c,'0.000040'),first=await capture(c,encoded),before=await bound(c);money(before,40);assert.equal(before.attempt.resultAttachmentState,'pending');assert.deepEqual(await attach(c,first.evidenceId),{attached:true,resultWithheld:false});const after=await bound(c);same(before.accounts,after.accounts);same(before.operation,after.operation);assert.equal(after.attempt.resultAttachmentState,'attached');assert.equal(after.attempt.privateResultCanonical,canonical({text:'answer'}));assert.equal(after.attempt.outputVisible,true);await duplicate(()=>attach(c,first.evidenceId),{attached:true,resultWithheld:false});await deny(()=>attach(c,first.evidenceId,canonical({text:'changed'})));await duplicate(()=>capture(c,encoded),first);await control(c,'revokeOrigin');await duplicate(()=>attach(c,first.evidenceId),{attached:false,resultWithheld:true});return;
 }
 const facts=kind==='facts-change-remove'?{actualModel:JSON.parse(c.attempt.snapshotCanonical).modelId,usage:{inputTokens:15}}:{};
 const initial=await unknown(c,facts);let final=receipt(c,'0.000150',facts);
 if(kind==='facts-add-absent')final=receipt(c,'0.000150',{actualModel:JSON.parse(c.attempt.snapshotCanonical).modelId,usage:{inputTokens:15,outputTokens:20}});
 if(kind==='facts-change-remove'){for(const changed of [{usage:{inputTokens:14},actualModel:facts.actualModel},{actualModel:facts.actualModel},{usage:{inputTokens:15}},{usage:{inputTokens:15},actualModel:'foreign/model'},{...facts,receiptId:'different'}])await deny(()=>capture(c,receipt(c,'0.000150',changed)));return;}
 if(kind==='unknown-intermediate'){await deny(()=>capture(c,receipt(c,undefined,{usage:{inputTokens:15}})));return;}
 if(kind==='revoked-live-origin'){await control(c,'revokeOrigin');const live=await snapshot();assert.equal(live.filter(x=>x.table==='runtimeAuthTombstones'&&x.row.tenantId===c.reference.tenantId).length,0);assert.equal(live.filter(x=>x.table==='runtimeAuthScopes'&&x.row.tenantId===c.reference.tenantId&&x.row.deletedAt===undefined).length,2);assert.equal(live.find(x=>x.id===c.reference.grantId).row.revokedAt!==undefined,true);}
 if(kind==='parent-refinement-rollback'){const before=await snapshot();await assert.rejects(()=>s.rpc('mutation','qualificationCapture:parentRefinementRollback',{run:s.runId,attemptId:c.a.attemptId,dispatchIdentity:c.attempt.dispatchIdentity,receiptCanonical:final}),e=>e?.data?.code==='QA_ROLLBACK');same(before,await snapshot());money(await bound(c),0,100);return;}
 if(kind==='initial-duplicates')await duplicate(()=>capture(c,initial.encoded),initial.result);
 if(kind==='late-original-window'){
  const start=Date.now();healthyWindow(initial.state.all,c.reference,c.b.runBudgetId,{startMs:start,endMs:Date.now()});const originalEnd=Math.max(...initial.state.accounts.map(x=>x.windowEnd));let waits=0;
  while(Date.now()<=originalEnd+1000){if(++waits>248||Date.now()>=qualifierDeadline())throw Error('QA_TOTAL_TIME_BUDGET');await new Promise(done=>setTimeout(done,250));}
  await call('ensureBudget',{reference:c.reference,operationKey:'agent.respond',requestId:'late-current',requestCanonical:canonical({text:'current'})});
 }
 if(kind==='peer-no-replay'){const config=json(resolve(scratch,'peer-config.json'),scratch,true);assert.equal(config.operation,s.target.operation);assert.deepEqual(await peer(s,c.attempt.dispatchIdentity,config.peerSecret),{requestCount:1,effectCount:1});}
 let result;
 if(kind==='equal-refinements'){const pair=await Promise.all([capture(c,final),capture(c,final)]);assert.deepEqual(pair[0],pair[1]);result=pair[0];}
 else if(kind==='conflicting-refinements'){const other=receipt(c,'0.000151'),pair=await Promise.allSettled([capture(c,final),capture(c,other)]),wins=pair.filter(x=>x.status==='fulfilled'),losses=pair.filter(x=>x.status==='rejected');assert.equal(wins.length,1);assert.equal(losses.length,1);assert.ok(losses[0].reason?.data?.code);result=wins[0].value;await deny(()=>capture(c,result.settledCostUnits===150?other:final));}
 else if(['closed-renew-ordinary','admin-compatibility','operator-compatibility'].includes(kind)){
  const route=kind==='closed-renew-ordinary'?'settle':kind==='admin-compatibility'?'recover':'reconcileDeploymentLiability';
  if(kind==='closed-renew-ordinary'){await control(c,'revokeOrigin');await control(c,'renewOrigin');}
  const args={attemptId:c.a.attemptId,receiptCanonical:receipt(c,'0.000150',{privateResultCanonical:canonical({text:'secret'})}),...(route==='reconcileDeploymentLiability'?{}:{reference:kind==='admin-compatibility'?c.adminReference:c.reference})};
  if(route==='reconcileDeploymentLiability'){await deny(()=>call(route,args));await fault(c,'tenant-delete');}
  if(route==='recover')await deny(()=>call(route,{...args,reference:{...c.reference,grantVersion:c.reference.grantVersion+1}}));
  const settled=await call(route,args);assert.equal(settled.resultWithheld,true);result={...initial.result,state:'settled',settledCostUnits:150,overrun:true};await duplicate(()=>capture(c,initial.encoded),result);await duplicate(()=>call(route,args),settled);await deny(()=>call(route,{...args,receiptCanonical:receipt(c,'0.000151')}));await duplicate(()=>attach(c,initial.result.evidenceId),{attached:false,resultWithheld:true});
 }else result=await capture(c,final);
 assert.equal(result.evidenceId,initial.result.evidenceId);const post=await refined(c,initial,result.settledCostUnits);assert.equal(post.attempt.receiptCanonical,kind==='facts-add-absent'?final:receipt(c,result.settledCostUnits===151?'0.000151':'0.000150',facts));
 if(kind==='initial-duplicates')await duplicate(()=>capture(c,initial.encoded),result);
 if(['final-lost-response','released-slot','peer-no-replay'].includes(kind)){await duplicate(()=>capture(c,final),result);await duplicate(()=>capture(c,initial.encoded),result);}
 if(kind==='late-original-window'){const newer=post.all.filter(x=>x.table==='runtimeBudgetAccounts'&&x.row.tenantId===c.reference.tenantId&&![...initial.state.accounts.map(x=>x._id)].includes(x.id));assert.ok(newer.length>=2);for(const {row}of newer){assert.equal(row.settledUnits,0);assert.equal(row.uncertainUnits,0);assert.equal(row.reservedUnits,0);}}
 if(kind==='peer-no-replay'){assert.deepEqual(await s.rpc('query','qualificationPeer:counter',{run:s.runId,dispatchDigest:sha256(c.attempt.dispatchIdentity)}),{requestCount:1,effectCount:1});}
}
