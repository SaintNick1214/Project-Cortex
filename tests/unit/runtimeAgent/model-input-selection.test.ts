import { describe, expect, it } from "@jest/globals";
import type { ModelMessage } from "ai";
import { MODEL_INPUT_SELECTION_V1 as defaults, fitModelInput, fitModelInputAsync, relevantRecallItems, modelInputPolicy, assertCompleteToolGroups } from "../../../src/domain/model-input-selection";
import type { ModelInputEntry, ModelInputMessage } from "../../../src/domain/model-input-selection";
import type { RecallItem } from "../../../src/types";
const messages:ModelInputMessage[]=[{id:"old",message:{role:"assistant",content:"old"},mandatory:false},{id:"current",message:{role:"user",content:"current"},mandatory:true}];
const entry=(key:string,relevance:number,kind:ModelInputEntry["kind"]="memory"):ModelInputEntry=>({key,kind,relevance,text:`complete entry ${key}`});
const within=()=>({supported:true as const,withinBound:true});
describe("bounded whole model input selection",()=>{
 it("defaults and immutable policy preserve few entries",()=>{ expect(modelInputPolicy()).toEqual({version:1,recentMessages:4,relevantMemories:4,relevantFacts:4,pendingEntries:4,maxMessages:16});expect(modelInputPolicy()).not.toBe(defaults); });
 it("drops complete weakest evidence then oldest optional message on actual qualified overflow",()=>{const calls:{ids:string[];context:string}[]=[];const result=fitModelInput({messages,entries:[entry("weak",.1),entry("strong",.9)],policy:defaults,check:(m,c)=>{calls.push({ids:m.map(v=>v.content as string),context:c});return {supported:true,withinBound:c===""&&m.length===1};}});expect(calls.map(c=>c.ids)).toEqual([["old","current"],["old","current"],["old","current"],["current"]]);expect(calls.map(c=>c.context)).toEqual(["complete entry weak\n\ncomplete entry strong","complete entry strong","",""]);expect(result.messageIds).toEqual(["current"]);expect(result.omitted).toBe(true);});
 it("combined message/evidence entry cap includes instructions",()=>{const result=fitModelInput({messages,entries:[entry("a",1),entry("b",2),entry("c",3)],policy:{...defaults,maxMessages:4},check:within});expect(result.entryKeys).toEqual(["c"]);expect(result.messageIds).toEqual(["old","current"]);});
 it("pending and explicit incompleteness notice are never optional",()=>{expect(()=>fitModelInput({messages:[messages[1]!],entries:[entry("p",1,"pending"),entry("warning",1,"notice")],policy:defaults,check:()=>({supported:true,withinBound:false})})).toThrow("CONTEXT_LIMIT_EXCEEDED");expect(()=>fitModelInput({messages,entries:Array.from({length:5},(_,i)=>entry(String(i),1,"pending")),policy:defaults,check:within})).toThrow("CONTEXT_INCOMPLETE");});
 it("no non-input validation refusal becomes selection",()=>{const original=Error("POLICY_DENIED_OUTPUT");expect(()=>fitModelInput({messages,entries:[entry("optional",1)],policy:defaults,check:()=>{throw original;}})).toThrow(original);});
 it("unsupported native shapes keep original validation path and complete content",()=>{const result=fitModelInput({messages,entries:[entry("a",1)],policy:defaults,check:()=>({supported:false})});expect(result.messages).toEqual(messages.map(v=>v.message));expect(result.supported).toBe(false);});
 it("tool call and every result stay indivisible and byte exact",()=>{const current:ModelMessage[]=[{role:"user",content:"current"},{role:"assistant",content:[{type:"tool-call",toolCallId:"c1",toolName:"memory_recall",input:{text:"exact",nested:{a:[1,2]}}},{type:"tool-call",toolCallId:"c2",toolName:"memory_remember",input:{text:"second"}}]},{role:"tool",content:[{type:"tool-result",toolCallId:"c1",toolName:"memory_recall",output:{type:"json",value:{full:[1,2,3]}}},{type:"tool-result",toolCallId:"c2",toolName:"memory_remember",output:{type:"text",value:"ok"}}]}];const before=JSON.stringify(current);const result=fitModelInput({messages:[messages[0]!,...current.map((message,i)=>({id:`m${i}`,message,mandatory:true}))],entries:[entry("optional",1)],policy:defaults,check:(m,c)=>({supported:true,withinBound:m.length===3&&!c})});expect(JSON.stringify(result.messages)).toBe(before);expect(()=>assertCompleteToolGroups(current.slice(0,2))).toThrow("CONTEXT_INCOMPLETE");expect(()=>assertCompleteToolGroups(current.slice(2))).toThrow("CONTEXT_INCOMPLETE");expect(()=>fitModelInput({messages:current.map((message,i)=>({id:`m${i}`,message,mandatory:true})),entries:[],policy:defaults,check:()=>({supported:true,withinBound:false})})).toThrow("CONTEXT_LIMIT_EXCEEDED");});
 it("ranks facts by matched source score or query overlap instead of static fact score",()=>{const items:RecallItem[]=[{type:"fact",id:"irrelevant",content:"User prefers red cars",score:.99,source:"facts"},{type:"fact",id:"relevant",content:"User prefers autumn season",score:.01,source:"facts"},{type:"memory",id:"m",content:"autumn",score:.8,source:"vector"}];expect(relevantRecallItems(items,"What season autumn?",defaults,{tenantId:"t",memorySpaceId:"s"}).map(v=>v.item.id)).toEqual(["m","relevant"]);expect(relevantRecallItems(items,"autumn",{...defaults,relevantMemories:0,relevantFacts:0},{tenantId:"t",memorySpaceId:"s"})).toEqual([]);});
 it("invalid policies and duplicate selection identities fail closed",()=>{expect(()=>modelInputPolicy({...defaults,recentMessages:0})).toThrow();expect(()=>fitModelInput({messages:[messages[1]!,messages[1]!],entries:[],policy:defaults,check:within})).toThrow("CONTEXT_INCOMPLETE");expect(()=>fitModelInput({messages,entries:[entry("duplicate",1),entry("duplicate",2)],policy:defaults,check:within})).toThrow("CONTEXT_INCOMPLETE");});
});

