import { canonicalModelJson } from "./model-policy.js";
import { semanticHash } from "./profile.js";

/** Public v1 is deliberately text-only. Scope, model and execution authority are server-owned. */
export interface TextSubmitV1 {
  version: 1; agentId: string; agentVersion: number; conversationId?: string;
  clientRequestId: string; parts: { type: "text"; text: string }[];
}
export interface NormalizedAdmissionV1 {
  internalVersion: 1; publicRequest: TextSubmitV1;
  conversationSelector: { kind: "create" } | { kind: "existing"; conversationId: string };
  agentSelector: { agentId: string; version: number };
  userInput: { role: "user"; parts: { type: "text"; text: string }[] };
}
export interface TranscriptPosition { order: number; stepOrder: number }
export interface MessagePin extends TranscriptPosition {
  nativeMessageId: string; sourceEventId: string; sourceRevision: number; contentHash: string; canonicalContentHash?: string;
}
export interface CutoffV1 {
  version: 1; conversationId: string; threadId: string; conversationEpoch: number;
  historyRevision: number; queueSequence: number; runDocId: string; attemptNumber: number;
  definitionVersion: number; definitionHash: string; anchor: MessagePin; messages: MessagePin[];
  ingestionCutoff: { scopeIdentity: string; sequence: number; graphSequence?: number; requiredStages: ("facts" | "vectors" | "graph")[] };
  capturedAuthorityReference: import("../auth/verified.js").RuntimeAuthorityReference;
  completeness: "complete" | "incomplete";
}
export interface PublicTranscriptMessage extends TranscriptPosition {
  id: string; role: "user" | "assistant" | "tool"; parts: ({ type: "text"; text: string } | { type: "media-job"; version: 1; jobId: string; artifactId: string; kind: "image" | "video" })[];
  status: "pending" | "success" | "failed"; revision: number; assets?: import("./assets.js").RuntimeAssetVersion[];
}

function invalid(): never { throw new Error("INVALID_INPUT: invalid text submission"); }
export function utf8Bytes(text: string): number { return new TextEncoder().encode(text).length; }
export function assertUnicode(text: string): void {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(++index); if (!(next >= 0xdc00 && next <= 0xdfff)) invalid();
    } else if (code >= 0xdc00 && code <= 0xdfff) invalid();
  }
}
export function boundedIdentifier(value: unknown, maximumBytes = 256): string {
  if (typeof value !== "string" || !value || value.trim() !== value || utf8Bytes(value) > maximumBytes) invalid();
  assertUnicode(value); return value;
}
export function clientRequestKey(value: unknown): string {
  const key = boundedIdentifier(value, 512);
  if ([...key].length > 128) invalid();
  return key;
}
function exactKeys(object: Record<string, unknown>, required: string[], optional: string[] = []): void {
  if (required.some(key => !Object.prototype.hasOwnProperty.call(object, key)) || Object.keys(object).some(key => !required.includes(key) && !optional.includes(key))) invalid();
}
export function normalizeTextSubmit(input: unknown): NormalizedAdmissionV1 {
  // Entire graph is inspected before any property access, getter, iteration or map.
  let canonical: string;
  try { canonical = canonicalModelJson(input); } catch { return invalid(); }
  const detached: unknown = JSON.parse(canonical);
  if (!detached || typeof detached !== "object" || Array.isArray(detached)) invalid();
  const value = detached as Record<string, unknown>;
  exactKeys(value, ["version", "agentId", "agentVersion", "clientRequestId", "parts"], ["conversationId"]);
  if (value.version !== 1 || !Number.isSafeInteger(value.agentVersion) || (value.agentVersion as number) < 1) invalid();
  boundedIdentifier(value.agentId); clientRequestKey(value.clientRequestId);
  if (Object.prototype.hasOwnProperty.call(value, "conversationId")) boundedIdentifier(value.conversationId);
  if (!Array.isArray(value.parts) || value.parts.length < 1 || value.parts.length > 128) invalid();
  let bytes = 0; let scalars = 0;
  for (const item of value.parts as unknown[]) {
    if (!item || typeof item !== "object" || Array.isArray(item)) invalid();
    const part = item as Record<string, unknown>; exactKeys(part, ["type", "text"]);
    if (part.type !== "text" || typeof part.text !== "string") invalid();
    assertUnicode(part.text); bytes += utf8Bytes(part.text); scalars += [...part.text].length;
  }
  if (!scalars || bytes > 120_000) invalid();
  const publicRequest = value as unknown as TextSubmitV1;
  return { internalVersion: 1, publicRequest,
    conversationSelector: publicRequest.conversationId === undefined ? { kind: "create" }
      : { kind: "existing", conversationId: publicRequest.conversationId },
    agentSelector: { agentId: publicRequest.agentId, version: publicRequest.agentVersion },
    userInput: { role: "user", parts: publicRequest.parts.map(part => ({ ...part })) } };
}
export async function bindTextSubmission(input: unknown, scope: { tenantId: string; memorySpaceId: string; principalId: string }) {
  const normalized = normalizeTextSubmit(input);
  const identity = ["cortex.submit.v1", scope.tenantId, scope.memorySpaceId, scope.principalId,
    normalized.conversationSelector.kind === "create" ? ["create"] : ["existing", normalized.conversationSelector.conversationId],
    normalized.publicRequest.clientRequestId];
  const identityCanonical = canonicalModelJson(identity);
  const requestCanonical = canonicalModelJson({ version: 1, identity, publicRequest: normalized.publicRequest });
  if (utf8Bytes(requestCanonical) > 180_000) invalid();
  const identityHash = await semanticHash(identityCanonical);
  return { normalized, identityCanonical, identityHash, requestCanonical, ledgerRequestId: `submit-v1:${identityHash}` };
}
export function comparePosition(left: TranscriptPosition, right: TranscriptPosition): number {
  for (const value of [left.order, left.stepOrder, right.order, right.stepOrder]) {
    if (!Number.isSafeInteger(value) || value < 0) invalid();
  }
  return left.order - right.order || left.stepOrder - right.stepOrder;
}
/** Deliberately projects content, never message metadata, reasoning, provider fields or tool inputs. */
export function publicTextParts(content: unknown): { type: "text"; text: string }[] {
  if (typeof content === "string") { assertUnicode(content); return [{ type: "text", text: content }]; }
  if (!Array.isArray(content)) return [];
  return (content as unknown[]).flatMap(value => {
    if (!value || typeof value !== "object") return []; const part = value as Record<string, unknown>;
    return part.type === "text" && typeof part.text === "string" ? (assertUnicode(part.text), [{ type: "text" as const, text: part.text }]) : [];
  });
}
