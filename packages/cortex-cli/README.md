# @cortexmemory/cli

CLI for installing the Cortex SDK, managing one selected Convex project, and performing scoped memory operations.

## Installation and compatibility

These examples describe CLI **0.38.0**, with SDK/provider **0.38.0**, Convex **1.46.0**, and the independently versioned `@cortexmemory/templates` **1.1.0** catalog. The CLI requires **Node.js 24.15.0 or newer**. SDK and application runtime requirements are declared by their own packages; the CLI floor does not change those requirements.

```bash
npm install -g @cortexmemory/cli@0.38.0
# Or install a matching published release in your project:
npm install --save-dev @cortexmemory/cli@0.38.0
npx cortex --help
```

For an unpublished release, install the matching local SDK/provider/catalog/CLI archives explicitly. SDK installation and update accept `--sdk-package` for a fixed 0.38.0 directory or tarball; template commands also accept `--provider-package` and `--templates-package`. An unavailable registry release is an error; an older SDK is not substituted. CLI native management uses the selected project's installed Convex 1.46.0 executable rather than a global or arbitrary downloaded executable.

## Quick start

The Basic app requires npm 11 or newer. Upgrade npm explicitly before installing it; the CLI does not download or switch package managers. Dry-run and `--no-install` do not require a package manager.

```bash
# New basic project with anonymous local Convex setup
cortex init my-agent --template basic --local --yes --graph none
cd my-agent

# Register the actual URL reported by local setup and associate this project
cortex config add-deployment local --url http://127.0.0.1:3210 --json-only
cortex config set-path local .

# One foreground Convex process; stop with Ctrl-C
cortex dev -d local --local
```

`init --template none` creates a backend-only project. `install [directory]` adds the SDK to an existing standalone npm project. For an existing project, stage with `--no-deploy`, then select and configure the native target explicitly. Use `--dry-run` to inspect the file/dependency plan; `--no-install` requires `--no-deploy`. `--local` and `--cloud` are mutually exclusive. Cloud staging requires `--cloud --no-deploy` and separate native Convex target configuration. Existing-project installation refuses unsupported package managers before writes.

```bash
cortex init backend --template none --local --yes --graph none
cortex install ./existing-project --no-deploy --yes --graph none --dry-run
cortex install ./existing-project --no-deploy --yes --graph none
cortex doctor -d local --json
cortex status -d local --check
```

`status` and `doctor` inspect configuration without pruning registrations or starting services. Their explicit `--check` performs a bounded backend check; authentication failure and unavailable checks are reported as failures. `doctor --graph` reports optional graph prerequisites.

## Application templates

Application templates have their own install/update channel. Catalog versions and template versions are selected independently from SDK versions. CLI builds do not synchronize a demo mirror or rewrite canonical application sources.

```bash
cortex templates list --format json
cortex templates init demo --template vercel-ai-quickstart --template-version 1.2.0 --catalog-version 1.1.0 --yes
cortex templates init chat --template chat-sdk --template-version 1.2.0 --catalog-version 1.1.0 --yes
cortex templates update ./demo --to 1.2.0 --catalog-version 1.1.0 --dry-run
cortex templates update ./demo --to 1.2.0 --catalog-version 1.1.0
```

Supported IDs are `basic`, `vercel-ai-quickstart`, and `chat-sdk`. Basic requires npm 11 or newer; Vercel uses npm and Chat uses its declared pnpm manager. Configure the generated app's server credentials, origin, model provider, and backend using its README before starting the app. Foreground `cortex dev` manages Convex; run the application's own development script separately. The generated manifests declare each app's runtime dependencies; a successful build does not certify every possible version permitted by a dependency range.

If an update stops after external dependency, backend or graph work, inspect its original operation receipt before retrying. Recovery restores only journaled files and never replays those external operations:

```bash
cortex templates update ./demo --recover
# After manually reconciling the original external effects:
cortex templates update ./demo --recover --yes
```

Recovery reports a nonzero reconciliation-required outcome until you explicitly acknowledge the completed manual reconciliation. Do not combine `--recover` with `--to`, `--dry-run`, `--sdk-package` or `--provider-package`.

Template update checks recorded ownership against the old, local, and new files. Missing ownership, unavailable versions, unsupported catalog formats, and conflicting user edits are refused before project writes. `--dry-run` plans without dependency, project, credential, or service writes. `--no-install` stages without regenerating dependencies/locks. `templates list` reads the selected catalog without automatic remote refresh.

For the recognized prior Next app shim that lacks `MutationCtx`, update the app/template to the current canonical shim **before** the SDK backend update. A recorded installation uses `templates update` first, then `update --sync` or `schema sync`. The app channel also supplies the corresponding Chat handler correction. An unrecorded or edited app needs an explicit app migration and conflict resolution. SDK updates own SDK backend files and cannot replace the app shim; arbitrary or conflicting app schemas are refused.

