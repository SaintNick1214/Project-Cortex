# Task04 bounded contract preparation

Status: PREPARATION_COMPLETE. Product: NOT_IMPLEMENTED. Tests, codegen, services,
inference, signing, independent Task04 review: NOT_RUN. Foundation: fresh aggregate
03-foundation PASS remains required before any product implementation. No UI dependency
applies to this preparation. This packet concretizes the accepted Task04 architecture;
it does not change goal dependencies, add an acceptance waiver, or supersede frozen
Task01 contracts. User superseded numeric review cycle limits, not acceptance gates.

Source fingerprint receipt: `source-evidence.json`. Read-only inspection used installed
Agent 0.7.3, Gateway 0.2.1, AI SDK 7.0.127 and their provider v4 declarations. Root
branch was `feat/convex-backend-runtime`; HEAD was
`8c418538ab67b263b17b4b0ac613847d314d5ecb`. Refresh these sources and the registration
ledger after the live foundation gate; snapshots do not certify later changes.

## Packet A — pure operation and policy contracts

Suggested bounded production ownership after PASS:

| Exact file | Concrete change |
| --- | --- |
| `src/domain/model-policy.ts` (new) | Pure operation registry, immutable policy/snapshot types, deterministic resolver, strict request/options validation, compatible fallback predicate; no credentials or provider constructors |
| `src/domain/index.ts` | Export backend-friendly pure policy contracts consistently with existing domain modules |
| `convex-dev/runtimePolicySchema.ts` (new) | Additive policy, account, operation and attempt fragments described below |
| `convex-dev/schema.ts` | Import/spread new fragment; preserve all existing host/schema fields |
| `convex-dev/runtimeModelPolicy.ts` (new) | Trusted policy resolution/provisioning, admission, dispatch checkpoint, once-only settlement and recovery internal queries/mutations |
| `convex-dev/runtimeGateway.ts` (new) | Action-only governed Gateway constructors/wrappers and MemoryModel adapter; no browser export |
| `convex-dev/runtimeMemory.ts` | Replace the two `unconfiguredMemoryModel()` injection sites with scoped governed adapter; retain existing verified read/write authority and source checks |
| `convex-dev/runtimeMemoryServices.ts` | Retain pure domain behavior; use operation-result reuse before paid dispatch, expose currentness checks needed by adapter; remove readiness stub only when governed implementation is wired |
| `convex-dev/_generated/api.d.ts` | Generated new module registrations only through authorized codegen; never hand-edit generated APIs |
| `tests/unit/domain/model-policy.test.ts` (new) | Policy precedence/capability/profile/fallback assertions |
| `tests/unit/runtime/model-policy-admission.test.ts` (new) | Transaction/idempotency/settlement/uncertainty/concurrency outcome assertions |
| Task04 isolated disposable qualification fixture + goal `qa/task04/` | Later observed Gateway/atomic/live receipts; exact fixture path selected by executor without broad host deployment |

`src/config.ts` is an inspected legacy client configuration, not trusted runtime policy.
Do not grant its arbitrary per-call/env overrides runtime model authority. No package
upgrade is necessary: the root manifest already pins all four qualified components
and AI SDK. Task05 owns run/transcript tables; Task04 owns an internal budget account
with an opaque trusted run budget identity for Task05 to bind atomically at admission.
Do not create a competing transcript/run execution implementation in Task04.

Registered operation taxonomy:

| Key | Native interface and invariant |
| --- | --- |
| `agent.respond` | Qualified Chat default; Responses only explicit qualified capability; each model step gets a distinct child call identity |
| `memory.extract` | Chat structured `Output.object({schema})`; pinned attributed extraction prompt/schema version |
| `facts.resolve` | Chat structured conflict decision; validate against `src/domain/conflicts.ts`, not arbitrary free text |
| `memory.summarize` | Text; scoped cutoff/prompt version |
| `conversation.title` | Text; no private context through title output |
| `artifact.text`, `artifact.code`, `artifact.sheet` | Separate registered operations; each update/generation call charged to the same owning run when present |
| `artifact.suggestions` | Separate suggestions operation; register template suggestions generation tool through this key; its GET endpoint observes persisted suggestions |
| `embedding.query`, `embedding.memory` | Immutable registered profile; every provider batch is a separately admitted child call |
| `media.image.generate`, `media.video.generate` | Registered now, explicitly unavailable until respective service/capability gates; submission/unknown job cost never hidden |

