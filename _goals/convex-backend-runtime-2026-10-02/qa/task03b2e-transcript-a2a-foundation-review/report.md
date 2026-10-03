# Task Judgment: Transcript/A2A bounded48 safety closure, cycle1

## Verdict: REJECT

Fresh independent read-only task review, 2026-10-03. This judgment applies only to the original48 transcript/A2A safety closure. It does not accept original Task03 functional behavior, currentguard live qualification, aggregate03-foundation or Task04. The required all-five-scores>=4 and average>=4 threshold is not met; the confidentiality finding independently blocks PASS.

## Critical finding

`convex-dev/runtimeUnavailableAuth.ts:17–30` turns caller-selected source tombstone presence into a distinguishable public error before establishing source ownership. `RegistryAccess.open` establishes current scope/capability, but own-only space access does not establish permission to learn another principal's source deletion state. `runtimeAuthSchema.ts:59–62` tombstones have tenant/space/type/ID/deletedAt and no owner. The helper queries both scoped and tenant-wide source keys, then changes readiness to FORBIDDEN solely when that record exists.

Fresh actual native `conversations.get` probes use the same own-only principal, grant, tenant, concrete space and foreign conversation ID. Absent tombstone returns the fixed CAPABILITY_NOT_READY/not_dispatched envelope. Adding only the matching trusted conversation tombstone returns FORBIDDEN/not_dispatched. Both scoped `space-a` and tenant-wide keys produce this difference. No private table read or write is needed to exploit it. Receipt: `work/resume/transcript-safety-review/probes-oracle.txt` (330 tests:328 pass,2 fail). Scratch tests assert complete envelope equality, preserving the required confidentiality expectation rather than changing it to the implementation's outcome.

This violates accepted sequencing plan line54: authorized unavailable routes must "never distinguish private foreign data presence." Source labels are caller-controlled; a trusted control table does not make every resource-key lookup authorized. Source tombstones must eventually fence actual authorized functional operations, but an always-rejecting closure cannot read, write, dispatch or resurrect the source. Their deletion-state lookup adds disclosure with no safety necessity during this unavailable stage.

## Requirements review

| Requirement | Met? | Evidence |
|---|---|---|
| All48 paths guarded before private hydration/count/content/effects | Yes for rejection ordering | All48 first statements are unconditional awaited guards;837 native cases,328 fresh probes; no private query/get/write/scheduler/storage/run effects observed |
|41 public use actual current query READ/mutation WRITE in concrete trusted space | Yes | All public registrations, native wrong-capability/tenant/space/ambiguity/tenant-only cases; shared RegistryAccess authority and reference fencing |
|7 baseline operator paths internalized with no public aliases | Yes | purgeAll, incrementViewCount and five factHistory operators; native flags and import-aware catalog |
| Uniform readiness independent of unauthorized private source presence | **No** | Scoped and tenant-wide foreign tombstone oracle above |
| Unknown identity/control errors opaque, including exact FORBIDDEN disguise and diagnostics | Yes within reviewed boundary | Native fault matrix and fresh zero-getter assertions; guarded low-level control reads normalize failures |
| Current membership/grant/epochs/expiry/scope deletion and late authority fences | Yes offline | Native initial/late generation cases; fresh late membership version/revocation, grant revocation/expiry, tenant epoch and space deletion on41 public paths |
| Exact original validators/bodies and inferred legacy shapes retained behind never-resolving helper | Yes bounded | Native/AST validator checks; independent first-guard/body AST comparison; scoped TypeScript PASS; runtimeUnavailable/internalUnavailable are Promise<never> with no resolving branch or handler enclosing catch |
| No second writer/ownerless adoption | Yes | Always-rejected old bodies; no data reads/writes or schema adoption added |
| Original functional access/locks/revisions/shares/A2A/derived repair remain pending | Yes | Executor report/frozen manifest and accepted sequencing preserve05/07/08 and03-final obligations |
| Services/aggregate gates not falsely accepted | Yes | No services invoked by judge; live currentguard and aggregate foundation remain pending before04 |

