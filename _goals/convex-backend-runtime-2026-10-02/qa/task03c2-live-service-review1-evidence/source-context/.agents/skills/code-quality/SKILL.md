---
name: code-quality
description: Run Cortex quality checks for affected stacks and dependencies, or a requested full core gate, using the project profile. Fix task-related failures and report unavailable checks honestly.
---

# Code Quality

Read `.agents/CODEX-RUNTIME.md` and Profile §4. The profile declares the exact commands,
working directories, prerequisites, and selection rules. Inspect manifests and CI if
commands have drifted; record any necessary correction.

1. Select affected stacks and dependency checks for normal implementation. A requested
   full core gate selects every core stack. A configuration/documentation-only install
   uses installation validation instead of application builds or service tests.
2. Before each check, verify tooling and any required generated files/services/test target.
   Credentials are not proof of a safe test deployment. Do not deploy, migrate, seed,
   publish, or run paid calls solely to make a gate green without relevant authorization.
3. Run each selected required check, cheapest-first within dependencies; independent
   read-only checks may run concurrently. Capture command, cwd, exit status, counts,
   and concise errors. No selected required check may disappear from the report.
4. For introduced failures, fix the smallest task-related defect, rerun the failed check,
   and rejudge when invoked by an orchestrator. Limit repairs for the same issue to three.
   Keep unrelated failures separate; do not change them unless the request covers them.
   Do not change test assertions merely to hide defects.
5. Finish with per-check PASS / FIXED / FAIL / BLOCKED and an overall verdict.
   PASS requires every selected required check to have passed. Otherwise report FAIL
   (observed failure) or INCOMPLETE (unavailable required evidence), with the reason.

Run full integration, graph, and paid-LLM coverage only on a verified disposable target
under the requested scope. If required but unavailable, report BLOCKED. Builds may
produce generated files; inspect Git status and protect unrelated edits.
