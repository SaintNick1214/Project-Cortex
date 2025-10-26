# Release v0.1.0 - Step-by-Step Guide

Complete checklist for releasing Cortex SDK v0.1.0 to npm and GitHub.

## 📋 Pre-Release Checklist

### ✅ Code Quality (DONE)
- [x] All 45 tests passing
- [x] No linter errors  
- [x] TypeScript compiles
- [x] Coverage > 80%

### ✅ Package Setup (DONE)
- [x] package.json updated to v0.1.0
- [x] Build scripts configured (tsup)
- [x] .npmignore created
- [x] CHANGELOG-SDK.md created
- [x] Build tested successfully

### ✅ Documentation (READY)
- [x] README.md comprehensive
- [x] LICENSE.md present
- [x] API docs complete
- [x] Examples working

### 🎯 Ready to Release!

Package details:
- Name: `@saintnick/cortex-sdk`
- Version: `0.1.0`
- Size: 16.2 KB (gzipped)
- Files: 8 (dist/ + docs)

---

## 🚀 Release Steps

### Step 1: Final Verification

```powershell
cd "C:\Users\nicho\OneDrive - Saint Nick LLC\Project Cortex"

# Ensure all changes are committed
git status

# Run full test suite
npm test

# Build the package
npm run build

# Test pack (dry run)
npm pack --dry-run
```

**Expected output**:
```
Tests: 45 passed, 45 total
Package size: ~16 KB
Total files: 8
```

---

### Step 2: Create CHANGELOG Entry

The file `CHANGELOG-SDK.md` is already created with v0.1.0 notes.

**Verify it looks good**:
```powershell
cat CHANGELOG-SDK.md
```

---

### Step 3: Commit Version Bump

```powershell
# Stage files
git add package.json CHANGELOG-SDK.md

# Commit
git commit -m "chore: release v0.1.0 - Conversations API

- Complete Layer 1a with 9 operations
- 45 comprehensive tests (100% passing)
- Includes getHistory, search, and export operations
- Full GDPR compliance
- Interactive test runner for debugging"

# Push to GitHub
git push origin main
```

---

### Step 4: Create Git Tag

```powershell
# Create annotated tag
git tag -a v0.1.0 -m "Release v0.1.0 - Conversations API (Layer 1a)

Features:
- Complete Conversations API with 9 operations
- 45 comprehensive tests (100% passing)
- TypeScript SDK with full type safety
- Interactive test runner
- GDPR-compliant export and deletion

Operations:
- create, get, addMessage, list, count, delete
- getHistory (paginated messages)
- search (full-text search)
- export (JSON/CSV for GDPR)"

# Push tag to GitHub
git push origin v0.1.0
```

---

### Step 5: Create GitHub Release

**Option A: Using GitHub CLI (Recommended)**

```powershell
# Install GitHub CLI if needed
winget install GitHub.cli

# Login (first time only)
gh auth login

# Create release
gh release create v0.1.0 `
  --title "v0.1.0 - Conversations API" `
  --notes-file dev-docs/release-notes-v0.1.0.md `
  --latest

# Or with inline notes:
gh release create v0.1.0 `
  --title "v0.1.0 - Conversations API" `
  --notes "## 🎉 Initial Release

Cortex SDK v0.1.0 includes the complete Conversations API (Layer 1a).

### Features
- 9 operations: create, get, addMessage, list, count, delete, getHistory, search, export
- 45 comprehensive tests (100% passing)
- TypeScript SDK with full type safety
- GDPR compliance (delete + export)

### Installation
\`\`\`bash
npm install @saintnick/cortex-sdk
\`\`\`

See [documentation](https://github.com/SaintNick1214/cortex-sdk#readme) for details."
```

**Option B: Using GitHub Web UI**

