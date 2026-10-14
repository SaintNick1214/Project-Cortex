# Bounded authoritative authentication refusal

Repository: SaintNick1214/Project-Cortex. This is source and controlled-test evidence only; new native qualification is pending.

The K20 official WebSocket client silently closed expired/invalid-token connections without an authentication callback. Cortex therefore reported the existing finite AUTHENTICATION_TIMEOUT. K22 official HTTP independently refused those same classes with401. Historical WebSocket causes and failures remain unchanged.

The SDK now starts one cancellable HTTP session check alongside a pending owned/official connection handshake. Custom borrowed transports enable this check by supplying the existing fetch port. It uses the same opaque token and deployment origin, prohibits redirects, and reads the existing session handler. Only401 or the official structured UNAUTHENTICATED refusal can reject authentication. Successful HTTP bodies cannot accept authentication; official WebSocket acceptance remains required. Other errors and silence retain the original deadline/error. The check performs no inference or operation retry.

The deployment origin, fetch port and opt-in flag are immutable constructor snapshots. Undefined-token fetches retain the original finite WebSocket outcome. The check is fenced by client generation and token-probe sequence, and aborts on acceptance, rejection, timeout, refresh, token replacement or close. Borrowed-client ownership is preserved. All61 other original client method bodies are byte-identical, including every fresh post-I/O session, source/grant, expiry and delivery check.

Controlled coverage:281/281 tests across9files,0skipped, counting the latest receipt perfile without duplicate reruns. Scopelint exited0 with11 existing client warnings; the new helper warning was corrected with an own-property unknown-value guard. Shared root/backend/lint types, scoped lint, SDK build and actual packed public contracts exited0. One joint independent source/test/docs review remains pending. Native expired/invalid JWT tests, full affected service outcomes and subsecond latency are not qualified by these fixtures.

The original shared type failure at client.ts150 is preserved. A string guard now narrows the optional fetched token before the denial probe; the combined shared check passed the corrected source.
