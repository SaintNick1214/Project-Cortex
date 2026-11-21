# External evidence v1: API contract

P0/P1 are implemented. Public TypeScript types and validation exports are declared in the shipped [`dist/client-runtime/index.d.ts`](../dist/client-runtime/index.d.ts). The managed client export is `@cortexmemory/sdk/runtime`. Consumers must query the authenticated backend capability response before using these additions. Implementation and package qualification do not configure or deploy an application's backend.

## Public surface

```ts
client.sources.ingest(input: RuntimeExternalIngestInput): Promise<RuntimeExternalBatchResult>;
client.sources.get(input: RuntimeExternalGetInput): Promise<RuntimeExternalSourceVersion>;
client.sources.history(input: RuntimeExternalHistoryInput): Promise<RuntimeExternalHistoryPage>;
client.sources.search(input: RuntimeExternalSearchInput): Promise<RuntimeExternalSearchPage>;
client.sources.status(receiptId: string): Promise<RuntimeExternalIngestResult>;
client.sources.tombstone(input: RuntimeExternalTombstoneInput): Promise<RuntimeExternalIngestResult>;
client.changes.list(input?: RuntimeChangesInput): Promise<RuntimeChangesPage>;
client.capabilities(): Promise<RuntimeExternalCapabilities>;
```

RPC registrations: `runtimeExternalSources:ingest`, `get`, `history`, `search`, `status`, `tombstone`, `capabilities`; `runtimeChanges:list`. The batch is an SDK convenience over independently atomic ingestion mutations with arguments `{requestId,input}`. Other methods pass their normalized input fields with the existing trusted session scope selectors. `status` passes `receiptId`. Labels supplied by a caller never choose the principal or grant access.

```ts
interface RuntimeExternalSourceInput {
  provider: string;
  externalSourceId: string;
  externalEventId: string;
  externalRevision: number; // positive safe integer assigned by the adapter
  providerRevision?: string; // optional opaque provider label
  originalText: string;
  author: { id: string; name?: string };
  authoredAt?: number;
  editedAt?: number;
  observedAt: number;
  provenance: { location?: string; captureId?: string; metadata?: Record<string, RuntimeExternalJson> };
  metadata?: Record<string, RuntimeExternalJson>;
  assetReferences?: { assetId: string; version: number }[];
  attribution: "unverified_external";
  extraction: "none";
}
interface RuntimeExternalIngestInput { requestId: string; sources: RuntimeExternalSourceInput[] }
interface RuntimeExternalSourceReference { sourceId: string; versionId: string; externalRevision: number }
interface RuntimeExternalGetInput { sourceId: string; versionId?: string }
interface RuntimeExternalHistoryInput { sourceId: string; after?: string; limit?: number }
interface RuntimeExternalSearchInput { literal: string; after?: string; limit?: number; includeHistory?: boolean }
interface RuntimeChangesInput { after?: string; limit?: number; types?: RuntimeChangeType[] }
```

All source IDs are scoped to tenant, memory space, owning principal, provider and external source ID. Observation IDs are scoped to tenant, space, owning principal and provider. A provider event ID reused for a different source or changed observation payload fails with `IDEMPOTENCY_CONFLICT`. No global cross-tenant external ID uniqueness is implied.

`receipt.principalId`, a returned source version's `principalId`, and an event's `principalId` identify the owning principal. A history/search/change/capability/batch envelope's `principalId` identifies the authenticated reader. A current space grant may read another owner's evidence; an own grant cannot. Clients check scope throughout but must not reject legitimate shared reads merely because source owner differs from reader.

## Example intake and receipts

