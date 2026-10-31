/** Disposable operator-only fixture; not included in the shipped backend. */
import { internalAction, internalQuery } from './_generated/server';
import { makeFunctionReference } from 'convex/server';
import { v } from 'convex/values';
import type { LanguageModelV4, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { runtimeAuthorityReference } from './runtimeAuthSchema';
import { createBackendGatewayComposition, ensureBackendGatewayBudget } from './runtimeGatewayBackend';
import { createGovernedGatewayModel, GatewayDispatchError } from './runtimeGateway';
import { canonicalModelJson } from './_cortex/shared/domain/model_policy';
import { AGENT_NATIVE_TOOLS, AGENT_TOOL_REGISTRY_VERSION, agentToolsInputBound } from './_cortex/shared/domain/agent_tools';

const stateRef=makeFunctionReference<'query'>('gatewayQualification:state');
export const state=internalQuery({args:{reference:runtimeAuthorityReference,runBudgetId:v.optional(v.string())},handler:async(ctx,args)=>{
  const runAccounts=(await ctx.db.query('runtimeBudgetAccounts').collect()).filter(row=>row.tenantId===args.reference.tenantId&&row.kind==='run'&&(!args.runBudgetId||row.runBudgetId===args.runBudgetId));
  const runById=new Map(runAccounts.map(row=>[row._id,row]));
  const operations=(await ctx.db.query('runtimeModelOperations').collect()).filter(row=>row.tenantId===args.reference.tenantId&&runById.has(row.runAccountId));
  const ids=new Set(operations.map(row=>row._id));
  const attempts=(await ctx.db.query('runtimeModelAttempts').collect()).filter(row=>ids.has(row.operationDocumentId));
  const accounts=(await ctx.db.query('runtimeBudgetAccounts').collect()).filter(row=>row.tenantId===args.reference.tenantId&&(!args.runBudgetId||row.kind==='tenant'||row.runBudgetId===args.runBudgetId));
  return {operations:operations.map(row=>({_id:row._id,operationKey:row.operationKey,semanticId:row.semanticId,parentOperationId:row.parentOperationId,
      runBudgetId:runById.get(row.runAccountId)!.runBudgetId,reservedUnits:row.reservedUnits,uncertainUnits:row.uncertainUnits,settledUnits:row.settledUnits,snapshot:JSON.parse(row.snapshotCanonical)})),
    attempts:attempts.map(row=>({_id:row._id,operationDocumentId:row.operationDocumentId,ordinal:row.ordinal,state:row.state,slotReleased:row.slotReleased,
      resultWithheld:row.resultWithheld,reservationUnits:row.reservationUnits,settledCostUnits:row.settledCostUnits,dispatchIdentity:row.dispatchIdentity,
      receipt:row.terminalEvidenceCanonical?JSON.parse(row.terminalEvidenceCanonical):row.receiptCanonical?JSON.parse(row.receiptCanonical):null,
      receiptStorage:row.terminalEvidenceCanonical?"terminalEvidenceCanonical":row.receiptCanonical?"receiptCanonical":"absent",privateResultBytes:row.privateResultCanonical?new TextEncoder().encode(row.privateResultCanonical).length:0})),
    accounts:accounts.map(row=>({_id:row._id,kind:row.kind,runBudgetId:row.runBudgetId,limitUnits:row.limitUnits,reservedUnits:row.reservedUnits,
      settledUnits:row.settledUnits,uncertainUnits:row.uncertainUnits,activeConcurrency:row.activeConcurrency,overrun:row.overrun,cancelled:row.cancelled}))};
}});

export const probe=internalAction({args:{reference:runtimeAuthorityReference,requestId:v.string(),mode:v.union(v.literal('tool'),v.literal('final'),v.literal('generate')),
  call:v.optional(v.object({toolCallId:v.string(),toolName:v.string(),input:v.any()}))},handler:async(ctx,args)=>{
  // Fixed mode/prompt/tool registry: no caller-selected model, provider or native options.
  const requestCanonical=canonicalModelJson({version:1,purpose:'Task07 native tool/stream qualification',requestId:args.requestId});
  const budget=await ensureBackendGatewayBudget(ctx,{reference:args.reference,operationKey:'agent.respond',requestId:args.requestId,requestCanonical});
  const before=await ctx.runQuery(stateRef,{reference:args.reference,runBudgetId:budget.runBudgetId});
  const events:unknown[]=[];const base=createBackendGatewayComposition(ctx);
  const composition={...base,ledger:{...base.ledger,
    admit:async(request:Parameters<typeof base.ledger.admit>[0])=>{const admitted=await base.ledger.admit(request);const canonical=JSON.parse(request.requestCanonical);events.push({phase:'admit',status:admitted.status,
      inputBound:canonical.inputTokens,outputBound:canonical.outputTokens,tools:canonical.tools.map((tool:{name:string})=>tool.name),at:Date.now(),
      state:await ctx.runQuery(stateRef,{reference:args.reference,runBudgetId:budget.runBudgetId})});return admitted;},
    checkpoint:async(request:Parameters<typeof base.ledger.checkpoint>[0])=>{const value=await base.ledger.checkpoint(request);events.push({phase:'checkpoint',attemptId:request.attemptId,at:Date.now()});return value;}},
    terminalSink:{capture:async(evidence:Parameters<typeof base.terminalSink.capture>[0])=>{events.push({phase:'terminal',at:Date.now(),receipt:JSON.parse(evidence.receiptCanonical)});return await base.terminalSink.capture(evidence);}}};
  const model=await createGovernedGatewayModel(composition,{reference:args.reference,operationKey:'agent.respond',runBudgetId:budget.runBudgetId,
    semanticId:'Task07-qualification-'+args.mode,ordinal:args.mode==='tool'?0:args.mode==='final'?1:2});
  const prompt:Parameters<LanguageModelV4['doStream']>[0]['prompt']=[{role:'user',content:[{type:'text',text:'Use memory_recall exactly once with text jasmine tea and limit 1. After receiving the result, answer exactly: CORTEX_AGENT_TOOL_STREAM_OK.'}]}];
  if(args.mode==='final'){
    if(!args.call||args.call.toolName!=='memory_recall'||canonicalModelJson(args.call.input)!=='{"limit":1,"text":"jasmine tea"}')throw new Error('INVALID_QUALIFICATION_TOOL_RESULT');
    prompt.push({role:'assistant',content:[{type:'tool-call',...args.call}]},
      {role:'tool',content:[{type:'tool-result',toolCallId:args.call.toolCallId,toolName:args.call.toolName,output:{type:'json',value:{context:'The user prefers jasmine tea.',profileId:'qualification-scoped-memory'}}}]});
  }
  const tools=AGENT_NATIVE_TOOLS.map(tool=>({...tool,inputSchema:{...tool.inputSchema,required:[...tool.inputSchema.required]}}));
  const native={prompt,tools,toolChoice:args.mode!=='final'?{type:'tool' as const,toolName:'memory_recall'}:{type:'none' as const},maxOutputTokens:128,abortSignal:model.lifecycle.signal};
  const serialized=canonicalModelJson({messages:prompt.map(message=>({role:message.role,parts:message.content})),
    tools:AGENT_NATIVE_TOOLS.map(tool=>({name:tool.name,definition:{description:tool.description,inputSchema:tool.inputSchema}})),toolChoice:native.toolChoice});
  const inputBound=agentToolsInputBound(serialized,prompt.length,AGENT_NATIVE_TOOLS.length);
  const parts:unknown[]=[];let reader:ReadableStreamDefaultReader<LanguageModelV4StreamPart>|undefined,result:unknown,error:unknown;const cleanupErrors:unknown[]=[];
  try{
    if(args.mode==='generate'){
      const generated=await (model.model as LanguageModelV4).doGenerate(native);parts.push(...generated.content, {type:'finish',finishReason:generated.finishReason,usage:generated.usage});
    }else{
      const streamed=await (model.model as LanguageModelV4).doStream(native);reader=streamed.stream.getReader();
      while(true){const item=await reader.read();if(item.done)break;
        const part=item.value;if(part.type==='text-delta'||part.type==='tool-call'||part.type==='tool-input-start'||part.type==='tool-input-delta'||part.type==='tool-input-end'||part.type==='finish'||part.type==='error')parts.push(part);
        if(parts.length>2048)throw new Error('QUALIFICATION_STREAM_LIMIT');
      }
    }
    result={parts,registryVersion:AGENT_TOOL_REGISTRY_VERSION,nativeModelId:model.model.modelId,nativeInterface:'chat',
      featureEnvelope:'agent-tools-chat-v1',serializedBytes:new TextEncoder().encode(serialized).length,inputBound};
  }catch(e){if(e instanceof GatewayDispatchError&&e.code==='REPLAY_AVAILABLE')result={replay:true,value:await model.lifecycle.consumeReplay()};
    else error={name:e instanceof Error?e.name:'unknown',code:e instanceof GatewayDispatchError?e.code:e instanceof Error?e.message:'unknown'};
  }finally{if(error)model.lifecycle.cancel();try{reader?.releaseLock();}catch(e){cleanupErrors.push({phase:'reader',message:e instanceof Error?e.message:'unknown'});}
    try{await model.lifecycle.complete();}catch(e){cleanupErrors.push({phase:'lifecycle',message:e instanceof Error?e.message:'unknown'});}}
  return {mode:args.mode,before,events,result:result??null,error:error??null,cleanupErrors,
    after:await ctx.runQuery(stateRef,{reference:args.reference,runBudgetId:budget.runBudgetId})};
}});