describe("async SDK fitting keeps the original selection semantics",()=>{
 it("awaits every exact candidate in the original weakest-evidence/oldest-history order",async()=>{
  const input={messages,entries:[entry("weak",.1),entry("strong",.9)],policy:defaults};
  const syncCalls:string[]=[],asyncCalls:string[]=[];
  const answer=(m:ModelMessage[],context:string)=>({supported:true as const,withinBound:context===""&&m.length===1});
  const expected=fitModelInput({...input,check:(m,c)=>{syncCalls.push(JSON.stringify([m,c]));return answer(m,c);}});
  let inFlight=0;
  const actual=await fitModelInputAsync({...input,check:async(m,c)=>{expect(inFlight++).toBe(0);asyncCalls.push(JSON.stringify([m,c]));await Promise.resolve();inFlight--;return answer(m,c);}});
  expect(actual).toEqual(expected);expect(asyncCalls).toEqual(syncCalls);expect(asyncCalls).toHaveLength(4);expect(inFlight).toBe(0);
 });
 it("non-input rejection keeps its exact error and makes no later fitting attempt",async()=>{
  const denied=Error("ORIGINAL_QUALIFICATION_DENIED");let calls=0;
  await expect(fitModelInputAsync({messages,entries:[entry("optional",1)],policy:defaults,check:async()=>{calls++;throw denied;}})).rejects.toBe(denied);
  expect(calls).toBe(1);expect(messages).toHaveLength(2);
 });
 it("mandatory overflow never splits a current tool group or erases notice/pending coverage",async()=>{
  const toolMessages:ModelInputMessage[]=[messages[1]!,{id:"call",mandatory:true,message:{role:"assistant",content:[{type:"tool-call",toolCallId:"fixed",toolName:"memory_recall",input:{text:"exact"}}]}},
   {id:"result",mandatory:true,message:{role:"tool",content:[{type:"tool-result",toolCallId:"fixed",toolName:"memory_recall",output:{type:"json",value:{context:"entire result"}}}]}}];
  const before=JSON.stringify(toolMessages),contexts:string[]=[];
  await expect(fitModelInputAsync({messages:toolMessages,entries:[entry("notice",1,"notice"),entry("pending",1,"pending")],policy:defaults,
   check:async(_m,c)=>{contexts.push(c);return {supported:true,withinBound:false};}})).rejects.toThrow("CONTEXT_LIMIT_EXCEEDED");
  expect(JSON.stringify(toolMessages)).toBe(before);expect(contexts).toEqual(["complete entry notice\n\ncomplete entry pending"]);
 });
 it("original invalid identity and incomplete-tool precedence runs before any async check",async()=>{
  let calls=0;const check=async()=>{calls++;return within();};
  await expect(fitModelInputAsync({messages:[messages[1]!,messages[1]!],entries:[],policy:defaults,check})).rejects.toThrow("CONTEXT_INCOMPLETE");
  await expect(fitModelInputAsync({messages:[{id:"orphan",mandatory:true,message:{role:"tool",content:[{type:"tool-result",toolCallId:"orphan",toolName:"memory_recall",output:{type:"text",value:"exact"}}]}}],entries:[],policy:defaults,check})).rejects.toThrow("CONTEXT_INCOMPLETE");
  expect(calls).toBe(0);
 });
});
