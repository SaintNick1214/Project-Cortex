# Task Judgment: Frozen Task04 C2 native source preparation

## Verdict: REJECT — SOURCE PREPARATION ONLY

All three C2 capsules still contain an HTTP dispatch path that bypasses the required fresh consumed-source and target checks. The exact `scripts/peer.mjs:5` reserves a ticket and immediately calls `fetch()` using the session's saved target. `scripts/guard.mjs:52` authenticates the private review bytes in `reserveTicket()`, but does not refresh the operational freeze, consumed graph, target, private environment or publication. A valid original external approval pin therefore does not stop a peer dispatch after consumed operational bytes change.

This review independently reproduces that defect against all three exact final guards and exact final peer modules. The genuine original DUMMY full baseline passes `reviewed()` and `preservationPreflight()`. Only a DUMMY operational fixture is then changed, with the original review and out-of-band expected pin unchanged. Actual `reviewed('rpc')` correctly rejects `QA_SOURCE_DRIFT`. Actual `peer()` nevertheless creates `ticket-peer-other-0001.json` and invokes the DUMMY fetch port once. The unchanged expected-zero-fetch assertion fails exit1 in each profile. No real network, credentials, target, private signer, historical private C11 inputs or native effects were used.

The initial C1 trust defect is separately repaired in the inspected C2 guard. The expected digest now comes from ROOT's external environment; the receipt cannot choose it. This does not repair the remaining HTTP path. Neither C1 SOURCE REJECT2.0 nor PARENT REJECT2.6 is superseded by approval here. Native, paid/default, product, Task04, full03, text/UI, all17 and goal acceptance remain unavailable.

## Frozen subjects and complete byte evidence

| Profile | Whole QA rows / SHA256 | Operational rows / freeze SHA256 |
|---|---|---|
| extension |471 /36bfb9f5ef1f1f6a4f74310fe4cfc7002edcdfeb0efbcb657d5fe903fe9be325|208 /1d6e26709cd7f0cbda78b3c6828373bb890f4f69b6f74afffdcee878e47618a2|
| regression |463 /88f5a2522d80002a39fd4edf35118dffb860bfa169484520ece3ecb25bbd4d43|205 /45398e83f731763dac2a89aa2bc9d2bba15378cc19490795c201311cc9c5ef1b|
| extra |670 /482e8469ee1d413d04a0322bfce14825d9ed44ad73086f3f0a2f0761d0b7ef30|316 /a028ee0445c55c3f4ef8b1b632f9e42b587396dc5cd828591b45857aa9f5d684|

`closure-audit.json` independently reads every row of each subject's manifest and operational freeze, compares bytes/hashes and complete recursive inventories, and verifies all25 unique imported historical whole closures. Only each owning root manifest is excluded; nested manifests are included. Every hash/inventory check passes. The83-row historical C7 whole supplement retains the original80-row manifest. These observations prove preservation, not source acceptance.

Exact common peer SHA256:141580d9099e0d2b90f7a029e26377d00ceac521e8885edbadb7d4f4464d755f. Guard hashes: extension820f988a86a282e0ac47087015f908edfa8948b7bf5ca609aaff3bb5ef907b2b; regressionedf54daef88fa7bf0742c810f8f139acb709eaf16eb6b604384ae86fa9fff19d; extra79e9f3f1113a44c961f2dd28fad422618fba867f1e8880ae7efe51363dd13d64.

Original task/rubric requirements were read before C1 reviews: AGENTS, CODEX-RUNTIME, PROJECT-PROFILE, pessimistic-judge, judge-task; implementation prompt/goal, tasks01/04 and affected03/05/16/17; authoritative decision gates/architecture. SOURCE C1 and PARENT C1 reviews were read as historical failures rather than current authority. The explicit C2 frozen scope is source preparation only.

## Issues found

### Critical: unguarded peer HTTP dispatch

The failure appears in extension/regression/extra `scripts/peer.mjs:4-5`. The helper only calls `reserveTicket()`. It never calls `reviewed()`, `sourcePreflight()` or `livePreflight()`, never compares fresh target/environment/publication bindings to the session, and never checks the shared qualifier deadline. By contrast each `driver.mjs:24` native client call refreshes `livePreflight(phase,'rpc')` after ticket acquisition and before client dispatch, comparing canonical hashes to the original session.

Source drift is the independently executed blocker. Saved-target/publication/environment drift and qualification-window expiry are additional unguarded seams visible in the same exact peer path; they were not executed by this reviewer and are not presented as observed native outcomes. Original five security peer denials reach this helper, and extension/regression crash-boundary peer effects also use it. Source changes cannot be ignored merely because a call is expected to return403 or uses a synthetic no-paid fixture.

Evidence: exact `peer-source-drift.mjs.text`, each `*-peer-source-drift.stdout/.stderr/.receipt.json`, exact source preimages, complete `dummy-proof/` snapshots and `dummy-proof-index.json`. Each owned original expected pin was set before the attacker changed the DUMMY operational fixture, and retained approval bytes remain unchanged. The actual guard's successful full baseline and later RPC denial are asserted, so this is not a fake guard or a label-driven failure. Receipts record real argv/cwd/UTC/source pre/post hashes and1 discovered assertion with0skips. All subject hashes remain unchanged.

