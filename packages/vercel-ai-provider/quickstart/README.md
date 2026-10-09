# Cortex Memory + Vercel AI SDK Quickstart

A Next.js 16/AI SDK 7 demo of streaming chat, memory-layer visualization, fact extraction and recall. Application 1.2.0 uses SDK/provider 0.38.0.

## Quick start

Use Node.js 24.15.0 or newer for the Cortex CLI workflow and npm for this application.

```bash
cortex templates init demo --template vercel-ai-quickstart --template-version 1.2.0 --catalog-version 1.1.0 --yes --graph none
cd demo
cp .env.local.example .env.local
```

The independently versioned catalog assembles the recognized app/SDK schema, app namespace and internal operation registrations. Do not replace this backend with public SDK handlers or overwrite app/custom schema files. Configure your own selected Convex deployment and run native setup/codegen:

```bash
npm run convex:dev
```

Cortex CLI native management uses the selected project's Convex 1.46.0 executable. Obtain that deployment's administrator key from its setup. In another terminal:

```bash
npm run dev
```

Open **http://localhost:3000**, using exactly the origin configured below, including the port.

## Private setup and sessions

```env
CONVEX_URL=https://your-project.convex.cloud
CORTEX_APP_DEPLOYMENT_ADMIN_KEY=your-private-deployment-admin-key
CORTEX_APP_ORIGIN=http://localhost:3000
CORTEX_APP_SETUP_TOKEN=your-private-first-setup-token
OPENAI_API_KEY=your-private-openai-key
CORTEX_FACT_EXTRACTION=true
CORTEX_GRAPH_SYNC=false
```

Generate a separate first-setup token with `openssl rand -hex 32` and supply it in the normal initial setup form. It is distinct from deployment administrator credentials and account passwords. Keep all secrets server-only, outside `NEXT_PUBLIC_*` variables and public SDK profile/history data. Use localhost consistently locally and the exact HTTPS origin when hosted.

Initial setup atomically creates the administrator and assigns the tenant. Normal registration cannot choose role/tenant authority. Private `appAccounts`, `appSessions` and `appAuthState` tables hold credential/session state. The server issues an opaque HttpOnly cookie, stores its digest, expires it after eight hours and resolves current account authority on each protected request. Logout/revocation removes authority; there is no localStorage bearer-token authentication.

The memory-space picker selects only spaces permitted by the verified server session. Environment defaults, request IDs and SDK AuthContext do not grant app authority. Known older credential-bearing fixtures must be retired/recreated only when proved disposable; installing the new backend over legacy credential histories without the required private-auth preparation is refused. Do not scrub production SDK history as an app migration shortcut.

## Demo behavior

Chat stores owned user/assistant turns, embeddings and extracted facts, with optional graph relationships. The visualization shows layer progress and recall. History/reload/new-chat recall, streaming Stop/recovery and provider errors use the same verified authority. Deleting a conversation removes that owned conversation and its managed graph projection; it is not complete user-data erasure. Graph-off chat needs no Docker.

The server-side implementation is in `lib/chat.ts`, `lib/app-auth.ts`, `lib/cortex.ts` and `convex/app/`. Preserve its fixed internal transport allowlist and session verification when customizing the app. The OpenAI key supplies chat and embeddings; unavailable provider configuration reports an error.

## Optional graph and updates

SDK init/install and template init use the same shared graph setup service. Neo4j and Memgraph are supported:

```bash
cortex graph setup . --graph neo4j --graph-mode local --yes
cortex graph status .
cortex graph stop .
cortex graph start .
cortex templates update . --to 1.2.0 --catalog-version 1.1.0 --dry-run
cortex templates update . --to 1.2.0 --catalog-version 1.1.0
```

Local setup owns project-specific Compose resources and private credentials. Stop preserves volumes; start/stop never guess unrelated containers/ports. Existing-service configuration uses `--graph-mode existing --graph-uri bolt://localhost:7687` with matching provider environment credentials and probes without graph data writes. Explicit graph enablement refuses missing/ambiguous configuration or a failed connection.

The app/template channel checks recorded ownership and user conflicts. SDK updates (`cortex update --sync` or `cortex schema sync`) own SDK backend files and do not replace app files. A recognized old Next shim missing `MutationCtx` needs the current template/app update first, then the SDK backend update. Unrecorded/edited apps require explicit migration. Catalog 1.1.0 is independent of CLI/SDK 0.38.0; explicit unpublished archives use `--templates-package`, `--sdk-package` and `--provider-package` without older registry fallback.

## Canonical development and checks

Canonical source is `packages/vercel-ai-provider/quickstart`; the old CLI mirror is not canonical. Development `file:` dependencies consume the built monorepo SDK/provider. Catalog rendering supplies standalone package dependencies. Run npm separately here; this app is not an npm workspace member.

```bash
npm install
npx --no-install tsc --noEmit
npm run build
npm test
npm run test:e2e
```

Unit/mock integration checks do not prove live service behavior. E2E needs your own running disposable app/backend and provider. `npm run lint` uses the current Next.js ESLint configuration. `npm run build` does not deploy the backend; `npm run convex:deploy` is a separate intentional hosted deployment step.

## Learn more

- [Cortex documentation](https://cortexmemory.dev/docs)
- [Vercel AI SDK documentation](https://ai-sdk.dev/docs)

## License

FSL-1.1-Apache-2.0
