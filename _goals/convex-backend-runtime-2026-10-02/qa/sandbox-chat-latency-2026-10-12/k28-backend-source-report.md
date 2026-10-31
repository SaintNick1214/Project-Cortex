# K28 backend implementation

Status: bounded source implementation and affected checks complete. Independent joint review, packaging, actual installed qualification and latency acceptance remain pending. Repository: SaintNick1214/Project-Cortex. Baseline product commit: `6ce044425b7e52270cdf89cde0ea3a8fbb42f91a`. The overall latency goal remains 50%; this source milestone is 100%.

The K27 measurements established that query embedding itself took 410/295 ms, while its admission/checkpoint, independent capture and attachment, later native reads and delivery all added serial work. This change reduces supported native handoffs and repeated raw control reads. It does not identify opaque Gateway/provider subdivisions, attribute an unknown OCC writer, or establish any native speed improvement.

## Changes

- `runtimeMemoryQuery.ts`: the actual managed public recall Action now uses a native authority/profile-readiness parent before its original ANN search, a native vector/fact read parent afterward, then Action ranking and an independent native final delivery. Vector and fact work uses isolated `allSettled` branches, joins both peers and preserves vector-first failure priority. Binding merge remains vectors then facts. Both original raw authority rechecks execute. Current profile validation calls the original helper locally instead of nesting another profile RPC. The original generic injected repository/recall tail remains unchanged.
- `runtimeModelPolicy.ts` and `runtimeAgentQueryEmbedding.ts`: additive internal `checkpointRecall` executes the byte-identical original checkpoint in an invocation-local raw control/message/source scope. Only managed public recall and private V8 query embedding select it. The child mutation is still a separate savepoint: checkpoint refusal leaves the reservation committed, and partial checkpoint writes roll back. Mutable financial rows are not cached.
- `runtimeAgent.ts` and `runtimeGatewayBackend.ts`: V8 main-model terminal attachment selects `attachModelResultV8`. It first executes the original Agent execution guard, then calls the original attachment handler with a separate fresh native reader. The actual reference supplied to attachment remains forwarded independently of the Agent attempt reference. The original charge capture remains a prior independent committed RPC. A failed attachment, including an opaque throw after a partial write, cannot undo that capture. The legacy wrapper and default Gateway ports retain their original routes.
- `runtimeAgent.ts`: the original observation guard is factored into a shared reader for A's envelope and opaque signal. It still reads and validates authority, control run, conversation, source/artifact/media witnesses, output JSON/media rows and approvals, then executes the final delivery deadline and public run projection in their original order. Signal omits private DTO and approval-hash construction. The supplied final authority context defaults to the original context; A passes the original raw context for the final fence. There are no new public observation arguments or registrations in this file.

The extra pre-storage hydrate remains: changed grant/transcript/bounds still deny before the official Agent creates its pending message. Visibility and output remain separate. Combining them would require changing the existing boundary in which Gateway records visibility before yielding a chunk, while Agent computes its public parts afterward. Financial capture and attachment are not fused. No preparation eligibility/error decision is reused across attachment/network waits.

## Controlled results

The populated public handler comparison returns the same six ranked items and context, with identical state and no provider call. The original read path made six memory RPCs plus three nested profile RPCs; the new path makes three native calls total, around the same one ANN Action call. Ranking remains before independent final delivery, so an opaque ranking error still prevents that mutation and preserves its exact error identity. Actual elapsed grant expiry on Action return still refuses.

The V8 query-checkpoint comparison preserves the exact result, full state and financial read sequence. Controlled DB calls change from 112 to 110; component/control query calls change from three to two. These are synthetic fixture counts, not native document-read billing or measured cloud latency.

Main terminal attachment changes two native handoffs (guard query, attachment mutation) to one parent invocation. Tests compare exact effects, mutable read order, ordinary denial, stale transcript, lease denial, opaque failure and partial-write rollback. This is terminal work after model generation; it is not claimed as a first-output reduction. The new native transaction uses fresh readers and all original predicates; installed expiry/OCC/timing behavior still requires fresh service qualification.

Private Agent match/delivery, save/candidate, initial admission, pre-storage hydrate and protected first-output handoffs retain their prior behavior. The old V1–V7 registrations and journals remain available. No schema, new backend file, catalog, cap, timeout, billable count, client tool loop, canonical transcript or selected input policy changes were made.

## Checks and failures

Pinned Node 24.15.0 and npm 12.2.0; offline explicit test environment at `http://127.0.0.1:9`, watchman disabled.

- Latest per-file affected union: 858 passed, 19 suites, zero failed/skipped/todo. This is a union of the 19-suite run and the five-file successor, not an assertion that the original failed aggregate passed.
- Original affected run: 856/857, 19 suites. Its only failure was the exact schema golden missing the already accepted foreground-priority table and indexes. The successor adds those exact existing definitions, including the existing event index, and retains the inventory assertions.
- Five-file successor: 308/308, zero skipped/todo. It includes the final public parallel read branch, all original public functional/tail checks, attachment tests and the corrected inventory.
- Backend types v2, owned/transitive test types v2 and scoped lint v2: exit 0. Scoped lint has zero warnings. Root owns the single final shared quality/build/packed gate.
- Eighteen original function declarations, including checkpoint, admission, resolve, capture, attachment, execution guard, source batches, old model preparation, old model step and legacy query embedding, are byte-identical to the baseline. Caller/registration composition is intentionally changed as described above; the evidence does not imply every file is unchanged.

All original failures are retained. Initial 90/98 tests used old checkpoint fault hooks and transport counts. Applicable hooks now target the actual new child without relaxing rollback assertions. New fixture failures included a fact-only final-profile expectation (corrected by including real consumed vectors), a missing third original profile RPC, and a restored synthetic clock for the second independent fixture. The original owned-type errors involved fixture narrowing, native writer overloads and vector-ID types; assertions were retained. The selected K28 successor before the final parallel branch was 14 passed/67 filtered, not a full-suite PASS.

## Frozen packet

`k28-backend-source-freeze.json` contains the exact five production and five test/fixture hashes. `k28-backend-checksummary.json` contains the latest per-file test union and original failures. `k28-backend-original-body-equivalence.json` contains the bounded literal function comparisons. Raw Jest/type/lint receipts are retained alongside these files.

No services, models, targets, Docker images, package builds, Git writes, Proofs launcher/pins or website edits were performed by this task. Current K27 SLO failures remain unchanged. No native speed acceptance is claimed.
