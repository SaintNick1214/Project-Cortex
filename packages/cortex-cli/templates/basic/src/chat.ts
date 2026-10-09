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
  const handle = await client.submit({ version: 1, agentId: config.agentId, agentVersion: config.agentVersion, clientRequestId: requestId,
    ...(input.conversationId === undefined ? {} : { conversationId: identifier(input.conversationId) }), parts: [{ type: "text", text }] });
  await client.start(handle, { streaming: true });
  return { version: 1 as const, handle, run: await client.get(handle) };
}
export async function observe(client: RuntimeClient, runId: string, options: { cursor?: number; attemptNumber?: number; finalOnly?: boolean } = {}) {
  const handle = await client.attach(identifier(runId));
  if (options.cursor !== undefined && (!Number.isSafeInteger(options.cursor) || options.cursor < 0)
    || options.attemptNumber !== undefined && (!Number.isSafeInteger(options.attemptNumber) || options.attemptNumber < 0)
    || options.cursor !== undefined && options.cursor > 0 && options.attemptNumber === undefined) throw new AppError("INVALID_CURSOR");
  return await client.observe(handle, { cursor: { sequence: options.cursor ?? 0, attemptNumber: options.attemptNumber ?? 0 }, finalOnly: options.finalOnly ?? false });
}
export function terminal(value: RuntimeObservation): boolean { return ["complete", "failed", "cancelled", "waiting_approval"].includes(value.run.responseStatus); }
export async function watch(client: RuntimeClient, handle: RuntimeRunHandle, update: (value: RuntimeObservation) => void): Promise<void> {
  let stop = () => {};
  try { await new Promise<void>((resolve, reject) => {
    stop = client.watchObservation(handle, value => { update(value); if (terminal(value)) resolve(); }, reject);
  }); } finally { stop(); }
}
