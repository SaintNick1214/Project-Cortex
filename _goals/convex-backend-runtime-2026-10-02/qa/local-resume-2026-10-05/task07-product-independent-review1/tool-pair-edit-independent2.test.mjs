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
it.each(["edit-call","remove-call","edit-final-text"])("tracked %s preserves usable private tool history",async kind=>{
 const f=await fixture(),a=await start(f,"turn-a");await f.call(runtime.saveContext,{...a.args,context:"",witnesses:[]});
 const ids=await finish(f,a,[{role:"assistant",content:[{type:"tool-call",toolCallId:"tc",toolName:"memory_recall",input:{text:"x",limit:1}}]},{role:"tool",content:[{type:"tool-result",toolCallId:"tc",toolName:"memory_recall",output:{type:"json",value:{context:"controlled memory"}}}]},{role:"assistant",content:"completed A"}]);
 await f.call(runtime.finalize,{...a.args,finalMessageIds:[ids[2]]});let c=f.db.table("runtimeConversations").find(c=>c.conversationId===a.run.conversationId);
 await f.call(transcript.setPolicy,{conversationId:c.conversationId,expectedRevision:c.historyRevision,manualWriteLocked:false});c=f.db.table("runtimeConversations").find(x=>x.conversationId===c.conversationId);
 const messageId=kind==="edit-final-text"?ids[2]:ids[0],edit={conversationId:c.conversationId,expectedRevision:c.historyRevision,messageId,expectedMessageRevision:1};
 try{await f.call(kind==="remove-call"?transcript.removeMessage:transcript.edit,kind==="remove-call"?edit:{...edit,parts:[{type:"text",text:"tracked replacement"}]});}
 catch(e){if(kind!=="edit-final-text"&&e?.data?.code==="TOOL_HISTORY_EDIT_DENIED"){expect(f.native.messages.get(ids[0]).message.content[0].type).toBe("tool-call");expect(f.db.table("runtimeModelOperations")).toHaveLength(0);return;}throw e}
 const b=await start(f,"turn-b",c.conversationId);await f.call(runtime.saveContext,{...b.args,context:"",witnesses:[]});const hydrated=await f.call(runtime.hydrateExecution,b.args);
 const calls=new Map(),orphans=[];for(const m of hydrated.messages)for(const p of Array.isArray(m.content)?m.content:[]){if(p.type==="tool-call")calls.set(p.toolCallId,p.toolName);if(p.type==="tool-result"&&calls.get(p.toolCallId)!==p.toolName)orphans.push({toolCallId:p.toolCallId,toolName:p.toolName});}
 expect(f.db.table("runtimeModelOperations")).toHaveLength(0);expect(orphans).toEqual([]);
});
