import {managementGuard,managementOperation} from './management-transport.mjs';
/** Exact owned retirement also covers a recorded partial create without target/env files. */
import { readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { reviewed as preparationReviewed, canonical, root, scratch } from './guard.mjs';
import { validateCreatedOwnership, validateRetirement } from './management-contract.mjs';
preparationReviewed();
const request=JSON.parse(readFileSync(canonical(resolve(root,'project-request.json'),root)));
const ownership=JSON.parse(readFileSync(canonical(resolve(scratch,'created-project.json'),scratch,true)));
validateCreatedOwnership(request,ownership);
const targetPath=resolve(scratch,'target.json');const target=lstatSync(targetPath,{throwIfNoEntry:false})?JSON.parse(readFileSync(canonical(targetPath,scratch,true))):undefined;
const key=process.env.CONVEX_TEAM_API_KEY;if(!key)throw new Error('Missing team management credential');
const guard=managementGuard('retire',request),operation=managementOperation('retire',request,guard,180000),api=operation.api;
try{
const before=await api(`/projects/${ownership.id}`);if(before.status!==200)throw new Error('Owned project unavailable before retirement');const project=JSON.parse(before.body);
const list=await api(`/projects/${ownership.id}/list_deployments`);if(list.status!==200)throw new Error('Owned deployment list unavailable');const deployments=JSON.parse(list.body);
if(!Array.isArray(deployments)||deployments.length!==1||typeof deployments[0].name!=='string')throw new Error('Not a sole owned deployment');
const observed=await api(`/deployments/${encodeURIComponent(deployments[0].name)}`);if(observed.status!==200)throw new Error('Owned named deployment unavailable');
const verified=validateRetirement(request,ownership,project,deployments,JSON.parse(observed.body),target);
const destination=resolve(scratch,'retirement-'+request.operation+'.json');if(lstatSync(destination,{throwIfNoEntry:false}))throw new Error('Retirement evidence already exists');
const startedAt=new Date().toISOString();const deletion=await api(`/projects/${verified.projectId}/delete`,'POST');if(deletion.status!==200)throw new Error('Owned project deletion failed');
const after=await api(`/projects/${verified.projectId}`);if(after.status!==404)throw new Error('Owned project absence not verified');
const receipt={version:1,operation:request.operation,phase:'exact-owned-project-retirement',status:'PASS',startedAt,observedAt:new Date().toISOString(),...verified,verifiedOnlyDevelopmentCloudDeployment:true,deletionHttpStatus:deletion.status,absentProjectHttpStatus:after.status,managementCalls:operation.count()};
writeFileSync(destination,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
// Initial target receipt is immutable; terminal retirement is an exclusive appended receipt.
process.stdout.write(JSON.stringify(receipt)+'\n');

operation.finish('PASS');}catch(error){try{operation.finish('FAIL',error);}catch(secondary){if(error&&typeof error==='object')Object.defineProperty(error,'qaManagementReceiptFailure',{value:secondary,enumerable:true});}throw error;}
