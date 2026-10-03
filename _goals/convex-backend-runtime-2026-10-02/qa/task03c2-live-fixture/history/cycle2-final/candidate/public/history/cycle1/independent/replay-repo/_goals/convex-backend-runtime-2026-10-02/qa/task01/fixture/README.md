# Task 01 standalone qualification

This private fixture deploys only to the verified disposable **development** target
named by `work/backend-runtime/target.json`. It does not modify the SDK workspace,
production backend/provider or their manifests. Real signed RS256 JWTs qualify auth;
deployment admin credentials only deploy the fixture and never impersonate callers.

From this directory, using Node >=24.15.0:

```sh
npm exec --yes --package=npm@12.2.0 -- npm ci --workspaces=false --ignore-scripts
```

The coordinator must first provide the verified target JSON and its private env file.
Keep these prerequisites in `work/backend-runtime/`; this fixture does not create a
project, select a shared CI deployment or deploy production. Network execution uses
the configured runtime proxy and CA trust; do not unset them.

On a fresh fixture/keypair only, generate the private key in scratch and public auth
config with `npm exec --yes --package=npm@12.2.0 -- npm run keys`. An existing private
key is preserved and causes that command to stop; the checked-in public JWKS must
match its private scratch key. The public data-URI JWKS is supported by Convex Custom
JWT auth. The test signing key and HTTP fixture secret stay mode 0600 in scratch;
tokens are created in memory and never saved in the fixture/evidence.

```sh
npm exec --yes --package=npm@12.2.0 -- npm run deploy
npm exec --yes --package=npm@12.2.0 -- npm run typecheck
npm exec --yes --package=npm@12.2.0 -- npm run check:transport
NODE_USE_ENV_PROXY=1 npm exec --yes --package=npm@12.2.0 -- npm run qualify
```

`deploy` validates isolation/development facts, loads only the coordinator's private
env file, provisions the nonbillable private HTTP effect secret and deploys with
`convex dev --once --env-file ...`. Codegen creates real bindings. The command disables
the CLI's automatic typecheck only because the separate strict fixture typecheck is
required and recorded; this is not a waiver of TypeScript checking. Output is sanitized
before writing `evidence/deploy.txt`. Private deploy values are never printed.

The qualification runner asserts real Gateway structured/native output, real Agent
backend tools, two live WebSocket observers and disconnect/reconnect during a bounded
tool delay, cross-component rollback, committed-final gap reconciliation, deterministic
synthetic stream cursors/cancel/privacy and one real private HTTPS external effect with
forced lost outcome. The private peer is a test effect, not a paid provider interruption.
Every actual Gateway call sets `maxRetries:0`; Workflow action retry is false.

To rerun only a failed/new check, pass its exact name after the script, e.g.
`npm run qualify -- signed-JWT-identity-and-boundary`; the runner replaces only that
check in the persisted matrix. New executions use unique owned request IDs. Output
and JSON evidence distinguish actual Gateway inference from synthetic model traffic
on real managed components. Browser protocol assertions do not certify an interactive
browser; native browser tools were unavailable.

`../contracts.md` freezes the text/run/event/error contracts and the new default
embedding profile. Actual managed default embedding/retrieval remains required before
Task 09 and is not claimed by this text spike. Media/graph/assets/additional profiles
retain their later service gates.

The owned test records and component history are retained on the disposable target
for independent review. They contain generated fixture text only. The coordinator
must clean/retire this fixture before reusing the target for production implementation
of the feature; retaining them is not a promise of permanent storage. No host business
data or shared CI target was touched. No commits/staging are performed by this runner.

Coordinator lifecycle note: after independent PASS, the qualification project was
retired; see ../../qualification-target-retirement.json. The current coordinator
work/backend-runtime/target.json may name a later product integration target.
Reproduction requires a separate verified fresh qualification target and updated
private prerequisite files; never redeploy this spike over product integration.
