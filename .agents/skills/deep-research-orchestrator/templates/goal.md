Read `.agents/CODEX-RUNTIME.md` before applying this document. Resolve profile and role
paths against the orchestration root defined there; its scope and evidence rules apply.
# Goal Template (research-linked)

Use this structure for the `goal.md` file in each `_goals/[goal-name]/` folder produced by
the deep-research-orchestrator.

---

## Template

```markdown
# Goal: [Goal Title]

**Created:** [Date]
**Status:** [Planning | Ready | In Progress | Complete]
**Research:** [Link to _research/[topic]/report.md]

---

## Summary
[2-3 sentence description of what this goal accomplishes and why it matters]

---

## Success Criteria
- [ ] [Specific, measurable outcome 1]
- [ ] [Specific, measurable outcome 2]
- [ ] [Specific, measurable outcome 3]

---

## Scope

### In Scope
- [What this goal includes]

### Out of Scope
- [What this goal explicitly excludes]

### Future Considerations
- [Things to consider for future iterations]

---

## Affected Areas
> Use the layers/areas from Project Profile §3.

| Area | Type of Change | Impact |
|------|----------------|--------|
| [Component/System] | [New/Modify/Remove] | [Description] |

---

## Key Decisions

| Decision | Choice | Rationale | Research Ref |
|----------|--------|-----------|--------------|
| [What was decided] | [The choice] | [Why] | [Section in report.md] |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk] | [L/M/H] | [L/M/H] | [Strategy] |

---

## Implementation Phases

| Phase | Folder | Description | Dependencies |
|-------|--------|-------------|--------------|
| 1 | `[phase-folder]/` | [What it accomplishes] | None |
| 2 | `[phase-folder]/` | [What it accomplishes] | Phase 1 |

---

## Task Summary

| Phase | Tasks | Est. Effort |
|-------|-------|-------------|
| [Phase 1 Name] | [N] tasks | [Relative size] |
| **Total** | **[N] tasks** | |

---

## Definition of Done
1. All success criteria checked
2. All task files marked complete
3. [Testing/validation requirements]
4. [Documentation requirements]
5. [Review/approval requirements]

---

## Notes
[Additional context, assumptions, or guidance]
```

---
