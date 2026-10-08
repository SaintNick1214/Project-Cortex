import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext,q,sha,denied} from './common.mjs';
const stage=process.argv[2],c=await openOwnedContext();
try{
 await c.verifyTarget('baseline-'+stage+'-target-verified');
 if(stage==='stock'){
  const seed=await c.hostOwner.mutation('host:seed',{text:'unrelated Task10 host sentinel'}),rows=await c.hostOwner.query('host:authenticated',{});
  assert.equal(rows.length,1);assert.equal(rows[0].text,'unrelated Task10 host sentinel');
  const node=await c.hostOwner.action('hostNode:health',{});assert.equal(node.subject,'host-owner');assert.equal(node.runtime,'node');
  await c.publish('stock-host-live',{status:'PASS',seed,rows,node,noCortexCalls:true,noModelCalls:true});
 }else if(stage==='install'){
  const sdk=join(c.host,'node_modules/@cortexmemory/sdk'),baseline=JSON.parse(await readFile(join(q,'baseline-packages.json')));
  assert.equal(sha(await readFile(join(sdk,'dist/backend/v1/manifest.json'))),baseline.sdk.manifestSha256);
  const installer=await import(pathToFileURL(join(c.host,'node_modules/@cortexmemory/cli/dist/utils/init/additive-backend.js')));
  const provider={type:'customJwt',issuer:c.auth.issuer,jwks:c.auth.jwks,algorithm:'RS256',applicationID:c.auth.applicationID};
  const plan=await installer.planAdditiveBackendInstallation(c.host,sdk,{trustedJwtProvider:provider});
  await c.publish('baseline-installation-plan1',plan);assert.deepEqual(plan.conflicts,[]);assert.equal(plan.functionsDirectory,'custom/backend/');
  const result=await installer.applyAdditiveBackendInstallation(plan);await c.publish('baseline-installation-result1',result);
  const rootConfig=await readFile(join(c.host,'custom/backend/convex.config.ts'),'utf8');assert.ok(rootConfig.includes('app.use(_cortex_component_agent'));assert.ok(rootConfig.includes('app.use(_cortex_component_workflow'));
  await writeFile(join(c.host,'custom/backend/baselineQualification.ts'),'import {internalQuery} from "./_generated/server";\nexport const counts=internalQuery({args:{},handler:async(ctx)=>{const tables=["runtimeAuthPrincipals","runtimeAuthGrants","runtimeConversations","runtimeRuns","runtimeModelOperations","runtimeModelAttempts"];const counts:Record<string,number>={};for(const table of tables)counts[table]=(await (ctx.db as any).query(table).take(1000)).length;return counts;}});\n');
 }else if(stage==='auth'){
  const scope={memorySpaceId:c.memorySpaceId},counts=()=>c.admin.query('baselineQualification:counts',{});
  const before=await counts();assert.equal(before.runtimeModelOperations,0);assert.equal(before.runtimeModelAttempts,0);
  const unbootstrapped=await denied(()=>c.owner.mutation('runtimeTranscript:create',{...scope,clientRequestId:'no-grant'}));
  assert.deepEqual(await counts(),before);
  const owner=await c.admin.mutation('runtimeAuth:provision',{issuer:c.auth.issuer,subject:'cortex-owner',actorKind:'user',tenantId:c.tenantId,...scope,
   capabilities:['read','write','run','admin','tool','storage:read','storage:write'],resourceAccess:'space',expiresAt:Date.now()+7200000});
  const foreign=await c.admin.mutation('runtimeAuth:provision',{issuer:c.auth.issuer,subject:'foreign-user',actorKind:'user',tenantId:c.tenantId+'-foreign',memorySpaceId:c.memorySpaceId+'-foreign',capabilities:['read','write','run','admin'],resourceAccess:'space',expiresAt:Date.now()+7200000});
  await c.owner.mutation('memorySpaces:register',{...scope,name:'Task10 isolated memory space',type:'project'});
  await c.foreign.mutation('memorySpaces:register',{memorySpaceId:c.memorySpaceId+'-foreign',name:'Task10 foreign isolated space',type:'project'});
  const policy=await c.admin.mutation('runtimeModelPolicy:installDeploymentPolicy',{manifestId:'cortex-gateway-agent-defaults-2026-10-08',expectedRevision:5});
  const created=await c.owner.mutation('runtimeTranscript:create',{...scope,clientRequestId:'baseline-canonical'});
  const replay=await c.owner.mutation('runtimeTranscript:create',{...scope,clientRequestId:'baseline-canonical'});assert.equal(replay.conversationId,created.conversationId);
  const selector={...scope,conversationId:created.conversationId},protectedBefore=await counts(),denials=[];
  for(const client of [c.anonymous,c.foreign])denials.push(c.publicError(await denied(()=>client.query('runtimeTranscript:get',selector))));
  for(const client of [c.anonymous,c.owner])denials.push(c.publicError(await denied(()=>client.mutation('runtimeAuth:provision',{issuer:c.auth.issuer,subject:'attacker',actorKind:'user',tenantId:c.tenantId,...scope,capabilities:['admin'],resourceAccess:'space'}))));
  assert.deepEqual(await counts(),protectedBefore);assert.equal(protectedBefore.runtimeModelOperations,0);assert.equal(protectedBefore.runtimeModelAttempts,0);
  const stock=JSON.parse(await readFile(join(q,'stock-host-live.json')));assert.deepEqual(await c.hostOwner.query('host:authenticated',{}),stock.rows);
  const host=await c.hostOwner.action('hostNode:health',{});assert.equal(host.subject,'host-owner');
  const response=await fetch(c.state.url.replace('.convex.cloud','.convex.site')+'/host-health',{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);assert.equal(await response.text(),'host-route-preserved');
  const originals=JSON.parse(await readFile(join(q,'host-originals.json'))),preserved=[];
  for(const name of ['convex.json','custom/backend/host.ts','custom/backend/hostNode.ts','custom/backend/http.ts']){assert.equal(sha(await readFile(join(c.host,name))),originals[name].sha256);preserved.push(name);}
  await c.publish('baseline-functional-auth-outcomes',{status:'PASS',projectId:c.state.projectId,stockHostPreserved:true,preserved,owner,foreign,policy,
   canonicalConversation:created.conversationId,exactReplay:true,unbootstrapped:c.publicError(unbootstrapped),denials,counts:protectedBefore,
   baseline:'Task09 immutable accepted package',task10CandidateDeployed:false,modelCalls:0});
 }else throw Error('Unknown baseline stage');
}finally{await c.close();await c.publish('baseline-'+stage+'-client-cleanup',{ownedClientsClosed:true});}
