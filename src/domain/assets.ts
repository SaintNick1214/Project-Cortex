/** Private immutable asset metadata. Binary bytes never enter transcript rows. */
export const ASSET_MAX_BYTES = 20_000_000;
export const ASSET_UPLOAD_LEASE_MS = 120_000;
export const ASSET_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "video/mp4", "video/webm", "audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4", "audio/webm", "application/pdf", "application/octet-stream", "application/json", "text/plain", "text/csv"] as const;
export type RuntimeAssetMediaKind = "image" | "video" | "audio" | "document" | "binary";
export type RuntimeAssetLineage = { kind: "upload"; requestId: string } | { kind: "generated"; operationId: string; modelId: string; sourceVersionIds?: string[] };
export interface RuntimeAssetVersion {
  version: 1; assetId: string; versionId: string; assetVersion: number; contentHash: string;
  sizeBytes: number; mimeType: string; mediaKind: RuntimeAssetMediaKind; filename?: string; lineage: RuntimeAssetLineage;
}
export type RuntimeAssetVersionV1 = RuntimeAssetVersion;
export interface RuntimeAssetReference { assetId: string; version: number }
export function assetMediaKind(mime: string): RuntimeAssetMediaKind {
  if (!ASSET_MIME_TYPES.includes(mime as typeof ASSET_MIME_TYPES[number])) throw new Error("INVALID_ASSET_METADATA");
  return mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : mime === "application/octet-stream" ? "binary" : "document";
}
export function assertAssetSize(size: number, cap = ASSET_MAX_BYTES): void {
  if (!Number.isSafeInteger(cap) || cap < 1 || cap > ASSET_MAX_BYTES || !Number.isSafeInteger(size) || size < 1) throw new Error("INVALID_ASSET_METADATA");
  if (size > cap) throw new Error("ASSET_TOO_LARGE");
}
export async function assetContentHash(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
}
/** Count actual streamed bytes, including responses with dishonest/no length. */
export async function readBoundedAsset(stream: ReadableStream<Uint8Array>, cap = ASSET_MAX_BYTES): Promise<Uint8Array<ArrayBuffer>> {
  assertAssetSize(1, cap);
  const reader = stream.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength;
      if (size > cap) { await reader.cancel(); throw new Error("ASSET_TOO_LARGE"); } chunks.push(next.value); }
    assertAssetSize(size, cap); const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } return bytes;
  } finally { reader.releaseLock(); }
}
