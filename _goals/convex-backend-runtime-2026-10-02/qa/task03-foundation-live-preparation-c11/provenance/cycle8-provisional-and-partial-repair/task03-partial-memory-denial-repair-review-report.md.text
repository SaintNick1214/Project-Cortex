# Task Judgment: Task03 bounded partial-memory denial repair

## Verdict: PASS — FINAL for this exact offline repair

Independent judgment applies only to `convex-dev/memories.ts` SHA256 `988143530d6009ac655ba5cc4f918df6ba0721d808001faadd6e60098b179554` and added `tests/unit/runtimeEndpointAuth/partialMemoryDenials.test.ts` SHA256 `6315c0c571ac9ae3e940f2fab2905e5de900100b207101c2f6e266588b514732`. All rubric dimensions satisfy the PASS threshold. No unresolved bounded product defect was found.

This is not a preparation, live, foundation, aggregate Task03 or Task04 acceptance. C8 remains provisional; separately reviewed C9 may adopt this exact repair only after the coordinator inspects this FINAL report. No C8 reseal, new fixture, service call, key access, signature, network operation or Git command occurred in this review.

## Requirements Review

| Requirement | Met? | Evidence |
|---|---|---|
| Apply original Task03 alternate-path privacy/error closure within approved bounded repair | Yes | Read AGENTS, runtime/profile, pessimistic-judge, judge-task, feature-orchestrator, original `tasks/03-authorization.md`, approved sequencing `qa/resume-dependency-refinement-c2/plan.md` and independent source assessment. Original R2/A1 and foundation exact no-output/no-effect negatives govern these paths. This review does not claim completion of the other original requirements. |
| Only two first-null statements change; all other source bytes identical | Yes | `integrity.json`: independently reconstructed postimage from preimage SHA256 `3208cb25973aa032fc4b22c62b21eefaf60ab91016ab9eb608d2a1e25037ecc4`, replacing only `throw new ConvexError("MEMORY_NOT_FOUND");` at original byte offsets 8435 and 9593 with `dataDenied();`. Exact complete-byte equality holds. Preimage also matches independently preserved C8 preimage. Current source lines 221/257 retain braces. |
| Exact v1 FORBIDDEN/static message/retryable false/not_dispatched for foreign tenant, foreign owner and absent ID | Yes | All six cases in the added native-handler suite execute and assert full `.data` equality to `{version:1,code:"FORBIDDEN",message:"Access denied",retryable:false,outcome:"not_dispatched"}`. Existing `dataDenied` and scope lookup are unchanged. |
| No private hydration or attempted/persisted effects on denial | Yes | Six regressions assert exactly one empty indexed memory result, no source reads, no foreign memory/source IDs in reads, zero attempted writes and deep-equal persisted tables. Fixture applies real index predicates and owner filter before logged result selection, and independently logs writes even across rollback. Extra foreign-space/ownerless/deleted-absent/resource-tombstone probes confirm no source hydration/writes and zero vector calls. |
| Healthy owner writes retain content, canonical source, version, revision, actor, metadata and final lifecycle | Yes | Two new owner controls verify full source content/hash/revision, memory version/revision, owner/editor, metadata, both patches and tags/partial flags. Independent sequential owner control executes two updates then finalization; versions/source revisions reach 4, one canonical source remains, final tags retain only ordinary tags. |
| Original tests/classifier/contracts and C8 421 files remain untouched | Yes | Original memory/shared fixture/data auth/SDK/classifier hashes match historical assessment. Other original endpoint test hashes match preserved executor preimage evidence. Independent full C8 manifest verification: 421/421 hashes match manifest SHA256 `54b641e93518c43d67364a910865ad71b6d6cb7cdead36795e17cf66188139cd`. `protected-before.json` and `final-integrity.json`: 428 protected files unchanged across review, including all assessment artifacts, C8 fixture/preparation, package manifest/lock and repaired targets. No assertion or classifier exception changed. |
| Historical source assessment remains a defect witness | Yes | Read but did not execute or edit historical witness expecting bare MEMORY_NOT_FOUND. Executor red receipt shows six denial failures and two passing owners on preimage; it is supplemental historical sensitivity evidence, not an independently rerun repair acceptance. |
| Affected six suites and pinned source quality pass | Yes | Independently observed 6/6 suites, 408/408 tests, zero failed/pending/todo; two direct TypeScript 6.0.3 checks and direct scoped ESLint exit 0 under Node v24.19.0. Additional 13/13 independent probes pass, no skipped cases. `commands.json`, JSON Jest results and stdout/stderr supplied. |
| SDK semantic change recorded and checked without compatibility expansion | Yes | Native `ProgressiveStorageHandler` executes both old/new error forms: update false, finalize wraps rejection, exactly one call per operation and no retry. Unchanged generic resilience assertions establish old bare MEMORY_NOT_FOUND retryable, structured FORBIDDEN terminal; both non-system failures. Exact extracted unchanged C8 classifier accepts new envelope and rejects old string plus malformed/private envelopes. Other SDK not-found paths are byte-preserved. |

