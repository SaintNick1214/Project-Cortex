# Task Completion Report

## Status: source/test COMPLETE; independent review and installed cloud measurement pending

Fresh Agent starts now use the supported Workflow 0.4.8 immediate initialization option, startAsync:false. The original inserted execution is available before the initial handler runs. The unchanged V4 handler performs only its original inline startContext/contextBarrier prefix, then durably queues its non-inline routing mutation or strict-barrier sleep. Paid context/model/tool Actions remain durable steps; they do not run in the parent admission mutation. Original V1/V2/V3/V4 registrations and complete journal layouts remain byte-identical against product source 2a08b37c23dc4066634d2735da219cb5d09900df.

K12's supplied server runCreated-to-initial-Workflow intervals were 2.513/1.636 seconds. Avoiding the startup queue is prospective: this change moves initial guarded work into admission and may increase admission latency or its transaction read set. It does not remove later durable handoffs, protected context/model work, provider acquisition or observer delivery. K12's original browser/CLI latency failures remain intact. No native cloud or under-one-second success is claimed for this source batch.

## Bounded early-completion repair

Installed Workflow completeHandler invokes onComplete synchronously. An initial inline handler failure could therefore reach the original strict callback before workflow.start returned and before the execution's workflowId was attached. The new internal onInitialWorkflowComplete registration is used only by fresh starts. If an ID is not yet attached, it reads the actual component document through its supported registered workflow.getStatus query, requires the exact actual document ID, generation zero, no in-progress steps, exact resolved V4 Workflow function handle, exact resolved fresh completion function handle, canonical attempt and callback context equality, canonical completed-result equality, and the original ready execution/attempt/reference/lease identity. It attaches only that proven ID, then invokes the unchanged original onWorkflowComplete registration. Resolved handles establish executable identity without assuming a particular native module-name spelling.

The original callback's strict workflowId comparison and full body remain byte-identical. Already attached callbacks still go through it and refuse mismatched IDs. The parent verifies any early attachment agrees with the ID returned by Workflow and reads the actual execution state before its final attachment, so an early failure is returned consistently with the original getHandler run state. Original failure/UNKNOWN/cancel disposition, output status, queue recovery and budget behavior remain in endInterrupted unchanged. Failed document/ownership proof refuses completion effects; the official component retains its existing onCompleteFailures behavior. There is no new public callback or caller-selected workflow, retry, account, model or authority lane.

The installed-contract test runs the real WorkflowManager, start, registered Workflow interpreter, deterministic environment and official component completeHandler with controlled DB/component ports. It proves initial execution visibility, separate context scheduling, strict sleep, journal replay, a paid Action queued without execution, actual early failure completion, the unchanged legacy callback's original early refusal, ten forged document/context/result/handle/attachment negatives and rollback/fresh retry. These ports model native function isolation and transactional rollback; they do not certify Convex engine OCC or cloud scheduling.

## Fresh model-preparation authority scope

Only prepareModelOperation's registered mutation now constructs an invocation-local raw authority read scope and passes that scoped writer through its unchanged original handler. The four original preparation helpers, all hydration/source/transcript/lease/definition/budget/replay/currentness predicates and their ordering remain unchanged. No hydrate/source/finalDelivery/observe entry was activated. Every write/child mutation continues to invalidate the existing factory's read epoch.

The actual-handler differential fixture retains exact results, persisted/native/scheduler state and non-authority read ordering. Its controlled raw-authority read count is 192 unscoped versus 28 scoped, with two grant reads across the operation-insert epoch. The late revocation insertion port is still rejected and the complete parent rolls back. Existing execution/guard negatives and model ownership/ledger/Gateway dependencies passed unchanged. These counts are fixture evidence, not native latency or DB-byte savings. The scope contains raw rows only; it does not cache authorization decisions, profile state or cross-invocation data.

## Requirements checklist

- [x] Immediate fresh start uses the installed documented false/default contract; original claim/execution insertion precedes it.
- [x] Exact old V1–V4 registrations/layouts and original completion callback are preserved; source equivalence receipt compares every original top-level statement.
- [x] Supported trusted component completion proof resolves early callback attachment without weakening the original equality assertion.
- [x] Context/barrier/model/tool actions, strict deadlines, failure ordering, replay and budgets remain in their original bodies.
- [x] Fresh prepareModelOperation raw scope preserves original body, sensitive negatives, writer epochs and state equivalence.
- [x] Meaningful installed-contract/native-handler tests and affected dependencies pass; original failure receipts remain available.
- [ ] Independent non-author verdict and fresh immutable candidate install/cloud/SLO measurements are pending root orchestration.

