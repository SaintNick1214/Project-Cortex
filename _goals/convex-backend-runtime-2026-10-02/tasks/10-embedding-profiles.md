# Task 10: Clean-slate embedding storage and retrieval

**Status:** Complete — all 5 original requirements and 4 criteria independently accepted PASS4.0 under acceptance policy v2.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [09 accepted actual text/UI slice](09-text-client-slice.md), [04 Per-function model policy and admission budgets](04-model-policy.md), [08 Durable asynchronous memory and belief consistency](08-memory-pipeline.md)

## Objective

Design embedding storage and semantic retrieval for the new runtime without retaining previous models, dimensions, vector-field layouts or upgrade paths.

## Requirements

- [x] Separate logical source content and versioned chunks from profile-specific derived vectors. Record source revision/chunk, tenant/space, model/profile identity, dimensions, preprocessing/chunking version and stage receipt.
- [x] Define the core default profile before the text slice, then qualify additional supported profile/index configurations on a managed disposable target. Choose schema/index layouts for the supported new-runtime models; declared index dimensions must match actual vectors.
- [x] Resolve storage/query profiles through backend operation policy; pin the profile to each job/query. Only current, authorized sources and matching semantic profiles participate in retrieval. Same-dimensional different-model vectors are not interchangeable; malformed/dimension-mismatched vectors fail validation.
- [x] Policy changes cannot relabel stored vectors or silently compare profiles. Missing compatible vectors/indexes produce explicit readiness/capability state; ordinary fallback cannot change an embedding profile.
- [x] Keep source identity independent of derived generations so future models or image-artifact analysis can add separate derived records. No image processing, old-corpus import/conversion, legacy compatibility or general reindex orchestration is implemented in this goal.

## Acceptance Criteria

- [x] Source/chunk/vector records and declared indexes follow the new design without an inherited model/dimension/schema requirement. Stored and query vectors record the matching profile and actual configured dimensions.
- [x] Same-dimensional incompatible models cannot mix in retrieval; concurrent policy changes, transcript edits and deletion cannot commit or return obsolete source-derived vectors.
- [x] Actual managed retrieval returns expected known fixtures under each qualified profile. Unit/local search is not presented as managed evidence.
- [x] Unsupported model/index choices and provider alias/version limits have explicit outcomes. Existing vectors are never relabeled to satisfy a policy change.

## Context and Research

[Architecture](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), §6; [decision gates](../../../_research/convex-ai-gateway-2026-10-02/decision-gates.md). The user explicitly authorizes clean-slate architecture and excludes upgrade concerns.

**Likely areas:** backend source/chunk/vector schema, search and embedding policy; TypeScript configuration/types. The core Tasks 01/02/04/08 declare and use the fresh default profile; this extension qualifies additional profiles without blocking the earlier text slice.

## Validation and Execution Notes

Meaningful profile mismatch, concurrent policy-change/write, dimension, source-revision/deletion and managed retrieval fixtures. No Python work, legacy migrations or service operations during planning. Re-read AGENTS.md, Git status and manifests at later execution; protect local work.

## Functional acceptance — 2026-10-08

One non-author [report](../qa/local-resume-2026-10-05/task10-product-independent-review1/report1.md) and [verdict](../qa/local-resume-2026-10-05/task10-product-independent-review1/verdict1.json) accepted the coherent source and actual batch. Both qualified profiles retrieve the same known source through managed indexes; policy, edit, deletion and revocation fences pass. Five governed calls retain 500,000 micro-USD uncertain liability. Shipped default revision9 preserves exact V5/four prior proofs and default-small settings. Task10 scopes are cleaned; owned target3174742 is explicitly retained for Task11 with final retirement open. Historical failures and scoped coverage remain preserved. This does not complete Task11+,03-final or the full goal.
