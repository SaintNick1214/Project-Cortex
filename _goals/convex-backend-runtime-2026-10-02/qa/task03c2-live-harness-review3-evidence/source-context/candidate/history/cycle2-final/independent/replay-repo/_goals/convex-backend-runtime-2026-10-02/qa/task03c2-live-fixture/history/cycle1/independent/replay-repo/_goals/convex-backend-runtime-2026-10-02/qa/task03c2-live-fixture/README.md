# Isolated authorization qualification candidate

Preparation only. No target has been created, deployed, generated or called by
this executor. Independent harness review, parent-owned service execution and a
fresh qualification review are required. Offline checks cannot certify live
identity/transport behavior, whole03, whole09 or UI behavior.

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
   setup and rejects other origins. The child receives no upstream/model key or
   deploy key. No fetch/provider/transport mocks certify live outcomes.
6. `node _goals/convex-backend-runtime-2026-10-02/qa/task03c2-live-fixture/scripts/cleanup.mjs owned-<qualification run UUID>.json`
   validates the private ownership ledger and tombstones only its owned scopes
   and principals. It never invokes global purge. The parent then retires/deletes
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
an actual accepted authorization-denial diagnostic; network/timeout/CLI errors
cannot become successful negative outcomes.

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
assertions; its fake transport is explicitly confined to proving zero maintenance
dispatch and zero invalid-credential operation callbacks. The fixture backend is
checked with its unchanged accepted ES2021/DOM tsconfig; the client has a separate
ES2022 Node client config. `evidence/initial-failures.json` retains corrected
invocation/type/class-identity/archive-inventory failures. Installed dependency
directories are excluded from archived source/evidence preservation; their versions
are separately pinned, and the original overbroad inventory remains in private scratch.

The live matrix is `service-outcomes.json`, with every outcome UNEXECUTED. Runs
have12-second observation/request bounds,25-second operator bounds, a750ms quiet
window and a10-minute process ceiling. All discovered cases remain in receipts;
setup/dependency failures become BLOCKED, assertion/service failures FAIL. A
bounded quiet window establishes only observed nondelivery during that window.
Ordinary host logout clears transport identity; trusted background references still
work until explicit grant/principal/membership/scope revocation or session ending.
Automatic maintenance, canonical transcripts/runs, actual tools/private bytes,
uploads/assets and connector callbacks remain pending in Tasks05/12/13.
