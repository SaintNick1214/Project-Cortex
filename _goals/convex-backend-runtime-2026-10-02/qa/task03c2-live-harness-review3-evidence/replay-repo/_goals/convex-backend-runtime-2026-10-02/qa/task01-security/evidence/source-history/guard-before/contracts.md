# Task 01 security followup contract

This followup changes only the standalone qualification fixture's direct WebSocket
polyfill and runner safety. The original Task01 10-check matrix and independent PASS
(4.2/5) remain historical evidence for the unchanged core stack. They do not certify
the patched source by themselves. Fresh affected checks are saved separately here.

`ws` is pinned exactly to **8.21.0**, fixing the HIGH CVE-2026-48779 and MEDIUM
CVE-2026-45736 reports for the former direct8.18.3. npm12.2.0 regenerated the fixture
lock; its existing nested Convex8.21.0 copy deduplicated to the patched direct copy.
AI7.0.127, Convex1.46.0, Gateway provider0.2.1, Agent0.7.3, Workflow0.4.8 and
Workpool0.4.13 remain unchanged. No root product manifest/lock update is included.

Two additional CI findings are fixed within the bounded followup. The private key
generator creates the key with exclusive `flag:"wx"` and mode0600, rather than a
check-then-write race. Concurrent isolated generation proves exactly one winner,
matching public JWKS, rejected loser/repeat and no overwrite; temporary private keys
are created only under private scratch and removed. The real signing key/public JWKS
is unchanged. The old generator source is retained in evidence/source-history/.
The fixture Gateway file's unused `import type { Id }` is removed for lint;
transpileModule proves generated JavaScript before/after byte-identical. This erased
type-only change is preserved/documented separately and requires no paid repetition.
The parent adds an ESLint mapping to the standalone fixture's actual tsconfig, keeping
its TypeScript sources parsed/checked. Scanner suppression is not used.

## Explicit target and credential selection

Live runner prerequisites:

- `CORTEX_QUALIFICATION_TARGET_RECEIPT`: absolute public receipt path; required.
- `CORTEX_QUALIFICATION_DEPLOY_ENV`: absolute private deployment env path; required
  for deployment, matched to the receipt before CLI execution. Signed caller clients
  use the target receipt and their existing private test JWT key, not deploy credentials.
- `CORTEX_QUALIFICATION_EVIDENCE_DIR`: optional fresh output directory; default is
  this followup's evidence directory. Original Task01 evidence directories are rejected.

No runner reads generic `work/backend-runtime/target.json` as a target fallback.
The receipt must assert operation/create-disposable-development-target,
purpose/qualification or qualification-security, exact qualification project slug/name,
isolationVerified/true, dev/cloud, productionDeployment/false, sharedCiTarget/false,
positive project ID and agreeing HTTPS deployment URL/name. Retired/deleted records
are rejected. The original efficient-ox-979 target is explicitly retired and rejected.
The product integration target limitless-chameleon-209 is forbidden for this fixture.

Deployment separately validates the private env file path matches the verified
receipt, its key names this exact dev deployment and any URL/deployment selectors
agree. Explicit env values override inherited selectors. Credential values are never
written into QA or printed. Deployment uses existing generated bindings with codegen
disabled, preserving the unchanged component source/binding provenance. Scoped
transport checks do not invoke the HTTP effect spike, so no new peer effect secret is
provisioned. The existing RS256 test key/JWKS is retained; no admin impersonation.

The full unselected qualification runner still includes the interrupted HTTP peer
effect. Reproducing that full route on an explicitly verified qualification target
requires a separate private setup: set `CORTEX_QUALIFICATION_EFFECT_SECRET_FILE` to
an absolute path under `work/backend-runtime/task01-security/`, then explicitly run
`node scripts/effect-secret.mjs`. It generates/reuses a mode0600 256-bit secret and
sets only that qualification deployment's `QUALIFICATION_EFFECT_SECRET`; its logs
are sanitized. After setup, `npm run qualify` without selectors runs the full suite
and records fresh outcomes. This optional command is not executed for the security
transport followup. No full-suite current-source certification is inferred from the
three scoped checks or the archived matrix.

## Scoped current-source evidence

Required fresh live checks:

- `live-Gateway-tool-disconnect-multiple-observers-no-replay`: actual paid Gateway
  Agent/tool execution; two real WebSocket observers, disconnect/reconnect while
  work runs; one attempt/effect/final ingestion receipt and identical canonical IDs.
- `persisted-Agent-stream-multiple-observers-reconnect`: synthetic slow model on
  real managed Agent/Workflow/Convex, persisted cursor replay and reasoning privacy.
- `persisted-Agent-stream-cancellation`: synthetic slow model on real managed
  components, durable cancel/aborted stream/no replay/no final receipt.

AI SDK7 UI text/tool/cancel decoding, offline strict TypeScript and browser-only bundle
checks also run against the patched fixture. New live receipt includes actual ws
version and current lock hash. Partial selection creates a new matrix rather than
merging old target receipts; a mismatched evidence deployment is rejected. Unknown
check names fail before any action. No model retry, fallback, unrelated paid call or
repeat of unaffected structured/native/component service checks is required here.
Native interactive browser evidence remains unavailable and unclaimed.

The coordinator provisions/deploys the separate verified qualification-security
target and explicitly authorizes the scoped live runner afterward. No product target,
production deployment, other agent source, staging or commits are in scope.
