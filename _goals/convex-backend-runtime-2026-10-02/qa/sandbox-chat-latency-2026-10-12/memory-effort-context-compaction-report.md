# Task Completion Report

## Status: COMPLETE — scoped implementation; combined checks/review pending

V2 model evidence now uses a compact projection of complete existing entries. Private context strings, source/fact/vector identifiers and bindings, full source witnesses, selection keys, canonical transcript rows and all freshness/authority/admission guards remain original. Legacy V1 and unknown entry envelopes retain their original bytes. No live target, credentials, inference, budgets, grants, models or timeout/cap policies were changed.

## Changes Made

- `convex-dev/runtimeAgentContext.ts`: project only recognized V2 evidence envelopes. Remove repeated renderer headings, duplicate identical source lineage and private ingestion/hash envelopes from model-facing text. Keep literal actionable source ids and tool operation ids, exact evidence/role labels, trust, source revisions, pending sequence/order, confidence/time/validity/correction markers. Full canonical lineage keys define collision-free invocation-local refs; unknown/future shapes fall back to complete originals. Fit copied projections, then return original selected raw context/keys.
- `convex-dev/runtimeAgent.ts`: pass V2 original entries/selected keys at only three existing message builders: candidate preflight and both SDK context-handler branches. Projection validates that private selected originals exactly match the context before conversion.
- `tests/unit/runtimeAgent/context-compaction.test.ts`: six new controlled tests covering the recorded nine-entry/5-tool case, complete governed body bounds and SDK admission byte parity, alias/event/revision/tool distinctions, V1/unknown preservation, identity mismatch refusal, and mandatory/tool-group overflow.
- `tests/unit/runtimeAgent/bounded-context-v8.test.ts`: eight new actual-handler controlled admission/fence tests. Update the stale claim-RPC mechanism assertion to the new explicit no-child-RPC expectation, retaining actual V8 scheduling/cutoff/canonical-row assertions.

## Requirements Checklist

- [x] Complete pending tail is retained, never optional or silently truncated by projection. Oversized mandatory/tool input refuses.
- [x] Recorded Max nine raw entry sizes and7,182context bytes reproduced using owned synthetic QA text and identifiers. All identifier padding is in retained sourceId, avoiding an optimistic projection estimate.
- [x] Original fitting reproduces selected question+two pending entries at29,394units without apricot. Projected fitting, unchanged ranking and five tools selects memory+fact+memory+two pending at30,426units under32,768.
- [x] Exact real SDK conversion and governed pre-admission request match. Actual native admission changes only the original server-assigned child id; all model-body fields and stored canonical/proof match exactly.
- [x] Source edits/revisions/tombstone, grant revocation, cancellation, qualification changes and tampered body deny fresh actual-handler admission with zero model attempts.
- [x] Full stored original context/entries/witnesses and private request binding remain unchanged. Exact source/operation/artifact identifiers remain available; no new reference resolver/tool contract.
- [x] Claim composition preserved: reversing only the three projection call-site edits yields frozen hash `bdf0a3fdcbeb80bbfc6ebc79a3646d20b4349c680ac36470eca3399496437286`; runs.ts remains `670e5b9a7549aa1e3b116215a1b45e7856460fe89e7145b066b886ae64aab49b`.
- [x] Legacy V1 and unknown/future/hostile serialized entry text preserve byte behavior. Known fact semantic metadata and quoted data role remain intact.
- [ ] Root combined final TypeScript/build/contracts and fresh non-author coherent review are pending. This implementer cannot provide independent acceptance.

## Files Modified

| File | SHA256 |
|---|---|
| convex-dev/runtimeAgentContext.ts | `948e2f595decf3bc18a0b084faa897747640e67c59a793ee8935104d6afc2180` |
| convex-dev/runtimeAgent.ts | `5681a9a28c27b7fda2787dabdb95c6450ec737da7288dccd2e867b3ca5899c74` |
| tests/unit/runtimeAgent/context-compaction.test.ts | `e5f5250229af4fea2af34d1a8b9518e19032f964d32341e7948ca38bb67a8c68` |
| tests/unit/runtimeAgent/bounded-context-v8.test.ts | `8acd3ad83e99ec78911a155c8083805a87a7c4f4e704c33e49ec202453ef25c8` |

## Verification

- PASS:163/163tests across six affected suites;0skipped; natural exit0 in16.554802seconds. Raw commands, full stdout/stderr, official Jest JSON and source hashes before/after are retained.
- PASS: strict four-file lint, exit0/0warnings in8.697919seconds, source hashes unchanged.
- PASS: Node24.15.0/npm12.2.0 verified by runner; installed tsx module preflight exit0. Git diff check exit0.
- Pending: one combined root final tsc/build/contracts after complete batch freeze; Root owns that gate.

## Notes for Reviewer

The scoped source patch uses commit064as the base for context/test files and the separately frozen claim runtimeAgent source as the base for the three call-site wires. Full git diff still composes claim/literal work by other authors. No storage schema or public contract changed. Known model-envelope parsing is deliberately narrow and occurs only on already guarded native entry text; it makes no authority decision and holds no permission cache. Unknown formats remain complete raw evidence and must still fit the original whole-input bound.

All red receipts remain in place. The first was a test bootstrap selector failure; the next exposed synthetic role-label sizing; then stale test mechanism/public-op assertions; the last reflected the unchanged native server child-id assignment. The final full affected invocation passes without weakened model-body/source/pending assertions. See checks JSON for exact preserved failure descriptions.

Actual old Max/warm failures and earlier native/diagnostic reports remain unchanged. Controlled tests establish source behavior, not changed-candidate hosted latency or model-answer correctness. Independent review and actual cloud qualification remain separate and pending.

Checks: [memory-effort-context-compaction-checks.json](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/memory-effort-context-compaction-checks.json). Scoped patch: [memory-effort-context-compaction-source.patch](/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/memory-effort-context-compaction-source.patch).
