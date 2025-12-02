# Installation

> **Last Updated**: 2025-11-02

## Quick Start

The fastest way to get started with Cortex:

```bash
npm create cortex-memories
```

This interactive wizard will:

- Set up a complete Cortex project
- Configure Convex (local or cloud)
- Install all dependencies
- Deploy backend functions
- Create working example code

**Time to working agent:** < 5 minutes

---

## Installation Methods

### Method 1: Interactive Wizard (Recommended)

Best for: New projects, first-time users, workshops

```bash
# Create new project
npm create cortex-memories@latest my-ai-agent
cd my-ai-agent
npm run dev  # Start Convex
npm start    # Run your agent
```

**What you get:**

- ✅ Cortex SDK installed
- ✅ Convex backend deployed
- ✅ Environment configured
- ✅ Working example code
- ✅ Optional graph database setup

### Method 2: Add to Existing Project

Best for: Integrating Cortex into existing applications

```bash
cd your-existing-project
npm create cortex-memories@latest .
```

The wizard will add Cortex to your project without disrupting existing code.

### Method 3: Manual Installation

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
npm create cortex-memories@latest my-agent
# Select: "Local development"
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
npm create cortex-memories@latest my-agent
# Select: "Create new Convex database"
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
npm create cortex-memories@latest my-agent
# Select: "Use existing Convex database"
# Enter your CONVEX_URL
```

---

## Verification

After installation, verify everything works:

### 1. Check Installation

```bash
# Verify SDK is installed
npm list @cortexmemory/sdk
# Should show: @cortexmemory/sdk@0.8.1

# Verify Convex is installed
npm list convex
# Should show: convex@^1.28.0

# Check backend files exist
ls convex/
# Should list: schema.ts, conversations.ts, memories.ts, etc.
```

### 2. Test Connection

```bash
# Start Convex (local mode)
npm run dev
# Should show: "Convex functions ready!"

# In another terminal, run your agent
npm start
# Should connect and create a memory
```

### 3. View Dashboard

**Local:**

- Open: http://127.0.0.1:3210
- You should see your deployed functions

**Cloud:**

- Dashboard URL shown in wizard output
- View your data and functions online

---

## Troubleshooting

### "npm create cortex-memories" fails

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
# For local mode
npm run dev

# For cloud mode
npx convex deploy
```

### "WebSocket closed with code 1006"

**Cause:** Convex server not running

**Fix:**

```bash
# Make sure Convex is running in another terminal
npm run dev
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
# Update SDK
npm install @cortexmemory/sdk@latest

# Update Convex
npm install convex@latest

# Redeploy backend
npx convex deploy
```

Check GitHub releases for breaking changes.

---

**Questions?** Ask in [Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions).
