import type { DerivedFact } from "./contracts.js";
import type { MemoryEffortTrace } from "./memory-effort.js";

/** A versioned literal lookup rule, not a semantic confidence estimate. Every
 * uncertainty keeps governed semantic discovery. Never infer aliases/synonyms. */
export const DIRECT_FACT_RECALL_ROUTE = "direct-facts-v1" as const;
const words = (value: string) => value.normalize("NFC").toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu) ?? [];
const ambiguous = new Set(["and", "or", "not", "no", "now", "formerly", "previously", "instead", "before", "after", "latest", "current", "all", "any", "other", "thing", "things", "information", "details", "memory", "memories", "facts", "about", "prefer"]);
export function sufficientDirectFactLookup(text: string, candidates: { facts: readonly DerivedFact[]; candidateWorkBound: boolean }, now: number): boolean {
  if (text.length > 1024 || candidates.candidateWorkBound || candidates.facts.length !== 1) return false;
  // One explicit property lookup only. Compound requests, conversational asks,
  // paraphrases and broad retrieval requests deliberately retain semantic search.
  const query = /^(?:what|which)\s+(?:is|are)\s+(my|the)\s+([^?!;.\n]+)\??$/iu.exec(text.trim());
  if (!query) return false;
  const topic = words(query[2]!), fact = candidates.facts[0]!;
  if (topic.length < 2 || topic.length > 8 || topic.some(word => word.length < 3 || ambiguous.has(word))) return false;
  if (fact.version !== 1 || fact.supersedes || fact.supersededBy || fact.supersedesEndpoint || fact.supersededByEndpoint || fact.historyReceipt
    || fact.updatedAt !== fact.createdAt || fact.validFrom !== undefined && fact.validFrom > now || fact.validUntil !== undefined) return false;
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
  const prefixes=self?["my","user","user s","the user","the user s"].map(prefix=>prefix+" "+phrase):[phrase,"the "+phrase];
  const values=prefixes.map(valueAfter).filter((value):value is string=>value!==undefined);
  if(!values.length)return false;
  if(fact.subject||fact.predicate||fact.object){
    if(!fact.object?.trim()||fact.object.length>512||!predicate)return false;
    if(self){if(!["user","the user","i","me","my",words(fact.ownerPrincipalId).join(" ")].includes(subject)||predicate!==phrase)return false;}
    else if(!subject||`${subject} ${predicate}`!==phrase)return false;
    return values.includes(words(fact.object).join(" "));
  }
  return self;
}

/** A second assertion about the same literal property, or corrected evidence
 * found through a real indexed edge, also requires semantic discovery. */
export function directFactTraversalCompatible(seed:DerivedFact,facts:readonly Pick<DerivedFact,"factId"|"subject"|"predicate"|"version"|"supersedes"|"supersededBy"|"supersedesEndpoint"|"supersededByEndpoint"|"historyReceipt"|"createdAt"|"updatedAt">[]):boolean {
  return facts.every(fact=>fact.version===1&&!fact.supersedes&&!fact.supersededBy&&!fact.supersedesEndpoint&&!fact.supersededByEndpoint&&!fact.historyReceipt&&fact.updatedAt===fact.createdAt
    &&(fact.factId===seed.factId||!!seed.predicate&&words(fact.subject??"").join(" ")!==words(seed.subject??"").join(" ")
      ||!!seed.predicate&&words(fact.predicate??"").join(" ")!==words(seed.predicate).join(" ")));
}

/** A configured hop horizon is deliberate bounded discovery. Other traversal
 * stops leave the candidates inside that horizon unexamined and cannot justify
 * skipping semantic discovery. This never asserts semantic corpus exhaustion. */
export function directFactTraversalComplete(trace: Pick<MemoryEffortTrace,"stopReasons"|"unavailableStages">): boolean {
  return trace.unavailableStages.length===0&&trace.stopReasons.every(reason=>reason==="exhausted"||reason==="depth");
}
