# Task Judgment: Task03B1-MF, FINAL cycle3

## Verdict: REJECT

**Scores: 2 / 3 / 3 / 4 / 4; average 3.2/5.** The two prior cycle2 blockers have effective repairs, but this frozen candidate still violates final linked-resource authorization and bulk preflight witness retention. This is the third completed independent cycle. Passing scoped checks cannot replace this verdict, and dependent MF/T or bridge work must not advance on a PASS assumption.

Target: `/workspace/Project-Cortex`, HEAD `cd5671449beb64ed1ca4a284a761cad60ab70525`, bounded uncommitted MF candidate. Freeze observed `2026-10-03T10:49:25.064300+00:00`; freeze SHA-256 `bd1f128311a974d9cb6562134b05ff147eed3e994f74a407ca066e787404c5b4`.

I read AGENTS, CODEX-RUNTIME, PROJECT-PROFILE, pessimistic-judge, judge-task, original Task03, authoritative decision gates and architecture, frozen03A contracts/inventory/handoff, both completed prior MF rejections, current candidate contracts/report/repair evidence, the current handlers/guard/schema/tests, and original cycle2 source/history/bulk probes including corrected effective-ID patch instrumentation. I did not modify the checkout, retained QA, history, generated bindings or source; all new evidence is in this directory. No live services, deployments, inference, builds or codegen were invoked.

## Original requirements review

The complete original Task03 remains in progress. “MF met” below applies only to the explicitly delegated memories/facts checkpoint; the other original obligations remain visible downstream.

| Original Task03 requirement / acceptance criterion | MF assessment and preserved broader boundary | Evidence |
|---|---|---|
| Separate03A/03B/03C receipts; freeze03A before dependent edits; serialize shared backend files | Frozen03A preserved and bounded MF receipts verified; cycle3 gate REJECT. Whole03B/03C not complete | Current source/QA hashes; closure42; archive32/38/44; both prior rejections retained |
| Inventory public memory/facts/conversation/search/share/artifact/attachment/graph/user/agent/policy APIs; guard/internalize bypasses | Historical catalog retained; MF42 original registrations resolve to37 public +5 internal. MF lifecycle closure is incomplete due critical issue1 | closure/closure-inventory.json; both handler modules; confirmations.json |
| Refreshed host JWT; exact verified issuer/subject → trusted grants; trusted bootstrap; metadata cannot grant privilege | MF uses reviewed03A require/recheck boundary, explicit independent capabilities, server actor bindings;133 frozen authority outcomes pass. Client refresh and actual JWT/subscription behavior remain03C | runtimeDataAuth.ts:27,44,58; runtimeAuth/authority+provisioning tests; scoped endpoint actor/capability negatives |
| Authenticated scoped direct endpoints; admin-only transcript unlock; canonical revisions/stale memory; lock cannot disable auth/billing | MF modern registrations retained and raw embeddings reject PROFILE_NOT_READY. Final linked-resource/anchor fence remains defective. Transcript routing/lock/bookkeeping remains03B1-T/05 and policy/billing04 | Critical issue1; memories/facts public missing-identity tests; typed embedding negatives |
| Background grant/deletion recheck; scoped subscriptions/bytes/callbacks; protect admin config; redacted shares | MF internal reference hydration and primary source/grant/tombstone checks work, including exact deletion-proof repair. Earlier linked controls remain unpinned. Bytes/callbacks/share/admin modules are outside this checkpoint | Original15 probes; repair-controls26; critical issue1; frozen handoff |
| Missing/forged identity, omitted/mismatched tenant, unauthorized scope and share cannot read/write/stream/infer via alternate paths | MF missing identity, wrong tenant/owner/scope, ambiguity, duplicate grant, capability and actor tests pass; entire alternate-path claim remains incomplete; final linked invalidation fails | All37 public paths have outcome and missing-identity matrix; authority133; issue1 |
| Cross-tenant subscriptions/tools/uploads/storage deny; internal helpers not public | MF foreign candidate IDs and stored-reference confused deputy negatives pass; all5 internal registrations actually internal. Live subscription/tool/storage coverage remains downstream | closure42; internal-handler tests; no live-service claim |
| Revocation/deletion stops later reads/effects/commits; cannot recreate deleted rows; logout semantics documented | Primary/source and independent READ/WRITE expiry/revocation/deletion repairs pass, but late linked deletion still permits private delivery and updateMany does not preserve preeffect source admission | Critical issues1 and2; controls26; frozen03A logout policy |

