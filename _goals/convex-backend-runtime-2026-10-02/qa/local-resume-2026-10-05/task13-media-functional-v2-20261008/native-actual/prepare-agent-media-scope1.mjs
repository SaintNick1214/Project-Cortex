/** Explicit new owned V2 scope and monotone operator root; setup only, no Agent/media request. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q,sha,authorityReference} from './common.mjs';
const c=await openOwnedContext(),scope={tenantId:'task13-agent-media-v2-3c1dcff16463',memorySpaceId:'agent-media-v2-3c1dcff16463'},subject='ui13v2-3c1dcff16463',operatorSubject='op13v2-3c1dcff16463';
const financial=value=>({accounts:value.accounts.map(row=>Object.fromEntries(['accountId','root','windowId','windowStart','windowEnd','reservedUnits','uncertainUnits','settledUnits','activeConcurrency'].map(key=>[key,row[key]]))).sort((a,b)=>a.accountId.localeCompare(b.accountId)),
 attempts:value.attempts.map(row=>({attemptId:row.attemptId,state:row.state,reservationUnits:row.reservationUnits,slotReleased:row.slotReleased,dispatchIdentity:row.dispatchIdentity})).sort((a,b)=>a.attemptId.localeCompare(b.attemptId))});
try{
 const deployed=JSON.parse(await readFile(join(q,'deploy-agent-media-overlay1.json')));assert.equal(deployed.code,0);assert.equal(deployed.timedOut,false);
 await c.verifyTarget('agent-media-scope1-target-verified');
 const before=await c.admin.query('task13Native:snapshot',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId});
 const recipe=JSON.parse(await readFile(join(q,'agent-media-local-manifest3.json'))),definition=JSON.parse(await readFile(join(q,'agent-media-local-definition3.json'))),installed=JSON.parse(await readFile(join(q,'installed-agent-media-overlay1-source-manifest.json')));
 assert.ok(recipe.dispatchEvidence.every(row=>row.checkedAt<=Date.now()&&row.expiresAt>Date.now()+600000));assert.equal(recipe.revision,13);assert.equal(recipe.classification,'fixture-synthetic');
 assert.equal(recipe.qualifications.length,7);assert.equal(recipe.dispatchEvidence.length,7);
 const root=await c.admin.mutation('runtimeModelPolicy:installDeploymentPolicy',{manifestId:recipe.manifestId,expectedRevision:13});
 await c.publish('agent-media-scope1-root',{status:'PRIVATE_OPERATOR_ROOT13_ACTIVATED',manifestId:recipe.manifestId,revision:13,
  manifestSha256:sha(await readFile(join(q,'agent-media-local-manifest3.json'))),sourceCandidateManifestSha256:installed.packed.sdk.manifestSha256,
  privateCompiledObjectOnly:true,classification:'fixture-synthetic',v2ActualQualificationPending:true,fiveOldProofObjectsPreserved:true,
  priorRoot10_11_12LookupPreserved:true,oldAccountsUnchanged:true,commonRunUnits:3000000,imageCallUnits:2000000,tenantUnits:10000000,modelCalls:0,
  rootResult:{manifestId:root?.manifestId??recipe.manifestId,revision:root?.revision??13}});
 const expiresAt=Date.now()+7200000;
 const op=await c.admin.mutation('runtimeAuth:provision',{issuer:c.auth.issuer,subject:operatorSubject,actorKind:'user',...scope,resourceAccess:'space',
  capabilities:['read','write','run','tool','admin','storage:read','storage:write'],expiresAt});
 const actor=await c.admin.mutation('runtimeAuth:provision',{issuer:c.auth.issuer,subject,actorKind:'user',...scope,resourceAccess:'space',
  capabilities:['read','write','run','tool','storage:read','storage:write'],expiresAt});
 await c.http(operatorSubject).mutation('memorySpaces:register',{...scope,name:'Task13 one streamed Agent image and delayed ingestion',type:'project'});
 const published=await c.http(operatorSubject).mutation('agentDefinitions:publishVersion',{memorySpaceId:scope.memorySpaceId,clientMutationId:'task13-one-v2-'+c.fixture.operation,
  expectedPreviousVersion:0,definitionInput:definition.definition});
 const observed=await c.http(subject).mutation('agentDefinitions:get',{...scope,agentId:published.agentId,version:published.version});
 assert.equal(observed.definitionHash,published.definitionHash);
 const session=await c.http(subject).mutation('runtimeClient:session',scope);assert.equal(session.principalId,actor.principalId);
 const after=await c.admin.query('task13Native:snapshot',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId});assert.deepEqual(financial(after),financial(before));
 const privateTokenFile=join(c.pointer.privateDataDirectory,'agent-media-v2-current.jwt'),privateRefreshTokenFile=join(c.pointer.privateDataDirectory,'agent-media-v2-refresh.jwt');
 await writeFile(privateTokenFile,c.token(subject)+'\n',{flag:'wx',mode:0o600});await writeFile(privateRefreshTokenFile,c.token(subject)+'\n',{flag:'wx',mode:0o600});
 const publicConfig={version:1,status:'NEW_V2_UI_IDENTITY_READY_NO_SUBMIT_OR_START',projectId:c.state.projectId,deploymentUrl:c.state.url,
  assetHttpUrl:c.state.url.replace('.convex.cloud','.convex.site'),...scope,subject,reference:authorityReference(actor),operatorSubject,operatorReference:authorityReference(op),
  browserAdmin:false,capabilities:['read','write','run','tool','storage:read','storage:write'],resourceAccess:'space',
  agentId:published.agentId,agentVersion:published.version,definitionHash:published.definitionHash,definitionRegistry:'V2_MEDIA_FIVE_FIXED_TOOLS',registryHash:definition.registryHash,
  userPrompt:definition.userPrompt,streaming:true,maximumToolEffects:1,privateTokenFile,privateRefreshTokenFile,
  commonBudgetUnits:3000000,imageCallCeilingUnits:2000000,tenantCeilingUnits:10000000,candidateManifestSha256:installed.packed.sdk.manifestSha256,
  fixtureOverlaySourceManifest:join(q,'installed-agent-media-overlay1-source-manifest.json'),initialExtractHeldBeforeClaim:true,holdMaximumMs:300000,
  onlyRootBrowserMaySubmit:true,noNativeParallelSubmission:true,noNewAgentOrMediaCalls:true,priorScopeFinancialIdentityUnchanged:true,
  publicEnvironment:{NEXT_PUBLIC_CONVEX_URL:c.state.url,NEXT_PUBLIC_CORTEX_ASSET_HTTP_URL:c.state.url.replace('.convex.cloud','.convex.site'),
   NEXT_PUBLIC_CORTEX_MEMORY_SPACE_ID:scope.memorySpaceId,NEXT_PUBLIC_CORTEX_AGENT_ID:published.agentId,NEXT_PUBLIC_CORTEX_AGENT_VERSION:String(published.version)}};
 await c.publish('agent-media-public-fixture1',publicConfig);await c.publish('prepare-agent-media-scope1-outcomes',{status:'ACTUAL_NONPAID_SCOPE_ROOT_DEFINITION_SETUP_PASS',publicConfig:'agent-media-public-fixture1.json',
  groups:['fresh sole-development identity','private compiled operator root13 only','new scoped current authority and versioned V2 definition','old account/window/attempt financial identity unchanged'],
  providerCalls:0,AgentSubmissions:0,AgentStarts:0,modelAttemptsAdded:0,expiresAt,privateTokensNotPrinted:true});
 console.log(JSON.stringify({status:'NEW_V2_SCOPE_READY',...scope,agentId:published.agentId,version:published.version,modelCalls:0}));
}catch(error){await c.publish('prepare-agent-media-scope1-outcomes',{status:'FAIL_OR_UNKNOWN',error:c.publicError(error),noPaidDispatch:true,noBlindRepeat:true});throw error;}
finally{await c.close();}
