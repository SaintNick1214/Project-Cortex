# Task judgment: K29 same-native-snapshot source/test/docs batch

## Verdict: PASS — source only

One independent nonauthor review of the coherent frozen batch passes acceptance-policy v2. Scores are 4/4/4/4/4 and there are **zero unresolved breaking findings**. This accepts the bounded source change for the next already-authorized qualification phase. It does not accept K29 native performance or the full backend-runtime goal.

`sourceOnly: true`; `fullGoalAcceptance: false`; `nativeCandidateStatus: NOT_RUN`.

## Verified inputs and scope

I read the repository instructions, runtime adapter/profile, pessimistic-judge role, judge-task rubric, authoritative acceptance-policy v2 and K29 batch scope. The goal-specific minima 4/4/4/3/3 supersede the rubric's older stricter thresholds. The review covers the packet's 17 core source/test files, ten canonical website documents, one Proofs document and sixteen evidence inputs.

I independently computed packet SHA-256 `e76e3601f8f1d27ec456c4869eda3760642b3e3297fedf25df8f50b6d10fe4db` and verified all **44 listed hashes**, both before review and immediately at finalization. The JSON report embeds the exact packet hash map. Current HEAD is `69becda2ba83d848f3768f5c4cea7c23ba946909`; the product comparison baseline is `a773bd545c22e3c6eeb228b800d4c3a679375c5b`. The HEAD range adds no product/source delta beyond that baseline; the reviewed product changes are the frozen working-tree batch. Unrelated dirty QA/resume work was preserved.

I inspected the actual production/test diffs, A/B source reports and final freezes, selected original failure receipts and successors, raw latest-per-file Jest JSON/logs, six joint quality results/logs, website build/render records and saved performance screenshot, and retained K28 outcome/cleanup records. No new tests, builds, services, inference or GitHub operations were needed or run by this reviewer. Only these review output files were written.

## Requirements review

| Requirement | Result and evidence |
|---|---|
| Exact owner and one native snapshot only | `runtimeAuth.ts:133` requires the parent's private native-owner identity and raw authority reader. Wrong-owner, unscoped, serialized and already-scoped fallbacks are exercised in `managed-source-read-scope.test.ts`. Symbols are nonenumerable, and Action/RPC arguments do not carry them. Installed Convex registration types state native child queries share their parent snapshot, while Action calls use separate transactions. |
| Retain raw values; rerun every decision | Production diffs preserve the original authority/currentness, definition/schema/hash/registry/root/narrowing, qualification/profile, expiry, duplicate and source predicates. An independent read-only TypeScript AST comparison confirmed all 432 other top-level declarations in B's six production files are byte-identical; exactly the ten declared orchestration/query expressions differ. A's original writer/reader bodies also match the saved equivalence evidence and the inspected diff. |
| Bound and isolate new metadata | Only explicit V8/public-read factories install the exact definition `by_scoped_version/take(2)` and tenant-policy `by_scope_active/take(65)` families. Default and legacy policy-metadata factories fall back to their original queries. The detached map has 32-entry/1,000,000-byte ceilings; entry/byte overflow, absence, clone isolation and failed-read behavior are exercised by actual helper/validator tests. |
| Preserve writer safety | Before/after/finally barriers, active-writer suppression and epoch checks remain. State writes retain only the pre-existing allowed untouched metadata; finance/definition/policy/unknown/component/fluent writers clear the appropriate rows. Managed origin-run rows invalidate on every write. Actual source and direct-save tests cover revocation/edit/tombstone/duplicate, pending/error writers, late reads and rollback. |
| Exclude mutable runtime/finance state | Account/operation/attempt/execution/output/conversation/current-run reads retain their raw paths. Differential tests compare exact result/state, nonfamily mutable read order and raw identity sets. New exact versioned-definition and bridge retention is classified explicitly rather than allowing arbitrary table reads. |
| Preserve independent fresh fences | `finalDeliveryV8Handler` still resets managed-source reads and passes `nativeCtx` to `checkDelivery`; public recall retains three separate native parents and Action-clock expiry. The original final raw authority fences, pre-storage hydration and independent terminal financial capture/attachment are unchanged. Successful reads followed by fresh save edit/revoke refusals, late raw revocation, terminal capture and malformed attachment regressions pass. |
| Empty save preserves validation | Only `prepareDirectTurnV8` supplies its exact native owner. The empty helper still invokes the complete original `saveContextV8Handler` and empty/profile probes. Default/unbranded callers take the original metadata/native-message reset. Direct-parent real wrapped writers and expiry preserve the original refusal and transaction rollback. |
| Observation and compatibility remain usable | Registered envelope/signal entries opt into the same-native raw scope; the original final authority context remains raw. SDK source is unchanged. Tests preserve fresh post-I/O sessions, generation/expiry/disposal behavior, signal dependency validation, fresh-RPC revocation and the exact legacy three-field envelope when acknowledgement is omitted/false. |
| Canonical history and bounded context remain intact | No schema, endpoint args, handler version, model, deadline or public contract was changed. The unchanged selection default remains four recent messages/four relevant memories/four facts/four pending, sixteen total, with qualified input constraints and complete tool groups. Canonical per-message storage and quoted untrusted recalled evidence are preserved. |
| Documentation remains truthful | Canonical docs and `SANDBOX.md` distinguish unreleased candidates, complete transcript storage, bounded request selection, functional outcomes, actual unknown charges and historical failures. K28's correct markers 4/4, latency 0/4, separate recall/tool/indexing outcomes and independent exact cleanup ABSENT agree with the retained records. No K29 hosted speed claim is introduced. The current website build exited 0 and the saved rendered table is legible. |

