# Task 02A completion report

**Status: COMPLETE — focused cycle 1 fixes ready for independent cycle 2 review.**
Whole Task 02 remains pending Task 02B scoped backend adapters and explicit remember/
recall wiring. This report claims observed offline/pure/mocked validation only.

The independent cycle 1 verdict was NEEDS FIXES (3.8/5), with concrete malformed-source,
revision and sparse-array probes. Those findings are fixed below; the original review,
contracts/report snapshots and raw receipts remain under `evidence/cycle1/`.

## Independent review fix checklist

- [x] Preparation rejects empty trusted principal/tenant/space/membership/grant IDs and
  nonpositive or unsafe versions/epochs, preventing empty source ownership.
- [x] Modern prompt, dispatch and parsing validate normalized nonempty content,
  canonical SHA-256 hash metadata, required scope/owner and finite nonnegative valid
  Date-range timestamps. Invalid preparation clocks reject. Regression cases assert
  zero extraction calls for all invalid source inputs.
- [x] Currentness validates source metadata/lineage and positive safe source/vector/
  chunk revisions, nonempty source/event/chunk/vector/receipt IDs before equality.
  Malformed records consistently throw `INVALID_INPUT`; valid stale or unauthorized
  records still return false. Backend grant checks remain a separate obligation.
- [x] Cosine similarity validates every coordinate in both arrays, including sparse
  holes. Strict extracted facts/tags/entities/relations all require dense arrays;
  malformed output cannot be silently normalized by serialization.
- [x] Existing valid legacy outcome fixtures and all frozen API signatures remain
  unchanged. Only the new invalid modern fixture hash was made format-valid; actual
  content/hash canonical equality remains the repository's responsibility.
- [x] Scoped tests/checks were rerun and actual source hashes/receipts refreshed.

## Changes

- Created `src/domain/index.ts` and nine leaf modules for explicit clocks, scoped
  repository/internal-model contracts, source lineage, fresh profile/source/chunk/vector
  preparation, schemas/prompts/parsing, slot/exact matching, conflict outcomes and recall.
- Existing LLM, facts and recall modules delegate/reexport the shared implementation.
  Valid existing outcome fixtures remain unchanged. Recall score/context time is
  injectable; domain ranking/deduplication no longer mutate caller score/context.
- Moved pure deduplication types from the client class module. The coordinator extended
  ownership for exactly one `src/types/index.ts` reexport-path change, preventing pure
  browser declarations from traversing generated backend/Node types.
- Added source-policy, authority/currentness/profile/Unicode and established-outcome
  fixtures under `tests/unit/domain/`. Frozen interfaces are in `contracts.md`.

## Requirement checklist

- [x] Pure normalization/ranking/context/extraction/conflict entry point with required
  repository/model/clock seams; browser runtime graph contains only ten domain modules.
- [x] Existing valid normalization, ranking, extraction and conflict outcomes preserved:
  all selected existing fixtures pass without assertion changes.
- [x] Exact frozen fresh profile/model/1536/index/filter contract; NFC/LF outer-trim
  normalization; deterministic 1600-code-point windows and 200 overlap preserve
  surrogate pairs and internal whitespace. Sources/chunks/vectors are logical records.
- [x] Source role/trust/event/revision and tool operation lineage; assistant claims
  reject before inference and parsing; extracted facts inherit trusted lineage.
- [x] Required internal purpose-only extraction/conflict/memory/query embedding seam;
  stable operation/policy/attempt metadata; source-extraction helper dispatches once,
  propagates ambiguous failures and exposes no public chat/remember callback.
- [x] Finite exact vector shapes (including sparse-array denial), full profile equality,
  scoped current-source/event/revision/chunk and tombstone checks.
- [x] Explicit principal/membership/grant versions and tenant/space deletion epochs,
  pure changed/revoked/deleted-authority denial outcomes, required repository recheck.
  Trusted source/fact ownership is available for 03A resource-access evaluation.
