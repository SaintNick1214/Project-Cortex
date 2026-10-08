# Task04 admission/accounting consumed-contract preparation

Status: PREPARATION_COMPLETE; product implementation and verification NOT_RUN.
Whole Task04, full03-final and goal remain incomplete. This report concretizes Packet B;
it grants no new scope, policy exception or acceptance waiver. User execution is authorized
and numerical cycle caps alone are waived. Production implementation remains blocked
for this agent until parent follow-up after fresh independent pure-candidate acceptance.

## Authority and inspected dependencies

Applied AGENTS, CODEX-RUNTIME, PROJECT-PROFILE and implementation-executor; approved
implementation prompt, decision register, architecture §6, goal/all17 task allocation,
Task04, frozen Task01 contracts, and existing implementation-packets A–D. Exact source
fingerprints are in `source-evidence.json` (42 rows, including each task).
Foundation report SHA256 is
`1a932577bb99317891942d44f80756b9270d086f1cbc0c6ad45f8416c28fb274`:
FINAL PASS4.6 accepts03-foundation, actual current matrix, owned cleanup and physical
retirement. Its accepted259 registrations are historical foundation evidence; every new
registration needs fresh inventory/publication/current-reference negatives.

Current concrete pure exports inspected, still pending acceptance:
`MODEL_OPERATION_KEYS`, `MODEL_OPERATION_REGISTRY`, `DEFAULT_CHAT_MODEL_ID`,
`MODEL_LIMIT_KEYS`, `resolveModelPolicy`, `canonicalModelJson`, `validateModelRequest`,
`createModelRequestIdentity`, `assertModelRequestIdentity`, `canFallbackModel`; associated
`TrustedModelPolicyRecord`, `TrustedModelQualification`, `TrustedModelPolicyContext`,
`ModelPolicySnapshotV1`, `ModelCallRequest`, `ValidatedModelRequest`,
`ModelRequestIdentity`, `QualifiedModelCostBound`, `ModelFallbackEvidence`.
Do not copy/reimplement the resolver. Persist exactly compatible explicit validators.
Policy scope is deployment/tenant/agent with optional operation specialization; Packet B's
fourth literal scopeKind=operation must be adapted to this actual schema, not invented.

`recheckAuthority(ctx, reference, requirement)` reloads trusted control tables and checks
versions/expiry/tombstones/one-active grant generation. Reuse it inside each native
transaction; a previously returned authority object is not current authorization.
`memoryScope(reference)` requires concrete space/epoch. `ConvexMemoryRepository.getSource`
rechecks source scope/owner/tombstone; compare its entire lineage, normalized content hash,
revision and current source document to the pinned operation before dispatch/reuse/commit.
Source lookup and admission must share the same mutation snapshot, not separate action queries.

Pure request canonicalization binds normalized ordered role/part text, tool-call/result IDs,
arguments, schemas/options, prompt/version/profile and snapshot. Digests are lookup aids;
`assertModelRequestIdentity` demands both exact canonical string and hash equality. Current
`reservationUnits` and `inputTokens` remain semantic validation inputs, not cost/token proof.
The ledger supplies reservationUnits from trusted qualification; final Gateway supplies
independently established actual-input bound. Receipt IDs do not establish actual pricing.

## Exact next bounded file ownership (proposal only)

| File | Change after explicit follow-up |
| --- | --- |
| `convex-dev/runtimePolicySchema.ts` | New explicit policy/qualification/account/operation/attempt validators and five additive tables below |
| `convex-dev/schema.ts` | Import/spread runtimePolicyTables only; preserve existing26 tables,173normal+8search/vector index configurations; rederive actual schema metadata before/after |
| `convex-dev/runtimeModelPolicy.ts` | New internal registrations and local typed transaction helpers; no provider import, public route or transcript executor |
| `tests/unit/runtime/model-policy-admission.test.ts` | Native registration/validator and deterministic accounting/currentness/fault assertions; no mock PASS claim for actual isolation |
| `_goals/convex-backend-runtime-2026-10-02/qa/task04-admission-fixture/convex/schema.ts` | Later disposable fixture composition of exact product fragment and existing authority/memory schema; owned evidence tables only |
| `_goals/convex-backend-runtime-2026-10-02/qa/task04-admission-fixture/convex/qualificationOwned.ts` | Later internal fixture setup/assertion/fault transaction helpers, no production exposure |
| `_goals/convex-backend-runtime-2026-10-02/qa/task04-admission-fixture/driver.mjs` | Later bounded nonpaid native concurrent RPC/fault driver and owned cleanup, target parent-selected |

