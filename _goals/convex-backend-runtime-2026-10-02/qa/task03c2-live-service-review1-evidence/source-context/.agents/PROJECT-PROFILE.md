# Cortex Project Profile

Refreshed for the cloud implementation handoff on 2026-10-03 from reconciled dev
`3341d64ddc06f1de26ed525312ef2c1b89b16952`: current AGENTS.md, active package manifests,
Jest configs and PR CI. Commands below were inspected, not executed during this
planning handoff. Re-read manifests after implementation changes.
Read `CODEX-RUNTIME.md` for path resolution, native delegation and evidence rules.

## 1. Project Identity

| Field | Value |
|---|---|
| Project | Cortex persistent memory and agent runtime, backed by Convex |
| Profile root | This Git repository, the parent of `.agents/`; discover the actual checkout path |
| Implementation branch | `feat/convex-backend-runtime`, based on reconciled `dev` |
| npm monorepo | Root `@cortexmemory/sdk`, `packages/cortex-cli`, `packages/vercel-ai-provider`; workspaces `.` and `packages/*` |
| Runtime | Node >=24.15.0; package manager npm 12.2.0; TypeScript ~6.0.3 and ESLint 10 at the handoff baseline |
| Separate installs | Canonical quickstart and each shipped scaffold template |
| Archived code | Python SDK and old pipeline helpers under `_DEPRECATED/`; excluded from active work and QA |

All paths below are relative to this repository unless explicitly described as a sibling.
Desktop absolute paths in historical research are provenance, not cloud prerequisites.
The Markdown orchestration instructions are tracked on this feature branch so a clean
cloud checkout can follow them, even though `.agents/` remains ignored for untracked files.

## 2. Tech Stacks

| Stack | Tooling | Location | Role |
|---|---|---|---|
| sdk | TypeScript 6, tsup, Jest 30 | `src/`, `tests/` | Public TypeScript client/domain contracts |
| backend | TypeScript, Convex >=1.46 | `convex-dev/` | Schema, queries, mutations, actions and generated bindings |
| cli | TypeScript, tsc, ESLint, Jest | `packages/cortex-cli/` | CLI and shipped scaffold templates |
| provider | AI SDK 7, TypeScript, React hooks, tsup, Jest | `packages/vercel-ai-provider/` | Core and `./react` exports |
| demo | Next.js, React, Jest | `packages/vercel-ai-provider/quickstart/` | Canonical interactive app; separate npm install |
| basic template | TypeScript, Vitest | `packages/cortex-cli/templates/basic/` | Offline build and unit checks; deployment is a separate script |
| chat template | Next.js, npm, Vitest, Playwright | `packages/cortex-cli/templates/chat-sdk-quickstart/` | Separate install and product-flow checks |
| docs | Package READMEs; canonical MDX in website repository | `README.md`, package READMEs; sibling `cortexmemory.dev/docs-site/docs/` | New-install and public-contract documentation |

`packages/cortex-cli/templates/vercel-ai-quickstart/` is generated from the canonical
quickstart by CLI prebuild. Edit the source, run sync and inspect the mirror diff.
Do not restore removed `Documentation/`, root Python or old dependency holds.
Sibling applications are independent repositories and are outside this feature except
related canonical website documentation. If website access is unavailable, produce a
reviewable docs patch/handoff and identify incomplete website integration explicitly.

## 3. Architecture & Layers

| Order | Layer | Paths / dependencies |
|---:|---|---|
| 1 | Backend schema/contracts and components | `convex-dev/schema.ts`, `convex-dev/*.ts`, `convex.json`, generated `convex-dev/_generated/` |
| 2 | Shared domain and TypeScript clients | `src/`; scoped validation, memory/facts, artifacts, streaming, graph adapters |
| 3 | CLI and AI SDK integration | `packages/cortex-cli/src/`, `packages/vercel-ai-provider/src/`, `packages/vercel-ai-provider/react/` |
| 4 | Demo, templates and docs | Canonical quickstart, basic/chat templates, package READMEs and canonical website docs |
| 5 | Behavioral verification | `tests/`, package/template tests and goal `qa/` receipts |

Only affected layers need tasks. Build SDK before packages consuming its exports.
Generated bindings are versioned; clean offline builds do not require deployment.
Do not hand-edit generated API files instead of codegen when backend contracts change.

## 4. Quality Gate Commands

Select affected stacks and dependency checks. A full active core gate selects sdk/backend,
CLI, provider, demo/templates and the six modules in §9; it excludes archived Python and
unrelated sibling applications. Check test discovery, skipped suites and service coverage.
A successful mocked run does not certify actual service behavior.

