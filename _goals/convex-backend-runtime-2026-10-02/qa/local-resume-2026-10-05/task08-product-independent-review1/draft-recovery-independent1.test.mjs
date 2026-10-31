import {beforeEach,afterEach,afterAll,jest,expect,test} from "@jest/globals";
import {writeFileSync} from "node:fs";
import {ingestionFixture,installIngestionMockRoot,ingestion,candidate} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeIngestion/fixture.ts";
import {planBeliefs} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/belief-plan.ts";
import {canonicalModelJson} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/model-policy.ts";
import {prepareSourceContent,processingIdentityKey} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/sources.ts";
import {DEFAULT_EMBEDDING_PROFILE} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile.ts";
const beliefs=await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeBeliefs.ts");
const {ConvexMemoryRepository}=await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryRepository.ts");
const context=await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryContext.ts");
const observations=[];
beforeEach(()=>installIngestionMockRoot());afterEach(()=>jest.restoreAllMocks());
afterAll(()=>writeFileSync("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task08-product-independent-review1/draft-recovery-independent1.observations.json",JSON.stringify(observations,null,2)+"\n"));
const tables=["facts","runtimeBeliefHeads","runtimeBeliefHistory","runtimeBeliefOutbox","runtimeMemoryReceipts","runtimeMemoryChunks","runtimeMemoryVectors","runtimeIngestionStages","runtimeIngestionEvents","runtimeModelOperations","runtimeModelAttempts","runtimeBudgetAccounts"];
function snapshot(f){return canonicalModelJson(Object.fromEntries(tables.map(t=>[t,f.db.table(t)])));}
function lease(f,eventId,stage,owned){return {reference:f.reference,eventId,stage,attempt:owned.attempt,leaseVersion:owned.leaseVersion};}
async function facts(f,id="draft",value="blue"){
 const source=await f.source("User prefers "+value,id);const event=await ingestion.enqueueSourceEvent(f.ctx,f.reference,source);await f.extraction(event.eventId,[candidate(value)]);const owned=await f.claim(event.eventId,"facts");
 const existing=await new ConvexMemoryRepository(f.ctx,f.reference,"write",f.ctx.db).listFacts({limit:100});const extract=f.db.table("runtimeIngestionStages").find(s=>s.eventId===event.eventId&&s.stage==="extract");
 const plan=await planBeliefs({eventId:event.eventId,sequence:event.sequence,source,candidates:JSON.parse(extract.payloadCanonical),existing,
 resolve:async(_candidate,matching)=>({action:"UPDATE",targetFactId:matching[0].factId,mergedFact:"User prefers "+value,reason:"Explicit current correction"})});
 const args=lease(f,event.eventId,"facts",owned);await f.call(ingestion.persistDraft,{...args,payloadCanonical:canonicalModelJson(plan)});return {source,event,owned,plan,args};
}
async function expire(f,args){const stage=f.db.table("runtimeIngestionStages").find(s=>s.eventId===args.eventId&&s.stage===args.stage);await f.db.patch("runtimeIngestionStages",stage._id,{leaseExpiresAt:Date.now()-1});await f.call(ingestion.expireStage,args);expect(f.db.table("runtimeIngestionStages").find(s=>s._id===stage._id).state).toBe("unknown");}
test("confirmed facts draft recovers after expiry exactly once, without a new operation or model attempt",async()=>{
 const f=await ingestionFixture();const d=await facts(f);await expire(f,d.args);const operations=canonicalModelJson(f.db.table("runtimeModelOperations"));
 const result=await f.call(ingestion.reconcile,{eventId:d.event.eventId,stage:"facts"});expect(result.reconciled).toBe(true);for(const t of ["facts","runtimeBeliefHeads","runtimeBeliefHistory","runtimeBeliefOutbox","runtimeMemoryReceipts"])expect(f.db.table(t)).toHaveLength(1);
 const once=snapshot(f);expect(await f.call(ingestion.reconcile,{eventId:d.event.eventId,stage:"facts"})).toEqual(result);expect(snapshot(f)).toBe(once);expect(canonicalModelJson(f.db.table("runtimeModelOperations"))).toBe(operations);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);observations.push({case:"facts-expiry-recovery",result,rows:JSON.parse(once)});
});
test("confirmed default1536 vector draft recovers after expiry once and cannot create duplicate chunks/vectors",async()=>{
 const f=await ingestionFixture();const d=await facts(f);await f.call(beliefs.commit,{...d.args,planCanonical:canonicalModelJson(d.plan)});const owned=await f.claim(d.event.eventId,"vectors");const args=lease(f,d.event.eventId,"vectors",owned);
 const prepared=await prepareSourceContent(f.reference,d.source.lineage,d.source.content,{now:()=>d.source.createdAt},DEFAULT_EMBEDDING_PROFILE);
 const identity={sourceId:d.source.lineage.sourceId,sourceEventId:d.source.lineage.sourceEventId,sourceRevision:d.source.lineage.sourceRevision,stage:"vectors",semanticPolicyVersion:DEFAULT_EMBEDDING_PROFILE.profileId};const receiptId=await processingIdentityKey(identity);
 const payload={source:{sourceId:identity.sourceId,sourceEventId:identity.sourceEventId,sourceRevision:identity.sourceRevision},identity,chunks:prepared.chunks,vectors:prepared.chunks.map((chunk,i)=>({sourceId:identity.sourceId,sourceEventId:identity.sourceEventId,sourceRevision:identity.sourceRevision,vectorId:"saved-vector-"+i,chunkId:chunk.chunkId,tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId,profile:DEFAULT_EMBEDDING_PROFILE,embedding:new Array(1536).fill(0.25),processingReceiptId:receiptId}))};
 await f.call(ingestion.persistDraft,{...args,payloadCanonical:canonicalModelJson(payload)});await expire(f,args);const result=await f.call(ingestion.reconcile,{eventId:d.event.eventId,stage:"vectors"});expect(result).toEqual({reconciled:true,receiptId});expect(f.db.table("runtimeMemoryVectors")).toHaveLength(prepared.chunks.length);expect(f.db.table("runtimeMemoryChunks")).toHaveLength(prepared.chunks.length);expect(f.db.table("runtimeMemoryVectors")[0].embedding).toHaveLength(1536);
 const once=snapshot(f);expect(await f.call(ingestion.reconcile,{eventId:d.event.eventId,stage:"vectors"})).toEqual(result);expect(snapshot(f)).toBe(once);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);observations.push({case:"vectors-expiry-recovery",result,chunkCount:prepared.chunks.length,rows:JSON.parse(once)});
});
test("changed consumed fact produces observable REPLAN_REQUIRED without a partial receipt/head/history/outbox",async()=>{
 const f=await ingestionFixture();const a=await facts(f,"initial","blue");await f.call(beliefs.commit,{...a.args,planCanonical:canonicalModelJson(a.plan)});const d=await facts(f,"correction","red");await expire(f,d.args);const fact=f.db.table("facts")[0];await f.db.patch("facts",fact._id,{version:fact.version+1,fact:"Concurrent durable edit"});
 const protectedTables=["facts","runtimeBeliefHeads","runtimeBeliefHistory","runtimeBeliefOutbox","runtimeMemoryReceipts"];const before=canonicalModelJson(Object.fromEntries(protectedTables.map(t=>[t,f.db.table(t)])));
 expect(await f.call(ingestion.reconcile,{eventId:d.event.eventId,stage:"facts"})).toEqual({reconciled:false,receiptId:null,failureCode:"REPLAN_REQUIRED"});expect(canonicalModelJson(Object.fromEntries(protectedTables.map(t=>[t,f.db.table(t)])))).toBe(before);expect(f.db.table("runtimeIngestionStages").find(s=>s.eventId===d.event.eventId&&s.stage==="facts")).toMatchObject({state:"failed",failureCode:"REPLAN_REQUIRED"});observations.push({case:"recovery-CAS-negative",protected:JSON.parse(before)});
});
test.each(["tombstone","revision","grant","policy"])("%s invalidation denies saved-draft recovery before any effect",async mode=>{
 const f=await ingestionFixture();const d=await facts(f);await expire(f,d.args);
 if(mode==="tombstone")f.db.seed("runtimeAuthTombstones",{tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId,resourceType:"source",resourceId:d.source.lineage.sourceId,deletedAt:Date.now()});
 if(mode==="revision")await f.source("User prefers red",d.source.lineage.sourceId,2);
 if(mode==="grant")f.grant.revokedAt=Date.now();
 if(mode==="policy"){const s=f.db.table("runtimeIngestionStages").find(s=>s.eventId===d.event.eventId&&s.stage==="facts");const p=JSON.parse(s.policyCanonical);p.limits.outputTokens-=1;await f.db.patch("runtimeIngestionStages",s._id,{policyCanonical:canonicalModelJson(p)});}
 const before=snapshot(f);await expect(f.call(ingestion.reconcile,{eventId:d.event.eventId,stage:"facts"})).rejects.toThrow();expect(snapshot(f)).toBe(before);expect(f.db.table("facts")).toHaveLength(0);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);observations.push({case:"recovery-invalidation-"+mode,rows:JSON.parse(before)});
});
test("unknown without a confirmed facts draft cannot be reconciled or silently requeued",async()=>{
 const f=await ingestionFixture();const source=await f.source("User prefers blue");const event=await ingestion.enqueueSourceEvent(f.ctx,f.reference,source);await f.extraction(event.eventId,[candidate("blue")]);const owned=await f.claim(event.eventId,"facts");await expire(f,lease(f,event.eventId,"facts",owned));
 const before=snapshot(f);await expect(f.call(ingestion.reconcile,{eventId:event.eventId,stage:"facts"})).rejects.toMatchObject({data:{code:"RECONCILIATION_NOT_SAFE"}});expect(snapshot(f)).toBe(before);expect(f.db.table("facts")).toHaveLength(0);observations.push({case:"unknown-no-draft-negative",rows:JSON.parse(before)});
});
test("space editor can repair a different owner's source without transferring ownership or misbinding the extract parent",async()=>{
 const f=await ingestionFixture();f.grant.resourceAccess="space";const own=await f.source("User prefers blue","shared-source");const source={...own,ownerPrincipalId:"other-source-owner"};await f.db.patch("runtimeMemorySources",f.db.table("runtimeMemorySources")[0]._id,{ownerPrincipalId:source.ownerPrincipalId});
 const event=await ingestion.enqueueSourceEvent(f.ctx,f.reference,source);expect(f.db.table("runtimeIngestionEvents")[0]).toMatchObject({ownerPrincipalId:source.ownerPrincipalId,authorityReference:f.reference});await f.extraction(event.eventId,[candidate("blue")]);const owned=await f.claim(event.eventId,"facts");expect(owned.parentOperationId).toBe(f.db.table("runtimeModelOperations")[0]._id);expect(f.db.table("runtimeModelOperations")[0].principalId).toBe(f.reference.principalId);
 const plan=await planBeliefs({eventId:event.eventId,sequence:event.sequence,source,candidates:JSON.parse(f.db.table("runtimeIngestionStages").find(s=>s.stage==="extract").payloadCanonical),existing:[],resolve:async()=>{throw Error("Unexpected paid resolution");}});await f.call(beliefs.commit,{...lease(f,event.eventId,"facts",owned),planCanonical:canonicalModelJson(plan)});expect(f.db.table("facts")[0].ownerPrincipalId).toBe(source.ownerPrincipalId);expect(f.db.table("runtimeMemorySources")[0].ownerPrincipalId).toBe(source.ownerPrincipalId);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);observations.push({case:"shared-editor-positive",sourceOwner:source.ownerPrincipalId,billingPrincipal:f.reference.principalId,rows:JSON.parse(snapshot(f))});
});
test("own-only admin cannot enqueue another owner's source or read whole-scope diagnostic activity",async()=>{
 const f=await ingestionFixture();const own=await f.source("Foreign private activity");const foreign={...own,ownerPrincipalId:"foreign-owner"};await f.db.patch("runtimeMemorySources",f.db.table("runtimeMemorySources")[0]._id,{ownerPrincipalId:foreign.ownerPrincipalId});const before=snapshot(f);
 await expect(ingestion.enqueueSourceEvent(f.ctx,f.reference,foreign)).rejects.toMatchObject({data:{code:"FORBIDDEN"}});expect(snapshot(f)).toBe(before);await expect(f.call(context.status,{memorySpaceId:f.reference.memorySpaceId})).rejects.toMatchObject({data:{code:"FORBIDDEN"}});expect(f.db.table("runtimeIngestionEvents")).toHaveLength(0);observations.push({case:"shared-owner-negative",rows:JSON.parse(before)});
});
