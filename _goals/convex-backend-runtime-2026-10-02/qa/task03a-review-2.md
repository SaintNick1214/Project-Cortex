# Independent Task03A judgment — cycle2

**Verdict: NEEDS FIXES. Average: 3.4/5.** Fresh read-only judge
`task03a_review_2`, 2026-10-03. Parent inspected the final report before recording
this verdict. Whole Task03 remains pending03B/03C.

The eight auth policy corrections are correct; no security blocker was established
in the bounded authority helpers. The inventory and active test wiring need correction
before freezing downstream contracts.

## Independent evidence

Both retained generators reproduce frozen JSON/Markdown exactly without writing it;
251 registrations/exports, 240 public/11 internal, 198 guard/42 internalize, no unresolved
registrations or HTTP routes. All 22 source hashes match and generators are byte-identical.
Removing the cycle2 override in memory reproduces the generic baseline; only eight auth
policies intentionally changed. Both strict configs, scoped lint and whitespace pass.
Independent cache-disabled Jest: three suites, 71 tests, zero skipped. All 13 original/
cycle2 command receipts have readable logs and successful exits. No deployment, inference,
live mutation, shared build, dependency change, staging or commit occurred.

## Findings requiring correction

1. Three pure internal read helpers are incorrectly labeled write because the generator
   recognizes only public query/action kinds as reads: facts:fetchFactsByIds,
   memories:fetchMemoriesByIds, memories:keywordSearchMemories. Their public search
   callers require read. Correct generated policies and assert both runners' outputs.
2. Eighteen deployment-maintenance paths retain contradictory tenant-grant policies:
   admin:listTable/deleteRecord/clearTable/countTable/getAllCounts; purgeAll in agents,
   artifacts, attachments, contexts, conversations, facts, graphSync, immutable,
   memories, memorySpaces and mutable; governance:purgeAllPolicies/purgeAllEnforcement.
   They must remain internalize and use explicit trusted deployment-operator invocation,
   scope, resource lookup, ownership and background rules. A tenant admin/write/tool/
   storage capability or stored tenant grant cannot authorize deployment maintenance.
3. Active inventory.test.ts requires the ignored work runner and creates temporary
   directories beneath an absent scratch parent. A clean checkout fails ENOENT; making
   the parent alone still leaves the runner missing. Use retained deliverables and an
   independently created temporary directory, or self-contained bootstrap. Verify absent work.
4. Active unit tests compare current production source hashes/counts with the frozen
   Task03A snapshot. A harmless EOF newline leaves policy/counts unchanged but fails the
   hash assertion; legitimate03B changes would break the normal test suite. Retain exact
   source qualification in explicit historical QA, and make active policy outcomes use
   maintained fixtures/contracts without production byte-identity requirements.

The policy defects originate in reproduction/inventory.mjs generic classification near
lines133–145; the active test problems are inventory.test.ts lines16/22/26–27.
No source authority helper changes are required by these findings.

## Requirements and scores

Complete inventory, exact verified identity, trusted internal bootstrap, independent
capabilities/access, omitted-scope denial, immutable grant generations, exact background
references, lifecycle fences, logout distinction and additive host preservation pass.
Transcript/share/storage/tool/callback contracts are frozen designs only. Correct per-path
policy and reproducible active tests are partial. No existing endpoint closure is certified.

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement fulfillment | 3/5 | Inventory and durable regressions incomplete |
| Code quality | 4/5 | Trusted typed adapters and scoped lifecycle checks |
| Test quality | 3/5 | 71 meaningful outcomes; missing equivalent policy and portability cases |
| Pattern adherence | 4/5 | Internal registrations, control indexes and additive schema |
| Completeness | 3/5 | Freeze and clean-checkout wiring need correction |

One bounded final correction must address all findings, regenerate inventories, document
intentional non-auth policy changes, rerun affected checks and obtain fresh review.
Actual handlers/visibility, JWT refresh, live subscriptions/private bytes/callbacks,
canonical transcript/share routing and product codegen remain downstream gates.
