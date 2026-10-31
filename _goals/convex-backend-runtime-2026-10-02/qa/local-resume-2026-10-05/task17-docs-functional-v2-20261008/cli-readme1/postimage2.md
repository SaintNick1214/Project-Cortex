# @cortexmemory/cli

CLI tool for managing Cortex Memory deployments, performing administrative tasks, and streamlining development workflows.

## Installation

```bash
# Install globally
npm install -g @cortexmemory/cli

# Or use with npx
npx @cortexmemory/cli <command>

# Or install as dev dependency in your project
npm install --save-dev @cortexmemory/cli
```

## Quick Start

```bash
# Review and install the backend runtime without replacing host functions
cortex backend install . --plan --jwt-provider ./jwt-provider.json
cortex backend install . --jwt-provider ./jwt-provider.json

# Register/provision only an explicitly verified disposable development target
cortex backend register . --target ./development-target.json
cortex backend provision . --target ./development-target.json --principal ./principal.json

# Configure public app metadata; host-issued JWTs remain in memory
cortex backend configure . --url https://my-dev.convex.cloud --http-url https://my-dev.convex.site --agent-id published-agent --agent-version 1
cortex backend guide

# Select a private host-issued JWT and its authorized scope
cortex config set token-file /private/path/host.jwt
cortex config set tenant-id demo-tenant
cortex config set memory-space-id demo-space
cortex config test

# Read operator statistics on the verified development target
cortex db stats --target ./development-target.json --project .

# List memory spaces
cortex spaces list

# Search memories
cortex memory search "release codename" --space demo-space
```

`cortex init . --backend` provides the same additive local installation. Neither
installation command registers a deployment, publishes an Agent, provisions a grant,
or proves model/media eligibility. Existing custom functions directories, schema,
component configuration, auth and HTTP routes are retained; ambiguous compositions
produce a merge proposal before source files are installed. Existing environment values
and scripts are preserved. Install the printed package dependencies with the host's
package manager after reviewing the plan.

Registration and provisioning use the accepted development verifier. Supply an exact
`development-target.json` with `teamId`, `projectId`, `deploymentName`, `deploymentUrl`
and `disposable: true`. The management API must confirm that identity and a cloud
development deployment. Credentials come only from `CONVEX_ACCESS_TOKEN` and a matching
`CONVEX_DEPLOY_KEY` (or explicitly named environment variables). Production targets are
refused. A principal file names the issuer, subject, actor kind, tenant, memory space,
capabilities and own/space/tenant resource access; it contains no JWT or provider key.
An optional expiry must be in the future. These operator files are explicit inputs and
are never copied into app configuration.

A fresh host may supply a `jwt-provider.json` custom-JWT configuration with `type`,
`issuer`, `jwks`, `algorithm` and `applicationID`. Existing host auth remains
the authority. Configure a published Agent/version and current server-verified grant,
then use the browser runtime entry and remote transport. Agent/Workflow component
registration and Gateway model qualification are separate prerequisites; unsupported
or unqualified model/media operations remain unavailable. App clients require no
OpenAI, Anthropic or Gateway inference key.

Public data commands use a fresh host-issued JWT from `CORTEX_AUTH_TOKEN`, an
explicit `--token-env` name, or `--token-file`. Choose one source. A token file must
be a regular, nonsymlink file owned by the current user with mode `0600` or stricter.
The CLI rereads rotated credentials and verifies the current principal and scope
before returning each result. Configuration stores environment names, private file
paths and scope selectors. A deployment key authorizes separate operator commands;
public SDK identity comes from the verified JWT. A missing or expired credential
produces an actionable error; renew it through the host identity provider.

Private asset upload/download routes require current identity and storage capabilities;
their limit is 20,000,000 bytes. Provider input protocols have separate, stricter caps.
Optional graph projection uses a trusted Node worker with service JWT and private Bolt
credentials; graph lag/strict barriers remain distinct from text completion. The
quickstart installer copies the app without a second Convex backend or graph credentials.
`cortex start` starts development services and never performs an implicit production
deployment or inherits a production deploy key.

## Commands

### Memory Operations

```bash
# Clear all memories for a user
cortex memory clear --user user-123 --space agent-1

# Clear all memories in a space
cortex memory clear --space agent-1

# List memories
cortex memory list --space agent-1 [--user user-123] [--limit 50]

# Search memories
cortex memory search "query" --space agent-1

# Delete specific memory
cortex memory delete mem-123 --space agent-1

# Export memories
cortex memory export --space agent-1 --output memories.json

# Memory statistics
cortex memory stats --space agent-1
```

### User Management

```bash
# List all users
cortex users list [--limit 100]

# Get user profile
cortex users get user-123

# Delete user with GDPR cascade deletion
cortex users delete user-123 --cascade [--dry-run]

# Delete multiple users
cortex users delete-many user-1 user-2 --cascade

# Export user data
cortex users export user-123 --output user-data.json

# User statistics
cortex users stats user-123
```

### Memory Spaces

```bash
# List memory spaces
cortex spaces list [--type team|personal|project]

# Create memory space
cortex spaces create team-alpha --type team --name "Team Alpha"

# Delete memory space with cascade
cortex spaces delete team-alpha --cascade

# Archive space
cortex spaces archive project-apollo --reason "Completed"

# Get space statistics
cortex spaces stats team-alpha

# Manage participants
cortex spaces participants team-alpha
cortex spaces add-participant team-alpha --id user-123 --type user
cortex spaces remove-participant team-alpha --id user-123
```

### Facts Operations

