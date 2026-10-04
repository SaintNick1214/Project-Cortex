# Task judgment: parent native identity and argument inputs

## Verdict: REJECT

Scope is the historical C3 parent source and the new finite current-input watcher, plus their noncredential provenance and guard dependencies. This is not a judgment of C4 preparation, native B, model readiness, complete Task04 or the goal. No target exists for this review and no live action was performed.

## Requirements review

| Requirement | Observed evidence | Result |
|---|---|---|
| Historical locators actually originated in owned C11 receipts | All four archived source SHA256/byte counts match the allowed C11 files. All nine table/locator hashes match the selected owned references and have same-run journal witnesses. Qualification reports cleanupComplete and retired project3138249 has delete200/absence404. | PASS historical provenance only |
| Current operation and attempt IDs come exclusively from future core receipts | Watcher lines15–17 accepts preseeded history model IDs and writes SOURCE_BOUND_NATIVE_ISSUANCE_PROVENANCE with empty currentCoreOwnership. | FAIL |
| Exact historical proof is validated before current bundle | Line33 merely reads/hashes initial proof, without canonical private read, matching operation/run, source hashes or locator digests; a foreign-operation proof succeeds. history.provenanceSHA256 is ignored. | FAIL |
| Frozen target/run guard | Candidate guard checks operation, source freeze, reviewed source, publication, safe selectors and private scratch. Actual validateTarget accepts target.runId different from request.runId; watcher line19 ignores returned target and does not compare repeated operation/run/target identity before output. | FAIL run binding |
| Canonical private input/key paths | Watcher uses canonical600 reads for history and current receipts; symlink history and644 current receipt fail. Historical parent lines24–26 uses statSync600/700 only for shared key path, which accepts a symlink. It does not check key owner, regular type, nlink or canonical ancestors. | FAIL reusable key path qualification |
| Signature/public-key identity contract | Historical source compares RSA n/e against frozen auth config, uses RS256/kid/issuer/audience, produces seven identity negatives and eight signatures with no key generation; public key-match and parent receipts agree. Actual cryptographic revalidation was skipped because private/JWT files are forbidden. | Historical receipt/source corroboration only |
| One bounded config call to own target | Source calls livePreflight, one redirect-error POST to target deployment update_environment_variables with30s timeout and checks200; historical safe receipt confirms exactly one config call. No output prints values or JWTs. | PASS source/archived receipt, no new call |
| Watcher finite and effect-free |120s deadline,100ms polling; actual VM missing and partial receipts reach bounded failure. Watcher contains no network, signing, RPC, row creation or storage APIs. Only exclusive private input artifacts are written. Existing proof prevents bundle writes. | PASS |
| Current decoding remains honest | Historical and current helper both explicitly say NOT_RUN. Exactly artifacts:completeArtifactUpload and attachments:attach must later produce noJWT handler FORBIDDEN/UNAUTHENTICATED after native validator acceptance inside unchanged1400 sweep. Internal aliases and shape flags are not decoding evidence. | NOT_RUN, required future gate |
| C3 failure/retirement preserved | Archived result reports official CLI missing convex dependency exit1, zero native tickets/committed rows/storage, terminal owned CLI group, target3138926 delete200/absence404. Candidate source unchanged; archived historical parent source exactly matches reviewed source. | PASS historical failure accounting |

## Dimension scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment |2/5 | Current source-bound provenance can be emitted without either required current receipt; run/key/proof boundaries incomplete. |
| Code Quality |2/5 | Unchecked historical ID spread, unvalidated proof, and incomplete key/run path guards. |
| Test Quality |4/5 |16 actual-source credential-free checks,11 expected boundaries and5 accepted counterexamples; four source and nine locator witness checks. No service claims. |
| Pattern Adherence |3/5 | Exclusive600 outputs and frozen/source guard reuse follow patterns; direct proof/key reads bypass their canonical private pattern. |
| Completeness |2/5 | Helper is reachable and finite but cannot yet certify the mandatory input contract. |

**Average:2.6/5.**

## Critical issues and required repairs

1. `work/resume/task04-native-current-inputs.mjs:15`: require the exact nine historical table keys, reject operation/attempt keys in history, and require both fresh receipt entries before constructing scope. Validate nonempty bounded string IDs and receipt operation/table/kind/name. Producer ownership receipts deliberately have no runId field; do not invent that requirement. Bind their operation to an explicitly verified frozen request/run and fresh private target directory instead.
2. `work/resume/task04-native-current-inputs.mjs:33`: read initial proof canonically with private permissions and validate exact operation/run, history proof digest, expected historical source hashes/bytes and per-table locator hashes against the proof before any current artifact is written. Do not merely hash arbitrary bytes and label them source-bound. Note history digest uses compact JSON serialization while archived file has formatted bytes; compare the intended serialization consistently.
3. Parent-level adaptation must explicitly compare frozen request.runId with target.runId and retain immutable operation/run/project/deployment identity from every repeated preflight, including a final preflight before exclusive outputs. Actual C3 guard lacks run binding. This review did not modify that guard or C4.
4. Any reuse of the historical signing source must replace mode-only stat checks with canonical regular-file owner/nlink600 checks and canonical owned700 parent checks before reading the existing private key. The credential-free dummy symlink reproducer shows statSync follows symlinks. No real private key was inspected.

Keep the historical executed source preserved. Prepare a new parent helper adaptation, preserve its exact source hash in the future parent input receipt/archive, and obtain fresh independent review before execution. Numeric retry waiver does not waive this failed input gate. No extra RPC, rows, uploads or hidden decoder claim is authorized by these repairs.

## Actual checks and limitations

`results.json` is the exhaustive actual assertion record. The watcher executable body was unchanged and run in a VM with controlled import bindings: real isolated filesystem reads, real canonical guard function, fake target preflight and argument generator, virtual clock, network trap. The real top-level parent module and livePreflight were never executed. Guard validateTarget and the historical key permission assertion were separately extracted exactly and run on noncredential synthetic metadata/dummy symlink paths.

Passing boundaries: legitimate current receipts, foreign history operation/run, foreign receipt operation, missing receipt timeout, partial receipt timeout, wrong receipt filename, insecure receipt permissions, symlink history, exclusive preexisting proof, nonstring receipt ID rejection. Accepted counterexamples: stale history model IDs with no current receipts, foreign initial proof, changed repeat-preflight run ignored, actual validateTarget foreign run accepted, actual key mode assertion symlink accepted.

Initial VM harness attempt exposed local umask masking the insecure-permission fixture; corrected fixture explicitly chmods its dummy file. Second attempt disproved a suspected nonstring ID acceptance because real sha256 rejects numbers; corrected expected result to rejection. Both original failures and subsequent successful runs remain in raw logs. These were review harness corrections, never product/helper edits.

Skipped: all real network/service/target actions, Git operations, private key/env/JWT/peer/deploy-key reads, signing, package installs, application quality suites, real publication or argument generation, native RPC/rows/storage, actual model/Task04/B execution and actual two-path decoder observations. C4 itself was not reviewed. Its guard was read only to understand generic mechanical path adaptation; no current-gate or candidate file was modified.

Review writes are confined to this QA directory and unique `work/resume/task04-parent-native-inputs-review`. Protected pre/post source hashes are identical.
