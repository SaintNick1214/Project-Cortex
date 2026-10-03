import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { build } from "esbuild";
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";
import { CortexTextTransport, type RemoteTextRuns, type TextSnapshot } from "../transport";
import { evidenceFile } from "./paths.mjs";

evidenceFile("transport.json");
let submissions=0,cancellations=0,observers=0;
const remote:RemoteTextRuns={
  async start(input){assert.equal(input.text,"Hello");submissions++;return "run-1";},
  async current(){return "run-1";},
  observe(runId,onSnapshot){observers++;queueMicrotask(()=>{
    for(const snapshot of [{version:1,runId,text:"Cortex",status:"running"},{version:1,runId,text:"Cortex ready",status:"completed"}] satisfies TextSnapshot[])onSnapshot(snapshot);
  });return ()=>{observers--;};},
  async cancel(){cancellations++;},
};
const transport=new CortexTextTransport(remote);
const input:UIMessage={id:"request-1",role:"user",parts:[{type:"text",text:"Hello"}]};
const first=await transport.sendMessages({trigger:"submit-message",chatId:"conversation-1",messageId:undefined,messages:[input],abortSignal:undefined});
let final:UIMessage|undefined;
for await(const message of readUIMessageStream({stream:first,terminateOnError:true}))final=message;
assert.equal(final?.id,"assistant:run-1");
assert.deepEqual(final?.parts,[{type:"text",text:"Cortex ready",state:"done",providerMetadata:undefined}]);
const reconnect=await transport.reconnectToStream({chatId:"conversation-1"});
assert.ok(reconnect);
for await(const message of readUIMessageStream({stream:reconnect,terminateOnError:true}))final=message;
assert.equal(submissions,1);assert.equal(cancellations,0);assert.equal(observers,0);
await assert.rejects(()=>transport.sendMessages({trigger:"regenerate-message",chatId:"conversation-1",messageId:undefined,messages:[input],abortSignal:undefined}),/UNSUPPORTED_OPERATION/);
const toolChunks:UIMessageChunk[]=[{type:"start",messageId:"assistant:tool-run"},{type:"tool-input-available",toolCallId:"tool-1",toolName:"add",input:{a:2,b:3}},{type:"tool-output-available",toolCallId:"tool-1",output:5},{type:"finish",finishReason:"stop"}];
let toolMessage:UIMessage|undefined;
for await(const message of readUIMessageStream({stream:new ReadableStream({start(controller){for(const chunk of toolChunks)controller.enqueue(chunk);controller.close();}}),terminateOnError:true}))toolMessage=message;
const toolPart=toolMessage?.parts.find(part=>part.type==="tool-add");
assert.ok(toolPart&&"state" in toolPart&&toolPart.state==="output-available");
assert.ok("input" in toolPart);assert.deepEqual(toolPart.input,{a:2,b:3});assert.ok("output" in toolPart);assert.equal(toolPart.output,5);
const held:RemoteTextRuns={...remote,observe(){observers++;return()=>{observers--;};}};
const detached=await new CortexTextTransport(held).reconnectToStream({chatId:"conversation-1"});assert.ok(detached);await detached.cancel();assert.equal(cancellations,0);assert.equal(observers,0);
const abortController=new AbortController();
const aborted=await new CortexTextTransport(held).reconnectToStream({chatId:"conversation-1",abortSignal:abortController.signal});assert.ok(aborted);abortController.abort();
const reader=aborted.getReader();const abortedChunks:UIMessageChunk[]=[];
for(;;){const chunk=await reader.read();if(chunk.done)break;abortedChunks.push(chunk.value);}
assert.ok(abortedChunks.some(chunk=>chunk.type==="abort"));assert.equal(cancellations,1);assert.equal(observers,0);
const bundled=await build({entryPoints:["transport.ts"],bundle:true,platform:"browser",format:"esm",write:false,metafile:true});
const inputs=Object.keys(bundled.metafile!.inputs);
assert.ok(inputs.every(path=>!path.includes("convex/")&&!path.includes("@convex-dev")&&!path.includes("node:")));
const result={version:1,status:"PASS",protocol:"AI SDK 7 ChatTransport / UIMessageChunk",submissions,cancellations,activeObservers:observers,browserBundleInputs:inputs,text:"Cortex ready",toolInput:{a:2,b:3},toolOutput:5,toolState:"output-available",observerDetachDidNotCancel:true,explicitAbortRequestedCancellationOnce:true,browserInteraction:"not run; native browser tools unavailable"};
writeFileSync(evidenceFile("transport.json"),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
