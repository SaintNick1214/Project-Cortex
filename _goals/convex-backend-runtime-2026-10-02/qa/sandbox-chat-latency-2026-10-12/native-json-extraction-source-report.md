# Native JSON-object extraction source batch

2026-10-12. Frozen for coherent non-author review. Offline affected quality PASS:410 tests in7 suites, zero failed/skipped; root/backend TypeScript and scoped lint exit0. This is prospective source support, not actual native JSON or memory/latency acceptance. No P/service/deployment/inference/Git write was performed. The other executor's admission files were left untouched.

## Practical bound amendment

The original `native-json-extraction-plan.md` is retained unchanged as conditional planning history (SHA256 `d454cdc5bbb1f8be8c84aceb0c694dac9c91d4bde317ad171925959c9e5bd7c8`). The coordinator's accepted independent review supplement authorizes the same practical audited-body/cookbook assumption and actual-usage fences as existing plain admission; a hard remote prompt-token cap is not an original acceptance criterion. This section supersedes the original plan's stronger conditional requirement for a general guarantee over unseen server tokenization.

The new closed measure is UTF8 of the exact installed-provider body projection plus9: two messages ×3 and terminal framing3. It includes model, actual cap, fixed json_object format, roles, all user/system contents and complete outer JSON escaping. Gateway, native admission and permit independently derive it from normalized admitted messages. It enforces existing input8192/context16384/output512 caps and retains actual input/output overrun checks. It does not claim a timeless guarantee about hidden remote accounting. `native-json-input-bound-assessment.md` records the primary-source limitation and the accepted narrow interpretation.

## Resulting behavior

`MEMORY_JSON_OBJECT_CONTRACT` fixes gpt-4o-mini, `memory-extraction-json-object-prompt-v5`, facts-v1, none-v1 tool registry, `memory-extract-json-object-v1`, `memory-json-object-chat-utf8-v1`, `memory-json-object-8192-512-v1`,8192/16384/512 caps,60000 private-result bytes and100000 micro-USD ceiling. No new actual qualification was created. Core V17 and every older actual proof/policy/expiry remain unchanged; the registry has no invented V18 JSON receipt. The launcher must install a genuine separately qualified compiled root.

The new lane accepts only `memory.extract` on chat and requires exactly `{type:'json'}`. Omitted/text/schema/name/expanded formats, another operation/model/pin/interface, tools, scalar/caller options, alternate roles and streaming deny before paid admission. Format persists in canonical admission and reconstructed native identity; its deletion/tampering at permit denies. The optional field has no default, preserving historical bytes. Existing text-format guards remain intact.

The production adapter calls the existing `buildSourceExtractionFramingV4` unchanged and adds only the format under the new pin. Strict schema/parser behavior is unchanged: valid empty or attributed facts instances pass; prose/fences/truncation/schema definitions/extra or wrong-type fields reject, including exact bad-result replay. No output repair, fabricated facts, retry, fallback or uncertain-cost refund was added.

Complete valid actual input AND output usage is now required before any extraction private output/delivery, including known-money settlement and retained replay. Missing/invalid usage closes attachment. Over-bound usage records overrun and closes delivery. Valid confirmed output with unavailable cost retains the original100000-unit UNKNOWN liability and releases its slot; same-intent re-entry cannot dispatch again. Revoked authority, expired proof and changed source at permit retain original liability without dispatch. Source/current-ref/ingestion/content/parent/grant/commit fences are preserved.

No production file or registration was added, so this change does not add to the existing158-file distribution. No public SDK API or application tool/memory loop changed. Full artifact rebuilding and installed-host integration belong to the coordinator's subsequent frozen-candidate gate.

## Launcher helper contract

From `src/domain/model-policy.ts` (installed shared path `_cortex/shared/domain/model_policy`):

- `MEMORY_JSON_OBJECT_CONTRACT`: properties `modelId`, `promptVersion`, `schemaVersion`, `toolRegistryVersion`, `featureEnvelope`, `inputRule`, `boundRevision`, `maximumInputTokens`, `maximumContextTokens`, `maximumOutputTokens`, `maximumPrivateResultBytes`, `maximumCostUnits`.
- `memoryJsonObjectRequestBody(messages: ModelCallRequest['messages'], outputTokens: number)`: exact frozen `{model,max_tokens,response_format:{type:'json_object'},messages:[system,user]}`. Accepts normalized admitted role/parts messages; validates descriptors, exactly two text messages, order, Unicode and output cap. It is a pure codec, never a qualification/authority grant.
- `memoryJsonObjectInputBound(messages, outputTokens): number`: UTF8(JSON.stringify(the production body))+9. It returns the measure; policy admission independently enforces the cap.

P can reuse this helper and unchanged v4 framing for its fresh `jsonExtract` probe. Its separate plain probe remains `artifact.text` under existing plain-chat-v1. The current tenant-policy handler still refuses arbitrary extraction-pin switching; a domain tenant-priority fixture is not evidence of a live selector. The eight-mode P procedure, new source generation and actual receipt promotion are coordinator-owned and are not covered by these mocks.

## Exact frozen paths

Five product and five existing test files changed. The permitted sixth product file (`runtimeGatewayMediaQualifications.ts`) required no edit because fabricating an actual JSON successor would be wrong.

