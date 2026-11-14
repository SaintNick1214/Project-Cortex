import { describe, expect, it } from "@jest/globals";
import {
  RUNTIME_EXTERNAL_LIMITS, changesInput, changesPage, externalCapabilities, externalGetInput,
  externalHistoryInput, externalHistoryPage, externalIngestInput, externalIngestResult,
  externalSearchInput, externalSearchPage, externalSourceInput, externalSourceVersion, externalTombstoneInput,
} from "../../../src/client-runtime/external";

const scope = { tenantId: "tenant-a", memorySpaceId: "space-a" };
const ref = { sourceId: "source-1", versionId: "version-1", externalRevision: 1 };
const input = { provider: "archive", externalSourceId: "message-1", externalEventId: "capture-1", externalRevision: 1,
  originalText: "A church—time?\r\nExact α text.", author: { id: "author-1", name: "Original Author" },
  authoredAt: 10, editedAt: 20, observedAt: 30, provenance: { location: "archive://message-1", captureId: "capture-1", metadata: { raw: [1, true, null] } },
  metadata: { replyTo: "parent-1" }, assetReferences: [{ assetId: "asset-a", version: 1 }], attribution: "unverified_external" as const, extraction: "none" as const };
const receipt = { version: 1 as const, receiptId: "receipt-1", requestId: "original-batch", scope, principalId: "owner-a", reference: ref,
  externalEventId: "capture-1", outcome: "created" as const, observedAt: 30, capturedAt: 40, provenance: input.provenance, originalContentHash: "a".repeat(64) };
const result = { version: 1 as const, receipt, readiness: { facts: "skipped" as const, vectors: "pending" as const, sourceRevision: 1, ingestionEventId: "ingestion-1", attempt: 0 } };
const source = { version: 1 as const, kind: "content" as const, scope, principalId: "owner-a", reference: ref, provider: input.provider,
  externalSourceId: input.externalSourceId, originalText: input.originalText, originalContentHash: "a".repeat(64), normalizedContentHash: "b".repeat(64),
  author: input.author, authoredAt: 10, editedAt: 20, metadata: input.metadata, assetReferences: input.assetReferences, attribution: input.attribution,
  extraction: input.extraction, capturedAt: 40, current: true, tombstoned: false };
const tombstoneInput = { sourceId: "source-1", requestId: "delete-1", externalEventId: "deletion-capture", externalRevision: 2, observedAt: 50, provenance: {}, reason: "Source removed" };
const event = { version: 1 as const, eventId: "event-1", type: "source.revised" as const, scope, principalId: "owner-a", source: ref, operationId: "receipt-1", occurredAt: 40, current: false };
const capability = { version: 1, scope, principalId: "reader-a", externalSources: { version: 1, immutableVersions: true, originalTextRetrieval: true,
  exactTextSearch: "literal_case_sensitive_scan", attribution: ["unverified_external"], extraction: ["none"], ...Object.fromEntries(["maxBatchSources", "maxSourceBytes", "maxBatchBytes", "maxMetadataBytes", "maxAssetReferences", "maxPageSize"].map(key => [key, RUNTIME_EXTERNAL_LIMITS[key as keyof typeof RUNTIME_EXTERNAL_LIMITS]])) },
  changes: { version: 1, durable: true, atomicPublication: true, opaqueCursors: true, maxPageSize: 100, retention: "until_policy_erasure", cursorExpiry: "explicit_invalidation_only" },
  largeAssets: { resumableUpload: false, rangeRetrieval: false, maxManagedBytes: 20_000_000, modelInputLimitsSeparate: true } };