## Evidence Review

The production repair follows the existing imported `dataDenied` pattern and preserves authority acquisition, verified tenant/space/owner index filtering, embedding qualification, canonical source revision logic, patches, final write rechecks, validators and return shapes. Absent and inaccessible IDs remain indistinguishable without a global ID probe. There is no schema, export or generated-binding change requiring registration or codegen.

`tests.json` records actual handler execution through the unchanged transaction-aware shared fixture for memory/facts/retained witnesses/optional read failures, the added denial suite and original progressive storage suite. Existing original memory tests cover identity failure, ambiguity, revocation/deletion, source integrity and final fences; all 117 remain passing. Original progressive storage tests use a recreated helper, so independent probes additionally execute the actual SDK helper. These mocked outcomes cannot prove Convex transport or deployed subscription semantics.

`probes.json` additionally records eight denied native-handler cases, one sequential healthy owner lifecycle, two empty-source validation negatives, one native SDK helper comparison, and one unchanged classifier/resilience comparison. The initial scratch owner probe expected empty text to succeed and failed with the existing exact INVALID_INPUT manual-source validation. This was a reviewer setup/expectation error, not a product repair defect: initial probe source/results remain preserved, the owner control now uses valid text, and two explicit negative tests verify empty text rejection before any attempted writes. No product/test candidate was edited to resolve it.

The first affected run used a scratch config without explicit roots, producing haste-map naming collision warnings from unrelated archived/copied manifests; all six selected suites and 408 tests still completed successfully. Initial config is preserved. The subsequent scratch probe config restricts discovery to its scratch directory. No warning was classified as an application failure or hidden.

Supplemental parent receipts inspected: `qa/task03-partial-memory-denial-repair-integration/summary.json`, exact lint/regression argv and UTC receipts. Broader current-source foundation regression reports 49/49 suites, 4,833/4,833 tests, zero failed/pending/todo, and declared npm12.2 standard root lint exit 0 with 0 errors/115 warnings. These are observed parent receipts, not falsely relabeled independent execution by this judge.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 5/5 | Every bounded repair criterion proven; exact scopes and incomplete broader gates explicit. |
| Code Quality | 5/5 | Existing typed never-returning denial helper, unchanged validation/authority/writes, exact source locality. |
| Test Quality | 5/5 | Full-envelope/privacy/effect assertions, independent lifecycle/negative probes and real helper behavior; preserved defect-sensitive red receipt. |
| Pattern Adherence | 5/5 | Same static denial pattern as surrounding data-authority paths; no new classifier/privacy exception. |
| Completeness | 4/5 | All affected offline checks pass on pinned Node/TS. Executor ambient npm11 invocation is transparently documented and independent tooling checks close the source validation gap. |

**Average**: 4.8/5.

## Issues Found

### Critical (must fix - blocks PASS)

- None within this bounded repair.

### Important (should fix)

- None within this bounded repair. Live foundation, preparation acceptance and original Task03 functional outcomes remain separate incomplete gates, not defects silently excused by this PASS.

### Minor (consider fixing)

- Executor `commands.json` records npm11.9.0 for `npx --no-install` checks despite repository npm12.2.0 declaration. No dependency install/update or lock mutation occurred. This is a procedural limitation of its receipts. Judge independently verified the pinned npm12.2 CLI version at `/home/agent/.npm/_npx/1106a35d869e25fb/node_modules/npm/bin/npm-cli.js` and directly executed Node24/local TS6/local ESLint checks without ambient npx; parent additionally ran standard lint through that declared npm12.2 CLI. Future commands should consistently use declared tooling.

## Recommendation

Accept this exact bounded repair after inspecting this FINAL report and hashes. Preserve the immutable C8 candidate/manifest, historical negative witness and failed scratch/control evidence. A new C9 fixture may incorporate only independently accepted current source; it still requires its own preparation/independent/live gates and current fingerprints. Do not infer foundation PASS, Task03 completion or Task04 advancement from this report. No additional product edits are recommended for the bounded repair.