| Path relative to R | SHA256 |
|---|---|
| src/domain/model-policy.ts |3127d9ce8d8f7b1d359e93e5e5623fb9453424ec784c493ef656b317001bba10|
| convex-dev/runtimeGateway.ts |7b8df07ff7f45efbabcab980b9d53636f01a10661441830f4c31be5155879755|
| convex-dev/runtimeModelPolicy.ts |506647be62eebf947ec132b7ef44fe65bf3e298bbd7b7a0fb23ba7b8e458e39b|
| convex-dev/runtimeModelPolicyBootstrap.ts |e630c1433c2dfc1c63de7791806befb967b325ebb58e7652eba921b8b6280d54|
| convex-dev/runtimeMemoryGateway.ts |3334366ac6cf51725cc23976bf65ab221d482736e291930dbffce53b38aa1b15|
| tests/unit/domain/model-policy.test.ts |f2cf6d5e06f628a1516e28dbbdc161b5fdf4bc640a391a64d430fe2b38bb1130|
| tests/unit/runtime/gateway-dispatch.test.ts |a39a609a8e48872b3c4738ae36e4f07b873fb6b062daefaeb80d1b107c1eeebb|
| tests/unit/runtime/model-policy-admission.test.ts |873aa036f6e3614cd019661b0ba774b1d2df90df3354247a82920813feb27869|
| tests/unit/runtime/memory-gateway.test.ts |b0cce6f85264e976a5a8de4fe8c3f4d18c2c4fa98297420bf366dae7f7c56c53|
| tests/unit/runtime/gateway-qualification-registry.test.ts |9d241d8457d4c42e22f4ddc8d3ced3bff2bdb732b451225cff536384bd7569bb|

Verified unchanged against tracked HEAD: `runtimeGatewayMediaQualifications.ts` (`2e3f10cebd9207fde5779de0abf51598f1d3c9de80e583dd6053a83d36184fee`), strict `sources.ts` (`6686eda984c286e73235ab66efb050c7416a480efe61caeb4521c44173bc679a`) and `extraction.ts` (`7324f700278531e30ae22d3eca29dd7bef2fbeae1d6aa7c7011ec9bcbb45fa5b`). TypeScript AST comparison also verifies the entire production v4 framing helper is byte-identical to tracked HEAD. The check manifest includes this helper's hash and all source/receipt hashes.

## Checks and outcomes

All commands ran at `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion` using `/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node` (v24.15.0). Project declares npm12.2; these selected commands invoke local tools directly and do not install dependencies.

| Check | Outcome | Receipt in Q |
|---|---|---|
| Jest ESM, watchman disabled, explicit offline URL, seven named suites |PASS410/410;7/7 suites;0 skipped |native-json-focused-tests-freeze.json / .log|
| local tsc --project tsconfig.json --noEmit |PASS exit0 |native-json-full-type-freeze.log|
| local tsc --project convex-dev/tsconfig.json --noEmit |PASS exit0; unchanged product code after this pass except documentation comment |native-json-backend-type-r3.log|
| local ESLint on the ten changed paths, --report-unused-disable-directives |PASS exit0, no warnings |native-json-scoped-lint-freeze.log|
| git diff --check on the ten paths |PASS exit0 |native-json-extraction-source-checks.json|
| v4 helper and parser/schema/actual-manifest preservation |PASS exact helper/retained-file equality; historical v2/v3 canonical request digests and v4 replay pass |native-json-extraction-source-checks.json plus Jest|

Jest command: `CORTEX_TEST_ENV_MODE=explicit CONVEX_URL=http://127.0.0.1:1 NODE --experimental-vm-modules node_modules/jest/bin/jest.js --watchman=false --runInBand --runTestsByPath` followed by the seven paths below, `--json --outputFile=Q/native-json-focused-tests-freeze.json`. NODE and Q abbreviate the absolute paths above. The offline URL satisfies setup only; selected suites use controlled ports/factories/injected fetch and made no hosted or paid call. Explicit environment prevents local credential configuration from selecting a service.

Coverage counts from the JSON result: native policy159, Gateway88, memory adapter92, domain policy49, registry6, unchanged v4 framing4 and unchanged strict sources12. The new62 cases cover exact installed transform/body measurement, boundary escaping, required format/pin/operation rejection, independent native bound/permit derivation, source/grant/expiry denial, usage completeness with unknown AND known money, unchanged liability/slots, replay without new attempts, strict malformed/empty/attributed output, historical byte compatibility and absence of fake actual qualification. Controlled native handlers do not prove hosted OCC or native format support.

Earlier receipts remain historical: initial Jest startup exited1 before results without an explicit test URL; corrected offline setup was used thereafter. One scoped lint warning was fixed by removing a condition already guaranteed by the parsed schema. Intermediate failures were test expectations for existing terminal disposition: same-intent overrun is `uncertain`, while settled-withheld output denies `CAPABILITY_UNAVAILABLE`; the final assertions verify those exact states, no new attempts and original financial balances. A readonly-schema test typing issue was corrected to use a mutable deliberately invalid schema fixture. No product guard was relaxed to make a test pass.

Machine check manifest: `native-json-extraction-source-checks.json`, SHA256 `e65ea8c5bb5f90cf198a762f8c8d3b89767ab3ffcec8bf2ee99e6202879871b0`.

Next mandatory boundary: one non-author review of this coherent frozen batch and P's procedure, rebuilt artifact/installed consumer checks, fresh actual JSON and separate plain receipts, then newly authorized ordinary memory intent with facts/vector/source provenance. Actual memory acceptance and subsecond latency remain incomplete. K4 is closed; its sequence3 failed output, financial snapshot and UNKNOWN receipts were neither accessed nor altered.
