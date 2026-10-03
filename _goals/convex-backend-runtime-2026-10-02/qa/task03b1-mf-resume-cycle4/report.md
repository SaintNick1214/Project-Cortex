# Task Completion Report: MF resume cycle4

## Status: PARTIAL — bounded repair complete; fresh original42 judgment and integration pending

The user superseded numerical review-cycle limits. Original Task03 requirements, original failures and all historical independent judgments remain authoritative evidence. This report records implementation checks, not an independent PASS or wholeTask03 completion.

Candidate: `/workspace/Project-Cortex/work/resume/mf/candidate`. Product writes are isolated. No main backend/schema, generated bindings, SDK, host configuration, deployment, paid model, network operation or commit was modified or invoked by this executor.

## Changes Made

- `convex-dev/runtimeDataAuth.ts`: retain typed operation-local linked admissions through canonical source witness objects, including arrays concatenated across handlers. Canonical conversations/message anchors, explicit fact/immutable edge versions, immutable/mutable target identity/owner/scope and deletion controls, linked memory conversation bindings and linked data lineage/edge bindings reload after source crypto and authority checks. Final reload is scoped, nonrecursive and performs no new digest. Initial recursive cycle/graph bound validation remains. Mutation barriers retain both READ and WRITE linked admissions.
- `convex-dev/memories.ts:updateMany`: capture independent READ and WRITE source/link admissions before the first batch patch. Re-evaluate independent READ after effects without replacing preeffect witnesses; final validation retains both admissions. Initially READ-less writers retain safe receipts. Initially admitted READ revoked/expired later denies and fixture rollback restores all rows.
- `convex-dev/facts.ts`: unchanged byte-exact cycle3 file; existing witness propagation reaches the shared final guard.
- `tests/unit/runtimeEndpointAuth/retainedWitnesses.test.ts`:10 added outcome regressions (6 late linked eligibility/control/version/anchor invalidations,2 valid same-revision bulk source replacements,2 anchor invalidations during final source reload with exact no-further-digest assertion).

## Historical assertion correction

The exact old `memory.test.ts` remains untouched under cycle3 history. Its old distinct-grant test asserted that updateMany succeeded with a receipt after an initially available READ grant was revoked/expired during the first patch. That reflected the old handler's first READ admission after effects. The approved additional-cycle repair requires independent READ admitted before effects and retained to finalization; original Task03 says revoked grants stop later reads/effects/commits. The coordinator explicitly directed the stronger correction: removed only the old `else if ... updateMany ... read ... expect receipt` branch, so this case now falls through to the existing FORBIDDEN and full rollback assertions. No test was skipped or weakened. Exact old/new hashes and diff are recorded in preservation.json and memory.test.ts.diff; fresh independent original42 review must judge this semantics correction. Legitimate initially absent READ receipts remain covered and pass.

## Requirements Checklist

- [x]12 late linked failures repaired; original30 confirmation matrix now30/30, including original16 controls.
- [x]2 updateMany original-source replacement failures repaired for READ/WRITE and WRITE-only; exact reached injection and rollback assertions pass.
- [x] Original15 judge replay outcomes and26 repair/positive controls pass; bodies relocated only by literal import-path substitution, verified in probe-preservation.json.
- [x] Original361 registered cases plus10 new cases pass with documented stronger assertion correction;371/371,6 suites,0 skipped/pending.
- [x] Actual unchanged backend ES2021 and strict scoped compiler configs pass; affected ESLint passes.
- [x] Catalog42=37public+5internal;0 unresolved;6 suites independently discovered.
- [x] Current accepted runtimeAuth/verified prerequisites copied byte-exact from main; no obsolete resolver used for final check.
- [x] Historical MF schema remains byte-exact frozen dependency; no schema additions or edits by this repair.
- [ ] Integrate existing frozen MF schema additions with current accepted metadata/session schema in coordinator-owned integration. Current full-root diagnostics include reconstructed old-schema/new-adapter mismatches plus known internalized purgeAll consumer callsites; full root is NOT PASS.
- [ ] Fresh independent whole original42 MF judgment pending. Dependent MF/T/bridge work remains gated until observed PASS.
- [ ] Actual Convex transactions/JWT verification/subscriptions/managed vectors/paid inference remain separate live gates, unexecuted here.

## Verification

Observed commands/exits are in commands.json. Backend types, scoped types, lint, unit, discovery, catalog and all5 probe groups exit0. Root types exit2 (raw root-types.stdout retained; no bypass config). Tests used inert `CONVEX_URL=http://127.0.0.1:1` only to satisfy unchanged setup prerequisites; actual handlers execute solely in the documented in-memory transaction fixture. This does not certify live service behavior. Root installed dependencies were reused, Node24.19.0; cached npm12.2.0 version observed separately. PATH npm11.9.0 observation retained honestly.

## Files Modified

| File | Action | Notes |
|---|---|---|
| candidate/convex-dev/runtimeDataAuth.ts | Modified | Retained final linked admissions |
| candidate/convex-dev/memories.ts | Modified | Preeffect batch witness retention |
| candidate/tests/unit/runtimeEndpointAuth/memory.test.ts | Single assertion correction | Stronger current READ revocation/expiry expectation, original archived |
| candidate/tests/unit/runtimeEndpointAuth/retainedWitnesses.test.ts | Created |10 meaningful outcomes |
| new QA directory | Created | Raw receipts, source freeze, exact diffs, preservation, scope report |

## Notes for Reviewer

Freeze manifest SHA256: `18406ff7526e3a80771c33449e836fd797b28feaa6ca6ec5a21cc698a4771c64`.

Product hashes: runtimeDataAuth `bdba101b3edfa367f45eecc55cfd8669cc5a127b9f8e238669bfde000e583955`; memories `3208cb25973aa032fc4b22c62b21eefaf60ab91016ab9eb608d2a1e25037ecc4`; unchanged facts `4a3b972e97b42b7d5cd273adfe28db1ca3a390675424bad57463cafbe30d2b92`.

All candidate writes stopped at freeze. Main metadata/session schema already contains independently accepted newer fields absent from historical MF schema. Integrate narrowly by merging original MF table fields/indexes into latest accepted schema; do not replace current schema wholesale with frozen MF schema. Generated bindings and original unsafe consumer callsites remain coordinator-owned integration. Historical report REJECT3.2 and failed confirmations remain unchanged and visible; passing scoped counts do not erase them.
