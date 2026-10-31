# Bounded judgment: Root-authored R8 cleanup bookkeeping

## Verdict: REJECT — 2.8/5

The exact candidate `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-f2-cleanup-bookkeeping-fence-repair8/phase_partition6.py` (27,682 bytes, SHA256 `28df882bbf563f19d01fac3e0209e857d2f9decfae3564ac0dab48ef6ceb4c66`) still permits a secondary cleanup-error recording failure to interrupt owned cleanup. In the physical-close branch it also permits readiness callbacks before the unknown-close latch is set.

This is an independent CODE/HOST review of Root's R8; this reviewer did not author R8. It grants no wholeSource, runtime, functional, private/native or Task03 approval. N1 REJECT2.6, R6 REJECT2.8 and R7 REJECT2.8 remain historical verdicts. No Docker, Linux target, private material, credentials, service, deployment, inference, product or Git effects occurred.

## Findings

### R8-P1-1: Error recording precedes the sticky unknown-close latch

At [phase_partition6.py:484](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-f2-cleanup-bookkeeping-fence-repair8/phase_partition6.py:484), `errors.append(error)` executes before line485 sets `ledger.unknown_close`. When a physical-close RuntimeError is followed by an error-buffer MemoryError, the original function aborts before the latch. All six first/middle/last cases, both before and after SOURCE_APPROVED, leave the latch false and execute later stage callbacks through ACTUAL_READY. First/middle also abandon later owned close attempts. The last case attempts all three owners but retains the failed-close virtual handle and its ledger owner.

Evidence: `independent-control-results2.json` → `freshErrorBuffer.conditions` names `error_buffer_physical_close_{0,1,2}_{SOURCE,SOURCE_APPROVED}`. This models virtual handles; a real close error has unknown physical state. No failed descriptor was retried.

### R8-P1-2: Error-buffer failure stops remaining close attempts

The unguarded appends at [phase_partition6.py:492](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-f2-cleanup-bookkeeping-fence-repair8/phase_partition6.py:492) and [phase_partition6.py:498](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-f2-cleanup-bookkeeping-fence-repair8/phase_partition6.py:498) can fail while recording a release or receipt error. Eight first/middle cases abort after one/two close attempts and skip two/one later owners. Here the latch is already true and callbacks are denied. The physical close of the current owner succeeded; the broken ledger/recording interval must not relabel that success as an unknown physical close.

Evidence: `error_buffer_{ledger_release,close_receipt}_{0,1}_{SOURCE,SOURCE_APPROVED}`. The four last-owner bookkeeping cases pass the obligations: no later owner exists, the latch is sticky, the original error is retained, and callbacks deny.

The added controls use CPython3.14.8 line tracing to replace only the function's local mutable `errors` buffer with a list whose append raises MemoryError. Candidate source, AST, function bytecode, control flow and assertions remain unchanged. A fixture-only preSTOP self-check proves this seam reachable. Each candidate case proves injection occurred and bytecode stayed equal. This is the same fallible list-append class as the repaired receipt recorder; it does not weaken the once-close, original-error or sticky-readiness requirements.

The original RuntimeError remains in the exception context in all18 added cases. Every second close is denied and no descriptor is retried. These passing properties are not findings.

## Coverage and preserved assertions

| Suite | Executed | PASS | FAIL |
|---|---:|---:|---:|
| Original97 plus unchanged independent35/7/26 |165|165|0|
| R7 registration48 plus R8 cleanup48 author regressions |96|96|0|
| Fresh independent R8 lifetime/bookkeeping/physical controls |129|129|0|
| Fresh local error-buffer first/middle/last controls |18|4|14|
| Total observed conditions |408|394|14|

There are no skipped conditions or current oracle setup failures. Suite totals are reported separately; replaying author regressions is not a claim that every condition is globally unique. The original97 wrapper is counted once in the original165.

Fresh129 covers original registration, positive complete close, physical close, receipt append, ledger release before/after commit; first/middle/last; SOURCE/SOURCE_APPROVED; MemoryError, RuntimeError, SystemExit0/nonzero and KeyboardInterrupt; every owned attempt exactly once, no retry, primary error type, physical-versus-ledger state, sticky latch, callbacks and protected-action denial. The added18 inspect the remaining local error-recording seam.

The held AST conservation check passes: only HeldBroker.close differs from R7. All other classes/functions, HeldBroker methods, constants, imports, resource caps, original counts/assertions and phase order remain AST-identical. There is no change to original actual1914/3828, actual114, original preflight/CLI counts, deadlines or service/target contracts. No original assertion was waived.

## Source and receipt custody

The successful replay opened and retained all50 declared Source descriptors before the first member body:579,709 bytes, minimum logged first-capture age298.444073201s. Full EOF, SHA256, exact byte sizes and every literal PRE9/OPEN9/POST9/FINAL9/pathFINAL9 match across all50. All50 remain held through controls and the final full-content fence, then each is closed once with zero close errors. The mature raw consumer independently checks all50 rows and close entries.

Seven raw outputs plus their stopped-writer document were then prospectively captured as one eight-descriptor document cohort after actual max(mtime,ctime) maturity; minimum age297.759257826s,547,280 bytes. All eight descriptors precede any body, full EOF/hash/size/allnine/final match, and all eight close once with zero errors. That later cohort confirms 408/394/14 and the exact per-case evidence.

