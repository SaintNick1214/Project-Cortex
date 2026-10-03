/** Client defaults delegate to the clock-injected pure domain implementation. */
import type { FactRecord } from "../types/index.js";
import type { DomainClock } from "../domain/clock.js";
import type { ConflictCandidate, PromptOptions } from "../domain/conflicts.js";
import { buildUserPrompt as buildDomainUserPrompt, buildConflictResolutionPrompt as buildDomainConflictPrompt } from "../domain/conflicts.js";
export { CONFLICT_RESOLUTION_SYSTEM_PROMPT, CONFLICT_RESOLUTION_EXAMPLES, buildSystemPrompt, parseConflictDecision, validateConflictDecision, getDefaultDecision } from "../domain/conflicts.js";
export type { ConflictAction, ConflictDecision, ConflictCandidate, PromptOptions } from "../domain/conflicts.js";
const clientClock: DomainClock = { now: () => Date.now() };
export function buildUserPrompt(newFact: ConflictCandidate, existingFacts: FactRecord[], options?: PromptOptions, clock: DomainClock = clientClock): string {
  return buildDomainUserPrompt(newFact, existingFacts, options, clock);
}
export function buildConflictResolutionPrompt(newFact: ConflictCandidate, existingFacts: FactRecord[], options?: PromptOptions, clock: DomainClock = clientClock): { system: string; user: string } {
  return buildDomainConflictPrompt(newFact, existingFacts, options, clock);
}
