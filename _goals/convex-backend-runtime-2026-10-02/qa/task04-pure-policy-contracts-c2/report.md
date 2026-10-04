# Task Completion Report — Task04 pure-policy C2

## Status: COMPLETE bounded C2 repair; independent judgment PENDING; whole Task04 PARTIAL

Fresh C1 judgment was NEEDS REVISION (3.4/5), with two proven defects. This C2 fixes only
those defects. Earlier producer/reviewer/candidate/history files remain untouched.

## Changes and requirements

| File | Change | Evidence |
| --- | --- | --- |
| `src/domain/model-policy.ts` | Detach the full descriptor-safe canonical JSON request graph before schema parsing/freezing; preflight and detach fallback evidence before parsing, returning false for invalid evidence | Six C2 regression outcomes |
| `tests/unit/domain/model-policy.test.ts` | Append six outcomes without changing any original C1 byte | `old-test-preservation-proof.json` |
| `src/domain/index.ts` | No C2 change; original exports remain exact | Unchanged SHA256 |

- [x] Nested tool definitions, output schemas, tool-call inputs and tool-result outputs
  are detached at every object/array depth. Caller objects remain unfrozen and unchanged
  by validation, then remain mutable. Subsequent caller mutations cannot change admitted
  values or their exact normalized canonical identity.
- [x] Counting and throwing fallback getters are rejected without evaluation. Symbolic,
  nonplain, nonenumerable and iterator evidence is also rejected with zero effects.
  Ordinary valid safe evidence remains eligible under all existing conservative rules.
- [x] No API/interface/export expansion. Model/profile/price/bound/prompt/tool/scope pins,
  normalized dispatch semantics and all prior budget/identity/fallback contracts remain.
- [x] Original 24 assertion names preserved and passing; original test file is an exact
  byte-prefix of the C2 test file (23,110 bytes, SHA256
  `da443be790853c4785a65d257bccf25fecd336224df2ceaa4684b93f3cca28a1`).
- [x] No backend/schema/ledger/Gateway/generated/service/network/credential/inference or
  Git edits. Root build/public contracts were expressly included in the repair scope.

The request fix parses `canonicalModelJson(input)` into a fresh JSON graph BEFORE Zod
can retain nested unknown leaves. This uses the existing exact descriptor-safe boundary,
without calling caller getters/iterators or a potentially foreign-realm structuredClone.
Freeze operates only on the detached admitted request. Fallback uses the same preflight
and fresh graph; any preflight failure returns false, retaining its boolean contract.

## Immutable execution history

`pre-edit/` preserves exact C1 source/test/index and initial prior config/runner copies,
verified against the frozen C1 candidate before edits. Every new execution has a NEW
run directory. Source/config copies and hashes were saved before execution; each command
has exclusive-created started/receipt/stdout/stderr files with exact argv/cwd/UTC and
before/after source/config SHA256. The runner refuses reuse of a run directory.

`run01-c1-plus-regressions/` intentionally tests the unchanged C1 product with appended
regressions: affected types exit0; unit exit1, original24 PASS plus new6 FAIL (30 total,
zero skipped/pending/todo). This is a newly observed C1 regression demonstration, not a
recreation of the unavailable initial producer evidence. Raw failed output/result is
preserved permanently. No failed assertion was removed or weakened.

`run02-c2-candidate/` checks the fixed C2 product: all nine command receipts exit0.

| Check | Observed result |
| --- | --- |
| Affected standalone TypeScript | PASS |
| Exact-file ESLint, max-warnings0 | PASS, zero warnings |
| Jest discovery | Exactly one model-policy test suite |
| Jest outcomes | 30 passed,0 failed,0 pending,0 todo; original24 all passed |
| Toolchain | Node24.19.0/npm12.2.0 via prescribed npm CLI |
| Root build | PASS, offline |
| Packed root public contracts | PASS: ESM/CJS,declarations,URL and browser execution |
| Separate domain browser bundle/export probe | PASS:60 exports/106 inputs,no provider/config/root client/graph modules |

The standalone Jest configs exclude root dotenv/env/setup. Standard Node VM Modules
experimental warnings remain preserved in stderr. Mock/synthetic outcomes do not certify
actual paid inference, qualifications, price knowledge, atomic ledger behavior or media.
`final-check-summary.json`, source-bound receipts, `unit.result.json`, discovery and raw
streams document exact observations. Reproduction must use a NEW run directory, e.g.
`python3 _goals/convex-backend-runtime-2026-10-02/qa/task04-pure-policy-contracts-c2/checks.py final run03-new-reproduction`;
do not reuse historical paths. The browser probe source is preserved inertly and runs
from the allowed scratch directory, without provider constructors.

## Exact final candidate SHA256

| File | SHA256 |
| --- | --- |
| `src/domain/model-policy.ts` | `943d2e0ee2597ef0386321b50165601fdefceaffb5dbd4283a820967d73be1c4` |
| `src/domain/index.ts` | `b1bb56d6df91596512f9c1e35b48f8942207bf9651739885eb81f7755d834648` |
| `tests/unit/domain/model-policy.test.ts` | `1bfb874dc2fe4bac9900c2c699e2985c4925129f55aad03b2f84a1f738acf714` |

## Notes for fresh reviewer

Fresh C2 independent acceptance remains required before dependent ledger implementation.
Whole04 still lacks accepted schema/atomic accounting/checkpoint/settlement/recovery,
Gateway/memory wiring and actual distinct qualified-model/service audit outcomes.
Full03-final and the overall goal remain incomplete. C2 does not remove or repair the
explicit earlier evidence-history limitation; its partial conversation archive and
C1 independent failed probes remain immutable. Only numeric cycle caps were waived.
