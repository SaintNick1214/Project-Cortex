import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixture, sha256 } from './guard.mjs';
import { validateRetirement } from './management-contract.mjs';
const request=JSON.parse(readFileSync(resolve(fixture,'project-request.json'))),ownership={operation:request.operation,requestSha256:sha256(JSON.stringify(request)),id:123,slug:request.projectSlug,requestedName:request.projectName,startedAt:new Date().toISOString(),deploymentName:'offline-owned-123'};
const project={id:123,slug:request.projectSlug,name:request.projectName},deployment={name:'offline-owned-123',projectId:123,kind:'cloud',deploymentType:'dev',deploymentUrl:'https://offline-owned-123.convex.cloud'},list=[deployment];
assert.equal(validateRetirement(request,ownership,project,list,deployment).provisionState,'REQUEST_OWNED_PARTIAL_RECOVERY');
let negatives=0;
for(const bad of [{...ownership,id:456},{...ownership,requestSha256:'wrong'},{...ownership,deploymentName:'foreign-123'}]){assert.throws(()=>validateRetirement(request,bad,project,list,deployment));negatives++;}
for(const bad of [{...deployment,deploymentType:'prod'},{...deployment,kind:'self-hosted'},{...deployment,projectId:456},{...deployment,deploymentUrl:'https://foreign.convex.cloud'}]){assert.throws(()=>validateRetirement(request,ownership,project,[bad],bad));negatives++;}
assert.throws(()=>validateRetirement(request,ownership,project,[deployment,{...deployment,name:'second-prod'}],deployment));negatives++;
assert.throws(()=>validateRetirement(request,ownership,{...project,name:'shared'},list,deployment));negatives++;
assert.throws(()=>validateRetirement(request,ownership,project,list,deployment,{...request,projectId:999}));negatives++;
console.log(JSON.stringify({scope:'OFFLINE_MANAGEMENT_CONTRACT',status:'PASS',partialRecoveryPrepared:true,negativeControls:negatives,dispatches:0}));
