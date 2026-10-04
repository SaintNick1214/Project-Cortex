# Task Judgment: Task04 offline native admission ledger C1

## Verdict: REJECT

Scope: only the frozen offline native policy/admission/accounting implementation. This is neither whole Task04 nor native atomicity/publication nor a Gateway price/model verdict. The empty production trust root correctly fails closed. No credentials, network, services, deployments, models, Git writes or product/test/config/generated edits were performed. Reviewer writes are confined to this new QA directory and unique work/resume/task04-admission-c1-review scratch.

## Issues Found

### Critical (blocks PASS)

1. **Current operation budget is bypassed by fresh fallback.** `convex-dev/runtimeModelPolicy.ts:739` compares cumulative operation spend against `nextSnapshot.limits.operationBudgetUnits`, inherited from the original snapshot; it omits the current resolved operation ceiling. A trusted tenant policy narrows the ceiling from200 to100 after a confirmed-rejected charge40. `admitFallback` reserves80, making120 of charge plus reservation, and `checkpoint` returns `dispatchPermit:true`. Original admission at line464 correctly takes the minimum of pinned/current operation ceilings. Fix fallback cumulative accounting to apply the current narrowed operation limit, retaining once-only prior spend; deny before any write/permit. Also fence policy narrowing after fallback reservation and before checkpoint.

2. **Revoked fallback permission remains executable.** `convex-dev/runtimeModelPolicy.ts:713` uses `fallbackAllowed` with the original pinned snapshot and checks only the current allowedModels list. A current authenticated tenant policy sets `fallbackModels:[]` while leaving the candidate generally allowed. Fresh fallback still reserves80 and checkpoint returns `dispatchPermit:true`. Current allowed model selection is not current fallback authorization. Require the candidate to remain an explicitly eligible compatible fallback under current policy at fresh fallback admission and checkpoint; update `checkFallback` to report current eligibility consistently.

Both are observed behavioral defects, not speculative native OCC or pricing objections. `hostile02` has two outcome failures showing reservations resolved instead of required denial. `hostile-dispatch03` independently records correct known40/reserved80 totals and two failing assertions because both forbidden checkpoints returned true. No actual dispatch occurs.

3. **Checkpoint does not fence aggregate narrowed budgets/concurrency after reservation.** `convex-dev/runtimeModelPolicy.ts:510`–530 checks current request-local limits but does not compare live accumulated operation/run/tenant liability or active concurrency against current narrowed ceilings. Independent fixtures first reserve two100-unit children (total200, active2). Trusted current policy then narrows operation ceiling150, run ceiling150 (operation150), tenant ceiling150 (operation/run150), or concurrency1. Each checkpoint returns dispatchPermit:true for the reserved second child. Separately, a valid fallback80 reserve followed by fallbackModels:[] also returns true. `hostile-postreserve04` observes5/5 failures; `hostile-postreserve-trace05` repeats5/5 with full synthetic before/after attempt snapshots: each performs one write and changes reserved to dispatch_pending. Expected no-effect comparisons fail; no upstream call occurs. Fix current aggregate monetary/concurrency constraints and fallback eligibility at the permit boundary, preserving existing liabilities. Do not blindly reuse fresh capacity checking, since an already-held reservation must not be added twice.

### Important

Existing54 ledger outcomes omit these legitimate trusted policy transitions, including updates between reserve and permit. Add product regressions with no-write/no-reservation/no-permit assertions, including narrowing between fallback reservation and checkpoint. Preserve original requirements and source evidence rather than treating policy pins as permanent permission.

### Minor

No additional minor finding is needed for this verdict.

## Requirements Review

All original Task04 rows remain required. “Offline met” below only describes the accepted slice boundary, never full completion.

| Original requirement / criterion | Offline finding | Evidence / remaining gate |
|---|---|---|
| Register all13 operation keys including secondary/artifact/media operations | Offline met | Accepted immutable pure registry and runtime validator; current385-test rerun. Actual Gateway callsite coverage remains NOT_RUN. |
| Trusted deployment/tenant/agent/operation policy; model/interface/prompt pins; options/tokens/tools | **Unmet for current fallback policy** | Current tenant policy removal fails to prevent fallback permit. Empty compiled trust root, exact root canonical provenance, narrowed tenant admin controls otherwise reviewed. Dynamic current Task05 executable definitions are deferred through typed same-context hook, unaccepted. |
| Atomic run/tenant budgets/concurrency; once-only known settlement; uncertain liability; safe fallback | **Unmet for narrowed current operation budget** |40+80 exceeds current100 with permit. Shared tenant/run native MutationCtx writes and385 fake outcomes otherwise pass; actual native OCC/rollback remains NOT_RUN. |
| Distinct functions select allowed models, correlated receipts, no hidden direct-provider bypass | Offline bounded wiring met | Pure snapshots, root provenance, internal-only registrations; actual model/interface/Gateway bypass census NOT_RUN. |
| Concurrent/child submissions cannot bypass reservation/settle twice; quotas before token | **Offline bypass observed in fallback current budget** | Fresh fallback is a newly reserved child attempt; no token/model execution present. Existing duplicate/hash/parent/account tests pass, actual native losers/concurrency NOT_RUN. |
| Fallback never repeats visible output/tools/ambiguous jobs or changes embedding profile | Existing offline monotone/safety tests met; current authorization incomplete | Terminal/no-dispatch proof, visibility flags and immutable default embedding profile reviewed; revoked current fallback authorization still permits execution. Actual stream/tool/model fault gate NOT_RUN. |

