# Release Guide - Cortex SDK

**Version**: 0.4.0  
**Updated**: October 26, 2025

---

## 🚀 Two Ways to Release

Cortex SDK supports **2 release workflows**:

### 1. 🤖 **Automated** (GitHub Action) - Recommended for Production

**Best for**: Production releases (v0.4.0, v0.5.0, v1.0.0)

```bash
# Just bump version and push!
# 1. Edit package.json
"version": "0.4.0" → "0.5.0"

# 2. Update CHANGELOG.md
# Add v0.5.0 section

# 3. Commit and push
git add package.json CHANGELOG.md
git commit -m "chore: release v0.5.0"
git push origin main

# 4. GitHub Action automatically:
# ✅ Runs 201 tests
# ✅ Builds package
# ✅ Publishes to npm
# ✅ Creates git tag
# ✅ Creates GitHub release
# ✅ Verifies publish

# Done in ~4 minutes! 🎉
```

**Setup**: See [.github/SETUP-AUTOMATED-RELEASES.md](.github/SETUP-AUTOMATED-RELEASES.md)

### 2. 💻 **Manual** (Local Script) - Full Control

**Best for**: Beta releases, hotfixes, debugging

```bash
# Interactive release with manual confirmation
npm run release

# Prompts: "Ready to publish v0.4.0? (y/n)"
# You type: y

# Then runs all steps locally
```

---

## 📊 Comparison

| Feature | GitHub Action | Local Script |
|---------|---------------|--------------|
| **Trigger** | Automatic (version change) | Manual (`npm run release`) |
| **Environment** | GitHub Ubuntu (clean) | Your machine |
| **Confirmation** | None (auto-publish) | Manual (y/n prompt) |
| **Speed** | ~4 minutes | ~2 minutes |
| **Audit Trail** | GitHub Actions UI | Terminal only |
| **Secrets** | GitHub Secrets | Local credentials |
| **Consistency** | Always same | Depends on local env |
| **Debugging** | Harder (remote) | Easier (local) |
| **Team** | Anyone can trigger | Requires local setup |

---

## 🎯 Recommended Workflow

### Production Releases (v0.x.0, v1.x.0)

**Use GitHub Action** (automated):

```bash
# 1. Create release branch
git checkout -b release/v0.5.0

# 2. Update files
# - package.json: version → "0.5.0"
# - CHANGELOG.md: Add v0.5.0 section

# 3. Test locally
npm test

# 4. Commit
git add package.json CHANGELOG.md
git commit -m "chore: release v0.5.0"

# 5. Create PR → Review → Merge to main

# 6. GitHub Action publishes automatically! ✨
```

### Patch Releases (v0.x.1, v0.x.2)

**Use Local Script** (faster for hotfixes):

```bash
# 1. Fix bug
git checkout -b hotfix/0.4.1

# 2. Update version
"version": "0.4.0" → "0.4.1"

# 3. Run local release
npm run release
# Faster, you control timing

# 4. Push changes
git push origin hotfix/0.4.1
# Merge PR afterward
```

### Beta Releases (v0.x.0-beta.1)

**Use Local Script** (manual control):

```bash
# 1. Update to beta version
"version": "0.5.0-beta.1"

# 2. Test
npm test

# 3. Publish with beta tag
npm run release
# OR manually:
npm publish --tag beta

# Users install: npm install @cortexmemory/sdk@beta
```

---

## 🔧 Release Checklist

### Before Any Release

- [ ] All tests passing (201/201)
- [ ] Version updated in `package.json`
- [ ] CHANGELOG.md updated
- [ ] README.md accurate
- [ ] Documentation synced
- [ ] No uncommitted changes

### For GitHub Action (Automated)

