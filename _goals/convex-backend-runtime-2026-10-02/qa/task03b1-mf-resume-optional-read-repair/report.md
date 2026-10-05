# Task Completion Report: MF optional READ callback repair

## Status: PARTIAL — repair/checks complete, fresh supplemental judgment pending

The additive original current-source REJECT remains preserved in task03b1-mf-resume-optional-read-review. Earlier original42 PASS and historical MF rejections are not rewritten. This repair modifies only runtimeDataAuth.ts and adds optionalReadFailures.test.ts; no existing371 assertions changed, no shared authority/schema/handler/SDK/generated/config edits, no live services/deployment/inference/network/commit.

## Changes Made

Identity acquisition is protected before the resolver permission catch: synchronous invocation errors and promise rejection become a fixed BACKEND_OPERATION_FAILED envelope with outcome not_committed. The thrown callback value is never read, stringified, inspected or returned. All eight underlying authority-reader callbacks are separately protected before the accepted shared resolver's candidate-pruning catch; their diagnostic exceptions cannot masquerade as missing READ. Persisted WRITE recheck uses that same protected reader.

Only genuine resolver FORBIDDEN with the exact static accepted permission envelope permits initially READ-less receipts. Own descriptors and exact keys/values replace property reads; accessors and malformed/private envelopes do not qualify. Static permission denial still rechecks current WRITE and denies if the writer independently includes READ. Previously admitted READ retention and revocation/expiry rollback stay unchanged.

## Requirements Checklist

- [x] Unchanged independent80-case probe matrix now80/80; previous60 false committed receipts now deny/rollback;10 READ-less positives and10 ordinary error negatives retained.
- [x]100 new registered outcome regressions across memories.store/update/updateMany and facts.store/update:80 identity failures (8 modes×2timings×5handlers),10 healthy receipt controls,10 low-level callback failures.
- [x] Exact native FORBIDDEN, code-only, private metadata/message, own data accessor, code accessor, proxy and ordinary Error identity failures abort with exact opaque envelope and full rollback; zero diagnostic getter/proxy traps.
- [x] Entire current471 registered cases pass (prior371+100),0 skipped/pending. Added100 isolated rerun also passes.
- [x] Actual unchanged backend ES2021 types, scoped types and affected ESLint pass;7 discovered suites.
- [ ] Fresh supplemental independent judgment pending; these execution receipts are not an independent PASS.
- [ ] Actual deployed callback/JWT/transaction behavior remains unexecuted; fixture outcomes do not claim a live exploit or live service certification.

## Verification

Exact successful commands and exits are in commands.json, raw receipts alongside. Unit setup uses inert http://127.0.0.1:1 to satisfy unchanged environment setup; all tested actual handlers operate solely through the transaction-aware fixture. Initial attempts with missing historical scoped config and no setup URL were noncertifying and superseded by the actual scoped config and inert setup prerequisites. No network request was made.

## Files Modified

| File | Action | Evidence |
|---|---|---|
| convex-dev/runtimeDataAuth.ts | Modified | Source SHA2563fd328761100777a06c0fe243deb68825492ddbefd669b23dbc1f9e125e4fd27 |
| tests/unit/runtimeEndpointAuth/optionalReadFailures.test.ts | Created | Source SHA25693732164d708380c9ca34b8483756890164d4733c440f3de56a1063e6b28f8dd |
| new QA directory | Created | Source snapshots, exact before/after diff, manifest,471/100 test outputs,80-case independent replay and commands |

## Notes for Reviewer

Frozen source manifest records relevant unchanged prerequisites and touched-source hashes. Callback origin is protected before resolver invocation; tightening envelope parsing alone would leave exact-looking callback errors exploitable. The previous ordinary READ-less positive semantics and stronger initially admitted READ revocation semantics are preserved. Supplemental review should inspect all five actual handler outcomes and callback pruning protection rather than only error shape.
