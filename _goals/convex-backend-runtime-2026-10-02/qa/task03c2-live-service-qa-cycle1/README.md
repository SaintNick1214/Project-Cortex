# Task Completion Report

## Status: COMPLETE — bounded correction; live qualification pending

This is the first actual-service QA correction under feature-orchestrator §5 after the fresh resume goal FINAL PASS. It addresses the actual callback-recovery observation failure; it is not another repair or acceptance claim for the exhausted offline harness mechanics. The historical actual run remains39 PASS,1 FAIL,1 dependency BLOCKED of41. No service call or actual original41 replay occurred in this correction.

## Changes made

`task03c2-live-fixture/scripts/client.ts` adds `waitForRecoveredSdkValue`, immediately awaited after the restored current token and void `notifySessionChanged`. The persistent native `onUpdate` witness survives only a structured native `ConvexError` with `data.code === UNAUTHENTICATED`. It requires a successful exact43 update within the existing `timeoutMs` ceiling, rejects incorrect values and every other error, and disposes in `finally`. The original exact43 one-shot query and `authFailure === undefined` checks then execute unchanged.

The preceding denial, sanitized keys/code assertions, credential/refresh behavior, all41 case names and their dependencies are unchanged. Removing only the added helper and single added call reproduces the original client byte for byte. No SDK, backend, schema, driver, classifier, guard, source list or historical evidence file was modified. All2899 tracked fixture/review/evidence files were compared against HEAD; only this authorized client changed. Frozen manifests retain their historical old-client bindings; coordinator refresh is required for the new candidate, and old readiness PASS does not certify it.

## Native offline regression

`native-regression.mjs` imports the actual current source Cortex and installed Convex1.46.0 under a PATH-only environment with network interception installed before SDK imports. Its in-memory WebSocket injects native protocol transitions into the installed real auth/query/cache/observer implementation. It extracts the actual changed helper plus actual object/bound helpers from `client.ts` using TypeScript AST and executes them. This is an offline cache/race regression, not service authority or live acceptance.

The historical reviewer probe is preserved verbatim as `historical-native-recovery.mjs.text`. The `required-assertion` mode still runs the original-purpose immediate exact43 assertion and exits1 with native cached `UNAUTHENTICATED`. Its nonzero outcome is required and is kept separate from passing regressions.

| Final process | Discovered/executed | PASS/FAIL | Exit |
| --- | --- | --- | --- |
| Original failing reproduction |4/4 |3/1 deliberate |1 |
| Immediate current getter |16/16 |16/0 |0 |
| Deferred current getter |17/17 |17/0 |0 |
| Witness installed while current getter pending |18/18 |18/0 |0 |
| Unexpected FORBIDDEN |16/16 |16/0 |0 |
| Generic native service error |16/16 |16/0 |0 |
| Unstructured authentication-text service error |16/16 |16/0 |0 |
| Fresh incorrect42 |16/16 |16/0 |0 |
| No successful delivery before bound |16/16 |16/0 |0 |

Eight passing processes execute131 passing assertions. A separate failing-reproduction process executes4 assertions with3 PASS and1 deliberate failure. Combined135 named executions are supplemental offline assertions, with0 skipped and0 todos; they are not135 product cases. All9 clients close, every completed/failed witness has0 surviving native listeners, no unhandled rejection occurs, and all processes observe0 network attempts. Fresh transient native UNAUTHENTICATED is tested in addition to the initial cached denial. Wrong42, FORBIDDEN, generic service errors, authentication-text lookalikes and timeout all reject and release subscriptions.

Replay from repository root with `env -i PATH="$PATH" node --import tsx <absolute native-regression.mjs path> <mode>`; modes are `required-assertion`, `immediate`, `deferred`, `early-deferred`, `forbidden`, `service-error`, `auth-lookalike`, `wrong-value`, `timeout`. Only the first has expected exit1. `commands.json`, mode JSONs and separate full stdout/stderr record the final executions and UTC timestamps. Synthetic compact strings use no signer/private JWT and are never sent to a service.

## Verification

- Full unchanged client project compiler: `node node_modules/typescript/bin/tsc --project _goals/convex-backend-runtime-2026-10-02/qa/task03c2-live-fixture/client-tsconfig.json --noEmit` — PASS exit0.
- Scoped house ESLint of changed client and new native probe — PASS exit0,0 errors,0 warnings.
- Extracted actual helper strict TypeScript check against installed native declarations — PASS exit0; full restored-client compile above supersedes this narrower check.
- Native8-process regression — PASS131/131; separate required original reproduction — expected exit1 preserved.
- All original client bytes/assertions/dependencies and41 names preserved — PASS; integrity.json records hashes and2899 tracked comparisons.

Initially the old private packed SDK was absent, so full client compiler failed TS2307 with cascading type errors; the initial scoped lint had missing-import warnings and one unused inherited probe variable. Those diagnostic failures remain in `quality-commands.json` and raw outputs. The unused variable was removed from the new probe; no assertion changed. The coordinator then reconstructed and verified all199 accepted packed provenance rows and exact historical tarball SHA before the final compiler/lint runs. This executor did not write that packed path, install, build the root, generate keys, commit, deploy, or call a service/model.

## Requirements checklist

- [x] Fix only recovered-result synchronization using a bounded persistent native witness.
- [x] Keep denial, sanitized diagnostics, exact43 query, cleared diagnostic,41 names and dependencies.
- [x] Reject all errors except structured transient native UNAUTHENTICATED; release observers on success/error/timeout.
- [x] Meaningful installed-native race and error/disposal regressions; preserved failing immediate reproduction.
- [x] Final full client typecheck and scoped lint pass after verified dependency restoration.
- [ ] Fresh independent task judgment — coordinator next gate.
- [ ] Actual original41 service rerun and independent service judgment — pending fresh owned disposable target and separately reviewed identity prerequisites. Session-end-not-grant-revocation remains unexecuted until that rerun.

No whole Task03/09/17, full-core, UI, endpoint-closure or actual-service PASS is claimed. Initial exploratory/provisional native invocations were superseded by the recorded final all-mode replay; final counts refer only to that recorded replay. Current-source native observations do not independently certify reconstructed historical packed bytes; full fixture compiler/lint consume the coordinator-restored packed declarations.
