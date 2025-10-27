# GitHub Workflows - Cortex SDK

This directory contains automated CI/CD workflows for the Cortex SDK.

---

## 📋 Available Workflows

### publish.yml - Automated npm Publishing

**Trigger**: Automatic when `package.json` version changes on `main` branch

**What it does**:
1. ✅ Detects version changes
2. ✅ Runs all 201 tests
3. ✅ Builds package
4. ✅ Publishes to npm
5. ✅ Creates git tag
6. ✅ Creates GitHub release
7. ✅ Verifies publish

**Required Secrets**:
- `NPM_TOKEN` (required) - npm authentication token
- `CONVEX_URL` (optional) - for running tests in CI

**Setup**: See [SETUP-AUTOMATED-RELEASES.md](./SETUP-AUTOMATED-RELEASES.md)

---

## 🚀 How to Use

### Automated Release (Recommended)

```bash
# 1. Update version
# package.json: "version": "0.5.0"

# 2. Update changelog
# CHANGELOG.md: Add v0.5.0 section

# 3. Commit and push
git add package.json CHANGELOG.md
git commit -m "chore: release v0.5.0"
git push origin main

# 4. GitHub Action publishes automatically!
# Watch: https://github.com/SaintNick1214/Project-Cortex/actions
```

### Manual Release (Alternative)

```bash
# For beta releases or quick hotfixes
npm run release

# Interactive script with manual confirmation
```

---

## 🔐 Security

**Secrets are stored securely**:
- Managed in GitHub repository settings
- Never exposed in logs
- Scoped to specific workflows
- Rotatable anytime

**Provenance enabled**:
- npm packages include signed provenance
- Verifiable build attestation
- Enhanced supply chain security

---

## 📊 Workflow Status

View workflow runs:
- **All workflows**: https://github.com/SaintNick1214/Project-Cortex/actions
- **Publish workflow**: https://github.com/SaintNick1214/Project-Cortex/actions/workflows/publish.yml

**Expected timeline**:
- Version detection: ~5 seconds
- Tests: ~2 minutes
- Build: ~30 seconds
- Publish: ~30 seconds
- Total: ~4 minutes

---

## 🛠️ Troubleshooting

### Workflow doesn't trigger

**Check**:
- Did you push to `main` branch?
- Did `package.json` version actually change?
- Is the commit on `main` (not other branch)?

### Tests fail in CI

**Check**:
- Do tests pass locally? (`npm test`)
- Is `CONVEX_URL` secret configured?
- Is Convex deployment accessible?

### Publish fails

**Check**:
- Is `NPM_TOKEN` secret configured correctly?
- Is the token still valid? (npm tokens can expire)
- Does the package name already exist at this version?

### Git tag fails

**Check**:
- Does tag already exist? (`git tag -l`)
- Are there git permission issues?

---

## 📝 Workflow Files

| File | Purpose | Trigger |
|------|---------|---------|
| `publish.yml` | Automated npm publish | Version change on main |

**Future workflows** (planned):
- `test.yml` - Run tests on all PRs
- `lint.yml` - Code quality checks
- `docs.yml` - Deploy documentation
- `security.yml` - Security scanning

---

## 🎯 Best Practices

### Version Bumping

```bash
# Major release (breaking changes)
"0.4.0" → "1.0.0"

# Minor release (new features)
"0.4.0" → "0.5.0"

# Patch release (bug fixes)
"0.4.0" → "0.4.1"

# Beta/alpha
"0.5.0-beta.1" → "0.5.0-beta.2"
```

### Commit Messages

```bash
# Triggers automated release
git commit -m "chore: release v0.5.0"

# Describes what's in the release
git commit -m "feat: Layer 3 Memory API complete (v0.5.0)"

# Clear and consistent
git commit -m "chore: bump version to 0.5.0"
```

### Testing Before Release

```bash
# Always test locally first
npm test

# Run interactive tests
npm run test:interactive

# Check build
npm run build

# Verify package contents
npm pack --dry-run
```

---

## 🔗 Related Documentation

- **[RELEASE-GUIDE.md](../RELEASE-GUIDE.md)** - Complete release workflow guide
- **[SETUP-AUTOMATED-RELEASES.md](./SETUP-AUTOMATED-RELEASES.md)** - One-time setup instructions
- **[../scripts/release.ps1](../scripts/release.ps1)** - Manual release script
- **[../CHANGELOG.md](../CHANGELOG.md)** - Version history

---

## ✅ Quick Start

**First time setup**:

1. Create npm token: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Add to GitHub: https://github.com/SaintNick1214/Project-Cortex/settings/secrets/actions
3. Push version bump to `main`
4. Watch it publish automatically!

**Every release after**:

1. Bump version in `package.json`
2. Update `CHANGELOG.md`
3. Push to `main`
4. Done! ✨

---

**Questions?** See [SETUP-AUTOMATED-RELEASES.md](./SETUP-AUTOMATED-RELEASES.md) or ask in [Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions).

