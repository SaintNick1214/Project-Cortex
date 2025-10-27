# Setup: Automated npm Releases

**GitHub Action**: `.github/workflows/publish.yml`  
**Trigger**: Automatic when `package.json` version changes on `main` branch

---

## 🔐 Required Secrets

You need to configure 3 secrets in your GitHub repository:

### 1. NPM_TOKEN (Required)

**Purpose**: Authenticate to npm registry for publishing

**Steps**:

1. **Create npm Access Token**:

   ```bash
   # Login to npm (if not already)
   npm login

   # Or create token on npmjs.com:
   # → Profile → Access Tokens → Generate New Token
   # → Type: "Automation" (for CI/CD)
   # → Copy the token
   ```

2. **Add to GitHub**:
   - Go to: `https://github.com/SaintNick1214/Project-Cortex/settings/secrets/actions`
   - Click **"New repository secret"**
   - Name: `NPM_TOKEN`
   - Value: `npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxx` (paste your token)
   - Click **"Add secret"**

### 2. CONVEX_URL (Required for tests)

**Purpose**: Tell tests which Convex deployment to use

**Steps**:

1. **Get Convex URL**:

   ```bash
   # Get from your .env.local or Convex dashboard
   echo $CONVEX_URL
   # Should look like: https://happy-animal-123.convex.cloud
   ```

2. **Add to GitHub**:
   - Go to: `https://github.com/SaintNick1214/Project-Cortex/settings/secrets/actions`
   - Click **"New repository secret"**
   - Name: `CONVEX_URL`
   - Value: Your Convex deployment URL
   - Click **"Add secret"**

### 3. CONVEX_DEPLOY_KEY (Required for tests)

**Purpose**: Authenticate to Convex for running tests (admin access)

**Steps**:

1. **Get Convex Deploy Key**:

   ```bash
   # Option A: From your local .env.local
   cat .env.local | grep CONVEX_DEPLOY_KEY
   # CONVEX_DEPLOY_KEY=prod:happy-animal-123|xxxxxxxxxxxxx

   # Option B: From Convex dashboard
   # 1. Go to: https://dashboard.convex.dev/
   # 2. Select your deployment
   # 3. Settings → Deploy Key
   # 4. Copy the deploy key
   ```

2. **Add to GitHub**:
   - Go to: `https://github.com/SaintNick1214/Project-Cortex/settings/secrets/actions`
   - Click **"New repository secret"**
   - Name: `CONVEX_DEPLOY_KEY`
   - Value: `prod:happy-animal-123|xxxxxxxxxxxxx` (paste your deploy key)
   - Click **"Add secret"**

**Note**: `GITHUB_TOKEN` is automatically provided by GitHub Actions (no setup needed)

---

## 🚀 How It Works

### Automatic Workflow

```bash
# 1. Update version locally
# Edit package.json: "version": "0.4.0" → "0.5.0"

# 2. Update CHANGELOG.md
# Add new version section

# 3. Commit and push to main
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.5.0"
git push origin main

# 4. GitHub Action automatically:
# ✅ Detects version change
# ✅ Runs all 201 tests
# ✅ Builds package
# ✅ Publishes to npm
# ✅ Creates git tag (v0.5.0)
# ✅ Creates GitHub release
# ✅ Verifies publish

# 5. Done! Package is live on npm
```

**No manual `npm publish` needed!**

---

## 📋 Workflow Details

### Trigger Conditions

**ONLY triggers when**:

- ✅ Push to `main` branch
- ✅ `package.json` file modified
- ✅ Version in package.json actually changed (not just file touched)

**Will NOT trigger when**:

- ❌ Push to other branches
- ❌ package.json unchanged
- ❌ Only other files changed
- ❌ Version same as previous commit

### What Happens

**Job 1: check-version** (1-2 seconds)

```bash
✅ Checkout code
✅ Compare package.json version with previous commit
✅ Set output: version-changed=true/false
```

**Job 2: publish** (3-5 minutes, only if version changed)

```bash
✅ Checkout code
✅ Setup Node.js 20
✅ Install dependencies (npm ci)
✅ Run all tests (201 tests)
✅ Build package (tsup)
✅ Verify contents (npm pack)
✅ Publish to npm (with provenance)
✅ Create git tag
✅ Push tag to GitHub
✅ Create GitHub release
✅ Verify npm updated
✅ Show summary
```

---

## 🎯 Comparison: GitHub Action vs Local Script

### GitHub Action (Automated Production)

**When to use**: Production releases (v0.4.0, v0.5.0, etc.)

```bash
# Update version
"version": "0.4.0" → "0.5.0"

# Commit and push
git push origin main

# GitHub Action handles the rest automatically!
```

**Pros**:

- ✅ Fully automated (no manual steps)
- ✅ Consistent environment (Ubuntu, Node 20)
- ✅ Secure (secrets in GitHub)
- ✅ Full audit trail
- ✅ Anyone on team can trigger
- ✅ Prevents dirty builds

**Cons**:

- ⏱️ Takes 3-5 minutes to run
- ❌ Can't cancel mid-publish
- ❌ Harder to debug failures

### Local Script (Manual Control)

**When to use**: Testing releases, beta versions, debugging

```bash
npm run release
```

**Pros**:

