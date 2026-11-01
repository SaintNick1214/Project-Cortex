/** Opt-in timing only. Never pass prompts, provider options or output here. */
import { createSha256 } from "../src/common/crypto";

export type RuntimeLatencyMetadata = { runBudgetId?: string; semanticId?: string; operationKey?: string; durationMs?: number; bytes?: number; status?: number;
  selectedMessages?: number; selectedMemories?: number; selectedFacts?: number; selectedPending?: number; contextBytes?: number;
  inputTokens?: number; inputLimit?: number };
const selectionScalar = (value: unknown): number | undefined => Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : undefined;
function correlation(value: string, opaqueAllowed = true): string {
  return opaqueAllowed && /^(?:run:)?[a-f0-9]{64}$/.test(value) ? value : `sha256:${createSha256().update(value).digestHex()}`;
}
export function traceRuntimePhase(runId: string, attemptNumber: number, phase: string, metadata: RuntimeLatencyMetadata = {}): void {
  // Workflow disables process in its deterministic handler environment.
  if (typeof process === "undefined" || process.env.CORTEX_RUNTIME_LATENCY_TRACE !== "1") return;
  // Copy only this fixed scalar allowlist, even if an untyped caller adds keys.
  const fields = { runBudgetId: metadata.runBudgetId === undefined ? undefined : correlation(metadata.runBudgetId),
    semanticId: metadata.semanticId === undefined ? undefined : correlation(metadata.semanticId, false), operationKey: metadata.operationKey,
    durationMs: metadata.durationMs, bytes: metadata.bytes, status: metadata.status,
    selectedMessages: selectionScalar(metadata.selectedMessages), selectedMemories: selectionScalar(metadata.selectedMemories),
    selectedFacts: selectionScalar(metadata.selectedFacts), selectedPending: selectionScalar(metadata.selectedPending),
    contextBytes: selectionScalar(metadata.contextBytes), inputTokens: selectionScalar(metadata.inputTokens), inputLimit: selectionScalar(metadata.inputLimit) };
  console.log(JSON.stringify({ runId: correlation(runId), attemptNumber, phase, at: Date.now(), ...fields }));
}

function mutationClock(): number | undefined {
  // Do not touch the clock in ordinary execution or Workflow's deterministic environment.
  if (typeof process === "undefined" || process.env.CORTEX_RUNTIME_LATENCY_TRACE !== "1") return undefined;
  try {
    if (typeof performance === "undefined") return undefined;
    const value = performance.now();
    return Number.isFinite(value) ? value : undefined;
  } catch { return undefined; }
}
function mutationDuration(start: number | undefined): RuntimeLatencyMetadata {
  if (start === undefined) return {};
  const end = mutationClock();
  const durationMs = end === undefined ? undefined : end - start;
  return durationMs !== undefined && Number.isFinite(durationMs) && durationMs >= 0 ? { durationMs } : {};
}

/** Prospective native-mutation diagnostics only: queries have a fixed performance clock.
 * Never use these timings for guards, budgets, return values or persisted state.
 * Trace-output failures retain traceRuntimePhase's existing enabled failure behavior. */
export async function traceRuntimeMutationSpan<T>(runId: string, attemptNumber: number, phase: string,
  execute: () => Promise<T>): Promise<T> {
  if (typeof process === "undefined" || process.env.CORTEX_RUNTIME_LATENCY_TRACE !== "1") return await execute();
  traceRuntimePhase(runId, attemptNumber, `${phase}.begin`);
  const start = mutationClock();
  let result: T;
  try { result = await execute(); }
  catch (error) {
    traceRuntimePhase(runId, attemptNumber, `${phase}.failed`, mutationDuration(start));
    throw error;
  }
  // Keep trace-output failures separate from failures of the original product callback.
  traceRuntimePhase(runId, attemptNumber, `${phase}.end`, mutationDuration(start));
  return result;
}