### Important: shared transport body cleanup loses resources and primary errors

Exact `scripts/peer.mjs:3` exports `boundedBody()`, also consumed by each driver's Convex transport. It never releases its reader lock. A read rejection is propagated without cancel/release. On overflow it awaits `reader.cancel()` before creating `QA_RESPONSE_CEILING`; if cancellation rejects, the cleanup error replaces the primary ceiling error. There is no local read/cancel deadline or finally cleanup in this helper; the caller's fetch AbortSignal is the available transport bound, not a locally proved body-cleanup guarantee.

Fresh independent four-arm controls execute the exact helper in each profile: healthy exact-body success, reader error, overflow with successful cancellation, and overflow with cancellation rejection. Exact body/normal overflow/primary read identity controls pass, while all4 release assertions fail, read-error cancellation fails and the original ceiling assertion fails when cancellation rejects. Each aggregated expected-quality assertion exits1. All raw failures are retained, with4 discovered arms/profile and0skips, no network. Evidence: `peer-body-controls.mjs.text` and each `*-peer-body.*` file.

`publication-artifacts.mjs:13` contains the same cancellation-before-ceiling/no-release structure in `boundedRawResponse()`. This is a source observation, not an independently executed additional helper test. `parent-inputs.mjs:39-45` uses a distinct stronger helper: remaining-deadline races, primary-error retention, bounded cancellation and release in finally. Its existing body controls do not cover the shared peer/driver transport helper.

## Bounded dynamic-path audit

`dynamic-entry-discovery.json` retains full, untruncated non-offline `.mjs` transport/spawn discovery over all three capsules. This is discovery plus source inspection, not exhaustive execution or an accepted upperbudget proof.

| Entry / path | Inspected placement and consequence |
|---|---|
| driver session and every `s.rpc` client call | Session begins FULL `livePreflight`/preservation. Each client dispatch refreshes RPC source+target/env/publication after ticket acquisition. Native effect is not dispatched by the independently inspected source before that check. Ticket files may be consumed before a subsequent source denial; no reset/retry allocation was approved. |
| peer HTTP | Critical reproduced gap above. Review-byte authentication alone is insufficient for fresh consumed graph/physical binding/window checks. |
| publication native apiSpec query | FULL `livePreflight` and preservation occur at script entry; `reserveTicket()` is then awaited before `client.query`. Fetch wrapper enforces fixed origin/path/method/apiSpec identity, raw body bound and no duplicate capture, but performs no refreshed full/RPC source or physical binding check after that await. This ordering gap requires repair/review; no additional native call was executed. |
| ProcessOwner child/CLI/fault spawning | `spawn()` begins FULL `reviewed()`. It obtains `reviewPin()`, rejects a conflicting child pin before `spawn`, and explicitly injects the exact expected pin. Six total/two concurrent groups; combined256000 output cap discards overflow, retained incomplete/FAIL. Executed conflict/spawn evidence belongs to separate parent review; this judge only inspected these seams. |
| deploy/codegen | FULL live/preservation entry precedes stage creation/copy. Official `dev --once --codegen enable --typecheck enable` runs under ProcessOwner and explicit stage/env. No hand edit of generated files is claimed. EMPTY replaces only bootstrap source in owned stage. Actual synthetic/EMPTY publications are NOT_RUN here. |
| qualify-owned / fault drivers / recovery / cleanup | Native work routes through session/s.rpc; process work through ProcessOwner. Primary scenario failure is emitted before cleanup; at most2 cleanup triples per qualifier finally, with cleanup/close errors retained independently. Child overflow remains incomplete; no outer observer reconstructs discarded bytes. Repeated fault native cleanup and actual process terminal states were not executed. |
| provision/retire management | FULL `preparationReviewed()` precedes configured credential consumption or effects; bounded5-call operation and150s/180s deadline, individual30s signal. API closures have no per-request refreshed review/source check; they parse `.json()`/`.text()` without an incremental local body cap. These are bounded source audit observations, not management execution. |
| parent setup/current watcher | Current physical binding uses FULL live preflight, retired-target denylist, immutable existing window and per-output checks. Setup management uses current-target check immediately before dispatch and stronger body helper. Actual private key, historical private source, targets and storage were never read. Parent's fresh independent verdict is a separate gate. |
| imported task04-native-c8-parent template | Discovered legacy callable management source remains source-bound; it is not assumed to be a selected current launcher. Current ROOT issuance/launcher must establish the exact entry used. No legacy template was executed. |

Direct reserveTicket no-pin/wrong-pin controls, all fresh parent/watch/CLI propagation controls and every source branch were not re-executed here. Their C2 evidence is preserved, not promoted into this judge's independent result.

## Requirement and coverage map

