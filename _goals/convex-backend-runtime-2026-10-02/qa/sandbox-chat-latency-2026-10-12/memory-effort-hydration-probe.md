# Hydration probe on actual 3875 executions

Read-only diagnosis of `3875d3238705a90cb191abbf824d3fa3517e42e5`. **One concrete missed raw-read family is the root lookup in `ConvexMemoryRepository.getSource`; it is a bounded next candidate, not a demonstrated latency repair.** Exact CPU versus nested-component waiting cannot be recovered from the saved receipts. No implementation, runtime service/model/credential calls, tests, builds, Git writes, Proofs or website writes were performed. Only this report and its JSON companion were created. The separate grammar and already-bound seed repairs are untouched.

All source references below are frozen `git show 3875d323…:<path>` line numbers, not the concurrent worktree edits. The approved `modified-goal-execution-v4.md` and original goal keep fresh auth/source/delivery fences and separate terminal financial capture/result attachment mandatory. The original 17 tasks are not reopened.

## Actual execution evidence

The two browser snapshots and CLI post-pair snapshot form an uncapped union of 1772 distinct execution rows. Every browser table row was rejoined to its official execution ID/request ID; CLI rows join each exact run's `direct.prepare.begin` to its Action request ID. The JSON retains every stage's execution ID and usage. Saved official rows contain **zero component Query completion records**: there is no recorded `messages.getMessagesByIds` child duration. The snapshot projector preserves every Completion entry it receives (`memory-effort-singleton-service-log-snapshot.mjs:79–86`), so this is a limitation of these retained receipts, not proof that the child calls were free.

Normal indexed / High / Max retain 0 / 2 / 4 prior history messages, with the same displayed 2 facts and 4 memories. Their save/candidate native calls show:

| Case | Native execution ms | Reported user execution ms | Read docs | Read bytes |
|---|---:|---:|---:|---:|
| normal-indexed | 330.3 | 202.4 | 143 | 398,403 |
| high | 365.5 | 228.7 | 257 | 674,026 |
| max | 808.6 | 324.1 | 371 | 948,499 |

The corresponding context-input native calls show:

| Case | Native execution ms | Reported user execution ms | Read docs | Read bytes |
|---|---:|---:|---:|---:|
| normal-indexed | 323.5 | 222.4 | 131 | 204,902 |
| high | 1375.2 | 431.8 | 309 | 632,440 |
| max | 732.0 | 408.8 | 484 | 1,047,057 |

The CLI runs have zero selected prior history yet still miss Normal: 10,333.3 and 6,031.7 ms. This prevents assigning all misses to selected history growth. Their readMatches/delivery calls are 1,927.9/883.4 ms, reported user execution 374.0/359.2 ms, with 365/609 documents and 1,188,711/1,732,495 bytes. Ambient timing and evidence breadth also matter. No named stage shows an OCC retry. These are observations, not a controlled scaling comparison.

`executionTime` and `userExecutionTime` are preserved as official fields. Neither is relabeled database CPU or exclusive JavaScript CPU. The Action's reported user time also overlaps the serial child/inference chain; subtracting these fields cannot identify component waiting. Same-request component mutation intervals elsewhere are not a parent/child hierarchy. No CPU-versus-wait percentage is supported.

## What the eight hydration entries actually repeat

`saveAndPrepareContextV8Handler` calls save then candidate (`runtimeAgent.ts:1946–1951`). On the ordinary noncompleted candidate branch the eight `executionContext` entries are save (`1909`), candidate entry (`2135`), completed-step lookup (`817`), both resolutions (`228`, `2140`), post-selection reload (`2161`), operation begin (`783`), and operation start (`829`). They are helper calls inside one native transaction. They are not eight Action RPCs.

Every entry calls `activeAttempt` and the own execution query, parses/validates its snapshot, performs selected hydration, current source/artifact checks, and reconstructs model projection (`runtimeAgent.ts:169–224`). Within selected hydration, `hydratePrivateCutoff` first executes `hydrateCutoff`, then the private pass (`runtimeTranscript.ts:431–505`).

