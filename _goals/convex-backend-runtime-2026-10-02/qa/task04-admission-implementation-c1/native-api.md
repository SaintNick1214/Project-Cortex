# Frozen native consumption interface

Source hash authority: final-source-evidence.json. Official generated API is NOT updated here; parent must verify disposable official codegen and publication. All fourteen registrations are internal. Only the two trusted deployment-control-plane routes omit an application authority reference; neither has a public alias/proxy.

`Reference` is the existing strict runtimeAuthorityReference validator; `OperationKey` is the accepted thirteen-key registry; `AttemptId`/`ParentOperationId` are native table IDs. `Source` is exact `{sourceId,sourceEventId,sourceRevision,contentHash}`. All string JSON arguments require exact canonical JSON with <=180000 UTF8 bytes. Explicit validators are in the frozen module/schema.

| Internal registration | Exact Args | Success Result |
|---|---|---|
| ensureBudget | reference, operationKey, requestId, requestCanonical, agentId?, agentVersion? | {runBudgetId,runAccountId} |
| installDeploymentPolicy | manifestId, expectedRevision | {manifestId,revision} |
| provisionTenantPolicy | reference, policyCanonical, overrideRequested? | {policyId,version} |
| resolve | reference, operationKey, runBudgetId, source? | {snapshot,dispatchEvidence,storageLimits} |
| admit | resolve Args + semanticId, ordinal, requestCanonical, parentOperationId? | reserved:{status,operationId,attemptId,snapshot,requestCanonical}; replay:{status,operationId,resultCanonical}; uncertain:{status,operationId,attemptId,replayAllowed:false}; inflight:{status,operationId,attemptId} |
| checkpoint | reference, attemptId, requestCanonical | {dispatchPermit:true,dispatchIdentity,snapshot,requestCanonical} or {dispatchPermit:false,state,replayAllowed:false} |
| markVisible | reference, attemptId, outputVisible, toolInputVisible, toolResultVisible, toolEffectCommitted | {recorded:true} |
| settle | reference, attemptId, receiptCanonical | known:{state,settledCostUnits,resultWithheld,overrun}; repeated:{state,settledCostUnits?,resultWithheld}; unknown/terminal:{state,replayAllowed:false} |
| recover | reference, attemptId, receiptCanonical? | settlement result or {state,replayAllowed:false} |
| reconcileDeploymentLiability | attemptId, receiptCanonical | settlement result; positive canonical tenant/space retirement mandatory; no result delivery |
| releaseNotDispatched | reference, attemptId | {state:not_dispatched} |
| cancelBudget | reference, runBudgetId | {cancelled:true} |
| admitFallback | reference, attemptId, candidateModelId | reserved result or {status:inflight,attemptId} |
| checkFallback | reference, attemptId, candidateModelId | {allowed:boolean} |

Known attempt states are reserved, dispatch_pending, uncertain, settled, not_dispatched, confirmed_rejected. Failure is existing ConvexError object `{version:1,code,message,retryable:false,outcome}`; it never includes prompt/provider/private data.

Receipt JSON is strict `{version:1,dispatchIdentity,receiptId,modelId,nativeInterface,outcome:confirmed|confirmed_rejected,proof:provider-terminal-v1,costSource:gateway-aggregate-usd-v1|unavailable,aggregateCostUsd?,usage?,actualModel?,privateResultCanonical?}`. Monetary amount is nonnegative plain decimal USD (no exponent), exact upward microUSD rounding; absent/incomplete/overflowed qualified cost retains uncertain monetary liability. `usage` optionally contains safe nonnegative integer inputTokens/outputTokens/totalTokens/cachedInputTokens/reasoningTokens. Receipt identity excludes the private result, preserving exact charge/usage equality. Private result only accepted for current permitted delivery: strict `{text:string}` or `{profile:exactDefaultProfile,vectors:finite1536Vectors}`; no reasoning/provider raw parts. No receiptId alone attests price truth.

Limits: every canonical request/snapshot/binding/receipt <=180000 UTF8 bytes; inline private result <=60000 UTF8 bytes; embedding billable call <=1 normalized value with fixed 1536 profile. Native provider profile remains unchanged. Future Gateway must deterministic stable split to single-value embedding calls with each child separately admitted/charged, or separately review a bounded owned-result-reference allocation. No result-reference table is allocated now. A trusted resultBound serialization/output proof must guarantee fit before dispatch; merely checking after a paid call is insufficient.

Gateway must whitelist final low-level native parameters, derive U independently from exact qualified final normalized request, enforce M/output/retry bounds, then checkpoint that exact canonical request before mint/dispatch. K is separate trusted whole-call monetary ceiling, never client estimates or context-wide inputTokens. The narrow default Chat/embedding rule IDs are qualification candidates; production root is EMPTY. Tools/schema/Responses/image/video lack qualified operational rules and fail closed. Every batch/tool/secondary step must separately consume the ledger; policy scope coverage does not certify provider availability.

Task05 calls exported `bindTrustedBudget(ctx:Pick<MutationCtx,db>, args:BindBudgetArgs)` inside its dedup/transcript/queue parent mutation. The backend derives full tenant/space/principal/operation/request tuple account identity; exact canonical comparison protects digest collisions. The run account is opaque budget binding, not a run/transcript executor or a second tenant envelope. Agent selectors resolve through exported typed `readTrustedAgentPolicyVersion(ctx,reference,{agentId,version}):TrustedAgentPolicyVersion`; later Task05 must compose CURRENT owned immutable executable-definition/version/policy lookup in the same context, check grants/revocation/source hash, and allow scoped administrators to register/update owned definitions with policy narrowing under deployment hard bounds. Current compiled fixture agent entries are not a requirement for every future definition revision to edit deployment root. Dynamic definition tables and complete integration are deferred, explicitly unaccepted.

Deployment reconciliation is a trusted operator control-plane boundary like runtimeAuth.provision, never an application/admin route. It only consumes immutable stored attempts after positive tenant/space deletion proof, records full original-window charge/overrun once, retains unknown liability, strips private payloads, and recreates no scope/results. Future Gateway must retain terminal receipt for trusted operator reconciliation when application authority is gone; it must not expose this as public recovery.
