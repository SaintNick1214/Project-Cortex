# Isolated authorization qualification candidate

Second offline candidate, repairing all five findings from FINAL REJECT2.6.
No target has been created, deployed, generated or called by this executor.
Fresh independent harness review, parent-owned service execution and a fresh
qualification review are required. Offline checks cannot certify live identity,
transport behavior, whole03, whole09 or UI behavior. The parent also holds service
execution pending a separately reviewed metadata native-error helper follow-up;
this candidate deliberately retains the exact accepted helper bytes.

The only deployed functions are exact accepted copies of runtimeAuth,
runtimeMetadataAuth, immutable, mutable, users and sessions. The exact accepted
schema and runtimeMemorySchema dependency are included; there are no memory/fact,
run, inference, HTTP, storage, tool or connector-callback functions. The fixture
auth registration uses Task01's public inline JWKS, issuer
`https://cortex-qualification.invalid` and audience `cortex-task01`. It reads the
existing parent-trusted0600 RSA file; no signing key is created or rotated.

Source base is signed accepted commit
`4fb3482c5e06fcab12ab8513b242a066ef761f2f`. All backend handler/schema bytes also
equal accepted `c92d548368791386c62f39895e381ef6bde2dc86`. Source and SDK provenance
are independently compared to Git in `evidence/provenance-final.json`.
Generated server/dataModel are copied accepted bindings. No generated API exists
until the parent's actual CLI codegen; it must never be hand-edited.

Use Node>=24.15.0 and npm12.2.0. This preparation uses the installed exact
Convex1.46.0, ws8.21.0, https-proxy-agent7.0.6, TypeScript6.0.3, tsx4.23.15 and
tsup8.5.1. A private SDK archive/build/pack from the accepted commit is under
`work/backend-runtime/task03c2-live-fixture/`; the live runner imports the actual
extracted package. No root dist/package/backend/schema/environment was edited.

## Parent-owned entrypoints

Run commands from `/workspace/Project-Cortex`. The parent must first obtain an
independent read-only PASS for these exact files.

1. `node _goals/convex-backend-runtime-2026-10-02/qa/task03c2-live-fixture/scripts/create.mjs`
   prints the exact project creation request. It makes no service call. The parent
   creates that fresh qualification-auth development/cloud project using its
   trusted service tool, verifies its ID/name/slug/type/origin and records the
   private receipt and environment described below.
2. Set only command-local selectors
   `CORTEX_QUALIFICATION_TARGET_RECEIPT=/workspace/Project-Cortex/work/backend-runtime/task03c2-live-fixture/target.json`
   and
   `CORTEX_QUALIFICATION_DEPLOY_ENV=/workspace/Project-Cortex/work/backend-runtime/task03c2-live-fixture/deploy.env`.
3. `node _goals/convex-backend-runtime-2026-10-02/qa/task03c2-live-fixture/scripts/deploy.mjs deploy`
   invokes guarded official `convex dev --once --codegen disable --typecheck enable --tail-logs disable --env-file <private path>`.
4. `node _goals/convex-backend-runtime-2026-10-02/qa/task03c2-live-fixture/scripts/deploy.mjs codegen`
   invokes the same guarded dev command with `--codegen enable`. Convex1.46's
   standalone `codegen` has no `--env-file`; this entrypoint also synchronizes the
   exact fixture deployment. Inspect authentic generated API/server/dataModel and
   source preservation after this command; no `--init` or unrelated backend is used.
5. `node _goals/convex-backend-runtime-2026-10-02/qa/task03c2-live-fixture/scripts/qualify.mjs`
   runs real ConvexHttpClient, ConvexClient and packed Cortex/HostCredentials
   cases. A process-local real ws constructor carries the qualified proxy/CA
   setup and rejects other origins. A trusted driver owns private preflight,
   deployment environment, existing RSA/signing, official operator CLI, the full
   41-case ledger and evidence. The child receives only qualified endpoint,
   JWTs and test references through an exact bounded IPC protocol, with a minimal
   proxy/CA environment. It never imports the guard/operator/driver or reads the
   private key/environment/target. This is a code/import/env/IPC boundary on a
   shared same-UID filesystem, not an OS sandbox. No fetch/provider/transport
   mocks certify live outcomes.
6. `node _goals/convex-backend-runtime-2026-10-02/qa/task03c2-live-fixture/scripts/cleanup.mjs owned-<qualification run UUID>.json`
   validates the private ownership ledger and tombstones only its owned scopes
   and known principals. Attempted scopes are journaled before provisioning so
   partial provisioning is also fenced; unknown partially created principal IDs
   require exact project retirement. It never invokes global purge. The parent then retires/deletes
   the exact qualification project with its trusted tool and records observed
   retirement. Tombstones remain until project deletion; no unrelated data is removed.

