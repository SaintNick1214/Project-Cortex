# Task 01 frozen backend text contracts — v1

Authority: approved decision register and architecture, execution goal review cycle 2.
Scope: fresh installations. This qualification fixture is isolated from production SDK,
backend, provider and manifest code. These contracts govern Tasks 02–09; extensions
retain their own managed vector/profile, graph, asset and media service gates.

## Qualified stack

| Package/runtime | Exact fixture lock | Evidence |
|---|---|---|
| Node | 24.19.0 observed; repository floor >=24.15.0 | runtime/lock receipt |
| npm | 12.2.0 invoked explicitly; ambient npm 11.9.0 unused for installation | package lock and command receipts |
| Convex | 1.46.0 | deployed generated bindings and live component receipts |
| AI SDK | 7.0.127 | real Chat, structured Output.object, Responses, tool loop; typed ChatTransport |
| Official Gateway provider | @convex-dev/ai-sdk-provider 0.2.1 | action-local deployment service token; no direct-provider fallback |
| Agent | @convex-dev/agent 0.7.3 | canonical transcript, persisted UIMessageChunk streams, tools |
| Workflow | @convex-dev/workflow 0.4.8 | durable step execution; action retry false |
| Workpool | @convex-dev/workpool 0.4.13 | actual direct and Workflow child components deployed |
| TypeScript | 6.0.3 | strict no-emit fixture check |

The complete transitive graph and integrity values are in fixture/package-lock.json.
Package peers alone are not evidence of service compatibility. Gateway requests use
`convexGateway(modelId)`, explicit `convexGateway.responses(modelId)` for native
Responses and `Output.object({schema})` for structured output. Default qualified text
model: `openai/gpt-4o-mini`, Chat interface. Responses uses the same qualified model.
Messages exists in the installed provider API but remains unqualified by this spike:
an operation requiring it must have a separately qualified policy capability.
Agent tools use `inputSchema` and `execute(ctx,input,{toolCallId,...})`, not removed
`args`/`handler` names. Backend modules stay separate from browser exports.

## Submission, identity and lifecycle

`TextSubmitV1` has `version:1`, `agentId`, immutable `agentVersion`, optional
`conversationId` (absence requests a new conversation), `clientRequestId` and
`parts:[{type:"text",text:string}]`. No provider key, trusted tenant/user/grant,
instructions, tool closures, model permission or arbitrary backend function comes
from this payload. Attachment/artifact/approval parts are later versioned extensions.
Limits and exact public validator implementations belong to Tasks 03–05.

Verify JWT identity and derive principal/scope/capabilities from trusted grants.
The fixture uses real signed RS256 JWTs with exact issuer, audience, expiry and
public data-URI JWKS; it exercises two equally eligible owners and a denied subject.
Admin impersonation is not authentication evidence. Background execution stores a
trusted grant reference/owner, never a caller JWT, and must recheck revocation and
deletion before sensitive reads, external effects and commits.

Stable request identity is `(trusted principal, scoped conversation, clientRequestId)`.
Retrying the same normalized request returns its existing run; different input under
that identity yields `IDEMPOTENCY_CONFLICT`. Mutating runs queue within a conversation.
`runId`, `conversationId`, canonical Agent thread/message IDs and attempt identity
remain stable after observer reconnect. A new execution attempt is explicit and
cannot silently append a second final response. A prompt edit invalidates its pinned
source revision; stale completion is rejected/cancelled/branched by policy.

`RunSnapshotV1` separates `responseStatus` (`queued`, `running`, `awaiting_approval`,
`completed`, `cancel_requested`, `cancelled`, `failed`, `uncertain`) from
`memoryStatus` (`pending`, `processing`, `ready`, `failed`, `deleted`) and graph/media
status. It includes version, run/conversation IDs, pinned agent/policy/auth references,
source revision/cutoff, attempt, canonical output references, usage and sanitized
error. Completed response does not assert memory readiness. Final-only observation
reads the durable canonical response and run records and need not subscribe to deltas.

## Transcript finalization and ingestion

