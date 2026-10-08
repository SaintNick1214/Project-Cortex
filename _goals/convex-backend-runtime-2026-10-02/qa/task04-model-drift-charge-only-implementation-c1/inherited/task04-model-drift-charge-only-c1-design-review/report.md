# Task Judgment: Model-drift charge-only repair preparation C1

## Verdict: NEEDS FIXES

Average **4.0/5**. Requirement Fulfillment **4/5**, Design Completeness **3/5**. The minimal ledger-owner repair is viable and the monetary qualification premise is appropriately limited, but two security-relevant implementation obligations need explicit acceptance criteria before design approval. This judges the immutable C1 proposal as written; coordinator messages do not amend that subject. No product mutation or broad Task04 acceptance is permitted by this verdict.

Subject proposal SHA256 `be7f8e2e83db7861dee5c6b446b6924649be1903baa6e94144909ab62a7a4355`; subject manifest `c656e9dda6748433afe445a4cb5dad308d9eec8d256a96b39f47c2900fa5d73c`. Independently verified complete subject2, rejected Gateway review71, accepted composition design147 and fresh design review120 manifests, every byte count/hash, exact file sets, excluding only each root manifest itself and INCLUDING nested manifests. All eight subject source-evidence rows match current files. Review source pre/post hashes are equal.

## Evidence Review

Read repository AGENTS, runtime/profile, pessimistic judge, judge-task and feature-orchestrator; approved implementation prompt, original Task04, decisions and architecture; accepted composition C2 blueprint and independent design judgment; current native policy in full (all958 lines), schema/bootstrap, current Gateway terminal path and original native immutable/refinement/attachment/unsupported-money assertions; native capture coordinator acceptance; FULL fresh Gateway REJECT3.2 report SHA256 `a8a92fead3ff09370a841bae978d242f02fe7f5de3d14e26761c30f0400e1b1a` and its complete71 manifest SHA256 `a4cb72af203cd02da097ec0b99da58a760bf043954855c80d1a5fef93fd46d07`.

The rejected review's actual Gateway→registered native handler offline diagnostic is inspected evidence, not rerun or relabeled native/actual money here. It demonstrates truthful foreign/model and synthetic aggregate150 on R100 reaching capture rejection before accounting: reserved100/settled0/active1, versus supported full-known obligation settled150/active0. Original133 plus diagnostic1 passed there; expected-RED obligation fails there. Current helper160 and historical78 are inspected prior results, not fresh executions in this design review. Both native profiles' accepted4.2 scope and physical retirement remain historical source-specific facts; changed policy requires fresh native acceptance.

Fresh review-owned Python stdlib static/integrity controls observe: capture drift rejection before knownCost; ordinary captured settlement drift rejection before duplicate/refinement; no unknown-money overrun latch; no observed-model defensive attachment guard; production registry empty; terminalCost contract separate from predispatch input/K bounds; unchanged5 tables/11 indexes/16 internal registrations. This is PASS_STATIC_INTEGRITY_ONLY, with no application discovery/execution and no claim of native OCC, real money, services or product behavior. Raw stdout/stderr, argv/cwd/start/end UTC, explicit environment policy, source pre/post fingerprints and complete verification results are retained. No fresh control failure occurred. No product/tests/subject/config/.agents/Git/environment/key/private/service/network/native/paid writes or calls, and no subagent were used. Root routing/config review is separate and unqualified here.

## Requirements Review

| Requirement / bounded criterion | Assessment | Evidence |
|---|---|---|
| Original operation registry, trusted scope/model/interface/pins/options/tools and distinct policies | Preserved in design, globally incomplete | Original Task04; proposal:9,30 changes no registry/provider/root/API |
| Atomic original operation/run/tenant full known once, unknown conservative, quota-before-token, safe fallback | Preserved in intent; predicate specification incomplete | proposal:11–15,19–26; source accountKnown/writeUnknown/checkpoint/capacity |
| First trusted truthful actualModel drift versus selected immutable identity | Complete design intent | proposal:9–10; exact requested identity/proof/checkpoint retained; malformed IDs deny; no fake observed model |
| Initial/final canonical identity, zero-write duplicates, immutable facts and compatible unknown→known | Complete design intent | proposal:13–14,23–24; capturedDuplicate/compatibleRefinement source; original actualModel-change rejection preserved |
| Genuine lifetime versus monetary proof | Complete design | proposal:11–12,20; no lifetime keeps slot; genuine terminal releases once independently of qualified money |
| Qualified full aggregate money independent of served model/K/input bounds | Complete conditional design; actual premise unresolved | proposal:11 expressly covers complete account charge, currency/categories/whole invocation including drift; bootstrap terminalCost separate from inputBound; production root empty |
| Model/token violations latch all original guards with or without money and remain monotone | Outcome intent present, exact shared transition obligation incomplete | proposal:12–15,21–22; item7 explicitly leaves predicate extension to later investigation |
| Defensive attachment refusal independent of pending/attached markers and latches | **Not explicitly specified or tested** | proposal:10,12–15 assumes transition closure; native permittedAttachment:775–791 lacks actualModel check |
| Captured ordinary settle/admin recovery/operator retirement parity without broader authority | Complete design intent | proposal:14,24; strict existing authority and positive retirement unchanged; duplicate/refinement must precede selected-model rejection for captured drift |
| Legacy uncaptured/partial-marker privacy, no new result authority | Preserved | proposal:14; capturedAttempt and liability/retirement authority source |
| Original43/22/133 assertions, current160/historical78 and native publication/isolation/rollback/retirement | Required later evidence, not executed here | proposal:15,26,30; existing admission test/schema byte-exact |
| Full-callsite/Task07/production paid readiness and whole Task04/full03/all17/goal | Remain held | proposal:3,11,30; accepted architecture and C2 boundaries |

