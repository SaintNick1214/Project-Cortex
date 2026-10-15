import type { MemoryEffortRequest, MemoryEffortTrace } from "../src/domain/memory-effort";
import { normalizeMemoryEffortRequest } from "../src/domain/memory-effort";
/** Modern memory operations share pure domain logic and required backend adapters. */
import type { MemoryDomainAdapters, SourceLineage, TrustedMemoryScope, DerivedFact, VectorMatch } from "../src/domain/contracts";
import { DEFAULT_EMBEDDING_PROFILE, normalizeSourceText, semanticHash } from "../src/domain/profile";
import { SOURCE_EXTRACTION_POLICY_VERSION, extractSourceFacts, prepareSourceContent, processingIdentityKey, validateModelEmbeddings } from "../src/domain/sources";
import { deduplicateResults, factToRecallItem, formatForLLM, rankResults } from "../src/domain/recall";
import type { RecallItem } from "../src/types";
import type { EmbeddingProfile } from "../src/domain/profile";
import { canonicalMemoryValue, memoryError } from "./runtimeMemoryRepository";

export function publicRecallBudgetRequest(text:string,limit:number,memory?:MemoryEffortRequest) {
  return {purpose:"recall",text,limit,...(memory===undefined?{}:{memory:normalizeMemoryEffortRequest(memory),memoryEffortPolicyVersion:1})};
}
export function assertMemoryRequestId(requestId: string): void {
  if (!requestId.trim() || requestId.length > 128) memoryError("INVALID_INPUT", "A nonempty request ID of at most 128 characters is required");
}
/** Exact tuple, rather than a digest, retains canonical admission identity on collision. */
export function explicitSourceLineage(scope: TrustedMemoryScope, requestId: string): SourceLineage {
  assertMemoryRequestId(requestId);
  const sourceId = `explicit:${JSON.stringify([scope.tenantId, scope.memorySpaceId, scope.principalId, requestId])}`;
  return { sourceId, sourceEventId: sourceId, sourceRevision: 1, role: "user", trust: "user_assertion" };
}

/** No provider credentials/fallback. Task04 installs the governed Gateway adapter here. */
export function unconfiguredMemoryModel(): MemoryDomainAdapters["model"] {
  const unavailable = () => memoryError("POLICY_NOT_CONFIGURED", "Governed backend memory model policy is not configured");
  return { extract: async () => unavailable(), resolve: async () => unavailable(), embed: async () => unavailable() };
}

