# Independent task judgment: default native driver design C3

## FINAL: NEEDS_FIXES — DESIGN ONLY

C3 repairs the two C2 mandatory conflicts: complete persisted StageIdentity differentiates equal text from distinct native parts, and exact committed C09/C10 replay precedes the self-revoked live fence. ROOT lifecycle authority now permits owned cleanup and hash-only recovery after STOP/revocation without granting inference/read/hydration privilege. One newly specified post-purge recovery obligation remains insufficiently defined: the retained lifecycle hashes have no exact canonical projections or executable corroboration rule. A future executor must invent that contract before implementing the stated corruption checks. This is a repairable deterministic prose-design issue; actual native/provider/managed evidence is not required to repair it.

## Evidence review

Applied AGENTS, CODEX-RUNTIME, PROJECT-PROFILE, pessimistic-judge, judge-task and feature-orchestrator. User's numeric-cycle waiver changes numerical limits only; failed gates still prohibit dependent advancement. Used delegated design threshold: each of five dimensions >=4 and average>=4. Read approved implementation prompt, goal, Tasks04/08/09/14, authoritative decisions and architecture, current proposal/report/check-plan and all five normative contracts. Reviewed C2 failed judgment and its preserved C1 lineage. Large combined reads that truncated were followed by bounded decisive contract/source/goal/architecture reads. Independently read/hash every subject/source byte; integrity does not imply semantic execution of each source.

Subject report SHA256 ae852218d0dae8a348803693a1c39555b60f6c960b34c0bc8f3f9c5adb2f3ef1 and manifest ee744fb6e3e75035b87efaaad1b23629ca56d6b59f9360c0cc84a7513345e9c5 match. Exact287 recursive rows excluding only root manifest verified, including nested manifests. Full copied101-row C2 subject and163-row C2 review closures and all copied bytes match original directories. C2 review report bf01434eb3fb9a96d38008acce2aaecabe028cb47c65bfc79fe5fd3e8c201caf and manifest bc441fca9f661427cf98c1929380a68823ba27dea944668fd831ec9809b8bed6 retain NEEDS_FIXES3.6 and historical C1 failure evidence. All53 unique source pins match current bytes. Complete subject and53 source preimages are retained under this review.

Inspected official getServiceToken/action-local fetch and modelId-only constructor, compatible embedding response.body rawValue/minimal raw schema, Chat stream raw-event/flush finish and official v4 embedding/finish types, and pinned Gateway conservativeUsdDecimal. These support source limitations, not actual provider truth. Frozen c827 policy/e796 Gateway offline4.4 acceptance is unchanged; three newer native profiles remain preparing, not accepted.

Ran only own inspected copies of the two illustrative models:25+19=44 groups PASS,0skips. Added four independent finite hash-obligation examples: a permitted late terminal/money refinement changes a whole-account snapshot, corrupt trigger changes it too, purge receipt lacks directly retained trigger tuple, and an illustrative immutable trigger projection separates these cases. Those four examples PASS as algebraic demonstrations only; they do not implement the missing normative projection. Total48 illustrative groups,0skips. No original builder/finalizer invoked. Reviewer verification initially failed with KeyError 'cases' because accepted source manifest uses expectedCalls; preserved failing full script preimage/raw traceback, exit1 and recordedUTC (original startUTC NOT_CAPTURED), then inspected manifest shape and corrected only reviewer script. Successful rerun receipts record UTC/argv/cwd/exit/raw outputs. No subject defect is inferred from that reviewer mistake.

## Requirements review

| Requirement | Assessment | Evidence |
|---|---|---|
| Complete stage sequence/raw digest/dispatch/BindingV2 identity | Repaired | replay-cleanup.md:6–29 exact stored canonical/hash/redundancy; stage content hash separate; same text different part collision. |
| Exact C09/C10 committed response-loss replay before live self-closure | Repaired | replay-cleanup.md:23–27; staging-trigger.md response loss paragraph; no private return/new native/reset/regrant. |
| Newly late stage denied, immutable-binding mismatch forbidden | Repaired | replay-cleanup.md:25–26 distinguishes altered binding, collision and fresh-effect denial. |
| Closed ROOT owned delete/revoke/evidence/purge finite API and fence separation | Substantially repaired | replay-cleanup.md:35–78; ownership before replay, current expected epochs for fresh effect; original known/reserved/active and durable tombstones retained. |
| Corrupt/post-purge retained trigger corroboration | Incomplete | replay-cleanup.md:66/74/76/86 requires hashes and post-purge corroboration but supplies no exact retained projection/verification rule; Issue1. |
| Format2 vs storage OCC | Repaired | replay-cleanup.md:3, receipt-state final paragraph: immutable schema version2, Convex OCC, no custom revision counter. |
| Strict receipt/state parsing, historical monetary/terminal refinements | Preserved | receipt-state exact types/matrix/parser/fold; observed null vs0, no clipping, max2 upgrades, STOP never clears. |
| Closed EMPTY proof APIs and native/source predicates | Preserved | observer-proofs: actual registry EMPTY; raw embedding absent id/model unknown; nominal flush never terminal authority; decoder/model revision/whole money remain unproved. |
| Managed default1536 repository and currentness | Preserved design-only | managed-fixture E11 qualified insert/current hydrate, E12/E13 no write, E14 separately admitted query; all live fences retained, actual managed NOT_RUN. |
| Exact initial14 and identity ordinal/order/U/M/K/no extra exploration | Preserved | Independently compared every selected field to accepted expectedCalls:14 identities,13 native hashes,total conditional K314310; ORDER C01–C08,E11–E14,C09,C10. C09 may stop C10; no guaranteed14 executions. |
| Official native entry/absolute ownership deadlines | Preserved | proposal modelId-only official factory/token after reserve/checkpoint/immediate current-enter;1000entry/15000lifecycle/1000persist/1000cleanup absolute deadlines and pending handlers. |
| Actual proof production EMPTY vs conditional experiment and separately accepted fixture root | Preserved | proposal and observer bootstrap paragraph; no production claim, no inference authority from cleanup, no new model/request/retry/window renewal. |
| Original Task04 all13 operations,08/09/14/all17/fullcore/UI | Retained incomplete | proposal/report/check-plan explicitly maintain all downstream original functional acceptance gates. |
| Immutable lineage/source/closure | Verified | verification.json and subject/source pre/post inventories; complete preimages preserve all failures and nested manifests. |

