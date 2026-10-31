/** Disposable administrator-only qualification endpoints, never package/product installation. */
import { internalAction, internalMutation, internalQuery } from './_generated/server';
import { makeFunctionReference, getServiceToken } from 'convex/server';
import { v } from 'convex/values';
import type { EmbeddingModelV4, LanguageModelV4 } from '@ai-sdk/provider';
import { runtimeAuthorityReference } from './runtimeAuthSchema';
import { createBackendGatewayComposition, ensureBackendGatewayBudget } from './runtimeGatewayBackend';
import { createGovernedGatewayModel, GatewayDispatchError } from './runtimeGateway';
import { canonicalModelJson } from '../src/domain/model-policy';
import { DEFAULT_EMBEDDING_PROFILE, semanticHash } from '../src/domain/profile';
import { parseConflictDecision } from '../src/domain/conflicts';
import { parseFactsResponse } from '../src/domain/extraction';
const fixtureRef = (name: string) => makeFunctionReference<'query'>(`qualification:${name}`);
export const prepare = internalMutation({ args: { reference: runtimeAuthorityReference }, handler: async (ctx,args) => {
  const content = 'The user prefers jasmine tea.';
  const contentHash = await semanticHash(content);
  const source = { tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId!, ownerPrincipalId: args.reference.principalId,
    lineage: { sourceId: 'qualification-source', sourceEventId: 'qualification-source-event', sourceRevision: 1, role: 'user' as const, trust: 'user_assertion' as const }, content, contentHash, createdAt: Date.now() };
  await ctx.db.insert('runtimeMemorySources', source);
  return { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: 1, contentHash };
} });
export const state = internalQuery({ args: { reference: runtimeAuthorityReference }, handler: async (ctx,args) => {
  const accounts = (await ctx.db.query('runtimeBudgetAccounts').collect()).filter(a=>a.tenantId===args.reference.tenantId);
  const operations = (await ctx.db.query('runtimeModelOperations').collect()).filter(a=>a.tenantId===args.reference.tenantId);
  const ids = new Set(operations.map(o=>o._id));
  const attempts = (await ctx.db.query('runtimeModelAttempts').collect()).filter(a=>ids.has(a.operationDocumentId));
  return { accounts: accounts.map(({_id,kind,runBudgetId,limitUnits,reservedUnits,settledUnits,uncertainUnits,activeConcurrency,concurrencyLimit,overrun,cancelled})=>({_id,kind,runBudgetId,limitUnits,reservedUnits,settledUnits,uncertainUnits,activeConcurrency,concurrencyLimit,overrun,cancelled})),
    operations: operations.map(({_id,operationKey,semanticId,parentOperationId,reservedUnits,settledUnits,uncertainUnits,snapshotCanonical})=>({_id,operationKey,semanticId,parentOperationId,reservedUnits,settledUnits,uncertainUnits,snapshot:JSON.parse(snapshotCanonical)})),
    attempts: attempts.map(({_id,operationDocumentId,ordinal,state,reservationUnits,settledCostUnits,dispatchIdentity,slotReleased,resultWithheld,receiptCanonical,privateResultCanonical,checkpointAt})=>({_id,operationDocumentId,ordinal,state,reservationUnits,settledCostUnits,dispatchIdentity,slotReleased,resultWithheld,checkpointAt,receipt:receiptCanonical?JSON.parse(receiptCanonical):null,privateResultBytes:privateResultCanonical?new TextEncoder().encode(privateResultCanonical).length:0})) };
} });
export const exhaust = internalMutation({args:{reference:runtimeAuthorityReference},handler:async(ctx,args)=>{
  const rows=(await ctx.db.query('runtimeBudgetAccounts').collect()).filter(a=>a.tenantId===args.reference.tenantId);
  for(const row of rows) await ctx.db.patch('runtimeBudgetAccounts',row._id,{limitUnits:1});
  return {changed:rows.length};
}});
export const catalog = internalAction({args:{},handler:async()=>{
  const token=await getServiceToken('ai-gateway');
  const response=await fetch('https://ai-gateway.convex.dev/v1/models',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30_000)});
  const body=await response.json();
  return {httpStatus:response.status,observedAt:Date.now(),models:body.data?.filter((m:{id:string})=>['openai/gpt-4o-mini','openai/gpt-4o','openai/text-embedding-3-small'].includes(m.id))??[]};
}});
export const exercise = internalAction({ args: { reference: runtimeAuthorityReference, runId:v.string(), semanticId:v.optional(v.string()), mode:v.union(v.literal('chat'),v.literal('title'),v.literal('embedding'),v.literal('embeddingMemory'),v.literal('extract'),v.literal('resolve'),v.literal('unknown')), source:v.optional(v.object({sourceId:v.string(),sourceEventId:v.string(),sourceRevision:v.number(),contentHash:v.string()})), parentOperationId:v.optional(v.id('runtimeModelOperations')) }, handler: async(ctx,args)=>{
  const budget=await ensureBackendGatewayBudget(ctx,{reference:args.reference,operationKey:'agent.respond',requestId:args.runId,requestCanonical:canonicalModelJson({fixture:'task04',runId:args.runId})});
  const operationKey=args.mode==='title'?'conversation.title':args.mode==='embedding'?'embedding.query':args.mode==='embeddingMemory'?'embedding.memory':args.mode==='extract'?'memory.extract':args.mode==='resolve'?'facts.resolve':'agent.respond';
  const binding={reference:args.reference,operationKey,runBudgetId:budget.runBudgetId,semanticId:args.semanticId??args.mode,ordinal:0,...(args.source?{source:args.source}:{}),...(args.parentOperationId?{parentOperationId:args.parentOperationId}:{})} as const;
  const before=await ctx.runQuery(fixtureRef('state'),{reference:args.reference});
  const composition=createBackendGatewayComposition(ctx); const events:unknown[]=[];
  const admit=composition.ledger.admit; composition.ledger.admit=async(request)=>{const result=await admit(request);events.push({phase:'admit',status:result.status,at:Date.now(),state:await ctx.runQuery(fixtureRef('state'),{reference:args.reference})});return result;};
  const checkpoint=composition.ledger.checkpoint; composition.ledger.checkpoint=async(request)=>{const result=await checkpoint(request);events.push({phase:'checkpoint',at:Date.now(),attemptId:request.attemptId,state:await ctx.runQuery(fixtureRef('state'),{reference:args.reference})});return result;};
  const capture=composition.terminalSink.capture; composition.terminalSink.capture=async(evidence)=>{
    const original=JSON.parse(evidence.receiptCanonical);events.push({phase:'terminal',at:Date.now(),original});
    // Intentional terminal cost-loss injection after a real paid call. Raw known
    // observation remains in this fixture receipt; production policy is unchanged.
    if(args.mode==='unknown'){const {aggregateCostUsd:_cost,...unknown}=original;evidence={...evidence,receiptCanonical:canonicalModelJson({...unknown,costSource:'unavailable'})};}
    return await capture(evidence);
  };
  const h=await createGovernedGatewayModel(composition,binding);
  let result:unknown; let error:unknown; let completionError:unknown;
  try{
    const replay=await h.lifecycle.consumeReplay();
    if(replay) result={replay:true,value:replay};
    else if(operationKey.startsWith('embedding.')){
      const embedded=await (h.model as EmbeddingModelV4).doEmbed({values:['The user prefers jasmine tea.'],abortSignal:h.lifecycle.signal});
      const vector=embedded.embeddings[0]!;
      result={profile:DEFAULT_EMBEDDING_PROFILE,dimensions:vector.length,finite:vector.every(Number.isFinite),norm:Math.sqrt(vector.reduce((s,x)=>s+x*x,0)),usage:embedded.usage??null,vectorHash:await semanticHash(canonicalModelJson(vector)),replay:false};
    }else{
      const prompt=args.mode==='resolve'?'Return only this JSON, no markdown: {"action":"NONE","targetFactId":null,"reason":"The source supports the existing jasmine tea preference.","mergedFact":null,"confidence":100}':args.mode==='extract'?'Return exactly this JSON with no markdown: {"facts":[{"fact":"The user prefers jasmine tea.","factType":"preference","subject":"user","predicate":"prefers","object":"jasmine tea","confidence":1,"tags":[],"entities":[],"relations":[]}]}':args.mode==='title'?'Return the short title: Jasmine Tea Preference':'Reply exactly: CORTEX_GATEWAY_OK';
      const generated=await (h.model as LanguageModelV4).doGenerate({prompt:[{role:'user',content:[{type:'text',text:prompt}]}],maxOutputTokens:args.mode==='extract'?384:32,abortSignal:h.lifecycle.signal});
      const text=generated.content.filter(p=>p.type==='text').map(p=>p.text).join('');
      result={text,usage:generated.usage,finishReason:generated.finishReason,replay:false,...(args.mode==='extract'?{facts:parseFactsResponse(text)}:args.mode==='resolve'?{decision:parseConflictDecision(text)}:{})};
    }
  }catch(e){
    if(e instanceof GatewayDispatchError&&e.code==='REPLAY_AVAILABLE'){const replay=await h.lifecycle.consumeReplay();result={replay:true,value:replay};}
    else error={name:e instanceof Error?e.name:'unknown',code:e instanceof GatewayDispatchError?e.code:e instanceof Error?e.message.slice(0,128):'unknown'};
  }
  finally{try{await h.lifecycle.complete();}catch(e){completionError={name:e instanceof Error?e.name:'unknown',code:e instanceof Error?e.message.slice(0,128):'unknown'};}}
  const after=await ctx.runQuery(fixtureRef('state'),{reference:args.reference});
  return {operationKey,binding,modelId:h.model.modelId,before,after,events,result:result??null,error:error??null,completionError:completionError??null};
} });
export const memoryState = internalQuery({args:{reference:runtimeAuthorityReference},handler:async(ctx,args)=>{
 const scope=(a:{tenantId?:string;memorySpaceId?:string})=>a.tenantId===args.reference.tenantId&&a.memorySpaceId===args.reference.memorySpaceId;
 const sources=(await ctx.db.query('runtimeMemorySources').collect()).filter(scope);
 const chunks=(await ctx.db.query('runtimeMemoryChunks').collect()).filter(scope);
 const vectors=(await ctx.db.query('runtimeMemoryVectors').collect()).filter(scope);
 const facts=(await ctx.db.query('facts').collect()).filter(scope);
 const receipts=(await ctx.db.query('runtimeMemoryReceipts').collect()).filter(scope);
 return {sources:sources.map(s=>({id:s._id,lineage:s.lineage,contentHash:s.contentHash,ownerPrincipalId:s.ownerPrincipalId,tombstonedAt:s.tombstonedAt??null})),chunks:chunks.map(c=>({chunkId:c.chunkId,sourceId:c.sourceId,profileId:c.profileId,textHash:c.textHash})),vectors:await Promise.all(vectors.map(async v=>({vectorId:v.vectorId,chunkId:v.chunkId,sourceId:v.sourceId,profile:v.profile,dimensions:v.embedding.length,finite:v.embedding.every(Number.isFinite),hash:await semanticHash(canonicalModelJson(v.embedding)),ownerPrincipalId:v.ownerPrincipalId}))),facts:facts.map(f=>({factId:f.factId,fact:f.fact,lineage:f.lineage,tombstonedAt:f.tombstonedAt??null,ownerPrincipalId:f.ownerPrincipalId})),receipts:receipts.map(r=>({receiptId:r.receiptId,identity:r.identity}))};
}});
export const tombstoneSource = internalMutation({args:{reference:runtimeAuthorityReference,sourceId:v.string()},handler:async(ctx,args)=>{
 const rows=(await ctx.db.query('runtimeMemorySources').collect()).filter(s=>s.tenantId===args.reference.tenantId&&s.memorySpaceId===args.reference.memorySpaceId&&s.lineage.sourceId===args.sourceId);
 if(rows.length!==1)throw Error('Owned source must be unique');
 await ctx.db.patch('runtimeMemorySources',rows[0]!._id,{tombstonedAt:Date.now()});return{sourceId:args.sourceId,tombstoned:true};
}});
import {createActionMemoryRepository,memoryScope} from './runtimeMemoryRepository';
import {explicitSourceLineage,rememberMemory} from './runtimeMemoryServices';
import {createGatewayMemoryModel} from './runtimeMemoryGateway';
export const diagnoseRemember = internalAction({args:{reference:runtimeAuthorityReference,requestId:v.string(),text:v.string()},handler:async(ctx,args)=>{
 const repository=createActionMemoryRepository(ctx,args.reference,'write');const lineage=explicitSourceLineage(memoryScope(args.reference),args.requestId);
 try{const budget=await ensureBackendGatewayBudget(ctx,{reference:args.reference,operationKey:'memory.extract',requestId:args.requestId,requestCanonical:canonicalModelJson({purpose:'remember',text:args.text,lineage})});
 return{result:await rememberMemory({repository,model:createGatewayMemoryModel(ctx,repository,budget),clock:{now:()=>Date.now()}},{text:args.text,lineage})};}
 catch(e){return{error:{name:e instanceof Error?e.name:'unknown',message:e instanceof Error?e.message:'unknown',stack:e instanceof Error?e.stack:null}};}
}});
export const diagnosticText = internalQuery({args:{reference:runtimeAuthorityReference},handler:async(ctx,args)=>{
 const ops=(await ctx.db.query('runtimeModelOperations').collect()).filter(o=>o.tenantId===args.reference.tenantId&&o.operationKey==='memory.extract');const ids=new Set(ops.map(o=>o._id));
 const attempts=(await ctx.db.query('runtimeModelAttempts').collect()).filter(a=>ids.has(a.operationDocumentId));
 return attempts.map(a=>({attemptId:a._id,state:a.state,resultWithheld:a.resultWithheld,privateText:a.privateResultCanonical?JSON.parse(a.privateResultCanonical):null}));
}});