Agent owns the sole executable transcript. Cortex owns its authorized API, revisions,
source attribution, lock and derived receipts. Do not create a second message writer.

Live mutation evidence proves `saveMessages(ctx,components.agent,...)` called from a
parent Convex mutation and a parent ingestion-receipt write roll back together when
the parent throws after both writes. The successful mutation commits both together.
This proof applies to explicit mutation composition; it does not imply that the
automatic Agent action and a later parent mutation share one transaction.

For ordinary Agent streaming, choose a durable canonical-message cursor/outbox
reconciler. Agent persists the final output before Cortex finalizes ingestion; a
forced process failure in this gap must be detectable by canonical message ID and
current revision. The live gap spike commits an assistant final, omits its receipt,
then reconciles once; a second reconciliation adds zero receipts and no messages.
Production reconciliation scans every eligible committed final through a persisted
cursor and advances only after registering corresponding work. A process-local
promise or scheduled call without a durable gap detector is insufficient.

Ingestion identity is `(sourceEventId, sourceRevision, stage, semantic/prompt policy
version)`. Final assistant output is attributed assistant evidence, not an automatic
authoritative user assertion. Verified tool evidence has its own stable operation ID.
User input is admitted durably and eligible pending context is available before
semantic processing. Tombstones/current revision fence every delayed stage commit.

## Events, persisted observation and UI

`RunEventV1` has version, stable event ID, monotonically ordered sequence within its
run, run/conversation IDs, attempt, source event/revision, timestamp and a typed
payload. Payload variants cover run state, text part start/delta/end, registered tool
input/result/error, approval request/result, canonical final reference, memory stage
and sanitized error. Additional artifact/media events extend this union later.
Text deltas carry a stable part ID and append offset. Cursor replay returns the same
events/IDs, and consumers deduplicate by event ID/part offset. Cross-component IDs are
adapter details, not public caller authorization. Completed final text is authoritative.

Agent persists `UIMessageChunk` deltas. Its installed adapter supports `listStreams`,
`syncStreams({streamArgs:{kind:"deltas",cursors:[{streamId,cursor}]}})` and `abortStream`.
The saved cursor is the returned delta end; replay resumes after it. Streams expose
streaming/finished/aborted separately from run/memory state. Component cursor units
are not token positions and do not resume an interrupted upstream provider connection.

Multiple observers and observer disconnect do not own backend execution. Reconnect
attaches to the same run; it cannot submit another prompt/tool/model call. UI stop is
an explicit cancellation request, distinct from detaching an observer. Cancellation
blocks future allowed work, aborts persisted streams where possible and retains partial
attempt state. It cannot reverse an upstream charge or committed external effect.
Output completed before cancellation remains completed; a terminal response must not
be rewritten as cancelled merely because a late UI request arrives.

AI SDK 7 adapter implements `ChatTransport<UIMessage>`, `sendMessages` and
`reconnectToStream`, returning `ReadableStream<UIMessageChunk>`. Minimum text wire
sequence: start, text-start, text-delta, text-end, finish; cancellation emits abort;
failure/uncertain emits sanitized error. The compiled fixture is consumed by AI SDK's
real `readUIMessageStream`, uses stable assistant/part IDs and reconstructs exact final
text. No second local tool loop/memory writer is present. Regeneration requires an
explicit new backend run and is rejected by the minimum fixture adapter.

Raw reasoning, injected private context, provider credentials and tool secrets are
excluded from public messages/deltas by default. Synthetic private reasoning is
persisted within the Agent fixture and removed by the authorized observation adapter;
Agent duplicates reasoning in message parts and top-level `reasoning`/`reasoningDetails`,
so removing only the parts is insufficient. Public message/stream adapters reconstruct
allowlisted fields and approved tool input/result shapes, rather than copying raw
component documents and deleting selected fields. Assert the entire serialized public
snapshot has no private marker, including auxiliary/search/status fields.
typed tool/UI protocol supports only approved result/input fields. Native browser
tools are unavailable in this session; typed protocol/browser bundle qualification
does not claim interactive browser UI coverage. Full UI gates remain for later tasks.

