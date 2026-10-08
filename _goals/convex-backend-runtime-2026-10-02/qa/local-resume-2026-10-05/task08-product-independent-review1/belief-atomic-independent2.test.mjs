import {beforeEach,afterEach,afterAll,jest,expect,test} from "@jest/globals";
import {writeFileSync} from "node:fs";
import {ingestionFixture,installIngestionMockRoot,ingestion,candidate} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeIngestion/fixture.ts";
import {planBeliefs} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/belief-plan.ts";
import {canonicalModelJson} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/model-policy.ts";
const beliefs=await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeBeliefs.ts");
const {ConvexMemoryRepository}=await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryRepository.ts");
const observations=[];
beforeEach(()=>installIngestionMockRoot());afterEach(()=>jest.restoreAllMocks());
afterAll(()=>writeFileSync("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task08-product-independent-review1/belief-atomic-independent2.observations.json",JSON.stringify(observations,null,2)+"\n"));
const tables=["facts","runtimeBeliefHeads","runtimeBeliefHistory","runtimeBeliefOutbox","runtimeMemoryReceipts","runtimeIngestionStages","runtimeIngestionEvents"];
function snapshot(f){return canonicalModelJson(Object.fromEntries(tables.map(t=>[t,f.db.table(t)])));}
async function event(f,id,value){const source=await f.source("User prefers "+value,id);const admitted=await ingestion.enqueueSourceEvent(f.ctx,f.reference,source);await f.extraction(admitted.eventId,[candidate(value)]);const owned=await f.claim(admitted.eventId,"facts");return {source,admitted,owned};}
async function plan(f,e,action="SUPERSEDE"){
 const existing=await new ConvexMemoryRepository(f.ctx,f.reference,"write",f.ctx.db).listFacts({limit:100});
 const extract=f.db.table("runtimeIngestionStages").find(s=>s.eventId===e.admitted.eventId&&s.stage==="extract");
 return await planBeliefs({eventId:e.admitted.eventId,sequence:e.admitted.sequence,source:e.source,candidates:JSON.parse(extract.payloadCanonical),existing,
 resolve:async(_candidate,matching)=>({action,targetFactId:matching[0].factId,mergedFact:action==="UPDATE"?"User prefers updated":null,reason:"Controlled explicit correction"})});}
async function commit(f,e,p){return await f.call(beliefs.commit,{reference:f.reference,eventId:e.admitted.eventId,stage:"facts",attempt:e.owned.attempt,leaseVersion:e.owned.leaseVersion,planCanonical:canonicalModelJson(p)});}
test("current ADD commits one receipt/head/history/outbox and duplicate job cannot duplicate it",async()=>{
 const f=await ingestionFixture();const e=await event(f,"one","blue");const p=await plan(f,e);const result=await commit(f,e,p);
 expect(result.created).toBe(true);for(const t of ["facts","runtimeBeliefHeads","runtimeBeliefHistory","runtimeBeliefOutbox","runtimeMemoryReceipts"])expect(f.db.table(t)).toHaveLength(1);
 const before=snapshot(f);expect(await f.claim(e.admitted.eventId,"facts")).toBeNull();expect(snapshot(f)).toBe(before);
 observations.push({case:"single-atomic-positive",result,rows:JSON.parse(before)});expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
test("concurrent consumed-fact version change rejects the entire belief commit without partial receipt/history/outbox",async()=>{
 const f=await ingestionFixture();const first=await event(f,"first","blue");await commit(f,first,await plan(f,first));
 const second=await event(f,"second","red");const p=await plan(f,second,"UPDATE");const fact=f.db.table("facts")[0];await f.db.patch("facts",fact._id,{version:fact.version+1,fact:"Concurrent current edit"});
 const before=snapshot(f);await expect(commit(f,second,p)).rejects.toMatchObject({data:{code:"FACT_VERSION_CONFLICT"}});expect(snapshot(f)).toBe(before);
 expect(f.db.table("runtimeBeliefHistory")).toHaveLength(1);expect(f.db.table("facts")[0].fact).toBe("Concurrent current edit");observations.push({case:"whole-readset-CAS-negative",plan:p,rows:JSON.parse(before)});
});
test("older source completing after newer correction cannot supersede the newer head even after replanning from its current readset",async()=>{
 const f=await ingestionFixture();const old=await event(f,"old","blue");const newer=await event(f,"newer","red");await commit(f,newer,await plan(f,newer));
 const p=await plan(f,old);const before=snapshot(f);await expect(commit(f,old,p)).rejects.toMatchObject({data:{code:"BELIEF_ORDER_CONFLICT"}});expect(snapshot(f)).toBe(before);
 expect(f.db.table("facts")).toHaveLength(1);expect(f.db.table("facts")[0].object).toBe("red");expect(f.db.table("runtimeBeliefHeads")[0].sequence).toBe(newer.admitted.sequence);observations.push({case:"reverse-source-order-negative",plan:p,rows:JSON.parse(before)});
});
