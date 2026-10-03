# Task 01 completion report

Status: **COMPLETE within the bounded qualification scope; independent Task01 review PASS (4.2/5).**
Observed 2026-10-03 on owned disposable development deployment `efficient-ox-979`.
The parent coordinator's ownership/isolation receipt governs deployment authorization.
No production SDK/backend/provider/manifests changed; no staging, commits, production
deployment, package release or merge performed.

## Requirements and acceptance matrix

| Requirement | Result | Observed evidence |
|---|---|---|
| Exact compatible package/runtime locks | PASS | fixture/package-lock.json; evidence/lock-runtime.json; actual components installed in evidence/deploy.txt |
| Node >=24.15.0 / npm12.2 | PASS | Node24.19.0; actual npm12.2.0 command stdout in evidence/check-commands.json |
| Real verified identity; no admin impersonation | PASS | signed-JWT-identity-and-boundary: owner, no token, denied grant, bad audience, expired token, invalid signature; private peer 403 without its secret |
| Same-role ownership isolation | PASS | equally eligible signed other owner denied run read/reconcile; owned operations derive/stash trusted owner and other-owner lookup returns null |
| Authenticated actual Gateway text | PASS | evidence/gateway-chat.json: READY.,13 tokens; service token handled action-locally by official provider |
| Actual structured output | PASS | live-gateway-structured: Output.object returns `{ready:true}` |
| Qualified native interface | PASS | live-gateway-responses: explicit Responses interface returns READY.; Messages capability is documented/unqualified |
| Actual Agent/Gateway backend tool | PASS | live-agent-gateway-backend-tool-and-dedup: add(2,3)=5; one attempt/tool effect; duplicate request returns existing run, conflicting scenario rejected |
| Actual Gateway multiobserver/disconnect/reconnect | PASS | live-Gateway-tool-disconnect-multiple-observers-no-replay: disconnect during backend tool delay; two WebSocket observers; one attempt, one effect, one final receipt; identical canonical final IDs on reconnect |
| Persisted stream cursor replay | PASS | persisted-Agent-stream-multiple-observers-reconnect: saved delta-end cursor, strictly resumed deltas, one execution; synthetic slow model on real managed Agent/Workflow/Convex explicitly labeled |
| Cancellation, terminal state and partial output contract | PASS | persisted-Agent-stream-cancellation: cancelled ledger, aborted stream, no final ingestion, duplicate start does not execute again; active cancellation observed; terminal late-cancel guard source-inspected, separate live assertion downstream |
| Final-output/ingestion cross-component transaction | PASS | forced mutation failure rolls back Agent canonical final and parent receipt; success writes one of each |
| Automatic action finalization gap recovery | PASS | forced-after-final-before-receipt action boundary; durable message detected and reconciliation adds one receipt; second reconciliation adds zero |
| Ambiguous external outcome/no replay | PASS | real private HTTPS effect commits once; forced loss before local receipt; Workflow records uncertain; repeated start/recover retains one attempt/effect, replay disallowed |
| Raw private reasoning suppression | PASS after fix | synthetic private marker persisted by Agent; public messages/streams reconstructed from allowlist; whole serialized snapshots contain no marker; failure history in privacy-finding.json and privacy-failure-stdout.txt |
| AI SDK7 typed text/tool/cancel UI transport | PASS | evidence/transport.json: real readUIMessageStream decodes exact final text/tool input+result; detach does not cancel; explicit abort requests cancellation once |
| Browser-safe module isolation | PASS | esbuild browser bundle inputs contain only transport.ts; no backend/provider/Node module path |
| Frozen v1 text/run/event/error contracts | COMPLETE | contracts.md, based on observed APIs and failure boundaries |
| Fresh default embedding profile/index contract | COMPLETE | contracts.md: Gateway text-embedding-3-small/1536, NFC/LF,1600-codepoint/200-overlap; separate sources/chunks/vectors and trusted scope/profile/currentness |
| Honest service/UI extension gates | COMPLETE | actual managed embedding/retrieval required before Task09; graph/media/assets/additional profiles at later task gates; native browser tools absent and interactive UI coverage not claimed |

The final aggregate live receipt has 10 PASS checks. Gateway Chat is a separate
observed receipt; strict typecheck and transport tests both exited 0. See
evidence/check-commands.json for raw command output and evidence/live-receipts.json
for outcomes and IDs. A failed initial JWT assertion used a too-narrow expected error
regex; Convex correctly rejected the bad signature. That initial receipt is retained,
and the corrected auth assertion was rerun alone. The privacy check found redundant
Agent reasoning metadata and was corrected, then rerun with the stronger whole-public-
snapshot assertion. No failed outcome is relabeled without an observed successful rerun.

## Changes made and reproducibility

All created deliverables are under this `qa/task01/` tree. The exact inventory is
evidence/changed-paths.json. Fixture includes pinned manifest/lock, Convex component
configuration/auth/schema/runtime/Gateway/workflow/private-peer spikes, actual generated
bindings, browser-only typed transport and command/key/deploy/live/check runners.
Downloaded primary docs and exact installed API excerpts are retained in evidence/.
Fixture/README.md gives standalone npm12 install/deploy/check commands and prerequisite
paths. Private test key and peer secret remain only in mode0600 scratch under
`work/backend-runtime/qualification/`; caller JWTs are generated in memory. The CLI-
generated fixture .env.local was removed; explicit private target env-file selection
remains mandatory. node_modules and env files are excluded from fixture deliverables.
The repository ignores `_goals/`, so the coordinator must explicitly force-add reviewed
QA deliverables if committing them. This executor staged nothing.

## Notes for reviewer and remaining gates

Explicit mutation composition is atomic across the Agent component and parent tables.
Automatic Agent streaming commits from an action and needs the selected durable cursor/
outbox reconciler; do not infer action-wide atomicity from the mutation spike. Agent
stores raw reasoning in message parts and top-level reasoning/ reasoningDetails;
production adapters must reconstruct approved public fields rather than expose raw
component documents. Gateway failure classification must track dispatched/outcome state
and distinguish capability eligibility from rejected/ambiguous model calls.

Synthetic slow streams prove deterministic persisted cursor/cancel/privacy windows;
actual Gateway/tool observer-disconnect evidence separately proves no duplicated live
effects. The interrupted HTTP peer is a real network effect with deterministic forced
loss; no paid-provider process was forcibly killed, and no upstream resumption or
idempotency guarantee is claimed. The minimum transport is a typed/protocol fixture,
not the later product UI. No native browser interaction evidence is available.

Managed retrieval for the frozen default profile is an explicit dependency before
Task09 PASS and has not been executed by this text qualification. Full production
auth/revocation/source-revision/policy/memory/UI implementations remain downstream.
Fixture test rows, Agent history/deltas and Workflow state are retained on the dedicated
target for independent review; the coordinator must clean/retire them before target
reuse. They contain generated test content only. No host/shared CI/business data touched.
No unresolved technical conflict blocks the next foundation tasks once fresh Task01
independent review passes.

Parent review note: retained final matrix combines spike revisions. Older tool
check has two ingestion rows; newer actual Gateway observer check proves one
final receipt on current code. See ../task01-review-1.md for downstream production
reconciliation and cancellation requirements. Historical outcomes are retained
as captured and are not claimed to certify every subsequent source revision.

Cleanup receipt: ../qualification-target-retirement.json records verified
development-only project deletion after independent review (HTTP200; subsequent
project lookup404). All retained generated fixture data/components were retired.
Product integration uses a separate fresh target; do not rerun this archived
qualification fixture against the product integration deployment.