```json
{
  "requestId": "archive-import-2026-11-13-page-1",
  "sources": [{
    "provider": "discord",
    "externalSourceId": "channel-002/message-123",
    "externalEventId": "capture-2026-11-13/message-123",
    "externalRevision": 1,
    "originalText": "Could the church indicate a time?\r\nThis is only a proposal.",
    "author": {"id": "author-42", "name": "Archive author"},
    "authoredAt": 1760000000000,
    "observedAt": 1794596400000,
    "provenance": {"location": "discord://channel-002/message-123", "captureId": "capture-2026-11-13"},
    "metadata": {"replyToExternalSourceId": "channel-002/message-100"},
    "assetReferences": [],
    "attribution": "unverified_external",
    "extraction": "none"
  }]
}
```

```ts
interface RuntimeExternalReceipt {
  version: 1; receiptId: string; requestId: string;
  scope: RuntimeScope; principalId: string;
  reference: RuntimeExternalSourceReference;
  externalEventId: string;
  outcome: "created" | "revised" | "unchanged" | "historical" | "tombstoned";
  observedAt: number; capturedAt: number;
  provenance: RuntimeExternalProvenance;
  originalContentHash?: string; // absent for a tombstone
}
interface RuntimeExternalIngestResult {
  version: 1; receipt: RuntimeExternalReceipt;
  readiness: {
    facts: "skipped";
    vectors: "pending" | "running" | "complete" | "failed" | "unknown" |
      "dead_letter" | "not_current" | "not_requested";
    sourceRevision?: number; ingestionEventId?: string;
    profile?: RuntimeEmbeddingProfile; attempt?: number; failureCode?: string;
  };
  deliveryExpiresAt?: number;
}
```

A batch returns `{version:1,requestId,scope,principalId,results}`. Every ordered result has either `{index,status:"accepted",result:RuntimeExternalIngestResult}` or `{index,status:"rejected",code,outcome:"not_dispatched"|"uncertain",retryable}`. A successful capture means custody committed, not that vectors are ready. `sources.status(receiptId)` returns the immutable admission receipt plus fresh readiness; indexing may finish or fail later. The receipt's `outcome`, IDs, timestamps and original batch `requestId` never change on replay. Authorization delivery deadlines belong to the outer response and can change.

`requestId` correlates the batch; it is not the source deduplication key. Retry a failed or uncertain record with the exact same `externalEventId` and payload. Retrying under another batch request ID returns its original admission receipt. No SDK mutation is blindly retried, no source is inferred deleted from an absent export, and failure of a later record does not roll back earlier accepted records.

The SDK validates the complete batch shape and byte limits before dispatch; a malformed envelope is rejected without writes. Backend per-record failures, such as revision conflicts, are reported individually alongside preceding successful records, subject to the final delivery check below.

Before returning a batch that contains accepted records, the SDK performs a final fresh session/actor check and rechecks every accepted response's delivery deadline. If that check cannot complete, authority changes, or a deadline expires while later records run, the entire delivery rejects with `outcome:"uncertain"` and `retryable:true`; protected earlier receipts are withheld. Prior commits remain durable. After restoring authorization, retry the original records with their exact `externalEventId` and payload to recover receipts without duplicate ingestion. Ordinary per-record conflicts or transport failures still return ordered partial outcomes when final delivery remains authorized.

## Revision and observation semantics

`externalRevision` orders source revisions independently of `authoredAt`, `editedAt`, `observedAt` and server `capturedAt`. All times are nonnegative integer Unix milliseconds. The adapter is responsible for a stable monotonic revision sequence; Cortex does not sort provider labels or infer edits from capture time.

- A new source commits its first immutable version and a `created` receipt.
- A higher revision with meaningful changed content/author/source metadata/assets creates a new immutable version and becomes current (`revised`). The older body remains addressable by its `versionId`.
- A lower, previously unseen revision is retained (`historical`) without replacing current content. It generates `source.revised` with `current:false` because newly preserved historical evidence is still new evidence.
- Equal provider/source/revision with a different canonical source payload fails explicitly. The canonical source payload includes exact text, author, source timestamps, metadata, provider revision and immutable asset references. Capture provenance, observed time, observation ID and batch request ID are separate.
- A distinct capture of unchanged source evidence preserves a new observation/provenance receipt (`unchanged`), reuses the immutable content version if its external revision is unchanged, and does not re-embed or publish a semantic source-change event. An unchanged higher revision can have a new custody version while reusing the prior pipeline generation. Pipeline `sourceRevision` is consequently separate from external custody `externalRevision`.
- Empty or whitespace-only bodies are valid, for example attachment-only posts. Their exact bodies are retained with `vectors:"not_requested"`; removing all text retires the prior indexed generation.