## Dimension scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment |2/5|Uniform private-presence confidentiality fails a required safety condition |
| Code Quality |3/5|Awaited non-resolving guard and opaque errors are sound, but caller-source lookup is not bounded by resource authority |
| Test Quality |3/5|837 outcome tests are meaningful; source-deletion tests expect FORBIDDEN without differentiating owned and inaccessible source controls, missing the oracle |
| Pattern Adherence |4/5|Native registration/validators, shared accepted authority/fence protocol and internalization follow patterns; dead-body technique remains temporary |
| Completeness |4/5|All48 registrations wired and checks pass; current global inventory drift is attributable to separate asset work and explicitly reported |

**Average:3.2/5.** Verdict REJECT. No criterion has been weakened or relabeled complete.

## Independent evidence and preservation

Read AGENTS, runtime/profile, pessimistic-judge, judge-task, feature-orchestrator, original Task03, decisions, Task01 frozen contracts, revised sequencing contract and PASS4.6 review, candidate implementation/test/report/manifest/positivecontrols/original sources and shared authority dependencies. All seven candidate SHA256 values match the executor's exact freeze. All five original sources match both frozen hashes and `git show HEAD` byte-for-byte. Independent AST checks verify all48 old body statement sequences remain byte-identical after the first unconditional await; original validators remain unchanged, with only absent optional tenant/space selectors added. No new public aliases are present. Initial root typecheck failure history is preserved; separate SDK history client repair is not certified here.

Replayed commands (all in `/workspace/Project-Cortex`):

- Native suite using `work/resume/transcript-closure/jest.config.mjs`:837/837 PASS, no skips. Fresh generated48 positive controls exactly equal frozen controls.
- Scoped backend/tests TypeScript configuration: exit0.
- ESLint on the six backend files and native suite: exit0.
- Import-aware current inventory:259 registrations,200 public,59 internal,0 unresolved; bounded48 rows exactly match the transcript freeze.
- `git diff --check` on bounded product/test paths: exit0.
- Fresh adversarial scratch suite initially328/328 PASS. Added two foreign-source confidentiality equality probes:328/330 PASS,2 FAIL as detailed above. No assertion was weakened.

Frozen transcript catalog historically records259/206public/53internal. Concurrent separately bounded asset17 edits internalized six more registrations, yielding the observed259/200public/59internal. Historical evidence is not rewritten. The aggregate coordinator must refresh fingerprints/current catalog and judge the actual combined source; neither global count is a transcript-only defect. `work/resume/transcript-safety-review/verification.json` records historical/current counts and exact bounded48 matching. `history.json` records original-vs-HEAD preservation. Source/hash/receipt changes require fresh affected checks and review.

## Other risks and required next actions

1. Remove source-ID tombstone lookups while these capabilities are uniformly unavailable, preserving exact current principal/membership/grant/capability/scope/epoch/expiry/tombstone authority rechecks. Alternatively provide a trusted resource authorization design that cannot reveal inaccessible ownership/existence/deletion; do not hydrate legacy private sources to establish it. Functional05/07/08 adapters still require authorized source tombstones and revisions before real reads/effects/commits. Repair tests must distinguish necessary authority deletion from inaccessible source deletion rather than dropping source-currentness requirements.
2. Rerun native/types/lint/catalog, preserve this rejected history, freeze repaired source, and obtain a fresh independent review. No Task04 advancement from this closure.
3. The old unsafe bodies remain compile-time shape scaffolding. They must never resolve, bypass or catch the guard. Their removal/replacement requires05 canonical Agent ownership/share/lock/revision contracts and07/08 source invalidation/repair. Unsupported endpoints are unavailable, not completed features. Local CAPABILITY_NOT_READY remains subject to accepted Task01 modern facade normalization to CAPABILITY_UNAVAILABLE.
4. Assets17 and SDK removal of newly internal API dispatch are separate active changes. Original Agent direct access, default locks/trusted unlock, revisions/redaction/A2A and actual stale-derived repair, live currentguard outcomes and aggregate03-final/16/17 gates remain required.

Only this review directory and `work/resume/transcript-safety-review` were written. No product/test/service changes, deployments, commits or child agents were used.