## Bounded MF requirements review

| Requirement | Met? | Evidence |
|---|---|---|
| Preserve original42 registrations and approved visibility changes only | Yes | Fresh AST closure42,37 public,5 internal,0 unresolved |
| Exact verified issuer/subject, current memberships/grants/epochs, independent capabilities; omitted selectors derive one scope or deny | Yes in offline boundary evidence |133 authority + endpoint scope/duplicate/identity negatives; existing03A code hashes unchanged |
| Trusted scoped canonical row selection and own-owner predicates before processing/limits; foreign duplicate-ID row cannot win | Yes for inspected scoped adapters |37 public positive/negative matrices verify selected IDs and writes; internal storage-ID hydration uses composite scope predicates |
| Privileged actor labels/metadata/public share claims never grant authority | Yes | Server bindDataActor/dataEditor; actual negative actor/capability tests; no public ref/proof/witness validator |
| Every linked peer/version/cycle/conversation/message selector remains current through final delivery | **No** | Critical issue1:12 fresh late failures, despite positive and early-denial controls |
| Current canonical source normalization/hash/full tuple/lifecycle witness reload after final crypto | Repaired on exercised source paths | Original source-fence6 and historical3 now pass; immutable source witness, exact final reload; current/history and source CAS controls pass |
| Independent current READ alone discloses private row or filter-selected IDs; write-only usable safe receipts; both admitted grants' lifetime after final await | Yes for exercised row responses and repaired proof paths; linked caveat remains | Original final-read6; distinct raw tenant READ/space WRITE positives;4 expiry injections during final source reload; write-only deletion positives |
| Complete bulk preflight and original source witness retained across effects; failure rollback | **No** | Critical issue2: updateMany valid full-source replacement after first patch succeeds for both read/write and write-only; malformed replacement correctly rolls back |
| Exact operation-minted deletion proof exempts only its own scoped tombstone; broad target/source fences remain | Repaired on exercised paths | Original corrected bulk2;12 independent two-row deletion injections (READ/write-only, source payload replacement/tenant resource/source control) deny and roll back |
| Manual source binding is server-only dedicated full-tuple CAS, distinct actual editor; extracted shared source must stay intact | Yes on inspected/retested branches |4 positive source/history controls;2 extracted edits preserve source/memory/sibling and receive fact-owned binding; registered CAS/replacement regressions |
| Assistant claims never become authoritative current user facts; all source selectors/anchors checked | Initial/current eligibility correct; late anchor checks incomplete | Current assistant fact negatives; empty/foreign/conflicting selectors; critical issue1 late canonical message removal |
| No source/ownership adoption, paid inference, raw embedding dispatch or old embedding compatibility work | Yes | Typed PROFILE_NOT_READY before vector dispatch; current schema additions only approved MF12; no MF import of D worker helper; no service/build/deploy/codegen actions |
| Whole03/05/08/09/10 completion not claimed | Yes | Candidate report and contracts explicitly retain downstream gates and limits |

## Issues found

### Critical1 — Earlier linked resources, requested fact versions and canonical message anchors are lost at the final multirow barrier

`runtimeDataAuth.ts:201` validates a conversation, resource lifecycle and each message anchor when the first row is processed. `:211` checks linked fact edge versions before recursive admission. The retained collection contains canonical **source** witnesses only; `finalizeDataRead` at `:147` reauthorizes selected top-level rows and sources, without retaining/reloading/rechecking earlier linked targets, requested versions or canonical message anchors. `currentRows` at `:291` and internal hydration thus let a later candidate's crypto boundary invalidate an earlier link without stopping delivery.

Fresh actual-handler confirmation, `/tmp/mf-cycle3-judge/confirmations.mts`:

