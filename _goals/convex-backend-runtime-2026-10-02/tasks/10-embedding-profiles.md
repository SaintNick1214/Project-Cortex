# Task 10: Clean-slate embedding storage and retrieval

**Status:** Execution authorized — pending prerequisite implementation and independent acceptance.
**Goal:** [Cortex-owned backend runs](../goal.md)
**Depends on:** [09 accepted actual text/UI slice](09-text-client-slice.md), [04 Per-function model policy and admission budgets](04-model-policy.md), [08 Durable asynchronous memory and belief consistency](08-memory-pipeline.md)

## Objective

Design embedding storage and semantic retrieval for the new runtime without retaining previous models, dimensions, vector-field layouts or upgrade paths.

## Requirements

- [ ] Separate logical source content and versioned chunks from profile-specific derived vectors. Record source revision/chunk, tenant/space, model/profile identity, dimensions, preprocessing/chunking version and stage receipt.
- [ ] Define the core default profile before the text slice, then qualify additional supported profile/index configurations on a managed disposable target. Choose schema/index layouts for the supported new-runtime models; declared index dimensions must match actual vectors.
- [ ] Resolve storage/query profiles through backend operation policy; pin the profile to each job/query. Only current, authorized sources and matching semantic profiles participate in retrieval. Same-dimensional different-model vectors are not interchangeable; malformed/dimension-mismatched vectors fail validation.
- [ ] Policy changes cannot relabel stored vectors or silently compare profiles. Missing compatible vectors/indexes produce explicit readiness/capability state; ordinary fallback cannot change an embedding profile.
- [ ] Keep source identity independent of derived generations so future models or image-artifact analysis can add separate derived records. No image processing, old-corpus import/conversion, legacy compatibility or general reindex orchestration is implemented in this goal.

## Acceptance Criteria

- [ ] Source/chunk/vector records and declared indexes follow the new design without an inherited model/dimension/schema requirement. Stored and query vectors record the matching profile and actual configured dimensions.
- [ ] Same-dimensional incompatible models cannot mix in retrieval; concurrent policy changes, transcript edits and deletion cannot commit or return obsolete source-derived vectors.
- [ ] Actual managed retrieval returns expected known fixtures under each qualified profile. Unit/local search is not presented as managed evidence.
- [ ] Unsupported model/index choices and provider alias/version limits have explicit outcomes. Existing vectors are never relabeled to satisfy a policy change.

## Context and Research

[Architecture](../../../_research/convex-ai-gateway-2026-10-02/architecture.md), §6; [decision gates](../../../_research/convex-ai-gateway-2026-10-02/decision-gates.md). The user explicitly authorizes clean-slate architecture and excludes upgrade concerns.

**Likely areas:** backend source/chunk/vector schema, search and embedding policy; TypeScript configuration/types. The core Tasks 01/02/04/08 declare and use the fresh default profile; this extension qualifies additional profiles without blocking the earlier text slice.

## Validation and Execution Notes

Meaningful profile mismatch, concurrent policy-change/write, dimension, source-revision/deletion and managed retrieval fixtures. No Python work, legacy migrations or service operations during planning. Re-read AGENTS.md, Git status and manifests at later execution; protect local work.
