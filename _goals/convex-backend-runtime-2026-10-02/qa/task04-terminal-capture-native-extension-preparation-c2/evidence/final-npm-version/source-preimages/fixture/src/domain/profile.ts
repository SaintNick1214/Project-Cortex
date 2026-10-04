/** Immutable fresh-install profile qualified by Task 01. */
export interface EmbeddingProfile {
  readonly profileId: string;
  readonly modelId: string;
  readonly dimensions: number;
  readonly normalization: string;
  readonly chunking: string;
  readonly indexName: string;
}

export const DEFAULT_EMBEDDING_PROFILE: Readonly<EmbeddingProfile> = Object.freeze({
  profileId: "cortex-text-small-1536-v1",
  modelId: "openai/text-embedding-3-small",
  dimensions: 1536,
  normalization: "text-nfc-lf-v1",
  chunking: "codepoint-1600-overlap-200-v1",
  indexName: "by_default_embedding_v1",
});

export const DEFAULT_VECTOR_FILTER_FIELDS = Object.freeze([
  "tenantId", "memorySpaceId", "profileId",
] as const);

export function normalizeSourceText(text: string): string {
  const normalized = text.normalize("NFC").replace(/\r\n?/g, "\n").trim();
  if (!normalized) throw new Error("INVALID_INPUT: normalized text is empty");
  return normalized;
}

export function assertProfileMatches(
  actual: EmbeddingProfile,
  expected: EmbeddingProfile = DEFAULT_EMBEDDING_PROFILE,
): void {
  const fields = ["profileId", "modelId", "dimensions", "normalization", "chunking", "indexName"] as const;
  if (fields.some((field) => actual[field] !== expected[field])) {
    throw new Error("PROFILE_NOT_READY: embedding profile does not match the pinned profile");
  }
}

export function assertEmbeddingVector(
  vector: readonly number[],
  profile: EmbeddingProfile = DEFAULT_EMBEDDING_PROFILE,
): void {
  if (!Number.isSafeInteger(profile.dimensions) || profile.dimensions <= 0 ||
      !Array.isArray(vector) || vector.length !== profile.dimensions || Array.from(vector).some((coordinate) => !Number.isFinite(coordinate))) {
    throw new Error(`INVALID_INPUT: expected ${profile.dimensions} finite embedding coordinates`);
  }
}

/**
 * SHA-256 over UTF-8, available in browser and default Convex via WebCrypto.
 * Hashes are lookup keys, not authorization or proof of equality: repositories must
 * compare the canonical identity/content before reusing an idempotency receipt.
 * A collision is an IDEMPOTENCY_CONFLICT, never permission to overwrite another source.
 */
export async function semanticHash(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface TextWindow {
  ordinal: number;
  /** Offsets are Unicode code points in the complete normalized source. */
  start: number;
  end: number;
  text: string;
}

/** Source is already normalized; windows preserve internal and boundary whitespace. */
export function chunkNormalizedText(text: string): TextWindow[] {
  if (!text || normalizeSourceText(text) !== text) {
    throw new Error("INVALID_INPUT: chunking requires normalized source text");
  }
  const points = Array.from(text);
  const windows: TextWindow[] = [];
  for (let start = 0; start < points.length; start += 1400) {
    const end = Math.min(start + 1600, points.length);
    windows.push({ ordinal: windows.length, start, end, text: points.slice(start, end).join("") });
    if (end === points.length) break;
  }
  return windows;
}
