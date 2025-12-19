# @cortexmemory/cli Changelog

## [0.22.2] - 2025-12-19

### Fixed

- Fixed `cortex convex deploy` (and all `cortex convex *` commands) deploying to wrong Convex instance when run from a directory with its own `.env.local`
  - Inherited `CONVEX_*` environment variables from the parent process were overriding the target deployment's configuration
  - Now clears inherited Convex environment variables before spawning child processes, ensuring the correct project's `.env.local` is used
  - Affected commands: `deploy`, `dev`, `logs`, `dashboard`, `init`, `env`

### Changed

- `cortex db clear` now uses batch operations instead of iterating one-by-one
  - Agents: Uses `agents.unregisterMany()` (single backend mutation)
  - Contexts, conversations, memorySpaces, immutable: Direct table clear (SDK batch methods require filters)
  - Users: Removed redundant loop (users are virtual - data cleared via underlying tables)
  - Significantly faster when clearing large datasets

## [0.22.0] - 2025-12-16

### Added

- `cortex config set-key [deployment]` - Easily set or update the deploy key for any deployment
  - Interactive deployment selection when name not provided
  - Secure password input for key entry
  - Updates both `~/.cortexrc` and `.env.local` by default
- `cortex config set-url [deployment]` - Easily set or update the URL for any deployment
  - Interactive deployment selection when name not provided
  - Shows current URL as default value
  - Validates URL format before saving
- `cortex spaces delete --reason` option for audit trail

### Fixed

- Fixed SDK type compatibility with paginated result types (`ListConversationsResult`, `ListMemorySpacesResult`, `ListUsersResult`)
- Fixed `cortex spaces delete` missing required `reason` parameter
- Fixed eslint errors on auto-generated Convex files by adding `convex/**` to ignores

## [0.21.0] - 2025-12-16

### Added

#### Interactive Development Mode

- `cortex dev` - Expo-style interactive terminal for development
  - Multi-deployment support (runs all enabled deployments simultaneously)
  - Live status dashboard with service indicators (Convex, Graph DB)
  - Aggregated streaming logs from all instances with deployment prefixes
  - Keyboard shortcuts for common actions:
    - `c` - Clear screen and show status
    - `s` - Show full status dashboard
    - `r` - Restart all services
    - `g` - Toggle graph database (with deployment selection if multiple)
    - `k` - Kill Convex instances (resolve port conflicts)
    - `q` - Quit (graceful shutdown)
    - `?` - Show help
  - Auto-prompts to run `cortex init` if no deployments configured
  - Options: `-d, --deployment <name>`, `-l, --local`

#### Init Wizard

- `cortex init [directory]` - Interactive project setup wizard
  - Replaces `npx create-cortex-memories` with integrated CLI experience
  - Convex setup options: new cloud project, existing deployment, or local
  - Graph database setup (Neo4j or Memgraph) with Docker Compose
  - Optional CLI scripts added to `package.json` (`cortex`, `cortex:setup`, `cortex:stats`, `cortex:spaces`, `cortex:status`)
  - Auto-saves deployment configuration to `~/.cortexrc`
  - Shows running status dashboard after setup completes
  - Options:
    - `--local` - Quick setup with local Convex only
    - `--cloud` - Quick setup with cloud Convex only
    - `--skip-graph` - Skip graph database setup
    - `-t, --template <name>` - Template to use (default: basic)
    - `-y, --yes` - Skip confirmation prompts
    - `--start` - Start Convex dev server after setup

#### Multi-Environment Support

- **Full multi-deployment support across ALL commands** - Manage multiple Convex backends (local, cloud, staging, etc.) from a single CLI
- `cortex use [deployment]` - Set current deployment for session context (stored in `~/.cortex-current`)
  - `cortex use --clear` - Clear current deployment setting
  - Shows current deployment when run without arguments
- `-d, --deployment <name>` flag now available on ALL commands for explicit deployment targeting
- **Smart deployment selection logic:**
  1. Single deployment → used automatically with "Using: X" hint
  2. Multiple deployments → interactive prompt with "Using: X" hint
  3. `-d` flag provided → uses specified deployment with "Using: X" hint
- All memory operations (`memory`, `users`, `spaces`, `facts`, `conversations`) support multi-env
- All database operations (`db stats/clear/backup/restore/export`) support multi-env
- All Convex operations (`convex status/deploy/dev/logs/dashboard/update`) now:
  - Support `-d, --deployment` flag
  - Execute from the deployment's `projectPath` directory
  - Use correct credentials per deployment
