# Changelog - create-cortex-memories

All notable changes to the create-cortex-memories wizard will be documented in this file.

## [0.2.0] - 2025-11-24

### Added

**Smart Version Detection:**

- CLI now automatically fetches the latest SDK version from npm registry
- Dynamically detects and installs the correct Convex version required by the SDK
- Template always uses `"latest"` for SDK to ensure newest features
- Convex version is automatically synced with SDK's peerDependencies
- No more manual version maintenance or version drift issues

**User Experience:**

- New spinner showing SDK version and Convex version being used
- Clear messaging when Convex version is injected from SDK metadata
- Graceful fallback to safe defaults if npm registry is unavailable

### Changed

**Template:**

- Updated SDK to use `"latest"` instead of pinned version
- Convex version is now dynamically determined at scaffolding time
- Ensures perfect compatibility between SDK and Convex versions

## [0.1.6] - 2025-11-22

### Changed

**Dependencies:**

- Updated `@types/node` from `^24.10.0` to `^24.10.1`

**CI/CD:**

- Package now integrated with centralized GitHub Actions workflows
- Automated publishing to npm on version changes

## [0.1.5] - 2025-11-02

### Fixed

**Critical - ROOT CAUSE:**

- **FIXED:** Filter function was checking absolute path (includes 'node_modules'), excluding ALL files!
- Now uses `path.relative()` to check only the relative path within template
- This was preventing any template files from being copied
- **CHANGED:** `overwrite: true` to avoid silent failures

**Debugging:**

- Verbose logging showing every file and filter decision
- Shows template item count before copy
- Better error messages with exact paths
- Verification that key files were copied

## [0.1.4] - 2025-11-02

### Fixed

**Critical:**

- **FIXED:** Template files not copied when adding to existing directory with partial files
- Now checks if package.json exists and copies template if missing
- Prevents "SDK not found" error when directory has leftover config files from failed runs

**Debugging:**

- Added logging to show template path resolution
- Added verification that key files were actually copied
- Better error messages showing exact paths
- SDK installation verification with helpful warnings

## [0.1.3] - 2025-11-02

### Fixed

**Debugging:**

- Added debug logging to verify SDK installation
- Better error message showing exact path checked
- Helps diagnose npm install issues

## [0.1.2] - 2025-11-02

### Fixed

**Critical:**

- **FIXED:** Binary not executable after npm install (added chmod +x to build step)
- This was preventing `npm create cortex-memories` from working after v0.1.1 publish

## [0.1.1] - 2025-11-02

### Fixed

**Template Improvements:**

- Fixed `memory.importance` access (was incorrectly `memory.metadata.importance`)
- Fixed `conversations.get()` signature (removed extra parameter)
- Added type annotations to fix implicit `any` warnings
- Added comment explaining template TypeScript errors are expected

**Docker Compose:**

- Removed obsolete `version: '3.8'` field (Docker Compose v2 compatibility)
- Improved error detection and messages
- Added pre-check for Docker daemon running
- Better handling of container name conflicts

**Development Experience:**

- Auto-start graph database when running `npm run dev`
- Auto-stop graph database on Ctrl+C
- Fixed exit code 254 issue (SIGINT double-execution)
- Clear status messages for Docker availability
- Graceful handling when containers already running

**Code Quality:**

- Added ESLint configuration
- Added lint script with prepublish check
- Added smoke tests to prepublish
- Fixed unused variable warnings
- 0 lint errors

### Added

- VSCode settings for template folder
- Better error messages for all Docker failure scenarios
- Comprehensive logging for debugging

## [0.1.0] - 2025-11-02

### Added

**Initial Release:**

- Interactive CLI wizard for Cortex project setup
- Three Convex setup modes (local/new cloud/existing)
- Optional graph database integration (Neo4j/Memgraph)
- Docker detection with platform-specific instructions
- Automatic dependency installation
- Backend function deployment
- Environment configuration
- Project templates with working examples
- Beautiful CLI with colors and spinners
- Comprehensive error handling

**Features:**

- `npm create cortex-memories` - Zero-config project creation
- Auto-detects configuration options
- Platform-aware (macOS/Windows/Linux)
- Fully automated setup using `CONVEX_AGENT_MODE=anonymous`
- 8 TypeScript modules
- Complete project scaffolding
- Smoke test suite

**Documentation:**

- README with usage examples
- TESTING guide with manual test scenarios
- Inline code documentation
