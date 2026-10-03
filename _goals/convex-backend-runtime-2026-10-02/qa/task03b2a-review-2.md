# Task Judgment: Task03B2A metadata closure — Cycle 2

## Verdict: NEEDS FIXES

**Average: 3.4/5.** This is a final completed second-cycle judgment of the frozen candidate at isolated HEAD `2edd9435a545ecf0f1e3315fe7ae37c22c7b0623`, frozen `2026-10-03T10:43:25.190192+00:00`. It does not supersede or relabel the first cycle's final REJECT. No security or transaction defect reproduced in the repaired behavior. Two bounded integration/validation issues prevent PASS: actual backend ES2021 compilation fails, and an ordinary test rewrites canonical retained QA artifacts.

The applicable judge-task rubric requires Requirement Fulfillment=5 and every dimension>=4 for PASS. Scope is the original 41 registrations in immutable12/mutable11/users8/sessions10, with 36 guarded public APIs and five internal maintenance paths. Whole Task03, service transport, MF integration and the whole goal remain outside this verdict.

## Requirements Review

| Bounded requirement | Met? | Evidence |
|---|---|---|
| Original inventory and modern public availability: exactly41=36 public+5 internal; no public reference credentials; no unreviewed MF/D dependency | Yes | Independent import-aware AST and native installed Convex registrations match the exact frozen03A paths; zero unresolved exports. Modules import owned metadata helper, frozen03A authority and generated server only. `catalog/public-path-inventory.json`, `framework-registration.json`. |
| Verified exact issuer/subject, trusted tenant/optional space, canonical owner before list/count/search hydration and limits; labels cannot mint identity | Yes | Actual-handler missing-identity and forged-tenant cases for all36 public paths, omitted/ambiguous selector cases, exact scope/owner collection instrumentation across eight query families. `extra-probes.json`; retained handler outcome tests. |
| Own profiles use immutable operator metadataUserId binding; generic immutable type=user has same restrictions | Yes | New/existing Bob profile writes return safe receipts under own READ; users.get denies; own candidates exclude Bob before collect; explicit tenant/space access retains allowed cross-principal behavior. `known-probes.log`, `boundary-probes.json`, `handlers.test.ts`. |
| Full independent READ eligibility before new/existing target writes; initially unavailable/ineligible READ gives safe receipt; admitted late READ/WRITE failure throws and rolls back | Yes |19 original independent outcomes replay correctly.52 additional late READ/WRITE expiry/revocation cases across13 mutation shapes preserve row/control snapshots and reject with attempted effects rolled back. Six new/existing ineligible/expired initial READ cases return safe receipts. `boundary-probes.json`. |
| Every bulk key unique; missing/foreign-owner conflicts and complete transaction validation before ANY write | Yes |20 later-conflict bulk probes across five bulk handlers, including own, foreign, missing-owner and tombstoned duplicates, have zero attempted writes. Eight later transaction failure cases also have zero attempts. `boundary-probes.json`, `extra-probes.json`; retained15 bulk regressions. |
| Internal maintenance pins exact stored canonical ref, owner, trusted user, tenant and optional space; current grant/tombstone/revocation checks | Yes |15 malformed binding probes with broad space grant reject with zero attempts;15 post-effect grant/principal/membership/scope/resource fence cases reject and roll back. Actual broad-space matching creator positives retained. `boundary-probes.json`, `extra-probes.json`. |
| Active session state/deadline checked after last pre-effect await and after effect/final authority checks | Yes | Independent probes first measure normal grant-read counts and then advance the clock at the last pre-effect and last final control await for create, touch and both counters. Pre-effect expiry has0 attempts; final expiry has1 attempted effect and0 committed writes. `boundary-probes.json`. |
| Null numeric operands explicitly INVALID_INPUT, omitted defaults one; safe current version and next-overflow validation | Yes | Exact archived null probe now throws INVALID_INPUT. Independent null/string/NaN/Infinity increment/decrement cases have0 attempts. Canonical version0,-1,1.5,NaN,Infinity,MAX_SAFE_INTEGER and overflow deny before writes; MAX_SAFE_INTEGER-1 increments exactly once. `known-numeric.log`, `boundary-probes.json`. |
| Retained typed/control tombstones, no resurrection; internal operator purge preserves authority/config/fences | Yes | Owned current handlers retain rows/fences; retained resurrection assertions and independent all-control preservation probes for both operator purges pass. `extra-probes.json`; existing outcome tests. |
| Collision-safe JSON-array source IDs for future MF bridge without changing MF source now | Yes | Independent arbitrary colon/quote/backslash/unicode keys round-trip and remain distinct for immutable, mutable and sessions. Separate canonical tenant/space fields preserved. Source-key bridge explicitly pending. `boundary-probes.json`, current contracts. |
| Meaningful regression tests, discovery, scoped strict types, lint, exact AST/native wiring | Partially |189 tests/two suites/0 skipped pass; original139 handler assertions are a byte-identical prefix. ES2022-scoped backend/test types and lint pass. Actual scoped ES2021 AND full `convex-dev/tsconfig.json` compilation both fail on exactly two new Array.at calls. Test has retained-catalog write side effect. |
| Frozen candidate/source/check/report/contract and historical evidence preserved; honest root/service limits | Yes, with execution caveat below |137 hash/verification assertions pass:9 source hashes,14 current check hashes,69 original archive records, frozen03A/auth baseline, exact report/contracts/receipts freeze and all245 snapshotted files unchanged. Full-root retains exactly5 introduced downstream SDK consumer errors; virtual reviewed HEAD has0 diagnostics. `verification.json`. |

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment |3/5|Repaired authorization/atomicity/lifecycle requirements meet observed outcomes; actual backend compilation and nonmutating ordinary test execution remain incomplete.|
| Code Quality |4/5|Scoped implementation has explicit capability/ref/lifecycle checks and preflight; no behavioral defect found after independent probes. Two Array.at uses need a minimal compatibility repair.|
| Test Quality |3/5|189 meaningful tests with retained assertions plus151 independent boundary probes pass, but ordinary registration test mutates retained catalog and QA config masks actual backend compiler errors.|
| Pattern Adherence |4/5|Generic frozen03A authority, exact composite indexes, Convex registrations and retained tombstone patterns observed; no pending MF/D helper dependency.|
| Completeness |3/5|Exact41-path wiring verified; actual backend source cannot pass its declared ES2021 compiler gate yet. Root SDK/service gates honestly remain deferred.|

