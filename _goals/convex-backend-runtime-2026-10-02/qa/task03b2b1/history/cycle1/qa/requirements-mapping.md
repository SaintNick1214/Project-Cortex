# Requirement → actual handler outcome evidence

| Requirement | Implementation | Outcome evidence |
|---|---|---|
| Exact46 selected paths,43 guarded public +3 internal operator purges | agents/memorySpaces/contexts native registrations; AST inventory.mjs | registered.test.ts exact counts/native visibility/native validators; catalog.test.ts temporary reproduction/current hashes |
| Every public path missing identity, forged tenant and forged verified subject denies | RegistryAccess.open → frozen03A requireAuthority | registered.test.ts ALL43 missing-auth +ALL43 forged-tenant +ALL43 forged-subject; zero domain read/effects assertions |
| Real scoped/owner selection before hydration/limit; omitted selectors derive one | scoped indexes/owner filters; trusted control scope enumeration | adversarial.test.ts foreign-first list cases in all3 modules, canonical foreign/absent owner, omitted-scope ambiguity |
| Explicit independent READ/WRITE/ADMIN and labels never authority | retained scope/resource references; private receipt union | adversarial.test.ts capability wildcard negatives, safe private-write/create/register receipt, distinct pinned READ generation revoked at actual insert/patch attempts rolls back, forged owner/user/config roles, no control provisioning; native empty descriptive-string create/update/read round trips in all3 modules |
| Same-key orphan/foreign collision cannot be adopted or share deletion side effect | Boolean exact-key conflict/uniqueness probes | adversarial.test.ts create collision2 +mutation collision6 +late bulk collision; zero first effects; documented Convex hydration exception |
| Bulk complete preflight +transaction rollback | target maps/revision plans/native persisted validators; no catch-and-continue | adversarial.test.ts missing/foreign/tombstoned/duplicate/malformed agent bulk, context version/history overflow, participant collision, native-invalid Date/Map/classes/cycles/int64 overflow, database failure rollback |
| Full context topology/source/resource/grant checks and bounded graph | graph/contextAt scoped independent actual-space admission +first snapshot witnesses | adversarial.test.ts parent/root/child/duplicate/cycle/depth/owner/ambiguous links; cross-space success then grant revocation; repeated earlier-root rebind denial |
| Descriptive grants/participants do not provision access; target actual grant required | graph target spaceAt; grantAccess metadata-only revision | adversarial.test.ts metadata access cannot replace grant; grantAccess keeps control table bytes; catalog.test.ts stale descriptive edge target denies |
| Hierarchy repairs/cascade overlaps retain exact topology and actor revisions | revision/deletion preflight plans; contexts.lastUpdatedBy | adversarial.test.ts child creation attribution; cross-principal editor; missing prior actor unknown; orphan descendant repair; overlapping cascade once; attributed retirement |
| Admitted refs/witnesses current after later rows/last await and effects | RegistryAccess retained checks/first snapshots/matching sweeps | adversarial.test.ts late READ/WRITE/ADMIN downgrade rollback, late peer revocation rollback, canonical tombstone delivery denial, earlier row owner/version/config rebind denial; retired row owner/fence/resource-fence changes on all4 agent/context deletion paths, space row/resource-fence loss, earlier cascade retirement rebind all deny and roll back; all3 creates with admitted or initially unavailable READ reject first-reread payload/owner/foreign-collision changes against locally computed expectations, while unchanged reordered-key controls pass |
| Space metadata/current-grants only; deletion retains barriers; no raw cascade | deleteSpace exact resource/scope tombstone +expected retirement barrier | adversarial.test.ts scoped/tenant-wide deletion, blocked bootstrap/reactivation/new resources, preserved controls/source; catalog.test.ts final principal loss after all3 fence writes rollback |
| Native canonical owner/anchor source seam cannot expose legacy transcript | independent conversationAt fail-closed typed seam | adversarial.test.ts get/create/getByConversation all deny with zero conversation hydration; registered.test.ts exact valid-identity fail-closed getByConversation outcome; Task03T/05 actual positive delivery PENDING |
| Purges internal and preserve auth/source/metadata fences | internalMutation +retirement only | registered.test.ts all3 native internal flags and outcomes with anonymous internal ctx; source/auth rows retained |
| Selected source ownership; original compiler/lib preserved | exact additive3-block schema patch; unchanged auth/generated/SDK/config | catalog.test.ts native schema host composition/stat exports; source-freeze.json/preservation.json; unchanged convex-dev/tsconfig ES2021 compile receipt |
| Offline npm12.2/Node>=24.15 actual validation/counts/no skips | checks/run-checks.py private cache | checks/commands.json/stdout/stderr/tests-final.json/discovery; scoped ES2021 compile/lint; no skipped tests |
| Honest pinned-base vs introduced root diagnostics | exact Git archive of a2c982 in owned TemporaryDirectory/finally cleanup | checks/baseline-commands.json; baseline governance1 vs introduced SDK25/root cleanup2; report/classification; no broad root PASS |

Pending outside this slice: stats2, A2A4, MF/source bridge, Task03T/05 actual conversation/anchor success,
Task08/12/15 durable derived cascade, Task03C2/09 SDK/cleanup integration, whole03B2B52, wholeTask03,
wholeGoal. Tests certify mocked registered handlers/transaction control records, not live deployment,
real JWT signature/audience configuration, actual private-byte delivery or paid runtime/service behavior.

Native v.any correction: adversarial.test.ts includes exact int64/byte/special-float/signed-zero create/
edit/get/list/search/history/export round trips, native root values in all3 modules, a supported depth55
object, archive preservation and record merge/non-record replacement. Changed int64 and binary source
witnesses deny and roll back. The old Infinity-negative is retained only as historical specification-
corrected evidence, not an authorized restriction; see contracts.md.
