# @cortexmemory/cli Changelog

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