## Issues found

### Critical to design PASS: finite retained-hash contract

**1. Lifecycle hash preimages and post-purge corroboration are unspecified.** replay-cleanup.md:66 gives exact receipt outer keys with beforeHash/afterHash/evidenceSnapshotHash/accountLiabilityHash, but only describes their inputs as 'content-addressed sanitized state' and 'original account attempts/K/known/reserved/active'. :74 says hash current account/liability and all private evidence/stages/vector, without exact canonical object keys, domains, row order or immutable-versus-mutable attempt projection. :76 deletes the private StageRows/evidence/vector, retaining only account facts and lifecycle receipt hashes. :86 then requires inspectTrigger to corroborate current per-attempt trigger/content/identity hashes using the purge receipt.

An aggregate evidenceSnapshotHash cannot be inverted to recover or verify a stage tuple after its private preimage has been removed. Comparing a whole current-account/liability hash against the purge snapshot also fails after a legitimate late terminal/money refinement, which remains permitted and changes active/known/reserved/attempt facts. Merely checking that an owned purge receipt exists would accept a subsequently malformed-but-H-shaped attempt trigger identity without the required relation check. The receipt has no explicit immutable trigger-set hash/canonical projection whose digest can be recomputed from retained account data. Different implementations must choose different projections or retain extra fields to make this path work. This is the finite design gap, not a claim that a deployed backend was corrupted.

Freeze exact versioned canonical preimage schemas/domains for lifecycle intent/receipt and before/after/evidence/liability projections, with row ordering and excluded mutable/private fields. Specify redundant lifecycle row field/canonical/hash validation on every load (including operation/account/key/intentHash/receiptHash equality), and a retained immutable trigger projection or retained canonical preimage that lets post-purge inspection recompute a relation without private bytes. Explicitly distinguish legitimate late accounting refinements from changed retained trigger hashes; corruption must deny0writes/no summary. Keep private purge and late qualified accounting independent, no frozen-account workaround that drops late charges. Require exact stage replay after purge to remain denied closed, as C3 already specifies. Also freeze how already-tombstoned/already-revoked no-write receiptHash is derived. No actual services are needed to resolve these schemas.

### Important

check-plan.md describes changed-binding, inspect corrupt/post-purge, revoke and purge adversaries as asserted. The new19-group model implements only stage/delete/inspect and exercises no revoke/purge, no changed-binding input, no stored-row corruption or post-purge receipt corroboration. Its own docstring and report truthfully disclose an illustrative scope; that disclosure avoids an execution auto-fail, but those remaining obligations need separate meaningful contract examples after Issue1 is repaired. The copied25 model is also a subset and proves no Convex transaction or native semantics.

### Minor

No additional source-pin, exact initial14, authority regrant or format-version conflict found. Keep the remaining native/security/publication/codegen/OCC/currentgrant/source/serial/unknown/missingdriver/retirement gates independent.

## Dimension scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment |4/5|C2 mandatory identity/branch/closed-owner repairs complete; retained-hash corruption relation remains undefined.|
| Code Quality / design viability |3/5|Lifecycle verification needs an invented immutable hash projection to implement post-purge corroboration.|
| Test Quality / check plan |4/5|44 copied/new illustrative groups plus4 independent hash examples; raw failures honest; additional finite obligations identified.|
| Pattern Adherence |4/5|Official sources, OCC, ROOT closed cleanup, independent late accounting, EMPTY actual/production proof boundary preserved.|
| Completeness for design |3/5|Post-purge hash recovery cannot be implemented deterministically from specified retained schema alone.|

**Average:3.6/5. FINAL NEEDS_FIXES — DESIGN ONLY.** No security/execution auto-REJECT is inferred for a noninstalled prose packet. Every dimension must reach4 before PASS_DESIGN_ONLY.

## Recommendation and limits

Create a new immutable finite hash/recovery revision, preserve C3 and this failed judgment, add corrupted lifecycle/trigger and late-accounting-after-purge contract adversaries, and obtain a fresh independent design review. Existing user authorization permits the repair; numeric limits alone were waived, not gates.

No product/config/tests/.agents/oldQA/source edits, Git/network/native/service/paid/private signer/env/history actions or subagents performed. Actual Convex transactions, driver/proof predicates, managed vector behavior, provider termination, serving/model revision/decoder/wholeUSD, native profiles, builds/lint/types/fullcore/UI remain NOT_RUN/UNKNOWN. Original experiment/fullTask04/all13 operations/Tasks08/09/14/all17 remain incomplete. This verdict neither accepts the driver nor authorizes advancement through failed design gates.