```bash
# List facts
cortex facts list --space agent-1 [--type preference]

# Search facts
cortex facts search "dark mode" --space agent-1

# Delete facts
cortex facts delete fact-123 --space agent-1

# Export facts
cortex facts export --space agent-1 --output facts.json
```

### Conversations

```bash
# List conversations
cortex conversations list [--user user-123] [--space agent-1]

# Get conversation with messages
cortex conversations get conv-123

# Delete conversation
cortex conversations delete conv-123

# Export conversation
cortex conversations export conv-123 --output conversation.json
```

### Convex Management

```bash
# Deploy schema updates
cortex convex deploy [--local|--prod]

# Check deployment status
cortex convex status

# View logs
cortex convex logs [--local|--prod] [--tail]

# Update SDK version
cortex convex update-sdk [--latest|--version 0.12.0]

# Sync schema
cortex convex schema sync
```

### Database Operations

```bash
# Exact operator counts, including each table's truncation flag
cortex db stats --target ./development-target.json --project . --format json

# Retire one disposable tenant and memory space with lifecycle fences
cortex db clear --target ./development-target.json --project . \
  --tenant-id demo-tenant --memory-space-id demo-space --yes

# Export bounded authorized metadata with restorable: false
cortex db backup --output ./metadata.json
cortex db export --output ./metadata-export.json
```

`db stats` and `db clear` verify the exact disposable cloud development target and
use a target-bound dev key through the pinned host Convex CLI. The default credential
environment names are `CONVEX_ACCESS_TOKEN` and `CONVEX_DEPLOY_KEY`; explicit names
can be selected with `--management-token-env` and `--deploy-key-env`. Statistics
preserve actual count/truncation values and propagate failures. Scoped retirement
retains billing history and deletion fences. Generic restore, global purge and
`--include-all` exports are unsupported and fail before effects. Metadata exports
use new private files and disclose their bounds.

### Development Utilities

```bash
# Seed test data
cortex dev seed [--users 10] [--memories 100]

# Clear test data
cortex dev clear-test-data

# Generate sample data
cortex dev generate-data --template chatbot
```

### Configuration

```bash
# Interactive setup
cortex setup

# Configure public deployment metadata and a private host JWT location
cortex config set convex-url https://my-deployment.convex.cloud
cortex config set token-file /private/path/host.jwt
cortex config set tenant-id demo-tenant
cortex config set memory-space-id demo-space

# Set URL for a specific deployment
cortex config set-url development --url "https://my-dev.convex.cloud"
cortex config set-url  # Interactive mode - select deployment and enter URL

# Show current configuration
cortex config show

# Test connection
cortex config test
```

## Configuration

The CLI looks for configuration in the following order (highest priority first):

1. CLI flags select the URL, deployment, JWT source and scope.
2. `CORTEX_AUTH_TOKEN` supplies the default host JWT; select the endpoint through flags or deployment configuration.
3. Project config: `./cortex.config.json`
4. User config: `~/.cortexrc`

### Config File Format (~/.cortexrc)

```json
{
  "deployments": {
    "development": {
      "url": "https://my-dev.convex.cloud",
      "tokenFile": "/private/path/host.jwt",
      "tenantId": "demo-tenant",
      "memorySpaceId": "demo-space"
    }
  },
  "default": "development",
  "format": "table",
  "confirmDangerous": true
}
```

## Global Options

All commands support these global options:

- `-d, --deployment <name>` - Use a named deployment from config
- `-u, --url <url>` - Override Convex deployment URL
- `--token-env <name>` - Select a host JWT environment variable; default `CORTEX_AUTH_TOKEN`
- `--token-file <path>` - Select a private owned regular JWT file
- `--tenant-id <id>` - Select a tenant covered by the current verified grant
- `--memory-space-id <id>` - Select a memory space covered by the current verified grant
- `-f, --format <format>` - Output format: table, json, csv
- `-q, --quiet` - Suppress non-essential output
- `--debug` - Enable debug output

## Safety Features

- **Confirmation prompts** for dangerous operations (delete, clear)
- **Dry-run mode** for previewing changes without executing
- **Verification** after cascade deletions
- **Scoped lifecycle retirement** preserves deletion fences and billing history
- **Explicit bounded metadata exports** disclose `restorable: false`

## Development

### Running Tests

Tests run against a real Convex instance (local or managed), using the same environment as the SDK tests.

```bash
# Run all tests (requires Convex running)
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run only unit tests (utilities - no Convex needed)
npm run test:unit

# Run only integration tests (requires Convex)
npm run test:integration

# Type checking
npm run typecheck
```

### Environment Setup

Tests use environment variables from the monorepo root:

- `.env.test` - Test defaults
- `.env.local` - Local overrides

Key variables:

- `LOCAL_CONVEX_URL` - Local Convex URL (e.g., `http://127.0.0.1:3210`)
- `CONVEX_URL` - Managed Convex URL
- `CONVEX_TEST_MODE` - `local`, `managed`, or `auto`

### Test Structure

```
tests/
├── env.ts              # Environment setup (runs first)
├── setup.ts            # Test hooks and cleanup
├── memory.test.ts      # Memory commands integration tests
├── users.test.ts       # User commands integration tests
└── spaces.test.ts      # Space commands integration tests

src/utils/__tests__/
├── validation.test.ts  # Input validation unit tests
├── formatting.test.ts  # Output formatting unit tests
└── config.test.ts      # Config management unit tests
```

### Building

```bash
# Build the CLI
npm run build

# Watch mode for development
npm run dev

# Lint
npm run lint
```

## License

FSL-1.1-Apache-2.0
