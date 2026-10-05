# Task judgment: Task03B2F bounded asset foundation

## Verdict: PASS

Scope is the bounded implementation safety closure of seventeen original asset registrations only. This verdict does not accept functional assets, Tasks12–14, full original Task03, the current-guard live gate, the aggregate foundation gate, or Task04 execution. Read the approved sequencing plan and its applied application.json alongside original Task03 and Tasks12–14 requirements; every original functional obligation remains allocated to restoration and final adversarial/live review.

## Requirements review

| Requirement | Met | Independent evidence |
|---|---|---|
| Exact17 declarations;11 public and6 internal | Yes | Original native exportArgs, literal validators, native registration visibility checked by executed390 tests; inspected actual exported handlers and refreshed17-row ledger |
| Verified issuer/subject; unique concrete trusted scope; storage capability and current principal/membership/grant/epoch fences | Yes | runtimeAssetUnavailableAuth.ts:19–73 reuses accepted policy; all11 handlers call read/write guard;390 tests exercise missing/forged, capabilities, omitted/mismatched/ambiguous scopes, deletion/revocation and late fences |
| Authorized outcome uniformly version1 CAPABILITY_UNAVAILABLE, retryablefalse, not_dispatched | Yes | Every public handler tested; source guard only reaches unavailable after matching pinned-reference sweeps and post-await expiry check; six internal helpers reject without authentication or database work |
| No caller private lookup, storage access, scheduling, forwarding, writes, fabricated success or presence oracle | Yes |390 tests trap private queries/get/storage/scheduler/runQuery/runMutation/runAction and writes across presence/owner/source variants; guard is first executable statement in each17 handler |
| Callback failures remain opaque and cannot become policy pruning | Yes |19 additional independent outcome probes include actual db.get returned accessors/proxies, auth/query/get/normalizeId exact ordinary FORBIDDEN callbacks, identity descriptor/then errors, current revocation and expiry; no private error data escapes |
| Accepted22, schema/shared auth and original validators preserved | Yes | Original390 tests perform literal/hash validator and accepted22 preservation; hash-check.json independently verifies all9 candidate frozen hashes against current bytes |
| Dead old bodies retained for original API inference only | Yes | Independent AST statement comparison of all17 handlers in body-preservation.json; attachments:get uses the documented equivalent typed local return; all other legacy statements literal identical |
| Preserve original390 tests and meaningful checks | Yes | Independent rerun390 passed,0 skipped/pending/failed;19 own probes passed,0 skipped; scoped tsc and affected eslint exit0 |
| Original functionality retained as later obligation | Yes | Seventeen-row restoration ledger names actual12 storage/delivery,13 media/callback,14 client/parity outcomes; report explicitly holds live/aggregate foundation and Task04 |

## Dimension scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment | 5/5 | All bounded safety requirements verified, no functional requirement claimed complete |
| Code Quality | 4/5 | Narrow protected callback/codec boundary, descriptor-captured identity, accepted policy reuse; retained dead legacy code intentionally temporary |
| Test Quality | 5/5 |390 original plus19 independent outcome probes, exact envelopes and no-effects assertions; observed discovery/skip counts |
| Pattern Adherence | 4/5 | Native Convex registrations/errors/codecs and current authority contracts; no shared-policy or schema edits |
| Completeness | 4/5 | All17 native paths closed and static types/lint pass; strictly bounded offline completion |

Average:4.4/5.

## Evidence interpretation and limits

The installed Convex codec uses Object.entries (node_modules/convex/src/values/value.ts:413) and executes enumerable accessors; it is not a getter-free copier. The candidate surrounds both await and codec copying with its asset-specific catch. Actual returned db.get accessors throwing an exact native FORBIDDEN and proxy descriptor/ownKeys/prototype/then faults yielded REGISTRY_OPERATION_FAILED with fixed message and failed outcome, rather than denial, alternate-scope selection, unavailable readiness or private diagnostics. Identity issuer accessors were rejected by descriptor inspection without invocation. Promise assimilation can invoke then before copying; that failure is also caught. Codec capture turns successful valid reads into ordinary detached values.

Native persisted Convex documents are schema-validated values without executable accessors/proxies, and queries/mutations use transaction snapshots. These injected returned-object fault probes test an infrastructure-failure boundary, not a claim that a caller can persist executable getters. Mid-call fixture changes deliberately model stale snapshots/revocation; matching sweeps and post-final-await expiry deny the examined variants. Arbitrary malformed database snapshots or mutation after the final snapshot read are not evidence of a native transactional bypass. No live deployment, storage or HTTP service behavior was exercised or certified.

Executed commands (all in /workspace/Project-Cortex):

- Original isolated Jest config:1 suite,390 passed,0 skipped. original-tests.json and original-tests.log retain observed receipt.
- Independent scratch Jest config:1 suite,19 passed,0 skipped. probes.json and probes.log; independent-probes.test.ts.text preserves source. First probe discovery attempt found0 because inherited roots excluded work/; corrected explicit scratch roots produced the counted19-test run. No pass inferred from the initial failure.
- npx --no-install tsc --project work/resume/asset-closure/tsconfig.json: exit0, typecheck.log empty.
- npx --no-install eslint convex-dev/artifacts.ts convex-dev/attachments.ts convex-dev/runtimeAssetUnavailableAuth.ts tests/unit/runtimeAssetUnavailableAuth/closure.test.ts: exit0, lint.log empty.
- Independent frozen-hash and AST-preservation probes: all9 hashes match, all17 guards first and old bodies preserved.

## Issues and recommendation

No blocking safety defect found. Minor: old unreachable product comments still describe bearer upload/download URL use, including expiry claims. Actual Task12/14 restoration must replace those examples with authenticated bounded delivery; they cannot authorize the old unreachable storage implementation.

Accept only this bounded offline implementation gate. Require current-guard live qualification and fresh aggregate foundation judgment before Task04; require actual12–14 restoration and original03/16/03-final outcomes before final assets/security completion. No source edits, services/deployment, commits, children or broad builds were performed by this judge.