| Read/work family | Existing suppression and the actual remaining path |
|---|---|
| Native selected-message batches | Already use `readNativeTranscriptMessages`; exact reference plus ordered ID array, 16-entry / 250 KB bounds, cloned hits and designated writer retention. Two history passes do not imply two physical child queries. Different ID-array keys or overflowing bounds can miss; these receipts do not expose hit/miss counts. |
| Bridge, recursive managed source/conversation/run rows | Already share bounded raw rows. Every currentness/permission predicate still runs. `runById` already uses the raw run reader. A `runtimeRuns` writer evicts the run family; source/conversation/bridge/security/unknown/component writers clear as defined by the original scope. |
| Root witness source row | `checkContextSourceWitnesses` loops each source/permission (`runtimeContextWitness.ts:8–15`); `getSource` always issues original `runtimeMemorySources/by_scope_source .unique()` (`runtimeMemoryRepository.ts:117–125`). This root query bypasses the existing graph reader; only recursive linked-source `.take(2)` at `runtimeDataAuth.ts:258` uses its source cache. A source used in both permissions and bridge/owner fences can therefore have repeated physical root queries despite the existing reader. Exact counts/time are unavailable. |
| Mutable control state | Each `activeAttempt` directly queries current conversation, outbox and run attempt; each `executionContext` directly queries own `runtimeAgentExecutions` (`runs.ts:44,297–305`; `runtimeAgent.ts:127–131`). These are intentionally outside generic raw caching. Their state changes are material to lifecycle/lease/cancellation and must stay current. |
| History owner executions | The private pass issues `runtimeAgentExecutions/by_attempt .take(2)` per message (`runtimeTranscript.ts:484–485`). `checkedAttempts` deduplicates source/artifact validation only after the query (`494–498`), so it does not suppress owner lookup. The saved receipts do not expose which selected messages share an owner, and mutable attempts are deliberately not cached. |
| Current saved-message batches | `executionContext:182–193` directly invokes the component, outside the native message reader. These first-model-turn receipts do not establish a nonempty saved-message set, so this is not attributed to their latency. |
| Parsing / hashing / projection | Snapshot JSON and canonical equality, selected-policy/message digests and private-message copying rerun. `semanticHash` awaits WebCrypto (`profile.ts:75–77`). No per-transform input size/count/time establishes which dominates. |

Thus eight logical entries are real repeated work, but multiplying eight by all transcript/source reads overstates I/O. The root source getter and owner/current control queries are explicit remaining physical reads; the official totals cannot attribute their individual contribution.

## One bounded next implementation candidate

Add an exact-native-owner private V8 raw reader for **the original `.unique()` result in `ConvexMemoryRepository.getSource`**, at `convex-dev/runtimeMemoryRepository.ts:117–125`. Keep the original query/cardinality semantics and its original duplicate/query error. A separate operation key can distinguish this result from the existing `.take(2)` raw source-array entry while sharing the original bounded source-family count/byte budget and invalidation machinery. Default and fresh independent native contexts fall back to the original query.

Every logical getter still executes both authority checks, `managedSourceIsCurrent`, conversation/source permissions, dependency traversal and expiry/deadline propagation. Cache only raw `Doc | null`, clone on return, retain no exceptions or decisions. Keep original unknown/fluent/security/component and failed/in-flight write handling, explicit fresh-source boundaries, and run-family eviction. Keep mutable Agent/Run attempts uncached. A broad hydrated-context cache would need substantially stronger invalidation proof and is not this candidate.

The meaningful oracle is a controlled comparison through real registered `saveAndPrepareContextV8`: identical return/native model request, writes/effects/final state, and ordered logical predicates; fewer original root `.unique` reads only for repeated exact scoped sources within one permitted owner. Exercise same-source both-permission witnesses and history bridge/owner witnesses. Existing `runtimeAuth/managed-source-read-scope.test.ts` and `runtimeAgent/v8-preparation-read-retention.test.ts` provide relevant fixture patterns; this probe ran or modified no tests.

