/** Actual registered V8/legacy handlers and native component ports; no cloud or inference claim. */
import {afterEach,beforeEach,expect,it,jest} from "@jest/globals";
import {getFunctionName} from "convex/server";
import type {MessageDoc} from "@convex-dev/agent";
import {serializeMessage,fetchContextWithPrompt} from "@convex-dev/agent";
import {checkAssembledAgentModelInput} from "../../../convex-dev/runtimeGateway";
import type {MutationCtx} from "../../../convex-dev/_generated/server";
import {canonicalModelJson} from "../../../src/domain/model-policy";
import {assertNativeArgs} from "./native-arguments";
const workflows:{name:string;options:unknown}[]=[];
jest.unstable_mockModule("@convex-dev/workflow",()=>({WorkflowManager:class{define(value:{handler:unknown}){return {_handler:value.handler};}async start(_ctx:unknown,ref:unknown,_args:unknown,options:unknown){workflows.push({name:getFunctionName(ref as never),options});return "workflow:bounded";}}}));
const {ingestionFixture,installIngestionMockRoot,invoke}=await import("../runtimeIngestion/fixture");
const {definitions,runs,transcript,clock}=await import("../runtimeTranscript/fixture");
const agent=await import("../../../convex-dev/runtimeAgent");
beforeEach(()=>{installIngestionMockRoot();workflows.length=0;});afterEach(()=>{jest.restoreAllMocks();});
async function fixture(options:{strict?:boolean;inputLimit?:number;recent?:number;incomplete?:boolean;tools?:boolean;approval?:boolean}={}){
 const f=await ingestionFixture(),oldMutation=f.ctx.runMutation.bind(f.ctx),oldQuery=f.ctx.runQuery.bind(f.ctx),calls:string[]=[];
 const resolve=(name:string)=>name.startsWith("runtimeAgent:")?agent[name.split(":")[1] as keyof typeof agent]:name.startsWith("runs:")?runs[name.split(":")[1] as keyof typeof runs]:undefined;
 f.ctx.runMutation=(async(ref,args)=>{let name="";try{name=getFunctionName(ref);}catch{return oldMutation(ref,args);}const target=resolve(name);if(target){calls.push(name);assertNativeArgs(target,args);return f.call(target,args);}return oldMutation(ref,args);}) as MutationCtx["runMutation"];
 f.ctx.runQuery=(async(ref,args)=>{let name="";try{name=getFunctionName(ref);}catch{return oldQuery(ref,args);}const target=resolve(name);if(target){calls.push(name);assertNativeArgs(target,args);return invoke(target,f.ctx,args);}return oldQuery(ref,args);}) as MutationCtx["runQuery"];
 if(options.tools)f.grant.capabilities=[...f.grant.capabilities as string[],"tool"];
 const published=await f.call<{agentId:string;version:number}>(definitions.publishVersion,{memorySpaceId:"space-a",clientMutationId:"bounded-v8",expectedPreviousVersion:0,definitionInput:{...f.definitionInput,...(options.tools?{tools:[{toolId:"memory.recall",toolVersion:1,registryHash:await definitions.executableRegistryHashV3(),requiredCapability:"tool",approval:options.approval?"explicit":"none"}]}:{}),
  context:{...f.definitionInput.context,handlerId:"cortex.transcript.relevant",registryHash:await definitions.executableRegistryHashV3(),memoryMode:options.strict?"strict":"indexed-plus-pending",maxContextTokens:1000,...(options.incomplete?{barrier:{deadlineMs:30000,onFailure:"incomplete"}}:{}),inputSelection:{version:1,recentMessages:options.recent??4,relevantMemories:4,relevantFacts:4,pendingEntries:4,maxMessages:16},...(options.strict?{requiredStages:["facts","vectors"],barrier:{deadlineMs:30000,onFailure:"fail"}}:{})},
  policies:[{policyId:"bounded-v8",version:1,rules:{limits:{inputTokens:options.inputLimit??8000,outputTokens:256,toolSteps:options.tools?4:0}}}]}});
 const request=(key="v8-first",conversationId?:string,text="Hello world!")=>({...f.request(key,conversationId),agentId:published.agentId,agentVersion:published.version,parts:[{type:"text" as const,text}]});
 async function start(text="Hello world!",conversationId?:string){const run=await f.call<ReturnType<typeof runs.publicRun>>(runs.submit,{request:request("v8-first",conversationId,text)});await f.call(agent.start,{runId:run.runId});const owned=f.db.table("runtimeAgentExecutions")[0]!;return {run,owned,attempt:{reference:f.reference,runId:run.runId,attemptNumber:1,leaseVersion:owned.leaseVersion as number}};}
 return {...f,calls,request,start,get grant(){return f.grant;}};
}
it("new definition actually selects V8 direct scheduling; old definitions stay on V6",async()=>{const f=await fixture(),{run,owned}=await f.start();expect(f.db.table("runtimeRuns")[0]).toMatchObject({modelInputVersion:8});expect(owned.executionMode).toBe("direct-v8");expect(f.scheduled.map(v=>v.name)).toContain("runtimeAgent:executeDirectV8");expect(f.calls).toContain("runs:claimNextV8");expect(JSON.parse(f.db.table("runtimeRuns")[0]!.snapshotCanonical as string)).toMatchObject({version:8,inputSelection:{coverage:"selected"}});expect(run.inputMessageIds).toHaveLength(1);
 const legacy=await ingestionFixture(),mutation=legacy.ctx.runMutation.bind(legacy.ctx);legacy.ctx.runMutation=(async(ref,args)=>{let name="";try{name=getFunctionName(ref);}catch{return mutation(ref,args);}return name==="runs:claimNext"?legacy.call(runs.claimNext,args):mutation(ref,args);}) as MutationCtx["runMutation"];const old=await legacy.run();await legacy.call(agent.start,{runId:old.runId});expect(legacy.db.table("runtimeAgentExecutions")[0]!.executionMode).toBe("direct-v6");expect(JSON.parse(legacy.db.table("runtimeRuns")[0]!.snapshotCanonical as string).version).toBe(1);});
