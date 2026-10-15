/** Shared browser-safe memory discovery policy. No inference or authority lives here. */
export type MemoryEffort = "fast" | "normal" | "high" | "max";
export interface MemoryEffortRequest { effort?: MemoryEffort; maxEntries?: number; maxContextTokens?: number }
export interface MemoryEffortPolicyV1 {
  version: 1;
  maxDepth?: number;
  maxEntries?: number;
  maxContextTokens?: number;
  maxWork?: number;
  retrievalDeadlineMs?: number;
}
export interface EffectiveMemoryEffortPolicy {
  version: 1; policyVersion: "memory-effort-v1";
  /** Omission preserves the original immutable snapshot's score ordering. */
  evidenceRankingVersion?: 1;
  requestedEffort: MemoryEffort; effectiveEffort: MemoryEffort;
  maxDepth: number | null; maxEntries: number | null; maxContextTokens: number;
  maxWork: number; maxCandidateBytes:number; pageSize: number; retrievalDeadlineMs: number; targetFirstAnswerMs: number;
}
export type MemoryEffortStopReason = "exhausted" | "depth" | "relevance" | "entries" | "input" | "deadline" | "work" | "cancellation" | "unavailable";
export interface MemoryEffortTrace {
  /** Discovery route only; direct facts do not imply semantic corpus exhaustion. */
  retrievalRoute?: "direct-facts-v1" | "semantic-v1";
  version: 1; policyVersion: "memory-effort-v1"; requestedEffort: MemoryEffort; effectiveEffort: MemoryEffort;
  maxDepth: number | null; maxEntries: number | null; maxContextTokens: number; targetFirstAnswerMs: number;
  reachedDepth: number; visited: number; expanded: number; selected: number; deduplicated: number;
  entriesByKind: { memory: number; fact: number; pending: number; history: number };
  selectedInputUnits: number; durationMs: number; stopReasons: MemoryEffortStopReason[]; unavailableStages: string[];
}
export const MEMORY_EFFORT_POLICY_V1: Readonly<MemoryEffortPolicyV1> = Object.freeze({ version: 1 });
const presets = {
  fast: { maxDepth: 2, maxEntries: 4, targetFirstAnswerMs: 3000, retrievalDeadlineMs: 750, maxWork: 128 },
  normal: { maxDepth: 4, maxEntries: 8, targetFirstAnswerMs: 6000, retrievalDeadlineMs: 2000, maxWork: 512 },
  high: { maxDepth: 8, maxEntries: 16, targetFirstAnswerMs: 8000, retrievalDeadlineMs: 3500, maxWork: 1024 },
  max: { maxDepth: null, maxEntries: null, targetFirstAnswerMs: 30000, retrievalDeadlineMs: 18000, maxWork: 4096 },
} as const;
function positive(value: unknown, zero = false): value is number { return Number.isSafeInteger(value) && (value as number) >= (zero ? 0 : 1); }
function ownDataRecord(input: unknown): input is Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) return false;
  return Reflect.ownKeys(input).every(key => typeof key === "string" && Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(input,key)!,"value"));
}
function invalid(): never { throw new Error("INVALID_INPUT: invalid memory effort"); }
export function normalizeMemoryEffortRequest(input?: MemoryEffortRequest): MemoryEffortRequest {
  if (input === undefined) return { effort: "normal" };
  if (!ownDataRecord(input) || Object.keys(input).some(key => !["effort", "maxEntries", "maxContextTokens"].includes(key))) invalid();
  const effort = input.effort === undefined ? "normal" : input.effort;
  if (!(typeof effort === "string" && Object.prototype.hasOwnProperty.call(presets, effort)) || input.maxEntries !== undefined && !positive(input.maxEntries, true)
    || input.maxContextTokens !== undefined && !positive(input.maxContextTokens)) invalid();
  return { effort:effort as MemoryEffort, ...(input.maxEntries === undefined ? {} : { maxEntries: input.maxEntries }), ...(input.maxContextTokens === undefined ? {} : { maxContextTokens: input.maxContextTokens }) };
}
export function validateMemoryEffortPolicy(input: MemoryEffortPolicyV1 = MEMORY_EFFORT_POLICY_V1): MemoryEffortPolicyV1 {
  if (!ownDataRecord(input) || (input as {version:number}).version !== 1 || Object.keys(input).some(key => !["version", "maxDepth", "maxEntries", "maxContextTokens", "maxWork", "retrievalDeadlineMs"].includes(key))
    || Object.entries(input).some(([key, value]) => key !== "version" && !positive(value, key === "maxEntries"))) invalid();
  return { ...input };
}
export function resolveMemoryEffortPolicy(request?: MemoryEffortRequest, administrator?: MemoryEffortPolicyV1): EffectiveMemoryEffortPolicy {
  const normalized = normalizeMemoryEffortRequest(request), admin = validateMemoryEffortPolicy(administrator), effort = normalized.effort!, preset = presets[effort];
  const narrow = (base: number | null, ...values: (number | undefined)[]) => { const present = values.filter((v): v is number => v !== undefined); return !present.length ? base : Math.min(base ?? Infinity, ...present); };
  return { version: 1, policyVersion: "memory-effort-v1", evidenceRankingVersion: 1, requestedEffort: effort, effectiveEffort: effort,
    maxDepth: narrow(preset.maxDepth, admin.maxDepth), maxEntries: narrow(preset.maxEntries, admin.maxEntries, normalized.maxEntries),
    maxContextTokens: Math.min(32768, admin.maxContextTokens ?? 32768, normalized.maxContextTokens ?? 32768),
    maxWork: Math.min(preset.maxWork, admin.maxWork ?? preset.maxWork), maxCandidateBytes:262144, pageSize: 16,
    retrievalDeadlineMs: Math.min(preset.retrievalDeadlineMs, admin.retrievalDeadlineMs ?? preset.retrievalDeadlineMs), targetFirstAnswerMs: preset.targetFirstAnswerMs };
}
export function emptyMemoryEffortTrace(policy: EffectiveMemoryEffortPolicy): MemoryEffortTrace {
  return { version: 1, policyVersion: policy.policyVersion, requestedEffort: policy.requestedEffort, effectiveEffort: policy.effectiveEffort,
    maxDepth: policy.maxDepth, maxEntries: policy.maxEntries, maxContextTokens: policy.maxContextTokens, targetFirstAnswerMs: policy.targetFirstAnswerMs,
    reachedDepth: 0, visited: 0, expanded: 0, selected: 0, deduplicated: 0, entriesByKind: { memory: 0, fact: 0, pending: 0, history: 0 },
    selectedInputUnits: 0, durationMs: 0, stopReasons: [], unavailableStages: [] };
}

/** Per-branch direct candidate work, independent of selected optional entries.
 * ANN supports bounded100-hit calls; native fact search uses the same work ceiling.
 * Reaching the ceiling reports partial discovery instead of asserting exhaustion. */
export function memoryEffortCandidateLimit(policy?:EffectiveMemoryEffortPolicy):number {
  if(!policy)return 10; // Exact legacy Agent contract.
  return Math.max(1,Math.min(100,Math.floor(policy.maxWork/8),Math.floor(policy.maxCandidateBytes/256),Math.floor(policy.maxContextTokens/64)));
}
