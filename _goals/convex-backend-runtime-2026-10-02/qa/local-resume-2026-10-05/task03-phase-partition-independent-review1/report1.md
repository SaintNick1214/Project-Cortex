# Task Judgment: A4 prospective phase-partition prototype

## Verdict: REJECT — bounded CODE_CONSERVATION only

This fresh independent review found four executable conservation defects in `phase_partition2.py`. Repair them and obtain fresh independent review before adapter integration or adoption. A4's current recipe still denies closed nonuse and grants no effects. This verdict neither accepts Source nor establishes intrinsic impossibility of a faithful future partition.

## Evidence Review

Only A4 and the explicitly approved original boundary documents were inspected. A4's exact 50-basename packet consists of 48 finite members (6,530,993 bytes) plus its pin manifest and final STOP. All 48 member hashes match the stopped publication pins; the four supplied critical size/hash pairs match. Epoch2 captured both authority headers before their bodies, then every member FD before the first member body. Staged discovery is disclosed; it is not an all-FDs-before-first-header claim. Minimum A4 capture age was 1587.690107 seconds using current max(mtime,ctime). All 53 retained epoch2 rows, plus two ordinary external-bootstrap descriptors, received final full-EOF/hash/size/all-nine verification and exactly one close with zero errors. Minimum owned epoch2 capture age was 289.755936 seconds. No physical Source qualification is inferred from that review custody.

The unchanged retained author controls executed 97/97 PASS, zero failed/skipped. Their two disk-loader source lines (four AST statements) were replaced with the already captured module; no test assertion was edited. The independent harness executed 20 cases: 16 PASS, 4 FAIL, 0 skipped. One case aggregates the 97 author cases; the 19 additional checks contain 15 PASS and 4 FAIL. Thus the underlying distinct outcomes are 116 executed, 112 passed, 4 failed, 0 skipped. All actual fixture writes were confined to this review directory, and the owned fixture was removed. The 8,192-descriptor probe uses mocked descriptor operations rather than creating 8,192 host descriptors.

The first reviewer epoch stopped before controls because its loader shape assertion expected two statements instead of four. `independent_cases1.py`, its STOPs, `acquisition-failure1.json`, and `bootstrap-ordinary-raw1.json` remain unchanged. The corrected reviewer-only epoch is new. The erased unparsed PTY command, prior metadata gap, and unknown late-ctime cause are also recorded. No operative A4 pin or historical record was refreshed.

## Issues Found

### Critical — must repair before bounded code-conservation PASS

- **[P1] Shared simultaneous descriptor cap is per broker rather than per lease.** `phase_partition2.py:345-375` checks each broker's row count, while `Ledger` deduplicates unique paths and never tracks live descriptors. Two `HeldBroker` instances using one ledger and the same 4,096 admissions both open successfully, reaching 8,192 mock descriptors. `independent_cases2.py:44-67` records `secondBrokerDenied=false`, `peakOwnedDescriptors=8192`, `uniqueLedgerPaths=4096`; every fake descriptor closes once. Put reservation/release and ownership on the one shared lease/ledger, or enforce one live broker with shared handles. Do not introduce a permanent duplicate Root pool.
- **[P1] Later Source admissions do not invalidate earlier Source approval.** `phase_partition2.py:424-438` calls preflight only while entering SOURCE_APPROVED and stores no ledger-generation/graph binding. After approval, four additional 16MiB enabling debts enter that same ledger; ACTUAL1914 still advances with the old approval despite member bytes plus original reserves exceeding 64MiB. `independent_cases2.py:68-75` records `lateUnionAboveCap=true`, `actualAdvanceDenied=false`, `phase=ACTUAL1914`. Bind approval to an immutable exact ledger/graph generation and recheck freshness, conserved aggregate, and all program approvals before each original actual transition. New enabling versions must be re-admitted/reviewed in the same non-resetting ledger.
- **[P1] A changed tuple hides a Source role at the same path.** `phase_partition2.py:267-274` compares used/debt/role sets only by admission ID. A candidate custody tuple can be deferred while a distinct tuple at the identical physical path remains an actual control/read debt. `independent_cases2.py:76-80` obtains a closed mock nonuse result where the required changed-version/mixed-path denial is absent. Evaluate all versions and roles at each path before deferral; unresolved changed tuples must be charged or denied. A witness must not authorize a path that the local conserved graph still classifies as mixed/changed.

### Important — must repair with the same conservation change

- **[P2] Admitted literal-nine identity remains caller-mutable.** `phase_partition2.py:99-105` stores a shallow `dict(row)`, retaining the caller's nested `nine` object. Mutating the original input's ctime rewrites the stored admission tuple and makes `admission_id(stored_row)` differ from the stored key. `independent_cases2.py:40-43` returns `(false,false)` for preserved snapshot/key identity. Store immutable/deep snapshots of every identity field and ensure broker rows/edges cannot silently mutate the admitted identity.

