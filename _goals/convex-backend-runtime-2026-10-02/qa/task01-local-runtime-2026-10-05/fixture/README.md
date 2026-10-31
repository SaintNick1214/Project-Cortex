# Fresh Task01 applicability fixture — local runtime preparation

This directory contains a small copy of the accepted current Task01 fixture and its
security followup. Original source/evidence in `../../task01/` and
`../../task01-security/` remain unchanged. This preparation qualifies credential-free
checks only. It has created no project, deployment, remote records or paid inference.

The fresh lock uses the exact relevant entries and Node-resolution topology of the
repository root lock: AI SDK 7.0.127, Convex 1.46.0, Gateway provider 0.2.1, Agent
0.7.3, Workflow 0.4.8, Workpool 0.4.13, ws 8.21.0 and Zod 4.6.5. Zod was 4.4.3
in the accepted fixture. Older Gateway-internal provider versions are nested exactly
as in the root lock; newer root-level Anthropic/OpenAI packages for other consumers
are outside this fixture's relevant closure. Root manifests are unchanged.

Use the prepared Node 24.15.0/npm 12.2.0 toolchain for every command:

```sh
export PATH='/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin':"$PATH"
umask 077
npm ci --workspaces=false --ignore-scripts --no-audit --no-fund
npm run typecheck
npm run check:transport
node scripts/paths-check.mjs
node scripts/ordering-check.mjs
node scripts/keys-check.mjs
node scripts/transpile-check.mjs
```

From the parent directory, `node scripts/check-quality.mjs` applies the root's scoped
fixture lint rules with only the QA ignore/project path adapted, checks syntax, and
compares installed packages and exact relevant lock entries. Install scripts remain
disabled; the installed optional esbuild platform binary worked for the real browser
bundle. Native interactive browser coverage is unexecuted. The real AI SDK decoder
and browser bundle checks are offline protocol evidence.

`../evidence/source-inventory.json` records accepted/current hashes and substitutions.
`../evidence/preservation.json` verifies original Task01/security files and relevant
root/product receipt files against their preparation baseline. Existing source,
assertions and deadlines for the ten live checks are retained; this fresh fixture
has no `live-receipts.json` or `gateway-chat.json` yet.
The output guard protects both full frozen trees and confines evidence overrides
to this fresh owned QA folder or its prescribed private test scratch directory.

The newly prepared RS256 private key stays in the ignored directory
`/Users/SaintNick/.codex/tmp/cortex-runtime-task01-private-20261005/`, mode 0600.
Its matching public JWKS is in `convex/auth.config.ts`. The exclusive generator must
not overwrite this key or public configuration. JWTs are created only in memory when
the later live runner is invoked. The private HTTP effect secret remains unprovisioned.

Before any real run, the coordinator must independently approve the prepared source
and verify a separate fresh owned qualification-purpose cloud **development** target.
A receipt must establish operation `create-disposable-development-target`, purpose
`qualification` or `qualification-security`, matching qualification project name/slug,
positive project ID, exact deployment name/HTTPS origin, isolationVerified true,
productionDeployment false, sharedCiTarget false, and active/unretired status.
Generic product integration receipts, archived original deployment efficient-ox-979,
production/shared targets and mismatched deployment selectors are rejected.

The receipt must name an absolute private env file in the owned ignored directory;
its deploy key must select exactly `dev:<verified deployment name>`. Set these values
without printing any key/token or copying the env file into this fixture:

```sh
export CORTEX_QUALIFICATION_TARGET_RECEIPT='<absolute verified fresh public receipt>'
export CORTEX_QUALIFICATION_DEPLOY_ENV='/Users/SaintNick/.codex/tmp/cortex-runtime-task01-private-20261005/deploy.env'
export CORTEX_QUALIFICATION_EVIDENCE_DIR='<absolute fresh evidence directory>'
export CORTEX_QUALIFICATION_EFFECT_SECRET_FILE='/Users/SaintNick/.codex/tmp/cortex-runtime-task01-private-20261005/effect-secret.txt'
```

The commands below have **not** been executed during preparation. Once independent
preparation and target checks pass, the coordinator can provision the owned private
peer secret, deploy this fixture using existing generated bindings, then rerun all
original core checks and the separate actual Chat probe:

```sh
node scripts/effect-secret.mjs
npm run deploy
NODE_USE_ENV_PROXY=1 npm run qualify
NODE_USE_ENV_PROXY=1 node scripts/gateway-check.mjs
```

Gateway access/eligibility, effective target/env and current deployed bindings must
be observed; credentials or local compilation do not establish service compatibility.
Keep actual Gateway/tool/WebSocket results separate from synthetic model traffic on
managed components. The interrupted private HTTPS peer is a deterministic external
effect test, not a forcibly killed paid provider call. Inference retries stay zero;
Workflow action retries stay disabled. Preserve raw failures and rerun only a distinct
corrected source/check when appropriate.

The authoritative versioned contracts remain `../../task01/contracts.md`; no embedding,
private asset, media, graph, product API or interactive UI qualification is added here.
Messages remains unqualified; the Responses probe is explicit. Managed default-profile
embedding/retrieval remains required before Task09. This bounded fixture's single-final
reconciler, cancellation-failure reporting and late-cancel coverage retain the original
production/downstream requirements in `../../task01-review-1.md`.

The full current-source structured/native/atomic/reconciliation/HTTP-effect suite was
not rerun by the accepted security followup. Current applicability remains incomplete
until the fresh actual service run passes and an independent judge reviews its raw
receipts and source provenance. Retire the fresh target after review; do not reuse it
for product integration.
