import assert from 'node:assert/strict';
import { readFileSync, lstatSync, mkdtempSync, writeFileSync, symlinkSync, linkSync, chmodSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { preparation, repo, fixture, scratch, sourcePreflight, validateTarget, sha256, canonical, livePreflight } from './guard.mjs';
sourcePreflight();
const request = JSON.parse(readFileSync(resolve(fixture,'project-request.json')));
const target = { ...request,requestSha256:sha256(JSON.stringify(request)),kind:'cloud',deploymentType:'dev',active:true,retired:false,deleted:false,isolationVerified:true,productionDeployment:false,sharedCiTarget:false,projectId:123,createdAt:new Date().toISOString(),deploymentName:'offline-only-123',deploymentUrl:'https://offline-only-123.convex.cloud' };
const values = {CONVEX_DEPLOYMENT:'dev:offline-only-123',CONVEX_URL:target.deploymentUrl,CONVEX_DEPLOY_KEY:'dev:offline-only-123|offline-test-placeholder'};
validateTarget(target,request,values);
let negatives = 0;
for (const patch of [{operation:'wrong'},{requestSha256:'wrong'},{projectSlug:'shared-target'},{productionDeployment:true},{deploymentType:'prod'},{active:false},{retired:true},{isolationVerified:false},{sharedCiTarget:true},{deploymentUrl:'https://foreign.convex.cloud'},{privateEnvironmentFile:'work/foreign.env'},{projectId:0}]) {
 assert.throws(()=>validateTarget({...target,...patch},request,values));negatives++;
}
for (const inherited of [{CONVEX_DEPLOYMENT:'dev:foreign'},{CONVEX_URL:'https://foreign.convex.cloud'},{CONVEX_DEPLOY_KEY:'dev:foreign|placeholder'},{CONVEX_OVERRIDE_ACCESS_TOKEN:'placeholder'}]) {assert.throws(()=>validateTarget(target,request,values,inherited));negatives++;}
assert.throws(()=>validateTarget(target,request,{...values,OPENAI_API_KEY:'placeholder'}));negatives++;
assert.throws(()=>canonical(resolve(scratch,'../qualification'),scratch));negatives++;
assert.throws(()=>livePreflight());negatives++;
const ledger=JSON.parse(readFileSync(resolve(preparation,'path-ledger.json')));
assert.equal(ledger.cases.length,259); assert.equal(new Set(ledger.cases.map(row=>row.path)).size,259);
assert.equal(ledger.cases.filter(row=>row.visibility==='public').length,200);
assert.equal(ledger.cases.filter(row=>row.visibility==='internal').length,59);
const tamper=mkdtempSync(resolve(repo,'work/backend-runtime/task03-foundation-live-c10/preflight-'));
try{const file=resolve(tamper,'private.json');writeFileSync(file,'{}',{mode:0o600});canonical(file,repo,true);
 symlinkSync(file,resolve(tamper,'alias'));assert.throws(()=>canonical(resolve(tamper,'alias'),repo,true));negatives++;
 symlinkSync(resolve(tamper,'missing-dir'),resolve(tamper,'missing-alias'));assert.throws(()=>canonical(resolve(tamper,'missing-alias/file'),repo));negatives++;
 linkSync(file,resolve(tamper,'hardlink'));assert.throws(()=>canonical(file,repo,true));negatives++;rmSync(resolve(tamper,'hardlink'));
 chmodSync(file,0o644);assert.throws(()=>canonical(file,repo,true));negatives++;
 assert.throws(()=>canonical(resolve(tamper,'missing'),repo,true));negatives++;
}finally{rmSync(tamper,{recursive:true});}
const extra=resolve(fixture,'fixture/convex/qualificationUnreviewed'+Date.now()+'.ts');try{writeFileSync(extra,'export const inert = true;\n',{flag:'wx'});assert.throws(()=>sourcePreflight());negatives++;}finally{rmSync(extra);}
assert.equal(lstatSync(scratch).mode & 0o777,0o700);
console.log(JSON.stringify({scope:'OFFLINE_ONLY',status:'PASS',negativeControls:negatives,registered:259,public:200,internal:59,liveQualification:'BLOCKED',dispatches:0,signatures:0}));
