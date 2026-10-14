import type { ModelMessage } from "ai";
import type { RecallItem } from "../types/index.js";
import { contextSourceKey } from "./memory-context.js";
import type { SourceLineage } from "./contracts.js";

/** Versioned request selection only. Canonical storage and authorization are external. */
export interface ModelInputSelectionPolicy {
  version: 1;
  recentMessages: number;
  relevantMemories: number;
  relevantFacts: number;
  pendingEntries: number;
  maxMessages: number;
}
export const MODEL_INPUT_SELECTION_V1: Readonly<ModelInputSelectionPolicy> = Object.freeze({
  version: 1, recentMessages: 4, relevantMemories: 4, relevantFacts: 4, pendingEntries: 4, maxMessages: 16,
});
export const MODEL_INPUT_RECENT_SCAN_LIMIT = 128;
export const MODEL_INPUT_RECALL_CANDIDATES = 10;
export interface ModelInputEntry { key: string; kind: "memory" | "fact" | "pending" | "notice"; text: string; relevance: number }
export interface ModelInputMessage { id: string; message: ModelMessage; mandatory: boolean }
export type ModelInputBoundResult = { supported: false } | { supported: true; withinBound: boolean };
export class ModelInputSelectionError extends Error {
  constructor(readonly code: "CONTEXT_LIMIT_EXCEEDED" | "CONTEXT_INCOMPLETE") { super(code); }
}
export function modelInputPolicy(input?: ModelInputSelectionPolicy): ModelInputSelectionPolicy {
  const selected = input ?? MODEL_INPUT_SELECTION_V1;
  if ((selected as { version:number }).version !== 1 || Object.keys(selected).sort().join(",") !== "maxMessages,pendingEntries,recentMessages,relevantFacts,relevantMemories,version"
    || !Number.isSafeInteger(selected.recentMessages) || selected.recentMessages < 1 || selected.recentMessages > 16
    || !Number.isSafeInteger(selected.maxMessages) || selected.maxMessages < 1 || selected.maxMessages > 32
    || [selected.relevantMemories, selected.relevantFacts].some(value => !Number.isSafeInteger(value) || value < 0 || value > MODEL_INPUT_RECALL_CANDIDATES)
    || !Number.isSafeInteger(selected.pendingEntries) || selected.pendingEntries < 0 || selected.pendingEntries > 32) throw new ModelInputSelectionError("CONTEXT_LIMIT_EXCEEDED");
  return { ...selected };
}
export function textOnlyModelMessage(message: ModelMessage): boolean {
  return (message.role === "user" || message.role === "assistant") && (typeof message.content === "string"
    || message.content.every(part => part.type === "text"));
}
/** All current-attempt tool rows are mandatory. No content part or tool JSON is split. */
export function assertCompleteToolGroups(messages: readonly ModelMessage[]): void {
  const calls = new Map<string, string>(), results = new Set<string>();
  for (const message of messages) {
    if (typeof message.content === "string") continue;
    for (const part of message.content) {
      if (part.type === "tool-call") {
        if (message.role !== "assistant" || calls.has(part.toolCallId)) throw new ModelInputSelectionError("CONTEXT_INCOMPLETE");
        calls.set(part.toolCallId, part.toolName);
      } else if (part.type === "tool-result") {
        if (message.role !== "tool" || results.has(part.toolCallId) || calls.get(part.toolCallId) !== part.toolName) throw new ModelInputSelectionError("CONTEXT_INCOMPLETE");
        results.add(part.toolCallId);
      }
    }
  }
  if (calls.size !== results.size) throw new ModelInputSelectionError("CONTEXT_INCOMPLETE");
}
export function renderModelInputEntries(entries: readonly ModelInputEntry[]): string {
  return entries.map(entry => entry.text).join("\n\n");
}
type ModelInputFitSource = { messages: readonly ModelInputMessage[]; entries: readonly ModelInputEntry[]; policy: ModelInputSelectionPolicy };
type ModelInputFitCandidate = { messages: ModelMessage[]; context: string };
export type ModelInputFitResult = ModelInputFitCandidate & { messageIds: string[]; entryKeys: string[]; omitted: boolean; supported: boolean };
/** Shared selection state. A yielded candidate is only a request proposal, never
 * authorization or a dispatch permit; the original guards remain external. */
