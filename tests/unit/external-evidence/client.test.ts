import { describe, expect, it, jest } from "@jest/globals";
import { getFunctionName } from "convex/server";
import type { AuthTokenFetcher } from "convex/browser";
import { CortexRuntimeClient, RUNTIME_CHANGE_TYPES, RUNTIME_EXTERNAL_LIMITS } from "../../../src/client-runtime/index";
import type { RuntimeChangeEvent, RuntimeChangesPage, RuntimeClientPort, RuntimeExternalCapabilities,
  RuntimeExternalContentVersion, RuntimeExternalIngestResult, RuntimeExternalSourceInput, RuntimeSession } from "../../../src/client-runtime/index";

const scope = { tenantId: "tenant-a", memorySpaceId: "space-a" };
const actor: RuntimeSession = { version: 1, ...scope, principalId: "reader-a", userId: "user-a" };
const reference = { sourceId: "source-1", versionId: "version-1", externalRevision: 1 };
const sourceInput: RuntimeExternalSourceInput = { provider: "archive", externalSourceId: "message-1", externalEventId: "capture-1",
  externalRevision: 1, originalText: "church—time?\r\n e\u0301 😀", author: { id: "external-author", name: "Original author" },
  authoredAt: 10, editedAt: 20, observedAt: 30, provenance: { location: "archive://message-1", captureId: "archive-1" },
  metadata: { replyTo: "message-0" }, assetReferences: [], attribution: "unverified_external", extraction: "none" };
const source: RuntimeExternalContentVersion = { version: 1, kind: "content", scope, principalId: "source-owner",
  reference, provider: sourceInput.provider, externalSourceId: sourceInput.externalSourceId, originalText: sourceInput.originalText,
  originalContentHash: "a".repeat(64), normalizedContentHash: "b".repeat(64), author: sourceInput.author,
  authoredAt: sourceInput.authoredAt, editedAt: sourceInput.editedAt, metadata: sourceInput.metadata, assetReferences: [],
  attribution: "unverified_external", extraction: "none", capturedAt: 40, current: true, tombstoned: false };
function result(input = sourceInput, requestId = "batch-1", owner = actor.principalId): RuntimeExternalIngestResult {
  return { version: 1, receipt: { version: 1, receiptId: `receipt:${input.externalEventId}`, requestId, scope, principalId: owner,
    reference: { ...reference, externalRevision: input.externalRevision }, externalEventId: input.externalEventId, outcome: "created",
    observedAt: input.observedAt, capturedAt: 40, provenance: input.provenance, originalContentHash: "a".repeat(64) },
    readiness: { facts: "skipped", vectors: "pending", sourceRevision: 1, ingestionEventId: "ingestion-1", attempt: 0 } };
}
const event: RuntimeChangeEvent = { version: 1, eventId: "change-1", type: "source.revised", scope, principalId: source.principalId,
  source: reference, operationId: "receipt:captured", occurredAt: 40, current: false };
const changePage: RuntimeChangesPage = { version: 1, scope, principalId: actor.principalId, events: [event],
  nextCursor: "persistent-2", hasMore: false, watermark: "watermark-1", completeThroughWatermark: true };
const capability: RuntimeExternalCapabilities = { version: 1, scope, principalId: actor.principalId,
  externalSources: { version: 1, immutableVersions: true, originalTextRetrieval: true, exactTextSearch: "literal_case_sensitive_scan",
    attribution: ["unverified_external"], extraction: ["none"], maxBatchSources: 25, maxSourceBytes: 64_000,
    maxBatchBytes: 512_000, maxMetadataBytes: 8_000, maxAssetReferences: 16, maxPageSize: 10 },
  changes: { version: 1, durable: true, atomicPublication: true, opaqueCursors: true, maxPageSize: 100,
    retention: "until_policy_erasure", cursorExpiry: "explicit_invalidation_only" },
  largeAssets: { resumableUpload: false, rangeRetrieval: false, maxManagedBytes: 20_000_000, modelInputLimitsSeparate: true } };
const tombstoneInput = { sourceId: reference.sourceId, requestId: "delete-1", externalEventId: "delete-capture", externalRevision: 2,
  observedAt: 50, provenance: {}, reason: "Provider explicitly removed source" };
