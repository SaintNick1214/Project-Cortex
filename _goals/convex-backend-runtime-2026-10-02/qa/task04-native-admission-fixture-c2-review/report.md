# Task Judgment: Task04 native admission fixture C2 preparation

## Verdict: REJECT

Independent, pessimistic READ-ONLY preparation judgment only, bound to C2 runtime-freeze SHA256 `f5ee7dc86a258c2e5c49ccd8f3e6200b6d7b6390d190ce32909fc5a3aff2dfc9` and qa-manifest SHA256 `182f270af595de0a0d2f284728172a0028ec64aa2a23c63847660e35ea0cbd00`.

The four C1 concerns are repaired and pass meaningful offline verification. A newly discovered deterministic public-argument defect blocks the required complete authorization sweep. **Do not create a target from this frozen C2 packet.** Native OCC/rollback/auth/publication/HTTPS peer/management/deployment/key-match/retirement and model/paid outcomes remain NOT_RUN. Accepted B C2 code is unchanged; native B qualification, whole04, full03 and the goal remain incomplete. Waived numeric limits never override the independent gate.

## Requirements Review

| Scoped preparation requirement | Met? | Evidence |
|---|---|---|
| Preserve accepted B ledger, original cases, C1 failures and current copied registration closure | Yes | Integrity01 verifies229 freeze rows,235 manifest rows/236 actual candidate files,136 source mappings, all16 accepted gates, all fixture bytes equal C1, exact unchanged cases.mjs and C1 recursive freeze/manifest. Ledger source remains `2a499e50107e6ba0064368c6d84c5ecce596bb420114336c3a2bdb86d0be9aa8`. |
| Immutable synthetic root, exact product schema, only peer table and EMPTY production source denial | Prepared | Offline trust identity/cloning/deep freeze and historical schema preservation assertions pass.31 product tables/184 ordinary+8 search-vector indexes;32 fixture tables/185 ordinary+8 search-vector. Actual EMPTY stage substitutes production bootstrap and fabricates full correctly hashed stored synthetic provenance; complete NO_EFFECT assertions remain. Native outcome NOT_RUN. |
|43 core admission/money/slots/currentness/fallback/privacy assertions | Prepared | cases.mjs is byte-identical C1. All8 repaired cap/fallback denials and2 exact-cap positives retained, nested real admission before parent rollback throw, once-only conflicting receipt accounting,1536-vector and60000/60001-byte boundaries retained. Native outcome NOT_RUN. |
| Exact both-phase actual apiSpec argument/tuple equality and independent driver equality | Yes, prepared | Actual publication-contract validates object or JSON text, structurally compares full arguments and metadata, preserves per-path equality digests. Driver session recomputes independently before creating clients. Offline20 and hostile02 prove both phases, all281 registration shapes,562 hostile extra-field drifts and duplicate-path rejection, actual driver-session rejection before client/transport. Wire/platform representation NOT_RUN. |
| Full200 public×7 authorization negatives with healthyJWT and whole-state equality;81 internal;20 maintenance; protected peer | **No: public argument bundle defect** | Source guard inventory covers all200 current public paths, separate internal-inaccessible prerequisite/category implemented. Security code requires actual FORBIDDEN/UNAUTHENTICATED or validated platform auth wire. Mandatory generated governance:setPolicy arguments are semantically invalid before authentication; this blocks the complete sweep. See blocker below. Other coverage remains prepared, NOT_RUN. |
| Three real controlled parent-kill schedules with full liability/slot states | Yes, prepared | fault-recovery asserts complete attempt/operation/run/tenant money and slots after each verified kill, again after unknown recovery, and once-only known settlement. Hostile ledger corruptions are rejected in all stages. Real HTTPS0/0,1/1,1/1, durable witnesses, verified process groups and no replay retained. Native outcome NOT_RUN. |
| Exact owned retirement, including partial-create recovery; zero hostile destructive calls | Yes, prepared | Actual retire entry uses packet-root containment. Original regression executes actual retirement and management source for full/partial owned five-request flow; hostile identity cases dispatch zero destructive requests and no retirement receipt. Initial target bytes unchanged. Original C1 ReferenceError and wrong-base variant remain red. Actual management API/retirement NOT_RUN. |
| Bounded rows/RPC/peer/process/private inputs/cleanup and source-bound approval | Prepared, pending rejection repair |49 scenarios; computed2987 native≤3000,2991 client tickets+9 nested;320 simultaneously live;783 cumulative creations/deletions; zero storage; concurrency4/RPC12s/shared20min/parent24min; six groups/two outstanding/CLI120s; peer8+24; provision5/150s and retire5/180s with30s requests. Immutable UNUSED C1 operation/private path preserved, never authorizes C1 target reuse. C2 fresh PASS missing. |
| Meaningful credential-free checks with actual discovery/raw evidence and stable fingerprints | Yes, with preserved reviewer setup failures |20/20 supplied offline assertions; inventory and scoped strict fixture types exit0. Hostile02 3/3 and semantic-probe02 2/2 reproduce outcomes. All final checks have zero skips/cancelled/todo and unchanged protected source/config fingerprints. Two reviewer harness setup failures retained and explained below. |

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment |2/5 | Required exhaustive public authorization sweep is not executable with the generated arguments. |
| Code Quality |4/5 | C1 safety/control repairs are concrete, fail closed and source-bound; public argument fixture misses semantic duration validation. |
| Test Quality |3/5 |20 meaningful assertions and independent hostile checks pass; validator-shape sampling test overlooks real semantic pre-auth rejection. |
| Pattern Adherence |4/5 | Preserves immutable source, approved synthetic boundaries and honest native NOT_RUN status; parent-only credentials/target responsibilities retained. |
| Completeness |2/5 | One required security path deterministically fails before any auth observation, so complete native qualifier cannot finish. |

