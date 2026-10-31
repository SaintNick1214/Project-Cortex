# Cortex AI SDK integration

Use the AI SDK 7 remote transport to submit and observe backend-owned Cortex runs.
Convex Agent/Workflow owns inference, tools, the canonical transcript and asynchronous
memory. The application renders durable output and supplies its host-issued JWT.

The current backend-runtime branch is under qualification and has not been released.
Required missing services remain incomplete; see the
[current acceptance record](../../_goals/convex-backend-runtime-2026-10-02/qa/completion-current.json).

## Installation

Use Node >=24.15.0, npm 12.2.0 and AI SDK 7.

```bash
npm install @cortexmemory/vercel-ai-provider @cortexmemory/sdk ai convex
# React applications also install the matching AI SDK React integration.
npm install @ai-sdk/react
```

Install/register the Cortex backend additively using the
[CLI setup guide](../cortex-cli/README.md). Configure verified host authentication and
current scoped grants, publish an Agent/version and qualify its server-side policies.
App-side OpenAI, Anthropic or Vercel Gateway credentials are not part of this setup.

## Connect a remote transport

```typescript
import { CortexRuntimeClient } from "@cortexmemory/sdk/runtime";
import { CortexRemoteTransport } from "@cortexmemory/vercel-ai-provider/remote";
import type { RuntimeObservation, RuntimeRunHandle } from "@cortexmemory/sdk/runtime";

export async function connectRemoteChat(options: {
  deploymentUrl: string;
  assetHttpUrl: string;
  memorySpaceId: string;
  agentId: string;
  agentVersion: number;
  conversationId?: string;
  fetchToken: (request: { forceRefreshToken: boolean }) => Promise<string | null>;
  onRun: (handle: RuntimeRunHandle) => void;
  render: (observation: RuntimeObservation) => void;
  clearPrivateViews: () => void;
}) {
  const client = new CortexRuntimeClient({
    deploymentUrl: options.deploymentUrl,
    assetHttpUrl: options.assetHttpUrl,
    scope: { memorySpaceId: options.memorySpaceId },
    fetchToken: options.fetchToken,
    onAuthChange: authenticated => {
      if (!authenticated) options.clearPrivateViews();
    },
  });
  try {
    await client.session();
    await client.getDefinition(options.agentId, options.agentVersion);
    const transport = new CortexRemoteTransport({
      client,
      agentId: options.agentId,
      agentVersion: options.agentVersion,
      conversationId: options.conversationId,
      onRun: options.onRun,
      onObservation: options.render,
    });
    return {
      client,
      transport,
      close: async () => {
        transport.disconnect();
        await client.close();
      },
    };
  } catch (error) {
    await client.close();
    throw error;
  }
}
```

Pass the returned stable `transport` instance to `useChat` from `@ai-sdk/react`.
Use `sendMessage` for a new text input and `resumeStream` to reconnect observation.
A submitted user message ID is the request's replay identity; do not replace it merely
because an RPC response was lost. Client transport options cannot override authority,
models, tools, context or budgets. This transport performs no inference or memory writes.

The [canonical quickstart component](quickstart/components/RuntimeQuickstart.tsx) and
[ChatSDK template](../cortex-cli/templates/chat-sdk-quickstart/components/runtime-chat.tsx)
show complete React wiring, private view clearing, history, recall and readiness.

## Memory effort

Effort-aware Agent definitions advertise `inputSelectionVersion: 2` and
`memoryEffortPolicyVersion: 1`. Set `memory: { effort: "normal" }` on
`CortexRemoteTransportOptions` for a fixed default, or use a stable React transport
with `sendMessage({ text }, { body: { memory: { effort: "high" } } })`.
The exact request body accepts only `memory`; headers and arbitrary metadata remain
unsupported. `maxEntries` and `maxContextTokens` are optional lower request ceilings.

Fast, Normal, High and Max request backend memory effort. Normal is the backend
default for new definitions. Max removes preset hop and entry caps; administrator,
input, work and deadline limits still apply. Omit `memory` for legacy definitions;
explicit effort on an unsupported definition fails `INVALID_INPUT`. A message ID binds
its normalized effort request. Reconnect retains the original request; change effort
only for a new message ID.

