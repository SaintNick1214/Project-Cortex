# Cortex ChatSDK quickstart

The canonical home uses AI SDK7 `useChat` with `CortexRemoteTransport`. The backend owns the Agent conversation, tool approvals, memory ingestion, title generation and artifact jobs. The app never calls an inference provider or writes a second conversation or memory copy.

Install with Node24.15/npm12.2 using `npm ci --ignore-scripts`. Copy `.env.local.example` and set your owned backend URLs and selectors. Use the Cortex CLI's reviewed additive installer; preserve host auth, functions, schema and HTTP routes. `npm run dev` starts only Next.js. It does not deploy or start Docker.

Your host identity provider must issue a JWT accepted by the backend's existing `auth.config.ts`. An administrator must provision a current membership and grant, publish an Agent definition and install qualified model policies. Paste the JWT into the password input to connect; it stays in memory. Refresh uses the official Convex auth callback. Expiry, revocation and sign-out clear protected displays. Environment selectors do not grant authority.

Send a message, approve an input or tool, disconnect only the local observer, reconnect, or attach another observer by Run ID. Stop requests server cancellation without promising a provider refund. Response, memory and graph status remain separate. History, governed recall and readiness use fresh backend reads. Recall has its own request ID. Scope-wide readiness may require a space grant. Graph is optional and requires an owned trusted worker and connector; the app needs no graph credentials.

The document panel submits durable `runtimeContentJobs` for title, Markdown text, code, CSV sheets and suggestions. Every new generation has a request ID. Content and its secondary title share one budget; automatic conversation titles share the actual Agent parent budget. Updates and suggestions select an immutable artifact version. Applying a suggestion requires that exact version to remain current. Jobs persist before inference. Refresh or reconnect by Job ID. Recovery publishes confirmed saved drafts without blindly redispatching unknown work. Versions remain under backend retention and authorization.

HTTP consumers send `Authorization: Bearer <host JWT>` on every request. `POST /api/chat` requires `{requestId,text,agentId,agentVersion,conversationId?}` and returns a remote handle. `GET /api/chat/<runId>/stream` returns a fresh observation. `POST /api/document` accepts the closed version1 content intent; GET/PATCH/DELETE get/reconcile/cancel it. `/api/suggestions` applies one selected suggestion. `/api/history` reads canonical history. `/api/files/upload?requestId=...` forwards bounded bytes to private asset HTTP. Assets enforce20,000,000 bytes and immutable hash/MIME/version metadata with no bearer storage links.

Previous app-side model factories, execution tools, unauthenticated SDK singleton and votes/share examples are retired. Retained editors and Auth.js examples do not grant Cortex authority. The canonical UI and HTTP generation routes are remote replacements.

Run `npm test`, `npx tsc --noEmit`, `npm run build` and scoped `ultracite check` for affected files. Offline checks do not attest provider availability or native OCC. Installed CLI/backend/browser evidence is separate; unavailable async video is not completed media.
