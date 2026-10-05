---
name: judge-qa
description: Reference criteria for judging browser-based QA evidence. Used by the qa-judge subagent when evaluating UI test plans, per-page evidence, flows, and cross-page consistency. Not a standalone skill - provides a judgment framework. Framework-agnostic.
---

Read `.agents/CODEX-RUNTIME.md` before applying this document. Resolve profile and role
paths against the orchestration root defined there; its scope and evidence rules apply.

# QA Judgment Criteria

Reference document for the qa-judge subagent when evaluating browser-based QA evidence.

> Read `.agents/PROJECT-PROFILE.md` (§8 and UI conventions) so you know the app's intended
> appearance and behavior before judging evidence.

## Judgment Dimensions

### 1. Visual Integrity (Weight: High)

**Question**: Does the page render correctly with no visual defects?

| Score | Criteria |
|-------|----------|
| 5 | Clean rendering, consistent spacing, no visual defects anywhere |
| 4 | Clean rendering, 1-2 minor cosmetic issues |
| 3 | Acceptable rendering, some visual issues that don't block usage |
| 2 | Noticeable visual defects that affect perceived quality |
| 1 | Layout broken, content invisible or overlapping, unusable |

**Verification Method:**
1. Examine the baseline screenshot — does the page look correct at first glance?
2. Compare before/after screenshots for each interaction — does the layout stay stable?
3. Check the accessibility snapshot for unexpected element positioning
4. Look for elements with zero dimensions or clipped/overflowing content

**Red Flags:**
- Text cut off mid-word without ellipsis
- Buttons or inputs overlapping adjacent elements
- Inconsistent spacing between similar elements
- Scrollbars appearing where they shouldn't (or missing where they should)
- Content shifting position after async data loads

### 2. Functional Correctness (Weight: Critical)

**Question**: Do all interactive elements produce the correct result when activated?

| Score | Criteria |
|-------|----------|
| 5 | Every interaction works correctly, responses immediate and accurate |
| 4 | All primary interactions work, 1-2 minor secondary elements misbehave |
| 3 | Core functionality works, some secondary interactions have issues |
| 2 | Primary interactions partially broken or producing wrong results |
| 1 | Core functionality non-functional, primary actions fail |

**Verification Method:**
1. For each element tested, check: did the after-state match expected behavior?
2. Buttons: did clicking trigger the intended action (navigate, submit, toggle)?
3. Inputs: did filling and submitting produce correct results?
4. Dropdowns/selects: did selection update dependent UI?
5. Links: did navigation arrive at the correct destination?

**Red Flags:**
- Click handler does nothing (no visible change, no network request)
- Form submission succeeds but data doesn't appear in the relevant list/table
- Navigation produces a blank page or error boundary
- Toggle/switch visual state doesn't match logical state
- Multi-step flow breaks partway through

### 3. Error Freedom (Weight: Critical)

**Question**: Is the interaction free of runtime errors?

| Score | Criteria |
|-------|----------|
| 5 | Zero console errors, zero failed network requests throughout |
| 4 | Zero errors during interaction; pre-existing warnings only |
| 3 | 1-2 non-critical warnings during interaction (not errors) |
| 2 | Console errors present during interaction but UI still functional |
| 1 | Multiple console errors and/or failed network requests |

**Verification Method:**
1. Review console output for each page
2. Classify each message: error vs warning vs info
3. For errors: did they occur during an interaction or on page load?
4. Review network requests for 4xx/5xx responses
5. For failed requests: is there corresponding error handling in the UI?

**Distinguishing pre-existing vs new errors:**
- Classify framework warnings using baseline evidence; do not assume they are pre-existing
- Errors that appear ONLY during interaction with modified elements are likely new — fail
- Network errors to endpoints related to the feature under test are critical — fail
- Network errors to unrelated endpoints may be pre-existing — note but weigh context

**Red Flags:**
- Type/reference errors during interaction
- Unhandled promise rejection during form submission or data fetch
- 5xx error on any request triggered by interaction
- CORS error on any request
- Error boundary rendering fallback UI

### 4. State Management (Weight: High)

**Question**: Are loading, error, empty, and transitional states properly handled?

| Score | Criteria |
|-------|----------|
| 5 | All async ops show loading, errors caught and displayed, empty states informative |
| 4 | Loading and error states handled for primary ops, minor gaps for secondary |
| 3 | Loading states present but inconsistent, some error states missing |
| 2 | Missing loading indicators for visible async ops, errors swallowed |
| 1 | No loading feedback, errors not handled, data appears/disappears unexplained |

**Verification Method:**
1. For each async operation: is there a loading indicator?
2. After a mutation (create/update/delete): does the UI reflect the change immediately?
3. When data is empty: does the UI show an informative empty state?
4. When a request fails: does the UI show an error message?
5. After navigation: does the new page show loading before data arrives?

**Red Flags:**
- User clicks "Save" and nothing visible happens for several seconds
- A table shows stale data after an item was deleted
- An empty list shows nothing (no "No items found" message)
- An error appears but doesn't describe what went wrong
- A loading spinner runs indefinitely

### 5. UX Quality (Weight: Medium)

**Question**: Is the experience polished and intuitive from the user's perspective?