No production/test/fixture file above was written now. This bounded slice does not edit
pure code, Gateway, memory wiring, generated bindings or tasks. Later governed adapter
ownership remains Packet C: runtimeGateway + runtimeMemory/runtimeMemoryServices and
corresponding tests. Only parent-authorized official codegen on a verified disposable
target may change `_generated/*`; handwritten FunctionReferences, if temporarily necessary,
must name real internal registrations and keep exact Args/Result types. Existing accepted
server generic ctx patterns are valid: use Pick<MutationCtx,'db'>/Pick<QueryCtx,'db'>,
Doc/Id table-specific types, not any or an invented transaction abstraction.

## Schema fragment contract

All fields use explicit v.object/union/array/literals, optional fields omitted rather than
undefined, finite nonnegative safe-integer arithmetic enforced in handlers. No v.any.
Structured policy/options/tools/output-schema payloads may use bounded canonical JSON
strings whose exact shape is parsed/validated by the pure contracts; they are not unchecked
raw passthrough. Never persist credentials, Gateway tokens or raw reasoning.

1. `runtimeModelPolicies`: policyId/version, scope (deployment/tenant/agent), optional
   tenantId/agentId/agentVersion/operationKey, canonicalPolicy string, trusted actor reference,
   createdAt, optional revokedAt, current generation marker. Immutable payload/version;
   only revocation/current pointer metadata changes. Index `by_policy_version [policyId,version]`
   and `by_scope_operation [scope,tenantId,agentId,agentVersion,operationKey]`. For every
   selected scope, bounded lookup of2 detects ambiguous current records; index is not unique.
   Overrides require a current admin actor plus exact authorized policy/change revision;
   no cross-tenant/deployment admin elevation. Deployment provisioning has no tenant-admin
   route: require explicit trusted deployment bootstrap record/provenance or fail closed.
2. `runtimeModelQualifications` (justified addition): receiptId, version, modelId,
   nativeInterface, canonicalQualification string, immutable authority/provenance record,
   priceRevision/boundRevision, optional revokedAt. Index `by_receipt_version [receiptId,version]`
   and `by_model_interface [modelId,nativeInterface]`. This is trusted stored evidence for
   complete maximumCostUnits/provenance/coversAllProviderCharges=true, caps and allowed options;
   policy receipt IDs alone cannot prove a ceiling. Complete actual-price rules or supported
   authoritative-cost extraction are separately enumerated, revisioned validated evidence,
   not inferred from token count or receiptId. Unqualified fixtures attest synthetic costs
   only; they never become Gateway price qualification. Keep mutable revocation distinct from
   immutable bound/cost payload. Select exact active qualified record or reject ambiguity.
3. `runtimeBudgetAccounts`: backend accountKey, kind tenant/run, tenantId, optional
   runBudgetId/ownerPrincipalId/memorySpaceId/reference, immutable windowId/start/end,
   USD/micro-USD, policy/version identity, limitUnits, reservedUnits, settledUnits,
   uncertainUnits, activeConcurrency/concurrencyLimit, version, blockedReason, current marker,
   optional predecessor accountId. Index `by_account_key [accountKey]` and
   `by_scope_current [tenantId,kind,runBudgetId,current]`. Typed account IDs bind attempts
   to their exact windows. Shared tenant account is common to all principals/spaces.
   Opaque runBudgetId is generated on the backend and never selected by public payload.
   Standalone request account is deduplicated from trusted scope/principal/semantic request.