Native bootstrap and the finite readback tool are ordinary tooling compiled before physical self-admission. Their bytes/debts are explicit, so these intervals are not a claim of wholeSource qualification or an operative source lease. Source descriptors were held through the actual replay/final fence; they were closed before this later documentary judgment. No claim is made that they remain open through human report publication.

### One cumulative accounting ledger

No admission, version or failure debt was refunded:
- Prior carried conservative debt:3,879,788B.
- Root header31,799 + distinct own documentary capture2,155 + failed-E2 header26,465 + failed-E2 Source382,776 + actual signature inspection40,244 + failed-output producer/declaration143,890 + successor authoring pin-read19,489 + successful50 Source579,709 + successful-output producer pin-read544,199 + mature raw547,280 + ordinary finite tool transport8,709.
- Cumulative through mature raw confirmation:6,206,503B.
- The original4MiB manifest,1MiB approval and ONE2MiB DATA reservations remain7,340,032B. Total including those reservations:13,546,535B <67,108,864B.
- Conservative path/FD upper bound including prior166, current50, document8 and32 reserved slots:256 <4096. Current Source peak50; receipt peak8. Largest current body347,105B <16MiB.

The native successful replay receipt starts its local arithmetic at4,507,117B and reports5,086,826B after579,709. Its external authoring pin-read19,489B is retained in this shared accounting, yielding5,106,315B before raw producer/decode stages. This is explicit additive accounting, not a new pool/reset. The finite report publishers are self-excluded until Root's later mature consumer; their inventory includes exact byte debt for any future actual read. This review does not establish fit of the complete F2 graph.

## Preserved setup failures and unknown history

1. The initial prequalification metadata census found one own discovery DOC ctime gap. No member body or candidate control ran, no FD opened, and cause remains UNKNOWN. Its old author tuple/plan/STOP/gap receipt remain immutable. Root authorized a distinct prospective document capture with the same hash/bytes; this does not repair historical custody or refresh candidate/code pins.
2. The document-epoch2 replay held37 inputs and closed all37 once without errors, but a reviewer call omitted the required `original_registration_raw` argument to `cleanup_controls1.run`. The TypeError, raw Source closure and partial prior outputs remain immutable. Its incomplete control interval is not candidate failure or acceptance.
3. The successor's preSTOP fixture-free check initially expected an absolute textual path where the bootstrap builds a relative literal. This setup-only assertion was corrected before STOP and preserved in the self-check document. No candidate control or Source acquisition occurred in that authoring check.

The successor uses a new physical actor/plan/STOP and new output/fixture names. It passes actual held-signature checks before STOP. All37 prior literal Source pins and candidate/code/Root pins remain exact; no prior failed tuple was normalized.

## Original Task03 requirement mapping

| Original requirement | State in this review |
|---|---|
|03A public contracts/inventory;03B backend guards;03C client refresh and scoped negative cases |OPEN; phase CODE/HOST checks do not execute or accept these substeps.|
|Inventory and guard/internalize all public paths |OPEN; no live current-guard exhaustive inventory acceptance.|
|Refreshed host JWT and trusted membership/bootstrap provisioning |OPEN; no private credential/JWT/target operation.|
|Scoped direct endpoints; administrator transcript unlock/canonical store/revisions |OPEN; no application endpoint or transcript execution.|
|Revocation/deletion rechecks, subscriptions/bytes/callbacks/config/shares |OPEN; virtual phase-fence tests are not functional evidence.|

All three original acceptance criteria remain OPEN: alternate-path forged/missing identity denial; cross-tenant subscription/tool/upload/storage denial; revoked/deleted grant stopping later effects/recreation. Task03 functional0/3, goal1/17 bounded Task01 only, product0/12 remain unchanged. Accepted C2 sequencing remains: current03-foundation live acceptance precedes actual04; capability errors and phase source mocks do not close original features.

## Dimension scores for the bounded R8 CODE/HOST contract

| Dimension | Score | Evidence |
|---|---:|---|
|Requirement fulfillment |3/5|Original and repaired targeted seams pass, but error-buffer cleanup/sticky obligations fail.|
|Code quality |2/5|Fallible cleanup recording can abandon owners and bypass readiness.|
|Test quality |4/5|Meaningful actual-source fault outcomes, positive paths and exact Source/receipt custody; tooling self-source qualification limitation explicit.|
|Pattern adherence |3/5|Original caps/order/contracts conserved; whole-lifetime all-owner cleanup remains incomplete.|
|Completeness |2/5|Critical close paths remain incomplete; wholeSource/F2 delivery and original functional criteria are open.|

Average2.8/5. The two P1 defects block bounded acceptance under the judge-task resource-release/error-handling obligations. These are scores for the assigned R8 code contract, not a score or acceptance of full Task03.

## Required next work

Use a separate immutable successor for Root's repair. Latch unknown before any fallible error recording; contain secondary bookkeeping BaseExceptions and continue every detached owned descriptor once; retain primary context; do not retry unknown descriptors; preserve known successful physical closes. Independently replay the original165, author96, fresh129 and the18 error-buffer outcomes. A corrected code verdict would still require the full fitting Source graph, independent dependency judgments and explicit Root runtime gates before effects.
