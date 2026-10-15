import { sufficientDirectFactLookup, directFactTraversalCompatible, directFactTraversalComplete, DIRECT_FACT_RECALL_ROUTE } from "../src/domain/memory-direct-recall";
import type { MemoryEffortRequest } from "../src/domain/memory-effort";
import { traverseConvexMemory,factEvidenceNode,sourceEvidenceNode,createMemoryRetrievalWorkClock } from "./runtimeMemoryTraversal";
import { memoryEffortRequest } from "./runtimeMemorySchema";
/** Private ordinary Agent read pipeline. Proposals never establish current authority. */
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import type { ActionCtx, QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { DerivedFact, SourceLineage } from "../src/domain/contracts";
import { contextSourceKey } from "../src/domain/memory-context";
import type { ContextSourceWitness } from "../src/domain/context-witness";
import { mergeContextWitness } from "../src/domain/context-witness";
import type { DomainClock } from "../src/domain/clock";
import type { EmbeddingProfile } from "../src/domain/profile";
import { LARGE_EMBEDDING_PROFILE, semanticHash } from "../src/domain/profile";
import { validateModelEmbeddings } from "../src/domain/sources";
import { canonicalModelJson } from "../src/domain/model-policy";
import { agentAttempt } from "./runtimeAgentSchema";
import { embeddingProfile, derivedFact, memoryDeliveryBindings } from "./runtimeMemorySchema";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { contextBoundary } from "./runtimeMemoryContext";
import type { ContextBoundary } from "./runtimeMemoryContext";
import { readCurrentEmbeddingProfile } from "./runtimeModelPolicy";
import { internalQuery, internalMutation } from "./_generated/server";
import { createAuthorityReadScope, createV8AuthorityReadScope, withNativeSnapshotReads, freshManagedSourceReads } from "./runtimeAuth";
import { contextSourceBatchHandler } from "./runtimeAgent";
import { currentQuery, boundedRefusal, throwRefusal } from "./runtimeAgentQueryEmbedding";
import type { AgentQueryEmbeddingAttempt } from "./runtimeAgentQueryEmbedding";
import { ConvexMemoryRepository, captureRecallFact, captureRecallVectors, canonicalMemoryValue, memoryError,
  memoryReferences, vectorOwnerScopeKey, vectorScopeKey } from "./runtimeMemoryRepository";
import type { MemoryDeliveryBindings } from "./runtimeMemoryRepository";
import { completeRecallDelivery, vectorRecallItems } from "./runtimeMemoryServices";
import { traceRuntimePhase } from "./runtimeLatencyTrace";

type Input = { text: string; requestId: string; limit: number;memory?:MemoryEffortRequest };
type Selection = { cutoff: number; boundary: ContextBoundary; excludedSourceKeys: string[] };
export type AgentRecallSelection = Selection & { onSelected(value: { witnesses: ContextSourceWitness[]; provenance: [string, SourceLineage][]; sourceScores?: [string, number][]; itemLineages?: [string, SourceLineage][] }): void };
const privateInlineSelection = Symbol("private-inline-agent-selection");
/** Internal opt-in for the V8 context assembler's synchronous Map bookkeeping.
 * Arbitrary callbacks keep the original read/callback/final-delivery sequence. */
export function withPrivateInlineAgentSelection(selection: AgentRecallSelection): AgentRecallSelection {
  return Object.defineProperty({ ...selection }, privateInlineSelection, { value: true });
}
// Private elapsed-work origin only; it grants no authority and cannot enlarge
// the current server policy. Omission keeps historical callers valid.
type Args = AgentQueryEmbeddingAttempt & { input: Input; profile: EmbeddingProfile; selection: Selection; retrievalStartedAt?:number };
type FactPlan = { kind: "ready"; facts: DerivedFact[]; bindings: MemoryDeliveryBindings;candidateWorkBound?:true } | { kind: "refused"; refusalCanonical: string };
const emptyBindings = (): MemoryDeliveryBindings => ({ sources: [], facts: [], vectors: [] });
const selectionArgs = v.object({ cutoff: v.number(), boundary: contextBoundary, excludedSourceKeys: v.array(v.string()) });
const inputArgs = v.object({ text: v.string(), requestId: v.string(), limit: v.number(),memory:v.optional(memoryEffortRequest) });
const nativeArgs = { ...agentAttempt, input: inputArgs, profile: embeddingProfile, selection: selectionArgs, retrievalStartedAt:v.optional(v.number()) };
const factPlanArgs = v.union(v.object({ kind: v.literal("ready"), facts: v.array(derivedFact), bindings: memoryDeliveryBindings,candidateWorkBound:v.optional(v.literal(true)) }),
  v.object({ kind: v.literal("refused"), refusalCanonical: v.string() }));

async function currentRead(ctx: QueryCtx, args: Args, expectedVersion?: 8) {
  const { current } = await currentQuery(ctx, args);
  if (expectedVersion === 8 && current.snapshot.version !== 8) memoryError("INVALID_STATE", "V8 recall required");
  const expectedBoundary = { conversationId: current.snapshot.conversationId, runId: args.runId,
    queueSequence: current.snapshot.queueSequence, anchor: { order: current.snapshot.anchor.order, stepOrder: current.snapshot.anchor.stepOrder } };
  if (args.selection.cutoff !== current.snapshot.ingestionCutoff.sequence || canonicalModelJson(args.selection.boundary) !== canonicalModelJson(expectedBoundary)
    || args.selection.excludedSourceKeys.length > 1032) memoryError("POLICY_DENIED", "Agent recall boundary changed");
  return { current, repository: new ConvexMemoryRepository(ctx, args.reference, "read", undefined, { now: () => Date.now() },
    (key, runBudgetId) => readCurrentEmbeddingProfile(ctx, args.reference, key, runBudgetId)) };
}
export async function prepareReadsHandler(nativeCtx: QueryCtx, args: Args, expectedVersion?: 8) {
  const ctx = expectedVersion === 8 ? createV8AuthorityReadScope(nativeCtx, { managedSources: true }) : createAuthorityReadScope(nativeCtx, { nativeTranscript: true, policyMetadata: true });
  const { current, repository } = await currentRead(ctx, args, expectedVersion);
  const sourceCtx = expectedVersion === 8 ? withNativeSnapshotReads(nativeCtx, ctx) : nativeCtx;
  const [vector, facts] = await Promise.allSettled([
    (async () => { const authority = await repository.authority(undefined, "read");
      await repository.assertProfileReady(args.profile, current.run.runBudgetId); return { resourceAccess: authority.resourceAccess }; })(),
    (async (): Promise<FactPlan> => { const candidates = args.input.memory===undefined?{facts:await repository.listFacts({ limit: args.input.limit }),candidateWorkBound:false}:await repository.searchFactCandidates(args.input.text,args.input.limit), bindings = emptyBindings();
      for (const fact of candidates.facts) await captureRecallFact(bindings, fact, await new ConvexMemoryRepository(sourceCtx, args.reference, "read").getSource(fact.lineage.sourceId));
      return { kind: "ready", facts: candidates.facts, bindings,...(candidates.candidateWorkBound?{candidateWorkBound:true as const}:{}) }; })(),
  ]);
  if (vector.status === "rejected") throw vector.reason;
  const factPlan: FactPlan = facts.status === "fulfilled" ? facts.value
    : { kind: "refused", refusalCanonical: canonicalModelJson(boundedRefusal(facts.reason)) };
  return { ...vector.value, factPlan };
}
export const prepareReads = internalQuery({ args: nativeArgs, handler: prepareReadsHandler });

export async function readMatchesHandler(nativeCtx: QueryCtx, args: Args & { hits: { id: Id<"runtimeMemoryVectors">; score: number }[]; factPlan: FactPlan }, expectedVersion?: 8, invocationScope?: QueryCtx, directFacts = false, inspectFact?:(fact:DerivedFact)=>void,workClock=createMemoryRetrievalWorkClock()) {
  const ctx = invocationScope ?? (expectedVersion === 8 ? createV8AuthorityReadScope(nativeCtx, { managedSources: true }) : createAuthorityReadScope(nativeCtx, { nativeTranscript: true, policyMetadata: true }));
  const { current, repository } = await currentRead(ctx, args, expectedVersion), bindings = emptyBindings();
  // Only this exact native owner shares raw rows across source traversals.
  // Every source/permission predicate still executes; the final raw fence below
  // and later save/admission invocations do not inherit this reader.
  const sourceCtx = expectedVersion === 8 ? withNativeSnapshotReads(nativeCtx, ctx) : nativeCtx;
  const matches = await repository.hydrateVectors(args.hits, args.profile, current.run.runBudgetId);
  await captureRecallVectors(bindings, matches, args.profile, { runBudgetId: current.run.runBudgetId });
  const selectedVectors = await contextSourceBatchHandler(sourceCtx, { reference: args.reference, ...args.selection, permission: "canViewMemories",
    witnesses: [], priorWitnesses: [], items: matches.map(match => ({ sourceId: match.source.lineage.sourceId,
      expected: { sourceEventId: match.source.lineage.sourceEventId, sourceRevision: match.source.lineage.sourceRevision, contentHash: match.source.contentHash } })) });
  // A fact refusal is delivered only after the original complete vector source branch.
  if (args.factPlan.kind === "refused") throwRefusal(JSON.parse(args.factPlan.refusalCanonical));
  const { facts, bindings: factBindings } = args.factPlan;
  if (facts.length > args.input.limit || factBindings.vectors.length || factBindings.facts.length > 101 || factBindings.sources.length > 201
    || new TextEncoder().encode(canonicalMemoryValue(factBindings)).byteLength > 262144) memoryError("INVALID_INPUT", "Invalid fact read plan");
  const expectedFacts: MemoryDeliveryBindings["facts"] = [];
  for (const fact of facts) {
    const expected = { factId: fact.factId, payloadHash: await semanticHash(canonicalMemoryValue(fact)) };
    if (!expectedFacts.some(value => value.factId === expected.factId && value.payloadHash === expected.payloadHash)) expectedFacts.push(expected);
    if (!factBindings.sources.some(value => value.sourceId === fact.lineage.sourceId && value.sourceEventId === fact.lineage.sourceEventId
      && value.sourceRevision === fact.lineage.sourceRevision && value.ownerPrincipalId === fact.ownerPrincipalId && value.permission === "canViewFacts"
      && /^[a-f0-9]{64}$/.test(value.contentHash))) memoryError("INVALID_INPUT", "Fact plan lost its source binding");
  }
  if (canonicalMemoryValue(expectedFacts) !== canonicalMemoryValue(factBindings.facts)) memoryError("INVALID_INPUT", "Fact plan payload binding changed");
  const selectedFacts = await contextSourceBatchHandler(sourceCtx, { reference: args.reference, ...args.selection, permission: "canViewFacts",
    witnesses: [], priorWitnesses: selectedVectors.witnesses,
    items: facts.map(fact => ({ sourceId: fact.lineage.sourceId, expected: { sourceEventId: fact.lineage.sourceEventId, sourceRevision: fact.lineage.sourceRevision } })) });
  const witnesses = new Map(selectedVectors.witnesses.map(value => [value.sourceId, value]));
  for (const next of selectedFacts.witnesses) {
    const witness = mergeContextWitness(witnesses.get(next.sourceId), next);
    if (!witness) memoryError("STALE_CONTEXT", "Agent context source changed"); witnesses.set(next.sourceId, witness);
  }
  const provenance = new Map(selectedVectors.provenance);
  for (const [key, value] of selectedFacts.provenance) provenance.set(key, value);
  for (const source of factBindings.sources) if (!bindings.sources.some(value => canonicalMemoryValue(value) === canonicalMemoryValue(source))) bindings.sources.push(source);
  for (const fact of factBindings.facts) if (!bindings.facts.some(value => value.factId === fact.factId && value.payloadHash === fact.payloadHash)) bindings.facts.push(fact);
  const effort=current.snapshot.version===8?current.snapshot.inputSelection.effort:undefined;
  const effortResult=effort?await traverseConvexMemory(sourceCtx,repository,[...selectedVectors.selectedIndexes.map(index=>{const match=matches[index]!;return {...sourceEvidenceNode(match.source,match.score),item:vectorRecallItems([match])[0]!};}),...selectedFacts.selectedIndexes.map(index=>factEvidenceNode(facts[index]!,directFacts?1:undefined))],effort,bindings,async node=>{
    const selected=await contextSourceBatchHandler(sourceCtx,{reference:args.reference,...args.selection,permission:node.item.type==="fact"?"canViewFacts":"canViewMemories",witnesses:[],priorWitnesses:witnesses.has(node.lineage.sourceId)?[witnesses.get(node.lineage.sourceId)!]:[],items:[{sourceId:node.lineage.sourceId,expected:{sourceEventId:node.lineage.sourceEventId,sourceRevision:node.lineage.sourceRevision}}]});
    for(const next of selected.witnesses){const merged=mergeContextWitness(witnesses.get(next.sourceId),next);if(!merged)memoryError("STALE_CONTEXT","Traversal source changed");witnesses.set(next.sourceId,merged);}
    for(const [key,lineage] of selected.provenance)provenance.set(key,lineage);
    return selected.selectedIndexes.length===1;
  },inspectFact,args.input.text,args.retrievalStartedAt,workClock):undefined;
  if(effortResult){
    for(const stage of [...(args.factPlan.candidateWorkBound?["direct-fact-candidate-work-bound"]:[]),...(args.hits.length===args.input.limit?["direct-vector-candidate-work-bound"]:[])]){
      if(!effortResult.memoryEffort.unavailableStages.includes(stage))effortResult.memoryEffort.unavailableStages.push(stage);
      if(!effortResult.memoryEffort.stopReasons.includes("work"))effortResult.memoryEffort.stopReasons.push("work");
    }
    const retainedSources=new Set(bindings.sources.map(value=>value.sourceId));
    for(const [sourceId,witness] of witnesses){
      if(!retainedSources.has(sourceId)){witnesses.delete(sourceId);continue;}
      const permissions=[...new Set(bindings.sources.filter(value=>value.sourceId===sourceId).map(value=>value.permission))];
      witnesses.set(sourceId,{...witness,permissions});
    }
    for(const [key,lineage] of provenance)if(!retainedSources.has(lineage.sourceId))provenance.delete(key);
  }
  await new ConvexMemoryRepository(nativeCtx, args.reference, "read").recheckAuthority();
  return { ...(effortResult?{effortResult}:{}),vectorItems: vectorRecallItems(selectedVectors.selectedIndexes.map(index => matches[index]!)),
    facts: selectedFacts.selectedIndexes.map(index => facts[index]!), bindings, witnesses: [...witnesses.values()], provenance: [...provenance.entries()],
    itemLineages: [...(effortResult?.itemLineages??[]),...selectedVectors.selectedIndexes.map(index => [`memory:${matches[index]!.chunk.chunkId}`, matches[index]!.source.lineage] as [string, SourceLineage]), ...selectedFacts.selectedIndexes.map(index => [`fact:${facts[index]!.factId}`, facts[index]!.lineage] as [string, SourceLineage])],
    sourceScores: selectedVectors.selectedIndexes.map(index => [contextSourceKey({ tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId! }, matches[index]!.source.lineage), matches[index]!.score] as [string, number]) };
}
export const readMatches = internalQuery({ args: { ...nativeArgs, hits: v.array(v.object({ id: v.id("runtimeMemoryVectors"), score: v.number() })), factPlan: factPlanArgs }, handler: readMatchesHandler });
const prepareRef = makeFunctionReference("runtimeAgentRecall:prepareReads") as unknown as FunctionReference<"query", "internal", Args, Awaited<ReturnType<typeof prepareReadsHandler>>>;
const matchesRef = makeFunctionReference("runtimeAgentRecall:readMatches") as unknown as FunctionReference<"query", "internal", Parameters<typeof readMatchesHandler>[1], Awaited<ReturnType<typeof readMatchesHandler>>>;

/** Actual fresh native reads around the original Action-only ANN search. */
export async function finishAgentRecall(ctx: ActionCtx, attempt: AgentQueryEmbeddingAttempt, clock: DomainClock, input: Input,
  profile: EmbeddingProfile, result: Parameters<typeof validateModelEmbeddings>[0], selection: AgentRecallSelection,startedAt?:number) {
  validateModelEmbeddings(result, profile, 1);
  const { onSelected, ...scope } = selection;
  const args = { ...attempt, input, profile, selection: scope };
  const plan = await ctx.runQuery(prepareRef, args);
  const hits = await ctx.vectorSearch("runtimeMemoryVectors", profile.indexName === LARGE_EMBEDDING_PROFILE.indexName ? "by_large_embedding_v1" : "by_default_embedding_v1", {
    vector: [...result.vectors[0]!], limit: input.limit,
    filter: q => plan.resourceAccess === "own"
      ? q.eq("scopeProfileOwnerKey", vectorOwnerScopeKey(attempt.reference.tenantId, attempt.reference.memorySpaceId!, profile.profileId, attempt.reference.principalId))
      : q.eq("scopeProfileKey", vectorScopeKey(attempt.reference.tenantId, attempt.reference.memorySpaceId!, profile.profileId)),
  });
  const read = await ctx.runQuery(matchesRef, { ...args, factPlan: plan.factPlan, hits: hits.map(hit => ({ id: hit._id, score: hit._score })) });
  onSelected({ witnesses: read.witnesses, provenance: read.provenance, sourceScores: read.sourceScores, itemLineages: read.itemLineages });
  return await completeRecallDelivery({ clock, finalDelivery: async () => await ctx.runMutation(memoryReferences.finalDelivery,
    { reference: attempt.reference, bindings: read.bindings }) }, input, profile.profileId, read.vectorItems, read.facts,read.effortResult,startedAt);
}

export const prepareReadsV8 = internalQuery({ args: nativeArgs, handler: (ctx, args) => prepareReadsHandler(ctx, args, 8) });
export const readMatchesV8 = internalQuery({ args: { ...nativeArgs, hits: v.array(v.object({ id: v.id("runtimeMemoryVectors"), score: v.number() })), factPlan: factPlanArgs },
  handler: (ctx, args) => readMatchesHandler(ctx, args, 8) });
/** Same consumed-row predicates and final unscoped grant/deadline fence. Only
 * the original profile helper executes locally instead of in a child query. */
export async function finalDeliveryV8Handler(nativeCtx: QueryCtx | MutationCtx, args: { reference: AgentQueryEmbeddingAttempt["reference"]; bindings: MemoryDeliveryBindings }, invocationScope?: QueryCtx | MutationCtx) {
  const ctx = invocationScope ?? createV8AuthorityReadScope(nativeCtx, { managedSources: true });
  // The original final resource pass begins with fresh raw ancestry rows.
  freshManagedSourceReads(ctx);
  return await new ConvexMemoryRepository(ctx, args.reference, "read", undefined, { now: () => Date.now() },
    (key, runBudgetId) => readCurrentEmbeddingProfile(ctx, args.reference, key, runBudgetId)).checkDelivery(args.bindings, nativeCtx);
}
export const finalDeliveryV8 = internalMutation({ args: { reference: runtimeAuthorityReference, bindings: memoryDeliveryBindings }, handler: finalDeliveryV8Handler });
const prepareV8Ref = makeFunctionReference("runtimeAgentRecall:prepareReadsV8") as unknown as typeof prepareRef;
const matchesV8Ref = makeFunctionReference("runtimeAgentRecall:readMatchesV8") as unknown as typeof matchesRef;
const deliveryV8Ref = makeFunctionReference("runtimeAgentRecall:finalDeliveryV8") as unknown as typeof memoryReferences.finalDelivery;

/** No application writes. Per-source reads and the final authority fence keep
 * the raw native context; only trusted raw control readers share this snapshot.
 * Defer delivery refusal so Action selection/ranking retain their precedence. */
export async function readMatchesAndDeliveryV8Handler(nativeCtx: MutationCtx, args: Parameters<typeof readMatchesHandler>[1]) {
  const ctx = createV8AuthorityReadScope(nativeCtx, { managedSources: true });
  const read = await readMatchesHandler(nativeCtx, args, 8, ctx);
  try { return { read, delivery: await finalDeliveryV8Handler(nativeCtx, { reference: args.reference, bindings: read.bindings }, ctx) }; }
  catch (error) {
    const refusal = boundedRefusal(error);
    if (refusal.kind !== "convex" && refusal.kind !== "gateway") throw error;
    return { read, refusal };
  }
}
export const readMatchesAndDeliveryV8 = internalMutation({ args: { ...nativeArgs, hits: v.array(v.object({ id: v.id("runtimeMemoryVectors"), score: v.number() })), factPlan: factPlanArgs }, handler: readMatchesAndDeliveryV8Handler });
const matchesDeliveryV8Ref = makeFunctionReference("runtimeAgentRecall:readMatchesAndDeliveryV8") as unknown as FunctionReference<"mutation", "internal", Parameters<typeof readMatchesHandler>[1], Awaited<ReturnType<typeof readMatchesAndDeliveryV8Handler>>>;

export async function finishAgentRecallV8(ctx: ActionCtx, attempt: AgentQueryEmbeddingAttempt, clock: DomainClock, input: Input,
  profile: EmbeddingProfile, result: Parameters<typeof validateModelEmbeddings>[0], selection: AgentRecallSelection,startedAt?:number) {
  validateModelEmbeddings(result, profile, 1);
  if(startedAt===undefined&&input.memory!==undefined)startedAt=clock.now();
  const { onSelected, ...scope } = selection;
  const args = { ...attempt, input, profile, selection: scope, ...(startedAt===undefined?{}:{retrievalStartedAt:startedAt}) };
  const plan = await ctx.runQuery(prepareV8Ref, args);
  const hits = await ctx.vectorSearch("runtimeMemoryVectors", profile.indexName === LARGE_EMBEDDING_PROFILE.indexName ? "by_large_embedding_v1" : "by_default_embedding_v1", {
    vector: [...result.vectors[0]!], limit: input.limit,
    filter: q => plan.resourceAccess === "own"
      ? q.eq("scopeProfileOwnerKey", vectorOwnerScopeKey(attempt.reference.tenantId, attempt.reference.memorySpaceId!, profile.profileId, attempt.reference.principalId))
      : q.eq("scopeProfileKey", vectorScopeKey(attempt.reference.tenantId, attempt.reference.memorySpaceId!, profile.profileId)),
  });
  const nativeArgs = { ...args, factPlan: plan.factPlan, hits: hits.map(hit => ({ id: hit._id, score: hit._score })) };
  // The brand is local server data, never an RPC argument or authority proof.
  const combined = (selection as AgentRecallSelection & { [privateInlineSelection]?: true })[privateInlineSelection]
    ? await ctx.runMutation(matchesDeliveryV8Ref, nativeArgs) : undefined;
  const read = combined ? combined.read : await ctx.runQuery(matchesV8Ref, nativeArgs);
  if(read.effortResult)read.effortResult.memoryEffort.retrievalRoute="semantic-v1";
  onSelected({ witnesses: read.witnesses, provenance: read.provenance, sourceScores: read.sourceScores, itemLineages: read.itemLineages });
  return await completeRecallDelivery({ clock, finalDelivery: async () => {
    if (!combined) return await ctx.runMutation(deliveryV8Ref, { reference: attempt.reference, bindings: read.bindings });
    if (combined.refusal !== undefined) throwRefusal(combined.refusal);
    return combined.delivery;
  } }, input, profile.profileId, read.vectorItems, read.facts,read.effortResult,startedAt);
}

/** Effort-aware V8 only: scoped native facts, existing real source traversal and
 * final raw delivery predicates. No model proposal, reservation or vector query. */
export async function readDirectAgentRecallV8Handler(nativeCtx: QueryCtx, args: Args) {
  const workClock=createMemoryRetrievalWorkClock();
  const ctx=createV8AuthorityReadScope(nativeCtx,{managedSources:true});
  const {current,repository}=await currentRead(ctx,args,8);
  if(current.snapshot.version!==8||current.snapshot.inputSelection.version!==2)return undefined;
  const candidates=await repository.searchFactCandidates(args.input.text,args.input.limit);
  const sufficient=sufficientDirectFactLookup(args.input.text,candidates,Date.now());
  traceRuntimePhase(args.runId,args.attemptNumber,`context.direct.candidates.${candidates.candidateWorkBound?"work-bound":sufficient?"sufficient":"insufficient"}`,{selectedFacts:candidates.facts.length});
  if(!sufficient)return undefined;
  const bindings=emptyBindings();
  for(const fact of candidates.facts)await captureRecallFact(bindings,fact,await repository.getSource(fact.lineage.sourceId,"canViewFacts"));
  let compatible=true;
  const read=await readMatchesHandler(nativeCtx,{...args,hits:[],factPlan:{kind:"ready",facts:candidates.facts,bindings}},8,ctx,true,fact=>{compatible=compatible&&directFactTraversalCompatible(candidates.facts[0]!,[fact]);},workClock);
  const trace=read.effortResult?.memoryEffort,hasFact=!!read.effortResult?.items.some(item=>item.type==="fact");
  const complete=trace!==undefined&&directFactTraversalComplete(trace);
  traceRuntimePhase(args.runId,args.attemptNumber,`context.direct.traversal.${!hasFact?"no-fact":!compatible?"conflict":!complete?"partial":"ready"}`,{selectedFacts:trace?.entriesByKind.fact,selectedMemories:trace?.entriesByKind.memory,durationMs:trace?.durationMs});
  for(const reason of trace?.stopReasons??[])traceRuntimePhase(args.runId,args.attemptNumber,`context.direct.stop.${reason}`);
  if(!hasFact||!compatible||!complete||!read.effortResult)return undefined;
  read.effortResult.memoryEffort.retrievalRoute=DIRECT_FACT_RECALL_ROUTE;
  const delivery=await finalDeliveryV8Handler(nativeCtx,{reference:args.reference,bindings:read.bindings},ctx);
  return {read,delivery,profileId:args.profile.profileId};
}
export async function finishDirectAgentRecallV8(clock:DomainClock,input:Input,selected:NonNullable<Awaited<ReturnType<typeof readDirectAgentRecallV8Handler>>>,selection:AgentRecallSelection,startedAt:number){
  const {read}=selected;
  selection.onSelected({witnesses:read.witnesses,provenance:read.provenance,sourceScores:read.sourceScores,itemLineages:read.itemLineages});
  return await completeRecallDelivery({clock,finalDelivery:async()=>selected.delivery},input,selected.profileId,read.vectorItems,read.facts,read.effortResult,startedAt);
}
