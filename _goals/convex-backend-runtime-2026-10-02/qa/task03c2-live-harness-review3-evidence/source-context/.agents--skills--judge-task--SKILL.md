---
name: judge-task
description: Reference criteria for judging task implementation quality. Used by the pessimistic-judge subagent when evaluating work produced by implementation-executor. Not a standalone skill - provides a judgment framework. Stack-agnostic.
---

Read `.agents/CODEX-RUNTIME.md` before applying this document. Resolve profile and role
paths against the orchestration root defined there; its scope and evidence rules apply.

# Task Judgment Criteria

Reference document for the pessimistic-judge subagent when evaluating task implementations.

> Read `.agents/PROJECT-PROFILE.md` first. "Patterns," "hard rules," "quality commands,"
> and "schema doc" below refer to what the Project Profile declares for *this* project.

## Judgment Dimensions

### 1. Requirement Fulfillment (Weight: Critical)

**Question**: Are ALL requirements from the task file met?

| Score | Criteria |
|-------|----------|
| 5 | All requirements met with evidence, exceeds expectations |
| 4 | All requirements met, evidence clear |
| 3 | Most requirements met, minor gaps |
| 2 | Some requirements unmet or partially met |
| 1 | Major requirements missing |

**Verification Method:**
1. List every requirement from the task file
2. Check the implementation against each one
3. Require evidence for each (file, line, test name, command output)

**Auto-Fail Triggers:**
- Any requirement marked complete but not verifiable
- Any requirement silently dropped

### 2. Code Quality (Weight: High)

**Question**: Does the code follow project patterns and language best practices?

| Score | Criteria |
|-------|----------|
| 5 | Exemplary code, could be used as a reference |
| 4 | Clean code, follows patterns, minor improvements possible |
| 3 | Acceptable code, some pattern deviations |
| 2 | Code quality issues that need fixing |
| 1 | Poor code quality, significant issues |

**Universal checks (translate to the stack):**
- [ ] Inputs validated at public boundaries
- [ ] Errors handled or deliberately propagated (never silently swallowed)
- [ ] Async/concurrent work awaited/synchronized correctly
- [ ] Resources released on all paths (files, connections, locks)
- [ ] Dependencies injected/passed per house convention (not constructed ad hoc)
- [ ] Strong typing where the language allows; escape hatches justified
- [ ] Logging/observability present for failures and key paths
- [ ] No violations of the Project Profile hard rules

### 3. Test Quality (Weight: High — for test tasks)

**Question**: Do tests actually verify behavior?

| Score | Criteria |
|-------|----------|
| 5 | Comprehensive tests with outcome verification |
| 4 | Good coverage, all tests verify outcomes |
| 3 | Adequate tests, some weak assertions |
| 2 | Tests present but don't verify outcomes |
| 1 | Missing tests or tests that just call code |

**Verification Method:**
1. Map changed public behavior, branches, and error paths to meaningful assertions
2. Review relevant test cases and their asserted outcomes
3. For each test, confirm assertions verify ACTUAL outcomes (not just "ran without error")

**Auto-Fail Triggers:**
- Tests that only invoke code without meaningful assertions
- "Not null" / "is defined" / "did not throw" as the *only* assertion
- Missing error-case tests
- Public functions with no test coverage

### 4. Pattern Adherence (Weight: Medium)

**Question**: Does the implementation follow established project patterns?

| Score | Criteria |
|-------|----------|
| 5 | Perfect pattern adherence, consistent with the codebase |
| 4 | Follows patterns, minor style differences |
| 3 | Mostly follows patterns, some deviations |
| 2 | Significant pattern deviations |
| 1 | Ignores established patterns |

**How to check:** Compare the new code against the canonical exemplar files named in the
Project Profile (§5) for this concern. Deviations in structure, naming, error handling, or
layering count against this dimension.

### 5. Completeness (Weight: Medium)

**Question**: Is the implementation truly complete and reachable?

| Score | Criteria |
|-------|----------|
| 5 | Complete with all supporting changes (wiring, exports, registration) |
| 4 | Implementation complete, supporting changes present |
| 3 | Core implementation complete, some supporting changes missing |
| 2 | Partial implementation, gaps in supporting infrastructure |
| 1 | Incomplete implementation |

**Completeness checks (translate to the stack):**
- [ ] New components registered/wired so they're reachable
- [ ] New routes/handlers mounted
- [ ] New symbols exported where consumers need them
- [ ] Config/enums/manifests updated where the pattern requires
- [ ] Build/lint/typecheck/tests for the touched stack pass

## Verdict Thresholds

| Verdict | Criteria |
|---------|----------|
| **PASS** | All dimensions ≥ 4 AND Requirement Fulfillment = 5 |
| **NEEDS FIXES** | Any dimension 3-4 AND no critical issues |
| **REJECT** | Any dimension ≤ 2 OR an auto-fail trigger hit |

## Output Format

```markdown
# Task Judgment: [Task Name]

## Verdict: [PASS | NEEDS FIXES | REJECT]

## Requirements Review

| Requirement | Met? | Evidence |
|-------------|------|----------|
| [Req 1] | ✅/❌ | [Location/proof] |
| [Req 2] | ✅/❌ | [Location/proof] |

## Dimension Scores

| Dimension | Score | Evidence |
|-----------|-------|----------|
| Requirement Fulfillment | X/5 | [Observation] |
| Code Quality | X/5 | [Observation] |
| Test Quality | X/5 | [Observation] (if test task) |
| Pattern Adherence | X/5 | [Observation] |
| Completeness | X/5 | [Observation] |

**Average**: X.X/5

## Issues Found

### Critical (must fix - blocks PASS)
- [Issue with file:line and suggested fix]

### Important (should fix)
- [Issue with file:line and suggested fix]

### Minor (consider fixing)
- [Issue with file:line and suggested fix]

## Recommendations

[Specific actions to achieve PASS verdict]
```

## Special Case: Test Task Judgment

When judging test tasks, add this section:

```markdown
## Test Coverage Analysis

| Implementation Function | Test Cases | Assertions Verify Outcome? |
|-------------------------|------------|----------------------------|
| `getById` | 2 | ✅ Checks return value |
| `create` | 3 | ✅ Verifies created entity |
| `delete` | 1 | ❌ Only checks no exception |

**Coverage**: X/Y functions have adequate tests
**Verdict Impact**: [How this affects overall verdict]
```

## Iron Law for Test Fixes

When judging fixes to failing tests:

**The TEST defines expected behavior. The IMPLEMENTATION must be fixed.**

**Auto-REJECT if:**
- Assertions were removed
- Expected values were changed without justification
- A test was made less specific just to pass
- Error handling was removed from a test

**Only acceptable test changes:**
- Test setup was incorrect (wrong mock data)
- Test was asserting wrong behavior (misread the spec)
- The API genuinely changed and the test must update to the new correct behavior

---

## Critical Reference: Schema / Contract Doc

The Project Profile (§6) names the authoritative schema/contract doc. When judging
data-layer work (migrations, queries, persistence, models), verify against it:

- [ ] Field names match the schema exactly
- [ ] Data types are correct
- [ ] Required (non-nullable) fields are always populated
- [ ] Optional fields have appropriate absent-value handling
- [ ] Relationships are respected
- [ ] Lookup/index usage aligns with access patterns
- [ ] Scripts are idempotent (safe to re-run)

### Auto-Fail Triggers (Data Layer)
- References to non-existent fields or entities
- Data types that don't match the schema
- Required fields left empty without a valid default
- Injection risk (concatenating untrusted input instead of parameterizing)
