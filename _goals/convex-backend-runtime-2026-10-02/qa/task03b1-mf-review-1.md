# Task Judgment: Task03B1-MF, loop1

Fresh read-only judge `task03b1_mf_review_1`: **REJECT**, average **3.0/5**.
Coordinator transcription of the native final judgment,2026-10-03.
All42 registrations were inspected; all9 frozen hashes remained unchanged.

| Dimension | Score |
| --- | --- |
| Requirement fulfillment | 2/5 |
| Code quality | 3/5 |
| Test quality | 3/5 |
| Pattern adherence | 3/5 |
| Completeness | 4/5 |

Five confirmed critical findings:

1. Write-only mutation responses disclose existing private data. Actual probes
   reproduced memories.update(tags), restoreFromArchive, facts.update(confidence),
   and updateInPlace(confidence), including another owner's fact under a write-only
   space grant. Hydration uses write authority at memories.ts:537/938 and
   facts.ts:253/422. Filter-based bulk returns also enumerate unsupplied identifiers
   at memories.ts:663/852. Require independent read authorization for private
   responses or return safe typed mutation receipts consistently.
2. Canonical source integrity is unchecked at runtimeDataAuth.ts:80/231/279.
   Corrupt contentHash and unnormalized content permit current/history reads and
   revision; revision silently replaces the bad hash. Verify normalization and
   actual SHA-256 before use/revision, including the current source behind history.
3. The manual: prefix is not proof of an exclusively editable source. An extracted
   fact with extract-v1 provenance derived from memories.store rewrites the memory
   source through facts.updateInPlace. Adding sourceRef.memoryId instead produces
   post-write STALE_SOURCE and rollback. Extracted/shared-source edits need a
   separate assertion source; dedicated manual ownership must be proven.
4. Visited-node skipping at runtimeDataAuth.ts:112/117 bypasses cycle/version checks.
   memoryA->factF->memoryB->factF passes even with requested fact version99 versus
   actual1. Use an active recursion path with cleanup, validate every edge, and
   preserve the independently passing valid shared-DAG control.
5. Message IDs without a conversation anchor are retained unchecked. Actual
   facts.store(sourceRef.messageIds-only) succeeds. Require a valid nonempty anchor
   and validate every supplied selector, including conflicting conversation IDs.

Other bounded requirements passed offline: complete AST disposition42/37public/
5internal/0unresolved; omitted trusted scope and ambiguity fences; actual composite
ID/list/count/keyword selection; foreign-first and owner/tombstone isolation;
bulk preflight and simulated rollback; trusted actors/editors; assistant-claim
eligibility; late revocation/deletion delivery fences; typed PROFILE_NOT_READY
before vector/paid dispatch; portable affected checks. Historical revision labeling
works but integrity remains defective. Managed Agent routing/ordered ingestion/
qualified vectors/private delivery/live subscriptions remain downstream gates.

Independent checks: affected strict backend/root types and ESLint PASS;5 suites,
243 selected tests PASS,0 skipped; AST/whitespace PASS. Full root typecheck fails
with exactly3 documented public purgeAll consumer references. Meaningful existing
tests missed the critical negatives. Independent positive controls verify owned
immutable/mutable links and valid shared DAG; foreign/missing-owner/tombstone/
wrong-version/message-not-in-selected-conversation deny.

The original sources and23 QA files are preserved under task03b1-mf/history/cycle1/
with9 source hashes in preservation.json. The independent probe and raw outcome
log are preserved there under independent/; the script is inert historical text.
The original temporary probe ran with node_modules/.bin/tsx. Repairs must assert
denial or safe responses and preserve positive outcomes rather than invert defect
assertions without testing the resulting behavior.

No repository edits, live services, subscriptions, UI or managed transactions were
performed by the judge. Recommendation: repair all findings, add outcome regressions
and obtain a fresh cycle2 judgment. Neither whole03 nor the goal is accepted.
