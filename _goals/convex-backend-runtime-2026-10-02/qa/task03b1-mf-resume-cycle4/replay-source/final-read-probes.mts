import assert from "node:assert/strict";
import {harness,identity} from "/workspace/Project-Cortex/work/resume/mf/candidate/tests/unit/runtimeEndpointAuth/sharedfixtures.ts";
import * as memories from "/workspace/Project-Cortex/work/resume/mf/candidate/convex-dev/memories.ts";
import * as facts from "/workspace/Project-Cortex/work/resume/mf/candidate/convex-dev/facts.ts";
import {provision} from "/workspace/Project-Cortex/work/resume/mf/candidate/convex-dev/runtimeAuth.ts";
const results:any[]=[];
for(const kind of ["memory","fact"] as const)for(const invalidation of ["none","revoked","expiry"] as const){
 const h=harness();const writer=await h.provisionScope({capabilities:["write"]});await h.seedData(kind==="memory"?"memories":"facts",writer,"private",{tags:["archived"]});
 const base=Date.now();const reader:any=await h.invoke(provision,{...identity,actorKind:"user",metadataUserId:writer.userId,tenantId:"tenant-a",capabilities:["read"],resourceAccess:"tenant",expiresAt:base+1000000});
 h.db.attemptedWrites=[];let readAdmission=false;let hashesAfterReadAdmission=0;let injected=false;let now=base;
 const originalNow=Date.now;Date.now=()=>now;
 h.setAuthHook(async()=>{if(h.db.attemptedWrites.some(w=>w.startsWith(kind==="memory"?"patch:memories/":"patch:facts/")))readAdmission=true;});
 const originalDigest=globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
 globalThis.crypto.subtle.digest=async(algorithm:any,data:any)=>{
  // First canonical hash is under the independent READ guard; second is the final WRITE validation.
  if(readAdmission && ++hashesAfterReadAdmission===2 && invalidation!=="none"){
   injected=true;if(invalidation==="expiry")now=base+1000001;else await h.db.patch(reader.grantId,{revokedAt:base});
  }
  return await originalDigest(algorithm,data);
 };
 try{
  const registration=kind==="memory"?memories.restoreFromArchive:facts.updateInPlace;
  const result:any=await h.invoke(registration,{memorySpaceId:"space-a",memoryId:"private",factId:"private",confidence:90});
  const privatePayload=kind==="memory"?result.memory?.content:result.fact;
  if(invalidation==="none")assert.equal(typeof privatePayload,"string");else{assert(injected);assert.equal(privatePayload,undefined,"private row was delivered after independent READ expired/revoked");}
  results.push({name:`${kind}-${invalidation}`,status:"PASS",injected,hashesAfterReadAdmission,result});
 }catch(e:any){results.push({name:`${kind}-${invalidation}`,status:e.data?.code==="FORBIDDEN"&&invalidation!=="none"?"PASS":"FAIL",injected,hashesAfterReadAdmission,error:e.stack??String(e)});}
 finally{Date.now=originalNow;globalThis.crypto.subtle.digest=originalDigest;}
}
console.log(JSON.stringify({observedAt:new Date().toISOString(),node:process.version,results},null,2));process.exitCode=results.some(r=>r.status==="FAIL")?1:0;