export async function rememberMemory(
  adapters: MemoryDomainAdapters, input: { text: string; lineage: SourceLineage },
): Promise<{ sourceId: string; sourceRevision: number; receiptId: string; created: boolean; facts: Omit<DerivedFact, "_id">[] }> {
  const { repository, model, clock } = adapters;
  await repository.recheckAuthority();
  const selection = await model.resolveProfile?.("embedding.memory") ?? { profile: DEFAULT_EMBEDDING_PROFILE };
  const profile = selection.profile;
  const prepared = await prepareSourceContent(repository.scope, input.lineage, input.text, clock, profile);
  const persisted = await repository.putSource(prepared.source);
  const source = persisted.source;
  const reference = { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: source.lineage.sourceRevision };
  const identity = { ...reference, stage: "facts" as const,
    semanticPolicyVersion: `${SOURCE_EXTRACTION_POLICY_VERSION}+${profile.profileId}` };
  const receiptId = await processingIdentityKey(identity);
  const recheckSource = async () => {
    await repository.recheckAuthority();
    const current = await repository.getSource(source.lineage.sourceId);
    if (!current || canonicalMemoryValue(current) !== canonicalMemoryValue(source)) memoryError("STALE_SOURCE", "Source changed before model dispatch or commit");
  };
  // Rechecks immediately precede each internal dispatch; an injected model never grants access.
  await recheckSource();
  const extracted = source.lineage.role === "assistant" ? [] : await extractSourceFacts(source, model, {
    operationId: `memory.extract:${receiptId}`, policyVersion: SOURCE_EXTRACTION_POLICY_VERSION, attempt: 1, source: reference,
  });
  await recheckSource();
  const embeddingResult = await model.embed({ purpose: "embedding.memory", operationId: `embedding.memory:${receiptId}`,
    policyVersion: profile.profileId, attempt: 1, source: reference,
    profile, texts: prepared.chunks.map((chunk) => chunk.text) });
  validateModelEmbeddings(embeddingResult, profile, prepared.chunks.length);
  if (extracted.length > 100) memoryError("INVALID_INPUT", "Extraction exceeds the bounded fact commit size");
  const facts: DerivedFact[] = await Promise.all(extracted.map(async (fact, ordinal) => ({
    _id: "", factId: await semanticHash(JSON.stringify([source.tenantId, source.memorySpaceId, source.lineage,
      SOURCE_EXTRACTION_POLICY_VERSION, ordinal, fact.fact])),
    tenantId: source.tenantId, memorySpaceId: source.memorySpaceId, ownerPrincipalId: source.ownerPrincipalId,
    fact: fact.fact, factType: fact.factType, subject: fact.subject, predicate: fact.predicate, object: fact.object,
    confidence: fact.confidence * 100, tags: fact.tags ?? [], entities: fact.entities, relations: fact.relations,
    sourceType: source.lineage.role === "tool" ? "tool" as const : "manual" as const,
    lineage: fact.lineage, extractionPolicyVersion: SOURCE_EXTRACTION_POLICY_VERSION,
    version: 1, createdAt: source.createdAt, updatedAt: source.createdAt,
  })));
  const vectors = await Promise.all(prepared.chunks.map(async (chunk, index) => ({
    sourceId: chunk.sourceId, sourceEventId: chunk.sourceEventId, sourceRevision: chunk.sourceRevision,
    vectorId: await semanticHash(JSON.stringify([chunk.chunkId, profile, receiptId])), chunkId: chunk.chunkId,
    tenantId: source.tenantId, memorySpaceId: source.memorySpaceId, profile,
    embedding: embeddingResult.vectors[index]!, processingReceiptId: receiptId,
  })));
  await recheckSource();
  const committed = await repository.commitDerived({ source: reference, identity, chunks: prepared.chunks, vectors, facts, ...(selection.runBudgetId ? { embeddingRunBudgetId: selection.runBudgetId } : {}),
    expectedFactVersions: Object.fromEntries(facts.map((fact) => [fact.factId, 0])) });
  // A write receipt returns only this committed payload by stable factId, without unrelated read access.
  const committedFacts = facts.map(({ _id: _id, ...fact }) => fact);
  return { sourceId: source.lineage.sourceId, sourceRevision: source.lineage.sourceRevision,
    receiptId: committed.receiptId, created: committed.created, facts: committedFacts };
}

export async function recallMemory(
  adapters: MemoryDomainAdapters, input: { text: string; requestId: string; limit: number },
): Promise<{ items: RecallItem[]; context: string; profileId: string; deliveryExpiresAt?: number }> {
  assertMemoryRequestId(input.requestId);
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) memoryError("INVALID_INPUT", "Limit must be between 1 and 100");
  const { repository, model, clock } = adapters;
  const text = normalizeSourceText(input.text);
  await repository.recheckAuthority();
  // Check read capability before inference without binding discarded facts to delivery.
  // Older injected adapters retain their independently authorized read preflight.
  if (repository.assertReadAuthority) await repository.assertReadAuthority();
  else await repository.listFacts({ limit: 1 });
  const selection = await model.resolveProfile?.("embedding.query") ?? { profile: DEFAULT_EMBEDDING_PROFILE };
  const profile = selection.profile;
  const operationId = `embedding.query:${JSON.stringify([repository.scope.tenantId, repository.scope.memorySpaceId,
    repository.scope.principalId, input.requestId, profile.profileId])}`;
  await repository.assertProfileReady?.(profile, selection.runBudgetId);
  const result = await model.embed({ purpose: "embedding.query", operationId,
    policyVersion: profile.profileId, attempt: 1, profile, texts: [text] });
  return await finishRecallFromEmbedding({ repository, clock }, { text, limit: input.limit }, selection, result);
}