it("strict V8 retains native Workflow and original stage barrier",async()=>{const f=await fixture({strict:true}),{attempt}=await f.start();expect(workflows[0]!.name).toBe("runtimeAgent:executeTurnV8");await f.call(agent.startContext,attempt);expect(await f.call(agent.contextBarrier,attempt)).toMatchObject({state:"waiting"});expect(f.scheduled.some(v=>v.name==="runtimeAgent:executeDirectV8")).toBe(false);});
it("long retained history selects recent four without full-history reads or byte-cap rejection",async()=>{const f=await fixture();const conversation=await f.call<{conversationId:string;threadId:string}>(transcript.create,{memorySpaceId:"space-a",clientRequestId:"long-history"});const row=f.db.table("runtimeConversations")[0]!;row.manualWriteLocked=false;
 for(let i=0;i<140;i++)await f.call(transcript.append,{conversationId:conversation.conversationId,expectedRevision:row.historyRevision,role:"user",parts:[{type:"text",text:`Retained ${i} ${"long ".repeat(220)}`}]});row.manualWriteLocked=true;
 const nativeReads:number[]=[],query=f.ctx.runQuery.bind(f.ctx);f.ctx.runQuery=(async(ref,args)=>{const path=(ref as unknown as Partial<Record<symbol,string>>)[Symbol.for("toReferencePath")];if(path?.endsWith("/listMessagesByThreadId"))throw Error("FORBIDDEN_FULL_HISTORY_SCAN");if(path?.endsWith("/getMessagesByIds"))nativeReads.push((args as {messageIds:string[]}).messageIds.length);return query(ref,args);}) as MutationCtx["runQuery"];
 const before=f.native.messages.size,{attempt}=await f.start("Current question",conversation.conversationId);const snapshot=JSON.parse(f.db.table("runtimeRuns")[0]!.snapshotCanonical as string);expect(snapshot.messages).toHaveLength(4);expect(snapshot.messages.map((v:{order:number})=>v.order)).toEqual([137,138,139,140]);expect(f.native.messages.size).toBe(before+1);expect(nativeReads.every(n=>n<=4)).toBe(true);
 const current=await agent.executionContext(f.ctx,attempt);expect(current.messages).toHaveLength(4);const represented=current.snapshot.messages.map(pin=>pin.sourceEventId);expect(represented).not.toContain((f.db.table("runtimeTranscriptMessages")[0]!.sourceEventId));expect(f.db.table("runtimeTranscriptMessages")).toHaveLength(141);});
