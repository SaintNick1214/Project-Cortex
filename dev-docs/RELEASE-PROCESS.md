# Release Process Guide

Complete guide for releasing Cortex SDK versions to npm and GitHub.

## 📦 Package Preparation Checklist

### 1. Update package.json

```json
{
  "name": "@cortexmemory/cortex-sdk",  // Scoped package
  "version": "0.1.0",                // Semantic versioning
  "description": "AI agent memory SDK built on Convex",
  "main": "./dist/index.js",         // CommonJS entry
  "module": "./dist/index.mjs",      // ESM entry
  "types": "./dist/index.d.ts",      // TypeScript definitions
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE.md"
  ],
  "keywords": [
    "ai",
    "agents",
    "memory",
    "convex",
    "sdk",
    "typescript"
  ],
  "author": "Saint Nick LLC",
  "license": "Apache-2.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/SaintNick1214/Project-Cortex.git"
  },
  "bugs": {
    "url": "https://github.com/SaintNick1214/Project-Cortex/issues"
  },
  "homepage": "https://github.com/SaintNick1214/Project-Cortex#readme"
}
```

### 2. Create Build Scripts

```json
"scripts": {
  "build": "tsc && tsc -p tsconfig.esm.json",
  "prepublishOnly": "npm run test && npm run build",
  "prepack": "npm run build"
}
```

### 3. Create .npmignore

Files to exclude from npm package:
```
# Source files (dist/ has compiled versions)
src/
tests/
convex-dev/
dev-docs/

# Development files
.env*
*.test.ts
*.debug.ts
jest.config.mjs
tsconfig*.json
convex.json

# CI/CD
.github/

# Documentation (user-facing goes to npm)
Internal Docs/

# Build artifacts
coverage/
node_modules/

# IDE
.vscode/
.idea/
```

---

## 🏗️ Build Setup

### 1. Create tsconfig.build.json

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "module": "CommonJS",
    "target": "ES2020"
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts", "tests", "node_modules"]
}
```

### 2. Create tsconfig.esm.json

```json
{
  "extends": "./tsconfig.build.json",
  "compilerOptions": {
    "module": "ES2020",
    "outDir": "./dist",
    "outExtension": {
      ".js": ".mjs"
    }
  }
}
```

---

## 📝 Pre-Release Checklist

### Code Quality
- [ ] All tests passing (`npm test`)
- [ ] No linter errors (`npm run lint`)
- [ ] Coverage > 80% (`npm run test:coverage`)
- [ ] TypeScript compiles (`tsc --noEmit`)

### Documentation
- [ ] README.md updated with current version
- [ ] CHANGELOG.md updated with new features
- [ ] API documentation complete
- [ ] Examples work

### Package Files
- [ ] package.json version bumped
- [ ] LICENSE.md present
- [ ] .npmignore configured
- [ ] Build scripts tested

### Testing
- [ ] Automated tests pass
- [ ] Interactive tests validated
- [ ] Build output tested (`npm pack` and test the .tgz)

---

## 🚀 Release Process

### Step 1: Prepare the Release

```powershell
# 1. Ensure you're on main branch
git checkout main
git pull origin main

# 2. Ensure everything is committed
git status  # Should be clean

# 3. Run full test suite
npm test
npm run test:coverage

# 4. Update version in package.json
# Edit package.json: "version": "0.1.0"

# 5. Update CHANGELOG.md
# Add release notes for v0.1.0

# 6. Commit version bump
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.1.0"
```

### Step 2: Build the Package

```powershell
# Build for distribution
npm run build

# Verify build output
ls dist/

# Test the built package locally
npm pack
# Creates: cortexmemory-cortex-sdk-0.1.0.tgz

# Test installation in another directory
cd ../test-install
npm install ../cortex-sdk/cortexmemory-cortex-sdk-0.1.0.tgz
# Test that it works
```

### Step 3: Create Git Tag

```powershell
# Create annotated tag
git tag -a v0.1.0 -m "Release v0.1.0 - Conversations API (Layer 1a)"

