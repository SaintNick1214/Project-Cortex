# Task Judgment: Managed conjunction clarification C1

## Verdict: NEEDS_FIXES — DESIGN_ONLY

This is a fresh independent review of exactly the five files listed by the frozen subject manifest. It does not accept any mutable driver implementation, actual vector index, native execution, publication, inference, Task04 completion or full-goal completion. The composite-filter approach is compatible with the installed API and preserves the intended fences in its written contract, but the exact hash preimage is contradictory and must be repaired before installation.

## Evidence Review

Subject: `_goals/convex-backend-runtime-2026-10-02/qa/task04-default-native-driver-implementation-c1/design-clarification-c1/`. Manifest SHA256 `a1bf717af79f850317632a12a48807f3190ea37628c3486e539184ca0e322cf5`; proposal SHA256 `2d4a5c21fb6b526db205e393da0c3633d8bc442161aa5154182dce46475cf321`. Own recursive discovery confirmed exactly five manifest entries, exact bytes/digests and unchanged subject pre/post. All five were read; retained failure is evidence of an earlier execution, not a fresh typecheck in this review.

Installed `node_modules/convex/src/server/vector_search.ts:99–122` exposes only `eq` and `or`; its query documentation at lines 40–42 says the same. `impl/vector_search_impl.ts:128–150` implements `$eq`/`$or`, without `and`. Retained subject `typecheck-failure/run.json` records tsc exit2, and stdout records TS2339 for `VectorFilterBuilder.and`. Thus the original C4 managed example is unsupported by this installed interface. One `eq` on an indexed composite is supported as a source-level API use; actual index behavior remains unobserved.

Read the original C4 proposal, managed fixture, receipt/state, hash-recovery and check-plan contracts; implementation prompt and Tasks01/04/14; runtime/profile/judge rules. The mutable installed canonical helper was inspected only to corroborate codec semantics, never accepted as an implementation. `references.stdout` retains the complete listed reference reads and `references-run.json` their actual argv/cwd/UTC/exit. `dummy-ambiguity.json` shows differing digests for plain canonical JSON and one illustrative possible length prefix; that prefix is neither specified nor recommended and this is DUMMY evidence only.

## Requirements Review

| Requirement | Met in design? | Evidence |
|---|---|---|
| Supported index conjunction with original scope/profile retained | Yes, subject to exact codec repair | Proposal:5,9 adds fifth filterField; retains four components, dimensions1536/indexname and limit1; forbids OR/drop/rescan/increased limit/alternate profile. |
| Exact canonical hash bytes/domain/type definition | **No** | Proposal:5 simultaneously inherits canonical JSON/UTF8 and says “Length-prefixed canonical JSON”; accepted C4 hash-recovery:7 defines plain SHA256(UTF8(C(x))). |
| Trusted expected query binding; no caller composite authority | Yes | Proposal:5 derives from compiled SCOPE/BINDING and owned live rows; no caller composite accepted. |
| Write, replay, read, hydrate and lifecycle loads verify derivation | Yes as specification | Proposal:7 requires recomputation from all four fields, expected current binding on replay, exact row keys and every-load validation. Composite match on wrong underlying scope/profile must reject. |
| Preflight/hydration source/grant/profile/epoch/qualification/current authority | Yes | Proposal:9 plus inherited C4 managed-fixture LIVE checker/searchE14; async search never replaces atomic final hydration or pre-summary authority check. |
| Lifecycle canonical projection coherence | Yes | Proposal:7 adds stored-row validation but preserves exact S projection keys; inherited C4 hash-recovery:43–62 validates stored vector before deriving projections. Composite is deterministic redundant data, not public evidence or a new S key. |
| Meaningful positive and negative control plan | Yes as plan only | Proposal:11 covers positive same binding; four wrong components at index/hydration; forged expected composite; wrong composite; stale profile and async mutation/revoke; no fallback/extra calls. Original C4 check-plan remains required. |
| Preserve initial14 identities/check order/model/options/billing/profile, EMPTY proofs and downstream gates | Yes | Proposal:3,11 explicitly retains them and incorporates original C4 contracts. No actual qualification is asserted. |

## Dimension Scores

The original five rubric dimensions are applied to specification quality and planned verification because this is DESIGN_ONLY; these scores do not certify executed code or tests.

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 4/5 | Security and query requirements are explicit; exact encoding requirement needs correction. |
| Code Quality | 3/5 | Supported API repair is sound, but the implementation-facing byte definition admits incompatible interpretations. |
| Test Quality | 4/5 | Outcome-oriented prospective controls cover component exclusion, forged redundancy and currentness; none is represented as executed native coverage. |
| Pattern Adherence | 4/5 | Trusted server scope, exact row validation, atomic fences and canonical projections preserved; codec sentence conflicts with inherited pattern. |
| Completeness | 4/5 | Write/replay/load/lifecycle/query impacts and unchanged gates identified; design cannot be installed until ambiguity is removed and fresh review passes. |

