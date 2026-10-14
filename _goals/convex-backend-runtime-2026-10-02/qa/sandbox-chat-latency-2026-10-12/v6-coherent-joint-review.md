# Task Judgment: coherent V6 execution, embedding and admission

## Verdict: PASS

One independent nonauthor source/test/docs gate under acceptance-policy v2. **Requirements4, code4, tests4, patterns4, completeness4; average4.0/5. Zero breaking findings.** Acceptance covers the frozen source batch only. Hosted V6 functionality, latency/SLO and final-goal acceptance remain open.

Product baseline is `f7c906b2888a410deb81c6a181e4863ca148e43c`; current QA-only HEAD is `0cb6f10d0697f5143d3c6a660fb79822d61f26d9`. The exact19-file packet SHA is `143131b3a3f002a81ab5213fa91bc3a713104cc6f1ec321b7b5cc4f66af93486`. All source/test hashes match before and after review. A's final freeze is **cloud-v6-source-freeze.json**, superseding the draft filename. Packet/production hashes are in the companion JSON.

## Requirements review

| Requirement | Assessment and evidence |
| --- | --- |
| Durable ordinary execution without paid replay | `runtimeAgent.ts:238` atomically claims, inserts and schedules the owned Action. `prepareDirectTurn:1061` applies original context/barrier/model guards and fences duplicates. Caught/crashed work uses original failed/cancelled/UNKNOWN disposition and existing lease retirement. Scheduler failure rolls back claim/execution. |
| Strict/history/tool continuity | Strict starts retain V5 waiting/deadline behavior. Twenty literal comparisons retain V1–V5 journals/callbacks and original execution/model helpers. `attachDirectContinuation:1082` uses persisted completed ordinal0; `executeToolsV6:1160` runs original approval/tool loop and later retry:false Actions without replaying first-model inference. Public reconciliation retains current authority and explicit final/continuation recovery. |
| Fresh context and every current fence | Original fresh Agent contextHandler and executePreparedModelStep are restored byte-identically. Actual installed/in-memory Agent evidence shows that the rejected static-hook prototype wrote a pending message after revocation while the original hook denied beforehand. No prepared-hook shortcut or594ms saving is accepted. Original grants/tombstones/owner/transcript/source/profile/cutoff/lease/cancellation/definition/qualification/budget/replay controls remain. |
| Safe private query embedding | `runtimeAgentQueryEmbedding.ts` combines original preflight predicates/two resolutions. Fresh admission rederives exact last-user text, request ID, profile, semantic identity, ordinal0, run budget and reference; mismatched source/parent/request bindings deny. Proposals are data, never dispatch authority. |
| Preserve reservation and recovery boundaries | Original admit runs before an original nested checkpoint. A caught checkpoint refusal commits reservation while its child writes roll back; Action rethrows bounded refusal. Lost reply cannot issue another permit. Charge capture and private attachment remain separate; confirmed UNKNOWN replay uses fresh resolution/admission without another provider call. |
| Preserve recall and clients | Shared tail retains original embedding validation, vector/fact overlap, vector-first ordering/error priority, ranking/bindings, final source/fact/profile/authority checks and Action expiry. Generic recall/ingestion keep their original prefix. SDK admission now uses native pre-session/admission then a separate fresh post-I/O session with original actor/scope/generation/expiry/DTO and uncertainty fences. Original backend endpoint/return remain available; observation is unchanged. |
| Reachable installation/docs | Shared types/lint/build/actual packed exports/declarations/browser/backend checks pass. Built backend158 paths/72 tables/2 components includes exact new registrations. Seven website hashes match; build0 and saved actual IAB DOM/pixels cover admission/performance, warnings/errors0, tab/server closed and port absent. Docs distinguish upcoming V6 from published versions and disclose missing SDK reconciliation wrapper. |

Atomic scheduling/at-most-once Action behavior agrees with [official scheduler documentation](https://docs.convex.dev/scheduling/scheduled-functions). The checkpoint child is intentionally retained for the [documented sub-transaction rollback boundary](https://docs.convex.dev/api/interfaces/server.GenericMutationCtx); replacing it with a plain helper would change failure liability.

## Test and quality assessment

A's final raw result is **1,025/1,025 across29 selected/executed suites**, zero failures/skips/todos. It includes26 direct-action and2 installed Workflow-interpreter cases: exact V5/V6 prompt comparison, fresh pre-dispatch denials, ambiguity/UNKNOWN, duplicate start/dispatch, canonical final recovery, lost tool handoff, approval/ordinal1/replay, cancellation and lease retirement. Installed Agent0.7.3/Convex1.46/convex-test0.0.61 evidence exercises actual handlers/component writes with controlled scheduling and0 paid attempts; it is not hosted scheduler/OCC proof.

Root's native-envelope/SDK cases pass **118/118,2 suites**, retaining post-I/O race/expiry/deadline/no-retry assertions and adding exact actor/envelope/legacy-effects comparison. B's real governed middleware/transactional-port checks pass **47/47,2 suites**, including actual checkpoint denial after reservation, child partial rollback, lost reply, current policy/profile/account/binding refusals, UNKNOWN replay, nonempty vector-plus-fact tail and late final-delivery/Action expiry. Counts overlap and are not added.

Shared Node24.15/npm12.2 root/backend/lint types, scoped ESLint, one build, actual packed SDK/runtime/graph ESM+CJS/declarations/browser/backend contracts and corrected built-root assertions all exit0. Scoped lint has11 SDK warnings; root lint has238 warnings/0 errors. Current frozen source and referenced raw receipt hashes match.

All original red intervals remain red. A's early fixtures, rejected v8 comparison, old physical-count v9 assertion, failed prepared-hook prototype and affected-v1 failures are preserved. Historical Workflow fixtures now explicitly select strict-ready definitions; existing denial/output/journal assertions remain. The resolve registration's3→1 lookup expectation explicitly verifies current f7 identities/arguments and all other read order. B's967/968 expiry failure was a wrongly advanced native clock; the corrected native1000/Action2000 fixture retains the final-delivery expiry oracle. Root's initial envelope differential and shared wrong-export-name assertion failures remain; neither deadlines nor functional guards were relaxed.

## Dimension scores and issues

| Dimension | Score |
| --- | --- |
| Requirement fulfillment |4/5 |
| Code quality |4/5 |
| Test quality |4/5 |
| Pattern adherence |4/5 |
| Completeness |4/5 |

No breaking or important finding. Nonbreaking debt: lint warnings; documented absence of an SDK run-reconciliation wrapper; existing reconcile header could clarify that retained tool continuation may be scheduled while uncertain first-model calls are never replayed.

Proceed to fresh installed fixed four-turn functionality/latency qualification and cleanup, plus the authorized tool/disconnect/reconnect/approval/ordinal1 outcome lane before accepting new hosted continuation behavior. K18 remains **0 latency PASS/4 FAIL** on old f7 source; V6 speed is unmeasured. Follow-up remains **50%**. Judge ran no suites/builds/services/inference/Git/Proofs and edited no product/tests/docs.
