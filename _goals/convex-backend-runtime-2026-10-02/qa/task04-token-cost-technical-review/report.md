# Judgment: Task04 token and monetary contract refinement

## Verdict: PASS for the bounded viable design; NEEDS REVISION for any claim of ready text/Responses cost qualification

No unavoidable conflict with the original approved architecture is established. Keep the accepted pure validator unchanged. A request-specific, operationally qualified conservative input bound and a separately qualified whole-model monetary reservation can coexist. The research correctly finds that a full-model input envelope cannot be passed off as the request's strict combined-context proof. Its suggestion that absence of a timeless mathematical framing/rate guarantee necessarily prevents qualification is stronger than the approved requirement. A supported documented conservative rule, exact allowed feature envelope, actual native qualification and currentness/revocation controls are the appropriate bar. None of those actual cost/framing qualification receipts were produced by this review.

This is an independent READONLY technical-design review, not wholeTask04 acceptance, a review of the concurrently changing ledger, or permission to bypass the held Gateway gate. Gateway implementation/actual qualification, structured/tool bounds and explicit Responses framing remain incomplete. The accepted PURE C3 PASS4.4 covers its original three files only. A fail-closed empty manifest is valid interim safety, never final functional completion. Numerical review caps alone were waived.

## Evidence review and exact scope

Read AGENTS/runtime/profile/pessimistic-judge/feature-orchestrator, approved implementation prompt, authoritative decisions/architecture, goal and all17 original tasks, Task01 frozen contracts, PURE C3 report and actual pure source, Gateway/admission/bootstrap preparation, new cost research/report/excerpts/manifest, installed native provider sources and existing public-document scratch. `source-evidence.json` fingerprints46 source documents/files and independently verifies all21 inherited raw and derived public-document hashes. No network, credentials, service/model calls, install, Git, product/oldQA edit or application test was performed. Tests and native service qualification: **NOT_RUN**. Only this new report/evidence packet and uniquely named scratch are permitted writes. Parent's changing five-file ledger implementation is outside this review and receives no implied acceptance.

Current `src/domain/model-policy.ts` SHA256 is `f43de8775880d1d4f6ddad90e527837d9ddb4ce58d00ea622aabc2609a1769da`, identical to accepted C3. Lines287/319–323 require independently established positive input bound, the real requested output maximum, separate per-field limits and input+output<=context. Lines58–67/103/323 separately require the trusted complete cost ceiling and reservation>=ceiling. No equation requires that ceiling to be derived from the same request input bound. Thus the allegedly conflicting concepts already occupy different fields.

Native coordinates:

- `@convex-dev/ai-sdk-provider`0.2.1 `src/index.ts:40–48`, `gatewayFetch`: private service-token acquisition precedes native HTTP. `convexGateway:138` defaults to Chat; `responses:155–168` uses official OpenAI and store:false; `embeddingModel:181–188` uses official embedding wrapper/512 maximum. `convexGatewayUsageMetadata:52–64` and extractor:67–82 call preserved amounts dollar costs at:51, but only test number/object, without validating completeness.
- OpenAI-compatible `OpenAICompatibleChatLanguageModel.getArgs:172`, `max_tokens:274`, response_format:279–293, messages/tools:316–321; `doGenerate:327`/`doStream:430` and terminal cost-extractor calls:397/:703. Unknown provider keys are spread at:297–307, reinforcing the need to reject them before dispatch.
- `convertToOpenAICompatibleChatMessages:32`: system text:39–40, one user text part becomes a string:45–50; multiple user parts become a native array:54–60; assistant text parts concatenate:171 onward. The simplest counting recipe must require a single plain text part per message, rather than accidentally count an unqualified content-array representation.
- OpenAI Responses native `baseArgs:596–639`: input, max_output_tokens:601, schema text, store, service_tier and truncation; `getArgs:824`, `doGenerate:832`, `doStream:1519`. Responses is a separate transform and needs its own bound rule.
- OpenAI-compatible embedding `doEmbed:90`, request input:157/encoding_format:158, usage:175–179/raw body; it does not run the Chat cost extractor.

Every exact installed-source hash is in the new evidence manifest. Public documentation URLs and raw hashes also appear there; they are observations, not certified live tariffs, eligibility or readiness.

## Smallest sound implementation design

### 1. Keep request and monetary envelopes separate

Let U be an independently established conservative upper bound for the complete final native input under a specific reviewed bound rule, M the actual dispatched max output and C the selected real combined-context limit. Require U<=policy.inputTokens, M<=policy.outputTokens and U+M<=C before admission/checkpoint/native closure/service token. Set request.inputTokens=U and request.outputTokens=M. No guessed/clipped input, fake zero output or raised model limits.

