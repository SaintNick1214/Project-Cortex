# Versioned memory extraction framing repair

Date: 2026-10-12 Pacific / 2026-10-13 UTC. Target repository: `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion`. Coordinator authorized the bounded prompt/framing repair after reviewing `background-memory-readonly-report.md`. This executor changed only the six source/test files listed below and new repair evidence in this QA directory. The original sequence3 UNKNOWN event, its malformed private result, uncertain account, prior diagnostic receipts and live deployment remain untouched.

## Result and boundary

The new immutable deployment manifest **V17** selects `memory-extraction-framed-prompt-v4` only for `memory.extract`. V16/v3 and every older manifest/request branch retain their bytes; qualifications, expiry, prices, caps, native interface and all other semantic selectors are reused unchanged. V17's analysis/acceptance hash binds the reviewed read-only diagnosis `d2aa058ea9d2ed73281b1f6ccc3a4a808d5ac33462718261d98e55f852a75776`; it does not assert a new native JSON capability or a new successful service result.

In the new pin only, the Gateway adapter uses the current attributed source already loaded from its scoped repository. Existing domain validation supplies trusted extraction/source-role semantics. The system role then supplies one explicit JSON data-instance contract, the legitimate no-facts instance, and validation schema metadata. The user role contains only `JSON.stringify({lineage: source.lineage, text: source.content})`. Legacy user-prefix instructions asking the model to return a JSON Schema are absent from that new assembly. Source requests, role labels and delimiters remain quoted evidence and cannot gain system authority. Old pin branches still use their original request.system/request.prompt verbatim.

Production and the coordinator's prospective fixed commissioning probe can use the same exported pure helper in the existing `convex-dev/runtimeMemoryGateway.ts` file:

`buildSourceExtractionFramingV4(source: SourceContent): { system: string; prompt: string }`

The helper validates normalized content, source role/trust and eligibility through the existing domain helper; it performs no I/O. It does not itself prove current grant/source/hash witnesses. Production retains the existing fresh scoped repository read, native source binding, full native-request measurement, guarded admission/checkpoint/terminal capture and final commit authority/source checks. Commissioning must independently bind fresh verified source witnesses and use the governed measured request, not claim helper construction as actual service qualification. No new registered endpoint or production file was added; the source distribution count stays 158 pending the coordinator's artifact build.

Strict JSON/domain parsing and facts schema are unchanged. No punctuation stripping, schema conversion, invented empty facts, automatic retry/fallback, cost refund, native JSON mode or capability bypass was added. Known malformed returned output still becomes nonretryable UNKNOWN without a fact/vector payload. Plain chat remains unable to guarantee JSON syntax; successful offline regressions are not actual memory acceptance or a subsecond latency result.

## Meaningful coverage

The coherent final run passed **129 tests across 7 suites, zero skipped**:

| Suite | Tests | Covered behavior |
|---|---:|---|
| `runtime/memory-gateway.test.ts` | 77 | Actual governed V4 middleware; new trusted roles/hostile source quoting/current source witness and measured bytes; valid empty and tool-attributed instances; ineligible/tombstoned/malformed/missing source refusal; pre-admission input bound; unchanged historical requests and replay; existing authority/revocation/staleness/output/capture/fallback guards. |
| `runtime/observed-extraction-framing.test.ts` | 4 | Registered V17 selector/install; exact historical manifest/proof references; only extraction pin changes; accounting holds/root/window preserved; new selector uses existing text interface; proof expiry, stale source and revoked grant refuse before effects. |
| `runtimeIngestion/framing-invalid-output.test.ts` | 11 | Real registered worker + real policy ledger + actual Gateway middleware with a controlled official provider peer. Empty/attributed instances advance legitimate facts/vectors with source lineage. Malformed delimiters, fences, prose, schema definitions, extra root/nested fields and malformed facts/relations each retain one operation/attempt, attached native result, 100000 uncertain units, zero reserved/settled units, released slot, no fact/vector/outbox commit, no retry or second dispatch. Installing V17 leaves an existing invalid v3 UNKNOWN event, operation, attempt and account byte exact. |
| `runtimeIngestion/worker.test.ts` | 14 | Existing lease/retry/reconcile/tool/source retirement behavior. |
| `runtime/observed-extraction-prompt.test.ts` | 5 | Historical V16/v3 policy/accounting/expiry behavior. |
| `runtime/observed-facts-selector.test.ts` | 6 | Historical conflict selectors and accounting/proof guards. |
| `domain/sources.test.ts` | 12 | Unchanged source eligibility, strict response parsing and source attribution. |

