# Task03C1 completion report — first review essential fix

## Status: COMPLETE/PASS — bounded credential foundation

The bounded implementation and local transport/source/browser checks are complete.
Fresh first independent review task03c1_review_1 passed4.2/5; see
../task03c1-review-1.md. The coordinator's serialized SDK build
and package checks passed for this updated source hash on committed reviewed
foundations6939678 plus the exact four frozen C1 sources. Earlier build/package
receipts cover the archived pre-review snapshot; they do not certify the current
source. Whole Task03 and actual signed-service qualification remain incomplete.

## Changes made

- `src/auth/credentials.ts`: typed browser-safe host credential foundation, official
  reactive binding/session notification, sanitized reactive failure diagnostics,
  current configuration/attempt/closed-client fences, supported clearAuth delivery
  workaround, fresh one-shot HTTP auth and private-fetch header seam.
- `src/auth/index.ts`: exports credential class/getter/request and diagnostic types.
- `src/index.ts`: `fetchAuthToken`, `onAuthError`, reachable constructor-bound
  `cortex.credentials`, and metadata-selector/logout/grant documentation. No model,
  runtime-default, domain-facade or general root-architecture changes.
- `tests/unit/auth/credentials.test.ts`: 40 outcome cases. Reactive error/wire cases
  exercise the actual installed ConvexClient/AuthenticationManager with an inert
  opened WebSocket; HTTP cases exercise actual ConvexHttpClient with supplied fetch.

## Essential review findings and repairs

The reviewer reproduced a paused socket/unhandled rejection when the original direct
throwing getter was passed to Convex1.46 setAuth. The reactive adapter now catches
host/shape/asynchrony failures, returns fail-closed null, and exposes a frozen
`{ code, attemptId }` diagnostic via `authFailure` and optional `onAuthError`.
No raw host error/token/message/stack enters that state. Sync callback throws and
async callback rejections are contained without delaying null/auth resumption.
Standalone `fetchToken`, header and HTTP calls preserve their rejection behavior.

Wire assertions then found that Convex1.46 clears local identity but drops its
Authenticate(None) message while setConfig pauses the socket. The current source
uses public `client.client.hasAuth()/clearAuth()` before explicit reconfiguration,
plus one fenced `setTimeout(...,0)` task from official auth-status false to deliver
clearAuth after promise continuations resume. New configuration/false notifications
cancel older pending tasks; current config/attempt and closed-client guards prevent
clearing a newer identity. Product code does not inspect private library state,
patch Convex, poll or retry a paid/effect operation.

## Requirements checklist

- [x] Installed Convex1.46 callback, static-HTTP and public clearAuth APIs inspected.
- [x] Strong async raw JWT/null host getter attached through official setAuth adapter.
- [x] Refresh options forwarded exactly; explicit session changes force first refresh.
- [x] Non-function/synchronous/malformed/undefined returns fail at the boundary without
  value disclosure. Reactive failures become null plus diagnostics; direct calls reject.
- [x] AuthContext user/tenant/claims do not set auth or manufacture credentials/grants.
- [x] Null/logout/failure clears local and actual wire identity, resumes the transport,
  and later valid notification recovers. Already-paused overlap and stale callbacks
  cannot overwrite latest diagnostics or clear recovered identity.
- [x] Auth-status true does not clear getter errors. Both synchronous and asynchronous
  diagnostic observer failures produce no unhandled rejection.
- [x] Actual constructor path and official server-rejection refresh flow tested using
  an inert WebSocket. No network/model/service calls occur.
- [x] Fresh HTTP setAuth/null clearAuth before one invocation; concurrent isolation;
  malformed/rejected getter causes zero operation/wire/auth writes; errors never retry.
- [x] Private-fetch headers are current and side-effect-free. Task12 owns trusted
  Convex origin/route binding, redirects, storage authorization and byte cap.
- [x] Local logout and private observer cleanup remain distinct from explicit backend
  revocation/deletion of persisted background grants and already dispatched effects.
- [x] Credential module browser graph: one source input, no runtime imports/provider/
  Node/backend modules; strict consumer uses `types: []`, ES2022/DOM only.
- [x] Current source hashes, raw commands and 98-test discovery retained.
- [x] Current SDK build and extracted-package declaration/export verification:
  coordinator ran serially in an isolated reviewed-foundation snapshot; diagnostic
  exports verified. This does not certify concurrent MF repairs or aggregate root quality.
- [x] Fresh first-review final verdict PASS4.2/5 after independent requalification.
- [ ] Aggregate strict root TypeScript/service gates: coordinator integration and03C2.

## Verification

| Current check | Result | Receipt |
|---|---|---|
| Auth Jest selection | PASS:3 suites/98 tests/0 skipped; credential suite40 | `jest-auth-review-freeze.txt`, `test-summary.json` |
| Affected ESLint | PASS:0 warnings/errors | `scoped-lint-review-freeze.txt` |
| Root source lint-project strict TypeScript | PASS | `scoped-types-review-freeze.txt` |
| Browser leaf strict types | PASS | `browser-types-review-freeze.txt` |
| Browser leaf bundle | PASS:1 source input/0 imports | `browser-bundle-review-freeze.txt`, metafile |
| SDK build/standard packed-browser/focused host contracts | PASS on reviewed-foundation snapshot plus exact frozen C1 overlay; npm12.2.0 | `reviewed-snapshot-package-gate.json` and3 reviewed-snapshot logs |

Pre-review strict root `tsc --noEmit` failed in unowned public purge helper/interactive
refs and then-active Task03B endpoint test typing. Those historical raw receipts are
preserved; they are not a current root-green claim. The pre-review root lint exit0
had113 existing warnings. The prior package failure caused by another clean build's
shared-dist overlap was confirmed by the coordinator; a serialized pre-review rebuild
passed. No shared dist build/package command was run during this essential fix.

Executor recorded Node v24.19.0/ambient npm11.9.0/Convex1.46.0; final source checks
invoke Node binaries directly. The coordinator's final build/package checks used
the declared npm12.2.0 with configured credential variables removed. Snapshot
base/overlay/dependency hashes and exact argv are retained. The focused QA runner
initially assumed array-shaped npm pack JSON; npm12 returns a keyed object. It now
uses the canonical runner's array/object handling. Original script/failure preserved
in history/npm12-pack-json-shape; only the failed focused gate reran successfully.
Jest's inert `https://example.convex.cloud` value only satisfies existing setup.
Its managed/graph banner is not service coverage. Synthetic compact strings and
inert protocol messages prove installed transport behavior, not signed identity,
trusted grants or real subscriptions/private bytes/callback authorization. Those
actual-service cases remain03C2/12/13 and the contract handoff describes them.

## Notes for reviewer

Current authoritative files are `contracts.md`, `report.md`, `sourcehashes.json`,
`test-summary.json` and the review-freeze receipts. `*-before-review.*` files and
older command outputs are explicitly historical. Preserve the two failed first
wire assertions in `jest-auth-reactive-fix.txt`; the final passing wire assertions
resolve them without relaxation. The macro-task variant supersedes the earlier
passing two-microtask prototype. No backend/schema/provider/CLI/UI edits, installed
library patch, staging, commits, codegen, deployment, paid calls or agent spawning.
