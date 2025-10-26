# Release Quick Reference Card

One-page cheat sheet for releasing Cortex SDK versions.

## 🚀 Quick Release (v0.1.0)

```powershell
# Verify everything works
npm test && npm run build

# Commit version bump
git add package.json CHANGELOG-SDK.md
git commit -m "chore: release v0.1.0"  
git push

# Tag and push
git tag -a v0.1.0 -m "Release v0.1.0"
git push --tags

# Publish
npm publish --access public

# Create GitHub release
gh release create v0.1.0 --generate-notes
```

**Done!** ✅

---

## 📦 Package Info

**Name**: `@cortexmemory/sdk`  
**Current Version**: `0.1.0`  
**Bundle Size**: 16.2 KB  
**Install**: `npm install @cortexmemory/sdk`

---

## 🔑 First-Time Setup

### npm Account
```powershell
npm login
npm whoami  # Verify
```

### GitHub CLI
```powershell
winget install GitHub.cli
gh auth login
```

### npm Token (for CI/CD)
1. Visit: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Generate New Token → Automation
3. Copy token
4. Add to GitHub Secrets as `NPM_TOKEN`

---

## 📝 Version Bump Process

### Before Release
1. Update `package.json` version
2. Update `CHANGELOG-SDK.md`
3. Run tests: `npm test`
4. Run build: `npm run build`

### Release
1. Commit changes
2. Create tag: `git tag -a vX.Y.Z -m "..."`
3. Push: `git push --tags`
4. Publish: `npm publish --access public`
5. GitHub release: `gh release create vX.Y.Z`

### After Release
1. Verify on npm: `npm view @cortexmemory/sdk`
2. Test install: `npm install @cortexmemory/sdk`
3. Check GitHub releases page

---

## 🎯 Version Strategy

```
0.1.0 - Conversations API (Layer 1a)        ← YOU ARE HERE
0.2.0 - Immutable Store (Layer 1b)
0.3.0 - Mutable Store (Layer 1c)
0.4.0 - Vector Memory (Layer 2)
0.5.0 - Memory API (Layer 3)
0.6.0 - Coordination APIs
1.0.0 - Production Release
```

---

## ⚡ Common Commands

```powershell
# Build
npm run build          # Build CJS + ESM
npm run clean          # Clean dist/

# Test
npm test               # Run all tests
npm run test:coverage  # Coverage report

# Pack (test before publish)
npm pack              # Creates .tgz
npm pack --dry-run    # Preview files

# Publish
npm publish --dry-run      # Preview
npm publish --access public # Actually publish

# GitHub
gh release create vX.Y.Z   # Create release
gh release list            # List releases
gh release view vX.Y.Z     # View release

# Verify
npm view @cortexmemory/sdk          # View on npm
npm view @cortexmemory/sdk version  # Check version
```

---

## 🐛 Quick Fixes

### "Permission denied"
```powershell
npm login
npm whoami
```

### "Tests failed"
```powershell
npm test
# Fix errors, then retry
```

### "Build failed"
```powershell
npm run clean
npm run build
```

### "Wrong version published"
```powershell
# Within 72 hours:
npm unpublish @cortexmemory/sdk@X.Y.Z

# Or better: publish patch
# Update to X.Y.Z+1
npm publish --access public
```

---

## 📋 Files Created for Release

### Configuration
- [x] `package.json` - Updated with publish metadata
- [x] `tsconfig.build.json` - Build configuration
- [x] `tsconfig.esm.json` - ESM configuration
- [x] `.npmignore` - Exclude dev files

### Documentation
- [x] `CHANGELOG-SDK.md` - Version history
- [x] `dev-docs/RELEASE-PROCESS.md` - Complete guide
- [x] `dev-docs/RELEASE-V0.1.0-GUIDE.md` - This release
- [x] `dev-docs/READY-FOR-RELEASE.md` - Pre-release summary
- [x] `dev-docs/RELEASE-QUICK-REF.md` - This file

### Automation
- [x] `.github/workflows/publish.yml` - Auto-publish on tag

---

## ✅ Ready to Publish!

**Everything is prepared and tested.**

When ready:
1. Read [RELEASE-V0.1.0-GUIDE.md](./RELEASE-V0.1.0-GUIDE.md)
2. Follow the steps
3. Publish your first npm package!

**Estimated Time**: 10-15 minutes

---

**Questions?** See [RELEASE-PROCESS.md](./RELEASE-PROCESS.md) for detailed explanations.

