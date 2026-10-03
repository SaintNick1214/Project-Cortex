Read `.agents/CODEX-RUNTIME.md` before applying this document. Resolve profile and role
paths against the orchestration root defined there; its scope and evidence rules apply.
# Research Prompt Template

Use this structure when generating prompts for external deep-research agents. The agent
has **no access to your codebase** — embed all necessary context.

---

## Template

```markdown
# Deep Research Request: [Topic Title]

## Context

[Provide all necessary background. The research agent has NO access to your codebase or
project context. Be explicit about everything.]

**Domain:** [What area/industry/technology domain is this in?]
**Current State:** [What exists today? What's the starting point?]
**Constraints:** [Technical, regulatory, timeline, budget, or other limitations]

## Objective

[One clear statement of what you're trying to achieve]

## Research Questions

Please investigate and provide findings on:

1. **[Question Category 1]**
   - [Specific question 1.1]
   - [Specific question 1.2]

2. **[Question Category 2]**
   - [Specific question 2.1]
   - [Specific question 2.2]

3. **[Question Category 3]**
   - [Specific question 3.1]
   - [Specific question 3.2]

## Scope

**In Scope:**
- [What should be researched]

**Out of Scope:**
- [What to explicitly exclude]

## Desired Output Format

Please structure your findings as:

### Executive Summary
- Key findings in 3-5 bullet points
- Primary recommendation

### Detailed Findings
For each research question:
- Current state of the art
- Available options/approaches
- Pros and cons of each
- Relevant examples or case studies

### Recommendations
- Recommended approach with rationale
- Alternative approaches if primary is not viable
- Implementation considerations

### Decision Points
- Key decisions that will need to be made
- Trade-offs to consider
- Dependencies or prerequisites

### Sources
- All sources cited with links where available

## Additional Instructions

- Prioritize recent information unless historical context is needed
- Include code examples where relevant
- Note any areas where information is conflicting or uncertain
- Flag any assumptions made
```

---
