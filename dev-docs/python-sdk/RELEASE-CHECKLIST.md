# Release Checklist: Python SDK v0.9.0

## ✅ Pre-Release Verification

### Tests
- [x] All 579 tests passing in LOCAL mode
- [x] All 579 tests passing in MANAGED mode  
- [x] Zero warnings or errors
- [x] Code coverage >70%

### Package Quality
- [x] Version updated to 0.9.0 (matches TypeScript SDK)
- [x] CHANGELOG.md updated with release notes
- [x] README.md reflects all features
- [x] All documentation updated
- [x] No broken links in docs
- [x] License file included (Apache 2.0)

### Build Verification
- [x] Package builds successfully (`python -m build`)
- [x] Twine check passes (`twine check dist/*`)
- [x] Wheel file created (`.whl`)
- [x] Source distribution created (`.tar.gz`)
- [x] Package size reasonable (<100KB compressed)

## 📋 PyPI Setup (One-Time)

### Step 1: PyPI Organization
- [ ] Log in to https://pypi.org
- [ ] Create organization: `cortexmemory`
- [ ] Organization approved

### Step 2: Trusted Publisher Configuration
Navigate to: https://pypi.org/manage/account/publishing/

Fill in:
- **PyPI Project Name:** `cortex-memory`
- **Owner:** `SaintNick1214`
- **Repository:** `Project-Cortex`
- **Workflow:** `publish-python.yml`  
- **Environment:** `pypi`

### Step 3: GitHub Environment
1. Go to: https://github.com/SaintNick1214/Project-Cortex/settings/environments
2. Click "New environment"
3. Name: `pypi`
4. (Optional) Add protection rules:
   - Required reviewers
   - Deployment branches: only `main`

## 🚀 Release Process

### Option A: Automatic Release (Recommended)

```bash
# 1. Ensure you're on main branch
git checkout main
git pull origin main

# 2. Version already updated to 0.9.0 ✅

# 3. Commit any final changes
git add .
git commit -m "chore: prepare Python SDK v0.9.0 release"
git push origin main

# 4. Create and push tag
git tag py-v0.9.0 -m "Python SDK v0.9.0 - Feature parity with TypeScript SDK"
git push origin py-v0.9.0

# 5. Monitor GitHub Actions
# https://github.com/SaintNick1214/Project-Cortex/actions

# 6. Wait for pipeline to complete (~5 minutes)
```

### Option B: Manual Release (Fallback)

```bash
cd cortex-sdk-python

# Build
python -m build

# Check
twine check dist/*

# Upload to Test PyPI first (recommended)
twine upload --repository testpypi dist/*

# Test installation
pip install --index-url https://test.pypi.org/simple/ cortex-memory==0.9.0

# If successful, upload to real PyPI
twine upload dist/*
```

## ✅ Post-Release Verification

### Immediate Checks (2-3 minutes after release)

```bash
# 1. Verify on PyPI
open https://pypi.org/project/cortex-memory/

# 2. Check version appears
curl https://pypi.org/pypi/cortex-memory/json | grep version

# 3. Test fresh installation
python3 -m venv test-env
source test-env/bin/activate
pip install cortex-memory==0.9.0

# 4. Verify import
python -c "from cortex import Cortex; print('✅ Import successful')"
python -c "from cortex import __version__; print(f'Version: {__version__}')"

# 5. Test basic functionality
python -c "
from cortex import Cortex, CortexConfig
cortex = Cortex(CortexConfig(convex_url='http://localhost:3210'))
print('✅ Cortex client initialized')
"
```

### Documentation Updates

- [ ] Update main README.md with PyPI badge
- [ ] Update Documentation/ to reference v0.9.0
- [ ] Create GitHub release with notes
- [ ] Update CHANGELOG.md with release date
- [ ] Tweet/announce the release

### Community Announcements

- [ ] GitHub Discussions post
- [ ] Update project website
- [ ] Share on social media
- [ ] Update any integration examples

## 📊 Release Metrics

Track these after release:

- PyPI downloads per day/week/month
- GitHub stars/forks
- Issues opened
- Community feedback

## 🔄 Version Synchronization

| Component | Version | Status |
|-----------|---------|--------|
| TypeScript SDK | 0.9.0 | ✅ Published |
| Python SDK | 0.9.0 | 🚀 Ready to publish |
| Documentation | 0.9.0 | ✅ Updated |

## 🐛 Rollback Plan

If critical issues are discovered:

```bash
# 1. Fix the issue locally
# 2. Bump to 0.9.1
# 3. Release patch version

# Note: Cannot delete PyPI releases
# Must release forward with fixes
```

## 📞 Support Channels

- Issues: https://github.com/SaintNick1214/Project-Cortex/issues
- Discussions: https://github.com/SaintNick1214/Project-Cortex/discussions
- Email: support@cortexmemory.dev

---

**Ready to release!** 🎉

All prerequisites met. Pipeline configured. Tests passing. Package builds successfully.