| Score | Criteria |
|-------|----------|
| 5 | Intuitive flow, clear feedback on every action, professional polish |
| 4 | Good experience, 1-2 minor UX improvements possible |
| 3 | Usable experience, some rough edges or unclear feedback |
| 2 | Confusing interactions, missing feedback, user left guessing |
| 1 | Hostile UX: no feedback, misleading states, user cannot accomplish the task |

**Verification Method:**
1. After each action: does the user know what happened?
2. Before destructive actions: is there a confirmation?
3. For disabled elements: is it clear WHY they're disabled?
4. For required fields: are they marked required BEFORE a submit attempt?
5. For multi-step flows: does the user know where they are and what's next?

**Red Flags:**
- Delete succeeds with no confirmation and no undo
- Submit is clickable before required fields are filled
- Error messages are raw technical jargon shown to the user
- No visual distinction between clickable and non-clickable elements
- Form resets all fields after a single validation error

### 6. Accessibility Basics (Weight: Medium)

**Question**: Are fundamental accessibility requirements met?

| Score | Criteria |
|-------|----------|
| 5 | All interactive elements labeled, proper focus management, semantic structure |
| 4 | Most elements properly labeled, minor labeling gaps |
| 3 | Core elements labeled, some buttons/icons missing labels |
| 2 | Multiple interactive elements without labels, focus issues |
| 1 | No accessibility consideration, icon-only buttons unlabeled, broken focus |

**Verification Method:**
1. Review accessibility snapshot: do interactive elements have text labels?
2. Buttons: visible text or accessible name?
3. Images: alt attributes?
4. Form inputs: associated with labels?
5. Tab order: follows logical reading order?

**Red Flags:**
- Icon-only button with no accessible name
- Input with no associated label
- Interactive element that cannot receive keyboard focus
- Status conveyed only by color with no text/icon supplement

## Verdict Thresholds

| Verdict | Criteria |
|---------|----------|
| **PASS** | Average ≥ 4.0 AND no dimension below 3 AND zero auto-fail triggers |
| **ISSUES FOUND** | Average 3.0-3.9 OR any dimension at 2 OR auto-fail on a non-critical element |
| **REJECT** | Average < 3.0 OR any dimension at 1 OR auto-fail on a critical element |

## Output Format

```markdown
# QA Judgment: [Page or Flow Name]

## Verdict: [PASS | ISSUES FOUND | REJECT]

## Evidence Reviewed
[Enumerate the evidence examined]

## Element-by-Element Review

| Element | Action | Result | Console Errors | Network Errors | Verdict |
|---------|--------|--------|----------------|----------------|---------|
| [Button "Save"] | Click | Form submitted, toast shown | None | None | OK |
| [Link "Details"] | Click | Navigated to detail page | TypeError | None | FAIL |

## Issues Found

### Critical (blocks release)
- **Element**: [ref or description]
- **Dimension**: [which dimension]
- **Expected**: [user-perspective expectation]
- **Actual**: [what the evidence shows]
- **Evidence**: [screenshot ref, console message, network log]
- **Suggested Fix Area**: [file path or component likely responsible]

### Important (should fix before release)
- [Same structure]

### Minor (cosmetic, fix when possible)
- [Same structure]

## Dimension Scores

| Dimension | Score | Key Evidence |
|-----------|-------|--------------|
| Visual Integrity | X/5 | [Observation] |
| Functional Correctness | X/5 | [Observation] |
| Error Freedom | X/5 | [Observation] |
| State Management | X/5 | [Observation] |
| UX Quality | X/5 | [Observation] |
| Accessibility Basics | X/5 | [Observation] |

**Average**: X.X/5

## Recommendations
[Ordered remediation actions, most critical first]
```

## Special Case: Test Plan Judgment

```markdown
# Test Plan Judgment: [Goal Name]

## Verdict: [PASS | NEEDS REVISION | REJECT]

## Coverage Analysis

| Page/Route | Elements Listed | Elements in Snapshot | Coverage |
|------------|-----------------|----------------------|----------|
| [/route] | 12 | 14 | 86% (missing: [list]) |

## Flow Coverage

| Flow | Steps Listed | Complete? |
|------|--------------|-----------|
| [Flow name] | 5 steps | Yes |

## Issues
- [Missing elements or flows]

## Recommendation
[What to add to achieve comprehensive coverage]
```

## Special Case: Cross-Page Judgment

```markdown
## Cross-Page Consistency

| Check | Status | Evidence |
|-------|--------|----------|
| Navigation active state correct on each page | OK/FAIL | [observation] |
| Shared chrome (header/sidebar) consistent | OK/FAIL | [observation] |
| Shared components render identically | OK/FAIL | [observation] |
| Terminology consistent for same concepts | OK/FAIL | [observation] |
| Loading/error patterns consistent | OK/FAIL | [observation] |
| Navigation between pages works bidirectionally | OK/FAIL | [observation] |
```

## Project-Specific Checks

Build a checklist from the Project Profile's UI conventions. Typical items:
- Navigation reflects the active page; all nav links work
- Header/sidebar/footer consistent across pages
- Data tables: headers, sorting, pagination, counts behave correctly
- Modals: open centered; close via button / Escape / backdrop
- Toasts/notifications: correct position, auto-dismiss, severity color
- Forms: required markers, inline validation, errors near the field
- Tabs: content swaps without full reload
- Any domain-specific widgets the project relies on

If the app is multi-tenant or scoped: scoped views show only the current scope's data, and
switching scope refreshes all data; scope identifiers are not leaked in user-visible URLs.
