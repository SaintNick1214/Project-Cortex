---
name: ui-qa-orchestrator
description: Perform browser QA of changed Cortex UI elements and affected flows, with a reviewed test plan and independent evidence judgment. Use only when UI work is in scope.
---

# UI QA Orchestrator

Read `.agents/CODEX-RUNTIME.md`, Profile §8, `roles/qa-judge.md`, and judge-qa.
Explicitly delegate browser testing and independent judgment using available native
Codex children. Use native browser tools as documented, not editor-specific tool names.
If the target has no UI, report NOT APPLICABLE. If a required browser tool or safe app
setup is unavailable, report QA INCOMPLETE with the missing prerequisite.

## 1. Change manifest

Read goal/tasks or the verified task diff/baseline. Map changed files to pages, components,
endpoints, and complete affected user flows. If using a diff, state the baseline and
coverage limits. Include the target repository and safe test URL.

## 2. Environment

Reuse or start the selected app per Profile §8, verifying ports, auth, readiness, and
health. Do not start unrelated sibling apps. Retry a transient setup failure once;
otherwise report failure. Do not infer credentials or create an authentication bypass.

## 3. Census and reviewed plan

For each affected page, capture an actual screenshot and available accessibility state.
Inventory interactive elements with label, state, expected behavior, and evidence ref.
Plan meaningful interactions, affected modal controls, keyboard paths, loading, populated,
empty, and error states, and full affected flows. Do not trigger destructive or external
side effects for unrelated unchanged controls merely to cover every visible element.

Spawn a fresh QA judge with the change manifest, census, and proposed plan. Require
PASS / NEEDS REVISION / REJECT. Fix omissions and rejudge, up to three cycles.
Only PASS permits a certified plan; exhausted retries leave the gate incomplete.

## 4. Element and flow testing

Give each bounded browser child absolute context/evidence paths and permitted actions.
Serialize children sharing a tab/session. For each planned interaction capture before
state, action, after state, expected vs actual, and available console/network evidence.
Test off-screen and modal elements; reset navigation/state between independent checks.
For each flow verify each step, recording where it blocks. Restore only test-owned data
and stop only processes this run owns. Record cleanup and unavailable telemetry explicitly.

## 5. Judgment and report

Delegate fresh read-only QA judges for page and flow evidence, then a cross-page audit
of shared chrome, navigation, language, and loading/error/state consistency. Apply
judge-qa dimensions and thresholds. Baseline claims need baseline evidence.
Only all PASS judgments and an APPROVED cross-page audit with complete required evidence
permit PASS. Otherwise return ISSUES FOUND, REJECT, or INCOMPLETE as supported.

Retain page/flow tables, counts, concrete expected/actual issues with evidence paths,
severity, likely source files, console/network findings, blockers, and cleanup.
Hand issues to implementation-executor plus pessimistic-judge via the feature loop;
rerun affected UI QA after fixes. Do not self-certify fixes or bypass a failed gate.