| Stack | Check | Command | Working directory |
|---|---|---|---|
| sdk/backend | Lint + lint typecheck | `npm run lint` | `.` |
| sdk/backend | CI typecheck | `npx --no-install tsc --noEmit` | `.` |
| sdk/backend | Build | `npm run build` | `.` |
| sdk/backend | Packed/browser public contracts | `npm run test:contracts` after build | `.` |
| sdk/backend | Unit | `node --experimental-vm-modules node_modules/jest/bin/jest.js --testPathPatterns=tests/unit --runInBand --forceExit` | `.` |
| cli | Lint | `npm run lint` | `packages/cortex-cli` |
| cli | Typecheck | `npm run typecheck` | `packages/cortex-cli` |
| cli | Build and template sync | `npm run build` | `packages/cortex-cli` |
| cli | Unit | `npm run test:unit -- --runInBand` | `packages/cortex-cli` |
| provider | Typecheck | `npm run lint` | `packages/vercel-ai-provider` |
| provider | Build both exports | `npm run build` | `packages/vercel-ai-provider` |
| provider | Unit/React/mocked integration | `node --experimental-vm-modules ../../node_modules/jest/bin/jest.js --selectProjects unit unit-react integration --runInBand` | `packages/vercel-ai-provider` |
| demo | Lint | `npm run lint` | `packages/vercel-ai-provider/quickstart` |
| demo | Typecheck | `npx --no-install tsc --noEmit` | `packages/vercel-ai-provider/quickstart` |
| demo | Build | `npm run build` | `packages/vercel-ai-provider/quickstart` |
| demo | Unit/mocked integration | `npm test -- --runInBand` | `packages/vercel-ai-provider/quickstart` |
| basic template | Offline build | `npm run build` | `packages/cortex-cli/templates/basic` |
| basic template | Unit | `npm run test:unit` | `packages/cortex-cli/templates/basic` |
| chat template | Build/lint/unit | `npm run build`, `npm run lint`, `npm test` | `packages/cortex-cli/templates/chat-sdk-quickstart` |

Root setup uses `npm ci`; independent demo/template installs use their own lockfiles.
The basic template's `build:convex` deploys; it is not an offline quality check.
No blanket dependency updater, package release, production deployment or destructive
purge is a substitute for scoped validation.

### Service-dependent coverage

First identify a verified disposable development/test target and effective environment.
Root tests load `.env.test` and `.env.local` (the latter overrides values); inspect targets
without printing secrets. Managed vector behavior requires actual managed service evidence.
Graph and Gateway/LLM tests need their actual services and an approved bounded budget.

| Area | Command or evidence | Prerequisite |
|---|---|---|
| SDK/backend integration | `npm run test:local -- --runInBand` or `npm run test:managed -- --runInBand` | Verified test deployment and selected service prerequisites |
| CLI command/e2e | `npm run test:commands -- --runInBand`, `npm run test:e2e -- --runInBand` in CLI | Inspect actual selected tests; use dedicated disposable fixtures |
| Provider e2e | `npm run test:e2e -- --runInBand` in provider | Convex, verified identity and qualified inference |
| Demo e2e | `npm run test:e2e -- --runInBand` in canonical quickstart | Running test app/backend and qualified inference |
| Template flows | Basic integration/e2e scripts; chat `npm run test:e2e` | Their own installs, host-preservation fixtures and live test targets |
| Graph | `tests/graph/graphAdapter.test.ts` and changed outbox/service outcomes | Actual Neo4j/Memgraph; CI has dedicated containers |
| New runtime | Meaningful acceptance tests in the goal tasks | Gateway/Agent/Workflow, managed vectors, private assets and media as applicable |

Inspect `convex.json` and current CLI instructions before backend codegen/deploy changes.
A deploy key or URL alone does not establish that a target is disposable. Existing CI
uses dedicated shared test deployments and serializes full runs; do not concurrently
purge/redeploy those backends from the cloud session. Missing services/credentials/unsafe
targets are BLOCKED/incomplete, never PASS. Do not disable graph or skip media to claim
full goal completion. Continue independent work while a service-specific gate is blocked.

## 5. Code Patterns To Follow

| Concern | Existing reference | Purpose |
|---|---|---|
| SDK API | `src/memory/index.ts`, `src/memory/validators.ts` | Namespaced APIs, validation, error contracts |
| Tenant/auth boundary | `src/auth/context.ts`, `convex-dev/memories.ts` | Inventory current semantics; replace untrusted scope with verified grants for this runtime |
| Backend schema | `convex-dev/schema.ts`, `convex-dev/conversations.ts` | Validators, indexes and transaction conventions |
| Streaming/provider | `packages/vercel-ai-provider/src/provider.ts`, `packages/vercel-ai-provider/src/streaming-helpers.ts` | Lifecycle and cancellation references, not a second loop for backend runs |
| CLI | `packages/cortex-cli/src/index.ts`, `packages/cortex-cli/src/commands/` | Registration and exit behavior |
| Isolated test data | `tests/helpers/isolation.ts`, `tests/unit/memory/` | Unique owned fixtures and cleanup |
| Demo UI | `packages/vercel-ai-provider/quickstart/app/page.tsx` | Product flows and current app structure |

