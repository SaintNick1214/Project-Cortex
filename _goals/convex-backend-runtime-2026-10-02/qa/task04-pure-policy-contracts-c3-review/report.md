# Task Judgment: Task04 bounded PURE-policy C3

## Verdict: PASS — FINAL, PURE slice only

**Average: 4.4/5.** The exact three-file candidate satisfies the bounded pure-policy contract. Both original C1 defects and all four original C2 own-key/identity failures pass unchanged independent probes. No blocking pure defect was established. This gate permits dependent ledger implementation; it does not accept whole Task04, full03-final or the goal.

Read-only review covered `src/domain/model-policy.ts`, `src/domain/index.ts`, and `tests/unit/domain/model-policy.test.ts`. Writes were confined to this new review packet and unique `work/resume/task04-pure-policy-c3-review` scratch. No candidate/product/prior QA/Git edits, root dotenv/test setup, installation, credential/key access, service request or network/inference execution occurred. Current build/package output was generated exclusively inside the scratch source mirror; production dist was not a build target.

Applied AGENTS, CODEX-RUNTIME, PROJECT-PROFILE, pessimistic-judge, judge-task and feature-orchestrator. Reviewed original implementation prompt, authoritative decision register, architecture, goal/all17 tasks, Task01 frozen contracts, Task04 preparation/consumer allocations and C11 aggregate report. Their exact document fingerprints are in `independent-reconciliation.json`. C11 PASS4.6 accepts03-foundation only. All original Task03 functional and final gates remain mandatory. Preparation/bootstrap/Gateway design packets are not production acceptance. Numerical cycle caps alone were waived; no requirement or rubric threshold was waived.

## Requirements review

| Original requirement as allocated to the pure slice | Result and concrete evidence |
| --- | --- |
| Register all approved operations | Met: `model-policy.ts:6` lists13 exact keys including suggestions; registry maps capabilities/native interfaces. Original unit registry outcome and independent per-text-operation checks pass. Media registration remains explicitly unavailable; Decisions/image understanding are excluded. |
| Trusted deployment/tenant/agent/operation precedence | Met: `resolveModelPolicy:142` validates exact scope/version and orders six scope/specialization ranks deterministically. Unit precedence/scope/ambiguity outcomes and unchanged broad rank controls pass independent of record arrival order. |
| Versioned trusted overrides within hard deployment bounds | Met: exact authorizationId/actor/changeRevision/policyId/version matching, no deployment override; ordinary allowlists intersect and caps tighten. Deployment operation constraints reapplied after authorized overrides. Unit and broad exact-override/hard-specialization controls pass. Pure records authenticate nobody; later trusted backend lookup remains required. |
| Provider-qualified models/native interface eligibility | Met: qualified Chat default `openai/gpt-4o-mini`, explicit qualified Responses with `openai.store:false`, Messages unsupported by operation whitelist. No raw fallback provider constructors/imports. Synthetic distinct-function model selection is tested, actual distinct qualified-model inference is NOT_RUN and mandatory later. |
| Capabilities/options/tools/token/time/monetary bounds | Met: strict schemas, safe integer micro-USD/caps, combined input+output context capacity, exact registered tools/roles, duplicate tool rejection, retry0, narrow allowlisted options and providerOptions. Original negative outcomes and independent safe-integer/ceiling/capability controls pass. Actual token establishment and final low-level dispatch whitelist remain adapter obligations. |
| Immutable full snapshot/pins | Met: immutable detached authority scope, agent/source/run/parent, policy versions, model/interface, prompt/schema/extraction/tool, price/bound and qualified-call ceiling. Original tests and broad recursive snapshot/current identity pin controls pass. Declared synthetic ceilings are not real cost/price evidence. |
| Complete ordered canonical request and collision rejection | Met: exact ordered roles/parts/tool-call IDs/payloads/definitions/output schema/options and snapshot enter canonical identity; normalized texts match complete dispatch messages. SHA256 lookup plus exact canonical equality; forced same-hash/unequal-canonical conflicts reject. Prior broad ordered changes and C1 identity controls pass. |
| C3 four ordinary own-key record families remain exact | Met: private `canonicalRecordSchema:267` used only in request schemas. `validateModelRequest:311` first descriptor-validates with canonicalModelJson then JSON.parse detaches the complete graph. The validator receives only that plain JSON graph; it checks nonnull nonarray plain objects and returns the same detached value without arbitrary-key assignment. All four unchanged C2 probes preserve own `__proto__`, canonical bytes and different hashes from `{}`, and reject identity reuse. |
| No malformed-input expansion or caller side effects | Met: all four families reject primitive/array roots, custom prototypes, nonenumerable/symbol/accessor data, bad nested values, cycles, sparse/custom-iterator arrays. Fresh controls observe zero getter/iterator effects and no caller freezing. Null-prototype JSON is accepted losslessly then detached into ordinary parsed data. Shared aliases and own constructor/prototype/toJSON/empty/numeric keys remain exact, frozen only in admission; caller mutations cannot change receipt. |
| Strict descriptor handling and fallback evidence | Met: canonical JSON rejects invalid graphs before parsing; `canFallbackModel:378` preflights/detaches unknown evidence and returns false on malformed records without executing getters. Original counting-getter/alias failures and broad every-fallback-field accessor checks pass unchanged. JavaScript proxies are not asserted to be side-effect-free objects; tests establish ordinary descriptor/iterator handling. |
| Complete fixed embedding profile and stable batches | Met: all six DEFAULT_EMBEDDING_PROFILE fields match via assertProfileMatches; pinned ranges/ordinal identity, count≤512, output0/tools0/no messages and no profile-changing fallback. Unit profile/batch controls pass. No actual managed-vector readiness, model alias immutability or retrieval qualification is claimed. |
| Conservative compatible fallback | Met: candidate qualification must cover current caps/options/capabilities and ceiling; safe proof/accounted attempt/current source/authority/policy checks required; visible text/tools/effects, uncertainty/cancel and embeddings prohibit replay. Unit/broad original outcomes pass. Eligibility grants no reservation or dispatch authority. |
| Reachability/browser/default-runtime seam | Met: `domain/index.ts:12` exports all policy contracts. Independent browser source bundle60exports/106inputs excludes provider/config/root client/graph modules, runs without process/require, and WebCrypto hashing works. Packed fresh-build ESM/CJS/declarations/URL/browser contracts pass. Package manifest has only root export, so no new published domain subpath is claimed. Backend/native wiring is outside this slice. |
| Atomic run/tenant budget/concurrency, checkpoint/once-only settlement, unknown liability/recovery | Outside pure slice, NOT_IMPLEMENTED here. Original whole04 obligation remains held for ledger/Gateway production implementation and independent acceptance. Pure ceilings/fallback predicates cannot establish quota enforcement. |
| No hidden paid-call bypass; actual distinct policies/models and audit | Outside pure slice, NOT_RUN. Source inventory shows no backend consumer yet. Governed runtimeMemory/actual Gateway/Agent low-level wrappers and later09/14/15 client/template secondary-call conversions still require real wiring, deny-before-token, audit and service receipts. |

