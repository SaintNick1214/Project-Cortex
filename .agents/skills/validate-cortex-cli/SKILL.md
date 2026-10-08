---
name: validate-cortex-cli
description: Validate Cortex CLI commands, scaffold behavior, and unit/e2e evidence when CLI changes or the core QA gate is requested.
---

# Cortex Cli Validation

Read `.agents/CODEX-RUNTIME.md` and Profile §§4, 8, 9. Resolve all paths against the
profile root. Inspect test setup and verify disposable targets before any service test.

## Validation

Read CLI registration, the command files in scope, and `packages/cortex-cli/jest.config.js`.
Run Profile §4 CLI lint/typecheck/build and unit checks. Build SDK first when required.
For a full gate, also run commands and e2e suites on an inspected disposable test target.
Verify init/template behavior in a unique temporary output directory; do not overwrite
existing projects. Review CLI prebuild template-sync diffs. Check expected help/exit/error
behavior against the changed commands. Remove only temporary artifacts owned by this run.

## Report

Return module PASS / FAIL / BLOCKED, scope and revision, each required step's command,
cwd, exit code and evidence, requirements covered, introduced vs baseline failures,
unavailable checks, mutations, and cleanup/restoration. No required step may disappear.
PASS requires all selected requirements verified and cleanup complete. Report failure
or missing prerequisite to qa-orchestrator; never weaken expectations to obtain a pass.
