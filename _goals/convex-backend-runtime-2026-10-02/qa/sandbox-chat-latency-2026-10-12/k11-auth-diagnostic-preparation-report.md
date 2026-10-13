# K11 authentication diagnosis helper — prepared, not executed live

The original K9 expected-code gate remains FAIL: expired valid signature and invalid signature returned AUTHENTICATION_TIMEOUT with configured4000ms auth deadline instead of asserted UNAUTHENTICATED. The original K9 receipts/scripts are unchanged. No correction to product authentication, client JWT parsing, caching, retry policy, deadline or expected assertion is proposed or implied by this preparation.

Helper: k11-auth-diagnostic-readonly.mjs

SHA-256: 7d378a7ad393d5d88f74ee885cac3f1339f0db643cb2117be2aeea27c14edce5

Only Q helper/test/report/check/primary metadata files were written. Syntax, public help and six pure logger/privacy/argument tests pass with Node24.15.0; zero failed/skipped/cancelled/todo. Actual SDK/Convex authentication remains unexecuted until root supplies the exact new K11 READY identity and authorizes reads after the text measurement quiet window. The pure tests are not a synthetic native-auth proof.

The helper imports actual installed packaged SDK0.39.0 and its official Convex1.46.0. It verifies installed SDK entry bytes against the exact staged immutable source, SDK archive SHA, archives manifest SHA, source commit and image. Exact SESSION/NAME/ID/team325340/project3200658/dev reference/finite expiry/nondefault cloud identity are freshly management-GET verified before and after every table/protected operation. READY journal path/owner/permissions/launcher PID are checked. Proofs persistence/receipts are disabled; no key creation, Docker command, service create, deployment, model invocation or inference occurs. Existing private owner signing/deploy material is held in memory and never copied.

Root explicitly authorized the only two supported SDK read-only native registrations: runtimeClient:session and runtimeMemory:defaultProfile. They are **registered mutations whose original handlers only read metadata**. Public SDK session/profile calls use those exact original paths. The port refuses every other mutation, all actions and arbitrary queries, and keeps current selector keys exact. Native table snapshots are existing admin _system/cli/tableData queries only, each bounded to a complete256-row page; unknown/overflow refuses rather than silently skipping. Before/after grants/data/finance counts and hashes must match for a PASS. No protected prompts/answer/fact strings/vectors are retained. A metadata positive owner control is optional; recommended1 for transport confirmation.

Each negative uses one constant owner JWT minted with the original K9 fixture shape: signed expiry60seconds in the past, or first signature character changed. Official forceRefresh returns the same token for that case, matching original K9 supplied-JWT behavior; no fallback token or paid retry. Public Convex Logger and public setAuth callbacks are observed and forwarded, not replaced. The supported socket logger exposes the fixed AuthError message type; metadata distinguishes native receipt, manager ignore/retry/no-new-token/confirmed paths, forceRefresh counts, official auth booleans and SDK auth booleans. Logger arguments, dynamic error text and auth-state JSON/token suffix are discarded. Only known classifications, monotonic relative ms, error code/hash/byte count and payload delivery0/1 are saved. Events are capped256. Original auth deadline4000ms remains; protective session call wall watchdog also4000ms and request RPC timeout4000ms. Optional profile uses separately bounded original metadata calls after confirmed auth.

The helper always closes the supplied SDK and official ConvexClient with a bounded cleanup in finally. Native callbacks after the local operation deadline, if observed during close, retain their own relative event times; they do not retroactively turn a timeout into UNAUTHENTICATED. Any unknown diagnostic/closure/data drift or new exact-code failure is preserved in a unique successor receipt with FAIL. HTTP auth rejection cannot satisfy an SDK assertion.

Current immutable local candidate source acf3b5efa4d1d3b798fa655b0db919cf6baf7f40; archives manifest SHA 968dece5b545d48df507d7a13b811e9c556154265e7baaa7c94f3b2a555992d1; SDK archive SHA d2e698c62ee7b0e762f08fa59d706f72fb71133e1b40e4451b03e59feb743fb9. Image pin must be supplied by root after actual image build; no placeholder can start the helper. These pins must also match the supplied exact new READY target.

Invoke only after root authorizes the exact K11 target:

```sh
/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin/node \
  /Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/k11-auth-diagnostic-readonly.mjs \
  --session "$K11_SESSION" --name "$K11_NAME" --id "$K11_ID" --expires-at "$K11_EXPIRES_AT" \
  --source-commit acf3b5efa4d1d3b798fa655b0db919cf6baf7f40 --manifest-sha256 968dece5b545d48df507d7a13b811e9c556154265e7baaa7c94f3b2a555992d1 \
  --sdk-archive-sha256 d2e698c62ee7b0e762f08fa59d706f72fb71133e1b40e4451b03e59feb743fb9 --image-id "$K11_IMAGE_ID" --owner-control 1
```

Missing/wrong pins/READY state refuse. No current target was read in preparation. Receipt filename is k11-auth-diagnostic-readonly-epoch-uuid.json under Q, exclusive creation; all original receipts remain.

Limitations: public Logger exposes message type and auth manager state transitions, not raw AuthError authUpdateAttempted/baseVersion/error fields or exact server verifier implementation. A missing native AuthError log is unavailable evidence rather than proof no rejection happened. The helper will identify whether official callback, forceRefresh or ignored/retry path was observed before the SDK deadline; it cannot claim a specific backend JWT-verifier cause not exposed by those metadata. Library source version/hash applicability is checked before running. No blind product repair is justified until actual successor metadata is observed.

Privacy test SHA 203dadd1f9ed8afbca0b0bb5b69112acf41b3517b573205f01fec550f96a2c01

Local checks SHA 9c286c55b83f6aac1a5f226760be7221590c3d6cf842cf25a575fe36175957ea

Primary contracts SHA a9bee236ee198bfeb080d37f7078352bcfb01596cccc2b4494af877838177ceb
