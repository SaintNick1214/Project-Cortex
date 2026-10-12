# Cortex memory chat quickstart

The canonical text demo uses AI SDK 7 with an authenticated Cortex remote-run
transport. Convex runs the Agent, backend tools and asynchronous memory work.
The application submits user text and observes durable output; it has no model
loop or memory writer.

## Configure

Use Node >=24.15.0 and npm 12.2.0. Install this package separately with `npm ci`.
For a local monorepo checkout, build the root SDK and provider before starting it.
Copy `.env.local.example` to `.env.local` and configure:

- `NEXT_PUBLIC_CONVEX_URL`: your installed Cortex development backend.
- `NEXT_PUBLIC_CORTEX_HTTP_URL`: the same installation's HTTP action origin, required
  for private uploads, downloads and media previews. Obtain it from the installation;
  the app does not guess a storage origin or use public file URLs.
- `NEXT_PUBLIC_CORTEX_AGENT_ID`: a published executable agent.
- `NEXT_PUBLIC_CORTEX_AGENT_VERSION`: the pinned version, initially `1`.
- Optional `NEXT_PUBLIC_CORTEX_MEMORY_SPACE_ID`: narrows the verified actor's grants.

The backend needs the qualified default text/query-embedding policy, Agent and
Workflow components, a verified host authentication provider and appropriate
scoped grants. The registered backend `memory.recall`/`memory.remember` tools are
selected in the published agent definition. Text execution does not require a
graph service, media configuration or an additional embedding profile.

Run `npm run dev`, open the displayed local URL and enter a host-issued access
token in **Connect**. The token stays in memory and the backend verifies it.
Sign out or reload to clear it. Use **Refresh token** for a replacement credential
from the same host identity. No upstream inference key belongs in this app or a
`NEXT_PUBLIC_*` variable.

## Use

Send a message and observe response status separately from memory status. A final
response can have pending or failed indexing. Backend tool activity and configured
approval controls appear alongside the response. Approvals continue the existing
backend operation; the app does not execute the tool.

**Disconnect observer** pauses this page's observation while the backend continues.
**Reconnect observer** resumes the retained run and cursor. **Observe an existing
run** reconstructs an authorized run in another page without resubmitting input.
**Cancel run** cancels backend work. Run IDs and local reconnect state confer no
access; every request still requires verified identity and current grants.

**New chat** starts a new conversation. **Use agent version** selects a published
version, including a version configured with strict stage-specific memory barriers.
The backend controls its models, tools, scope and deadlines. Earlier pending or
failed memory events prevent strict barriers from passing across a hole. Context
limits, unavailable capabilities and failed barriers remain explicit errors.

**Memory search** uses the qualified managed default profile through Cortex's
budget-governed query embedding. It reads indexed, currently authorized sources.
The displayed profile and dimensions identify the fresh index. Immediate chat
context can additionally include eligible approved history and authorized pending
sources while indexing catches up.

The old `/api/chat` and `/api/chat-v6` app-side inference routes return
`410 REMOTE_RUN_TRANSPORT_REQUIRED`. The home page uses the remote transport.

**Memory readiness** reads fresh administrator-selected profile/index metadata and
the contiguous facts, vectors and optional graph watermarks. Selecting a required
stage checks an explicit barrier; an incomplete or unavailable stage returns a
capability/context error. This check makes no model call. Scope-wide counters
require an appropriate space or tenant grant; an own-only grant can still use its
run's memory/graph status but cannot read the whole space's counters.

**Media and artifacts** uploads raw private files with the application limit of
20,000,000 bytes. The backend also enforces its protocol and provider limits;
smaller files can fail a particular provider input contract. Image generation uses
a qualified text prompt without an input asset. Its observed descriptor has callbacks
disabled and requested-only model identity; serving identity and USD charges remain unknown.
The administrator chooses qualified models, options and budgets. A missing media
service fails explicitly rather than falling back to an app-side model.

Convex Gateway does not support asynchronous video generation and cannot enable it for
an individual team or deployment. Video generation is explicitly deferred until official
support, implementation compatibility qualification, real service outcomes and independent
acceptance. The retained `video` kind, `media.video.generate` operation and video input,
signed callback/native polling/provider-download contracts are reserved, not functional
video capabilities. Private upload and delivery of existing video files remain in scope.

The job list reloads retained state, including canonical chat media references.
**Recover job status** preserves the original job identity, can mark expired submissions
unknown and can resume eligible retained-output recovery. It does not guarantee recovery
of a lost upstream image result or resubmit an unknown generation. Native polling/download
and missed-callback recovery remain future video contracts. **Cancel local job**
fences delivery; the UI separately reports unsupported upstream cancellation and
retained unknown incurred costs. **Open retained artifact** reads the current
authorized version. Previews and downloads use authenticated, hash-checked bytes
through the configured HTTP action origin and temporary local Blob URLs. Closing
a preview, signing out or unmounting releases the local URL. No media bytes,
upstream URLs or credentials are stored in transcript or reconnect state.

## Integrate with a host auth provider

Import `CortexRuntimeClient` from `@cortexmemory/sdk/runtime` and supply your host
provider's `fetchToken` callback. The client uses official Convex token refresh and
reactive invalidation subscriptions. Private payloads are fetched by fresh mutations; subscription caches carry only opaque change markers. The client bounds authentication to10 seconds and RPC observation to12 seconds by default (host options `authTimeoutMs` and `requestTimeoutMs`). A local timeout reports uncertainty for an issued mutation; it does not cancel, refund or retry backend work. Server-derived grant/resource deadlines revoke retained previews and close expired observations. Import `CortexRemoteTransport` from
`@cortexmemory/vercel-ai-provider/remote` and pass it to AI SDK 7's `useChat`.
These entry points are browser safe and do not import the Node graph or backend
implementation. The masked token form is the minimal development adapter; a host
application can connect its existing auth UI to the same client callback.

Build, lint and affected route/client checks are local quality checks. Actual
chat, managed retrieval, isolation, refresh, reconnect and approval outcomes
require a verified disposable backend and are recorded separately from mocks.

## Application catalog and private app modules

This is the canonical development source. The independently versioned application
catalog retains immutable published payloads and uses deliberate assembly for a new
application candidate. CLI build does not copy this source into an older mirror.
SDK/backend updates and application updates are separate ownership channels; review
an explicit application update for edited host files.

Incoming private account/session, history and library modules remain in the source
with their server-only administrator transport, fixed internal operation allowlist
and session scope checks. Their controlled compatibility tests do not qualify a
backend runtime turn. The home page and ordinary chat entry points use the remote
client described above, with host-issued identity and no app-side inference key.
The composed runtime backend retains guarded public registrations separately from
the private app module aliases; do not expose internal legacy app handlers to make
a remote runtime endpoint callable.