Unregistered purposes fail `POLICY_DENIED` before constructor invocation/dispatch.
Additional future inference needs a registry entry and its own capability qualification;
`evaluationModel`/Decisions is excluded. Image/video registration is no claim of media
service readiness. Separate model IDs for different functions require later actual
qualified model receipts: the existing spike qualifies `openai/gpt-4o-mini`, not an
arbitrary second model. Distinct configured policies can be offline tested immediately,
but that alone cannot certify distinct actual allowed-model inference.

Trusted precedence: deployment defaults → tenant rules → immutable agent-version rules
→ operation specialization at those scopes. Resolve scalar choices deterministically;
intersect allowlists/capability/options constraints and take tighter limits by default.
An explicit trusted administrator override is a versioned policy record with actor,
change revision and override authorization; no public model/tenant/admin claim grants
it. Policy admin does not imply data/read/run capability (foundation authority rule).
Higher-precedence ordinary policies cannot broaden hard deployment bounds. Tenant,
agent, operation and admin references are read server-side; absence/ambiguity/invalid
records fail closed. Public configuration writes, if introduced later, must add exact
current registration/live guard evidence. Internal-only provisioning is the smallest
Task04 implementation; do not expose an unauthenticated bootstrap/configuration path.

Snapshot includes operation key, requested and resolved qualified model, native
interface, allowed options and output/context/tool-step/time limits, tool registry
version, prompt/schema/extraction versions, semantic profile, price/bound revision,
all effective policy versions, explicit fallback candidates, trusted scoped authority
reference and parent/source identities. Retry pins these; source semantic
`policyVersion` in MemoryModel is not a trusted policy selector. Emergency revocation,
allowlist removal and tombstones are checked currently before every later effect/commit.
Ordinary policy updates cannot silently mutate an admitted snapshot.

## Packet B — additive schema and atomic accounting

Concrete table fragment (names are new; field validators use existing
`runtimeAuthorityReference`, explicit v.union states, finite/safe-integer validation):

- `runtimeModelPolicies`: policyId, version, scopeKind(deployment/tenant/agent/operation),
  trusted tenantId/agentId/agentVersion/operationKey where applicable, immutable canonical
  policy payload, actorPrincipalId/createdAt, optional revokedAt. Index
  `by_policy_version [policyId,version]` and `by_scope_operation
  [scopeKind,tenantId,agentId,agentVersion,operationKey]`. Resolve singleton/current
  generation explicitly; Convex indexes do not impose uniqueness.
- `runtimeBudgetAccounts`: accountKey, kind(tenant/run), tenantId, optional runBudgetId,
  immutable budget-window identity/start/end, currency/unit, limitUnits, reservedUnits,
  settledUnits, uncertainUnits, activeConcurrency, concurrencyLimit, version.
  Index `by_account_key [accountKey]`. Integer micro-units with overflow/finite checks,
  conservative rounding and versioned price inputs; never binary dollar accumulation.
  Keep account windows referenced by attempts; late settlement must not charge a new
  window or release an old reservation into it.
- `runtimeModelOperations`: operationId (backend ledger ID), trusted principal/tenant/
  space, reference, callerSemanticId, operationKey, runBudgetId/parentOperationId when
  present, source event/revision, canonical logical request + hash, pinned snapshot,
  status, private validated result/reference and retention/currentness metadata.
  Index `by_scope_semantic [tenantId,memorySpaceId,principalId,callerSemanticId]`;
  canonical equality is required even if a digest matches. Replay cannot expose
  provider raw request/headers/private reasoning or another scope's results.
- `runtimeModelAttempts`: operationId, attemptNumber, stable childCallId (step or batch),
  canonical actual provider request + hash, resolved model/interface/profile,
  reservationUnits, tenant/run account IDs, status, dispatchCheckpointAt,
  settlementIdentity, observed usage/cost/price provenance, actualModel if supplied,
  outcome/sanitized error, timestamps, effect/output-visible flags and durable recovery
  identity. Index `by_operation_child_attempt
  [operationId,childCallId,attemptNumber]` and `by_status_checkpoint
  [status,dispatchCheckpointAt]`. Unique tuple enforced transactionally, not assumed.

