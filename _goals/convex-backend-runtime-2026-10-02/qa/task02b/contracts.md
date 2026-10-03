# Task 02B contracts and handoff

These are fresh scoped backend adapters for the frozen Task02A domain contract. They
are independently reviewed bounded implementation evidence (02B PASS4.4/5). No managed vector,
Gateway paid operation, deployment or browser outcome is certified by this substep.

`runtimeMemory.remember` and `runtimeMemory.recall` are the only two public registrations.
They accept optional narrowing tenant/space selectors, text and a stable nonempty
request ID (at most128 UTF-16 code units); recall additionally accepts limit1–100.
They inherit verified Convex authentication into `runtimeAuth.authorize`, require a
concrete space and use the persisted authority reference for every internal operation.
No caller supplies a principal, grant, role/trust, model closure, provider key or vector.
Remember returns only its successful committed fact payload identified by stable factId;
it does not return a fabricated Convex document ID or read unrelated stored facts.
Remember assigns `user_assertion` with exact canonical source identity
`explicit:${JSON.stringify([tenantId,memorySpaceId,principalId,requestId])}`. Different
normalized payload under the same identity is an idempotency conflict.

The six internal registrations are checkAuthority/readSource/writeSource/writeDerived/
readFacts/readVectorMatches. Every invocation reloads current control records. The
write registrations require a write-capable mutation; using the read adapter cannot
write even if the underlying grant separately contains write capability. Source reads
inside write preparation validate the exact write-owned resource. listFacts, vectorSearch
and hydration independently require read, even through a write-scoped adapter. Recall
checks the read fence before its embedding dispatch; write capability is no general
read grant. Function
references name these actual internal registrations with strong argument/result types;
no generated bindings were edited. Parent will run actual codegen at the integration
stage. Action adapters use ctx.runQuery/runMutation/vectorSearch; they construct no
Cortex, ConvexClient, browser subscriptions, provider clients or graph workers.

## Stores and profile

- runtimeMemorySources: canonical normalized content/hash, trusted tenant/space/owner,
  role/trust and source ID/event/revision, persisted timestamp and optional tombstone.
  Canonical indexes by_scope_source [tenantId,memorySpaceId,lineage.sourceId] and
  by_scope_event [tenantId,memorySpaceId,lineage.sourceEventId]. Each must select exactly
  one row. Hashes are not equality proof; writeSource recalculates actual content hash.
  Same identity with different attribution/content conflicts. Replays retain initial time.
- runtimeMemoryChunks: logical deterministic Unicode-codepoint windows and exact
  text hashes, independent of vector storage; by_scope_chunk tenant/space/chunk ID.
- runtimeMemoryVectors: source/event/revision/chunk plus complete immutable profile,
  receipt, 1536 finite coordinates, trusted owner and canonical filter tuples.
  by_scope_vector and by_scope_source_revision support current selection and later
  source invalidation/cleanup. Default declared vector index by_default_embedding_v1
  has dimension1536. Filter fields retain tenantId/memorySpaceId/profileId and add
  scopeProfileKey/scopeProfileOwnerKey as the supported query representation.
- runtimeMemoryReceipts: exact canonical processing identity and complete canonical
  payload plus deterministic SHA-256 receipt key. Same-key different tuple/payload
  is an idempotency conflict. Receipt/chunks/vectors/facts commit atomically.
- Existing facts is the single authoritative facts table. Additive optional fields:
  ownerPrincipalId, lineage, extractionPolicyVersion, processingReceiptId,tombstonedAt;
  by_runtime_scope_factId [tenantId,memorySpaceId,factId]. No parallel belief store.

The unchanged default semantic profile is cortex-text-small-1536-v1,
Gateway openai/text-embedding-3-small,1536; NFC, LF and outer trim preserve internal
whitespace;1600-codepoint chunks overlap200. No legacy embeddings/backfill/reindex.

Official Convex1.46 VectorFilterBuilder supports eq/or, **no and**. The supported exact
conjunction is `JSON.stringify([trustedTenant,trustedSpace,pinnedProfile])` in
scopeProfileKey; own access uses the fourth trustedPrincipal element in
scopeProfileOwnerKey. Index prefilter is one eq on the appropriate tuple. Broader OR
or global search never substitutes for scoped selection. This also prevents foreign
owners/tenants/profiles consuming top-k slots. Post-fetch again verifies all actual
fields, source ownership/currentness, profile/model/dimension, chunk and processing
receipt. A grant is rechecked after vectorSearch before hydrated data is delivered.
The additional fields do not change semantic profile identity. Actual managed index
and embedding behavior remains required before Task09 PASS.

## Manual facts / source lifecycle

Task03B manual fresh fact writes must assign trusted owner and persist a canonical
runtimeMemorySources row (normalized text, recalculated hash, original time,
user/user_assertion for manual assertions). Its fact lineage must exactly reference
that current source event/revision/role/trust. extractionPolicyVersion is a trusted
nonempty explicit-write policy version; sourceType manual (tool only trusted evidence).
No ownership adoption of old rows. Modern read excludes missing-lineage/owner/policy,
assistant-derived, stale-source, deleted, superseded and expired facts. Trusted space/
tenant grants can read other owners only within the authorized scope.

Tracked edits advance source event/revision atomically; the primitive writeSource only
creates or idempotently reuses the exact current canonical source, and cannot serve as
an untracked edit path. Derived old references are excluded immediately. Task08 owns
retiring/removing stale vector rows (by_scope_source_revision index) so they cannot
consume current top-k indefinitely, as well as ordering, fact history, projection
outbox, per-stage durable status and contiguous watermarks/barriers. These are not
certified by the primitive 02B atomic receipt. Tombstones fence sensitive reads,
pre-model source checks and commit. Fact commits require explicit expected version0
for creation or current version for update, with submitted fact.version=expected+1.
Every expected candidate version is checked even if that candidate is not rewritten.

## Model and clock seam

Services require repository/model/clock adapters. Public registrations intentionally
use unconfiguredMemoryModel until Task04 supplies the governed Gateway factory;
extract/resolve/embed return typed POLICY_NOT_CONFIGURED, outcome not_dispatched.
There is no paid call, fake production vector, fallback or recursive public wrapper.
A valid public remember currently persists its attributed source then fails at policy
admission; it creates no derived receipt/facts/vector. Task04/08 supplies observable
admission/processing state. No completeness is inferred from that durable source.

Injected test models exercise memory.extract and embedding.memory/query with stable
operation identity, policy version, attempt and exact source reference. Recall IDs
retain trusted scope, principal, request ID and profile; normalized query text is the
model request payload, so Task04 can reject reused request identity with changed input. Paid operation
reuse/admission/reservation belongs Task04: repeated service calls currently pass the
same stable operation IDs to that adapter rather than independently certifying zero
paid replay. Sources are reloaded before each model dispatch and before commit.
Structured confidence0–1 becomes authoritative facts confidence0–100 exactly once.
Assistant attributed context may have vectors; its claims never invoke fact extraction.
Ranking/context formatting reuse the frozen pure modules with the injected clock;
Convex repository temporal validity also accepts an injected clock (backend default
Date.now). No local inference/graph process is constructed.

Facts apply trusted owner and optional subject/type filters in the database before
taking candidates. A facts read bounds scan to1024 matching candidates and explicitly rejects QUERY_TOO_BROAD
rather than implying exhaustive scope coverage. Normal recall bounds returned items
and uses source/version authorization; strict completeness/pending tails are Task08.
