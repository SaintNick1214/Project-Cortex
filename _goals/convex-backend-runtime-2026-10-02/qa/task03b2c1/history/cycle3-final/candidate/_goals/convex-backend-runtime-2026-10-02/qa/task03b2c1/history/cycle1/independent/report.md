# Task Judgment: frozen Task03B2C1, cycle 1

## Verdict: REJECT

The bounded 22-registration text metadata slice has three requirement defects: create can discard an already admitted READ after its insert, linked source lifecycle flags are checked after private source hydration, and a later candidate can replace an earlier source snapshot. The 84 native tests and the type/lint checks pass, but do not cover these failures. This judgment concerns only the frozen candidate; it does not assess or adopt the concurrent memory/fact work in the main checkout.

Candidate: `/workspace/Project-Cortex/work/backend-runtime/task03b2c1-checkout`.
Reviewed base: `c0c40423b52e133b9a51f04d07fd21d38f27c7f2`.
Freeze: `2026-10-03T11:28:11.013834+00:00`.
Read-only review. All new files/logs/probes are under `/tmp/task03b2c1-review1-vm2r9skl`; no production/test/QA/freeze files in the candidate were modified. No build, deployment, generated binding change, service operation, paid call, stage, commit, push, or child agent was performed.

## Evidence Review

Read AGENTS.md, CODEX-RUNTIME.md, PROJECT-PROFILE.md, pessimistic-judge.md, judge-task/SKILL.md, the original goal/implementation prompt, Tasks 03/05/12, authoritative decision-gates.md and relevant architecture sections. Reviewed all six changed source/test files, accepted runtimeAuth/verified contracts, schema, generated inference of schema types, scoped check configs, inventory writer, baseline compiler host, source freeze, preservation, requirements, report, all retained native receipts, and the initial expiry failure/correction.

Verified all 52 frozen source/evidence hashes before checks. Independently compared all 1,828 tracked base files with the checkout: only artifacts.ts and schema.ts differ; the new guard and three test files are the four permitted new code files. Schema changes are confined to artifacts. No rejected memory/fact, registry, metadata or worker guard/fixture machinery is imported by this adapter. The original baseline compiler-host overlay is sound here because every tracked input apart from original artifacts/schema is byte-identical.

Independent observed checks: actual unchanged backend config with ES2021 lib, explicit scoped ES2021 types, scoped ESLint zero warnings, full isolated root compiler, original tracked c0c baseline compiler host, native discovery, native tests, AST inventory and whitespace all exit 0. Type checks have zero diagnostics. Discovery is exactly handlers.test.ts and inventory.test.ts. Native result is 2 suites, 84 passed, 0 failed, 0 skipped/pending/todo. Inventory is 22 selected registrations: 21 public + 1 internal, 0 unresolved, 5 excluded file registrations byte-identical. Ordinary inventory test uses mkdtemp/finally cleanup. All reviewer catalog/Jest/cache outputs were rerouted to scratch.

The initial native receipt actually records 69 passed/1 failed/0 skipped. Its expiry hook used a threshold not reached by the handler. The current test retains the expected denial, independently measures a successful native path, reaches the exact final control await, verifies its final resource key and zero attempts, and passes. No weakening of that denial assertion was found. This justified setup correction does not erase the raw failure.

Additional private probes: initial 6 exploratory cases; 40 adversarial cases, with 33 expected outcomes and 7 failed expectations; 4 repeated-source cases, with unchanged-source positive control passing and all 3 changed-source expectations failing. The 40-case failures comprise one blocking create downgrade, three lifecycle hydration failures, and three explicitly qualified synthetic final-await limitations. They are not claimed as 40 passing acceptance tests.

## Requirements Review

