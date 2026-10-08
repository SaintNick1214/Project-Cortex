# Task Judgment: Task03A authorization foundation

Verdict: **NEEDS FIXES**. Fresh read-only `/root/task03a_review`,2026-10-03.
One authoritative inventory correction; no bounded helper security blocker.
Whole03 remains pending03B endpoint closure and03C client/transport negatives.

Reviewed instructions/profile/role/rubric, original03 task, decisions/architecture,
Task01 contracts,03A implementation/contracts/inventory/handoff/tests/runners/logs.
Independent observations: exact AST inventory recomputation,251calls/251exports,
240public/11internal/0unresolved/0HTTP routes,22 matching source hashes; both scoped
strict configs,ESLint,whitespace passed;2suites/55tests/0skipped passed with cache
disabled. Every referenced original raw log exists and records exit0. Inventory
correctly recommends198guard/42internalize without claiming closure implemented.

| Bounded requirement | Outcome | Evidence |
|---|---|---|
| Complete configured-directory AST inventory | Met | Exact recomputation and22 matching source hashes. |
| Correct frozen per-path capability/scope/ownership/background rules | Partial | Eight new runtimeAuth internal registrations use incorrect genericwrite labels. |
| Exact verified issuer/subject via ctx.auth | Met | runtimeAuth.ts:133,211; actual adapter assertions. |
| Claims/IDs/metadata never provision privileges | Met | Trusted control tables only; forged/no-selfprovision cases. |
| Bootstrap/lifecycle internal-only | Met | Eight internal builders; provisioning.test visibility assertions. |
| Idempotent provision/immutable grant generations | Met | runtimeAuth.ts:291; IDs/versions/revocation/oldref assertions. |
| No revival of deletedprincipal/revokedmembership/deletedscope | Met | runtimeAuth.ts:237,271,283; actual lifecycle handler tests. |
| Unambiguous trusted scope or fail closed | Met | runtimeAuth.ts:157; scope/duplicategrant cases. |
| Explicit capability/noadminwildcard | Met | runtimeAuth.ts:99; read/tool/storage denials. |
| Own/space/tenant resource scope; unscoped denied | Met | runtimeAuth.ts:65; foreignowner/crossspace/missingowner. |
| Exact versions/epochs pinned | Met | runtimeAuth.ts:116; forged/stale refs. |
| Background cannot change pinnedspace including absence | Met | runtimeAuth.ts:120; tenantwide admission test. |
| Revocation/deletion/expiry/tombstones | Met | Shared materialization/currentness and lifecycle tests. |
| Trusted immutable metadata binding | Met | runtimeAuth.ts:271; rebind denied/table ID normalization. |
| Canonical backend resource descriptor | Contract | Actual endpoint selection adapters03B. |
| Unlock/revision/share/storage/tool/callback rules | Contract | Explicit later05/12/13 ownership. |
| Additive host preservation | Met | Only schema import/spread; auth/HTTP untouched. |
| Honest scope/evidence | Met | No endpoint closure/live/subscription/private byte/callback claim. |

| Dimension | Score |
|---|---:|
| Requirement Fulfillment | 3/5 |
| Code Quality | 4/5 |
| Test Quality | 4/5 |
| Pattern Adherence | 4/5 |
| Completeness | 4/5 |

Average **3.8/5**. No critical bounded helper finding or separate minor action.

Important correction: reproduction/inventory.mjs:134 uses generic module/builder
heuristics. JSON:7523/7548 incorrectly requires write for authorize/recheck,
whose capability is requirement.capability; authorize consumes inherited verified
identity, recheck exact trusted storedreference. JSON:7590/7614/7638/7662/7694/7724
mislabels six internal provisioning/revocation/deletion/tombstone controls aswrite
and tenant/space ownership. These require trusted deployment-operator internal
invocation, not a publicJWTadmin/tenantwrite/owner/current backgroundgrant (which
may be revoked). Ownership/background fields repeat this mismatch, contradicting
contracts.md and real handlers. Frozen authoritative downstream input must be
correct before use.

Add explicit policies in both retainedrunner copies, regenerate JSON/MD and refresh
affected receipts. Dynamic capability/verifiedidentity or exactbackgroundref must
be distinct from operator control. No helper implementation change required.
Existing public functions remain unprotected until03B; no downstream PASS implied.