## SDK and backend updates

SDK dependency updates, template updates, and graph container lifecycle are separate operations.

```bash
cortex update -d local --sdk-version 0.38.0 --convex-version 1.46.0 --sync --dry-run
cortex update -d local --sdk-version 0.38.0 --convex-version 1.46.0 --sync --yes
cortex schema status .
cortex schema sync . --dry-run
cortex schema sync .
cortex schema references -d local --format json
cortex schema migrate -d local --dry-run --format json
cortex schema migrate -d local --format json
```

`update` defaults to the pinned SDK 0.38.0/Convex 1.46.0 pair. `convex update` is an alias with the same target/options. `--sync` explicitly synchronizes the owned SDK backend after dependency application. Without it, dependency changes do not imply a backend push. `schema status` inspects installed source; `schema sync` respects the configured functions directory, ownership, and user-edit conflicts. `--overwrite` explicitly backs up and replaces conflicting backend files only. Known canonical Next/Chat layouts use the supported composition; unrelated schemas are not merged by guessing.

`schema references` reports deployed reference coverage. `schema migrate` explicitly resumes the supported backfill, using fixed deployment administrator authority; its dry-run reads the plan without deployment writes. Installation/status/help do not start migration. Operational tables `cortexReferenceTargets`, `cortexReferenceEdges`, `cortexReferenceState`, and `cortexErasureReceipts` hold reference/provenance/control state; they are disclosed exclusions from the user-content export, not additional user-content families.

## Shared graph setup and owned lifecycle

SDK `init`/`install`, template initialization, and `graph setup` share the optional graph service. Noninteractive graph-off workflows do not require Docker. Enabled setup supports Neo4j or Memgraph, with either local project-owned Compose resources or an existing service.

```bash
cortex graph setup ./my-agent --graph neo4j --graph-mode local --yes --dry-run
cortex graph setup ./my-agent --graph neo4j --graph-mode local --yes
cortex graph status ./my-agent
cortex graph stop ./my-agent
cortex graph start ./my-agent
cortex install ./existing-project --no-deploy --graph memgraph --graph-mode existing --graph-uri bolt://localhost:7687 --yes
cortex templates init graph-demo --template basic --graph neo4j --graph-mode local --yes
```

Credentials come from the selected provider's environment, private prompts, or `--graph-credentials` on SDK/graph setup. Keep the credential JSON private (mode 0600); URIs must be credential-free. SDK/graph setup exposes `--graph-bolt-port` and `--graph-http-port`; template initialization exposes `--bolt-port` and `--http-port`. `--skip-graph` selects none and conflicts with an enabled `--graph` choice.

Existing-service setup probes readiness without graph-data mutation. Local start/stop acts only on the selected project's validated ownership; stop preserves data volumes. Existing-service start/stop is refused. No unrelated containers or processes are discovered or killed. Missing Docker, bad credentials, and unavailable enabled graphs fail explicitly. The SDK/provider runtime graph resolver remains supported; stopping a container is not an SDK or template update.

## Target selection and caller scope

Configuration merges the nearest supported project configuration over `~/.cortexrc`, preserving unrelated and legacy fields. Malformed configuration fails; show/list/status do not silently delete it. Config writes are private and atomic, and diagnostics redact stored credentials.

```bash
# Interactive URL/key setup; the key prompt is private
cortex config add-deployment staging
cortex config set-path staging ./existing-project
cortex config set-key staging
cortex config show --format json
cortex config list
cortex config test -d staging
cortex use staging
cortex use --clear
```

Ordinary SDK operations select `-d`, then project-scoped `cortex use`, then configured default, then a sole configured deployment. Ambiguous or stale selections fail. `CONVEX_URL` and `CONVEX_DEPLOY_KEY` do not override CLI deployment selection. Native management requires the selected project's path and matching endpoint/deployment/key; mutations require explicit `-d`. `--project` and `--env-file` select that project's native context. `--local` asserts a local target and `--prod` asserts production intent; neither silently switches targets. Production deploy requires explicit authorization.

Common global options are `-d/--deployment`, `-f/--format`, `--quiet`, `--debug`, `--scope-user`, `--tenant`, and `--graph-sync auto|off|required`. Formats depend on the leaf: ordinary output uses table/json/csv, memory/facts export uses json/csv, conversation export uses json/txt, and complete user export uses json only. Short flags may belong to a leaf; use long flags when their meaning could be ambiguous. URL/key flags are configuration-command options, not universal endpoint overrides.

