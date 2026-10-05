# Frozen C ordinary helper API

No new Convex registrations, generated API refs, public routes or browser exports.

- createGovernedGatewayModel(composition,binding) -> Promise<{model:LanguageModelV4|EmbeddingModelV4,lifecycle}>; installed official constructor only, required capture-only sink before resolve.
- governGatewayLanguageModel(model,composition,binding,resolution) -> {model:LanguageModelV4,lifecycle}; backend-owned native fixture/composition seam; only convexGateway.chat/exact requested model/plain-Chat proof.
- governGatewayEmbeddingModel(model,composition,binding,resolution) -> {model:EmbeddingModelV4,lifecycle}; only convexGateway.embedding/default fixed profile/single-value proof.
- conservativeUsdDecimal(unknown) -> plain bounded outward decimal|undefined.
- GatewayDispatchError exposes typed code, fixed sanitized message.

GatewayBinding exactly {reference:RuntimeAuthorityReference,operationKey:ModelOperationKey,runBudgetId:string,semanticId:string,ordinal:number,source?:{sourceId,sourceEventId,sourceRevision,contentHash},parentOperationId?:Id<runtimeModelOperations>}. Semantic/ordinal are backend-owned stable child identity; repeated hooks never advance them.

GatewayLedgerPort consumes actual B resolve({reference,operationKey,runBudgetId,source?}), admit(binding+requestCanonical flat), checkpoint({reference,attemptId,requestCanonical flat}), markVisible({reference,attemptId,outputVisible,toolInputVisible,toolResultVisible,toolEffectCommitted}), settle({reference,attemptId,receiptCanonical}). Results are the strict typed declarations in runtimeGateway.ts. resolve arguments explicitly project only its actual native fields. ensureBudget/setup/provision/recover/operator/fallback/cancel are not exposed as model-dispatch authority; owning callers bind budgets and handle those distinct actual B routes.

DurableTerminalEvidenceSink.capture({attemptId,dispatchIdentity,receiptCanonical charge-only}) -> Promise<{evidenceId:string}> is backend code composition ONLY. FIRST SLICE CAPTURE ONLY: required durable sanitized persistence/dedup; MUST NOT change attempt accounting/slot/visibility/result state before returning. No native capture-only registration is installed. Terminal order capture -> pending-state markVisible -> ordinary settle -> eligible delivery. A future atomic capture+accounting RPC requires a reviewed port/order change to capture -> current-authority attachTerminalResult; it cannot satisfy this sink by structural return compatibility alone.

Lifecycle exposes owned signal,cancel(),complete(),retryPendingTerminalEvidence()->Promise<boolean>,consumeReplay()->Promise<{text}|{profile,vectors}|undefined>. Action owner awaits complete. Observer cancellation does not abort owned reader. Retry method persists only one retained sanitized receipt and cannot restart inference/delivery/admin settlement; its memory is not a durable outbox. Replay is a narrow governed consumer disposition, not a fabricated native SDK result.

Model doGenerate/doStream/doEmbed hooks deny replay/inflight/uncertain and all unsupported native features before closure/service token. No production caller or high-level helper is wired. Production qualification root remains empty. B receipt enums/shapes/storage limits remain unchanged.