**Average: 3.4/5.** No auto-fail security/transaction trigger reproduced in this cycle. PASS is blocked by the two important issues below.

## Issues Found

### Critical

None reproduced in repaired authorization, privacy, bulk preflight, reference binding or deadline/rollback behavior under the independent actual-handler fixtures. This is bounded offline evidence, not a live-service security certification.

### Important — blocks PASS

1. **Actual ES2021 backend compilation fails on two source expressions.** `convex-dev/immutable.ts:55` and `convex-dev/users.ts:27` use `.at(-1)`. The backend's real `convex-dev/tsconfig.json` declares `lib:["ES2021","dom"]`. Candidate QA `tsconfig.backend.json:6` overrides that declaration to ES2022, so its green result does not establish compatibility with the actual backend compiler. Independently observed exit2 with TS2550 at both locations in `types-actual-es2021.log` and `full-backend-es2021.log`. Repair by selecting the final filtered version using ordinary indexed array access, preserving `null` for no immutable match and `undefined` before users' existing null mapping. Do not change host/backend library declarations just to mask these errors. Retain unchanged timestamp/history result assertions and run both actual backend and scoped typechecks.

2. **Ordinary registration test rewrites canonical retained QA catalog.** `tests/unit/runtimeMetadataAuth/registrations.test.ts:22` runs retained `inventory.mjs` without its supported output-path argument and then reads the retained catalog at line23. The runner defaults to canonical `qa/task03b2a/catalog` and writes its JSON/Markdown at `inventory.mjs:226` and `:228`, including current source hashes. A normal test run therefore rewrites review evidence and can alter its bytes after integration or another approved source change. Use an owned OS temporary directory passed to inventory, read the result from that directory and remove it in `finally`. Keep original exact41-path,36-public/5-internal,zero-unresolved and frozen03A correspondence assertions. No weakening of coverage is necessary.

### Minor

No additional source changes are recommended in this cycle.

## Evidence and Execution Notes

Evidence root: `/workspace/Project-Cortex/work/backend-runtime/task03b2a-judge-cycle2/`.

- `commands.json` contains argv/cwd/UTC receipts for14 initial independent checks. Raw outputs are separate `.log` files.
- `known-probes.log`, `known-additional.log`, `known-numeric.log` replay the unchanged archived first-review scripts against current actual handlers. The unchanged numeric script terminates with exit1 because the newly correct INVALID_INPUT exception is uncaught in that old exploit probe; independent assertions verify denial/zero effects separately.
- `boundary-probes.mjs`/`.json` contain118 outcome probes, and `extra-probes.mjs`/`.json` contain33. All151 pass.
- Eight initial collection probes intentionally expected success but accidentally reused canonical keys for foreign/missing-owner fixtures, correctly encountering new conflict denial. The harness was repaired by giving those foreign fixtures distinct keys. Original script/results and explanation are retained in `extra-probes.initial.*` and `extra-probes-harness-note.txt`; assertions and candidate bytes were not changed.
- The first independent rerun of the supplied189-test suites exposed issue2 by internally invoking the retained catalog writer. Its output bytes were identical. This is a deviation from the requested no-mutating-retained-runner workflow, recorded here rather than hidden. A subsequent independent copied-test rerun redirects that one runner's output and reader to my owned evidence directory;189 tests/two suites/0 skipped pass again in `jest-readonly-results.json` and `jest-readonly.log`. Copies otherwise preserve all assertions; no candidate tests were edited.
- `verification.json` proves all245 snapshotted candidate/backend/auth/QA files remain byte-identical to initial observation, all69 original archive records match their preservation manifest, frozen source/check/report/contracts hashes match, and frozen03A/auth source agrees with reviewed HEAD. The current schema/users source agrees with the first-cycle archived candidate. Final hash validation repeated after all probes.
- `full-root-types.log` has exactly the same five introduced SDK consumer errors as cycle1: sessions:421 cannot use internal expireIdle through public API; users:218-221 assumes hydrated fields on a safe write receipt union. Its bytes match the original retained cycle1 log. `baseline-diagnostics.json` has0 virtual reviewed HEAD diagnostics. No full-root PASS, pre-existing-failure relabel or SDK repair is claimed.

## Recommendations

Archive this final second-cycle source/QA/evidence unchanged. A bounded third repair may replace the two Array.at expressions with semantics-preserving ES2021 indexing, place ordinary registration-test inventory output in an OS temporary directory with finally cleanup, and run actual backend/scoped compilation plus retained behavior/registration checks. Preserve every original assertion and retained review artifact. Freeze the resulting third candidate and obtain the final allowed independent judgment cycle. Do not integrate this frozen second candidate as PASS.

No deployment, codegen, build/package generation, live mutation, paid inference, model call, MF/D source edit, staging, commit or push was performed. Fixtures call native registered handlers with a transaction-snapshot fake database and trusted control records; actual JWT verification, subscriptions, private bytes, callbacks and service revocation/delivery behavior require later managed-service gates. The bounded41-path judgment does not close whole Task03 or the overall17-task goal.