These are SOURCE/MOCK contract counterexamples. The mock phase label does not start any original actual clock or cohort, and `protected_action()` continues to deny every effect. They do not demonstrate an adopted protected-action vulnerability.

## Requirements Review

| Bounded requirement | Result | Evidence |
|---|---|---|
| Exact stopped finite A4 pins, maturity, staged FD-first custody, EOF/hash/size/all-nine/final/once-close | PASS | `acquisition-raw2.json`, `bootstrap-ordinary-raw2.json` |
| No actual effect, current adapter edit, cap reset/refund API, JSON verdict authority | PASS within SOURCE/MOCK scope | 97 replay and additional negative cases; current recipe has no closed proof |
| One shared 4,096 simultaneous descriptor limit | FAIL | Two brokers reach 8,192 mock FDs |
| Immutable admission tuple and same-path changed/mixed-role conservation | FAIL | Mutable nested-nine and changed-tuple nonuse counterexamples |
| Source approval remains valid only for the exact conserved graph before actual phases | FAIL | Late Source debt admits stale approval transition |
| Original declared counts/caps/assertions and separate original actual phase order | Declarations preserved; physical acceptance PENDING | Retained module/recipe validation; no original actual execution |
| Closed current body-use/import/control graph and executable collector/G/U3/B3/Root adapters | PENDING internal work | Recipe has zero edges/approvals, five pending adapters, eight unknown inputs, one unresolved edge |

## Conservation and downstream edges

Independent arithmetic reproduces 3,185 version admissions, 3,157 known paths, 100,719,043 member bytes; original MF4MiB + approval1MiB + oneDATA2MiB reserves and known late publishers produce 108,081,724 bytes, 40,972,860 over64MiB. This conservative current-loop union does not prove intrinsic original-contract impossibility. Published recipe4 itself has 3,183 admissions including six quarantined declarations, 3,155 paths and 97,650,189 member bytes; adding its own actual body and finalization ledger yields the published known census. Recipe debt226 plus that ledger's actual use gives final known debt227; 542 historical references are distinct from actual current reads. Old F1's historical SOURCE_ONLY qualification is neither automatic current transitive debt nor a refund/exemption; its used whole header and every current enabling body remain charged.

`adapter-edge-map1.json` precisely identifies required changes: collector recipe/header admission; G exact Source MF and shared HeldSourceLease; U3 Source program approval before original1914/3828 then114/161/138/1907/CLI; B3 launcher and seven enabling inputs; RootDriver held imports, schemas, MF/approval/DATA and original guards. These are obligations, not implemented adapters or a closure witness. Generic collector/G/U3/B3/Root still require every current MF body. No frozen1907, compiler114, J5, historical, or mixed-role omission is adopted. Later closed L/Root/review publications need fresh exact admission; this review does not treat L as permanently absent. A fitting faithful partition and whole Source eligibility remain PENDING internal closure/integration/review.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 2/5 | Four declared conservation safeguards fail additional executable probes |
| Code Quality | 2/5 | Shared resource accounting, approval freshness and immutable identity are incomplete |
| Test Quality | 3/5 | 97 meaningful author cases pass, but shared/mutation/late/version interactions were missing |
| Pattern Adherence | 4/5 | Owned finite mocks, stopped artifacts, effects denied, scope and historical limits preserved |
| Completeness | 3/5 | Concrete bounded prototype exists; its reusable invariants need repair before pending adapters |

**Average: 2.8/5.** REJECT follows judge-task's any-dimension-at-most2 threshold, scoped solely to this prototype. Source/adapter/actual/full-task/goal acceptance is outside this verdict.

## Recommendation

Repair the four executable invariants without changing caps, original assertions/deadlines, phase boundaries, or historical receipts. Retain these negative cases and obtain fresh stopped/mature/held-byte independent review before operative adapter work/adoption. Complete the closed current Source use/import/control/IO/witness map, all enabling approvals and finite current L/Root/publication census in the same ledger. Large ledgers remain file-and-digest inputs; no stdin truncation, DATA exemption, graph reset, retroactive pin refresh or numerical-cycle shortcut is permitted.

No Docker, CI, network, services, private inputs, secrets, keys, targets, inference or application/module/UI checks were invoked. Full Source eligibility, foundation/full03, full04 and goal acceptance are not granted. Task03/04 functional status remains0/3 each; the declared milestone remains1/17 (bounded Task01 only,5.9%), product0%, effects0.
