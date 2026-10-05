---
name: validate-cortex-python
description: Validate Cortex Python SDK quality, public contract parity, and service-dependent pytest evidence for Python changes or the core gate.
---

# Cortex Python Validation

Read `.agents/CODEX-RUNTIME.md` and Profile §§4, 8, 9. Resolve all paths against the
profile root. Inspect test setup and verify disposable targets before any service test.

## Validation

Read Python `pyproject.toml`, `Makefile`, client and changed namespaces, and the matching
TypeScript API contract. Run Profile §4 ruff/mypy checks with the repository venv.
Select local or managed tests only after checking the effective disposable target and
applicable graph/LLM prerequisites. Run the documented make test command with venv PATH.
This runner is service-dependent; missing services are BLOCKED, not offline unit success.
Review changed public behavior and TS/Python parity, async cleanup, validation, and errors.
Use existing pytest isolation/cleanup conventions and report failed restoration.

## Report

Return module PASS / FAIL / BLOCKED, scope and revision, each required step's command,
cwd, exit code and evidence, requirements covered, introduced vs baseline failures,
unavailable checks, mutations, and cleanup/restoration. No required step may disappear.
PASS requires all selected requirements verified and cleanup complete. Report failure
or missing prerequisite to qa-orchestrator; never weaken expectations to obtain a pass.
