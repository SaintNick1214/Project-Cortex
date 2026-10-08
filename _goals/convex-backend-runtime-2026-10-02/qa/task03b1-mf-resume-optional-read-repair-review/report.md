# Supplemental Task Judgment: MF optional READ callback repair

## Verdict: PASS — narrow offline repair, average 4.2/5

The reviewed runtimeDataAuth.ts SHA256 is 3fd328761100777a06c0fe243deb68825492ddbefd669b23dbc1f9e125e4fd27. This independent supplemental judgment closes the callback-origin blocker against the repaired current source only. The earlier original42 offline PASS4.2 and later unrepaired optional-read REJECT remain separate immutable historical judgments. No original requirement or failed historical receipt is relabeled or waived. Numeric cycle limits alone were overridden by the user's instruction.

## Evidence Review

Read repository AGENTS.md, CODEX-RUNTIME.md, PROJECT-PROFILE.md, pessimistic-judge role, judge-task rubric, original Task03, authoritative decision register, earlier cycle4 judgment and callback-origin rejection. Inspected actual registered memories.store/update/updateMany and facts.store/update paths, runtimeAuth.ts resolver/reader implementation, runtimeDataAuth.ts repair diff and new optionalReadFailures.test.ts. Source snapshots and hashes are in source-manifest.json and source/. All seven reviewed source hashes still match the repair receipt, including unchanged memories/facts/schema/auth prerequisites.

At runtimeDataAuth.ts:626-639 callback invocation and await are wrapped without binding, reading, reflecting on or stringifying the thrown value. Identity acquisition at :662 occurs outside the permission-denial catch. All eight AuthorityReader methods are protected before resolveAuthority's candidate-pruning catch; the persisted WRITE fallback uses the same protected reader. The exact native FORBIDDEN payload therefore cannot impersonate a permission denial when it originates in an identity/control callback. Wrapped failures use the fixed BACKEND_OPERATION_FAILED/not_committed envelope.

At :643-657 only an exact static accepted resolver denial is eligible for READ-less fallback: native class, own data descriptor, ordinary/null prototype, exact five keys and exact values; accessors/private/malformed metadata fail classification. Origin protection is essential: descriptor parsing alone would not repair exact-looking callback errors. At :670-672 fallback independently reloads WRITE, and a writer that includes READ cannot mask a failed READ check. Existing mutation admission, READ retention and final delivery fences remain intact.

## Requirements Review

| Requirement | Met? | Evidence |
|---|---|---|
| Identity synchronous throws and rejected promises must abort even for native exact FORBIDDEN | Yes | Independently replayed unchanged prior80 matrix, all80 matched; earlier60 false committed receipts now abort/rollback |
| Malformed/code-only/private-message/private-field/data-accessor/code-accessor errors must remain opaque | Yes | Prior80 reaches each identity error origin; all70 failure cases abort; diagnostic getter counts all0 |
| Proxy diagnostics must not execute; arbitrary callback errors cannot become missing READ | Yes | Registered100 regressions include hostile identity proxy; fresh240 controls include revoked proxies and throwing own-data getters, all0 getter reads |
| All eight authority-reader callbacks must preserve infrastructure failures through candidate pruning and WRITE fallback | Yes | fresh-controls.stdout:8methods×2timings×3modes×5handlers=240/240 reached exact opaque failure, complete fixture-row rollback, no returned diagnostics |
| Initially READ-less valid WRITE still returns a usable safe receipt | Yes | Prior80 retains10 healthy controls; new registered10 positive controls pass; existing WRITE-only baselines retained |
| Previously admitted READ revocation/expiry must continue to stop commits | Yes | Existing371 cases pass unchanged; final-read6 and original confirmation30/repair26 replay receipts preserve admitted READ rollback expectations |
| Five actual mutation handlers must deny and roll back complete table/source effects | Yes | Prior80 and fresh240 invoke current registrations through transaction-aware fixture, compare entire pre/post rows, assert reached injection, fixed envelope and recorded attempted writes |
| Original canonical source/manual CAS/history/source-fence behavior remains | Yes | Main-source replays of confirmation30, repair26, source-fence6, historical-source3, final-read6 all pass; scripts changed only import roots from accepted candidate to main |
| Current affected native tests/types/lint pass | Yes |471/471 tests across7suites,0failed/pending/todo; actual backend ES2021 tsc, scoped tsc and affected ESLint exit0 |
| Preserve original witnesses and avoid shared/SDK/artifact/stats changes | Yes | Product files untouched by judge; current source hashes match repair record; allowed QA/scratch writes only |

