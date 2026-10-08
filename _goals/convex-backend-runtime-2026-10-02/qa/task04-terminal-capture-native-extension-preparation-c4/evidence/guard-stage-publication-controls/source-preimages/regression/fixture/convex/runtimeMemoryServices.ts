/** Modern memory operations share pure domain logic and required backend adapters. */
import type { MemoryDomainAdapters, SourceLineage, TrustedMemoryScope, DerivedFact } from "../src/domain/contracts";
import { DEFAULT_EMBEDDING_PROFILE, normalizeSourceText, semanticHash } from "../src/domain/profile";
import { SOURCE_EXTRACTION_POLICY_VERSION, extractSourceFacts, prepareSourceContent, processingIdentityKey, validateModelEmbeddings } from "../src/domain/sources";
import { deduplicateResults, factToRecallItem, formatForLLM, rankResults } from "../src/domain/recall";
import type { RecallItem } from "../src/types/index";
import { canonicalMemoryValue, memoryError } from "./runtimeMemoryRepository";

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
  const prepared = await prepareSourceContent(repository.scope, input.lineage, input.text, clock);
  const persisted = await repository.putSource(prepared.source);
  const source = persisted.source;
  const reference = { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: source.lineage.sourceRevision };
  const identity = { ...reference, stage: "facts" as const,
    semanticPolicyVersion: `${SOURCE_EXTRACTION_POLICY_VERSION}+${DEFAULT_EMBEDDING_PROFILE.profileId}` };
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
    policyVersion: DEFAULT_EMBEDDING_PROFILE.profileId, attempt: 1, source: reference,
    profile: DEFAULT_EMBEDDING_PROFILE, texts: prepared.chunks.map((chunk) => chunk.text) });
  validateModelEmbeddings(embeddingResult, DEFAULT_EMBEDDING_PROFILE, prepared.chunks.length);
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
    vectorId: await semanticHash(JSON.stringify([chunk.chunkId, DEFAULT_EMBEDDING_PROFILE, receiptId])), chunkId: chunk.chunkId,
    tenantId: source.tenantId, memorySpaceId: source.memorySpaceId, profile: DEFAULT_EMBEDDING_PROFILE,
    embedding: embeddingResult.vectors[index]!, processingReceiptId: receiptId,
  })));
  await recheckSource();
  const committed = await repository.commitDerived({ source: reference, identity, chunks: prepared.chunks, vectors, facts,
    expectedFactVersions: Object.fromEntries(facts.map((fact) => [fact.factId, 0])) });
  // A write receipt returns only this committed payload by stable factId, without unrelated read access.
  const committedFacts = facts.map(({ _id: _id, ...fact }) => fact);
  return { sourceId: source.lineage.sourceId, sourceRevision: source.lineage.sourceRevision,
    receiptId: committed.receiptId, created: committed.created, facts: committedFacts };
}

export async function recallMemory(
  adapters: MemoryDomainAdapters, input: { text: string; requestId: string; limit: number },
): Promise<{ items: RecallItem[]; context: string; profileId: string }> {
  assertMemoryRequestId(input.requestId);
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) memoryError("INVALID_INPUT", "Limit must be between 1 and 100");
  const { repository, model, clock } = adapters;
  const text = normalizeSourceText(input.text);
  await repository.recheckAuthority();
  // Read methods enforce read independently; a write-only injected adapter cannot dispatch recall.
  await repository.listFacts({ limit: 1 });
  const operationId = `embedding.query:${JSON.stringify([repository.scope.tenantId, repository.scope.memorySpaceId,
    repository.scope.principalId, input.requestId, DEFAULT_EMBEDDING_PROFILE.profileId])}`;
  const result = await model.embed({ purpose: "embedding.query", operationId,
    policyVersion: DEFAULT_EMBEDDING_PROFILE.profileId, attempt: 1, profile: DEFAULT_EMBEDDING_PROFILE, texts: [text] });
  validateModelEmbeddings(result, DEFAULT_EMBEDDING_PROFILE, 1);
  const vectors = await repository.searchVectors({ text, profile: DEFAULT_EMBEDDING_PROFILE, embedding: result.vectors[0]! }, input.limit);
  const facts = await repository.listFacts({ limit: input.limit });
  const vectorItems: RecallItem[] = vectors.map((match) => ({ type: "memory", id: match.chunk.chunkId,
    content: match.chunk.text, score: match.score, source: "vector", memory: {
      _id: match.vector.vectorId, memoryId: match.chunk.chunkId, tenantId: match.source.tenantId,
      memorySpaceId: match.source.memorySpaceId, userId: match.source.ownerPrincipalId, content: match.chunk.text,
      contentType: "raw", sourceType: match.source.lineage.role === "tool" ? "tool" : "conversation",
      sourceTimestamp: match.source.createdAt, messageRole: match.source.lineage.role === "user" ? "user" : "agent",
      importance: 50, tags: [], version: match.source.lineage.sourceRevision, previousVersions: [],
      createdAt: match.source.createdAt, updatedAt: match.source.createdAt, accessCount: 0,
    }, graphContext: { connectedEntities: [] } }));
  await repository.recheckAuthority();
  const items = rankResults(deduplicateResults([...vectorItems, ...facts.map((fact) => factToRecallItem(fact, "facts", 0.7))]), clock).slice(0, input.limit);
  return { items, context: formatForLLM(items, clock), profileId: DEFAULT_EMBEDDING_PROFILE.profileId };
}
