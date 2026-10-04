# Task Judgment: Existing Task05 consumed-contract preparation

## Verdict: PASS_DESIGN_ONLY

Fresh independent pessimistic review of the existing two-file preparation, not implementation, replanning or whole Task05 acceptance. Requirement fulfillment 5/5; all scored preparation dimensions at least 4; average 4.4/5. No concrete impossible installed-source contract or silently omitted original05 requirement was established.

User implementation authorization persists. Historical preparation report line3 saying “unauthorized in this bounded assignment” describes that earlier assignment only; it cannot override the implementation prompt. Task04 actual native gate remains FAIL; terminal-capture implementation is held; Task05 product cannot start before independently accepted prerequisites. This review changes no historical packet, product, current gate or settled decision. Whole05/native component/currentness/concurrency/runtime/UI remain NOT_RUN;03-final/full goal remain incomplete.

## Evidence Review

Read repository AGENTS, CODEX-RUNTIME, PROJECT-PROFILE, pessimistic-judge and judge-task criteria; original implementation prompt, authoritative decisions, architecture/goal and05 plus mapped03/06/07/08/09 criteria. Reviewed frozen01 contracts/atomic-save and gap fixture, accepted03-foundation C11, current PURE/model policy and B16 native budget helper, and accepted unwired Gateway helper contracts. Scope applies the rubric to preparation truthfulness/coverage, not nonexistent prospective implementation fields.

`source-hash-verification.json` independently verifies 55/55 source SHA256 AND byte sizes, zero mismatches, and the report self-hash. Historical packet contains exactly report.md (25650 bytes, SHA256 `48f03e99e0cc3e4dd12899303b675178ba4f4299475adafb23c42417116ee476`) and source-evidence.json (11313 bytes, SHA256 `96f20cfe00f161410c6102c5ddce73cffd10e8712a2b67e26a8d34b800b639f9`). Post verification repeats all55 without mutation. Additional current source hashes and numbered raw context include resolved package dist as well as src. This is installed byte/API inspection, never a pristine registry or native runtime assertion.

Root Agent export resolves dist/vercel/index.js and re-exports the typed save helper. Resolved dist and cited src agree for save/addMessages, update patch, delete result, list/cutoff behavior. `saveMessages` returns all saved documents, accepts mutation/action context, serializes messages, and invokes component.messages.addMessages. Numeric order restrictions and separate prompt/pending anchors are present. Source-only evidence supports these callable shapes, not parent atomicity in the current product.

`component/messages.ts:537–583` allows message/fileIds/status/error/model/provider/providerOptions/finishReason and preserves native message ID; it recalculates text/tool and manages files, but only failed status removes embeddings. The preparation does not invent immutable edits or built-in Cortex revision fencing. `:92–111` ignores missing delete IDs and returns removed IDs, releases references and aborts associated streams; bounded64 range deletion requires continuation. `:51–53` omits only parentMessageId/stepId/files, so DTO allowlisting and top-level reasoning stripping are necessary, correctly recorded. Native get-by-ID nulls, asc/desc paging, status changes and all-message reconciliation are explicitly covered.

Frozen01 fixture runtime.ts:94–102 composes explicit save plus one receipt and forced rollback;:107–118 is only newest100/first assistant. Existing preparation lines11/58/75/78 explicitly reject using that spike as production cursor proof and require every eligible native message/part, pending holes, deletion/revision handling, durable receipts and no-model reconciliation. C11 scope remains foundation safety rather than functional transcript authorization. No frozen evidence is promoted to current product proof.

## Requirements Review

“Covered” means preserved and source-compatible in preparation; every product requirement remains unimplemented/unqualified by this review.

| Original05 requirement/acceptance | Preparation coverage | Evidence |
|---|---|---|
| R1 stable mapped Cortex conversations, access/share/retention, typed authoritative adapter | Covered | report:29–38,44,60–70; one Agent store, scoped identities, DTOs, share/export projections and tombstones |
| R2 versioned executable definitions distinct from discovery; backend tools/context/memory/policy/budgets | Covered | report:7,32,48–50; definition snapshot/version and backend ownership; current policy hook integration remains future implementation |
| R3 transaction dedup/input/budget/enqueue; queue serialization/explicit branching | Covered | report:48–52,75–76; exact content collision checks, absent-conversation stable retry, atomic composition/recoverable durable intent and explicit separate threads |
| R4 separate statuses/attempts/cancel/approval/output/export/delete, admin lock, tracked append/edit/delete/invalidation | Covered | report:44–60,64–70,77–79; lock does not deny read or bypass auth; revision currentness/repair and stale completion fencing |
| A1 exact replay/conflicting reuse and concurrent deterministic queue/branch | Covered, actual NOT_RUN | report:48–52,76; no dedup access bypass or double input/accounting |
| A2 locked writes denied/read available; unlocked canonical mutation once with actor/revision and stale facts/vectors exclusion | Covered, actual NOT_RUN | report:46,54–56,77–79; native in-place edit distinguished from new source-revision transition |
| A3 recoverable crash, rebuildable projections, no private context/credentials in public records | Covered, actual NOT_RUN | report:23,50,58,60,75,78,81; durable acceptance/outbox and privacy fields |
| Mapped03 original authorization/public/internal/share/refresh/revocation criteria | Preserved | report:7,38,44–46,74,77,81; fresh registration inventory and current gates remain required |
| Mapped07/08/09 executor/context/currentness/memory/readiness/UI | Preserved | report:15,52–60,78–81; no second executor/ingestion writer, ordered receipts/tail barriers and actual later functional outcomes |
| Mapped06 additive host component/schema/custom-directory preservation | Preserved | report:29–30,38,74; additive fragment/registration, no Agent table/schema copy or host replacement |
| Original statistics, conversation/share/snapshot and A2A restoration | Preserved | report:33–35,64–70,80–81; replace unreachable arrays/memory reconstruction, scoped service identity and canonical current counts; functional original assertions cannot be weakened to zeros/unready |

