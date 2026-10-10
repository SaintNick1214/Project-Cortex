# Pipeline integration execution handoff

Working directory: `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion`.
Modern merge input: `origin/dev` / MERGE_HEAD `443148c1d8a63ed820bafe7d87bf21c7e0a2fd21`.
Local checks used Node 24.15.0 and npm 12.2.0 from
`/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin`.
The modern setup composite still requires Node 24.21.0 and npm 12.2.0.

Source handoff is stable. The two workflow conflict resolutions use the modern
pipeline as their primary contract. No Git index, commit, credentials, deployed
service, or product implementation was changed by this executor.

## Resulting behavior

- Parent CI preserves exact-SHA candidate artifacts and byte verification,
  scoped selection, sparse checkout, and independent offline draft/fork/bot checks.
- The called managed workflow owns its shared-backend lock from preparation
  through all selected consumers and fixture cleanup. Cleanup is a required
  observed leaf of the managed receipt, including failure and cancellation paths.
- Current disposable-target allowlists, scoped authentication, governed model
  qualification and runtime discovery/selection remain prerequisites for real
  service qualification. Application-side provider inference loops are removed.
- Offline unit discovery follows all current `tests/unit/**/*.test.ts` additions
  and removals. Both controlled Gateway catalogs are included. Runtime, graph,
  and native service qualification remain separately selected jobs. Bounded
  graph/runtime children use natural Jest exit, 240 seconds and five seconds of
  kill escalation.
- Public/browser and installed CLI consumer checks remain additive. Modern
  security scanner findings and execution errors retain their distinct policies;
  the obsolete Semgrep action and commit-signature gate are not restored.

## Executed checks

These are individual run receipts with overlapping cases; their counts must not
be added as distinct coverage. The final Gateway fixture and selector restoration
postdate these passing runs and require the prospective checkout checks below.

| Evidence | Outcome | Process close |
| --- | --- | --- |
| `pipeline-before-adaptation.log` | 130 tests, 128 pass, 2 fail; stale managed leaf expectation and old provider preflight shell expectation | Natural, 1.592 seconds |
| `pipeline-run1.log` | 140 tests, 140 pass, zero failed/skipped/cancelled | Natural, 1.455 seconds |
| `ci-helper-final.log` | 122 tests, 122 pass, zero failed/skipped/cancelled | Natural, 10.011 seconds |
| `demo-install.log` | 14 tests, 14 pass, zero failed/skipped/cancelled | Natural, 2.362 seconds |
| `offline-discovery.json` | 163 selected and discovered files, zero missing/outside before Gateway restoration | Natural discovery only; no assertion receipt |
| `scoped-lint.log` | Exit zero, zero errors, three ignored-script warnings | Natural; ignored files are not lint-qualified |

Passing commands, with the toolchain directory prepended to PATH:

```sh
node --test tests/ci-pipeline.test.mjs tests/ci-managed.test.mjs tests/ci-candidate-artifacts.test.mjs tests/release-pipeline.test.mjs tests/security-pipeline.test.mjs scripts/ci/workflow-runtime-fixtures.test.mjs
node --test scripts/ci/*.test.mjs tests/ci-pipeline.test.mjs tests/ci-managed.test.mjs
node --test scripts/install-ci-demo.test.mjs
node scripts/ci-contract.mjs offline-unit --listTests --json
```

Demo install fixtures exercised npm 12.2.0 and the fixture-declared pnpm 10.33.0.
The installed root pnpm probe returned `ERR_PNPM_OTHER_PM_EXPECTED` because root
declares npm; fixture installs nevertheless succeeded. No global tool was installed.
Workflow Node tests parsed the affected YAML. `actionlint` was unavailable.
`git diff --check` passed during the pipeline batch; root owns the final source check.

## Gateway restoration and interrupted local checks

`gateway-original.test.ts` preserves the original complete source bytes. The
AST migration record in `gateway-migration.json` records its initial 46 automated
case migrations and two then-untouched cases. Both remaining cases were repaired
manually afterward; the final file preserves all 48 original case declarations.
This declaration count is not a completed Jest test count.

The injected fixture now models terminal capture as the owner of durable charge
accounting, with separate `attachTerminalResult` qualification for private output.
Revocation and all qualification-overrun variants retain concrete assertions for
settled units 500, uncertainty zero, active slots zero, no attachment and no visible
output. The late capture acknowledgment clears pending evidence; retry therefore
returns false after that acknowledgment and cannot duplicate persistence. The
delayed issued attachment case asserts that the pending attachment cannot reopen
client delivery, create another native attempt, or restart persistence.

Three bounded isolated invocations returned `ETIMEDOUT` after 120 seconds, each
with SIGTERM, an empty log, and no Jest JSON receipt. Their process results are in
`gateway-local-interruptions.json`. There is no observed assertion failure or
passing Gateway result from these attempts. The parent subsequently inspected the
stalled broader run's open descriptor and reported `src/resilience/TokenBucket.ts`
as a macOS File Provider placeholder (`UF_DATALESS`, flags `0x40000060`). Source
reads and CLI discovery also stalled. That is an unavailable local input, not a
test assertion result. No further local attempts were made after that diagnosis.

The parent removed the Gateway exclusions from root Jest, TypeScript and ESLint
configuration. `scripts/ci-contract.mjs` includes the restored catalog and its
discovery regression asserts that inclusion. The resulting expected
selection is 164 files; no final 164-file local discovery receipt is claimed.

## Prospective qualification

Root will commit the stable integration/version source and qualify that exact
commit in an unsynced disposable checkout under `~/.codex` with a fresh install.
That is a new prospective baseline and does not repair historical C7 custody.
Required remaining evidence includes the isolated restored Gateway suite, the
exact offline selector, affected lint/typecheck, and the final CI helper regressions
after the selector expectation change. Root coordinates builds, versions, CLI fast
checks, independent review and the final acceptance decision.

The `integrate.mjs` and `migrate-gateway.mjs` files record the bounded initial
transformation. They are not final-source regenerators: rerunning them would
overwrite later reviewed/manual fixes. Do not rerun them for qualification.
