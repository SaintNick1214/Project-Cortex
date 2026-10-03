---
name: validate-cortex-provider
description: Validate Cortex AI provider core and React exports, middleware, streaming, and integration evidence for provider changes or the core gate.
---

# Cortex Provider Validation

Read `.agents/CODEX-RUNTIME.md` and Profile §§4, 8, 9. Resolve all paths against the
profile root. Inspect test setup and verify disposable targets before any service test.

## Validation

Read provider exports, `provider.ts`, stream helpers, React entry point, and Jest config.
Run Profile §4 provider typecheck/build and all selected unit, unit-react, and mocked
integration projects. Do not use only test:unit and silently omit React hooks.
Check stream completion, cancellation, errors, memory scope, and artifact lifecycle when
affected. A full gate also requires provider e2e on verified Convex + LLM test services.
Record service-dependent gaps and restore test-owned data.

## Report

Return module PASS / FAIL / BLOCKED, scope and revision, each required step's command,
cwd, exit code and evidence, requirements covered, introduced vs baseline failures,
unavailable checks, mutations, and cleanup/restoration. No required step may disappear.
PASS requires all selected requirements verified and cleanup complete. Report failure
or missing prerequisite to qa-orchestrator; never weaken expectations to obtain a pass.