| Original bounded requirement | Met? | Evidence / disposition |
|---|---|---|
| Exact original selected 22 registrations, 21 guarded public and 1 operator internal | Yes | Independent native AST inventory; selected names and original dispositions reviewed; actual handlers reachable. |
| Five named original file registrations AST byte-unchanged; all attachments unchanged; remaining 17 pending | Yes | Inventory frozenFilePaths all unchanged; all tracked preservation comparison includes attachments; contracts/report explicitly pending. |
| Only six permitted source/test files; schema only artifacts owner/actor/tombstone/scoped indexes | Yes | 1,828-file comparison, two tracked diffs plus four permitted new files, schema.diff inspection. |
| Use independent accepted03A only; no rejected guard/fixture dependencies | Yes | New adapter imports runtimeAuth, verified types, generated types; independent fixture imports actual artifacts. |
| Exact verified issuer/subject, trusted principal/membership/grants and one eligible concrete scope | Yes | begin():143-161 delegates accepted03A; missing identity on all 21 native handlers; forged issuer/labels, wrong/ambiguous scopes tested. |
| Omitted selectors cannot imply global access; tenant grant must narrow to concrete registered space | Yes | authority.memorySpaceId required at 146; accepted policy/current scopes; normal by_runtime_scope selection. |
| Caller labels cannot grant authority; admin is not read/write wildcard | Yes | Explicit policy capabilities; native forged label tests; independent admin-only get/update probes reject before attempts. |
| Canonical owner and artifact lifecycle before hydration/count/limit | Yes | candidates():165-175 and controls exclusion list():214-229; own/cross-owner/resource tombstone tests verify returned query IDs. |
| Collision-only exact trusted tenant/space/key full-document Boolean exception | Yes | collision():231-245 retrieves first exact indexed document, discards it immediately, uses only Boolean; native opaque conflict receipt. |
| Initial WRITE and independent READ admission; initially absent READ may yield safe receipt; never adopt later READ | Partial / fail | Initial absent READ/update and later-added READ receipt tests pass. Create after insert discards previously admitted READ rather than denying. Issue 1. |
| Later admitted READ/WRITE/control failure denies and mutation rolls back | Partial / fail | update revocation/principal/membership/scope/resource rollback assertions pass; create independent READ revoked after insert resolves/retains insert. Issue 1. |
| Retain full source/link/version/anchor/current control witnesses across all candidates | Partial / fail | Distinct earlier link witnesses survive later admission and control preflight. Repeated same source overwrites the first row snapshot, losing old anchor/content/version pin. Issue 3. |
| Current authority through transaction delivery/effect/commit; expiry after final DB await | Yes within real transaction snapshot, subject to Issues 1/3 | checkpoint():296-308 reloads current transaction rows/controls and evaluates Date.now after last DB await/local policy awaits. Native reached expiry denial passes. Synthetic external changes to an already-read row at final await are separately qualified below. |
| Canonical conversation before artifact label association; independent linked READ/resource control before private source query | Partial / fail | getByConversation verifies canonical conversation first; scope READ and control tombstones precede query; source row lifecycle is missing from query predicates. Issue 2. |
| Actual current conversation rows lacking owner fail before message hydration; no invented live ownership | Yes | Structural owner filter at 253-260; owner-absent native test returns no source IDs; current schema is unchanged and has no owner. Typed seam is explicitly pending03T/05. |
| Exact known-source owner/lifecycle/version/history/anchor ties; no private source/raw reasoning/tool output serialized | Partial / fail | Full row snapshots and anchor uniqueness otherwise enforce ties; no canonical messages serialized. Source lifecycle hydrates before deny and repeated source snapshot can lose old tie. Issues 2/3. |
| Version/history/input safe integer, overflow, uniqueness/order/gaps/state invariants | Yes for observed bounded outcomes | validateArtifact():40-58, nextVersion():37-39, input safeInteger calls; meaningful native overflow/malformed/gap/branching/state and UTF-8 outcomes. Read/tombstone file preflight tested. |
| CRUD/history/undo/redo/all stream metadata actual outcomes remain functional | Yes, subject to authorization defects | All 21 selected actual _handler happy outcomes have meaningful assertions, plus full start/append/pause/finalize history flow. No second model/tool loop. |
| Verified actor labels; owner/editor remain distinct | Yes | Create owner/user and changedBy derived authority; patch central actor setter; deletion verified principal; broader space owner access does not overwrite owner. |
| Tombstones retained, no resurrection or control deletion | Yes | Public retained row+resource tombstone; repeated create/update reject; internal purge never calls delete and retains foreign/control records. |
| File-bearing current or retained historical version fails typed CAPABILITY_NOT_READY before effect/storage | Yes | Independent all 20 non-create selected handlers with retained history reject typed with zero attempts; native current-file matrix; no storage access in selected slice. |
| Internal purge exact tenant/space, trusted operator-only internal, entire batch preflight/control retention/foreign untouched/no storage | Yes | internalMutation; missing concrete scope denies; independent current-file/history/link/malformed last-row batches all zero attempted mutations; positive two-row batch retains foreign/grants and adds tombstones. |
| Bounded linked purge remains typed unready; eligible unlinked text rows execute; incomplete linked cleanup honest | Yes | linked preflight before first patch; independent linked batch zero attempts; contracts/report explicitly pending canonical cleanup Task05/12/16 and do not claim full lifecycle PASS. |
| Actual unchanged ES2021 backend compilation; scoped/root/baseline compilation not hidden by higher libs | Yes | Independent reruns all exit0/zero diagnostics; original backend config preserved; scoped config ES2021. |
| Native 84 meaningful outcomes, discovery2, skipped0; retain initial expiry failure and reached correction | Yes, coverage gaps block aggregate PASS | Raw native JSON and discovery; source assertions reviewed; 69/70 failure preserved; corrected expiry actual final-await hook asserted. Missing create/repeated-source/lifecycle negatives documented. |
| No full C2/Task03/private bytes/transcript/asset/live/goal PASS inferred | Yes | Bounded report/contracts accurately preserve remaining 17, canonical source/linked cleanup and full service gates pending. |