Represent parent allocations and actual call reservations without counting twice:
run account tracks cumulative spent/reserved across all its child calls; each actual
child reserves atomically against both tenant and run remaining limits. If admission
preallocates a run envelope at tenant level, child calls draw from that envelope rather
than reserving the same dollars at tenant level again. Pick and test one accounting
mode; a parent envelope is optional, per-child aggregate enforcement is mandatory.
Standalone explicit remember/recall calls use a backend-created bounded request account,
not a caller-selected fake run ID. Child operations inherit parent account/scope/pinned
policy versions through trusted lookup. Caller-supplied parent IDs cannot choose a
larger quota or omit tenant accounting.

Admission mutation: authenticate or recheck stored reference; verify source/parent
currentness and operation permission; resolve or load pinned policy; compute canonical
request; atomically lookup same semantic identity; return same current eligible stored
result/inflight/uncertain outcome, reject changed request `IDEMPOTENCY_CONFLICT`; validate
rate/bounds/options/profile; check all account capacities/concurrency; create operation
and attempt and increment reservations/activeConcurrency in one transaction. Failed
admission writes no partial balance, cannot mint token and cannot dispatch. Canonical
request includes normalized texts/parts, exact source revision, schema/prompt identity,
model/interface/profile, permitted provider options, tool definitions/version and
step/batch boundaries. Hashes are lookups, canonical equality resolves collisions.

Lifecycle:

| Transition | Accounting/effect contract |
| --- | --- |
| new → reserved | Atomically reserve run + tenant maximum expected bounded cost and operation limits; no external call |
| reserved → dispatch_pending | Separate mutation checks current auth/source/policy/cancel and compare state; persists durable checkpoint before invoking provider |
| reserved → rejected/not_dispatched | Proven pre-provider refusal releases reservation/slot once; no paid fallback needed |
| dispatch_pending → settled/confirmed | Valid terminal receipt with stable settlementIdentity moves reserved to settled once; decrements slot once; preserve actual usage/model/cost when provided |
| dispatch_pending → confirmed_rejected | Explicit qualified provider response establishes rejection; cost handled from evidence, not blindly assumed zero |
| dispatch_pending → uncertain | Lost response/process crash/cancel after possible dispatch, malformed/missing cost receipt or lost settlement retains conservative monetary liability; replayAllowed false |
| uncertain → reconciled confirmed | Reliable provider/job receipt settles original attempt atomically; cannot allocate a fresh attempt to disguise recovery |

A checkpoint precedes token mint as well as network dispatch. Therefore a process crash
between checkpoint and provider may conservatively become uncertain even without an
actual charge. This is honest; don't claim exactly-once external inference. Recovery
cannot infer no-dispatch from lease expiry or exception names. Reservations with proof
that dispatch never started may expire/release; dispatched unknown liability cannot.
Concurrency is separate from liability: uncertain work keeps a slot while upstream
may run; release after terminal evidence or a qualified enforced maximum upstream
lifetime. A local timeout alone proves neither provider completion nor zero charge.
Use an explicit blocked/reconciliation state rather than silently resetting unknown
slots/money on cron or policy changes. Administrative reconciliation records provenance.

Known usage settlement requires authoritative cost or a complete supported price rule.
Gateway Chat exposes `providerMetadata.convexGateway.cost`/`costDetails`; native
Responses/Messages constructors lack this Chat metadata extractor. Token counts are
not universal dollar costs (reasoning/cache/media may differ). Missing or invalid price
knowledge fails admission or retains conservative unknown monetary liability; never
invent zero cost. Reservation with output/input caps requires a documented conservative
cost bound and price revision. Usage above reserve is an audited overrun, accounted
fully and blocks additional admission; prevent it through qualified bounds where
possible, without relabeling spend as within quota. Tenant deployment kill switch
is independent operational protection, not an application budget substitute.

## Packet C — installed qualified API boundary and execution adapter

Inspected exact source/declaration locations:

