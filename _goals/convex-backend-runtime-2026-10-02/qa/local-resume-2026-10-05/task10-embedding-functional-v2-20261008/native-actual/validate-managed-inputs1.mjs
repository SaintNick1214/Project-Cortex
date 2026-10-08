/** Normal prepared-input check using the exact existing domain resolver. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {q,root,sha,authorityReference} from './common.mjs';
const ts=await import(pathToFileURL(join(root,'node_modules/typescript/lib/typescript.js'))),directory=join(q,'local-domain-check');await mkdir(directory,{recursive:true});
const sourcePins=[];
for(const name of ['profile','model-policy']){const bytes=await readFile(join(root,'src/domain',name+'.ts'));sourcePins.push({path:join(root,'src/domain',name+'.ts'),bytes:bytes.length,sha256:sha(bytes)});await writeFile(join(directory,name+'.js'),ts.transpileModule(bytes.toString(),{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.ES2022}}).outputText);}
const {resolveModelPolicy}=await import(pathToFileURL(join(directory,'model-policy.js')));
const manifest=JSON.parse(await readFile(join(q,'observed-small-manifest2.json'))),baseline=JSON.parse(await readFile(join(q,'baseline-functional-auth-outcomes.json'))),reference=authorityReference(baseline.owner),snapshots=[];
for(const [key,value] of Object.entries(reference))assert.ok(typeof value===(key.endsWith('Version')||key.endsWith('Epoch')?'number':'string'));
for(const operationKey of ['agent.respond','memory.extract','facts.resolve','embedding.memory','embedding.query']){
 const context={scope:reference,operationKey,runBudgetId:'local-check',authorizedOverrides:[]};
 const applicable=manifest.policies.filter(row=>!row.operationKey||row.operationKey===operationKey);
 const small=resolveModelPolicy({context,policies:applicable,qualifications:manifest.qualifications});snapshots.push({operationKey,modelId:small.modelId,boundRevision:small.pins.boundRevision});
 if(operationKey.startsWith('embedding.')){const policy={policyId:'exact-large-selector',version:1,scope:'tenant',tenantId:reference.tenantId,operationKey,override:{actorPrincipalId:'separate-tenant-operator',changeRevision:1,authorizationId:'trusted-operator-change'},rules:{modelId:'openai/text-embedding-3-large',nativeInterface:'embedding',pins:{priceRevision:'vercel-gateway-2026-10-08-text-large',boundRevision:'task10-large-8192-3072-v1'}}};
  const large=resolveModelPolicy({context:{...context,authorizedOverrides:[{...policy.override,policyId:policy.policyId,policyVersion:policy.version}]},policies:[...applicable,policy],qualifications:manifest.qualifications});assert.equal(large.semanticProfile.dimensions,3072);snapshots.push({operationKey,modelId:large.modelId,boundRevision:large.pins.boundRevision});}
}
assert.ok(manifest.dispatchEvidence.every(proof=>proof.checkedAt<=Date.now()&&proof.expiresAt>Date.now()));
await writeFile(join(q,'managed-prepared-input-validation1.json'),JSON.stringify({status:'PASS',sourcePins,manifestSha256:sha(await readFile(join(q,'observed-small-manifest2.json'))),snapshots,authorityProjectionFields:Object.keys(reference),oldQualifications:4,preparedLargeProvenanceLength:manifest.qualifications.at(-1).costBound.provenance.length,effects:false},null,2)+'\n');
console.log(JSON.stringify({status:'PREPARED_INPUT_PASS',snapshots:snapshots.length}));
