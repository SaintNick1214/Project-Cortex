/** Existing client recall outcomes backed by the clock-injected domain helpers. */
import type { FactRecord, MemoryEntry, RecallItem } from "../../types/index.js";
import type { DomainClock } from "../../domain/clock.js";
import { rankResults as rankDomainResults, formatForLLM as formatDomainForLLM, processRecallResults as processDomainRecallResults } from "../../domain/recall.js";
export { RANKING_WEIGHTS, SCORE_BOOSTS, memoryToRecallItem, factToRecallItem, mergeResults, deduplicateResults, buildSourceBreakdown, enrichWithConversations } from "../../domain/recall.js";
const clientClock: DomainClock = { now: () => Date.now(), formatDate: (timestamp) => new Date(timestamp).toLocaleDateString() };
export function rankResults(items: RecallItem[], clock: DomainClock = clientClock): RecallItem[] {
  return rankDomainResults(items, clock);
}
export function formatForLLM(items: RecallItem[], clock: DomainClock = clientClock): string {
  return formatDomainForLLM(items, clock);
}
export function processRecallResults(vectorMemories: MemoryEntry[], directFacts: FactRecord[], graphExpandedMemories: MemoryEntry[], graphExpandedFacts: FactRecord[], discoveredEntities: string[], options: { limit?: number; formatForLLM?: boolean } = {}, clock: DomainClock = clientClock): ReturnType<typeof processDomainRecallResults> {
  return processDomainRecallResults(vectorMemories, directFacts, graphExpandedMemories, graphExpandedFacts, discoveredEntities, options, clock);
}
