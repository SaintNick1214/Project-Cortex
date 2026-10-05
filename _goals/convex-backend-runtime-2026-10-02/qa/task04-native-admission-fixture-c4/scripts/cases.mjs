import assert from 'node:assert/strict';
export const definitions=[
 ['parent-distinct-child-fence','parent-cancel'],['root-idempotent','install'],['parent-native-rollback','rollback'],['identity-canonical','identity'],['checkpoint-race','checkpoint'],['money-run-race','run-race'],['money-tenant-race','tenant-race'],['slot-race','slots'],['known-settlement-race','known'],['unknown-running-terminal','unknown'],['known-overrun','overrun'],['collision-canonical','collision'],
 ...['grant-version','grant-expiry','principal-revoke','membership-revoke','source-edit','source-delete','policy-revoke','qualification-revoke','corrupt-counter'].map(x=>['fence-'+x,x]),
 ['retired-tenant-overrun','tenant-delete'],['retired-space-overrun','space-delete'],['retired-absence-denial','scope-absence'],['cancel-current','cancel'],['fallback-fresh-money','fallback-money'],['fallback-current-query-reserve','fallback-revoke'],['fallback-postreserve-revoke','fallback-postrevoke'],['fallback-postreserve-money','fallback-postmoney'],
 ...['operation','run','tenant','concurrency'].map(x=>['held-current-'+x,'held-'+x]),['held-exact-cap','held-positive'],['fallback-exact-cap','fallback-positive'],['visibility-monotone','visible'],['embedding-single-bound','embedding'],['agent-selector-denial','agent'],['window-original-liability','window'],['private-invalid-result','private'],['known-private-privacy','privacy'],['predispatch-compatible-fallback','fallback-no-dispatch'],['private-byte-exact-bound','private-bound'],
];
export function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';return JSON.stringify(value);}
export const request=(text='hello')=>({semanticId:'semantic',childCallId:'estimate',texts:[text],messages:[{role:'user',parts:[{type:'text',text}]}],inputTokens:1,outputTokens:20,toolSteps:0,timeoutMs:1000,reservationUnits:1,promptVersion:'qa-prompt-1',schemaVersion:'qa-schema-1',extractionVersion:'qa-extract-1',toolRegistryVersion:'qa-tools-1',tools:[],options:{maxRetries:0}});
export async function scenario(s,id,kind){const ctx=await s.rpc('mutation','qualificationOwned:seed',{run:s.runId,caseId:id,subject:s.runId+'-'+id});const ref=ctx.reference;
 const invoke=(name,args={})=>s.rpc(name==='resolve'||name==='checkFallback'?'query':'mutation','runtimeModelPolicy:'+name,args);
 const install=()=>invoke('installDeploymentPolicy',{manifestId:'qa-task04-synthetic-v1',expectedRevision:1});await install();
 const snapshot=()=>s.rpc('query','qualificationOwned:snapshot',{run:s.runId});
 const ledger=async()=>{const all=await snapshot();return all.filter(x=>['runtimeBudgetAccounts','runtimeModelOperations','runtimeModelAttempts','qaAdmissionPeerEffects'].includes(x.table));};
 const denial=async(action,code)=>{const before=canonical(await ledger());await assert.rejects(action,error=>{assert.ok(error?.data?.code);if(code)assert.equal(error.data.code,code);return true;});assert.equal(canonical(await ledger()),before);};
 const bind=async(name='request',extra={})=>invoke('ensureBudget',{reference:ref,operationKey:'agent.respond',requestId:name,requestCanonical:canonical({text:'hello'}),...extra});
 const admit=async(b,ordinal=0,text='hello',extra={})=>invoke('admit',{reference:ref,operationKey:'agent.respond',runBudgetId:b.runBudgetId,semanticId:'semantic',ordinal,requestCanonical:canonical(request(text)),...extra});
 const checkpoint=a=>invoke('checkpoint',{reference:ref,attemptId:a.attemptId,requestCanonical:a.requestCanonical});
 const attempt=async a=>(await snapshot()).find(x=>x.id===a.attemptId)?.row;
 const receipt=async(a,cost='0.000040',extra={})=>{const t=await attempt(a);return canonical({version:1,dispatchIdentity:t.dispatchIdentity,receiptId:'qa-terminal-'+id,modelId:JSON.parse(t.snapshotCanonical).modelId,nativeInterface:JSON.parse(t.snapshotCanonical).nativeInterface,outcome:'confirmed',proof:'provider-terminal-v1',costSource:'gateway-aggregate-usd-v1',aggregateCostUsd:cost,privateResultCanonical:canonical({text:'answer'}),...extra});};
 const settle=async(a,cost='0.000040',extra={})=>invoke('settle',{reference:ref,attemptId:a.attemptId,receiptCanonical:await receipt(a,cost,extra)});
 const change=(fault,a)=>s.rpc('mutation','qualificationOwned:change',{run:s.runId,reference:ref,fault,...(a?{operationId:a.operationId,attemptId:a.attemptId}:{})});
 const narrow=rules=>invoke('provisionTenantPolicy',{reference:ctx.adminReference,policyCanonical:canonical({policyId:'narrow-'+id,version:1,scope:'tenant',tenantId:ref.tenantId,rules})});
 const balance=async(expected)=>{const all=await snapshot();const accounts=all.filter(x=>x.table==='runtimeBudgetAccounts'&&x.row.tenantId===ref.tenantId);assert.ok(accounts.length>=2);for(const {row}of accounts)for(const [k,v]of Object.entries(expected))assert.equal(row[k],v);};
 if(kind==='install'){const before=canonical(await snapshot());await Promise.all([install(),install()]);assert.equal(canonical(await snapshot()),before);await denial(()=>invoke('installDeploymentPolicy',{manifestId:'forged',expectedRevision:1}));return;}
 if(kind==='rollback'){await denial(()=>s.rpc('mutation','qualificationOwned:parentRollback',{run:s.runId,reference:ref}),'QA_ROLLBACK');return;}
 if(kind==='agent'){const b=await bind('agent',{agentId:'qa-agent',agentVersion:7});const a=await admit(b);assert.equal((await invoke('resolve',{reference:ref,operationKey:'agent.respond',runBudgetId:b.runBudgetId})).snapshot.agent.version,7);await denial(()=>bind('wrong-agent',{agentId:'qa-agent',agentVersion:8}));await change('agent-policy-revoke',a);await denial(()=>checkpoint(a));return;}
 if(kind==='run-race'||kind==='tenant-race'||kind==='slots'){
  await narrow({limits:kind==='slots'?{concurrency:1}:kind==='run-race'?{operationBudgetUnits:100,runBudgetUnits:100}:{operationBudgetUnits:100,runBudgetUnits:100,tenantBudgetUnits:100}});
  const b=await bind(),second=kind==='tenant-race'?await bind('second-run'):b;
  const results=await Promise.allSettled([admit(b,0,'one',{semanticId:'one'}),admit(second,0,'two',{semanticId:'two'})]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected'&&x.reason.data?.code==='BUDGET_EXCEEDED').length,1);
  const accounts=(await snapshot()).filter(x=>x.table==='runtimeBudgetAccounts');assert.equal(accounts.find(x=>x.row.kind==='tenant').row.reservedUnits,100);assert.equal(accounts.find(x=>x.row.kind==='tenant').row.activeConcurrency,1);return;
 }
 if(kind==='embedding'){

  // Exact profile is supplied from the accepted schema evidence, no provider metadata inferred.
  const actual=s.profile;const b=await bind('embedding',{operationKey:'embedding.query'});const req={...request('é'),messages:undefined,texts:['é'],outputTokens:0,profile:actual,batch:{ordinal:0,start:0,end:1}};delete req.messages;
  const args={reference:ref,operationKey:'embedding.query',runBudgetId:b.runBudgetId,semanticId:'embed',ordinal:0,requestCanonical:canonical(req)};const a=await invoke('admit',args);assert.equal(JSON.parse(a.requestCanonical).inputTokens,2);await checkpoint(a);const result=await settle(a,'0.000040',{privateResultCanonical:canonical({profile:actual,vectors:[Array(1536).fill(0.125)]})});assert.equal(result.resultWithheld,false);assert.equal((await invoke('admit',args)).status,'replay');
  await denial(()=>invoke('admit',{...args,ordinal:1,semanticId:'bad-embed',requestCanonical:canonical({...req,texts:['one','two'],batch:{ordinal:1,start:0,end:2}})}));return;
 }
 const b=await bind(),a=await admit(b,0,'hello',['source-edit','source-delete','privacy'].includes(kind)?{source:ctx.source}:{});assert.equal(a.status,'reserved');
 if(kind==='identity'){assert.equal((await admit(b)).attemptId,a.attemptId);await denial(()=>admit(b,0,'changed'));return;}
 if(kind==='collision'){await change('identity-collision',a);await denial(()=>admit(b));return;}
 if(kind==='cancel'){await invoke('cancelBudget',{reference:ref,runBudgetId:b.runBudgetId});await denial(()=>checkpoint(a));return;}
 if(kind.startsWith('held-')){
  const mode=kind.slice(5),secondBinding=mode==='tenant'?await bind('second-run'):b;
  const other=await admit(secondBinding,1,'second',['run','tenant'].includes(mode)?{semanticId:'other'}:{});
  const caps=mode==='positive'?{operationBudgetUnits:200,runBudgetUnits:200,tenantBudgetUnits:200,concurrency:2}:mode==='operation'?{operationBudgetUnits:150}:mode==='run'?{operationBudgetUnits:150,runBudgetUnits:150}:mode==='tenant'?{operationBudgetUnits:150,runBudgetUnits:150,tenantBudgetUnits:150}:{concurrency:1};
  await narrow({limits:caps});if(mode==='positive'){assert.equal((await checkpoint(other)).dispatchPermit,true);}else await denial(()=>checkpoint(other),'BUDGET_EXCEEDED');
  assert.equal((await snapshot()).find(x=>x.table==='runtimeBudgetAccounts'&&x.row.kind==='tenant').row.reservedUnits,200);return;
 }
 if(kind==='fallback-no-dispatch'){await invoke('releaseNotDispatched',{reference:ref,attemptId:a.attemptId});const f=await invoke('admitFallback',{reference:ref,attemptId:a.attemptId,candidateModelId:'fixture/fallback'});assert.equal((await checkpoint(f)).dispatchPermit,true);await balance({reservedUnits:80,settledUnits:0,activeConcurrency:1});return;}
 if(kind==='private-bound'){await checkpoint(a);const result=await settle(a,'0.000040',{privateResultCanonical:canonical({text:'x'.repeat(59989)})});assert.equal(result.resultWithheld,false);const second=await admit(b,1,'second');await checkpoint(second);const overflow=await settle(second,'0.000040',{privateResultCanonical:canonical({text:'x'.repeat(59990)})});assert.equal(overflow.resultWithheld,true);assert.equal((await attempt(second)).privateResultCanonical,undefined);return;}
 if(kind.startsWith('fallback-')){
  await checkpoint(a);await settle(a,'0.000040',{outcome:'confirmed_rejected',privateResultCanonical:''});const args={reference:ref,attemptId:a.attemptId,candidateModelId:'fixture/fallback'};
  if(kind==='fallback-postrevoke'||kind==='fallback-postmoney'){const f=await invoke('admitFallback',args);await narrow(kind==='fallback-postrevoke'?{fallbackModels:[]}:{limits:{operationBudgetUnits:100}});await denial(()=>checkpoint(f));await balance({reservedUnits:80,settledUnits:40});return;}
  await narrow(kind==='fallback-revoke'?{fallbackModels:[]}:{limits:{operationBudgetUnits:kind==='fallback-positive'?120:100}});
  const eligible=await invoke('checkFallback',args);if(kind==='fallback-revoke')assert.equal(eligible.allowed,false);
  if(kind==='fallback-positive'){assert.equal(eligible.allowed,true);const f=await invoke('admitFallback',args);assert.equal((await checkpoint(f)).dispatchPermit,true);await balance({reservedUnits:80,settledUnits:40});}
  else await denial(()=>invoke('admitFallback',args));return;
 }
 if(kind==='parent-cancel'){const child=await admit(b,1,'child',{semanticId:'child',parentOperationId:a.operationId});await change('parent-cancel',a);await denial(()=>checkpoint(child));return;}
 if(['grant-version','grant-expiry','principal-revoke','membership-revoke','source-edit','source-delete','policy-revoke','qualification-revoke','corrupt-counter'].includes(kind)){
  await change(kind,a);await denial(()=>checkpoint(a));return;
 }
 if(kind==='window'){
  // Observe actual backend window, never alter a clock/account timestamp.
  const account=(await snapshot()).find(x=>x.table==='runtimeBudgetAccounts'&&x.row.kind==='run').row;
  const remaining=account.windowEnd-Date.now();if(remaining>30000)throw Error('QA_WINDOW_START_OUTSIDE_BOUND');await checkpoint(a);await invoke('recover',{reference:ref,attemptId:a.attemptId});
  const deadline=Date.now()+30000;while(Date.now()<account.windowEnd&&Date.now()<deadline)await new Promise(done=>setTimeout(done,250));
  assert.ok(Date.now()>=account.windowEnd);await denial(()=>bind('successor'),'BUDGET_EXCEEDED');await settle(a);const receiptValue=await receipt(a);await invoke('settle',{reference:ref,attemptId:a.attemptId,receiptCanonical:receiptValue});await balance({reservedUnits:0,uncertainUnits:0,settledUnits:40});const next=await bind("successor-ok");assert.notEqual(next.runAccountId,b.runAccountId);await invoke("settle",{reference:ref,attemptId:a.attemptId,receiptCanonical:receiptValue});const old=(await snapshot()).find(x=>x.id===b.runAccountId).row;assert.equal(old.settledUnits,40);return;
 }
 if(kind==='checkpoint'){const results=await Promise.all([checkpoint(a),checkpoint(a),checkpoint(a),checkpoint(a)]);assert.equal(results.filter(x=>x.dispatchPermit===true).length,1);await denial(()=>invoke('releaseNotDispatched',{reference:ref,attemptId:a.attemptId}));return;}
 await checkpoint(a);
 if(kind==='tenant-delete'||kind==='space-delete'||kind==='scope-absence'){
  await change(kind,a);const args={attemptId:a.attemptId,receiptCanonical:await receipt(a,'0.000150',{privateResultCanonical:'secret-unparsed-private'})};
  if(kind==='scope-absence'){await denial(()=>invoke('reconcileDeploymentLiability',args),'FORBIDDEN');return;}
  await denial(()=>settle(a,'0.000150'));const result=await invoke('reconcileDeploymentLiability',args);assert.equal(result.settledCostUnits,150);assert.equal(result.overrun,true);await invoke('reconcileDeploymentLiability',args);await balance({settledUnits:150,reservedUnits:0,activeConcurrency:0});assert.ok(!canonical(await snapshot()).includes('secret-unparsed-private'));return;
 }
 if(kind==='unknown'){await invoke('recover',{reference:ref,attemptId:a.attemptId});await invoke('recover',{reference:ref,attemptId:a.attemptId});await balance({uncertainUnits:100,reservedUnits:0,activeConcurrency:1});const terminal=await receipt(a,'0.000040',{costSource:'unavailable'});await invoke('recover',{reference:ref,attemptId:a.attemptId,receiptCanonical:terminal});await balance({uncertainUnits:100,activeConcurrency:0});await settle(a);await balance({uncertainUnits:0,settledUnits:40,activeConcurrency:0});return;}
 if(kind==='visible'){const keys=['outputVisible','toolInputVisible','toolResultVisible','toolEffectCommitted'];for(let index=0;index<keys.length;index++){const current=index===0?a:await admit(b,index,'visible-'+index);if(index>0)await checkpoint(current);const flags=Object.fromEntries(keys.map(k=>[k,k===keys[index]]));await invoke('markVisible',{reference:ref,attemptId:current.attemptId,...flags});await invoke('markVisible',{reference:ref,attemptId:current.attemptId,...Object.fromEntries(keys.map(k=>[k,false]))});await settle(current,'0.000040',{outcome:'confirmed_rejected'});const stored=await attempt(current);for(const[k,v]of Object.entries(flags))assert.equal(stored[k],v);assert.equal((await invoke('checkFallback',{reference:ref,attemptId:current.attemptId,candidateModelId:'fixture/fallback'})).allowed,false);}return;}
 if(kind==='privacy')await change('source-delete',a);
 const amount=kind==='overrun'?'0.000150':kind==='known'?'0.0000001':'0.000040';const extra=kind==='private'?{privateResultCanonical:canonical({reasoning:'forbidden'})}:{};const encoded=await receipt(a,amount,extra);
 const result=await invoke('settle',{reference:ref,attemptId:a.attemptId,receiptCanonical:encoded});await Promise.all([invoke('settle',{reference:ref,attemptId:a.attemptId,receiptCanonical:encoded}),invoke('settle',{reference:ref,attemptId:a.attemptId,receiptCanonical:encoded})]);const cost=kind==='overrun'?150:kind==='known'?1:40;await balance({settledUnits:cost,reservedUnits:0,uncertainUnits:0,activeConcurrency:0});
 if(kind==='private'||kind==='privacy'){assert.equal(result.resultWithheld,true);assert.equal((await attempt(a)).privateResultCanonical,undefined);}
 if(kind==='overrun')await denial(()=>admit(b,1));else await denial(()=>settle(a,'0.000041'),'IDEMPOTENCY_CONFLICT');
}