## Detailed Boundary Review

Production `runtimeModelPolicyBootstrap.ts` uses an empty immutable registry, reference identity and reviewed-actual classification: no arbitrary selector certifies monetary truth. Fixture mock supplies a synthetic object-identity root and is expressly excluded from live qualification. Tenant overrides are generated by current tenant-wide administration and checked against deployment hard bounds. Agent selectors use a typed current composition hook; no standalone executor/transcript store or generic public admin dispatch is introduced.

Exact canonical identities protect replay/account hash collisions. Requests and receipts are UTF8 bounded; surrogate checks and final normalized input proof derive U independently from caller estimates. Whole-call reserve K remains a trusted qualification ceiling. Single-value1536 embedding result allocation is bounded; actual serialization/tokenizer/framing truth is not established offline.

Settlement records full known cost and overrun, strips private payload from audit identity, validates narrow private text/vector results, and charges original immutable windows. Unknown paid liability retains money; only qualified terminal proof releases a slot. Original grant/source deletion denies private delivery without erasing liability; scoped administrator recovery is private. Deployment retirement reconciliation positively reads canonical scope deletedAt/tombstones; absence alone cannot authorize it, live scopes are denied, and tenant/space retirement tests charge150 against100 exactly once without result hydration or revival. Registration source/flags remain internal; actual publication must still prove no public proxy.

Original schema26 tables/173 normal/8 search-vector configurations are preserved by additive spread, five private tables/11 normal indexes added,31/184/8 final. Reviewed schema-audit02 raw output and schema/table validators/index use. No generic admin table or dispatch widening found.

## Independent Checks and Failures

| Check | Observed result | Scope |
|---|---|---|
| dependencies01 | PASS6 suites,385/385,0 skipped | Final frozen54 ledger + pure policy + four runtimeMemory dependencies; fake DB only |
| types01 | PASS | Strict scoped backend and owned test typecheck |
| lint01 | PASS,0 warnings | Five owned product/test files |
| toolchain01 | PASS npm12.2.0 | Prescribed CLI; Node observed24.19.0 |
| hostile01 | FAIL setup only |2 tests failed before intended behavior due reviewer canonical undefined;54 filter exclusions. Preserved, not product evidence. |
| hostile02 | FAIL2/2 meaningful probes |2 actual forbidden fallback reservations observed;54 filter exclusions not counted as validation |
| hostile-dispatch03 | FAIL2/2 meaningful probes |Both forbidden dispatch checkpoints return true; known40/reserved80 assertions pass;54 filter exclusions |
| hostile-postreserve04 | FAIL5/5 meaningful probes |Narrowed operation/run/tenant/concurrency and revoked fallback after reservation all permit;56 filter exclusions |
| hostile-postreserve-trace05 | FAIL5/5 repeated probes |Before/after snapshots show each forbidden permit adds one write and dispatch_pending;56 filter exclusions |

All check attempts have unique directories with pre-execution argv/cwd/UTC, comprehensive source/config/discovery hashes, raw streams, result, posthashes and preserved scratch config/probe snapshots. No source changed during a check. Final source-freeze.json confirms every implementation authority hash still matches; five product files are exact. Complete artifact hashes are in qa-manifest.json. Existing implementation failures (early type rootDir, fake prototype/canonical contract setup, initial same semantic-ID fixture, lint unused validator, expected privacy red) were retained and reviewed with later successful receipts; none is silently promoted to PASS.

Root build/packed-contract checks were NOT_RUN because this native-only change adds no SDK/browser export and rebuilding would overwrite preserved accepted C11 dist without relevant additional proof. Root checks already recorded for earlier candidate are not claimed against final retirement source. Actual native OCC/concurrent rollback/faults, official codegen/bindings/publication, current target visibility, Gateway cost completeness/token/framing qualification and paid model coverage are NOT_RUN. Whole04/full03/goal remain incomplete.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment |2/5|Current policy/budget obligations fail in fresh fallback and postreservation checkpoint |
| Code Quality |2/5|Stale policy used at fresh fallback reservation and permit boundary |
| Test Quality |3/5|385 meaningful existing outcomes pass, but fresh and postreservation policy transitions absent |
| Pattern Adherence |4/5|Additive private native tables, trusted control checks, internal registrations and immutable evidence |
| Completeness |2/5|Offline fallback admission/checkpoint behavior requires fixes; deferred live obligations explicitly retained |

**Average:2.6/5.** Requirement Fulfillment5 and all dimensions>=4 are required for PASS. This source freeze cannot authorize native fixture implementation through an accepted offline gate.

## Recommendation

Fix current fallback permission and cumulative current operation/run/tenant/concurrency limits at reservation and checkpoint, add meaningful regressions, rerun affected credential-free tests/types/lint, then obtain fresh independent judge PASS with new frozen hashes. Only after that and final parent verification should the separately reviewed bounded synthetic native fixture proceed. Native accounting proof can use synthetic nonpaid costs without requiring timeless pricing/protocol guarantees; actual Gateway/model readiness remains a separate gate.
