import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preparation } from './guard.mjs';
import { offlineCandidateContext as ctx } from './offline-arguments-check.mjs';
import { prepare as prepareMf, offlineDenialControls } from '../cases/mf-registry-artifacts.mjs';
import { prepare as prepareMwd } from '../cases/metadata-worker-domain.mjs';
const rows=[];ctx.operator=async(name,args)=>{assert.equal(name,'seed');return args.rows.map((entry,index)=>{rows.push(entry);const ref={table:entry.table,id:'OFFLINE_SHAPE_ONLY_'+entry.table+'_'+index};ctx.refs.push(ref);return ref;});};ctx.seed=rows=>ctx.operator('seed',{rows});
for(const key of ['reader','writer','foreign','revoked','deleted','admin','ungranted']){ctx.users[key]??=ctx.run+':user-'+key;ctx.principals[key]??='OFFLINE_PRINCIPAL_'+key;ctx.grants[key]??='OFFLINE_GRANT_'+key;ctx.references[key]??={principalId:ctx.principals[key],principalVersion:1,membershipId:'OFFLINE_MEMBERSHIP_'+key,membershipVersion:1,grantId:ctx.grants[key],grantVersion:1,tenantId:ctx.scopes.tenantId,memorySpaceId:ctx.scopes.memorySpaceId,tenantEpoch:1,memorySpaceEpoch:1};}
const suites=[await prepareMf(ctx),await prepareMwd(ctx)];assert.deepEqual(suites.map(suite=>suite.cases.length),[122,8]);assert.equal(suites.flatMap(suite=>suite.cases).length,130);
const controls=offlineDenialControls();assert.equal(controls.serviceCalls,0);
const ledger=JSON.parse(readFileSync(resolve(preparation,'path-ledger.json')));assert.equal(ledger.cases.filter(row=>row.safeClosure).length,67);assert.equal(ledger.cases.filter(row=>row.visibility==='public').length,200);assert.equal(ledger.cases.filter(row=>row.group==='model-policy-delta').length,16);
console.log(JSON.stringify({scope:'OFFLINE_AUTHORING_AND_ASSERTION_CONSERVATION_ONLY',status:'PASS',mfDescriptors:122,mwdDescriptors:8,totalFunctionalDescriptors:130,safeClosurePaths:67,originalPublicPaths:200,addedInternalPaths:16,actualLiveOutcomes:0,externalRequests:0,denialControls:controls}));