it("real exact-bound candidate drops optional whole entries and retains current input",async()=>{const f=await fixture({inputLimit:8000}),{attempt,owned}=await f.start("Current input");await f.call(agent.startContext,attempt);await f.call(agent.saveContextV8,{...attempt,context:"x".repeat(3000),entries:[{key:"memory:optional",kind:"memory",text:"x".repeat(3000),relevance:.1}],witnesses:[],completeness:"complete"});const result=await f.call<Awaited<ReturnType<typeof agent.prepareResolvedModelCandidateV8Handler>>>(agent.prepareResolvedModelCandidateV8,{...attempt,ordinal:0});expect(result.state).toBe("started");if(result.state!=="started")throw Error("Expected actual candidate");expect(result.current.execution.contextCanonical).toBe("");expect(result.current.messages).toEqual([{role:"user",content:[{type:"text",text:"Current input"}]}]);expect(f.db.table("runtimeAgentExecutions").find(v=>v._id===owned._id)!.modelInputSelection).toMatchObject({entryKeys:[],messageIds:result.current.run.inputMessageIds});expect(f.db.table("runtimeAgentOperations")).toHaveLength(1);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);});
it("mandatory overflow refuses before begin/start and save survives refused child rollback",async()=>{const f=await fixture({inputLimit:1000}),{attempt}=await f.start("M".repeat(3000));await f.call(agent.startContext,attempt);const result=await f.call<{kind:string;refusal:unknown}>(agent.saveAndPrepareContextV8,{...attempt,context:"",entries:[],witnesses:[],completeness:"complete"});expect(result.kind).toBe("refused");expect(f.db.table("runtimeAgentExecutions")[0]!.contextState).toBe("complete");expect(f.db.table("runtimeAgentExecutions")[0]!.modelInputSelection).toBeUndefined();expect(f.db.table("runtimeAgentOperations")).toHaveLength(0);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);});
it.each(["revocation","snapshot-policy","mandatory-pin","payload"])("%s still refuses fresh V8 execution with zero operation effects",async fault=>{const f=await fixture(),{attempt}=await f.start();await f.call(agent.startContext,attempt);await f.call(agent.saveContextV8,{...attempt,context:"",entries:[],witnesses:[],completeness:"complete"});if(fault==="revocation")f.grant.revokedAt=clock;if(fault==="payload")f.native.messages.values().next().value!.message={role:"user",content:"changed"};if(fault==="snapshot-policy"||fault==="mandatory-pin"){const row=f.db.table("runtimeRuns")[0]!,snapshot=JSON.parse(row.snapshotCanonical as string);if(fault==="snapshot-policy")snapshot.inputSelection.policy.recentMessages=2;else snapshot.inputSelection.mandatoryMessageIds=[];row.snapshotCanonical=canonicalModelJson(snapshot);}await expect(f.call(agent.prepareResolvedModelCandidateV8,{...attempt,ordinal:0})).rejects.toThrow();expect(f.db.table("runtimeAgentOperations")).toHaveLength(0);});

