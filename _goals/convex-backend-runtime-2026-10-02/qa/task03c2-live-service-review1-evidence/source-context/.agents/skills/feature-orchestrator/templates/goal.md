Read `.agents/CODEX-RUNTIME.md` before applying this document. Resolve profile and role
paths against the orchestration root defined there; its scope and evidence rules apply.
# [Goal Title]

## Status
- **Phase**: Planning | In Progress | Complete
- **Created**: [Date]
- **User Approved**: Yes/No

## Summary
[2-3 sentence description of what this goal accomplishes]

## Success Criteria
> Derive from the affected layers (Project Profile §3). Include only what applies.
- [ ] Data/schema changes applied (if applicable)
- [ ] Each affected implementation layer complete
- [ ] New code wired and reachable
- [ ] Tests pass with adequate coverage for each implementation layer
- [ ] Code quality checks pass (Project Profile §4)

## Affected Layers
> One row per affected layer, using the names and paths from Project Profile §3.

| Layer | Path | Changes |
|-------|------|---------|
| [Layer] | [path] | [Describe] |
| [Layer] | [path] | [Describe] |

## Task Summary

| # | Task | Layer | Status | Attempts |
|---|------|-------|--------|----------|
| 01 | [Task name] | [Layer] | Pending | 0 |
| 02 | [Task name] | [Layer] | Pending | 0 |
| .. | [Task name] | Tests | Pending | 0 |

## Dependencies
- External: [Any external dependencies or blockers]
- Internal: [Any internal dependencies]

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| [Risk description] | H/M/L | [How to address] |

## Out of Scope
- [What this goal explicitly excludes]

---

## Completion Log

### Phase 1: Alignment
- [ ] Requirements gathered
- [ ] User confirmed (interactive) / assumptions recorded (autonomous)

### Phase 3: Goal Judgment
- [ ] Judge subagent invoked
- **Verdict**: [PASS/NEEDS REVISION/REJECT]
- **Revisions**: [count]

### Phase 4: Task Execution
[Updated as tasks complete]

### Phase 5: Final Audit
- [ ] Final audit passed (APPROVED)
- [ ] Code quality passed
