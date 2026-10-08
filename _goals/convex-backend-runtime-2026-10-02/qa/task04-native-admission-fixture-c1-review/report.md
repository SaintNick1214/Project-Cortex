# Task Judgment: Task04 native admission fixture C1 preparation

## Verdict: REJECT

Scope: credential-free, nonpaid native preparation only. This judgment is bound to runtime-freeze SHA256 `222473222323c6b7948fe093cf9a5d0ac987366f01aad48caa64cfe2f154afd6` and qa-manifest SHA256 `7f2c3bf55431804d865dd4feb2a283167eb051d7041a330d1f2b6af888120391`. Target creation must not proceed from this candidate. Numeric cycle limits do not confer acceptance. All native/model/paid/service results remain NOT_RUN; Task04 B, whole Task04, retained full03 and the goal remain incomplete.

## Requirements Review

| Preparation requirement | Met? | Evidence |
|---|---|---|
| Preserve accepted C2 and complete copied registered closure | Yes, offline | Independent all281 freeze/all283 manifest hashes,284 actual files, all16 accepted gates match. Ledger source matches accepted `2a499e50107e6ba0064368c6d84c5ecce596bb420114336c3a2bdb86d0be9aa8`. Inventory verification PASS;131 unchanged copies and sole bootstrap divergence. |
| Immutable synthetic trust; exact schema; EMPTY source separation | Prepared | Offline identity/cloned-root negatives pass.31 product tables/184 normal/8 search-vector and32 fixture tables preserved. Only peer table added. Empty staging copies exact production bootstrap; fabricateRoot constructs canonical complete stored rows. Native no-effect witness still NOT_RUN. |
| OCC, nested admission rollback, idempotency, money/slots/fallback/currentness/privacy | Prepared, with assertion gap |43 concrete core cases exercise meaningful outcomes, all8 repaired C2 denials and2 exact-cap positives, child parent fence,1536-vector and60000/60001-byte results. parentRollback uses real ctx.runMutation admission before deliberately throwing. Native semantics NOT_RUN. Crash liability assertions are incomplete below. |
|200 public×7 negatives; healthy JWT; full state;81 internals;20 table denials; peer | Prepared, with publication gap | Security driver requires real auth wire/category, healthy mutable set/get,400 snapshots,162 internal attempts,20 maintenance validator denials,5 peer denials. Import metadata is preparation evidence. Actual API argument equality is not enforced. Internal visibility rejection category needs native verification and should not be presumed identical to public auth denial. |
| Three actual peer crash schedules | Prepared, with assertion gap | Fault child checkpoints, optionally invokes actual HTTPS peer and reads request/effect counters; parent kills its owned group after durable markers; recovery confirms0/0,1/1,1/1 and no replay. No synthetic throw substitute. Full liability/slot balances after first two crashes are not asserted. |
| Finite rows/RPC/process/management ownership | Mostly prepared |49 scenarios;2981 computed native invocations under3000;2991 client tickets+9 allowance;783 cumulative creates/deletes,320 live rows, zero storage; global native tickets/20min qualifier;4 concurrent12s RPC; bounded children and verified terminal descendants. Source calculations and ordering are explicit. |
| Safe exact target provisioning, partial recovery and terminal retirement | **No** | Retirement has unconditional undefined variable, then wrong containment base; no target may be provisioned while its reviewed retirement path is broken. Pure management contract hostile identity tests pass, but they do not execute retirement's entry expression. |
| Frozen receipts, privacy, failure preservation, offline/type checks | Mostly |12 offline tests pass,4 additional hostile checks pass, inventory and scoped fixture TypeScript pass. No skips/cancelled/todo. Historical EEXIST and provisional ordering failures retained. Independent checkJs exposes retirement TS2304. Source/config/test path fingerprints remain unchanged. |

## Dimension Scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment |2/5 | Required retirement is unusable; publication args and crash liability assertions incomplete. |
| Code Quality |3/5 | Strong ownership and fail-closed boundaries, but an undefined name in mandatory management entrypoint escaped syntax-only checks. |
| Test Quality |3/5 | Meaningful12-case offline suite and core native assertions; omission of retirement entry, argument comparison and crash balances. |
| Pattern Adherence |4/5 | Synthetic boundary, native-not-run reporting, source freeze, no production mutation and independent gate follow repository instructions. |
| Completeness |2/5 | Required cleanup/retirement cannot complete from reviewed packet. |