4. `runtimeModelOperations`: backend operationId, reference, required capability derived
   from registered purpose, trusted scope, callerSemanticId, operationKey, run accountId,
   optional parentOperationId/source lineage/contentHash/agent version, logicalCanonical/hash,
   immutable snapshot canonical payload, qualification record/version IDs, status, optional
   private validated result canonical/reference and result retention/version metadata.
   Index `by_operation_id [operationId]` and `by_scope_semantic
   [tenantId,memorySpaceId,principalId,callerSemanticId,operationKey]`. Including purpose
   permits extraction and embedding children under one source semantic ID; child identity
   still differs by complete step/batch canonical content. Current parent account/reference
   is inherited from trusted lookup and exact same ownership/scope, never a caller claim.
5. `runtimeModelAttempts`: typed operation documentId, attemptNumber, stable childCallId,
   actualCanonical/hash, exact model/interface/profile/batch, ceilingUnits, qualification
   record/version, typed tenant/run accountIds, explicit state, checkpointAt, immutable
   dispatch/recovery identity, terminalEvidence, once-only receiptCanonical/hash/identity,
   settledCostUnits/provenance, observed usage/actualModel if supplied, conservative outcome,
   visible text/tool-input/tool-result/effect flags, timestamps, slotReleased boolean.
   Index `by_operation_child_attempt [operationDocumentId,childCallId,attemptNumber]`
   and `by_status_checkpoint [status,checkpointAt]`. Stable tuple uniqueness is transactionally
   enforced with bounded duplicate detection. Result strings/references remain bounded/private.

Use per-child accounting only, no tenant envelope preallocation: every actual low-level
call reserves the same ceiling in both run and tenant totals atomically, and is counted
once in each. Operation owns total child ceiling/spend limits; children cannot each exploit
an unlimited fresh per-operation budget. No competing run/transcript tables exist now:
run accounts are a budget seam only; Task05 later binds its canonical run admission in
one native mutation through exported typed local helper, without a second executor.

## Internal API and native transaction rules

All registrations are internal only, with explicit validators and sanitized RuntimeErrorV1.
IDs are locators; every function reloads records, checks exact scope/reference/capability,
and validates immutable stored payload/version before touching private/result/balance data.

| Registration | Exact consumed arguments/result and invariants |
| --- | --- |
| `provisionPolicy` mutation | {reference,policyCanonical,expectedCurrentVersion?,qualificationRecordIds}; require current scoped admin, immutable validated policy, authorized override provenance. Return {policyId,version}; duplicate identical write idempotent, different version payload conflicts |
| `provisionQualification` mutation | {reference,qualificationCanonical,provenanceCanonical}; current correctly scoped admin/control authorization, exact supported proof and revision validation; cannot attest arbitrary client-provided prices through a public path. Return {receiptId,version} |
| `ensureBudget` mutation | {reference,requestSemanticId,operationKey}; derive tenant/window/caps from trusted current policy and backend clock, create/return opaque request run account. Return {runBudgetId}; no caller limit/window/accountKey/parent selection |
| `resolve` query | {reference,operationKey,runBudgetId,source?}; current registered operation capability, trusted run lookup and source/parent validation, trusted current policy/qualification load. Return snapshot+record versions; action result is advisory and must be revalidated on admission |
| `admit` mutation | {reference,runBudgetId,operationKey,semanticId,childCallId,requestCanonical,source?,parentOperationId?}; exact caller locator must match inherited current trusted run/parent owner/scope. Build canonical normalized request using stored snapshot/trusted bound, ignore/reject external reserve/attempt/policy choice. Return union reserved{operationId,attemptId,snapshot}, replay{operationId,privateValidatedResult}, inflight{operationId}, uncertain{operationId,replayAllowed:false}; conflicts/errors make no partial writes |
| `checkpoint` mutation | {reference,attemptId,actualRequestCanonical}; compare exact final whitelisted request, immutable qualification and accounts, current authority/source/parent/policy/cancel fences. CAS reserved→dispatch_pending once. Return {dispatchPermit:true,attemptId,dispatchIdentity} only to winner; duplicate returns inflight/uncertain/terminal without a permit. Dispatch identity is not public/token authorization |
| `settle` mutation | {reference,attemptId,receiptCanonical}; exact attempt/model/interface/dispatch/receipt binding and supported authoritative cost proof. Current original capability permits result storage/delivery only if source/parent still current. Apply once-only accounting; duplicate equal receipt returns same settled result, conflicting receipt rejects/audits without counter change |
| `recover` mutation | {reference,attemptId,evidenceCanonical}; current scoped admin or valid originating capability, exact immutable attempt/qualified evidence. If original reference revoked, scoped admin can reconcile ledger liability only, never hydrate/deliver/cache private model result or bypass original data/source grants. No evidence means uncertain with replayAllowed:false |