describe("external evidence public contracts", () => {
  it("preserves exact original Unicode/newlines, authors, timestamps, provenance and immutable assets", () => {
    expect(externalSourceInput(input)).toEqual(input);
    expect(externalSourceInput({ ...input, originalText: "" }).originalText).toBe("");
    expect(externalIngestInput({ requestId: "batch-1", sources: [input] })).toEqual({ requestId: "batch-1", sources: [input] });
  });
  it.each([
    { ...input, externalRevision: 0 }, { ...input, externalRevision: Number.MAX_SAFE_INTEGER + 1 },
    { ...input, observedAt: -1 }, { ...input, editedAt: NaN }, { ...input, attribution: "user_assertion" },
    { ...input, extraction: "facts" }, { ...input, extra: true }, { ...input, originalText: "\ud800" },
    { ...input, originalText: "α".repeat(32_001) }, { ...input, metadata: { bad: undefined } },
    { ...input, metadata: { bad: Infinity } }, { ...input, metadata: { bad: new Date() } },
    { ...input, metadata: { bad: Array(2) } }, { ...input, metadata: { bad: "a".repeat(8_001) } },
    { ...input, assetReferences: [{ assetId: "asset", version: 0 }] },
  ])("rejects invalid source input %# without upgrading attribution", bad => {
    expect(() => externalSourceInput(bad)).toThrow("INVALID_INPUT");
  });
  it("rejects accessor metadata without invoking it, overdeep metadata, oversized and empty batches", () => {
    let reads = 0; const bad = Object.defineProperty({}, "secret", { enumerable: true, get() { reads++; return "bad"; } });
    expect(() => externalSourceInput({ ...input, metadata: bad })).toThrow("INVALID_INPUT"); expect(reads).toBe(0);
    let nested: unknown = "leaf"; for (let i = 0; i < 10; i++) nested = { next: nested };
    expect(() => externalSourceInput({ ...input, metadata: nested })).toThrow("INVALID_INPUT");
    expect(() => externalIngestInput({ requestId: "batch", sources: [] })).toThrow("INVALID_INPUT");
    expect(() => externalIngestInput({ requestId: "batch", sources: Array(26).fill(input) })).toThrow("INVALID_INPUT");
    expect(() => externalIngestInput({ requestId: "batch", sources: Array(9).fill({ ...input, originalText: "x".repeat(64_000) }) })).toThrow("INVALID_INPUT");
  });
  it("validates every read/tombstone/feed request and preserves opaque checkpoints", () => {
    expect(externalGetInput({ sourceId: ref.sourceId, versionId: ref.versionId })).toEqual({ sourceId: ref.sourceId, versionId: ref.versionId });
    expect(externalHistoryInput({ sourceId: ref.sourceId, after: "opaque", limit: 10 })).toEqual({ sourceId: ref.sourceId, after: "opaque", limit: 10 });
    expect(externalSearchInput({ literal: "—time?\r\n", after: "opaque", limit: 1, includeHistory: true })).toEqual({ literal: "—time?\r\n", after: "opaque", limit: 1, includeHistory: true });
    expect(externalTombstoneInput(tombstoneInput)).toEqual(tombstoneInput);
    expect(changesInput({ types: ["source.revised", "source.created"], limit: 100 })).toEqual({ types: ["source.created", "source.revised"], limit: 100 });
    const invalidInputs: [((value: unknown) => unknown), unknown][] = [
      [externalGetInput, { sourceId: "" }], [externalHistoryInput, { sourceId: "a", limit: 11 }],
      [externalSearchInput, { literal: "" }], [externalSearchInput, { literal: "a", includeHistory: "true" }],
      [externalTombstoneInput, { ...tombstoneInput, externalRevision: 0 }], [changesInput, { limit: 101 }],
      [changesInput, { types: ["source.created", "source.created"] }], [changesInput, { types: ["fact.created"] }],
    ];
    for (const [parse, value] of invalidInputs) expect(() => parse(value)).toThrow("INVALID_INPUT");
  });
  it("keeps admission immutable while permitting fresh readiness and original batch ID on replay", () => {
    expect(externalIngestResult(result)).toEqual(result);
    const completed = externalIngestResult({ ...result, readiness: { facts: "skipped", vectors: "complete", sourceRevision: 1, attempt: 1 } });
    expect(completed.receipt).toEqual(receipt); expect(completed.receipt.requestId).toBe("original-batch"); expect(completed.readiness.vectors).toBe("complete");
    expect(() => externalIngestResult({ ...result, readiness: { facts: "complete", vectors: "pending" } })).toThrow("INVALID_RESPONSE");
    expect(() => externalIngestResult({ ...result, receipt: { ...receipt, originalContentHash: "bad" } })).toThrow("INVALID_RESPONSE");
  });
  it("discriminates retained body and immutable tombstone versions without fabricating text", () => {
    expect(externalSourceVersion(source)).toEqual(source);
    const tombstone = { version: 1, kind: "tombstone", scope, principalId: "owner-a", reference: { ...ref, versionId: "tombstone-2", externalRevision: 2 }, provider: "archive", externalSourceId: "message-1", capturedAt: 50, current: true, tombstoned: true, reason: "Removed" };
    expect(externalSourceVersion(tombstone)).toEqual(tombstone);
    expect(() => externalSourceVersion({ ...tombstone, originalText: "old hidden content" })).toThrow("INVALID_RESPONSE");
    expect(() => externalSourceVersion({ ...source, extraction: "facts" })).toThrow("INVALID_RESPONSE");
    expect(() => externalSourceVersion({ ...source, originalContentHash: "bad" })).toThrow("INVALID_RESPONSE");
  });
  it("preserves shared-owner history but rejects cross-scope/source payloads and bad pagination", () => {
    const page = { version: 1, scope, principalId: "reader-a", sourceId: ref.sourceId, items: [receipt], nextCursor: null, hasMore: false };
    expect(externalHistoryPage(page)).toEqual(page);
    expect(() => externalHistoryPage({ ...page, items: [{ ...receipt, scope: { ...scope, tenantId: "other" } }] })).toThrow("INVALID_RESPONSE");
    expect(() => externalHistoryPage({ ...page, sourceId: "other" })).toThrow("INVALID_RESPONSE");
    expect(() => externalHistoryPage({ ...page, hasMore: true })).toThrow("INVALID_RESPONSE");
  });
  it("accepts empty incomplete literal-search pages and rejects false completeness or tombstone leakage", () => {
    const page = { version: 1, scope, principalId: "reader-a", items: [source], nextCursor: null, hasMore: false, watermark: "opaque-watermark", completeThroughWatermark: true, match: "literal_case_sensitive" };
    expect(externalSearchPage(page)).toEqual(page);
    expect(externalSearchPage({ ...page, items: [], nextCursor: "scan-2", hasMore: true, completeThroughWatermark: false }).items).toEqual([]);
    expect(() => externalSearchPage({ ...page, hasMore: true })).toThrow("INVALID_RESPONSE");
    expect(() => externalSearchPage({ ...page, items: [{ ...source, tombstoned: true }] })).toThrow("INVALID_RESPONSE");
    expect(() => externalSearchPage({ ...page, items: [{ ...source, scope: { ...scope, memorySpaceId: "other" } }] })).toThrow("INVALID_RESPONSE");
  });
  it("validates source/historical/index events, stable IDs, readiness and fixed watermark projections", () => {
    const page = { version: 1, scope, principalId: "reader-a", events: [event], nextCursor: "checkpoint", hasMore: false, watermark: "cutoff", completeThroughWatermark: true };
    expect(changesPage(page)).toEqual(page);
    const ready = { ...event, type: "source.index.ready", stage: "vectors", attempt: 2, indexState: "complete" };
    expect(changesPage({ ...page, events: [ready] }).events[0]).toEqual(ready);
    const failed = { ...event, type: "source.index.failed", stage: "vectors", attempt: 1, indexState: "unknown", failureCode: "PROVIDER_UNCERTAIN" };
    expect(changesPage({ ...page, events: [failed] }).events[0]).toEqual(failed);
    for (const bad of [{ ...page, events: [event, event] }, { ...page, hasMore: true },
      { ...page, events: [{ ...ready, attempt: undefined }] }, { ...page, events: [{ ...ready, indexState: "failed" }] },
      { ...page, events: [{ ...event, originalText: "should never appear" }] }, { ...page, events: [{ ...event, scope: { ...scope, tenantId: "other" } }] }]) {
      expect(() => changesPage(bad)).toThrow("INVALID_RESPONSE");
    }
  });
  it("advertises P0/P1 capabilities while keeping large transport and model limits separate", () => {
    expect(externalCapabilities(capability)).toEqual(capability);
    expect(() => externalCapabilities({ ...capability, largeAssets: { ...capability.largeAssets, resumableUpload: true } })).toThrow("INVALID_RESPONSE");
    expect(() => externalCapabilities({ ...capability, changes: { ...capability.changes, atomicPublication: false } })).toThrow("INVALID_RESPONSE");
    expect(() => externalCapabilities({ ...capability, externalSources: { ...capability.externalSources, maxSourceBytes: 0 } })).toThrow("INVALID_RESPONSE");
  });
  it("rejects capability tuple masquerades, sparse arrays and accessors without invoking callbacks", () => {
    let calls = 0;
    const masquerade = { toJSON() { calls++; return ["unverified_external"]; } };
    const accessor = Object.defineProperty(["unverified_external"], "0", { enumerable: true, get() { calls++; return "unverified_external"; } });
    const decorated = Object.assign(["none"], { toJSON() { calls++; return ["none"]; } });
    for (const [key, value] of [["attribution", masquerade], ["attribution", accessor], ["attribution", Array(1)], ["extraction", decorated], ["extraction", []]] as const) {
      expect(() => externalCapabilities({ ...capability, externalSources: { ...capability.externalSources, [key]: value } })).toThrow("INVALID_RESPONSE");
    }
    expect(calls).toBe(0);
  });
  it("rejects sparse arrays with distractor properties or custom methods across every array boundary", () => {
    let callbacks = 0;
    const distractor = () => Object.assign(Array(1), { extra: true });
    const customMap = () => Object.assign(Array(1), { map() { callbacks++; return []; } });
    const accessor = () => Object.defineProperty(Array(1), "0", { enumerable: true, get() { callbacks++; return input; } });
    const iterator = () => Object.assign(Array(1), { [Symbol.iterator]() { callbacks++; return [input][Symbol.iterator](); } });
    const history = { version: 1, scope, principalId: "reader-a", sourceId: ref.sourceId, items: [receipt], nextCursor: null, hasMore: false };
    const search = { version: 1, scope, principalId: "reader-a", items: [source], nextCursor: null, hasMore: false, watermark: "watermark", completeThroughWatermark: true, match: "literal_case_sensitive" };
    const changes = { version: 1, scope, principalId: "reader-a", events: [event], nextCursor: "cursor", hasMore: false, watermark: "watermark", completeThroughWatermark: true };
    for (const malformed of [distractor, customMap, accessor, iterator]) {
      const inputCases: [((value: unknown) => unknown), unknown][] = [
        [externalIngestInput, { requestId: "batch", sources: malformed() }],
        [externalSourceInput, { ...input, assetReferences: malformed() }],
        [externalSourceInput, { ...input, metadata: { values: malformed() } }],
        [externalSourceInput, { ...input, provenance: { metadata: { values: malformed() } } }],
        [changesInput, { types: malformed() }],
      ];
      for (const [parse, bad] of inputCases) expect(() => parse(bad)).toThrow("INVALID_INPUT");
      const outputCases: [((value: unknown) => unknown), unknown][] = [
        [externalSourceVersion, { ...source, assetReferences: malformed() }],
        [externalHistoryPage, { ...history, items: malformed() }],
        [externalSearchPage, { ...search, items: malformed() }],
        [changesPage, { ...changes, events: malformed() }],
        [externalCapabilities, { ...capability, externalSources: { ...capability.externalSources, attribution: malformed() } }],
        [externalCapabilities, { ...capability, externalSources: { ...capability.externalSources, extraction: malformed() } }],
      ];
      for (const [parse, bad] of outputCases) expect(() => parse(bad)).toThrow("INVALID_RESPONSE");
    }
    class CustomArray extends Array<unknown> {}
    expect(() => externalIngestInput({ requestId: "batch", sources: CustomArray.of(input) })).toThrow("INVALID_INPUT");
    expect(callbacks).toBe(0);
  });
  it("enforces documented identifier and original-text limits as UTF-8 bytes", () => {
    expect(externalSourceInput({ ...input, provider: "α".repeat(64), externalSourceId: "α".repeat(256) }).provider).toBe("α".repeat(64));
    expect(() => externalSourceInput({ ...input, provider: "α".repeat(65) })).toThrow("INVALID_INPUT");
    expect(() => externalSourceInput({ ...input, externalSourceId: "α".repeat(257) })).toThrow("INVALID_INPUT");
    expect(externalSourceInput({ ...input, originalText: "α".repeat(32_000) }).originalText).toHaveLength(32_000);
    expect(() => externalIngestInput({ requestId: "α".repeat(65), sources: [input] })).toThrow("INVALID_INPUT");
  });
});
