# Task judgment: frozen C3 finite qualification launcher composition

## Verdict: REJECT

This is a bounded launcher judgment against the original requirement: a technically runnable, source-specific finite qualification launcher, preserving all122 exact argv/source/assertion/cap bindings and capturing generated consumed inputs before every child. It is not whole Task04 product acceptance. C3 remains implementation-incomplete. Positive OWN controls do not replace that criterion or release any original command. This review independently executed the new seam; it also reproduced a concrete cleanup/error-retention defect.

## Evidence review

Read repository AGENTS, runtime/profile, pessimistic-judge and judge-task rubric, original implementation prompt, Task04, authoritative decision register and relevant architecture technical gates. Read and parsed the full nine QA artifacts, both candidate composition implementations, registry/fixed launcher, module boundary, compiler/session/facade/build port, VM/FS ports, generated-parent and supplemental process ports, original ancestor-control/guard and inventory sources, and finite-recipe inventory/source evidence. `source-review.json` verifies all122 original argv and original entry SHA bindings against both the approved finite contract and independent audit. Descriptor labels establish preparation, not executed recipe correctness.

The frozen QA/work/tmp literal seals matched all recorded fields and entire membership, excluding only their own seal files: 9/70/8022 rows, including four literal symlinks never followed. Their exact SHA256 values remain ffff1d0c88b66437b3f8fbd069a20e5c4c402abc200ef33cacf9e51a80ed4d96 / 1cad81581eaccce6dfee140440fd0032c16c43cf128f3dc21a2cd99a7213cd7e / 88d0273651681cd10f2f3dbbe6fe3c29604bd5778be04297b0393322c01616a8. Whole PRE/POST snapshots include each seal too (10/71/8023 rows). Mode/uid/dev/ino/nlink/size/content and membership are covered; timestamps/gid are not asserted. All35 external plus4 prepared references matched their expected byte lengths/hashes and remained equal POST. Actual PRE/POST observations are retained in OWN tmp, rather than asserted from labels.

OWN directory: `/tmp/cortex-native-c5-independent-review-c3-fresh-20261004a`. Exact interpreter argv, UTC, cwd, PATH/TMPDIR, raw stdout/stderr, exit and timeout status are in `execution-receipts.json`. The control imports the candidate seam without path replacement and captures/validates all4591 returned closure files as content-addressed gzip before installing ports. The outer recorder archives its control entry before each OWN Node child. These observations are OWN controls, not an original qualification recorder or proof that every prerequisite consumed during seam setup was archived before the outer Node interpreter started. Every actual compiler service input listed by the candidate is archived before that service dispatch, with source stdin preserved in its exact raw tape. No original122, default frozen controls, driver/qualifier/provision/deploy/reconcile, private ROOT paths, signing inputs, native/paid or Git/history mutators were executed.

## Requirements review

| Requirement / route | Met? | Evidence and limits |
|---|---|---|
| B01 fixed IDs, exact argv/source-specific contract | Partial | All122 bindings checked; registry and fixed launcher explicitly reject original122. No runnable original launch mechanism. |
| B02 synchronous/CJS/callback/named FS | Partial | Actual named write/outside denial/VM write PASS; byte-exact accepted policy remains SHA72eedf1f80bcca600319e690605d29675389fbb6dda371246293f63ee242ec03. No all122 outcome execution. |
| B03 promise/FileHandle/inode/resource lifetime | Partial | Normal close of real tracked fd PASS, fd EBADF after close, unresolved0. Restoration failure defect below. Prior component acceptance cannot accept composition. |
| B04 module/VM/import composition | Partial | Real esbuild import value17, produced drift and unknown-before-body rejection, original/module/process holds, OWN VM named FS PASS. Public graph hash checked; trusted fixed graph only. |
| B05 exact generated parent recipe | Prepared only | Source-bound two-field template checks exist. Original source/PARENT gates and generated child preimage archival remain held. |
| B06 compiler service plus generated output registration | Partial | Actual installed esbuild exact argv, successful exit0, complete/decompressed raw stdin/stdout/stderr hashes and output registration PASS. Eight original compiler recipes not executed; raw graph-sized allocation is finite, not an output-fit theorem. |
| B07 finite argument/environment binding | Partial | OWN exact argv/cwd/owned PATH/TMPDIR recorded; no original launch. No arbitrary release flag can open current registry. |
| B08 ROOT real-effect gates | Held correctly | No deployment, paid/native/publication/signing effects. Holding required routes prevents full launcher readiness. |
| B09 historical mutators/uncalled process forms | Held correctly | Historical mutators denied. Supplemental CLI cp/stage/tsc paths are not actual122 process routes and do not prove qualification. |
| B10 original preservation/custody | Prospective only | Whole frozen roots and external references equal PRE/POST. Six historical custody gaps remain BROKEN; recovered-state equality does not repair them. |
| Every generated consumed entry/bootstrap input captured before its child | Unmet | Candidate report acknowledges absent inner generated entry/bootstrap archival; outer snapshots/service stdin do not satisfy the full original criterion. |
| Original assertions, caps, diagnostic/timing/source tiers retained | Binding verified; outcomes incomplete | All122 exact binding checks pass. Original source remains byte-pinned; no original execution. compiler20s/recorder120s unchanged, no assertions relaxed; original256000 and source-derived finite IPC overflow FAIL/incomplete remain mandatory. |
| Full technically runnable source-specific finite launcher | Unmet | No reviewed ROOT original admission/orchestration interface; registry/fixed launcher/module boundary categorically hold original entries. |

