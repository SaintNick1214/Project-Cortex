# Quick Release Guide - v0.2.0

One-command release for v0.2.0 with the new package name `@cortexmemory/sdk`.

---

## 🚀 Automated Release (Recommended)

### One Command:

```powershell
npm run release
```

**This will**:

1. ✅ Run all 99 tests
2. ✅ Build the package
3. ✅ Show package contents preview
4. ✅ Ask for confirmation
5. ✅ Commit and push
6. ✅ Create git tag v0.2.0
7. ✅ Publish to npm
8. ✅ Create GitHub release
9. ✅ Verify publication

**Total time**: ~2 minutes

---

## 📋 Manual Release (If Preferred)

### Step-by-Step:

```powershell
# 1. Test and build
npm test && npm run build

# 2. Verify package
npm pack --dry-run

# 3. Commit and tag
git add .
git commit -m "chore: release v0.2.0"
git push origin main
git tag -a v0.2.0 -m "Release v0.2.0 - Immutable Store API"
git push origin v0.2.0

# 4. Publish
npm publish --access public

# 5. Create GitHub release
gh release create v0.2.0 --title "v0.2.0 - Immutable Store API" --generate-notes

# 6. Verify
npm view @cortexmemory/sdk version
```

---

## 📦 What's Being Released

**Package**: `@cortexmemory/sdk@0.2.0` (renamed from @cortexmemory/cortex-sdk)

**New in v0.2.0**:

- ✅ Complete Immutable Store API (Layer 1b)
- ✅ 8 new operations (store, get, getVersion, getHistory, list, search, count, purge)
- ✅ 45 comprehensive tests
- ✅ Automatic versioning system
- ✅ 99 total tests (54 conversations + 45 immutable)
- ✅ Enhanced edge case and integration testing

**Size**: ~16 KB (gzipped)

---

## ✅ Pre-Release Checklist

Before running `npm run release`:

- [x] Version bumped to 0.2.0 in package.json
- [x] CHANGELOG-SDK.md updated with v0.2.0 notes
- [x] All 99 tests passing
- [x] Package name updated to @cortexmemory/sdk
- [x] Build tested locally
- [x] Test installation verified (Proofs/React)

**Everything ready!** ✅

---

## 🎯 After Release

### Verify Publication

```powershell
# Check npm
npm view @cortexmemory/sdk

# Should show:
# @cortexmemory/sdk@0.2.0
# dist.tarball: https://registry.npmjs.org/@cortexmemory/sdk/-/sdk-0.2.0.tgz
```

### Test Installation

```powershell
# In a fresh directory
npm install @cortexmemory/sdk

# Test import
node -e "import('@cortexmemory/sdk').then(m => console.log('✅ Works!', m.Cortex))"
```

---

## 🎊 Release Highlights for v0.2.0

### Layer 1b: Immutable Store

```typescript
import { Cortex } from "@cortexmemory/sdk";

const cortex = new Cortex({ convexUrl: process.env.CONVEX_URL });

// Store versioned data
const v1 = await cortex.immutable.store({
  type: "kb-article",
  id: "refund-policy",
  data: { content: "30-day refund policy" },
});

// Update (creates v2, preserves v1)
const v2 = await cortex.immutable.store({
  type: "kb-article",
  id: "refund-policy",
  data: { content: "60-day refund policy" },
});

// Get version history
const history = await cortex.immutable.getHistory(
  "kb-article",
  "refund-policy",
);
console.log(`${history.length} versions`); // 2
```

### Breaking Changes

- ⚠️ Package renamed from `@cortexmemory/cortex-sdk` to `@cortexmemory/sdk`
- Migration: Update import from `@cortexmemory/cortex-sdk` to `@cortexmemory/sdk`

---

## 🚀 Ready to Release!

Just run:

```powershell
npm run release
```

And follow the prompts! The script will handle everything. 🎉

---

**Last Updated**: October 26, 2025  
**Version**: 0.2.0  
**Status**: ✅ Ready to publish