## Independent execution evidence

All attempts have exclusively created raw stdout/stderr, argv/cwd/start/endUTC/exit receipts, exact source/config fingerprints and saved inert scripts/configs. Installed Node24.19.0 and prescribed npm12.2.0 CLI `/home/agent/.npm/_npx/1106a35d869e25fb/node_modules/npm/bin/npm-cli.js` were used with offline npm and installed dependencies only. The subprocess environment includes only PATH, scratch TMPDIR/cache, offline flag and NO_COLOR; no root dotenv/setup loaded.

| Independently executed check | Outcome |
| --- | --- |
| Affected standalone TypeScript | exit0 |
| Exact three-file ESLint/max-warnings0 | exit0; zero warnings, empty stdout/stderr |
| Jest discovery | Exactly one standalone model-policy suite |
| Unit outcomes |35PASS/0FAIL/0pending/0todo,1suite; all original30 retained |
| Unchanged original C1 failed probes | exit0; four nested request families detached, caller unfrozen; fallback accessor effects0/false; scope/run/parent identities, forced digest collision, safe integer and ceiling controls pass |
| Unchanged original C2 four-family failure probes | exit0; all4 exact own keys retained, no canonical/hash collapse, identity comparison rejects changed record |
| Unchanged prior broad corners |13PASS/0FAIL: six-rank precedence/override hard bounds, pins/ordered messages, fallback compatibility, all text operations, ordinary own keys |
| Fresh C3 hostile-record controls, corrected run02 |12PASS/0FAIL over all4 families: exact deep keys/descriptors/aliases/caller mutation, malformed rejection/effect0, null-prototype input |
| Isolated current-source root build | exit0; ESM/CJS/declarations built in scratch |
| Packed contracts from fresh scratch build | exit0; packed ESM/CJS/public exports/declarations/URL/browser execution |
| Domain browser bundle and VM |60exports/106inputs; no provider/config/root client/graph dependency; no process/require; WebCrypto confirmed |
| Producer reconciliation |75manifest rows independently match SHA256/bytes; observed producer red30PASS5FAIL and green35PASS confirmed; C2 exact28,011-byte prefix preserved |

Every source fingerprint stayed unchanged before/after commands. `source-before.json` equals `source-after.json`; candidate mirrored bytes are exact. `independent-reconciliation.json` verifies all original30 assertion names remain and pass, original C1/C2 probe source bytes are unchanged, and all producer manifest rows match. `unit.result.json` retains exact assertion outcomes. A VM Modules warning is recorded in raw stderr, not suppressed or counted as a product warning.

