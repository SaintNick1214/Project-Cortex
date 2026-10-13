/** Opt-in timing only. Never pass prompts, provider options or output here. */
import { createSha256 } from "../src/common/crypto";

export type RuntimeLatencyMetadata = { runBudgetId?: string; semanticId?: string; operationKey?: string; durationMs?: number; bytes?: number; status?: number };
function correlation(value: string, opaqueAllowed = true): string {
  return opaqueAllowed && /^(?:run:)?[a-f0-9]{64}$/.test(value) ? value : `sha256:${createSha256().update(value).digestHex()}`;
}
export function traceRuntimePhase(runId: string, attemptNumber: number, phase: string, metadata: RuntimeLatencyMetadata = {}): void {
  // Workflow disables process in its deterministic handler environment.
  if (typeof process === "undefined" || process.env.CORTEX_RUNTIME_LATENCY_TRACE !== "1") return;
  // Copy only this fixed scalar allowlist, even if an untyped caller adds keys.
  const fields = { runBudgetId: metadata.runBudgetId === undefined ? undefined : correlation(metadata.runBudgetId),
    semanticId: metadata.semanticId === undefined ? undefined : correlation(metadata.semanticId, false), operationKey: metadata.operationKey,
    durationMs: metadata.durationMs, bytes: metadata.bytes, status: metadata.status };
  console.log(JSON.stringify({ runId: correlation(runId), attemptNumber, phase, at: Date.now(), ...fields }));
}