Separately let K be a root-qualified inference/Gateway monetary ceiling covering the allowed feature envelope at the reviewed model input/output/rates. Reserve K in each run and tenant account once. K may deliberately price full maximum input C_model and full maximum output O_model, even though this individual request passes U+M<=C. Monetary overreservation does not assert C_model+O_model is a valid combined context. No pure-interface change is needed to express this design. A tighter operation's limits can reject K; that is an honest budget failure, not grounds for lowering K without qualification.

For example, research's public gpt-4o-mini maximum-envelope candidate is ceil(128000*0.15+16384*0.60)=29031 microUSD. That candidate can accompany a small independently bounded request without entering request.inputTokens as128000. It is still only a candidate until exact live Gateway rates/charge coverage are qualified. Reserving model-full output is conservative even when M=256; narrowing to M is allowed only if its complete charged-output enforcement is qualified. Preserve safe-integer checks and exact rational outward rounding.

### 2. Default Chat has a concrete documented operational rule candidate

Existing official OpenAI cookbook `openai-cookbook-tokens.text:82–135`, section6, documents gpt-4o-mini-2024-07-18 as three framing tokens per message plus encoded field values plus three reply-priming tokens. It expressly treats generic gpt-4o-mini as that snapshot assumption with an update warning, and calls counts estimates rather than timeless guarantees. Existing official tiktoken educational source starts from individual UTF8 bytes and merges; ordinary BPE token count is at most the bytes used by that string.

For **only** native plain `{role,content:string}` Chat messages, no names, tools, schemas, reasoning, assets or extra options, a concrete candidate is:

`U_chat = 3 + sum_over_native_messages(3 + UTF8(role).length + UTF8(content).length)`.

The byte substitution conservatively bounds each encoded string under the documented framing rule; it does not independently prove that rule eternally governs the serving alias. Count the exact normalized strings that the pinned native conversion will send. Require one text part per message for this first rule; preserve ordered roles/messages and full identity. This narrower admitted feature envelope is an initial qualification step, not deletion of tools/extraction or Task07 requirements. No new tokenizer dependency is necessary for this restrictive candidate.

Before any real-ready manifest entry: actual default Gateway Chat qualification must independently accept the documented framing assumption for the current exact alias/interface/native transforms; observe genuine input usage on adversarial bounded Unicode/special-string/message-count cases; validate output cap for generate and stream; set boundRevision, immutable source/doc/evidence hashes, checked-at/expiry and emergency revocation. Aliases remain aliases; do not manufacture weight revision, silently change the frozen model ID, or call this a timeless mathematical guarantee. New source transform, detected alias behavior or bound overrun invalidates readiness. Observed finite samples alone must not be labeled a universal proof.

This is a supported, reviewable operational qualification approach within original scope. Public docs and this review do not themselves activate it. If actual Gateway qualification contradicts the rule, choose a separately supported stronger rule or keep the gate incomplete; no arbitrary multiplier masquerading as proof.

### 3. Required tools/schema, distinct models and explicit Responses remain qualification work

The default Chat equation does not cover tool-call/results, function definitions or structured schema. Cookbook section7 provides an example function-tool recipe; it does not establish every arbitrary nested schema/tool shape. Scope eventual qualification to immutable operation-specific schemas/tool registries, bounded native payload shapes and exact conversion/defaults. A rule can combine UTF8 bounds for variable strings/serialized payloads with **actually qualified** per-shape framing constants, bounded message/part/tool/property cardinalities and frozen schema/definition contributions. Do not insert an invented hidden-overhead constant now. Native output-schema names/defaults/strictness and complete definitions/results are part of the rule/identity. Retain required registered tools and structured extraction/conflict capabilities pending their own real proofs.

Distinct actual per-function models are required; gpt-4.1-mini is a research candidate, not an approved mandatory second model. Its cookbook framing coverage is absent. A different documented and actually Gateway-qualified model (for example a cookbook-covered gpt-4o variant if eligible and allowed) can satisfy this criterion after independent price/interface/framing evidence. That routine choice does not need a new product decision. Frozen default Chat and embedding identifiers remain unchanged.

Explicit Responses must keep store:false, stateless exact input, denied conversation/previous_response_id/background/auto-truncation/provider-hosted tools/routing/reasoning extensions. Native max_output_tokens bounds visible and reasoning output per official reference. This does not provide a documented full-input framing rule. Neither Chat framing nor its Chat cost extractor transfers automatically. Use an independently supported and actually qualified interface-specific conservative rule for the constrained final Responses shapes. At present that rule and its real evidence are absent: **BLOCKED/NOT_RUN**, never a fabricated U. No unsupported input-token-count endpoint, custom transport or direct-provider fallback is introduced.

