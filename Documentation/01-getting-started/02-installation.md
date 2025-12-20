# Installation

> **Last Updated**: 2025-12-18

## Quick Start

The fastest way to get started with Cortex:

```bash
# Install the CLI globally
npm install -g @cortexmemory/cli

# Create a new project
cortex init my-cortex-agent
```

The interactive wizard will:

- Set up a complete Cortex project
- Configure Convex (local or cloud)
- Install all dependencies
- Deploy backend functions
- Create working example code
- Optionally set up graph database (Neo4j/Memgraph)

**Time to working agent:** < 5 minutes

---

## Installation Methods

### Method 1: Cortex CLI (Recommended)

Best for: New projects, first-time users, production deployments

```bash
# Install CLI globally
npm install -g @cortexmemory/cli

# Create new project
cortex init my-ai-agent
cd my-ai-agent

# Start all services (Convex + graph DB if configured)
cortex start

# Or use interactive dev mode with live dashboard
cortex dev
```

**What you get:**

- ✅ Cortex SDK installed
- ✅ Convex backend deployed
- ✅ Environment configured (.env.local)
- ✅ Working example code
- ✅ Optional graph database setup (Docker)
- ✅ Multi-deployment management via CLI
- ✅ Deployment saved to `~/.cortexrc`

### Method 2: Add to Existing Project

Best for: Integrating Cortex into existing applications

```bash
cd your-existing-project
cortex init .
```

The wizard will add Cortex to your project without disrupting existing code.

### Method 3: Legacy Wizard

Best for: Users who prefer npx without global install

```bash
npm create cortex-memories@latest my-ai-agent
cd my-ai-agent
npm run dev  # Start Convex
npm start    # Run your agent
```

> **Note:** The `cortex init` method is recommended as it provides additional features like multi-deployment management, interactive dev mode, and integrated graph database setup.

### Method 4: Manual Installation

Best for: Advanced users who want full control

```bash
# 1. Install packages
npm install @cortexmemory/sdk convex

# 2. Copy backend functions
# The SDK package includes convex-dev/ folder
# Copy it to your project:
cp -r node_modules/@cortexmemory/sdk/convex-dev ./convex

# 3. Create convex.json
echo '{"functions": "convex/"}' > convex.json

# 4. Configure environment
# Create .env.local:
echo 'CONVEX_URL=http://127.0.0.1:3210' > .env.local

# 5. Deploy Convex
npx convex dev
```

---

## CLI Commands Reference

Once the CLI is installed, you have access to powerful management commands:

```bash
# Project Setup
cortex init [dir]              # Create new project or add to existing

# Lifecycle Management
cortex start                   # Start all enabled deployments
cortex stop                    # Stop all running services
cortex status                  # View status dashboard
cortex dev                     # Interactive dev mode with live logs

# Configuration
cortex config list             # View all deployments
cortex config add-deployment   # Add a new deployment
cortex use <name>              # Switch between deployments
cortex config enable <name>    # Enable a deployment for auto-start
cortex config disable <name>   # Disable a deployment

# Database Operations
cortex db stats                # View database statistics
cortex db clear                # Clear database (with confirmation)

# Convex Management
cortex convex status           # Check Convex deployment status
cortex convex update           # Update SDK and Convex packages
```

---

## Prerequisites

### Required