For ordinary operations, `--scope-user` supplies caller context and `--tenant` requires that explicit caller. Target IDs and `--user` filters do not authenticate the caller. A selected deployment key grants administrator transport to fixed internal `cliOperator` services; it does not supply a tenant JWT or bypass public runtime authority checks. Public SDK paths retain verified authorization. Runtime-owned rows cannot be changed through the legacy administrative services. `--graph-sync off` disables optional CLI graph work; `required` refuses missing graph configuration, and `auto` uses the selected project's configured graph while reporting configured connection failures.

## Memory, facts, and conversations

```bash
cortex memory list -d staging --space agent-1 --scope-user user-123 --tenant team-a --limit 50
cortex memory search "preferences" -d staging --space agent-1 --scope-user user-123 --tenant team-a
cortex memory delete mem-123 -d staging --space agent-1 --scope-user user-123 --tenant team-a
cortex memory clear -d staging --space agent-1 --user user-123 --scope-user user-123 --tenant team-a
cortex memory export -d staging --space agent-1 --output memories.json --format json --scope-user user-123 --tenant team-a
cortex memory stats -d staging --space agent-1 --scope-user user-123 --tenant team-a

cortex facts list -d staging --space agent-1 --type preference --scope-user user-123 --tenant team-a
cortex facts search "dark mode" -d staging --space agent-1 --scope-user user-123 --tenant team-a
cortex facts delete fact-123 -d staging --space agent-1 --scope-user user-123 --tenant team-a
cortex facts export -d staging --space agent-1 --output facts.json --format json --scope-user user-123 --tenant team-a

cortex conversations list -d staging --user user-123 --space agent-1 --scope-user user-123 --tenant team-a
cortex conversations get conv-123 -d staging --scope-user user-123 --tenant team-a
cortex conversations export conv-123 -d staging --output conversation.txt --format txt --scope-user user-123 --tenant team-a
```

List limits bound displayed results; count/export/scoped clear traverse their supported scope rather than treating the first page as complete. A clear requires a memory space. Partial deletion is reported with its outcome and a nonzero exit. Domain exports are scoped views; they do not replace the complete administrative user export.

## Users and memory spaces

```bash
cortex users list -d staging --limit 100 --offset 0 --scope-user admin-1 --tenant team-a
cortex users get user-123 -d staging --include-history --scope-user user-123 --tenant team-a
cortex users export user-123 -d staging --tenant team-a --output user-data.json --format json
cortex users delete user-123 -d staging --cascade --tenant team-a --dry-run
cortex users delete-many user-1 user-2 -d staging --cascade --tenant team-a --dry-run

cortex spaces list -d staging --type team --scope-user admin-1 --tenant team-a
cortex spaces create team-alpha -d staging --type team --name "Team Alpha" --scope-user admin-1 --tenant team-a
cortex spaces archive team-alpha -d staging --reason "Completed" --scope-user admin-1 --tenant team-a
cortex spaces delete team-alpha -d staging --cascade --tenant team-a --dry-run
cortex spaces participants team-alpha -d staging --scope-user admin-1 --tenant team-a
cortex spaces add-participant team-alpha -d staging --id user-123 --type user --scope-user admin-1 --tenant team-a
cortex spaces remove-participant team-alpha -d staging --id user-123 --scope-user admin-1 --tenant team-a
```

`users export` is a deployment administrator operation across all 17 supported authoritative user-data families, eligible retained histories, shared projections, and verified binary files. It requires the selected deployment administrator key. Omitted `--tenant` selects tenantless data only; an explicit tenant selects exactly that tenant. Version 1 uses rolling reads rather than an atomic snapshot, preserves Convex value encoding, and publishes a private atomic JSON export only after collection and blob verification succeed. External graph infrastructure and operational reference/erasure tables are explicit exclusions. Historical records with unknown ownership are not assigned to a user by inference.

Cascade erasure uses separate fixed administrator transport, with the same exact tenant selection; ordinary caller scope is not maintenance authority. CLI constructs that transport from the selected URL/key. Space deletion requires `--cascade`; user deletion without it is profile-only. Dry-run previews supported scope. Verification is enabled by default; `--no-verify` does not bypass ownership/readiness or destructive preflight. The receipt distinguishes deleted, detached, preserved, partial, unknown, and residual outcomes. Shared/foreign data and required provenance can remain; a completed supported erasure is not a promise that every personal-data association or infrastructure copy was physically removed. Do not retry an unknown outcome without inspecting its receipt and persisted state.

## Native Convex management and snapshots

```bash
cortex deploy -d local --local --dry-run
cortex convex codegen -d local --dry-run
cortex convex logs -d local --lines 50
cortex convex logs -d local --tail
cortex convex env list -d local
cortex convex data -d local
cortex db stats -d local --format json
cortex db export -d local --output snapshot.zip --include-file-storage
# Only for an eligible destination without reference lifecycle state:
cortex db import snapshot.zip -d local --append --yes
```