## Issues Found

### Critical

No demonstrated auto-fail in this proposal-only subject. No secret exposure, unauthenticated new route, fake qualification or claimed implementation completion.

### Important — blocks design PASS

1. **Defensive observed-drift attachment refusal is missing as an explicit independent invariant.** Proposal:10,12–15 requires closing attachment during accounting, but does not require attachTerminalResult/permittedAttachment to independently inspect stored truthful observations when a row is inconsistently marked pending or attached and its overrun latches are false. Current source:780 only checks guards and selected model eligibility; it does not compare actualModel. A patch that only gates initial deliverable and adds normal latches could satisfy the listed normal rows while still accepting that inconsistent row. Add: attachment must withhold any stored actualModel different from the attempt snapshot model, reading initial and final captured canonical evidence as applicable, without relying on resultAttachmentState or account/operation overrun. Preserve typed unexpected-read retry behavior; do not turn transient failures into permanent denials. Add outcome controls for inconsistent pending and attached drift, false latches, current valid authority, and attempted renewal/reconciliation. They must expose no private bytes or attached acknowledgment, create no money/slot delta, and never reopen drift delivery. Legacy/partial markers must remain fail closed without created privileges.

2. **The shared model/token predicate and money-independent monotone update contract remains speculative.** Proposal:12 provides the desired outcome, but proposal:15 says “review whether extending that predicate ... can use the same existing fields.” Source accountKnown:710 currently covers cost/input/output only; writeUnknown:615–635 has no violation update at all. Resolve this at the design gate: a bounded model/token qualification violation predicate is computed independently of knownCost, from optional truthful actualModel versus immutable attempt snapshot and supplied measured input/output usage versus stored attempt limits. Apply it to first capture and every permitted refinement/shared accounting path; qualified C>R adds the monetary violation. Existing original operation/run/tenant overrun flags are OR-latched atomically, with no new fields/public flags/ledger. Private output is withheld on every observed native violation, including money unavailable and refinements adding previously absent drift/over-limit usage. Later lower money, exact duplicates, renewal/cancel/retirement/reconciliation cannot clear latches or reopen output; duplicates retain zero writes. Add explicit absent-observation→known-refinement-with-drift and absent-usage→known-refinement-with-token-overrun outcomes, alongside already-present drift unknown→known. Require next checkpoint/admit/fallback denial on original guards, original window/account parity and no successor-account laundering. Shared global-root operational revocation and Task07 wiring remain future owner work, not a new API.

These are narrow specification additions, not reasons to invent a third ledger or weaken cost limits. Existing5 tables/11 indexes and16 internal registrations already provide the needed persistence surfaces. Original byte-exact133 assertions can coexist: the old actualModel incompatibility case changes an already-present observed model, whereas the proposed first-drift capture records a new immutable observation.

### Minor

Proposal:5 says the independent Gateway final report is pending; it is now finalized REJECT3.2 with the exact report/manifest above. Reference the immutable final evidence in a new proposal packet; do not edit this C1 history.

## Qualified Aggregate Seam and Limits

C1's aggregate qualification condition is sound as a design premise. Receipt aggregateCostUsd, currency implied by costSource, numeric usage, code/samples and a fixture classification never establish complete account money. The stored compiled proof's terminalCost may qualify that source only after independently reviewed actual evidence covers complete inference/Gateway categories, USD denomination and whole invocation INCLUDING a served-model drift; the selected model's K or token envelope is a separate promise. Missing or unsupported aggregate support remains full original R/U, even when receipt metadata claims a known amount; genuine lifetime alone can release the held slot once. No known150 PASS is justified for a root whose complete-money premise is absent. Later actual root/source qualification stays BLOCKED, and the registry remains empty. Synthetic proofs may exercise known-money branches offline/native only and must remain labeled synthetic. This unresolved actual-service premise does not invalidate the conditional design, but cannot be transformed into paid readiness by a design PASS.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 4/5 | Original criteria preserved; defensive attach and mandatory shared predicate need explicit design acceptance criteria |
| Design Quality | 4/5 | Minimal trusted capture distinction, immutable observations, exact original accounts and conditional complete-money seam |
| Validation Plan | 4/5 | Concrete charge/unknown/parity/native matrix; add inconsistent-row and absent-fact refinement outcome rows |
| Pattern Adherence | 5/5 | Internal trusted surfaces, no new schema/root/provider/privileges, exact original assertions, separate ownership and future gates |
| Design Completeness | 3/5 | Two security-relevant transition/attachment details left implicit or speculative |

**Average:4.0/5.** Requirement Fulfillment is not5 and Design Completeness is below4; judge-task's design PASS threshold is unmet.

## Recommendation

Create a new C2 proposal freezing the two mandatory invariants and new outcomes, cite finalized rejected Gateway evidence, and obtain fresh independent design judgment before any native product mutation. Preserve C1 proposal/review/failures and all prior accepted/rejected packets. A later design PASS permits only the bounded policy plus NEW tests repair, with schema/original admission tests unchanged and Gateway frozen unless separately reviewed. Then require fresh product review, actual registered adapter outcomes, affected current strict types/lint and160/133/78 preservation, new native extension/regression/OCC/rollback/lost-response/publication/isolation and both physical retirements, plus fresh aggregate source-specific acceptance. No provider, paid, Task07 wiring, full Task04/full03/text/UI/all17/goal or routing/config acceptance follows here. Numeric cycle limits alone are waived; finite caps and acceptance criteria remain.
