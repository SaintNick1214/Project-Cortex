# Canonical backend-runtime docs execution report

## Status: Content complete; offline checks pass; continuing review/browser QA pending

The isolated website worktree `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-docs` contains the canonical upcoming-release documentation batch: 88 existing pages rewritten, four pages added, 94 pages total. License and code-of-conduct pages are preserved. All 90 original page IDs/paths remain. The 12 category JSON files remain unchanged.

SDK/CLI/provider are 0.39.0; independent catalog is 1.3.0 and current Basic/Vercel application payloads are 1.4.0 and Chat SDK is 1.4.1. Registry publication, website publication and production deployment are not claimed. Convex async-video access is documented once as a setup prerequisite; no actual async-video acceptance or original goal criterion is changed by the docs assumption.

## Requirements checklist

- [x] Entry/getting-started/what’s-new uses ordinary backend Agent/Workflow/Gateway execution.
- [x] Canonical transcript, admin locks, tracked revisions, source provenance and stale-work fencing.
- [x] Asynchronous facts/chunks/vectors, eligible pending context, contiguous watermarks and explicit stage barriers.
- [x] Every primary/secondary billable operation, interface/capability/version/model controls, budgets, unknown costs, replay and safe fallback.
- [x] Verified host JWTs, trusted current grants, revocation/expiry/deletion/tombstones and protected view cleanup.
- [x] Additive install/register/configure, trusted principal JSON, auth configuration, executable Agent setup and independent update channels.
- [x] Current profile/query embedding contracts and authorized optional graph worker/connector lifecycle.
- [x] Private Convex assets, 20,000,000-byte bound, durable image/video jobs, signed callbacks, saved-operation recovery and no blind retry.
- [x] Browser-safe TypeScript and AI SDK 7 remote transport/UI, plus Basic/Vercel/ChatSDK application paths.
- [x] Lower-level explicit SDK/admin reference retains exact method/overload notation, source-derived fields/defaults/results/errors and supported operation examples across 15 namespaces plus the administrative graph appendix.
- [x] Legacy local provider helpers explicitly separated as advanced administrative compatibility; Python runtime/parity not invented.
- [x] Dirty primary `sidebars.ts` and original untracked `backend-runtime.mdx` hashes preserved.
- [x] Meaningful content/link/version/API and compiler checks completed.
- [ ] Root-owned real browser navigation/code/render QA (final stable build ready; not performed by this executor).
- [ ] Continuing independent completeness/content review (substantive repairs complete; outcome owned by reviewer).

## Verification

| Check | Command and cwd | Observed result |
| --- | --- | --- |
| Dependencies | `npm ci`, isolated `docs-site` | Exit 0, selected Node 24.15/npm 12.2 |
| Site TypeScript | `npm run typecheck`, isolated `docs-site` | Exit 0 |
| MDX + internal URLs/anchors + static render | `npm run build`, isolated `docs-site` | Exit 0, Docusaurus 3.9.2, client/server compiled, static files generated |
| Runnable documentation examples | Core TypeScript compiler with `docs-execution/examples-tsconfig.json` | Exit 0, all 32 TS/TSX examples against stable built declarations |
| Content/link audit | Read-only Markdown/ID/version audit | 94 pages, 351 current relative targets valid; all 87 dated released headings preserved, zero changed original IDs/stale default patterns, one video prerequisite |
| Actual CLI entry | Built CLI `backend --help`, core cwd | Exit 0, commands/options confirmed |
| Whitespace | `git diff --check`, isolated website cwd | Exit 0 |
| Primary inputs | SHA-256 comparison to pre-edit receipts | Both unchanged |

The first build surfaced an introduced footer route mismatch; `/integrations/` was restored and the final strict-link build passes. The renderer config elevates broken URLs/Markdown/anchors to errors and repairs the duplicated docs path in GitHub edit links. The retained failed build log is historical evidence, not a passing check.

