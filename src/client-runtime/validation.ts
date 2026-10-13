import type { RuntimeObservation, RuntimePublicPart, RuntimeRun, RuntimeScope, RuntimeSession, RuntimeStartResult, TextSubmitV1 } from "./types.js";

export class CortexRuntimeError extends Error {
  readonly version = 1;
  constructor(readonly code: string, readonly outcome: "not_dispatched" | "uncertain" = "not_dispatched", readonly retryable = false) {
    super(`Cortex runtime: ${code}`); this.name = "CortexRuntimeError";
  }
}
export function invalid(code = "INVALID_INPUT"): never { throw new CortexRuntimeError(code); }
export function runtimeError(error: unknown): CortexRuntimeError {
  if (error instanceof CortexRuntimeError) return error;
  // Convex transports typed .data. Never expose a provider diagnostic, token, stack or arbitrary .message.
  let data: unknown;
  if (error && typeof error === "object") data = Object.getOwnPropertyDescriptor(error, "data")?.value;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch { data = undefined; } }
  if (data && typeof data === "object") {
    const code = Object.getOwnPropertyDescriptor(data, "code")?.value;
    const outcome = Object.getOwnPropertyDescriptor(data, "outcome")?.value;
    if (typeof code === "string" && /^[A-Z][A-Z0-9_]{0,79}$/.test(code)) {
      return new CortexRuntimeError(code, outcome === "not_dispatched" ? outcome : "uncertain");
    }
  }
  return new CortexRuntimeError("TRANSPORT_ERROR", "uncertain");
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== "string" || !("value" in descriptors[key]!))) invalid();
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  if (required.some(key => !Object.prototype.hasOwnProperty.call(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) invalid();
}
export function identifier(value: unknown, max = 256): string {
  if (typeof value !== "string" || !value || value.trim() !== value || new TextEncoder().encode(value).length > max) invalid();
  unicode(value); return value;
}
function unicode(value: string) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) { const next = value.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) invalid(); }
    else if (code >= 0xdc00 && code <= 0xdfff) invalid();
  }
}
export function natural(value: unknown): number { if (!Number.isSafeInteger(value) || (value as number) < 0) invalid(); return value as number; }
export function textSubmit(input: unknown): TextSubmitV1 {
  const value = object(input); exact(value, ["version", "agentId", "agentVersion", "clientRequestId", "parts"], ["conversationId"]);
  if (value.version !== 1 || natural(value.agentVersion) < 1) invalid();
  const agentId = identifier(value.agentId), clientRequestId = identifier(value.clientRequestId, 512);
  if ([...clientRequestId].length > 128) invalid();
  if (!Array.isArray(value.parts) || value.parts.length < 1 || value.parts.length > 128) invalid();
  // Dense, ordinary arrays only: no accessors or extra branches anywhere in v1.
  const descriptors = Object.getOwnPropertyDescriptors(value.parts);
  if (Object.getPrototypeOf(value.parts) !== Array.prototype || Reflect.ownKeys(descriptors).length !== value.parts.length + 1
    || Reflect.ownKeys(descriptors).some(key => typeof key !== "string" || !("value" in descriptors[key]!))) invalid();
  let bytes = 0, scalars = 0;
  const parts = value.parts.map(inputPart => {
    const part = object(inputPart); exact(part, ["type", "text"]);
    if (part.type !== "text" || typeof part.text !== "string") invalid();
    unicode(part.text); bytes += new TextEncoder().encode(part.text).length; scalars += [...part.text].length;
    return { type: "text" as const, text: part.text };
  });
  if (!scalars || bytes > 120_000) invalid();
  return { version: 1, agentId, agentVersion: value.agentVersion as number, clientRequestId, parts,
    ...(value.conversationId === undefined ? {} : { conversationId: identifier(value.conversationId) }) };
}
export function sameScope(a: RuntimeScope, b: RuntimeScope): boolean { return a.tenantId === b.tenantId && a.memorySpaceId === b.memorySpaceId; }
export function deliveryDeadline(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > Number.MAX_SAFE_INTEGER) invalid("INVALID_RESPONSE");
  return value;
}
export function session(value: unknown): RuntimeSession {
  const row = object(value); if (row.version !== 1) invalid("INVALID_RESPONSE");
  return Object.freeze({ version: 1, tenantId: identifier(row.tenantId), memorySpaceId: identifier(row.memorySpaceId), principalId: identifier(row.principalId), userId: identifier(row.userId),
    ...(row.deliveryExpiresAt === undefined ? {} : { deliveryExpiresAt: deliveryDeadline(row.deliveryExpiresAt) }) });
}
export function run(value: unknown): RuntimeRun {
  const row = object(value), scope = object(row.scope);
  if (row.version !== 1 || !["queued", "waiting_approval", "running", "complete", "failed", "cancelled"].includes(row.responseStatus as string)) invalid("INVALID_RESPONSE");
  if ([row.memoryStatus, row.graphStatus].some(value => !["pending", "complete", "failed", "not_requested"].includes(value as string))) invalid("INVALID_RESPONSE");
  for (const key of ["runId", "conversationId", "agentId", "definitionHash"]) identifier(row[key], 512);
  identifier(scope.tenantId); identifier(scope.memorySpaceId); natural(row.agentVersion); natural(row.attemptNumber); natural(row.queueSequence);
  // The backend owns these public metadata fields. Copy them without accepting private extras.
  return { version: 1, runId: row.runId as string, conversationId: row.conversationId as string, agentId: row.agentId as string, agentVersion: row.agentVersion as number,
    scope: { tenantId: scope.tenantId as string, memorySpaceId: scope.memorySpaceId as string }, definitionHash: row.definitionHash as string,
    queueSequence: row.queueSequence as number, responseStatus: row.responseStatus as RuntimeRun["responseStatus"], memoryStatus: row.memoryStatus as RuntimeRun["memoryStatus"],
    graphStatus: row.graphStatus as RuntimeRun["graphStatus"], attemptNumber: row.attemptNumber as number, cancellationRequested: row.cancellationRequested === true,
    inputMessageIds: row.inputMessageIds as string[], outputMessageIds: row.outputMessageIds as string[], failureCode: row.failureCode as string | null,
    contextCompleteness: row.contextCompleteness as RuntimeRun["contextCompleteness"], contextFailureCode: row.contextFailureCode as string | null,
    createdAt: row.createdAt as number, updatedAt: row.updatedAt as number };
}
export function startResult(input: unknown): RuntimeStartResult {
  const value = object(input);
  exact(value, ["runId", "attemptNumber", "state"], ["failureCode"]);
  if (!["queued", "ready", "running", "waiting_approval", "finalizing", "complete", "failed", "cancelled", "unknown"].includes(value.state as string)) invalid("INVALID_RESPONSE");
  return { runId: identifier(value.runId, 512), attemptNumber: natural(value.attemptNumber), state: value.state as RuntimeStartResult["state"],
    ...(value.failureCode === undefined ? {} : { failureCode: identifier(value.failureCode) }) };
}
export function admissionResult(input: unknown): { version: 1; run: RuntimeRun; start: RuntimeStartResult } {
  const value = object(input); exact(value, ["version", "run", "start"]);
  if (value.version !== 1) invalid("INVALID_RESPONSE");
  const metadata = object(value.run);
  exact(metadata, ["version", "runId", "conversationId", "agentId", "agentVersion", "scope", "definitionHash", "queueSequence", "responseStatus",
    "memoryStatus", "graphStatus", "attemptNumber", "cancellationRequested", "inputMessageIds", "outputMessageIds", "failureCode", "contextCompleteness", "contextFailureCode", "createdAt", "updatedAt"]);
  exact(object(metadata.scope), ["tenantId", "memorySpaceId"]);
  if (typeof metadata.cancellationRequested !== "boolean" || natural(metadata.agentVersion) < 1
    || ![null, "complete", "incomplete"].includes(metadata.contextCompleteness as RuntimeRun["contextCompleteness"])
    || [metadata.failureCode, metadata.contextFailureCode].some(code => code !== null && typeof code !== "string")) invalid("INVALID_RESPONSE");
  for (const key of ["inputMessageIds", "outputMessageIds"] as const) {
    const ids = metadata[key]; if (!Array.isArray(ids) || ids.some(id => typeof id !== "string")) invalid("INVALID_RESPONSE");
    for (const id of ids) identifier(id, 512);
  }
  natural(metadata.createdAt); natural(metadata.updatedAt);
  const admitted = run(value.run), started = startResult(value.start);
  if (started.runId !== admitted.runId || started.attemptNumber !== admitted.attemptNumber) invalid("RUN_IDENTITY_CHANGED");
  return { version: 1, run: admitted, start: started };
}
export function runtimePublicPart(input: unknown): RuntimePublicPart {
  const part = object(input);
  switch (part.type) {
    case "text": case "text-delta": if (typeof part.text !== "string") break; return { type: part.type, text: part.text, ...(typeof part.id === "string" ? { id: part.id } : {}) };
    case "text-start": case "text-end": return { type: part.type, id: identifier(part.id) };
    case "tool": if (!["requested", "approved", "running", "succeeded", "failed"].includes(part.phase as string)) break;
      return { type: "tool", toolCallId: identifier(part.toolCallId), name: identifier(part.name), phase: part.phase as "requested" };
    case "status": return { type: "status", state: identifier(part.state) };
    case "artifact": if (part.kind !== "memory-receipt") break; return { type: "artifact", kind: "memory-receipt", artifactId: identifier(part.artifactId, 512) };
    case "media-job": if (part.version !== 1 || !["image", "video"].includes(part.kind as string)) break;
      return { type: "media-job", version: 1, jobId: identifier(part.jobId), artifactId: identifier(part.artifactId), kind: part.kind as "image" | "video" };
    case "error": return { type: "error", code: "RUNTIME_OUTPUT_FAILED" };
  }
  return invalid("INVALID_RESPONSE");
}
export function observation(input: unknown): RuntimeObservation {
  const row = object(input); if (!Array.isArray(row.parts) || !Array.isArray(row.approvals)) invalid("INVALID_RESPONSE");
  return { run: run(row.run), state: identifier(row.state), cursor: natural(row.cursor),
    ...(row.deliveryExpiresAt === undefined ? {} : { deliveryExpiresAt: deliveryDeadline(row.deliveryExpiresAt) }),
    parts: row.parts.map(inputPart => { const part = object(inputPart); return { sequence: natural(part.sequence), part: runtimePublicPart(part.part) }; }),
    approvals: row.approvals.map(inputApproval => { const approval = object(inputApproval); return { operationId: identifier(approval.operationId, 512), toolName: identifier(approval.toolName), requestHash: identifier(approval.requestHash) }; }) };
}
