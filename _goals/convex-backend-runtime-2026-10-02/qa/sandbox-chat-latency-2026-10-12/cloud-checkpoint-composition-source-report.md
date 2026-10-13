# Agent admission/binding/checkpoint composition source batch

Status: source implementation and affected offline checks COMPLETE; independent practical-v2 review PENDING. Source milestone100%. This is not hosted-latency, actual Convex OCC, package, browser or full-goal acceptance.

## Change and original ownership

`runtimeAgent:modelStep` opts into one internal `admitModelOperation` parent. Its exact native schema accepts only original Attempt, operationId/ordinal and normalized request/pinned snapshot bytes. It rehydrates the original attempt, derives the canonical model semantic ID and run budget from its verified run/operation, rejects changed ordinal/kind/state/semantic ID/stored model binding, then invokes the original admission → original Agent binding → exact admitted-request comparison → original fresh post-binding execution hydration → original checkpoint, sequentially in one transaction. No provider/model invocation or terminal charge settlement runs in the mutation.

The shared pre-checkpoint request comparison is the original Gateway comparison, retained in both the generic action and parent. The governed wrapper strictly validates the composed envelope, matching request/snapshot and true permit before the existing official native call. Nonreserved replay/inflight/UNKNOWN receives no permit or generic fallback. The factory records the same attempt correlation for later visibility/capture/attachment timing.

The original admit/checkpoint/bind bodies are unchanged; generic memory/title/embedding/tools continue original admit/checkpoint ports. Original later Agent model execution, contextHandler, cancellation bridge, markVisible, charge-only capture, private attachment, output/finalization/Workflow/tool handlers remain unchanged. Generated bindings already derive exports from modules; no generated-file edit was needed.

## Meaningful outcomes

Actual handlers on the existing controlled transaction fixture prove exact original/composed persisted state and result equivalence; rollback of reservations/binding on late original guard failures; original ordinal/attempt/account/parent enforcement; current grant/epoch/lease/source/definition/proof/budget fences; reserved inflight and completed replay with one native attempt; lost committed reply with no second permit/no pre-dispatch release; original UNKNOWN100 retained and active slot1 held without terminal evidence; post-permit cancellation with charge-only capture and denied output. Exact native schemas reject caller-selected request lanes. The actual action wiring selects one named parent only for its original model binding.

Credential-free governed peers prove malformed/missing/getter/mismatched/no-permit/nonreserved-extra envelopes, lost committed replies and concurrent local cancellation produce zero native/token calls; successful composition retains native once → capture → attach. Existing secondary budgets, embedding, tools, title, memory and terminal ambiguity suites run unchanged. These controlled cases do not prove hosted concurrency/OCC or all possible race interleavings.

## Verification and retained red receipts

- 737/737 tests,9/9 suites,0 skips in20.146s: `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/cloud-checkpoint-composition-jest-v3.log`.
- Backend TypeScript, lint TypeScript and scoped ESLint: exit0; empty successful logs preserved.
-31 original AST/body/registration/generic-port equivalence assertions: PASS.
-`git diff --check`: exit0. No package build/deploy/service/inference/commit executed by this author.

Original v1 fixture route omission, v2 incorrect slot-release test assumption and concurrent V18 types remain raw failures. The v2 expected outcome was corrected to the pre-existing unchanged `recover` contract and its existing model-policy regression, strengthening retention of the active slot. No product failure/accounting policy was relaxed. Concurrent V18 errors were repaired solely by that batch's owner.

## Frozen files

Baseline `4c2bc7cffafd57b5493f6305f48e390621528793`. All files owned by this batch only:

| File | SHA256 |
| --- | --- |
| convex-dev/runtimeAgent.ts | 94bcf93fcf1d906a3c9a161af9b343f7b0601c1a314421b7cb71eac065fdb15a |
| convex-dev/runtimeModelPolicy.ts | 3b265413cbbf3d64766fc555ce5be84833dc5394e6829ed187fd439f9651774b |
| convex-dev/runtimeGateway.ts | 254bd3b4a69560fce7231aaa0e704aee026c305b225f4fe83df635772dcf1e78 |
| convex-dev/runtimeGatewayBackend.ts | ff2ac985c59ee952fd31666664526665c415dc24155a4d438173fd0378cfd4e6 |
| tests/unit/runtimeAgent/checkpoint-composition.test.ts | 353e559869caa1ced47c153950e2900ca275e86949d6eb6e6213d8b9f4c282d4 |
| tests/unit/runtimeAgent/model-owner.test.ts | 9f77b274c3e0946ddbe3fc03b34a3da9e1901d96c99be67bbf25134fc39b75c0 |
| tests/unit/runtime/gateway-dispatch.test.ts | 61918810b0cbe22d292070b6749cc6622fc2c4b61232b48afcc2de238f11b75e |

Detailed commands, original failure explanations and raw receipt hashes: `/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion/_goals/convex-backend-runtime-2026-10-02/qa/sandbox-chat-latency-2026-10-12/cloud-checkpoint-composition-checks.json`.

## Remaining gate

Root must obtain one non-author practical-v2 source verdict, commit only this batch's files/evidence, then package a new immutable candidate and measure actual hosted delay. The old measured admit/bind/checkpoint span contained retained work; only two action→mutation handoffs are composition targets, and no millisecond savings or subsecond success is predicted. Preserve old immutable K6 evidence separately. Current overall goal/latency percentages remain coordinator-owned and unchanged by this offline source milestone.
