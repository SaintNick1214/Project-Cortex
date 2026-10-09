import { CortexRuntimeError, deliveryDeadline, identifier, invalid, natural, object } from "./validation.js";
import type { RuntimeAssetReference, RuntimeAssetVersion } from "./types.js";

/** Application cap in decoded bytes, independent of Convex/provider protocol limits. */
export const RUNTIME_ASSET_MAX_BYTES = 20_000_000;
export interface RuntimeAssetIoOptions { signal?: AbortSignal; timeoutMs?: number }
export interface RuntimeAssetPreview { readonly url: string; readonly mimeType: string; readonly sizeBytes: number; revoke(): void }
export interface RuntimeAssetUploadOptions extends RuntimeAssetIoOptions { requestId: string; mimeType: string; filename?: string }

export function assetHttpBase(value: string | undefined): URL {
  if (!value) invalid("ASSET_HTTP_NOT_CONFIGURED");
  let url: URL;
  try { url = new URL(value); } catch { return invalid(); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)
    || url.username || url.password || url.pathname !== "/" || url.search || url.hash) invalid();
  return url;
}
export function assetReference(input: RuntimeAssetReference): RuntimeAssetReference {
  const value = object(input), assetId = identifier(value.assetId);
  if (Object.keys(value).some(key => !["assetId", "version"].includes(key)) || natural(value.version) < 1) invalid();
  return { assetId, version: value.version as number };
}
const mimes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "video/mp4", "video/webm",
  "audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4", "audio/webm", "application/pdf", "application/octet-stream", "application/json", "text/plain", "text/csv"]);
export function assetMime(value: unknown): string {
  if (typeof value !== "string" || !mimes.has(value)) invalid("ASSET_MIME_UNSUPPORTED");
  return value;
}
export function assetRequestId(value: unknown): string {
  const id = identifier(value, 1024); if (id.length > 256) invalid("INVALID_ASSET_METADATA"); return id;
}
export function assetFilename(value: unknown): string {
  const name = identifier(value, 1024);
  if (name.length > 256 || /[\r\n\x00]/.test(name)) invalid("INVALID_ASSET_METADATA"); return name;
}
export function assetVersion(input: unknown): RuntimeAssetVersion {
  const value = object(input);
  if (value.version !== 1 || natural(value.assetVersion) < 1 || natural(value.sizeBytes) < 1 || natural(value.sizeBytes) > RUNTIME_ASSET_MAX_BYTES
    || typeof value.contentHash !== "string" || !/^[a-f0-9]{64}$/.test(value.contentHash)
    || !["image", "video", "audio", "document", "binary"].includes(value.mediaKind as string)) invalid("INVALID_RESPONSE");
  const mime = assetMime(value.mimeType), kind = mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video"
    : mime.startsWith("audio/") ? "audio" : mime === "application/octet-stream" ? "binary" : "document";
  if (kind !== value.mediaKind) invalid("INVALID_RESPONSE");
  const raw = object(value.lineage);
  let lineage: RuntimeAssetVersion["lineage"];
  if (raw.kind === "upload") lineage = Object.freeze({ kind: "upload", requestId: assetRequestId(raw.requestId) });
  else if (raw.kind === "generated") {
    if (raw.sourceVersionIds !== undefined && (!Array.isArray(raw.sourceVersionIds) || raw.sourceVersionIds.length > 16)) invalid("INVALID_RESPONSE");
    lineage = Object.freeze({ kind: "generated", operationId: identifier(raw.operationId, 512), modelId: identifier(raw.modelId),
      ...(raw.sourceVersionIds === undefined ? {} : { sourceVersionIds: Object.freeze((raw.sourceVersionIds as unknown[]).map(value => identifier(value))) }) });
  } else return invalid("INVALID_RESPONSE");
  // Copy the public immutable DTO. No storage IDs, URLs, tokens or private extras escape.
  return Object.freeze({ version: 1, assetId: identifier(value.assetId), versionId: identifier(value.versionId),
    assetVersion: value.assetVersion as number, contentHash: value.contentHash, sizeBytes: value.sizeBytes as number,
    mimeType: assetMime(value.mimeType), mediaKind: value.mediaKind as RuntimeAssetVersion["mediaKind"],
    ...(value.filename === undefined ? {} : { filename: assetFilename(value.filename) }),
    ...(value.deliveryExpiresAt === undefined ? {} : { deliveryExpiresAt: deliveryDeadline(value.deliveryExpiresAt) }), lineage });
}
/** Consume a response once and cancel at the first byte above the bound. No unbounded arrayBuffer()/text(). */
export async function boundedAssetBody(response: Response, maxBytes: number, signal: AbortSignal, oversizeCode = "ASSET_TOO_LARGE"): Promise<Uint8Array<ArrayBuffer>> {
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) {
    await response.body?.cancel().catch(() => {}); invalid("INVALID_RESPONSE");
  }
  if (length !== null && Number(length) > maxBytes) {
    await response.body?.cancel().catch(() => {}); invalid(oversizeCode);
  }
  if (!response.body) return new Uint8Array(0);
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0, done = false;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    for (;;) {
      if (signal.aborted) throw signal.reason;
      const result = await reader.read();
      if (signal.aborted) throw signal.reason;
      if (result.done) { done = true; break; }
      size += result.value.byteLength;
      if (size > maxBytes) invalid(oversizeCode);
      chunks.push(result.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally {
    signal.removeEventListener("abort", abort);
    if (!done) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function assetHttpError(response: Response, signal: AbortSignal): Promise<never> {
  let code = response.status === 401 ? "UNAUTHENTICATED" : response.status === 403 ? "FORBIDDEN"
    : response.status === 413 ? "ASSET_TOO_LARGE" : "ASSET_HTTP_ERROR";
  try {
    const value = object(JSON.parse(new TextDecoder().decode(await boundedAssetBody(response, 4096, signal, "INVALID_RESPONSE"))));
    if (typeof value.code === "string" && /^[A-Z][A-Z0-9_]{0,79}$/.test(value.code)) code = value.code;
  } catch { /* Arbitrary provider/HTTP diagnostics are never public. */ }
  throw new CortexRuntimeError(code, "uncertain");
}
export async function assetDigest(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
