# Task Completion Report

## Status: COMPLETE — source and scoped offline checks

Fresh runs dispatch **executeTurnV2**, whose new journaled inline mutation completes context only when the **original bounded authoritative probe proves indexed-empty**. This removes the empty context Action/workpool handoff while preserving current checks. The historical executeTurn registration/body and original prepareContext Action body remain unchanged. The installed K7 source/image remains immutable7fec; no deployed code or artifacts were changed. Independent non-author review and installed cloud qualification are coordinator-owned next steps. The 1,000 ms submission→visible-text goal remains unmet by actual K7 and is not claimed from these tests.

## Changes made

- `convex-dev/runtimeAgent.ts`: extract the exact original saveContext body into a private helper; add Attempt-only internal prepareEmptyContext that directly calls the existing contextInputs helper and original save helper in sequence. No external network/model I/O occurs in the mutation. Add the versioned Workflow layout for fresh starts, preserving the old layout byte/AST body for existing journals. Start changes only its referenced Workflow function name; startAsync/onComplete and all other behavior are unchanged.
- `tests/unit/runtimeAgent/empty-context-inline.test.ts`: actual registered context handlers and existing native DB/component fixtures prove equivalent empty/pending/UNKNOWN-pending/barrier-warning data; no writes or model admission on unproven-empty fallback; original governed retrieval; current Attempt/source/profile/witness/authority/budget races; original32-source bound and transactional write rollback.
- `tests/unit/runtimeAgent/empty-context-workflow.test.ts`: real installed Workflow0.4.8 StepExecutor/createWorkflowCtx exercise inline journal completion, exact completed replay, parent journal-write rollback, versioned/old layout behavior, unchanged governed Action fallback and strict sleep/deadline/warning/failure semantics.

## Requirements checklist

- [x] Native mutation accepts only the original reference/run/attempt/lease tuple; no caller cutoff/profile/context/witness selectors. Registration is internal and validator negatives exercise actual registration metadata.
- [x] Original executionContext→pending→availability bodies run sequentially. The original cutoff, represented/pending exclusions, current embedding profile, maxBytes, barriers and error precedence are retained. Source/authority/transcript/lease checks and model-policy/budget checks remain present.
- [x] Nonempty or bounded-unknown metadata returns NEEDS_ACTION with no context/model writes, then dispatches the original prepareContext Action with retry:false and exact Attempt. Unsupported/stale profile errors remain errors, never empty proofs.
- [x] Original pending overflow failure is a marker, before availability. The Workflow persists the original separate failContext mutation before exposing failure. Warning context, pending witnesses and32-source/16,384-byte bounds match original positive outcomes.
- [x] Original saveContext body, including empty/profile re-probe and current source/witness checks, is preserved exactly and repeated atomically after the local probe. Eligible source/index appearing, incompatible profile generation, revocation, lease change, source hash/owner/tombstone change, budget cancellation and policy revocation deny false completion on actual ports; write faults roll back all context state.
- [x] New Workflow registration preserves historical executeTurn body and journal layout without migration. Original strict barrier/sleep, model/tool/approval/billing/replay/finalization/title tail, startAsync and onComplete remain unchanged. Completed journal replay performs no repeat context writes; journal failure rolls back the local write in the controlled parent transaction.
- [x] No synchronous Workflow start, context+model fusion, guard removal, retry/funding change, new generic admission or modified provider/client/memory helpers.

## Files modified and frozen

| File | Action | SHA256 |
|---|---|---|
| convex-dev/runtimeAgent.ts | Modified | 0b0c216c52a963643dde89982508a99b293f16cdeea4cc7a740bae7a4774fa25 |
| tests/unit/runtimeAgent/empty-context-inline.test.ts | Created | d1610a256c5b95ffaf2206ddcfc16d344e4dd6051458db2367cfa6fa9586dbeb |
| tests/unit/runtimeAgent/empty-context-workflow.test.ts | Created | 1ea2e28097c367743d91d0fc7013945f82af25dc596ef997844135d8a04094ab |

Only one existing backend production file and two new focused tests changed. No new backend helper/import file, generated binding or distribution closure expansion: count change **0**. The current API binding already derives runtimeAgent module types. Existing unrelated QA modification and21untracked work entries were preserved.

