# Task Judgment: standalone policy-profile import repair

## Verdict: PASS — bounded source/test repair only

Independent non-author review under acceptance-policy v2. Scores are4/5 in all five dimensions, average4.0/5, zero unresolved breaking findings. This accepts the two-file source/test repair, with17 unchanged files inherited from the earlier coherent source review. It does not accept a new installation, latency result or overall goal completion.

Frozen19-file manifest: `memory-effort-hash-stream-repair-coherent-source-hashes.json`, SHA256 `2a2f5b8ce9a789913dd8b4f732a4a78d57a08f1051703ea5db8388c2b5f67c73`. All19 hashes match before/after checks. The17 inherited hashes exactly match prior review `0a7f4dd0a2a154f23e38d8b7f249c77a4d6afcb57c9ecdc5644134cbe9aff332`; their explicit paths and all hashes appear in the JSON companion.

Changed files:

- `src/domain/profile.ts` — `cb22cbf300ec1c679dc30a912f69a79afe8268b4de72578f9d6c5af7a58e8599`.
- `tests/unit/domain/semantic-hash-standalone.test.ts` — `8d81063de1416da8570662187f3cbde6f78c6bc2f60a44818cf747308f363866`.

## Requirements Review

| Requirement | Met? | Evidence |
|---|---|---|
| Repair actual missing standalone module edge | Yes | Read explicitly permitted `P/sandbox-env/qualification.mjs:36-50`: actual loader syntax-only transpiles five known domain modules into `.sandbox-policy-preflight`, without copying common/crypto. `runtime.mjs:161-162` calls it before commissioning. New profile imports bare fast-sha256 instead of unresolved `../common/crypto`. |
| Preserve exact pure hash/API | Yes | `profile.ts:1,77` uses the same fast-sha256 Hash class, explicit TextEncoder bytes, lowercase64hex and async Promise API. Direct Node crypto and former WebCrypto parity, Unicode/BOM/surrogate, large-input, coercion and rejected-promise tests pass. No JWT/HMAC/auth/currentness/financial policy edits. |
| Actual module-resolution regression | Yes | New test reads actual current source, uses the actual ES2022 transpileModule settings, creates only isolated profile.mjs without common sibling and imports it in native Node ESM. Ten byte inputs match Node crypto and the former WebCrypto. No mock module resolver/source substitution. Joined child reports success/no signal/error; finally cleans temp files. |
| Existing additive dependencies and custom functions preserved | Yes | Root package already pins fast-sha2561.3.0. `build-distribution.mjs:197` carries package dependencies into the manifest; `additive-backend.ts:358` forwards them and respects configured functions path. Read-only diff confirms no package/config/installer/producer changes from b366. |
| Active security regressions remain meaningful | Yes | Independently ran admission/model-drift, v8 hash-owner/bounds/failure, endpoint memory and retained witness suites. Collision/failure/late revocation/expiry/write/currentness/financial assertions pass through the actual fast default probe. |
| Frozen scope and inherited acceptance | Yes | Exact19 hashes stable before/after; changed2 and inherited17 explicit in JSON. Prior17 are byte-identical to earlier reviewed source. No full1323 rerun needed after same-class dependency-only substitution and meaningful focused tests passing. |

## Independent Checks

Absolute Node24.15.0; minimal explicit environment, dead `https://offline.invalid` selector, no .env credential loading, `--forceExit=false`, natural exits. Commands, versions and raw Jest assertions are in the companion JSON and adjacent independent command/log receipts.

| Check | Observed result |
|---|---|
| Actual standalone MJS import + direct hash parity + necessary active security suites | 7/7 suites,436/436 cases,zero skips/todos; natural0 in12.644s |
| Full lint TypeScript project | exit0 in8.334s |
| Strict lint for both changed files | exit0,zero warnings in3.088s |
| Scoped whitespace | exit0 |
| Package/convex.json/producer/additive installer/config source diff | empty |
| Frozen sources and test temp cleanup | all19 stable; no standalone temp directories remain |

The custom timing reporter says362 individual tests; raw Jest436 is authoritative. Offline security fixtures do not establish real Convex/OCC/hosted runtime behavior. The native Node MJS import is actual local module-resolution evidence, not a complete installed preflight.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement fulfillment | 4/5 | Observed missing edge addressed with exact-consumer source inspection and native import regression. |
| Code quality | 4/5 | Minimal direct dependency substitution; same reviewed hash implementation and explicit encoding/output. |
| Test quality | 4/5 | Real source/native loader, independent digest references, before-red retained and meaningful security negatives. |
| Pattern adherence | 4/5 | Reuses existing pinned dependency and existing additive dependency/config flow. |
| Completeness | 4/5 | Source repair and focused tests/types/lint complete; installed candidate remains separately pending. |

**Average:4.0/5. No unresolved critical, important or minor findings in this bounded repair.**

## Preserved Failure and Scope

The earlier b366 source-only PASS remains historical source acceptance. Its actual installation **FAILED** before startup: session`6cde9472-246b-4a02-ba2a-54c86db9d8f6`, target6194822, original exec98777 joined with exit1, missing host/common/crypto imported from isolated profile.mjs. Startup qualification was NOT_REACHED with zero startup dispatches. The launcher recorded CLEANED; this reviewer made no service absence check. `memory-effort-hash-stream-launch-failure.json` remains unchanged.

The original regression harness EPIPE failure remains preserved. After consuming stdin before import, the regression independently recorded the precise ERR_MODULE_NOT_FOUND on the original81cc source before product repair; that one-case RED remains a failure. Reviewer inspected these receipts and did not rerun/relabel them.

No reviewer source/test/P edits, builds, packs, deployments, credentials, service/model calls or Git mutations occurred. Only the explicitly permitted two P loader files were read. The regression created and removed its owned local temp files; Q check/review artifacts were written.

Root may now perform its justified rebuild/new package/new kit/new session. A fresh successful installed preflight/startup and later latency/final audit are still required for their respective acceptance gates; this report makes no end-to-end improvement claim.
