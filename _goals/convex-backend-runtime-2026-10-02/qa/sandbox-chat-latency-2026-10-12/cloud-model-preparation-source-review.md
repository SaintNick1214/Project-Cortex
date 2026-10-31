# Independent model-preparation source review

2026-10-13. **PASS — 4.0/5 under acceptance-policy v2.** No unresolved breaking finding in the bounded three-file source/test batch. Installed hosted behavior, native OCC and measured speedup remain pending; K6's 2449 ms preparation region is not predicted savings.

Reviewer authored no candidate code. Only this report was written; no source/P/Git/service/inference operation or test rerun. This verdict excludes concurrent qualification-data promotion.

Reviewed report SHA-256 `ba5db9ea3dad463773d0aed6f8598673f2ed7ffc69395c60569129d7bb1e6ffe` and check manifest `b544d45286aa46b80596ccfd5584c958d5d36ff4448300cff115e5ce7332d3a4`, exact scoped diff, retained preimage, actual handler/fault-port tests, raw Jest/type/lint evidence and 74-check AST comparison. Independently recomputed all three source hashes and every listed raw receipt hash: no mismatch. Canonical Jest JSON confirms **355/355 tests, 5/5 suites, zero failures/pending/todo**; AST checks all pass. Recorded backend/lint typechecks and scoped ESLint exit zero. Earlier bootstrap/path failures remain preserved and unaccepted.

| Requirement | Finding |
| --- | --- |
| Original tuple and server-derived request | Internal prepareModelOperation accepts only original Attempt plus ordinal. It sequentially invokes executionContext and the unchanged completed/begin/start bodies, deriving messages/context/instructions from verified current execution. Native validators and old registrations remain. |
| Atomic state and replay | Actual fixture compares the original four-handler sequence with the combined mutation, including full DB/component/scheduler state, exact request/semantic/ordinal and lease extension. Prepared exact replay starts once; changed request conflicts; completed output replay rechecks saved pins and makes no writes; started/UNKNOWN remains refused. A committed started operation with a lost reply gains no retry/refund/not-dispatched privilege. |
| Guards and rollback | Authority/scope/epoch/definition/tombstone/input/attempt/lease/cancel/source-witness negatives use actual handlers. Faults after real operation-start, lease/execution writes and component reads assert the hook was reached and the entire parent rolled back. Late revocation/input edits prove start's repeated original hydration remains. |
| Fresh later execution | model-owner routes the actual combined mutation transaction, then requires original fresh hydration and ledger resolve; obsolete initial completed/begin/start RPCs are absent. AST and scoped diff preserve the entire subsequent modelStep suffix, contextHandler, Gateway resolve/admit/bind/checkpoint/visibility/terminal/attachment and Workflow/finalization paths. No model/funding/schema/public selector or paid-call change. |

| Dimension | Score |
| --- | ---: |
| Requirement fulfillment | 4/5 |
| Test quality | 4/5 |
| Completeness | 4/5 |
| Code quality | 4/5 |
| Pattern adherence | 4/5 |

Average **4.0/5**. No candidate fix required.

Frozen source bindings:

- `convex-dev/runtimeAgent.ts`: `b495dd91a7c967660268ae1e2944b343165c95b5caff64fa207de3a1084bfb47`
- `tests/unit/runtimeAgent/execution.test.ts`: `e95f489bfb3d0e098c0b48363eb2a70f60ec292cb2dbd7b79c4271299c63338e`
- `tests/unit/runtimeAgent/model-owner.test.ts`: `664f1d3674db89785492922499a1dd210c271e0243749bca89dde46f7b5ee19d`

Proceed with ordinary immutable artifact/installed hosted qualification and canonical client measurements. Controlled fixture rollback and static equivalence do not establish native conflict scheduling or timing; preserve original interruption ambiguity, guards and every prior failed interval. No additional custody/controller or routine-artifact review gate is introduced.