## Verification

Exact working directory `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion`; pinned Node **v24.15.0**, npm **12.2.0**. Explicit offline Jest mode targets inert127.0.0.1:9 and tracing is off; no test invokes a live service, paid inference or deploy.

- [x] Final coherent Jest: **238/238 tests,8/8 suites,0 failed/0 skipped/0 todo**, process exit0. Actual selected suites: new handler39, new Workflow8, existing context42, old inline-barrier7, execution86, model-owner21, checkpoint-composition28 and native public-payload7. Receipt `cloud-empty-context-inline-jest-final-v4.json` plus raw log.
- [x] RootCI `tsc --noEmit`, backend `tsc --project convex-dev/tsconfig.json --noEmit`, lint `tsc --project tsconfig.lint.json --noEmit`: all exit0. Scoped ESLint over the three frozen files with unused-directive checking: exit0. Dependency imports/types are checked by root/backend types; no package build or service gate is inferred.
- [x] **19** exact original-body/validator/layout assertions pass. These include original saveContext extraction, executionContext/contextInputs, old executeTurn, original prepareContext, original barrier/failure/model/preparation/admission/output/finalization/completion bodies, V2's unchanged strict-barrier prefix and complete model/tool/approval/title tail, exact start identity-only change and Attempt-only new args. Receipt `cloud-empty-context-inline-equivalence.json` SHA256 `e551f58111e553d4bcd1ea8921cba4b79338af5ba42ed5b11e5f0518d9151ec0`.
- [x] Local official Workflow0.4.8 contract excerpt/hash preserved in equivalence receipt. Inline queries/mutations execute on the parent mutation context and journal their result; Actions explicitly cannot run inline. The tests import the real installed executor/context rather than reimplementing those semantics.
- [x] Source diff whitespace check passed; no unrelated formatting or production/test assertions weakened.

Full command strings, test discovery/counts, process exits and raw receipt hashes are in `cloud-empty-context-inline-checks.json`, SHA256 `1813341d905a9de43f99d8fed1fe1ee71d36d59222ea568eeadc874954cea40f`.

## Preserved failures and corrections

The initial new-suite receipt has **43/44 passed,1 failed,0 skips**, exit1: the new Workflow fixture did not route the actual runtimeMemory profile query reached by governed fallback. Adding that native query route corrected the fixture without mocking the context helper or dropping fallback assertions; failed-suite recheck8/8 passed. The original root type receipt exits2 for the overloaded DB patch fault-port callback; explicit typed2required/1optional parameters fixed its signature, then full rootCI exited0. A later coherent command named a nonexistent runtimeAgent/delivery.test.ts: **231 discovered tests passed but discovery failed**, exit1. This raw receipt remains preserved; the final coherent command uses the existing runtimeDelivery/public-payload.test.ts and passes238/238. No original red receipt was overwritten or relabeled PASS.

## Notes for reviewer and remaining limits

The extra layout is deliberate compatibility: existing journals retain executeTurn's exact body, while new journals use executeTurnV2. A completed standalone mutation result cannot overwrite committed context; the actual inline executor consumes a matching completed journal result instead of rerunning the mutation. The lost-journal test uses the actual executor with a controlled failing journal port and encompassing fixture transaction. Real hosted native OCC/scheduler behavior remains an installed-candidate qualification task; the controlled port tests do not certify service OCC or latency.

**Fallback tradeoff:** V2 nonempty/metadata-overflow cases perform an extra authoritative inline probe before the unchanged Action re-probes inputs. This may add retrieval latency; it is disclosed rather than transferring a cached authorization/context DTO. The measured K7 empty path is the intended optimization. Larger combined inline transaction read sets may also raise resource/OCC pressure. Original caps remain unchanged; tests cover32pending sources and1026metadata fallback, and actual hosted qualification must observe the new generation before any speed claim. No numerical savings or subsecond assertion is made.

Only the allowed source/tests and `cloud-empty-context-inline-*` QA receipts were written in this batch. No Proofs/runtime/package/generated edits, live target/key access, deployment, inference, Graph/GitHub/UnionArena access, Git stage/commit or artifact regeneration occurred. K7 saved attribution was completed separately in its three expressly authorized report files before this implementation began.
