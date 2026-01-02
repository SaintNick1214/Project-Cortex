# Configuration

> **Last Updated**: January 1, 2026

## Overview

Cortex uses a hierarchical configuration system managed by the CLI. Configuration is minimal by default but offers extensive customization when needed.

---

## Quick: Auth Integration

> **Common Question:** "How do I integrate my auth system (Auth0, Clerk, Okta, WorkOS, etc.)?"

**Answer:** Cortex works with **ANY auth system** - just extract `userId` and optionally `tenantId`:

```typescript
import { createAuthContext } from "@cortexmemory/sdk";

// Extract from YOUR auth (3 lines of code)
const auth = createAuthContext({
  userId: yourAuthData.id, // Required
  tenantId: yourAuthData.tenantId, // Optional (multi-tenant SaaS)
});

// Pass to Cortex
const cortex = new Cortex({ convexUrl: process.env.CONVEX_URL!, auth });

// Done! All operations now authenticated
```

**Works with:** Auth0, Clerk, NextAuth, Supabase, Firebase, Okta, WorkOS, OIDC, OAuth, custom JWT, sessions, API keys, or any auth system you already use.

**See:** [Authentication Guide](../02-core-features/18-authentication.md) for complete setup.

---

---

## Configuration Hierarchy

The CLI uses a hierarchical configuration system (highest priority first):

1. **CLI Flags** - `--url`, `--key`, `--deployment`
2. **Environment Variables** - `CONVEX_URL`, `CONVEX_DEPLOY_KEY`
3. **Project Config** - `./cortex.config.json` (optional)
4. **User Config** - `~/.cortexrc` (managed by CLI)

### Example: How Priority Works

```bash
# User config (~/.cortexrc) says: local deployment
# Environment variable says: CONVEX_URL=http://127.0.0.1:3210
# CLI flag overrides everything:
cortex db stats --url https://prod.convex.cloud

# Result: Uses production URL from flag
```

---

## User Configuration (~/.cortexrc)

The CLI automatically manages `~/.cortexrc` for deployment settings.

### Viewing Configuration

```bash
# Show all configuration
cortex config show

# List all deployments
cortex config list

# View config file path
cortex config path
```

### Configuration File Format

The `~/.cortexrc` file is JSON:

```json
{
  "deployments": {
    "local": {
      "url": "http://127.0.0.1:3210",
      "deployment": "anonymous:anonymous-cortex-sdk-local",
      "projectPath": "/Users/you/projects/my-agent",
      "enabled": true
    },
    "staging": {
      "url": "https://staging.convex.cloud",
      "key": "dev:staging|key",
      "projectPath": "/Users/you/projects/my-agent",
      "enabled": false
    },
    "production": {
      "url": "https://prod.convex.cloud",
      "key": "prod:prod|key",
      "projectPath": "/Users/you/projects/my-agent",
      "enabled": false
    }
  },
  "apps": {
    "quickstart": {
      "type": "nextjs",
      "projectPath": "/Users/you/projects/my-agent",
      "path": "quickstart",
      "port": 3000,
      "startCommand": "npm run dev",
      "enabled": true
    }
  },
  "default": "local",
  "format": "table",
  "confirmDangerous": true
}
```

**Fields:**

| Field                           | Type    | Description                                   |
| ------------------------------- | ------- | --------------------------------------------- |
| `deployments`                   | object  | Named deployment configurations               |
| `deployments[name].url`         | string  | Convex deployment URL                         |
| `deployments[name].key`         | string  | Deploy key (optional for local)               |
| `deployments[name].deployment`  | string  | Convex deployment name                        |
| `deployments[name].projectPath` | string  | Path to project directory                     |
| `deployments[name].enabled`     | boolean | Auto-start with `cortex start`                |
| `apps`                          | object  | Named app configurations                      |
| `apps[name].type`               | string  | App type (e.g., "nextjs")                     |
| `apps[name].projectPath`        | string  | Path to project root                          |
| `apps[name].path`               | string  | Relative path to app                          |
| `apps[name].port`               | number  | Port number                                   |
| `apps[name].startCommand`       | string  | Command to start app                          |
| `apps[name].enabled`            | boolean | Auto-start with `cortex start`                |
| `default`                       | string  | Default deployment name                       |
| `format`                        | string  | Default output format                         |
| `confirmDangerous`              | boolean | Require confirmation for dangerous operations |

