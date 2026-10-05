Read `.agents/CODEX-RUNTIME.md` before applying this document. Resolve profile and role
paths against the orchestration root defined there; its scope and evidence rules apply.
# Task Template (research-linked)

Use this structure for individual task files in `_goals/[goal-name]/tasks/[NN]-task-name.md`.

---

## Template

```markdown
# Task: [Task Title]

**ID:** [phase]-[number] (e.g., `foundation-01`)
**Status:** [Pending | In Progress | Blocked | Complete]
**Phase:** [Phase Name]
**Goal:** [Link to goal.md]

---

## Objective
[One clear sentence describing what this task accomplishes]

---

## Requirements

### Functional Requirements
- [ ] [Specific requirement 1]
- [ ] [Specific requirement 2]

### Technical Requirements
- [ ] [Technical constraint or standard 1]

---

## Acceptance Criteria
1. [ ] [Specific, testable criterion]
2. [ ] [Specific, testable criterion]

---

## Context

### Why This Task
[Brief explanation of why this task is necessary and how it fits the larger goal]

### Dependencies
| Depends On | Status | Notes |
|------------|--------|-------|
| [Task ID or external dependency] | [Status] | [Notes] |

### Blocks
- [Task ID that cannot start until this completes]

---

## Research Context

> [Relevant excerpt from the research report that informs this task]
>
> — `_research/[topic]/report.md`, Section: [Section Name]

### Key Insights from Research
- [Insight relevant to this task]

### Decisions Applied
- [Decision from goal.md that affects this task]: [How it applies]

---

## Implementation Notes

### Approach
[Suggested approach or guidance]

### Files Likely Affected
- `path/to/file` - [What changes]

### Patterns to Follow
- [Reference to exemplar in Project Profile §5 or to a research recommendation]

### Pitfalls to Avoid
- [Common mistake or anti-pattern]

---

## Validation

### Manual Testing
- [ ] [Test scenario]

### Automated Testing
- [ ] [Unit/integration test requirement]

---

## Notes
[Additional context, questions to resolve, or implementation hints]
```

---

## Naming Convention

Task files: `[NN]-[descriptive-name].md`
- `NN` = two-digit sequence (01, 02, 03…)
- `descriptive-name` = lowercase, hyphenated

Examples: `01-setup-project-structure.md`, `02-implement-data-models.md`,
`03-create-api-endpoints.md`, `04-add-validation-layer.md`

---