Typed local helpers compose same native mutation context; action runMutation calls do not
create a transaction across multiple RPCs. Policy administrative capability alone never
permits model invocation or private cache inspection. `memory.extract`/`facts.resolve`/
`embedding.memory` require current write authority plus source rights; `embedding.query`
requires read; agent/secondary calls require current run and relevant source/artifact
capability. Internal qualification fixture cannot broaden production authority.

First admission reads accounts and checks remaining:
limitUnits - settledUnits - reservedUnits - uncertainUnits >= trusted ceiling.
Safe-add all fields and reject overflow/noninteger/negative values before writes.
Both account slot limits and operation child count/spend cap apply. Reserve increases
reservedUnits and activeConcurrency once in both accounts; rejecting either rolls back all.
Status/inflight lookups happen before new reservation. Same semantic identity after an
ordinary policy update loads admitted snapshot rather than regenerating one; emergency
revocation still fences subsequent effects. Exact logical request equality must be checked
independently of snapshot refresh so changed policy cannot turn same input into a spurious
new call or allow changed text. Current eligible result reuse requires complete canonical
identity, authority/source/parent/policy checks and available validated private result.
Missing/expired result yields explicit failure/reconciliation, never silent rebilling.

Known terminal settlement moves R reserved to actual cost C settled, releasing slot once;
from uncertain it removes R uncertain instead. If C>R, account full C, retain an audited
overrun/block latch and deny future admission; no quota clipping, refund duplication or
throw-after-writes rollback of charge. Duplicate exact receipt is checked first. Settlements
use attempt's original account/window IDs regardless of current window. If cost is missing
or malformed after possible dispatch, move reserved R to uncertain R once. Keep slot while
upstream may still run. Release slot only on qualified terminal proof or qualified enforced
upstream maximum lifetime; local abort/timeout/lease expiry alone proves neither completion
nor no-charge. Terminal with unknown money keeps uncertain liability even if slot released.

Smallest conservative window policy: do not create a successor/current window while its
predecessor has reserved/uncertain liability, active slots or unreconciled overrun. This
prevents rollover laundering uncertainty or multiplying tenant concurrency across windows.
Clock/window changes and policy edits cannot reset a blocked account. Windows are immutable
and attempts retain original IDs. Explicit scoped reconciliation can clear a demonstrated
resolved block, with immutable provenance; merely increasing limits does not erase spend.
This sacrifices availability under uncertainty, preserving Packet B requirements without
adding a new global counter table. Test rollover races and late duplicate settlement.

Precheckpoint refusal can release reserved/slot once using proved no-permit evidence.
Postcheckpoint crash even before actual network call is uncertain. No API can accept a
caller boolean 'not dispatched' to undo it. Monotone visibility/effect flags must be
persisted before observable effects. Fallback predicates are assembled from stored trusted
state, never user-supplied booleans; pinned compatible candidates require a new attempt,
prior charge accounted, current checks and no uncertain/visible/tool effects. Embedding
profile fallback remains prohibited. Confirmed rejection requires qualified provider proof
and cost accounting; generic HTTP/error-name assumptions do not qualify.

## Final Gateway dependency (separate later packet)

The action wrapper must reject every unsupported final LanguageModelV4/EmbeddingModelV4
parameter, raw headers/authorization/provider passthrough and override model/retries; dispatch
normalized messages exactly, derive full input bound including ordered tools/schemas/results
and hidden protocol overhead via qualified tokenizer or documented conservative rule. If
that bound cannot be established, deny. Qualified full-call ceiling covers all charges at
these complete caps; native Responses/Messages cannot invent Chat cost metadata. Every
actual step and every embedding batch receives stable predefined child identity and shared
accounts; maxRetries0, sequential bounded batches<=512 and smaller qualified token limits.
The native ledger proves admission atomicity only; it cannot prove exactly-once provider
execution. Checkpoint before token mint/fetch; stream start is not terminal settlement.