it("known five pending sources retain four current whole sources and explicit withheld incompleteness",async()=>{
 const f=await fixture({incomplete:true,inputLimit:64000});const ingestion=await import("../../../convex-dev/runtimeIngestion");
 for(let i=0;i<5;i++){const source=await f.source(`Verified pending ${i}`,`pending-${i}`);await ingestion.enqueueSourceEvent(f.ctx,f.reference,source);}
 const {attempt}=await f.start();await f.call(agent.startContext,attempt);
 const inputs=await f.call<{kind:string;pending:{completeness:string;reason:string;withheldCount:number;sources:{sourceId:string}[];text:string}}>(agent.contextInputsV8,attempt);
 expect(inputs.kind).toBe("ready");expect(inputs.pending).toMatchObject({completeness:"incomplete",reason:"CONTEXT_OVERFLOW",withheldCount:1});
 expect(inputs.pending.sources.map(source=>source.sourceId)).toEqual(["pending-1","pending-2","pending-3","pending-4"]);
 expect(inputs.pending.text).toContain("Verified pending 4");expect(inputs.pending.text).not.toContain("Verified pending 0");
});

it("exact-bound omitted recent source remains eligible before recall, with no second embedding",async()=>{
 const f=await fixture({inputLimit:8000}),conversation=await f.call<{conversationId:string}>(transcript.create,{memorySpaceId:"space-a",clientRequestId:"fit-history"}),row=f.db.table("runtimeConversations")[0]!;row.manualWriteLocked=false;
 for(let i=0;i<3;i++)await f.call(transcript.append,{conversationId:conversation.conversationId,expectedRevision:row.historyRevision,role:"user",parts:[{type:"text",text:`Older ${i} ${"x".repeat(1200)}`}]});row.manualWriteLocked=true;
 const profile=(await import("../../../src/domain/profile")).DEFAULT_EMBEDDING_PROFILE;
 for(const event of f.db.table("runtimeIngestionEvents"))Object.assign(event,{factsState:"complete",vectorsState:"complete",vectorProfilesComplete:[profile.profileId]});
 const watermark=f.db.table("runtimeIngestionScopes")[0]!;Object.assign(watermark,{factsThrough:3,vectorsThrough:3,vectorProfileThrough:{[profile.profileId]:3}});
 const {attempt}=await f.start("Current short question",conversation.conversationId);await f.call(agent.startContext,attempt);
 const inputs=await f.call<{kind:string;historyMessageIds:string[];represented:string[];current:Awaited<ReturnType<typeof agent.executionContext>>}>(agent.contextInputsV8,attempt);
 expect(inputs.kind).toBe("ready");expect(inputs.historyMessageIds.length).toBeLessThan(4);expect(inputs.current.messages).toHaveLength(inputs.historyMessageIds.length);
 const omitted=inputs.current.snapshot.messages.find(pin=>!inputs.historyMessageIds.includes(pin.nativeMessageId))!;expect(omitted).toBeDefined();
 const event=f.db.table("runtimeIngestionEvents").find(value=>(value.lineage as {sourceEventId:string}).sourceEventId===omitted.sourceEventId)!;
 const lineage=event.lineage as {sourceId:string;sourceEventId:string;sourceRevision:number};
 const {contextSourceKey}=await import("../../../src/domain/memory-context");expect(inputs.represented).not.toContain(contextSourceKey({tenantId:f.reference.tenantId,memorySpaceId:f.reference.memorySpaceId!},lineage));
 const boundary={conversationId:conversation.conversationId,runId:attempt.runId,queueSequence:inputs.current.snapshot.queueSequence,anchor:inputs.current.snapshot.anchor};
 const context=await import("../../../convex-dev/runtimeMemoryContext");expect(await context.readIndexedSourceAtCutoff(f.ctx,{reference:f.reference,sourceId:lineage.sourceId,sourceRevision:lineage.sourceRevision,cutoff:inputs.current.snapshot.ingestionCutoff.sequence,boundary})).toBe(true);
 await f.call(agent.saveContextV8,{...attempt,context:"",entries:[],historyMessageIds:inputs.historyMessageIds,witnesses:[],completeness:"complete"});
 const candidate=await f.call<Awaited<ReturnType<typeof agent.prepareResolvedModelCandidateV8Handler>>>(agent.prepareResolvedModelCandidateV8,{...attempt,ordinal:0});expect(candidate.state).toBe("started");
 if(candidate.state!=="started")throw Error("Expected retained selection");expect(candidate.current.messages).toEqual(inputs.current.messages);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);expect(f.calls.filter(name=>name==="runtimeAgentQueryEmbedding:prepare")).toHaveLength(0);
});

