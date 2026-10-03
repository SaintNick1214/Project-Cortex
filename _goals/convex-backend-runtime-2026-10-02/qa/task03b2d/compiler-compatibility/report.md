# D compiler compatibility follow-up

The actual backend typecheck initially failed with TS2550 at `governance.ts:434` and `runtimeWorkerAuth.ts:52`. Both `Object.hasOwn` calls now use `Object.prototype.hasOwnProperty.call`, preserving the own-property checks while supporting the backend's ES2021 library.

Only those two product expressions changed. The host compiler configuration, D tests, schema, generated code, manifests, and SDK consumers were not changed by this executor. No stage, commit, deploy, or live operation was performed.

The earlier D scoped configuration uses ES2022, so its successful check did not establish ES2021 backend compatibility. That original qualification remains preserved. This follow-up ran the unchanged actual backend configuration and recorded the original failure before applying the repair.

| Check | Outcome |
| --- | --- |
| Initial actual backend ES2021 typecheck | Exit 2; exactly two TS2550 diagnostics, retained |
| Actual backend ES2021 typecheck after repair | PASS, exit 0 |
| Existing D scoped types | PASS, exit 0 |
| Changed-file lint and full existing D scoped lint | PASS, exit 0 |
| Existing D registered-handler/native-schema/catalog suite | PASS, 185 tests / 3 suites / 0 pending |
| Scoped diff whitespace check | PASS, exit 0 |

`commands.json` records argv, cwd, timestamps, exit codes, source hashes, and raw logs. `preservation.json` verifies exact two-expression changes against reviewed HEAD cd5671449beb64ed1ca4a284a761cad60ab70525, the unchanged backend compiler config, all 139 preexisting D QA files (including canonical catalogs and historical freezes), and the unchanged original private CI log. The parent-owned `qa/ci-followups/worker-closure-failures.json` changed concurrently after the initial snapshot; this executor did not write it, and both observed hashes are recorded without overwriting the parent receipt. New evidence and the new freeze are confined to this directory.

This bounded repair does not resolve the separate root SDK governance consumer diagnostic or establish full CI, live, graph projection, or storage lifecycle coverage. Parent independent review remains required before integration.
