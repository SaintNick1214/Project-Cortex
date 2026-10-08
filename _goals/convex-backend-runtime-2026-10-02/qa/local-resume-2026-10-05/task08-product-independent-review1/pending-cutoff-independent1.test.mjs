import {beforeEach, afterAll, expect, test} from "@jest/globals";
import {writeFileSync} from "node:fs";
import {ingestionFixture, installIngestionMockRoot} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeIngestion/fixture.ts";
import {runs} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeTranscript/fixture.ts";
import {readPendingContext} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryContext.ts";
import {contextSourceKey} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/memory-context.ts";
const observations=[];
beforeEach(()=>installIngestionMockRoot());
afterAll(()=>writeFileSync("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task08-product-independent-review1/pending-cutoff-independent1.observations.json",JSON.stringify(observations,null,2)+"\n"));
async function submit(f,key,text,conversationId){ return await f.call(runs.submit,{request:{...f.request(key,conversationId),parts:[{type:"text",text}]}}); }
async function pending(f,a){const owned=await f.call(runs.claimNext,{reference:f.reference,conversationId:a.conversationId,leaseMs:300000});
 const snapshot=owned.snapshot; const represented=snapshot.messages.map(pin=>contextSourceKey(f.reference,{...pin,sourceId:pin.sourceEventId}));
 const tail=await readPendingContext(f.ctx,{reference:f.reference,cutoff:snapshot.ingestionCutoff.sequence,alreadyRepresented:represented,maxBytes:16384,
   runId:a.runId,conversationId:a.conversationId,queueSequence:snapshot.queueSequence,anchor:snapshot.anchor});
 return {owned,snapshot,tail}; }
test("later queued same-thread input is excluded from an earlier turn's pending context",async()=>{
 const f=await ingestionFixture(); const a=await submit(f,"A","ANCHOR_CURRENT_A"); const b=await submit(f,"B","FUTURE_QUEUED_B_SENTINEL",a.conversationId);
 const value=await pending(f,a); observations.push({case:"queued-future-negative",a,b,...value,events:f.db.table("runtimeIngestionEvents"),facts:f.db.table("facts"),jobs:f.db.table("runtimeIngestionJobs")});
 expect(value.snapshot.messages.some(pin=>b.inputMessageIds?.includes(pin.nativeMessageId))).toBe(false);
 expect(value.tail.completeness).toBe("complete"); expect(value.tail.text).not.toContain("FUTURE_QUEUED_B_SENTINEL");
 expect(f.db.table("runtimeIngestionJobs")).toHaveLength(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
test("authorized older cross-thread pending source remains included",async()=>{
 const f=await ingestionFixture(); const other=await submit(f,"other","AUTHORIZED_OTHER_THREAD_SENTINEL"); const a=await submit(f,"A","ANCHOR_CURRENT_A");
 const value=await pending(f,a); observations.push({case:"cross-thread-positive",other,a,...value});
 expect(other.conversationId).not.toBe(a.conversationId); expect(value.tail.completeness).toBe("complete"); expect(value.tail.text).toContain("AUTHORIZED_OTHER_THREAD_SENTINEL");
 expect(f.db.table("runtimeIngestionJobs")).toHaveLength(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