- [ ] `NPM_TOKEN` secret configured
- [ ] `CONVEX_URL` secret configured
- [ ] `CONVEX_DEPLOY_KEY` secret configured
- [ ] On `main` branch
- [ ] Ready to auto-publish (can't cancel mid-flight)

### For Local Script (Manual)

- [ ] npm logged in (`npm whoami`)
- [ ] GitHub CLI authenticated (`gh auth status`)
- [ ] Ready to confirm publish

---

## 🚨 Emergency: Unpublish

If you need to unpublish a bad release:

```bash
# Within 72 hours of publish
npm unpublish @cortexmemory/sdk@0.4.0

# After 72 hours (must deprecate instead)
npm deprecate @cortexmemory/sdk@0.4.0 "Deprecated - use 0.4.1+"
```

**Note**: Unpublishing is discouraged. Better to publish patch version.

---

## 📋 Common Workflows

### Scenario 1: Normal Release (v0.5.0)

```bash
# Local development
git checkout -b release/v0.5.0
# ... implement features ...
npm test  # 201/201 passing

# Update version
# package.json: "0.5.0"
# CHANGELOG.md: Add section

# Push to GitHub
git push origin release/v0.5.0
# Create PR → Review → Approve

# Merge to main
# GitHub Action publishes automatically ✨
```

### Scenario 2: Hotfix (v0.4.1)

```bash
# Critical bug in v0.4.0
git checkout -b hotfix/0.4.1
# ... fix bug ...
npm test

# Update version
"version": "0.4.1"

# Fast local publish
npm run release
# Confirm: y
# Published in 2 minutes! 🎉
```

### Scenario 3: Pre-release (v0.5.0-beta.1)

```bash
# Testing new features
"version": "0.5.0-beta.1"

# Local publish with beta tag
npm run release
# OR: npm publish --tag beta

# Users: npm install @cortexmemory/sdk@beta
```

### Scenario 4: Rollback

```bash
# v0.5.0 has a critical bug
# Option 1: Deprecate
npm deprecate @cortexmemory/sdk@0.5.0 "Critical bug - use 0.4.0 or 0.5.1"

# Option 2: Unpublish (if within 72 hours)
npm unpublish @cortexmemory/sdk@0.5.0

# Option 3: Publish fixed version
"version": "0.5.1"
npm run release
```

---

## 📦 Current Release (v0.4.0)

**Ready to publish**:

### Option A: Automated (Recommended)

```bash
# 1. Setup secrets (one-time)
# https://github.com/SaintNick1214/Project-Cortex/settings/secrets/actions
# Add: NPM_TOKEN (for npm publish)
# Add: CONVEX_URL (for tests)
# Add: CONVEX_DEPLOY_KEY (for Convex auth)

# 2. Push to main
git add .
git commit -m "feat: Layer 2 Vector Memory complete (v0.4.0)"
git push origin main

# 3. Watch: https://github.com/SaintNick1214/Project-Cortex/actions
# Publishes automatically in ~4 minutes
```

### Option B: Manual (Immediate)

```bash
# Run local script
npm run release

# Prompt: "Ready to publish v0.4.0? (y/n)"
# Type: y

# Publishes in ~2 minutes
```

---

## 🎊 What Gets Published

**Package**: `@cortexmemory/sdk@0.4.0`

**Contents**:
- `dist/` - Compiled SDK (CJS + ESM)
- `README.md` - Package documentation
- `CHANGELOG.md` - Release history
- `LICENSE.md` - Apache 2.0

**Install command**:
```bash
npm install @cortexmemory/sdk@0.4.0
```

**What's included**:
- 54 operations (40 Layer 1 + 14 Layer 2)
- 201 comprehensive tests
- Full TypeScript types
- Complete documentation
- Production-ready quality

---

## 🔗 Resources

- **Setup Guide**: [.github/SETUP-AUTOMATED-RELEASES.md](.github/SETUP-AUTOMATED-RELEASES.md)
- **Workflow File**: [.github/workflows/publish.yml](.github/workflows/publish.yml)
- **Local Script**: [scripts/release.ps1](scripts/release.ps1)
- **CHANGELOG**: [CHANGELOG.md](CHANGELOG.md)

---

## ❓ FAQ

### Q: Which method should I use for v0.4.0?

**A**: Either works! 
- **GitHub Action**: More professional, consistent, trackable
- **Local Script**: Faster, you control timing

For a major release like v0.4.0, **GitHub Action is recommended**.

### Q: Can I use both methods?

**A**: Yes! They're complementary:
- GitHub Action for production (v0.x.0)
- Local script for patches/betas (v0.x.1-beta.1)

### Q: What if GitHub Action fails?

**A**: 
1. Check workflow logs: https://github.com/SaintNick1214/Project-Cortex/actions
2. Fix issue
3. Bump version (e.g., 0.4.0 → 0.4.1)
4. Push again OR use local script

### Q: How do I cancel a publish in progress?

**A**:
- **GitHub Action**: Can't cancel mid-publish (by design for safety)
- **Local Script**: Press Ctrl+C before confirming

### Q: What secrets do I need?

**A**: 3 secrets total:

1. **`NPM_TOKEN`**: **Required** (for publishing to npm)
2. **`CONVEX_URL`**: **Required** (for running tests in CI)
3. **`CONVEX_DEPLOY_KEY`**: **Required** (for Convex authentication in tests)

All 3 are needed for the GitHub Action to work properly. Without them, the workflow will fail at the test or publish step.

---

**Status**: ✅ **Two release workflows ready - choose based on your needs!** 🚀

**Next**: Setup `NPM_TOKEN` secret, then push to publish v0.4.0!

