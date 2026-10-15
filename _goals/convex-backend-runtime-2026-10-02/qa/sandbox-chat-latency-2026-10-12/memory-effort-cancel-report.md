# Task Completion Report

## Status: COMPLETE — source-only scoped implementation

An explicit `stop()` now waits for successful cancellation and a fresh SDK `observe()` before closing its captured observer. The returned observation passes through the same stream projection used by subscriptions, updating AI SDK message metadata/status, retained cursor state, and `onObservation`. It does not infer `cancelled` from the cancellation acknowledgement.

Attachment state and both observer callback identities are checked after each await. Replacing the run, selecting a conversation, reconnecting the same run, or closing the observer prevents stale publication or closure. Cancellation and observation failures propagate; failed synchronization leaves the existing observer available. SDK authorization, independent post-I/O session checks, cursor reset, and immutable run pins remain in use. A newly attached unknown attempt can require the SDK's existing second observation to reset its cursor; this performs no inference.

## Files Modified

| File | Change | SHA-256 |
|---|---|---|
| `packages/vercel-ai-provider/src/remote/index.ts` | Capture current observation projection for post-cancel synchronization. | `b82e28eabd47f1efad66da03d17d20162e2170f95cd2ea53dea051d28ed332d0` |
| `packages/vercel-ai-provider/tests/unit/remote.test.ts` | 12 cancellation success, failure, identity/auth, and race cases. | `fe6a7749e8aa32e6648c920bacf221cbb8171ff8c314a0a985e71dcb9d5fe6c0` |

The two prior literal repair files retain their frozen hashes, recorded in the JSON report. No other product files were edited for this task.

## Requirements Checklist

- [x] Waiting-approval cancellation receives actual fresh cancelled status before owned observation closes; official AI SDK 7 parser asserts terminal metadata and cursor.
- [x] A server result that remains running is published honestly; no fabricated cancelled state.
- [x] Cancel failure and fresh-observe failure propagate unchanged without false terminal metadata or unintended disconnection.
- [x] Six races cover attachment, conversation, and same-run reconnect changes during both cancellation and observation waits; replacement observers remain open.
- [x] Two tests construct the actual public SDK client over a bounded port and assert cancel/observation/session calls, including independent post-I/O actor-change refusal.
- [x] No new submit/start/approval/model/tool/memory loop, template changes, exports, or public API.

## Verification

Working directory for provider checks: `packages/vercel-ai-provider` in this checkout. Node 24.15.0/npm 12.2.0 pinned toolchain; real HOME unchanged. `CORTEX_TEST_ENV_MODE=explicit` prevents local credential-file loading; unit URL is `https://unit.invalid`.

| Check | Actual result | Receipt |
|---|---|---|
| `node --experimental-vm-modules <root>/node_modules/jest/bin/jest.js --selectProjects unit-remote --runInBand --forceExit=false` | exit 0, 49/49, 12 added, 0 skipped, natural exit | `memory-effort-cancel-tests-green-3.json` |
| `node <root>/node_modules/typescript/bin/tsc --noEmit` | exit 0 | `memory-effort-cancel-types-1.json` |
| `npm run lint` (provider manifest: `tsc --noEmit`) | exit 0 | `memory-effort-cancel-lint-1.json` |
| `npm run build` (core, React, and remote CJS/ESM/declarations) | exit 0 | `memory-effort-cancel-build-1.json` |
| `git diff --check -- <two owned files>` | exit 0 | `memory-effort-cancel-diff-2.json` |

All receipts retain exact executable/args/cwd, start/end, direct child exit and signal, and separate raw stdout/stderr. The initial zero-test prerequisite failure remains `tests-red-1` because Root's concurrent SDK clean build briefly removed its exports. Original-source `tests-red-2` exited 1 with 11 failed/38 passed; its waiting-approval case reproduced the missing fresh observation. Intermediate green-1 matcher incompatibility and green-2 SDK cursor-reset expectation failures remain preserved. Assertions now match the actual contract without weakening terminal/identity/auth requirements.

## Notes for Reviewer

This verifies the two-file source repair only. Independent combined review and repaired installed/browser acceptance remain pending Root. The original source064 UI failure and Root's successful later fresh observation remain separate evidence. No services, private keys, inference, commit/deployment, shared resources, or existing evidence were touched. Core/React behavior is unchanged; the selected remote suite includes all existing remote streaming, replay, authorization, effort, and reference-projection tests.
