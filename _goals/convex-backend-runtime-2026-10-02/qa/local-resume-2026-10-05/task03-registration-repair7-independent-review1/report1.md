# Independent Task03 registration-fence repair7 judgment

Verdict: **REJECT — 2.8/5**, limited to the Root-authored R7 CODE/HOST contract. The immediate registration fallback repairs the observed R6 ownership gap. Cleanup's own receipt and ledger bookkeeping can still fail without preserving the complete lifetime or sticky denial. No whole Source epoch, integration, Linux delivery, private operation, or functional Task03 gate is accepted.

## Critical findings

**P1 — close-receipt failure abandons later owned descriptors and bypasses sticky phase denial.** In [phase_partition5.py](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-f2-registration-fence-repair7/phase_partition5.py:490), `self.close_attempts.append(...)` runs outside the close/release exception handlers. An injected first append MemoryError stops the actual close loop after virtual FD100, leaving101/102 open; a middle append stops after100/101, leaving102 open. `self.held` was detached at476 and `self.closed` is already true. These failures leave `ledger.unknown_close=false`. The original first guard in `PhaseMachine.advance` at503 consequently does not reject them. Before and after SOURCE_APPROVED, the same mock independently verified original counts/assertions receipt reaches ACTUAL_READY and invokes later mock verifier callbacks. Four first/middle controls reproduce the abandonment; the two last controls close every physical virtual handle but still lose the failed receipt and accept later mock phases. None invokes a real target or protected action.

This directly violates every-owned-close-once on error paths, complete close evidence, and the original sticky no-bypass contract. The rubric explicitly requires resources released on every path and errors retained. Cleanup reporting is part of that lifetime; it must not interrupt later close attempts or permit a failed broker to progress.

**P1 — failed ledger release is aggregated locally without failing the shared readiness state.** At [phase_partition5.py](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/local-resume-2026-10-05/task03-f2-registration-fence-repair7/phase_partition5.py:488), release exceptions are added to a local error list; the shared ledger remains nonsticky. First/middle/last faults immediately before release remove all physical virtual handles but retain the target FD in `Ledger.owned_fds`, even though the broker detached its own map. Close raises `Denied(all_close_attempted_errors:MemoryError)`; every tested subsequent mock phase nevertheless accepts the stale ledger and invokes callbacks through ACTUAL_READY. This is inconsistent ownership/accounting, not proof that the physical close itself failed. Six before-release controls establish this class, on both sides of SOURCE_APPROVED.

Six additional faults after successful release retain no physical handle or ledger owner. They show the same swallowed shared-lifetime failure signal: the broker raises Denied while phases still accept. These are corroborating error-chain/receipt-consistency observations, not six physical UNKNOWN-close claims. A disjoint repair must retain the primary/report/bookkeeping errors, attempt every remaining close once, and latch a conservative shared failed-lifetime state before an exception can bypass guards; never retry an unknown descriptor.

## Meaningful coverage and exclusions

The actual held-byte replay discovered/executed238 conditions,218 PASS/20 FAIL/0 skipped. This comprises the unchanged original97 plus35,7 and26 independent conditions (165 PASS, counting the raw36 original97 wrapper once), the exact author48 regression conditions (48 PASS, scoped author evidence), and25 fresh independent conditions (5 PASS/20 FAIL). Eighteen fresh negatives are the three cleanup seams × first/middle/last × before/after SOURCE_APPROVED; they support the two findings above.

The other two FAILs are **reviewer oracle mistakes**, not candidate findings. `original_gap_1_all_once_cleanup` and `original_gap_2_all_once_cleanup` incorrectly require close order to equal open order. Actual fallback closes are[101,100] and[102,100,101]; their sets equal the owned descriptors, each is attempted once, no handle remains, the primary MemoryError is preserved, the ledger is sticky, and callbacks are denied. Their immutable raw FAIL results remain unchanged and are excluded from candidate negative counts. No test was rewritten into a synthetic PASS.

An AST conservation control confirms R6→R7 changes only HeldBroker's `__init__`, `open_all` and `close`; every unrelated top-level definition, every other HeldBroker method, imports, constants, caps, counts, assertions, phase order, and protected-action unconditional denial are identical. The author48 conditions exercise immediate registration before/after insertion, original error propagation and fallback cleanup. The fresh checks inspect actual current function bytes with isolated virtual IO. No candidate source or assertion was substituted; harness output and fixture paths point only into this reviewer namespace.

## Requirement mapping