Hard rules: preserve tenant/space isolation and unrelated host data/config; validate external
input; never expose secrets; protect existing work; never weaken assertions to hide a defect;
keep active public exports/contracts consistent. Python parity and legacy data migrations
are excluded by user instruction. Existing code examples are evidence, not immutable design
constraints for the clean-slate backend runtime.

## 6. Domain / Reference Docs

| Topic | Reference | Read for |
|---|---|---|
| Repo operation | `AGENTS.md`, manifests, `.github/workflows/pr-checks.yml` | Current setup/check selection |
| Approved scope | `_research/convex-ai-gateway-2026-10-02/decision-gates.md` | User decisions override historical proposals |
| Architecture | `_research/convex-ai-gateway-2026-10-02/architecture.md` | Current versus proposed diagrams, ownership and technical gates |
| Implementation | `_goals/convex-backend-runtime-2026-10-02/goal.md`, `tasks/` | Ordered contracts, outcomes and dependencies |
| Data model | `convex-dev/schema.ts` | Current schema and prospective changes |
| Product docs | Package READMEs and sibling `cortexmemory.dev/docs-site/docs/` | Public semantics and new installation |
| Demo setup | `packages/vercel-ai-provider/quickstart/README.md`, `.env.local.example` | Actual app bootstrap |

## 7. Artifact Locations

Relative to the target repository, never an assumed desktop/cloud absolute path:

| Artifact | Location |
|---|---|
| Research prompt | `_research/prompts/topic.md` |
| Research report | `_research/topic/report.md` |
| Goal | `_goals/goal-name/goal.md` |
| Ordered tasks | `_goals/goal-name/tasks/NN-name.md` |
| QA evidence/reports | `_goals/goal-name/qa/` |

Markdown goals do not authorize the separate active-goal API. Record task state, decisions,
qualified locks, observed receipts, ownership and blockers in this goal tree.

## 8. UI QA Bootstrap

Use the canonical quickstart and independently selected changed template flows. Read each
README/environment example and install its own dependencies. The current demo requires
`CONVEX_URL`, `NEXT_PUBLIC_CONVEX_URL`, `OPENAI_API_KEY`; the new backend runtime should
replace upstream app-side inference keys with authenticated Cortex transport. Qualify the
new setup rather than treating the old variables as the final required contract.

Use a verified disposable backend and test identity. Reuse safe running services. Run
`npm run dev` in the canonical quickstart; inspect the actual ready port and browser render.
HTTP success alone does not certify chat, recall, reconnect, tool approvals or artifact
flows. Use available native browser tools, save real evidence and never invent screenshots.
Required browser access unavailable means UI QA incomplete. Browser/device tool execution
is outside the ordinary backend runtime; UI observation/approval remains in scope.

## 9. QA Modules

Full core QA covers the active product, excluding archived Python and unrelated repositories.
A scoped gate reports its selection; required service coverage cannot be skipped with PASS.

| Order | Module | Validation skill |
|---:|---|---|
| 1 | CLI | `.agents/skills/validate-cortex-cli/SKILL.md` |
| 2 | AI provider | `.agents/skills/validate-cortex-provider/SKILL.md` |
| 3 | Memory/backend | `.agents/skills/validate-cortex-memory/SKILL.md` |
| 4 | Auth/isolation | `.agents/skills/validate-cortex-isolation/SKILL.md` |
| 5 | Graph | `.agents/skills/validate-cortex-graph/SKILL.md` |
| 6 | Demo/UI | `.agents/skills/validate-cortex-demo/SKILL.md` |

Read-only/mocked checks precede live mutation. Use unique owned fixtures and cleanup;
never use real user memory as QA data. Missing service coverage blocks the relevant gate
and aggregate full success; it does not erase independent completed work.

## 10. Workflow Conventions

- Work autonomously within the user's requested scope. A pasted implementation prompt
  is the execution request; planning-only disclaimers describe artifact creation and do
  not require asking for the same permission again.
- Use feature-orchestrator with native bounded executors and fresh independent judges.
  Follow the real runtime's tools; report unavailable independent gates honestly.
- Preserve dirty work and disjoint delegated ownership. Serialize overlapping provider,
  demo, CLI and generated-mirror edits. No broad workspace formatting/update.
- Current authorization covers creating/committing/pushing this planning branch. Future
  implementation commits/draft PRs follow the human's pasted prompt; package publication,
  releases, production deployment and PR merging require separate authorization.
- Product decisions in the decision register are settled. Ask only for missing credentials,
  a safe target/budget, or a consequential technical conflict that cannot be resolved
  consistently with the approved scope. Continue independent authorized work meanwhile.
- Only observed checks/reviews count as PASS. Keep pre-existing defects separate, fix
  task-related failures, and never silently drop scoped features to obtain a green label.
