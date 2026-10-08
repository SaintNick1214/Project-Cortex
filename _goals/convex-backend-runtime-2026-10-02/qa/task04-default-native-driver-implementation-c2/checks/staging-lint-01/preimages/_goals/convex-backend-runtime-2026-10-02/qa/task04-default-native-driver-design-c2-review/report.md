# Independent task judgment: default native driver design C2

## FINAL: NEEDS_FIXES — DESIGN ONLY

The revision substantially repairs C1: exact receipt/state types, a closed EMPTY proof resolver, source-aware native observers, a concrete managed1536 repository, and inaccessible atomic staging are now specified. Two remaining contract conflicts require an executor to invent authority exceptions or persisted identity fields. This is a repairable prose-design verdict, not rejection of observed production behavior. No driver implementation/native/paid/managed/production/fulltask acceptance follows.

## Evidence review

Applied AGENTS, CODEX-RUNTIME, PROJECT-PROFILE, pessimistic-judge, judge-task and feature-orchestrator, with the delegated explicit design threshold (five dimensions >=4 and average >=4). Read approved implementation prompt/goal/Tasks04/08/09/14, research decisions/architecture, C1 review and the C2 proposal, all four normative contracts and check plan. Inspected official token/constructor, compatible Chat stream flush and embedding raw-body/minimal-schema sources, v4 type pins, and Gateway conservativeUsdDecimal. Initial large combined output was truncated; decisive contracts/source sections were reread. Every subject and source-reference byte was independently read and hashed; that integrity operation alone does not imply semantic execution coverage.

Subject report SHA256 a939795057bc298a6a9a0ed121f211fe3b5eb9301af5dda6427a371e22ae50bc and qa-manifest SHA256 f1313f6c1f68953ba2e1a5301c7dc1425c2fba428de2b66662cc27a56df22bfb match. Exact101-row recursive set, all byte counts/hashes and sole self-exclusion verified. All50 distinct source-matrix references match current bytes; full subject/lineage and reference preimages copied into this review. Missing original failure UTC remains unchanged. Static-parsed subject Python scripts; never invoked original builder/finalizer. Ran only a copied inspected pure illustrative model with own output bindings:25 groups PASS, explicitly a schema/algebra subset. Four independent in-memory integrity adversaries reject missing/extra/duplicate/changed-hash evidence. Exact14 accepted selected identity fields,13 native hashes, conditional K314310microUSD and execution ORDER C01–C08,E11–E14,C09,C10 verified independently. These are design/integrity checks, not provider/native/service outcomes.

## Requirements review

| Requirement / original finding | Assessment | Evidence |
|---|---|---|
| Strict actual-v2 receipt/state/parser, null/zero, graph/bytes, exact bindings/categories, union/refinement/STOP | Substantially repaired | receipt-state.md:3–end gives required keys/types/crossfields, descriptor-first canonical limits, immutable facts, independent max2 upgrades and parser order. Malformed/collision accounting distinctions are explicit. |
| Closed lifetime/serving/money APIs and source predicates | Repaired for finite design scope | observer-proofs.md defines official inputs/returns, raw/native generation, ordered streams, fabricated flush unknown, embedding missing-ID/model unknown, finite compiled proof types and EMPTY resolver. Proof currentness/historical accounting, complete drift/cache/routing/rejected/cancelled categories and conservative exact conversion remain independent. No actual proof invented. |
| Managed owned grant/source/chunk/vector/schema/index1536/write/search/read/delete/currentness | Mostly repaired; destructive-lifecycle exception missing | managed-fixture.md:5–59 defines schema, finite methods, allowlist, atomic fences, E11 key, E12/E13 no-write and E14 actual vectorSearch plus hydrate. Its universal fence conflicts with delete/revocation cleanup, Issue2. |
| C09/C10 inaccessible first eligible persisted staging, durable atomic control, response loss/noeligible/late/pending reader | Mostly repaired; replay identity and precedence unresolved | staging-trigger.md:5–46 defines eligibility, closure and atomic effects; Stage schema/replay cannot compare all promised part identity and rejects self-revoked authority, Issue1. Honest C09 prevents later C10 consequence is explicit. |
| Minor deduplicated embedding/raw/v4 source pins | Repaired | source-matrix contains50 unique current paths including embedding implementation/options/raw schema and provider v4 types. |
| Official model-only native factory/token after reserve/checkpoint/current-enter; absolute phase ownership | Preserved as normative requirements | proposal:7–11; observer sources support official boundaries; total lifecycle deadlines, pending/late ownership and no replay retained. Not run. |
| Exact14 identities/order/U/M/K, no15th/reset/regrant/replay/renewal/substitution, uncapped known original-account liabilities | Preserved | exact identities verification; proposal and receipt capture algebra retain uncertainty/STOP, independent slot/charge and no money clipping. $10/28 remain engineering controls, not permission caps. |
| Fresh-disposable execution/no-cap authorization, numeric review caps alone waived | Preserved | proposal:3; no renewed human authorization required to repair design. |
| Production EMPTY root versus experiment bootstrap and separately accepted fixture-root/Gateway | Preserved | proposal:13; observer final section distinguishes conditional hypothesis currentness from actual qualification. No fake production qualification/second production ledger. |
| All13 operations, original Task04/08/09/14/all17/fullcore acceptance, prior rejection lineage | Retained and incomplete | proposal/report/check-plan and full copied lineage preserve independent gates. Current c827/e796 offline4.4 is not three changed-source native capsule acceptance. |
| Meaningful checks with honest scope and failure closure | Good plan, incomplete remaining adverse specification | check-plan has concrete liabilities/writes/authority outcomes; copied25 illustrative checks do not implement staging/repository transactions and cannot resolve Issues1–2. |

