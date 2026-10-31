# K27 V8 prompt trust and order repair

Status: source implementation and finite checks complete; independent joint review and actual installed K27 behavior remain pending. Repository: SaintNick1214/Project-Cortex. Task milestone 100%; the parent latency follow-up remains 50% and the under-1,000 ms goal is unmet.

The K26 private request-order receipt proved that the current CLI46 user message was retained, followed by a system-role recalled-context message containing the older READY46 directive. The canonical and private attached reply was READY46. This establishes the request trust/order defect, not a claim about the model's internal reason for that answer. The frozen K26 receipt and failures remain unchanged.

## Change

`convex-dev/runtimeAgentContext.ts` now owns one pure `buildV8AgentMessages` constructor. Nonempty retrieved memory, fact, pending and incompleteness text is a JSON-quoted evidence string inside an explicitly framed assistant data message, before the unchanged selected executable conversation. Source-role annotations remain text inside that data. They do not become active system/user/tool roles. Static administrator instructions still travel through the original official Agent `instructions` field.

The V8 fitter, fresh V8 preflight, and production Agent contextHandler use that same constructor. Both checking callers pass `context: ""` to the unchanged official assembled checker, preventing its historical trailing-system adapter from reintroducing the defect. The same official SDK conversion and original native request validation bind and account for the actual framed body. The frame/JSON escaping contributes to the existing exact input bound; optional whole-entry shedding can occur earlier. Selected entry caps, complete mandatory tool groups and current input, output reserve, 32,768 qualified input ceiling, all accounting and source/authority guards are unchanged.

The contextHandler branches only for snapshot version 8. Its original V1–V7 trailing-system expression is unchanged. No new module, endpoint, schema, registry, package version, SDK export or catalog was added. The originally suggested runtimeAgentGateway.ts path does not exist; root authorized the surgical correction to the actual existing runtimeAgentContext.ts. No shared-domain or Gateway checker body change was needed.

Canonical native message rows are unchanged by construction. Installed Agent startGeneration uses contextHandler output for model input, then saveInputMessages receives the original prompt/messages, not the synthetic context. The actual installed-start controlled test proves the evidence is not stored as a synthetic canonical row, while the original pending output effect remains.

## Freshness and delivery boundary

The requested extra-hydrate investigation found a concrete incompatibility with removing that RPC. The installed Agent calls contextHandler before creating its durable pending output. The original fresh grant/transcript/bound-growth negative contract denies before that write. Final native model admission happens later. Reusing prepared payload in place of the fresh hydrate would permit a new pending effect before those refusals. The RPC and all its fresh checks are retained; this batch claims no latency saving from it.

## Verification

The passing per-file union is 176 cases across nine files: prompt-trust 5, bounded-context 21, installed preflight 22, and six dependency files totaling 128. This is a coverage union, not a single 176-case run. The final assertion type-guard follow-up selected one test, passed it, and filtered 21; its earlier complete 22-case result is retained. Backend types, owned/transitive test types, scoped lint and final changed-test lint all exit 0. Root owns the later single shared build/packed-contract gate.

Actual official AI SDK generateText and governed middleware on controlled ports produce byte-identical canonical requests to the early checker, including the assistant evidence prefix, static system instructions and complete tool call/results. Boundary tests cover exact fit, one-unit overflow, Unicode/escaped-byte overhead, optional whole-entry removal, mandatory-only refusal, unchanged 4/4/4/4/16 policy and pending/notice behavior. Installed official Agent startGeneration exercises the production contextHandler with controlled ready-context candidate delivery; initial recall preparation is separately covered rather than claimed by that test. Fresh-hook negatives assert the hook actually ran and refuse before pending storage or any model-attempt effect. Existing Workflow history, authority, source and bounded selection regressions pass.

The exact source inverse restores both entire production files to the accepted 9fb968 baseline after removing only the documented constructor/import/V8 call changes. runtimeGateway.ts and the shared input-selection domain are byte-identical to that baseline. This is source evidence, not native runtime acceptance.

## Preserved failures and limits

The first new wire test incorrectly treated texts as the structured message array (4/5 initial pass); the corrected test uses the actual request.messages contract. The first complete fixture run preserved 47/48 with an OFFLINE_ONLY proof refusal; its apparent new negative successes are not counted as fresh-hook coverage. The successor installs the existing qualification-shaped fixture and proves hook reachability. Two type-check failures preserve the omitted QA rootDir and a new unknown row.message assertion; both have focused successors. A QA inverse mask initially removed a blank line; its failure is retained and only the mask was corrected. No original assertion or cap was weakened.

No service, provider, inference, deployment, package build, Docker, Proofs/website change or Git mutation occurred here. All tests use Node 24.15.0/npm 12.2.0 with explicit offline test configuration. There is no model-compliance guarantee or fresh native/SLO PASS. The K26 wrong-marker and four latency failures remain original failures until an independently reviewed immutable candidate is measured.

## Files and receipts

Owned production: convex-dev/runtimeAgent.ts; convex-dev/runtimeAgentContext.ts. Owned tests: tests/unit/runtimeAgent/prompt-trust-v8.test.ts; tests/unit/runtimeAgent/request-preflight.test.ts. Exact hashes and all raw receipt references are in k27-prompt-trust-freeze.json and k27-prompt-trust-checks.json. The source comparisons are k27-prompt-trust-source-equivalence.json.