---

## Managing Deployments

### Adding Deployments

```bash
# Interactive mode (recommended)
cortex config add-deployment

# With options
cortex config add-deployment cloud \
  --url https://your-app.convex.cloud \
  --key "prod|..."

# Set as default
cortex config add-deployment production \
  --url https://prod.convex.cloud \
  --default
```

### Removing Deployments

```bash
# Interactive mode
cortex config remove-deployment

# Specific deployment
cortex config remove-deployment staging
```

**Note:** Cannot remove the default deployment. Set a different default first.

### Updating Deployment Settings

```bash
# Update URL
cortex config set-url production \
  --url https://new-prod.convex.cloud

# Update deploy key
cortex config set-key production \
  --key "prod|new-key"

# Set project path (enables running from anywhere)
cortex config set-path production /path/to/project
```

### Enabling/Disabling Deployments

Control which deployments start with `cortex start`:

```bash
# Enable (will auto-start)
cortex config enable staging

# Disable (won't auto-start)
cortex config disable production

# View status
cortex config list
```

### Switching Deployments

```bash
# Show current deployment
cortex use

# Switch to different deployment
cortex use production

# Clear current deployment
cortex use --clear

# All subsequent commands use the current deployment
cortex db stats  # Uses production (from 'cortex use production')
```

### Testing Configuration

```bash
# Test connection to deployment
cortex config test

# Test specific deployment
cortex config test --deployment production
```

---

## Environment Variables

The CLI recognizes these environment variables:

### Convex Configuration

