# Integrating external evidence v1

P0/P1 provide reusable external-evidence custody and durable changes. This guide covers backend integration and the independently qualified local `0.40.0-external-evidence.0` candidate. Public release versions are selected by the normal release pipeline; that local prerelease name does not reserve the next stable version. Consult the matching qualification receipt for exact package bytes and coverage. No application production deployment is configured by installing the SDK.

The public contract, limits, JSON examples and event schema are in [external-evidence.md](external-evidence.md). Import the managed client from `@cortexmemory/sdk/runtime`. Existing chat, agent, asset and graph APIs remain separate.

## Installation and safe upgrades

The local candidate is `@cortexmemory/sdk@0.40.0-external-evidence.0`, delivered as a tarball with its SHA-256, base revision, source patch and packaging-overlay receipt. It is not an npm registry release. Use Node >=24.15.0; qualification uses Node 24.20.0. Verify the artifact hash before installing it in the application.

The historical local candidate was assembled outside repository ancestry with a manifest/lock version overlay, an additive package allowlist entry for these two guides, and a rebuilt distribution manifest. Its receipt identifies the source delta and overlay; a bare base commit does not identify that package. Its recorded builder used Node24.20/npm11.19; the repository's declared npm version is a separate toolchain requirement.

For public releases, the release planner updates SDK, provider and CLI package versions and SDK dependency ranges together. The CLI's exact composer target follows its declared SDK dependency. Use the matching released SDK and CLI; the published CLI0.39 compatibility boundary below describes the local prerelease qualification, not future coordinated releases. CI/local release checks use the declared Node24.21/npm12.2 toolchain.

Install the candidate with npm's file path support, then use the published CLI's additive backend command:

```sh
npm install /absolute/path/cortexmemory-sdk-0.40.0-external-evidence.0.tgz
npx --package @cortexmemory/cli@0.39.0 cortex backend install . \
  --sdk-path ./node_modules/@cortexmemory/sdk --plan
```

Review the plan's dependencies and file changes, install its reported direct backend dependencies, and apply the same command without `--plan`. This operation composes source files; it does not provision a principal, register a deployment, run inference or deploy production. The backend manifest names the complete reserved Cortex table/module set. Keep application tables/modules in a separately owned namespace such as `hunt_*` and `hunt/*`.

**CLI compatibility boundary:** CLI 0.39.0's `cortex install`, `cortex init` candidate path and `cortex schema sync` validate an exact 0.39.0 SDK identity. They do not consume this prerelease. `cortex backend install --sdk-path` uses the digest-bound additive distribution and is the supported path qualified for this candidate. Do not rename a prerelease to 0.39.0 to bypass a version check.

For an owned backend already containing 0.39.0, changed managed files produce a merge proposal before any backend file is written. The installer does not silently replace those files, including with an overwrite flag. Review each conflict against the previous distribution's hash and the candidate's hash. Replace only unchanged Cortex-owned preimages that were explicitly reviewed; merge application edits separately. Preserve backups, then replan and reapply. Already-identical files make a partial installation resumable. Host tables, functions, JWT configuration, HTTP routes and other files must survive the upgrade.

The qualification scripts test this path with temporary hosts and public CLI bytes. A passing controlled installer fixture is separate from the final candidate's install/upgrade receipt. Existing 0.39 hosts do not require a table backfill: new tables/indexes and optional row markers are additive. Published 0.39 could not create supported external roots; there is no inferred migration of application-owned or experimental rows into external lineage.

## Identity, grants and processing policy

A trusted deployment operator must configure the host's JWT issuer, JWKS, algorithm and audience in the composed Convex authentication configuration. The JWT subject must match a currently provisioned Cortex principal. JWT labels, external authors and tenant/space selectors do not grant access.

The existing protected operator registrations are the bootstrap boundary:

- `runtimeAuth:provision` binds a verified issuer/subject to a principal, tenant membership and a current scoped grant. Its first-owner setup is an operator action, not a public self-service endpoint.
- External intake needs current `read` and `write` authority because it delivers its receipt through a read fence. Asset-bearing intake and reads additionally require current `storage:read` for every referenced version. Asset references retain immutable bytes but confer no access rights.
- Choose `resourceAccess:"own"` for private importer evidence or an explicit `space` grant when authorized readers should consume another principal's evidence. External author IDs remain distinct from the importer principal.
- `runtimeModelPolicy:installDeploymentPolicy` installs an approved manifest compiled into the backend; qualifications and budgets must match the selected operation/profile. Do not fabricate a qualification or weaken policy to force indexing readiness.

Actual JWT transport, first-owner provisioning and provider eligibility in Treasure Hunts production remain deployment-specific qualification. The local native test transport uses administrative identity impersonation to exercise real server-side grants and isolation; that does not certify the production JWT issuer or browser token handshake.

```ts
import { CortexRuntimeClient } from "@cortexmemory/sdk/runtime";

const client = new CortexRuntimeClient({
  deploymentUrl: configuration.convexUrl,
  scope: { tenantId: configuration.tenantId, memorySpaceId: configuration.memorySpaceId },
  fetchToken: async ({ forceRefreshToken }) => identityProvider.getToken({ forceRefresh: forceRefreshToken }),
});

const capabilities = await client.capabilities();
if (capabilities.externalSources.version !== 1 || !capabilities.changes.durable) {
  throw new Error("External evidence v1 is unavailable on the selected backend");
}
```

Capability discovery must succeed on the authenticated backend. A missing registration or transport failure is not evidence of support. The application does not need to manufacture a conversation or assistant reply.

## Capture, revisions and exact citations

Map a provider message/document to a stable `provider` and `externalSourceId`. Allocate a stable positive `externalRevision` for source changes; it is independent of authored, edited, observed and server capture times. Preserve opaque provider revision labels separately. Preserve capture identity with `externalEventId`, not the batch's diagnostic `requestId`.

Ingest with `attribution:"unverified_external"` and `extraction:"none"`. The SDK does not turn community assertions, organizer-looking labels or model hypotheses into authoritative user facts. An application's authority/review classification can be stored as metadata without changing that guarantee.

The receipt confirms committed custody. Its outcome, IDs and timestamps are immutable; `sources.status(receiptId)` returns fresh processing readiness separately. A retained source can be available for exact text retrieval while vector indexing is pending or has failed. The 64,000-byte custody cap is not a promise that every source fits every qualified embedding envelope or processing payload limit. Index failures remain explicit and do not erase captured originals.

Retry uncertain or failed captures with the exact same `externalEventId` and observation payload. Batch schema/byte-limit failures occur before dispatch. Valid per-record server failures produce ordered partial outcomes. If authority, actor or a buffered receipt's deadline changes before aggregate delivery, the batch can instead throw an uncertain delivery error even though earlier writes committed; exact-ID replay recovers their original receipts. Never infer absence or roll back successful captures from a later batch failure.

A new capture of unchanged evidence preserves its provenance without re-embedding or emitting a semantic source event. A newly retained older revision does not move current content, but emits `source.revised` with `current:false`. Equal revision or event identity reused with conflicting payload fails explicitly. Treat the conflict as evidence to investigate; do not silently renumber merely to conceal it.

For citations, persist `{sourceId,versionId,externalRevision}` from the receipt. Use `sources.get({sourceId,versionId})` when quoting evidence, and verify/display the exact original body's SHA-256 and external attribution. `get({sourceId})` selects the current custody version. Observation history preserves the separate capture provenance and observed time.

Literal search is a case-sensitive substring scan over original text. It preserves punctuation, Unicode and newline distinctions. A bounded page may contain no matches while `hasMore:true`; continue the opaque cursor. Only `completeThroughWatermark:true` means the scan reached its fixed boundary. A fresh scan considers later evidence. This path does not require fact extraction or a working vector provider.

## Durable application consumption

The v1 feed covers lifecycle and indexing changes of sources admitted through the external-source API. It does not emit existing chat, artifact/asset or fact changes. It is independent of an in-process listener. Event IDs are stable deduplication keys; events contain identifiers and sanitized state, never source bodies, authors or provenance.