- Gateway `node_modules/@convex-dev/ai-sdk-provider/src/index.ts`: `gatewayFetch`
  obtains `getServiceToken("ai-gateway")` and then calls `globalThis.fetch`. That fetch
  is private; public factory accepts modelId only. Constructing `convexGateway(id)`
  does not itself mint a token. Never globally monkey-patch fetch or handcraft a
  direct-provider credential path to implement admission.
- `convexGateway(id)` is Chat; `.responses(id)` explicit Responses; `.messages(id)`
  Messages; `.embeddingModel(id)`, `.imageModel(id)`, `.videoModel(id)` are distinct.
  Task01 qualifies Chat + Responses and structured `Output.object`, not Messages,
  managed embeddings or alpha media. Provider-qualified IDs remain exact; any native
  SDK prefix transformations occur inside provider internals, not in policy identity.
- AI SDK `node_modules/ai/dist/index.d.ts:9365` exports
  `wrapLanguageModel({model,middleware,modelId?,providerId?}): LanguageModelV4`.
  `:9385` exports analogous `wrapEmbeddingModel(...): EmbeddingModelV4`;
  `:9405` exports `wrapImageModel(...): ImageModelV4`. Provider v4 middleware signatures
  below are from installed declarations, not speculative Gateway options.

```ts
// node_modules/@ai-sdk/provider/dist/index.d.ts:3387+
specificationVersion: "v4";
transformParams?: (o: {
  type: "generate" | "stream";
  params: LanguageModelV4CallOptions; model: LanguageModelV4;
}) => PromiseLike<LanguageModelV4CallOptions>;
wrapGenerate?: (o: {
  doGenerate: () => PromiseLike<LanguageModelV4GenerateResult>;
  doStream: () => PromiseLike<LanguageModelV4StreamResult>;
  params: LanguageModelV4CallOptions; model: LanguageModelV4;
}) => PromiseLike<LanguageModelV4GenerateResult>;
wrapStream?: (o: {
  doGenerate: () => PromiseLike<LanguageModelV4GenerateResult>;
  doStream: () => PromiseLike<LanguageModelV4StreamResult>;
  params: LanguageModelV4CallOptions; model: LanguageModelV4;
}) => PromiseLike<LanguageModelV4StreamResult>;

// node_modules/@ai-sdk/provider/dist/index.d.ts:5430+
wrapEmbed?: (o: {
  doEmbed: () => ReturnType<EmbeddingModelV4["doEmbed"]>;
  params: EmbeddingModelV4CallOptions; model: EmbeddingModelV4;
}) => Promise<Awaited<ReturnType<EmbeddingModelV4["doEmbed"]>>>;
// Also available: overrideMaxEmbeddingsPerCall and overrideSupportsParallelCalls.
```

Use a wrapper bound to the trusted ledger context. Validate final params in the outer
wrapper, admit/checkpoint, then call exactly its own `doGenerate`, `doStream` or
`doEmbed`. Reject attempts to replace model, inject raw authorization headers or
unsupported options via Agent per-call overrides or prepareStep. For streaming,
`doStream()` resolution is connection initiation, not terminal completion. Transform
and observe the returned stream through terminal finish/usage and abort/error paths;
persist once-only settlement after actual terminal receipt. A dropped action before
receipt is uncertain and durable recovery owns it. Do not settle using the initial
`doStream()` return alone or wait only on a client-owned promise.

Agent public root export is `src/vercel/index.ts`/`dist/vercel/index.d.ts`, not the
nonexistent `src/client/index.ts`. Config has `languageModel`, optional `embeddingModel`,
`callSettings`, `usageHandler`, context/storage options and maxSteps. Its
`src/vercel/client/start.ts:425` calls usageHandler after saving model output;
`streamText.ts:213` invokes caller prepareStep before subsequent step; `search.ts:488`
calls embedMany for Agent context embedding. Thus usageHandler is supplementary audit,
not admission; prepareStep can help assign deterministic step identity but the governed
model wrapper must remain the final dispatch boundary. Keep `maxRetries:0` in Agent
callSettings and each generate/stream/embed call; Workflow action `retry:false` and
`retryActionsByDefault:false`. Reject override routes that enable retries.

