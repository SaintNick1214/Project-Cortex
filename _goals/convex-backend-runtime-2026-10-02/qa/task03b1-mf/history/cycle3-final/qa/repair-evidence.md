# Task03B1-MF third repair defect evidence

Cycle1 remains independently REJECT3.0/5; cycle2 is FINAL REJECT3.2/5.
See ../task03b1-mf-review-1.md and ../task03b1-mf-review-2.md. The32/38/44 preserved
records for cycle1/open-cycle2/final-cycle2 match their manifests byte for byte.
This third repaired candidate awaits the last fresh independent judgment.

Final cycle2 confirmed eight additional failures despite its307 passing selected tests
and6+30+12 passing grant/adapter/proof controls. Its original source, frozen QA, probes
and failing raw outcomes remain under history/cycle2-final/. The original first bulk
probe had a wrong patch signature and is non-certifying. The corrected historical
BEFORE mirror reproduces the genuine old unsupplied-ID gap. No historical probe/log
has been edited to turn a failure into PASS.

| Final cycle2 finding | Third source repair | Actual registered-handler outcomes |
|---|---|---|
| Final WRITE source hash allowed memory restore/fact in-place private responses after source tombstone/revision advance (4) | Immutable complete source witnesses copied before hash; actual scoped source/full payload/current controls reloaded after all crypto and authorizations; no hash after final reload | Each of the4 original cases reaches injection, rejects STALE_SOURCE and restores the complete transaction. Additional source/event/owner/scope/content plus valid hash/hash/timestamps/role/trust/tool-operation changes also reject. Distinct raw tenant READ/space WRITE full responses and late grant denials remain. |
| Historical fact hash allowed current source tombstone/event changes (2) | Full CURRENT canonical source witness retained through whole historical chain and final read barrier; older valid revisions remain explicitly stale | Real two-version update then tombstone/event/content/role/trust/operation injection rejects with rollback. Positive history contains2 labeled versions; old revision remains excluded from normal current get. Current/history READ lifetime expiry after final source reload denies. |
| Deletion proof removed whole resource requirement and ignored independent tenant-wide memory/source-row tombstones (2) | Private exact full scoped tombstone proof; delegating current authority reader ignores only that exact unchanged operation proof and retains target/owner/scope requirements, tenant-wide resource controls and all admitted source witnesses | Both original injection cases deny/rollback with and without READ. Source controls/event replacement, proof payload corruption, late WRITE invalidation also deny. Exact scoped proof positive returns IDs with READ or count+receipt without READ. Single, count-only and caller-ID deletes retain the same WRITE/source fences. |

Earlier source witnesses are also retained through later list, keyword, internal-hydration
candidate hashes; changing the first candidate's source while hashing the second rejects
and rolls back. Source CAS keeps the original full payload, so replacing content with a
valid matching hash without advancing revision cannot be silently overwritten. Unbound
extracted-edit branches retain the original shared source witness while hashing their
separate assertion; both update variants deny and roll back an independently replaced
shared source payload, while ordinary extracted edits still succeed.
The synchronous pinned-grant lifetime check runs after the final async source reload,
including opposite READ/WRITE expiry. Supersession/consolidation retain every admitted peer source and validate all of them
before effects and after later hashes; valid full-payload replacement of an earlier peer
while hashing a later peer denies before any fact writes. Fixtures assert reached injections and
complete database rollback, not just rejection.

Unchanged independent source-fence6, historical-source3 and distinct-grant final-read6
probes are copied byte-identically into checks/ and replayed by the exact checks.mjs
runner with hashes/command receipts. These15 outcomes are executor replays, not a fresh
independent judgment. The earlier completed judge's30 adapter and12 extra boundary
checks remain historical results; current registered tests retain those behaviors.
The old exact two-grant-read instrumentation was adapted to the new source authorization
path: registered expiry outcomes now advance time after final raw grants and during the
last source reload, retain injection/rollback assertions, and cannot pass by early denial.

The following original defect matrix and response audit remain applicable:

| Confirmed defect | Source repair | Actual-handler regression outcomes |
|---|---|---|
| Write grants returned private existing rows and unsupplied bulk IDs | memoryMutationResult/factMutationResult independently resolve current read; write-only receipts. canReadMutationRows checks every filter-selected target before IDs are returned. Final write/source/resource checks prevent a downgrade from hiding invalidation. | Memory update/restore/updateMany/deleteMany and fact update/updateInPlace under own and foreign-owner space write-only grants succeed without private text/metadata or unsupplied bulk IDs. New store receipts contain only newly created IDs. Read+write full responses remain usable. Late grant expiry/revocation, principal/membership/scope/resource/source deletion or hash corruption after preparation rejects and rolls back, including a later bulk row. Read-capable writer read failure never becomes receipt success. |
| Corrupt source hash/normalization accepted and silently repaired | canonicalSource verifies lineage, NFC/LF/trim canonical equality and actual semanticHash. Current, historical and revision paths all require it. | Memory get/history/version/timestamp/update/partial/finalize and fact get/history/update/updateInPlace deny forged hashes or valid hashes of noncanonical text with zero attempted writes and unchanged transactions. Fact historical cases begin with a real two-version update and check the current canonical source. |
| A manual: source prefix permitted extracted fact edits to rewrite memory siblings | Server-only typed manualSourceBinding; dedicated CAS proves exact full source tuple and manual policy. Unbound derived facts receive separate user assertions. | A real memories.store source feeds typed DerivedFact inputs, with/without explicit sourceRef.memoryId. Both fact update and updateInPlace succeed, preserve the original source/hash/revision/memory and sibling, and produce fact-owned assertion bindings. A later real update retains the family binding. Invalid bindings and source collisions deny without writes. |
| Visited skipping accepted cycles and ignored requested edge versions | Active recursion set with finally cleanup; getScopedFact checks expectedVersion before descent on every edge. | Actual memory get/partial edit deny direct cycles and A->F->B->F(version99) with no writes. Typed shared guard validates repeated valid DAG nodes; actual memory store with valid linked F succeeds, while wrong F version99 denies before writes. |
| Message-only and conflicting source selectors were accepted | Validate all selectors, require nonempty conversation anchor for messages, reject inconsistent conversation/memory references. | Actual facts.store rejects messages-only, empty refs/IDs/messages, foreign messages/memory, and conflicting owned anchors before any source/row insert. Matching conversation/message/memory selectors succeed together. Corrupted stored links deny later edits. Actual partial memory creation rejects empty and foreign anchors. |

The original110 MF test outcomes remain.64 prior-repair and54 third-repair
parameterized outcomes contain fresh per-operation/owner/corruption matrices;228 MF
plus133 frozen authority outcomes pass,361 total across5 suites,0 skipped. Store and revision async hash-boundary
expiry injections deny before source/row writes and roll back. Empty/whitespace-only normalized manual
text fails with typed INVALID_INPUT and zero writes on memory/fact store/edit and memory
partial/finalize paths. Unbound assistant-memory partial edits
retain assistant_claim when establishing a new binding, preserving their original source.
Owned immutable/mutable controls and
their foreign/missing-owner/tombstone/wrong-version negatives are retained as endpoint
outcomes alongside the link repairs. The fixture invokes actual registered _handler
bodies; only its context adapter is cast, and failed transactions restore all rows.

All public mutating response paths were inspected:

| Response shape | Paths | Disclosure policy |
|---|---|---|
| Private row | memories.store/update; facts.store/update/updateInPlace | Independent current read or successful typed receipt |
| Nested restored row | memories.restoreFromArchive | Independent current read; otherwise restored/known ID + mutationReceipt |
| Filter-selected IDs | memories.updateMany/deleteMany | Read for every selected target; otherwise count + mutationReceipt |
| New IDs | memories.storePartialMemory | Newly created memoryId/storage ID, no row contents |
| Echoed selectors/counts/status | memories.updatePartialMemory/finalizePartialMemory/deleteMemory/deleteByIds/archive; facts.deleteFact/supersede/deleteMany/consolidate/deleteByIds | Only caller-supplied IDs, counts or fixed status; no private row payload or unsupplied ID lists |
| Internal operator count | memories.purgeAll; facts.purgeAll | Internal deployment operator only |

No mutating handler has an existing-row idempotent return shortcut. All actual row
responses use the independent-read helpers. Admin remains separate from read/write.

Root schema was opened only for the approved optional manualSourceBinding columns
on memories and facts: `{resourceType:"memory"|"fact",resourceId:string}`. Trusted
writers assign them; metadata cannot grant them; frozen DerivedFact/SourceContent and
the02B source schema are unchanged. Third repair does not edit the root schema. The parent separately integrated reviewed
Task03B2-D blocks/import; the combined current schema hash is recorded in freeze.json
and the approved prior MF12 lines remain unchanged. Task08 must use runtimeEditor
for actual editor audit attribution when a cross-principal correction becomes ingestion
input, distinct from canonical source/resource owner.

Exact commands and raw outputs are retained in checks/. Strict affected types/lint,
42-path AST closure and whitespace pass. Full root types still fail with exactly the
four documented consumer references (three MF purgeAll and the parent-integrated D enforce); this is not a full-root PASS. No live
Convex, subscription, managed transaction, vector dispatch, inference, SDK/codegen,
deployment or commit qualification is claimed. Task03B1-T/03B2/03C and05/08/09/10 remain
the previously declared downstream gates.