```ts
const after = await applicationStore.loadCursor("evidence-importer");
const page = await client.changes.list({ after, limit: 100 });

await applicationStore.transaction(async transaction => {
  for (const event of page.events) {
    if (await transaction.hasProcessed(event.eventId)) continue;
    await transaction.recordEvidenceChange(event);
    await transaction.markProcessed(event.eventId);
  }
  await transaction.saveCursor("evidence-importer", page.nextCursor);
});
```

Persist the cursor atomically with deduplication/application effects. After a consumer restart, resume the saved opaque cursor with the same scope, principal, visibility and filter. Drain pages through their fixed watermark; a completed window's next call catches subsequent writes. Completeness means feed catch-up, not vector readiness. Own grants use owner-specific progress, so other owners' activity is not exposed through watermarks or `hasMore`.

Replaying a cursor rechecks current authority. Handle explicit cursor invalidation/expiry by reconciling current authorized application state and opening a fresh feed; never silently treat it as a complete history. Default retention is until policy erasure/invalidation, with no automatic time-based pruning. Keep application chain snapshots, review decisions, notification outbox/acknowledgements and notification intent in application-owned storage.

Safe pre-dispatch indexing failures can use the existing guarded `runtimeIngestion:retry` operator path, bounded by its attempt policy. Unknown dispatched work requires positive native reconciliation; capture replay is not permission to repeat a potentially billed operation. There is no v1 `sources.retry` client convenience method. Live provider/ANN qualification remains separate from source custody and exact search.

## Tombstone and erasure

Use `sources.tombstone` only with explicit deletion evidence and a strictly newer revision. It retires current indexing/search, retains authorized archive history, and cannot be undone by ordinary ingestion. Missing messages in a partial export are not deletion evidence.

Policy erasure is a distinct protected operator path: `runtimeExternalErasure:eraseSource`, with bounded continuation through `continueSource`. The authority cleanup paths use `retireAuthority`/`continueAuthority`. Erasure establishes a persistent resurrection fence before asynchronous cleanup, removes/redacts archived originals, observation provenance/canonical bodies and derived payloads, releases asset references, and invalidates affected replay cursors. It retains only permitted minimal fence and financial control data. An old version ID, observation ID, receipt or cursor cannot restore erased content.

Completion concerns supported SDK-managed copies registered to their declared external roots. The owning Workflow/component/storage work may require positive terminal or transport reconciliation before bounded cleanup completes; elapsed time is not evidence of physical erasure. Current external-dependent generation does not create native streaming deltas. Unsupported experimental retained native streams whose message identity/revision changed or disappeared before cleanup require explicit operator reconciliation; this candidate does not certify arbitrary experimental-row migration or cleanup. Platform backups/telemetry and upstream provider retention remain governed by their owning systems.

## P2 follow-up: the stitched map

The existing map is 122,182,087 bytes; managed asset upload/download remains capped at 20,000,000 bytes. No large map upload is claimed. Keep the original map and whole-file hash in application custody, and initially use existing immutable tiles plus a versioned tile manifest. `resumableUpload` and `rangeRetrieval` remain false.

A separate transport implementation should add scope-bound expiring upload sessions; idempotent part IDs/hashes and restart checkpoints; direct storage grants that never replace final authorization; server-verified whole-file hash/size/MIME and immutable version finalization; and authenticated streaming/HTTP Range delivery with revocation checks. Acceptance must include the actual 122,182,087-byte case, interrupted upload/retry, exact hash readback, boundary/invalid ranges, immutable versions and authorization revocation. Model-input qualification and storage capacity remain distinct.

## Evidence classes

Qualification reports distinguish pure/port-mocked checks, real Convex HTTP persistence/transactions with controlled identity, actual JWT transport, live providers and managed ANN. Missing or unexecuted coverage is not a pass. The four-message archive fixture preserves only 689 body bytes and makes no claim of archive completeness or an accepted solve. Final artifact, installer, live test and independent-review receipts belong to the goal's QA handoff.