Do not enable optional Agent automatic RAG/embedding as a second Cortex semantic writer.
If any Agent embedding is required, register its purpose explicitly and inject only a
governed embedding model; it must not infer outside policy or silently mix profiles.
Task07 integrates actual Agent streaming/tool steps. Task04 provides the controlled
model constructor seam plus step accounting assertions; it does not certify future
Task07 wiring merely by constructing an unused wrapper.

Gateway `.embeddingModel` overrides maxEmbeddingsPerCall to 512. Installed AI SDK
`src/embed/embed-many.ts` splits requests by model limits and can run batches in parallel;
default maxRetries is 2. Simplest deterministic adapter explicitly partitions texts
into stable bounded ordered batches, sets `maxParallelCalls:1` and `maxRetries:0`, and
wraps EVERY low-level doEmbed call. Each batch child identity includes parent operation,
profile/source revision, ordered range/ordinal and canonical batch hash. Repeated equal
texts in separate positions retain distinct range identities; callback arrival order
must not assign identities. Respect any smaller discovered model/token limit; a 512
count limit is not a token limit. Validate all finite vectors/count/dimensions/profile
before result commit. A partially completed batch set reuses confirmed eligible results
and leaves dispatched unknown batches uncertain; restarting embedMany cannot rebill
all prior batches. Later parallelization needs predetermined child identities and
atomic shared run/tenant capacity tests.

Native interface constraints: no arbitrary providerOptions passthrough; validate
allowlisted namespace/key/value enums, limits, tools, output schema and explicit
qualified interface. Chat structured output uses Task01 `Output.object({schema})`.
Responses default provider middleware applies `openai.store:false`; managed policy
must retain this and prevent per-call re-enablement. Messages requires its own gate.
Embedding fallback cannot change any DEFAULT_EMBEDDING_PROFILE field, including model,
normalization/chunking/dimensions/index. Default registered profile already exists in
`src/domain/profile.ts` and schema index is already 1536 with trusted profile/scope
filters; do not invent migration/backfill or relabel vectors. Media async start/status/
download constraints belong to Task13: installed video exposes custom `doStart`,
`getStatus`, `download` in addition to `doGenerate`; a generic language middleware does
not cover those submission APIs. Register policy now, leave actual job qualification
at its approved extension gate.

## Packet D — trusted request identity, replay, fallback and bypass inventory

Existing `InternalModelOperation.operationId`, `policyVersion`, `attempt` are pure
semantic inputs used by domain tests; they confer no authentication or policy authority.
Construct trusted backend ledger identities from verified principal/scope, registered
operation key, backend-owned parent/account, canonical request and source revision.
Ignore caller-selected attempt/policy/version except exact comparison to the expected
semantic contract. Admission creates immutable snapshot; IDs must not permit tenant,
principal, parent or prompt substitution. Store canonical logical identity plus hashed
lookup with exact equality. Use bounded private storage for results; no raw prompt or
private model response in public audit snapshots.

Actual current behavior requiring repair: `rememberMemory` persists source, then always
invokes extract/embed before `commitDerived` deduplicates receipts. `recallMemory` derives
query operationId from requestId/profile but text is not embedded in that ID. Repeating
identical explicit requests can therefore reach paid calls twice unless the governed
ledger handles outcomes; changing query text under the same ID must conflict. Reuse
confirmed operation results only after current authority/grant/scope/source recheck and
exact request equality. Tombstoned/revised sources or revoked references cannot read
cached private result or recreate derived state. If paid result survives but a source
commit fails, retain the charge and private result; replay a permitted current commit,
not the inference. Confirmed-but-unavailable private result fails explicitly or uses
qualified recovery; it does not authorize a new paid attempt silently.

Safe fallback requires an explicitly registered compatible candidate and evidence
that previous attempt is pre-dispatch or confirmed rejected with no uncertain paid
submission, visible output or tool effect. Mark attempt outcome and retain charges
before any new candidate is reserved; parent quotas/concurrency still apply. Never
fallback after streamed text/tool input/result became visible, after a committed tool
effect, after lost response/cancel or after ambiguous media submission. Policy update
alone cannot retarget retries. Embeddings cannot change semantic profile even when
models have equal dimensions. Generic exceptions/HTTP status alone are insufficient
to declare replay safe; preserve Task01 RuntimeErrorV1 sanitized code/outcome semantics.