function fixture(options: { authenticated?: boolean; requestTimeoutMs?: number } = {}) {
  let current = actor, auth = (_authenticated: boolean) => {};
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const responses = new Map<string, (args: Record<string, unknown>) => unknown | Promise<unknown>>();
  responses.set("runtimeExternalSources:ingest", args => result(args.input as RuntimeExternalSourceInput, args.requestId as string));
  responses.set("runtimeExternalSources:get", args => ({ ...source, reference: { ...reference, versionId: args.versionId ?? reference.versionId }, current: args.versionId === undefined }));
  responses.set("runtimeExternalSources:history", () => ({ version: 1, scope, principalId: actor.principalId, sourceId: reference.sourceId,
    items: [result(sourceInput, "original-batch", source.principalId).receipt], nextCursor: null, hasMore: false }));
  responses.set("runtimeExternalSources:search", () => ({ version: 1, scope, principalId: actor.principalId, items: [source],
    nextCursor: null, hasMore: false, watermark: "scan-cutoff", completeThroughWatermark: true, match: "literal_case_sensitive" }));
  responses.set("runtimeExternalSources:status", () => result(sourceInput, "original-batch", source.principalId));
  responses.set("runtimeExternalSources:tombstone", () => {
    const captured = result(sourceInput, "original-delete-batch", source.principalId);
    const { originalContentHash: _hash, ...receipt } = captured.receipt;
    return { version: 1, receipt: { ...receipt, reference: { ...reference, versionId: "tombstone-2", externalRevision: 2 },
      externalEventId: tombstoneInput.externalEventId, outcome: "tombstoned", observedAt: 50, provenance: {} },
      readiness: { facts: "skipped", vectors: "not_requested" } };
  });
  responses.set("runtimeExternalSources:capabilities", () => capability);
  responses.set("runtimeChanges:list", () => changePage);
  const mutation = jest.fn(async (ref: Parameters<RuntimeClientPort["mutation"]>[0], args: Record<string, unknown>): Promise<unknown> => {
    const name = getFunctionName(ref); calls.push({ name, args });
    if (responses.has(name)) return await responses.get(name)!(args);
    if (name === "runtimeClient:session") return current;
    throw new Error("Unexpected RPC");
  });
  const port = { setAuth: (_fetch: AuthTokenFetcher, changed: (authenticated: boolean) => void) => {
    auth = changed; changed(options.authenticated ?? true);
  }, mutation, query: jest.fn(async () => { throw new Error("No public query expected"); }),
  action: jest.fn(async () => { throw new Error("No inference expected"); }), onUpdate: jest.fn(() => { throw new Error("No process observer expected"); }),
  close: jest.fn(async () => {}) } as unknown as RuntimeClientPort;
  const client = new CortexRuntimeClient({ deploymentUrl: "https://fixture.convex.cloud", client: port, fetchToken: async () => "opaque-host-jwt",
    scope, ...(options.requestTimeoutMs === undefined ? {} : { requestTimeoutMs: options.requestTimeoutMs }) });
  return { client, port, calls, responses, mutation, authenticate: (value: boolean) => auth(value), session: (value: RuntimeSession) => { current = value; },
    externalCalls: () => calls.filter(call => call.name !== "runtimeClient:session") };
}
const selectors = (fields: Record<string, unknown> = {}) => ({ ...scope, ...fields });
const inputAt = (index: number) => ({ ...sourceInput, externalEventId: `capture-${index}`, externalSourceId: `message-${index}` });