## Test and evidence assessment

The raw latest-per-file results independently support **A: 481 passing tests/13 suites** and **B: 804 passing tests/21 suites**, with zero pending/todo in those selected complete suites. These are latest-per-file unions across overlapping executions, not one aggregate invocation. I verified the relevant raw suite/status counts, 42 nested evidence hashes, and all six joint quality log hashes and recorded actual exit-0 results: scoped lint, backend/root/lint typechecks, build and packed/browser public contracts. The build generated the backend distribution without deployment; packed contracts cover root/runtime/graph ESM+CJS, declarations and browser execution.

Original failed invocations remain failed: A's six profile-fixture setup failures and fluent-table fixture failure, and B's historical control/public-fixture, unknown-writer, metadata-order/identity and terminal-family instrumentation failures. The corrections are applicable: the profile fixture now fits the existing qualified root; the fluent fixture restores its accessor; unknown writer targets an existing row; public stale-neighbor exclusion/plain profile error matches the original contract; historical K27 control runs its original view; newly retained exact raw families no longer count as mutable. Functional result/state, ordered failure, budget/effect and original deadline assertions remain, with raw identity equality added. No removed safety assertion or broadened deadline was found.

The meaningful controlled results are direct preparation 332→211 DB calls, shared private plan 104→62, shared private tail 261→111, and public three-parent pipeline 221→167, with equal outcomes/state and original nonfamily reads. These counts establish the intended source optimization in transactional fixtures. They do not establish hosted elapsed time, CPU savings, serving location or one-second compliance.

## Dimension scores

| Dimension | Score | Basis |
|---|---:|---|
| Requirement fulfillment | 4/5 | All bounded source requirements have direct implementation and meaningful positive/negative evidence. |
| Test quality | 4/5 | Actual registered-handler outcomes, raw identities/state/order, writer races/failures, authority/profile/source refusals and fresh-boundary regressions; original failures retained. |
| Completeness | 4/5 | Opt-in factories and real parent/registered endpoint wiring are reachable; fallback/compatibility preserved; affected checks and docs build pass. |
| Code quality | 4/5 | Closed bounded raw helpers reuse existing detached-value and conservative writer machinery. Minor comment/test-instrumentation debt below is nonbreaking. |
| Pattern adherence | 4/5 | Native transaction ownership, original guards, internal helpers, public DTOs and repository scope conventions are preserved. |

**Average: 4.0/5.** No average overrides a blocker; none was found in this source batch.

## Findings

### Critical / important

None. `breakingFindings: []`.

### Minor, nonblocking

- `convex-dev/runtimeAgentRecall.ts:162` retains a pre-existing parent comment saying per-source reads keep the raw native context. K29 now deliberately shares exact-owner raw readers for those traversals; only the final authority fence stays raw. Update the comment when this area is next touched. The implementation and nearby new comment correctly express the behavior.
- `tests/unit/runtimeAgent/whole-recall-composition.test.ts:27` and the direct-parent control distinguish `bridgeFor` using `Error.stack`. The pinned-runtime controlled outputs show the intended original raw family, but callsite/stack-format dependence is fragile test-only instrumentation. Explicit control injection would be easier to maintain in a future refactor.

## Acceptance boundary

This is the single nonauthor source/test/docs review, not a new receipt/controller/custody gate. K29 hosted qualification remains **NOT_RUN**. K28's first-text samples remain 4379.5/3765.6/7704.97/9901.85 ms, correct canonical markers 4/4 and SLO 0/4. The exact K28 resources were independently verified ABSENT; that does not qualify a future K29 environment. Final installed-candidate integration, required actual service outcomes and the final independent goal audit remain outstanding as applicable. Video stays explicitly deferred. No production, release, merge or full-goal approval is granted.
