# {{PROJECT_NAME}}

A terminal chat agent and optional Hono HTTP server with persistent Cortex memory. This application is version 1.2.0 and uses SDK 0.38.0.

## Quick start

Use Node.js 24.15.0 or newer for the Cortex CLI workflow and the declared npm 12.2.0 manager for this app. Native CLI management uses the selected project's Convex 1.46.0 executable.

```bash
cortex init my-agent --template basic --local --yes --graph none
cd my-agent
```

Basic is also available through the independently versioned catalog:

```bash
cortex templates init my-agent --template basic --template-version 1.2.0 --catalog-version 1.1.0 --yes --graph none
```

Configure the generated `.env.local` with the URL of your own Convex deployment. For local setup, use the URL actually reported by Convex; do not assume an existing service on a default port. Select that project explicitly for management:

```bash
cortex config add-deployment local --url http://127.0.0.1:3210 --json-only
cortex config set-path local .
cortex dev -d local --local
```

Keep the foreground backend running; Ctrl-C stops its owned child. In a second terminal:

```bash
npm start
# Or start the optional HTTP server:
npm run server
```

`npm run build` only compiles TypeScript. It does not install, push or deploy a backend. For an existing npm project, `cortex install . --no-deploy --yes --graph none` stages SDK/backend files; choose the native target separately before `cortex dev --once`.

## Configuration

Use private `.env.local` values for your selected deployment and provider:

```env
CONVEX_URL=http://127.0.0.1:3210
CORTEX_APP_DEPLOYMENT_ADMIN_KEY=your-private-deployment-key
CORTEX_APP_TENANT_ID=basic-demo
OPENAI_API_KEY=your-private-openai-key
MEMORY_SPACE_ID=basic-demo
USER_ID=demo-user
USER_NAME=Demo User
AGENT_ID=basic-assistant
AGENT_NAME=Cortex CLI Assistant
CORTEX_FACT_EXTRACTION=true
CORTEX_GRAPH_SYNC=false
```

The demo uses echo responses when no OpenAI key is supplied. Embeddings and LLM-powered extraction require their provider configuration. Basic requires the selected deployment's private server key and uses the SDK's internal deployment-operator mode. The CLI-generated `CONVEX_DEPLOY_KEY` is accepted when `CORTEX_APP_DEPLOYMENT_ADMIN_KEY` is unset; conflicting keys refuse startup. Its optional HTTP server binds to loopback and rejects requests from other browser origins. Basic is a server-trust SDK example; its HTTP server is not an authenticated multi-user application. Add a verified application boundary before exposing it to other users.

## Chat and HTTP interface

| Terminal command | Purpose |
| --- | --- |
| `/recall <query>` | Retrieve memories without storing another turn |
| `/facts` | List stored facts |
| `/history` | Show the current conversation |
| `/new` | Start another conversation |
| `/config` | Show demo configuration |
| `/clear` | Clear the terminal display |
| `/exit` | Close the demo |

| HTTP endpoint | Method | Purpose |
| --- | --- | --- |
| `/chat` | POST | Chat and store memory |
| `/recall?query=...` | GET | Retrieve memories |
| `/facts` | GET | List facts |
| `/history/:id` | GET | Read a conversation |
| `/health` | GET | Check the server |

```bash
curl -X POST http://localhost:3001/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"My name is Alex"}'
```

## Optional graph

SDK init/install and template init share the same optional graph setup service. Choose `--graph neo4j` or `--graph memgraph` with `--graph-mode local`, or configure an existing service with `--graph-mode existing --graph-uri bolt://localhost:7687`. Graph off requires no Docker. You can also configure an existing project explicitly:

```bash
cortex graph setup . --graph neo4j --graph-mode local --yes
cortex graph status .
cortex graph stop .
cortex graph start .
```

Local setup owns project-specific Compose resources and private credentials. Stop preserves data volumes; it never guesses unrelated containers or ports. Existing-service setup probes without graph data mutation and does not own external start/stop. Use credentials from the selected provider's environment or a private credential file, not URI userinfo or command-line passwords. `Cortex.create()` reads the enabled graph's configuration; an explicitly enabled graph with missing/ambiguous configuration or a failed connection is an error.

## Updating

```bash
cortex templates update . --to 1.2.0 --catalog-version 1.1.0 --dry-run
cortex templates update . --to 1.2.0 --catalog-version 1.1.0
cortex update -d local --sdk-version 0.38.0 --convex-version 1.46.0 --sync --dry-run
```

Template update checks recorded ownership and preserves user-edit conflicts. SDK update plans dependencies and optionally synchronizes SDK-owned backend files; it does not update app files or manage graph containers. An unpublished candidate must be selected explicitly with the applicable `--sdk-package`/`--templates-package` options; unavailable registry versions do not fall back to an older SDK.

## Build and tests

```bash
npm run build
npm run test:unit
npm run test:integration
npm run test:e2e
```

Integration units may use a mocked SDK. Real backend E2E needs your selected disposable deployment; provider tests need OpenAI, and server tests need the HTTP server. A skipped service test is not a runtime check.

## Learn more

- [Cortex documentation](https://cortexmemory.dev/docs)
- [Source repository](https://github.com/SaintNick1214/Project-Cortex)

## License

FSL-1.1-Apache-2.0