## Verification

Node v24.15.0; npm 12.2.0; explicit cwd /Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion. Offline fixture environment sets CORTEX_TEST_ENV_MODE=explicit and CONVEX_URL=http://127.0.0.1:9; selected tests have no service/model calls. Exact commands, paths, exits and raw receipt hashes are in cloud-workflow-start-checks-final.json.

| Check | Observed result |
| --- | --- |
| Initial scope-only existing execution regressions | 86/86, zero skips, exit 0 |
| Original installed-Workflow fixture | 11/18 passed, seven failures, zero skips, exit 1; preserved |
| Corrected installed-Workflow native isolation fixture | 18/18, zero skips, exit 0 |
| Final affected Agent/Workflow/transcript/model-ledger/Gateway/admission/read-scope gate | 1,094/1,094 across 21 suites, zero skips, exit 0 |
| Actual test discovery | Exactly 21 requested test paths, exit 0 |
| Backend TypeScript | Exit 0 |
| Root CI TypeScript | Exit 0 |
| Lint TypeScript | Exit 0 |
| Scoped ESLint, four affected files | Exit 0 |

The seven initial failures were a controlled-port error: installed setupEnvironment disables global crypto, while the old direct in-process handler invocation shared that global instead of entering a fresh native function environment. The correction restores crypto only inside native query/mutation ports, leaves the real Workflow environment active, and adds an exact controlled initial-failure assertion. No production hashing, assertion or guard was changed to hide those failures. Original v1 logs/JSON remain unchanged. Watchman's existing recrawl warning is retained; discovery's raw 27-line count included six warning lines and the final receipt identifies the actual 21 test paths. No Watchman reset or unrelated fixture edit was performed.

No build, packaging, deployment, service mutation or inference was run for this batch. Those installed-candidate outcomes remain separate.

## Files modified and frozen

| File | Original SHA-256 | Final SHA-256 |
| --- | --- | --- |
| convex-dev/runtimeAgent.ts | 7a70ee756f2fb8e99e2fa873b9b8f403f936f3199dfee85e8aacb45ad24a1a60 | 1ec557cb9f652dc49ee932677bddf84ec6ea6494eaee78ed66919e18ef242089 |
| tests/unit/runtimeAgent/start-native.test.ts | New file | 02427e532b2c25831f3a921e345b0988235935518466e32cf0d98c2b7a34a6a1 |
| tests/unit/runtimeAgent/empty-context-inline.test.ts | 33052c90b19a0cbffce2239c9d29643c2680f860e483471308a6fd7a07397db7 | 3cca1de5ec87f020cf82ff3fc4940a650deba0afcfaa2424f2b28e8872f87102 |
| tests/unit/runtimeAgent/context-routing.test.ts | cc59ec56b45652467c834d2f1fa5b3576cad59853b8334e08917db972320d078 | 00604ae5e9cb97534e51dd0139a82aeb201134428b03a8a7e8f2e0b71184efcb |

Production change is confined to runtimeAgent.ts. The two existing test edits intentionally change only fresh-start option/callback expectations and their descriptions; all historical/body/replay assertions remain. start-native.test.ts is new. No existing model/preparation/source/final-delivery/observation test assertion was dropped or weakened. No generated bindings, schema, compiled manifest, Gateway wire, Proofs, package/version, deployment or documentation file was edited.

## Notes for reviewer

Author self-assessment, not an independent verdict: requirement fulfillment 4/5, test quality 4/5, completeness 4/5, code quality 4/5, pattern adherence 4/5. Evidence includes five complete installed-primary-source files with literal contract excerpts and hashes in cloud-workflow-start-primary-contracts.json, exact original/current AST comparisons in cloud-workflow-start-equivalence-final.json, and raw commands/results in cloud-workflow-start-checks-final.json. The actual product baseline remains 2a08 even though root's separate QA-only commit advanced HEAD; no product baseline was reset.

The early wrapper adds a document query only before an unattached callback and one small local execution read after Workflow start; later callbacks retain the original path. Immediate initialization still joins the prefix read set with admission, so native conflict/scheduling behavior and any net latency benefit require the next installed cloud observation. A separate routed context mutation and all downstream guards remain intact. The under-one-second goal remains unmet.