Optional `memoryEffort` in message metadata and status reports the server's effective
bounds, reached depth, counts and stop reasons. `unavailableStages` means partial
retrieval. Retrieval duration is separate from submission-to-first-answer latency.

## Reconnect, approve and cancel

`transport.state` is a bounded local projection for reconnect, never an authorization
credential. Restore it only from the application's own retained state. Alternatively,
call `transport.attach(handle)` with an existing handle and reconnect; this does not
submit or start another run. Server identity and grants are checked again.

`transport.disconnect()` closes observation while the durable backend run continues.
`transport.stop()` requests run cancellation. Input and registered tool approvals use
`approveInput()` and `approveTool()` under the existing server policy. Close the owned
client on unmount, and clear messages, history, recalled context, job/artifact views and
Blob previews when authentication or authority expires.

The SDK bounds authentication (10 seconds by default) and ordinary RPCs (12 seconds). Explicit Max recall has a 30-second default; an explicit
`requestTimeoutMs` still takes precedence, including a shorter caller deadline.
A mutation timeout has an uncertain outcome; inspect the original run/job/request instead
of blindly retrying paid work with a new identity. `refreshAuth()` verifies a fresh host
JWT while retaining the same authorized run. Scope labels do not grant access.

## Output, memory and artifacts

The transport emits AI SDK 7 text/metadata and bounded references to server-authored
tools, retained artifacts and media jobs. Fetch their current state through the authenticated
runtime client. Private previews use authenticated Convex HTTP bytes and Blob URLs;
provider URLs are not the delivery authority.

A completed response can precede extraction, vector indexing and graph projection.
Render `responseStatus`, `memoryStatus` and `graphStatus` independently. Use the runtime
client's managed default embedding profile, recall and stage-specific memory-readiness
barriers when retrieval consistency is required. App-side hooks do not write memory.

Governed backend content jobs cover conversation titles, text/code/sheet artifacts and
suggestions. Explicit application of a suggestion uses the exact retained artifact
version. Primary and secondary model calls remain inside the server's operation and
shared budget controls. Private media delivery is capped at **20,000,000 bytes**.
Image generation uses a qualified text-prompt path with callbacks disabled; its observed
descriptor records requested-only model identity and leaves serving identity and USD
charges unknown. Convex Gateway does not support asynchronous video generation and
cannot enable it for an individual team or deployment. Video generation is explicitly
deferred until official support, implementation compatibility qualification, real service
outcomes and independent acceptance. The retained `video` kind, `media.video.generate`
operation and signed callback/native polling/provider-download contracts are reserved.
Private upload and delivery of existing video files remain in scope.

## Exports and compatibility

- `@cortexmemory/vercel-ai-provider/remote`: browser-safe AI SDK 7 `CortexRemoteTransport`,
  transport options and durable reconnect/output types.
- `@cortexmemory/sdk/runtime`: authenticated browser-safe runtime client, contracts and
  content/media/asset operations; no root SDK, graph driver or model factory is bundled.
- Existing root and `./react` provider exports retain the incoming 0.38 server wrappers,
  explicit private deployment transport and caller-owned graph lifecycle.
  Their older application-side model/memory wrappers are not the backend-run integration
  described here and do not replace verified runtime identity or server model policy.

Legacy local model wrappers and memory factories require explicit administrative server credentials, or a borrowed `Cortex` whose `deploymentOperator` mode is enabled. Ordinary clients fail with `CAPABILITY_UNAVAILABLE` before model, embedding, extraction, observer, or memory RPC effects. The mode reports local routing; Convex still verifies administrative authentication independently. Use the `/remote` transport for application requests.

## Validation

```bash
# Build the SDK before packages that consume its current exports.
# From the monorepo root:
npm run build

# From packages/vercel-ai-provider:
npm run lint
npm run build
npm run test:unit -- --runInBand
npm run test:integration -- --runInBand
```

The provider unit/React/remote and integration projects include controlled coverage.
Actual e2e and quickstart browser qualification also require verified Convex, identity,
Agent and Gateway prerequisites. Missing services and skipped coverage remain visible.
See [quickstart/README.md](quickstart/README.md) for the separately installed demo.
The application catalog has its own version and immutable payloads. CLI builds do not
copy this source into templates; application install/update is an explicit catalog
operation independent of SDK/backend updates. A published older application payload
does not acquire this branch's runtime integration from an SDK update.