Each live invocation first validates canonical paths, prior immutable QA hashes,
accepted source/SDK hashes, private modes/ownership, project purpose/name/slug,
positive verified project ID, active/dev/cloud flags, matching origin and exact
development key/selector/URL. It rejects aliases, hardlinks, old Task01 targets,
retired/deleted/shared/production/product targets, alternative selectors and
unexpected private environment variables. A key or URL alone never grants permission.
Evidence is append-only: each live result gets a new UUID filename and exclusive
creation. Raw CLI/server/callback messages, tokens and data payloads are discarded;
only allowlisted statuses/counters/codes are saved. Operator denial checks require
an exact official function-invocation envelope, server request marker and parsed
accepted ConvexError FORBIDDEN payload. Network/timeout/CLI/env-file permission
errors cannot become negative PASS. Diagnostics remain in memory. The strict
parser's live compatibility remains unexecuted; unfamiliar diagnostics fail
closed as operator unavailability.

SDK and operator subprocesses use owned Linux process groups. The driver waits
for its direct children, kills remaining group descendants and finalizes a
41-case append-only receipt after crashes, SIGKILLs and hangs of the SDK child.
Container init may retain a defunct orphan grandchild; the offline check proves
no owned grandchild remains running. If reaping fails the receipt is FAIL.
Final qualification evidence uses its initially guarded output binding, never a
second private/target preflight that could lose the crash receipt after shutdown.

## Required private files

The parent creates `target.json` and `deploy.env` under the existing owned0700
scratch directory, each an unlinked regular owned0600 file. The receipt copies
the exact fields in `project-request.json` and adds the following observed fields:

```json
{
  "projectId": 123,
  "deploymentName": "actual-fresh-name",
  "deploymentUrl": "https://actual-fresh-name.convex.cloud",
  "active": true,
  "retired": false,
  "deleted": false,
  "isolationVerified": true,
  "createdAt": "actual UTC creation time",
  "privateEnvironmentFile": "work/backend-runtime/task03c2-live-fixture/deploy.env"
}
```

The private environment contains exactly `CONVEX_DEPLOY_KEY=dev:<name>|<secret>`,
`CONVEX_DEPLOYMENT=dev:<name>` and `CONVEX_URL=https://<name>.convex.cloud`.
Inherited mismatched selectors are rejected; do not rewrite the repository/global
environment. The operator uses the verified official `convex run <internal name>
<fixture-owned control JSON> --env-file <private path>` contract. No secret appears
in command arguments, and internal worker references are never attached to the SDK.

## Offline replay and limits

`scripts/guard-check.mjs` contains37 discovered rejection cases and zero post-guard
network/subprocess/output attempts. `scripts/client-prep.ts` contains6 offline
assertions, kept unchanged; its fake transport is explicitly confined to proving zero maintenance
dispatch and zero invalid-credential operation callbacks. The fixture backend is
checked with its unchanged accepted ES2021/DOM tsconfig; the client has a separate
ES2022 Node client config. `scripts/packed-prep.mjs` repeats six meaningful checks
against the actual extracted packed exports. `scripts/classifier-check.mjs`
has28 official-contract positive/lookalike controls; `scripts/driver-check.mjs`
has35 environment/import/IPC/process/receipt assertions, including actual SDK
child filesystem/key-value/network interceptions. Fake operator/sign values
exist only in explicitly labeled OFFLINE probes and cannot certify live
security. The live driver hardcodes live phase and invokes the real guarded
operator and trusted signer. `scripts/bounds-check.mjs` checks72 service/shutdown
calls plus four configured ceilings. Each replay receipt lists discovered/skipped
cases and UTC commands in `evidence/cycle2/commands-final2.json`.
`evidence/initial-failures.json` retains corrected
invocation/type/class-identity/archive-inventory failures. Installed dependency
directories are excluded from archived source/evidence preservation; their versions
are separately pinned, and the original overbroad inventory remains in private scratch.
The rejected first freeze/judgment/raw receipts are byte-exact under
`history/cycle1/`, including280 preserved records; the original199 reproducible
accepted SDK build/pack files remain private and unchanged. All107 old QA files
are unchanged. Second-cycle initial failures and every replay raw output remain
under `evidence/cycle2/`. Actual house lint reports0 errors/21 accepted-source
warnings; the private selector applying existing backend rules reports0 warnings.

The live matrix is `service-outcomes.json`, with every outcome UNEXECUTED. Runs
have12-second observation/request bounds,25-second operator bounds, a750ms quiet
window and a10-minute driver ceiling; deployment/codegen has a separate120s
owned CLI bound and cleanup has a10-minute ceiling with25s per operator call.
All41 cases live in the trusted driver's ledger before the SDK child starts.
Setup/operator availability becomes BLOCKED; failed foundational metadata/session
or scope setup blocks its dependents, while actual assertions/service failures
are FAIL. SDK logout and late credentials first require exact authorized values
41/42, then fence with null, apply an independently authenticated owned write to
42/43 and require zero delivery changes for750ms. Only numeric values, delivery
counts and the payload-field allowlist are recorded; watchers stop and clients
close. A
bounded quiet window establishes only observed nondelivery during that window.
Ordinary host logout clears transport identity; trusted background references still
work until explicit grant/principal/membership/scope revocation or session ending.
Automatic maintenance, canonical transcripts/runs, actual tools/private bytes,
uploads/assets and connector callbacks remain pending in Tasks05/12/13.
