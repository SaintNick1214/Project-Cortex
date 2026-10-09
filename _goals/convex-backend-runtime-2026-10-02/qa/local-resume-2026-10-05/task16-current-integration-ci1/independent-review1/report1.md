# Preliminary independent repair review — no source blocker; actual verdict open

Reviewer: /root/fresh_goal_review. Parent source: 732ce2b041d81ba458bbcc9a4c093bb38a5ef364. This is the ONE coherent successor review under [acceptance policy v2](../../../../acceptance-policy.md), continuing through the eventual repaired-source Linux CI/installed-host outcomes.

**Preliminary finding: no concrete reachable breaking finding in the reviewed repair diff and affected offline evidence.** The repair is reviewable and suitable for the already-authorized incremental commit/push and successor CI. **The final source-plus-actual verdict remains OPEN.** This does not grant Task06A1, a full task, any of the original six extension criteria or full-goal acceptance. Current counts remain12/17 tasks and54/61 criteria because Task06A1 is honestly reopened.

## Current failed actual run remains failed

[CI37911007445](https://github.com/SaintNick1214/Project-Cortex/actions/runs/37911007445) tests732ce2b and has conclusion failure; [run-final1](../run-final1.json), [failure/repair explanation](../failure-and-repair1.md) and raw failure1 logs are retained. The source findings are causal:
- Fresh Basic/canonical installation lacks the chosen functions-root tsconfig for genuine enabled Convex typecheck.
- Native privacy/graph staging omits active SDK src modules imported by Convex modules.
- SDK installed-catalog unit tests need the real current backend distribution before running. Raw failing shard logs explicitly show CURRENT_RUNTIME_DISTRIBUTION_REQUIRED.
- CLI test:fast rejects every forceExit override, including false, before running the suite.
- Six compile-only fixture type errors block root TypeScript; the corrections retain the runtime values and assertions.

The passing cleanup job does not change the failed workflow conclusion. Skipped actual inference suites provide no fresh functional qualification.

## Product composer and ten meaningful controls

I reviewed the actual additive-backend.ts diff, surrounding planning/apply code, all ten new causal controls and the bounded related test changes.

The default functions-root config matches the installed Convex1.46 codegen template's compiler options and include/exclude values; the local primary source is node_modules/convex/src/cli/codegen_templates/tsconfig.ts. It retains strict/noEmit/Bundler/ESNext/ES2023+dom/isolatedModules and generated exclusion. The one new proposed file is absent-only, rooted in the selected/custom functions directory. Existing config is returned unchanged, including comments/BOM/CRLF, and observed for staleness. Planning does not write. Apply validates observed preimages before the first write and retains symlink checks, exclusive absent-file creation, idempotence and original backup/atomic replacement rules. No new overwrite or path/authority fallback is introduced.

Controls cover real TypeScript6 valid compilation followed by an intentional number-to-string error exiting2, no emitted JS, absent/custom-root creation, unrelated byte preservation, existing commented config, repeat install, stale config creation/edit/deletion, symlink before planning/apply, directory refusal and prospective template bytes. The changed file-count assertions retain their meaning; current runtime integration checks exact planned/installed config bytes from the real built distribution.

[Installer report1](../installer-repair1/report1.json) records87/87 assertions,0 skipped plus CLI types/build/lint exit0 with natural child closure and no service credentials. The original19-case red (8 PASS/11 FAIL) remains. [Handoff1](../installer-repair1/handoff1.json) closes four source/test paths at digest9a7bff677d7f9fc9bbebe76947ad5435e9494ad314b2e8efe95e57dbc80da5fc. I independently rehashed those four entries against current bytes: no mismatch. This is affected offline evidence, not fresh Convex deployment acceptance.

## Native private staging

I reviewed prepare-ci-backend.mjs, the new credential-free scripts/lib/ci-backend-stage.mjs and four substantive native-backend-stage controls. Filtered active Convex and SDK sources keep their actual relative paths and canonical Convex tsconfig. Generated bindings are copied as current versioned inputs; the guarded entry still invokes genuine enabled codegen/typecheck. Trusted native fixture rewriting remains private to the disposable stage. The published distribution remains separate.

The filter excludes dotfiles, credentials JSON, archives, tests/fixtures and symlinked source inputs; controls actually construct these excluded sentinels. Current relative import closure, actual TypeScript checking and three entry-point bundles are exercised. Invalid owner/container/expected URL/foreign cloud targets refuse before stage creation or credential access. Original CI opt-in, exact expected owned loopback/authentication checks, private0600 env file, credential redaction and finally stage removal are unchanged.

[Native handoff1](../native-stage-repair1/handoff1.json) closes digest9c12f1a58f9d87896cd5c4a1e524f4825a1f2ae5e256e5247e532ab108ac7762. Four focused and44 aggregate CI controls pass,0 skipped; scoped lint exits0. Their children close naturally and test-owned stages are removed. The initial wrong test-path expectation and43 PASS/1 FAIL workflow-test red remain failures, not promoted results. No install, deployment, private-env read or service effect was performed by this author.

## Workflow and compile-only fixture repair

The actual workflow adds build:backend before current SDK unit shards; it does not replace installed-catalog assertions with mocked source. It removes the prohibited forceExit=false argument from only the canonical CLI fast runner. That runner still imports its existing actual Jest config with forceExit:false and rejects overrides; the other selected Jest commands retain their explicit false flags.

The additional workflow control now checks the actual CLI manifest test:fast entry and imported actual forceExit:false config, forbids forceExit overrides on that command, retains explicit false on the other six selected commands and asserts backend build precedes SDK units. This repairs the contradictory assertion rather than waiving natural-close coverage.

The two SDK test files widen the manifest variable to its declared DeploymentPolicyManifest contract, set the same read/write/run fixture capability array explicitly, and give jsonSchema the same required strings in a mutable array. No product policy, tool schema value or runtime assertion changes.

[Root report2](../root-repair1/report2.json) records current typecheck PASS; real backend build156 files/72 tables/2 components; current eight-suite643/643 affected SDK assertions,0 skip,natural exit;44 complete CI controls; prior275 SDK/28 CI controls; affected lint0 errors/1 warning. Three remaining catalog suites368 assertions pass separately. These are affected checks, not successor Linux CI. The raw current workflow/type/fixture inputs are pinned in that report, including the additional workflow control40e1ff07261c881fb5fa5adef09b9a56661df6f74ac3f64a71b54158d9fc6145.

## Failed-run cleanup and financial limit

[Final Native failed-run readback](../native-actual1/final-native-report1.json) closes only read-only financial/retirement outcomes for the dedicated SDK/CLI targets. It explicitly preserves the baseline's after-provisioning timing and does not invent a pre-provision snapshot.

SDK3176493/steady-snake-253 preserves11 account/16 operation/16 attempt rows by exact ID/fields; CLI3176494/usable-sheep-908 preserves8/10/10. No new calls/operations/accounts/attempts occur in that follow-up. Historical uncertainty1.6m+1m micro-USD is unchanged, with0 held slots. Artifact-bound tenant scopes are retired and all six current role checks deny; grants/history are retained behind epoch/tombstone fences, not claimed physically removed. The run's owned cleanup succeeded. Dedicated targets/settings/private credentials remain intentionally retained for successor CI. Main3174742 and original held2 were not read or changed by this follow-up. Local graphs are stopped with preserved volumes per the separately scoped practical receipt.

This readback is neither a repaired CI PASS nor a new model/media qualification.

## Pending final scope

The final coherent verdict awaits genuine successor Linux CI, including fresh/custom host enabled Convex typecheck/codegen, native privacy/graph source closure, all selected quality/installed client and actual inference suites, discovery/skips and owned cleanup. Only those applicable real outcomes can restore Task06A1. No new independent preparation, receipt, custody, clock or alias gate is introduced.

Original17 tasks/61 criteria/12 goal criteria remain. The six original ungranted extension criteria remain13A1,13A2,13A4,14A1,16A3,17A2; official async503 and genuine callback/poll/download/materialization/parity remain incomplete. C7 missing original sources/backing/custody and prior failures remain unrepaired history without reinstating retired QA ceremony. No product/full acceptance is granted here.

No reviewer product write, Git/service/settings mutation or paid call occurred. My only writes are this preliminary report/handoff under independent-review1. Parent may commit/push the reviewable repair under existing authorization and resume this same review with successor actual outcomes.