`originalContentHash` is SHA-256 of the exact UTF-8 original text. `normalizedContentHash` applies to the separate normalized indexing text. Neither normalizing newlines nor Unicode nor whitespace changes the archived original. Authors remain external authors; they are never relabeled as the authenticated app user. All v1 sources are `external/unverified_external`, and fact extraction is skipped in the central domain eligibility rule as well as at intake. Vectors index evidence text; they do not make it authoritative user truth.

`sources.get({sourceId})` selects the current immutable custody version. `get({sourceId,versionId})` selects a precise retained version. Returned versions are discriminated by `kind:"content"|"tombstone"`; a content version includes original body/hashes/author/source metadata/assets, while a tombstone version has no body/hash/author and may have `reason`. Both carry scope, principal, immutable reference, capture time, `current`, `tombstoned` and optional delivery deadline. `history` enumerates observation receipts, including repeated captures; each receipt selects its exact immutable version through `reference.versionId`.

Asset references must resolve to existing immutable managed asset versions under current storage authorization. Referencing an asset grants no additional access, and source retrieval rechecks dependencies. This API does not upload arbitrary external URLs or treat them as trusted evidence automatically.

## Exact source-text search

`sources.search({literal,includeHistory:false})` matches the original string with case-sensitive literal substring semantics, without tokenization, Unicode normalization, case folding, regex or punctuation rewriting. `"church—time"` matches that exact substring, not `"church time"`. CRLF and LF are distinct. `includeHistory:true` also considers historical content versions; tombstoned sources are excluded from search in both modes.

The implementation scans a bounded ordered database index over accessible raw versions. It does not claim a token-only search index provides complete arbitrary substring retrieval. A page may have fewer than `limit` matches, or no matches, and still have `hasMore:true`; continue using `nextCursor`. Each call scans at most 100 rows and returns at most 10 bodies. The initial call captures an opaque watermark. Only `completeThroughWatermark:true` means that accessible snapshot has been fully examined. Concurrent new evidence belongs to the next fresh search. Current authorization can remove results during traversal; original body/history retrieval still rechecks access independently.

## Durable event and cursor schema

```ts
type RuntimeChangeType = "source.created" | "source.revised" | "source.tombstoned" |
  "source.index.ready" | "source.index.failed";
interface RuntimeChangeEvent {
  version: 1; eventId: string; type: RuntimeChangeType;
  scope: RuntimeScope; principalId: string;
  source: RuntimeExternalSourceReference;
  operationId: string; occurredAt: number; current: boolean; receiptId?: string;
  stage?: "vectors"; attempt?: number;
  indexState?: "complete" | "failed" | "unknown" | "dead_letter";
  failureCode?: string;
}
interface RuntimeChangesPage {
  version: 1; scope: RuntimeScope; principalId: string;
  events: RuntimeChangeEvent[]; nextCursor: string;
  hasMore: boolean; watermark: string; completeThroughWatermark: boolean;
  deliveryExpiresAt?: number;
}
```

```json
{
  "version": 1,
  "scope": {"tenantId": "hunt-tenant", "memorySpaceId": "eldoria"},
  "principalId": "importer-principal",
  "events": [{
    "version": 1, "eventId": "change:opaque-stable-id", "type": "source.revised",
    "scope": {"tenantId": "hunt-tenant", "memorySpaceId": "eldoria"},
    "principalId": "importer-principal",
    "source": {"sourceId": "external:opaque-source", "versionId": "version:opaque-2", "externalRevision": 2},
    "operationId": "receipt:opaque-2", "receiptId": "receipt:opaque-2",
    "occurredAt": 1794596400000, "current": true
  }],
  "nextCursor": "opaque-persistent-checkpoint",
  "hasMore": false,
  "watermark": "opaque-fixed-catch-up-boundary",
  "completeThroughWatermark": true
}
```

