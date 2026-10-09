/** Reuse the established sole owned target/issuer; no credential values are published. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {openOwnedContext,authorityReference,sha,denied,waitUntil} from '../../task13-media-functional-v2-20261008/native-actual/common.mjs';
export {authorityReference,sha,denied,waitUntil};
export const q=dirname(new URL(import.meta.url).pathname),root='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
export const qa=join(root,'_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05'),n15=join(qa,'task15-integration-functional-v2-20261008/native-actual');
export const scope={tenantId:'task03-aggregate-20261009',memorySpaceId:'aggregate03-20261009'};
export async function openNativeContext(options){
 const c=await openOwnedContext(options);
 const redact=value=>c.redact(value).replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[REDACTED_JWT]');
 const publish=async(name,value)=>{assert.match(name,/^[a-z0-9][a-z0-9._-]*$/);await writeFile(join(q,name+'.json'),redact(JSON.stringify(value,null,2))+'\n',{flag:'wx'});};
 async function verifyTarget(label){const account=JSON.parse(await readFile(join(homedir(),'.convex/config.json'))),utility=await import(pathToFileURL(join(c.host,'node_modules/@cortexmemory/cli/dist/utils/init/development-target.js')));
  const result=await utility.verifyDisposableDevelopmentTarget({teamId:c.state.teamId,projectId:c.state.projectId,deploymentName:c.state.deploymentName,deploymentUrl:c.state.url,disposable:true},account.accessToken);
  const response=await fetch('https://api.convex.dev/v1/projects/'+c.state.projectId+'/list_deployments',{headers:{Authorization:'Bearer '+account.accessToken},signal:AbortSignal.timeout(15000),redirect:'error'});assert.equal(response.status,200);const rows=await response.json();assert.equal(rows.length,1);assert.equal(rows[0].name,c.state.deploymentName);assert.equal(rows[0].deploymentType,'dev');
  await publish(label,{target:result.target,verifiedAt:result.verifiedAt,soleCloudDev:true,production:false});return result;}
 return {...c,publish,verifyTarget,redact};
}
