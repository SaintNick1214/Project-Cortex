# Task Judgment: semantic hash and bounded Gateway stream batching

## Verdict: PASS — source/test batch only

Independent non-author review under acceptance-policy v2. All 18 frozen source/test hashes matched before and after the final independent checks. Final coherent manifest revision 2: `3bac0cfa56ed906318c4922a015edb34663012c6a179133ea416fe3954f0f408`. Product base: `ef094fc5f724a25470d5da0d74f287b638e83bf0`; QA HEAD: `752506b05b4457cb1ac8ab0b069adecdbe326ca4`.

This accepts this coherent source/test change only. Installed latency qualification and the final goal audit remain pending; no overall goal completion, hosted speed or release acceptance follows from this verdict.

## Requirements Review

| Requirement | Met? | Evidence |
|---|---|---|
| Exact UTF8 SHA256, lowerhex and async API | Yes | `src/domain/profile.ts:77` keeps TextEncoder and the async API, delegates to existing portable createSha256. 26 direct parity cases independently pass against Node crypto and the former WebCrypto expression, including known vectors, Unicode/replacements, padding, large canonical bodies and coercion/rejection behavior. No JWT/HMAC or product authorization/currentness/financial policy diff. |
| Active collision, fault and late-invalidation tests | Yes | Every adaptation diff inspected; `tests/unit/semantic-hash-probe.ts:8` defaults to the real production fast hash. Registered handlers use the same seam through dynamic imports. Existing security effects/assertions remain; forced collision counters prove the injected equality was reached. Independent 12-suite oracle run passed all 927 cases. |
| Preserve the original test contracts | Yes | K29 historical global physical-order case retains all original assertions under explicitly STATIC old WebCrypto boundary. Separate current fast case checks exact output/state/effects/RPC/read identities; revision/tombstone/revocation/expiry/profile/foreign negatives remain fast. Original-byte baseline diagnostic retains expected2/received3 authority-scope failure; correction asserts a fresh distinct session scope and preserves token revocation denials. |
| Bounded owned producer and conservative metadata handling | Yes | `convex-dev/runtimeGateway.ts:692` and `:1006` bound queued entries32/wire upper estimate65536, visit1024/depth16; use descriptors and serial handoff for opaque/accessor/cyclic/oversized parts. No new rejection cap for ignored large metadata. One pending/in-flight provider part plus provider-owned buffering is separate from the queue bound. |
| First text and safe batching barriers | Yes | `:1055`/`:1094` coalesce only compatible already-queued deltas across transparent private raw records; no awaited lookahead and first text is unbatched. ID, metadata, start/end/call/error/terminal boundaries preserved. Actual normalized official SSE text/tool parity passes with injected fetch only. |
| Fresh visibility and financial cancellation | Yes | Each actual emitted batch still calls fresh state.visible/markVisible; canDeliver/assertDelivery and abort guards remain. Regression independently rejects queued text/tool output after a financial-only denial following the initial ACK. No first-ACK reuse. |
| Accounting, bounds, backpressure and cleanup | Yes | Producer performs reads only. Drain retains terminal/native accounting and private attachment rules. Cleanup stops/wakes and joins producer, cancels reader and releases lock. Independent cancellation, timeout, result overflow, upstream failure, replay, entry/byte backpressure and ignored metadata regressions all pass. |
| Build/contracts and stack checks | Yes for this batch | Root build natural0 in25.690s with both product hashes stable; public contracts natural0 in2.031s. Reviewer did not rebuild. Independent TypeScript lint project and strict ESLint for all18 files exit0. |

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement fulfillment | 4/5 | All mandatory behavior for this bounded batch has source and meaningful offline outcome evidence. |
| Code quality | 4/5 | Bounded single producer, conservative fallback and explicit joined cleanup; maintains existing guarded pipeline. |
| Test quality | 4/5 | Active fault boundaries, positive parity and relevant security/lifecycle negatives; no assertion deletion or silent weakening found. |
| Pattern adherence | 4/5 | Reuses portable hashing, existing ledger fences and owned task/observation lifecycle. |
| Completeness | 4/5 | Reachable existing API, root build/contracts and independent affected tests/types/lint pass; separate installed gate remains explicit. |

**Average: 4.0/5. Zero unresolved breaking findings.** Meets goal-specific minima; no generic higher score or cycle requirement imposed.

## Independent Checks

All commands used absolute Node24.15.0; npm12.2.0 was verified. Jest used a minimal explicit environment with `CONVEX_URL=https://offline.invalid`, no .env credential loading, `--runInBand --forceExit=false --watchman=false`. No service or model was invoked.

| Check | Result |
|---|---|
| Gateway dispatch/terminal/backend plus direct semantic hash parity | 4/4 suites,396/396 cases,0 skipped/todo; natural0 in15.651s |
| Every other changed hash-oracle suite, after BOM helper repair | 12/12 suites,927/927 cases,0 skipped/todo; natural0 in39.275s |
| Full lint TypeScript project | exit0 in8.735s |
| Strict ESLint across all18 reviewed files | exit0,0 warnings in7.333s |
| Scoped whitespace check | exit0 |
| Source hashes | 18/18 unchanged before/after revision2 checks |

Total independent executions: **16 suites,1323 passing cases,zero skips/todos**, natural process exits. The custom timing reporter undercounts individual cases; raw Jest396/927 is used. Detailed commands, versions, per-suite results and hashes are in `memory-effort-stream-hash-independent-review.json` and the adjacent independent command/Jest/log receipts.

## Issues Found

### Critical and important

None unresolved in this source/test batch.

### Resolved within this coherent review

The initial test probe decoded UTF8 with default TextDecoder, which stripped a leading BOM before calling the correct product hash. The author changed it to `ignoreBOM:true` and added a three-input regression against independent Node and former WebCrypto digests, explicitly different from stripped bytes. Reviewer independently inspected the change and reran the affected oracle suite. Both product files stayed unchanged. This was test-helper fidelity, not a product hash defect.

## Evidence boundaries and preserved history

The inspected actual hash-method receipts show110 matching digests per method and zero DB/model calls, with official whole-query execution166.670792ms WebCrypto versus25.467481ms fast. This supports selecting the pure hash method; it does not establish calibrated per-hash cost, CPU/network decomposition or end-to-end gain.

Original failed checks and experiments remain historical failures: author first35-case failures, loader zero-test failure, original authority-scope expectation failure, stale generated catalog diagnosis and CLOCK_DID_NOT_ADVANCE. The author's55/2454 pre-BOM run and8/615 post-BOM repair run are distinct evidence scopes. Earlier real hosted latency/cancellation failures are unchanged by this review. Video remains explicitly unsupported/deferred.

Reviewer performed no product/test edits, builds, packing, deployments, service/model calls, credential reads, Git mutations, Proofs/docs/Union Arena actions or other-chat messages. Only authorized Q review/check artifacts were written. Proceed with the root's separate installed-candidate latency verification and final audit.