Source creation/revision/tombstone events commit in the same mutation as custody/current-pointer changes. Index events commit with the actual stage transition; they are distinct from capture. Index events require `stage:"vectors"`, an integer attempt, and `indexState`; failures carry only a sanitized failure code. No event carries original text, external IDs, authors or provenance. Repeated idempotent capture or a stage callback that does not change state must not create a new meaningful event identity. Failed attempts and later readiness are separately visible.

`changes.list({after,limit,types})` replays persisted events independently of observers or process lifetime. Event IDs are stable deduplication keys. Cursors are opaque persisted handles bound to tenant, space, principal, visibility and canonical filter. Save a cursor transactionally with the application effects/deduplication state. Reusing a cursor with changed scope/principal/filter/visibility fails explicitly; cursor possession never grants access. Unknown, invalidated or erased cursor state fails explicitly (`CURSOR_INVALID`, `CURSOR_SCOPE_CHANGED` or `CURSOR_EXPIRED`), never silently resets to the beginning.

The initial page fixes a catch-up watermark; intermediate pages retain it. `hasMore` means more accessible stream positions remain through that boundary. A final page's `completeThroughWatermark:true` certifies catch-up to that boundary, not vector readiness. Continuing from that returned cursor opens the next catch-up window so newly committed evidence is consumed. Empty pages still return a checkpoint. Own grants use owner-scoped progress; hidden owners' sequence numbers, activity and counts are not exposed through cursor/watermark/hasMore. Current grants and resource authorization are checked during every replay. Revoked/erased resource payloads cannot be recovered from old events.

Default source/event/cursor retention is until explicit policy erasure/invalidation; v1 adds no automatic timed expiry or pruning. There is no timestamp-only resume boundary, automatic cursor reset or guaranteed recovery after explicit erasure. Consumers that receive an invalidation must reconcile their own application state using current authorized sources before opening a fresh feed. Delivery deadlines protect a single response and are distinct from persistence retention.

This v1 feed covers the external-source API lifecycle only. Existing chat transcripts, assets and facts do not implicitly publish into this stream. Scope and owner streams are separate; an owner's cursor, watermark and `hasMore` do not change because another owner writes or erases evidence.

## Explicit tombstone and policy erasure

`sources.tombstone({sourceId,requestId,externalEventId,externalRevision,observedAt,provenance,reason?})` records a strictly newer immutable tombstone revision. It retires indexing/current search and emits one `source.tombstoned` event. A tombstone is never inferred from export absence and cannot be undone by ordinary ingestion. An unknown source or stale/conflicting tombstone revision is rejected. Exact tombstone replay returns its original receipt.

A logical tombstone preserves retained versions and observation history for authorized archival retrieval, with `tombstoned:true`. A trusted policy erasure is a separate executable cleanup that purges/redacts source bodies, observation provenance/canonical payloads and derived data, and leaves a minimal resurrection fence. Erased evidence is unavailable through get/history/search/status or feed replay, including old cursors. No ordinary client method can bypass erasure or restore it by using another observation ID.

Trusted deployment operators can invoke the internal `runtimeExternalErasure:eraseSource({tenantId,memorySpaceId,sourceId})`, then `continueSource` with the same selectors until `complete:true`. Scheduled continuations normally perform that work. The first mutation commits the delivery fence and invalidates affected catch-up cursors; physical cleanup proceeds in bounded steps. `runtimeAuth` source tombstones and principal/scope deletion also start this cleanup. `retireAuthority`/`continueAuthority` enumerate a retired principal or scope; their `fencedComplete` means enumeration is done, while individual source jobs report physical completion separately. These functions are internal, absent from the ordinary managed-client API, and require trusted operator access.

