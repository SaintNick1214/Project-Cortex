# Task judgment: standalone default experiment-control guard C1

## FINAL: REJECT — OFFLINE EXPERIMENT CONTROL ONLY

Two implementation defects violate the accepted capture/lifetime contract. Genuine terminal evidence cannot refine an existing unknown-lifetime receipt unless the new receipt also carries qualified known money. Separately, refinements can change established usage evidence and can append multiple differing terminal receipts. These failures block acceptance of this bounded fixture; they do not justify weakening the contract or proceeding to native/paid execution.

The subject report SHA256 is `06ae793d256cd62af3eeb9cd3f02406b9219b4a26480bafe91164156cd4a38bf`; its complete47-row manifest SHA256 is `a2234bb4a25cf234d1da8628be492b2d6778586619403d3cef16ff865ee83a8b`. Independently checked every row's bytes/hash and compared the actual recursive file set, excluding only the subject root qa-manifest.json. All47 match. All subject and selected source/config preimages are retained. No subject/product/config/test/old-QA/private/env/key/Git/service/network/native/paid/subagent operation was performed.

## Evidence review

Applied AGENTS, CODEX-RUNTIME, PROJECT-PROFILE, pessimistic-judge, judge-task and feature-orchestrator. Read the approved Task04/09/14, implementation and research prompts, decision register and architecture. Read the complete preparation report and source evidence, authoritative initial14 manifest, and fresh proposal-review report (4.4, design/preparation only). Current capture root acceptance accepts BOTH native packets and retirement while explicitly limiting costs to synthetic evidence; this implementation remains offline. Initial14/28overall/$10 engineering controls remain technical limits, not user permission caps. Persistent fresh-instance/no-cap authorization and waiver of numeric review cycles do not waive technical gates.

Preparation source evidence contains201 historical references. Rehashed all201:198 match; execution-progress.md, runtimeGateway.ts and runtimeModelPolicy.ts differ from the older preparation hashes. These are recorded as historical drift, not silently asserted unchanged. Current subject20 reference rows match their declared source evidence. The fixture imports only its own compiled/canonical/guard files and official convex dependencies; the historical mutable Gateway source supplies no acceptance authority here. Actual reference/pre/post verification is retained separately. Of260 frozen paths,259 remain byte-identical at final check; only the coordinator-owned mutable execution-progress.md changed concurrently. All48 subject files (47 manifest rows plus its manifest), all20 current subject references and the immutable source-contract packet files remain unchanged. The status-file change supplies no guard acceptance authority.

Inspected all five fixture sources, standalone schema/config/pins, runner registration, all check scripts and23 baseline assertions before executing a byte-identical fixture/baseline copy in this review's own scratch. Subject scripts that write to the subject packet were never invoked. The harness calls actual registered `_handler` functions, snapshots a single canonical account, checks a shared version before publication, retries conflicting transactions and discards writes on thrown errors. Committed response loss is injected after publication. This is useful outcome evidence, expressly not native Convex OCC proof. Assertions check tickets, calls, slots, liabilities, first evidence and currentness rather than counts alone.

Fresh Node24.19/npm12.2 checks, independent strict fixture typecheck and scoped lint pass. All23 unchanged baseline outcomes pass, zero skipped. Six additional independent hostile outcomes were executed; four violate the contract, two pass. The asserted hostile run exits1 with `4 !== 0`; raw stdout/stderr and argv/cwd/UTC/exit/hashes are retained. A diagnostic run emitting the same six outcomes exits0 because it reports booleans; that exit is not a behavior PASS. Discovery distinguishes the23 baseline outcomes from the6 independent outcomes.

Producer three repaired failures and their preserved preimages remain untouched and are frozen here. Their first two exploratory UTC timestamps were not recorded in files; no invented timestamp is supplied. The producer's deadline-fixture failure has complete raw receipts. Review tooling initially looked for a nonexistent toolchain-bin/node; no check executed in that attempt. The actual ambient Node path was then used. That exploratory invocation lacks a separately recorded exact UTC. The first complete review command set was superseded when scoped lint was added; the final complete command receipts retain exact UTC and raw output, and the separately asserted hostile rerun is appended. These review-tooling limitations do not alter the behavior failures.

## Requirements review

