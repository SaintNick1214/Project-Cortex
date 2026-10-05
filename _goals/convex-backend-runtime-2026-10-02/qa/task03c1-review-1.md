# Task Judgment: bounded Task03C1 host JWT client plumbing

Fresh read-only judge `task03c1_review_1`: **PASS**, average **4.2/5**.
Coordinator transcription of the native final judgment,2026-10-03.

| Dimension | Score |
| --- | --- |
| Requirement fulfillment | 5/5 |
| Code quality | 4/5 |
| Test quality | 4/5 |
| Pattern adherence | 4/5 |
| Completeness | 4/5 |

All bounded requirements were independently verified: async raw JWT/null getter
and official refresh signature; browser-safe validation without signing/decoding/
cache/logging/claims privilege; metadata does not supply credentials; validation
before transport allocation; actual Cortex constructor binding; one reactive client;
forced session refresh and closed/unbound behavior; contained reactive failures and
frozen sanitized diagnostics; logout/failure removes wire identity; current config/
attempt/closed-client fences; fresh serialized HTTP credentials; invalid/rejected
HTTP getters cause no auth writes/effects; ambiguous effects invoked once; current
private-fetch headers without network effects; documented logout versus grant
revocation; reachable exports/declarations/package wiring; honest frozen evidence.

Independent final evidence:

-3 auth suites,98 outcomes,0 skipped, including40 credential cases.
- Scoped ESLint:0 errors/warnings; source/browser strict types PASS.
- Browser credential leaf:1 input,0 runtime imports.
-53 additional installed-client reactive assertions: wire removal, failure containment,
  sync/async observer errors, resumed transport, logout, recovery and stale fetches.
- Additional HTTP probes: queued failed/malformed getter recovery, fresh headers,
  null clearing and no replay of an ambiguous action.
- Four owned source hashes plus10 dependency/mechanics hashes independently match.
- Coordinator's immutable reviewed-foundation6939678 snapshot plus exact C1 overlay:
  SDK build, standard packed/browser contracts and focused extracted-package contracts
  PASS with npm12.2. Independent declaration/ESM/CJS inspection and actual built
  Cortex failure-binding probes also passed. This does not certify concurrent MF code.

No critical or important bounded finding remains. Two essential defects were fixed
during this first open review: official Convex1.46's unawaited config call allowed
unhandled getter rejection and left the socket paused; its paused null flow removed
local identity but dropped Authenticate(None) on the wire. The final adapter contains
failures and uses public clearAuth plus one canceled/fenced deferred event task.
Both corrections were independently reproduced without real sockets/model calls;
all clients were awaited closed. No polling or client-owned model loop was introduced.

The focused QA runner's npm12 keyed-object JSON incompatibility was corrected with
canonical array/object parsing. Original script/error retained; only that failed gate
reran. Historical failures and superseded receipts remain labeled and preserved.

This verdict certifies the credential foundation, not whole03/current working-tree
integration/managed-service authorization. Signed JWT verification, subscription
isolation, scoped tools, revocation/deletion, uploads/private bytes and connector
callbacks remain03C2/12/13 service gates. Historical root errors in purge consumers
and concurrent endpoint tests remain integration work; runtime/domain facade/model
configuration changes remain09. Private-fetch trusted origins/routes/redirects and
20,000,000-byte cap are explicitly12 responsibilities.

The judge made no repository edits, shared build/pack writes, deployment/model calls,
staging or commits. Recommendation: freeze bounded C1 and preserve its package
receipt; keep whole03 and aggregate integration incomplete.
