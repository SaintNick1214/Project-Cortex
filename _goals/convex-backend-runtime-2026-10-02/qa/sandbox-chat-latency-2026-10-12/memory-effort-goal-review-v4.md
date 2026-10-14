# Goal Judgment: Memory effort execution amendment v4

## Verdict: PASS

This is approval of the new goal amendment only. It does not accept implementation or hosted latency, reopen the original 17 tasks, or alter their accepted non-video scope-version3. The goal-specific acceptance policy controls: planning average at least 3.5, no dimension below 3, and no breaking gap.

## Dimension Scores

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Layer Coverage | 5/5 | E1 covers shared domain, schema and backend; E2 covers SDK/client, provider, CLI, canonical consumers and docs; final qualification includes installed packages and affected modules. |
| Test Coverage Plan | 4/5 | Real hop reachability and depth negatives, isolation/currentness, cycles/fanout, bounds, cancellation, pending/strict, propagation and profile latency are explicit. Exact fixtures and sample counts remain ordinary execution choices. |
| Task Decomposition | 4/5 | Baseline, backend contract, dependent clients, measured repair, installed qualification and cleanup/audit have coherent boundaries. E1/E2 permit disjoint delegation after types stabilize. |
| Implementation Readiness | 4/5 | Files, semantic rules, compatibility, policy bounds and outcome assertions are actionable. One file pointer has a harmless name error, noted below. |
| Dependency Ordering | 5/5 | Unchanged K29 baseline precedes edits; backend contract precedes dependents; changed build/install precedes real qualification; cleanup and final audit precede completion. |

**Average: 4.4/5. Zero blocking findings.**

## Evidence Review

- **Feasible logical hops.** Source/fact lineage and source/message linkage exist in `src/domain/contracts.ts:31-90` and `convex-dev/runtimeMemorySchema.ts:18-54`. Facts retain subject/object, exact entity names and explicit relation triples in `convex-dev/schema.ts:569-687`; the current graph producer uses current, scoped facts and their stored entities/relations in `convex-dev/runtimeGraph.ts:97-124`. V4 lines20–26 correctly separate evidence traversal from hydration and allow narrow indexed adjacency additions. Ordinary source/fact links can work in Convex. External-only relationships must retain unavailable coverage when that service is absent.
- **Caller clamp and compatible snapshots.** Current selection is V1 with separate per-kind quotas (`src/domain/model-input-selection.ts:6-32,64-96`), while definitions validate it and V8 cutoffs pin it (`convex-dev/agentDefinitions.ts:46-55`, `src/domain/transcript.ts:19-33`, `convex-dev/runtimeAgent.ts:166-169`). E1 explicitly adds an administrator-clamped shared policy, versioned run/definition behavior and preserved historical snapshot interpretation. E2 then propagates the Normal default and validated request/result metadata. The plan does not mistake current quota mapping for implemented hop traversal.
- **Max remains bounded.** V4 lines22–26 and design lines99–139 distinguish the absence of product hop/entry caps from bounded pages, visited work, context/output reserve, relevance, deadlines, cost and cancellation. The 32,768 conservative input ceiling remains in force; this review does not independently requalify or enlarge it. No extra summarization/reranking/inference retry is authorized.
- **Real outcomes and depth isolation.** V4 line34 requires actual Fast2/not3, Normal4/not5, High8/not9 and useful Max9+ outcomes, alongside direct-hit depth1 behavior, cycles/fanout, denied/revoked/stale/deleted edges, pending/strict and overflow cases. The intended chain must be isolated from direct seeding when testing a depth negative; otherwise every direct match is legitimately depth1. This is how to satisfy the existing assertion, not an added gate. E2 also names omitted/default, invalid choices, SDK-to-endpoint, reconnect/approval/cancel, browser-safe exports and installed consumers.
- **Preserved product fences.** Public recall currently binds the canonical request and explicit limit before governed embedding (`convex-dev/runtimeMemoryQuery.ts:27-42`, `runtimeMemory.ts:227-239`); final delivery checks exact current sources/facts (`runtimeMemoryRepository.ts:291-368`, `runtimeMemoryServices.ts:81-154`). V4 retains authority/currentness, accounting/replay, transcript and async gates and includes these seams in E1. Existing strict/pending overflow handling at `runtimeAgent.ts:1762-1815` remains a requirement to preserve.
- **Honest latency and order.** Fast2/3s, Normal4/6s default, High8/8s and Max/no preset depth/30s agree across the amendment and design. The end boundary is first visible model-generated answer text, not a spinner or retrieval result. K28 remains historical; unchanged K29 is measured first and cannot qualify unimplemented profiles. Fixed overhead is separately addressed using measured traces. Later real profile misses remain misses.
- **Historical decisions are reconciled.** The design and decisions JSON retain their design-only pause status. The amendment expressly records the later user resumption. Its 4/8/16 breadth values are initial administrator implementation choices carried forward from the resumed discussion, not an asserted verbatim user count decision. No further routine user question is needed.

## Issues Found

### Critical (blocks progress)

None.

### Important (should fix)

None.

### Minor (consider fixing)

The E1 reading list at v4 line31 names `runtimeRuns.ts`; the actual run implementation is `convex-dev/runs.ts`, with run storage in `runtimeTranscriptSchema.ts`. Resolve that pointer while executing E1. It does not block an actionable plan.

## Recommendation

After Root completes the unchanged K29 baseline, proceed with E1 and then E2 under the accepted policy. Review one coherent source/test batch and retain the installed real-service/browser qualification and final independent audit. No receipt/controller judge or original-task replanning loop is required.

## Review provenance

Reviewed HEAD: `f87695783e8b21ffecf6298057a87cd8e69a3016`.

| Subject | SHA-256 |
| --- | --- |
| modified-goal-execution-v4.md | `00910c9ff11a88f15fada5c63bb18c0c1b7594fff1bc283375ae202ba13f141b` |
| memory-effort-design-2026-10-14.md | `d49e00cb5ef4944b03afd8428e24baf50ce146722170240629d6dfccd80dba27` |
| memory-effort-user-decisions-v2.json | `d54c58606c9b0b41cffb19b24b3bd6799a05daa0ebf5552cab21e61e83666ea3` |

Read the requested runtime, project profile, pessimistic-judge role, judge-goal rubric and acceptance policy. Selectively inspected actual source/schema interfaces above. No service calls, inference, product edits, commits, evidence copying or subjudges. No product tests were executed because this was a planning/source-interface review; those outcomes remain required before implementation acceptance.

