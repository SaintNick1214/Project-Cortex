import assert from 'node:assert/strict';
import {getFunctionName} from 'convex/server';
import {context,write,errorSummary,hash,id} from './k9-native-negative-common.mjs';
const c=await context();let reader,revocationIssued=false,revoked=false,restored=false,before,grant,originalMetadata,postDenial,issuedResponse=false,grantAfter;
try{
 await c.verify();before=await c.snapshot();const principals=await c.table('runtimeAuthPrincipals'),grants=await c.table('runtimeAuthGrants'),scopes=await c.table('runtimeAuthScopes'),graphs=await c.table('runtimeGraphSources');
 const rp=principals.find(p=>p.subject===c.identities.reader.subject),op=principals.find(p=>p.subject===c.identities.owner.subject);assert.ok(rp&&op&&rp._id!==op._id);
 const active=grants.filter(g=>g.principalId===rp._id&&g.tenantId===c.s.publicRuntime.tenantId&&g.memorySpaceId===c.s.publicRuntime.memorySpaceId&&g.revokedAt===undefined&&g.deletedAt===undefined);assert.equal(active.length,1);grant=active[0];
 assert.deepEqual([...grant.capabilities].sort(),['read','storage:read']);assert.equal(grant.resourceAccess,'space');assert.equal(graphs.filter(g=>g.authorityReference?.grantId===grant._id).length,0);
 const identity=c.identities.reader;assert.equal(identity.issuer,rp.issuer);assert.equal(identity.subject,rp.subject);assert.equal(identity.actorKind,rp.actorKind);assert.equal(identity.metadataUserId,rp.metadataUserId);assert.equal(identity.tenantId,grant.tenantId);assert.equal(identity.memorySpaceId,grant.memorySpaceId);assert.equal(identity.resourceAccess,grant.resourceAccess);assert.equal(identity.expiresAt,grant.expiresAt);assert.deepEqual([...identity.capabilities].sort(),[...grant.capabilities].sort());
 const ownerGrants=grants.filter(g=>g.principalId===op._id);assert.ok(ownerGrants.every(g=>g._id!==grant._id));originalMetadata={readerGrant:grant,readerPrincipal:rp,ownerGrants,scopeDigest:hash(scopes),graphDigest:hash(graphs),restoreIdentity:c.identities.reader};
 await write('reader-grant-before',originalMetadata);
 let triggered=false;
 reader=c.sdk('reader',{hook:async(reference,result)=>{
   if(!triggered&&getFunctionName(reference)==='runtimeMemory:defaultProfile'){
     triggered=true;assert.equal(result.profile.profileId,'cortex-text-small-1536-v1');issuedResponse=true;
     await c.verify();revocationIssued=true;await c.admin.mutation('runtimeAuth:revokeGrant',{grantId:grant._id});revoked=true;
     const after=await c.table('runtimeAuthGrants');assert.deepEqual(after.filter(g=>g.principalId===op._id),ownerGrants);assert.equal(hash(await c.table('runtimeAuthScopes')),originalMetadata.scopeDigest);assert.equal(hash(await c.table('runtimeGraphSources')),originalMetadata.graphDigest);
   }
   return result;
 }});
 let delivered=false;try{await reader.client.getDefaultProfile();delivered=true;}catch(e){postDenial=errorSummary(e);}
 assert.equal(triggered,true);assert.equal(issuedResponse,true);assert.equal(delivered,false);assert.equal(postDenial.code,'FORBIDDEN');
 assert.ok(reader.events.some(e=>e.method==='runtimeMemory:defaultProfile'&&e.phase==='rpc.end'));assert.ok(reader.events.some(e=>e.method==='runtimeClient:session'&&e.phase==='rpc.failed'));
} catch(error){await write('post-revoke-failure',{observedAt:new Date().toISOString(),error:errorSummary(error),revoked,issuedResponse,restored});process.exitCode=1;} finally{
 if(revocationIssued&&!revoked){try{await c.verify();revoked=(await c.table('runtimeAuthGrants')).find(g=>g._id===grant._id)?.revokedAt!==undefined;}catch(error){await write('reader-revoke-ambiguity',{error:errorSummary(error),revocationIssued,revoked});process.exitCode=1;}}
 if(revoked){
   try{
    await c.verify();const authority=await c.admin.mutation('runtimeAuth:provision',c.identities.reader);assert.equal(authority.principalId,originalMetadata.readerPrincipal._id);assert.deepEqual([...authority.capabilities].sort(),['read','storage:read']);
    const grants=await c.table('runtimeAuthGrants');grantAfter=grants.find(g=>g._id===authority.grantId);assert.ok(grantAfter);assert.equal(grantAfter.version,grant.version+1);for(const key of ['principalId','membershipId','tenantId','memorySpaceId','tenantEpoch','memorySpaceEpoch','resourceAccess','expiresAt'])assert.equal(grantAfter[key],grant[key]);assert.deepEqual([...grantAfter.capabilities].sort(),[...grant.capabilities].sort());assert.notEqual(grantAfter._id,grant._id);assert.equal(grants.find(g=>g._id===grant._id).revokedAt!==undefined,true);assert.deepEqual(grants.filter(g=>g.principalId===originalMetadata.ownerGrants[0].principalId),originalMetadata.ownerGrants);assert.equal(hash(await c.table('runtimeAuthScopes')),originalMetadata.scopeDigest);assert.equal(hash(await c.table('runtimeGraphSources')),originalMetadata.graphDigest);
    const fresh=c.sdk('reader');const profile=await fresh.client.getDefaultProfile();assert.equal(profile.profile.profileId,'cortex-text-small-1536-v1');await fresh.close();restored=true;
   }catch(error){await write('reader-restoration-failure',{observedAt:new Date().toISOString(),error:errorSummary(error),revoked,restored,oldGrantId:grant?._id});process.exitCode=1;}
 }
 if(reader)await reader.close();
 if(before&&restored&&postDenial){const after=await c.snapshot();assert.deepEqual(after.counts,before.counts);assert.deepEqual(after.hashes,before.hashes);assert.deepEqual(after.financial,before.financial);
  const destination=await write('post-revoke-outcome',{observedAt:new Date().toISOString(),target:{sessionId:id,...c.s.target},sdk:c.sdkIdentity,realProfileResponseReceivedBeforeRevoke:issuedResponse,sdkCallerNeverReceivedStaleResponse:true,postDenial,freshPostSessionFailed:true,originalReaderGrantId:grant._id,newReaderGrantId:grantAfter._id,oldVersion:grant.version,newVersion:grantAfter.version,readOnlyGrantRestoredAndFreshAccessVerified:true,ownerGrantsScopeEpochsGraphRowsUnchanged:true,before:{counts:before.counts,hashes:before.hashes,financial:before.financial},after:{counts:after.counts,hashes:after.hashes,financial:after.financial},paidCalls:0,newRunsOrEffects:0,freshVerifications:c.verifications(),scope:'Actual SDK metadata return-after-revoke with existing reader read-onlygrant; no owner-private observe-envelope late-revocation coverage because reader lacks original conversation ACL. No ACL broadened.'});console.log(JSON.stringify({receipt:destination,postDenialCode:postDenial.code,restored,paidCalls:0}));
 }
 await c.close();
}
