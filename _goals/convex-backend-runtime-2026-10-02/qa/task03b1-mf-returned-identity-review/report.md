# Supplemental Task Judgment: MF returned identity accessor boundary

## Verdict: PASS — no supported blocker established, 4.2/5

The parent synthetic witness is reproducible: all10 returned issuer/subject accessor cases yield WRITE-only committed safe receipts. It is not a supported production identity state in the installed Convex1.46 runtime, so this witness does not establish an additive original-criteria defect or reverse the immutable optional-read repair PASS4.2. A future custom identity provider/adapter returning arbitrary JavaScript objects would require new qualification and boundary protection.

## Evidence Review

Read prior optional-read REJECT and repair-review PASS, Task03, applied sequencing and repository/rubric instructions. Inspected actual registered memories.store/update/updateMany and facts.store/update and their transaction-aware fixture. Current runtimeDataAuth SHA256 remains3fd328761100777a06c0fe243deb68825492ddbefd669b23dbc1f9e125e4fd27, unchanged from accepted repair. Source-manifest.json records current sources and installed Convex implementation.

runtimeDataAuth.ts:662 protects invocation/await of ctx.auth.getUserIdentity outside its denial catch. resolveAuthority subsequently dereferences identity. An injected accessor throwing the exact native FORBIDDEN at that later dereference reaches the denial catch and is treated as absent READ after persisted WRITE recheck. Thus there is a real arbitrary-object hardening opportunity. The synthetic fixture substitutes an unsupported returned object; it does not demonstrate an actual JWT claim/HTTP caller can inject JavaScript getters into the platform identity.

Installed convex/src/server/impl/authentication_impl.ts:6 returns performAsyncSyscall('1.0/getUserIdentity'). syscall.ts:36–64 awaits a string response and returns JSON.parse(resultStr) without a reviver. A successful returned identity is null or a plain JSON object with data properties; JSON cannot carry getters, setters, proxies or throwing property access. UserIdentity requires readonly string issuer/subject/tokenIdentifier. JWT claims are JSON values. Repository production handlers accept generated Convex ctx; no custom getUserIdentity override/returned-object adapter occurs in these entrypoints. The platform can throw/reject during acquisition/parsing, and those exceptions are within the protected acquisition boundary. A malformed JSON result cannot create a later accessor exception. This is source-backed boundary classification, not an assertion that every conceivable compromised platform state is safe.

## Independent Actual-handler Controls

Fresh work/resume/sdk-safety-judge/mf/probe.mts uses all5 actual registrations and retained transaction-aware fixture. Healthy controls use installed setupAuth with an inert syscall shim returning JSON identity (no service/network). Fault selection reaches optionalMutationRead specifically; assertions require actual injection and full pre/post fixture-row comparison.

| Control | Cases | Observed outcome |
|---|---:|---|
| Healthy JSON identity with valid WRITE-only grant |5| Usable mutationReceipt, actual commit; intended baseline preserved |
| Unsupported returned issuer/subject accessor, exact native FORBIDDEN |10| Reproduced committed receipt,1 getter per reached identity; synthetic only |
| Identity callback synchronous exact native FORBIDDEN |5| Fixed BACKEND_OPERATION_FAILED/not_committed, complete rollback |
| Identity callback rejected exact native FORBIDDEN |5| Same fixed failure and complete rollback |
| Installed setupAuth syscall invalid JSON string |5| Parsing failure protected, fixed failure and complete rollback |

30/30 match independently classified expectations;20 supported controls pass and10 synthetic reproductions are retained explicitly. Actual setupAuth identity descriptors independently have own value fields and Object.prototype, not getters. First scratch run recursively overwrote its own saved callback and did not reach injection; its failure is preserved. Second run expected the wrong fixed public message; preserved mismatch corrected to source-defined 'Data operation failed.' No product/test assertions were changed, no attempted failure relabeled as passing. Final results/stdout/stderr retained in scratch.

## Requirements Review

| Requirement | Met? | Evidence |
|---|---|---|
| Independently reproduce10 reported actual-handler outcomes |Yes| All10 reached issuer/subject getter and commit, explicitly marked unsupported returned-object simulation |
| Assess supported Convex identity contract before verdict |Yes| Installed setupAuth→asyncSyscall→JSON.parse; UserIdentity string contract; no production custom adapter |
| Preserve unexpected callback failure abort and opacity |Yes|10 exact sync/rejected callbacks and5 real setupAuth parse failures all fixed abort, no raw private diagnostics |
| Preserve initially READ-less safe receipt baseline |Yes|5 healthy installed setupAuth JSON controls commit real receipts |
| Preserve original criteria, judgments and failed history |Yes| Earlier original and supplemental reports unchanged; this is an additive boundary-classification review only |

## Dimension Scores

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment |5/5| Reproduction, platform qualification, supported failures and healthy controls verified |
| Code Quality |4/5| Supported callback acquisition protected; arbitrary returned-object hardening remains advisory |
| Test Quality |4/5|30 independent actual-handler controls with reached assertions and table rollback |
| Pattern Adherence |4/5| Verified platform identity and trusted WRITE reference remain established boundaries |
| Completeness |4/5| Installed source proof and current handler outcomes; no live service claim |

**Average:4.2/5.**

## Issues Found

### Critical

None established within the supported installed Convex contract.

### Important

Arbitrary/custom returned identities are not covered by the acquisition wrapper after await. If a custom ctx/auth adapter is introduced, validate/capture issuer/subject within protected acquisition and classify all access errors as fixed infrastructure failure. Do not expose such an adapter under the current PASS without fresh qualification.

### Minor

Consider explicit plain-data identity validation as defense in depth. It is not necessary to close the supplied platform accessor witness because the platform JSON construction already rules that state out.

## Recommendation

Keep the prior narrow optional-read repair acceptance. Retain all synthetic and failed receipts without claiming they are live exploits or supported blockers. Original Task03 live/currentguard/final acceptance and all later functionality remain mandatory. No source edits, services, deployment, children or commits occurred.
