# K11 actual SDK authentication diagnosis

Overall exact-code gate **FAILS**: expired valid signature returns AUTHENTICATION_TIMEOUT at4002.110709ms with the original4000ms auth deadline, rather than required UNAUTHENTICATED. Invalid signature returns UNAUTHENTICATED at1568.996125ms and passes its unchanged expected-code gate. Both negatives deliver0protected payloads and start0runtime RPCs. Original K9 two failures remain historical FAIL, not rewritten or inferred repaired by this successor target.

Valid owner metadata control passes at2447.542916ms: official auth callback true, SDK callback true, original session/profile metadata delivered. Only original read-only session/defaultProfile mutation handlers were called. Existing grants/data/finance complete bounded before/after snapshots are exactly unchanged.107fresh management GET identity verifications, zero paid calls/effectful mutations.

For expired signed token, official Logger sees two socket opens/closes/reconnects but no observed native AuthError, no forceRefresh callback and no official onAuthChange boolean. The SDK's false callback follows its bounded timeout. This is not proof there was no server rejection: raw close reasons/AuthError fields/protocol payloads were not retained, and the public diagnostic metadata cannot establish the exact verifier cause. No product fix or deadline extension follows from this incomplete cause evidence.

For invalid signature, native AuthError is observed once, followed by reauthentication_attempt, forceRefresh once with the same case token, reauthentication_no_new_token and official false callback. The unchanged SDK surfaces UNAUTHENTICATED. This is actual supported official callback/manager-path evidence on K11; it does not explain K9's different timeout or accept an HTTP error as SDK success.

All three SDK instances and all supplied official ConvexClient instances completed bounded finally cleanup; process exited1 with no outstanding client and root was notified before resuming CLI. Relative event timestamps use one process monotonic origin.2.111ms timer scheduling overrun is an observed elapsed, not an increased deadline.

The initial frozen-helper invocation exited1 before constructing clients: missing NEWkit/image-id.txt. Its saved162-byte error hash exactly matches local ENOENT. Root then created the new genuine pin only after fresh actual Docker identity inspection and authorized one unchanged-helper successor. That original guard refusal remains preserved; no assertions/interfaces/pins were weakened and no unchanged failure was blindly repeated.

Actual successor receipt: k11-auth-diagnostic-readonly-1791918994318-b52ac287-7f1c-4fcc-8852-89f03e0ecf41.json

SHA-256: 64e3ec9fb90e0b5829db0ec9c98d1a3a54e92774fd8a1ca800f4556a0582d300

Frozen helper SHA-256: 7d378a7ad393d5d88f74ee885cac3f1339f0db643cb2117be2aeea27c14edce5

No further live reads or retries were performed after closure. Outcome JSON projects only scalar/code/hash/boolean/counter evidence; no tokens, server error strings, prompt/output/fact/vector payloads are saved here.
