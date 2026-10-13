/** Submit only new text. History, model/tool loops and memory writes belong to the backend. */
import type { RuntimeRunHandle, RuntimeObservation } from "@cortexmemory/sdk/runtime";
import type { RuntimeClient, RuntimeConfig } from "./cortex.js";
import { AppError, identifier } from "./cortex.js";
export function message(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || new TextEncoder().encode(value).byteLength > 16000) throw new AppError("INVALID_MESSAGE");
  return value;
}
export async function chat(client: RuntimeClient, config: RuntimeConfig, input: { requestId: string; message: string; conversationId?: string }) {
  const requestId = identifier(input.requestId), text = message(input.message);
  const { handle, run } = await client.submitAndStart({ version: 1, agentId: config.agentId, agentVersion: config.agentVersion, clientRequestId: requestId,
    ...(input.conversationId === undefined ? {} : { conversationId: identifier(input.conversationId) }), parts: [{ type: "text", text }] }, { streaming: true });
  return { version: 1 as const, handle, run };
}
export async function observe(client: RuntimeClient, runId: string, options: { cursor?: number; attemptNumber?: number; finalOnly?: boolean } = {}) {
  const handle = await client.attach(identifier(runId));
  if (options.cursor !== undefined && (!Number.isSafeInteger(options.cursor) || options.cursor < 0)
    || options.attemptNumber !== undefined && (!Number.isSafeInteger(options.attemptNumber) || options.attemptNumber < 0)
    || options.cursor !== undefined && options.cursor > 0 && options.attemptNumber === undefined) throw new AppError("INVALID_CURSOR");
  return await client.observe(handle, { cursor: { sequence: options.cursor ?? 0, attemptNumber: options.attemptNumber ?? 0 }, finalOnly: options.finalOnly ?? false });
}
export function terminal(value: RuntimeObservation): boolean {
  return value.parts.length < 100 && ["complete", "failed", "cancelled", "waiting_approval"].includes(value.run.responseStatus);
}
export async function watch(client: RuntimeClient, handle: RuntimeRunHandle, update: (value: RuntimeObservation) => void, signal?: AbortSignal): Promise<void> {
  let stop = () => {}, subscribed = false, released = false, active = true, rejectWatch = (_error: AppError) => {};
  const release = () => { if (subscribed && !released) { released = true; stop(); } };
  const abort = () => { if (!active) return; active = false; release(); rejectWatch(new AppError("REQUEST_ABORTED", 499)); };
  try { await new Promise<void>((resolve, reject) => {
    rejectWatch = reject;
    signal?.addEventListener("abort", abort, { once: true }); if (signal?.aborted) { abort(); return; }
    stop = client.watchObservation(handle, value => {
      if (!active || signal?.aborted) return;
      update(value); if (terminal(value)) { active = false; resolve(); }
    }, error => { if (!active) return; active = false; reject(error); });
    subscribed = true; if (!active) release();
  }); } finally { active = false; signal?.removeEventListener("abort", abort); release(); }
}