| Bounded requirement | Result | Evidence |
|---|---|---|
| Conserve original165 conditions, cap/order/assertion authority | Met in CODE/HOST scope |165 PASS and AST conservation |
| Immediate successful-open fallback; no retry of detached/unknown FD | Observed repaired |48 author regressions; fresh primary/once-close/readiness outcomes, with two incorrect order oracles excluded |
| Attempt every owned close despite reporting/bookkeeping failures | Unmet |First/middle receipt failures leave2/1 virtual handles |
| Sticky failure before shared preflight/binding/phase callbacks | Unmet for cleanup bookkeeping |18 fresh negative conditions; physical/accounting consequences distinguished |
| Finite mature held-input, original-nine/EOF/hash/final/every-close evidence | Met for recorded CODE/HOST intervals |50 Source inputs and later five document inputs verified |
| No self-JSON authority, hidden new pool, or protected effects | Met as a negative scope limit |Protected action remains denied; Source/functional eligibility false |

All five original Task03 requirements remain OPEN:03A/03B/03C; public alternate-path inventory/guards; refreshed verified issuer/subject and trusted memberships/grants/bootstrap; scoped direct access and transcript write/revision controls; background revocation/deletion and subscription/byte/callback/config/share closure. All three original acceptance criteria remain OPEN:alternate-path identity/tenant/scope/share denial; cross-tenant subscription/tool/upload/storage and internal-helper denial; revoked/deleted grant effects, no resurrection, and logout semantics. Accepted C2 dependency order remains unchanged. This contract review proves none of those live application outcomes. Original Task03 is0/3, goal1/17 is bounded Task01 only, product0/12.

## Dimension scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement fulfillment |3/5|Registration fallback repaired; full cleanup and sticky readiness remain incomplete |
| Code quality |2/5|Receipt append abandons later closes; shared accounting failure is not sticky |
| Test quality |4/5|238 observed outcomes; exact raw counterexamples and two explicit oracle exclusions |
| Pattern adherence |3/5|Constants, original guards and external authority preserved; lifetime failure propagation incomplete |
| Completeness |2/5|Exported broker cannot meet complete close/report/accounting contract on all paths |

Average:2.8/5. REJECT; no Source or functional eligibility.

## Physical and accounting scope

The replay holds50 Source descriptors before the first member body,804146bytes, minimum first-capture age323.298945500seconds. Each full EOF/hash/size and literal PRE9/OPEN9/POST9/FINAL9/pathFINAL9 is confirmed, including original candidate/preimage/control tuples. All50 remain held through controls and final full-content rehash, then close exactly once with0 errors and no primary/final failure. The candidate pin is e4e35ac0b7089b8db8e2d2a99cdf39374bd415c9bc4c76a52ab6ed9e0b776a4b/27238.

The first five-document confirmation has a reviewer decoder KeyError for a nonexistent `sourceWriters` field. All five bodies/nines/final hashes and closes completed, but no interpretation verdict was inferred from that failed decoder. The correction reuses the five exact first-captured tuples/hashes after current maturity; it never refreshes a failed candidate tuple or reruns candidate controls. That corrected confirmation has minimum age576.443650495seconds, all five documents retained through interpretation/final fences and five once-closes/0 errors. It independently verifies all50 complete Source row fields and close entries. The failed decoder source/receipt and corrected decoder source are preserved in the confirmation publisher.

The native bootstrap and documentary decoder code are compiled by native tool transport before their own physical admission; that limitation is explicit. Exact stopped actor/control sources are acquired and compiled from verified held bytes. This packet is meaningful CODE/HOST evidence, not a claim of complete operative parent Source acquisition. No Python cache is trusted.

One conservative cumulative ledger remains:1813294bytes carried from prior scoped work,121519headerbytes,553116inspectionbytes,30997separate plan/STOP headerbytes conservatively charged again,804146held replaybytes,278358first decoderbytes,278358corrected decoderbytes =3879788bytes. Both documentary attempts are charged with no refund. These total counts do not establish the fitting whole F2 graph. The same one4096-path/FD,64MiB aggregate,16MiB/file ceiling and original4MiB MF+1MiB approval+ONE2MiB DATA reserve remain; this small review fits with those reservations. Later self-excluded publisher acquisition must add its actual debt to the consumer's complete ledger.

The human judgment is published after the recorded Source/control intervals closed. It does not claim those FDs were held through this later report. Final publishers require Root's fresh genuine mature first physical capture. Every old failed interval, R6REJECT2.8, underlying NREJECT2.6 and G REJECT2.8 remains unchanged.

## Recommendation

Keep R7 unadopted. Prepare a disjoint narrow cleanup repair that survives receipt recording and ledger-release allocation failures, conservatively records failed shared lifetime state before later callbacks, attempts all still-owned closes once, retains original failures, and never retries unknown state. Review its exact before/after Source-approval cleanup outcomes alongside the unchanged165 controls and resource/authority assertions. This report does not authorize an effect or broaden the original phase contract.