The docs lock reports existing npm audit findings and old Browserslist data. Dependencies/lockfiles were not changed; no broad update was attempted. The example compiler validates interfaces rather than paid/native service behavior; `skipLibCheck` covers dependency declaration internals, while all example calls remain under strict TypeScript checking. Core public package qualification is Root-owned.

## Continuing substantive repair

The same coherent review found that initial signature-only pages had lost valid operational detail. The repair restores memory ownership/content validation and enriched results, fact matching strategies/default thresholds and belief-revision outcomes, fixed administrative export/erasure setup and completion/receipt semantics, supported context/history/pagination/transaction operations, every other explicit namespace's parameter/result fields and supported examples, graph adapter lifecycle/read/traversal/CRUD and managed-v2 rebuild/erasure boundaries, and exact auth helper returns/validation. Unsupported compatibility options (local Agent cascade, manual governance enforcement, cloud auto flags and idle cleanup) are qualified against current implementation.

The historical What's New section preserves all 87 released headings, including unique provider/template package records. The two old unreleased 0.37/0.38 entries are superseded by upcoming 0.39.0; future historical roadmap claims were not restored. Historical snippets are explicitly reference text and do not recommend old application loops or current Python runtime parity.

The runtime example retains caller-created submit identity before dispatch and applies private-view cleanup to both observer and direct authority errors. All current TS/TSX examples compile, including private staged export completion, fixed erasure cleanup, manual graph reads and a managed rebuild. A compiler check exposed an invalid agent `getStats` call; it was removed in favor of the actual registry API. The final graph appendix introduced one trailing blank line, removed by the whitespace check without affecting rendered content.

The first reference-repair build exposed a nonexistent feature link; the next build exposed a missing auth-page anchor. Both are corrected, failed logs retained, and the final build passes throw-level URL/Markdown/anchor checks. Current core source is `5ba0046864839ccbcff55ea3515951e90276243c`; the public declaration hashes used for compilation are recorded separately. Root owns final clean-source/package/service qualification. No credentials, paid generation, publishing or deployment was performed by this executor.

Browser review subsequently found a copy-paste setup omission. The setup block now shows `backend install --plan` and `backend install` before register/provision, with the host SDK dependency/report prerequisite explicit. The strict docs build was rerun after that correction and exits 0; unchanged TypeScript examples retain their passing receipt.

## Evidence

- `inventory-before.json`: all 102 original docs files, headings, IDs and hashes.
- `api-source-inventory.json`, `type-source-inventory.json`, `reference-repair-map.json`: current method/field/source coverage and repaired route map.
- `page-changes.json`: final page actions/hashes.
- `examples-inventory.json`, `examples/*.ts[x]`, `examples-tsconfig.json`, `examples-typecheck.log`: all runnable snippets and compiler receipt.
- `source-check-receipt.json`: selected versions, source contracts and built declaration hashes.
- `content-link-audit.json`: current local links, IDs, default-pattern and access-prerequisite checks.
- `npm-ci.log`, `docusaurus-typecheck.log`, `docusaurus-build.log`, `cli-backend-help.log`, `*-result.json`: observed check logs and final exit-code receipts.
- `preserved-inputs.json`, `preserved-input-verification.json`: untouched primary inputs.

## Browser handoff

From `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-docs/docs-site`, serve `build` with the selected toolchain:

```bash
PATH=/Users/SaintNick/.codex/tmp/cortex-runtime-toolchain-20261005/node_modules/.bin:$PATH npm run serve -- --host 127.0.0.1 --port 3109
```

Representative routes: `/`, `/getting-started/backend-runtime`, `/getting-started/installation`, `/api-reference/runtime-client`, `/architecture/model-policy`, `/core-features/assets-and-media`, `/integrations/vercel-ai-sdk/getting-started`, `/security/authentication`, `/tools/cli-reference`, `/api-reference/memory-operations`, `/api-reference/facts-operations`, `/api-reference/user-operations`, `/api-reference/graph-operations`, `/reference/types-interfaces` and `/whats-new#historical-releases`. Check sidebar/top navigation, code rendering/copy, tables, Mermaid, desktop/mobile layout and links. Root owns server/browser lifecycle.

