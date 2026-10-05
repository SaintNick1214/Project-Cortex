# Task Judgment: Official Convex AI-budget public source C3

## Verdict: PASS — source interpretation only

**Actual money qualification: NOT QUALIFIED.** Present actual money domain and ACTUAL_PROOFS remain EMPTY; UNKNOWN/fullK/STOP stays required. This PASS accepts the precise public-source findings below, not Task04 completion, positive admission, service compatibility, or implementation.

## Evidence review

Reviewed repository AGENTS/runtime/profile/pessimistic-judge/judge-task, original goal/Task04, accepted C3 money-domain clarification and C4 observer/proof contract, plus frozen C2 observer/canonical/proofs/runner and companion fixture sources. Applied these local review instructions for this bounded judgment, without executing supplied helpers or application checks.

Independent Python standard-library verification confirms complete subject closure: nine manifest rows, every size/SHA256, and no unlisted file except exact self manifest. Manifest SHA256 is **47e6cd5b0594c4e14839a9bfd343c9e427a7321953cf3626b26c8cc0ac1fb636**; report SHA256 is **ff5322cfb4208f9c3208f2356e1664e323630226967fafdb4ff3dde32174ab29**. Exact UTF8 README/index bytes equal complete pinned structured tool contents at commit **509977282bce11cc1ba41b9ca31897eb43124da8**, with independently recomputed Git blobs **39e34fb64502f9b76fb296028c7d2d2d61df06dc** / **fe4ccb24f6d48ac60013e9674b0b275ec55d7e4d**. Initial failed README patch representation is retained and independently confirmed to be exactly one extra final newline, never substituted for authoritative bytes. verification.json and complete context/subject preimages retain this evidence.

The delegation accidentally supplied a 65-character manifest string by appending row count 9. An exact assertion against that string failed; later coordinator correction confirms the actual 64-character hash and nine rows without changing bytes. Both failure and correction are preserved. A guessed native-driver.ts read also failed; actual driver is runner.ts:25. These are review bootstrap failures, not product results.

## Requirements and source interpretation

| Contract | Newly supported / missing |
|---|---|
| Same-provider amount authority | **SUPPORTED, conditional.** README:581–584 names the Convex provider >=0.2.0-alpha.1, real per-request dollar cost at providerMetadata.convexGateway.cost, including cached/reasoning tokens, and says recorded spend equals actual bill. index:237–246 explicitly calls it authoritative USD and accepts finite nonnegative number. This is substantive same-provider aggregate request-charge documentation, not merely a tariff estimate or evidence for a Vercel service. |
| Amount versus estimate | **SUPPORTED distinction.** Missing/older-provider cost is undefined in index:242–253; README:584–588 describes token fallback. README:977–978 says cancelled/source-error settlement without authoritative usage remains estimated. No absent field establishes zero. |
| Generate consumption | **SUPPORTED consumer paths, conditional.** index:659–669 forwards generateText result cost; index:862–883 forwards doGenerate result cost. These are method-specific consumer evidence, stronger than a generic meter callback. They do not independently establish pinned provider v4 raw-wire mapping, all SDK steps/retries or complete error-attempt charges. |
| Stream consumption | **SUPPORTED consumer path, conditional.** index:919–925 reads finish.providerMetadata and index:898–904 extracts its cost. It attempts settlement on finish, reader-done, cancellation and source errors. One memoized settlement promise is client behavior, not a provider finality theorem or revision contract. No finish tail after cancellation is assumed to arrive. |
| Embed surface | **MISSING.** README:295–297 mentions generic metering of embeddings through caller-reported units/prices. This does not prove an official embedding provider result/chunk amount path or whole embedding invocation cost. |
| Finite categories | **PARTIAL semantic inclusion, MISSING closed extraction.** Cached and reasoning are expressly included in documented request total. Server-tool fees are discussed at README:598–602 for authoritative costNanos, but arbitrary meter input is not provider evidence. There is no exact own-data category field/type/enum predicate proving cache-read/cache-write/cancelled/inference/rejected/routing/surcharge completeness, duplicate/conflict/unknown behavior. Do not assign inference by default or equate reasoning with an accepted category. |
| All attempts and drift | **MISSING.** “Each request” / “actual bill” support conditional charge authority for the surfaced request. They do not identify whether a logical dispatch's retries, rejected attempts, cancellations, fallback/routing and drift models are aggregated or billed separately, nor correlate every such charge to the same dispatch. |
| Finality and lookup | **MISSING.** No published immutable billing identifier/lookup/delegation, authoritative revision ordering, whole-invocation finality after cancellation, or billing reconciliation proof is established by these two files. Hashing a dispatch creates no billing ID. |
| Correlation | **PARTIAL consumer association only.** Consumer reads cost from the same returned result/finish; no independently reviewed mapping binds this mapped metadata to retained raw ID/model/transcript digest and all attempts. |
| Exact conversion | **Number input supported in principle; helper not adopted.** index:246 uses Math.round(costUsd*1e9), and :251 rounds hypothetical back-compatible nano fields. Accepted C4 observer-proofs:73 instead requires exact decimal or IEEE upper-neighbor rational outward microceil. Preserve original detached numeric value for that existing converter; no exact original decimal lexeme is promised by the source. Lack of a lexeme alone does not prohibit the already accepted numeric conversion, but the rounded nano result cannot substitute for it. Finite input alone also does not guarantee multiplication is finite/safe. Hypothetical “if ever present” costNanos is not proof that the official provider emits it. |
| Present nomination and capture | **MISSING current route.** C2 observer.ts:17 selectGenerate omits top-level providerMetadata; :18 selectEmbed omits it; :19 native finish selection retains only finish/usage. :28 nominates rawUsage.cost with observedCategories empty. proofs.ts:10 fixes money extraction raw-usage-cost-v1 and all seven categories; :14 returns unknown without categories and accepted proof. New metadata evidence cannot enter this frozen route without a separately reviewed retention/extraction/source contract and capture revalidation. |
| Actual/current qualification | **NOT PERFORMED.** No paid/native/service call, keys/environment/private billing read, source installation or registry mutation. Historical public acquisition timestamps and exact Git identities do not certify loaded provider/adapter/current target/native behavior. |