Actual current runtimeMemory foreground unconditionally throws readiness unavailable
inside memoryForegroundControl before the two unconfigured injections. Later wiring must
replace this control only after governed adapter is real; catch only control failures before
billable work. memoryScope/auth references stay intact. The present controlCtx.runQuery
projects every query reply as authority and is suitable only for readiness recheck, not
future arbitrary source/result queries. Existing writeDerived/source fences remain final.

## Selected verification and requirements mapping (all proposed, NOT_RUN)

| Original Task04/Packet B requirement | Meaningful evidence required |
| --- | --- |
| Trusted versioned resolution/caps | Stored policy/qualification read tests; missing/ambiguous/revoked/foreign records, unauthorized override, absent full cost bound, public claims denied; actual normalized messages/options/default profile comparison |
| Atomic run+tenant capacity | Actual native parallel distinct-child RPCs at last monetary/slot capacity: exactly permitted winners, persisted exact sums/attempt counts; shared tenants across principals/spaces and sibling parent calls; throw after each write proves full rollback |
| Canonical idempotency/replay | Actual native concurrent identical submissions create one attempt; changed text/role/toolID/schema/profile/source/parent conflicts; forced identical lookup digest but unequal canonical conflicts; current result replay yields zero extra peer dispatch |
| Once-only settlement | Wrapper/usage/recover parallel equal terminal receipts affect sums/slots once; different receipt/provenance conflicts; valid overrun fully accounted and blocks; finite/integer/overflow/rounding negatives; old-window late/duplicate settlement and rotation cannot transfer liability |
| Unknown/no replay/slots | Fault before checkpoint, after checkpoint before call, after nonpaid peer effect, after response before settlement, after stream terminal before durable receipt; observe exact durable state and external peer count. Timeout alone leaves liability/slot; qualified terminal proof can release slot but not unknown dollars |
| Current authority/source/parent | Healthy baseline plus revocation/expiry/deletion/revision between admit/checkpoint/settle/reuse/derived commit. No result delivery/recreation, charges retained. Governance admin without data/run grant cannot invoke or read result; admin-only liability recovery remains private |
| Safe fallback/every child | Stored proof gate negatives for visible text/tool input/result/effect and uncertain paid outcome; safe predispatch candidate reserves again and retains prior spend; embeddings never change profile; deterministic >512 embedding batches and actual multi-step accounting later Gateway/Task07 tests |
| Additive/internal-only | Recompute schema tables/index field lists before/after and compare all old definitions, no duplicate field index config. Import-aware registration inventory + actual apiSpec + noJWT/authenticated public denial for every new internal function; no HTTP/public alias of provision/admit/settle |

Offline tests may use native handler/validator invocation and fakes to explore error paths;
Map-backed mock transactions do not prove OCC/serializability/native rollback. Only actual
Convex native mutations on parent-qualified disposable target establish accounting concurrency.
Use controlled nonpaid HTTPS peer to prove external fault count separately; no provider/token
call is needed for this native atomic gate. Native live receipts do not establish model cost
qualification or actual Gateway selection. Parent owns target creation, credentials, official
codegen, later paid/native-interface evidence and retirement. Fixture rows owned and tracked;
cleanup verifies absence, closes observers, and preserves append-only observed outcomes.

After implementation select root affected lint/typecheck, scoped meaningful policy/admission/
authority/native-schema tests, root build/contracts for affected exports. Rebuild source
inventory/current codegen import checks. Broaden only for concrete dependency changes.
Task04 still requires real adapter wiring, model/interface/cost qualification and actual
policy-selected/no-bypass outcomes; managed default embedding+search remains before Task09.
Task05/07 owns agent/run/tool execution, Task08 ingestion, Task09/14/15 client bypass removal,
Task13 media jobs, Task16/full03-final whole matrix; all17 original task criteria remain.

## Task Completion Report

Status: COMPLETE for bounded preparation; NOT_IMPLEMENTED for admission/product.
Created only this report and source-evidence.json in allowed new QA directory.
No production/pure/test/generated/Git/network/credential/service/provider mutation occurred.
No application builds/tests/codegen/live qualification were run or claimed PASS.
Next dependent work awaits parent explicit follow-up after pure fresh PASS.