`dev` runs one foreground native Convex child, optionally `--once`. Deploy uses the selected development/local push or explicitly authorized production operation. Finite logs default to 50 entries (`--lines` accepts 1–1000); `--tail` explicitly streams until Ctrl-C. Environment listing shows names unless values are explicitly requested. `db stats` lists actual deployed tables and reports exact aggregate counts as unavailable.

Native ZIP export includes deployment tables and optionally stored file bytes. It excludes application code, configuration, environment variables, pending schedules, and external graph data. The output must be a new `.zip` path. Import requires an explicit target, exactly one of `--append`, `--replace`, or `--replace-all`, and `--yes`. Append requires matching table IDs; replace replaces tables present in the snapshot, and replace-all can clear tables absent from it. Native import has no dry-run.

Import refuses archives, installed schemas, and deployed destinations containing reference lifecycle tables or protected runtime auth, source, model policy, and operation tables before mutation. A ZIP export of the current lifecycle backend is therefore not a supported round-trip restore. Protected snapshot create/status/resume/release/stop/discard and `--restore-bundle`, `--restore-session`, and `--provenance` are unsupported and refuse; they do not fall back to unsafe native import.

## Migration from earlier CLI behavior

Retired commands/options fail nonzero with migration guidance.

| Earlier command or behavior | Current command or action |
|---|---|
| `db backup`, JSON `db export` | `db export --output snapshot.zip`; optionally `--include-file-storage` |
| `db restore --input backup.json` | Eligible native `db import snapshot.zip` with explicit target, one mode, and `--yes`; legacy JSON is unsupported |
| `db clear` | Scoped resource deletion; intentional eligible restoration uses explicit `db import --replace-all` |
| Detached multi-app/graph `start`, `dev` dashboard | `dev -d <alias>` for one foreground Convex child; `start` is its compatibility alias |
| `start --foreground` | Accepted deprecated no-op; start is already foreground |
| `start --convex-only`, `start --graph-only` | `dev` or explicit project `graph start` |
| `stop` and process/port discovery | Ctrl-C in foreground dev/start, or your own process manager |
| `init --template vercel-ai-quickstart`, `init --template chat-sdk`/`chat-sdk-quickstart` | `templates init <directory> --template vercel-ai-quickstart` or `--template chat-sdk` |
| `init --start` | Separate foreground `dev` and application development script |
| `convex init` | `install [directory]`, then explicit targeted dev/codegen |
| `convex update-sdk --latest`/`--version` | `update --sdk-version <exact-version> --convex-version <exact-version>`; `convex update` is an alias |
| Nested `convex schema sync`, hardcoded schema status | `schema status [directory]` / `schema sync [directory] --dry-run`; `convex schema` is status only |
| `update --app`, `--apps-only`, `--deployments-only`, `--dev`, `--sync-template`, `--provider-version` | Targeted SDK/Convex update; separate `templates update` or the application's declared package manager for app/provider changes |
| SDK update automatically replacing app/template files | Explicit template update, then SDK/backend update; resolve ownership conflicts first |
| CLI `prebuild` copying the Vercel quickstart mirror | Deliberate independent catalog assembly/release from canonical sources |
| Broad graph/container supervisor | Shared optional SDK/template graph setup and project-owned graph start/stop/status |
| `config enable`/`disable` supervisor toggles | Explicit `-d` on the selected foreground/native operation; stored legacy fields remain readable |
| `dev seed`, `dev clear-test-data`, `dev generate-data` | Application-owned fixture/reset scripts; these subcommands are not registered |
| `setup` | `config add-deployment` and targeted config commands |
| npm lifecycle completion/RC edits | Explicit `completion bash|zsh|fish`; users manage their shell configuration |

## Shell completion

```bash
cortex completion bash
cortex completion zsh
cortex completion fish
```

The command prints a script for the selected shell. Source or save it explicitly according to your shell configuration. npm installation/uninstallation does not modify shell RC files.

## Development

Run package checks from `packages/cortex-cli`:

```bash
npm run lint
npm run typecheck
npm run build
npm run test:unit
npm run test:commands
npm run test:e2e
```

Build compiles the CLI and sets its executable bit; it does not mirror canonical demos. Unit checks do not require Convex. Command/e2e suites need verified disposable targets and any selected graph/LLM prerequisites. Tests load root `.env.test` and `.env.local`; inspect the effective target without printing credentials before running service tests. Matching release packages and generated backend bindings are required for cross-package checks.

## License

FSL-1.1-Apache-2.0
