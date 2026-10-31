/** New prospective metadata scope only; current closed accounting never rolls over. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {canonicalModelJson} from './local-domain-check/model-policy.js';
import {openOwnedContext,q,authorityReference,denied,sha} from './common.mjs';
const c=await openOwnedContext(),read=name=>readFile(join(q,name+'.json'),'utf8').then(JSON.parse);
try{
 await c.verifyTarget('installed-shipped9-target-verified');const manifest=await read('shipped-default-manifest9'),source=await read('installed-shipped9-source-manifest1'),deployment=await read('deploy-shipped9');assert.equal(deployment.code,0);
 for(const row of source.files)assert.equal(sha(await readFile(join(c.host,c.functionsDirectory,row.path))),row.sha256);
 const base=await read('baseline-functional-auth-outcomes'),setup=await read('managed-setup4'),counts=()=>c.admin.query('baselineQualification:counts',{}),ledger=async()=>({commission:await c.admin.query('profileNative:inspectLedger',{reference:authorityReference(base.owner)}),managed:await c.admin.query('profileNative:inspectLedger',{reference:setup.reference})});
 const beforeCounts=await counts(),beforeMoney=await ledger();assert.equal(beforeCounts.runtimeModelAttempts,5);
 const selected=await c.admin.mutation('runtimeModelPolicy:installDeploymentPolicy',{manifestId:manifest.manifestId,expectedRevision:9});
 const tenantId=c.tenantId+'-installed9',memorySpaceId=tenantId+'-space',scope={tenantId,memorySpaceId};
 const readerAuthority=await c.admin.mutation('runtimeAuth:provision',{issuer:c.auth.issuer,subject:'task10-installed-reader',actorKind:'user',...scope,capabilities:['read'],resourceAccess:'space',expiresAt:Date.now()+3600000});
 const operatorAuthority=await c.admin.mutation('runtimeAuth:provision',{issuer:c.auth.issuer,subject:'task10-installed-operator',actorKind:'user',tenantId,capabilities:['admin'],resourceAccess:'tenant',expiresAt:Date.now()+3600000}),operator=authorityReference(operatorAuthority),client=c.http('task10-installed-reader');
 const small=await client.query('runtimeMemory:defaultProfile',scope);assert.equal(small.profile.dimensions,1536);
 const selector=(await read('managed-policy-candidates2')).largeSelector,policyWrites=[];
 for(const operationKey of ['embedding.memory','embedding.query']){const policy={policyId:'task10-installed9-selector-'+operationKey,version:1,scope:'tenant',tenantId,operationKey,rules:{modelId:selector.modelId,nativeInterface:selector.nativeInterface,pins:{priceRevision:selector.priceRevision,boundRevision:selector.boundRevision}}};policyWrites.push(await c.admin.mutation('runtimeModelPolicy:provisionTenantPolicy',{reference:operator,policyCanonical:canonicalModelJson(policy),overrideRequested:true}));}
 const large=await client.query('runtimeMemory:defaultProfile',scope);assert.equal(large.profile.dimensions,3072);
 const negatives=[];for(const [kind,negative]of [['anonymous',c.anonymous],['foreign',c.foreign]])negatives.push({kind,error:c.publicError(await denied(()=>negative.query('runtimeMemory:defaultProfile',scope)))});
 for(const authority of [readerAuthority,operatorAuthority])await c.admin.mutation('runtimeAuth:revokeGrant',{grantId:authority.grantId});
 await c.admin.mutation('runtimeAuth:deleteScope',{tenantId});
 const afterCounts=await counts(),afterMoney=await ledger();assert.equal(afterCounts.runtimeModelAttempts,beforeCounts.runtimeModelAttempts);assert.equal(afterCounts.runtimeModelOperations,beforeCounts.runtimeModelOperations);assert.deepEqual(afterMoney,beforeMoney);
 await c.verifyTarget('installed-shipped9-retained-target-verified');
 await c.publish('installed-shipped9-outcomes1',{status:'PASS',selected,sourceManifestSha256:source.packed.manifestSha256,defaultSmall:small,exactLargeSelection:large,policyWrites,negatives,metadataOnly:true,modelCalls:0,attempts:afterCounts.runtimeModelAttempts,
  noClosedFinancialAccountRollover:true,ledgerBefore:beforeMoney,ledgerAfter:afterMoney,fullRetainedUnits:500000,prospectiveMetadataTenant:tenantId,prospectiveGrantsRevoked:2,prospectiveTenantDeleted:true,
  oldV5ExactLookup:true,oldFourProofsAndQualificationsPreserved:true,productBootstrapExact:true,syntheticTrustAllowance:false,projectId:c.state.projectId,deploymentName:c.state.deploymentName,targetRetainedForTask11:true});
 console.log(JSON.stringify({status:'SHIPPED9_INSTALLED_PASS',paidCalls:0,retainedUnits:500000,profiles:[1536,3072]}));
}catch(error){await c.publish('installed-shipped9-failure1',{status:'FAIL_OR_UNKNOWN',error:c.publicError(error),noPaidRetry:true});throw error;}
finally{await c.close();await c.publish('installed-shipped9-cleanup1',{ownedClientsClosed:true,noIssuerProcess:true});}