/** Shared original post-embedding recall: private Agent preparation does not grant read/delivery authority. */
export async function finishRecallFromEmbedding(
  adapters: Pick<MemoryDomainAdapters, "repository" | "clock">, input: { text: string; limit: number },
  selection: { profile: EmbeddingProfile; runBudgetId?: string }, result: Awaited<ReturnType<MemoryDomainAdapters["model"]["embed"]>>,
): Promise<{ items: RecallItem[]; context: string; profileId: string; deliveryExpiresAt?: number }> {
  const { repository, clock } = adapters, { text } = input, { profile } = selection;
  validateModelEmbeddings(result, profile, 1);
  const query = { text, profile, embedding: result.vectors[0]!, ...(selection.runBudgetId ? { embeddingRunBudgetId: selection.runBudgetId } : {}) };
  const staged = repository.stageRecallReads?.();
  let vectors: readonly VectorMatch[], facts: readonly DerivedFact[];
  if (staged) {
    // Invoke each adapter in its own task: a synchronous throw must neither skip
    // the peer read nor leave its late rejection unowned. Preserve vector priority.
    const [vectorRead, factRead] = await Promise.allSettled([
      Promise.resolve().then(() => staged.searchVectors(query, input.limit)),
      Promise.resolve().then(() => staged.listFacts({ limit: input.limit })),
    ]);
    if (vectorRead.status === "rejected") throw vectorRead.reason;
    if (factRead.status === "rejected") throw factRead.reason;
    staged.commit(); vectors = vectorRead.value; facts = factRead.value;
  } else {
    // Older injected adapters do not promise isolated read bookkeeping.
    vectors = await repository.searchVectors(query, input.limit);
    facts = await repository.listFacts({ limit: input.limit });
  }
  const vectorItems = vectorRecallItems(vectors);
  await repository.recheckAuthority();
  return await completeRecallDelivery({ clock, finalDelivery: repository.finalDelivery?.bind(repository) }, input, profile.profileId, vectorItems, facts);
}
/** Exact original projection; private native parents avoid returning vector/source bodies. */
export function vectorRecallItems(vectors: readonly VectorMatch[]): RecallItem[] {
  return vectors.map((match) => ({ type: "memory", id: match.chunk.chunkId,
    content: match.chunk.text, score: match.score, source: "vector", memory: {
      _id: match.vector.vectorId, memoryId: match.chunk.chunkId, tenantId: match.source.tenantId,
      memorySpaceId: match.source.memorySpaceId, userId: match.source.ownerPrincipalId, content: match.chunk.text,
      contentType: "raw", sourceType: match.source.lineage.role === "tool" ? "tool" : "conversation",
      sourceTimestamp: match.source.createdAt, messageRole: match.source.lineage.role === "user" ? "user" : "agent",
      importance: 50, tags: [], version: match.source.lineage.sourceRevision, previousVersions: [],
      createdAt: match.source.createdAt, updatedAt: match.source.createdAt, accessCount: 0,
    }, graphContext: { connectedEntities: [] } }));
}
/** Original rank/expiry/format tail after the current read predicate has executed. */
export async function completeRecallDelivery(adapters: { clock: MemoryDomainAdapters["clock"]; finalDelivery?: MemoryDomainAdapters["repository"]["finalDelivery"] },
  input: { limit: number }, profileId: string, vectorItems: RecallItem[], facts: readonly DerivedFact[], effortResult?:{items:RecallItem[];memoryEffort:MemoryEffortTrace;retrievalDeadlineMs:number;retainValidatedOnDeadline?:true},effortStartedAt?:number) {
  const { clock } = adapters;
  let items = effortResult?.items ?? rankResults(deduplicateResults([...vectorItems, ...facts.map((fact) => factToRecallItem(fact, "facts", 0.7))]), clock).slice(0, input.limit);
  const delivery = await adapters.finalDelivery?.();
  const expiresAt = delivery?.deliveryExpiresAt;
  // Actions have a real clock across RPC awaits. Never deliver a response whose
  // actual grant/consumed source deadline elapsed while its final RPC returned.
  if (expiresAt !== undefined && (!Number.isFinite(expiresAt) || clock.now() >= expiresAt)) memoryError("FORBIDDEN", "Recall delivery authority expired");
  if(effortResult&&effortStartedAt!==undefined) {
    effortResult.memoryEffort.durationMs=Math.max(0,clock.now()-effortStartedAt);
    if(effortResult.memoryEffort.durationMs>=effortResult.retrievalDeadlineMs){
      // Retrieval expiry stops exploration, not delivery of already selected
      // evidence. The independent authority/consumed-source expiry above still
      // rejects delivery. Historical snapshots without the private ranking pin
      // keep their original all-or-nothing interpretation.
      if(!effortResult.retainValidatedOnDeadline){items=[];effortResult.memoryEffort.selected=0;effortResult.memoryEffort.selectedInputUnits=0;effortResult.memoryEffort.entriesByKind={memory:0,fact:0,pending:0,history:0};}
      effortResult.memoryEffort.stopReasons=[...new Set([...effortResult.memoryEffort.stopReasons,"deadline" as const])];
    }
  }
  return { items, context: formatForLLM(items, clock), profileId, ...(effortResult?{memoryEffort:effortResult.memoryEffort}:{}), ...(expiresAt === undefined ? {} : { deliveryExpiresAt: expiresAt }) };
}

