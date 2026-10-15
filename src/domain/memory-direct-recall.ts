import type { DerivedFact, SourceContent } from "./contracts.js";
import type { MemoryEffortTrace } from "./memory-effort.js";

/** A versioned literal lookup rule, not a semantic confidence estimate. Every
 * uncertainty keeps governed semantic discovery. Never infer aliases/synonyms. */
export const DIRECT_FACT_RECALL_ROUTE = "direct-facts-v1" as const;
const words = (value: string) => value.normalize("NFC").toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu) ?? [];
const ambiguous = new Set(["and", "or", "not", "no", "now", "formerly", "previously", "instead", "before", "after", "latest", "current", "all", "any", "other", "thing", "things", "information", "details", "memory", "memories", "facts", "about", "prefer"]);
const selfPrefixes=["the user s","the user","user s","user","my"];
/** Compare only explicit assertion heads. Predicate labels do not establish
 * whether two facts concern different literal properties. Unknown heads retain
 * semantic discovery rather than treating differing labels as disjoint. */
function literalAssertionHead(text:string):string|undefined {
  const statement=words(text),copula=statement.findIndex(word=>word==="is"||word==="are");
  if(copula<2||copula===statement.length-1||statement.some(word=>ambiguous.has(word)))return undefined;
  const head=statement.slice(0,copula);
  for(const prefix of selfPrefixes){const parts=words(prefix);if(parts.every((word,index)=>head[index]===word)){
    const property=head.slice(parts.length);return property.length>=2?`self:${property.join(" ")}`:undefined;
  }}
  return `named:${(head[0]==="the"?head.slice(1):head).join(" ")}`;
}
export function sufficientDirectFactLookup(text: string, candidates: { facts: readonly DerivedFact[]; candidateWorkBound: boolean }, now: number): boolean {
  if (text.length > 1024 || candidates.candidateWorkBound || candidates.facts.length !== 1) return false;
  const fact=candidates.facts[0]!;
  if (fact.version !== 1 || fact.supersedes || fact.supersededBy || fact.supersedesEndpoint || fact.supersededByEndpoint || fact.historyReceipt
    || fact.updatedAt !== fact.createdAt || fact.validFrom !== undefined && fact.validFrom > now || fact.validUntil !== undefined) return false;
  return literalPropertyEvidence(text,fact,now);
}

export type DirectFactLookupProof = { seed: DerivedFact; source?: undefined } | { seed: DerivedFact; source: SourceContent; query: string };
/** The new source proof needs an explicit value to compare with canonical text.
 * Historical singleton facts may omit these fields; that rule stays separate. */
function structuredLiteralValue(fact: DerivedFact): fact is DerivedFact & { subject: string; predicate: string; object: string } {
  return [fact.subject, fact.predicate, fact.object].every(value => typeof value === "string" && words(value).length > 0);
}
function pristineFact(fact: DerivedFact, now: number): boolean {
  return fact.version === 1 && !fact.supersedes && !fact.supersededBy && !fact.supersedesEndpoint && !fact.supersededByEndpoint && !fact.historyReceipt
    && fact.updatedAt === fact.createdAt && (fact.validFrom === undefined || fact.validFrom <= now) && fact.validUntil === undefined;
}
function sameFactSource(fact: DerivedFact, source: Pick<DerivedFact,"tenantId"|"memorySpaceId"|"ownerPrincipalId"|"lineage">): boolean {
  return fact.tenantId === source.tenantId && fact.memorySpaceId === source.memorySpaceId && fact.ownerPrincipalId === source.ownerPrincipalId
    && fact.lineage.role === "user" && source.lineage.role === "user"
    && fact.lineage.sourceId === source.lineage.sourceId && fact.lineage.sourceEventId === source.lineage.sourceEventId && fact.lineage.sourceRevision === source.lineage.sourceRevision;
}
/** Deliberately finite projection grammar. These statements supply no aliases or
 * answer evidence: the exact fact AND single canonical assertion below do that.
 * Unknown projections remain a semantic miss, even when their source agrees. */