## External operations and errors

Every billable/effectful operation has a stable operation ID, resolved policy version,
attempt, admission/checkpoint, usage/outcome receipt and scoped authorization.
The Gateway SDK calls use `maxRetries:0`; Workflow action steps use `retry:false` and
`retryActionsByDefault:false`. Local database retry/idempotent repair is safe only when
it cannot repeat a dispatched external operation.

The real private HTTPS peer spike commits one external effect, then deliberately
interrupts the action after its response and before a local outcome receipt. Workflow
records `uncertain`; duplicate submission and recovery retain one attempt and one
effect, with `replayAllowed:false`. This deterministic boundary demonstrates the
replay decision; the paid provider was not forcibly killed and no upstream idempotency
guarantee is invented. Recovery requires receipt reconciliation or explicit operator
decision. A lost network response cannot automatically become a retryable failure.

`RuntimeErrorV1` has `version:1`, `code`, public message, `retryable`, `operationId`
where relevant, and `outcome` (`not_dispatched`, `confirmed_rejected`, `confirmed`,
`uncertain`). Codes include `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_INPUT`,
`IDEMPOTENCY_CONFLICT`, `POLICY_DENIED`, `BUDGET_EXCEEDED`, `CAPABILITY_UNAVAILABLE`,
`CAPABILITY_UNSUPPORTED`, `PROFILE_NOT_READY`, `INCOMPLETE_CONTEXT`, `RUN_CANCELLED`,
`UNCERTAIN_OUTCOME`, `UPSTREAM_REJECTED`, `INTERNAL_FAILURE`.
Service eligibility/capability failure is distinct from rejected bad options, model
failure and ambiguous dispatched effects. Classify using the operation checkpoint
and confirmed service response, not only an Error name/status. No generic catch may
label every inference failure unavailable or blindly retry it. No direct OpenAI,
Anthropic or self-hosted fallback is installed by this feature.

## Fresh default embedding/index profile — frozen for Tasks 02/04/08

| Field | Contract |
|---|---|
| Profile ID/version | `cortex-text-small-1536-v1`, immutable profile record |
| Transport/interface | Official Convex Gateway embedding interface |
| Provider-qualified model | `openai/text-embedding-3-small` |
| Dimensions | exactly 1536, validate finite coordinates on stored/query vectors |
| Normalization | `text-nfc-lf-v1`: Unicode NFC; CRLF/CR to LF; trim outer whitespace; preserve internal whitespace/paragraphs; reject empty normalized text |
| Chunking | `codepoint-1600-overlap-200-v1`: deterministic Unicode code-point windows, max 1600, overlap 200; no splitting surrogate pairs; stable chunk ordinal/hash/source revision |
| Query preprocessing | same `text-nfc-lf-v1`; query uses the same immutable profile/model/dimension contract |
| Index | declare `by_default_embedding_v1`, vector field `embedding`, dimensions 1536; trusted `tenantId`, `memorySpaceId`, `profileId` filter fields |
| Data separation | source content/revision and chunks are logical records; derived vectors reference source/chunk/profile/revision/processing receipt |
| Authorization/currentness | trusted scope filters plus post-search grant/tombstone/current-source-revision checks; exclude stale or unauthorized vectors before returning recall |
| Profile matching | selected query/job profile pinned; same dimensions from another profile are incompatible; missing qualified index/vectors returns readiness/capability error |
| Provider alias drift | exact model name is pinned; provider exposes no immutable weight revision here. A detected drift requires an explicit profile-generation/policy revision; never silently relabel vectors or invent immutable provenance |

This profile is a fresh design choice, not retained legacy schema or compatibility.
Task 01 freezes it; no live embedding/retrieval result is claimed here. Tasks 02/04/08
implement and provision it, and an observed managed Gateway embedding + Convex search
receipt with correct/current/authorized matching is required before Task 09 PASS.
Additional profiles/media/graph do not block the initial text slice but retain all
their own required service gates. No old-corpus migration or general reindex work.
