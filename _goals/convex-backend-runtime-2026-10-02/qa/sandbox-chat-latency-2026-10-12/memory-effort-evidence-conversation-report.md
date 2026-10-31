# Private V8 canonical conversation read reuse — author complete

The bounded patch routes `conversationById` canonical `by_scoped_id.take(2)` through the existing raw conversation family only for the exact returned private V8 owner. Every logical canonical call still constructs its original query/index constraints. Duplicate detection, alias fallback physical queries, authority/currentness/lease/cancel/financial checks and the cold final-delivery fence remain in their original callers. No public flag, new family or cached decision was added.

| Registered controlled fixture | Canonical physical takes | Other physical reads |
|---|---:|---:|
| Recent/empty indexed context | 20 → 2 | 150, exactly equal |
| Two indexed selected sources | 30 → 5 | 341, exactly equal |

For selected sources the stage counts are context/preflight 15→1, prepareReads 2→1, readMatches/delivery 3→2 and save/candidate 10→1. The two remaining readMatches/delivery canonical takes preserve the explicit cold final fence. The recent fixture is context/preflight 8→1 and save/candidate 12→1. Actual registered handler outputs, native model body, rows/writes, component effects, native calls and ordered authority guards match in the A/B comparison. No model was called. These counts establish no hosted timing improvement.

The new29-case suite covers exact owner/public/v7/default/unbranded/real snapshot-view isolation, canonical/alias take2 and duplicate/error behavior, original query-builder predicates, detached rows/tenant/space/absent insert, retention/grant clocks, all conversation writer forms, pending/failed component writes, fluent/failed retained writes, late population, shared entry/byte limits, actual registered refusals and cold final source/grant/conversation fences. Existing unchanged shared-reader safety suites also passed.

Latest applicable affected coverage is **950/950 passing tests across22 suites, zero skips**, composed of21 unchanged passing suites/933 tests plus the repaired17-case V8 preparation suite. There was **no single all-green22-suite run**. Root types passed; strict affected5-path lint passed across the final4-path run plus added-file repair run. Tracked `git diff --check` passed; the untracked new-file check is clean (empty output, normal no-index differences-present exit1). Node24.15.0/npm12.2.0; all tests used an explicit dead local target and `forceExit=false`, with natural exits.

The initial focused25/4 and28/1 failures, initial types/lint/whitespace failures, other author's historical9 comparison failures and own947/3 affected result are retained. The new test fixture corrections do not change production behavior. Root authorized test-local isolation of only12 existing historical physical-read comparison instances (9 whole-recall,3 preparation), with every original assertion/case preserved and flags reset after each case; all other cases retain the candidate. Their observers classify constructed queries as physical reads, while this patch deliberately preserves construction but reuses only the terminal result.

Frozen5-file SHA256s are in `memory-effort-evidence-conversation-source-hashes.json`; commands, exact exits and full counts are in the report JSON and raw logs. Only runtimeAuth/runtimeTranscript products changed. No hosted/service/model/build/pack/deploy/Git mutation or P/W work was performed. One coherent independent batch review and any installed qualification remain Root-owned.
