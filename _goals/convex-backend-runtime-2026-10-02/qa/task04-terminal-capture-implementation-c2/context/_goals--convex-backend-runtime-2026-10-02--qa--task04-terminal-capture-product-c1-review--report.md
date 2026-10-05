# Task Judgment: Task04 terminal capture implementation C1

## Verdict: REJECT — OFFLINE PRODUCT ONLY, repairable

**Average 3.0/5. One blocking product finding.** This is a fresh independent judgment of the exact frozen candidate, not acceptance inherited from DESIGN C2 or native B C8. Do not advance this candidate to the extension qualification gate. Fix the unexpected-read-error closure below and obtain fresh independent judgment. Whole Task04/full03/goal, Gateway composition, actual extension OCC/rollback/publication, paid model/token/price/interface truth and UI remain incomplete.

## Evidence Review

Read AGENTS, runtime/profile, pessimistic-judge, judge-task and feature-orchestrator; original implementation prompt, decisions, architecture, goal and Task04; accepted terminal DESIGN C2 and fresh design review; retired accepted native B C8 review and coordinator acceptance; new implementation report, source, tests, diffs and raw receipts. Context preimages and hashes are preserved. Only the new review packet and unique scratch directory were written. No product/test/old-QA/config/generated/Git/environment/credential/network/service/native/paid/UI actions or subagents were used.

Independently verified every producer manifest row: **581/581**, zero mismatches, manifest SHA256 `7d2fee1e3d18c1649a68fce9caf6fcddea45d2fa4a88519ae6ccbfa0a09d42b8`. Independently verified the unchanged original 50,546-byte test prefix SHA256 `51a8a1072ec5d782fcd44fbcd03e1b7010f705568461a30896bbd9a234b39b23`. Exact candidate hashes match runtimeModelPolicy `7a21d64328b7b0f08f91199cf6a714c78432e0db68eb340713d208763871f64b`, runtimePolicySchema `4467a4d4e424fa57cd07de95bce702108765747cfb6afa8a0756fea253926534`, and admission test `be5b87c1c1bb744222c4ca9f4a274279890dcca9443fcfd93bbd6b1177134489` in contemporary command snapshots. Earlier producer crossrealm/default-argument/embedding-profile failures remain immutable; none was excluded or relabeled.

Fresh exact product suite: **122/122 PASS**, one discovered suite, zero skipped/todo/failed. Independent hostile suite: **10 PASS, 1 FAIL of 11**; extended witness run **11 PASS, 1 FAIL of 12**, zero skipped/todo. The second run adds an observation witness and retains the original failing requirement assertion unchanged. It does not turn that failure into success. Fresh affected typecheck and lint both exit0. Node24.19.0/npm12.2.0 observed through prescribed PATH. Every run preserves argv/cwd/UTC, raw stdout/stderr/results and source/config pre/post preimages; all per-command bindings remain unchanged. Standalone setup arrays are empty; no dotenv/service setup. The hostile config deliberately discovers only the review's unique scratch suite. No static-only acceptance or producer-only behavior conclusion was used.

## Issues Found

### Critical (must fix — blocks this gate)

**Unexpected eligibility read failure becomes permanent delivery closure, defeating exact persistence retry.** `convex-dev/runtimeModelPolicy.ts:770` catches every exception in `permittedAttachment` and returns false. `:825` treats that false as positive loss of eligibility and patches pending→closed. These include unexpected DB/read/runtime errors, not only structured authority/policy denials. A healthy pending attempt with unchanged current authority, source, policy and request loses attachment forever after a transient `runtimeModelPolicies` query throws.

The independent hostile test `unexpected eligibility read failure must propagate without permanently closing pending attachment` fails: its expected rejection resolves `{attached:false,resultWithheld:true}`. Separate `read-failure-witness.json` records before/after whole fixture rows, one unexpected write, state `closed`, and after removing the injected read failure the exact healthy attachment retry still returns withheld, with no private result. This is deterministic handler behavior under a synthetic unexpected read fault; it is not a claim about how often native DB faults occur or native rollback.

Accepted C2 requires current eligibility checks plus exact persistence-only retries after failures. A missing/invalid grant or revoked policy can legitimately close pending. An unexpected inability to read eligibility is not evidence that eligibility was lost. Propagate unexpected failures to abort/retry; convert only recognized eligibility denials to false/closure. Add meaningful fault outcomes for attach and the first-capture eligibility decision because both use the same helper. Preserve genuine revoked/retired/cancelled/policy/expired-root closures, money accounting, exact retry behavior and all original assertions. Parent/native rollback and Gateway behavior need their later actual gates after a new freeze.

### Important

No additional independently supported blocker. First capture also calls this helper at `:807`: unexpected reads can choose closed for an otherwise healthy charge. This is the same error-classification defect, not a second counted issue.

### Minor

No separate minor issue is needed to explain this rejection. Existing synthetic transaction/candidate tests are explicitly offline and cannot certify OCC/rollback.

## Requirements Review