**Average: 3.8/5.** No observed security auto-fail or silently removed scope. NEEDS_FIXES reflects an explicit design precision defect, not unsupported implementation or service acceptance.

## Issues Found

### Critical

None established within the frozen design subject. No implementation was judged.

### Important — blocks design PASS

**F1: contradictory hash byte contract, proposal.md:5.** The equation names `SHA256(canonical({...}))` and the same paragraph preserves sorted canonical keys/UTF8/descriptor-first contract, then states “Length-prefixed canonical JSON”. Accepted C4 `contracts/hash-recovery.md:7` defines `H(x)=SHA256(UTF8(C(x)))`, explicitly forbids interchangeable canonicalization, and contains no prefix. The inspected canonical helper returns sorted JSON and its digest hashes its UTF8 bytes directly. A prefix changes the digest. Its size, representation, position and per-object/per-field meaning are unspecified. Named JSON keys and exact 64hex components already remove concatenation ambiguity; a length prefix is unnecessary. A reviewer cannot silently select one interpretation in a frozen exact-hash design.

Required repair: explicitly define `scopeProfileHash = SHA256(UTF8(C({domain:"cortex.experiment.scope-profile.v1",version:1,tenantHash,spaceHash,ownerHash,profileHash})))`, where C is exactly the accepted codec and the object has exactly those six keys; remove “Length-prefixed” and state no additional prefix, delimiter or alternate encoding. Keep lowercase64hex component validation and trusted derivation. Refreeze and obtain a fresh DESIGN_ONLY review. If a new length-prefix encoding is intended instead, fully specify and separately review that changed codec; it cannot be presumed to be the existing unchanged contract.

### Minor

None requiring a separate design change. Future implementation verification must distinguish ordinary derived-hash exclusion at the index from hostile forged-composite rows: a wrong-field row whose forged composite equals expected may be returned by the index, but must be denied during semantic hydration. The proposal already requires this through its separate forged-composite control and every-load validator.

## Required Subsequent Gates

1. Repair F1, freeze the complete replacement subject and receive fresh DESIGN_ONLY acceptance. Root must read the complete review and verify recursive closure before releasing implementation.
2. Implement exact field/index addition and one supported server-derived equality. Registered-handler controls must prove same-binding positive; independently changed tenant/space/owner/profile with correctly recomputed composites excluded by the index model; each wrong component denied on hydration even if a candidate is injected or its composite forged; otherwise matching row with wrong composite denied; canonical/order/type/unknown-field/descriptor/Unicode controls; write and exact replay with changed or stale composite; lifecycle read/delete/revoke/recovery/purge load checks. Verify zero writes/calls for denied paths and stable historical hash projections.
3. Exercise source revision/hash/epoch/profile mutation, deletion, revoke and cancel during async search, after index response but before hydration, and after hydration but before public summary; retain current-grant/profile/proof/window and E11/E14 qualification fences. No fallback, rescan, larger limit or alternate profile. EMPTY actual resolver must still deny closed. DUMMY qualification stays synthetic.
4. Run affected offline types/lint/outcome checks with discovery and skips recorded; preserve all original baseline23/hostile6/refinement4/fresh5 and C3/C4 lifecycle controls. Source/operator/input/load freeze and fresh independent implementation review remain required.
5. On a root-verified disposable target, official codegen/publication/types/security/native OCC/duplicate/lost-response/unknown/currentness/missing-driver/cleanup-retirement and actual managed index/write/search controls must be observed and independently reviewed before the separate paid stage. No source-level or mock evidence certifies actual indexed exclusion. Preserve original exact14/order/hashes/model/profile/U/M/K/money/lifetime and proof gates, then full Task04/Tasks08–17/core/UI gates. All native/index/model/money outcomes in this review remain NOT_RUN/UNKNOWN.

## Evidence Limits and Ownership

Own fresh executed checks: read-only reference capture, recursive five-file closure and pre/post equality, plus one pure DUMMY encoding ambiguity example. No native/service/network/provider/paid/environment/private actual evidence or product/config/Git mutations. No new check failed; retained tsc failure remains preserved in the frozen subject. Earlier interactive read outputs were inspected; complete targeted reference output was recaptured without truncation in this packet. Application tests intentionally not selected for a design-only review; zero application tests/native cases were executed and no such PASS is claimed. Own writes are confined to this new QA directory and `work/resume/task04-managed-filter-clarification-c1-review/`.
