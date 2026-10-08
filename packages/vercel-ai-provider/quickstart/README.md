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

## Integrate with a host auth provider

Import `CortexRuntimeClient` from `@cortexmemory/sdk/runtime` and supply your host
provider's `fetchToken` callback. The client uses official Convex token refresh and
reactive subscriptions. Import `CortexRemoteTransport` from
`@cortexmemory/vercel-ai-provider/remote` and pass it to AI SDK 7's `useChat`.
These entry points are browser safe and do not import the Node graph or backend
implementation. The masked token form is the minimal development adapter; a host
application can connect its existing auth UI to the same client callback.

Build, lint and affected route/client checks are local quality checks. Actual
chat, managed retrieval, isolation, refresh, reconnect and approval outcomes
require a verified disposable backend and are recorded separately from mocks.
