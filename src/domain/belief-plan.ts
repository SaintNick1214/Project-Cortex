/** Ordered conflict plans are data; only the scoped native mutation can commit them. */
import type { AttributedFact, DerivedFact, SourceContent } from "./contracts.js";
import type { ConflictDecision } from "./conflicts.js";
import { validateConflictDecision } from "./conflicts.js";
import { semanticHash } from "./profile.js";
import { BELIEF_POLICY_VERSION, MAX_INGESTION_FACTS } from "./ingestion.js";
import { canonicalModelJson } from "./model-policy.js";
export interface BeliefCandidateBinding { version: 1; eventId: string; sequence: number; sourceHash: string;
  ownerPrincipalId: string; lineageCanonical: string; sourceOrdinal: number; ordinal: number; stageAttempt: number;
  candidateId: string; operationId: string; semanticId: string }
export interface BoundBeliefDecision { candidateBinding: BeliefCandidateBinding; decision: ConflictDecision }
export interface BeliefPlanEntry { ordinal: number; slotKey: string; candidate: AttributedFact;
  candidateBinding?: BeliefCandidateBinding; decision: ConflictDecision; targetFactId: string | null; next?: DerivedFact }
export interface BeliefPlanV1 { version: 1; eventId: string; sequence: number; sourceHash: string;
  candidateBindingVersion?: 1; expectedVersions: Record<string, number>; entries: BeliefPlanEntry[] }
export function beliefSlot(fact: Pick<AttributedFact, "subject" | "predicate" | "fact">): string {
  return JSON.stringify(fact.subject && fact.predicate ? [fact.subject.trim().toLowerCase(), fact.predicate.trim().toLowerCase()]
    : ["text", fact.fact.trim().toLowerCase()]);
}
/** One source may repeat an assertion. Only exact value, wording and truth
 * metadata equality can share a write; slot normalization never normalizes a
 * value or drops a qualifier. The raw extraction remains the durable evidence. */
function sameCandidate(left: AttributedFact, right: AttributedFact): boolean {
  const shape = (fact: AttributedFact) => ({ ...fact,
    subject: fact.subject?.trim().toLowerCase(), predicate: fact.predicate?.trim().toLowerCase() });
  return canonicalModelJson(shape(left)) === canonicalModelJson(shape(right));
}
/** Private source-owned selection. The model never selects a candidate ordinal.
 * Exact duplicate normalization is the existing rule; unequal values remain. */
