Read `.agents/CODEX-RUNTIME.md` before applying this document. Resolve profile and role
paths against the orchestration root defined there; its scope and evidence rules apply.
# Research Report Template

Use this structure when cleaning and organizing raw research reports in Phase 2.

---

## Template

```markdown
# Research Report: [Topic Title]

**Generated:** [Date]
**Source:** [Research tool/agent used]
**Status:** [Draft | Final]

---

## Executive Summary

- **Key Finding 1:** [One sentence]
- **Key Finding 2:** [One sentence]
- **Key Finding 3:** [One sentence]
- **Primary Recommendation:** [One sentence]

---

## Research Questions & Findings

### 1. [Question Category]

**Question:** [The specific question asked]

**Findings:**
[Detailed findings organized clearly]

**Key Takeaways:**
- [Takeaway 1]
- [Takeaway 2]

---

## Options Analysis

| Option | Description | Pros | Cons | Complexity | Cost |
|--------|-------------|------|------|------------|------|
| [Option A] | [Brief] | [Pros] | [Cons] | [Low/Med/High] | [Est.] |
| [Option B] | [Brief] | [Pros] | [Cons] | [Low/Med/High] | [Est.] |

---

## Recommendations

### Primary Recommendation
[Detailed recommendation with rationale]

**Why this approach:**
- [Reason 1]
- [Reason 2]

### Alternative Approaches
**If [condition]:** Consider [alternative] because [reason].

---

## Decision Points

| # | Decision | Options | Considerations | Suggested |
|---|----------|---------|----------------|-----------|
| 1 | [Decision] | [A, B, C] | [What to consider] | [Suggestion] |

---

## Risks & Considerations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk] | [L/M/H] | [L/M/H] | [How to mitigate] |

---

## Implementation Considerations

### Prerequisites
- [What needs to be in place before starting]

### Dependencies
- [External dependencies]

### Estimated Effort
- [Rough scope/complexity assessment]

---

## Knowledge Gaps

- [ ] [Gap 1]: [What's unclear and why it matters]
- [ ] [Gap 2]: [What's unclear and why it matters]

---

## Sources & References

1. [Source title](URL) - [What this source provided]
2. [Source title](URL) - [What this source provided]

---

## Appendix

### A. Code Examples
[Relevant snippets from research]

### B. Diagrams
[Architecture diagrams or flowcharts]

### C. Raw Data
[Tables, benchmarks, or supporting data]
```

---

## Cleaning Guidelines

When processing raw research into this format:

### Remove
- Redundant information (say it once, clearly)
- Marketing language or hype
- Outdated information (unless noting historical context)
- Irrelevant tangents

### Preserve
- All citations and sources
- Specific version numbers and dates
- Code examples (clean up formatting)
- Quantitative data and benchmarks

### Restructure
- Group related information together
- Create a clear hierarchy with headers
- Convert prose to bullet points where appropriate
- Add tables for comparisons

### Enhance (markers the orchestrator can scan for)
- Decision points: `DECISION:`
- Warnings: `WARNING:`
- Uncertainties: `UNCERTAIN:`
- Action items: `ACTION:`
