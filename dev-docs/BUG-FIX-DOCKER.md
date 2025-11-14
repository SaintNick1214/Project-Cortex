# Bug Fixes: ES Module Compatibility & Docker Detection

## Issues Found and Fixed

**Total Issues Fixed:** 8 (7 critical bugs + 1 security warning)

### Issue #1: File Creation Before Directory Exists

**Error:**

```
✖ Failed to create Docker Compose configuration
❌ Error: ENOENT: no such file or directory, open '...test-project/docker-compose.graph.yml'
```

**Root Cause:**
The wizard was calling `setupGraphDatabase(projectPath)` before creating the project directory. The execution order was:

1. Get project info → path determined
2. Get installation type
3. Get Convex setup
4. **Get graph setup** → 🚫 Tried to write docker-compose.yml here!
5. Show confirmation
6. **Execute setup** → Project directory created here ✅

**Fix:**
Split the graph setup into two phases:

- `getGraphConfig()` - Only prompts user, gets configuration (no file writes)
- `setupGraphFiles()` - Creates files after project directory exists

New execution order:

1. Get project info
2. Get installation type
3. Get Convex setup
4. **Get graph config** → Just prompts, no file writes
5. Show confirmation
6. **Execute setup:**
   - Create project directory ✅
   - Install dependencies
   - Deploy backend
   - **Setup graph files** → Files created here ✅

### Issue #2: No Docker Detection

**Problem:**
Wizard offered "Local (Docker Compose)" option even when Docker wasn't installed, leading to confusing errors later.

**Fix:**
Added comprehensive Docker detection:

```typescript
async function checkDockerInstalled(): Promise<boolean> {
  try {
    const result = await execCommand("docker", ["--version"], {});
    return result.code === 0;
  } catch {
    return false;
  }
}
```

**Features Added:**

1. **Pre-check:** Detects Docker before showing deployment options
2. **Disabled option:** If no Docker, "Local" option is disabled in menu
3. **Warning message:** Clear warning if Docker not detected
4. **Installation instructions:** Platform-specific instructions (macOS/Windows/Linux)

### Issue #3: ES Module \_\_dirname Not Defined

**Error:**

```
ReferenceError: __dirname is not defined
    at copyTemplate (file:///.../file-operations.js:75:36)
```

**Root Cause:**
The package uses ES modules (`"type": "module"` in package.json), but the code was using `__dirname` which is only available in CommonJS. In ES modules, `__dirname` is not a global variable.

**Fix:**
Added ES module equivalents at the top of `file-operations.ts`:

```typescript
import { fileURLToPath } from "url";
import { dirname } from "path";

// ES module equivalents of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

This is a standard pattern for ES modules that need directory information.

### Issue #4: ES Module require Not Defined

**Error:**

```
ReferenceError: require is not defined
```

**Root Cause:**
Two places in `utils.ts` used CommonJS `require`:

1. Line 95: `const fs = require('fs')` - Loading fs module
2. Line 105: `require.resolve('@cortexmemory/sdk/package.json')` - Resolving package path

**Fix:**

1. Import `readdirSync` directly instead of using require:

```typescript
import { existsSync, readdirSync } from "fs";
```

2. Use `createRequire` for package resolution:

```typescript
import { createRequire } from "module";

