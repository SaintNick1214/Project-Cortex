# Task 12: Convex-owned assets and bounded private delivery

**Status:** Execution authorized — pending prerequisite implementation and independent acceptance.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [09 accepted actual text/UI slice](09-text-client-slice.md), [03 authorization foundation](03-authorization.md#authorization-execution-gates), [05 Canonical transcript, agent definitions and run admission](05-transcripts-runs.md)

This execution prerequisite means independently accepted **03-foundation**, not full03-final. All original Task03 functional criteria remain required at their mapped implementation gates and03-final before Task17. See [accepted sequencing contract](../qa/resume-dependency-refinement-c2/plan.md).

## Objective

Extend Cortex artifact ownership and authenticated Convex delivery within 20,000,000 bytes, leaving external media storage outside scope.

## Requirements

- [ ] Keep Convex storage references and a catalog of owners across artifact versions, attachments and Agent messages. Add first-class video output and typed binary metadata/provenance.
- [ ] Enforce the application asset/HTTP payload cap of 20,000,000 bytes before accepting oversized uploads and before marking generated outputs ready or delivering bytes. Model options may reduce size but cannot guarantee it; oversized output returns a typed error and cleanup with no external fallback.
- [ ] Serve private assets through authenticated/authorized HTTP actions. UI helpers fetch with credentials and render bounded blobs; do not expose direct bearer storage URLs as automatically expiring signed URLs.
- [ ] Make ready/version commits idempotent. Reference-aware cleanup covers history/undo, orphans, cancellation and user/space cascades; Agent message vacuum does not determine all ownership.
- [ ] Preserve stable artifact/version IDs, content hash, MIME and source lineage for a future image-analysis processor. No image captions/OCR/visual embeddings or processor implementation now.
- [ ] Qualify private provider input access and protocol payload limits separately. No R2, object-storage abstraction/adapter or large-media delivery path is added.

## Acceptance Criteria

- [ ] Actual supported private assets below the cap are delivered only to authorized callers; uploads/generated/downloaded outputs above the cap cannot become ready or be returned. Boundary cases account for actual HTTP limits.
- [ ] Deleting an attachment cannot break retained artifact versions; final-owner deletion and failed job cleanup remove bytes according to retention/retry policy.
- [ ] Tenant/share metadata and byte access are denied when unauthorized or revoked; delayed commits respect deletion tombstones.
- [ ] Undo/redo/export retain correct lineage; future processor references could identify an exact immutable asset version without requiring external storage today.

## Context and Research

[Architecture](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), §§7,9; [decision gates](../../../_research/convex-ai-gateway-2026-10-02/decision-gates.md). Convex getUrl grants bearer access. The scoped solution uses private HTTP delivery and a conservative asset cap, as requested.

**Likely areas:** convex-dev artifacts/attachments/schema, owned-file catalog, HTTP delivery and TypeScript artifact types/helpers. Follow existing artifact versioning and scoped auth exemplars.

## Validation and Execution Notes

Qualify Convex storage and actual HTTP delivery on the disposable target; force oversize/failed-download/shared-reference/delete races with bounded fixtures. No external storage prerequisite, Python work or live operations during planning. Re-read target instructions/status at execution.
