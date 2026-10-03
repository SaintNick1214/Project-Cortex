# Supplemental Task Judgment: current MF optional READ infrastructure failures

## Verdict: REJECT — confirmed additive blocker

Current integration must not be marked fully accepted until this supported callback-error boundary is repaired and independently rechecked. The earlier original42 offline MF FINAL PASS report remains immutable; this is an additive current-source finding, not a rewrite of its evidence or verdict.

## Source proof

Inspected current main runtimeDataAuth.ts:621 optionalMutationRead and runtimeAuth.ts:247 requireAuthority. A valid WRITE-only mutation calls requireAuthority for independent READ. requireAuthority directly awaits `ctx.auth.getUserIdentity()` before resolveAuthority. optionalMutationRead catches every native ConvexError whose data.code equals FORBIDDEN, rechecks the persisted WRITE reference, then returns undefined if that writer has no READ capability. This catch cannot distinguish a genuine resolver permission decision from an identity callback infrastructure exception.

The WRITE recheck uses a persisted reference and ctx.db; it does not re-invoke the identity callback. Consequently, an infrastructure failure during optional READ becomes a successful committed safe receipt. The catch also reads arbitrary error.data and data.code accessors instead of treating the thrown value as untrusted diagnostics.

Exact reviewed bytes and hashes are in source-manifest.json and source/*.text. The source snapshots are evidence only; no main/candidate/history code was changed by this review.

## Independent meaningful actual-handler probes

`probes.mts.text` invokes actual current registered memories.store, memories.update, memories.updateMany, facts.store and facts.update via the retained transaction-aware fixture. Facts creation is exported as facts.store; there is no facts.create registration to invent. Each case provisions an initially valid WRITE-only grant. The identity callback returns healthy verified identity for initial WRITE admission and throws/rejects only when its exact captured stack contains optionalMutationRead. This injection does not mutate database records or cross an assumed snapshot boundary.

The native exception is imported from the same installed `convex/values` module as production. A preliminary different-import class experiment was noncertifying: class identity must match for instanceof. The final saved80-case matrix uses the correct shared native class and is the certifying run.

| Actual handler | Healthy READ-less positives | Callback false committed receipts | Ordinary Error denial + rollback |
|---|---:|---:|---:|
| memories.store |2/2|12/12 failures|2/2|
| memories.update |2/2|12/12 failures|2/2|
| memories.updateMany |2/2|12/12 failures|2/2|
| facts.store |2/2|12/12 failures|2/2|
| facts.update |2/2|12/12 failures|2/2|

Total80 cases:20 meet expectations,60 fail. The60 failures are six native FORBIDDEN error variants times synchronous throw/rejected Promise times five operations:

- Exact static accepted envelope: `{version:1,code:"FORBIDDEN",message:"Access denied",retryable:false,outcome:"not_dispatched"}`.
- Code-only malformed envelope.
- Exact envelope plus synthetic private diagnostic field.
- Envelope with synthetic private diagnostic as message.
- Native exception with an own data accessor returning the exact envelope.
- Native exception whose data.code is an accessor returning FORBIDDEN.

Every failure explicitly reaches the optional READ callback, succeeds, returns mutationReceipt:true and has rolledBack=false with actual table effects recorded. Store cases commit canonical source and new row; updates commit row/source/version changes as appropriate; updateMany commits importance77. All injection stacks and attemptedWrites are retained. updateMany can invoke the failing optional READ callback twice, once before effects and once during post-effect delivery. Other tested handlers reach it once. Data accessors run four times per callback; code accessor runs once. Getter invocation therefore is observed rather than inferred.

Ten ordinary Error controls throw at the identical callback boundary and fully restore fixture rows. Ten healthy identity/initially absent READ controls return usable safe receipts. These controls rule out invalid WRITE grants, inherently failing mutations or a receipt-policy dispute. Baseline initially READ-less behavior must be preserved by the repair.

The certifying command was `node node_modules/tsx/dist/cli.mjs work/resume/mf-optional-review/probes.mts` from `/workspace/Project-Cortex`. It exits1 by design because60 expected abort/rollback outcomes fail. Raw stdout is probes.json; stderr is probes.stderr; summary.json gives per-operation reached outcomes.

## Requirement and boundary classification

The current original Task03 rule requires unexpected infrastructure failures to abort, rather than falsely commit a safe receipt. Optional READ may be absent as a valid permission outcome, but a failing verified identity callback is not evidence that READ is absent. Both an exact safe-looking exception and an accessor/malformed/private diagnostic exception originate inside that callback; the origin is unambiguously captured by the injected stack.

This is distinct from the previous final-DB-await synthetic snapshot limitations. There is no injected query database write, already-read-row replacement, foreign transaction or impossible alternating reload requirement. The platform identity method is an awaited effectful/error-producing boundary that the actual requireAuthority implementation invokes. Its synchronous throw or promise rejection is propagated into the actual catch and swallowed. The fixture establishes actual handler outcome and rollback behavior; it does not establish that a deployed identity implementation currently emits these exact exceptions or demonstrate a live exploit.

The exact static envelope must still abort when emitted by the callback. Tightening only the envelope shape will fix malformed/private/accessor acceptance but will leave the exact-origin failure. Error shape alone cannot establish policy provenance.

## Recommendations

Separate infrastructure acquisition from resolver permission decisions. Protect invocation and await of getUserIdentity (and applicable low-level authority reader callbacks) so any callback exception becomes a fixed opaque operation-failure envelope outside the optional-read permission-denial class. Genuine resolver-produced missing READ remains eligible for a WRITE-only receipt. Reject unknown thrown values without invoking getters, returning private diagnostics or passing raw exceptions back through admission pruning.

Add meaningful regression outcomes for exact native FORBIDDEN callback failures as well as malformed/private/accessor/synchronous/rejected cases, requiring denial and full rollback. Keep ordinary initially absent READ receipt positives and the previously admitted READ revocation/expiry denial assertions intact. Independently recheck actual handlers after repair; passing older371 tests cannot certify this newly exercised error origin.

## Dimension scores for this supplemental requirement

| Dimension | Score | Evidence |
|---|---:|---|
| Requirement Fulfillment |2/5|60 reached infrastructure failures yield committed safe receipts |
| Code Quality |3/5|Policy/infrastructure origins conflated; error getters invoked |
| Test Quality |3/5|Retained baseline positive/error coverage omitted this callback-origin boundary; independent controls establish defect |
| Pattern Adherence |4/5|Scoped trusted WRITE reference remains checked, but optional READ error treatment needs origin protection |
| Completeness |4/5|Affected shared helper wired to all five exercised registrations; current source and effects proved |

Average3.2/5. The confirmed current infrastructure-error blocker requires repair; earlier reports, histories and failed raw outcomes remain preserved. Schema/consumer/generated-binding and live gates remain separate, incomplete work.
