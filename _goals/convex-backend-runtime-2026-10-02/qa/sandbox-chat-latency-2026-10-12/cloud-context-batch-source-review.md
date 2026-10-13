# Independent source/test review: context-read composition

2026-10-13. **PASS — 4.0/5 under acceptance-policy v2.** No unresolved breaking finding identified. This accepts the frozen context source/test batch; installed endpoint/native OCC behavior and hosted latency remain pending.

Reviewer authored no candidate code. Read the exact production/test diff, actual fixture/fault ports, preserved-body receipt, raw successful/failed Jest results and type/lint/check manifests. Only this review and the separate JSON/launcher review were written; no candidate/P edits, services, inference, deployment, GitHub or test rerun.

## Frozen inputs and verification

| Input | SHA-256 |
| --- | --- |
| cloud-context-batch-source-report.md | 3e4e2d02bbf008758c0dc7a9e63f2e5ad223e996f9fd59605a3f68d3a170c41c |
| cloud-context-batch-checks-v3.json | cd4b13d67712d80c4d5610415d5c196319249f33430b9e0f5429cfcfde2451a8 |
| cloud-context-batch-jest-final-v3.json | 10da58a668c904ee0822a928fa96494e9d512fd04e0eed9614dccbe8d52bf700 |
| cloud-context-batch-equivalence-v1.json | 2a1f87ebcb5cfcd8c03656697590e3cee3f8221a551c31900bf1abad871086a7 |
| convex-dev/runtimeAgent.ts | 66a21b39c1d07d5bc73ebcf21edf7c1c7a405fe482b4b05ad657367ceaaf0cca |
| tests/unit/runtimeAgent/context-latency.test.ts | 2f0d87c6b1dcd4e006f21decf154088274421b8bf271ce3be7c193521b726a6c |
| tests/unit/runtimeAgent/execution.test.ts | 3a3b5ffd831188bab1fe9f62a9edf6c699c0d87cdeb2091dcdbedfc7d432b324 |

Independently recomputed all three candidate hashes and every listed raw receipt hash: no mismatch. Raw final Jest confirms **116/116, four suites, zero failures/pending/todo**: context 42, inline barrier 7, execution 63, tool context 4. The preserved first result remains **115/116, one failure**; the corrected execution recheck and justified final batch are separate intervals. Recorded backend/lint typechecks and scoped ESLint exit zero with empty diagnostics.

## Requirements review

| Requirement | Finding |
| --- | --- |
| Exact original private tuple | New contextInputs is internalQuery with the original agentAttempt validator and explicit typed reference. It invokes unchanged executionContext with the supplied original reference/run/attempt/lease, then requires started context. No reconcile/current-attempt substitution or caller-derived cutoff/profile/budget fields are accepted. |
| Sequential authoritative reads | Scope/cutoff/history keys/boundary/caps/run account use original expressions. Original pending and indexed-availability helpers run sequentially in the same query snapshot; scans, exclusions, profile readiness and current source/permission checks remain. Candidate/overflow cannot become false empty. |
| Durable overflow order | A real pending overflow returns the marker before availability. The action invokes original failContext then throws CONTEXT_OVERFLOW. The test uses 33 actual fixture sources plus independently invalid profile readiness and asserts availability never runs and failure remains committed after action error. The action is invoked without fictitious parent mutation rollback. Existing `onFailure:'incomplete'` keeps original fallback/incompleteness behavior. |
| Fresh save after I/O | Original saveContext is unchanged. Post-query actual port changes cover grant/expiry, original lease/cancel, input edit and pending source revision/hash/tombstone/ownership; no context/model effects are committed. Awaiting-approval becoming eligible/indexed within the captured cutoff and incompatible profile generation are rejected by the original empty/profile reread. A competing save cannot be overwritten. |
| Retained model/barrier/admission guards | Fourteen AST checks and scoped diff preserve execution/lease, hydrate, start/Workflow, save/start/barrier/failure context, modelStep/beginOperation/recordOutput bodies. Retrieval/current native policy/source/terminal guards and prior admission optimization remain untouched. No generated bindings are hand-edited. |
| Meaningful compatibility/error tests | Empty/pending context, represented/cutoff/future queue exclusions, unknown stages, candidate and bounded overflow, wrong tuple/expiry/tombstone/edit/state, source/index/profile changes and strict barrier behavior use actual registered/shared bodies with controlled ports. The obsolete execution sentinel now intercepts the real embeddingProfile query with the same reference/run budget plus embedding.query assertion and still requires zero model effects. This is a correct port adaptation, not weakened behavior. |

## Scores and limits

| Dimension | Score | Evidence |
| --- | --- | --- |
| Requirement fulfillment | 4/5 | Approved three-read composition is implemented with original binding/failure/save semantics. |
| Test quality | 4/5 | Real controlled handler/helper paths, reached race ports, durable action-failure and no-effect assertions. |
| Completeness | 4/5 | New private query is registered/referenced and affected checks pass; installed registration remains the integration gate. |
| Code quality | 4/5 | Small typed discriminated DTO and sequential helper reuse; no catch/retry/model bypass. |
| Pattern adherence | 4/5 | Existing private Agent references, native guarded reads and fresh mutations retained. |

Average **4.0/5**. No source fix or additional review ceremony is required.

The fixtures prove handler predicates and simulated transactional writes, not native OCC, deployed Workflow/endpoint behavior or faster cloud execution. Fixed query trace timestamps are phase markers and cannot measure CPU duration. Proceed with the ordinary immutable candidate/installed hosted gate and canonical browser/Basic measurements; preserve all original red intervals, K4 failed memory and the still-unachieved subsecond target.