- Seed two valid owned rows. The first references an owned canonical conversation containing message `anchor`; the second has an independent valid source. At the digest for the second source's `private second` content, inject an actual scoped conversation tombstone. Both `memories.list` and `memories.fetchMemoriesByIds`, and both equivalent facts handlers, still return both private rows. Four failures, every injection explicitly true.
- Replace that canonical conversation's messages with an empty array at the same reached digest. The same four handlers again deliver the first row carrying the now-invalid message anchor. Four failures, every injection true.
- First memory references fact `peer` at version1. During second-source hash, either set the canonical peer version to99 or create its scoped fact tombstone. `memories.list` and internal hydration still deliver both memories. Four failures, every injection true.
- Six no-invalidation linked positives return the exact two expected rows. Six matching early-invalidation negatives reject FORBIDDEN and preserve the fixture transaction. These demonstrate that the fixtures are admitted initially and that the defect concerns retention through later hashing.

Fix direction: retain typed admitted linked targets and exact edge/anchor requirements, and revalidate all of them after the last candidate crypto/authority work before delivery/effects; avoid a hash-producing recursive rewalk after the final source reload. This is part of the existing MF current-link requirement, not an added product feature.

### Critical2 — memories.updateMany discards preeffect source admission and accepts a different valid canonical payload

`memories.ts:841` obtains WRITE-selected rows from `listScopedMemories`, but its sources are private to `currentRows` and are not carried out to the batch. The batch performs every patch at `:864`, then first creates its retained admission through `canReadMutationRows` at `:868`. That helper (`runtimeDataAuth.ts:592`) captures the then-current source witnesses. A valid source replacement with unchanged lineage/revision is silently treated as the originally admitted source.

Fresh actual-handler confirmations:

- Two valid owned memories, read/write or write-only authority. Compute a valid hash for `Replacement valid canonical content` before invocation. After the first actual memory patch, using the effective-ID hook that supports both2-argument and3-argument patch signatures, replace the first canonical source's content and hash while preserving source ID/event/revision/owner.
- Both injections are asserted true. Read/write returns `{updated:2,memoryIds:["first","second"]}`; write-only returns `{updated:2,mutationReceipt:true}`. Both memory importance updates and the replacement source remain committed in the fixture. Neither failure is a late READ admission policy dispute: the original WRITE source admission is missing.
- Same batch with no invalidation succeeds with the exact expected payload for both capability sets. A corrupted replacement hash at that identical boundary denies STALE_SOURCE and restores every row for both capability sets. Existing final canonical-source integrity is effective; retaining the originally admitted full witness is the missing step.

Fix direction: capture and retain WRITE targets/source witnesses before the first batch effect, independently of later optional READ admission, then validate that original admission in the final barrier. The existing prepareMutationRowsWrite machinery demonstrates the intended boundary for delete paths. This is required by frozen03A's “Bulk operations precheck every target before mutation” and the candidate's claimed bulk witness guarantees.

### Important

The registered228 MF tests omit these two preservation cases. They thoroughly cover current top-level controls and source replacements, but the30 fresh confirmation outcomes have14 failed late expectations. Retained passing counts therefore cannot certify complete endpoint closure.

### Minor

No additional standalone minor issue is required for this verdict.

## Dimension scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment |2/5| Two current authorization/preflight requirements remain unmet; claimed final closure is contradicted by explicit reached handler injections |
| Code Quality |3/5| Trusted typed adapters and repaired source/proof barriers are effective, but linked admissions and preeffect batch source witnesses are incompletely propagated |
| Test Quality |3/5|361 meaningful registered outcomes pass; the uncovered boundary cases fail14/30 fresh confirmation expectations;26 independent repair/positive controls pass |
| Pattern Adherence |4/5| Convex-scoped indexes, structured errors, explicit capabilities, frozen contracts, source CAS and deliberate downstream limits follow house patterns |
| Completeness |4/5|42 registrations are reachable/cataloged; scoped types/lint and discovery pass; approved root consumer integration failures and service gaps are honestly reported rather than hidden |

