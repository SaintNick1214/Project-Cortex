---
name: validate-cortex-graph
description: Validate Cortex graph adapters and synchronization with actual graph service evidence for graph changes or the full core QA gate.
---

# Cortex Graph Validation

Read `.agents/CODEX-RUNTIME.md` and Profile §§4, 8, 9. Resolve all paths against the
profile root. Inspect test setup and verify disposable targets before any service test.

## Validation

Read `src/graph/README.md`, adapter/sync implementation, `tests/graph/`, and applicable
Python graph tests. Separate mocked adapter checks from real Neo4j/Memgraph synchronization.
Run Profile §4 affected SDK/Python quality checks, then the graph suites required by the
change/full gate using verified disposable Convex and graph targets. Full SDK tests may
already supply receipts; reuse current receipts only when they actually include graph
coverage at the same revision. Inspect configuration and effective URLs without secrets.
Never disable graph sync and call real graph behavior verified. Confirm node/edge scope,
retry behavior, orphan cleanup, and connection lifecycle when affected. Missing reachable
graph services are BLOCKED. Clean only test-owned nodes/edges and verify cleanup.

## Report

Return module PASS / FAIL / BLOCKED, scope and revision, each required step's command,
cwd, exit code and evidence, requirements covered, introduced vs baseline failures,
unavailable checks, mutations, and cleanup/restoration. No required step may disappear.
PASS requires all selected requirements verified and cleanup complete. Report failure
or missing prerequisite to qa-orchestrator; never weaken expectations to obtain a pass.