# Push commits and tags
git push origin main
git push origin v0.1.0
```

### Step 4: Create GitHub Release

**Option A: GitHub CLI (Recommended)**

```powershell
# Install GitHub CLI if needed
# winget install GitHub.cli

# Login
gh auth login

# Create release
gh release create v0.1.0 \
  --title "v0.1.0 - Conversations API" \
  --notes "## What's New

- ✅ Complete Conversations API (Layer 1a)
- ✅ 9 operations: create, get, addMessage, list, count, delete, getHistory, search, export
- ✅ 45 comprehensive tests (100% passing)
- ✅ TypeScript SDK with full type safety
- ✅ Interactive test runner for debugging

## Features

### Core Operations
- Create user-agent and agent-agent conversations
- Add messages (append-only, immutable)
- Retrieve conversations with filters
- Count conversations

### New Features (v0.1.0)
- 📜 Paginated message history (getHistory)
- 🔍 Full-text conversation search
- 💾 JSON/CSV export for GDPR compliance

## Installation

\`\`\`bash
npm install @cortexmemory/cortex-sdk
\`\`\`

## Quick Start

\`\`\`typescript
import { Cortex } from '@cortexmemory/cortex-sdk';

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
});

const conversation = await cortex.conversations.create({
  type: 'user-agent',
  participants: {
    userId: 'user-123',
    agentId: 'agent-456',
  },
});
\`\`\`

See [Documentation](https://saintnick1214.github.io/Project-Cortex/) for complete API reference."
```

**Option B: GitHub Web UI**

1. Go to: `https://github.com/SaintNick1214/Project-Cortex/releases/new`
2. Tag: `v0.1.0`
3. Title: `v0.1.0 - Conversations API`
4. Description: (same as above)
5. Check "Set as the latest release"
6. Click "Publish release"

### Step 5: Publish to npm

```powershell
# 1. Login to npm (first time only)
npm login
# Enter username, password, email, OTP

# 2. Verify you're logged in
npm whoami

# 3. Test publish (dry run)
npm publish --dry-run

# 4. Publish to npm
npm publish --access public
# For scoped packages (@cortexmemory/cortex-sdk)

# 5. Verify publication
npm view @cortexmemory/cortex-sdk

# 6. Test installation
npm install @cortexmemory/cortex-sdk
```

---

## 📋 Version Naming Strategy

### Semantic Versioning (semver)

```
MAJOR.MINOR.PATCH

0.1.0 - Initial release (Layer 1a)
0.2.0 - Add Layer 1b (Immutable Store)
0.3.0 - Add Layer 1c (Mutable Store)
0.4.0 - Add Layer 2 (Vector Memory)
0.5.0 - Add Layer 3 (Memory API)
0.6.0 - Add Coordination APIs
1.0.0 - Production release (all features stable)
```

### Version Milestones

| Version | Features | Status |
|---------|----------|--------|
| **v0.1.0** | Layer 1a (Conversations) | 🎯 Next |
| v0.2.0 | Layer 1b (Immutable Store) | ⏳ |
| v0.3.0 | Layer 1c (Mutable Store) | ⏳ |
| v0.4.0 | Layer 2 (Vector Memory) | ⏳ |
| v0.5.0 | Layer 3 (Memory API) | ⏳ |
| v0.6.0 | Coordination APIs | ⏳ |
| v1.0.0 | Production Release | ⏳ |

---

## 🏷️ Release Tags

### Tag Naming Convention

```bash
v0.1.0          # Release version
v0.1.0-beta.1   # Beta release
v0.1.0-alpha.1  # Alpha release
v0.1.0-rc.1     # Release candidate
```

### Current Release Plan

