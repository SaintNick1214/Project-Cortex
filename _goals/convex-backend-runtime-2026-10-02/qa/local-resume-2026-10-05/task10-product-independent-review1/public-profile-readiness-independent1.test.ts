/** Actual registered public handler with controlled metadata/budget ports; no native model. */
import {it,expect} from "@jest/globals";
import {ConvexError} from "convex/values";
import {memoryFixture,registeredHandler} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeMemory/fixture";
import * as memory from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemory";
import {memoryScope} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryRepository";
import {prepareSourceContent} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/sources";
import {DEFAULT_EMBEDDING_PROFILE as small,LARGE_EMBEDDING_PROFILE as large} from "/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/profile";
it("public recall exposes trusted missing-generation readiness before any search/model",async()=>{
 const f=memoryFixture({profile:()=>large,budget:async()=>({runBudgetId:"independent-readiness",runAccountId:"runtimeBudgetAccounts:independent" as never})});
 const prepared=await prepareSourceContent(memoryScope(f.reference),{sourceId:"one",sourceEventId:"one",sourceRevision:1,role:"user",trust:"user_assertion"},"Known managed fixture",{now:()=>1000});
 f.db.seed("runtimeMemorySources",prepared.source as unknown as Record<string,unknown>);
 f.db.seed("runtimeMemoryVectorGenerations",{tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId,ownerPrincipalId:f.reference.principalId,
  sourceId:"one",sourceEventId:"one",sourceRevision:1,contentHash:prepared.source.contentHash,profile:small,receiptId:"existing-small"});
 const writes=f.db.writes;
 let code:string|undefined;
 try {await registeredHandler<unknown,unknown>(memory.recall)(f.actionCtx as never,{tenantId:"tenant-a",memorySpaceId:"space-a",text:"fixture",requestId:"independent-current-readiness",limit:5});}
 catch(error){if(!(error instanceof ConvexError))throw error;code=(error.data as {code:string}).code;}
 expect(["PROFILE_NOT_READY","CAPABILITY_UNAVAILABLE"]).toContain(code);
 expect(f.searches).toHaveLength(0);expect(f.db.writes).toBe(writes);
 expect(f.db.table("runtimeModelOperations")).toHaveLength(0);
});