The missing Responses/tool rule is consequential unfinished technical qualification, but not proof no supported operational solution exists. Do not ask the user to waive strict limits merely because a universal protocol theorem is unavailable. A user decision becomes necessary only after evidence establishes that an originally required interface/capability cannot meet the approved operational qualification bar through the supported native path. Options then must explicitly state the changed capability/interface or budget/context guarantee; no silent weakening, omission or architecture switch.

### 4. Embedding UTF8 proof is viable for the strict string envelope

For each final normalized embedding value, U_i=UTF8(value).length and U_batch=sum U_i. Under documented cl100k_base string-input BPE semantics each matched substring starts as bytes and only merges, so tokens<=bytes. A recognized literal special token consumes at most its marker bytes; markers handled as ordinary text follow the byte proof; tokenizer rejection is an upstream outcome, not free/retryable usage. No local special-token expansion/control injection is permitted. Reject ill-formed UTF16 (unpaired surrogates) before counting/dispatch, rather than rely on unspecified differences between TextEncoder replacement and service decoding. Rejection preserves the frozen preprocessing contract; silent normalization-version changes do not.

Normalize NFC/LF/trim exactly as `src/domain/profile.ts:24–28`; detached dispatched strings must be exactly those counted. Count post-normalization, including UTF8 expansion and all scalar values. Enforce each U_i<=8192, count<=512 and sum<=300000, plus tighter deployment/tenant/request limits. Treat8192 as per-value native cap and300000 as aggregate request cap; never mislabel aggregate allowance as a larger per-value limit. If the pure input/context policy is tighter, split/reject within it. Existing1600-code-point chunks have <=6400UTF8 bytes only for valid scalar strings; query inputs still need independent checks. Stable batches must split on both count and aggregate/tighter policy limits and reserve against the same parent/run/tenant accounts. Validate finite1536 vectors and exact default profile/current source/authority separately. Real embedding forwarding, tariff, managed index/retrieval evidence remain NOT_RUN.

## Minimal trusted interface: backend proof seam, no permissive pure mode

Implement a backend-only bound-rule registry rooted in reviewed deployment manifests. It supplies a deterministic `boundFinalNativeRequest(qualification, detachedFinalParams)` returning U, M and explicit native per-value/aggregate limits for embeddings. A persisted proof record binds ruleId/revision, qualification receipt/source hashes, complete canonical native request/hash, normalized values, feature-envelope/template/tool/schema revisions, measured conservative U/M, checked-at/expiry and original price/bound revision. Values originate from the trusted rule/helper, not public caller claims or tenant admin prices. Empty/unqualified rule fails before native closure/token.

The transaction admission/checkpoint consumer verifies exact registry/root and canonical request equality, current authority/source/parent/cancel and unrevoked/unexpired qualification; it consumes U/M into unchanged pure request validation and K from qualification.costBound into unchanged accounting. Hashes index evidence; compare exact canonical bytes. Synthetic rules/receipts remain fixtures only. No `native-enforces-context` exemption, proof boolean from a caller or separate relaxed request mode is necessary or approved here.

Terminal rule is independent: a qualified complete aggregate inference charge for the exact attempt, or a complete revisioned usage/rate formula. Currency/unit can be established by qualification's official semantic source plus actual accepted charge evidence; do not require the native payload to carry a nonexistent currency field. Official provider source explicitly calls Chat preserved amounts dollar costs, while billing says invoice dollars/OpenRouter rates; that supports a candidate semantic chain, not a ready complete USD attestation. OpenRouter credits/docs and upstream_inference_cost must not substitute blindly for the Convex account's aggregate inference charge. No inference key purchase/BYOK fee is added without relevant evidence; Convex infrastructure is separate from the inference/Gateway budget scope.

Settle known complete charge once with integer microUSD conversion; record actual usage and model when supplied. Known tokens with missing money remain unknown monetary liability. Raw missing Chat token fields cannot be interpreted as free usage because converter defaults them to0. Responses/embedding lack Chat's extractor and need their own authoritative aggregate/rate proof. On abort, error, lost/partial stream or crash after checkpoint retain conservative liability, prohibit blind replay, and release concurrency only qualified terminal/lifetime proof. Unexpected charge categories/rate/model drift or cost>reserve are fully accounted and latch blocking/revocation; never clip charges or falsely mark the ceiling honored. Rate expiry does not freeze prices or prove all unseen future categories; the attestation is scoped to reviewed current assumptions, with actual qualification and drift controls.

## Original assertions preserved and new acceptance proofs