function neutralLiteralProjection(fact: DerivedFact, seed: DerivedFact): boolean {
  const head = literalAssertionHead(seed.fact), category = head?.match(/^self:favorite ([\p{L}\p{N}]+)$/u)?.[1];
  if (!category || !fact.object || !fact.predicate || !["user", "the user", "i", "me", "my", words(fact.ownerPrincipalId).join(" ")].includes(words(fact.subject ?? "").join(" "))) return false;
  const statement = words(fact.fact).join(" "), predicate = words(fact.predicate).join(" "), object = words(fact.object).join(" "), value = words(seed.object ?? "").join(" ");
  return selfPrefixes.some(prefix => predicate === "likes" && (statement === `${prefix} likes ${category}` && object === category
      || statement === `${prefix} likes ${value}` && object === value)
    || statement === `${prefix} stated a specific preference for a type of ${category}` && predicate === "has a preference for" && object === value);
}
function compatibleLiteralProjection(text: string, seed: DerivedFact, fact: DerivedFact, now: number): boolean {
  return structuredLiteralValue(seed) && structuredLiteralValue(fact) && pristineFact(fact, now) && sameFactSource(fact, seed)
    && (literalPropertyEvidence(text, fact, now) && words(fact.object).join(" ") === words(seed.object).join(" ") || neutralLiteralProjection(fact, seed));
}
function sourceProofSeed(text: string, candidates: { facts: readonly DerivedFact[]; candidateWorkBound: boolean }, now: number, version?: 1): DerivedFact | undefined {
  if (version !== 1 || text.length > 1024 || candidates.candidateWorkBound || candidates.facts.length === 0) return undefined;
  const seed = candidates.facts.find(fact => structuredLiteralValue(fact) && pristineFact(fact, now) && literalPropertyEvidence(text, fact, now));
  return seed && seed.lineage.sourceRevision === 1 && candidates.facts.every(fact => compatibleLiteralProjection(text, seed, fact, now)) ? seed : undefined;
}
/** Avoid another source read for broad/ambiguous/partial/unknown candidates. The
 * returned ID is only a prospective read location, never an authority decision. */
export function directFactLookupSourceId(text: string, candidates: { facts: readonly DerivedFact[]; candidateWorkBound: boolean }, now: number, version?: 1): string | undefined {
  return sourceProofSeed(text, candidates, now, version)?.lineage.sourceId;
}
/** New immutable-snapshot opt-in only. All current direct candidates must be
 * explained by the SAME one-assertion canonical user source. Every candidate is
 * still traversed/bound; this never removes facts or relaxes output/work bounds. */
