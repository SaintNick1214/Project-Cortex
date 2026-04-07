# AGENTS.md

## Cursor Cloud specific instructions

### Monorepo Overview

Cortex is a persistent memory system for AI agents, built on Convex. The monorepo uses **npm workspaces** (`"."` and `"packages/*"`). The Python SDK and templates are **not** part of the npm workspace graph.

| Path | Package | What it is |
|------|---------|------------|
| `/` (root) | `@cortexmemory/sdk` | Core TypeScript SDK — `Cortex` class with namespaced APIs: `memory`, `conversations`, `vector`, `facts`, `contexts`, `memorySpaces`, `users`, `agents`, `sessions`, `governance`, `a2a`, `artifacts`, `attachments`, `immutable`, `mutable`. Use `Cortex.create()` for auto-configured embedding/fact-extraction/graph from env vars, or `new Cortex()` for manual config. |
| `packages/cortex-cli` | `@cortexmemory/cli` | CLI tool (binary: `cortex`). Commands: `init`, `dev`, `deploy`, `status`, `setup`, `db`, `memory`, `users`, `spaces`, `facts`, `conversations`, `convex`, `completion`. Engine: Node ≥ 20. `prebuild` syncs `vercel-ai-provider/quickstart` → `templates/vercel-ai-quickstart`. |
| `packages/vercel-ai-provider` | `@cortexmemory/vercel-ai-provider` | Vercel AI SDK integration. **Two export subpaths:** `"."` (core: `createCortexMemory`, `createCortexMemoryAsync`, streaming helpers, v6 agent helpers, artifact tools) and `"./react"` (hooks: `useLayerTracking`, `useArtifacts`). Peers: `ai`, `convex`, optional `react`. |
| `packages/vercel-ai-provider/quickstart` | `@cortexmemory/vercel-ai-quickstart` | Next.js interactive demo app. **Not an npm workspace member** — run `npm install` separately. Depends on SDK and provider via `file:` links. Needs `CONVEX_URL`, `NEXT_PUBLIC_CONVEX_URL`, `OPENAI_API_KEY` in `.env.local`. Run `npm run convex:dev` before `npm run dev`. |
| `cortex-sdk-python` | `cortex-memory` (PyPI) | Python SDK mirroring the TS client. **Separate from npm** — uses `Makefile` + `pyproject.toml`. Python ≥ 3.10. Install: `make dev` (creates venv + editable install). Test: `make test` / `make test-local` / `make test-managed`. Extras: `[graph]`, `[a2a]`, `[llm]`, `[all]`, `[dev]`. |
| `convex-dev/` | *(not an npm package)* | Convex backend functions (schema, mutations, queries, actions). Deployed via `npx convex dev` or `npx convex deploy`. Published inside `@cortexmemory/sdk` (`files` includes `convex-dev`). `convex.json` at root maps `"functions": "convex-dev/"`. |
| `Documentation/` | *(not an npm package)* | MDX docs site content (Docusaurus-style). Sections: getting-started, architecture, api-reference, integrations, security, roadmap, tools. Content only — the rendering framework lives elsewhere. |

#### CLI Templates (shipped inside `packages/cortex-cli/templates/`)

| Template | What it scaffolds |
|----------|-------------------|
| `basic` | Minimal CLI chat + optional Hono HTTP server. Uses **Vitest** (not Jest). |
| `chat-sdk-quickstart` | Full Next.js + AI chatbot (rich UI, next-auth, Redis, Radix, CodeMirror). Uses **pnpm** (`packageManager: pnpm`). |
| `vercel-ai-quickstart` | Mirror of `packages/vercel-ai-provider/quickstart` — synced automatically by CLI `prebuild`. |

> `create-cortex-memories` is **deprecated** — replaced by `cortex init` from `@cortexmemory/cli`.

---

### Required Secrets (injected as env vars)

All secrets from `.env.example` are available as injected environment variables:

| Secret | Purpose |
|--------|---------|
| `CONVEX_URL` | Managed Convex cloud deployment URL |
| `CONVEX_DEPLOYMENT` | Convex deployment identifier (`dev:...` format) |
| `LOCAL_CONVEX_URL` | Local Convex URL (`http://127.0.0.1:3210`) |
| `LOCAL_CONVEX_DEPLOYMENT` | Local deployment name |
| `OPENAI_API_KEY` | Required for embeddings and LLM-powered fact extraction |
| `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` | Neo4j graph DB (**not reachable from Cloud Agent VMs**) |
| `MEMGRAPH_URI`, `MEMGRAPH_USERNAME`, `MEMGRAPH_PASSWORD` | Memgraph (**not reachable from Cloud Agent VMs**) |
| `CONVEX_TEST_MODE` | `managed` for cloud testing, `local` for local |
| `CORTEX_FACT_EXTRACTION`, `CORTEX_GRAPH_SYNC`, `CORTEX_EMBEDDING_MODEL`, etc. | Feature flags and model config |

### .env.local Setup

On first setup, write `.env.local` in the workspace root by expanding the injected environment variables. See `.env.example` for the full template.

---

### Convex Codegen

The SDK imports from `convex-dev/_generated/api` which must be generated before building. The project uses `convex.json` (`"functions": "convex-dev/"`) instead of the default `convex/` directory.

**To generate codegen files without interactive auth:**
1. Clear `CONVEX_DEPLOYMENT` and run `npx convex dev --once --typecheck disable` in an interactive tmux session
2. Select "Start without an account (run Convex locally)"
3. Name the project anything (e.g., `cortex-dev`)
4. This creates `convex-dev/_generated/` with `api.js`, `api.d.ts`, `dataModel.d.ts`, `server.js`, `server.d.ts`

---

### Build Order

1. `npm install` (workspace root — installs root + `cortex-cli` + `vercel-ai-provider`)
2. Generate Convex codegen (see above) — required before any build
3. `npm run build` (root SDK — tsup → `dist/`)
4. `cd packages/cortex-cli && npm run build` (tsc → `dist/`, also runs `prebuild` template sync)
5. `cd packages/vercel-ai-provider && npm run build` (tsup → `dist/`)
6. Quickstart: `cd packages/vercel-ai-provider/quickstart && npm install` (separate lockfile)
7. Python SDK: `cd cortex-sdk-python && make dev` (separate venv)

### Updating Dependencies

Run `node scripts/update-deps.mjs` to update deps across **all** packages via `npm-check-updates`. Flags: `--dry-run`, `--no-install`. Requires `ncu` globally (`npm install -g npm-check-updates`).

**Pinned packages** (`.ncurc.json`): `eslint`, `@eslint/js`, and `typescript` are excluded from updates — eslint 10 has peer conflicts with `@typescript-eslint`, and TypeScript 6 deprecates tsconfig options used across the repo.

---

### Scripts Reference (`/scripts/`)

| Script | Purpose |
|--------|---------|
| `dev-runner.mjs` | `npm run dev` — orchestrates Convex dev server (auto/local/cloud), opens dashboard, watches for changes |
| `test-runner.mjs` | `npm run test` — detects `LOCAL_CONVEX_URL` / `CLOUD_CONVEX_URL`, runs Jest in appropriate mode(s) |
| `update-deps.mjs` | `npm run update-deps` — runs `ncu -u` across all packages, respects `.ncurc.json` reject list |
| `test-pipeline-local.sh` | Local CI simulator with changed-file detection |
| `test-pipeline-parallel.sh` | Parallel test matrix (Python + TS + sub-packages) |
| `test-staggered-suite.sh` | Staggered test orchestration |
| `test-memory-openai-20x.mjs` | Repeat memory-openai tests for flake hunting (needs managed Convex + OpenAI) |
| `seed-multi-user-data.ts` | Seed test data for multi-user scenarios |
| `verify-test-data.ts` / `verify-multi-user-data.ts` | Verify test data state |
| `cleanup-test-data.ts` | Clean up test data |
| `release.ps1` | Release flow (PowerShell, referenced by `npm run release`) |

