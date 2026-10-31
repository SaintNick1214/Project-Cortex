# Root source-read repair

Status: **implemented; local checks pass; combined review and hosted qualification pending.** Target `SaintNick1214/Project-Cortex`, base `3875d3238705a90cb191abbf824d3fa3517e42e5`.

`runtimeAuth.ts` adds an optional private V8 reader for the original root `runtimeMemorySources/by_scope_source .unique()` result. `runtimeMemoryRepository.ts` uses it only for `getSource`'s raw lookup. Its `source.unique` key is distinct from ancestry `.take(2)` but shares the existing bounded source family (512 entries / 1,000,000 bytes), clones, epochs, writer invalidation, run-family eviction and explicit freshness. Default/public/ingestion and wrong-owner contexts retain the original query. Every authority/currentness/permission/deadline predicate remains in its original position; errors, decisions and mutable attempts remain uncached.

The new registered `saveAndPrepareContextV8` comparison uses populated selected history, bridge and completed owner witnesses, and a source consumed with both permissions. Switching only new root reuse off/on yields **62 versus 1 original root unique reads**, with exactly equal full return, native model request, all DB/component/effect state, ordered getter/authority predicates and every non-root read. This is controlled read-count evidence, not hosted speed evidence.

## Observed checks

| Check | Result | Receipt |
|---|---|---|
| Targeted Jest | 617/617, 14/14 suites; no failed/pending/todo; natural exit0, forceExit=false | `memory-effort-source-root-tests.json`, `.raw.log`, `.jest.json` |
| Root types | exit0 | `memory-effort-source-root-types.json`, `.raw.log` |
| Lint types | exit0 | `memory-effort-source-root-lint-types.json`, `.raw.log` |
| Four affected files ESLint | exit0, no output | `memory-effort-source-root-lint.json`, `.raw.log` |
| Diff whitespace | tracked check exit0; new-file no-index exit1 is expected content difference, empty whitespace output | `memory-effort-source-root-diff.json`, `.raw.log` |

Node24.15.0/npm12.2.0 were verified. All checks use explicit environment selection, a dead local `http://127.0.0.1:1` URL, and no dotenv credential selection. No service/model/credential, build/pack/deployment, Git-write, Proofs, website or UI work occurred.

All **460 original canonical assertion instances** remain, compared as a multiset of exact suite path/full title. The new root suite has **33 cases**. Existing managed-source, V8 and native-transcript safety suites provide unchanged mechanism coverage rather than duplicating hundreds of cases. The JSON maps each required safety condition to direct or reused evidence.

The original canonical manifest is unchanged. Eleven of its twelve file pins remain byte-identical, including `v8-preparation-read-retention.test.ts`. Parent explicitly authorized the sole test delta in `whole-recall-composition.test.ts`: classify only `SourceUniqueRow` as the new retainable family and add root-only count/identity assertions. No old predicate, assertion or case was removed. Reversing exactly those additions reproduces its original canonical hash. Current pins are in `memory-effort-source-root-source-hashes.json`; parent will supersede the one test pin in its combined manifest.

## Safety coverage

- **Original unique cardinality/error; uncached errors and detached rows; exact tenant/space/source keys; null then insert; patch/replace/delete; shared entry/byte limits** — New source-root-read-scope.test.ts directly covers each condition. Literal original .unique retained in both the private reader and fallback; ancestry .take(2) has a distinct operation key.
- **Private V8 exact owner; default/public/ingestion/wrong-owner fallback; no RPC handle** — New scope/view test checks all variants and nonenumerable symbols. Existing managed-source-read-scope.test.ts native isolation tests retained. No serialized/public schema/API handle was added.
- **Undefined or canViewMemories cannot convey canViewFacts permission, both orders, after expiry, with deadline propagation** — New parameterized actual-getter share test first refuses facts, then warms undefined/memories, refuses facts again, verifies deadline, and expires both paths. New grant/retention clock cases compare original refusals.
- **Source/bridge/conversation/run/security changes after warm root** — Six new actual getter writer cases compare original refusal. Root remains cached across a run write but original raw run-family eviction/currentness refuses. No authority/currentness decision is cached.
- **Unknown/fluent/component pending and failed writers; late population; fresh owner/post-await explicit source fence** — New root tests cover the three pending/failed routes, late unique result across retained writer epoch, fresh owner and explicit freshManagedSourceReads. Existing managed-source suite covers successful unknown/fluent/child writers, original receivers, retained and failed/in-flight writer variants on the same unchanged readGraph machinery.
- **Actual registered saveAndPrepareContextV8 populated bridge/owner witness oracle** — Controlled on/off comparison changes only new root raw reuse. Full output, nativeRequestCanonical, DB/component/effect state, ordered getter+authority predicates, and all non-root reads equal. Both source permissions and history bridge/completed-owner witnesses are exercised. Root unique reads 62 to 1; exact unique identity set equal.
- **First refusal, atomic rollback, zero candidate/paid dispatch or financial attachment after refusal** — Five initial registered source/grant/lease/pin/duplicate faults and five warmed source/grant/run/bridge/component writer faults compare exact error, ordered authority predicates and entire state rollback; no Agent operation or model attempt created, no dispatch/attach/capture registered call. Existing V8 admission/financial negatives retained.
- **Mutable execution/owner/run-attempt reads remain uncached; all canonical instances preserved** — Registered oracle compares every non-root read in exact order, including current execution/owner by_attempt/run-attempt queries. All 460 canonical exact suite/fullName instances including duplicates retained; 11/12 canonical file hashes unchanged including v8 test. Only explicitly authorized whole-recall root-family classification and added root count/identity assertions differ; reversing precisely this delta reproduces original freeze hash.

## Preserved failures and limitations

The initial six fixture failures are retained in `memory-effort-source-root-initial-tests.raw.log`; importing the policy-aware fixture before the repository corrected test setup. Four adjacent oracle-classification failures remain in `memory-effort-source-root-adjacent-initial.raw.log`; the authorized precise correction retains all cases and adds positive root assertions. The test-hook type annotation failure and raw exit2 remain under `memory-effort-source-root-types-hook-type-failure.*`; the exact helper parameter type fixes it. Final types and all617 cases pass.

This is controlled actual-handler evidence, not live Convex OCC, hosted latency or paid-model evidence. The post-await freshness case proves the local explicit fence; installed external-I/O/admission/financial qualification remains with the parent. No latency savings or acceptance milestone is claimed. The parent performs one coherent non-author review of the combined batch next.