| Original assertion | Preserved behavior and required evidence |
|---|---|
| Strict input/output/context validation | Pure limits/assertions unchanged; trusted final-request U/M; reject invalid Unicode/extra native fields/shapes and U+M>C before closure/token. Boundary U=C-M passes and U=C-M+1 denies with zero token/native calls. |
| Complete canonical/pinned input | Same ordered roles/parts/tools/schema/JSON own keys/profile/batches; prove exact normalized native transform/default correspondence and mutation resistance; exact canonical collision mismatch denies. |
| Complete cost ceiling and currentness | K remains separate complete reviewed monetary bound; source/model/interface/feature/price/bound roots and expiry/revocation rechecked at checkpoint; forged/synthetic/outdated proof denied. Public observations cannot install ready roots. |
| Per-function actual models/audit, no bypass | Actual distinct-model receipts tied to registered functions and request/bound/price identities; all Agent steps, extraction/conflict/title/artifact/suggestion and embedding batches governed; deny model/prepareStep/provider overrides. |
| Atomic budgets/concurrency/once-only | Native OCC concurrent reservations against same parent/run/tenant accounts; one dispatch winner; known/unknown/overrun/duplicate-conflict exact balances; unknown window liability cannot be laundered. Ledger implementation not reviewed here. |
| Loss/cancel/fallback | maxRetries0; no replay after visible output/tools/effects/ambiguous payment; revoked/stale result withholding does not erase charge; compatible explicit safe fallback separately reserved; embeddings never change profile. |
| Whole capability functional coverage | Actual Chat generate/stream, explicit Responses generate/stream, tools/structured schema, secondary distinct models, embedding/managed search and later media/client/native gates remain mandatory. Typed unavailability is intermediate safety only. |

New bound tests must validate the independently expected rule outcome, not only mirror helper arithmetic: exact final bodies via installed official underlying-provider injected-fetch fixtures (never replace production Gateway), UTF8 scalar/special-string/boundary fixtures and no unintended metadata/reasoning/part-array defaults; native same-qualification usage<=U across independently selected boundary/adversarial cases; output accounting<=M; operation-specific fixed schemas/tools; actual money authority and each allowed charge class; currentness/revocation/wrong revision denials before token. Real input or cost exceedance is a qualification failure, fully retained and blocked, not a test expectation to rewrite. Pricing completeness has official semantic support plus reviewed actual evidence, not16 happy-path samples alone. Native all these checks: NOT_RUN.

## Issues found

### Critical if used as readiness claims

- No ready Responses/tool/schema framing rule or actual complete Gateway cost qualification is established by current sources. Enabling them using invented counts/ceilings violates unchanged PURE obligations.
- Passing C_model into request.inputTokens with positive output to fit a full-envelope price proof fails `model-policy.ts:322`. Lowering input/clipping output/raising real context to evade this is forbidden.

### Important

- Research's refusal to distinguish operational documented qualification from timeless theorem risks unnecessarily blocking authorized work. Keep genuine missing evidence explicit; do not invent an impossible universal acceptance bar.
- Freeze exact one-text-part native Chat shapes for the simple equation; multiple user parts use different native content arrays. Tool/schema/Responses and second-model bounds do not inherit the simple rule.
- Actual charge semantics, all allowed categories and rejection/cancel uncertainty still need real evidence. Source comments and public prices support candidates only.

### Minor

None material established in the accepted pure source; its known dynamic record type limitation remains outside this technical conflict.

## Dimension scores

| Dimension | Score | Evidence |
|---|---:|---|
| Original-scope fidelity |5/5|Keeps all17 obligations/default identifiers, tools/schema/Responses/media; no direct fallback or final unavailability substitution. |
| Viable minimal contract design |4/5|Separate U/M and K already fit pure contracts; supported operational Chat/embedding candidates; explicit remaining feature rules. |
| Evidence precision |4/5|Exact source coordinates/current hashes and21 inherited document hashes verified; zero invented actual qualification. |
| Qualification completeness |2/5|Real framing/rate/charge/native proofs NOT_RUN, Responses/tool rules incomplete; this dimension prevents ready-capability approval. |
| Safety/accounting preservation |5/5|Predispatch denial, source/authority/currentness, once-only known/unknown/overrun and loss rules retained. |

Average4.0/5 is a technical design assessment only; the2/5 qualification dimension explicitly prevents any production-readiness or wholeTask04 PASS. Recommendation: implement the unchanged-contract bound seam and offline governed dispatcher safely, then actually qualify narrow Chat/embedding and required structured/tools/distinct models/explicit Responses through supported native APIs. No user product decision is needed on the evidence currently available; an evidenced unresolvable capability/guarantee conflict must return for a concrete choice.