---

### Test Organization (`/tests/`)

Jest config: `jest.config.mjs`. Setup: `tests/env.ts` (loads `.env.test` + `.env.local`, configures `CONVEX_URL` based on `CONVEX_TEST_MODE`) + `tests/setup.ts`.

| Directory / Pattern | Category | Notes |
|---------------------|----------|-------|
| `tests/unit/` | Unit tests | Validators, auth, artifacts, attachments, sessions, types, memory helpers. **No Convex needed.** |
| `tests/integration/` | Integration | Cross-module (artifacts CRUD/streaming/versioning, phase orchestration) |
| `tests/e2e/` | End-to-end | Belief revision, auth flows, sessions, multi-tenancy, recall stress, artifacts |
| `tests/streaming/` | Streaming | Progressive storage, stream processor, fact extraction/dedup, chunking, error recovery |
| `tests/graph/` | Graph DB | Adapter, sync, orphan detection, E2E sync. `graph/proofs/` for proof scripts |
| `tests/stress/` | Stress/chaos | Multi-turn chaos testing |
| `tests/helpers/` | Test utilities | Isolation (`TestRunContext` for unique prefixed IDs), assertions, tenancy, cleanup |
| `tests/*.test.ts` (root) | Domain suites | `conversations`, `memory`, `facts`, `vector`, `contexts`, `memorySpaces`, `sessions`, `agents`, `a2a`, `governance`, `gdprCascade`, `hiveMode`, `resilience`, `tenant-isolation`, etc. |
| `tests/debug/` | Debug | Race condition debugging scripts |
| `*.manual.ts` | Manual tests | Not picked up by standard Jest runs |

**Running tests:**
- All tests: `npm test` (uses `test-runner.mjs` to auto-detect local/managed/both)
- Unit only: `node --experimental-vm-modules node_modules/jest/bin/jest.js --testPathPatterns="tests/unit" --forceExit`
- Specific suite: `CONVEX_TEST_MODE=managed node --experimental-vm-modules node_modules/jest/bin/jest.js --testPathPatterns="tests/conversations.test" --forceExit`
- CLI: `cd packages/cortex-cli && npm run test:unit`
- Vercel AI provider: `cd packages/vercel-ai-provider && npm run test:unit`
- Python: `cd cortex-sdk-python && make test`

### Lint

- Root SDK: `npm run lint` — runs `tsc --project tsconfig.lint.json --noEmit` then `eslint`
- CLI: `cd packages/cortex-cli && npm run lint` — eslint only
- Vercel AI provider: `cd packages/vercel-ai-provider && npm run lint` — `tsc --noEmit` only

---

### Key Gotchas

- **Graph databases (Neo4j/Memgraph) are not reachable** from Cloud Agent VMs. Set `CORTEX_GRAPH_SYNC=false` when running code that uses `Cortex.create()` to avoid connection errors.
- **Convex CLI interactive auth**: `npx convex dev` requires interactive prompts for first-time setup. Use a tmux session. The managed deployment already has functions pushed.
- **`cross-env` is a devDependency** but may not be on PATH. Use plain `VAR=value command` syntax instead.
- **Jest 30** uses `--testPathPatterns` (plural, not `--testPathPattern`).
- **Quickstart is not a workspace member** — `packages/vercel-ai-provider/quickstart` has its own `package-lock.json`; run `npm install` separately.
- **CLI `prebuild`** syncs the quickstart app into `templates/vercel-ai-quickstart` — this runs automatically on `npm run build` in the CLI package and may produce git diffs in the template directory.
- **`.ncurc.json`** at repo root pins `eslint`, `@eslint/js`, `typescript` to prevent breaking major bumps from `update-deps.mjs`.
- **Python SDK** is fully independent from the npm workspace — use its `Makefile` for all operations.
