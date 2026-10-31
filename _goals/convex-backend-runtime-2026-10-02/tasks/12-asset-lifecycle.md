# Task 12: Convex-owned assets and bounded private delivery

**Status:** Complete — original six requirements and four criteria accepted by one non-author PASS4.0 on 2026-10-08; later media jobs, 03-final and the full goal remain open.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [09 accepted actual text/UI slice](09-text-client-slice.md), [03 authorization foundation](03-authorization.md#authorization-execution-gates), [05 Canonical transcript, agent definitions and run admission](05-transcripts-runs.md)

This execution prerequisite means independently accepted **03-foundation**, not full03-final. All original Task03 functional criteria remain required at their mapped implementation gates and03-final before Task17. See [accepted sequencing contract](../qa/resume-dependency-refinement-c2/plan.md).

## Objective

Extend Cortex artifact ownership and authenticated Convex delivery within 20,000,000 bytes, leaving external media storage outside scope.

## Requirements

- [x] Keep Convex storage references and a catalog of owners across artifact versions, attachments and Agent messages. Add first-class video output and typed binary metadata/provenance.
- [x] Enforce the application asset/HTTP payload cap of 20,000,000 bytes before accepting oversized uploads and before marking generated outputs ready or delivering bytes. Model options may reduce size but cannot guarantee it; oversized output returns a typed error and cleanup with no external fallback.
- [x] Serve private assets through authenticated/authorized HTTP actions. UI helpers fetch with credentials and render bounded blobs; do not expose direct bearer storage URLs as automatically expiring signed URLs.
- [x] Make ready/version commits idempotent. Reference-aware cleanup covers history/undo, orphans, cancellation and user/space cascades; Agent message vacuum does not determine all ownership.
- [x] Preserve stable artifact/version IDs, content hash, MIME and source lineage for a future image-analysis processor. No image captions/OCR/visual embeddings or processor implementation now.
- [x] Qualify private provider input access and protocol payload limits separately. No R2, object-storage abstraction/adapter or large-media delivery path is added.

## Acceptance Criteria

- [x] Actual supported private assets below the cap are delivered only to authorized callers; uploads/generated/downloaded outputs above the cap cannot become ready or be returned. Boundary cases account for actual HTTP limits.
- [x] Deleting an attachment cannot break retained artifact versions; final-owner deletion and failed job cleanup remove bytes according to retention/retry policy.
- [x] Tenant/share metadata and byte access are denied when unauthorized or revoked; delayed commits respect deletion tombstones.
- [x] Undo/redo/export retain correct lineage; future processor references could identify an exact immutable asset version without requiring external storage today.

## Context and Research

[Architecture](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), §§7,9; [decision gates](../../../_research/convex-ai-gateway-2026-10-02/decision-gates.md). Convex getUrl grants bearer access. The scoped solution uses private HTTP delivery and a conservative asset cap, as requested.

**Likely areas:** convex-dev artifacts/attachments/schema, owned-file catalog, HTTP delivery and TypeScript artifact types/helpers. Follow existing artifact versioning and scoped auth exemplars.

## Validation and Execution Notes

Qualify Convex storage and actual HTTP delivery on the disposable target; force oversize/failed-download/shared-reference/delete races with bounded fixtures. No external storage prerequisite, Python work or live operations during planning. Re-read target instructions/status at execution.


## Independent functional acceptance — 2026-10-08

Accepted under [policy v2](../acceptance-policy.md), with all original requirements and criteria preserved. See [independent report](../qa/local-resume-2026-10-05/task12-product-independent-review1/report1.md) and [actual native outcomes](../qa/local-resume-2026-10-05/task12-asset-functional-v2-20261008/native-actual/final-native-report1.json). Actual authenticated storage/HTTP, 20,000,000/20,000,001-byte boundaries, immutable artifact history/undo/export, shared owners/Agent vacuum, revocation/tombstone/orphan/cancellation cleanup and private provider input all passed. The distinct synchronous qualification generated and materialized a real 331,153-byte MP4; installed SDK delivery matched hash/MIME and denied revoked access. Author 922, independent eight and Root/CLI controlled scopes remain separate and are not summed into runtime success.

Cleanup leaves asset storage and active asset jobs at zero with clients/processes closed. Two uncertain media calls retain two financial concurrency slots and their full 4,000,000 micro-USD liability in retired test scopes, plus unchanged earlier 500,000 micro-USD uncertainty; no refund, terminal settlement or ledger-byte replay is invented. The existing conservative policy requires genuine terminal evidence to release those holds. Disposable development target3174742, sole issuer/credentials and prior graph resources are explicitly retained for later qualification/final retirement. The async request returned genuine configuration503 and issued no retry; synchronous private-input success does not complete Task13 asynchronous jobs. Historical failures and missing C7 archive/custody backing remain unchanged.
