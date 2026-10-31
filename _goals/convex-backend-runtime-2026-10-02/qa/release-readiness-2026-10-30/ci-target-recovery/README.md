# Temporary release CI target recovery

This local operator helper replaces the two missing CI targets in approved Convex team325340/project3200658 (`cortex-sandboxes`). It reuses the maintained private Proofs `sandbox-env/cloud.mjs` and runner session/context/lock controls. It leaves the public CI target guard unchanged. It does not change foreground sandbox exit behavior.

No target creation, key creation, GitHub mutation, backend preparation, inference, workflow dispatch or model renewal has been executed by preparing this helper. Existing 404/401/cleanup failures remain history. Full service CI must wait for genuine current model qualification; model manifest16 is expired. Successful target publication alone does not establish release readiness.

Use the existing pinned Node executable:

```sh
NODE=/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node
HELPER=/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-release-2026-10-30/_goals/convex-backend-runtime-2026-10-02/qa/release-readiness-2026-10-30/ci-target-recovery/recover.mjs
"$NODE" "$HELPER"
```

Default dry-run only reads local source and prints the current review digest. It creates no files and makes no network calls. Run local fixtures with `"$NODE" --test /absolute/path/to/ci-target-recovery/recovery.test.mjs`.

A non-author must review the coherent helper, tests, runbook and reused guards before any future mutations. The review file contains no credentials:

```json
{
  "reviewer": "/root/INDEPENDENT_REVIEWER",
  "verdict": "PASS",
  "breakingFindings": 0,
  "sourceDigest": "CURRENT_DIGEST_FROM_DRY_RUN"
}
```

The digest includes this helper/test/runbook, the exact maintained cloud/runner/config and existing CI guard/workflows. It detects materially stale review inputs; it is a practical review check, not proof of an adversarial actor's identity. The review and current operator authorization are separate prerequisites. This preparation authorizes no live invocation.

After independent review and the coordinator's go-ahead, explicit future commands are:

```sh
"$NODE" "$HELPER" create --execute --review /absolute/path/to/review.json
"$NODE" "$HELPER" publish PAIR_UUID --execute --review /absolute/path/to/review.json
"$NODE" "$HELPER" cleanup PAIR_UUID --execute --review /absolute/path/to/review.json
```

`create` allocates two distinct UUID sessions in owned0700 `/Users/SaintNick/.codex/tmp/cortex-release-ci-targets-20261031`, outside the public checkout. Pair journals, session journals, receipts and scoped key files stay there. Journals/keys use0600. Pair cleanup references are persisted before either creation. Each cloud creation intent records its finite expiry and is synced before the existing API issues its POST. Exact project/team/type/nondefault/reference/name/URL/expiry are server checked. Both targets must verify before either deploy key is created; each UUID gives a distinct reference/key name. The approved config must retain project3200658/team325340/slug`cortex-sandboxes`. No project creation is attempted.

The helper checks GitHub repository full identity and remembers its numeric ID. It checks every active/pending PR Checks/Managed CI lifecycle run (including queued/waiting runs), refusing mutation while one exists. The initial allowlist must still contain only `steady-snake-253` and `usable-sheep-908`. A failed create is never automatically retried. It attempts exact owned cleanup after a creation/key failure; identity ambiguity, active CI or a selected target leaves a private cleanup recovery record.

`publish` rereads both exact server identities and existing private keys, then runs the unchanged `verifyDisposableCiTargets` guard. It changes only `CORTEX_CI_CONVEX_DEPLOY_KEY`, `CORTEX_CI_CONVEX_URL`, `CORTEX_CI_CONVEX_DEPLOY_KEY_CLI`, `CORTEX_CI_CONVEX_URL_CLI`, and the existing `CORTEX_CI_DISPOSABLE_DEPLOYMENTS` variable. Secret values go to `gh secret set NAME --repo SaintNick1214/Project-Cortex` through stdin, never argv/stdout. The allowlist is last. No auth issuer, signing key, model ID or revision changes. There is no cross-service transaction: a partial/unknown publication retains both targets and records `PUBLISH_UNCERTAIN`. Repeat the explicit `publish PAIR_UUID` command to finish the same intended values after resolving the cause. Do not create another pair as a retry. A final variable readback proves selector names only; GitHub does not expose secret values for readback. Actual managed preparation remains a separate future gate.

GitHub's lifecycle lock cannot be acquired by this local helper. Each selector mutation and exact delete has a fresh idle check; a run starting between that check and a mutation is still possible. Use an operator quiet window and keep workflow dispatch paused until all five values are confirmed. The existing CI allowlist/key/URL guard fails closed during mixed selector state. No workflow is disabled or cancelled by this helper.

Successful publication records `RETAINED`, both server `expiresAt` values, the exact recovery/cleanup command, and future cleanup conditions. This pair lasts only for the finite release window (server expiry at most7days from each creation). It survives helper exit intentionally. CI tenant/fixture cleanup is separate from deployment deletion. Before expiry, finish qualification or obtain a separately approved replacement; an expired pair is unusable and does not silently renew.

`cleanup` checks current GitHub selectors and idle lifecycle again. It refuses deletion of either currently selected target, and refuses unresolved publication. Detach the pair through a separately authorized selector replacement before cleanup. Then the existing cloud guard reconciles exact UUID references, checks owned nondefault dev identity, records delete intent, deletes only those deployments and verifies absence. It removes private scoped deploy-key files after verified deletion. Unknown create outcomes remain recoverable without a blind POST. If server expiry occurs first, keep the private journal and verify absence with this same exact cleanup after selectors are detached. Do not remove journals/credentials while cleanup is unresolved. No scheduled automation is created.