export async function sourceCandidateBindings(input: { eventId: string; sequence: number; source: SourceContent;
  candidates: readonly AttributedFact[]; attempt: number }): Promise<{ candidate: AttributedFact; binding: BeliefCandidateBinding }[]> {
  if (!Number.isSafeInteger(input.attempt) || input.attempt < 1 || !Number.isSafeInteger(input.sequence) || input.sequence < 1
    || input.candidates.length > MAX_INGESTION_FACTS || input.source.lineage.role === "assistant") throw new Error("INVALID_BELIEF_PLAN");
  const selected: { candidate: AttributedFact; binding: BeliefCandidateBinding }[] = [];
  const lineageCanonical = canonicalModelJson(input.source.lineage);
  for (const [sourceOrdinal, candidate] of input.candidates.entries()) {
    if (canonicalModelJson(candidate.lineage) !== lineageCanonical) throw new Error("INVALID_BELIEF_PLAN");
    if (selected.some(prior => beliefSlot(prior.candidate) === beliefSlot(candidate) && sameCandidate(prior.candidate, candidate))) continue;
    const ordinal = selected.length;
    const operationId = `${input.eventId}:facts:${input.attempt}:${ordinal}`;
    const candidateId = await semanticHash(canonicalModelJson([input.eventId, input.sequence, input.source.ownerPrincipalId,
      input.source.contentHash, input.source.lineage, sourceOrdinal, ordinal, candidate]));
    selected.push({ candidate, binding: { version: 1, eventId: input.eventId, sequence: input.sequence,
      sourceHash: input.source.contentHash, ownerPrincipalId: input.source.ownerPrincipalId, lineageCanonical,
      sourceOrdinal, ordinal, stageAttempt: input.attempt, candidateId, operationId,
      semanticId: await semanticHash(canonicalModelJson(["facts.resolve", operationId, BELIEF_POLICY_VERSION])) } });
  }
  return selected;
}
export async function planBeliefs(input: { eventId: string; sequence: number; source: SourceContent;
  candidates: readonly AttributedFact[]; existing: readonly DerivedFact[];
  candidateAttempt?: number;
  resolve(candidate: AttributedFact, existing: readonly DerivedFact[], ordinal: number,
    binding?: BeliefCandidateBinding): Promise<ConflictDecision | BoundBeliefDecision> }): Promise<BeliefPlanV1> {
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1 || input.candidates.length > MAX_INGESTION_FACTS
    || input.existing.length > MAX_INGESTION_FACTS || input.source.lineage.role === "assistant") throw new Error("INVALID_BELIEF_PLAN");
  const expectedVersions = Object.fromEntries(input.existing.map(fact => [fact.factId, fact.version]));
  const entries: BeliefPlanEntry[] = []; const virtual = new Map(input.existing.map(fact => [fact.factId, fact]));
  const used = new Map<string, AttributedFact>();
  const bound = input.candidateAttempt === undefined ? undefined : await sourceCandidateBindings({ ...input, attempt: input.candidateAttempt });
  const selected = bound ?? input.candidates.map(candidate => ({ candidate, binding: undefined }));
  for (const { candidate, binding } of selected) {
    if (canonicalModelJson(candidate.lineage) !== canonicalModelJson(input.source.lineage)) throw new Error("INVALID_BELIEF_PLAN");
    const slotKey = canonicalModelJson([input.source.ownerPrincipalId, beliefSlot(candidate)]);
    const prior = used.get(slotKey);
    if (prior) {
      if (sameCandidate(prior, candidate)) continue;
      if (!binding) throw new Error("AMBIGUOUS_EXTRACTION_SLOT");
    }
    used.set(slotKey, candidate);
    // Dense retained ordinals also let the native commit consume each original
    // decision exactly once after a duplicate was consolidated.
    const ordinal = entries.length;
    const matching = [...virtual.values()].filter(fact => fact.ownerPrincipalId === input.source.ownerPrincipalId && beliefSlot(fact) === beliefSlot(candidate) && !fact.supersededBy);
    const resolved = matching.length ? await input.resolve(candidate, matching, ordinal, binding)
      : { action: "ADD" as const, targetFactId: null, mergedFact: null, reason: "No current matching belief" };
    let decision: ConflictDecision;
    if ("candidateBinding" in resolved) {
      if (!binding || canonicalModelJson(resolved.candidateBinding) !== canonicalModelJson(binding)) throw new Error("INVALID_BELIEF_DECISION");
      decision = resolved.decision;
    } else {
      if (binding && matching.length) throw new Error("INVALID_BELIEF_DECISION");
      decision = resolved;
    }
    if (!validateConflictDecision(decision, matching).valid || (decision.action === "NONE" && !decision.targetFactId)
      || (decision.action === "ADD" && decision.targetFactId !== null)) throw new Error("INVALID_BELIEF_DECISION");
    const target = decision.targetFactId ? virtual.get(decision.targetFactId) : undefined;
    // The original native CAS writes each fact once. A second rewrite of an
    // in-plan target is not representable and must not partially commit.
    if (binding && (decision.action === "UPDATE" || decision.action === "SUPERSEDE")
      && entries.some(entry => entry.next?.factId === target?.factId)) throw new Error("INVALID_BELIEF_DECISION");
    const id = decision.action === "UPDATE" ? target!.factId : await semanticHash(JSON.stringify([input.eventId, BELIEF_POLICY_VERSION, ordinal, candidate.fact]));
    const entry: BeliefPlanEntry = { ordinal, slotKey, candidate, ...(binding ? { candidateBinding: binding } : {}), decision, targetFactId: decision.targetFactId };
    if (decision.action !== "NONE") {
      entry.next = { _id: "", factId: id, tenantId: input.source.tenantId, memorySpaceId: input.source.memorySpaceId,
        ownerPrincipalId: input.source.ownerPrincipalId, lineage: input.source.lineage, extractionPolicyVersion: BELIEF_POLICY_VERSION,
        fact: decision.action === "UPDATE" ? decision.mergedFact! : candidate.fact, factType: candidate.factType,
        ...(candidate.subject ? { subject: candidate.subject } : {}), ...(candidate.predicate ? { predicate: candidate.predicate } : {}),
        ...(candidate.object ? { object: candidate.object } : {}), confidence: candidate.confidence * 100,
        tags: candidate.tags ?? [], entities: candidate.entities ?? [], relations: candidate.relations ?? [],
        sourceType: input.source.lineage.role === "tool" ? "tool" : "conversation", version: decision.action === "UPDATE" ? target!.version + 1 : 1,
        createdAt: target && decision.action === "UPDATE" ? target.createdAt : input.source.createdAt, updatedAt: input.source.createdAt,
        ...(decision.action === "SUPERSEDE" ? { supersedes: target!.factId } : {}) };
      if (decision.action === "SUPERSEDE") virtual.delete(target!.factId);
      virtual.set(id, entry.next); if (!(id in expectedVersions)) expectedVersions[id] = 0;
    }
    entries.push(entry);
  }
  return { version: 1, eventId: input.eventId, sequence: input.sequence, sourceHash: input.source.contentHash,
    ...(bound ? { candidateBindingVersion: 1 } : {}), expectedVersions, entries };
}