- **Node.js 18+** - Download from [nodejs.org](https://nodejs.org)
- **npm 9+** - Comes with Node.js

Check your versions:

```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be 9.0.0 or higher
```

### Optional

- **Convex Account** - For cloud deployments (free tier available)
  - Sign up at [convex.dev](https://convex.dev)
  - Required for vector search features
  - Not needed for local development

- **Docker Desktop** - For local graph database
  - Download from [docker.com](https://www.docker.com/products/docker-desktop)
  - Only needed if using graph database features
  - Not required for basic Cortex usage

- **OpenAI API Key** - For embeddings
  - Get from [platform.openai.com](https://platform.openai.com)
  - Or use any other embedding provider
  - Optional - Cortex works without embeddings

---

## Convex Setup Options

Cortex works with Convex in three modes:

### 1. Local Development (Default)

**Best for:** Rapid iteration, learning, prototyping

**Pros:**

- ✅ No account needed
- ✅ Instant start
- ✅ Fully private
- ✅ Free forever

**Cons:**

- ❌ No vector search
- ❌ Not production-ready
- ❌ Data stored locally only

**Setup:**

```bash
cortex init my-agent --local
# Or select "Local development" when prompted
```

### 2. Convex Cloud (Recommended for Production)

**Best for:** Production apps, full features, collaboration

**Pros:**

- ✅ Full vector search support
- ✅ Automatic scaling
- ✅ Real-time sync
- ✅ Production-ready
- ✅ Free tier available

**Cons:**

- ❌ Requires Convex account
- ❌ Internet required
- ❌ Costs scale with usage

**Setup:**

```bash
cortex init my-agent --cloud
# Or select "Create new Convex project" when prompted
# Follow prompts to login/create account
```

### 3. Existing Convex Deployment

**Best for:** Adding Cortex to existing Convex projects

**Pros:**

- ✅ Reuse existing deployment
- ✅ Centralized data
- ✅ Existing auth setup

**Setup:**

```bash
cortex init my-agent
# Select: "Use existing Convex deployment"
# Enter your CONVEX_URL and deploy key
```

---

## Verification

After installation, verify everything works:

### 1. Check Installation

```bash
# Verify CLI is installed
cortex --version
# Should show: 0.21.0 or higher

# Verify SDK is installed in your project
npm list @cortexmemory/sdk
# Should show: @cortexmemory/sdk@0.21.0 or higher

# Check backend files exist
ls convex/
# Should list: schema.ts, conversations.ts, memories.ts, etc.
```

### 2. Check Status

```bash
# View status of all deployments
cortex status
# Shows: Convex running status, graph DB status, SDK version
```

### 3. Test Connection

```bash
# Start all services
cortex start

# Or use interactive mode to see live logs
cortex dev
```

### 4. View Dashboard

**Local:**

- Open: http://127.0.0.1:3210
- You should see your deployed functions

**Cloud:**

- Run `cortex convex dashboard` to open in browser
- View your data and functions online

---

## Troubleshooting

### "cortex: command not found"

**Cause:** CLI not installed globally

**Fix:**

```bash
npm install -g @cortexmemory/cli
```

### "cortex init" fails

**Check:**

- Node.js version >= 18
- Internet connection (to download packages)
- npm permissions

**Fix:**

```bash
# Update npm
npm install -g npm@latest

# Clear cache
npm cache clean --force

# Reinstall CLI
npm install -g @cortexmemory/cli
```

### "Cannot find module @cortexmemory/sdk"

**Cause:** Dependencies not installed

**Fix:**

```bash
cd your-project
npm install
```

### "Convex functions not found"

**Cause:** Backend not deployed or Convex not running

**Fix:**

```bash
# Start services with CLI
cortex start

# Or manually for cloud mode
npx convex deploy
```

### "WebSocket closed with code 1006"

**Cause:** Convex server not running

**Fix:**

```bash
# Start Convex via CLI
cortex start

# Or check status
cortex status
```

### Port Conflicts

**Cause:** Another Convex instance running on same port

**Fix:**

```bash
# Use interactive mode to kill conflicting processes
cortex dev
# Press 'k' to open kill menu
```

---

## Next Steps

After installation:

1. **[Five-Minute Quickstart](./03-five-minute-quickstart.md)** - Build your first memory-enabled agent
2. **[Core Concepts](./04-core-concepts.md)** - Understand how Cortex works
3. **[Configuration](./05-configuration.md)** - Configure for your needs

---

## Upgrading

To upgrade to a new version:

```bash
# Update CLI globally
npm install -g @cortexmemory/cli@latest

# Update SDK and Convex in your project (via CLI)
cortex convex update

# Or manually:
npm install @cortexmemory/sdk@latest
npm install convex@latest
npx convex deploy
```

Check GitHub releases for breaking changes.

---

**Questions?** Ask in [Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions).