**Average:2.8/5.** PASS requires requirements5 and every dimension≥4. Those thresholds are not met.

## Issues Found

### Critical (blocks preparation PASS)

1. `scripts/retire.mjs:7` references `fixture` without importing or declaring it: `canonical(resolve(root,'project-request.json'),fixture)`. After preparationReviewed succeeds, the script throws ReferenceError before reading ownership or making retirement requests. Independent exact-expression VM reproduction and checkJs TS2304 confirm this without credentials/network. Merely importing fixture still rejects QA_PATH: project-request.json is in the packet root, outside its fixture subtree. Use the packet root as containment base, and verify the exact entry/read path in a credential-free retirement harness before source-freezing a replacement candidate. This blocks both full target retirement and request-owned partial-create recovery; provisioning before correction would leave the reviewed teardown unusable.

### Important (should fix before renewed PASS)

2. `scripts/publication.mjs:6-7` records actual arguments but compares only `[path,type,visibility]`; `scripts/driver.mjs:24` repeats type/visibility checks without actual argument comparison. The report claims exact publication tuples and arguments. Independent hostile test changes actual args while retaining tuple identity and the exact current comparison still passes. Compare each actual native args validator structurally against the frozen local registration args, for both phases; retain full matching evidence. Frozen source makes accidental drift less likely but does not implement the required native proof.

3. `scripts/fault-recovery.mjs:5-7` checks state uncertain, replayAllowed false and checkpoint dispatchPermit false, but before-peer/lost-receipt branches never snapshot/assert attempt/account uncertain money or active slots. Only before-settle checks settled40/reserved0/uncertain0, and it still omits activeConcurrency. Add full attempt/run/tenant balance and slot assertions immediately after each actual crash and again after known settlement. A normal-path unknown case cannot replace outcomes at these actual parent-kill boundaries. Additional assertions must fit recomputed frozen RPC allowances.

### Minor / source-bound execution prerequisite

Internal visibility loop uses public authorization predicate for internal dispatch failures. Exact apiSpec proves internal visibility, but native inaccessible-internal wire classification must be separately observed; missing-public-function rejection must not be promoted to public authorization success. No native category is asserted by this review.

## Evidence Review and reproducibility

Read AGENTS/runtime/profile/pessimistic role/judge-task/feature workflow, original goal/prompt/tasks and retained03 sequencing, authoritative architecture/decision register, complete candidate report/README, frozen inventories, all23 scripts, fixture controls/manifest/schema/bootstrap/peer,43-case matrix, and failure/preflight history. Machine verification reads every frozen artifact and accepted source hash. Ordinary unregistered runtimeGateway is excluded and never invoked.

Independent checks are archived in checks.json with argv/cwd/UTC/raw exits. `offline-review.mjs.text` is the exact supplied offline harness with absolute imports and its scratch destination moved exclusively into this review work tree; assertions unchanged.12 discovered/12 pass/0 skipped. `hostile-review.mjs.text` adds four assertions reproducing retirement failures, argument-comparison acceptance gap and rejected management identities;4/4 pass. Inventory --verify and scoped fixture tsc each exit0. CheckJs exit2 is an investigative check, not a claim that JavaScript scripts are part of the passing scoped fixture TypeScript build; its other implicit-any/Buffer diagnostics are not used as independent blockers.

Fingerprints encompass candidate, production convex-dev/src, runtime test paths, root package/lock/config before and after checks; all preserved. The first hostile invocation existed only in the tool transcript; a second exclusive archived invocation was recorded to make reproduction reviewable, with no prior result erased. Setup/static reads used no services, credentials, signatures, targets, environment files, model APIs or Git mutations. Only the authorized new review and unique work directories were written. Synthetic hostile management inputs contain no credentials. Reproduction scratch is archived; no prior QA/test/product files were edited.

## Recommendation and prerequisites

Prepare a new source-bound candidate correcting mandatory retirement and the two assertion gaps. Preserve this rejected freeze, failure receipts and original packet. Recompute budgets and obtain fresh independent preparation PASS on the new digest before target creation. Parent must then independently supply exact current scoped identities/native-format absent locators, private key-match/config/owned target files, official deployment/codegen/API publication for synthetic and exact EMPTY phases, observed complete outcomes and verified cleanup/physical retirement. JWT/key matching, official APIs, native rollback/OCC/auth and actual peer requests remain NOT_RUN. Paid provider framing, terminal cost, SDK dispatch, production trust and full functional03 remain separate later gates.