| Requirement | Result | Evidence |
|---|---|---|
| Strict experiment versus production split; no forged production qualification/root or Gateway/product import | Met | hypothesis:true/nonpaid-peer-offline state, fixed internal observation scope; published null peer; scope-injection hostile probe rejects qualification. No actual serving/all-charge truth installed. |
| Immutable compiled14/order/native+wire hashes/U/M/K/profile and fixed account/principal/run/source/target/grant/manifest epochs | Met offline | compiled.ts, exact copied accepted manifest and baseline identity assertions;14 semantic permits/13 native hashes;314310microUSD total. |
| Atomically single-account reserve+checkpoint before closure; fresh enter fence; no replay after committed loss | Met offline | guard.ts reserveCheckpoint/enterPeer; baseline OCC race/rollback/response-loss/currentness tests. Native behavior remains NOT_RUN. |
| One active,14 once-only permits; no15th/new-run/reset/window laundering | Met offline | fixed provision/current/ORDER; unchanged baseline serial/race/no-laundering tests. |
| Genuine terminal slot release once independently of unknown money; retain full K without terminal | **Unmet** | guard.ts:76 rejects lifetime-only refinement; hostile outcomes1/2 leave active C01 despite genuine terminal, with reserved29031/known0 or reserved0/known10. |
| Full qualified amount once before private attachment, late charge after revoke/cancel/retirement, overrun/drift STOP | Met for tested accounting; compatibility defect below | baseline full-charge/usage-overrun/currentness/late-charge cases; no clipped accounting or production qualification inference. |
| First/refined evidence immutable, compatible and once-only; collisions denied | **Unmet** | guard.ts:75–77 compares only firstCapture and never locks refined terminal/usage. Hostile outcomes3/4 accept usage1→2 and three distinct terminal refinements. |
| Invalid proof STOP distinct from absent money; missing usage never converter-zero; unknown active never timeout/EOF terminal | Met on first receipt and tested lifecycle; late terminal defect above | observation validation/STOP, baseline invalid-category/currency/hypothesis/shape tests and pending-peer/entry-deadline outcomes. |
| Capture before attachment; exact principal/dispatch/result hash/profile1536/current source; closed attach never reopens | Met offline | guard attach checks, baseline text/hash/auth/profile/stale-source outcomes. Additional private inspection probe does not disclose attached data. Actual managed write/search remain NOT_RUN. |
| Private/key/vector/prompt never public; all own-data graph validation/getters/sparse/prototypes/cycles/scalars/bounds/detach | Met within Convex plain-value boundary | canonical descriptor-first graph validation, ordered detached serialization, finite bounds; baseline canonical adversaries/getter zero side effects. Internal inspect allowlist; no private/canonical prompts acquired. Arbitrary JS Proxy traps outside declared Convex boundary. |
| Finite owned entry/peer/capture/cleanup tasks and retained late handlers, no effect revival | Met offline | runner lifecycle/abort/currentness fence; baseline pending-peer/late-charge/late-checkpoint and error-handler tests. Actual native factory/stream/token driver is NOT_IMPLEMENTED. |
| Published action fails closed before reserve/token/factory | Met | registered authenticated public action buildRunner(null), baseline state unchanged on OFFICIAL_NATIVE_DRIVER_NOT_IMPLEMENTED. |
| Evidence completeness/discovery/failures/refs | Met with disclosed timestamp limitations | subject47 complete, frozen/pre-post checks, raw receipts, baseline23+hostile6 discovery; historical references not mistaken for current sources. |
| Preserve remaining original tasks/defaults/scope | Met as scope preservation | No Task04/full03/text/UI/all17/goal PASS; actual official Gateway driver/target profile, native guard proof, paid serving/currency/category/all-charge evidence and managed1536 write/search remain separately REQUIRED. |

## Issues found

### Critical: supported terminal-only refinement is rejected

At fixture/convex/guard.ts:76, every later receipt must have money `qualified-experiment-observation`, nonnull microUSD and qualified monetary fields. This executes before the independent lifetime handling at87–88. Reproduction: reserveC01; capture unknown lifetime with unknown money/null amount; capture genuine terminal with the same unchanged unknown money. Actual: CAPTURE_COLLISION rollback, activeC01 and slotReleased:false, reserved29031 retained. Expected: preserve full K, release the slot once from supported lifetime, preserve immutable observations, allow the next fixed permit only if all other controls remain valid. The same defect retains the active slot after prior known10 when a later genuine terminal carries unavailable money.

Implement independent monotone lifetime and monetary refinement with compatibility checks. A newly supported terminal must not require a newly available amount. Retain any already-known charge and any still-unknown reservation, without double release/settlement or reopened result authority. Keep invalid-proof STOP and malformed/unvalidated lifetime conservative. Add real-handler regression assertions for both sequences.

### Critical: incompatible and repeated terminal refinements are accepted

At guard.ts:75–77, comparisons use firstCapture instead of the complete accumulated immutable evidence. The condition checks amount/terminalId/resultHash but omits established usage equality and a completed terminal refinement fence. Reproduction: first unknown-lifetime/unknown-money usageInput1; refine to known10/genuine-terminal usageInput2. Accepted. Starting with compatible usage1 terminal refinement, additional terminal receipts with usage2 and usage3 are also accepted; refinements.length becomes3 while known stays10 and slot is released. Money is not double charged, but contradictory evidence is blessed and the claimed once-only compatible receipt semantics fail. Repeated distinct receipts can also grow the stored account until its finite canonical bound stops persistence.

Freeze previously established usage and all other immutable observation fields; permit only documented independent unknown→known/lifetime transitions, and exact replays of accepted evidence. Reject further differing receipts after those transitions complete, without modifying account/evidence. Add conflicting-usage and multiple-terminal-refinement regression assertions. Do not weaken the baseline23 assertions.

## Dimension scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 2/5 | Independent lifetime/refinement requirements fail reproducibly. |
| Code Quality | 3/5 | Small typed/internal/failclosed implementation; central refinement predicate conflates money/lifetime and misses evidence consistency. |
| Test Quality | 3/5 | Baseline23 meaningful outcomes pass, but omit the four adverse sequences found independently. |
| Pattern Adherence | 4/5 | Canonical single-account Convex boundary, private allowlists, official registration and experiment separation preserved. |
| Completeness for bounded offline implementation | 3/5 | Sources/registration/evidence present; blocked capture branches prevent complete bounded acceptance. |

Average **3.0/5**. RequirementFulfillment<=2 requires **REJECT** under judge-task. No PASS_OFFLINE_EXPERIMENT_CONTROL_ONLY can be recorded for this packet.

## Recommendation

Return these two precise capture defects to a bounded executor, preserve this rejected frozen packet, rerun unchanged23 plus the missing adverse lifetime/evidence cases, then obtain a fresh independent review of the repair. Root's separately reviewed Gateway/native driver and verified target remain next only after their own required PASS gates. No native/paid/model/root/managed readiness follows from this review.
