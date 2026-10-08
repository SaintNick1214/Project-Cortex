---
name: judge-goal
description: Reference criteria for judging goal quality. Used by the pessimistic-judge subagent when evaluating goals created by feature-orchestrator. Not a standalone skill - provides a judgment framework. Stack-agnostic.
---

Read `.agents/CODEX-RUNTIME.md` before applying this document. Resolve profile and role
paths against the orchestration root defined there; its scope and evidence rules apply.

# Goal Judgment Criteria

Reference document for the pessimistic-judge subagent when evaluating goals.

> Read `.agents/PROJECT-PROFILE.md` first. "Layers," "test commands," "patterns," and
> "schema doc" below all refer to what the Project Profile declares for *this* project.

## Judgment Dimensions

### 1. Layer Coverage (Weight: High)

**Question**: Are all affected layers (per Project Profile §3) properly addressed?

| Score | Criteria |
|-------|----------|
| 5 | All affected layers have dedicated tasks with clear scope |
| 4 | All layers covered, minor scope gaps |
| 3 | Most layers covered, some implicit coverage |
| 2 | Missing tasks for affected layers |
| 1 | Fundamental layer coverage missing |

**Red Flags:**
- Client/UI changes without server-side tasks (or vice versa)
- Schema/data changes without a migration strategy
- Transport/API changes without corresponding domain/service tasks
- New features without test tasks

### 2. Test Coverage Plan (Weight: High)

**Question**: Will the test tasks provide adequate coverage?

| Score | Criteria |
|-------|----------|
| 5 | Test tasks for each implementation layer, edge cases noted |
| 4 | Test tasks present, minor gaps in scope definition |
| 3 | Test tasks exist but lack specificity |
| 2 | Insufficient test task coverage |
| 1 | Missing test tasks entirely |

**Red Flags:**
- Implementation tasks without corresponding test tasks
- Test tasks that don't specify what to test
- No error-case testing mentioned

### 3. Task Decomposition (Weight: Medium)

**Question**: Are tasks appropriately sized and atomic?

| Score | Criteria |
|-------|----------|
| 5 | Each task completable in one session, clear boundaries |
| 4 | Good decomposition, minor sizing issues |
| 3 | Some tasks too large or too small |
| 2 | Poor decomposition, tasks overlap or are too broad |
| 1 | Monolithic tasks that should be split |

**Red Flags:**
- Tasks that span multiple layers
- Tasks with vague completion criteria
- Tasks that would take multiple sessions to complete

### 4. Implementation Readiness (Weight: Medium)

**Question**: Does each task have sufficient context for a subagent to execute?

| Score | Criteria |
|-------|----------|
| 5 | Files to read, patterns to follow, and acceptance criteria all clear |
| 4 | Good context, minor clarifications needed |
| 3 | Adequate context but missing some specifics |
| 2 | Insufficient context for independent execution |
| 1 | Tasks lack actionable context |

**Red Flags:**
- Tasks without files to read
- Missing pattern/exemplar references for new code
- Vague acceptance criteria that can't be objectively verified

### 5. Dependency Ordering (Weight: Medium)

**Question**: Are tasks properly sequenced based on dependencies?

| Score | Criteria |
|-------|----------|
| 5 | Clear dependency chain, parallel opportunities identified |
| 4 | Correct ordering, dependencies explicit |
| 3 | Ordering correct but dependencies implicit |
| 2 | Some ordering issues that could cause blockers |
| 1 | Incorrect ordering that will cause implementation failures |

**Red Flags (relative to the Project Profile's layer order):**
- A higher layer scheduled before the lower layer it depends on
- Test tasks interleaved with implementation (should generally follow it)

## Verdict Thresholds

| Verdict | Criteria |
|---------|----------|
| **PASS** | Average ≥ 4.0 AND no dimension below 3 |
| **NEEDS REVISION** | Average 3.0-3.9 OR one dimension at 2 |
| **REJECT** | Average < 3.0 OR any dimension at 1 |

## Output Format

```markdown
# Goal Judgment: [Goal Name]

## Verdict: [PASS | NEEDS REVISION | REJECT]

## Dimension Scores

| Dimension | Score | Evidence |
|-----------|-------|----------|
| Layer Coverage | X/5 | [Specific observation] |
| Test Coverage Plan | X/5 | [Specific observation] |
| Task Decomposition | X/5 | [Specific observation] |
| Implementation Readiness | X/5 | [Specific observation] |
| Dependency Ordering | X/5 | [Specific observation] |

**Average**: X.X/5

## Issues Found

### Critical (blocks progress)
- [Issue with specific task/location]

### Important (should fix)
- [Issue with specific task/location]

### Minor (consider fixing)
- [Issue with specific task/location]

## Recommendations

[Specific actions to address issues and achieve PASS]
```

## Project-Specific Checks

Derive these from the Project Profile. Examples of the *kind* of check to apply per area:

### Backend / Service Goals
- [ ] New units of business logic have corresponding test tasks
- [ ] Data-access methods have corresponding test tasks
- [ ] Dependency registration/wiring mentioned where new components are added

### Client / UI Goals
- [ ] Components/views have corresponding test tasks
- [ ] Data-fetching has a defined mock/fake strategy for tests
- [ ] Client state management updates are scoped
- [ ] Typing is planned (no untyped escape hatches by default)

### Data / Schema Goals
- [ ] Schema changes have a migration strategy
- [ ] Existing-data considerations addressed
- [ ] Index/lookup updates considered
- [ ] Multi-tenant / scoping implications addressed (if applicable)

---

## Critical Reference: Schema / Contract Doc

The Project Profile (§6) names the authoritative schema/contract doc. When judging goals
that involve data work, verify:

- [ ] Tasks reference correct entity/field names
- [ ] Tasks understand relationships between entities
- [ ] Tasks account for any scoping/tenancy structure
- [ ] Schema changes follow the project's migration/versioning pattern
- [ ] Scripts will be idempotent
- [ ] Existing-data migration is considered

This doc should be cited in context packages for any task involving schema changes,
data-access implementation, model/entity changes, or query optimization.