export function proveDirectFactLookup(text: string, candidates: { facts: readonly DerivedFact[]; candidateWorkBound: boolean }, now: number,
  version?: 1, source?: SourceContent): DirectFactLookupProof | undefined {
  // New snapshots can start from one search hit and discover another projection
  // through an indexed edge. Prefer a verified source proof before traversal;
  // absent/older pins and unavailable proofs retain the original singleton rule.
  const singleton = sufficientDirectFactLookup(text, candidates, now) ? { seed: candidates.facts[0]! } : undefined;
  const seed = sourceProofSeed(text, candidates, now, version);
  if (!seed || !source || source.tombstonedAt !== undefined || source.lineage.sourceRevision !== 1
    || !/^[a-f0-9]{64}$/.test(source.contentHash) || !/^[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?(?: [\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?)*\.?$/u.test(source.content)) return singleton;
  if (!sameFactSource(seed, source) || !literalPropertyEvidence(text, { ...seed, fact: source.content }, now)) return singleton;
  const proof = { seed, source, query: text };
  return directFactProofCompatible(proof, candidates.facts, now) ? proof : singleton;
}
/** Called for every discovered current fact BEFORE entry/queue shedding. */
export function directFactProofCompatible(proof: DirectFactLookupProof, facts: readonly DerivedFact[], now: number): boolean {
  if (!proof.source) return directFactTraversalCompatible(proof.seed, facts);
  const { source, query } = proof;
  return facts.every(fact => sameFactSource(fact, source) && compatibleLiteralProjection(query, proof.seed, fact, now));
}

/** Priority within an already-authorized current candidate set, never proof that
 * semantic discovery can be skipped. Every explicit value for the exact property
 * receives equal priority, including current corrections and conflicting values. */
export function literalPropertyEvidence(text:string,fact:DerivedFact,now:number):boolean {
  if(text.length>1024||fact.supersededBy||fact.supersededByEndpoint
    ||fact.validFrom!==undefined&&fact.validFrom>now||fact.validUntil!==undefined&&fact.validUntil<=now)return false;
  // One explicit property lookup only. Compound requests, conversational asks,
  // paraphrases and broad retrieval requests deliberately retain semantic search.
  const query = /^(?:what|which)\s+(?:is|are)\s+(my|the)\s+([^?!;.\n]+)\??$/iu.exec(text.trim());
  if (!query) return false;
  const topic = words(query[2]!);
  if (topic.length < 2 || topic.length > 8 || topic.some(word => word.length < 3 || ambiguous.has(word))) return false;
  const statement = words(fact.fact);
  if (statement.some(word => ambiguous.has(word))) return false;
  const phrase = topic.join(" ");
  function valueAfter(prefix: string): string | undefined {
    const head=words(prefix),suffix=statement.slice(head.length);
    return head.every((word,index)=>statement[index]===word)&&["is","are"].includes(suffix[0]??"")&&suffix.length>1&&suffix.length<=65
      ?suffix.slice(1).join(" "):undefined;
  }
  const subject=words(fact.subject??"").join(" "),predicate=words(fact.predicate??"").join(" ");
  const self=query[1]!.toLowerCase()==="my";
  const prefixes=self?selfPrefixes.map(prefix=>prefix+" "+phrase):[phrase,"the "+phrase];
  const values=prefixes.map(valueAfter).filter((value):value is string=>value!==undefined);
  if(!values.length)return false;
  if(fact.subject||fact.predicate||fact.object){
    if(!fact.object?.trim()||fact.object.length>512||!predicate)return false;
    // The exact literal assertion above proves the requested property. A broad
    // extracted predicate such as "prefers" supplies no alias/synonym proof;
    // owned subject and the value must still agree with that assertion.
    if(self){if(!["user","the user","i","me","my",words(fact.ownerPrincipalId).join(" ")].includes(subject))return false;}
    else if(!subject||`${subject} ${predicate}`!==phrase)return false;
    return values.includes(words(fact.object).join(" "));
  }
  return self;
}

/** A second assertion about the same literal property, or corrected evidence
 * found through a real indexed edge, also requires semantic discovery. */
export function directFactTraversalCompatible(seed:DerivedFact,facts:readonly Pick<DerivedFact,"factId"|"fact"|"subject"|"predicate"|"version"|"supersedes"|"supersededBy"|"supersedesEndpoint"|"supersededByEndpoint"|"historyReceipt"|"createdAt"|"updatedAt">[]):boolean {
  const seedHead=literalAssertionHead(seed.fact);
  return facts.every(fact=>{
    const head=literalAssertionHead(fact.fact);
    return fact.version===1&&!fact.supersedes&&!fact.supersededBy&&!fact.supersedesEndpoint&&!fact.supersededByEndpoint&&!fact.historyReceipt&&fact.updatedAt===fact.createdAt
      &&(fact.factId===seed.factId||seedHead!==undefined&&head!==undefined&&head!==seedHead
        &&!!seed.predicate&&(words(fact.subject??"").join(" ")!==words(seed.subject??"").join(" ")||words(fact.predicate??"").join(" ")!==words(seed.predicate).join(" ")));
  });
}

/** A configured hop horizon is deliberate bounded discovery. Other traversal
 * stops leave the candidates inside that horizon unexamined and cannot justify
 * skipping semantic discovery. This never asserts semantic corpus exhaustion. */
export function directFactTraversalComplete(trace: Pick<MemoryEffortTrace,"stopReasons"|"unavailableStages">): boolean {
  return trace.unavailableStages.length===0&&trace.stopReasons.every(reason=>reason==="exhausted"||reason==="depth");
}