## Original Task03/05/12 disposition

Task03's bounded-substeps/inventory/guarding requirements are partially implemented by this slice, with the three defects above; this is not a completed03B or Task03. Verified issuer/membership/grant checks are reused from accepted03A. Client JWT refresh, background run references, real scoped subscriptions/bytes/callbacks, admin configuration, shares, tools and paid negative cases are outside this slice and remain pending; none receive PASS here. Direct manual artifact APIs are scoped; transcript unlocking/writing is not implemented. Missing/forged identity, wrong scopes, revocation and tombstone artifact unit outcomes are observed, but whole alternate-path/live acceptance is pending.

All Task05 requirements and acceptance (Agent thread mapping/authoritative transcript adapter, executable agent definitions, admission deduplication/serialization, run statuses, managed lock/unlock revisions/stale derived state, crash recovery and live component behavior) remain pending. The current-schema owner absence fails closed before canonical message hydration, and no manual transcript writes or private message serialization were introduced. The typed test source seam is not Agent/conversation readiness.

All Task12 requirements and live acceptance (cross-owner asset catalog/video/provenance, 20,000,000-byte actual admission/materialization/delivery cap, authenticated private HTTP/blob delivery, idempotent reference-aware byte cleanup, immutable asset lineage, provider input/protocol limits, actual authorized below-cap and denied oversized/revoked byte outcomes) remain pending. This slice conservatively rejects current/history files and keeps every original file/attachment registration unchanged/unaccepted. Text undo/redo and retained metadata are observed; full file lineage/export and cleanup are not certified.

Model policy/billing/secondary artifact inference controls remain Task04/14 work: no inference added, and manual metadata grants do not imply a model/tool budget. Production/release/merge are outside authorization.

## Issues Found

### Critical: admitted READ downgraded after create's insert

`convex-dev/runtimeArtifactAuth.ts:187-195` catches FORBIDDEN and removes all READ witnesses; `convex-dev/runtimeArtifactAuth.ts:319-324` calls that admission after the insert. `convex-dev/artifacts.ts:87-103` therefore admits scope READ before effects, inserts, then can classify a later READ failure as initial ineligibility. A private reached probe supplies a write-only space grant plus a distinct initially eligible tenant READ grant. Its insert hook sets that READ grant's revokedAt. Create resolves `{success:true, artifactId:'new-a'}` and retains the insert. The same independently revoked READ on update rejects and rolls back. Initial absent READ and ordinary admitted READ create controls both succeed with their correct response shape.

This violates the explicit late-admitted-failure rollback contract; it is a deterministic native-handler/guard requirement failure, not a deployed race exploit claim. Pin the create resource READ decision from its expected canonical row before the insert, preserve any admitted READ thereafter, and propagate failed post-effect checks. Initial safe-receipt logic must never clear already retained READ/source requirements. Add both create late-READ cases, including a distinct grant, and assert reached injection, rejection and rollback.

Raw proof: `adversarial-results.json`, case `create independently admitted READ revocation after effect`; `probes.mts`/`probe-results.json` also reproduce same-grant read removal and distinct-grant revocation.

### Critical: later repeated source replaces the earlier exact witness

`convex-dev/runtimeArtifactAuth.ts:177-178` unconditionally overwrites the row snapshot in the map, and `convex-dev/runtimeArtifactAuth.ts:294` applies it to every linked source admission. Two artifact candidates referencing one conversation produce two source reads. If the second read observes a replacement of the first candidate's anchor, first message content, or source version, the new snapshot replaces the first. Final checkpoint checks only the replacement snapshot. The first candidate's requested message can be absent, yet list resolves with both artifacts.

All three private probes reach exactly the second source query (two source queries/one injection), resolve, and attempt zero mutations. Unchanged repeated source resolves as the positive control. This is a lost retained requirement, separate from requiring impossible atomic rereads. Keep the original source snapshot immutable; compare each repeated admission against it and deny a changed source. Expected snapshots for this operation's own artifact patches should use a distinct explicit update path. Add repeated-conversation and repeated-memory tests with old anchor/content/version ownership ties.

