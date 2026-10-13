# Parallel recall implementation report

Status: COMPLETE for this bounded source implementation and its selected offline checks. Live deployment, native service outcomes and populated-recall latency/SLO acceptance are outside this delegated implementation and remain coordinator gates.

## Change and scope

The actual shared service is `convex-dev/runtimeMemoryServices.ts`; the proposed `src/domain/memory-services.ts` path does not exist. After the unchanged request/text, authority, read preflight, selected-profile readiness and one validated query embedding, the staged Action and Agent recall adapters start their existing read-only vector and fact methods together. Each call is invoked in its own promise task. Both settlements are owned before choosing the original vector-before-fact error priority. Failed batches never commit bookkeeping, perform finalDelivery or save Agent context.

`src/domain/contracts.ts` adds one optional private-bookkeeping staging seam. The Action adapter runs the same read guards, source/hash reads and native ANN/hydration calls into separate consumed-binding envelopes, merging vector then fact only on success. Direct Action reads retain their original behavior. The seam is non-enumerable: spread-based wrappers that replace read methods must explicitly supply their own staging. This prevents bypassing unmodified dynamic-tool current-attempt/witness guards. Adapters without the seam retain the original serial read path and the original older read-preflight fallback.

Only the recall adapter section of `runtimeAgent.ts` changes. Vector/fact branches retain separate witness/provenance maps. The fact native read overlaps vector retrieval but waits for vector source-guard settlement before its original contextSource queries, preserving existing positional RPC assertions. The fact witness merger sees prior vector witnesses so a shared-source revision/hash conflict still fails on the first conflicting fact before later fact errors. The vector gate is released in finally, including vector read/source-guard failures. Successful context bookkeeping merges vector then fact, preserving context bytes, source insertion order and canonical permission union. The original finalDelivery, deadline/expiry check, pending-context merge and saved-context fences remain.

Historical Workflow V1-V4 bodies, registered RPC/auth contracts, authority caches, models, parser, budget/retry policy and UI are unchanged. No service, deployment, credentials, browser, paid model, Git network/commit or unrelated repository actions were performed. All initial unrelated dirty files were preserved.

## Requirements and evidence

- Actual production-adapter read overlap, both completion orders: `parallel-recall.test.ts` actual Action test blocks both real native read ports, then checks exact serial reference items/context and delivery envelopes; Agent context-source tests similarly block real read ports and compare exact context bytes, RPC/source/witness/provenance order, source permissions and derived IDs.
- Prior guard failures start no recall branches; one embedding, no retries/inference: eleven guard-failure cases and a deferred embedding boundary test; original write-only/current/legacy capability tests and unused-preflight-fact supersession regression remain.
- Both async failures in either order; synchronous vector/fact throws, including both synchronous throws; late peer rejection is joined; vector error identity wins; either single failure prevents commit/delivery: service settlement tests.
- Vector source failure releases fact gate; either/both source errors produce no finalDelivery/save: Agent guard tests. Shared-source revision/hash witness conflicts preserve failure ordering before later fact faults.
- Existing current source/grant/profile/cutoff/expiry/permission refusals and lease/cancel/transcript/witness/competing-save races: unmodified affected suites included in the final 23-suite discovery selection.
- Wrapper compatibility: unchanged tool-context test detects exact source witnesses, current-attempt guard and single shared-run-budget embedding. Nonstaged legacy adapters explicitly stay serial.

## Frozen source and receipts

`parallel-recall-frozen-files.json` records baseline HEAD `eb8c4c03a2457b79d3b7129a7e7af8da3ecd67bd`, branch and SHA-256 for all seven changed source/test files. `parallel-recall-source.diff` includes the tracked diff plus the new regression file. The runner records exact commands, cwd, offline environment, duration, exit codes and raw logs without overwriting prior attempts. Final checks use Node 24.15.0 and npm 12.2.0 from the provided toolchain, `CONVEX_URL=http://127.0.0.1:9`, `CORTEX_TEST_ENV_MODE=explicit`, Jest watchman disabled and forceExit false.

The focused wrapper-repair run passed 100/100 tests across four suites with zero skips. The final frozen selection passed 23/23 suites and 839/839 tests, with zero pending suites/tests, zero todo tests and exact discovery/executed suite-set equality. The standard Jest JSON is authoritative for counts; the repository timing reporter summarizes fewer individually named tests and is not used as coverage evidence.

| Selected final check | Observed result | Raw receipt |
|---|---|---|
| Affected offline Jest suites | PASS: 23 suites, 839 tests, zero skips/todos; exit 0 | parallel-recall-affected-final.log and -jest.json |
| Root TypeScript --noEmit | PASS: exit 0 | parallel-recall-types-frozen.log |
| Convex backend TypeScript --noEmit | PASS: exit 0 | parallel-recall-backend-types-frozen.log |
| Affected seven-file ESLint --max-warnings=0 | PASS: zero warnings/errors; exit 0 | parallel-recall-lint-affected.log |
| Root npm run lint | PASS command: 0 errors, 237 repository warnings; exit 0 | parallel-recall-lint-frozen.log |
| Root npm run build | PASS: SDK/runtime/graph JS+declarations, 157 backend source files, 72 tables, 2 components; exit 0 | parallel-recall-build-frozen.log |
| npm run test:contracts after frozen build | PASS: packed ESM/CJS, declarations, backend source bytes and browser contracts; exit 0 | parallel-recall-contracts-frozen.log |
| Git diff whitespace check | PASS: exit 0 | parallel-recall-diffcheck.log |

All seven source/test hashes were reverified after the final checks. Exact commands/cwd/environment/durations are in each matching receipt JSON and consolidated in parallel-recall-verification-summary.json. The root lint warning total is unchanged across the initial and frozen runs; the changed-file lint is clean.

## Retained failures and limits

- `parallel-recall-new-focused.log`: 18 passed, 2 failed due to an incomplete newly added structured-fact fixture.
- `parallel-recall-focused-r2.log`: incomplete fixture remained and an overlap test waited for the repository alias `hydrateVectors` instead of the actual `readVectorMatches` RPC. Deliberately terminated, process exit -15, after recording the raw failure.
- `parallel-recall-focused-r3.log`: Action regression suite passed; new Agent test wrapper did not forward opaque component references. Deliberately terminated, process exit -15. The wrapper now forwards those references and races read-start waits against the actual recall result, so early errors are reported directly.
- `parallel-recall-affected.log`: 838 passed, 1 failed. Introduced enumerable staging bypassed dynamic tool recall's spread-based witness wrapper. Repaired within runtimeMemoryRepository by explicit opt-in staging; the unchanged failed test then passed in the 100-test wrapper-repair run. Final full selection is rerun against the frozen repair.

All failures remain raw evidence; none were hidden by relaxed assertions or dropped suite selection. These are actual source/registered-handler tests with controlled DB/component/embedding ports. They do not establish managed ANN, native OCC/concurrency, provider billing equivalence, production latency or SLO success. Successful reads are delivered after both branches settle; a failing read can wait for its peer, while all original caller/backend deadlines remain unchanged. Further live/native qualification requires the coordinator's independent source review and authorized target.