```bash
# v0.1.0 - Initial public release
git tag -a v0.1.0 -m "Release v0.1.0 - Conversations API (Layer 1a)

Features:
- Complete Conversations API with 9 operations
- 45 comprehensive tests (100% passing)
- TypeScript SDK with full type safety
- Interactive test runner
- GDPR-compliant export and deletion

Breaking Changes: None (initial release)
Migration Guide: N/A (initial release)
"
```

---

## 📦 npm Package Setup

### Package Scope

**Recommended**: Use scoped package `@cortexmemory/cortex-sdk`

**Benefits**:
- Namespace protection (no one else can use @saintnick/*)
- Professional appearance
- Can have public and private packages under same scope
- Free for public packages

**Alternative**: Unscoped `cortex-sdk` (if available)

### Package Visibility

```bash
# Public (recommended for open source)
npm publish --access public

# Private (requires paid npm account)
npm publish --access restricted
```

### npm Scripts for Publishing

```json
{
  "scripts": {
    "prepublishOnly": "npm test && npm run build",
    "prepack": "npm run build",
    "postpublish": "git push && git push --tags"
  }
}
```

---

## 🔧 Build Configuration

### TypeScript Build Targets

**Dual Build** (CommonJS + ESM):

```json
// package.json
{
  "main": "./dist/index.js",      // CommonJS (require)
  "module": "./dist/index.mjs",   // ESM (import)
  "types": "./dist/index.d.ts",   // TypeScript
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

**Why dual build?**
- Some users still use CommonJS (require)
- Modern tools prefer ESM (import)
- Supporting both maximizes compatibility

### Build Script

```bash
# Build CommonJS
tsc -p tsconfig.build.json

# Build ESM
tsc -p tsconfig.esm.json

# Or use a build tool
npm install --save-dev tsup

# Then: npx tsup src/index.ts --format cjs,esm --dts
```

---

## 📄 Required Files for Publishing

### 1. package.json (Updated)
- ✅ Correct version
- ✅ Proper entry points
- ✅ Keywords for discoverability
- ✅ Repository links

### 2. README.md
- ✅ Installation instructions
- ✅ Quick start example
- ✅ API overview
- ✅ Links to documentation

### 3. LICENSE.md
- ✅ Apache License 2.0

### 4. CHANGELOG.md
```markdown
# Changelog

## [0.1.0] - 2025-10-26

### Added
- Complete Conversations API (Layer 1a)
- 9 operations: create, get, addMessage, list, count, delete, getHistory, search, export
- TypeScript SDK with full type safety
- 45 comprehensive tests
- Interactive test runner

### Features
- User-agent and agent-agent conversation types
- Append-only immutable message history
- Paginated message retrieval
- Full-text search across conversations
- JSON/CSV export for GDPR compliance
```

### 5. .npmignore
- ✅ Exclude source files (ship only dist/)
- ✅ Exclude tests
- ✅ Exclude dev docs

---

## 🌐 GitHub Release Process

### Manual Steps

1. **Create Tag Locally**
   ```bash
   git tag -a v0.1.0 -m "Release v0.1.0"
   git push origin v0.1.0
   ```

2. **Go to GitHub**
   - Navigate to: `https://github.com/YOUR_USERNAME/cortex-sdk/releases/new`
   - Choose tag: `v0.1.0`
   - Release title: `v0.1.0 - Conversations API`
   - Description: (see template below)
   - Attach files (optional): Built .tgz file
   - Publish release

### Automated (GitHub Actions)

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      
      - run: npm ci
      - run: npm test
      - run: npm run build
      
      - name: Publish to npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      
      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          draft: false
          prerelease: false
```

---

## 📝 Release Notes Template

```markdown
# v0.1.0 - Conversations API

## 🎉 Initial Release

Cortex SDK v0.1.0 includes the complete **Conversations API** (Layer 1a) - ACID-compliant conversation storage for AI agents.

## ✨ Features

### Conversation Management
- ✅ Create user-agent and agent-agent conversations
- ✅ Append messages (immutable, ordered)
- ✅ Retrieve conversations by ID
- ✅ Filter and list conversations
- ✅ Count conversations with filters
- ✅ Delete conversations (GDPR compliant)

### New in v0.1.0
- 📜 **Paginated message history** - Retrieve messages in chunks
- 🔍 **Full-text search** - Find conversations by keywords
- 💾 **JSON/CSV export** - GDPR data portability

## 📦 Installation

\`\`\`bash
npm install @cortexmemory/cortex-sdk
\`\`\`

## 🚀 Quick Start

\`\`\`typescript
import { Cortex } from '@cortexmemory/cortex-sdk';

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL,
});

// Create conversation
const conv = await cortex.conversations.create({
  type: 'user-agent',
  participants: {
    userId: 'user-123',
    agentId: 'agent-456',
  },
});

// Add message
await cortex.conversations.addMessage({
  conversationId: conv.conversationId,
  message: {
    role: 'user',
    content: 'Hello, agent!',
  },
});

// Search conversations
const results = await cortex.conversations.search({
  query: 'password',
  filters: { userId: 'user-123' },
});

// Export for GDPR
const exported = await cortex.conversations.export({
  filters: { userId: 'user-123' },
  format: 'json',
});
\`\`\`

## 📚 Documentation

- [Complete API Reference](https://saintnick1214.github.io/Project-Cortex/)
- [Getting Started Guide](./Documentation/01-getting-started/)
- [Architecture Overview](./Documentation/04-architecture/)

## 🧪 Testing

- **45 comprehensive E2E tests** (100% passing)
- **Interactive test runner** for debugging
- **Storage validation** in every test
- **ACID properties** validated

## 📊 Stats

- Operations: 9
- Tests: 45
- Test Coverage: ~95%
- Documentation Pages: 8

## 🎯 Coming Next

- v0.2.0: Layer 1b (Immutable Store)
- v0.3.0: Layer 1c (Mutable Store)
- v0.4.0: Layer 2 (Vector Memory)
- v0.5.0: Layer 3 (Memory Convenience API)

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md)

## 📄 License

Apache-2.0 - See [LICENSE.md](./LICENSE.md)
```

---

## 🔐 npm Authentication

### First Time Setup

```powershell
# 1. Create npm account
# Visit: https://www.npmjs.com/signup

# 2. Login via CLI
npm login

# 3. Verify
npm whoami

# 4. (Optional) Enable 2FA
# Visit: https://www.npmjs.com/settings/YOUR_USERNAME/tfa
```

### Publishing Authentication

```powershell
# Ensure you're logged in
npm whoami

# Publish (will prompt for OTP if 2FA enabled)
npm publish --access public

# If using automation, create token
# Visit: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
# Create "Automation" token
# Store as: NPM_TOKEN in GitHub secrets
```

---

## 🧪 Testing the Package Before Publishing

### Local Testing

```powershell
# 1. Build the package
npm run build

# 2. Pack it (creates .tgz)
npm pack

# 3. Install in test project
mkdir ../test-cortex-install
cd ../test-cortex-install
npm init -y
npm install ../Project\ Cortex/cortexmemory-cortex-sdk-0.1.0.tgz

# 4. Test importing
# Create test.js:
# import { Cortex } from '@cortexmemory/cortex-sdk';
# console.log('Import works!', Cortex);

node test.js
```

### Using npm link (Alternative)

```powershell
# In SDK directory
npm link

# In test project
npm link @cortexmemory/cortex-sdk

# Now you can import and test
```

---

## 📢 Post-Release Checklist

### Immediate
- [ ] Verify package appears on npm
- [ ] Test installation from npm
- [ ] Verify GitHub release is visible
- [ ] Check documentation links work

### Communication
- [ ] Tweet/announce on social media
- [ ] Post in relevant communities
- [ ] Update project website
- [ ] Notify early users

### Follow-up
- [ ] Monitor for issues
- [ ] Respond to questions
- [ ] Plan next version
- [ ] Update roadmap

---

## 🔄 Future Release Process

### For v0.2.0 and beyond

```bash
# 1. Develop features on feature branch
git checkout -b feature/layer-1b-immutable-store

# 2. Implement, test, document
# ... development ...

# 3. Merge to main
git checkout main
git merge feature/layer-1b-immutable-store

# 4. Update version
# Edit package.json: "version": "0.2.0"

# 5. Update CHANGELOG
# Add v0.2.0 section

# 6. Commit
git add .
git commit -m "chore: bump version to 0.2.0"

# 7. Tag
git tag -a v0.2.0 -m "Release v0.2.0 - Immutable Store"

# 8. Push
git push origin main
git push origin v0.2.0

# 9. Publish to npm
npm publish

# 10. Create GitHub release
gh release create v0.2.0 --title "v0.2.0 - Immutable Store" --notes "..."
```

---

## 🎯 Release Automation

### Recommended Tools

**Semantic Release** (Automated versioning):
```bash
npm install --save-dev semantic-release

# Automatically:
# - Bumps version based on commits
# - Generates CHANGELOG
# - Creates GitHub release
# - Publishes to npm
```

**Release-It** (Interactive release tool):
```bash
npm install --save-dev release-it

# Interactive prompts for version bump, changelog, publish
npx release-it
```

---

## 🔍 Package Verification

### After Publishing

```bash
# View on npm
npm view @cortexmemory/cortex-sdk

# Check versions
npm view @cortexmemory/cortex-sdk versions

# See latest
npm view @cortexmemory/cortex-sdk version

# View full metadata
npm view @cortexmemory/cortex-sdk --json
```

### Test Installation

```bash
# In new directory
npm install @cortexmemory/cortex-sdk

# Verify files
ls node_modules/@cortexmemory/cortex-sdk/

# Test import
node -e "import('@cortexmemory/cortex-sdk').then(m => console.log(m))"
```

---

## ⚠️ Common Issues

### Issue: "Package name already taken"

**Solution**: Use scoped package `@cortexmemory/cortex-sdk`

### Issue: "No permission to publish"

**Solution**: 
```bash
npm login
npm publish --access public
```

### Issue: "prepublishOnly failed"

**Solution**: Ensure tests pass locally first
```bash
npm test
npm run build
```

### Issue: "Files not included in package"

**Solution**: Check `package.json` `files` field and `.npmignore`

---

## 📊 Package Stats

### What Gets Published

```
@cortexmemory/cortex-sdk/
├── dist/                    # Compiled code
│   ├── index.js            # CommonJS
│   ├── index.mjs           # ESM
│   ├── index.d.ts          # TypeScript types
│   └── conversations/      # Sub-modules
├── README.md               # Installation guide
└── LICENSE.md              # License

Size: ~100KB (before compression)
```

### What Gets Excluded

- `src/` - Source TypeScript (dist/ has compiled version)
- `tests/` - Test files
- `convex-dev/` - Development database
- `dev-docs/` - Developer documentation
- `node_modules/` - Dependencies

---

## 🎓 Learning Resources

### npm Publishing
- [npm Docs: Publishing Packages](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Creating and Publishing Scoped Packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages)

### GitHub Releases
- [GitHub Docs: Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [GitHub CLI: Release Commands](https://cli.github.com/manual/gh_release)

### Semantic Versioning
- [Semver.org](https://semver.org/)
- [npm Docs: Semantic Versioning](https://docs.npmjs.com/about-semantic-versioning)

---

## ✅ Ready to Release v0.1.0!

Follow these steps in order:

1. ✅ Run tests (`npm test`)
2. ✅ Update package.json version to `0.1.0`
3. ✅ Update CHANGELOG.md
4. ✅ Create build configuration
5. ✅ Test build (`npm run build`)
6. ✅ Test package (`npm pack`)
7. ✅ Commit and tag
8. ✅ Push to GitHub
9. ✅ Create GitHub release
10. ✅ Publish to npm

**Let's do this!** 🚀