1. Go to: https://github.com/SaintNick1214/cortex-sdk/releases/new
2. Choose tag: `v0.1.0` (from dropdown)
3. Title: `v0.1.0 - Conversations API`
4. Description: Copy from `dev-docs/RELEASE-PROCESS.md` template
5. Check ✅ "Set as the latest release"
6. Click "Publish release"

---

### Step 6: Publish to npm

**First Time Setup** (if not already done):

```powershell
# Create npm account
# Visit: https://www.npmjs.com/signup

# Login via CLI
npm login
# Enter: username, password, email
# Enter OTP if 2FA enabled

# Verify login
npm whoami
```

**Publish the Package**:

```powershell
# Ensure you're in the project directory
cd "C:\Users\nicho\OneDrive - Saint Nick LLC\Project Cortex"

# Test publish (shows what would happen)
npm publish --dry-run

# Actually publish
npm publish --access public

# Expected output:
# + @saintnick/cortex-sdk@0.1.0
```

**Verify Publication**:

```powershell
# View package on npm
npm view @saintnick/cortex-sdk

# Check version
npm view @saintnick/cortex-sdk version
# Should show: 0.1.0

# View all versions
npm view @saintnick/cortex-sdk versions
```

---

### Step 7: Test Installation

**Create test project**:

```powershell
# Create new directory
mkdir C:\temp\test-cortex-install
cd C:\temp\test-cortex-install

# Initialize
npm init -y

# Install your published package
npm install @saintnick/cortex-sdk

# Verify installation
ls node_modules/@saintnick/cortex-sdk/
```

**Test import** (create `test.js`):

```javascript
import { Cortex } from '@saintnick/cortex-sdk';

console.log('✅ Import successful!');
console.log('Cortex class:', typeof Cortex);
console.log('Package loaded correctly!');
```

Run:
```powershell
node test.js
```

---

### Step 8: Post-Release Verification

```powershell
# 1. Check npm page
# Visit: https://www.npmjs.com/package/@saintnick/cortex-sdk

# 2. Check GitHub release
# Visit: https://github.com/SaintNick1214/cortex-sdk/releases/tag/v0.1.0

# 3. Test installation from npm
npm install @saintnick/cortex-sdk

# 4. Check package stats
npm view @saintnick/cortex-sdk --json
```

---

## ⚠️ Troubleshooting

### Issue: "You do not have permission to publish"

**Cause**: Not logged in to npm or wrong account

**Solution**:
```powershell
npm logout
npm login
npm whoami  # Verify correct account
npm publish --access public
```

---

### Issue: "Package name already taken"

**Cause**: Unscoped name might be taken

**Solution**: Use scoped package (already done!)
```json
"name": "@saintnick/cortex-sdk"  // ✅ Scoped
```

---

### Issue: "prepublishOnly script failed"

**Cause**: Tests failed or build failed

**Solution**:
```powershell
# Run tests manually
npm test

# Run build manually
npm run build

# Fix any errors, then try again
npm publish --access public
```

---

### Issue: "Cannot find dist/ files"

**Cause**: Build didn't run or failed

**Solution**:
```powershell
# Clean and rebuild
npm run clean
npm run build

# Verify dist exists
ls dist/

# Try publishing again
npm publish --access public
```

---

### Issue: "2FA code required"

**If you have 2FA enabled on npm**:

1. npm publish will prompt for OTP code
2. Check your authenticator app
3. Enter the 6-digit code
4. Package will publish

**Or use automation token**:
```powershell
# Create automation token on npm website
# Then:
npm set //registry.npmjs.org/:_authToken YOUR_TOKEN
npm publish --access public
```

---

## 📝 After Publishing

### Immediate Actions

1. **Verify on npm**:
   - Visit: https://www.npmjs.com/package/@saintnick/cortex-sdk
   - Check version shows 0.1.0
   - Check README displays correctly
   - Test "Try on RunKit" if available

2. **Verify on GitHub**:
   - Visit: https://github.com/SaintNick1214/cortex-sdk/releases
   - Check v0.1.0 release is published
   - Verify release notes are correct

