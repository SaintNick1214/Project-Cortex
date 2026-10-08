# Cortex Chat SDK

A Next.js 16/AI SDK 6 chat application with Cortex persistent memory, normal Auth.js guest and email/password sessions, and editable artifacts. Application 1.1.0 uses SDK/provider 0.37.0.

## Quick start

Use Node.js 22.16.0 or newer for the Cortex CLI workflow and the declared **pnpm 10.33.0** manager for this app.

```bash
cortex templates init my-chatbot --template chat-sdk --template-version 1.1.0 --catalog-version 1.0.0 --yes --graph none
cd my-chatbot
cp .env.local.example .env.local
```

The independent template channel assembles the recognized app and SDK backend under one schema, with genuine Convex-generated bindings. It keeps app handlers in their own namespace and registers the Next backend operations internally. Do not copy a bare SDK backend over the app or expose those functions as public operations. Arbitrary schemas and conflicting user edits are refused.

Configure your own Convex deployment, then run its native setup/codegen and foreground watcher:

```bash
pnpm convex:dev
```

Use the selected project's Convex 1.46.0 executable for Cortex CLI native management. Obtain the deployment administrator key from that deployment's setup and keep it server-only. In another terminal:

```bash
pnpm dev
```

Open **http://localhost:3000**. Use exactly the same host and port in the browser, `AUTH_URL` and `CORTEX_APP_ORIGIN`; mixing localhost and 127.0.0.1 breaks the origin/session contract. Use the same HTTPS origin for hosted configuration.

## Server environment

Copy the example file and replace private placeholders locally:

```env
AUTH_SECRET=your-private-random-auth-secret
AUTH_URL=http://localhost:3000
CORTEX_APP_ORIGIN=http://localhost:3000
CONVEX_URL=https://your-project.convex.cloud
CORTEX_APP_DEPLOYMENT_ADMIN_KEY=your-private-deployment-admin-key
CORTEX_APP_TENANT_ID=chat-sdk-local
MEMORY_SPACE_ID=chat-sdk-demo
OPENAI_API_KEY=your-private-openai-key
CORTEX_FACT_EXTRACTION=true
CORTEX_GRAPH_SYNC=false
```

Generate `AUTH_SECRET` with `openssl rand -base64 32`. None of the key/secret variables belongs in a `NEXT_PUBLIC_*` variable. Keep the server tenant stable. Each verified guest or registered user gets a separate memory space from the prefix plus their persisted user ID; a browser request cannot choose user/tenant/space authority.

OpenAI supplies embeddings and direct chat/title generation. Selecting a Gateway model additionally requires `AI_GATEWAY_API_KEY`; the Gateway key does not replace OpenAI embeddings. Normal guest and credentials login are configured; GitHub/Google OAuth are not configured in this template. Optional `REDIS_URL` enables resumable streams; chat works without Redis, with no promise to resume a disconnected stream.

## Features and scope

- Real streaming chat, Stop, history/reload and recall in another chat.
- Owner-scoped edit/truncate/resubmit preserves audit history and excludes discarded turns from edited-branch recall.
- Text, code and sheet generation, editing, version navigation and restore. Valid empty text can be saved and edited again. Code Run waits for the pinned Python runtime.
- Image rendering and genuine image uploads/preview; this app does not generate image artifacts. Uploads enforce owner scope, MIME/size and the owned URL registry.
- Suggestions can be applied to save a new version or collapsed with X. Collapse is not persistent rejection; queries return the document's owned suggestions without a current-version-only filter.
- Tool Allow/Deny responses persist through reload; denied tools do not execute.
- Vote/copy and intentional public text sharing. Public share omits private files/tools/credentials and is read-only; revocation makes the link unavailable.
- Delete selected/all owned chats preserves foreign data. Conversation deletion does not erase all recall memory or user-associated data.

Normal Auth.js sessions authorize private app routes, actions and loaders. Internal `chatUsers` stores credential material privately. SDK `AuthContext` or a caller-supplied user ID is not a replacement for that application verification.

## Optional graph and updates

Template init and SDK init/install use one shared graph setup service. Neo4j and Memgraph are supported; Graph off does not need Docker.

```bash
cortex graph setup . --graph memgraph --graph-mode local --yes
cortex graph status .
cortex graph stop .
cortex graph start .
cortex templates update . --to 1.1.0 --catalog-version 1.0.0 --dry-run
cortex templates update . --to 1.1.0 --catalog-version 1.0.0
```

Local graph operations select only project-owned resources; stop retains data volumes. For an existing graph, use `--graph-mode existing --graph-uri bolt://localhost:7687` and the matching provider's private environment credentials. The resolver rejects ambiguous enabled provider configuration and failed connections.

Template updates require recorded ownership and refuse conflicting user edits. SDK dependency/backend updates are separate (`cortex update --sync` or `cortex schema sync`). For the recognized older Next shim lacking `MutationCtx`, update the template/app first, then update the SDK backend; the SDK channel cannot overwrite the app shim or Chat handlers. An unrecorded/edited older app needs explicit app migration and conflict resolution. Catalog 1.0.0 and app 1.1.0 versions are independent of CLI/SDK releases; prepublication archives can be selected through `--templates-package`, `--sdk-package` and `--provider-package`.

## Development

Canonical source is `packages/cortex-cli/templates/chat-sdk-quickstart` in the core monorepo. Its development `file:` dependencies require the SDK and provider builds; generated catalog projects use rendered standalone dependencies. Keep the composed schema, `convex/app.schema.ts`, `convex/app/`, SDK ownership record and generated bindings together.

```bash
pnpm exec tsc --noEmit
pnpm build
pnpm test
pnpm test:e2e
```

`pnpm test` runs Vitest; Playwright E2E uses `pnpm test:e2e` and requires the configured running app/backend/provider. Inherited lint debt is not a clean-lint guarantee. For an intentional hosted deployment, set the exact HTTPS origin and private server variables and deploy the composed backend with `pnpm convex:deploy`; app compilation alone never deploys it.

## Based on

Based on [vercel/ai-chatbot](https://github.com/vercel/ai-chatbot) at commit `9d5d8a3ea7968522a37ab1cc145a6c0ef8a9dd2e`, with Cortex/Convex persistence, memory visualization, belief revision and fact extraction.

## License

MIT
