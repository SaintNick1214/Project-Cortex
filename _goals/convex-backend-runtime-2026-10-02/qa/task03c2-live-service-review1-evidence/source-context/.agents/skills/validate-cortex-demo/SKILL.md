---
name: validate-cortex-demo
description: Validate Cortex quickstart demo build, route tests, and live browser chat and memory flows when the demo changes or the core gate is requested.
---

# Cortex Demo Validation

Read `.agents/CODEX-RUNTIME.md` and Profile §§4, 8, 9. Resolve all paths against the
profile root. Inspect test setup and verify disposable targets before any service test.

## Validation

Read quickstart README, app routes, components, and Jest projects. Run Profile §4 demo
typecheck/build and unit/mocked integration tests. Start or reuse the safe UI per §8.
Invoke ui-qa-orchestrator for changed UI or the primary demo flow during a full core gate.
For full coverage, include actual chat submission, streaming response, persisted recall,
loading/error behavior, and demo e2e tests with verified Convex + authorized LLM access.
Do not invent a seeded login, API key, or bypass. Use a test-owned memory space and remove
created data. Page rendering without backend/LLM access is partial evidence only.

## Report

Return module PASS / FAIL / BLOCKED, scope and revision, each required step's command,
cwd, exit code and evidence, requirements covered, introduced vs baseline failures,
unavailable checks, mutations, and cleanup/restoration. No required step may disappear.
PASS requires all selected requirements verified and cleanup complete. Report failure
or missing prerequisite to qa-orchestrator; never weaken expectations to obtain a pass.