it.each([1300,7000])("later exact-bound continuation keeps the complete %i byte tool result or refuses without truncation",async payload=>{
 const f=await fixture({inputLimit:16000,tools:true}),conversation=await f.call<{conversationId:string}>(transcript.create,{memorySpaceId:"space-a",clientRequestId:"tool-history"}),row=f.db.table("runtimeConversations")[0]!;row.manualWriteLocked=false;
 await f.call(transcript.append,{conversationId:conversation.conversationId,expectedRevision:row.historyRevision,role:"assistant",parts:[{type:"text",text:`Optional history ${"h".repeat(1600)}`}]});row.manualWriteLocked=true;
 const {attempt,owned}=await f.start("Current question",conversation.conversationId);await f.call(agent.startContext,attempt);await f.call(agent.saveContextV8,{...attempt,context:"",entries:[],witnesses:[],completeness:"complete"});
 const current=await agent.executionContext(f.ctx,attempt),input=f.native.messages.get(current.run.inputMessageIds[0]!)!;
 const serializedCall=await serializeMessage(f.ctx,transcript.agentComponent,{role:"assistant",content:[{type:"tool-call",toolCallId:"complete-call",toolName:"memory_recall",input:{text:"actual query",limit:1}}]});
 const serializedResult=await serializeMessage(f.ctx,transcript.agentComponent,{role:"tool",content:[{type:"tool-result",toolCallId:"complete-call",toolName:"memory_recall",output:{type:"json",value:{context:"r".repeat(payload),items:[]}}}]});
 expect(serializedCall.message.content).toEqual([expect.objectContaining({type:"tool-call",input:{text:"actual query",limit:1},args:{text:"actual query",limit:1}})]);
 // Convex persistence omits optional undefined properties on the wire. The
 // controlled Map port must store that same official serializer result.
 const call={...input,_id:"native:continuation-call",order:current.snapshot.anchor.order,stepOrder:current.snapshot.anchor.stepOrder+1,message:JSON.parse(JSON.stringify(serializedCall.message)) as typeof serializedCall.message};
 const result={...input,_id:"native:continuation-result",order:current.snapshot.anchor.order,stepOrder:current.snapshot.anchor.stepOrder+2,message:JSON.parse(JSON.stringify(serializedResult.message)) as typeof serializedResult.message};
 const storedCanonical=canonicalModelJson([call.message,result.message]);
 f.native.messages.set(call._id,call);f.native.messages.set(result._id,result);
 const pins=await Promise.all([call,result].map(async message=>({id:message._id,order:message.order,stepOrder:message.stepOrder,canonicalContentHash:await transcript.canonicalMessageHash(message as unknown as MessageDoc)})));
 await f.db.patch("runtimeAgentExecutions",owned._id,{savedMessageIds:[call._id,result._id],savedMessagePins:pins,nextModelStep:1});
 if(payload===7000){await expect(f.call(agent.prepareResolvedModelCandidateV8,{...attempt,ordinal:1})).rejects.toThrow("CONTEXT_LIMIT_EXCEEDED");expect(f.db.table("runtimeAgentOperations")).toHaveLength(0);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);expect(f.native.messages.get(result._id)!.message).toEqual(result.message);expect(canonicalModelJson([f.native.messages.get(call._id)!.message,f.native.messages.get(result._id)!.message])).toBe(storedCanonical);return;}
 const candidate=await f.call<Awaited<ReturnType<typeof agent.prepareResolvedModelCandidateV8Handler>>>(agent.prepareResolvedModelCandidateV8,{...attempt,ordinal:1});expect(candidate.state).toBe("started");if(candidate.state!=="started")throw Error("Expected current tool continuation");
 expect(candidate.current.messages).toEqual([current.messages.at(-1),call.message,result.message]);expect(candidate.current.messages).not.toContainEqual(current.messages[0]);
 expect(candidate.current.execution.modelInputSelection!.messageIds).toEqual([input._id,call._id,result._id]);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
 expect(canonicalModelJson([f.native.messages.get(call._id)!.message,f.native.messages.get(result._id)!.message])).toBe(storedCanonical);
 // Exercise the installed Agent's real context assembly, including the same
 // recentMessages:0 custom-handler contract used by production V8. It does not
 // append a second hidden prompt/history after our selected current tool group.
 const readsBefore=f.calls.length;
 if(typeof input._id!=="string")throw Error("Expected controlled native prompt id");
 const assembled=await fetchContextWithPrompt(f.ctx as unknown as Parameters<typeof fetchContextWithPrompt>[0],transcript.agentComponent,{
  prompt:undefined,messages:undefined,promptMessageId:input._id,userId:f.reference.principalId,threadId:current.threadId,
  contextOptions:{recentMessages:0},contextHandler:async()=>candidate.current.messages,
 });
 expect(assembled.messages).toEqual(candidate.current.messages);expect(f.calls).toHaveLength(readsBefore);
 const checked=await checkAssembledAgentModelInput({messages:assembled.messages,context:candidate.current.execution.contextCanonical??"",
  instructions:candidate.current.definition.instructions.text,tools:["memory_recall"],maxOutputTokens:256},candidate.governedResolution,
  {reference:attempt.reference,operationKey:"agent.respond",runBudgetId:candidate.current.run.runBudgetId,semanticId:candidate.op.semanticId,ordinal:1});
 expect(checked).toMatchObject({supported:true,withinBound:true});
 if(!checked.supported||!checked.withinBound)throw Error("Exact assembled request must fit");
 expect(JSON.parse(checked.requestCanonical).inputTokens).toBeLessThanOrEqual(16000);
});

