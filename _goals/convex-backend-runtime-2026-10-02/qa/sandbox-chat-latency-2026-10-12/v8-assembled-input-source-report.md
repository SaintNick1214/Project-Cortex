# Task Completion Report

## Status: PARTIAL — authored source/checks complete; joint quality and native qualification pending

Repository **SaintNick1214/Project-Cortex**, baseline `03256989da22bde35dff78023c1c3962391a68c6`. This is the bounded B implementation in the root's coherent repair batch; it does not accept the failed historical K21 run or claim native performance.

The installed Agent 0.7.3 serializer stores a tool call with both modern `input` and deprecated `args: input` (`mapping.ts:452–468`). The canonical private transcript preserves that shape. The former partial early projector excludes `args`, so it can return `supported:false`; the synchronous selector then leaves optional context untouched. AI SDK 7.0.127 later normalizes the request. The K21 native continuation bound was 41,870 against 32,768, with a persisted pre-ledger `POLICY_DENIED`. Individual historical message keys were not captured; the installed serializer's reachable alias and controlled regressions establish the source defect without pretending to recover private K21 content.

## Changes Made

- `runtimeAgent.ts`: V8 baseline and continuation fitting await the root's official SDK assembled-request checker. Its result includes Agent instructions, whole selected context and the complete tool history/result graph. The candidate is fitted before begin/start. The fresh Action context check uses the same exact conversion; V1–V7 keep their original preflight branch.
- New `runtimeAgentContext.ts`: a private pure fitting adapter emits fixed, opt-in selected row/evidence counts, context UTF8 bytes and the current conservative input bound only after success. It reads no authority, dispatches no model, reserves no budget and exposes no endpoint or raw content.
- `model-input-selection.ts`: synchronous and additive asynchronous drivers share the original selection loop through a private generator. Validation, ranking, weakest-evidence removal, oldest optional history removal, notices/pending coverage, mandatory groups and error ordering are unchanged. Only the bound-check yield differs between drivers.
- Tests use actual official `serializeMessage`, its persisted JSON shape, and `fetchContextWithPrompt`. Stored tool-call/result canonical JSON remains identical after fitting. The complete 1,300-byte result fits after optional history is removed; the 7,000-byte mandatory result refuses before operation or inference admission. No part or JSON payload is truncated.

## Requirements Checklist

- [x] Actual stored tool shape and SDK assembly are exercised, without speculative field widening. Root owns the new Gateway checker and its actual governed-wire equivalence tests.
- [x] Optional whole entries/history can be shed; mandatory current input/tool groups remain complete or receive `CONTEXT_LIMIT_EXCEEDED`.
- [x] Canonical native messages, pins, edit/revision contracts, source/authority/lease checks, caps, conservative accounting and replay behavior remain.
- [x] Fresh post-preparation Action hydration remains. No positive authorization cache, new cross-RPC cache or second client loop is introduced.
- [x] Prospective scalar diagnostics contain no raw IDs, text, tool input/result or provider payload.
- [x] All original assertions remain. Historical Workflow journals are preserved; source comparisons pass with explicit narrow masks.
- [ ] Shared root/backend/lint types and actual package/build contracts: root owns the single gate after all authors freeze.
- [ ] Installed cloud positive tool continuation and latency: require a fresh accepted candidate; no service or paid work occurred here.

## Verification

Pinned Node **24.15.0**, npm **12.2.0** were observed. Offline Jest used `CORTEX_TEST_ENV_MODE=explicit`, `CONVEX_URL=http://127.0.0.1:9`, `--watchman=false`, in-band execution and normal close without forced exit.

- Final affected source set: **233/233 tests, 11 suites, 0 failed/skipped/todo**, exit 0. It includes V8 selection/native handlers, original direct paths, original preflight, actual installed Workflow controls and execution/context regressions.
- Scoped ESLint for all five owned files: **0 errors, 0 warnings**, exit 0.
- Source equivalence: **35/35**. Thirty-one historical controls plus original execution context/preflight match. Shared model execution matches after restoring only the added `snapshot.version === 8` branch. Selector predicates/order match after restoring the generator yield to the original callback invocation.
- Original focused gate **41/43 FAIL** remains. Two official-serializer fixtures incorrectly retained optional undefined properties in the controlled Map instead of the real persisted JSON shape. Only fixture persistence was corrected; its failed-suite successor was **13/13 PASS**. The final affected gate includes the actual assembly and scalar privacy additions.

This batch does not remove fresh native guard RPCs to claim a latency gain. The installed Agent's `recentMessages:0` custom handler replaces ordinary assembly history; its controlled assembly adds **zero queries**. The new fitting/conversion helper adds **zero native handoffs**, inference, ledger writes or app-side work. Native preparation/hydration still performs its original current transcript/source/account checks. Potential read fanout remains a measured follow-up; no savings or subsecond result is inferred from pure checker work.

## Files Modified

The five exact source/test hashes are frozen in `v8-assembled-input-source-freeze.json`: `convex-dev/runtimeAgent.ts`, new `convex-dev/runtimeAgentContext.ts`, `src/domain/model-input-selection.ts`, and the two selection/bounded-context tests. Root's Gateway, trace, client-marker and A's capacity/CAS changes are separately owned.

## Notes for Reviewer

Inspect the recorded generator/callback and V8-only branch masks rather than treating them as wholly identical bodies. The native opaque Gateway/provider interval and historical failures remain. The source adds no table, migration, supported cap increase, deployment, package build/repack, service call or Git write. Shared quality and one non-author coherent source gate precede a fresh native qualification.

**Milestone: B authored implementation and focused checks 100%; shared/native qualification pending. Latency follow-up remains 50%, historical K21 subsecond outcomes 0/4.**