3. **Test Real Installation**:
   ```powershell
   # Fresh install from npm
   mkdir C:\temp\fresh-test
   cd C:\temp\fresh-test
   npm init -y
   npm install @saintnick/cortex-sdk
   
   # Test import
   node -e "import('@saintnick/cortex-sdk').then(m => console.log('Works!', m.Cortex))"
   ```

### Optional: Announce the Release

**Twitter/X**:
```
🎉 Cortex SDK v0.1.0 is now live!

AI agent memory management built on @convex_dev

✅ 9 conversation operations
✅ 45 tests (100% passing)
✅ TypeScript support
✅ GDPR compliant

npm install @saintnick/cortex-sdk

Docs: github.com/SaintNick1214/cortex-sdk
```

**Dev.to / Medium** (optional):
Write a blog post about:
- Why you built it
- Key features
- How it works
- Getting started

**Reddit** (optional):
- r/typescript
- r/node
- r/javascript
- r/programming

---

## 🎊 Success Criteria

Your release is successful when:

- [ ] `npm view @saintnick/cortex-sdk version` returns `0.1.0`
- [ ] `npm install @saintnick/cortex-sdk` works
- [ ] Import works: `import { Cortex } from '@saintnick/cortex-sdk'`
- [ ] GitHub release is visible at /releases/tag/v0.1.0
- [ ] GitHub shows "Latest" badge on v0.1.0
- [ ] README renders correctly on npm website
- [ ] Package size is reasonable (< 100 KB)

---

## 📊 Expected Results

### npm Package Page

**URL**: https://www.npmjs.com/package/@saintnick/cortex-sdk

**Should show**:
- Version: 0.1.0
- Weekly downloads: 0 (for now!)
- License: Apache-2.0
- Dependencies: convex (peer)
- README with installation instructions
- TypeScript definitions available

### GitHub Release Page

**URL**: https://github.com/SaintNick1214/cortex-sdk/releases/tag/v0.1.0

**Should show**:
- Release title: v0.1.0 - Conversations API
- Release notes with features
- Assets: Source code (zip, tar.gz)
- "Latest" badge

---

## 🔄 Next Release (v0.2.0)

After publishing v0.1.0, for v0.2.0:

1. Develop Layer 1b (Immutable Store)
2. Update version to `0.2.0` in package.json
3. Update CHANGELOG-SDK.md with v0.2.0 section
4. Run tests
5. Commit, tag, push
6. Create GitHub release
7. Publish to npm

**Same process, just increment version!**

---

## 💡 Tips

### Before Publishing
- ✅ Test the package locally (`npm pack` and install the .tgz)
- ✅ Check bundle size is reasonable
- ✅ Verify all required files are included
- ✅ Run tests one more time

### After Publishing
- ✅ Test installation immediately
- ✅ Check package page renders correctly
- ✅ Keep an eye on npm for first few hours
- ✅ Be ready to publish a patch if needed (v0.1.1)

### If You Need to Unpublish
```powershell
# Within 72 hours of publishing
npm unpublish @saintnick/cortex-sdk@0.1.0

# Fix issues, then republish
npm publish --access public
```

**Warning**: Unpublishing is frowned upon. Better to publish a patch (v0.1.1)!

---

## ✅ Quick Reference Commands

```powershell
# Full release flow
npm test                              # 1. Test
npm run build                         # 2. Build
npm pack --dry-run                    # 3. Preview
git add package.json CHANGELOG-SDK.md # 4. Stage
git commit -m "chore: release v0.1.0" # 5. Commit
git push origin main                  # 6. Push
git tag -a v0.1.0 -m "Release v0.1.0" # 7. Tag
git push origin v0.1.0               # 8. Push tag
gh release create v0.1.0             # 9. GitHub release
npm publish --access public          # 10. Publish to npm
```

---

**Ready to release v0.1.0!** 🚀

Follow the steps above in order, and you'll have your first published npm package!

