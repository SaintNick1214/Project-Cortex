import {jest,expect,it,beforeEach,afterEach} from "@jest/globals";
import {getFunctionName} from "convex/server";
jest.unstable_mockModule("@convex-dev/workflow",()=>({WorkflowManager:class{define(i){return {_handler:i.handler}}async start(){return "workflow:independent"}async sendEvent(){}async cancel(){}}}));
const {transcriptFixture,installMockRoot,transcript,runs,invoke}=await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeTranscript/fixture.ts");
const runtime=await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeAgent.ts");
const definitions=await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/agentDefinitions.ts");
const memory=await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemory.ts");
const {prepareSourceContent}=await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/src/domain/sources.ts");
const {explicitSourceLineage}=await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryServices.ts");
const {memoryScope}=await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/convex-dev/runtimeMemoryRepository.ts");
const {assertNativeArgs}=await import("/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/tests/unit/runtimeAgent/native-arguments.ts");
beforeEach(()=>installMockRoot({tools:true}));afterEach(()=>jest.restoreAllMocks());
async function fixture(){
 const f=await transcriptFixture(),mutation=f.ctx.runMutation.bind(f.ctx),query=f.ctx.runQuery.bind(f.ctx);
 const route=n=>n.startsWith("runtimeAgent:")?runtime[n.split(":")[1]]:n==="runs:claimNext"?runs.claimNext:n==="runs:recoverQueue"?runs.recoverQueue:n==="runtimeMemory:readSource"?memory.readSource:undefined;
 for(const [method,original] of [["runMutation",mutation],["runQuery",query]]) f.ctx[method]=async(ref,args)=>{let n="";try{n=getFunctionName(ref)}catch{}const reg=route(n);if(reg)assertNativeArgs(reg,args);return reg?await invoke(reg,f.ctx,args):await original(ref,args)};
 f.grant.capabilities=[...f.grant.capabilities,"tool"]; f.toolDefinition=await f.call(definitions.publishVersion,{memorySpaceId:"space-a",clientMutationId:"independent-tool-agent",expectedPreviousVersion:0,definitionInput:{...f.definitionInput,tools:[{toolId:"memory.recall",toolVersion:1,registryHash:await definitions.executableRegistryHash(),requiredCapability:"tool",approval:"none"}],policies:[{policyId:"independent-tool",version:1,rules:{limits:{toolSteps:4}}}]}});
 return f;
}
async function start(f,key,conversationId){const run=await f.call(runs.submit,{request:{...f.request(key,conversationId),agentId:f.toolDefinition.agentId,agentVersion:f.toolDefinition.version}});await f.call(runtime.start,{runId:run.runId});const row=f.db.table("runtimeRuns").find(x=>x.runId===run.runId),owned=f.db.table("runtimeAgentExecutions").find(x=>x.runId===run.runId);return {run,row,owned,args:{reference:f.reference,runId:run.runId,attemptNumber:row.attemptNumber,leaseVersion:owned.leaseVersion}}}
async function finish(f,current,messages){
 const input=f.native.messages.get(current.row.inputMessageIds[0]);const ids=[];
 for(let i=0;i<messages.length;i++){const id=`saved:${current.run.runId}:${i}`;ids.push(id);f.native.messages.set(id,{...input,_id:id,stepOrder:i+1,agentName:`cortex:${current.run.runId}:1:0`,message:messages[i]})}
 const op=await f.call(runtime.beginOperation,{...current.args,kind:"model",ordinal:0,requestCanonical:"{}"});await f.call(runtime.startOperation,{...current.args,operationId:op.operationId});await f.call(runtime.finishOperation,{...current.args,operationId:op.operationId,resultCanonical:"{}",nativeMessageIds:ids});return ids;
}
it.each([["original","unchanged"],["original","changed"],["original","tombstoned"],["fork","unchanged"],["fork","changed"],["fork","tombstoned"]])("%s later-turn private tool context respects prior recalled source %s",async (path,kind)=>{
 const f=await fixture(),a=await start(f,"turn-a");const scope=memoryScope(f.reference);const prepared=await prepareSourceContent(scope,explicitSourceLineage(scope,"independent-context-x"),"PRIVATE_RECALLED_X_SENTINEL",{now:()=>Date.now()});const source=f.db.seed("runtimeMemorySources",prepared.source);
 const witness={sourceId:source.lineage.sourceId,sourceEventId:source.lineage.sourceEventId,sourceRevision:source.lineage.sourceRevision,contentHash:source.contentHash};
 await f.call(runtime.saveContext,{...a.args,context:"",witnesses:[witness]});
 const ids=await finish(f,a,[{role:"assistant",content:[{type:"tool-call",toolCallId:"tc",toolName:"memory_recall",input:{text:"x",limit:1}}]},{role:"tool",content:[{type:"tool-result",toolCallId:"tc",toolName:"memory_recall",output:{type:"json",value:{context:"PRIVATE_RECALLED_X_SENTINEL"}}}]},{role:"assistant",content:"completed A"}]);
 await f.call(runtime.finalize,{...a.args,finalMessageIds:[ids[2]]});
 let target=a.run.conversationId;if(path==="fork"){const conversation=f.db.table("runtimeConversations").find(c=>c.conversationId===target);target=(await f.call(transcript.fork,{conversationId:target,clientRequestId:"fork-independent",expectedRevision:conversation.historyRevision})).conversationId;}
 if(kind==="changed"){source.lineage={...source.lineage,sourceRevision:2};source.contentHash="b".repeat(64)}if(kind==="tombstoned")source.tombstonedAt=Date.now();
 let hydrated;try{const b=await start(f,"turn-b",target);await f.call(runtime.saveContext,{...b.args,context:"",witnesses:[]});hydrated=await f.call(runtime.hydrateExecution,b.args)}catch(e){if(kind!=="unchanged"&&String(e).includes("STALE_CONTEXT"))return;throw e}
 if(kind==="unchanged")expect(JSON.stringify(hydrated.messages)).toContain("PRIVATE_RECALLED_X_SENTINEL");
 else expect(JSON.stringify(hydrated.messages)).not.toContain("PRIVATE_RECALLED_X_SENTINEL");
 expect(f.db.table("runtimeModelOperations")).toHaveLength(0);
});
it.each([0,1010])("current completed-save gap recovers with %i old failed native rows",async holes=>{
 const f=await fixture();const run=await f.run("gap-input");const row=f.db.table("runtimeRuns")[0],input=f.native.messages.get(row.inputMessageIds[0]);input.order=holes;f.db.table("runtimeTranscriptMessages")[0].order=holes;
 for(let i=0;i<holes;i++)f.native.messages.set(`old-failed:${i}`,{...input,_id:`old-failed:${i}`,order:i,stepOrder:0,status:"failed",message:{role:"assistant",content:"old unregistered failed work"}});
 await f.call(runtime.start,{runId:run.runId});const owned=f.db.table("runtimeAgentExecutions")[0],current={run,row,owned,args:{reference:f.reference,runId:run.runId,attemptNumber:row.attemptNumber,leaseVersion:owned.leaseVersion}};
 await f.call(runtime.saveContext,{...current.args,context:"",witnesses:[]});const [id]=await finish(f,current,[{role:"assistant",content:"gap final"}]);
 f.db.table("runtimeAgentExecutions")[0].savedMessageIds=[];f.db.table("runtimeAgentOperations")[0].state="started";await f.call(runtime.endInterrupted,{...current.args,cancelled:false});
 expect(await f.call(runtime.reconcile,{runId:run.runId})).toMatchObject({receiptId:expect.stringMatching(/^agent-ingestion:/)});
 expect(f.db.table("runtimeRuns")[0].outputMessageIds).toEqual([id]);expect(f.db.table("runtimeAgentIngestion")).toHaveLength(1);expect(f.db.table("runtimeModelOperations")).toHaveLength(0);
});
