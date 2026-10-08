Read `.agents/CODEX-RUNTIME.md` before applying this document. Resolve profile and role
paths against the orchestration root defined there; its scope and evidence rules apply.
# Module Validation Skill Template

Copy this to `.agents/skills/validate-[module]/SKILL.md` for each module listed in Project
Profile §9. It tells a QA agent how to exercise one area of the product and what "pass"
means — without guessing which controls exist, which actions mutate data, or how to leave
the environment clean.

Replace every `[placeholder]`. Delete sections that don't apply (e.g. "Safety Rules" for a
read-only module).

---

```markdown
---
name: validate-[module]
description: Step-by-step validation of the [Module] area at [route/entry point]. Covers [the controls, states, and flows it exercises] and safe cleanup after any mutating tests.
---

# [Module] Validation Skill

Use this skill to validate the [Module] at `[route/entry point]`.

## When to Use
- After changes under `[paths that affect this module]`
- During full-app QA runs (invoked by $qa-orchestrator)

## Prerequisites
Start the dev stack per Project Profile §8 (UI QA Bootstrap), then open `[module URL]`.

Run the health check from Project Profile §8 and confirm the app is authenticated and
usable before testing.

**Expected authenticated context:** [role/identity the test session should have, and what
that role can see/do — e.g. which controls are visible. For read-only roles, document
permission-limited behavior instead of failing.]

## Safety Rules for Mutating QA   *(delete if this module is read-only)*
This validation can write to real dev data. Before editing anything:
1. Pick a low-risk target and record its original values.
2. Use timestamped test values (e.g. `qa-[module]-[date]-[n]`).
3. Restore every edited value before finishing.
4. Delete anything you created for the test.
5. Do not leave test artifacts behind unless the task requires persistence evidence.
6. If a save fails, record the error and verify the value reverted.

## Architecture: What the Agent Sees
[A short map of the page's regions so the agent knows what to look for. Example:]

```
┌───────────────────────────────────────────────┐
│ [Top region: filters, summary, primary action] │
├───────────────────────────────────────────────┤
│ [Main region: table / list / canvas]           │
├───────────────────────────────────────────────┤
│ [Status bar / pagination / footer]             │
└───────────────────────────────────────────────┘
```

Important implementation notes:
- [Anything non-obvious — persisted state, default filters, exact labels, etc.]

## Validation Steps

### Step 1: [Navigate and confirm the module loads]
**Action**
1. Navigate to `[module URL]`.
2. Wait until [key elements] render.
3. Capture a screenshot and the browser console/network status.

**Expected**
- [Concrete, observable expectations]

**Pass criteria**
- [What must be true to pass this step]
- No route/auth/CORS console errors

### Step 2: [Validate the next control/state]
**Action**
1. [Exact steps]

**Expected**
- [Concrete expectations]

**Pass criteria**
- [Pass conditions]

### Step N: [Continue for every meaningful control, state, and flow]
[Repeat. Cover: primary actions, filters/search, sorting/pagination, create/edit/delete
(with safety rules), empty states, error states, and any module-specific widgets.]

## Cleanup   *(delete if read-only)*
- [ ] All edited values restored
- [ ] All created test artifacts deleted
- [ ] Environment left in its original state

## Module Report Format

Conclude with:

\```markdown
# [Module] Validation Report

## Verdict: PASS / FAIL

## Steps
| Step | Result | Evidence |
|------|--------|----------|
| 1 | PASS/FAIL | [screenshot/notes] |

## Mutations Executed
[List, or "none"]

## Cleanup / Restoration
[What was restored/deleted, or "N/A — read-only"]

## Console Errors
[List or "none"]

## Failed Network Requests
[List or "none"]
\```
```
