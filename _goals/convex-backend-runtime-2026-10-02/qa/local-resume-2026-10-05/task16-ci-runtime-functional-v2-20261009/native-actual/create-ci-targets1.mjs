/** Root-authorized finite two-target CI activation setup. No GitHub writes or inference. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {homedir} from 'node:os';
import {dirname,join} from 'node:path';
import {randomUUID,generateKeyPairSync,createHash} from 'node:crypto';
const q=dirname(new URL(import.meta.url).pathname),operation=randomUUID(),suffix=operation.replaceAll('-','').slice(0,12),privateDirectory=join(homedir(),'.codex/tmp/cortex-task16-ci-native-'+suffix);
await mkdir(privateDirectory,{mode:0o700});await chmod(privateDirectory,0o700);
const accessToken=JSON.parse(await readFile(join(homedir(),'.convex/config.json'))).accessToken;assert.equal(typeof accessToken,'string');
const state={operation,teamId:325340,privateDirectory,targets:[],createdAt:new Date().toISOString(),purpose:'two separately verified sole-cloud-dev CI SDK/CLI targets',noProduction:true};
const save=()=>writeFile(join(privateDirectory,'state.json'),JSON.stringify(state,null,2)+'\n',{mode:0o600});
await save();await writeFile(join(q,'fixture-pointer1.json'),JSON.stringify({operation,privateDirectory,teamId:state.teamId},null,2)+'\n',{flag:'wx'});
async function api(method,path,body){const response=await fetch('https://api.convex.dev'+path,{method,headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json','Convex-Client':'npm-cli-1.46.0'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000),redirect:'error'});let data;try{data=await response.json();}catch{data=null;}return{status:response.status,data};}
async function publish(name,value){await writeFile(join(q,name+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});}
try{
 const teams=await api('GET','/api/teams'),rows=Array.isArray(teams.data)?teams.data:teams.data?.teams,team=rows?.find(row=>row.id===state.teamId);assert.equal(teams.status,200);assert.ok(team?.slug);state.teamSlug=team.slug;await save();
 await publish('team-access1',{status:teams.status,teamId:team.id,teamSlug:team.slug,accessibleTeamCount:rows.length,secretsPrinted:false});
 for(const kind of ['sdk','cli']){
  const target={kind,projectName:'cortex-task16-ci-'+kind+'-'+suffix,production:false,requestedDeploymentType:'dev',createIssuedAt:Date.now()};state.targets.push(target);await save();
  const created=await api('POST','/v1/teams/'+state.teamId+'/create_project',{projectName:target.projectName,deploymentType:'dev',deploymentRegion:null});
  target.projectId=created.data?.id;target.projectSlug=created.data?.slug;await save();await publish(kind+'-create1',{httpStatus:created.status,kind,projectId:target.projectId,projectSlug:target.projectSlug,requestedProjectName:target.projectName,requestedType:'dev'});
  assert.equal(created.status,200);assert.ok(target.projectId&&target.projectSlug);assert.ok(![3174742,3176298].includes(target.projectId));
  const provisioned=await api('POST','/api/deployment/provision_and_authorize',{teamSlug:state.teamSlug,projectSlug:target.projectSlug,deploymentType:'dev'});assert.equal(provisioned.status,200);assert.equal(typeof provisioned.data?.adminKey,'string');
  const {adminKey,url,deploymentName}=provisioned.data;assert.equal(url,'https://'+deploymentName+'.convex.cloud');target.deploymentName=deploymentName;target.url=url;await save();
  const project=await api('GET','/v1/projects/'+target.projectId),deployment=await api('GET','/v1/deployments/'+deploymentName),list=await api('GET','/v1/projects/'+target.projectId+'/list_deployments');
  assert.equal(project.status,200);assert.equal(project.data?.id,target.projectId);assert.equal(project.data?.slug,target.projectSlug);
  assert.equal(deployment.status,200);assert.equal(deployment.data?.projectId,target.projectId);assert.equal(deployment.data?.deploymentType,'dev');assert.equal(deployment.data?.kind,'cloud');assert.equal(deployment.data?.deploymentUrl,url);assert.equal(list.status,200);assert.equal(list.data?.length,1);assert.equal(list.data[0]?.name,deploymentName);
  target.soleCloudDevVerifiedAt=new Date().toISOString();await save();
  const key=await api('POST','/v1/deployments/'+deploymentName+'/create_deploy_key',{name:'task16-ci-'+kind+'-'+operation,expiresAt:Date.now()+86400000});assert.equal(key.status,200);assert.equal(typeof key.data?.deployKey,'string');assert.ok(key.data.deployKey.startsWith('dev:'+deploymentName+'|'));
  await writeFile(join(privateDirectory,kind+'-credentials.json'),JSON.stringify({operation,projectId:target.projectId,deploymentName,url,adminKey,deployKey:key.data.deployKey},null,2)+'\n',{flag:'wx',mode:0o600});
  await publish(kind+'-target-verified1',{...target,teamId:state.teamId,projectHttpStatus:project.status,deploymentHttpStatus:deployment.status,listHttpStatus:list.status,soleCloudDev:true,devKeyPrefixBound:true,keyExpirationMs:86400000,credentialMode:'0600',credentialValuesPrinted:false,noModelCalls:true});
 }
 assert.notEqual(state.targets[0].deploymentName,state.targets[1].deploymentName);assert.notEqual(state.targets[0].projectId,state.targets[1].projectId);
 const pair=generateKeyPairSync('rsa',{modulusLength:2048});const pem=pair.privateKey.export({format:'pem',type:'pkcs8'});await writeFile(join(privateDirectory,'ci-jwt-private.pem'),pem,{flag:'wx',mode:0o600});
 const jwk=pair.publicKey.export({format:'jwk'}),publicKeySha256=createHash('sha256').update(JSON.stringify(jwk)).digest('hex');
 await publish('target-setup1-outcomes',{status:'ACTUAL_TWO_FRESH_DEV_TARGETS_READY_NO_DEPLOY',targets:state.targets,teamId:state.teamId,publicAuth:{issuer:'https://cortex-ci-runtime.example/',audience:'cortex-ci-runtime',algorithm:'RS256',modulusLength:2048,publicKeySha256},privateDirectory,privateKeyFile:join(privateDirectory,'ci-jwt-private.pem'),GitHubSecretWrites:0,GitHubVariableWrites:0,deploymentsIssued:0,providerCalls:0,existing3174742Untouched:true,oldProductionSelectorsUnused:true,retainedForNativeCIAndRootActivation:true});
 console.log(JSON.stringify({status:'TWO_FRESH_DEV_CI_TARGETS_VERIFIED',targets:state.targets.map(row=>({kind:row.kind,projectId:row.projectId,deploymentName:row.deploymentName,url:row.url})),modelCalls:0,GitHubWrites:0}));
}catch(error){await publish('target-setup1-outcomes',{status:'FAIL_OR_UNKNOWN',knownTargets:state.targets,error:{name:error?.name,message:String(error?.message??error).replaceAll(accessToken,'[REDACTED]').slice(0,2000)},noBlindCreateRepeat:true,noGitHubWrites:true,noModelCalls:true,privateDirectory});throw Error('TASK16_TARGET_SETUP_FAILED_SEE_PUBLIC_RECEIPT');}
