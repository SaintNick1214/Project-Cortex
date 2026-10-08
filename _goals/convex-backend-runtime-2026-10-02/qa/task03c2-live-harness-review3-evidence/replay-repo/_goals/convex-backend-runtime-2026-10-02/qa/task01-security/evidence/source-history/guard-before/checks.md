# Checks and reproduction

Working directory:
`_goals/convex-backend-runtime-2026-10-02/qa/task01/fixture`.

```sh
export CORTEX_QUALIFICATION_TARGET_RECEIPT=/workspace/Project-Cortex/work/backend-runtime/qualification-security/target.json
export CORTEX_QUALIFICATION_DEPLOY_ENV=/workspace/Project-Cortex/work/backend-runtime/qualification-security/deploy.env
export CORTEX_QUALIFICATION_EVIDENCE_DIR=/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task01-security/evidence

npm exec --yes --package=npm@12.2.0 -- npm install --workspaces=false --ignore-scripts
npm exec --yes --package=npm@12.2.0 -- npm audit --workspaces=false --json
node scripts/verify.mjs
node scripts/paths-check.mjs
node scripts/keys-check.mjs
node scripts/transpile-check.mjs
```

The coordinator alone serializes the separate verified qualification deployment:

```sh
npm exec --yes --package=npm@12.2.0 -- npm run deploy
```

After its deployment success and explicit authorization, run only affected checks:

```sh
NODE_USE_ENV_PROXY=1 NODE_USE_SYSTEM_CA=1 npm exec --yes --package=npm@12.2.0 -- npm run qualify -- \
  live-Gateway-tool-disconnect-multiple-observers-no-replay \
  persisted-Agent-stream-multiple-observers-reconnect \
  persisted-Agent-stream-cancellation
```

Observed offline receipts: npm12.2 install exited0; audit-before exited1 with the
direct ws advisories; audit-after exited0 with zero vulnerabilities. Strict typecheck
and AI SDK7 decoder/browser bundle exited0 in evidence/check-commands.json.
evidence/target-safety.json records21 passing no-network assertions, including the
actual product receipt rejected by both deploy and qualify entrypoints. Pin comparison
proves all6 qualified core versions unchanged; only ws and its deduplication changed.
Fresh live evidence in evidence/live-receipts.json has3 PASS outcomes on
fiery-setter-784 with ws8.21.0, started2026-10-03T08:55:46.358Z and
finished2026-10-03T08:56:04.750Z. Parent deployment succeeded at08:54:47 UTC;
evidence/deploy.txt records installed components/indexes on the separate target.
The actual Gateway case has1 attempt/effect/final receipt and stable canonical IDs;
synthetic replay/privacy and cancellation passed. evidence/live-stdout.txt preserves
the observed runner stdout. No unselected live check was repeated.

evidence/key-generator.json records two real concurrent generators with exactly one
successful creator, matching key/JWKS, mode0600, rejected duplicate generation and
zero overwrites; all temporary private keys were removed and no live key was changed.
evidence/type-only-transpile.json proves the unused type import removal emits exactly
the same JavaScript bytes. Fixture ESLint uses the parent's explicit standalone
tsconfig mapping; evidence/fixture-lint.json is its raw result (exit0,0 errors,
3 pre-existing warnings). Root/fixture lint configuration is parent-owned; this
executor edits no lint config or scanner suppression.

For a separately authorized full qualification replay on this verified qualification
target, configure its private HTTP peer before running the unselected suite:

```sh
export CORTEX_QUALIFICATION_EFFECT_SECRET_FILE=/workspace/Project-Cortex/work/backend-runtime/task01-security/full-effect-secret.txt
node scripts/effect-secret.mjs
NODE_USE_ENV_PROXY=1 npm exec --yes --package=npm@12.2.0 -- npm run qualify
```

That optional private setup/full replay is not run by this scoped security task.
The affected three-check pass cannot certify unexecuted current-code HTTP-effect,
structured/native or component atomicity checks; original outcomes retain their own
source/target provenance.
