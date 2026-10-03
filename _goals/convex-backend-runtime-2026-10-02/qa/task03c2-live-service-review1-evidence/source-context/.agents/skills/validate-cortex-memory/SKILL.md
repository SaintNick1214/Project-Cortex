---
name: validate-cortex-memory
description: Validate Cortex memory and Convex persistence, conversations, facts, and retrieval behavior for core API changes or the full core QA gate.
---

# Cortex Memory Validation

Read `.agents/CODEX-RUNTIME.md` and Profile §§4, 8, 9. Resolve all paths against the
profile root. Inspect test setup and verify disposable targets before any service test.

## Validation

Read `src/memory/index.ts`, `convex-dev/schema.ts`, and changed backend/SDK modules.
Run Profile §4 sdk/backend checks, then required integration coverage on a verified
isolated test deployment. Use existing suites such as `tests/memory-core.test.ts`,
`tests/memory-orchestration.test.ts`, and conversation/fact/streaming suites as relevant;
a full core gate requires the full selected SDK suite, not only these examples.
Verify persisted reads/writes, scope, metadata, streaming/error handling, and retrieval
semantics against changed requirements. Managed vector search needs managed coverage;
local Convex success alone cannot certify it. Use TestRunContext and test-owned cleanup.

## Report

Return module PASS / FAIL / BLOCKED, scope and revision, each required step's command,
cwd, exit code and evidence, requirements covered, introduced vs baseline failures,
unavailable checks, mutations, and cleanup/restoration. No required step may disappear.
PASS requires all selected requirements verified and cleanup complete. Report failure
or missing prerequisite to qa-orchestrator; never weaken expectations to obtain a pass.
