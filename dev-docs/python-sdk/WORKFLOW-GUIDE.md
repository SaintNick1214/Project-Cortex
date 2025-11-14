# Development & Release Workflow

## Your Workflow Pattern

```
dev branch (daily work)
   ↓
   ↓ many commits
   ↓
   PR to main (when ready for release)
   ↓
   merge to main
   ↓
   create tag (triggers publish)
   ↓
   automatic release
```

## Development Workflow

### Daily Work on `dev` Branch

```bash
# Work on dev branch
git checkout dev

# Make changes
git add .
git commit -m "feat: add new feature"
git push origin dev

# Repeat as needed...
# Tests run on dev via test workflow
# No publishing happens
```

### Release Process (Python SDK)

When ready to release:

```bash
# 1. Ensure dev branch is ready
git checkout dev
make test  # Run full test suite (LOCAL + MANAGED)

# 2. Update version in pyproject.toml (if not already done)
# version = "0.9.0"

# 3. Update CHANGELOG.md with release notes

# 4. Create PR from dev → main
git push origin dev
# Create PR on GitHub: dev → main

# 5. Review and merge PR to main
# (via GitHub web interface)

# 6. After merge, checkout main and create tag
git checkout main
git pull origin main

# 7. Create and push tag (this triggers publish!)
git tag py-v0.9.0 -m "Python SDK v0.9.0 release"
git push origin py-v0.9.0

# 8. Monitor GitHub Actions
# https://github.com/SaintNick1214/Project-Cortex/actions
```

## What Triggers What

| Action | Triggers | Publishes |
|--------|----------|-----------|
| Push to `dev` | Test workflow | No |
| Push to `main` | Test workflow | No |
| Tag `py-v*` on `main` | Publish workflow | ✅ YES |
| Tag `v*` on `main` | npm publish | ✅ YES (TypeScript SDK) |

## Secrets Required

**Current GitHub Secrets (no changes needed):**
- ✅ `CONVEX_URL` - Used for tests
- ✅ `NPM_TOKEN` - Used for TypeScript SDK publishing
- ❌ **No PyPI token needed** - Trusted publishing uses OIDC

## Workflows Configured

### Python SDK

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test-python.yml` | Push to `main`/`dev` (Python files changed) | Run tests |
| `publish-python.yml` | Tag `py-v*` | Publish to PyPI |

### TypeScript SDK (Existing)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `test.yml` | Push to any branch | Run tests |
| `publish.yml` | Push to `main` (version changed) | Publish to npm |

## Tag Naming Convention

| SDK | Tag Pattern | Example |
|-----|-------------|---------|
| **TypeScript SDK** | `v*` | `v0.9.0` |
| **Python SDK** | `py-v*` | `py-v0.9.0` |
| **Wizard** | `wizard-v*` | `wizard-v0.1.5` |

This prevents conflicts when releasing different packages.

## Best Practices

### Before Tagging

- ✅ Merge dev → main via PR
- ✅ All tests passing
- ✅ Version updated in pyproject.toml
- ✅ CHANGELOG.md updated
- ✅ Documentation updated

### Creating Tags

```bash
# Always create tags FROM main branch
git checkout main
git pull origin main

# Create annotated tag with message
git tag py-v0.9.0 -m "Python SDK v0.9.0 - Feature parity with TypeScript SDK"

# Push tag (triggers publish workflow)
git push origin py-v0.9.0
```

### If Tag Push Fails or You Need to Redo

```bash
# Delete local tag
git tag -d py-v0.9.0

# Delete remote tag (if already pushed)
git push origin :refs/tags/py-v0.9.0

# Create new tag
git tag py-v0.9.0 -m "Updated message"
git push origin py-v0.9.0
```

## Monitoring Releases

### GitHub Actions Dashboard

https://github.com/SaintNick1214/Project-Cortex/actions

**What to watch for:**
- ✅ Tests passing (579 tests)
- ✅ Build succeeds
- ✅ Upload to PyPI succeeds
- ⏱️ Total time: ~5-10 minutes

### Post-Release Verification

```bash
# Wait 2-3 minutes after workflow completes

# Check PyPI
curl https://pypi.org/pypi/cortex-memory/json | grep "0.9.0"

# Test install
pip install cortex-memory==0.9.0
python -c "from cortex import Cortex; print('Success!')"
```

## Rollback if Needed

```bash
# You cannot delete PyPI releases
# Instead, release a patch version

# 1. Fix the issue
# 2. Update to 0.9.1 in pyproject.toml
# 3. Commit and merge to main
# 4. Tag py-v0.9.1
# 5. Push tag
```

---

## Summary: Your Workflow

```
┌──────────────┐
│  dev branch  │ ← Daily work, many commits
└──────┬───────┘
       │
       ↓ (when ready)
┌──────────────┐
│   PR → main  │ ← Review and merge
└──────┬───────┘
       │
       ↓ (after merge)
┌──────────────┐
│  main branch │ ← Create tag here
└──────┬───────┘
       │
       ↓ git push origin py-v0.9.0
┌──────────────┐
│   Published  │ ← Automatic via GitHub Actions
└──────────────┘
```

**Key Point:** Only create tags on `main` branch AFTER merging your PR. This ensures releases only happen from stable, reviewed code.