- ✅ Immediate feedback
- ✅ Full control (can abort anytime)
- ✅ Easy debugging
- ✅ Manual confirmation step

**Cons**:

- ❌ Depends on local environment
- ❌ Requires local npm/gh credentials
- ❌ Risk of dirty builds
- ❌ No audit trail

---

## 🎊 Recommended Workflow

**For Cortex SDK**, use BOTH:

### Production Releases (v0.4.0, v0.5.0, v1.0.0)

```bash
# Update version in package.json
# Update CHANGELOG.md
git add package.json CHANGELOG.md
git commit -m "chore: release v0.4.0"
git push origin main

# GitHub Action automatically publishes ✨
```

### Development/Beta Releases

```bash
# Update version to beta
"version": "0.4.0-beta.1"

# Use local script
npm run release
```

### Hotfix Releases

```bash
# Quick fix
"version": "0.4.1"

# Use local script for speed
npm run release
```

---

## ⚙️ Next Steps

### 1. Setup Secrets (5 minutes)

**Required NOW** (before GitHub Action works):

```bash
# Step 1: Create npm token
npm login  # If not logged in
# OR visit: https://www.npmjs.com/settings/YOUR_USERNAME/tokens

# Step 2: Get Convex credentials
# From .env.local or Convex dashboard:
# - CONVEX_URL (deployment URL)
# - CONVEX_DEPLOY_KEY (admin key)

# Step 3: Add to GitHub
# Go to: https://github.com/SaintNick1214/Project-Cortex/settings/secrets/actions
# Add: NPM_TOKEN (required for publishing)
# Add: CONVEX_URL (required for tests)
# Add: CONVEX_DEPLOY_KEY (required for tests)
```

### 2. Test the Workflow

**Option A: Dry run (safe)**

```bash
# Temporarily change version
"version": "0.4.0-test.1"

# Push to test branch first
git checkout -b test-publish
git add package.json
git commit -m "test: version bump"
git push origin test-publish

# Merge to main to trigger action
```

**Option B: Real release (v0.4.0)**

```bash
# Version already at 0.4.0 in package.json
# Just push to main
git add .
git commit -m "chore: release v0.4.0"
git push origin main

# GitHub Action will publish automatically!
```

### 3. Monitor Workflow

**Watch it run**:

- Go to: `https://github.com/SaintNick1214/Project-Cortex/actions`
- Click on the running workflow
- Watch real-time logs

**Expected timeline**:

- Tests: ~2 minutes
- Build: ~30 seconds
- Publish: ~30 seconds
- Total: ~3-4 minutes

---

## 🔧 Workflow Features

### Smart Detection

```yaml
# Only runs when version ACTUALLY changes
# Compares current vs previous commit
CURRENT_VERSION → "0.4.0"
PREVIOUS_VERSION → "0.3.1"
# Result: Publish triggered ✅

CURRENT_VERSION → "0.4.0"
PREVIOUS_VERSION → "0.4.0"
# Result: Skipped (no change) ⏭️
```

### Safety Checks

- ✅ All 201 tests must pass
- ✅ Build must succeed
- ✅ Package verification before publish
- ✅ Provenance enabled (npm security)

### Automatic Tagging

- ✅ Creates `v0.4.0` git tag
- ✅ Pushes to GitHub
- ✅ Creates GitHub release
- ✅ Links to CHANGELOG.md

### Verification

- ✅ Waits for npm registry to update
- ✅ Verifies package is live
- ✅ Shows package URLs

---

## 📝 Files Created

1. **`.github/workflows/publish.yml`** - Automated publish workflow
2. **`.github/SETUP-AUTOMATED-RELEASES.md`** - This setup guide

---

## 🎯 Your New Workflow (v0.4.0 and Beyond)

### For v0.4.0 Release (Right Now!)

```bash
# 1. Verify version is 0.4.0 (already done)
cat package.json | grep version
# "version": "0.4.0" ✅

# 2. Setup npm token secret (one-time)
# Visit: https://github.com/SaintNick1214/Project-Cortex/settings/secrets/actions
# Add: NPM_TOKEN

# 3. Push to main
git add .
git commit -m "feat: Layer 2 Vector Memory - all 14 operations (v0.4.0)"
git push origin main

# 4. Watch GitHub Action
# Visit: https://github.com/SaintNick1214/Project-Cortex/actions
# Watch it publish automatically! 🚀

# Done! Package live in ~4 minutes
```

### For Future Releases

```bash
# Update version
# package.json: "0.4.0" → "0.5.0"

# Update changelog
# CHANGELOG.md: Add v0.5.0 section

# Commit and push
git add package.json CHANGELOG.md
git commit -m "chore: release v0.5.0"
git push origin main

# GitHub Action publishes automatically! ✨
```

---

## ✅ Setup Checklist

Before pushing v0.4.0:

- [ ] Create npm access token
- [ ] Add `NPM_TOKEN` to GitHub secrets
- [ ] (Optional) Add `CONVEX_URL` to GitHub secrets for tests
- [ ] Verify package.json version is `0.4.0`
- [ ] Verify CHANGELOG.md has v0.4.0 section
- [ ] Push to main
- [ ] Watch GitHub Actions run
- [ ] Verify on npm: `npm view @cortexmemory/sdk version`

---

**Status**: ✅ **Automated workflow ready! Setup secrets and push to trigger.** 🚀