Inspection found existing independent SDK/template paths, not yet backend rewired:
`src/llm/index.ts` directly instantiates OpenAI/Anthropic; provider `src/provider.ts`
and `src/index.ts` accept client embedding generators; chat template
`lib/cortex-memory-config.ts` invokes OpenAI embedding; `lib/ai/providers.ts` selects
raw provider/title/artifact models; `app/(chat)/actions.ts`, `artifacts/{text,code,sheet}/server.ts`,
`lib/ai/tools/request-suggestions.ts` are secondary-call owners. The inspected suggestions GET route only reads persisted suggestions; it is a data authorization/observation consumer, not an inference call.
Task04 must record these consumers and provide one governed backend contract; Task09/
14/15 replace their runtime call ownership at mapped client gates. They cannot be
claimed governed just because a registry exists. No legacy compatibility bridge or
old SDK provider fallback is built. Task04 aggregate claim 'no hidden bypass' covers
its actually reachable backend operations; final whole-goal claim requires mapped
client/template paths to be rewired and independently observed at later gates.

## Required failure and outcome assertions (all NOT_RUN)

1. Exact trusted policy precedence selects expected models/interfaces, clamps constraints;
   public admin/model/version/parent claims, unknown operations, unsupported native
   options, tools, profiles and missing cost bounds fail before token mint/fetch.
2. Parallel child submissions at the last quota/slot admit exactly the permitted count;
   no partial account changes after rejection, run children and secondary calls share
   tenant + run totals. Different principals/scopes cannot collide or select accounts.
3. Same canonical request/identity under concurrency creates one operation/call attempt;
   changed query text/source/prompt/options or forced hash collision conflicts; repeat
   remembers/recalls use eligible result without another provider call.
4. Identical terminal receipt racing from usageHandler/wrapper/reconciler settles once;
   conflicting settlement identity/usage is rejected/audited, not double charged/refunded.
   Correct account window receives late settlement; rounding/overflow/nonfinite costs fail.
5. Inject crashes before checkpoint, after checkpoint before call, after peer effect,
   after response before settlement, and between streamed terminal and receipt. Assert
   exact checkpoint/outcome/reserved/settled/uncertain values and observed peer count.
   Unknown attempts never dispatch again; expiry is not no-dispatch evidence.
6. Every actual model step and every embedding batch >512 is admitted independently;
   last-capacity batching cannot overspend, partial completion reuses confirmed batches,
   repeated identical values get correct stable range IDs, SDK retry stays disabled.
7. Revocation/deletion/source revision change between admission, dispatch and settlement/
   replay prevents future reads/effects/derived commit/delivery; retain incurred cost.
   Governance admin without private data/run grant cannot invoke model or inspect cache.
8. Visible text/tool effects and uncertain paid jobs block fallback; explicit safe
   no-dispatch/rejection allows only pinned compatible candidate with new reservation;
   embedding profile cannot change. Actual upstream model recorded only when supplied.
9. Stream start alone leaves reservation outstanding; terminal receipt settles once,
   interrupted/cancelled stream stays conservatively unknown when cost is missing.
   Missing native-interface cost metadata never becomes zero dollars.
10. Refresh import-aware current registration inventory for all new internal policy
    helpers/public runtime routes, actual codegen imports and HTTP aliases. Add trusted
    grant/background/control-access negatives; no public alias of mint/settle/provision.
11. Run root affected lint/typecheck/build/contracts and meaningful policy/domain tests,
    inspect discovery/skips. Then separately reviewed disposable live Task04 evidence
    for actual policy-selected models and quotas before mint/dispatch. Managed default
    embedding/retrieval receipt remains mandatory before Task09, not asserted here.

## Consequential technical conflicts and resolution boundary

- **Usage hook timing:** installed Agent hook is post-call. Resolved within approved
  architecture by final model wrapper admission + checkpoint, with usage hook as audit.
- **Private Gateway fetch:** no public pre-token hook. Resolved by v4 model wrappers
  before calling provider methods; early checkpoint uncertainty remains conservative.
- **Current memory replay:** existing source/derived dedup occurs after inference;
  caller semantic ID does not contain canonical query text. Resolved by trusted ledger
  + result reuse, currentness fencing and exact canonical identity equality.
