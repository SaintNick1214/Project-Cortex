import{build}from'esbuild';import{readFileSync,writeFileSync,mkdirSync,cpSync,readdirSync}from'node:fs';import{resolve,dirname,relative}from'node:path';import{createHash}from'node:crypto';
const repo='/workspace/Project-Cortex',q=resolve(repo,'_goals/convex-backend-runtime-2026-10-02/qa'),extra=resolve(q,'task04-model-drift-native-extra-preparation-c3');
mkdirSync(resolve(extra,'runtime'),{recursive:true});mkdirSync(resolve(extra,'runtime-source/convex'),{recursive:true});cpSync(resolve(repo,'convex-dev/runtimeGateway.ts'),resolve(extra,'runtime-source/convex/runtimeGateway.ts'));cpSync(resolve(extra,'fixture/src'),resolve(extra,'runtime-source/src'),{recursive:true});
for(const[name,entry]of[['gateway',resolve(extra,'runtime-source/convex/runtimeGateway.ts')],['semantic-profile',resolve(extra,'runtime-source/src/domain/profile.ts')]]){
 const built=await build({entryPoints:[entry],outfile:resolve(extra,'runtime/'+name+'.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',metafile:true,logLevel:'silent'});writeFileSync(resolve(extra,'runtime/'+name+'.metafile.json'),JSON.stringify(built.metafile,null,2)+'\n');
}
const plan=JSON.parse(readFileSync(resolve(q,'task04-model-drift-native-profile-design-c1/cases.json')));
const prior=JSON.parse(readFileSync(resolve(extra,'cases.json')));prior.scenarios=plan.cases.map(x=>({id:x.id,kind:x.id,status:'PREPARED_OFFLINE_NATIVE_NOT_RUN',maximumCommittedCreatedRows:x.createdRowsUpper,rpcCeiling:32,postCaseCleanupIncluded:3,requiredOutcomes:x.outcomes}));prior.candidate='MODEL_DRIFT_EXTRA_C1';prior.budgets={...prior.budgets,cumulativeRows:444,cumulativeDeletions:444,cumulativeCreationAndDeletionEvents:888,derivedRowsUpper:444,derivedNativeUpper:2945,rpcWorstCase:2945,logicalScenarios:32,cleanupWorstCase:40,cumulativeRowComputation:{core:417,security:15,fault:0,empty:12},rpcComputation:{coreAssertionsAndPerCaseCleanup:832,security:2044,fault:0,empty:20,publication:2,finalAndRecovery:10,nestedNative:37}};writeFileSync(resolve(extra,'cases.json'),JSON.stringify(prior,null,2)+'\n');
const p=resolve(extra,'fixture/convex/qualificationManifest.ts');let text=readFileSync(p,'utf8').replace('providerVersion: "fixture-synthetic-0"','providerVersion: "0.2.1"');text='/** Transport library version is actual installed0.2.1; all qualification/cost/input premises remain FIXTURE_SYNTHETIC_ONLY. */\n'+text;writeFileSync(p,text);
const c=resolve(extra,'scripts/cases.mjs');text=readFileSync(c,'utf8').replace("accounting(initialRows,0,0,1,false);","accounting(firstRowsForBaseline(baseline),40,0,0,false);");text=text.replace("accounting(firstRowsForBaseline(baseline),40,0,0,false);", "for(const r of [baseline.o,...baseline.accounts])assert.equal(r.overrun,false);");writeFileSync(c,text);
// Copying runtime source is explicit ROOT-runner-only; never a Convex public function or production qualification.
for(const kind of['extension','regression','extra']){
 const root=resolve(q,'task04-model-drift-native-'+kind+'-preparation-c3');const ip=resolve(root,'registration-inventory.json');const sp=resolve(root,'schema-evidence.json');
 for(const p of[ip,sp]){const body=readFileSync(p);writeFileSync(resolve(root,'preimages/'+p.split('/').at(-1)),body);}
 // Actual inventory code exclusively recreates metadata; never hand edits validators.
 const mod=await import('file://'+resolve(root,'scripts/inventory.mjs'));
 // inventory emits exclusive paths; move prior metadata into preimages first.
 const{unlinkSync}=await import('node:fs');unlinkSync(ip);unlinkSync(sp);await mod.inventory(resolve(repo,'work/resume/task04-model-drift-native-preparation-c3/'+kind));
}
console.log('SOURCE_BOUND_BUNDLES_AND_ACTUAL_REGISTRATION_METADATA_GENERATED; native wire/codegen NOT_RUN');