Required negative mutation cases are: same ID in another tenant/space; cached absence then insert; source patch/replace/delete; duplicate source and query exceptions; source/bridge/conversation/run change; grant/share revocation or expiry; unknown/fluent/component writes, including pending and failed writers; late-read population; returned-row mutation; bound overflow; a new native owner and explicit post-I/O source fence. Compare the original first refusal and full rollback, and prove there is no candidate/paid dispatch or financial-result attachment after refusal. Do not mock away the source/permission predicates just to obtain a read reduction.

The permission argument must remain exactly as supplied, including `undefined`. In the actual recall composition, an earlier fact-source batch label is witness bookkeeping; its getter does not independently authorize `canViewFacts`. The later explicit fact bind remains mandatory. A useful focused oracle warms the same raw row through an undefined-permission or `canViewMemories` call, then proves `canViewFacts` still refuses under a share that denies facts, in both call orders and after expiry. A raw hit cannot convey an earlier permission verdict.

Suggested disjoint implementation files are `convex-dev/runtimeAuth.ts` (one operation-distinct, bounded raw unique-result method and existing exact-owner invalidation wiring), `convex-dev/runtimeMemoryRepository.ts` (only the original getter's raw lookup), a new `tests/unit/runtimeMemory/source-root-read-scope.test.ts`, and, if useful, the existing `tests/unit/runtimeAuth/managed-source-read-scope.test.ts` fixtures. Initial status showed both proposed source files clean; recheck before edits. Parent owns implementation; this subtask has no source-write authorization.

Do not touch the concurrent canonical grammar/seed files: `runtimeMemoryTraversal.ts`, `memory-direct-recall.ts`, `memory-traversal.ts`, `whole-recall-composition.test.ts`, `direct-fact-rule.test.ts`, or `query-composition.test.ts`. Consequential conflicts are preserving `.unique()`'s exact duplicate error rather than reusing `.take(2)` semantics; keeping ordinary/default public and ingestion root getters unretained unless explicitly inside the private V8 owner; preserving exact-owner view propagation; and retaining every current permission/deadline/write fence. No serialized/public cache handle or broad mutable-attempt cache is needed.

No measured savings is assigned. This candidate reduces one identified redundant query family if its controlled oracle passes. Hosted first-text improvement requires the changed installed candidate's actual measurements after the separately owned grammar/seed fix; it cannot be predicted from read counts.

## Minimal trace still needed for attribution

Instrument only scalars under existing opt-in latency tracing: per-`executionContext` caller/stage ordinal, selected pin count and elapsed; exact native batch hit/miss/overflow plus cumulative awaited `getMessagesByIds` count/ms; root `.unique` and owner `.by_attempt` count/ms; direct current conversation/outbox/execution/run-attempt count/ms; parse/canonical/hash count/inputBytes/ms. Use nonoverlapping scopes or explicitly label nested totals. Retain no private content, source/message IDs or permission verdicts. Preserve fresh boundaries and writes.

Those scalars can distinguish a large awaited component interval from measured local transformation work. Residual native wall time still contains database/runtime scheduling and is not an exclusive CPU measurement. The current receipts cannot resolve that split, and a new profiler or native trace would be needed to claim it.

Convex documents that native `runQuery` shares its transaction snapshot but adds validation and isolated-context overhead; component access requires those calls. [Query context reference](https://docs.convex.dev/api/interfaces/server.GenericQueryCtx), [component transactions](https://docs.convex.dev/components/using), [helper and boundary guidance](https://docs.convex.dev/understanding/best-practices). These explain why avoiding a duplicate component call could matter, not how much these runs spent there.

Primary receipts were SHA-256 checked unchanged before/after this analysis. Frozen source hashes, exact joins, all eight-case native stage rows, limitations and candidate oracle are retained in [memory-effort-hydration-probe.json](memory-effort-hydration-probe.json). No acceptance, cleanup, finance or release milestone advances from this diagnosis.