## Actual independent controls

`positive`: exit0, seven grouped controls PASS. Actual real esbuild stdin recipe exports preparedCompositionValue17; generated import returns17; service argv exactly `[.../@esbuild/linux-x64/bin/esbuild,"--service=0.27.0","--ping"]`, cwd repository, inherited owned TMPDIR, dispatch1, exit0/signal-null, rawComplete=true, each raw gzip tape verified by decoded length/hash plus encoded hash. Produced byte drift rejects with IMPORT_DRIFT; unregistered import rejects with IMPORT_GRAPH before throwing body; original import rejects with HISTORIC_IMPORT_DENIED; process import/spawn held; write outside the UUID session denied; pinned OWN VM producer writes through named FS; real owned fd joined/closed and all normal FS/VM/process/global ports restored. sourceFence POST EQUAL.

`close-primary`: exit0, injected closeOwned error OWN_CLOSE_PRIMARY remains the returned error and all normal restores run. sourceFence POST EQUAL.

`restore-failure`: exit1, deliberately retained failing assertion. Injected closeOwned OWN_CLOSE_PRIMARY plus preload.restore OWN_RESTORE_SECONDARY returns only OWN_RESTORE_SECONDARY. Actual observation: processRestored=false, VMRestored=false, fsRestored=false, globalCleared=false. The primary-retention assertion fails (the optional errors lookup is undefined); raw observation shows the primary error is absent. sourceFence POST EQUAL. This is a defect reproduction, not a passing control or unexpected original qualification failure.

Initial reviewer recorder setup failed before any child because preparedInputReferences is a dict containing files; repaired its schema lookup and retained that failure. Initial read-only seal verifier expected byte hashes for symlinks; repaired it to verify exact literal target. Neither affected candidate code, caps or assertions.

## Issues found

### Critical: no original launcher readiness

`command-registry.mjs` returned launch throws QA_BRIDGE_ORIGINAL122_HELD; `fixed-command-launcher.mjs` rejects all original registry IDs; `independent-review-seam.mjs:16-17` and composed runtime populate deniedEntries with every original mirror entry. There is no source-pinned ROOT admission/orchestration interface that can execute the approved finite recipes, and no complete generated entry/bootstrap prebyte chain. Repair the missing bounded launcher mechanism and before-child archives; retain present holds until that mechanism has fresh independent review. Do not relabel OWN controls as the full gate.

### Critical: cleanup aborts and masks original errors

`independent-review-seam.mjs:19` and `composed-runtime.mjs:23` use sequential restoration in finally. A failure in preload.restore skips VM restore, module hook deregistration, compiler-global deletion, process restoration and syncBuiltinESMExports; it also replaces a captured closeOwned primary. The fresh injected receipt reproduces that exact behavior. Each restoration step must be independently attempted, with original primary plus all subsequent cleanup failures retained, and later restoration must run even when an earlier one fails. Add actual composed error-path assertions for early/middle/late cleanup failure, not just normal unresolved0.

Both close methods also await compiler.joined before entering cleanup protection. Important qualification: current compilerSession returns a frozen object and normalizes pending build failures to fulfillment, so joined rejection was not reachable through its ordinary current implementation; this review does not claim an observed join-rejection defect. Move join under exhaustive cleanup protection to maintain the intended lifetime contract, preserving any join failure if future implementation makes it reachable.

### Important: partial install and inner recording coverage

Install performs multiple global mutations sequentially without a rollback guard. Failures after installing earlier ports have no returned closer. This is source-inspected missing error-path coverage, not a separately reproduced failure. Use staged rollback/error aggregation and test failures at install boundaries. Do not admit original recipes before generated input/bootstrap capture is complete.

## Dimension scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement fulfillment | 1/5 | Full runnable finite launcher and complete generated before-child custody absent. |
| Code quality | 2/5 | Reproduced primary masking and abandoned restoration; normal paths work. |
| Test quality | 3/5 | Meaningful positive composition assertions; original recipe coverage and cleanup failure coverage missing. |
| Pattern adherence | 4/5 | Explicit owns/holds, accepted policy preserved, source-bound public graph, honest service limitations. |
| Completeness | 1/5 | Registry/launcher/module wiring intentionally prevents original execution. |

Average: 2.2/5. Under judge-task thresholds, any dimension at most2 means REJECT. The explicit incomplete status is accurate; this review is not rejecting that disclosure.

## Preserved failures and unresolved coverage

The candidate's69134 source-path failure and120s no-return/no-partial-raw, 2d9d EEXIST and dependent import GRAPH denial, and ee050120s failure with partial raw remain failures. bb577 successful OWN runtime batch does not erase them. Old C1 foreign-close/accessor rejection and accepted C2 component scope remain distinct. Full8 recovered equality is prospective only; six historical BROKEN custody windows never become PASS. Native feasibility, source/PARENT/ROOT/timing gates and all actual122 source outcomes remain unexecuted/held. Task04 operation/model/budget/fallback product acceptance and actual paid/native evidence remain outside this bounded review.

Recommendation: repair exhaustive cleanup/error retention, rollback partial installation, implement a pinned reviewed ROOT finite launch/recording interface including generated prebytes, and obtain fresh independent composition review before any separate source/PARENT/native/timing/ROOT gates. No product or frozen evidence files were modified by this review.
