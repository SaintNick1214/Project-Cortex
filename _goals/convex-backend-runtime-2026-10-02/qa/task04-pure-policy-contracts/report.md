# Task Completion Report

## Status: COMPLETE bounded pure packet; Task04 PARTIAL; independent acceptance pending

Implemented only the authorized pure portion of Packet A. No backend schema, ledger,
Gateway adapter, MemoryModel integration, generated files, provisioning, network,
credential, paid inference or Git writes were performed. Root build was authorized by
parent after C11 dist preservation; prior accepted C11 evidence remains unchanged.

## Changes Made / Files Modified

| File | Action | Purpose |
| --- | --- | --- |
| `src/domain/model-policy.ts` | Created | Strict pure registry, trusted resolution, frozen snapshots, request/options validation, exact canonical identities, conservative fallback |
| `src/domain/index.ts` | Modified | Exports contracts through the existing browser/default-Convex-safe domain seam |
| `tests/unit/domain/model-policy.test.ts` | Created | 24 outcome tests, synthetic receipts only |
| `qa/task04-pure-policy-contracts/` | Created | Standalone configs, reproducible check runner, observed receipts, source hashes and this report |
| `work/resume/task04-pure-policy/` | Created | Scratch runner/browser probe/bundle |

No public root SDK export or provider constructor was added. The existing domain source
seam remains usable by backend imports. Root build/public-contract success does not
claim a newly published package subpath; the separate domain browser probe verifies
this contract's actual bundle and named exports.

## Requirements Checklist

- [x] All 13 operations registered; Decisions, Python and image understanding absent.
- [x] Chat defaults to exact `openai/gpt-4o-mini`; Responses requires explicit qualified
  receipt and `openai.store:false`; Messages cannot pass registered language operations.
- [x] Deterministic scope order: deployment/tenant/immutable-agent defaults, then
  operation specialization at deployment/tenant/agent. Singleton ambiguity, cross-scope,
  stale agent, unknown fields and padded authority identifiers fail closed.
- [x] Ordinary restrictions intersect; caps tighten. Exact versioned administrator
  authorization permits override of ordinary restrictions within ALL deployment hard
  bounds, including deployment operation specializations. No policy-admin proof grants
  data/run authority.
- [x] Models/interfaces/capabilities/options/tools/token/context/time/concurrency and
  integer operation/run/tenant micro-USD limits are checked and pinned. Full-call
  conservative price bound and receipt provenance are pinned, not merely price IDs.
- [x] Prompts/schema/extraction/tool registry/price/bound versions are pinned; retry
  identity includes complete ordered roles/parts/tool-call IDs/tool definitions/output
  schema/options/source/scope/parent/run plus every effective policy/qualification.
- [x] Deep frozen snapshots/requests are detached from supplied records; text is NFC/LF
  normalized and exact normalized messages are bound for actual dispatch.
- [x] Hash lookup requires canonical equality. Forced equal-hash different-canonical
  identity fails `IDEMPOTENCY_CONFLICT`.
- [x] Full fixed DEFAULT_EMBEDDING_PROFILE is required. Same dimensions alone cannot
  substitute provenance. Ordered batch range/ordinal enters identity; language parts,
  tools/output or profile-changing fallback cannot enter an embedding request.
- [x] Fallback requires a registered qualified compatible model, accounted prior
  attempt and current authority/source/policy proofs. Visible text/tool input/results,
  tool effects, uncertain paid outcomes, cancellation or absent proof forbid it.
- [x] Meaningful outcome checks passed; discovery and zero skips recorded.

## Consumed contract for the next executor

`resolveModelPolicy({context,policies,qualifications})` accepts unknown data and strictly
validates structure. ONLY the backend may supply these records after current trusted
lookups. This function authenticates nobody: a structurally valid public object cannot
be used as policy authority. All policy/version/agent/admin authorization references
must come from trusted server records, never caller/env/legacy `src/config.ts` overrides.
Qualifications contain model/native interface, capabilities, accepted options, complete
caps, exact price/bound revisions and `costBound`:

