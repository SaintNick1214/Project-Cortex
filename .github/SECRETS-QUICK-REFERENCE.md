# GitHub Secrets - Quick Reference

**For**: Automated npm publishing workflow  
**Setup Once**: Then works automatically for all future releases

---

## 🔐 Required Secrets (3 total)

Add these at: https://github.com/SaintNick1214/Project-Cortex/settings/secrets/actions

### 1. NPM_TOKEN

**Purpose**: Publish to npm registry  
**Type**: npm Automation Token

**Get it**:

```bash
# Visit: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
# Click: "Generate New Token"
# Type: "Automation" (for CI/CD)
# Copy: npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Add to GitHub**:

```
Name:  NPM_TOKEN
Value: npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 2. CONVEX_URL

**Purpose**: Convex deployment URL for tests  
**Type**: URL

**Get it**:

```bash
# Option A: From your local .env.local file
cat .env.local | grep CONVEX_URL
# CONVEX_URL=https://happy-animal-123.convex.cloud

# Option B: From Convex dashboard
# 1. Go to: https://dashboard.convex.dev/
# 2. Select your deployment
# 3. Copy the deployment URL from settings
```

**Add to GitHub**:

```
Name:  CONVEX_URL
Value: https://happy-animal-123.convex.cloud
```

---

### 3. CONVEX_DEPLOY_KEY

**Purpose**: Authenticate to Convex for admin operations in tests  
**Type**: Deploy Key (admin access)

**Get it**:

```bash
# Option A: From your local .env.local file
cat .env.local | grep CONVEX_DEPLOY_KEY
# CONVEX_DEPLOY_KEY=prod:happy-animal-123|xxxxxxxxxxxxxxxxx

# Option B: From Convex dashboard
# 1. Go to: https://dashboard.convex.dev/
# 2. Select your deployment
# 3. Settings → Deploy Keys
# 4. Copy the "Production Deploy Key"
```

**Add to GitHub**:

```
Name:  CONVEX_DEPLOY_KEY
Value: prod:happy-animal-123|xxxxxxxxxxxxxxxxx
```

**⚠️ Security**: This key has admin access! Keep it secret.

---

## 🎯 Quick Setup (5 minutes)

### Step 1: Get Your Credentials

```bash
# From your local Project Cortex directory
cd "C:\Users\nicho\OneDrive - Saint Nick LLC\Project Cortex"

# Check .env.local
cat .env.local
# Should show:
# CONVEX_URL=https://...
# CONVEX_DEPLOY_KEY=prod:...
```

### Step 2: Get npm Token

```bash
# Login to npm (if not already)
npm login

# Create automation token
# Visit: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
# Generate → Automation → Copy
```

### Step 3: Add All 3 to GitHub

**Go to**: https://github.com/SaintNick1214/Project-Cortex/settings/secrets/actions

**Click**: "New repository secret" (3 times, one for each)

**Add**:

```
1. NPM_TOKEN          = npm_xxxxx...
2. CONVEX_URL         = https://happy-animal-123.convex.cloud
3. CONVEX_DEPLOY_KEY  = prod:happy-animal-123|xxxxx...
```

**Click**: "Add secret" for each

---

## ✅ Verification

After adding secrets, verify they're set:

**Go to**: https://github.com/SaintNick1214/Project-Cortex/settings/secrets/actions

**You should see**:

```
✅ NPM_TOKEN          (Updated X ago)
✅ CONVEX_URL         (Updated X ago)
✅ CONVEX_DEPLOY_KEY  (Updated X ago)
```

**Note**: You can't view the values (for security), only that they exist.

---

## 🧪 Test the Setup

**Option 1: Dry run (safe)**

```bash
# Create test version
"version": "0.4.0-test.1"

# Push to trigger workflow
git add package.json
git commit -m "test: workflow test"
git push origin main

# Watch: https://github.com/SaintNick1214/Project-Cortex/actions
# Should run tests and publish
# Then unpublish: npm unpublish @cortexmemory/sdk@0.4.0-test.1
```

**Option 2: Real release (v0.4.0)**

```bash
# Version already at 0.4.0
git push origin main

# Publishes for real!
```

---

## 🔧 Troubleshooting

### "Tests failed - missing CONVEX_URL"

**Fix**: Add `CONVEX_URL` secret (deployment URL)

### "Tests failed - unauthorized"

**Fix**: Add `CONVEX_DEPLOY_KEY` secret (admin key for tests)

### "npm publish failed - 401 Unauthorized"

**Fix**:

- Check `NPM_TOKEN` secret is correct
- Verify token hasn't expired
- Regenerate token if needed

### "npm publish failed - package already exists"

**Fix**: Version already published, bump to next version

---

## 📝 Where to Get Credentials

| Secret              | Source 1                          | Source 2                    |
| ------------------- | --------------------------------- | --------------------------- |
| `NPM_TOKEN`         | https://npmjs.com/settings/tokens | `npm token create`          |
| `CONVEX_URL`        | `.env.local` file                 | Convex dashboard            |
| `CONVEX_DEPLOY_KEY` | `.env.local` file                 | Convex dashboard → Settings |

---

## 🎊 After Setup

**For every future release**:

```bash
# 1. Bump version
"version": "0.5.0"

# 2. Update changelog
# CHANGELOG.md

# 3. Push
git push origin main

# 4. Done! GitHub Action handles everything ✨
```

**No manual `npm publish` ever again!**

---

## 🔗 Related Files

- **Workflow**: [workflows/publish.yml](./workflows/publish.yml)
- **Setup Guide**: [SETUP-AUTOMATED-RELEASES.md](./SETUP-AUTOMATED-RELEASES.md)
- **Release Guide**: [../RELEASE-GUIDE.md](../RELEASE-GUIDE.md)
- **Manual Script**: [../scripts/release.ps1](../scripts/release.ps1)

---

**Status**: ✅ **Add these 3 secrets, then you're ready for automated releases!** 🚀

**Setup URL**: https://github.com/SaintNick1214/Project-Cortex/settings/secrets/actions
