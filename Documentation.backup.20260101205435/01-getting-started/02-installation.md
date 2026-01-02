# Installation

> **Last Updated**: January 1, 2026

## Quick Start

The fastest way to get started with Cortex:

```bash
# Install the CLI globally
npm install -g @cortexmemory/cli

# Verify installation
cortex --version
# Should output: 0.27.4 or higher

# Create your first project
cortex init my-cortex-agent
```

The interactive wizard will guide you through setup in under 5 minutes.

---

## Prerequisites

Before installing Cortex, ensure you have:

### Required

- **Node.js >= 20** - Download from [nodejs.org](https://nodejs.org)
- **npm or pnpm** - Comes with Node.js

Check your versions:

```bash
node --version  # Should be v20.0.0 or higher
npm --version   # Should be 9.0.0 or higher
```

### Optional

- **Convex Account** - For cloud deployments (free tier available)
  - Sign up at [convex.dev](https://convex.dev)
  - Required for vector search features
  - Not needed for local development

- **Docker Desktop** - For graph database features (optional)
  - Download from [docker.com](https://www.docker.com/products/docker-desktop)
  - Only needed for advanced graph queries
  - Not required for basic Cortex usage

- **OpenAI API Key** - For embeddings (optional)
  - Get from [platform.openai.com](https://platform.openai.com)
  - Or use any other embedding provider
  - Cortex works without embeddings (keyword search)

---

## Installation Methods

### Method 1: Global Installation (Recommended)

Install the CLI globally to use it from anywhere:

```bash
npm install -g @cortexmemory/cli
```

**Verify installation:**

```bash
cortex --version
# Output: 0.27.4 or higher
```

**Now create projects anywhere:**

```bash
cortex init my-agent
cd my-agent
cortex start
```

### Method 2: Using npx (No Installation)

Use the CLI without installing it globally:

```bash
npx @cortexmemory/cli init my-agent
cd my-agent
npx @cortexmemory/cli start
```

**When to use:**

- One-time project creation
- Testing before global install
- CI/CD environments

**Trade-off:** Slightly slower (downloads each time)

### Method 3: Project-Specific Installation

Install as a dev dependency in your project:

```bash
cd my-existing-project
npm install --save-dev @cortexmemory/cli

# Use with npm scripts
npm pkg set scripts.cortex="cortex"
```

**Add to package.json:**

```json
{
  "scripts": {
    "cortex": "cortex",
    "dev": "cortex dev",
    "start": "cortex start",
    "stop": "cortex stop"
  }
}
```

**Then run:**

```bash
npm run cortex init
npm run dev
```

---

## Verification

After installation, verify everything works:

### 1. Check CLI Installation

```bash
# Verify CLI is installed
cortex --version
# Should show: 0.27.4 or higher

# Check CLI help
cortex --help
# Should display available commands
```

### 2. Test CLI Connection

```bash
# Initialize a test project
cortex init test-project
cd test-project

# Start services
cortex start

# Check status
cortex status
# Should show: Convex running, deployment info
```

### 3. Verify Convex Dashboard

**For local development:**

- Open: http://127.0.0.1:3210
- You should see deployed Cortex functions

**For cloud deployment:**

```bash
cortex convex dashboard
# Opens your deployment in browser
```

---

## Next Steps

After successful installation:

1. **[Five-Minute Quickstart](./03-five-minute-quickstart.md)** - Build your first agent
2. **[Core Concepts](./04-core-concepts.md)** - Understand how Cortex works
3. **[Configuration](./05-configuration.md)** - Multi-deployment setup
4. **[CLI Reference](../06-tools/01-cli-reference.md)** - All CLI commands

---

## Troubleshooting

### "cortex: command not found"

**Cause:** CLI not installed or not in PATH

**Fix:**

```bash
# Reinstall globally
npm install -g @cortexmemory/cli

# Or check npm global bin path
npm config get prefix
# Make sure this directory is in your PATH
```

### "cortex init" fails

**Possible causes:**

- Node.js version < 20
- No internet connection
- npm permissions

**Fix:**

```bash
# Update Node.js to v20+
# Then clear npm cache
npm cache clean --force

# Reinstall CLI
npm install -g @cortexmemory/cli
```

### "Cannot find module @cortexmemory/sdk"

**Cause:** Dependencies not installed in project

**Fix:**

```bash
cd your-project
npm install
```

### "Convex connection failed"

**Cause:** Convex server not running

**Fix:**

```bash
# Start Convex
cortex start

# Or check status
cortex status

# If issues persist, restart
cortex stop
cortex start
```

### Port Conflicts

**Cause:** Another Convex instance on same port

**Fix:**

```bash
# Use interactive dev mode
cortex dev
# Press 'k' to kill conflicting processes
```

### Getting More Help

```bash
# General help
cortex --help

# Command-specific help
cortex <command> --help

# Example
cortex init --help
cortex start --help
```

**Still stuck?**

- [GitHub Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions)
- [CLI Reference](../06-tools/01-cli-reference.md)
- [GitHub Issues](https://github.com/SaintNick1214/Project-Cortex/issues)

---

## Upgrading

To upgrade to the latest version:

```bash
# Update CLI globally
npm install -g @cortexmemory/cli@latest

# Verify new version
cortex --version

# Update SDK and Convex in your projects
cd your-project
cortex update
```

The `cortex update` command will:

- Check for newer versions of `@cortexmemory/sdk`
- Check for newer versions of `convex`
- Offer to update all projects
- Redeploy backend if needed

---

## Uninstalling

If you need to uninstall:

```bash
# Remove CLI globally
npm uninstall -g @cortexmemory/cli

# Remove from project
cd your-project
npm uninstall @cortexmemory/sdk convex

# Clean up configuration (optional)
rm ~/.cortexrc
```

---

**Ready to build?** Continue to [Five-Minute Quickstart](./03-five-minute-quickstart.md) →
