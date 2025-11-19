# 🛡️ Enable Merge Protection - Quick Start

## What This Does

**Prevents merging PRs when tests, security scans, or deployments fail.**

Before: Tests run after merge → main branch can break  
After: Tests run before merge → only working code reaches main

---

## ✅ Quick Setup Checklist

### 1. Verify PR Checks Workflow (Already Done ✓)

The file `.github/workflows/pr-checks.yml` has been created with:
- TypeScript/JavaScript tests
- Python SDK tests  
- Security scanning
- Code quality checks

### 2. Enable Branch Protection (Do This Now)

**Navigate to**: Repository → Settings → Branches → Add Rule

**For `main` branch**:

```
Branch name pattern: main

☑️ Require a pull request before merging
   └─ Require approvals: 1
   
☑️ Require status checks to pass before merging
   └─ ☑️ Require branches to be up to date
   └─ Search and select these checks:
      • all-checks-passed    ← MOST IMPORTANT
      • test-typescript
      • test-python
      • security-check
      • code-quality

☑️ Require conversation resolution before merging

☑️ Include administrators

[Save Changes]
```

### 3. Test It Works

```bash
# Create test branch with intentional error
git checkout -b test-protection
echo "const broken: string = 123;" >> src/test-protection.ts
git add .
git commit -m "test: verify branch protection"
git push origin test-protection

# Open PR on GitHub
# → Should see checks run
# → Should see merge button disabled when checks fail

# Clean up
git checkout dev
git branch -D test-protection
git push origin --delete test-protection
rm src/test-protection.ts
```

---

## 🎯 Expected Behavior

### ✅ When Checks Pass

![Status: All checks passed](https://via.placeholder.com/600x100/28a745/FFFFFF?text=All+checks+have+passed)

- Merge button: **Enabled** (green)
- Status: "All checks have passed"
- Can merge safely

### ❌ When Checks Fail

![Status: Some checks failed](https://via.placeholder.com/600x100/d73a4a/FFFFFF?text=Some+checks+were+not+successful)

- Merge button: **Disabled** (greyed out)
- Status: "Some checks were not successful"
- Must fix issues before merging

---

## 📋 What Gets Checked

| Check | What It Does | Blocks Merge? |
|-------|--------------|---------------|
| **test-typescript** | Runs all TS/JS tests, linting, type checking | ✅ Yes |
| **test-python** | Runs Python tests across multiple versions | ✅ Yes |
| **security-check** | Scans for vulnerabilities with Trivy | ✅ Yes |
| **code-quality** | ESLint code quality checks | ✅ Yes |
| **all-checks-passed** | Master gate - all above must pass | ✅ YES |

---

## 🚨 Common Issues

### Issue: "Required checks are not found"

**Cause**: Check names must exist before adding to branch protection  
**Fix**: 
1. Create a test PR first (triggers workflow)
2. Wait for checks to complete
3. Then add them to branch protection rules

### Issue: "Checks never start"

**Cause**: Missing GitHub secrets  
**Fix**: Verify these secrets exist in Settings → Secrets:
- `CONVEX_URL`
- `CONVEX_DEPLOY_KEY`
- `OPENAI_API_KEY`

### Issue: "Merge button still works when checks fail"

**Cause**: Branch protection not configured correctly  
**Fix**: 
1. Verify rule is for correct branch (`main`)
2. Enable "Include administrators"
3. Force refresh PR page (Ctrl+F5)

---

## 🔧 Customization

### Skip Checks for Documentation

If you don't want checks to run for doc-only changes, add to `pr-checks.yml`:

```yaml
on:
  pull_request:
    branches:
      - main
    paths-ignore:
      - '**.md'
      - 'Documentation/**'
      - 'dev-docs/**'
```

### Require More Reviewers

In branch protection settings:

```
Number of required approvals: 2  # or more
```

### Auto-Dismiss Stale Reviews

```
☑️ Dismiss stale pull request approvals when new commits are pushed
```

This requires re-approval if code changes after review.

---

## 📊 Workflow Timeline

```
Developer creates PR (dev → main)
           ↓
    [0s] PR opened
           ↓
   [10s] Checkout code
           ↓
   [30s] Install dependencies
           ↓
  [2min] Run linting & type checks
           ↓
  [5min] Run all tests
           ↓
  [1min] Security scan
           ↓
   [30s] Build package
           ↓
    ✅ All checks passed
           ↓
  [Human] Code review
           ↓
  [Human] Approve & merge
           ↓
    🚀 Post-merge: Deploy & publish
```

**Total check time**: ~8-10 minutes  
**Can review during**: Yes, checks run in parallel with review

---

## 🎓 Best Practices

### 1. **Protect Both `main` and `dev`**

Consider adding similar (but lighter) protection to `dev`:
- Required checks: Yes
- Required reviews: Optional
- Allows faster iteration while maintaining quality

### 2. **Use Squash Merges**

In branch protection settings:
```
☑️ Allow squash merging only
```

Benefits:
- Cleaner git history
- Easier to revert
- Better for changelogs

### 3. **Monitor Check Duration**

If checks take >15 minutes:
- Review what's running
- Consider caching strategies  
- Split into parallel jobs
- Run heavy tests only on specific paths

### 4. **Document Bypass Process**

For emergencies, admins can bypass protection:
1. Temporarily disable branch protection
2. Merge the fix
3. Re-enable protection
4. Document in incident log

---

## 📚 Additional Resources

- **Detailed Guide**: `.github/BRANCH-PROTECTION-SETUP.md`
- **Workflow File**: `.github/workflows/pr-checks.yml`
- **GitHub Docs**: [About Protected Branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)

---

## ✨ Summary

| Before | After |
|--------|-------|
| ❌ Tests run after merge | ✅ Tests run before merge |
| ❌ Broken code can reach main | ✅ Only working code reaches main |
| ❌ Manual review only gate | ✅ Automated + manual gates |
| ❌ Hope nothing breaks | ✅ Confidence in every merge |

**Next Step**: Go to GitHub Settings → Branches → Add Rule

**Time to Setup**: 5 minutes  
**Time Saved**: Countless debugging hours