Historical complete canonical request digests now have explicit regression assertions: v2 `a35d20964da33be441d81980b78e06fff3c4a7e0c7f5d38d210a9935c53a63ad`; v3 `f2fe4280c07826dd2ca677d63dc6839867df73f0abdfd3cad41b458ac050a043`. The captured historical branches are unchanged by the source diff; the v4 canonical request is distinct and replay retains its exact bytes without redispatch. The first capture invocation did not execute tests because the global Jest environment lacked a URL; the corrected explicit loopback-only offline invocation passed. It is not a pre-change live measurement.

The registered-worker fixture was made locally faithful to detached Convex query reads, avoiding mutated captured lease counters. Its embedding peer uses the existing qualification's exact unprefixed terminal identity. Initial fixture/type/assertion failures are retained in the raw repair logs; expectations were corrected to actual persisted contracts, including `privateResultCanonical`, `operationDocumentId`, and nested fact lineage. Production guards were not relaxed.

## Checks and limitations

All commands used Node24.15.0 at `/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node`, cwd R. Offline Jest used `CORTEX_TEST_ENV_MODE=explicit CONVEX_URL=http://127.0.0.1:3210 CORTEX_RUNTIME_LATENCY_TRACE=0`; selected tests use controlled ports and do not connect to that URL. No deployment, model/service invocation, P/website edit, Git write or previous-receipt edit occurred.

| Check | Result | Receipt / command |
|---|---|---|
| Seven affected regression suites | PASS, exit0,129/129,0 skipped | `memory-framing-v4-regressions-final.log`; `node --experimental-vm-modules node_modules/jest/bin/jest.js --runTestsByPath [seven suites above] --runInBand`. |
| Production lint TypeScript | PASS, exit0 | `memory-framing-v4-type-initial.log`; `node node_modules/typescript/bin/tsc --project tsconfig.lint.json --noEmit`. Production source did not change after this check. |
| Affected production + test TypeScript | PASS, exit0 | `memory-framing-v4-scoped-tsc-final.log`; `node node_modules/typescript/bin/tsc --project Q/tsconfig.memory-framing-v4.json --noEmit`. Config includes all six owned files and their transitive dependencies, with R rootDir. |
| Scoped ESLint | PASS, exit0,zero errors/warnings | `memory-framing-v4-eslint-final.log`; `node node_modules/eslint/bin/eslint.js [six owned files] --report-unused-disable-directives`. |
| Source whitespace/diff check | PASS, exit0 | `git diff --check -- [four tracked owned files]`; read-only Git operation. |
| Broad root TypeScript | FAIL, exit2; no errors in this batch | `memory-framing-v4-tsc-final.log`; `node node_modules/typescript/bin/tsc --noEmit`. Seven outside-batch test errors remain: `client-runtime/admission-native.test.ts:126`; `runtimeAgent/context-latency.test.ts:16`; `runtimeAgent/inline-barrier.test.ts:106,132,133`; `runtimeAgent/model-owner.test.ts:89`; `runtimeContent/jobs.test.ts:137`. Coordinator was notified; these frozen files were preserved. |
| Root artifact/build, independent source review and actual new-intent cloud memory/latency | NOT RUN here; coordinator gates remain | No broad build/distribution writes, no service mutations or paid calls were authorized to this executor. |

Affected implementation checks PASS. Overall release/live memory acceptance remains INCOMPLETE: independent review, coordinator repair of broad TypeScript errors, new source-bound commissioning qualification and fresh distinct authorized live intents are still required. The original invalid13byte output remains invalid and retains its uncertain monetary liability. An actual subsequent answer alone cannot certify facts/vectors or UNDER1SECOND.

## Frozen source hashes

| Exact owned path relative to R | SHA-256 |
|---|---|
| `convex-dev/runtimeMemoryGateway.ts` | `db503df8d2278c4e2d37802502f2ed6cc78daac9d213841d423f3965463f8acd` |
| `convex-dev/runtimeGatewayMediaQualifications.ts` | `2e3f10cebd9207fde5779de0abf51598f1d3c9de80e583dd6053a83d36184fee` |
| `convex-dev/runtimeModelPolicyBootstrap.ts` | `0c5c98bae06c5c6d16a0a9edc9488938d9f6c3ecd7cf36f15e76b0065f7f67da` |
| `tests/unit/runtime/memory-gateway.test.ts` | `c72181cbdf413c784f3ceaebcde113f45f23e5a36ba88cc2db29809c163ad277` |
| `tests/unit/runtime/observed-extraction-framing.test.ts` | `aaa47b656af644806e14fffa34d92e43e8e6b1b040becc4843da9e9538f65d82` |
| `tests/unit/runtimeIngestion/framing-invalid-output.test.ts` | `96799c1257933350798f52cf4e6d0efbc4de46760aabb93ed9428bff5a3fadcd` |

Machine-readable source/raw evidence hashes: `memory-framing-v4-hashes.json`. The source batch is frozen for non-author review; further product edits require a concrete finding/new authorization and a refreshed source/check receipt.