**Average:3.0/5.** PASS requires Requirement Fulfillment5 and every dimension≥4.

## Issues Found

### Critical (blocks preparation PASS)

1. `scripts/arguments.mjs:3` samples every string except tenantId/memorySpaceId as `<runId>-<fieldName>`. For the frozen actual validator of `governance:setPolicy`, the generated required `policy.conversations.retention.deleteAfter` becomes `admission-…-deleteAfter`. `convex-dev/governance.ts:254`/`:258`/`:267` requires duration strings to match `/^[1-9]\d*(?:s|m|h|d|w|y)$/`; `setPolicy` invokes this semantic validator at `:318` before `publicAdmin`/verified identity at `:319`.

   Independent actual bundled production handler execution proves validator shape=true, rejection=`INVALID_INPUT`, and verified identity lookups=0, with no database or service access (`semantic-probe02/stdout.txt`). The actual security driver at `scripts/driver.mjs:24` insists on `s.authDenied`, whose predicate at `:21` accepts only FORBIDDEN/UNAUTHENTICATED or exact observed platform auth envelopes. NoJWT therefore fails the sweep on this public path; skipping or counting INVALID_INPUT as authorization would weaken the requirement. `arguments.mjs:5` writes the sampled map directly, with no semantic override support.

   Fix the QA argument generator with valid controlled duration fixtures, e.g. `1d`, or explicit source-bound per-path semantic arguments, while keeping all public paths and strict actual authorization classification. Add a credential-free assertion against the actual public handler proving the supplied payload reaches identity admission; native auth remains a later gate. Freeze a new candidate preserving this rejected C2 and obtain fresh independent judgment before provisioning.

### Important (should fix)

None separate from the blocking argument-fixture issue. C1 retirement/publication/crash assertion/internal classification repairs are accepted as preparation changes.

### Minor (consider fixing)

The script-entry guards use basename suffixes (`endsWith('arguments.mjs')`), which can accidentally trigger when imported by a similarly named offline test entry. This caused a reviewer setup failure below; it does not itself grant native authorization and was not used to change the preparation score. Keep test names distinct or use exact module identity when subsequently maintaining entry guards.

