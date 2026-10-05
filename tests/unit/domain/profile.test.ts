import { describe, expect, it } from "@jest/globals";
import {
  assertEmbeddingVector, assertProfileMatches, chunkNormalizedText,
  DEFAULT_EMBEDDING_PROFILE, DEFAULT_VECTOR_FILTER_FIELDS, normalizeSourceText, semanticHash,
} from "../../../src/domain/index.js";

describe("fresh default text profile", () => {
  it("pins the qualified model, shape, index and trusted filters", () => {
    expect(DEFAULT_EMBEDDING_PROFILE).toEqual({
      profileId: "cortex-text-small-1536-v1", modelId: "openai/text-embedding-3-small", dimensions: 1536,
      normalization: "text-nfc-lf-v1", chunking: "codepoint-1600-overlap-200-v1", indexName: "by_default_embedding_v1",
    });
    expect(DEFAULT_VECTOR_FILTER_FIELDS).toEqual(["tenantId", "memorySpaceId", "profileId"]);
    expect(Object.isFrozen(DEFAULT_EMBEDDING_PROFILE)).toBe(true);
  });

  it("normalizes NFC and line endings, preserving internal whitespace and paragraphs", () => {
    expect(normalizeSourceText(" \tCafe\u0301\r\n  first\rsecond\n\nlast  \n")).toBe("Café\n  first\nsecond\n\nlast");
    expect(() => normalizeSourceText(" \r\n\t ")).toThrow("normalized text is empty");
  });

  it("chunks code points with exact 200 overlap without splitting astral characters", () => {
    const text = "A".repeat(1599) + "😀" + "B".repeat(1401);
    const chunks = chunkNormalizedText(text);
    expect(chunks.map(({ ordinal, start, end }) => ({ ordinal, start, end }))).toEqual([
      { ordinal: 0, start: 0, end: 1600 }, { ordinal: 1, start: 1400, end: 3000 }, { ordinal: 2, start: 2800, end: 3001 },
    ]);
    expect(chunks[0].text.endsWith("😀")).toBe(true);
    expect(Array.from(chunks[1].text).slice(0, 200)).toEqual(Array.from(chunks[0].text).slice(-200));
    expect(chunks[1].text).toContain("😀");
    expect(chunkNormalizedText("x".repeat(1600))).toHaveLength(1);
    expect(chunkNormalizedText("x".repeat(1601))).toHaveLength(2);
    expect(() => chunkNormalizedText("a\r\nb")).toThrow("normalized source text");
    expect(() => chunkNormalizedText("")).toThrow("normalized source text");
  });

  it("does not trim whitespace at internal chunk boundaries", () => {
    const chunks = chunkNormalizedText("x".repeat(1599) + " \n" + "y".repeat(100));
    expect(chunks[0].text.endsWith(" ")).toBe(true);
    expect(chunks[1].text).toContain(" \n");
  });

  it("rejects same-dimensional different profile/model/normalization/index provenance", () => {
    expect(assertProfileMatches({ ...DEFAULT_EMBEDDING_PROFILE })).toBeUndefined();
    for (const field of ["profileId", "modelId", "normalization", "chunking", "indexName"] as const) {
      expect(() => assertProfileMatches({ ...DEFAULT_EMBEDDING_PROFILE, [field]: "different" })).toThrow("PROFILE_NOT_READY");
    }
    expect(() => assertProfileMatches({ ...DEFAULT_EMBEDDING_PROFILE, dimensions: 768 })).toThrow("PROFILE_NOT_READY");
  });

  it("validates exact finite coordinates including sparse/nonfinite arrays", () => {
    expect(assertEmbeddingVector(Array<number>(1536).fill(0.1))).toBeUndefined();
    for (const vector of [[], [0.1], Array<number>(1536), Array<number>(1536).fill(NaN), Array<number>(1536).fill(Infinity)]) {
      expect(() => assertEmbeddingVector(vector)).toThrow("finite embedding coordinates");
    }
  });

  it("uses standard browser WebCrypto SHA-256 with deterministic canonical input", async () => {
    expect(await semanticHash("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(await semanticHash(normalizeSourceText(" Cafe\u0301\r\n"))).toBe(await semanticHash("Café"));
    expect(await semanticHash("one")).not.toBe(await semanticHash("two"));
  });
});