```
{ kind: "qualified-call-ceiling", maximumCostUnits,
  provenance, coversAllProviderCharges: true }
```

This is an explicit trusted conservative ceiling covering ALL provider charges within
that receipt's complete qualified caps. It is not a fabricated price formula from token
usage. Provisioning must have actual defensible bound/price provenance; absent knowledge
cannot dispatch. Snapshot pins this bound; request reservation below it or above the
operation budget is rejected. Ledger MUST derive its reservation independently from
this immutable bound and reserve atomically against tenant/run/concurrency. Public token
counts/reservations do not establish provider limits or budget authority.

`validateModelRequest(snapshot,input)` binds exact ordered messages/parts/tool identities,
registered definitions, schema and options. Nonembedding texts must equal the normalized
text part projection; embedding requests use only texts/profile/stable batch boundaries.
The final Gateway wrapper MUST whitelist and compare complete low-level params, dispatch
these normalized messages/texts exactly, independently establish conservative token
counts and enforce actual provider output/tool/time caps. It cannot use only extracted
text to authorize replay or allow a `prepareStep` override to replace the model/options.
Trusted backend prompt/schema/tool construction and currentness checks remain mandatory.

`createModelRequestIdentity` uses browser WebCrypto SHA-256. Persist canonical+hash and
call `assertModelRequestIdentity` before any cached/inflight result reuse; equal digests
are insufficient. Current source/authority checks still precede result reads and commits.
`canFallbackModel` is eligibility only: each next candidate still requires independent
atomic accounting/checkpoint with pinned model/options/profile and its qualified receipt.
It does not dispatch, release money, establish zero charges or implement recovery.

`MODEL_OPERATION_REGISTRY.availableInThisPacket` indicates pure-contract support, NEVER
service readiness. Embedding requires an actual trusted qualification plus the full fixed
profile; none is installed by this packet. Both media operations fail unavailable even
if synthetic receipts are supplied; their own service gates remain later work. No second
actual qualified model allowlist is fabricated. Distinct-model tests use visibly synthetic
fixture model IDs and do not satisfy Task04's distinct actual inference acceptance.

## Verification

Observed Node `v24.19.0`, npm `12.2.0` via the parent's prescribed npm CLI. See each
`*.receipt.json` for exact command, cwd, UTC start/end and exit status, `*.stdout` and
`*.stderr` for raw output; `unit.result.json` records each assertion outcome.

- [x] Affected TypeScript (standalone scoped config): exit 0.
- [x] Scoped ESLint for exactly three product/test files, `--max-warnings=0`: exit 0.
- [x] Jest discovery: exactly `tests/unit/domain/model-policy.test.ts`.
- [x] Jest unit: 1 suite, 24 tests passed, 0 skipped/pending/todo; no root env/setup.
- [x] Root build: exit 0, offline; archived C11 dist source was preserved by parent first.
- [x] Packed/public-contract verification after build: exit 0.
- [x] Domain browser bundle/probe: 60 exports, 106 bundled inputs, no provider,
  credential, legacy config, root SDK constructor or graph modules.
- [x] Exact product/config source fingerprints: `source-evidence.json`.

A preliminary standalone test attempt had repository fixture naming collisions because
Jest roots were initially broad, and 14 failures from Node `structuredClone` producing
foreign-realm objects rejected by exact plain-object validation. Scoped roots and local
JSON fixture copies corrected these harness issues without relaxing descriptor/prototype
validation. Array descriptor tests prove accessor/custom iterator code is not evaluated.
Later observed passing runs supersede that attempt; no unrelated baseline defect was
modified. The standard experimental VM Modules warning is preserved in raw stderr.

## Notes for Reviewer

Fresh independent judgment remains required. Whole Task04 is NOT COMPLETE: additive
schema/accounting ledger, admission/checkpoint/once-only settlement/uncertainty/recovery,
Gateway wrapper and memory rewiring, atomic/live negative/concurrency tests and actual
distinct qualified-model inference/correlated audits remain later packets. Full03-final
and the overall goal also remain incomplete. No mock success here certifies live model,
embedding/index, media, price knowledge or service readiness.
