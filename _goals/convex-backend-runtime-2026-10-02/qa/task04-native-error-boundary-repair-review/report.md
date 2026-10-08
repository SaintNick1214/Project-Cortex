# Task judgment: Task04 source-bound native error boundary repair

## Verdict: PASS_OFFLINE_PRODUCT

Average **4.4/5**; Requirement Fulfillment **5**, every other dimension at least4. This accepts only the exact two-file offline product repair. It does not convert the actual C6 run to PASS, certify native transport/transactions, accept terminal capture implementation, or complete Task04/full03/the goal.

Exact accepted candidate:

- `convex-dev/runtimeModelPolicy.ts`: `bed10cc3934aac6743ff0cb08911765d84e9db18446cd8aebff979815068207f`.
- `tests/unit/runtime/model-policy-admission.test.ts`: `51a8a1072ec5d782fcd44fbcd03e1b7010f705568461a30896bbd9a234b39b23`.
- Producer packet manifest: `b34620d4c0cb33d96ee7d9423bc066b31568e4728f34f37fe9bcb44ad3a016a2`; report: `1fccdc9bb508361d4738b12b8552783c8dc973a68926f5e98d284f8a947dbf83`.

## Evidence review and authority

Read AGENTS, CODEX-RUNTIME, PROJECT-PROFILE, pessimistic-judge, judge-task, original tasks/04-model-policy.md, authoritative decision-gates.md, current-gates.md, accepted PURE C3 and admission C2 acceptance records, PURE C3 report/source, consumed admission preparation, C1/C2 native API freeze, denial-boundary qualification and current repair packet/raw tests/codec. Original Task04 requirements remain open at their original service/integration gates. The judge-task iron law applies: a missing structured denial requires an implementation repair, not an assertion relaxation.

Independently verified all **148** producer `evidenceFiles` map entries and all ten declared product/dependency fingerprints. Exact original B preimage is `2a499e50107e6ba0064368c6d84c5ecce596bb420114336c3a2bdb86d0be9aa8`. Original test **44,765-byte prefix** is unchanged; no original64 assertion was removed/relaxed. `freeze-verification.json`, `source.diff`, and `final-freeze.json` preserve this proof. Producer meaningful red04 retains original64 PASS/new12 FAIL against exact B; failed setup and later corrected check inputs remain visible. Early deterministic scratch reconstructions are explicitly disclosed by the producer and are not treated as contemporaneous receipts. Final-source acceptance relies on independently observed execution here.

The entire source diff changes one import to private aliases, adds synchronous wrappers, and supplies `uncertain` to the pre-existing settlement identity guard. There are no inserted/reordered DB effects or authorization calls, new registration/schema/public API/capture fields, replay paths, or profile changes. Producer actual registration fingerprints bind all14 existing internal names/args/returns; minimal diff and original registration outcome tests confirm no registration modification.

## Requirements review

| Requirement | Met within this bounded repair? | Evidence |
|---|---|---|
| Preserve authentic source codes in sanitized native envelopes | Yes | runtimeModelPolicy.ts:30–65; PURE model-policy.ts:115–118,199–218,240–265,363–365; exact envelope assertions tests:473–555 |
| Closed anchored taxonomy; unknown/subclass/non-Error/Zod/hostile metadata propagation; existing typed identity/data preserved | Yes | runtimeModelPolicy.ts:37–51 checks exact Error prototype and own data descriptor, six literal prefixes; producer adapter14 plus fresh adapter18 outcome probes |
| Normalize only actual synchronous PURE calls, with no blanket handler/DB/auth catch | Yes | aliases/wrappers:55–65 and complete `source.diff`; fresh actual-handler source-looking DB exceptions retain original Error identity |
| Preserve canonical collision/idempotency/current authorization, economic liability and ordering | Yes | unchanged call sites admission:465,489; checkpoint:566; settlement:673; original64 and new identity/checkpoint/settlement cases; fresh codec denial keeps settled40 plus separately pending100 and original private result |
| Refused request/admission action not_dispatched; conservative shared/settlement denials | Yes | wrappers:55–65; settlement identity:673 explicitly uncertain; envelopes do not modify stored attempt/account fields or assert absence of previous charges |
| Keep invalid private result withholding/charges and safe fallback semantics | Yes | unchanged validatedPrivateResult:636–655, settleAttempt:658–700; canFallbackModel remains unwrapped and unchanged; original economic/privacy/fallback tests PASS |
| Preserve all original assertions and provide actual-handler/installed-codec outcome regressions | Yes | exact prefix proof; independent main76, copied76+fresh5, and actual invokeFunction serializer assertions; no resolver/assertIdentity/codec mocks |
| Affected checks and precise evidence without native overclaim | Yes | independent types/lint/dependency638/discovery PASS; every command has argv/cwd/UTC/source/config pre/post, raw streams and status; native remains incomplete |

## Independently observed checks