## Issues found

### Critical for any positive actual money claim
- No closed category/all-attempt/drift/finality/correlation predicate for the accepted whole-invocation account charge.
- No embedding amount mapping or current C2 retained metadata nomination.
- No independently qualified native target/source installation or accepted actual proof.

These are explicit remaining qualification gates, not defects in the bounded source-only report. The report accurately keeps them unresolved.

### Important source interpretation clarification
- Read “generic meter usage is not specific generate/stream/embed proof” narrowly: generic meter does not qualify those interfaces, but this pinned index DOES provide concrete generate and stream-finish cost consumer paths. Preserve those positive findings in any next design.
- Read “no exact-original-money lexeme/rounding contract” without discarding valid supported numeric input: accepted conservative numeric conversion can operate on a retained original number once semantic proof exists.

### Minor evidence limits
- Early review bootstrap commands lacked persistent full raw argv/output capture, and the first lacked genuine pre/post UTC brackets. Later direct reads contain genuine shell UTC but several displayed outputs truncate; targeted follow-ups and full frozen preimages resolve source inspection. tool-command-log.json preserves subsequent exact command arguments/tool output/real tool clock brackets; no missing timestamp is invented.
- Source acquisition tool clocks have one-second resolution, including zero-second search intervals. They bracket returned tool calls only; they cannot certify network/provider inference duration, native phase ceilings, timestamp freshness beyond retrieval, or authenticated billing access. The acquisition report itself acknowledges authoring/bootstrap capture limitations.

## Dimension scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement fulfillment for bounded source interpretation | 5/5 | Every requested positive/missing contract distinguished; no positive actual proof installed |
| Evidence quality | 4/5 | Complete source closure and byte/Git checks; explicit bootstrap/tool timing limitations |
| Pattern adherence and scope | 5/5 | Read-only review; only owned review/resume writes; independent gates preserved |
| Completeness of source assessment | 5/5 | Generate/stream/embed/category/amount/current observer differences individually addressed |

**Average: 4.75/5.** Test/code implementation dimensions are not applicable to this source-only assessment. Missing actual gates are not scored as completed Task04 requirements.

## Recommendation

Proceed only to a bounded design for preserving original own-data providerMetadata.convexGateway.cost and correlating it with existing native/raw evidence for generate/stream, retaining UNKNOWN for absent/conflicting/unsupported values. Before any positive proof, independently review exact pinned provider/adapter/type mapping, amount/currency semantics and current installed source closure, categories/all-attempt/drift/finality, numeric conversion and capture revalidation. Embedding needs separate concrete official surface evidence. This source can justify that partial next design; it cannot itself install positive whole-invocation money proof.

No AI-budget package, dependencies, approximate caps, token estimates, callbacks, alternate architecture/provider or Jev are adopted. Numeric review-cycle waiver changes only the loop count; acceptance and scope gates remain.
