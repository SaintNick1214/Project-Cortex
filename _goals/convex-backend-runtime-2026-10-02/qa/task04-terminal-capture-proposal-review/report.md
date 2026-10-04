# Task Judgment: minimal terminal capture proposal

## Verdict: scoped DESIGN REJECT

One bounded accounting gap blocks approval. Atomic capture on the existing attempt row is a sound direction; it does not need a new table or worker. This judgment covers the NEW proposal only, not accepted C2, actual native execution, Gateway, models, full Task04, full03 or the goal. Execution authorization and the numeric cycle waiver do not waive privacy, trust or accounting criteria.

## Evidence Review

Reviewed terminal-capture-preparation/report.md and source-evidence.json, Gateway integration preparation, current native ledger/schema/root/API and in-progress Gateway terminal composition, against AGENTS/runtime/profile/judge-task, approved implementation prompt, goal, decision register, architecture §6/§9 and original Task04. Exact fingerprints and verification scope are in source-evidence.json and manifest.json. Gateway is a changing observation, not a frozen or accepted candidate. No application checks/services were run.

## Issues Found

### Critical (must fix)

1. **Unknown→known liability has no authorized path after origin revocation in a live scope.** Proposal lines13/15 prohibit different canonical capture receipts, then delegate refinement to admin recover or positive-retirement reconciliation. Concrete trace: capture a qualified terminal with costSource=unavailable; R becomes uncertain, slot releases once, attachment closes. Revoke origin grant while tenant/space remain live. Later trusted producer learns reliable full C for that same terminal. Capture conflicts because canonical cost fields differ; ordinary settle calls currentAuthority (runtimeModelPolicy.ts:629); recover calls liabilityAuthority requiring admin (:598–601,625,690); deployment reconciliation calls retiredScope requiring positive retirement (:624,670–685). Neither an admin nor tombstone is established. C therefore remains unrecorded even when known; if C>R, overrun is not latched. Conservative R retention is safe for an unknown, but does not fulfill known-full-charge accounting once knowledge improves.

   **Minimal repair:** explicitly extend the same trusted internal capture mutation to one narrowly checked unknown→known refinement, or specify an equally narrow internal accounting-only helper reachable by the trusted producer. No new table/worker/admin credential is required. Keep initial terminalEvidenceCanonical/hash and evidenceId immutable. Permit only addition of qualified supported money to the same stored attempt/dispatch/root/provider-terminal identity; pin non-money outcome/model/interface/provider receipt ID and already-known usage/actual-model facts. Specify absent-to-known compatible evidence fields and reject contradictory values. Atomically replace uncertain R with full C in original operation/run/tenant windows, preserving already-released slot, latching overrun, creating final receiptCanonical/hash once, and leaving attachment closed. Exact duplicate final refinement must have zero deltas; different final known cost must conflict. Recheck immutable proof, not application grant/admin/positive-retirement authority. Add the live-scope revoked-origin unknown→known C150/R100 case, concurrent refinement, lost-response retry and conflicting refinement to offline and actual-native plans.

### Important (should fix)

2. **Specify coexistence of attachment state with legacy settlement explicitly.** Proposal lines15/19/23 retain ordinary settle/recover/operator routes and require shared accounting, but the current first-known settle path (:648–666) can store a private result without consulting resultAttachmentState; writeUnknown (:579–595) can overwrite terminalEvidenceCanonical. During the repair, require all routes to preserve captured initial evidence and closed attachment state, and require captured-row private result writes to use attachTerminalResult exclusively. Legacy rows may preserve already-stored results, as proposed. Add an ordinary-settle refinement carrying privateResultCanonical after unknown capture and grant renewal: money may settle under its proper authority, but no result may attach/replay and no initial evidence may change. This is a concrete compatibility requirement for the existing helper, not evidence that the unimplemented proposal already exposes data.

### Minor (consider fixing)

3. State explicitly that first capture accepts dispatch_pending/uncertain, whereas exact duplicate capture also accepts settled/confirmed_rejected; proposal line13 otherwise gives competing state rules. The duplicate path must retain exact canonical equality and existing attachment state.

## Original criteria mapping

| Original Task04 requirement/acceptance | Proposal design disposition |
|---|---|
| Registered chat/extraction/conflict/title/memory/query/text/code/sheet/suggestion/image/video operation keys | Unchanged existing policy scope; this proposal adds no operation or provider path. Whole-task completion is not certified. |
| Trusted layered policy, pinned model/interface/prompt/options/token/tools | Stored snapshot/root and real checkpoint are required; retain immutable historical qualification for incurred liabilities. No new dispatch permission or caller trust boolean. Actual qualification remains separate. |
| Atomic run/tenant/operation money and concurrency; known once, unknown conservative; safe fallback | Known-first capture/full overrun/original-window and unknown terminal slot semantics are specified. Later-known revoked/live-scope path fails until issue1 is repaired. |
| Distinct allowed function models, correlated audit, zero hidden provider bypass | No public capture proxy or service-token route proposed; trusted backend producer and proof recipe remain mandatory. Distinct real models/callsite coverage is outside this review. |
| Concurrent and child/secondary calls cannot bypass reservation/double settle; exhausted quota before token | No reservation/checkpoint relaxation proposed. Duplicate/conflict/OCC/rollback/lost-response cases are planned, not executed; add refinement race assertions. |
| Fallback never repeats visible output/tools/ambiguous paid effects or changes embedding profile | Unknown remains nonreplayable, provider is never retried on persistence failure, visibility is monotone and profile is pinned. Capture/attachment adds no fallback privilege. |
| Trust/privacy/revocation/deletion from goal and architecture | Charge-only strict bounded receipts, original account ownership, no private raw bodies, no caller trust flag/public proxy, healthy current-authority attachment and permanent closure are specified. Legacy helper coexistence needs issue2's explicit enforcement. |

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 2/5 | Known later charge cannot be recorded under the revoked/live-scope case. |
| Design Quality (code quality analogue) | 3/5 | Small atomic design; refinement and shared-helper state semantics need clarification. |
| Validation Plan (test quality analogue) | 3/5 | Meaningful outcome/race/rollback plans, but missing revoked/live-scope unknown refinement and legacy bypass probes. No tests claimed. |
| Pattern Adherence | 4/5 | Internal Convex mutations, optional fields, original accounts and strict receipts; preserves accepted fixture ownership. |
| Design Completeness | 2/5 | Later trusted evidence cannot reach final accounting with the proposed interfaces/rules. |

**Average: 2.8/5.** Judge-task requires REJECT for any dimension≤2. This is repairable within the bounded design, not rejection of the approved architecture.

## Recommendation

Repair the refinement transition and enumerate the captured/legacy helper state matrix; keep the two-field/two-mutation boundary if capture supports refinement. Review the repaired proposal before implementation. Finish/retire the concurrent C2 native packet against its exact accepted hashes before freezing any extension fixture. Separately update Gateway's capture-only sink contract and typed attach port/order: await atomic capture → current-authority attach → eligible final delivery; retain streaming pre-part markVisible and forbid postcapture ordinary settle/markVisible. No production qualification/root, additional service call or user decision is required to repair this proposal.