- **Deployment configuration enhancements:**
  - `enabled` flag on deployments - Control which deployments auto-start with `cortex start`
  - `projectPath` per deployment - Run commands from correct directory regardless of current working directory

#### Command Organization

- **Command order optimized for workflow:** start → stop → status → config → init → db → dev
- **Memory Operations section** - `memory`, `users`, `spaces`, `facts`, `conversations` grouped separately in help
- Removed `setup` command (redundant with `init`)
- Removed unused global flags: `-u`, `-k`, `-q`

#### Convex Commands

- `cortex convex update` (renamed from `update-sdk`) - Comprehensive update command that:
  - Updates `@cortexmemory/sdk` to latest (or specified version)
  - Checks for Convex patch updates and prompts to update if available
  - Shows current vs latest versions with SDK's peer dependency info
  - Options: `--sdk-version <version>`, `--convex-version <version>`, `-y, --yes`
- `cortex convex env` - Manage Convex environment variables
  - `--list` - List environment variables
  - `--set <key=value>` - Set environment variable
  - `--prod` - Use production environment

#### Configuration

- Auto-load `.env.local` from current directory for seamless project configuration
- `cortex config add-deployment` now writes to `.env.local` (use `--json-only` for ~/.cortexrc only)
- `cortex config add-deployment` prompts interactively when arguments are missing
- `cortex config remove-deployment` now removes from `.env.local` (use `--json-only` for ~/.cortexrc only)
- `cortex config remove-deployment` prompts interactively when name is missing
- `cortex config path` now shows both JSON config and `.env.local` paths
- `cortex config path` now displays currently set environment variables
- `cortex config list` - View all deployments with organized columns:
  - Deployment name, URL, enabled status, graph status
- `cortex config status` - Updated for multi-deployment display
- `cortex config set-path <deployment> [path]` - Set project path for a deployment
  - Enables running `cortex start -d <name>` from any directory
  - Defaults to current directory if path not provided
- `cortex config enable <deployment>` - Enable a deployment (will be started with `cortex start`)
- `cortex config disable <deployment>` - Disable a deployment (will not be started with `cortex start`)

#### Graph Database Integration

- Full Neo4j and Memgraph support with Docker Compose
- `docker-compose.graph.yml` auto-generated during `cortex init`
- Graph containers auto-start/stop with `cortex start` and `cortex stop`
- Graph database toggle in interactive dev mode (`g` key)
- `cortex db clear` now clears graph database nodes and relationships when graph sync is enabled
- Environment variable detection (`NEO4J_URI`, `MEMGRAPH_URI`, `CORTEX_GRAPH_SYNC`)

#### Database & Stats

- `cortex users list` now shows usage stats (memories, conversations, facts) instead of raw data
- `cortex users list --no-stats` option for faster listing without gathering stats
- `cortex db clear` now shows target database and allows selecting from multiple deployments
- `cortex db clear` simplified confirmation (y/N instead of typing exact phrase)
- `cortex db stats` now shows all 11 tables with comprehensive statistics
- `cortex db clear` now clears ALL 11 tables: agents, contexts, conversations, facts, memories, memorySpaces, immutable, mutable, governancePolicies, governanceEnforcement, graphSyncQueue
- Added usage examples in command descriptions (e.g., `cortex config add-deployment --help`)

#### Lifecycle Commands

- `cortex start` - Starts all **enabled** deployments (local Convex, managed deployments, graph DBs)
  - `-d, --deployment <name>` - Start a specific deployment only
  - `-l, --local` - Use Convex local beta mode (starts a new local backend)
  - `-f, --foreground` - Run in foreground (only works with single deployment)
  - `--convex-only` - Only start Convex servers
  - `--graph-only` - Only start graph databases
  - Auto-deploys functions to production before starting dev mode for cloud deployments
- `cortex stop` - Stops all running deployments with process cleanup
  - `-d, --deployment <name>` - Stop specific deployment only
  - `--convex-only` - Only stop Convex server
  - `--graph-only` - Only stop graph database
- `cortex status` - Shows status of all configured deployments
  - Per-deployment status: Convex running, graph running, project path
  - SDK version check with update available indicator

### Fixed

