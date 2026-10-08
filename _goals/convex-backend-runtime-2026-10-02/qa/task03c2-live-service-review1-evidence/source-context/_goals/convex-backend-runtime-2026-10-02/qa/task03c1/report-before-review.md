# Task03C1 completion report

## Status: COMPLETE — bounded client foundation

The implementation and local transport/package/browser checks are complete.
Whole Task03, independent review, real signed-service qualification and the aggregate
strict root TypeScript gate remain pending. Aggregate code-quality verdict is
INCOMPLETE because the observed root `tsc --noEmit` fails in unowned integration files.

## Changes made

- `src/auth/credentials.ts`: browser-safe typed host JWT getter, raw result validation,
  official reactive binding/session notification, fresh one-shot HTTP auth and private
  fetch header seam. No token cache, decoded privilege, logging or operation retry.
- `src/auth/index.ts`: exports credential class and request/getter types.
- `src/index.ts`: adds `fetchAuthToken`, constructor binding and reachable
  `cortex.credentials`; clarifies `auth` metadata selectors and logout/grant semantics.
  No model configuration, domain facade, runtime defaults or architecture changes.
- `tests/unit/auth/credentials.test.ts`: 31 outcome tests including actual installed
  ConvexHttpClient bearer requests, narrowly mocked ConvexClient constructor binding,
  refresh/logout/login/identity replacement, invalid/rejected getters, error non-retry,
  concurrent HTTP isolation and closed/unbound/multiple-reactive-binding behavior.
- `qa/task03c1/contracts.md`: exact public API, trusted-origin/byte handoff for12,
  observer lifecycle handoff for09 and remaining actual-service cases for03C2.

## Requirements checklist

- [x] Installed Convex 1.46.0 callback/static-HTTP signatures inspected.
- [x] Async raw JWT/null host getter exported and attached through official setAuth.
- [x] Ordinary callback refresh options forwarded exactly; session-change first fetch
  forces refresh. Changing JWT values and null are observed by transport tests.
- [x] Non-function/synchronous/malformed/undefined getter results fail without value
  disclosure. Rejections propagate; invalid/rejected HTTP getters perform no auth
  writes, invocation or wire request.
- [x] AuthContext user/tenant/claims never invokes setAuth or manufactures credentials.
- [x] HTTP attaches the fresh current token before each invocation, clears on null,
  serializes a dedicated shared client and never retries an ambiguous operation.
- [x] Header seam gets a fresh credential without performing arbitrary fetches;
  trusted Convex route/origin binding and response limits are explicit Task12 work.
- [x] Logout transport identity, observer cleanup and durable grant revocation are
  distinguished. No local logout claims to stop already dispatched background work.
- [x] Actual public constructor/config path is tested; root ESM/CJS exports and
  declarations include credential types/class. Browser leaf has no runtime imports.
- [x] Exact source hashes, discovery/counts and raw command receipts retained.
- [ ] Aggregate strict root TypeScript: unowned public-purge helper/interactive refs
  and ongoing Task03B endpoint test typing fail. No assertions weakened or foreign
  files repaired. See `root-typecheck-final.txt` for the exact observed state.
- [ ] Actual managed JWT/subscription/tool/private-byte/callback authorization outcomes:
  Task03C2 after03B/12/13, outside this bounded plumbing scope.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Selected auth Jest suites | PASS: 3 suites, 89 tests, 0 skipped; new suite31 tests | `jest-auth-final.txt`, `test-summary.json` |
| Affected ESLint | PASS: zero warnings/errors | `scoped-lint-final.txt` |
| Root lint script | PASS exit0;113 existing warnings,0 errors | `root-lint-final.txt` |
| Root strict `tsc --noEmit` | FAIL in unowned integration refs; no credential/root-auth/test errors | `root-typecheck-final.txt` |
| Browser leaf strict types | PASS with `types: []`, ES2022/DOM only | `browser-typecheck-final.txt`, retained browser consumer/config |
| Browser leaf bundle | PASS: only `src/auth/credentials.ts`, zero imports | `browser-metafile-final.json`, `browser-bundle-final.txt` |
| Coherent SDK ESM/CJS + declarations build | PASS after serialized rebuild | `build-coherent.txt` |
| Packed standard public/browser contracts | PASS after serialized rebuild | `public-contracts-coherent.txt` |
| Focused extracted-package credential API/types | PASS; actual ESM/CJS exports + strict getter/config negative types | `public-host-contract-packed.txt`, retained runner |

The first final packed-contract attempt failed because a second SDK build cleaned
`dist` during the check. The parent confirmed the Task02B build overlap and serialized
the remaining output window. That failed receipt is preserved as
`public-contracts-final.txt`; a coherent SDK rebuild and subsequent package checks
passed. This was an output ownership race, not a source/type repair. No shared
package build remains running when this bounded task returns.

Node v24.19.0 and installed npm11.9.0 were used; the manifest declares npm12.2.0.
No installation/dependency/manifest changes were made. Jest used the inert explicit
`https://example.convex.cloud` environment value to satisfy existing setup. The
reactive constructor was mocked and the actual HTTP client's fetch was supplied by
the test fixture; no service or model calls were made. Standard setup's managed/graph
banner is not service-coverage evidence. Synthetic compact strings are documented
transport fixtures, not signed JWT qualification.

## Notes for reviewer

Use `contracts.md`, `sourcehashes.json`, `command-receipts.json` and the raw outputs.
The source hash freeze covers the four owned source/test files plus credential
exports/manifests and installed Convex API definitions. Independent judgment is
owned by the coordinator. No backend/schema/CLI/provider/UI/deployment changes,
staging, commits, package publication, paid calls or agent spawning occurred here.
All unrelated dirty Task01/Task02/Task03B work was preserved.
