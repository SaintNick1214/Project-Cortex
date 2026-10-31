import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
const q=dirname(new URL(import.meta.url).pathname);
const root=join(q,'../../../../../..');
const load=async name=>JSON.parse(await readFile(join(q,name)));
const pin=async path=>{const b=await readFile(path);return {path,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};};
const write=async(name,value)=>writeFile(join(q,name),JSON.stringify(value,null,2)+'\n');
const qualification=await load('qualification-actual-record1.json'),live=await load('installed-live-outcomes.json');
const liveState=await load('installed-live-native-state.json'),gap=await load('live-gap-recovery1.json');
const expiry=await load('installed-expiry2-outcome.json'),renewal=await load('installed-grant-renewal-resume1-outcome.json');
const final=await load('installed-final5-source-manifest.json'),deployment=await load('deploy-installed-final5.json');
const host=await load('host-final-readback.json'),deleted=await load('retirement-delete.json'),retired=await load('retirement.json'),cleanup=await load('owned-local-cleanup.json');
assert.equal(qualification.qualificationDispatches,3);assert.equal(qualification.readOnlyReplays,3);assert.equal(qualification.replayAddedAttempts,0);
assert.equal(qualification.retainedUncertainUnits,300000);assert.equal(live.outcomes.length,2);for(const row of live.outcomes)assert.equal(row.status,'PASS');
assert.equal(liveState.run.responseStatus,'complete');assert.equal(liveState.ingestion.length,1);assert.equal(liveState.modelAttempts.length,4);
for(const row of liveState.modelAttempts){assert.equal(row.slotReleased,true);assert.equal(row.state,'uncertain');assert.equal(row.reservationUnits,100000);}
assert.equal(liveState.modelOperations.reduce((sum,row)=>sum+row.uncertainUnits,0),400000);
assert.equal(gap.status,'PASS');assert.equal(gap.providerAttemptsUnchanged,true);assert.equal(gap.paidRetry,false);
assert.equal(expiry.status,'PASS');assert.equal(renewal.status,'PASS');assert.equal(host.status,'PASS');assert.equal(cleanup.status,'PASS');
assert.equal(deployment.code,0);assert.equal(deployment.childClosed,true);assert.equal(deployment.timedOut,false);
assert.equal(deleted.deletionHttpStatus,200);assert.equal(retired.readbackHttpStatus,404);assert.equal(retired.retainedForNextTask,false);
const cases=[
 ['selected manual edit','installed-fence-edit-outcome.json','installed-final3-source-manifest.json'],
 ['selected message removal','installed-fence-remove-outcome.json','installed-final3-source-manifest.json'],
 ['current owner cancellation','installed-fence-cancel-outcome.json','installed-final3-source-manifest.json'],
 ['cached tool context source tombstone','installed-history-currentness-outcome.json','installed-final3-source-manifest.json'],
 ['expired admitted approval, next queued claim and stale callback','installed-expiry2-outcome.json','installed-final5-source-manifest.json'],
 ['revoked executable definition safe control and strict paid denial','installed-fence2-definition-revoke-outcome.json','installed-final5-source-manifest.json'],
 ['replacement grant safe cancellation without quota reset','installed-grant-renewal-resume1-outcome.json','installed-final5-source-manifest.json'],
 ['revoked current grant public and paid denial','installed-fence2-revoke-outcome.json','installed-final5-source-manifest.json'],
];
for(const [,file] of cases)assert.equal((await load(file)).status,'PASS');
const originalSourcePins=[];
for(const name of ['runtimeAgent.ts','runs.ts','runtimeModelPolicy.ts','runtimeGateway.ts','runtimeGatewayQualifications.ts','runtimeModelPolicyBootstrap.ts','runtimeOutputProjection.ts'])originalSourcePins.push(await pin(join(root,'convex-dev',name)));
const report={
 version:1,scope:'TASK07_CURRENT_PRODUCT_NATIVE_FUNCTIONAL_BATCH',status:'ACTUAL_OUTCOMES_PASS_INDEPENDENT_FINAL_VERDICT_PENDING',
 completedAt:new Date().toISOString(),target:{projectId:3172114,teamId:325340,deploymentName:'determined-raven-795',previousTask06Installed:true,production:false,retired:true,retainedForNextTask:false},
 candidate:{finalInstalledSource:'installed-final5-source-manifest.json',manifestSha256:final.manifestSha256,sourcePins:originalSourcePins,
  installed69Files:final.files.filter(row=>!row.fixtureOnly).length,components:['agent','workflow'],exactShippedDefault:'cortex-gateway-agent-defaults-2026-10-08/revision5',
  fixtureTrustExceptionRemoved:true,finalDeployment:deployment,finalChangedProductPaths:final.changedPaths,
  scopeReuse:'Normal shipped V5 live/source fences ran on final3. Final4 adds lease/current-resource control repairs. Final5 changes only runs budget cancellation route and modelPolicy cleanup; final5 targets those authority controls. Prior green outcomes retain their exact source scope.'},
 qualification:{actualRecord:'qualification-actual-record1.json',modelId:qualification.modelId,nativeInterface:qualification.nativeInterface,
  featureEnvelope:qualification.featureEnvelope,boundRevision:qualification.boundRevision,toolRegistryVersion:qualification.toolRegistryVersion,
  genuineDispatches:3,readOnlyReplays:3,replayAddedAttempts:0,eachFullCeiling:100000,retainedUncertainUnits:300000,
  observedTerminalCost:'unavailable',costInterpretation:'Confirmed matching bounded output is delivered/replayed; full ceiling remains uncertain liability, no settlement discount/refund or paid retry.',
  paidModes:['native generate tool call','native tool-call stream','native tool-result final-text stream'],priorPlainStructuredEmbeddingPreserved:true,
  promotion:'Observed record is the compiled V5 qualification binding, not an invented independent full-task PASS.'},
 originalAcceptance:[
  {criterion:1,status:'PASS',evidence:['installed-final3-source-manifest.json','deploy-installed-final3.json','installed-live-native-state.json','installed-final5-source-manifest.json','deploy-installed-final5.json'],detail:'Task06-installed customized host executes current registered Agent, Workflow and governed Gateway with enabled native typecheck.'},
  {criterion:2,status:'PASS',evidence:['installed-live-outcomes.json','installed-live-observer-events.json','installed-live-output.json'],detail:'Authenticated context recall and approved memory_recall server tool, two observers, saved-cursor disconnect/reconnect and final-only convergence. Saved-output replay is not upstream stream resumption.'},
  {criterion:3,status:'PASS',evidence:['installed-live-native-state.json','installed-live-reconcile-repeat.json','live-gap-recovery1.json'],detail:'One completed logical turn has one canonical final and one ingestion receipt. Actual model-save/core-registration failure reconciles twice to the same receipt with unchanged paid attempts.'},
  {criterion:4,status:'PASS',evidence:cases.map(row=>row[1]),detail:'Manual edit/removal, cached recalled-source tombstone, cancellation, approval expiry, definition revocation and replacement/revoked grant checks reject obsolete work before subsequent paid dispatch. Typed final/cancel/unknown states and redacted projections are retained.'},
 ],
 ordinaryLive:{outcomes:live.outcomes,runId:liveState.run.runId,modelAttempts:4,attemptState:'uncertain',allSlotsReleased:true,
  turnUncertainUnits:400000,ingestionReceiptId:liveState.ingestion[0].receiptId??live.outcomes[1].evidence.ingestionReceiptId,
  allPaidOperationsShareRunBudget:true,contextAndToolSourceWitnessesPersisted:true,reactiveClientsClosed:4},
 focusedNativeCases:cases.map(([name,receipt,source])=>({name,status:'PASS',receipt,source})),
 newestControls:{expiry:{approvalCode:expiry.approvalError.data.code,noLeaseRenewal:expiry.noLeaseRenewal,queuedRunAdvances:expiry.queuedRunAdvances,staleCallbackNoEffect:expiry.staleCallbackNoEffect},
  replacementGrant:{oldGrantId:renewal.attempt.reference.grantId,newGrantId:renewal.current.grantId,newGrantVersion:renewal.current.grantVersion,sameAdmittedRun:true,noReprovision:true,
   capturedBudgetUnchanged:renewal.capturedBudgetUnchanged,tenantUncertainUnits:renewal.budgetAfter.tenants.reduce((sum,row)=>sum+row.uncertainUnits,0),noPaidDispatch:true}},
 preservedFailures:[
  {kind:'product',evidence:'deploy-qualification1.json',detail:'Initial ordinary-scanned component helper 400 preserved; separately corrected components.config.ts layout/deployed source.'},
  {kind:'fixture',evidence:'qualification2-outcomes.json',detail:'First already-paid generate observer used wrong native observation field. Exact same-request read-only replay corrected the oracle without another paid generate.'},
  {kind:'product',evidence:'live-red-state1.json',detail:'Raw finish-step Date RPC serialization failed after real native save. Original live is not relabeled green; actual reconcile recovered one receipt without inference. Current source projects primitives before RPC.'},
  {kind:'consequential timeout',evidence:'lifecycle-edit-progress-readonly1.json',detail:'Earlier lifecycle edit reached the same Date failure and 180s observation timeout; it does not certify manual-edit rejection. Distinct current installed manual fences pass.'},
  {kind:'fixture transition',evidence:'lifecycle-old-root-transition-cancel.json',detail:'Removed qualification-only synthetic root was no longer trusted; old scope cancellation denial retained, never restored to reset paid liability. Current shipped-root owner cancellation separately passes.'},
  {kind:'fixture',evidence:'installed-expiry-red-readback1.json',detail:'First native expiry fixture omitted Workflow ID and reached INVALID_STATE. Distinct expiry2 uses a genuine harmless Workflow waiter; no fake ID or product fault flag.'},
  {kind:'fixture',evidence:'installed-fence-definition-revoke-command1.stderr.log',detail:'Owner get/observe/cancel succeeded; final oracle expected the wrong model denial. Correct immutable successor requires actual POLICY_DENIED.'},
  {kind:'fixture',evidence:'installed-grant-renewal-command1.stderr.log',detail:'Actual provision creates a new grant ID/version2. Same-ID oracle failed before cancellation; resume1 uses the actual current grant on the same admitted run, no reprovision.'},
 ],
 cleanup:{hostPreservation:'host-final-readback.json',deletion:'retirement-delete.json',readback:'retirement.json',local:'owned-local-cleanup.json',
  deletionHttpStatus:200,readbackHttpStatus:404,allReactiveClientsClosed:true,finalDeploymentChildClosed:true,noOwnedCommandRemaining:true,privateCredentialFilesRemoved:cleanup.exactOwnedCredentialFilesRemoved},
 limitations:['This report records functional evidence; final Task07 acceptance belongs to the non-author reviewer.','No full-goal completion or Task08 acceptance.','Terminal monetary cost remains unavailable and conservative full liability is preserved.','No production deployment, foreign-target mutation, broad scenario sum or retired Source-controller qualification.'],
};
await write('actual-report-final1.json',report);
const md=`Task07 actual native batch is closed on the Task06-installed customized development target3172114. The target was deleted with HTTP200 and read back404; exact owned keys, JWT signing material and temporary deployment environment were removed. Unrelated host functions, Node action, authentication, HTTP route, schema and original data remained intact until retirement. Final independent acceptance is pending.\n\nThe shipped default V5 completed a scoped-memory Agent turn with an approved memory_recall server tool. Two authenticated observers and a saved-cursor reconnect converged on typed final output; final-only output withheld unfinished data. The canonical user/tool-call/tool-result/assistant history has one final transcript and one ingestion receipt. Four governed paid attempts released all concurrency slots while retaining400000 uncertain units. Earlier actual native-save/core-registration failure recovered the same receipt twice with no inference or added paid attempt.\n\nThree real interface probes cover generated tool calls, streamed tool calls and final text after a tool result. Three exact read-only replays added no attempts. Each call retained its100000 ceiling because terminal monetary cost is unavailable. The actual record binds the compiled registry; it does not invent independent full-task acceptance.\n\nFinal5 targeted unpaid controls pass: genuine Workflow approval expiry rejects late approval without renewal; the next queued run advances and old callbacks have no effect. Definition revocation preserves current-owner read/cancel while paid execution denies POLICY_DENIED. Actual replacement grant2 can cancel the old bound run, the captured old grant still cannot dispatch, and600000 tenant uncertain liability remains unchanged. Current-grant revocation denies public and paid work. Current manual edit/removal/cancel and cached-tool source tombstone checks also pass on their recorded final3 source scope.\n\nThe receipt index preserves the initial400, paid Date-RPC failure, observation timeout and fixture oracle reds. The first renewal oracle incorrectly expected a stable grant ID; the corrected continuation reuses the same admitted run and actual returned grant, without provisioning or paying again. The original failures remain recorded. Normal live evidence is scoped to final3; final5 adds only the narrowly changed cancellation accounting controls and enabled deployment.\n\nCurrent installed source: [installed-final5-source-manifest.json](./installed-final5-source-manifest.json). Full outcomes and criteria: [actual-report-final1.json](./actual-report-final1.json). Public raw index: [actual-receipt-index-final1.json](./actual-receipt-index-final1.json). Cleanup: [retirement.json](./retirement.json). Full backend-runtime goal remains open.\n`;
await writeFile(join(q,'actual-report-final1.md'),md);
const names=new Set([
 'actual-report-final1.json','actual-report-final1.md','qualification-actual-record1.json','qualification2-generate.json','qualification3-first-generate-current-state.json','qualification3-generate-replay.json','qualification3-tool-stream.json','qualification3-tool-stream-replay.json','qualification3-final-stream.json','qualification3-final-stream-replay.json','qualification3-outcomes.json',
 'installed-final3-source-manifest.json','installed-final4-source-manifest.json','installed-final5-source-manifest.json','deploy-installed-final3.json','deploy-installed-final4.json','deploy-installed-final5.json','deploy-installed-final5.stderr.log','packed-sdk-final5.json',
 'installed-live-outcomes.json','installed-live-native-state.json','installed-live-output.json','installed-live-observer-events.json','installed-live-reconcile-repeat.json','installed-live-client-cleanup.json','installed-live-remember.json',
 'live-gap-recovery1.json','live-red-state1.json','live-native-failure-logs1.json','live-client-cleanup.json','live-outcomes.json','lifecycle-edit-progress-readonly1.json','lifecycle-edit-client-cleanup.json','lifecycle-old-root-transition-cancel.json',
 'installed-expiry-red-readback1.json','installed-expiry-first-fixture-cleanup.json','installed-fence-definition-revoke-command1.stderr.log','installed-fence-definition-revoke-calls.json','installed-grant-renewal-command1.stderr.log','installed-fence2-grant-renewal-calls.json',
 'host-final-readback.json','host-final-target-verified.json','retirement-target-verified.json','retirement-delete.json','retirement.json','owned-local-cleanup.json','retirement-command1.stdout.log',
 'deploy-qualification1.json','deploy-qualification1.stderr.log','public-live-command1.stderr.log','lifecycle-edit-command1.stderr.log','qualification-command2.stderr.log','actual-report-draft1.json','actual-report-draft1.md','common.mjs','common-installed.mjs','agentQualification.ts','agentFenceQualification.ts','exercise-installed-expiry2.mjs','exercise-installed-fences4.mjs','resume-installed-grant-renewal1.mjs','retire-owned.mjs',
]);
for(const [,name] of cases)names.add(name);
for(const prefix of ['installed-fence-edit','installed-fence-remove','installed-fence-cancel','installed-expiry2','installed-fence2-definition-revoke','installed-grant-renewal-resume1','installed-fence2-revoke'])for(const suffix of ['-calls.json','-client-cleanup.json'])names.add(prefix+suffix);
for(const name of ['installed-expiry-command2.stderr.log','installed-expiry-command2.stdout.log','installed-definition-revoke-command2.stderr.log','installed-definition-revoke-command2.stdout.log','installed-grant-renewal-resume1.stderr.log','installed-grant-renewal-resume1.stdout.log','installed-revoke-command2.stderr.log','installed-revoke-command2.stdout.log'])names.add(name);
const files=[];for(const name of names)files.push(await pin(join(q,name)));
await write('actual-receipt-index-final1.json',{scope:report.scope,files,notes:'Finite public index of evidence relied on by this report, not a new controller or qualification gate. Original red/preimage files remain intact.'});
const principals=[];for(const name of ['actual-report-final1.json','actual-report-final1.md','actual-receipt-index-final1.json','installed-final5-source-manifest.json','retirement-delete.json','retirement.json','owned-local-cleanup.json'])principals.push(await pin(join(q,name)));
await write('actual-handoff-final1.json',{scope:report.scope,status:report.status,closedAt:new Date().toISOString(),allActualCommandsClosed:true,
 finalTargetRetired:true,independentFinalVerdictPending:true,files:principals});
console.log(JSON.stringify({status:report.status,target:3172114,retirement:'200/404',files:principals}));
