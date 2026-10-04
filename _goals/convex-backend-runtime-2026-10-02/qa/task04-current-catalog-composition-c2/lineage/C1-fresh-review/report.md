# Task Judgment: current catalog composition C1 proposal

## Verdict: REJECT

The catalog preservation logic and isolated four-file proposal pass their offline behavioral checks. The runner does not satisfy the required filesystem and network containment controls. Keep the actual four-file splice on SOURCE_SERIALIZED HOLD; repair in a new bounded subject and obtain fresh independent review.

## Evidence Review

Reviewed AGENTS, runtime/profile, pessimistic-judge and judge-task, the original decision register, goal and Tasks03/04, the current repair backlog, all four complete original failure messages, the frozen runner/probe/guard/adverse/config/copies/patch, source and dependency receipts, and discovery/history/gap metadata. No Git, product, actual test/config, prior QA, dependencies, services, credentials, private inputs, native execution or paid inference were changed or invoked.

Frozen subject report SHA256 is `43a83afb03deac11402a3b392a2d9af1767056ec7ea3613173df8f6f96e55df6`; manifest SHA256 is `7b4c2e43e0c607dd59721f9984bd42eb76dc69cea45df3eb859770fe1951f939`. Exact recursive closure independently verified:1424 rows,1413 regular files and11 symlink literal targets; excluded only the exact root self-manifest. Every nested manifest is included. External dependency trees were not traversed. All136 protected current source bytes match retained preimages before and after observed checks. All32 subject dependency entries, including repeated paths across five checks, match their real before-execution byte preimages and post hashes.

Fresh observed checks:

| Check | Result | Evidence |
|---|---|---|
| Copied current composition | PASS | `checks/fresh-composition/`; exact07df projection,26/173 baseline,31/184 current,275 registrations |
| Four isolated copies | PASS,4 suites,454 cases,0 pending/skips | `checks/fresh-four-02/`, `fresh-four-02.json`, `case-verification.json`; all454 original full names equal |
| Existing adverse controls | PASS,30 groups | `checks/fresh-adverse/`; original frozen source, preload guard |
| Installed TypeScript | PASS | `checks/fresh-types/`; noEmit, incremental disabled |
| Scoped ESLint | PASS | `checks/fresh-lint/` |
| Independent source/native adversaries | PASS,15 rejection controls | `checks/independent-controls-03/`; old table/index/validator, module/source, visibility, handler, extra, return, fake actual root and re-export |
| Independent approved metadata reflection | PASS | `checks/independent-approved-03/`; direct accepted4467 fragment/c827 policy imports, all5 complete native definitions/all16 registrations, false expected validator rejected |

Every invoked check records exact argv/cwd/UTC/raw stdout/stderr/exit and BEFORE/AFTER136 protected hashes. The first review-only Jest relocation attempted a scratch route outside the copied runner fence and failed the original four composition cases; `checks/fresh-four/` and its450/4 output are retained. Corrected only review-copy orchestration paths, preserving all assertions and imports. Two early independent controls incorrectly chose an absent `returns:` source needle and an unchanged public flag; both real failures are retained before corrected controls. Independent reflection first assumed a string documentType, then encountered JSON omission of undefined stagedDocumentType; both failures are retained. Final probe explicitly validates the object validator structure and undefined stagedDocumentType before comparing the complete JSON metadata. No false pass was promoted.

## Requirements Review

| Requirement | Met? | Evidence |
|---|---|---|
| Exact accepted07df26-table schema by only two additive lines | Yes | Fresh composer; frozen whole-byte theorem unchanged |
| All26 full validators/index/search/vector and27 artifact argument/return/visibility contracts | Yes | Deep equality in fresh witnesses; independent wrong validator/index/return/visibility denials |
| Only approved5 tables/11 additional normal indexes and16 INTERNAL builders | Yes | Source pins, fresh exact definitions and independent source-derived reflection; builder AST/re-export denial |
| Prior endpoint rows and classification/canonical authority remain visible | Yes | `inventory-verification.json`; all259 prior rows deep-equal the current catalog prefix |
| Current275=200 public+75 internal; prior259=200+59;37→38 modules | Yes | Source-derived inventory outputs; selected25 remains7 public/18 internal |
| Original22 literal/17 validator/25 selection/27 artifact expectations and454 names retained | Yes | Original patch reviewed; copied454 execution and exact full-name equality; all31-table duplicate loop retained |
| Real production root EMPTY; forged caller actual label not authority | Yes | Native rootLookup null/forgedRootTrusted false, independent fake-root denial |
| Source fences before effects | No | Reproduced directory creation before drift denial |
| Destination and replica symlink safety | No | Successful275 composition escaped lexical base; existing replica file symlink overwritten before probe |
| Cleanup all failure arms | No | Native/import/inventory errors retain owned replica/scratch; no try/finally in compose |
| Fetch/HTTP/socket network denial | Partial | Existing30 controls pass, but Socket.prototype.connect bypass reproduced with stub transport |
| Offline/internal reflection only, no SDK or codegen claim | Yes | Runtime method/structure verified; native service/codegen never invoked |
| Actual source splice/full70 unit/native/all17 completion | Incomplete | Deliberately held; no acceptance claim |

