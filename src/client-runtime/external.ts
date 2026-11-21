/** Versioned, browser-safe external evidence contracts. IDs and labels never grant authority. */
import type { RuntimeAssetReference, RuntimeEmbeddingProfile, RuntimeScope } from "./types.js";
import { deliveryDeadline, identifier, invalid, natural, object } from "./validation.js";
import { runtimeEmbeddingProfile } from "./extensions.js";

export const RUNTIME_EXTERNAL_LIMITS = Object.freeze({ maxBatchSources: 25, maxSourceBytes: 64_000,
  maxMetadataBytes: 8_000, maxBatchBytes: 512_000, maxAssetReferences: 16, maxPageSize: 10,
  maxChangePageSize: 100, maxLiteralBytes: 1_024, maxScanRows: 100 });
export type RuntimeExternalJson = null | boolean | number | string | RuntimeExternalJson[] | { [key: string]: RuntimeExternalJson };
export interface RuntimeExternalAuthor { id: string; name?: string }
export interface RuntimeExternalProvenance { location?: string; captureId?: string; metadata?: Readonly<Record<string, RuntimeExternalJson>> }
export interface RuntimeExternalSourceInput {
  provider: string; externalSourceId: string; externalEventId: string;
  /** Adapter-assigned positive safe integer; orders revisions independently of capture time. */
  externalRevision: number; providerRevision?: string; originalText: string;
  author: RuntimeExternalAuthor; authoredAt?: number; editedAt?: number; observedAt: number;
  provenance: RuntimeExternalProvenance; metadata?: Readonly<Record<string, RuntimeExternalJson>>;
  assetReferences?: RuntimeAssetReference[];
  /** This v1 contract deliberately has no extraction opt-in. */
  attribution: "unverified_external"; extraction: "none";
}
export interface RuntimeExternalIngestInput { requestId: string; sources: RuntimeExternalSourceInput[] }
export interface RuntimeExternalSourceReference { sourceId: string; versionId: string; externalRevision: number }
export type RuntimeExternalOutcome = "created" | "revised" | "unchanged" | "historical" | "tombstoned";
/** Immutable admission projection. A replay returns this exact original receipt. */
export interface RuntimeExternalReceipt {
  version: 1; receiptId: string; requestId: string; scope: RuntimeScope; principalId: string;
  reference: RuntimeExternalSourceReference; externalEventId: string; outcome: RuntimeExternalOutcome;
  observedAt: number; capturedAt: number; provenance: RuntimeExternalProvenance;
  /** Exact UTF-8 body hash, absent for tombstone-only observations. */
  originalContentHash?: string;
}
export type RuntimeExternalVectorState = "pending" | "running" | "complete" | "failed" | "unknown" | "dead_letter" | "not_current" | "not_requested";
export interface RuntimeExternalReadiness {
  facts: "skipped"; vectors: RuntimeExternalVectorState;
  /** Pipeline lineage may be reused by a newer unchanged custody revision. */
  sourceRevision?: number; ingestionEventId?: string; profile?: RuntimeEmbeddingProfile; attempt?: number; failureCode?: string;
}
export interface RuntimeExternalIngestResult { version: 1; receipt: RuntimeExternalReceipt; readiness: RuntimeExternalReadiness; deliveryExpiresAt?: number }
export type RuntimeExternalBatchItem =
  | { index: number; status: "accepted"; result: RuntimeExternalIngestResult }
  | { index: number; status: "rejected"; code: string; outcome: "not_dispatched" | "uncertain"; retryable: boolean };
