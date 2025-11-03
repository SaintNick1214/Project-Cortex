# Changelog - create-cortex-memories

All notable changes to the create-cortex-memories wizard will be documented in this file.

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

