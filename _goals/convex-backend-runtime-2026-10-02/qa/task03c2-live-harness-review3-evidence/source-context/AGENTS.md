# Cortex repository

## Scope and safeguards

This is the `Project-Cortex` SDK monorepo. The surrounding Cortex workspace contains
independent repositories. Use explicit working directories and inspect Git status,
the relevant manifests and CI before editing. Preserve local work. Do not commit,
publish, deploy production or message other chats unless requested.

The Python SDK and old pipeline helpers are archived under `_DEPRECATED/`. They are
reference material, outside active package builds, parity work and QA. SDK documentation
is canonical in the sibling website repository at `cortexmemory.dev/docs-site/docs/`;
do not restore the removed `Documentation/` tree or edit the website without task scope.

## Active packages and tooling

| Path | Role |
|---|---|
| Root (`@cortexmemory/sdk`) | TypeScript memory client, domain modules and shared contracts |
| `convex-dev/` | Convex backend; `convex.json` selects this functions directory |
| `packages/cortex-cli/` | CLI and shipped scaffold templates |
| `packages/vercel-ai-provider/` | AI SDK integration with core and React export paths |
| `packages/vercel-ai-provider/quickstart/` | Canonical Next.js demo; separate install outside npm workspaces |
| `packages/cortex-cli/templates/basic/` | Basic scaffold; separate checks/install |
| `packages/cortex-cli/templates/chat-sdk-quickstart/` | Chat scaffold; separate checks/install |
| `packages/cortex-cli/templates/vercel-ai-quickstart/` | Generated mirror of the canonical demo |

Root npm workspaces include the root and `packages/*`. Current active manifests require
Node >=24.15.0 and declare npm 12.2.0. Use their current scripts and lockfiles. The current
stack uses TypeScript 6.0 and ESLint 10; old `.ncurc.json` exclusions and global `ncu`
setup are superseded. `scripts/update-deps.mjs` uses local npm execution, skips archived
packages and restricts TypeScript to supported patch upgrades. Run its dry mode before
an authorized dependency update; do not run it for unrelated work.

## Codex orchestration

The workspace orchestration suite is canonical in `Project-Cortex/.agents/` and linked
from the workspace `.agents/`. When installed, read `.agents/CODEX-RUNTIME.md` and
`.agents/PROJECT-PROFILE.md` for path resolution, module scope and validation commands.
Verify profile facts against current manifests when branches have changed.

Use feature-orchestrator for substantial multi-step features, deep-research-orchestrator
for research/planning, and project-bootstrap-orchestrator only for requested new projects.
These workflows use native Codex subagents for bounded execution and independent review;
ordinary small edits stay direct. Planning documents do not authorize implementation.

## Builds and checks

Convex generated bindings are versioned so a clean build does not require credentials or
an automatic backend deployment. Do not initialize a deployment or regenerate bindings
just to satisfy an unrelated check. Verify generated imports when changing backend APIs.

- Root: `npm run lint`, `npm run build`, and `npm run test:contracts`.
- CLI: its own lint, build and `test:unit` scripts. Its `prebuild` synchronizes the demo
  mirror, so inspect generated diffs and protect unrelated template work.
- Provider: its own lint, build and `test:unit` scripts, including React exports.
- Demo/templates: inspect each package's scripts; they are separate installs. Chat scaffold
  uses npm/Vitest. The basic scaffold's `build` runs offline TypeScript; its separate
  `build:convex` deploys Convex and requires deployment authorization.

After behavior changes run affected code-quality and applicable module/UI QA. A requested
full QA gate covers the active core modules in the profile, not all sibling repositories.
Use verified disposable targets for integration, isolation, graph and paid inference;
credentials alone do not establish a safe target. Report absent/skipped coverage honestly.
Do not deploy, seed, migrate or invoke paid models solely to make a check pass.

## Runtime and environment

Inspect `.env.example` and actual configured prerequisites without printing secrets.
Do not assume cloud-injected credentials, rewrite `.env.local`, or disable graph features
in local Codex because of older Cursor Cloud guidance. Convex authentication and service
access are checked when needed; Neo4j/Memgraph reachability depends on the actual runtime.
Keep browser-safe exports separate from backend/Node-only modules and provider secrets.