function* modelInputFitSteps(input: ModelInputFitSource): Generator<ModelInputFitCandidate, ModelInputFitResult, ModelInputBoundResult> {
  const policy = modelInputPolicy(input.policy), ids = new Set<string>();
  const messages = input.messages.map(value => {
    if (!value.id || ids.has(value.id)) throw new ModelInputSelectionError("CONTEXT_INCOMPLETE"); ids.add(value.id); return value;
  });
  assertCompleteToolGroups(messages.filter(value => value.mandatory).map(value => value.message));
  if (messages.some(value => !value.mandatory && !textOnlyModelMessage(value.message))) throw new ModelInputSelectionError("CONTEXT_INCOMPLETE");
  const keys = new Set<string>();
  const entries = input.entries.map(value => {
    if (!value.key || keys.has(value.key) || !Number.isFinite(value.relevance)) throw new ModelInputSelectionError("CONTEXT_INCOMPLETE");
    keys.add(value.key); return value;
  });
  let omitted = false;
  for (const [kind, maximum] of [["memory", policy.relevantMemories], ["fact", policy.relevantFacts]] as const) {
    const ranked = entries.filter(entry => entry.kind === kind).sort((a, b) => b.relevance - a.relevance || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    for (const entry of ranked.slice(maximum)) { entries.splice(entries.indexOf(entry), 1); omitted = true; }
  }
  if (entries.filter(entry => entry.kind === "pending").length > policy.pendingEntries) throw new ModelInputSelectionError("CONTEXT_INCOMPLETE");
  const remove = () => {
    // Pending coverage is mandatory; excess becomes explicit incompleteness upstream.
    const optional = entries.filter(value => value.kind === "memory" || value.kind === "fact").sort((a, b) => a.relevance - b.relevance || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    if (optional.length) { entries.splice(entries.indexOf(optional[0]!), 1); omitted = true; return; }
    const index = messages.findIndex(value => !value.mandatory);
    if (index < 0) throw new ModelInputSelectionError("CONTEXT_LIMIT_EXCEEDED"); messages.splice(index, 1); omitted = true;
  };
  while (messages.length + entries.length + 1 > policy.maxMessages) remove();
  for (;;) {
    const context = renderModelInputEntries(entries), selected = messages.map(value => value.message);
    const result = yield { messages: selected, context };
    if (!result.supported || result.withinBound) return { messages: selected, context, messageIds: messages.map(value => value.id),
      entryKeys: entries.map(value => value.key), omitted, supported: result.supported };
    remove();
  }
}

/** The callback must distinguish qualified numeric overflow from every other refusal. */
export function fitModelInput(input: ModelInputFitSource & {
  check(messages: ModelMessage[], context: string): ModelInputBoundResult;
}): ModelInputFitResult {
  const steps = modelInputFitSteps(input);
  let step = steps.next();
  while (!step.done) step = steps.next(input.check(step.value.messages, step.value.context));
  return step.value;
}

/** Same whole-entry ordering with an async, pure SDK conversion check. The caller
 * supplies fresh policy proposals; no outcome is shared across invocations. */
export async function fitModelInputAsync(input: ModelInputFitSource & {
  check(messages: ModelMessage[], context: string): Promise<ModelInputBoundResult>;
}): Promise<ModelInputFitResult> {
  const steps = modelInputFitSteps(input);
  let step = steps.next();
  while (!step.done) step = steps.next(await input.check(step.value.messages, step.value.context));
  return step.value;
}

/** Reuses the current query's source scores; no fact or source is newly embedded. */
export function relevantRecallItems(items: readonly RecallItem[], query: string, policyInput: ModelInputSelectionPolicy,
  scope: { tenantId: string; memorySpaceId: string }, sourceScores: readonly [string, number][] = []) {
  const policy = modelInputPolicy(policyInput), scores = new Map<string, number>();
  for (const [key, score] of sourceScores) if (Number.isFinite(score)) scores.set(key, Math.max(scores.get(key) ?? -Infinity, score));
  const words = new Set(query.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu)?.filter(word => word.length > 2
    && !["the", "and", "for", "that", "this", "what", "which", "with", "are", "was", "user", "have"].includes(word)) ?? []);
  const relevance = (item: RecallItem) => {
    if (item.type === "memory") return item.score;
    const lineage = (item.fact as unknown as { lineage?: SourceLineage } | undefined)?.lineage;
    const semantic = lineage ? scores.get(contextSourceKey(scope, lineage)) : undefined;
    const lexical = (item.content.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu) ?? []).filter(word => words.has(word)).length;
    return semantic !== undefined ? semantic : lexical ? lexical / Math.max(words.size, 1) : 0;
  };
  const selected: { item: RecallItem; relevance: number }[] = [], seen = new Set<string>();
  for (const [type, maximum] of [["memory", policy.relevantMemories], ["fact", policy.relevantFacts]] as const) {
    const ranked = items.filter(item => item.type === type).map(item => ({ item, relevance: relevance(item) }))
      .filter(value => Number.isFinite(value.relevance) && (type === "memory" || value.relevance > 0))
      .sort((a, b) => b.relevance - a.relevance || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));
    let count = 0;
    if (!maximum) continue;
    for (const value of ranked) { const key = `${type}:${value.item.id}`; if (seen.has(key)) continue; seen.add(key); selected.push(value); if (++count >= maximum) break; }
  }
  return selected;
}