- Fixed `cortex start` not starting local Convex instances configured via `init`
- Fixed `cortex dev` and `cortex start` failing when run from outside project directory (now uses `projectPath`)
- Fixed `cortex config reset` creating phantom "local" deployment (now advises running `init` or `add-deployment`)
- Fixed test environment using wrong Convex deployment (ts-sdk-tests vs cli-tests)
- Fixed `cortex db clear` timing out on agents by using fast unregister (was 3.6s/agent with cascade, now 5ms/agent)
- Fixed all commands hanging after completion by properly closing SDK client connections
- Fixed `cortex config add-deployment` failing to parse `-u/--url` option due to conflict with global options
- Fixed path truncation to show end of path (filename) instead of beginning
- Fixed help screen not showing commands when run without arguments
- Fixed `cortex db clear` and other commands failing with "limit must be at most 1000" error
- Fixed `cortex db clear` not clearing all data (now clears agents, contexts, memory spaces, users)
- Fixed `cortex config list` spacing between name and URL columns

## [0.1.0] - 2025-11-29

### Added

#### Core Commands

- **Memory Operations** (`cortex memory`)
  - `list` - List memories in a memory space
  - `search` - Search memories by content
  - `delete` - Delete a specific memory
  - `clear` - Clear multiple memories
  - `export` - Export memories to JSON/CSV
  - `stats` - Show memory statistics
  - `get` - Get memory details
  - `archive` - Archive a memory (soft delete)
  - `restore` - Restore archived memory

- **User Management** (`cortex users`)
  - `list` - List all user profiles
  - `get` - Get user profile details
  - `delete` - Delete user with GDPR cascade deletion
  - `delete-many` - Bulk delete users
  - `export` - Export user data
  - `stats` - Show user statistics
  - `update` - Update user profile
  - `create` - Create new user
  - `exists` - Check if user exists

- **Memory Spaces** (`cortex spaces`)
  - `list` - List memory spaces
  - `create` - Create new memory space
  - `get` - Get memory space details
  - `delete` - Delete with optional cascade
  - `archive` - Archive memory space
  - `reactivate` - Reactivate archived space
  - `stats` - Show space statistics
  - `participants` - List participants
  - `add-participant` - Add participant
  - `remove-participant` - Remove participant
  - `update` - Update memory space
  - `count` - Count memory spaces
  - `search` - Search spaces by name

- **Facts Operations** (`cortex facts`)
  - `list` - List facts in a space
  - `search` - Search facts
  - `get` - Get fact details
  - `delete` - Delete a fact
  - `export` - Export facts
  - `count` - Count facts
  - `clear` - Clear all facts

- **Conversations** (`cortex conversations`)
  - `list` - List conversations
  - `get` - Get conversation with messages
  - `delete` - Delete conversation
  - `export` - Export conversation
  - `count` - Count conversations
  - `clear` - Clear conversations
  - `messages` - List messages

- **Convex Management** (`cortex convex`)
  - `status` - Check deployment status
  - `deploy` - Deploy schema/functions
  - `dev` - Start development server
  - `logs` - View deployment logs
  - `dashboard` - Open dashboard
  - `update-sdk` - Update SDK version
  - `schema` - View schema information
  - `init` - Initialize Convex
  - `env` - Manage environment variables

- **Database Operations** (`cortex db`)
  - `stats` - Database statistics
  - `clear` - Clear entire database (dangerous!)
  - `backup` - Backup database
  - `restore` - Restore from backup
  - `export` - Export all data

- **Development Utilities** (`cortex dev`)
  - `seed` - Seed test data
  - `clear-test-data` - Clear test data
  - `generate-data` - Generate sample data
  - `debug search` - Test vector search
  - `debug inspect` - Inspect memory details
  - `debug connection` - Test connection

- **Configuration** (`cortex setup` & `cortex config`)
  - `setup` - Interactive setup wizard
  - `config show` - Show configuration
  - `config set` - Set config value
  - `config test` - Test connection
  - `config deployments` - List deployments
  - `config add-deployment` - Add deployment
  - `config remove-deployment` - Remove deployment
  - `config path` - Show config paths
  - `config reset` - Reset to defaults

#### Features

- Configuration management with multiple deployment support
- Table, JSON, and CSV output formats
- Interactive confirmations for dangerous operations
- Dry-run mode for previewing changes
- Progress spinners for long-running operations
- GDPR-compliant cascade deletion
- Backup and restore functionality
- Test data seeding and cleanup

### Integration

- Added to `create-cortex-memories` wizard as optional installation
- Automatic npm scripts added to generated projects:
  - `npm run cortex` - Run CLI
  - `npm run cortex:setup` - Setup wizard
  - `npm run cortex:stats` - Database statistics
  - `npm run cortex:spaces` - List memory spaces

### Dependencies

- @cortexmemory/sdk ^0.12.0
- commander ^13.1.0
- prompts ^2.4.2
- picocolors ^1.1.1
- ora ^9.0.0
- cli-table3 ^0.6.5
- cosmiconfig ^9.0.0
- convex ^1.29.3