## Independent Checks

commands.json records exact arguments, working directories, exits and measured runs; raw stdout/stderr and native tests.json are retained. Jest used the inert http://127.0.0.1:1 setup prerequisite and actual handlers via the fixture; it made no live service request. Prior80 summary:80/80 matched,0unexpected successes,10ordinary positives,10ordinary Error denials. Fresh240 summary:240/240 matched,0missed injections. Reader failures cover findPrincipal, getPrincipal, listMemberships, getMembership, listGrants, getGrant, getScope and hasTombstone. Scope/tombstone cases provision a separate tenant READ grant to force candidate materialization; pinned-reader cases exercise persisted WRITE fallback. Exact safe-looking native error, throwing private-data accessor and revoked proxy are exercised for every method, timing and handler.

The first fresh-control attempt used Node's default stack depth and missed15 rejected getScope injections;225/240 matched and15 controls succeeded because the injection was not reached. Its raw output is preserved as fresh-controls-short-stack.noncertifying.json and its exit1 remains in commands.json. Increasing scratch Error.stackTraceLimit to100 allowed exact optionalMutationRead origin selection and all240 injections to be reached. This is a fixture injection correction, not a product fix or weakened assertion. Final script/output are saved; corrected run exit0 is separately recorded.

## Main integration and accepted-witness preservation

Current main memories.ts/facts.ts and all four pre-existing runtimeEndpointAuth test/fixture files are byte-identical to the accepted cycle4 candidate (accepted-candidate-preservation.json). Current schema memories/facts blocks independently match the accepted candidate exactly (schema-owned-verification.json). The parent's preserved main-integration schema merge script restricts changes to those two blocks and checks all17 other original blocks before writing; the historical receipt confirms that check. Subsequent independently owned artifact/registry schema composition is excluded from this narrow judgment.

Reviewed qa/task03b1-mf-main-integration receipts: initial backend/root checks exited2, corrected merged backend exited0, root diagnostics still exited2; those failures remain preserved. The saved combined native unit receipt in that directory records1420/1420 in13suites,0pending/failed. A stated later1553 run is not the count in that historical file and is not substituted for it. The fresh471 native tests and original71 controls above certify the current MF helper/entrypoints for this bounded repair. This PASS does not downgrade or replace original42 accepted source-witness requirements, authorize dropping them, or certify full-root/consumer integration.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment |5/5| All narrow callback-origin repair requirements verified, original semantics and accepted witnesses retained |
| Code Quality |4/5| Typed protected callback adapter, awaited propagation, fixed opaque error, strict static permission envelope; no raw diagnostic inspection |
| Test Quality |4/5|471 meaningful native outcome tests; unchanged80 replay; independent240 all-reader failure outcomes and71 original source/read controls |
| Pattern Adherence |4/5| Existing trusted resolver and persisted authority reference reused; scoped Convex structured failures and rollback conventions preserved |
| Completeness |4/5| Shared helper reached by all5handlers; actual scoped compiler/lint/tests pass; full Task03/live gates explicitly excluded |

**Average: 4.2/5.** Every dimension is at least4 and Requirement Fulfillment is5.

## Issues Found

### Critical

None found in the bounded repaired callback-origin contract.

### Important

No repair blocker. Actual deployed identity/JWT callbacks, Convex transaction/OCC and schema admission, subscriptions, storage/private bytes, tooling/connectors, managed vectors and paid inference remain unexecuted here. This fixture evidence is not deployed exploit evidence or service certification. Shared SDK/artifact/stats work is independently owned and excluded from this verdict. Full Task03, whole core QA and the full runtime goal remain incomplete.

### Minor

The registered low-level callback regression currently targets db.get; the broader eight-reader matrix is saved independently rather than registered in Jest. Consider retaining that matrix as a future regression suite if this private adapter evolves. Existing100 regressions already cover the discovered identity callback defect and a candidate-control failure, so this is not a current correctness blocker.

## Recommendation

Accept this narrow optional READ repair and continue independently authorized integration/live gates. Preserve earlier judgments and their raw failed outcomes without rewriting their verdicts. No deployment, service call, commit, product/test edit or SDK/artifact/stats write was performed by this review.