it("fitted V8 diagnostics expose exact selected counts and bounds without stored private text",async()=>{
 const previous=process.env.CORTEX_RUNTIME_LATENCY_TRACE;process.env.CORTEX_RUNTIME_LATENCY_TRACE="1";
 const logged=jest.spyOn(console,"log").mockImplementation(()=>{});
 try{
  const f=await fixture({inputLimit:8000}),{attempt}=await f.start("CURRENT_PRIVATE_MARKER");
  await f.call(agent.startContext,attempt);
  const entries=[{key:"memory:private",kind:"memory" as const,relevance:.1,text:"PRIVATE_EVIDENCE_MARKER ".repeat(160)},
   {key:"fact:private",kind:"fact" as const,relevance:.9,text:"PRIVATE_FACT_MARKER ".repeat(160)}];
  await f.call(agent.saveContextV8,{...attempt,context:entries.map(entry=>entry.text).join("\n\n"),entries,witnesses:[],completeness:"complete"});
  const candidate=await f.call<Awaited<ReturnType<typeof agent.prepareResolvedModelCandidateV8Handler>>>(agent.prepareResolvedModelCandidateV8,{...attempt,ordinal:0});
  expect(candidate.state).toBe("started");
  const events=logged.mock.calls.flatMap(([line])=>{if(typeof line!=="string")return [];try{return [JSON.parse(line) as Record<string,unknown>];}catch{return [];}});
  const selected=events.filter(event=>event.phase==="model.input.fit.candidate");expect(selected).toHaveLength(1);
  expect(selected[0]).toMatchObject({selectedMessages:1,selectedMemories:0,selectedFacts:0,selectedPending:0,contextBytes:0,inputLimit:8000});
  expect(selected[0]!.inputTokens).toBeLessThanOrEqual(8000);
  expect(JSON.stringify(events)).not.toContain("CURRENT_PRIVATE_MARKER");expect(JSON.stringify(events)).not.toContain("PRIVATE_EVIDENCE_MARKER");
  expect(JSON.stringify(events)).not.toContain("PRIVATE_FACT_MARKER");expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
 }finally{if(previous===undefined)delete process.env.CORTEX_RUNTIME_LATENCY_TRACE;else process.env.CORTEX_RUNTIME_LATENCY_TRACE=previous;}
});

