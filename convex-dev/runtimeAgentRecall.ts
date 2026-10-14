/** Private ordinary Agent read pipeline. Proposals never establish current authority. */
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import type { ActionCtx, QueryCtx } from "./_generated/server";
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
import { contextBoundary } from "./runtimeMemoryContext";
import type { ContextBoundary } from "./runtimeMemoryContext";
import { readCurrentEmbeddingProfile } from "./runtimeModelPolicy";
import { internalQuery } from "./_generated/server";
import { createAuthorityReadScope } from "./runtimeAuth";
import { contextSourceBatchHandler } from "./runtimeAgent";
import { currentQuery, boundedRefusal, throwRefusal } from "./runtimeAgentQueryEmbedding";
import type { AgentQueryEmbeddingAttempt } from "./runtimeAgentQueryEmbedding";
import { ConvexMemoryRepository, captureRecallFact, captureRecallVectors, canonicalMemoryValue, memoryError,
  memoryReferences, vectorOwnerScopeKey, vectorScopeKey } from "./runtimeMemoryRepository";
import type { MemoryDeliveryBindings } from "./runtimeMemoryRepository";
import { completeRecallDelivery, vectorRecallItems } from "./runtimeMemoryServices";

type Input = { text: string; requestId: string; limit: number };
type Selection = { cutoff: number; boundary: ContextBoundary; excludedSourceKeys: string[] };
export type AgentRecallSelection = Selection & { onSelected(value: { witnesses: ContextSourceWitness[]; provenance: [string, SourceLineage][]; sourceScores?: [string, number][]; itemLineages?: [string, SourceLineage][] }): void };
type Args = AgentQueryEmbeddingAttempt & { input: Input; profile: EmbeddingProfile; selection: Selection };
type FactPlan = { kind: "ready"; facts: DerivedFact[]; bindings: MemoryDeliveryBindings } | { kind: "refused"; refusalCanonical: string };
const emptyBindings = (): MemoryDeliveryBindings => ({ sources: [], facts: [], vectors: [] });
const selectionArgs = v.object({ cutoff: v.number(), boundary: contextBoundary, excludedSourceKeys: v.array(v.string()) });
const inputArgs = v.object({ text: v.string(), requestId: v.string(), limit: v.number() });
const nativeArgs = { ...agentAttempt, input: inputArgs, profile: embeddingProfile, selection: selectionArgs };
const factPlanArgs = v.union(v.object({ kind: v.literal("ready"), facts: v.array(derivedFact), bindings: memoryDeliveryBindings }),
  v.object({ kind: v.literal("refused"), refusalCanonical: v.string() }));

async function currentRead(ctx: QueryCtx, args: Args) {
  const { current } = await currentQuery(ctx, args);
  const expectedBoundary = { conversationId: current.snapshot.conversationId, runId: args.runId,
    queueSequence: current.snapshot.queueSequence, anchor: { order: current.snapshot.anchor.order, stepOrder: current.snapshot.anchor.stepOrder } };
  if (args.selection.cutoff !== current.snapshot.ingestionCutoff.sequence || canonicalModelJson(args.selection.boundary) !== canonicalModelJson(expectedBoundary)
    || args.selection.excludedSourceKeys.length > 1032) memoryError("POLICY_DENIED", "Agent recall boundary changed");
  return { current, repository: new ConvexMemoryRepository(ctx, args.reference, "read", undefined, { now: () => Date.now() },
    (key, runBudgetId) => readCurrentEmbeddingProfile(ctx, args.reference, key, runBudgetId)) };
}
export async function prepareReadsHandler(nativeCtx: QueryCtx, args: Args) {
  const ctx = createAuthorityReadScope(nativeCtx, { nativeTranscript: true, policyMetadata: true });
  const { current, repository } = await currentRead(ctx, args);
  const [vector, facts] = await Promise.allSettled([
    (async () => { const authority = await repository.authority(undefined, "read");
      await repository.assertProfileReady(args.profile, current.run.runBudgetId); return { resourceAccess: authority.resourceAccess }; })(),
    (async (): Promise<FactPlan> => { const values = await repository.listFacts({ limit: args.input.limit }), bindings = emptyBindings();
      for (const fact of values) await captureRecallFact(bindings, fact, await new ConvexMemoryRepository(nativeCtx, args.reference, "read").getSource(fact.lineage.sourceId));
      return { kind: "ready", facts: values, bindings }; })(),
  ]);
  if (vector.status === "rejected") throw vector.reason;
  const factPlan: FactPlan = facts.status === "fulfilled" ? facts.value
    : { kind: "refused", refusalCanonical: canonicalModelJson(boundedRefusal(facts.reason)) };
  return { ...vector.value, factPlan };
}
export const prepareReads = internalQuery({ args: nativeArgs, handler: prepareReadsHandler });