| Requirement | Finding / limit |
|---|---|
| Externally approved initial FULL freeze+complete manifest before trusted baseline | C2 source now checks canonical64lowerhex ROOT env digest against exact private review bytes before latching. Own relocated original C1 expected-denial assertion passes on all3 after coherent changed fixture/full freeze/complete manifest/review substitution with original pin unchanged. Initial owned-directory ENOENT setup failures were retained; same-harness corrected-directory retries pass. No actual ROOT pin or receipt was issued. |
| Every native/HTTP call refreshes consumed bytes and physical binding | FAILED on exact peer path, independently reproduced all3. Publication after-ticket gap identified by source ordering. |
| Complete whole closure including nested histories | Independently verified all3 current and25 unique historical closures with0hash/inventory failures. No failed C1 evidence was removed. |
| Full graph retained, exact disjoint tier union | Independently bytes-verified RPC87/86/89 plus boundary27/25/27 equals FULL114/111/116. Tools RPC4+boundary14 equals18; exact unions/disjoint sets. Fresh esbuild graph/import-metafile re-derivation was NOT_RUN here; declared unions are not independently certified as actual complete transitive graphs. |
| Original22/43 functions and historical security1400+200/174/20/5/storage/public287/3kills;133/76/current160/historical78 | Complete preserved byte closures verified, relevant driver/case/fault seams inspected. Full independent byte-exact function comparison to C1 and historical accepted owners and exhaustive outcome executions NOT_COMPLETED. They remain mandatory, not waived. |
| Extra NEW26/36 hostile/stronger binding/Gateway composition | Inspected exact cases and Gateway adapter: original duplicate whole-state equality, new same-window empty run1binding with no dispatch and subsequent account-guarded denial; known40/150 accounting, full uncertainty, model/token/actualModel-only pending+attached subarms, falseflags/private original admit denial, unknown successor BUDGET_EXCEEDED, real registered-handler synthetic Gateway composition and healthy attachment. Independent all26 and36hostile execution NOT_RUN here; no acceptance follows from samples/declarations. |
| Source static upperbudget2961/444/32/4800/1024/7143424;nested28+1<=37/sharedcleanup40/residual39 | Read full proof and concrete cases/driver/gateway/ownership/guard seams. Allocations fit unchanged3000/465/320/6000/8MiB caps;39 is not retry reserve. Exhaustive independent branch/subarm/create/error/finally/nested count derivation, original extension/regression allocations,1093 serialized encoding witnesses and deadline/window/account reset audit NOT_COMPLETED. No upperbudget PASS or sample-as-proof substitution is issued. |
| Publication/schema/validator287/core memory/data auth templates | Source contains full synthetic/EMPTY official publication and exact schema/argument checks. Actual ROOT generated source hashes/native publications/security remain NOT_RUN. Source acceptance cannot establish defaults or service compatibility. |
| Evidence honesty/final26 pre-post claims | Independently recomputed current hashes against26 declared final source rows:8extension+8regression+10extra, all equal. Read final-offline recorder: genuine prehash before subprocess and posthash after; ROOT external recorder before/after source reads are visible. Earlier post-only/shadow errors remain explicitly non-certifying; equality now cannot prove their historical prehash. Exact own adverse controls have real pre/post receipts. |
| Timing/process/private journal/raw reserve completeness | Source caps unchanged; actual transport latency remains uncertain, not a20m guarantee. Body defects above undermine claimed full resource closure. No real process reap, private journal budget or actual dynamic time acceptance issued. |

## Dimension scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment |2/5| External initial pin repaired, but mandatory per-dispatch consumed-source boundary fails all3. |
| Code Quality |2/5| Peer bypasses fresh source/target guard; shared transport lacks finally cleanup and replaces primary ceiling error. |
| Test Quality |2/5| Existing C2 controls do not prevent demonstrated transport gap; own expected-zero effects and resource/error controls fail. |
| Pattern Adherence |3/5| Owned immutable evidence and correct external anchor exist; transport does not follow driver/current parent guard/cleanup pattern. |
| Completeness |2/5| Preparation cannot release readiness; remaining exhaustive graph/budget/assertion audit remains required. |

Average:2.2/5. Any dimension<=2 and the concrete unmet dispatch requirement require REJECT under the original rubric.

## Recommendation and gate limits

Retain frozen C2 subjects and this review unchanged. Repair only a new independently owned cycle. Give every peer/publication transport dispatch a freshly authenticated consumed-source and target/env/publication/window check at the dispatch boundary after any ticket await, using the unchanged original external expected pin. Preserve the existing no-fetch expected assertion and add actual-source source/target/env/publication/window drift controls. Repair bounded body helpers with deadline-aware cancel/release finally and primary-error retention; keep exact byte caps.

Complete the still-required exhaustive independent source branch/create/error/graph/assertion/budget/journal audit and separate fresh parent review before ROOT can accept a later capsule or issue actual reviewed pin/receipt. No failed gate can advance by exhausting numerical cycles. All native/provisioning/signing/paid/default/product/full-task actions remain NOT_RUN by this reviewer.
