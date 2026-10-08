# Task Completion Report — Task04 pure-policy C3

## Status: COMPLETE bounded C3 repair; independent judgment PENDING; whole Task04 PARTIAL

Fresh C2 review NEEDS REVISION3.4 established own enumerable JSON `__proto__` loss at
four record boundaries, collapsing accepted request identities. C3 repairs only that
loss. Prior producer/reviewer/history packets and their failed probes remain unchanged.

## Changes and requirements

| File | Change |
| --- | --- |
| `src/domain/model-policy.ts` | Replace four lossy Zod record parsers with one private plain-record validator on the already descriptor-safe, detached canonical JSON graph |
| `tests/unit/domain/model-policy.test.ts` | Append five meaningful regression outcomes, preserving the full original C2 test bytes |
| `src/domain/index.ts` | Unchanged; no API/export expansion |

- [x] Tool definitions, output schemas, tool-call inputs and tool-result outputs preserve
  every ordinary own JSON `__proto__` key, its value and its frozen admitted dispatch
  representation. None silently becomes `{}`.
- [x] Each of the four accepted own-key records has distinct exact canonical bytes and
  SHA-256 identity from `{}`; identity reuse rejects the changed request.
- [x] Own `__proto__`, `constructor`, `prototype` and nested array/object key combinations
  remain ordinary data. Object.prototype and admitted object prototypes remain unchanged.
  Caller-owned objects stay mutable, detached and unfrozen; mutation cannot alter receipt.
- [x] Existing descriptor-safe rejection, canonical detachment, exact normalized messages,
  model/native/profile/cost/prompt/tool/source/authority pins and conservative fallback
  rules remain unchanged. The private record schema receives only canonical-parsed JSON,
  validates plain nonarray objects and never assigns arbitrary keys onto another object.
- [x] All original C2 test bytes preserved: 28,011-byte exact prefix, SHA256
  `1bfb874dc2fe4bac9900c2c699e2985c4925129f55aad03b2f84a1f738acf714`.
  All original30 assertion names preserved and passed. Domain index remains exact.
- [x] No backend/schema/ledger/Gateway/generated/service/network/credential/inference or
  Git writes. Only authorized current offline build/check outputs were produced.

The installed `z.record` parser explicitly omits a root `__proto__` key. C3 uses private
`z.custom<Record<string, unknown>>` validation rather than reconstructing keys through
assignment or selectively merging missing values. Descriptor-safe canonicalization and
JSON.parse already validate/detach every descendant before this schema runs, so preserving
that exact detached object safely retains arbitrary JSON keys at every depth. No public
schema, broad provider-options passthrough or new trusted input authority is introduced.

## Immutable history and verification

`pre-edit/` archives exact C2 three source bytes/hashes and configs/runner before edits.
Each run directory is exclusively created; runner rejects reuse. Source/config preimages
and hashes are captured before commands. Started/receipt files bind exact argv/cwd/UTC,
exit status and before/after source/config hashes; raw stdout/stderr and unit JSON remain.

`run01-c2-plus-regressions/` is the newly observed red attempt against exact C2 model:
affected types exit0, unit exit1, original30 PASS plus new5 FAIL (35 total,0pending/0todo).
All five failures and source/config bytes remain saved. This is not a reconstructed prior
review or producer run; no old assertion or historical output was overwritten.

`run02-c3-candidate/` is the green C3 attempt, all nine command receipts exit0:

| Check | Observed outcome |
| --- | --- |
| Standalone affected TypeScript | PASS |
| Exact three-file ESLint, max-warnings0 | PASS, zero warnings |
| Exact standalone Jest discovery | One model-policy suite |
| Jest outcome assertions |35PASS/0FAIL/0pending/0todo, all original30 retained |
| Node/npm |24.19.0/12.2.0 via prescribed npm CLI |
| Current root offline build | PASS |
| Packed public contracts after build | PASS:ESM/CJS,declarations,URL and browser execution |
| Separate domain browser bundle/export probe | PASS:60exports/106inputs,zero provider/config/root client/graph modules |

Standalone Jest loads no root dotenv/env/setup. Standard VM Modules warning remains in
raw stderr. Source hashes stayed stable throughout every command. Original test-prefix
and assertion-name proof: `old-test-preservation-proof.json`. Receipt summary:
`final-check-summary.json`. Exact candidate: `candidate-source-evidence.json`. All new
packet bytes are fingerprinted in `evidence-manifest.json`.

For reproduction, choose a NEW run directory, e.g.
`python3 _goals/convex-backend-runtime-2026-10-02/qa/task04-pure-policy-contracts-c3/checks.py final run03-new-reproduction`.
Do not reuse prior paths. Browser probe source is saved inertly and its scratch location
is explicit in the receipt. No new run retroactively supplies missing initial history.

## Exact final candidate SHA256

| File | SHA256 |
| --- | --- |
| `src/domain/model-policy.ts` | `f43de8775880d1d4f6ddad90e527837d9ddb4ce58d00ea622aabc2609a1769da` |
| `src/domain/index.ts` | `b1bb56d6df91596512f9c1e35b48f8942207bf9651739885eb81f7755d834648` |
| `tests/unit/domain/model-policy.test.ts` | `d5a65043cb6c1dc2af851df866c5881fea67a0677c79ce3c5fe99d79f62700fc` |

## Notes for fresh reviewer

Fresh independent C3 judgment remains required before ledger work. Whole04 is PARTIAL:
additive schema, atomic tenant/run/concurrency reservation, checkpoint/once-only
settlement/uncertainty/recovery, Gateway/memory wiring and actual distinct qualified
model/service audit outcomes remain pending. Full03-final and goal remain incomplete.
Synthetic tests do not establish actual prices, authentication, inference/index/media
readiness or live budget enforcement. The earlier missing/truncated producer-history
limitation remains unchanged and explicit. Only numeric cycle caps were waived.