## Issues Found

### Critical (must fix)

1. `current-compose.mjs:56` uses a lexical `startsWith` destination fence, accepting symlink ancestors. The exact unchanged copied runner successfully composed275 endpoints through `subject-copy/scratch-link/probe`, while the files were written into sibling `escaped-destination/probe` outside its permitted base. Both paths were inside this review's authorized area. The production code would accept the same pattern pointing elsewhere. Reject symlink ancestors and validate real filesystem containment before any mutation.

2. `current-compose.mjs:60` and `:61` reuse an existing replica without rejecting symlink entries. `scratch-copy-probe.mjs` planted a replica schema symlink to an owned sentinel. `copyFileSync` followed it and replaced the sentinel with exact current b95 schema bytes before the native probe failed. `checks/scratch-copy-probe/stdout` retains before bytes/hash, after hash and actual error. Allocate a fresh exclusively owned replica, reject existing destinations/entries, copy without symlink traversal and verify the entire dynamic source tree before imports.

3. `offline-guard.mjs:9` changes `net.connect/createConnection` but leaves `net.Socket.prototype.connect` untouched. A stubbed underlying transport recorded one call after fresh guard import. No socket or network operation occurred. Trap the socket instance API and add an outcome assertion against it; audit equivalent direct socket entry points rather than claiming the three existing API probes cover all sockets.

### Important (must fix for this proposal)

4. `current-compose.mjs:56` creates the directory before the136 source fences at`:57`. A review-only altered AGENTS pin reproduced a retained newly created directory on rejection. Move source verification before effects and independently test an unchanged destination on source drift.

5. `current-compose.mjs:55` through`:80` has no finally/error cleanup around allocation/copy/native/inventory. The replica remains after a real native import error and after the old inventory rejects an added JS re-export. The proposed tests clean their own mkdtemp directories in finally, but direct runner invocation does not. Define runner-owned resources and cleanup every failing arm while preserving any caller-owned directory. Add failure controls for each execution stage.

### Not a finding

An attempted preexisting JS-sibling import injection did not execute. Native imports chose the TS module; the historical inventory subsequently rejected the unexpected re-export. Its status is explicitly NOT_REPRODUCED. This is not evidence of an executed dynamic import exploit.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 2/5 | Required source-before-effects, symlink safety, socket denial and failure cleanup unmet |
| Code Quality | 2/5 | Reproduced unsafe copy/write containment and incomplete resource safety |
| Test Quality | 4/5 |454 meaningful original cases and deep native contract checks pass; required containment branches missing |
| Pattern Adherence | 4/5 | Exact source preservation, separate additive contracts and honest offline scope |
| Completeness | 2/5 | Proposal containment gate incomplete; real splice correctly held |

**Average:**2.8/5. Under judge-task's any-dimension≤2 threshold, verdict is REJECT. This is a rejection of this frozen offline proposal, not a finding that approved product contracts should change.

## Evidence Limits and Recommendation

The subject's three pre-invocation startup failures retain explicit NOT_CAPTURED startUTC/before-hash gaps; no missing history was manufactured. Several early discovery probes also lack exactUTC, as already disclosed. Review wrapper startup mistakes (undefined local node variable and wrong dependency row hash key) occurred before any dependent command; their exact UTC was not captured. Their tool tracebacks and this disclosure are retained. Subprocess failures themselves have complete raw receipts. Subject before-execution byte-preimages were independently checked; review controls have dedicated byte-preimages before their final successful versions. Do not mislabel reconstructed or copied evidence as a historical observation.

Repair the five containment issues in a new subject, retain the exact catalog/native contracts and all original cases, and add independent symlink/source-drift/socket/failure cleanup controls. Keep the four-file minimal patch unapplied until fresh review and ROOT's explicit source-serialized release. No numeric retry limit is imposed by this judgment; all original gates remain.

Seven legacy SDK asset failures remain unchanged in Task11 scope. Full70-unit execution, live memory observer, current native target/publication/codegen/OCC, actual service inference, all original Task03/04/08/09/14/17 and UI/full-core gates remain incomplete. The observed454 offline cases do not certify those outcomes.