// Scheduling changes must leave the original executable transcript and terminal fences intact.
it("V8 ordinal0 completion releases ingestion early after original native-message checks", async () => {
 const f=await fixture(),{attempt}=await f.start();
 const marker=f.db.table("runtimeIngestionForegroundPriority")[0]!;expect(marker.state).toBe("held");
 await f.call(agent.startContext,attempt);await f.call(agent.saveContextV8,{...attempt,context:"",entries:[],witnesses:[],completeness:"complete"});
 const op=await f.call<{operationId:string}>(agent.beginOperation,{...attempt,kind:"model",ordinal:0,requestCanonical:"{}"});
 await f.call(agent.startOperation,{...attempt,operationId:op.operationId});
 const input=f.native.messages.values().next().value!;
 const id="native:priority-final";f.native.messages.set(id,{...input,_id:id,stepOrder:1,status:"success",message:{role:"assistant",content:"answer"}});
 await expect(f.call(agent.finishOperation,{...attempt,operationId:op.operationId,resultCanonical:"{}",nativeMessageIds:["native:missing"]})).rejects.toThrow("STALE_TRANSCRIPT");
 expect(f.db.table("runtimeIngestionForegroundPriority")[0]!.state).toBe("held");
 await f.call(agent.finishOperation,{...attempt,operationId:op.operationId,resultCanonical:"{}",nativeMessageIds:[id]});
 expect(f.db.table("runtimeIngestionForegroundPriority")[0]!.state).toBe("released");
 expect(f.db.table("runtimeAgentOperations")[0]!.state).toBe("complete");
 expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
 expect(f.scheduled.filter(x=>x.name==="runtimeIngestion:processStage").length).toBeGreaterThan(1);
});
it("V8 interruption releases scheduling preference without retrying or marking source indexed",async()=>{
 const f=await fixture(),{attempt}=await f.start();
 await f.call(agent.endInterrupted,{...attempt,cancelled:false});
 expect(f.db.table("runtimeIngestionForegroundPriority")[0]!.state).toBe("released");
 expect(f.db.table("runtimeAgentExecutions")[0]!.state).toBe("failed");
 expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
 expect(f.db.table("runtimeIngestionStages").every(row=>row.state==="pending"&&row.attempt===0)).toBe(true);
});
it.each(["relevant","default"])("strict %s barrier promotes captured ordinary inputs across conversations without claiming readiness",async handler=>{
 const f=await fixture();const ordinary=await f.call<ReturnType<typeof runs.publicRun>>(runs.submit,{request:f.request("ordinary-before-strict")});
 expect(f.db.table("runtimeIngestionForegroundPriority")[0]!.state).toBe("held");
 const strict=await f.call<{agentId:string;version:number}>(definitions.publishVersion,{memorySpaceId:"space-a",clientMutationId:`strict-priority-override-${handler}`,expectedPreviousVersion:0,
 definitionInput:{...f.definitionInput,context:{...f.definitionInput.context,...(handler==="relevant"?{handlerId:"cortex.transcript.relevant",registryHash:await definitions.executableRegistryHashV3()}:{}),memoryMode:"strict",requiredStages:["facts","vectors"],barrier:{deadlineMs:100,onFailure:"fail"}}}});
 const run=await f.call<ReturnType<typeof runs.publicRun>>(runs.submit,{request:{...f.request("strict-new-conversation"),agentId:strict.agentId,agentVersion:strict.version}});
 expect(run.conversationId).not.toBe(ordinary.conversationId);await f.call(agent.start,{runId:run.runId});
 const owned=f.db.table("runtimeAgentExecutions")[0]!,attempt={reference:f.reference,runId:run.runId,attemptNumber:1,leaseVersion:owned.leaseVersion as number};
 await f.call(agent.startContext,attempt);expect(await f.call(agent.contextBarrier,attempt)).toMatchObject({state:"waiting",remainingMs:100});
 expect(f.db.table("runtimeIngestionForegroundPriority")[0]!.state).toBe("released");
 expect(f.db.table("runtimeIngestionStages").every(row=>row.state==="pending"&&row.attempt===0)).toBe(true);
 jest.spyOn(Date,"now").mockReturnValue(clock+101);
 expect(await f.call(agent.contextBarrier,attempt)).toMatchObject({state:"failed",failureCode:"MEMORY_BARRIER_TIMEOUT"});
});