The initial fresh-C3 fixture mistakenly attached a shared array containing its own owner, creating a cycle. Canonicalization correctly rejected it, yielding4failed fixture setup outcomes and8passing controls in `fresh-c3.stdout`/stderr with exit1. That attempt remains unchanged. New run02 substitutes an independent child object only; all12 controls pass. This corrected reviewer fixture is explicitly recorded in `attempt-limitations.md`. No product source/assertion was changed to obtain green. Exploratory missing root PROJECT-PROFILE and a missing historical source-before filename are read errors, not test results; correct .agents/profile and pre-edit manifest evidence were subsequently read.

The original C1 initial producer14failure/preliminary22PASS missing/truncated disk-history remains missing. Newly archived hashes establish those archived bytes only; C3 producer red/green and this independent execution do not retroactively fabricate earlier raw streams/source preimages. Prior C1/C2 NEEDS_REVISION verdicts and their original failures remain intact.

## Test coverage analysis

| Public behavior | Meaningful outcomes |
| --- | --- |
|resolveModelPolicy|Registry, qualified native/default interface, distinct synthetic functions, six ranks, exact overrides, hard intersections/caps, scope/ambiguity/invalid limits/pins, frozen snapshot, full embedding profile, fallback incompatibility|
|validateModelRequest|Exact normalization/messages/roles/parts/options/tools/schema/profile/batches; token/context/cost/time bounds; pinned versions; four detached/lossless JSON families; malformed descriptor/value rejection and caller mutation controls|
|canonicalModelJson|Stable object key order/ordered arrays, finite values, rejection of cycles/coercion/sparse/accessor/iterator/symbol/nonplain graphs; exact own keys|
|createModelRequestIdentity/assertModelRequestIdentity|Actual SHA256 format; normalized equality, ordered text/tool/option/scope/source/run/profile changes; canonical/hash mismatch and forced same-hash conflict|
|canFallbackModel|Safe positive predispatch/qualified-rejection controls; invalid proof/candidate, visibility/tool effect/uncertainty/cancel/currentness negatives; getter/no-effect evidence; embedding prohibition|

All5public function areas have outcome and error/control coverage; none rely only on execution or nonnull assertions. Original C2 test SHA256 `1bfb874dc2fe4bac9900c2c699e2985c4925129f55aad03b2f84a1f738acf714` is an exact prefix of current32786bytes. Five C3 regression outcomes were appended; no original assertion removed or weakened.

## Issues found

### Critical

None established in the bounded PURE candidate. Whole04 is incomplete by explicit allocation, not accepted by this verdict.

### Important

Later production code must construct trusted policy/qualification snapshots and enforce current source/authority, exact final params/independent tokens and all low-level paid-call admission. Synthetic fixtures cannot certify actual qualification/pricing/accounting/authentication. Existing direct SDK/provider/template paths remain mandatory named conversion gates.

### Minor

Public request record types remain `Record<string, unknown>` and `Readonly<ModelCallRequest>` is shallow at the type level although runtime admission freezes deeply. This is compatible with existing dynamic schema contracts; consumers should honor immutable admitted values. The private permissive leaf is safe only because its sole parse path follows descriptor validation and detached JSON; preserve that ordering in future edits.

## Dimension scores

| Dimension | Score | Evidence |
| --- | ---: | --- |
|Requirement Fulfillment|5/5|Every bounded pure requirement reviewed and independently proven, with all original whole-task obligations explicitly preserved|
|Code Quality|4/5|Private precise plain-record validation after safe detachment; strict schemas, pure boundaries and fail-closed contracts; dynamic unknown/shallow type limitation remains|
|Test Quality|5/5|35meaningful preserved outcomes/no skips; unchanged prior failure probes and fresh four-family hostile/mutability controls; failed reviewer setup retained|
|Pattern Adherence|4/5|Pure domain export, scoped validation, offline/isolated evidence, no provider or backend mutation; no wider integration asserted|
|Completeness|4/5|Exact bounded contracts/tests/export and required checks complete; ledger/native wiring/actual distinct-model evidence belongs to later original gates|

**Average:4.4/5.** All dimensions≥4 and Requirement Fulfillment5 meet judge-task PASS without waivers.

## Exact candidate SHA256

| File | SHA256 |
| --- | --- |
|src/domain/model-policy.ts|`f43de8775880d1d4f6ddad90e527837d9ddb4ce58d00ea622aabc2609a1769da`|
|src/domain/index.ts|`b1bb56d6df91596512f9c1e35b48f8942207bf9651739885eb81f7755d834648`|
|tests/unit/domain/model-policy.test.ts|`d5a65043cb6c1dc2af851df866c5881fea67a0677c79ce3c5fe99d79f62700fc`|

## Recommendation

Proceed with bounded Task04 ledger/Gateway implementation under the original requirements and fresh independent gates. Keep whole04, full03-final and goal incomplete. Actual inference/pricing/quota enforcement/authentication/vector/media/UI coverage is NOT_RUN in this review. Reproduce commands only in a new exclusive receipt directory; source changes invalidate this candidate verdict.
