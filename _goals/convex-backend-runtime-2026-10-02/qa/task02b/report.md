# Task 02B execution report

Status: bounded scoped adapters/remember/recall foundation independently PASS,
fresh judge task02b_review_1,4.4/5; see ../task02b-review-1.md. Whole Task02/goal remains pending.
Selected scoped quality PASS. Aggregate root quality is incomplete because concurrent
Task03B public-to-internal API changes still have old references/unfinished tests.

Seven new owned source/test files plus the authorized additive portions of schema.ts
implement the foundation; source-inventory.json contains exact final SHA-256 hashes.
No generated bindings, old handlers, SDK public exports/manifests, provider, CLI,
demo, archived Python or production targets were edited by this executor. Root schema
now also has parent-authorized Task03B additions; ownership is separated below.

## Implemented outcomes

- Actual registered public remember/recall inherit verified identity, select a concrete
  trusted scope and use internal scoped ctx adapters; no client/provider construction.
- Every sensitive internal operation reloads the persisted principal/membership/grant,
  versions/epochs and resource tombstones. Source validation uses write authority;
  facts/context/vector reads independently require read. Write-only remember returns
  only its successful commit's stable fact payload, without general read permission.
- Fresh source/chunk/vector/default1536 stores use exact approved normalization,
  chunks/profile/index; no legacy embedding adoption or second facts store.
- Exact canonical source/receipt identity and payload comparisons prevent digest reuse
  from overwriting another payload. Actual normalized content SHA-256 is recalculated.
- Derived receipt/chunks/vectors/authoritative facts validate together and commit in
  one mutation. Every expected fact-version candidate is checked, including candidates
  not rewritten. Source currentness and tombstones fence dispatch and commit.
- Official Convex1.46 supports vector eq/or only. Trusted canonical tuple fields encode
  required tenant/space/profile conjunction; an owner tuple additionally bounds own
  grants before top-k. Post-fetch validates owner/source/receipt/profile/currentness.
- Model injection is required. Production default returns typed POLICY_NOT_CONFIGURED
  for extract/resolve/embed. Stable per-purpose operation identity is passed to the
  future governed Gateway adapter; no provider fallback/recursive memory call exists.
- Attributed assistant context can have vectors; assistant claims never invoke fact
  extraction. Strict structured confidence0–1 is converted exactly once to0–100.
- Recall uses shared normalization, deduplication, ranking and context formatting with
  an injected clock. Scope/owner/subject/type are filtered in the database before the
  bounded facts take; oversize matching scopes explicitly fail QUERY_TOO_BROAD.

## Observed verification

Exact argv/cwd/start time/duration/exit codes: checks/commands.json. Raw logs are
retained separately and contain no provider keys/JWTs/private keys.

| Check | Observed result |
| --- | --- |
| Retained scoped strict TypeScript project | PASS, exit0 |
| Complete Convex backend strict TypeScript | PASS, exit0 |
| Affected ESLint including tests | PASS, exit0, zero errors/warnings |
| Runtime memory outcomes | PASS,2 suites,53 tests, zero skipped, exit0 |
| Root strict TypeScript | FAIL, exit2: Task03B internalized purgeAll old test references and a concurrently unfinished Task03B test callback type |
| SDK build | exit0; retained as non-certifying concurrent shared-output receipt |
| Packed/browser public contracts | exit0; retained as non-certifying concurrent shared-output receipt |

The shared SDK build/pack runner was already started when the coordinator requested
serialization with the client executor, and finished before the stop message arrived.
It changed ignored dist output only. Its passing exit codes do not certify the shared
build gate; the parent must use its serialized client/build receipt on the actual final
sources. checks/commands-types-tests.json separately preserves scoped receipts.

Tests invoke real registered handler bodies and actual repository/action-adapter logic
against an outcome-focused test database that honors scoped indexes/filter/take and
transaction rollback. They do not claim live Convex validator or vector-service coverage.
The deliberately invalid https://unit.invalid satisfies the existing root Jest bootstrap;
no test constructs a network client or sends requests. The root bootstrap's generic
"managed/vector supported" text is configuration boilerplate, not managed evidence.

Assertions cover foreign-tenant same-ID first selection, owner/scope forgery, actual
content-hash mismatch, event alias, canonical receipt identity and payload collision,
late source event/revision change, scoped/tenant/row tombstones, all-candidate CAS with
rollback, malformed canonical chunk windows/hash/profile/duplicates, assistant claim
rejection, foreign-owner/missing-lineage/stale facts, temporal validity, incompatible or
stale vectors/profile/owner/tenant/space/receipt, exact top-k filters, explicit sharing,
revocation before/between/after model dispatch, write-only permission separation,
read-before-query-dispatch, normalized replay/idempotency and confidence91%.

## Scope ownership and downstream gates

Executor additions to convex-dev/schema.ts are only the runtimeMemoryTables/sourceLineage
import, runtimeMemoryTables spread, facts provenance fields and by_runtime_scope_factId.
The memories provenance/index and both content-search owner filter changes are Task03B.
No overlapping edits were made after parent transferred the root schema window.

Task04 must replace unconfiguredMemoryModel with governed Gateway policy/budget/reservation,
known/uncertain usage handling and paid dispatch reuse. The current replay tests verify
stable model operation IDs and local persistence deduplication; they do not certify zero
paid replay. An unconfigured public remember can persist the attributed source before
its policy failure and creates no derived receipt, facts or vector; later admission/stage
state must expose that honestly. Gateway inference itself was not invoked.

Task08 owns durable stage scheduling, ordered conflict/history/outbox transactions,
contiguous watermarks, strict barriers and eligible pending tails. It must remove/retire
stale source-derived vectors so old revisions cannot consume current top-k indefinitely;
by_scope_source_revision provides the scoped cleanup lookup. The primitive atomic receipt
does not certify ordered conflict resolution, history, graph or stage completeness.

Task09 must qualify actual Gateway default embeddings and managed1536 index search,
including exact canonical tuple filter behavior, signed negative identity cases and full
text/client/UI outcomes. No disposable deployment was touched or live model/storage/
vector/browser check executed by this executor. contracts.md defines the exact handoff
for fresh manual Task03B facts and later model/memory stages.
