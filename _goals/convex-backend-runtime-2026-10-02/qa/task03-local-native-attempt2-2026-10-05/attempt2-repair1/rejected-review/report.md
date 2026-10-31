# Independent Task03 native attempt2 preparation review

## Verdict: NEEDS REVISION — preparation only

Average **3.2/5**, scores **3/3/3/4/3**. Candidate freeze SHA256 `7d633bd5e2e6588b9650c6a8b717e4f9eaab9528b6e988ccd3d3746a6b65db7c` is held. The compiler repair and evidence conservation are substantiated, but two defects violate the prepared incidental-file removal fence. No target creation, deployment, native case, inference, private-file read, or enabling review attestation was performed by this reviewer. This is not acceptance of03-foundation or full original Task03.

## Blocking findings

### 1. Incidental capture/removal still runs with a nonterminal owned process group

`scripts/deploy.mjs:13` awaits `owner.reapAll()`, sets overall status FAIL if a group remains or verified-group counts disagree, and then unconditionally calls `captureIncidental()`. That helper can remove the CLI-created file. The inherited accepted custody fence requires terminal owned deployment groups before restoration/removal; returning overall FAIL does not authorize mutation while an owned writer may remain.

The independent witness executes the exact frozen deployment module (SHA256 `0643c3753c76285ab6554e8d67174d244473a4e5edaff1b8e1b7aabca7c2064d`) through effect-blocked import/process boundaries. Its ProcessOwner exposes one remaining group and zero verified terminal groups. The module emits qualification FAIL but invokes incidental capture **once**; the required count is zero. `nonterminal-custody-witness.final.stdout` and `witness-command-receipts.json` preserve the actual-source observation. This is a boundary injection, not a claim that a real group or file was left running/deleted.

The executor's seven deployment controls do test FAIL on a nonterminal group, but their common helper explicitly asserts `captured === 1` for every scenario. Consequently their green outcome endorses this unwanted side effect rather than rejecting it. Their35-case result remains preserved as observed execution and cannot certify the missing fence.

Repair: capture/remove only after successful terminal ownership verification. Unknown/rejected reaping or count disagreement must retain the source file and its ownership, emit a fixed failure receipt, and permit the coordinator's unconditional retirement fence. Add actual-source controls asserting zero capture/removal calls for nonterminal groups, unverified counts and reaping rejection. Preserve120-second CLI and all other original bounds.

### 2. A source replacement after durable custody can be unlinked without being checked

`scripts/incidental-custody.mjs:18` checks source identity/content, then lines19–20 create/fsync a custody receipt. At line21 the helper checks only the receipt path and unlinks the original source pathname. It does not revalidate the source after that intervening I/O.

The independent exact-source witness (custody SHA256 `8619bac738a7fde53c064d00cb3a813021a3b0bda62df052a6873e29b0c95553`) models a replacement at the source pathname when the custody receipt finishes fsync: inode changes from2 to3 and UID from501 to1. The actual helper subsequently calls unlink and returns `{created:true,captured:true,removed:true}`. Its private capture belongs to the earlier source, so it does not establish custody or removal authorization for the replacement. `post-custody-replacement-witness.final.stdout` records the ordering and observed deletion call. No real filesystem replacement, foreign file deletion or attacker exploit occurred during this review.

This violates the candidate's own requirement to refuse foreign owners/changed source identity before removing only the newly created owned file. It does not depend on importing Task04/C8's separate filesystem contract. Repair the pathname/content/ownership fence at the final removal boundary after durable custody, with held-source identity/custody as appropriate; reject a replacement without unlinking it. Add an actual-source race control at this exact seam, preserving the failed candidate and receipt bytes.

## Requirement review

| Bounded preparation requirement | Result | Evidence |
|---|---|---|
| Exact frozen source and receipt conservation | Met | Independent PRE/POST rehash of774 frozen entries and773 receipt entries; no candidate writes |
| Accepted559 ancestry and declared deltas | Met | All559 old entries rehashed;551 unchanged, exactly8 declared changes,0 removals; exact preimages/diffs frozen |
| Current source, original task and accepted dependency allocation | Met | All161 current source pins; actual sourcePreflight verifies138 managed-copy and23 selected historical-reference pins; original Task03 and c2 allocation byte-exact |
| Correct actual CLI compiler discovery | Met offline | Installed Convex1.46 source and bundle pins; actual cwd-relative compiler lookup,114 byte-exact TS6.0.3 assets/10,617,006 bytes; enabled typecheck retained |
| Node/npm/runtime preparation | Met within observed offline scope | Inspected source-bound actual Linux Node24.15/npm12.2, networknone/read-only2GiB readiness/typecheck receipt; no heap override or service outcome inferred |
| Source ownership, exact private custody and safe incidental removal | **Not met** | Two independent exact-source witnesses above |
| Original native counts, bounds and generated predicates | Conserved, not executed live |275 product/200public/75internal;287 fixture/200public/87internal; original259 conserved; exact5 generated-file predicates, case counts and deadlines retained |
| Cleanup and failed-result/terminal consistency | Met within offline prepared boundary | Independently executed28 conserved cleanup/driver controls; failed original qualification never promoted through recovery |
| Meaningful affected controls and quality | Partial | Independently executed35 producer controls and28 conserved controls,9-file lint and6 syntax checks PASS; new independent witnesses identify missing outcome assertions |
| Reused1005/discovery evidence kept distinct | Met | Exact preserved17-suite/1005/zero-skip source-bound evidence; not counted as a new test run by this reviewer |
| Previous failures, missing evidence and scope limits retained | Met | First native attempt FAIL/zero cases/retired200–404; HOME failure, vanished first512MiB raw/cgroup gap, separate measured V8 failure and subsequent2GiB success remain distinct |
| Fresh review before provisioning; separate management review | Held | This verdict is not PASS; no enabling attestation or target action performed |

