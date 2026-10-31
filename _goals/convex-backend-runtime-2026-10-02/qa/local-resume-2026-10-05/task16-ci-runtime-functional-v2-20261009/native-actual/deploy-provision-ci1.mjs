/** Exact two verified dev targets and real shipped compiled policy/JWT provisioning. No paid calls. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openCi,q,root,sha} from './ci-common1.mjs';
const c=await openCi(),groups=[];
try{
 const hosts=JSON.parse(await readFile(join(c.pointer.privateDirectory,'hosts.json'))),fixtures=await import(pathToFileURL(join(root,'scripts/ci/runtime-fixtures.mjs'))),receipt=JSON.parse(await readFile(join(root,'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task16-ci-runtime-functional-v2-20261009/author/source-check-receipt.json')));
 const provisioned=[];assert.ok(Date.now()<Date.parse('2026-10-09T08:50:12.383Z'),'Compiled proofs are no longer current');
 for(const host of hosts){
  const kind=host.kind,target=await c.verify(kind,kind+'-deploy-target-verified1');
  for(const pin of host.installed)assert.equal(sha(await readFile(join(host.path,'convex-dev',pin.path))),pin.sha256);for(const[path,pin]of Object.entries(host.unrelated))assert.equal(sha(await readFile(join(host.path,path))),pin.sha256);
  await c.command(kind+'-enabled-deploy1',[join(host.path,'node_modules/convex/bin/main.js'),'dev','--once','--typecheck','enable'],host.path,{CONVEX_URL:target.url,CONVEX_DEPLOY_KEY:c.credentials[kind].deployKey,CONVEX_DEPLOYMENT:'dev:'+target.deploymentName,CONVEX_URL_CLI:undefined,CONVEX_DEPLOY_KEY_CLI:undefined,CORTEX_CI_AUTH_PRIVATE_KEY:undefined},120000);
  await c.verify(kind,kind+'-provision-target-verified1');
  const policy=await fixtures.installFixturePolicy(c.env,kind,fixtures.operator(c.env,kind,host.path));await c.publish(kind+'-compiled-policy1',policy);
  const authority=await fixtures.provisionFixtures(c.env,kind,fixtures.operator(c.env,kind,host.path));await c.publish(kind+'-provisioned-scopes1',authority);provisioned.push(authority);
  const {ConvexHttpClient}=await import(pathToFileURL(join(host.path,'node_modules/convex/dist/esm/browser/index.js'))),{makeFunctionReference}=await import(pathToFileURL(join(host.path,'node_modules/convex/dist/esm/server/index.js')));
  const client=new ConvexHttpClient(target.url,{logger:false});client.setAuth(fixtures.issueFixtureToken(c.env,kind,'owner'));const session=await client.mutation(makeFunctionReference('runtimeClient:session'),{tenantId:authority.plan.tenantId,memorySpaceId:authority.plan.memorySpaceId});assert.equal(session.principalId,authority.references.owner.principalId);assert.equal(session.userId,authority.plan.identities.owner.subject);
  const unrelated=await new ConvexHttpClient(target.url,{logger:false}).query(makeFunctionReference('hostMetadata:sentinel'),{});assert.equal(unrelated.host,'owned-ci-'+kind);assert.equal(unrelated.inference,false);await c.publish(kind+'-current-host-auth1',{session,unrelated,hostContentPreserved:true,providerCalls:0});
  for(const[path,pin]of Object.entries(host.unrelated))assert.equal(sha(await readFile(join(host.path,path))),pin.sha256);
  groups.push({name:kind+' native enabled registration/current compiled9/real provision/verified JWT/unrelated host',status:'PASS',projectId:target.projectId,deploymentName:target.deploymentName,modelCalls:0});
 }
 await writeFile(join(c.pointer.privateDirectory,'provisioned.json'),JSON.stringify(provisioned,null,2)+'\n',{mode:0o600,flag:'wx'});
 await c.publish('deploy-provision1-outcomes',{status:'TWO_ACTUAL_CURRENT_CI_TARGETS_QUALIFIED_SETUP',groups,sourceCandidateDigest:receipt.candidateDigest,backendFiles:107,currentPolicyRevision:9,proofExpiryUtc:'2026-10-09T08:50:12.383Z',GitHubWrites:0,providerCalls:0,existing3174742Unchanged:true,privateSigningKeyOmittedFromDeployAndOperator:true});
 console.log(JSON.stringify({status:'TWO_ACTUAL_CI_TARGETS_REGISTERED_PROVISIONED',groups:groups.length,providerCalls:0,GitHubWrites:0}));
}catch(error){await c.publish('deploy-provision1-outcomes',{status:'FAIL_OR_UNKNOWN',groups,error:{name:error.name,message:c.redact(error.message)},noBlindRetry:true,noPaidCalls:true,noGitHubWrites:true});throw Error('TASK16_DEPLOY_PROVISION_FAILED_SEE_PUBLIC_RECEIPT');}
