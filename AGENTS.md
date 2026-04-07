# AGENTS.md

## Cursor Cloud specific instructions

### Architecture
Cortex is an npm workspace monorepo with these packages:
- **Root (`@cortexmemory/sdk`)** – Core TypeScript SDK (memory, vector, facts, conversations, etc.)
- **`packages/cortex-cli`** – CLI tool (`cortex init`, `cortex start`, `cortex dev`)
- **`packages/vercel-ai-provider`** – Vercel AI SDK integration
- **`packages/vercel-ai-provider/quickstart`** – Next.js demo app (separate `npm install`)
- **`cortex-sdk-python`** – Python SDK (separate, uses `make dev` / pip)
- **`convex-dev/`** – Convex backend functions (schema, mutations, queries)

### Required Secrets (injected as env vars)
All secrets listed in `.env.example` are available as injected environment variables. The key ones:
- `CONVEX_URL`, `CONVEX_DEPLOYMENT` – Managed Convex cloud deployment
- `LOCAL_CONVEX_URL`, `LOCAL_CONVEX_DEPLOYMENT` – Local Convex config
- `OPENAI_API_KEY` – Required for embeddings and fact extraction
- `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` – Neo4j graph DB (not reachable from Cloud Agent VMs)
- `MEMGRAPH_URI`, `MEMGRAPH_USERNAME`, `MEMGRAPH_PASSWORD` – Memgraph (not reachable from Cloud Agent VMs)
- `CONVEX_TEST_MODE` – Set to `managed` for cloud testing
- `CORTEX_FACT_EXTRACTION`, `CORTEX_GRAPH_SYNC`, `CORTEX_EMBEDDING_MODEL`, etc.

### .env.local Setup
On first setup, write `.env.local` in the workspace root by expanding the injected environment variables. The update script handles this automatically. See `.env.example` for the full list of variables.

### Convex Codegen
The SDK source imports from `convex-dev/_generated/api` which must be generated before building. The project uses `convex.json` to configure `convex-dev/` as the functions directory (not the default `convex/`).

**To generate codegen files without interactive auth:**
1. Temporarily clear `CONVEX_DEPLOYMENT` and run `npx convex dev --once --typecheck disable` in an interactive tmux session
2. Select "Start without an account (run Convex locally)"
3. Name the project anything (e.g., `cortex-dev`)
4. This creates `convex-dev/_generated/` with `api.js`, `api.d.ts`, `dataModel.d.ts`, `server.js`, `server.d.ts`

Alternatively, the update script generates these files automatically using a local anonymous Convex instance.

### Build Order
1. `npm install` (workspace root – installs all packages)
2. Generate Convex codegen (see above) – required before building
3. `npm run build` (root SDK)
4. `npm run build` in `packages/cortex-cli`
5. `npm run build` in `packages/vercel-ai-provider`
6. For the quickstart demo: `cd packages/vercel-ai-provider/quickstart && npm install`

### Running Tests
- **Root SDK unit tests:** `node --experimental-vm-modules node_modules/jest/bin/jest.js --testPathPatterns="tests/unit" --forceExit`
- **Root SDK integration tests (managed Convex):** `CONVEX_TEST_MODE=managed node --experimental-vm-modules node_modules/jest/bin/jest.js --testPathPatterns="tests/conversations.test" --forceExit`
- **CLI unit tests:** `cd packages/cortex-cli && npm run test:unit`
- **Vercel AI provider unit tests:** `cd packages/vercel-ai-provider && npm run test:unit`
- All test scripts are documented in each package's `package.json` `scripts` section.

### Lint
- Root SDK: `npm run lint` (runs `tsc --noEmit` + ESLint)
- CLI: `cd packages/cortex-cli && npm run lint`
- Vercel AI provider: `cd packages/vercel-ai-provider && npm run lint`

### Key Gotchas
- **Graph databases (Neo4j/Memgraph) are not reachable** from Cloud Agent VMs. Set `CORTEX_GRAPH_SYNC=false` when running code that uses `Cortex.create()` to avoid connection errors.
- **Convex CLI interactive auth**: The `npx convex dev` command requires interactive prompts for first-time setup. Use a tmux session for this. The managed Convex deployment is already configured and has functions pushed.
- **`cross-env` is a devDependency** but may not be on PATH. Use plain `VAR=value command` syntax instead.
- **Jest 30** uses `--testPathPatterns` (not `--testPathPattern`).
- The quickstart app (`packages/vercel-ai-provider/quickstart`) has its own `package-lock.json` and is NOT part of the npm workspace – run `npm install` separately inside it.
