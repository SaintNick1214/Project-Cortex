# PyPI Release Guide for Cortex Memory Python SDK

## Prerequisites

1. **PyPI Organization Setup** (One-time)
   - Organization created: `cortexmemory` on PyPI
   - Trusted Publisher configured with GitHub Actions

2. **GitHub Environment Setup** (One-time)
   - Create protected environment named `pypi` in GitHub repository settings
   - Navigate to: Settings → Environments → New environment
   - Name it: `pypi`
   - (Optional) Add deployment protection rules

## Release Process

### Method 1: Automatic via Git Tag (Recommended)

```bash
# 1. Update version in pyproject.toml
cd cortex-sdk-python
# Edit version in pyproject.toml to match release (e.g., "0.9.0")

# 2. Commit changes
git add pyproject.toml CHANGELOG.md
git commit -m "chore: bump Python SDK to v0.9.0"

# 3. Create and push tag
git tag py-v0.9.0
git push origin main
git push origin py-v0.9.0

# 4. GitHub Actions automatically:
#    - Runs tests
#    - Builds distribution
#    - Publishes to PyPI
```

### Method 2: Manual Local Publish (Backup)

```bash
cd cortex-sdk-python

# Install build tools
pip install --upgrade build twine

# Build distribution
python -m build

# Check distribution
twine check dist/*

# Upload to PyPI (requires API token)
twine upload dist/*
```

## Trusted Publisher Configuration

When setting up the trusted publisher on PyPI, use these values:

- **PyPI Project Name:** `cortex-memory`
- **Owner:** `SaintNick1214`
- **Repository:** `Project-Cortex`
- **Workflow:** `publish-python.yml`
- **Environment:** `pypi`

## Version Synchronization

Keep Python SDK version in sync with TypeScript SDK:

| TypeScript SDK | Python SDK | Status |
|----------------|------------|--------|
| `@cortexmemory/sdk@0.9.0` | `cortex-memory==0.9.0` | Current |

## Pre-Release Checklist

- [ ] All tests passing (579 tests)
- [ ] Version updated in `pyproject.toml`
- [ ] `CHANGELOG.md` updated
- [ ] `README.md` reflects latest features
- [ ] Documentation updated
- [ ] GitHub release notes prepared

## Post-Release Verification

```bash
# Wait 2-3 minutes after pipeline completes

# Verify on PyPI
open https://pypi.org/project/cortex-memory/

# Test installation
pip install cortex-memory==0.9.0

# Verify import
python -c "from cortex import Cortex; print('✅ Import successful')"
```

## Rollback Process

If a release has issues:

```bash
# 1. Fix the issue
# 2. Bump to patch version (e.g., 0.9.1)
# 3. Release new version

# Note: You cannot delete or replace a PyPI release
# You must release a new version
```

## Common Issues

### "Project name already exists"
- Package name `cortex-memory` is already registered
- You need to be added as maintainer
- Or choose a different name

### "Trusted publisher not configured"
- Complete the PyPI trusted publisher setup first
- Link: https://pypi.org/manage/account/publishing/

### "Environment protection rules"
- If using protected `pypi` environment
- Approve deployment in GitHub Actions tab

## Links

- **PyPI Project:** https://pypi.org/project/cortex-memory/
- **PyPI Organization:** https://pypi.org/org/cortexmemory/
- **GitHub Actions:** https://github.com/SaintNick1214/Project-Cortex/actions
- **Documentation:** https://github.com/SaintNick1214/Project-Cortex/tree/main/Documentation