Original Task03 R1–R5 and A1–A3 remain unchanged. This review is a preparation subset: actual exhaustive currentguard/native publication, refreshed-identity cases, no-effect snapshots, live SDK/background outcomes, owned cleanup/process terminality, physical retirement and a fresh bounded-foundation review are still mandatory before Task04. Full transcript/lock/revision/share, text/tool/asynchronous-memory, graph/private-asset/media/client and03-final functional outcomes remain at their original c2 gates. Empty model qualification registry and capability-unavailable controls do not certify functional delivery.

## Evidence and independent check scope

`inspect-integrity.py`, `integrity.json` and `integrity-final.json` bind the final freeze and current/prior inventories. The receipt manifest SHA256 is `c466ddb4033105d6374a3e119b26fbd26edfa55755eb36ccaf65c924dbafa71d`. All114 compiler files independently match the actual installed root TypeScript bytes. Actual read-only `sourcePreflight()` confirms the full candidate membership and installed CLI/compiler/source pins, not just a manifest count.

`command-receipts.json` records ten independently observed credential-free checks:35 producer actual-source controls,28 conserved cleanup/driver controls,9-file recommended-JS lint,6 syntax checks and actual strict source preflight. All exit0. Their raw stdout/stderr are retained. Independent network blocking lives only in this review directory; all recorded denial counters are zero. The extra two instrumented witnesses exit0 as observation harnesses but their **outcome status is FAIL / REPRODUCED_BLOCKING_DEFECT**. They are not labeled passing acceptance checks.

The successful Linux compiler readiness receipt SHA256 `524f2d489c96eb33bc9782febcfe24e740d55d449d7e5b5d48cea7c18d323538` was inspected and rehashed; it was not rerun by this judge. It records20 seconds elapsed, immutable image `sha256:9ff43bfe7849197a6dfbaa80f2d11a34db4202d8aaae269ddc8b740f7da75fb3`, UID501,2GiB cgroup, owned `/tmp` HOME, all pre/post max/oom/kill counts0, exact CLI version/help and full projected fixture typing. The original HOME failure is corrected with explicit owned runtime HOME. The first512MiB failure's vanished child/cgroup evidence remains unavailable; a distinct diagnostic establishes V8 heap exhaustion and is not retroactively used as that lost observation. No additional large Linux/resource phase was necessary for this rejected preparation candidate.

Custody precision is explicitly limited: the current helper's `sourceIdentity` uses Number-valued dev/ino and floating-point `mtimeMs`/`ctimeMs`, and reads source content by pathname without holding a source FD. This review does **not** claim exact decimal nanosecond/all-nine-field/held-FD identity or apply C8's separate physical-custody acceptance assertions automatically. Its blocking replacement witness is independently sufficient under Task03's existing owned-file requirement. Any repair must accurately state the prospective identity it actually verifies.

Reviewer writes are confined to this new review directory. Public frozen module/control/manifest copies are retained under `reviewed-source/`. Candidate, accepted priorQA, product, private directories, volumes, Git, management helper and enabling attestations were not mutated. No credentials, actual private diagnostics, JWTs or keys were read. No external request or service operation occurred. The numerical-cycle waiver permits repair/review continuation but does not waive either demonstrated fence.

## Scores

| Dimension | Score | Reason |
|---|---:|---|
| Requirement Fulfillment |3/5| Two prepared removal conditions are unmet; source/toolchain/count preservation otherwise substantiated |
| Code Quality |3/5| Safe CLI/result handling improved, but custody/removal ordering still permits unsupported mutation |
| Test Quality |3/5| Substantive63 controls and quality checks pass; nonterminal expectation is wrong and post-custody replacement is untested |
| Pattern Adherence |4/5| Disjoint ownership, frozen ancestry, original criteria and historical failures preserved |
| Completeness |3/5| Prepared compiler path works, but safe removal is incomplete and release must remain held |

**Average:3.2/5.** Fresh independent review after bounded repair is required. Preserve this failed freeze, exact source/control preimages and both witnesses; do not overwrite prior results or waive the original acceptance stages.