| Exact accepted C2 outcome | Judgment and evidence |
|---|---|
| Two optional fields/two INTERNAL registrations; no new table/index/public proxy | Met offline: runtimePolicySchema:42–43 is exactly the two optional fields; new exports at runtimeModelPolicy:773,817 are internalMutation. Schema diff and producer outcome registration/schema assertions retain five tables/eleven indexes. Actual published inventory remains a later gate. |
| Strict bounded charge-only capture, stored checkpoint/root/dispatch/original windows; no caller trust assertion | Met: :141–145 verifies stored immutable compiled root; :773–783 requires checkpoint and stored dispatch/model/interface/proof; strict schema omission rejects private payload, raw fields and added trust flags. Independent caller-trust hostile case denies with exact whole-state/write equality. No provider import or raw/private input storage in capture. |
| First known full C once; genuine unknown retains R and releases slot once | Met: :615–632,668–671,704–726,804–811; producer healthy known/unknown/overrun outcomes verify account and operation deltas and slot release. Unknown/overflow are conservative; receipt proof must be literal provider-terminal-v1. |
| Live revoked origin unknown100→known150, no admin/tombstone/data requirement; original windows and no repeated slot release | Met: producer :599 case plus independent expired historical-root/live revoked case. Full150, uncertain0, concurrency0, overrun, exact original windowId and immutable initial canonical/evidenceId. Historical root expiry does not erase incurred charge; attachment expiry is separately fenced. |
| Initial evidence/hash/id immutable; final once; exact initial and final retries and collisions | Met: :677–701,784–812; producer initial/final digest collision checks compare bytes, conflicting150/151 denies; independent initial retry after late full150 returns latest cost without writes. |
| Only absent compatible actualModel/usage additions; changed/removed facts and intermediate unknown deny | Met: :677–686 with stored model check. Producer additions/removal/changes/unknown variant cases; independent each of all five known usage fields cannot disappear and leaves exact rows/write count unchanged. |
| Ordinary settle/recover/operator/writeUnknown coexistence without initial overwrite/private hydration/reopen | Met: :615–617,729–755,851–870. Producer renewed-grant settle/recover/operator full150 with receipt private payload leaves initial exact and attachment closed; writeUnknown cannot downgrade captured known. Their actor/admin/positive-retirement requirements remain. |
| Partial markers fail closed including replay; legacy valid private/missing state preserved | Met: :487,549,662–665,790–802,819. Producer legacy known valid private and legacy genuine unknown outcomes preserve rows; partial hash/state tests deny. Independent partial-marker admit replay denies zero effects. |
| Legacy non-genuine unknown must not block later genuine first capture | Supported path met: independent proof='absent' ordinary settlement is rejected by schema before terminal evidence storage, remains unknown with active slot1; later genuine capture full40 releases slot. A fabricated legacy terminal row with such proof is not a supported production counterexample and is not counted. |
| Healthy known pending current attachment; parent/source/grant/policy/cancel/profile/limits, closed never reopens | Mostly met: :757–769,817–835; producer source deletion, current narrowing, expiry, text/embedding profile/bytes and renewal tests; independent cancelled parent child capture/attach closes forever with unchanged money. **Unexpected-read handling is unmet at :770/:825.** |
| Attached duplicate exact bytes/current eligibility; revoked withheld; zero money | Met in producer healthy/current/revoked and conflicting-result outcome assertions :579–597 and attach implementation :821–835. Capture/refinement never returns private result. |
| Persistence failures exact-retry without losing valid pending output | **Unmet**, fresh hostile failure and raw witness above. No provider redispatch is exercised or certified. |
| Historical completeness unavailable cannot be asserted by incoming receipt | Met: stored provenance and knownCost use immutable proof terminalCost; producer missing complete monetary support remains uncertain and conflicting upgrade denies. Current expiry closes delivery without destroying historical accounting. |
| Source freeze, original76 prefix, meaningful offline checks and honest limits | Met: all 581 producer rows, exact prefix, fresh122, independent12 hostile outcomes, fresh lint/types and complete raw failure preservation. Actual native extension and Gateway wiring remain pending separate gates. |

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 2/5 | Most exact outcomes have concrete evidence, but mandatory persistence retry/error handling fails and permanently loses pending output. |
| Code Quality | 2/5 | Blanket catch converts unexpected read failure into irreversible state mutation; significant error-propagation defect requires repair. |
| Test Quality | 4/5 | 122 meaningful preserved outcomes plus independent hostile tests/witness expose the missing fault case; no assertions weakened or skipped. |
| Pattern Adherence | 4/5 | Internal typed Convex mutations, immutable compiled root and scoped authority/source isolation; no broader structural boundary changes. |
| Completeness | 3/5 | Offline slice registered and type/lint green, but retry failure blocks the requested product behavior. Later native/Gateway gates remain separately unexecuted. |

**Average: 3.0/5.** Scores≤2 require REJECT under judge-task. This repairable rejection is bounded to this offline product candidate; accepted design and retired native B acceptance are unchanged. Review-cycle waiver does not waive this failure.

## Recommendation

Repair helper error classification within bounded product ownership, retain this failing independent counterexample and obtain fresh successful meaningful fault checks and independent judgment for the new source freeze. Do not treat passing old122, serialized fake candidates or JSON snapshot rollback as certification of this failure or actual extension native transactions. Keep remaining Task04/full03/goal/paid/UI and Gateway acceptance open.