**Average:3.2/5.** PASS requires Requirement Fulfillment=5 and every dimension≥4. These critical current-authorization failures auto-reject the candidate regardless of aggregate test counts.

## Evidence review and raw receipts

All paths below are absolute under `/tmp/mf-cycle3-judge/` unless otherwise shown.

| Evidence | Observed result | Raw receipt |
|---|---|---|
| Source/QA freeze verification |9 source +47 QA hashes match before and after independent probes; freeze hash exact | freeze-verification.json; final-source-verification.json |
| Archive integrity |32 cycle1 /38 cycle2-open-final-read /44 cycle2-final records checked; zero mismatches | archives-verification.json |
| Scoped backend and fixture type checks, affected ESLint, whitespace | All exit0 under actual preserved Convex ES2021 lib config | commands.json; backend-types.stdout/stderr; scoped-types.stdout/stderr; lint.stdout/stderr; whitespace.stdout/stderr |
| AST registration closure |42 total,37 public,5 internal,0 unresolved, original path set unchanged | closure/closure-inventory.json; closure.stdout |
| Jest discovery and actual registered tests |5 expected suites;361/361 passed:117 memories,111 facts,133 frozen authority;0 skipped/pending | tests.json; tests-summary.json; discovery.stdout; unit.stdout/stderr |
| Full root types | Exit2, exactly4 TS2339 integration diagnostics: src/governance/index.ts:380 enforce (accepted D internalization), tests/helpers/cleanup.ts:58,:77 and tests/interactive-runner.ts:380 purgeAll (accepted MF internalization) | root-types.stdout/stderr; commands.json. **Not full-root PASS** |
| Unchanged original cycle2 probes rerun by fresh judge |6 source fences +3 history +6 independent READ delivery outcomes pass | original-probe-commands.json; source-fence-probes.stdout.json; historical-source-probes.stdout.json; final-read-probes.stdout.json. Exact original bytes copied from /tmp/mf-cycle2-final-judge-edvgqmuw |
| New linked and bulk confirmation matrix |30 observed outcomes,16 expected controls pass,14 reached late expectations fail; process exit1 | confirmations.mts; confirmations.stdout.json; confirmations.stderr; independent-probe-commands.json |
| Independent source/history/extracted/distinct-grant/deletion/expiry controls |26/26 pass, including source payload/broad fence rollback and4 final-reload grant expiry injections | repair-controls.mts; repair-controls.stdout.json; repair-controls.stderr; independent-probe-commands.json |
| Initial exploratory boundary probe |6 failures independently identified; superseded for certification by explicit30-case controls above, retained without rewriting | new-boundaries.mts; new-boundaries.stdout.json; new-boundaries.stderr |

The original wrong2-argument-only bulk hook is **NONCERTIFYING**. I read the immutable corrected historical BEFORE probe with effective-ID selection plus `assert(injected)`, and used effective-ID hooks with explicit reached injection fields in every fresh mutation experiment. No previous failed evidence, review or archive was edited.

## Limits and recommendation

The probes invoke actual registered `_handler` bodies with the documented transaction-aware fixture. Fixture exceptions restore all rows; these outcomes demonstrate stipulated handler checkpoint failures. They do **not** demonstrate an actual deployed exploit, real Convex concurrent transaction behavior, JWT signature/expiry validation, schema-validator admission, subscriptions, managed vector search, paid inference or external effects. Linked owner columns on conversation/immutable/mutable tables are an explicit downstream adapter seam; fixture linked rows model that trusted fresh ownership, consistent with the candidate's tests and handoff, rather than certifying current live schema readiness.

The source integrity and exact deletion-exemption repairs are real improvements and their original failures now reject. Final MF closure nevertheless remains rejected because linked lifecycle/anchor/version admission and preeffect updateMany source admission do not survive the tested boundaries.

Preserve this third candidate and all exact independent evidence. Keep MF-dependent work blocked and honor the installed maximum3-cycle rule; do not reinterpret the361 scoped tests, earlier15 replay outcomes or26 repair controls as a final PASS, and do not assume an automatic fourth fix/judge cycle. Continue only other independently authorized, nondependent work within the original17-task plan.
