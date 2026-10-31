# Task Completion Report

## Status: COMPLETE — source/test batch frozen

Agent context recall now uses one private contextSource query for each original sequential readSource→indexedSourceAtCutoff pair. K10 populated CLI observed four uncached pairs over736.092ms inside5300ms recall, with each native user execution~56–59ms and engine~88–92ms. This change composes those existing reads; that entire window is not predicted removable RPC time. No installed speed, native OCC, functional cloud or subsecond SLO success is claimed. The1second goal remains unmet by existing K10 browser/CLI samples.

## Changes made

- runtimeAgent.ts adds internal contextSource and a typed reference. Its read capability/reference, expected event/revision/optional hash, excluded keys and immutable cutoff/boundary derive from the original trusted Action snapshot/selected evidence. The first original ConvexMemoryRepository.getSource still reloads scope/source authority and managed source/dependency/transcript currentness. Original missing/lineage/hash STALE_CONTEXT checks precede exclusions; exclusions still avoid eligibility reads. The original indexed cutoff body runs next, retaining its own second complete source getter. No invocation-to-invocation auth/profile/source cache or paid/network operation exists in the new query.
- runtimeMemoryContext.ts exports the shared original boundary validator and extracts readIndexedSourceAtCutoff. Its original registered query/validator remain supported. The complete handler body is byte-exact to the frozen preimage. Event unique selection, eligible state, cutoff, event/source content hash and event lineage, current conversation queue/terminal/tombstone/approved transcript position remain unchanged.
- context-source-composition.test.ts exercises actual original registered handlers and production getter/class with transactional DB/component ports. Only paid embedding transport/result is controlled; original profile/authority/budget readers and actual recall service, ordered selection, witness merge, finalDelivery and saveContext bodies execute. No test claims a real model/native OCC/service deployment.

## Preserved boundaries and required outcomes

- Two original read snapshots become one private query snapshot. Both original getters/checks still run sequentially; this does not reuse an authorization result. Native query snapshot/OCC behavior requires installed follow-up evidence.
- Source/lineage/hash denial precedence, source permissions, original cutoff/boundary/exclusion order, selection order, expected hash presence, query profile/model/account bounds, pending/UNKNOWN/overflow/strict barriers and original failure writes are preserved. New native expected object explicitly projects only event/revision/optional hash; no source-role/trust extras enter its exact validator.
- Witness permissions/provenance and tail remain byte-exact. Original Action repository listFacts/searchVectors still capture identical source/fact/vector delivery bindings. Original finalDelivery mutation remains after all retrieval I/O; original saveContext freshness/lease/current grant/cancellation/transcript/witness/profile checks remain after delivery. Any fault cannot save or overwrite a competing context.
- Model preparation/resolution/admit/checkpoint/visibility/output/billing/UNKNOWN/replay/finalization, historical Workflow registrations and new V3 separate boundary stay unchanged. No secondary-call policy, deadline, source cap, retry or output contract changes.

## Frozen files

| File | SHA-256 |
|---|---|
| convex-dev/runtimeAgent.ts | d2d108e0e019d94e846acf1ea875b8ad7202edbf6bb52e061129b29fc36f7ddd |
| convex-dev/runtimeMemoryContext.ts | 6c3ecab80b4953e0e4f3c94ca4396217ab5a51738da1ab3bb29163450deaa070 |
| tests/unit/runtimeAgent/context-source-composition.test.ts | f4e3dc440cd33929cd82f2dd6943a05fe090d34dfc44b4d0f9119768d4758c4a |

Only these three product/test files were written in this batch. runtimeMemory.ts, model policy, first-stage tests, Proofs, generated bindings, Gateway wire/parser, package versions and immutable live candidate were not edited. Distribution source file count delta0.

## Verification

- Node24.15.0, npm12.2.0, TypeScript6.0.3, ESLint10.11.0; explicit offline Jest environment, URL127.0.0.1:9, runInBand/watchman=false.
- Coherent affected source/dependency run: **398 passed,13 suites,0 failed,0 skipped,0 todo**, exit0. It covers new actual source-handler tests, Agent context/execution/empty-context Workflow, frozen resolution/model-owner, ingestion context/permissions and memory repository/profile/service/final-vector-delivery dependencies.
- Final exact focused file: **46 passed,1 suite,0 failed/skipped/todo**, exit0. Final change since affected run was erased test type aliases only, resolving official typed references without generated writes. No production/assertion change followed that coherent passing run.
- Root CI tsc --noEmit, backend tsc, lint-types and final scoped ESLint all exit0. Commands/cwd/output hashes/exits/discovery are in checks JSON; no passing check was broadened or redundantly repeated without a failed check/test change.
- Byte/AST comparison: **67 original Agent declarations** including frozen resolution/modelStep/helpers and all original Workflow handlers unchanged; **15 context declarations** unchanged; complete original cutoff handler/validator, prepareContext outside remember and witness tail byte-exact. Moved stale predicate is TypeScript-printer exact after expected→args.expected binding, with indentation difference disclosed.
- Current original-source success plus exclusions, missing/wrong lineage/hash, current authority/version/expiry/epoch/principal/membership/owner/tombstone/duplicates, queue/run/current transcript approval/position, bounded cutoff, second fresh getter, no writes/no cross-invocation cache, source port failure/no duplicate embedding, post-composition finalDelivery races and post-delivery saveContext lease/cancel/edit/witness/competing-save negatives pass.

## Original failures retained

First focused run correctly refused fixture-root installation because test module loading bypassed the fixture's bootstrap mock (0/46). Second focused run45/46 exposed the test's wrong permission-order expectation; production canonical ordering was preserved and asserted exactly. Root type errors from private erased _handler/generated binding aliases/fixture type and the initial indentation-sensitive predicate comparison remain in named original raw receipts. None is relabeled PASS or concealed. Successor focused/type/equivalence checks pass.

## Notes for joint reviewer

The first independently authored Agent hydration/policy composition is the immediate baseline: Agent preimage fa7d5783beabf3ce67c283a0fed2b78592803cad571a580e11f02eaa42c70385, policy c4a76cef99abffd103004345d93643f184a835ef5a29a3d5142305a33ef2e921. Policy and both first-stage test file hashes remain exact; its Agent handler/model bodies are included in the67 unchanged declaration checks. Its previous source checks remain valid intermediate evidence. The final joint candidate includes both compositions and this later Agent hash.

No service/key/target/paid inference/deploy/build/package/commit operation was performed. Actual native registration/OCC/installed callbacks, complete cloud functional checks and fresh browser/CLI timings remain parent-owned follow-up. A larger source readset can still encounter native contention; no universal speed prediction or provider floor is inferred. Historical original response/approval/verifier failures and current trace boundaries stay preserved.

Checks SHA-256: ef049c1143862472912ab4f5b205db57161e214f4ca030ca872f24a2cbaeab63

Equivalence SHA-256: d2e28ffc2acd74b7e94e73230f62f3b66fa10521c9bc683b2496134de3e0f70b
