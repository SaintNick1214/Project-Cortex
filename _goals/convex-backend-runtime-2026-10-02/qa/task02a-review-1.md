# Task Judgment: bounded Task02A

Verdict: **NEEDS FIXES**. Fresh read-only `/root/task02a_review`,2026-10-03.
Whole Task02 remains pending02B; this review covers pure domain extraction,
adapter interfaces, frozen source/profile contracts and unchanged outcomes only.

Reviewed instructions/profile/role/rubric, Task02, decisions/architecture,
Task01 frozen contracts, all10 domain modules, six legacy delegates/type reexports,
three new test files, selected existing fixtures and raw QA evidence. All19 source
hashes match. Raw logs support strict root/browser types, scoped lint0errors/32
existing client warnings,7suites/133tests,build/packed contracts. Independent probes
used an in-memory browser bundle with write:false; no mutations or paid calls.

| Requirement | Outcome | Evidence |
|---|---|---|
| Pure normalization/ranking/context/extraction/conflict modules | Met | src/domain/index.ts and10 modules. |
| Scoped repository/internal model/clock interfaces | Met | contracts.ts and clock.ts; required injected seams. |
| Frozen02B interfaces | Pending corrections | qa/task02a/contracts.md. |
| Exact default profile/index filters | Met | profile.ts and profile.test.ts. |
| NFC/LF/code-point chunks and overlap | Met | profile.ts:24,70; Unicode/whitespace assertions. |
| Sources/chunks separate from vectors | Met | contracts.ts:44,56,68; logical records have no embedding. |
| Required valid source metadata/lineage | Partial | Emptyowner,emptycontent/hash,NaNtime and revision0 probes accepted. |
| Vector/profile/currentness guards | Partial | Existing shape/scope/profile/tombstone checks; missing lineage validity. |
| Trusted authority refs and recheck contract | Met as contract | Ten reference fields, lifecycle/epoch guard and required repository recheck; ctx enforcement02B/03. |
| Assistant speculation excluded from user facts | Met | sources.ts:95,100,118 and eligibility/dispatch/parsing tests. |
| Internal extraction no recursive chat/memory entry | Met | One memory.extract dispatch; counts/error propagation asserted. |
| Canonical hash/equality contract | Met as contract | profile.ts:50; repository collision equality obligation. |
| Existing outcomes unchanged | Met | Unchanged selected fixtures;133tests; clock/nonmutation assertions. |
| Browser/default-runtime isolation | Met | Only10 runtime modules; no generated/backend/Node declaration inputs; sandbox passes. |
| Backend ctx/action and modern remember/recall | Deferred02B | Honest scope; wholeTask02 incomplete. |
| Public limits, model admission, managed retrieval | Downstream | No mocked live-service PASS inferred. |

| Dimension | Score |
|---|---:|
| Requirement Fulfillment | 4/5 |
| Code Quality | 3/5 |
| Test Quality | 4/5 |
| Pattern Adherence | 4/5 |
| Completeness | 4/5 |

Average **3.8/5**. No critical authentication/secret defect established in this
isolated slice. Important fixes required:

1. sources.ts:60 preparation checks tenant/space but accepts emptyprincipalId and
   emits emptyowner at68. Modern prompt/dispatch/parsing checks attribution and
   tombstone but accepts empty/unnormalized content, invalid required metadata and
   NaN creationtime. Require valid nonempty ownership/scope/content/hash/source
   metadata and finite timestamps. Reject malformed input before model dispatch;
   assert zero calls. Canonical hash equality remains repository obligation.
2. sources.ts:193 accepts source/chunk/vector sharing revision0, since reference
   equality alone is checked. Validate positive safe revision, nonempty IDs and
   valid lineage before currentness. Keep backend grant/resource checks separate.

Minor: deduplication.ts:113 .some skips sparse vector holes, returning NaN for
cosineSimilarity(Array(2),[1,2]); iterate every index. sources.ts:130 strict tags
parser accepts sparse arrays, silently normalized by serialization/legacy parser;
reject malformed sparse strict arrays.

Existing tests meaningfully cover profile/chunks/hash, source attribution,
single dispatch/uncertain propagation, authority generations/lifecycle,
scope/profile/tombstones and ranking/context/conflict. Missing malformed-record
and invalid matching-revision regressions are demonstrated by independent probes.
Fix guards, add those assertions, refresh affected hashes/receipts and rejudge.