## Issues found

### Critical to design PASS — finite contract repairs required

1. **Stage replay lacks stored part identity and a valid post-trigger replay branch.** staging-trigger.md:8–10 accepts partSequence/rawPartDigest, :17 defines stageHash as digest of only `{text}`, and :23 promises exact row/stage/part-hash replay. managed-fixture.md:25–27 stores neither partSequence nor rawPartDigest, nor an alternative digest binding them. Two distinct eligible deltas with the same text have identical stageCanonical/stageHash and cannot be distinguished by the prescribed stored row. Freeze a full immutable stage identity (including sequence, raw-part digest and dispatch binding) in the row or a precisely defined hash and compare it on replay; a changed part must collision0writes even when text is equal.

   The required ordering also conflicts: staging-trigger.md:19 requires current grant/owner and no prior trigger through the managed fence before effect; :23/:37 require exact replay0writes after committed C09 response loss. C09 itself changes grant.active=false, increments epoch and sets account.revoked; C10 sets cancelled. managed-fixture.md:49 rejects those facts. Specify an explicit immutable historical replay lookup/comparison before fresh-effect/current-delivery checks, with no private text response or reopening; then specify how differing replay returns collision and genuinely new late part is denied. Do not simply relax currentness for insertion. A lost C09 acknowledgment must be recoverable without reset/regrant/new native request. inspectTrigger's query authority/shape must be compatible with this closed-account recovery.

2. **Universal live-authority fence blocks destructive cleanup and has no finite denial/replay contract.** managed-fixture.md:49 applies active grant, exact old epochs, !tombstone and !revoked/cancelled/stopped/closed to EVERY mutation/query. :55 says deleteOwned rereads that same fence and establishes durable tombstones/closure, and describes revocation. Following the normal first unknown receipt, STOP/closed is already latched; following C09 the grant is inactive/epoch changed. The stated delete path therefore cannot tombstone the owned source/chunk/vector after either event. A repeated successful delete also fails because source epochs/tombstones changed. Its signature at :44 returns only `{tombstoned:true}`, while :55 requires wrong-scope/stale denial0writes, leaving denial/exception/idempotency behavior untyped. A separate root cleanup/evidence method is mentioned at :47, but has no finite API or authority contract and still says current authority.

   Define separate operation-specific fences: live inference/read/write/search authority versus root/operator-owned destructive lifecycle and closed-account evidence recovery. Root deletion must preserve exact owned scope/operator/target checks, permit closure/revocation without inferring read/delivery authority, bound/hash evidence before physical removal and preserve account liability/tombstones. Freeze delete/revoke/evidence-recovery inputs/returns and already-tombstoned/revoked/stale/wrong-owner outcomes, including atomic repeated0writes and retained unknown-active/known/reserved. This is a deterministic contract repair; actual services may remain NOT_RUN.

### Important

Add independent planned adversaries for same text with changed sequence/raw digest, exact C09/C10 persistence replay after self-closure, owned delete after unknown STOP/revocation, repeated delete and wrong-owner closed-account cleanup. The present illustrative stage check copies a preconstructed dictionary; it does not prove the row can enforce those distinctions. Its disclosed limited scope is truthful and is not itself an auto-fail.

### Minor

No new source-matrix duplication or missing embedding/type pin found. Account storage-version terminology should be clarified if implementation intends a custom revision field: AccountV2 declares format version2 while capture prose mentions incrementing storage version. Convex row OCC may supply concurrency without a custom counter; freeze which meaning future write-count assertions use.

## Dimension scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment | 4/5 | Four original areas substantially addressed; staged replay and destructive lifecycle need operation-specific exceptions. |
| Code Quality / design viability | 3/5 | Strict schemas/proof resolver improved; executor must currently invent persisted part identity and fence ordering. |
| Test Quality / check plan | 4/5 | Concrete adverse outcomes and honest subset scope; add the identified replay/cleanup counterexamples. |
| Pattern Adherence | 4/5 | Official native boundaries, independent accounting/lifetime, immutable liability, EMPTY root and bounded owned scope preserved. |
| Completeness for design | 3/5 | Remaining API return/authority branch contradictions prevent a finite consistent implementation. |

**Average:3.6/5. FINAL NEEDS_FIXES — DESIGN ONLY.** No security/execution auto-REJECT is inferred from this noninstalled prose-only packet. All dimensions must reach4 before PASS_DESIGN_ONLY.

## Recommendation

Create a new immutable repair revision specifying the full stage identity and historical replay ordering plus separate closed-account destructive/recovery APIs, with the adverse outcome table above. Preserve this failed review and all prior lineage/failures. Obtain a fresh independent design review before implementation/native gates. No actual provider/managed proof is required to specify those deterministic contracts; actual lifetime/serving/wholeUSD/modelrevision/decoder/managed positives remain UNKNOWN/NOT_RUN until their own evidence gates. No broader original-task completion or paid readiness follows from this judgment.