Node24.19.0/npm12.2.0 through prescribed `work/resume/toolchain-bin`. Standalone Jest configs have empty setup arrays and do not load root dotenv/service setup.

| Check | Outcome |
|---|---|
| Exact current admission test file |76/76 PASS, one suite |
| Relocated exact original76 plus fresh actual-handler/codec probes |81/81 PASS, one suite; **5 genuinely new** outcomes |
| Fresh private adapter investigations |18/18 PASS, one suite |
| Affected domain/runtime/auth/memory/Gateway dependency selection |638/638 PASS,13 discovered suites |
| Scoped strict types |PASS, exit0 |
| Owned ESLint max-warnings0 |PASS, exit0, empty error output |

All selected tests have zero pending/todo, no skipped suite/test, and all command source/config snapshots remain identical. `test-summary.json` provides precise discovery; dependency selection contains no standalone transcript suite. Service-dependent transcript/integration checks were not executed. No additional build was run because this reviewer owns only new QA/scratch outputs: producer build and packed/browser contracts were directly inspected, successful, and tied to the identical final backend/PURE/schema/Gateway bytes; their earlier appended-test setup hashes are disclosed, with final tests independently checked here.

Fresh probes use actual registered handlers and installed compiled `invokeFunction`, not a replacement serializer. They decode actual encoded error data with installed `jsonToConvex`. One verifies refusal after an earlier settled40 charge and another dispatch_pending100 preserves complete account/operation/attempt snapshots and write count. Another verifies conflicting settlement retains the known charge and stored private result with uncertain envelope. Three prove source-looking exceptions from DB/auth lookup are not normalized by a blanket catch. Fresh adapter18 includes nine closed-prefix negatives, Error subclass/inherited/getter cases, descriptor-trap proxy identity, existing ConvexError identity/data, and authentic canonical-cycle/identity/resolver outcomes plus actual PURE unknown-cause propagation.

`node_modules/convex/src/server/impl/registration_impl.ts:84–92,112–126` serializes only ConvexError-symbol values; `src/browser/http_client.ts:398–407,608–611` preserves structured HTTP data only when errorData exists. This repair fixes the diagnosed boundary and the in-process codec path. These are authentic installed-dependency observations, **not live native HTTP evidence**.

The review-only helper source copy differs solely by absolute import relocation and appended private-helper export, preserved in `adapter-source.diff`. It adds no product export. The review handler copy changes import locations and appends fresh tests, retaining all76 existing assertion bodies. Inputs, exact source copies and command runner are archived in `check-inputs/`; `external-artifacts.json` maps each unique scratch file to its hash and preserved copy. No failed verification attempt occurred in this review. Exploratory initial `qa/` lookup was corrected to the profile-defined goal QA tree; no product/test change followed.

## Dimension scores

| Dimension | Score | Evidence |
|---|---|---|
| Requirement Fulfillment |5/5| Every bounded repair requirement verified; original Task04 criteria remain explicitly deferred |
| Code Quality |4/5| Small private synchronous adapter, descriptor-safe inspection, deliberate propagation, no effects/catch broadening |
| Test Quality |5/5| Original assertions unchanged; expected red preserved;23 fresh outcomes plus actual codec/state comparisons and638 dependency outcomes |
| Pattern Adherence |4/5| Reuses existing generic fail envelope and accepted PURE services, exact native contract and internal registrations |
| Completeness |4/5| All changed paths wired and affected offline checks pass; native/service completion is a separate mandatory gate |

## Issues found and material limitations

No critical or important defect found in the exact bounded repair. Shared canonical/resolver paths intentionally use uncertain even in pre-dispatch contexts: conservative and less precise, while preserving liability and refusing unsafe permission. Arbitrary transparent JavaScript proxies can impersonate ordinary Error metadata; the adapter does not establish universal proxy provenance. Production RPC/storage inputs are JSONlike and PURE calls are source-owned; no broad callback/public exception classifier was introduced. Trap failures/getters/subclasses are independently covered. This limitation is documented rather than disguised with unavailable Convex-runtime Node proxy detection.

Synthetic DB tests do not prove OCC/isolation/rollback/publication/crash behavior. Actual C6 fourth-case failure, supplied server traceback, cleanup54/54, zero processes, and DELETE200/GET404 retirement are preserved parent context, not independently repeated live observations. No live service/network/RPC/storage/native/deployment/signing/credential/physical-ID inspection was performed.

## Recommendation

This PASS permits only **new C7 fixture preparation** bound to accepted B2 plus these exact repaired bytes. Preserve C6 and every prior failure unchanged. Require fresh independent fixture/parent-input preparation reviews, a new verified disposable nonpaid native run, publication/transport/OCC/rollback/crash/cleanup outcomes, verified retirement, and an aggregate native judge. No prior failed native gate becomes PASS through this product judgment, and no all04/full03/fullgoal completion is authorized or claimed.
