# GitHub Workflow Improvement - Smart Version Detection

**Date**: October 27, 2025  
**Issue**: Multi-commit pushes not triggering publish  
**Solution**: Compare with npm registry instead of git history

---

## 🐛 The Problem

### Original Logic (Git-Based)

```yaml
# Get version from current commit
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Get version from previous commit
git show HEAD~1:package.json > prev-package.json
PREVIOUS_VERSION=$(node -p "require('./prev-package.json').version")

# Compare
if [ "$CURRENT_VERSION" != "$PREVIOUS_VERSION" ]; then
  publish
fi
```

### Why It Failed

**Scenario**:

```bash
Commit 1: package.json (0.4.6 → 0.5.0)
Commit 2: CHANGELOG.md (add v0.5.0 section)
Push both commits

Workflow runs on Commit 2:
  HEAD = 0.5.0
  HEAD~1 = 0.5.0  (Commit 1!)
  → No change detected ❌
```

**Problems**:

- ❌ Fails with multi-commit pushes
- ❌ Depends on git history order
- ❌ Can't retry failed publishes
- ❌ Fragile to rebase/amend

---

## ✅ The Solution

### New Logic (npm Registry-Based)

```yaml
# Get version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")

# Get version from npm registry
NPM_VERSION=$(npm view @cortexmemory/sdk version 2>/dev/null || echo "0.0.0")

# Compare
if [ "$CURRENT_VERSION" != "$NPM_VERSION" ]; then
  publish
fi
```

### Why It Works

**Scenario 1: Normal release**

```bash
package.json: 0.5.0
npm registry: 0.4.6
→ Publish! ✅
```

**Scenario 2: Multi-commit push**

```bash
Commit 1: Bump version to 0.5.0
Commit 2: Update CHANGELOG
Commit 3: Fix typo

All pushed together:
  package.json: 0.5.0
  npm registry: 0.4.6
  → Publish! ✅ (doesn't matter how many commits)
```

**Scenario 3: Already published**

```bash
package.json: 0.5.0
npm registry: 0.5.0
→ Skip ⏭️ (prevents duplicate publish)
```

**Scenario 4: Retry failed publish**

```bash
First push: Failed to publish (network error)
  package.json: 0.5.0
  npm registry: 0.4.6

Fix issue and re-push (same commits):
  package.json: 0.5.0
  npm registry: 0.4.6
  → Publish! ✅ (can retry without version bump)
```

---

## 🎯 Benefits

### Robustness

- ✅ **Multi-commit safe**: Works regardless of commit count
- ✅ **Retry-friendly**: Can re-push same version if publish fails
- ✅ **Idempotent**: Safe to run multiple times
- ✅ **Git-independent**: No dependency on git history

### Developer Experience

- ✅ **Flexible workflow**: Commit version and changelog separately
- ✅ **No special order**: Version bump can be in any commit
- ✅ **Rebase-safe**: Works after git rebase/amend
- ✅ **Clear intent**: "Is this version published?" vs "Did version change in last commit?"

### Safety

- ✅ **Prevents duplicates**: Won't publish 0.5.0 if already on npm
- ✅ **Allows retries**: Can fix CI issues and re-run
- ✅ **Clear logging**: Shows both package and npm versions

---

## 📊 Comparison

| Feature                  | Git-Based (Old)      | npm-Based (New)        |
| ------------------------ | -------------------- | ---------------------- |
| **Multi-commit push**    | ❌ Fails             | ✅ Works               |
| **Retry failed publish** | ❌ Need version bump | ✅ Just re-push        |
| **Idempotent**           | ❌ No                | ✅ Yes                 |
| **Rebase safe**          | ❌ Can break         | ✅ Works               |
| **Clear intent**         | ⚠️ Git diff          | ✅ "Not yet published" |
| **Prevents duplicates**  | ⚠️ Usually           | ✅ Always              |

---

## 🔧 Implementation Details

### Code Changes

**File**: `.github/workflows/publish.yml`

**Before**:

```bash
# Compare HEAD vs HEAD~1 (git-based)
PREVIOUS_VERSION=$(node -p "require('./prev-package.json').version")
if [ "$CURRENT_VERSION" != "$PREVIOUS_VERSION" ]; then
```

**After**:

```bash
# Compare package.json vs npm registry (registry-based)
NPM_VERSION=$(npm view @cortexmemory/sdk version 2>/dev/null || echo "0.0.0")
if [ "$CURRENT_VERSION" != "$NPM_VERSION" ]; then
```

### Error Handling

```bash
# If package not on npm yet (first publish)
npm view @cortexmemory/sdk version 2>/dev/null || echo "0.0.0"
# Returns: "0.0.0" if not found
# → Will always trigger publish for first release
```

---

## 🎯 Example Flows

### Flow 1: Standard Release

```bash
# Developer workflow
git commit -m "chore: bump version to 0.5.0"  # Commit 1
git commit -m "docs: update CHANGELOG"        # Commit 2
git commit -m "fix: typo in README"           # Commit 3
git push origin main

# GitHub Action
1. Checks out code (all 3 commits)
2. Reads package.json: "0.5.0"
3. Checks npm: "0.4.6"
4. Compares: 0.5.0 != 0.4.6 → PUBLISH ✅
```

### Flow 2: Failed Publish Retry

```bash
# First attempt
git push origin main
# → Workflow runs
# → Tests pass
# → Publish fails (network timeout)
# npm still shows: 0.4.6

# Retry (no changes needed!)
git push origin main --force-with-lease
# → Workflow runs again
# → package.json: 0.5.0
# → npm: 0.4.6 (still old)
# → Compares: 0.5.0 != 0.4.6 → PUBLISH ✅
```

### Flow 3: Accidental Re-Push

```bash
# First push
git push origin main
# → Published 0.5.0 successfully

# Accidental second push (same commits)
git push origin main
# → Workflow runs
# → package.json: 0.5.0
# → npm: 0.5.0 (just published!)
# → Compares: 0.5.0 == 0.5.0 → SKIP ⏭️
# → No duplicate publish!
```

---

## ✅ Verification

### Test the Logic

```bash
# Simulate locally
CURRENT_VERSION=$(node -p "require('./package.json').version")
NPM_VERSION=$(npm view @cortexmemory/sdk version 2>/dev/null || echo "0.0.0")

echo "Package: $CURRENT_VERSION"
echo "npm: $NPM_VERSION"

if [ "$CURRENT_VERSION" != "$NPM_VERSION" ]; then
  echo "Would publish"
else
  echo "Would skip"
fi
```

### Expected Results

**Before any publish**:

- Package: 0.5.0
- npm: 0.4.6
- Result: Would publish ✅

**After publish succeeds**:

- Package: 0.5.0
- npm: 0.5.0
- Result: Would skip ✅

---

## 📝 Files Modified

1. **`.github/workflows/publish.yml`**
   - Changed version detection logic
   - Now uses npm registry instead of git diff
   - More robust and reliable

2. **`.github/SETUP-AUTOMATED-RELEASES.md`**
   - Added explanation of smart version detection
   - Documented benefits

3. **`CHANGELOG.md`**
   - Noted improvement in v0.5.0 release

---

## 🚀 Ready for v0.5.0

**With this fix**, the v0.5.0 release will work correctly even though:

- Version bump was in earlier commit
- CHANGELOG update was in later commit
- Both pushed together

**The workflow will**:

1. See package.json: 0.5.0
2. Check npm registry: 0.4.6 (or whatever is currently published)
3. Compare: Different → Publish! ✅

---

**Status**: ✅ **Workflow improved - Ready for reliable automated publishing!**