// Create require function for ES modules
const require = createRequire(import.meta.url);
```

Now `require.resolve()` works in ES modules!

### Issue #5: SDK Package Not Found After Installation

**Error:**

```
Error: Could not locate @cortexmemory/sdk package. Please ensure it is installed.
    at deployCortexBackend (file://.../file-operations.js:19:15)
```

**Root Cause:**
The wizard installed the SDK in the new project's `node_modules`, but `getSDKPath()` was using `require.resolve()` which looked relative to the wizard's location, not the new project's location.

**Sequence:**

1. ✅ Create project directory
2. ✅ Install dependencies (SDK installed to `test-project/node_modules/@cortexmemory/sdk`)
3. ❌ Try to copy convex-dev → `getSDKPath()` looks in wrong location

**Fix:**
Updated `getSDKPath()` to accept a `projectPath` parameter:

```typescript
export function getSDKPath(projectPath?: string): string | null {
  try {
    // If projectPath provided, look in that project's node_modules
    if (projectPath) {
      const sdkPath = path.join(
        projectPath,
        "node_modules",
        "@cortexmemory",
        "sdk",
      );
      if (existsSync(sdkPath)) {
        return sdkPath;
      }
    }

    // Fallback: use require.resolve from current location
    const sdkPackageJson = require.resolve("@cortexmemory/sdk/package.json");
    return path.dirname(sdkPackageJson);
  } catch {
    return null;
  }
}
```

Updated caller in `deployCortexBackend()`:

```typescript
const sdkPath = getSDKPath(projectPath); // Pass project path!
```

Now it looks in the correct location!

### Issue #6: Local Convex Deployment Requires Login (RESOLVED)

**Initial Error:**

```
✖ Cannot prompt for input in non-interactive terminals.
   (Welcome to Convex! Would you like to login to your account?)
✖ Deployment failed
❌ Error: Failed to deploy Cortex backend
```

**Initial Approach (WRONG):**
Skipped deployment for local mode, required users to manually run `npx convex dev --local`.

**Better Fix (CORRECT - using Convex docs):**
After consulting Convex documentation, discovered the proper way to deploy locally without login:

```bash
CONVEX_AGENT_MODE=anonymous npx convex dev --local --once --until-success
```

Key components:

- `CONVEX_AGENT_MODE=anonymous` - **CRITICAL!** Enables non-interactive mode
- `--local` - Uses local deployment (no cloud, no login required)
- `--once` - Runs deployment once without watching (non-interactive)
- `--until-success` - Retries until successful

**Implementation:**
Updated `deployConvexBackend()` to accept `isLocal` parameter and set agent mode:

```typescript
export async function deployConvexBackend(
  projectPath: string,
  config: ConvexConfig,
  isLocal: boolean = false,
): Promise<void> {
  const args = ["dev", "--once", "--until-success"];
  if (isLocal) {
    args.push("--local"); // Add --local flag for local mode!
  }

  // Set environment - CRITICAL: CONVEX_AGENT_MODE for non-interactive
  const env = {
    ...process.env,
    CONVEX_URL: config.convexUrl,
    ...(config.deployKey && { CONVEX_DEPLOY_KEY: config.deployKey }),
    ...(isLocal && { CONVEX_AGENT_MODE: "anonymous" }), // ← THE KEY!
  };

  // Deploy
  await execCommand(convexCommand, args, { cwd: projectPath, env });
}
```

**Result:**

- **Local mode:** Fully automated deployment with `--local` flag ✅
- **Cloud modes:** Standard deployment (requires login if not already) ✅
- **Principle preserved:** Setup is 100% automated for local mode!

Updated success message:

```
🚀 Next steps:

  cd my-project
  npm start  # Run your AI agent

  💡 Your local Convex is deployed and ready to use!
     To view the dashboard: http://127.0.0.1:3210
```

### Issue #7: Security Warning - Shell Option with Args

**Warning:**

```
(node:71289) [DEP0190] DeprecationWarning: Passing args to a child process
with shell option true can lead to security vulnerabilities, as the arguments
are not escaped, only concatenated.
```

**Root Cause:**
All `spawn()` calls in `utils.ts` were using `shell: true`, which Node.js flags as a security risk when combined with argument arrays. The shell concatenates arguments without escaping, potentially allowing command injection.

**Fix:**
Removed `shell: true` from all spawn calls:

```typescript
// BEFORE (insecure):
spawn(command, args, { shell: true, ...options });

// AFTER (secure):
spawn(command, args, { ...options });
```

**Changed functions:**

1. `commandExists()` - Removed shell, added platform-specific command (which/where)
2. `execCommand()` - Removed shell option
3. `execCommandLive()` - Removed shell option

**Why this is better:**

- ✅ More secure (no command injection risk)
- ✅ Faster (no shell overhead)
- ✅ More reliable (no shell parsing issues)
- ✅ Cross-platform compatible (spawn handles it)
- ✅ No deprecation warnings

### Issue #8: No User Guidance for Docker

**Problem:**
If user didn't have Docker, they got an error with no guidance on how to fix it.

**Fix:**
Added platform-specific installation instructions:

**macOS:**

```
⚠️  Docker Desktop is not installed

To use local graph database, please install Docker Desktop:

macOS:
  1. Download Docker Desktop: https://www.docker.com/products/docker-desktop
  2. Install and start Docker Desktop
  3. Run the wizard again

Or choose "Cloud/Existing instance" to use a remote graph database.
```

**Windows:**

```
Windows:
  1. Download Docker Desktop: https://www.docker.com/products/docker-desktop
  2. Install and start Docker Desktop
  3. Run the wizard again
```

**Linux:**

```
Linux:
  1. Install Docker Engine: https://docs.docker.com/engine/install/
  2. Install Docker Compose: https://docs.docker.com/compose/install/
  3. Run the wizard again
```

## Changes Made

### Modified Files

**1. `src/utils.ts`**

- Added `createRequire` from 'module' for ES module compatibility
- Changed direct require imports to proper ES imports
- Fixed `require.resolve()` usage for package path resolution
- Fixed `readdirSync` to use direct import instead of require
- **Updated `getSDKPath()` to accept `projectPath` parameter and look in correct node_modules**
- **Removed `shell: true` from all spawn calls** (security fix)
- **Added platform-specific command detection** (which/where)

**2. `src/file-operations.ts`**

- Added ES module `__dirname` equivalent using `fileURLToPath` and `dirname`
- Fixed template path resolution
- **Updated `deployCortexBackend()` to pass projectPath to `getSDKPath()`**

**3. `src/wizard.ts`**

- Changed `setupGraphDatabase()` call to `getGraphConfig()` (line 35)
- Added `setupGraphFiles()` call in `executeSetup()` after directory creation
- **Skip Convex CLI deployment for local mode** - Added conditional check
- **Updated success message** - Better instructions for local mode users
- Updated imports

**4. `src/graph-setup.ts`**

- Added `checkDockerInstalled()` function
- Added `showDockerInstructions()` function
- Renamed `setupGraphDatabase()` → `getGraphConfig()` (prompts only)
- Added new `setupGraphFiles()` function (file creation only)
- Renamed `setupLocalGraphDB()` → `getLocalGraphConfig()` (no file writes)
- Renamed `setupCloudGraphDB()` → `getCloudGraphConfig()` (no file writes)
- Updated deployment type choices to disable local option if no Docker
- Added Docker detection warning message

## Testing

### Smoke Tests: ✅ All Passing

```bash
cd packages/create-cortex-memories
npm run build
./test-smoke.sh
```

All tests pass with 0 errors.

### Manual Testing Scenarios

**Scenario 1: With Docker Installed**

```bash
node dist/index.js test-with-docker
# Select: Local development → Enable graph → Neo4j → Local (Docker Compose)
# Expected: ✅ Success, docker-compose.yml created
```

**Scenario 2: Without Docker Installed**

```bash
# Stop Docker Desktop first
node dist/index.js test-no-docker
# Select: Local development → Enable graph → Neo4j
# Expected: ⚠️  Warning, local option disabled, instructions shown
```

**Scenario 3: Cloud Graph Database**

```bash
node dist/index.js test-cloud-graph
# Select: Local development → Enable graph → Neo4j → Cloud/Existing
# Expected: ✅ Success, prompts for URI/credentials, no docker-compose
```

## Impact

### User Experience

**Before:**

- ❌ Confusing error if Docker not installed
- ❌ Files created before directory exists
- ❌ ES module `__dirname` not defined error
- ❌ ES module `require` not defined error
- ❌ SDK package not found after installation
- ❌ Local Convex deployment requires login (violated automation)
- ❌ Security warning: `shell: true` with args array
- ❌ No guidance on how to fix issues

**After:**

- ✅ Clear detection of Docker availability
- ✅ Files created in correct order
- ✅ ES modules fully compatible (`__dirname` and `require` fixed)
- ✅ SDK correctly located in project's node_modules
- ✅ Fully automated local deployment with `CONVEX_AGENT_MODE`
- ✅ Secure spawn calls (no shell injection risk)
- ✅ Platform-specific installation instructions
- ✅ Disabled options with clear explanations
- ✅ Graceful fallback to cloud option

### Code Quality

- ✅ Better separation of concerns (config vs. file creation)
- ✅ More robust error handling
- ✅ Clearer function names
- ✅ Better user feedback

## Backwards Compatibility

✅ **Fully compatible** - No breaking changes to API or configuration

## Version

These fixes will be included in:

- **create-cortex-memories@0.1.1** (or @0.1.0 if not yet published)

## Recommendation

Test the wizard thoroughly before publishing:

```bash
# Test without Docker (stop Docker Desktop)
node dist/index.js test-no-docker

# Test with Docker (start Docker Desktop)
node dist/index.js test-with-docker

# Test cloud option
node dist/index.js test-cloud
```

All scenarios should now work smoothly with clear messaging!