Current memory repository:101–119 is immutable idempotent source creation, not update/upsert. Preparation:35/54 explicitly allocates a controlled current-revision/tombstone transition rather than claiming putSource edits. Repository:125–140 and:251–291 check exact current lineage/tombstones/receipt and owners; future revision transitions can invalidate retrieval/late commits through that same authority. Actual transitions/repair/native races remain unqualified.

## Issues Found

### Critical

None established within source-truthful preparation scope. No requirement is marked product-complete and no proposed adapter field is treated as installed.

### Important compatibility conditions already left open by the packet

1. **B16 exact caller mapping must be frozen before execution.** `runtimeModelPolicy.ts:256–301` now exports `bindTrustedBudget(ctx:Pick<MutationCtx,"db">,args:BindBudgetArgs)` where args are reference, operationKey, requestId, requestCanonical, optional paired agentId/agentVersion; returns `{runBudgetId,runAccountId}`. It creates capped run/tenant accounts with zero reserved units, matching preparation:50's no double envelope semantics. Its binding key is `["run",tenantId,memorySpaceId,principalId,operationKey,requestId]`, without a conversation column. Passing raw clientRequestId would collide across conversations. The05 adapter must canonically encode its scoped-conversation request identity in requestId, use a stable absent-conversation creation identity, compare exact canonical payload/reference before allocation, and retain returned ledger runBudgetId separately from Cortex run row IDs. This is compatible with preparation:48–50's coordinated scoped dedup and explicit future signature freeze; it is not proof that the adapter exists. Exact authorization-reference replay rules also remain relevant.
2. **Executable definition reader is a required composition seam.** Current `readTrustedAgentPolicyVersion` at173–208 is the bounded compiled/stored foundation reader, not05 executable definitions. Its comment explicitly requires05's CURRENT owned immutable version lookup and narrowed policies in the same native db context. Preparation's definition/policy snapshot ownership covers this obligation; current selectors/registry metadata cannot become authority. No claim of present implementation is accepted.
3. **Agent cutoff is order-wide, not step-exact.** Installed `messages.ts:755–780` treats upToAndIncludingMessageId as an order cutoff and includes all same-order messages; a missing anchor produces no cutoff. A future adapter cannot assume this option alone excludes later same-order tool/assistant parts or survives deleted anchors. Preparation:52 explicitly requires qualifying context cutoff mechanics before choosing execution, and:78 covers deleted cursor targets. An actual adapter needs current anchor validation plus exact allowed native IDs/positions/revision and cannot silently widen context. No new product policy is chosen here.
4. **Gateway remains unwired.** Current `GatewayBinding` carries returned runBudgetId and stable child semanticId/ordinal, not a public row as authority. Governed helper accepts trusted ledger plus required durable capture-only sink and lifecycle owner; capture+accounting cannot be wired into that port without the separately reviewed attach ordering. Current factory preliminary resolution is unbounded by entered helper lifecycle. Preparation creates no Gateway caller, sink or model loop and correctly leaves07 execution/full04 gates pending. Actual trust root remains empty/fail-closed; helper source compatibility is not native acceptance.

### Minor

Preparation line3 reflects earlier authorization timing. Preserve it as historical provenance; this report supplies the current authorized-but-prerequisite-blocked interpretation. No authorization request or historical rewrite is warranted.

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement fulfillment |5/5|All original05 rows and mapped criteria preserved; no product completion invented |
| Contract quality |4/5|Installed src/dist shapes accurately stated; exact B16 caller mapping and cutoff semantics remain freeze conditions |
| Evidence quality |4/5|55/55 hashes/self-hash verified twice, resolved-dist raw context; no native or semantic behavior inferred |
| Pattern adherence |5/5|Independent judge, scoped writes, preserved packet/history, same store/auth/additive component design |
| Preparation completeness |4/5|Consumed contracts and necessary later qualification stated; exact integration adapters and tests remain future work |

**Average:4.4/5.** Test quality is N/A for read-only design review. Evidence quality replaces test scoring only for this bounded preparation judgment.

## Checks and Preservation

Credential-free source introspection exits0; its exact argv/cwd/start/end/raw stdout/stderr and inert script are preserved. No product test suite, discovery, service, target, credentials, network, env, Git, signing, models or UI was invoked. Native component/currentness/concurrency/runtime/UI are NOT_RUN; test skips are N/A because no tests were executed. No inert mocked probe was necessary to establish callable source shape; none is mislabeled runtime proof.

Interactive reads remain in the session tool transcript. `read-discovery-notes.json` preserves early missing shorthand paths and the nonexistent guessed B16 report path as reviewer discovery errors; neither ran behavior or changed product. Recorded filesystem paths correct to the goal qa tree and actual accepted admission C2 report. Raw retained context/introspection receipts and pre/post hashes are the durable evidence packet; no retrospective timestamps or full shell-output capture are fabricated.

Historical two-file packet and all55 sources are unchanged pre/post. `evidence-manifest.json` recursively hashes every review file other than itself and every unique scratch file; its own digest is returned separately. This design verdict does not alter any existing task/current gate or grant permission to start05 while04 prerequisites fail.