## Files modified

All content writes are under the isolated website's `docs-site/docs/**/*.mdx`, plus `sidebars.ts` and the strict-link/anchor checks and corrected edit URL in `docusaurus.config.ts`. No main-site/source product files or Git state were changed by this executor.

| Page | Action |
| --- | --- |
| `docs-site/docs/advanced-topics/a2a-communication.mdx` | modified |
| `docs-site/docs/advanced-topics/context-chains.mdx` | modified |
| `docs-site/docs/advanced-topics/fact-integration.mdx` | modified |
| `docs-site/docs/advanced-topics/facts-vs-conversations.mdx` | modified |
| `docs-site/docs/advanced-topics/graph-capabilities.mdx` | modified |
| `docs-site/docs/advanced-topics/graph-database-integration.mdx` | modified |
| `docs-site/docs/advanced-topics/graph-integration.mdx` | modified |
| `docs-site/docs/advanced-topics/orchestration-observer.mdx` | modified |
| `docs-site/docs/advanced-topics/sessions-management.mdx` | modified |
| `docs-site/docs/api-reference/a2a-communication.mdx` | modified |
| `docs-site/docs/api-reference/agent-management.mdx` | modified |
| `docs-site/docs/api-reference/artifacts-operations.mdx` | modified |
| `docs-site/docs/api-reference/attachments-operations.mdx` | modified |
| `docs-site/docs/api-reference/auth-context-api.mdx` | modified |
| `docs-site/docs/api-reference/context-operations.mdx` | modified |
| `docs-site/docs/api-reference/conversation-operations.mdx` | modified |
| `docs-site/docs/api-reference/facts-operations.mdx` | modified |
| `docs-site/docs/api-reference/governance-policies-api.mdx` | modified |
| `docs-site/docs/api-reference/graph-operations.mdx` | modified |
| `docs-site/docs/api-reference/immutable-store-api.mdx` | modified |
| `docs-site/docs/api-reference/memory-operations.mdx` | modified |
| `docs-site/docs/api-reference/memory-space-operations.mdx` | modified |
| `docs-site/docs/api-reference/mutable-store-api.mdx` | modified |
| `docs-site/docs/api-reference/overview.mdx` | modified |
| `docs-site/docs/api-reference/runtime-client.mdx` | created |
| `docs-site/docs/api-reference/sessions-operations.mdx` | modified |
| `docs-site/docs/api-reference/user-operations.mdx` | modified |
| `docs-site/docs/architecture/agent-registry.mdx` | modified |
| `docs-site/docs/architecture/context-chain-design.mdx` | modified |
| `docs-site/docs/architecture/convex-integration.mdx` | modified |
| `docs-site/docs/architecture/data-models.mdx` | modified |
| `docs-site/docs/architecture/governance-policies.mdx` | modified |
| `docs-site/docs/architecture/infinite-context.mdx` | modified |
| `docs-site/docs/architecture/model-policy.mdx` | created |
| `docs-site/docs/architecture/performance.mdx` | modified |
| `docs-site/docs/architecture/resilience-layer.mdx` | modified |
| `docs-site/docs/architecture/search-strategy.mdx` | modified |
| `docs-site/docs/architecture/security-privacy.mdx` | modified |
| `docs-site/docs/architecture/system-overview.mdx` | modified |
| `docs-site/docs/architecture/vector-embeddings.mdx` | modified |
| `docs-site/docs/core-features/artifacts.mdx` | modified |
| `docs-site/docs/core-features/assets-and-media.mdx` | created |
| `docs-site/docs/core-features/conversation-history.mdx` | modified |
| `docs-site/docs/core-features/fact-extraction.mdx` | modified |
| `docs-site/docs/core-features/hive-mode.mdx` | modified |
| `docs-site/docs/core-features/index.mdx` | modified |
| `docs-site/docs/core-features/memory-orchestration.mdx` | modified |
| `docs-site/docs/core-features/memory-spaces.mdx` | modified |
| `docs-site/docs/core-features/semantic-search.mdx` | modified |
| `docs-site/docs/core-features/streaming-support.mdx` | modified |
| `docs-site/docs/core-features/user-profiles.mdx` | modified |
| `docs-site/docs/getting-started/auth-integration.mdx` | modified |
| `docs-site/docs/getting-started/backend-runtime.mdx` | created |
| `docs-site/docs/getting-started/configuration.mdx` | modified |
| `docs-site/docs/getting-started/core-concepts.mdx` | modified |
| `docs-site/docs/getting-started/five-minute-quickstart.mdx` | modified |
| `docs-site/docs/getting-started/index.mdx` | modified |
| `docs-site/docs/getting-started/installation.mdx` | modified |
| `docs-site/docs/getting-started/introduction.mdx` | modified |
| `docs-site/docs/index.mdx` | modified |
| `docs-site/docs/integrations/auth-providers.mdx` | modified |
| `docs-site/docs/integrations/index.mdx` | modified |
| `docs-site/docs/integrations/vercel-ai-sdk/advanced-usage.mdx` | modified |
| `docs-site/docs/integrations/vercel-ai-sdk/api-reference.mdx` | modified |
| `docs-site/docs/integrations/vercel-ai-sdk/getting-started.mdx` | modified |
| `docs-site/docs/integrations/vercel-ai-sdk/hive-mode.mdx` | modified |
| `docs-site/docs/integrations/vercel-ai-sdk/index.mdx` | modified |
| `docs-site/docs/integrations/vercel-ai-sdk/memory-spaces.mdx` | modified |
| `docs-site/docs/integrations/vercel-ai-sdk/migration-from-mem0.mdx` | modified |
| `docs-site/docs/integrations/vercel-ai-sdk/troubleshooting.mdx` | modified |
| `docs-site/docs/project/contributing.mdx` | modified |
| `docs-site/docs/project/project-overview.mdx` | modified |
| `docs-site/docs/project/security.mdx` | modified |
| `docs-site/docs/reference/cheat-sheet.mdx` | modified |
| `docs-site/docs/reference/error-handling.mdx` | modified |
| `docs-site/docs/reference/patterns-and-practices.mdx` | modified |
| `docs-site/docs/reference/types-interfaces.mdx` | modified |
| `docs-site/docs/roadmap/a2a-communication.mdx` | modified |
| `docs-site/docs/roadmap/access-analytics.mdx` | modified |
| `docs-site/docs/roadmap/api-enhancements.mdx` | modified |
| `docs-site/docs/roadmap/cloud-mode.mdx` | modified |
| `docs-site/docs/roadmap/context-chains.mdx` | modified |
| `docs-site/docs/roadmap/governance.mdx` | modified |
| `docs-site/docs/roadmap/index.mdx` | modified |
| `docs-site/docs/roadmap/infinite-context.mdx` | modified |
| `docs-site/docs/roadmap/mcp-server.mdx` | modified |
| `docs-site/docs/security/admin-operations.mdx` | modified |
| `docs-site/docs/security/authentication.mdx` | modified |
| `docs-site/docs/security/index.mdx` | modified |
| `docs-site/docs/security/isolation-boundaries.mdx` | modified |
| `docs-site/docs/tools/cli-reference.mdx` | modified |
| `docs-site/docs/whats-new.mdx` | modified |
| `docs-site/sidebars.ts` | modified: canonical paths and previously hidden reference/index/admin pages |
| `docs-site/docusaurus.config.ts` | modified: broken URL/Markdown checks fail the build |
