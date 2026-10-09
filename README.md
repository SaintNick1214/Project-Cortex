# Cortex

Cortex runs AI conversations and asynchronous memory on Convex. The backend owns
Agent execution, tools, the canonical transcript, model policy and memory commits.
TypeScript and AI SDK 7 clients submit and observe durable runs.

[Website](https://cortexmemory.dev) · [Documentation](https://docs.cortexmemory.dev)
· [License](LICENSE.md)

The backend runtime is under active implementation. The continuation's current
acceptance and service gaps are recorded in
[_goals/convex-backend-runtime-2026-10-02/qa/completion-current.json](_goals/convex-backend-runtime-2026-10-02/qa/completion-current.json).
An unavailable required capability does not establish functional completion.
This branch has not been released or deployed to production.

## Package and application versions

This checkout declares **0.38.0** for the SDK, CLI and AI provider. Application sources
declare **1.3.0**; the independent `@cortexmemory/templates` catalog declares **1.2.0**.
These source versions do not establish registry publication or installed compatibility.
Use matching released packages, or matching local archives for this unpublished branch.

SDK/backend upgrades and application-template upgrades use separate channels. CLI build
compiles its code without copying application sources. Catalog payloads have explicit
versions and digests; an SDK update does not replace host application files. See the
[CLI setup and upgrade contracts](packages/cortex-cli/README.md) and
[catalog contract](packages/cortex-templates/README.md).

## Development installation

Use Node >=24.15.0 and npm 12.2.0. The SDK, CLI and provider are independent packages;
the quickstart and scaffold templates also have their own manifests and lockfiles.

```bash
npm install @cortexmemory/sdk convex
npm install --save-dev @cortexmemory/cli

# Inspect the additive plan, then install its files.
npx cortex backend install . --plan --jwt-provider ./jwt-provider.json
npx cortex backend install . --jwt-provider ./jwt-provider.json

# Register and provision an explicitly verified disposable development target.
npx cortex backend register . --target ./development-target.json
npx cortex backend provision . --target ./development-target.json --principal ./principal.json

# Configure public client metadata after publishing an Agent/version on the backend.
npx cortex backend configure . --url https://my-dev.convex.cloud --http-url https://my-dev.convex.site --agent-id published-agent --agent-version 1
```

Follow the [CLI setup contract](packages/cortex-cli/README.md) for the exact JWT,
target and principal files and operator credential environment variables. Existing
host authentication, custom functions directories, schema tables/indexes, components,
HTTP routes, scripts and environment entries are preserved. Ambiguous compositions
are refused with a reviewable merge proposal. Install the printed dependencies with
the host's package manager.

Registration, host-issued identity/grants, an administrator-published Agent definition
and qualified server-side model policies are separate setup steps. Copying the source
or setting a deployment URL does not qualify a model, embedding profile or media service.
Never point test cleanup or development registration at production.

### Native development and explicit administration

The CLI also supports foreground native Convex development, explicit deployment
selection, graph service ownership, SDK installation/update and independent template
installation/update. Inspect `cortex install --help`, `cortex schema sync --help`,
`cortex templates --help` and `cortex graph --help` for their current target and
preservation rules. Use dry-run/plan modes before changing an existing host.

Low-level domain administration, exports, provenance and reference maintenance use
separate guarded operator contracts. A deployment administrator credential is required
for those internal operations. Caller-supplied tenant/user labels never grant access to
the public backend runtime. Runtime scope retirement preserves financial and tombstone
history and must not be replaced with a native database reset.

## Submit and observe a backend run

```typescript
import { CortexRuntimeClient } from "@cortexmemory/sdk/runtime";
import type { RuntimeObservation } from "@cortexmemory/sdk/runtime";

export async function openConversation(options: {
  deploymentUrl: string;
  assetHttpUrl: string;
  memorySpaceId: string;
  agentId: string;
  agentVersion: number;
  fetchToken: (request: { forceRefreshToken: boolean }) => Promise<string | null>;
  text: string;
  render: (observation: RuntimeObservation) => void;
  clearPrivateViews: () => void;
  onError: (error: unknown) => void;
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
  let disconnect = () => {};
  try {
    await client.session();
    await client.getDefinition(options.agentId, options.agentVersion);
    const handle = await client.submit({
      version: 1,
      agentId: options.agentId,
      agentVersion: options.agentVersion,
      clientRequestId: crypto.randomUUID(),
      parts: [{ type: "text", text: options.text }],
    });
    disconnect = client.watchObservation(handle, options.render, error => {
      options.clearPrivateViews();
      options.onError(error);
    });
    await client.start(handle, { streaming: true });
    return { client, handle, disconnect };
  } catch (error) {
    disconnect();
    await client.close();
    throw error;
  }
}
```

The host supplies a real JWT through the official Convex token callback. Caller tenant,
space and user labels do not grant authority. JWT verification, current grant checks
and resource/source fences apply to public endpoints and background work. Clear retained
private UI data when authentication is lost; close the client when its owner unmounts.
Authentication defaults to a 10-second deadline, RPC observation to 12 seconds. A timed-out
mutation may have executed: reconnect and inspect the existing request/run rather than
creating a new request to hide an uncertain outcome.

Disconnecting observation leaves the backend Workflow running. Retain the returned
handle to attach another authenticated client without resubmission. Administrators
control transcript write locks; unlocked edits create tracked revisions and invalidate
stale derived context. Response completion, memory indexing and graph readiness are
separate statuses.

## Memory, tools and model governance

- Registered backend tools run through Convex Agent and Workflow/Workpool. Clients have
  no second tool loop or memory writer.
- Memory uses canonical sources, chunks and vectors with matching embedding profile and
  index provenance. Ordinary reads can combine indexed memory and authorized pending
  context. Strict reads declare stage-specific barriers against contiguous scoped watermarks.
- Every billable call, including extraction, query embeddings, conversation/artifact titles
  and other secondary calls, needs a versioned function/interface/capability/budget policy.
  Unknown costs retain conservative ceilings. Replay, cancellation and fallback preserve
  the existing accounting and operation identity.
- Content jobs support governed title, text, code, sheet and suggestions intents. Explicit
  suggestion application checks the current retained artifact version. Backend model calls
  are never selected by a browser-supplied provider key or budget override.

## Private artifacts and media

Cortex retains artifacts and owns governed image/video jobs. Private uploads, downloads
and Blob previews use authenticated Convex HTTP delivery. The storage/delivery limit is
**20,000,000 bytes**; provider input contracts may be stricter. External media storage,
image understanding, OCR and visual embeddings are outside this goal.

Image and video capabilities require actual service qualification. Asynchronous video
is currently blocked on the disposable development Gateway's service availability;
typed unavailable errors and synchronous video evidence do not complete async jobs.
Unknown media submissions reconcile the original job rather than dispatching a duplicate.

Gateway/model providers receive the authorized input needed for inference. Optional
Neo4j/Memgraph projection uses a trusted Node worker and private graph credentials.
Graph lag and strict barriers remain distinct from text completion. Keep inference,
graph and deploy credentials on trusted operators/services, never in public app variables.

## AI SDK 7, demos and templates

Use the [remote AI SDK transport](packages/vercel-ai-provider/README.md) and its
`@cortexmemory/vercel-ai-provider/remote` export. The
[canonical quickstart](packages/vercel-ai-provider/quickstart/README.md),
[Basic template](packages/cortex-cli/templates/basic/README.md) and
[ChatSDK template](packages/cortex-cli/templates/chat-sdk-quickstart/README.md)
have separate setup and validation. The app client needs public deployment/HTTP URLs,
a published Agent/version and host-issued identity; it needs no upstream inference key.

Older low-level SDK and provider exports remain in the repository for supported contract
checks. Their historical application-side orchestration examples are not the modern
backend-runtime integration. Archived Python code is under `_DEPRECATED/`; Python parity,
legacy data/deployment/transcript/embedding migrations and Decisions/Jev are excluded.

## Repository development

```bash
npm ci
npm run build
npm run test:contracts
npm run lint
```

Read [AGENTS.md](AGENTS.md) and the
[project profile](.agents/PROJECT-PROFILE.md) before changes. Service-dependent tests need
verified disposable targets and real configured prerequisites. A mocked suite, a skipped
test or a missing service is never reported as actual runtime qualification. The goal's
[execution record](_goals/convex-backend-runtime-2026-10-02/qa/execution-progress.md)
links scoped independent verdicts and raw receipts.

The repository also retains meaningful native provenance, reference-maintenance,
erasure, paging and graph checks. Run the affected CLI/provider/catalog checks in their
own packages; build does not synchronize templates or deploy Convex. `npm run test:release`
validates release workflow contracts without publishing a package.

Security scanners and dependency review run through the
[security workflow](.github/workflows/security.yml),
[PR checks](.github/workflows/pr-checks.yml) and
[dependency-review configuration](.github/dependency-review-config.yml). Report private
security findings using [SECURITY.md](SECURITY.md). Inference and external graph services
receive authorized data through their documented boundaries; keep their credentials on
trusted services. Package publication is a separate release action governed by
[RELEASE-GUIDE.md](RELEASE-GUIDE.md). This continuation does not publish or deploy production.
