# Task Judgment: Packet C first offline Gateway helper

## Verdict: REJECT

Scope: independently judge the frozen unwired ordinary helper only. This verdict does not judge or certify the native terminal proposal, actual Gateway/models/currency/U/K or full Task04. Source runtimeGateway.ts SHA efb337e4ba177d267a714ee317b346a6934c69b59fb5046514bea8f8a97c3139; candidate test SHA 36acc9a18166e15516533e44df4d7a6733faddf6f085d8435f86ff3113ea9b2a. No source drift found.

## Requirements Review

| Requirement | Met? | Evidence |
|---|---|---|
| Final native normalization and exact admitted/checkpoint identity | Yes, offline envelope | :142–184, :235–250; candidate normalization, hostile descriptors/options/profile and official injected-fetch assertions |
| Deny/replay/inflight/uncertain/quota before closure/token; stable ambiguous child | Yes, offline | 56 candidate tests pass, native token lookup prohibited; child ordinal stays bound; no fallback/retry branch |
| Known charge capture before authority-sensitive visibility/settlement | Yes for required capture-only composition | :261–281; sanitized receipt-only capture, revoked delivery withheld, retained persistence retry; no native registration exists |
| Correlated genuine terminal and private output/reasoning hygiene | Yes for synthetic plain envelope | genuine finish_reason/ID/model required; no EOF proof; narrow text/default-profile vectors; raw/reasoning/request metadata stripped |
| Cancellation suppresses future local stream delivery | **No** | hostile-c2 test fails: paused visibility completes after owner cancel, then downstream text-delta “answer” is emitted |
| Owned stream lifetime/deadline bounded across awaited visibility | **No** | deadline-c2 test: timeout20ms, at70ms owned signal aborted but complete unresolved; releasing visibility then emits “answer” |
| Replay current-authority check and narrow payload; conservative cost units | Yes, offline | explicit resolve replay, exact profile, no fabricated native replay; cost unavailable != zero; outward exact rational conversion |
| Production/native integration candidly incomplete | Yes | capture-only server-code sink UNWIRED; atomic capture/accounting needs attachment port/order change; production root empty |

Original Task04 operation registration/policy/reservation/settlement/fallback and distinct-model actual audit completion remain required. Accepted B and pure packets supply bounded earlier prerequisites; this helper does not prove every operation or actual model behavior. No original requirement is waived.

## Evidence Review

Read AGENTS, runtime/profile, pessimistic-judge/judge-task/feature-orchestrator, original implementation prompt/goal/Task04, authoritative decision gates/architecture and candidate report/API/freeze/source evidence. Reviewed installed official AI7 v4 wrapping and Gateway token/provider construction and candidate native-transform outcomes. All 163 candidate recursive manifest rows and all 16 accepted B fingerprints match. Source authority captures installed transforms/config/package hashes. Examined 39 historical command receipts: 8 nonzero exploratory results, all raw streams present; preserved failures match the candidate’s disclosed history.

Independent Node v24.19.0 checks use local binaries and sanitized PATH/TMPDIR/NO_COLOR only, no services/network/credentials/Git. One candidate test file discovered; 56/56 pass with zero pending/skipped. Scoped strict types and owned lint pass with zero warnings. Each unique attempt includes exact argv/cwd/UTC/raw output, source/config/discovery fingerprints before/after; all stable. Review setup failures are preserved: initial hostile config omitted .js mapping and produced zero tests; first deadline fixture attempted frozen snapshot mutation. Corrected configurations/new files retain originals. Both corrected hostile tests execute one test and fail on candidate behavior, not setup.

## Issues Found

### Critical (must fix; blocks PASS)

1. **Late stream delivery after cancellation** — convex-dev/runtimeGateway.ts:348–351 awaits markVisible and then enqueues without checking state.controller.signal.aborted. An abort may occur while a valid authority RPC is in flight; buffered native output may remain even if the official native fetch honors abort. This is independent of the provider’s ability to reverse inference. Reproduction hostile.test.ts cancels while visibility is paused; downstream receives a delta afterward, while known terminal charge is correctly captured. Add an owned cancellation fence before/after awaited delivery work and before every observer enqueue; suppress delivery while retaining bounded charge observation. Extend candidate assertions to this race.

2. **Deadline does not bound an in-flight visibility wait** — :320 cancels the native reader, but :348 can remain suspended indefinitely on ledger.markVisible, preventing lifecycle.complete from finishing and delaying cleanup. Corrected deadline-c2.test.ts observes signal aborted at the20ms deadline, complete still unresolved at70ms, then late delivery after releasing the RPC. Bound/join the authority work under the owned lifetime, isolate a late RPC response from delivery, and define conservative liability when genuine terminal observation cannot finish within the bound. Also inspect capture/settle waits under the same ownership contract rather than treating native-reader cancellation as a whole-action deadline.

These are observed defects in the bounded helper, not objections to its intentionally unwired status. Do not simply discard charge evidence or blindly replay to fix them.

### Important

- Preserve capture-only ordering. Future atomic capture/accounting must consume evidence/accounting disposition via separately reviewed authorized result attachment; structural compatibility with capture({..})->{evidenceId} does not suffice.
- Native root/model/cost/currency/U/K and caller lifetime ownership remain unqualified. Real registration/codegen and original-window no-delivery reconciliation remain later gates.

### Minor

No independent minor finding required.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 2/5 | Two explicit helper cancellation/lifetime guarantees fail hostile outcome tests |
| Code Quality | 2/5 | Awaited visibility is outside deadline bound and lacks post-await cancellation fence |
| Test Quality | 3/5 | 56 useful outcome tests pass, but current abort test relies on provider stream error and misses buffered/in-flight delivery race |
| Pattern Adherence | 4/5 | Backend-only injected ledger/sink, official native wrapping, stable identity, scoped privacy; lifecycle race needs repair |
| Completeness | 3/5 | Permitted unwired boundary explicit, but bounded helper lifecycle itself not complete |

**Average: 2.8/5.** PASS requires every dimension>=4 and requirements=5; threshold is not met. REJECT follows the <=2 rubric without inferring a secret/auth exposure.

## Recommendations

Repair cancellation/deadline fences and bounded authority waits in owned implementation scope, preserve native charge/liability semantics, add meaningful controlled buffered stream/visibility regressions and obtain fresh independent judgment. Do not wire native capture/accounting until the separately reviewed attachment/order change is implemented. Full Task04 and the seventeen-task goal remain incomplete.
