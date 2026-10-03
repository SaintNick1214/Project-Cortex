---
name: feature-orchestrator
description: Plan and implement substantial Cortex features across affected layers using delegated execution and independent judge gates. Use for multi-step feature work, not small isolated edits.
---

# Feature Orchestrator

Read `.agents/CODEX-RUNTIME.md` and `.agents/PROJECT-PROFILE.md` first. This workflow
explicitly delegates implementation and independent judgment to native Codex subagents.
Use `templates/goal.md` and `templates/task.md` in this skill directory.

## 1. Align

Extract requirements, scope, affected repositories/layers, constraints, and acceptance
criteria from the request and code. Ask only consequential unanswered questions. Record
assumptions and routine choices; proceed on the existing authorization per Profile §10.
If prebuilt goal/tasks exist, read them and reconcile with the latest user request.
Reuse their planning, but still run the goal judge before execution.

## 2. Plan

Create a goal and ordered tasks at Profile §7 locations. Cover each affected layer in
Profile §3 with concrete files, exemplars, dependencies, requirements, acceptance checks,
and relevant reference documents. Tests may be embedded in implementation tasks.
Do not create redundant tasks merely to match the layer list. Document consequential
tradeoffs and resolve any required user choices before dependent work.

## 3. Judge the plan

Spawn a fresh read-only pessimistic judge with absolute paths to the profile,
`roles/pessimistic-judge.md`, `skills/judge-goal/SKILL.md`, original requirements, goal,
and all task files. Ask for the rubric's dimension scores, evidence, and
PASS / NEEDS REVISION / REJECT. Inspect the actual result.

Only PASS permits execution. For NEEDS REVISION or a repairable REJECT, revise cited
problems and rejudge with a fresh agent. At most three total judge cycles; unresolved
issues remain incomplete and are reported. Never proceed best-effort through a failed gate.

## 4. Implement and judge each task

In dependency order, spawn implementation-executor with its role path, full requirements,
allowed files, exemplars, acceptance criteria, prerequisite results, and selected quality
checks. Parallelize only independent tasks with nonoverlapping permitted writes.
Read the completion report and inspect changed files.

Then spawn a fresh read-only pessimistic judge using judge-task, original task criteria,
actual changed files, and execution receipts. Review every requirement, wiring/export,
behavioral correctness, test outcomes, and pattern adherence.
Only PASS marks the task complete. Otherwise send concrete feedback to an executor,
inspect the fix, and launch a fresh judge. Maximum three implementation/judge cycles.
Do not weaken requirements or assertions just to pass.

## 5. Quality, final audit, and QA

Run `$code-quality` for the affected stacks and dependencies. After all task verdicts and
required checks pass, delegate a final read-only audit of the goal's success criteria,
integration/wiring, compatibility, and receipts. Verdict APPROVED / ISSUES FOUND.
Fix findings, rerun affected checks, and reaudit; maximum three cycles.
Only APPROVED permits completion. If the audit changes code, old check receipts for that
code no longer certify the fix.

Run Profile §9 module QA when a full core gate is requested; otherwise run affected module
validators. Run `$ui-qa-orchestrator` for changed UI/flows when Profile §8 applies.
For QA issues: create bounded fixes, delegate implementation, rejudge, and rerun the
failing QA gate. Never claim a full QA pass from a scoped run.

## State and output

Track phase, task ownership/dependencies, per-cycle verdicts, check receipts, QA coverage,
and unresolved blockers in the goal/task artifacts. Final output states what changed,
what passed, what remains incomplete, and artifact paths. Commit only per Profile §10.
