# Task 02A frozen pure domain contracts — v1

Authority: Task 01 frozen contracts and approved fresh-install architecture.
Scope: pure SDK domain extraction. Task 02B owns actual scoped Convex ctx adapters and
explicit modern remember/recall routes. Task 04 supplies governed Gateway execution;
02B can independently compile and test with an injected model and fail-closed default.
No production inference or deployment is part of this substep.

## Import boundary

Backend/default-Convex and browser consumers import `src/domain/index.ts` or its leaf
modules. Runtime imports remain entirely under `src/domain/`; SDK record types are
type-only imports. There is no `Cortex`, `ConvexClient`, subscription, graph worker,
Node import, provider SDK, token/config/environment access or `Date.now()` in this graph.
The SDK root export/manifests remain outside 02A ownership. Package export routing and
explicit client/backend integration are later integration work.

The pure deduplication types also reside in `src/domain/deduplication.ts`; the one
reexport path in `src/types/index.ts` points there, avoiding type-only traversal into
the Convex client/generated backend graph.

Existing client modules delegate the same extraction parser/prompts, slot normalization,
conflict heuristics and recall scoring/context helpers. Their client default clock
preserves existing date rendering. Domain recall functions return fresh scored/deduped
items instead of changing the caller's score or graph context.

## Trusted scope and source lineage

`TrustedMemoryScope` requires `tenantId`, `tenantEpoch`, `memorySpaceId`,
`memorySpaceEpoch`, `principalId`, `principalVersion`, `membershipId`,
`membershipVersion`, `grantId`, `grantVersion`. This matches 03A
`RuntimeAuthorityReference` narrowed to an explicit memory space. A structural object
does not authenticate a caller; only the trusted backend authority adapter constructs it.

`MemoryAuthoritySnapshot` supplies the current scope plus `principalActive`,
`membershipActive`, `grantActive`, `tenantActive`, `memorySpaceActive`.
`assertMemoryAuthorityCurrent(expected,snapshot)` rejects any inactive lifecycle flag
or changed identity/version/deletion epoch with `FORBIDDEN`.

`SourceReference` is `{sourceId,sourceEventId,sourceRevision}`; revision is a positive
safe integer. `SourceLineage` adds one of:

- `{role:"user",trust:"user_assertion"}`
- `{role:"tool",trust:"verified_tool_evidence",operationId}` with stable tool operation ID
- `{role:"assistant",trust:"assistant_claim"}`

`assertSourceLineage(unknown)` validates runtime attribution. User and verified tool
sources are fact eligible. Assistant claims remain context/source evidence and are
rejected before extraction dispatch and when supplied extraction results are parsed.
The model never supplies lineage; `AttributedFact` receives it from the source adapter.
An assistant can be normalized/chunked/retained without becoming a durable user fact.

## Logical sources, chunks and vectors

`SourceContent` stores trusted tenant/space, `ownerPrincipalId`, lineage, normalized `content`,
`contentHash`, `createdAt`, optional `tombstonedAt`.
Preparation validates all required trusted scope identifiers and positive safe versions/
epochs. Modern source prompt/dispatch/parsing boundaries require nonempty scope/owner,
normalized nonempty content, canonical lowercase 64-hex SHA-256 metadata and finite
nonnegative timestamps within the JavaScript Date range. Preparation rejects an invalid
clock result. Actual content/hash equality remains the repository's obligation.
`SourceChunk` is a separate logical record with tenant/space, source reference,
`chunkId`, `profileId`, ordinal, code-point start/end, text and text hash.
`DerivedVector` is a separate record with tenant/space, source reference, vector/chunk
IDs, complete pinned profile, finite embedding and processing receipt ID.

`DEFAULT_EMBEDDING_PROFILE` is exactly `cortex-text-small-1536-v1`, model
`openai/text-embedding-3-small`, dimensions 1536, normalization `text-nfc-lf-v1`,
chunking `codepoint-1600-overlap-200-v1`, index `by_default_embedding_v1`.
Trusted filter fields are `tenantId`, `memorySpaceId`, `profileId`.
`assertProfileMatches` compares every profile field, never dimensions alone.

`normalizeSourceText` applies NFC, CRLF/CR to LF and outer trim, preserving internal
whitespace/paragraphs; empty results reject. Query adapters use the same function.
`chunkNormalizedText` requires normalized text and emits code-point windows of at most
1600, advancing 1400 with overlap 200; surrogate pairs and internal boundary whitespace
remain intact. `prepareSourceContent(scope,lineage,text,clock,profile?)` returns separate
source/chunks with deterministic IDs/hashes. Only the frozen default profile is currently
supported by that preparer; additional profile qualification remains Task 10.

`assertEmbeddingVector` rejects wrong length, sparse arrays and nonfinite coordinates.
`validateModelEmbeddings(result,expectedProfile,expectedCount)` additionally rejects a
different profile or output batch size. `isCurrentAuthorizedVector(vector,source,chunk,
scope,profile?)` checks all tenant/space references, chunk identity, source event/current
revision and tombstone, while validating profile/shape. This is a post-search defense;
the repository still must recheck the trusted grant and its resource access.
Malformed source metadata, lineage or source/vector/chunk identity throws an
`INVALID_INPUT` error. Valid stale, cross-scope, wrong-chunk or tombstoned results
return false. Source/event IDs and vector/chunk/receipt IDs must be nonempty; all
source revisions must be positive safe integers before equality can establish currentness.