describe("managed external evidence client", () => {
  it("exports browser-facing contracts and frozen namespaces with bound methods", async () => {
    const f = fixture();
    try {
      expect(RUNTIME_EXTERNAL_LIMITS.maxBatchSources).toBe(25); expect(RUNTIME_CHANGE_TYPES).toContain("source.index.failed");
      expect(Object.isFrozen(f.client.sources)).toBe(true); expect(Object.isFrozen(f.client.changes)).toBe(true);
      const { get } = f.client.sources, { list } = f.client.changes;
      expect((await get({ sourceId: reference.sourceId })).kind).toBe("content");
      expect((await list()).nextCursor).toBe("persistent-2");
      expect(f.port.action).not.toHaveBeenCalled(); expect(f.port.query).not.toHaveBeenCalled(); expect(f.port.onUpdate).not.toHaveBeenCalled();
    } finally { await f.client.close(); }
  });
  it("dispatches each normalized source under verified selectors and preserves exact text, attribution and original replay batch", async () => {
    const f = fixture(), original = result(sourceInput, "original-batch");
    f.responses.set("runtimeExternalSources:ingest", () => original);
    try {
      const captured = await f.client.sources.ingest({ requestId: "retry-batch", sources: [sourceInput] });
      expect(captured).toEqual({ version: 1, requestId: "retry-batch", scope, principalId: actor.principalId,
        results: [{ index: 0, status: "accepted", result: original }] });
      expect(f.externalCalls()).toEqual([{ name: "runtimeExternalSources:ingest", args: selectors({ requestId: "retry-batch", input: sourceInput }) }]);
      expect(f.calls.map(call => call.name)).toEqual(["runtimeClient:session", "runtimeClient:session", "runtimeExternalSources:ingest", "runtimeClient:session", "runtimeClient:session"]);
    } finally { await f.client.close(); }
  });
  it("retains successes around explicit conflicts and uncertain transport failures, without automatic mutation retry", async () => {
    const f = fixture();
    f.responses.set("runtimeExternalSources:ingest", args => {
      const input = args.input as RuntimeExternalSourceInput;
      if (input.externalEventId === "capture-2") throw { data: { code: "IDEMPOTENCY_CONFLICT", outcome: "not_dispatched" } };
      if (input.externalEventId === "capture-3") throw new Error("PRIVATE_PROVIDER_DIAGNOSTIC");
      return result(input, args.requestId as string);
    });
    try {
      const value = await f.client.sources.ingest({ requestId: "partial", sources: [1, 2, 3, 4].map(inputAt) });
      expect(value.results.map(item => item.status)).toEqual(["accepted", "rejected", "rejected", "accepted"]);
      expect(value.results[1]).toEqual({ index: 1, status: "rejected", code: "IDEMPOTENCY_CONFLICT", outcome: "not_dispatched", retryable: false });
      expect(value.results[2]).toEqual({ index: 2, status: "rejected", code: "TRANSPORT_ERROR", outcome: "uncertain", retryable: true });
      expect(f.externalCalls()).toHaveLength(4); expect(JSON.stringify(value)).not.toContain("PRIVATE_PROVIDER_DIAGNOSTIC");
      const retry = await f.client.sources.ingest({ requestId: "new-batch", sources: [inputAt(1)] });
      expect(retry.results[0].status).toBe("accepted"); expect(f.externalCalls()).toHaveLength(5);
    } finally { await f.client.close(); }
  });
  it("validates the complete batch before session or source dispatch", async () => {
    const f = fixture();
    try {
      for (const input of [{ requestId: "bad", sources: [sourceInput, { ...sourceInput, extraction: "facts" }] },
        { requestId: "big", sources: Array(26).fill(sourceInput) }, { requestId: "sparse", sources: Array(1) }]) {
        await expect(f.client.sources.ingest(input as never)).rejects.toMatchObject({ code: "INVALID_INPUT", outcome: "not_dispatched" });
      }
      expect(f.calls).toEqual([]);
    } finally { await f.client.close(); }
  });
  it.each([
    { receipt: { ...result().receipt, scope: { ...scope, tenantId: "other" } } },
    { receipt: { ...result().receipt, principalId: "foreign" } },
    { receipt: { ...result().receipt, externalEventId: "wrong-event" } },
    { receipt: { ...result().receipt, reference: { ...reference, externalRevision: 2 } } },
    { readiness: { facts: "complete", vectors: "pending" } },
  ])("withholds malformed or misbound ingest response %# while preserving uncertain custody", async changes => {
    const f = fixture(); f.responses.set("runtimeExternalSources:ingest", () => ({ ...result(), ...changes }));
    try {
      const value = await f.client.sources.ingest({ requestId: "batch-1", sources: [sourceInput] });
      expect(value.results).toEqual([{ index: 0, status: "rejected", code: "INVALID_RESPONSE", outcome: "uncertain", retryable: true }]);
      expect(f.externalCalls()).toHaveLength(1);
    } finally { await f.client.close(); }
  });
  it("pins the batch actor and withholds the aggregate when a later mutation crosses a session change", async () => {
    const f = fixture();
    f.responses.set("runtimeExternalSources:ingest", args => {
      const input = args.input as RuntimeExternalSourceInput;
      if (input.externalEventId === "capture-2") f.session({ ...actor, principalId: "other-owner" });
      return result(input, args.requestId as string);
    });
    try {
      await expect(f.client.sources.ingest({ requestId: "pinned", sources: [1, 2, 3].map(inputAt) }))
        .rejects.toMatchObject({ code: "SESSION_CHANGED", outcome: "uncertain", retryable: true });
      expect(f.externalCalls()).toHaveLength(2);
    } finally { await f.client.close(); }
  });
  it.each([{ ...actor, principalId: "changed" }, { ...actor, tenantId: "changed" }, { ...actor, memorySpaceId: "changed" }])(
    "withholds earlier accepted receipts on a later actor/scope change and recovers by exact-event replay %#", async changed => {
      const f = fixture(), persisted = new Map<string, RuntimeExternalIngestResult>(); let sessions = 0;
      f.responses.set("runtimeExternalSources:ingest", args => {
        const input = args.input as RuntimeExternalSourceInput;
        if (!persisted.has(input.externalEventId)) persisted.set(input.externalEventId, result(input, args.requestId as string));
        return persisted.get(input.externalEventId)!;
      });
      // First receipt has passed its per-record delivery fence at session 3.
      f.responses.set("runtimeClient:session", () => ++sessions >= 4 ? changed : actor);
      try {
        await expect(f.client.sources.ingest({ requestId: "committed-before-change", sources: [1, 2].map(inputAt) }))
          .rejects.toMatchObject({ code: "SESSION_CHANGED", outcome: "uncertain", retryable: true });
        expect(persisted.size).toBe(1); expect(f.externalCalls()).toHaveLength(1);
        f.responses.delete("runtimeClient:session");
        const replay = await f.client.sources.ingest({ requestId: "recovered-batch", sources: [1, 2].map(inputAt) });
        expect(replay.results.map(item => item.status)).toEqual(["accepted", "accepted"]); expect(persisted.size).toBe(2);
        expect(replay.results[0]).toMatchObject({ status: "accepted", result: { receipt: { requestId: "committed-before-change", externalEventId: "capture-1" } } });
        expect(f.externalCalls()).toHaveLength(3);
      } finally { await f.client.close(); }
    });
  it("withholds an earlier receipt whose delivery deadline expires while a later record runs", async () => {
    const f = fixture(); let now = 1_000; const clock = jest.spyOn(Date, "now").mockImplementation(() => now);
    const persisted = new Map<string, RuntimeExternalIngestResult>();
    f.responses.set("runtimeExternalSources:ingest", args => {
      const input = args.input as RuntimeExternalSourceInput, value = result(input, args.requestId as string);
      if (input.externalEventId === "capture-1") value.deliveryExpiresAt = 1_010;
      else now = 1_011;
      persisted.set(input.externalEventId, value); return value;
    });
    try {
      await expect(f.client.sources.ingest({ requestId: "expires-during-batch", sources: [1, 2].map(inputAt) }))
        .rejects.toMatchObject({ code: "AUTHORITY_EXPIRED", outcome: "uncertain", retryable: true });
      expect(persisted.size).toBe(2); expect(f.externalCalls()).toHaveLength(2);
    } finally { clock.mockRestore(); await f.client.close(); }
  });
  it("withholds earlier accepted receipts after a later auth revocation and replays committed events without duplicate effects", async () => {
    const f = fixture(), persisted = new Map<string, RuntimeExternalIngestResult>(); let revoke = true;
    f.responses.set("runtimeExternalSources:ingest", args => {
      const input = args.input as RuntimeExternalSourceInput;
      if (input.externalEventId === "capture-2" && revoke) { f.authenticate(false); throw { data: { code: "FORBIDDEN", outcome: "not_dispatched" } }; }
      if (!persisted.has(input.externalEventId)) persisted.set(input.externalEventId, result(input, args.requestId as string));
      return persisted.get(input.externalEventId)!;
    });
    try {
      await expect(f.client.sources.ingest({ requestId: "before-revocation", sources: [1, 2].map(inputAt) }))
        .rejects.toMatchObject({ code: "UNAUTHENTICATED", outcome: "uncertain", retryable: true });
      expect(persisted.size).toBe(1); expect(f.externalCalls()).toHaveLength(2);
      revoke = false; await f.client.refreshAuth();
      const replay = await f.client.sources.ingest({ requestId: "after-recovery", sources: [1, 2].map(inputAt) });
      expect(replay.results.map(item => item.status)).toEqual(["accepted", "accepted"]); expect(persisted.size).toBe(2);
      expect(replay.results[0]).toMatchObject({ status: "accepted", result: { receipt: { requestId: "before-revocation" } } });
      expect(f.externalCalls()).toHaveLength(4);
    } finally { await f.client.close(); }
  });
  it("bounds an uncertain source mutation without cancelling or redispatching it", async () => {
    const f = fixture({ requestTimeoutMs: 10 }); f.responses.set("runtimeExternalSources:ingest", () => new Promise(() => {}));
    try {
      const value = await f.client.sources.ingest({ requestId: "timeout", sources: [sourceInput] });
      expect(value.results).toEqual([{ index: 0, status: "rejected", code: "RPC_DEADLINE_EXCEEDED", outcome: "uncertain", retryable: true }]);
      expect(f.externalCalls()).toHaveLength(1);
    } finally { await f.client.close(); }
  });
  it("gets current and selected immutable bodies under current scope while allowing shared ownership", async () => {
    const f = fixture();
    try {
      expect(await f.client.sources.get({ sourceId: reference.sourceId })).toEqual(source);
      expect(await f.client.sources.get({ sourceId: reference.sourceId, versionId: "historical-1" })).toMatchObject({ principalId: "source-owner", current: false,
        reference: { sourceId: reference.sourceId, versionId: "historical-1" } });
      expect(f.externalCalls()).toEqual([{ name: "runtimeExternalSources:get", args: selectors({ sourceId: reference.sourceId }) },
        { name: "runtimeExternalSources:get", args: selectors({ sourceId: reference.sourceId, versionId: "historical-1" }) }]);
    } finally { await f.client.close(); }
  });
  it.each([
    { ...source, scope: { ...scope, memorySpaceId: "other" } }, { ...source, reference: { ...reference, sourceId: "wrong" } },
    { ...source, current: false }, { ...source, attribution: "user_assertion" },
  ])("rejects wrong source identity, scope or attribution %#", async response => {
    const f = fixture(); f.responses.set("runtimeExternalSources:get", () => response);
    try { await expect(f.client.sources.get({ sourceId: reference.sourceId })).rejects.toMatchObject({ code: "INVALID_RESPONSE" }); }
    finally { await f.client.close(); }
  });
  it("gets metadata-only logical tombstones and exact retained version selectors", async () => {
    const f = fixture(); f.responses.set("runtimeExternalSources:get", () => ({ version: 1, kind: "tombstone", scope, principalId: "source-owner",
      reference: { ...reference, versionId: "tombstone-2", externalRevision: 2 }, provider: "archive", externalSourceId: "message-1", capturedAt: 50,
      current: true, tombstoned: true, reason: "Removed" }));
    try {
      const value = await f.client.sources.get({ sourceId: reference.sourceId }); expect(value.kind).toBe("tombstone"); expect(value).not.toHaveProperty("originalText");
      await expect(f.client.sources.get({ sourceId: reference.sourceId, versionId: "other-version" })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    } finally { await f.client.close(); }
  });
  it("pages shared observation history and validates the requested source, page limit and reader", async () => {
    const f = fixture();
    try {
      const value = await f.client.sources.history({ sourceId: reference.sourceId, after: "history-checkpoint", limit: 1 });
      expect(value.items[0].principalId).toBe("source-owner"); expect(value.principalId).toBe(actor.principalId);
      expect(f.externalCalls()).toEqual([{ name: "runtimeExternalSources:history", args: selectors({ sourceId: reference.sourceId, after: "history-checkpoint", limit: 1 }) }]);
      f.responses.set("runtimeExternalSources:history", () => ({ ...value, principalId: "other-reader" }));
      await expect(f.client.sources.history({ sourceId: reference.sourceId })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
      f.responses.set("runtimeExternalSources:history", () => ({ ...value, items: [value.items[0], value.items[0]] }));
      await expect(f.client.sources.history({ sourceId: reference.sourceId, limit: 1 })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    } finally { await f.client.close(); }
  });
  it("searches literal originals with fixed opaque progress and shared owners; empty intermediate pages remain valid", async () => {
    const f = fixture();
    try {
      const value = await f.client.sources.search({ literal: "—time?\r\n", includeHistory: true, after: "scan-1", limit: 1 });
      expect(value.items[0].originalText).toBe(sourceInput.originalText);
      expect(f.externalCalls()).toEqual([{ name: "runtimeExternalSources:search", args: selectors({ literal: "—time?\r\n", includeHistory: true, after: "scan-1", limit: 1 }) }]);
      f.responses.set("runtimeExternalSources:search", () => ({ ...value, items: [], nextCursor: "scan-2", hasMore: true, completeThroughWatermark: false }));
      expect(await f.client.sources.search({ literal: "absent" })).toMatchObject({ items: [], hasMore: true, nextCursor: "scan-2", completeThroughWatermark: false });
    } finally { await f.client.close(); }
  });
  it.each([
    { item: { ...source, originalText: "does not contain the literal" } }, { item: { ...source, current: false } },
    { item: { ...source, scope: { ...scope, tenantId: "other" } } }, { item: { ...source, tombstoned: true } },
  ])("withholds false literal matches, unauthorized history or malformed nested search scope %#", async ({ item }) => {
    const f = fixture(); f.responses.set("runtimeExternalSources:search", () => ({ version: 1, scope, principalId: actor.principalId, items: [item],
      nextCursor: null, hasMore: false, watermark: "cutoff", completeThroughWatermark: true, match: "literal_case_sensitive" }));
    try { await expect(f.client.sources.search({ literal: "church" })).rejects.toMatchObject({ code: "INVALID_RESPONSE" }); }
    finally { await f.client.close(); }
  });
  it("reads immutable shared receipts with fresh readiness and rejects substituted receipt IDs", async () => {
    const f = fixture(), expected = result(sourceInput, "original-batch", "source-owner");
    try {
      expect(await f.client.sources.status(expected.receipt.receiptId)).toEqual(expected);
      expect(f.externalCalls()).toEqual([{ name: "runtimeExternalSources:status", args: selectors({ receiptId: expected.receipt.receiptId }) }]);
      await expect(f.client.sources.status("different-receipt")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    } finally { await f.client.close(); }
  });
  it("sends explicit tombstones and accepts the original receipt batch/other owner under a shared write grant", async () => {
    const f = fixture();
    try {
      const value = await f.client.sources.tombstone(tombstoneInput);
      expect(value.receipt).toMatchObject({ requestId: "original-delete-batch", principalId: "source-owner", outcome: "tombstoned", externalEventId: "delete-capture" });
      expect(f.externalCalls()).toEqual([{ name: "runtimeExternalSources:tombstone", args: selectors(tombstoneInput) }]);
      f.responses.set("runtimeExternalSources:tombstone", () => result());
      await expect(f.client.sources.tombstone(tombstoneInput)).rejects.toMatchObject({ code: "INVALID_RESPONSE", outcome: "uncertain" });
    } finally { await f.client.close(); }
  });
  it("replays durable change pages through ordinary RPCs with canonical filters and exact checkpoint preservation", async () => {
    const f = fixture();
    try {
      const value = await f.client.changes.list({ after: "persisted-before-restart", limit: 1, types: ["source.revised", "source.created"] });
      expect(value).toEqual(changePage);
      expect(f.externalCalls()).toEqual([{ name: "runtimeChanges:list", args: selectors({ after: "persisted-before-restart", limit: 1, types: ["source.created", "source.revised"] }) }]);
      expect(f.port.onUpdate).not.toHaveBeenCalled();
      f.responses.set("runtimeChanges:list", () => ({ ...changePage, events: [{ ...event, type: "source.tombstoned" }] }));
      await expect(f.client.changes.list({ types: ["source.revised"] })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
      f.responses.set("runtimeChanges:list", () => ({ ...changePage, events: [event, { ...event, eventId: "change-2" }] }));
      await expect(f.client.changes.list({ limit: 1 })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    } finally { await f.client.close(); }
  });
  it("checks authenticated installed capabilities and fails closed on legacy refusal or unknown transport", async () => {
    const f = fixture();
    try {
      expect(await f.client.capabilities()).toEqual(capability);
      expect(f.externalCalls()).toEqual([{ name: "runtimeExternalSources:capabilities", args: selectors() }]);
      f.responses.set("runtimeExternalSources:capabilities", () => { throw { data: { code: "CAPABILITY_UNAVAILABLE", outcome: "not_dispatched" } }; });
      await expect(f.client.capabilities()).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
      f.responses.set("runtimeExternalSources:capabilities", () => { throw new Error("Could not find public function: runtimeExternalSources:capabilities"); });
      await expect(f.client.capabilities()).rejects.toMatchObject({ code: "TRANSPORT_ERROR", outcome: "uncertain" });
      f.responses.set("runtimeExternalSources:capabilities", () => ({ ...capability, principalId: "other-reader" }));
      await expect(f.client.capabilities()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    } finally { await f.client.close(); }
  });
  it("rejects all malformed requests before RPC and honors client closure across the full new public surface", async () => {
    const f = fixture();
    try {
      const invalid = [() => f.client.sources.get({ sourceId: "" }), () => f.client.sources.history({ sourceId: "source", limit: 11 }),
        () => f.client.sources.search({ literal: "" }), () => f.client.sources.status(""),
        () => f.client.sources.tombstone({ ...tombstoneInput, externalRevision: 0 }), () => f.client.changes.list({ limit: 101 })];
      for (const call of invalid) await expect(call()).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(f.calls).toEqual([]);
      await f.client.close();
      const closed = [() => f.client.sources.ingest({ requestId: "batch", sources: [sourceInput] }), () => f.client.sources.get({ sourceId: reference.sourceId }),
        () => f.client.sources.history({ sourceId: reference.sourceId }), () => f.client.sources.search({ literal: "church" }),
        () => f.client.sources.status("receipt"), () => f.client.sources.tombstone(tombstoneInput), () => f.client.changes.list(), () => f.client.capabilities()];
      for (const call of closed) await expect(call()).rejects.toMatchObject({ code: "CLIENT_CLOSED" });
      expect(f.calls).toEqual([]); expect(f.port.close).not.toHaveBeenCalled();
    } finally { await f.client.close(); }
  });
  it("withholds expired source and nested search delivery and suppresses results after authorization changes", async () => {
    const f = fixture(); f.responses.set("runtimeExternalSources:get", () => ({ ...source, deliveryExpiresAt: Date.now() - 1 }));
    try { await expect(f.client.sources.get({ sourceId: reference.sourceId })).rejects.toMatchObject({ code: "AUTHORITY_EXPIRED" }); }
    finally { await f.client.close(); }
    const nested = fixture(); nested.responses.set("runtimeExternalSources:search", () => ({ version: 1, scope, principalId: actor.principalId,
      items: [{ ...source, deliveryExpiresAt: Date.now() - 1 }], nextCursor: null, hasMore: false, watermark: "cutoff", completeThroughWatermark: true, match: "literal_case_sensitive" }));
    try { await expect(nested.client.sources.search({ literal: "church" })).rejects.toMatchObject({ code: "AUTHORITY_EXPIRED" }); }
    finally { await nested.client.close(); }
    const changed = fixture(); changed.responses.set("runtimeExternalSources:get", () => { changed.session({ ...actor, tenantId: "other" }); return source; });
    try { await expect(changed.client.sources.get({ sourceId: reference.sourceId })).rejects.toMatchObject({ code: "SESSION_CHANGED", outcome: "uncertain" }); }
    finally { await changed.client.close(); }
  });
  it("does not dispatch a protected method after authentication denial", async () => {
    const f = fixture({ authenticated: false });
    try {
      await expect(f.client.sources.get({ sourceId: reference.sourceId })).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
      await expect(f.client.capabilities()).rejects.toMatchObject({ code: "UNAUTHENTICATED" }); expect(f.calls).toEqual([]);
    } finally { await f.client.close(); }
  });
});