## Test Coverage Analysis

| Changed boundary | Independently executed assertions | Outcome verification |
|---|---|---|
| Actual retirement entry/full/partial | Supplied offline VM full/partial/hostile/C1-red cases | Exact five methods/paths, absent404, receipt mode/status, immutable target and zero hostile destructive requests |
| Native-publication comparator | Supplied object/text, type/optional/missing/extra/malformed tests; hostile all281×both-phase | Full equality digests, drift and duplicate rejection |
| Actual driver independent publication gate | Hostile02 actual driver source in isolated VM | Same tuple drift rejects before client construction; positive phase journals equality digest |
| Complete crash state helper | Supplied killed/recovered/known corruption cases | Attempt, operation, two accounts, money, slot release and activeConcurrency |
| Internal inaccessible classifier | Supplied+independent public/unknown/validator/transport negatives | Exact published internal prerequisite; no public authorization substitution |
| Public argument preparation | Semantic-probe02 actual handler plus200-path controlled first-boundary probe | Reveals semantically invalid governance duration; validator shape alone insufficient |

## Evidence Review and reproducibility

Read AGENTS/runtime/profile/pessimistic role/judge-task/feature workflow; original prompt/goal/Tasks03/04 and architecture/decision register; C2 report/README/provenance/divergence/source/schema/registration/case budget artifacts; all26 scripts and fixture-owned controls; original frozen C1 and final REJECT2.8. Import-aware guard inventory names all200 public registrations; independently archived actual handler first-statements cover every path. Examined authority, RegistryAccess, metadata, data/action control, artifact, typed unavailable and private-maintenance boundaries. Ordinary unregistered Gateway source is excluded and never invoked.

`checks.json` records exclusive argv/cwd/UTC/pre/post fingerprints/raw outputs/exits. Provided20 assertions were unchanged except absolute import resolution and scratch redirection exclusively into this review's unique work directory. Inventory uses the same source logic, with its scratch destination moved into this review. Types compile only the scoped fixture with noEmit. Independent VM/handler probes are synthetic local execution; none certify real platform/OCC/auth/management/API outcomes. Clean check environments contain PATH/LANG/NO_COLOR only; no environment files, credentials, signatures or existing keys were read. Only the two authorized new review/work trees were written. No product/fixture/existing QA/test/Git/service/network/target/paid/model mutation or invocation occurred.

Failure preservation: hostile01 retained exit1 because the reviewer VM lacked a synthetic `process` object; hostile02 adds `process:{argv:[]}` and passes all3 tests. Semantic-arguments01 retained exit1 because the reviewer test basename matched the imported generator's entry suffix; its guard stopped on ENOENT at the nonexistent private scratch directory before any private file read or credential access. Semantic-probe02 changes only the reviewer entry filename and passes2 tests, reproducing the blocker. No previous result was overwritten. A preliminary read-only rg used an absent Convex apiSpec wildcard and exited2; read-probe-failure.txt preserves it. Subsequent official local CLI source paths were located and inspected. These are reviewer setup/read failures, not candidate native failures and not erased success evidence.

Source-fingerprint-authority.json binds the complete protected source/config/C1/C2/test/accepted-gate pre/post hashes and check results; review-manifest.json recursively freezes every review file except itself. Review hashes are returned to the parent independently.

## Recommendation and prerequisites

Prepare a replacement QA-only candidate correcting semantic public arguments; retain full original coverage, auth classifiers, ceiling calculations, original C1/C2 failures and current accepted product fingerprints. Obtain fresh independent preparation PASS on that candidate's exact digest before creating any target. Then parent alone supplies existing-key match, signed identities, owned native-format absent IDs/zero storage, exact private peer/config and fresh owned target, official codegen and actual both-phase publication, all native outcomes, verified process terminality, cleanup and physical retirement. No mocked preparation result qualifies paid/provider framing/terminal cost/SDK/production bootstrap trust or full Task04/03.