`semanticHash` uses async browser/default-Convex WebCrypto SHA-256 over UTF-8, with no
Node crypto import. `processingIdentityKey` hashes the canonical JSON tuple
`[sourceEventId,sourceRevision,stage,semanticPolicyVersion]`; stages are extract/facts/
vectors. Chunk IDs hash tenant/space/source/event/revision/profile/ordinal/exact text.
Hashes are lookup aids, not authorization/equality proof. Before reusing a source or
receipt, the repository compares complete canonical identity/content. A hash collision
or same identity with different canonical data is `IDEMPOTENCY_CONFLICT`; it must never
overwrite or silently reuse another source. A repository is scoped before key lookup.

## Repository and model seams

`MemoryRepository` is required, with immutable `scope` and these methods:

```ts
recheckAuthority(): Promise<void>
getSource(sourceId): Promise<SourceContent | null>
putSource(source): Promise<{ source: SourceContent; created: boolean }>
commitDerived({ source, identity, chunks?, vectors?, facts?, expectedFactVersions? }):
  Promise<{ receiptId: string; created: boolean }>
searchVectors(profiledQuery, limit): Promise<readonly VectorMatch[]>
listFacts({ subject?, factType?, limit }): Promise<readonly DerivedFact[]>
```

Each operation rechecks current stored authority and lifecycle. Writes atomically fence
current event/revision/tombstones, canonical idempotency and optional current belief
versions. Search applies trusted profile/scope filters and post-search authorization and
currentness checks. `DerivedFact` reuses established `FactRecord` outcomes (confidence
0–100) and adds trusted `ownerPrincipalId`, lineage/extraction policy version. The
repository evaluates source/fact ownership using 03A own/space/tenant resource access;
scope equality alone is not an ownership grant. Extraction facts use confidence 0–1;
02B converts exactly once at its persistence boundary.

`MemoryModel` is a required injected internal operation seam:

```ts
extract({ purpose: "memory.extract", operationId, policyVersion, attempt,
          source?, system, prompt, schema }): Promise<unknown>
resolve({ purpose: "facts.resolve", operationId, policyVersion, attempt,
          source?, candidate, system, prompt }): Promise<ConflictDecision>
embed({ purpose: "embedding.memory" | "embedding.query", operationId,
        policyVersion, attempt, source?, profile, texts }):
  Promise<{ profile: EmbeddingProfile; vectors: readonly (readonly number[])[] }>
```

`InternalModelOperation` requires a stable operation ID, policy version and positive
attempt. The adapter uses these registered keys for policy admission, checkpoints,
usage/outcome receipts and no automatic provider retries. It never invokes public chat,
remember/recall, context injection or ingestion wrappers. There is no direct-provider
fallback. Ambiguous dispatched failures propagate for explicit receipt reconciliation.
`MemoryDomainAdapters` composes required repository/model/clock.

`extractSourceFacts(source,model,operation)` validates operation/source match, builds
the source-policy prompt, dispatches exactly one `memory.extract` call and strictly
parses output while assigning trusted lineage. It does not persist or retry. 02B checks
authority/current source before dispatch and before committing; 08 owns durable stages.
`FACTS_JSON_SCHEMA` is transport-neutral JSON schema for structured output; modern
`parseSourceFactsResponse` rejects malformed facts/entities/relations and model-provided
source authority. Legacy `parseFactsResponse` preserves permissive existing outcomes.
All collections in modern structured facts must be dense arrays; sparse facts, tags,
entities or relations reject before serialization. Cosine similarity likewise validates
both vectors at every index, rejecting holes and nonfinite coordinates.
Modern/source prompts use `SOURCE_EXTRACTION_POLICY_VERSION=source-attributed-facts-v1`.

## Clock and reused algorithms

`DomainClock` requires `now():number`; optional `formatDate(timestamp):string` controls
old-date rendering. Pure domain defaults to an ISO date string, while client wrappers
inject their established local date renderer. Domain `rankResults(items,clock)`,
`formatForLLM(items,clock)` and `processRecallResults(vector,facts,graphMemories,
graphFacts,entities,options,clock)` require explicit clocks. Conflict
`buildUserPrompt(candidate,facts,options|undefined,clock)` and
`buildConflictResolutionPrompt(candidate,facts,options|undefined,clock)` also require one.
Each rank/context/prompt calculation captures the clock once.

The domain exports the existing ranking weights/boosts, memory/fact conversion, merge,
dedup, source breakdown, conversation enrichment; subject/predicate/slot helpers;
conflict system/examples, decision parsing/validation and fallback heuristics; exact
fact normalization and cosine similarity; and existing extraction types/parser/prompts.
No alternate semantic memory engine or new client-held service is introduced.