export async function readMatchesHandler(nativeCtx: QueryCtx, args: Args & { hits: { id: Id<"runtimeMemoryVectors">; score: number }[]; factPlan: FactPlan }) {
  const ctx = createAuthorityReadScope(nativeCtx, { nativeTranscript: true, policyMetadata: true });
  const { current, repository } = await currentRead(ctx, args), bindings = emptyBindings();
  const matches = await repository.hydrateVectors(args.hits, args.profile, current.run.runBudgetId);
  await captureRecallVectors(bindings, matches, args.profile, { runBudgetId: current.run.runBudgetId });
  const selectedVectors = await contextSourceBatchHandler(nativeCtx, { reference: args.reference, ...args.selection, permission: "canViewMemories",
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
  const selectedFacts = await contextSourceBatchHandler(nativeCtx, { reference: args.reference, ...args.selection, permission: "canViewFacts",
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
  await new ConvexMemoryRepository(nativeCtx, args.reference, "read").recheckAuthority();
  return { vectorItems: vectorRecallItems(selectedVectors.selectedIndexes.map(index => matches[index]!)),
    facts: selectedFacts.selectedIndexes.map(index => facts[index]!), bindings, witnesses: [...witnesses.values()], provenance: [...provenance.entries()],
    itemLineages: [...selectedVectors.selectedIndexes.map(index => [`memory:${matches[index]!.chunk.chunkId}`, matches[index]!.source.lineage] as [string, SourceLineage]), ...selectedFacts.selectedIndexes.map(index => [`fact:${facts[index]!.factId}`, facts[index]!.lineage] as [string, SourceLineage])],
    sourceScores: selectedVectors.selectedIndexes.map(index => [contextSourceKey({ tenantId: args.reference.tenantId, memorySpaceId: args.reference.memorySpaceId! }, matches[index]!.source.lineage), matches[index]!.score] as [string, number]) };
}
export const readMatches = internalQuery({ args: { ...nativeArgs, hits: v.array(v.object({ id: v.id("runtimeMemoryVectors"), score: v.number() })), factPlan: factPlanArgs }, handler: readMatchesHandler });
const prepareRef = makeFunctionReference("runtimeAgentRecall:prepareReads") as unknown as FunctionReference<"query", "internal", Args, Awaited<ReturnType<typeof prepareReadsHandler>>>;
const matchesRef = makeFunctionReference("runtimeAgentRecall:readMatches") as unknown as FunctionReference<"query", "internal", Parameters<typeof readMatchesHandler>[1], Awaited<ReturnType<typeof readMatchesHandler>>>;

/** Actual fresh native reads around the original Action-only ANN search. */
export async function finishAgentRecall(ctx: ActionCtx, attempt: AgentQueryEmbeddingAttempt, clock: DomainClock, input: Input,
  profile: EmbeddingProfile, result: Parameters<typeof validateModelEmbeddings>[0], selection: AgentRecallSelection) {
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
    { reference: attempt.reference, bindings: read.bindings }) }, input, profile.profileId, read.vectorItems, read.facts);
}
