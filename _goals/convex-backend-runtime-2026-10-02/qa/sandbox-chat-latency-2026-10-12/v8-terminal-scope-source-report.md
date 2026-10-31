# Task Completion Report

## Status: COMPLETE (bounded source task only)

Repository: **SaintNick1214/Project-Cortex**, baseline `efcc91d2317dadcb143c5cf1929504bd0cbee3a6`.

Private V8 Agent callers now select fresh native terminal read scopes. **Capture and attachment remain separate mutations and separately durable**. Their complete original handler bodies, argument validators, errors, accounting, UNKNOWN ceilings, slots, replay behavior and current private-delivery checks are preserved. No actor or V8 authorization gate is added before charge accounting.

## Changes made

- `runtimeModelPolicy.ts` factors the original capture/attachment bodies unchanged into named handlers. The original internal endpoints call these handlers with original unscoped contexts; two additive internal V8 endpoints call the same bodies with `createV8AuthorityReadScope`.
- `runtimeGatewayBackend.ts` adds a private nonserialized Symbol context selector. It changes only the two terminal mutation references. Native RPC methods are bound to their original context, preserving their `this` semantics. It stores no authority result or mutable ledger data.
- `runtimeAgentQueryEmbedding.ts` selects that context only in `recallAgentMemoryV8`, after its actual native V8 preflight. The existing memory-model factory and V6/public/ingestion paths are untouched.
- `runtimeAgent.ts` selects it for main output only from the server-derived immutable `current.snapshot.version === 8`. Fresh actual-prompt hydration, native exact-bound admission, visibility, cancellation, output, finalization and title behavior remain.
- The new real-handler suite compares legacy/V8 results, complete committed state and the exact mutable DB read identities/index arguments/order. One existing V8 query test updates only the intentional physical terminal endpoint expectations; all legacy outcomes/assertions remain.

The existing V8 scope contains only raw authority, opted-in policy and exact official-message readers. Every predicate runs again. Mutable attempts/accounts/operations/run/source/result decisions are not cached. Existing financial-write metadata resets, unknown/security/component-write full invalidation, in-flight suppression, fresh copies and per-invocation boundaries are unchanged. No Auth, MemoryGateway, ingestion, belief, schema, public client or generic public recall implementation is changed.

## Requirements checklist

- [x] Actual private V8 query and main wiring, two new internal registrations; original default/V1–V7 ports retained.
- [x] Separate charge capture and private attachment commits, no pre-account access guard, identical monetary/slot/UNKNOWN/replay effects.
- [x] Fresh revoked/expired/principal-generation/scope-epoch/tombstone/cancel/lease/canonical-transcript refusals still account charge and withhold private data.
- [x] Capture commit survives later denied/malformed/wrong-principal/wrong-scope/policy/budget attachment; no monetary delta or automatic inference retry.
- [x] Opaque partial-write failure rolls back only its failing mutation; an earlier capture commit remains pending for attachment.
- [x] Original receipt validation/error order preserved; malformed/identity/model/proof failures have exact original errors and zero committed partial effects.
- [x] Invocation-local raw reuse demonstrably reduces controlled reads without modifying original guard bodies or mutable reads.

## Controlled reduction and measured limits

| Original real handler | Original raw DB calls | V8 raw DB calls | Authority calls before → after |
| --- | ---: | ---: | --- |
| captureTerminalEvidence | 122 | 43 | 91 → 14 |
| attachTerminalResult | 118 | 39 | 91 → 14 |

These are original handler executions against controlled transaction/component peers, with identical resulting effects and mutable DB call order. They are **not hosted latency or native OCC proof**. The exact shared account and execution-output conflict surfaces remain: preserving original mutable reads preserves those native read dependencies. No runtime cache-hit instrumentation, source-witness pruning, account caching, cap/deadline change or multi-second savings claim is introduced.

K23 populated CLI measured embedding capture/attachment caller cost 477 / 858 ms and warm native 463 / 455 document reads; main terminal work also retries against execution output counters. These saved observations motivated this batch, but selected context and native load differ between samples. Main terminal costs occur after first processed text; embedding terminal costs occur before protected recall returns. Prior K23 all-four subsecond failures remain unchanged.

## Verification

Pinned **Node 24.15.0 / npm 12.2.0**, explicit offline Convex URL `http://127.0.0.1:9`, watchman disabled, serial Jest. Final per-suite union **410 tests / 7 suites / 0 failed / 0 skipped**, not a newly invented aggregate invocation. The original embedding suite passed 42 cases; the finite six-suite dependency run passed 368, including new terminal, original native admission, Gateway, direct Action and V8 scope regressions. A final 26-case successor covers the exact last fixture bytes.

Backend types passed. Both owned test roots and actual transitive dependencies typecheck. Scoped lint has zero final errors/warnings: the six-file run had one type-proven fixture warning, removed and checked only on that changed test. Source equivalence confirms **194 original function/registered-handler bodies** unchanged, except three explicit terminal-route inverse masks. Immutable preimages are the four narrow K23 staged sources whose bytes match that kit's committed build-input hashes; no Git operation, archive/staging copy or old-kit write was required for equivalence.

Original failures are retained: first 67/68 run altered an unused top-level MessageDoc.text field rather than canonical MessageDoc.message. The corrected fixture exercises the actual hash fence; its assertion was unchanged. First test-type command needed the TypeScript 6 --ignoreConfig flag; the next found owned fixture discriminant/mock typings. First lint found an unused fixture import. Their logs remain in `v8-terminal-scope-*`; none is relabeled PASS.

## Notes for reviewer

Six owned files are hashed in `v8-terminal-scope-freeze.json`. The intentional public API change is **none**; the two new mutation names are `runtimeModelPolicy:captureTerminalEvidenceV8` and `runtimeModelPolicy:attachTerminalResultV8`. No capture-side version lookup precedes accounting: trusted compiled V8 callers select the private port, while the original handler validates the stored original attempt/dispatch/qualification and monetary truth. Attachment independently repeats its original current authority/source/account/lease guards. The ports do not share state across invocations or combine commits.

Shared build/packed checks, one non-author coherent source review and fresh installed service verification remain root-owned. No service, inference, package/image, deployment, credential, Proofs source, website or Git write was performed here. Source-task milestone **100%**; overall latency follow-up **50%**, with no new native/SLO acceptance.