it("tool approval wait releases V8 ingestion before any human decision",async()=>{
 const f=await fixture({tools:true,approval:true}),{attempt}=await f.start();
 await f.call(agent.startContext,attempt);await f.call(agent.saveContextV8,{...attempt,context:"",entries:[],witnesses:[],completeness:"complete"});
 const op=await f.call<{operationId:string}>(agent.beginOperation,{...attempt,kind:"tool",ordinal:0,toolCallId:"priority-tool",toolName:"memory_recall",requestCanonical:canonicalModelJson({text:"query",limit:1})});
 await f.call(agent.waitForApproval,{...attempt,operationId:op.operationId});
 expect(f.db.table("runtimeIngestionForegroundPriority")[0]!.state).toBe("released");
 expect(f.db.table("runtimeAgentOperations")[0]!.state).toBe("waiting_approval");
 expect(f.db.table("runtimeRuns")[0]!.responseStatus).toBe("waiting_approval");
 expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});

it("V8 read parent keeps empty context local without an embedding proposal or any writes", async () => {
 const f=await fixture({inputLimit:64000}),{attempt}=await f.start();await f.call(agent.startContext,attempt);
 const writes=f.db.writes;
 const original=await f.call(agent.contextInputsV8,attempt);
 const parent=await f.call<Awaited<ReturnType<typeof agent.contextInputsAndEmbeddingV8Handler>>>(agent.contextInputsAndEmbeddingV8,attempt);
 expect(parent).toEqual({inputs:original});expect(parent.inputs.kind).toBe("ready");
 if(parent.inputs.kind!=="ready")throw Error("Expected empty context");expect(parent.inputs.availability.empty).toBe(true);
 expect(parent.proposal).toBeUndefined();expect(f.db.writes).toBe(writes);expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
});
it("V8 pending failure skips embedding preparation and Action commits the original failure",async()=>{
 const f=await fixture({inputLimit:64000}),ingestion=await import("../../../convex-dev/runtimeIngestion");
 for(let i=0;i<5;i++)await ingestion.enqueueSourceEvent(f.ctx,f.reference,await f.source(`Pending first ${i}`,`read-parent-pending-${i}`));
 const {attempt}=await f.start();await f.call(agent.startContext,attempt);
 const {ConvexMemoryRepository}=await import("../../../convex-dev/runtimeMemoryRepository");
 const embeddingGuard=jest.spyOn(ConvexMemoryRepository.prototype,"assertReadAuthority").mockRejectedValue(Error("EMBEDDING_PREP_MUST_NOT_RUN"));
 const writes=f.db.writes;
 expect(await f.call(agent.contextInputsAndEmbeddingV8,attempt)).toMatchObject({inputs:{kind:"pending_overflow",pending:{completeness:"incomplete",reason:"CONTEXT_OVERFLOW"}}});
 expect(f.db.writes).toBe(writes);
 await expect(agent.prepareContextV8Handler(f.ctx as unknown as Parameters<typeof agent.prepareContextV8Handler>[0],attempt,undefined,true)).rejects.toThrow("CONTEXT_OVERFLOW");
 expect(f.db.table("runtimeAgentExecutions")[0]).toMatchObject({contextState:"failed",contextCompleteness:"incomplete",contextFailureCode:"CONTEXT_OVERFLOW"});
 expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);expect(f.db.table("runtimeAgentOperations")).toHaveLength(0);
 expect(embeddingGuard).not.toHaveBeenCalled();
});