Erasure removes raw versions, observations/provenance, normalized text, chunks, vectors, processing receipt payloads and source-derived model request/proof/result payloads. It releases source asset retention edges without deleting unrelated asset ownership. Minimal hashes/IDs, fences, sequence state and financial liability/accounting scalars remain; late provider liability evidence can still be accounted, while private result delivery stays closed. Provider-side retention is outside Cortex's local erasure operation.

Declared dependencies follow evidence into managed Agent context (legacy and V8), tool results, generated assistant/tool transcript copies, content/media jobs and generated artifact versions. Registration commits with each private copy; model admission records its producer dependencies before binding the operation back to that producer. Dependencies retain exact source revisions and accumulate required permissions. Cleanup removes SDK context/input/output caches and generated media bytes, waits for issued Workflow work to release its payloads before removing its journal, and redacts only the affected generated artifact/transcript revisions. Independently authored user messages, later independent manual revisions, unrelated host/application records and original uploaded assets remain outside that cleanup. Minimal dependency/fence records survive to prevent late callbacks from reopening private storage or delivery. If a cleanup step fails or issued work has not completed, the source remains fenced and `complete` remains false; retry `continueSource` after correcting the storage/component failure. `complete:true` waits for dependent cleanup as well as original custody removal. Deployment telemetry, backups and provider retention remain governed by their owning platform policies.

External-dependent Agent generation disables the owning Agent library's automatic message saves and native stream-delta persistence. The managed public stream still uses Cortex's fenced output buffer. Final supported response messages and tool results are saved through a fresh guarded parent mutation: the component write, exact message IDs/hash pins and operation completion commit together. If erasure wins, that mutation writes no native message; if saving wins, cleanup can find the registered copy. Fresh context hydration refuses external-root growth before handing external text to a generation that began in the ordinary persistence mode.

That external-dependent response boundary accepts assistant text, reasoning and supported server-tool calls, and omits optional provider metadata. Model-generated file bodies are rejected before native file materialization. Media tools continue to use their separately tracked generated-asset lifecycle.

For retained native streams attached to an exact SDK-generated message position and agent, cleanup aborts the selected stream, drains bounded owning-component pages and removes its header/file references before deleting the message. Future scheduled garbage collection does not establish completion. The owning stream inventory is capped at 100; a capped inventory cannot prove an unseen exact stream absent, so cleanup stays incomplete. It also waits for an unrelated active generation at the same message order because the owning message-deletion API would otherwise abort that generation. Unrelated streams remain intact. Scheduled source continuations have a one-second delay, and trusted operators can resume explicitly with `continueSource`.

The dependency tables and optional markers are additive. Published 0.39.0 could not create supported external source lineage, so it has no supported external-root rows to backfill. An existing in-progress legacy/V8 Agent or job that first consumes new external evidence acquires dependency custody in the same mutation as context/history/tool/job registration or native admission. Ordinary authored-source behavior is unchanged. Cortex does not scan unrelated host records or infer dependencies by searching for matching text; application-owned exported copies have their own retention responsibilities.

Generated storage transfers are discovered by their trusted native model-operation lineage, including transfers that never reached media-job attachment. Their issued state remains durable until positive storage/terminal acknowledgement permits cleanup. Erasure refuses new generated writes after the source fence, removes acknowledged generated bytes and references in bounded steps, and preserves unrelated uploads. A cancelled job, elapsed lease or missing transport receipt alone does not prove that an issued write committed no bytes: unresolved transfers keep `complete:false` until storage reconciliation supplies a terminal acknowledgement. Erasure never retries inference or silently reissues the transfer.

Unverified evidence cannot become an authoritative user fact through an automatic model/tool path. An Agent with external evidence in its context, including inherited history/artifact context, receives `CAPABILITY_UNAVAILABLE` for `memory.remember` before that tool starts. Declared external-derived tool/assistant sources can still be indexed and recalled as evidence; their extraction/fact stages remain skipped, and fact model admission, fact commits, fact retrieval and graph projection reject promotion. An explicit independently authored user assertion or application review remains a separate authorized path.