- [x] Browser/default-Convex WebCrypto SHA-256 without Node imports; canonical tuple
  hashes plus documented collision/idempotency equality rules.
- [x] Raw observed commands/results, import graphs and source hashes retained in evidence.
- [x] No root manifests, backend, provider/CLI/demo, `src/index.ts`, Python, old-data
  migrations, media storage, production deployment, inference, staging or commit edits.

## Verification

All selected required checks passed with Node 24.19.0 and npm 12.2.0. Exact command,
cwd, status and raw-log paths are in `evidence/check-commands.json`.

| Check | Observed result |
|---|---|
| Root strict `tsc --noEmit` | PASS, exit 0 |
| Root lint strict typecheck | PASS, exit 0 |
| Isolated browser/default-runtime strict typecheck, DOM library and `types:[]` | PASS, exit 0; zero backend/generated/Node type dependencies |
| Scoped ESLint for all changed source/tests | PASS, exit 0; 0 errors, 32 inherited client warnings, zero pure-domain warnings |
| Selected pure/domain/existing mocked outcome suites | PASS, 7 suites, 137 tests, zero skipped |
| Browser bundle/import graph and sandbox execution | PASS, only ten domain inputs; Node globals absent; exact NFC/hash/Unicode-chunk outcomes |
| SDK ESM/CJS/declaration build | PASS, exit 0 |
| Packed public ESM/CJS/browser/declaration contracts | PASS, exit 0 |
| Scoped diff whitespace check | PASS, no output |

The isolated typecheck's initial scratch-rootDir error and subsequent existing client
type-reexport traversal are retained as failure history, then fixed and rerun to PASS.
They were not hidden by adding Node ambient types. No unrelated warnings were repaired.

## Modified source inventory

Exact source path hashes are in `evidence/changed-source-paths.json` (19 files).

| Paths | Action |
|---|---|
| `src/domain/clock.ts`, `contracts.ts`, `profile.ts`, `sources.ts`, `extraction.ts`, `slots.ts`, `deduplication.ts`, `conflicts.ts`, `recall.ts`, `index.ts` | Created |
| `src/llm/index.ts`, `src/memory/recall/resultProcessor.ts` | Modified delegates |
| `src/facts/conflict-prompts.ts`, `src/facts/slot-matching.ts`, `src/facts/deduplication.ts` | Modified delegates/type reexports |
| `src/types/index.ts` | One type reexport path modified with coordinator authorization |
| `tests/unit/domain/profile.test.ts`, `sources.test.ts`, `outcomes.test.ts` | Created |

Additional owned artifacts are `qa/task02a/{contracts.md,report.md,evidence/*}` and
scratch `work/backend-runtime/task02a/{tsconfig.json,check-import-graph.mjs,check-type-graph.mjs,
domain-browser.js,type-files.txt}`. QA/work paths are ignored by the repository;
the coordinator must force-stage intended QA receipts when committing.

## Remaining integration prerequisites

Task 02B must construct scope only from 03A trusted authority, recheck current grants/
deletion epochs before sensitive reads/model dispatch/commits, implement canonical
idempotency/current-source/tombstone and belief-version transaction fences, use trusted
source ownership for own/space/tenant resource access, and apply actual scoped vector
filters plus post-search grant/currentness checks. It must wire modern remember/recall
to this domain graph with an explicit fail-closed unconfigured model or injected test
adapter. The required `MemoryModel` seam is operation-only, with no retry/fallback.

Task 04 supplies governed Gateway adapters and receipts. Task 08 owns durable source
admission/stage ordering/cursors/pending-tail consistency and stale-result commits.
Actual qualified Gateway embedding and managed current/authorized retrieval remain
mandatory before Task 09 PASS. Additional profiles, graph/media/private assets and
interactive product browser QA retain their downstream service gates. Package export
routing/public modern client integration remains later scoped integration work.

No full Task 02, whole-goal, actual service retrieval or production-readiness PASS is
claimed here. Independent 02A judgment has not been performed by this executor.
