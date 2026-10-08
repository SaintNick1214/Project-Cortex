Read `.agents/CODEX-RUNTIME.md` before applying this document. Resolve profile and role
paths against the orchestration root defined there; its scope and evidence rules apply.
# Task: [Layer] - [Feature] [Action]

## Status
- **State**: Pending | In Progress | Complete | Blocked
- **Layer**: [Layer name from Project Profile §3]
- **Attempts**: 0

## Requirements

Complete ALL of the following:

- [ ] Requirement 1
- [ ] Requirement 2
- [ ] Requirement 3

## Files to Modify/Create

| File | Action | Purpose |
|------|--------|---------|
| `path/to/file` | Create | [What this file does] |
| `path/to/file` | Modify | [What changes] |

## Context for Subagent

### Files to Read First
Understanding these is REQUIRED before implementation:

- `[exemplar from Project Profile §5]` - [Why: pattern to follow]
- `[related file]` - [Why: related code to understand]
- `[reference doc from Project Profile §6]` - [Why: e.g. schema before data work]

### Patterns to Follow

Reference the canonical exemplar (Project Profile §5) for this concern. Summarize the key
points to mirror:
- [Structure / naming / error-handling convention to copy]

### Related Code
- `[file]` - [Relationship: extends/uses/similar to]

## Acceptance Criteria

Each criterion MUST be verifiable:

- [ ] Criterion 1 - Verify by: [how to test]
- [ ] Criterion 2 - Verify by: [how to test]

## Dependencies

- **Requires**: [Previous task(s) that must complete first]
- **Blocks**: [Subsequent task(s) that depend on this]

## Decision Record (if a decision gate applied)

- **Decision**: [what was chosen]
- **Alternatives considered**: [A, B]
- **Rationale**: [why — e.g. smallest blast radius / consistent with patterns]

## Implementation Notes

[Any specific guidance, gotchas, or considerations]

---

## Completion Report

*Filled in by the implementation-executor subagent*

### Status: [COMPLETE | PARTIAL | BLOCKED]

### Changes Made
- [file]: [what changed]

### Requirements Checklist
- [x] Requirement 1 - [evidence]
- [x] Requirement 2 - [evidence]

### Files Modified
| File | Action | Notes |
|------|--------|-------|
| `path` | Created/Modified | [summary] |

### Verification
- [ ] Builds/compiles (command + result)
- [ ] Lint/format/typecheck clean (command + result)
- [ ] Relevant tests pass (command + result)
- [ ] All requirements addressed

### Notes for Reviewer
[Context the reviewer should know]