Raw proof: `repeated-source.mts`, `repeated-source-results.json`, `repeated-source.stdout`.

### Critical to bounded pre-hydration requirement: deleted source payload hydrates before denial

`convex-dev/runtimeArtifactAuth.ts:250-260` and `:275-281` filter scope/key/owner but omit source row isDeleted/deletedAt/tombstonedAt. `:288-289` checks these only after collect has hydrated the full source, including private messages/content. Independent probes with the typed fresh owner seam and each deletion marker reject FORBIDDEN, but the source ID appears in the returned query IDs before rejection. A memory deletedAt probe reproduces the same behavior. No source output is delivered and no mutations are attempted.

This is a pre-hydration contract violation, not evidence that current owner-less conversations expose live bytes. Current schema conversation/memory ownership remains unavailable and current rows fail the owner predicate as documented. Add lifecycle predicates to the private canonical source query before collect, retain resource control checks, and assert deleted source IDs never enter returned private query results for both source kinds.

Raw proof: `adversarial-results.json` conversation deletion-marker cases; `probe-results.json` conversation and memory lifecycle cases.

### Important: current suite misses these distinct boundaries

`tests/unit/runtimeArtifactAuth/handlers.test.ts:96-100` tests late READ revocation only through update; `:139-161` does not test two candidates re-admitting the same changed source; `:269-273` tests trusted control tombstones before hydration but not canonical source row lifecycle filters. Add the exact outcome negatives and positive controls above without relaxing existing assertions or using rollback to hide attempted preflight mutations.

### Qualified synthetic final-await limits, not additional live exploit defects

Three retained probes inject earlier conversation tombstone/anchor/deleted state at the independently measured final DB await of a two-candidate list. All reach await 67 exactly; the final query is the unscoped artifact tombstone control for `second`; each resolves. Rows and earlier controls have already been read, so the local control snapshot cannot observe later synthetic mutation of those earlier records.

A real Convex query/mutation has one serializable transaction snapshot. An external concurrent transaction cannot change an already-read row within that same snapshot, and conflicting mutation reads/writes are governed by transaction retry/commit semantics. These results do not independently establish a missing real current-transaction check or require an impossible atomic reread of every earlier row after the final await. They remain in raw evidence as the mutable fixture's practical limit. The create READ drop and repeated-source replacement are explicit lost/erased witness requirements; lifecycle hydration lacks a selection check outright. Those are the blocking findings.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 2/5 | Three explicit bounded admission/source requirements fail despite remaining scope being honestly pending. |
| Code Quality | 3/5 | Clear independent adapter, scoped selection and deliberate transaction handling; READ reclassification and mutable source witness map need repair. |
| Test Quality | 3/5 | 84 meaningful native outcomes, raw initial failure and reached expiry; critical create/repeated-source/lifecycle assertions absent. |
| Pattern Adherence | 4/5 | Accepted03A adapter, generated schema inference, scoped indexes, preserved excluded code and private test output ownership. |
| Completeness | 3/5 | Exact bounded registrations wired and compilation clean; bounded authorization closure cannot be accepted with found defects. |

**Average: 3.0/5.** Requirement Fulfillment <=2 requires REJECT under judge-task; passing checks or exhausting review cycles cannot override it.

## Recommendation

Repair the three guard defects in a new candidate, add the reached outcome negatives with positive controls, rerun affected native/type/lint checks and request a fresh independent cycle2 judgment. Preserve this freeze and all failed raw receipts. Keep full C2/Task03/Task05/Task12/live subscriptions/bytes/services/goal gates pending.

## Practical Service Limits and Raw Evidence

No live Convex deployment, subscription, Agent/Workflow store, storage, HTTP bytes, paid provider, callback, external effect, browser or media behavior was invoked or qualified. Native _handler tests use independent in-memory transaction rollback and real exported Convex registration handlers; they do not execute the deployed Convex validator/service/commit engine. The structural source owner fixtures contain fields that actual current source schemas cannot write. Backend compile and complete tracked baseline comparison are offline evidence only.

The scratch directory contains `commands.json`, each raw `*.stdout`/`*.stderr`, `native-tests.json`, `catalog/public-path-inventory.json`, all probe sources and raw results, `tracked-preservation.json`, before/after source verification, this report and `manifest.json`. Command receipts retain absolute cwd, exact args, UTC start/end and exit status; direct Node24 invoked the installed TS6/ESLint10/Jest30 tools. No npm install or npx fetch was needed. The source verification and manifest SHA256s are reported separately to the parent for copying into canonical QA.
