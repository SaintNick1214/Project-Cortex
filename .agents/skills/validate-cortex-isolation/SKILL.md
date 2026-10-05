---
name: validate-cortex-isolation
description: Validate Cortex authentication, authorization, tenant and memory-space isolation with negative cases for protected changes or the core QA gate.
---

# Cortex Isolation Validation

Read `.agents/CODEX-RUNTIME.md` and Profile §§4, 8, 9. Resolve all paths against the
profile root. Inspect test setup and verify disposable targets before any service test.

## Validation

Read `src/auth/`, `Documentation/security/isolation-boundaries.mdx`, and relevant Convex
scope filters. Run applicable SDK unit auth checks and service-dependent isolation suites
including `tests/tenant-isolation.test.ts` on a verified disposable test deployment.
Verify tenant A cannot read/write/delete tenant B data, memory-space isolation, authorized
identity propagation, and denied/invalid input cases covered by the changed behavior.
Inspect real assertions; mocked tests alone do not certify backend access control.
Use separate unique test tenants and remove only test-created data. Record coverage gaps.

## Report

Return module PASS / FAIL / BLOCKED, scope and revision, each required step's command,
cwd, exit code and evidence, requirements covered, introduced vs baseline failures,
unavailable checks, mutations, and cleanup/restoration. No required step may disappear.
PASS requires all selected requirements verified and cleanup complete. Report failure
or missing prerequisite to qa-orchestrator; never weaken expectations to obtain a pass.
