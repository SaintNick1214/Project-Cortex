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
# Run interactive setup
cortex setup

# Check database statistics
cortex db stats

# List memory spaces
cortex spaces list

# Search memories
cortex memory search "password" --space agent-1
```

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
# Database statistics
cortex db stats

# Clear entire database (dangerous!)
cortex db clear --confirm "I understand this is irreversible"

# Backup database
cortex db backup --output backup.json

# Restore from backup
cortex db restore --input backup.json [--dry-run]
```

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

# Configure deployment
cortex config set convex-url https://my-deployment.convex.cloud
cortex config set convex-key "..."

# Set deploy key for a specific deployment
cortex config set-key production --key "prod|abc123..."
cortex config set-key  # Interactive mode - select deployment and enter key

# Set URL for a specific deployment
cortex config set-url production --url "https://new-app.convex.cloud"
cortex config set-url  # Interactive mode - select deployment and enter URL

# Show current configuration
cortex config show

# Test connection
cortex config test
```

## Configuration

The CLI looks for configuration in the following order (highest priority first):

1. CLI flags: `--url`, `--key`, `--deployment`
2. Environment variables: `CONVEX_URL`, `CONVEX_DEPLOY_KEY`
3. Project config: `./cortex.config.json`
4. User config: `~/.cortexrc`

### Config File Format (~/.cortexrc)

```json
{
  "deployments": {
    "local": {
      "url": "http://127.0.0.1:3210",
      "deployment": "anonymous:anonymous-cortex-sdk-local"
    },
    "staging": {
      "url": "https://staging.convex.cloud",
      "key": "..."
    },
    "production": {
      "url": "https://prod.convex.cloud",
      "key": "..."
    }
  },
  "default": "local",
  "format": "table",
  "confirmDangerous": true
}
```

## Global Options

All commands support these global options:

- `-d, --deployment <name>` - Use a named deployment from config
- `-u, --url <url>` - Override Convex deployment URL
- `-k, --key <key>` - Override Convex deploy key
- `-f, --format <format>` - Output format: table, json, csv
- `-q, --quiet` - Suppress non-essential output
- `--debug` - Enable debug output

## Safety Features

- **Confirmation prompts** for dangerous operations (delete, clear)
- **Dry-run mode** for previewing changes without executing
- **Verification** after cascade deletions
- **Backups** before destructive operations

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

Apache-2.0