/** One current source, one new profile-specific generation. No history scan,
 * source rewrite, reindex loop or fallback; used by trusted backend compositions. */
export async function deriveSourceVectors(adapters: MemoryDomainAdapters, input: { sourceId: string; requestId: string }) {
  assertMemoryRequestId(input.requestId);
  const { repository, model, clock } = adapters;
  await repository.recheckAuthority();
  const source = await repository.getSource(input.sourceId);
  if (!source) memoryError("STALE_SOURCE", "Source is unavailable");
  const selection = await model.resolveProfile?.("embedding.memory") ?? { profile: DEFAULT_EMBEDDING_PROFILE };
  const profile = selection.profile;
  const prepared = await prepareSourceContent(repository.scope, source.lineage, source.content, clock, profile);
  const reference = { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: source.lineage.sourceRevision };
  const identity = { ...reference, stage: "vectors" as const, semanticPolicyVersion: profile.profileId };
  const receiptId = await processingIdentityKey(identity);
  const embedded = await model.embed({ purpose: "embedding.memory", operationId: `embedding.memory:${receiptId}`,
    policyVersion: profile.profileId, attempt: 1, source: reference, profile, texts: prepared.chunks.map(chunk => chunk.text) });
  validateModelEmbeddings(embedded, profile, prepared.chunks.length);
  const vectors = await Promise.all(prepared.chunks.map(async (chunk, ordinal) => ({ ...reference,
    vectorId: await semanticHash(JSON.stringify([chunk.chunkId, profile, receiptId])), chunkId: chunk.chunkId,
    tenantId: source.tenantId, memorySpaceId: source.memorySpaceId, profile, embedding: embedded.vectors[ordinal]!, processingReceiptId: receiptId })));
  const current = await repository.getSource(input.sourceId);
  if (canonicalMemoryValue(source) !== canonicalMemoryValue(current)) memoryError("STALE_SOURCE", "Source changed before vector commit");
  const committed = await repository.commitDerived({ source: reference, identity, chunks: prepared.chunks, vectors,
    ...(selection.runBudgetId ? { embeddingRunBudgetId: selection.runBudgetId } : {}) });
  return { ...committed, profile, sourceId: input.sourceId };
}