- **Cost evidence:** Gateway Chat enriches cost, native interfaces may not. This is a
  real qualification gap for a strict monetary bound/settlement: require complete
  price/bound evidence or retain conservative liability/capability failure. No silently
  relaxed quota or fabricated observed cost is acceptable.
- **Embedding batching/Agent RAG:** one high-level invocation can contain secondary
  paid calls. Resolved by wrapped actual doEmbed boundary and deterministic child IDs,
  optional automatic Agent RAG disabled unless separately governed; no second memory
  architecture added.
- **Later callers still direct:** existing template/client paths remain concrete final
  wiring obligations, not Task04 preparation modifications. Registration alone cannot
  certify them. Existing gate allocations remain unchanged.

No new product choice is required by these findings. An inability to establish native
cost bounds or desired interface service compatibility must be reported as a technical
qualification blocker with evidence, not silently resolved by accepting weaker behavior.


## Verified installed versions and exact later consumer ownership

`installed-packages.json` records actual installed package.json versions: Agent 0.7.3,
Gateway 0.2.1, Workflow 0.4.8, Workpool 0.4.13, AI SDK 7.0.127, Convex 1.46.0.
These match Task01's qualified lock; installed inspection is not a fresh live receipt.
Root exact component/AI dependency pins are distinct from its Convex ^1.46.0 peer range.

| Actual inspected bypass/call site | Restoration owner and required outcome |
| --- | --- |
| `src/memory/index.ts:219` creates LLM for conflict; `:815` constructs extraction client; `:581`, `:1335`, `:1520`, `:2284` select caller/config embedding generators; `src/llm/index.ts` dispatches direct OpenAI/Anthropic | Task09 text client + Task14 modern explicit memory extensions replace modern runtime ownership with thin backend transport; assert SDK run/memory invocation performs no client provider call, extraction, belief-resolution loop or embedding generation. Task04 backend adapter never imports these clients. No compatibility bridge is added. |
| `packages/vercel-ai-provider/src/provider.ts:169`/`:258` call underlyingModel doGenerate/doStream; `:195`/`:498` invoke client ingestion with embedding callbacks; `src/index.ts:134`/`:320` calls custom embedding generator | Task09 remote text transport removes second local tool/memory loop; Task14 extensions remove secondary local inference ownership. Assert backend run IDs reused on reconnect/observers and no underlyingModel, remember writer or embedding callback executes. |
| `packages/cortex-cli/templates/chat-sdk-quickstart/lib/cortex-memory-config.ts:59` calls embed with OpenAI model; `lib/ai/providers.ts` returns direct upstream/provider defaults | Task15 shipped template integration uses authenticated backend transport; assert app works without upstream keys and unknown/unavailable policy produces typed errors, never fallback provider. |
| Chat template `app/(chat)/actions.ts:25` generateText title; `artifacts/text/server.ts:11`/`:40` streamText; `artifacts/code/server.ts:12`/`:45` and `artifacts/sheet/server.ts:12`/`:51` streamObject; `lib/ai/tools/request-suggestions.ts:35` streamText | Task14 secondary-call backend contract + Task15 template adoption wire conversation.title / artifact.text / artifact.code / artifact.sheet / artifact.suggestions respectively. Assert actual call receipts correlate to owning backend run and shared tenant/run account; exhaustion denies before provider call. Convert old streamObject sites to qualified AI SDK7 structured Output contract through backend. |
| Chat template `app/(chat)/api/suggestions/route.ts` GET | Task15 observe authorized persisted suggestions; no generation here. Do not count as an inference bypass or invent extra billable operation. |

Backend Task04 acceptance must assert runtimeMemory remember/recall actually receive the
governed adapter and every extract/resolve/embed reaches wrapper/ledger; a stub, dead
constructor or bypass raw factory is incomplete. Every reachable new backend inference
constructor is restricted to `runtimeGateway.ts`; source inventory plus token/fetch
instrumentation in controlled fixtures must prove deny-before-mint and no raw calls.
Task07 actual Agent integration must repeat those assertions for multi-step/tools.
The whole-goal every-billable-call claim remains incomplete until these specific later
client/template conversions and their actual outcomes pass. This preserves accepted
sequencing without giving hidden runtime/client loops an acceptance waiver.
