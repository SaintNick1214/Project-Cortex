# Agent hydration and model resolution composition

Source batch complete, 100% of the bounded implementation/check milestone. Independent source acceptance and fresh hosted latency qualification remain pending. Repository: private Project-Cortex, continuation checkout /Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion. Baseline 6eb45386fb146be330c5c58419e840015b4e936d.

The model action now invokes one Agent-only internal resolveModelOperation query at each of its two original fresh resolution intervals. Each invocation first runs the unchanged executionContext helper, checks the exact current run budget, then calls the byte-identical exported model-policy resolve body in the same native query context. The policy registration and hydrateExecution registration remain available. The action adapter retains its embeddingValuesPerCall === 1 fail-closed check and rejects altered internal reference/key/budget/source/parent tuples. No model policy, account, qualification, grant, epoch, source, lease, cutoff, definition or transcript check is cached or removed.

This reduces four action-to-query RPCs across these adjacent pairs to two. It does not eliminate the two native helper bodies, their repeated current checks, component reads, or later fresh admission/checkpoint/context/visibility/attachment intervals. No timing reduction is asserted: K10 measured pre-stream duration included retained work, and this source was not deployed.

The new query cannot select a model, policy lane, source, parent, request or account. Original execution checks retain precedence over the unchanged policy checks. An additional internal exact current-budget mismatch returns POLICY_DENIED after Agent hydration; substituted action resolver tuples are rejected after the fresh parent response. These internal tuples are not produced by the original detached Agent binding. Each parent shares one consistent native read snapshot, replacing the old pair of separate action transactions; each subsequent parent call still has its own new snapshot. Installed Convex QueryCtx.runQuery documentation explicitly states component/nested queries use the same read snapshot. No claim is made that controlled port fault injection is native OCC.

The equivalence receipt uses zero masks or normalization. It confirms byte equality of the original model-policy resolve body, executionContext, prepareModelOperation, Agent admission/checkpoint, the entire later model lifecycle/output/context tail, and tool execution path. Generic runtimeGateway/runtimeGatewayBackend, transcript, context-witness and Agent budget fences remain byte-identical. Thus secondary-call ledger controls, replay/UNKNOWN liability, settlement, output projection, cancellation, canonical messages and journal semantics stay on the established paths.

Checks: 26 new focused tests passed on frozen source; 47 focused/ownership tests passed together; 1,025 affected tests across 19 suites passed, zero skipped. Root/backend/lint types passed, plus ESLint with zero warnings. The tests compare actual registered original handlers against the composition for exact return, error data/order, all recorded DB/index/get/component read order, and zero writes/effects; cover current grant/principal/membership/epochs/cancellation/lease/attempt/definition/conversation/transcript/context hash/tombstones/root/payload/qualification/account authority/agent pin/proof expiry; and use the actual governed Gateway constructor to prove both fresh resolutions remain wired. Separate late grant/qualification failures between those intervals deny before inference or final output. The official model factory is constructed but the controlled Agent never calls its paid port. Existing affected suites cover generic secondary calls, replay/UNKNOWN accounting, cancellation, admission/checkpoint and terminal attachment.

Original focused 43/47 result, the first shell exit-capture error, and first lint error are preserved in raw receipts. The windowId fixture did not reject in the original resolve handler; it was replaced with a real account agent-version fault rather than inventing a new accounting requirement. The synthetic OFFLINE_ONLY proof was correctly rejected; constructor tests use the existing ingestion qualification fixture. Native component hooks now distinguish component references. The final lint fix only renamed a type-only validator identifier after the affected run; the final frozen focused run and lint passed afterward.

No services, inference, deployment, packaging, Proofs/docs/browser changes or Git commits were performed. K7 warm CLI deadline failure, K9 two authentication-code mismatches, and K10 latency/SLO failures remain unchanged. Native qualification/latency belongs to the next fresh immutable candidate.

## Frozen files

- convex-dev/runtimeAgent.ts: fa7d5783beabf3ce67c283a0fed2b78592803cad571a580e11f02eaa42c70385
- convex-dev/runtimeModelPolicy.ts: c4a76cef99abffd103004345d93643f184a835ef5a29a3d5142305a33ef2e921
- tests/unit/runtimeAgent/model-owner.test.ts: 58244b0cdfae21138a0feaf7b32bfd5070553814b3bdbcad8308aa4bb17c2659
- tests/unit/runtimeAgent/resolution-composition.test.ts: 53a3aa58e2f80f9bdd7efe33f2993c8bb67c9ce90290ec0b21d4f1b7cbc5daf4

## Evidence

- cloud-agent-resolution-composition-checks.json: commands, tool versions, exact counts, hashes, failures and limitations.
- cloud-agent-resolution-composition-equivalence.mjs/json: exact old/current body equality and unchanged generic/fence paths.
- cloud-agent-resolution-composition-focused-final.json/log: 26 final frozen-source tests.
- cloud-agent-resolution-composition-affected-jest-v1.json/log: 1,025 affected regressions.
- cloud-agent-resolution-composition-jest-v1.json/log: preserved original four fixture failures.
