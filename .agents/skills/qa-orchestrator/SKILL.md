---
name: qa-orchestrator
description: Run the full Cortex core module-validation gate or explicitly scoped module QA, aggregate evidence, and return SUCCESS or FAILURE with coverage and blockers.
---

# QA Orchestrator

Read `.agents/CODEX-RUNTIME.md` and Profile §9. A full core gate runs every listed core
module validator. A scoped request selects affected modules and identifies its coverage;
it never counts as a full core gate. Sibling products require their own module inventory.
If §9 is genuinely N/A, report NOT APPLICABLE rather than an unexplained success.

For each selected module, in profile order:
1. Read its validation skill, prerequisites, safe test-target constraints, and setup.
2. Use a native Codex child for a bounded module when useful; this workflow explicitly
   permits module delegation. Serialize shared service/browser mutation and cleanup.
3. Execute all required steps, capture raw receipts/evidence, and record PASS / FAIL /
   BLOCKED. Do not substitute unit checks for required integration behavior.
4. Retain module reports independently, including cleanup and unavailable evidence.

Delegate a fresh read-only pessimistic judge to inspect coverage and receipts, especially
when module results were supplied by implementers. Report concrete findings.
Aggregate SUCCESS only if every selected module and required review passes; any FAIL,
BLOCKED, missing required evidence, or failed cleanup yields FAILURE. Include scope,
module verdicts, commands, issues, blockers, and evidence paths. Never skip a failing module
because another passed. For issues, hand concrete fix tasks to the feature resolution
loop, then rerun the failed module and review before success.