| Variable                  | Description                                       |
| ------------------------- | ------------------------------------------------- |
| `CONVEX_URL`              | Convex deployment URL                             |
| `CONVEX_DEPLOY_KEY`       | Convex deploy key                                 |
| `CONVEX_DEPLOYMENT`       | Convex deployment name                            |
| `LOCAL_CONVEX_URL`        | Local Convex URL (default: http://127.0.0.1:3210) |
| `CLOUD_CONVEX_URL`        | Cloud Convex URL                                  |
| `CLOUD_CONVEX_DEPLOY_KEY` | Cloud deploy key                                  |

### Graph Database Configuration

| Variable            | Description                        |
| ------------------- | ---------------------------------- |
| `NEO4J_URI`         | Neo4j connection URI               |
| `NEO4J_USERNAME`    | Neo4j username                     |
| `NEO4J_PASSWORD`    | Neo4j password                     |
| `MEMGRAPH_URI`      | Memgraph connection URI            |
| `MEMGRAPH_USERNAME` | Memgraph username                  |
| `MEMGRAPH_PASSWORD` | Memgraph password                  |
| `CORTEX_GRAPH_SYNC` | Enable graph sync ("true"/"false") |

### Other Configuration

| Variable              | Description                    |
| --------------------- | ------------------------------ |
| `OPENAI_API_KEY`      | OpenAI API key for embeddings  |
| `CORTEX_SDK_DEV_PATH` | Path to local SDK for dev mode |
| `DEBUG`               | Enable debug output            |

### Example .env.local

```env
# Convex Configuration
CONVEX_URL=http://127.0.0.1:3210

# For cloud deployment:
# CONVEX_URL=https://your-app.convex.cloud
# CONVEX_DEPLOY_KEY=dev:your-app|key

# Optional: Graph Database
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=password

# Optional: Embeddings
OPENAI_API_KEY=sk-your-key-here
```

---

## Multi-Environment Setup

### Example: Local + Staging + Production

```bash
# 1. Add local development
cortex config add-deployment local \
  --url http://127.0.0.1:3210

cortex config set-path local ~/projects/my-agent

# 2. Add staging
cortex config add-deployment staging \
  --url https://staging.convex.cloud

cortex config set-key staging  # Prompts for key

# 3. Add production
cortex config add-deployment production \
  --url https://prod.convex.cloud

cortex config set-key production  # Prompts for key

# 4. Enable only local for auto-start
cortex config enable local
cortex config disable staging
cortex config disable production

# Now 'cortex start' starts only local
# Use 'cortex start -d staging' for staging
# Use 'cortex start -d production' for production
```

### Switching Between Environments

```bash
# Work on local
cortex use local
cortex start
cortex db stats

# Switch to production
cortex use production
cortex db stats           # Shows production stats
cortex memory list --space user-123

# Or target specific deployment without switching
cortex db stats -d staging
```

---

## Project Configuration (Optional)

### cortex.config.json

You can optionally create a `cortex.config.json` in your project root:

```json
{
  "defaultMemorySpace": "my-agent",
  "defaultImportance": 50,
  "memoryRetention": {
    "maxVersions": 10,
    "retentionDays": 365
  },
  "graph": {
    "enabled": true,
    "uri": "bolt://localhost:7687"
  }
}
```

**Note:** This is optional. Most configuration is managed via CLI in `~/.cortexrc`.

---

## SDK Configuration

When using the SDK programmatically, configuration is minimal:

```typescript
import { Cortex } from "@cortexmemory/sdk";

// Minimal configuration
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!, // Set by CLI or .env.local
});

// Or with graph database
import {
  CypherGraphAdapter,
  initializeGraphSchema,
} from "@cortexmemory/sdk/graph";

const graphAdapter = new CypherGraphAdapter();
await graphAdapter.connect({
  uri: process.env.NEO4J_URI!,
  username: process.env.NEO4J_USERNAME!,
  password: process.env.NEO4J_PASSWORD!,
});

await initializeGraphSchema(graphAdapter);

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
  graph: {
    adapter: graphAdapter,
    orphanCleanup: true,
  },
});
```

**See:**

- [API Reference - Configuration](../03-api-reference/02-memory-operations.md#configuration)
- [Graph Database Integration](../07-advanced-topics/02-graph-database-integration.md)

---

## Common CLI Workflows

### Workflow 1: Multi-Environment Development

```bash
# Morning: Start local development
cortex use local
cortex dev  # Interactive dashboard

# Afternoon: Test on staging
cortex use staging
cortex start
cortex db stats  # Check staging data

# Evening: Deploy to production
cortex use production
cortex deploy
cortex status  # Verify deployment
```

### Workflow 2: Database Management

```bash
# Backup production before changes
cortex use production
cortex db backup --output prod-backup-$(date +%Y%m%d).json

# Make changes on staging
cortex use staging
cortex db clear  # Clear test data
# ... make changes ...

# Verify changes worked
cortex db stats

# Deploy to production
cortex use production
cortex deploy
```

### Workflow 3: GDPR Compliance

```bash
# Export user data (GDPR portability)
cortex users export user-123 --output user-data.json

# Preview deletion (dry run)
cortex users delete user-123 --cascade --dry-run

# Delete user data (GDPR erasure)
cortex users delete user-123 --cascade --verify
```

---

## Security Configuration

### Authentication

The CLI doesn't handle application auth. Integrate with your existing auth system:

```typescript
// Example with Clerk
import { auth } from "@clerk/nextjs";

export async function chatAction(message: string) {
  const { userId } = auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  // Use authenticated userId
  await cortex.memory.remember({
    memorySpaceId: `user-${userId}`,
    conversationId,
    userMessage: message,
    agentResponse: response,
    userId,
    userName: user.name,
  });
}
```

### Data Isolation

Ensure proper memory space boundaries:

```bash
# Good: User-specific space
cortex memory list --space user-alice
cortex memory list --space user-bob

# Bad: Shared space (unless intentional)
cortex memory list --space global
```

### Sensitive Data

Be careful with PII:

```bash
# Search for potential PII
cortex memory search "password" --space user-123
cortex memory search "email" --space user-123

# Export for review
cortex memory export --space user-123 --output review.json

# Delete if needed
cortex memory delete <memoryId> --space user-123
```

---

## Performance Configuration

### Connection Reuse

The CLI reuses connections automatically. For SDK usage:

```typescript
// Good: Single instance (recommended)
const cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });

// Use this instance throughout your app
export default cortex;

// Bad: Creating new instance for each operation
// This creates unnecessary connections
```

### Batch Operations

Use CLI commands efficiently:

```bash
# Export all spaces at once
cortex spaces list --format json > spaces.json

# Export memories for multiple spaces
for space in $(cat spaces.json | jq -r '.[].id'); do
  cortex memory export --space $space --output "$space-memories.json"
done
```

---

## Advanced Configuration

### Debug Mode

Enable verbose logging:

```bash
# Via flag
cortex db stats --debug

# Via environment variable
DEBUG=1 cortex db stats

# Shows:
# - Environment variable loading
# - Configuration resolution
# - API request/response details
# - Process spawning
```

### Custom Output Formats

```bash
# Table format (default)
cortex db stats

# JSON format (for scripting)
cortex db stats --format json

# CSV format (for export)
cortex memory list --space user-123 --format csv
```

### Configuration Reset

If you need to start fresh:

```bash
# Reset all configuration
cortex config reset

# This removes:
# - All deployments
# - All apps
# - Default settings
# But keeps:
# - Project .env.local files
# - Deployed Convex data
```

---

## Configuration Best Practices

### 1. Use Environment Variables

```typescript
// Good: Environment-based config
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!,
});

// Bad: Hardcoded values
const cortex = new Cortex({
  convexUrl: "https://my-deployment.convex.cloud", // Don't!
});
```

### 2. Separate Environments

```bash
# Development
cortex use local

# Staging
cortex use staging

# Production
cortex use production

# Never mix!
```

### 3. Secure Credentials

```bash
# Store deploy keys securely
cortex config set-key production  # Prompts for key

# Never commit keys to git
echo ".env.local" >> .gitignore
echo "~/.cortexrc" >> .gitignore  # If you check in config
```

### 4. Test Before Production

```bash
# Always test on staging first
cortex use staging
cortex deploy
cortex db stats
# ... verify everything works ...

# Then deploy to production
cortex use production
cortex deploy
```

### 5. Regular Backups

```bash
# Backup production regularly
cortex use production
cortex db backup --output prod-backup-$(date +%Y%m%d).json

# Automate with cron
0 2 * * * cd /path/to/project && cortex use production && cortex db backup
```

---

## Troubleshooting

### Configuration Not Found

```bash
# Error: No deployments configured

# Fix: Initialize a project
cortex init

# Or add existing deployment
cortex config add-deployment
```

### Wrong Deployment

```bash
# Check current deployment
cortex use

# Switch to correct one
cortex use local

# Or clear and specify
cortex use --clear
cortex db stats -d local
```

### Connection Failed

```bash
# Test connection
cortex config test

# Check URL
cortex config show

# Verify Convex is running
cortex status
cortex start
```

### Environment Variable Conflicts

```bash
# Check what's being used
cortex config show --debug

# Priority order:
# 1. CLI flags (--url, --key)
# 2. Environment variables
# 3. User config (~/.cortexrc)
```

---

## Next Steps

**Configuration is done! Now:**

1. **[Memory Operations API](../03-api-reference/02-memory-operations.md)** - Start using the SDK
2. **[CLI Reference](../06-tools/01-cli-reference.md)** - All CLI commands
3. **[Architecture](../04-architecture/01-system-overview.md)** - Understand the system design
4. **[Core Features](../02-core-features/01-memory-spaces.md)** - Deep dive into features

---

**Questions?** Ask in [Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions).
