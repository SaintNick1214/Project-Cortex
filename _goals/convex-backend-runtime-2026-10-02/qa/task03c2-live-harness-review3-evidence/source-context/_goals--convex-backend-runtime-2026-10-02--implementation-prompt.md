# Cloud implementation prompt

Select `SaintNick1214/Project-Cortex` and `feat/convex-backend-runtime`, then paste this
prompt. The branch contains the existing agreed plan and its orchestration instructions;
product implementation has not started.

```text
Implement the approved Cortex backend-runtime plan in SaintNick1214/Project-Cortex on branch feat/convex-backend-runtime. This is authorization to implement; reuse the saved plan and settled product decisions. Planning-only disclaimers describe when the files were written and do not override this request.

First read AGENTS.md, .agents/CODEX-RUNTIME.md and .agents/PROJECT-PROFILE.md. Then read:
- _research/convex-ai-gateway-2026-10-02/decision-gates.md (authoritative decisions).
- _research/convex-ai-gateway-2026-10-02/architecture.md (architecture and technical gates).
- _goals/convex-backend-runtime-2026-10-02/goal.md and every file in its tasks/ directory.
- .agents/skills/feature-orchestrator/SKILL.md.

Inspect Git status and manifests, preserve unrelated work, and verify reconciled dev commit 3341d64ddc06f1de26ed525312ef2c1b89b16952 is an ancestor. Resolve paths against your checkout, not historical desktop paths. Use Node >=24.15.0 and the declared npm 12.2.0 toolchain.

Follow feature-orchestrator: fresh independent goal review, bounded delegated implementation, independent task reviews, affected quality/module/UI checks and final audit. Earlier planning PASS reports cover superseded scope. Start with Task 01 technical qualification, complete the text slice in Tasks 01-09, then the remaining extensions and integration through Task 17. Verify current official API/package contracts as needed; do not silently drop approved capabilities or substitute another architecture.

Keep the agreed pillars: Cortex/Convex owns orchestration and asynchronous memory; one authoritative transcript with tracked administrator unlocks; indexed memory plus authorized pending context and scoped strict barriers; per-function model/capability/budget policy for every billable call; clean-slate embeddings; retained Cortex artifacts with Gateway image/video jobs and Convex-only delivery capped at 20,000,000 bytes; verified identity/grants and background revocation/deletion; additive host installation; modern TypeScript/AI SDK 7 clients, CLI, demo and templates.

Exclude Decisions/Jev, Python, legacy compatibility/data/deployment/embedding migrations, external media storage, image understanding/visual embeddings, unrelated sibling applications, production deployment and package releases. Canonical website docs live in cortexmemory.dev/docs-site/docs in a separate repository; do not restore Documentation/. If website access is unavailable, prepare a reviewable documentation patch/handoff and identify remaining coverage.

Use verified disposable test targets and owned fixtures. Bounded paid inference needs an approved target/budget; request missing credentials or target details when necessary and continue independent work. Do not purge/redeploy shared CI backends concurrently. Run the full active core quality/module gate plus affected browser/template flows. Record task status, decisions, review verdicts, real test receipts and blockers under the goal's qa/ directory; mocked/skipped/unavailable service coverage is not PASS.

Make incremental commits, push this feature branch, and open a draft PR against dev when reviewable. Do not merge, release packages or deploy production. Continue until the scoped implementation and validation are complete, or clearly identify the external blocker and completed independent work. Report final behavior, checks, remaining coverage and the PR link.
```