export interface RuntimeExternalBatchResult {
  version: 1; requestId: string; scope: RuntimeScope; principalId: string; results: RuntimeExternalBatchItem[];
}
export interface RuntimeExternalGetInput { sourceId: string; versionId?: string }
export interface RuntimeExternalVersionBase {
  version: 1; scope: RuntimeScope; principalId: string; reference: RuntimeExternalSourceReference;
  provider: string; externalSourceId: string;
  capturedAt: number; current: boolean; tombstoned: boolean; deliveryExpiresAt?: number;
}
export interface RuntimeExternalContentVersion extends RuntimeExternalVersionBase {
  kind: "content"; providerRevision?: string; originalText: string;
  originalContentHash: string; normalizedContentHash: string; author: RuntimeExternalAuthor;
  authoredAt?: number; editedAt?: number; metadata?: Readonly<Record<string, RuntimeExternalJson>>;
  assetReferences: RuntimeAssetReference[]; attribution: "unverified_external"; extraction: "none";
}
export interface RuntimeExternalTombstoneVersion extends RuntimeExternalVersionBase { kind: "tombstone"; reason?: string }
export type RuntimeExternalSourceVersion = RuntimeExternalContentVersion | RuntimeExternalTombstoneVersion;
/** History enumerates every observation, including distinct captures of an unchanged version. */
export interface RuntimeExternalHistoryInput { sourceId: string; after?: string; limit?: number }
export interface RuntimeExternalHistoryPage {
  version: 1; scope: RuntimeScope; principalId: string; sourceId: string; items: RuntimeExternalReceipt[];
  nextCursor: string | null; hasMore: boolean; deliveryExpiresAt?: number;
}
export interface RuntimeExternalSearchInput { literal: string; after?: string; limit?: number; includeHistory?: boolean }
export interface RuntimeExternalSearchPage {
  version: 1; scope: RuntimeScope; principalId: string; items: RuntimeExternalContentVersion[];
  nextCursor: string | null; hasMore: boolean; watermark: string; completeThroughWatermark: boolean;
  /** Search uses a bounded ordered index scan, not token-only candidates. Empty intermediate pages are valid. */
  match: "literal_case_sensitive"; deliveryExpiresAt?: number;
}
export interface RuntimeExternalTombstoneInput {
  sourceId: string; requestId: string; externalEventId: string; externalRevision: number; observedAt: number;
  provenance: RuntimeExternalProvenance; reason?: string;
}
export const RUNTIME_CHANGE_TYPES = ["source.created", "source.revised", "source.tombstoned", "source.index.ready", "source.index.failed"] as const;
export type RuntimeChangeType = typeof RUNTIME_CHANGE_TYPES[number];
/** Content-free envelope; source IDs remain subject to current per-resource authorization. */
export interface RuntimeChangeEvent {
  version: 1; eventId: string; type: RuntimeChangeType; scope: RuntimeScope; principalId: string;
  source: RuntimeExternalSourceReference; operationId: string; occurredAt: number;
  /** False for newly recorded out-of-order evidence; that evidence still receives an event. */
  current: boolean; receiptId?: string;
  stage?: "vectors"; attempt?: number; failureCode?: string;
  indexState?: "complete" | "failed" | "unknown" | "dead_letter";
}
export interface RuntimeChangesInput { after?: string; limit?: number; types?: RuntimeChangeType[] }
export interface RuntimeChangesPage {
  version: 1; scope: RuntimeScope; principalId: string; events: RuntimeChangeEvent[];
  /** Always returned, including an empty initial stream; save transactionally with consumer effects. */
  nextCursor: string; hasMore: boolean; watermark: string; completeThroughWatermark: boolean; deliveryExpiresAt?: number;
}
export interface RuntimeExternalCapabilities {
  version: 1; scope: RuntimeScope; principalId: string;
  externalSources: { version: 1; immutableVersions: true; originalTextRetrieval: true;
    exactTextSearch: "literal_case_sensitive_scan"; attribution: readonly ["unverified_external"]; extraction: readonly ["none"];
    maxBatchSources: number; maxSourceBytes: number; maxBatchBytes: number; maxMetadataBytes: number; maxAssetReferences: number; maxPageSize: number };
  changes: { version: 1; durable: true; atomicPublication: true; opaqueCursors: true; maxPageSize: number;
    retention: "until_policy_erasure"; cursorExpiry: "explicit_invalidation_only" };
  largeAssets: { resumableUpload: false; rangeRetrieval: false; maxManagedBytes: number; modelInputLimitsSeparate: true };
  deliveryExpiresAt?: number;
}