For safe indexing failures, the existing authenticated `runtimeIngestion:retry` mutation takes `{eventId,stage:"vectors",tenantId?,memorySpaceId?}` and preserves the finite retry budget. This is an explicit recovery operation, not an automatic SDK ingestion retry. An `unknown` outcome requires native positive-result reconciliation and is never blindly dispatched again. Capture replay continues to return its original receipt while readiness evolves.

## Limits and capabilities

Limits are UTF-8 bytes: 25 records and 512,000 serialized source bytes per SDK batch; 64,000 original-text bytes per record; 8,000 bytes per metadata object; 16 asset references per record; 10 source/history results, 100 change events and 100 raw search scan rows per page; 1,024 bytes per search literal. IDs are bounded (provider 128, external IDs 512, batch request ID 128 bytes). Metadata must be JSON, finite numbers, maximum nesting 8, maximum 64 object keys/array entries; no accessors, sparse arrays, class instances or undefined values. Outer response validation also rejects malformed types and scopes.

Capability discovery requires a successful authenticated response. `CAPABILITY_UNAVAILABLE` is an explicit typed refusal. A legacy deployment without the registration may instead produce `TRANSPORT_ERROR`; that leaves support unresolved and is never converted into guessed capability flags. Authentication and unknown transport failures retain their existing error semantics.

```json
{
  "version": 1,
  "scope": {"tenantId": "hunt-tenant", "memorySpaceId": "eldoria"},
  "principalId": "importer-principal",
  "externalSources": {
    "version": 1, "immutableVersions": true, "originalTextRetrieval": true,
    "exactTextSearch": "literal_case_sensitive_scan",
    "attribution": ["unverified_external"], "extraction": ["none"],
    "maxBatchSources": 25, "maxSourceBytes": 64000, "maxBatchBytes": 512000,
    "maxMetadataBytes": 8000, "maxAssetReferences": 16, "maxPageSize": 10
  },
  "changes": {
    "version": 1, "durable": true, "atomicPublication": true, "opaqueCursors": true,
    "maxPageSize": 100, "retention": "until_policy_erasure", "cursorExpiry": "explicit_invalidation_only"
  },
  "largeAssets": {
    "resumableUpload": false, "rangeRetrieval": false,
    "maxManagedBytes": 20000000, "modelInputLimitsSeparate": true
  }
}
```

P2 is explicitly unshipped in this contract: the 122,182,087-byte stitched map exceeds the current managed asset cap. Preserve that original and its hash in application-owned custody; use existing immutable tiles and a versioned manifest initially. Storage transport capacity and individual model-input limits remain separate. Resumable/direct-storage upload and authenticated streaming/range delivery require their own implementation and qualification before either flag can become true.

The hunt application owns provider acquisition, reply/link interpretation, chain queries/snapshots, stale conclusions, hypotheses/review, notification outbox/delivery and puzzle acceptance. Cortex provides attributed custody, retrieval, processing readiness and durable generic changes.

## Distribution and qualification boundary

The accompanying [integration guide](external-evidence-integration.md) describes the local `0.40.0-external-evidence.0` tarball, digest verification and supported public CLI0.39 `backend install --sdk-path` route. The working monorepo remains0.39-compatible; the package receipt records its exact source delta and staging metadata/docs overlay. No package publication or production deployment is implied.

Actual local Convex HTTP transaction/persistence probes use controlled administrative identity impersonation. They do not certify JWT verification, hosted ANN, provider success/quality or provider retention. Exact-source custody/search does not depend on those services. Supported external-dependent generation avoids native streaming deltas; unsupported experimental retained streams with changed/deleted message identities require operator reconciliation. Arbitrary experimental-row migration/cleanup is outside this candidate's qualification.