function exact(value: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  const row = object(value);
  if (required.some(key => !Object.prototype.hasOwnProperty.call(row, key)) || Object.keys(row).some(key => !required.includes(key) && !optional.includes(key))) invalid();
  return row;
}
function text(value: unknown, maximum: number, nonempty = false): string {
  if (typeof value !== "string" || nonempty && !value.length || new TextEncoder().encode(value).length > maximum
    || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) invalid();
  return value;
}
function positive(value: unknown): number { const n = natural(value); if (n < 1) invalid(); return n; }
function timestamp(value: unknown): number { const n = natural(value); if (n > 8.64e15) invalid(); return n; }
function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) invalid();
  const descriptors: Partial<PropertyDescriptorMap> = Object.getOwnPropertyDescriptors<object>(value);
  const lengthDescriptor = descriptors.length;
  if (!lengthDescriptor || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value)
    || lengthDescriptor.value < 0 || lengthDescriptor.value > maximum) invalid();
  const length = lengthDescriptor.value as number;
  // Counting keys alone permits a hole to be replaced by an unrelated property
  // (including an attacker-owned map method). Require every numeric data slot.
  if (Reflect.ownKeys(descriptors).length !== length + 1) invalid();
  const dense: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const key = String(index), descriptor = descriptors[key];
    if (!Object.prototype.hasOwnProperty.call(descriptors, key) || !descriptor || !("value" in descriptor)) invalid();
    dense.push(descriptor.value);
  }
  // Only fresh, dense arrays reach map/some/serialization below. Never invoke
  // methods, iterators or toJSON on the caller's original array.
  return dense;
}
function json(value: unknown, depth = 0): RuntimeExternalJson {
  if (depth > 8) invalid();
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return text(value, RUNTIME_EXTERNAL_LIMITS.maxMetadataBytes);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return array(value, 64).map(item => json(item, depth + 1));
  const row = object(value); if (Object.keys(row).length > 64) invalid();
  return Object.fromEntries(Object.keys(row).sort().map(key => [text(key, 256), json(row[key], depth + 1)]));
}
function metadata(value: unknown): Readonly<Record<string, RuntimeExternalJson>> {
  const result = json(object(value)) as Record<string, RuntimeExternalJson>;
  if (new TextEncoder().encode(JSON.stringify(result)).length > RUNTIME_EXTERNAL_LIMITS.maxMetadataBytes) invalid();
  return result;
}
function author(value: unknown): RuntimeExternalAuthor {
  const row = exact(value, ["id"], ["name"]);
  return { id: identifier(row.id, 512), ...(row.name === undefined ? {} : { name: text(row.name, 512) }) };
}
function provenance(value: unknown): RuntimeExternalProvenance {
  const row = exact(value, [], ["location", "captureId", "metadata"]);
  return { ...(row.location === undefined ? {} : { location: text(row.location, 2_048) }),
    ...(row.captureId === undefined ? {} : { captureId: identifier(row.captureId, 512) }),
    ...(row.metadata === undefined ? {} : { metadata: metadata(row.metadata) }) };
}
function assets(value: unknown): RuntimeAssetReference[] {
  return array(value, RUNTIME_EXTERNAL_LIMITS.maxAssetReferences).map(item => {
    const row = exact(item, ["assetId", "version"]); return { assetId: identifier(row.assetId, 512), version: positive(row.version) };
  });
}
function cursor(value: unknown): string { return identifier(value, 4_096); }
function pageLimit(value: unknown, maximum: number = RUNTIME_EXTERNAL_LIMITS.maxPageSize): number { const n = positive(value); if (n > maximum) invalid(); return n; }
function scope(value: unknown): RuntimeScope { const row = exact(value, ["tenantId", "memorySpaceId"]); return { tenantId: identifier(row.tenantId), memorySpaceId: identifier(row.memorySpaceId) }; }
function sameScope(a: RuntimeScope, b: RuntimeScope): boolean { return a.tenantId === b.tenantId && a.memorySpaceId === b.memorySpaceId; }
function hash(value: unknown): string { if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) invalid(); return value; }
function boolean(value: unknown): boolean { if (typeof value !== "boolean") invalid(); return value; }
function response<T>(parse: () => T): T { try { return parse(); } catch { return invalid("INVALID_RESPONSE"); } }
function deadline(row: Record<string, unknown>): { deliveryExpiresAt?: number } { return row.deliveryExpiresAt === undefined ? {} : { deliveryExpiresAt: deliveryDeadline(row.deliveryExpiresAt) }; }
function reference(value: unknown): RuntimeExternalSourceReference {
  const row = exact(value, ["sourceId", "versionId", "externalRevision"]);
  return { sourceId: identifier(row.sourceId, 512), versionId: identifier(row.versionId, 512), externalRevision: positive(row.externalRevision) };
}
export function externalSourceInput(value: unknown): RuntimeExternalSourceInput {
  const row = exact(value, ["provider", "externalSourceId", "externalEventId", "externalRevision", "originalText", "author", "observedAt", "provenance", "attribution", "extraction"],
    ["providerRevision", "authoredAt", "editedAt", "metadata", "assetReferences"]);
  if (row.attribution !== "unverified_external" || row.extraction !== "none") invalid();
  return { provider: identifier(row.provider, 128), externalSourceId: identifier(row.externalSourceId, 512), externalEventId: identifier(row.externalEventId, 512),
    externalRevision: positive(row.externalRevision), originalText: text(row.originalText, RUNTIME_EXTERNAL_LIMITS.maxSourceBytes), author: author(row.author),
    observedAt: timestamp(row.observedAt), provenance: provenance(row.provenance), attribution: "unverified_external", extraction: "none",
    ...(row.providerRevision === undefined ? {} : { providerRevision: identifier(row.providerRevision, 512) }),
    ...(row.authoredAt === undefined ? {} : { authoredAt: timestamp(row.authoredAt) }), ...(row.editedAt === undefined ? {} : { editedAt: timestamp(row.editedAt) }),
    ...(row.metadata === undefined ? {} : { metadata: metadata(row.metadata) }), ...(row.assetReferences === undefined ? {} : { assetReferences: assets(row.assetReferences) }) };
}
export function externalIngestInput(value: unknown): RuntimeExternalIngestInput {
  const row = exact(value, ["requestId", "sources"]), sources = array(row.sources, RUNTIME_EXTERNAL_LIMITS.maxBatchSources).map(externalSourceInput);
  if (!sources.length || new TextEncoder().encode(JSON.stringify(sources)).length > RUNTIME_EXTERNAL_LIMITS.maxBatchBytes) invalid();
  return { requestId: identifier(row.requestId, 128), sources };
}
export function externalGetInput(value: unknown): RuntimeExternalGetInput {
  const row = exact(value, ["sourceId"], ["versionId"]);
  return { sourceId: identifier(row.sourceId, 512), ...(row.versionId === undefined ? {} : { versionId: identifier(row.versionId, 512) }) };
}
export function externalHistoryInput(value: unknown): RuntimeExternalHistoryInput {
  const row = exact(value, ["sourceId"], ["after", "limit"]);
  return { sourceId: identifier(row.sourceId, 512), ...(row.after === undefined ? {} : { after: cursor(row.after) }), ...(row.limit === undefined ? {} : { limit: pageLimit(row.limit) }) };
}
export function externalSearchInput(value: unknown): RuntimeExternalSearchInput {
  const row = exact(value, ["literal"], ["after", "limit", "includeHistory"]);
  return { literal: text(row.literal, RUNTIME_EXTERNAL_LIMITS.maxLiteralBytes, true), ...(row.after === undefined ? {} : { after: cursor(row.after) }),
    ...(row.limit === undefined ? {} : { limit: pageLimit(row.limit) }), ...(row.includeHistory === undefined ? {} : { includeHistory: boolean(row.includeHistory) }) };
}
export function externalTombstoneInput(value: unknown): RuntimeExternalTombstoneInput {
  const row = exact(value, ["sourceId", "requestId", "externalEventId", "externalRevision", "observedAt", "provenance"], ["reason"]);
  return { sourceId: identifier(row.sourceId, 512), requestId: identifier(row.requestId, 128), externalEventId: identifier(row.externalEventId, 512),
    externalRevision: positive(row.externalRevision), observedAt: timestamp(row.observedAt), provenance: provenance(row.provenance),
    ...(row.reason === undefined ? {} : { reason: text(row.reason, 1_024) }) };
}
export function changesInput(value: unknown): RuntimeChangesInput {
  const row = exact(value, [], ["after", "limit", "types"]);
  const types = row.types === undefined ? undefined : array(row.types, RUNTIME_CHANGE_TYPES.length).map(item => {
    if (!RUNTIME_CHANGE_TYPES.includes(item as RuntimeChangeType)) invalid(); return item as RuntimeChangeType;
  });
  if (types && (!types.length || new Set(types).size !== types.length)) invalid();
  return { ...(row.after === undefined ? {} : { after: cursor(row.after) }), ...(row.limit === undefined ? {} : { limit: pageLimit(row.limit, RUNTIME_EXTERNAL_LIMITS.maxChangePageSize) }),
    ...(types === undefined ? {} : { types: [...types].sort() }) };
}
function receipt(value: unknown): RuntimeExternalReceipt {
  const row = exact(value, ["version", "receiptId", "requestId", "scope", "principalId", "reference", "externalEventId", "outcome", "observedAt", "capturedAt", "provenance"], ["originalContentHash"]);
  if (row.version !== 1 || !["created", "revised", "unchanged", "historical", "tombstoned"].includes(row.outcome as string)) invalid();
  if ((row.outcome === "tombstoned") !== (row.originalContentHash === undefined)) invalid();
  return { version: 1, receiptId: identifier(row.receiptId, 512), requestId: identifier(row.requestId, 128), scope: scope(row.scope), principalId: identifier(row.principalId), reference: reference(row.reference),
    externalEventId: identifier(row.externalEventId, 512), outcome: row.outcome as RuntimeExternalOutcome, observedAt: timestamp(row.observedAt), capturedAt: timestamp(row.capturedAt), provenance: provenance(row.provenance),
    ...(row.originalContentHash === undefined ? {} : { originalContentHash: hash(row.originalContentHash) }) };
}
function readiness(value: unknown): RuntimeExternalReadiness {
  const row = exact(value, ["facts", "vectors"], ["sourceRevision", "ingestionEventId", "profile", "attempt", "failureCode"]);
  if (row.facts !== "skipped" || !["pending", "running", "complete", "failed", "unknown", "dead_letter", "not_current", "not_requested"].includes(row.vectors as string)) invalid();
  return { facts: "skipped", vectors: row.vectors as RuntimeExternalVectorState,
    ...(row.sourceRevision === undefined ? {} : { sourceRevision: positive(row.sourceRevision) }), ...(row.ingestionEventId === undefined ? {} : { ingestionEventId: identifier(row.ingestionEventId, 512) }),
    ...(row.profile === undefined ? {} : { profile: runtimeEmbeddingProfile(row.profile) }), ...(row.attempt === undefined ? {} : { attempt: natural(row.attempt) }),
    ...(row.failureCode === undefined ? {} : { failureCode: identifier(row.failureCode, 128) }) };
}
export function externalIngestResult(value: unknown): RuntimeExternalIngestResult {
  return response(() => { const row = exact(value, ["version", "receipt", "readiness"], ["deliveryExpiresAt"]); if (row.version !== 1) invalid();
    return { version: 1, receipt: receipt(row.receipt), readiness: readiness(row.readiness), ...deadline(row) }; });
}
function sourceVersion(value: unknown): RuntimeExternalSourceVersion {
  const discriminator = object(value);
  const base = ["version", "kind", "scope", "principalId", "reference", "provider", "externalSourceId", "capturedAt", "current", "tombstoned"];
  if (discriminator.kind === "tombstone") {
    const row = exact(value, base, ["reason", "deliveryExpiresAt"]);
    if (row.version !== 1 || row.tombstoned !== true) invalid();
    return { version: 1, kind: "tombstone", scope: scope(row.scope), principalId: identifier(row.principalId), reference: reference(row.reference), provider: identifier(row.provider, 128), externalSourceId: identifier(row.externalSourceId, 512),
      capturedAt: timestamp(row.capturedAt), current: boolean(row.current), tombstoned: true, ...(row.reason === undefined ? {} : { reason: text(row.reason, 1_024) }), ...deadline(row) };
  }
  const row = exact(value, [...base, "originalText", "originalContentHash", "normalizedContentHash", "author", "assetReferences", "attribution", "extraction"],
    ["providerRevision", "authoredAt", "editedAt", "metadata", "deliveryExpiresAt"]);
  if (row.version !== 1 || row.kind !== "content" || row.attribution !== "unverified_external" || row.extraction !== "none") invalid();
  return { version: 1, kind: "content", scope: scope(row.scope), principalId: identifier(row.principalId), reference: reference(row.reference), provider: identifier(row.provider, 128), externalSourceId: identifier(row.externalSourceId, 512),
    originalText: text(row.originalText, RUNTIME_EXTERNAL_LIMITS.maxSourceBytes), originalContentHash: hash(row.originalContentHash), normalizedContentHash: hash(row.normalizedContentHash), author: author(row.author),
    assetReferences: assets(row.assetReferences), attribution: "unverified_external", extraction: "none", capturedAt: timestamp(row.capturedAt), current: boolean(row.current), tombstoned: boolean(row.tombstoned),
    ...(row.providerRevision === undefined ? {} : { providerRevision: identifier(row.providerRevision, 512) }), ...(row.authoredAt === undefined ? {} : { authoredAt: timestamp(row.authoredAt) }),
    ...(row.editedAt === undefined ? {} : { editedAt: timestamp(row.editedAt) }), ...(row.metadata === undefined ? {} : { metadata: metadata(row.metadata) }), ...deadline(row) };
}
export function externalSourceVersion(value: unknown): RuntimeExternalSourceVersion { return response(() => sourceVersion(value)); }
export function externalHistoryPage(value: unknown): RuntimeExternalHistoryPage {
  return response(() => { const row = exact(value, ["version", "scope", "principalId", "sourceId", "items", "nextCursor", "hasMore"], ["deliveryExpiresAt"]);
    if (row.version !== 1 || boolean(row.hasMore) !== (row.nextCursor !== null)) invalid();
    const sourceId = identifier(row.sourceId, 512), items = array(row.items, RUNTIME_EXTERNAL_LIMITS.maxPageSize).map(receipt);
    if (items.some(item => item.reference.sourceId !== sourceId || !sameScope(item.scope, scope(row.scope)))) invalid();
    return { version: 1, scope: scope(row.scope), principalId: identifier(row.principalId), sourceId, items, nextCursor: row.nextCursor === null ? null : cursor(row.nextCursor), hasMore: row.hasMore as boolean, ...deadline(row) }; });
}
export function externalSearchPage(value: unknown): RuntimeExternalSearchPage {
  return response(() => { const row = exact(value, ["version", "scope", "principalId", "items", "nextCursor", "hasMore", "watermark", "completeThroughWatermark", "match"], ["deliveryExpiresAt"]);
    if (row.version !== 1 || row.match !== "literal_case_sensitive" || boolean(row.hasMore) !== (row.nextCursor !== null) || boolean(row.completeThroughWatermark) === row.hasMore) invalid();
    const items = array(row.items, RUNTIME_EXTERNAL_LIMITS.maxPageSize).map(sourceVersion);
    if (items.some(item => item.kind !== "content" || item.tombstoned || !sameScope(item.scope, scope(row.scope)))) invalid();
    return { version: 1, scope: scope(row.scope), principalId: identifier(row.principalId), items: items as RuntimeExternalContentVersion[], nextCursor: row.nextCursor === null ? null : cursor(row.nextCursor), hasMore: row.hasMore as boolean,
      watermark: cursor(row.watermark), completeThroughWatermark: row.completeThroughWatermark as boolean, match: "literal_case_sensitive", ...deadline(row) }; });
}
function changeEvent(value: unknown): RuntimeChangeEvent {
  const row = exact(value, ["version", "eventId", "type", "scope", "principalId", "source", "operationId", "occurredAt", "current"], ["receiptId", "stage", "attempt", "failureCode", "indexState"]);
  if (row.version !== 1 || !RUNTIME_CHANGE_TYPES.includes(row.type as RuntimeChangeType)) invalid();
  const indexing = row.type === "source.index.ready" || row.type === "source.index.failed";
  if (indexing && (row.stage !== "vectors" || row.attempt === undefined || row.indexState === undefined) || !indexing && [row.stage, row.attempt, row.failureCode, row.indexState].some(v => v !== undefined)) invalid();
  if (row.type === "source.index.ready" && row.indexState !== "complete" || row.type === "source.index.failed" && !["failed", "unknown", "dead_letter"].includes(row.indexState as string)) invalid();
  return { version: 1, eventId: identifier(row.eventId, 512), type: row.type as RuntimeChangeType, scope: scope(row.scope), principalId: identifier(row.principalId), source: reference(row.source), operationId: identifier(row.operationId, 512), occurredAt: timestamp(row.occurredAt), current: boolean(row.current),
    ...(row.receiptId === undefined ? {} : { receiptId: identifier(row.receiptId, 512) }), ...(indexing ? { stage: "vectors" as const, attempt: natural(row.attempt), indexState: row.indexState as RuntimeChangeEvent["indexState"] } : {}),
    ...(row.failureCode === undefined ? {} : { failureCode: identifier(row.failureCode, 128) }) };
}
export function changesPage(value: unknown): RuntimeChangesPage {
  return response(() => { const row = exact(value, ["version", "scope", "principalId", "events", "nextCursor", "hasMore", "watermark", "completeThroughWatermark"], ["deliveryExpiresAt"]);
    if (row.version !== 1 || boolean(row.completeThroughWatermark) === boolean(row.hasMore)) invalid();
    const events = array(row.events, RUNTIME_EXTERNAL_LIMITS.maxChangePageSize).map(changeEvent);
    if (new Set(events.map(event => event.eventId)).size !== events.length || events.some(event => !sameScope(event.scope, scope(row.scope)))) invalid();
    return { version: 1, scope: scope(row.scope), principalId: identifier(row.principalId), events, nextCursor: cursor(row.nextCursor), hasMore: row.hasMore as boolean,
      watermark: cursor(row.watermark), completeThroughWatermark: row.completeThroughWatermark as boolean, ...deadline(row) }; });
}
export function externalCapabilities(value: unknown): RuntimeExternalCapabilities {
  return response(() => { const row = exact(value, ["version", "scope", "principalId", "externalSources", "changes", "largeAssets"], ["deliveryExpiresAt"]), sources = object(row.externalSources), changes = object(row.changes), large = object(row.largeAssets);
    const attribution = array(sources.attribution, 1), extraction = array(sources.extraction, 1);
    if (row.version !== 1 || sources.version !== 1 || sources.immutableVersions !== true || sources.originalTextRetrieval !== true || sources.exactTextSearch !== "literal_case_sensitive_scan"
      || attribution.length !== 1 || attribution[0] !== "unverified_external" || extraction.length !== 1 || extraction[0] !== "none"
      || changes.version !== 1 || changes.durable !== true || changes.atomicPublication !== true || changes.opaqueCursors !== true || changes.retention !== "until_policy_erasure" || changes.cursorExpiry !== "explicit_invalidation_only"
      || large.resumableUpload !== false || large.rangeRetrieval !== false || large.modelInputLimitsSeparate !== true) invalid();
    return { version: 1, scope: scope(row.scope), principalId: identifier(row.principalId), externalSources: { version: 1, immutableVersions: true, originalTextRetrieval: true, exactTextSearch: "literal_case_sensitive_scan", attribution: ["unverified_external"], extraction: ["none"],
      maxBatchSources: positive(sources.maxBatchSources), maxSourceBytes: positive(sources.maxSourceBytes), maxBatchBytes: positive(sources.maxBatchBytes), maxMetadataBytes: positive(sources.maxMetadataBytes), maxAssetReferences: positive(sources.maxAssetReferences), maxPageSize: positive(sources.maxPageSize) },
      changes: { version: 1, durable: true, atomicPublication: true, opaqueCursors: true, maxPageSize: positive(changes.maxPageSize), retention: "until_policy_erasure", cursorExpiry: "explicit_invalidation_only" },
      largeAssets: { resumableUpload: false, rangeRetrieval: false, maxManagedBytes: positive(large.maxManagedBytes), modelInputLimitsSeparate: true }, ...deadline(row) }; });
}
