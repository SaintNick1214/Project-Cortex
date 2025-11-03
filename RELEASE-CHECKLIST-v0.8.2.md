# Release Checklist: v0.8.2 + create-cortex-memories v0.1.1

## Pre-Release Verification

### SDK (@cortexmemory/sdk@0.8.2)
- [x] Version bumped to 0.8.2
- [x] CHANGELOG updated
- [x] README updated with Quick Start
- [x] convex-dev/ included in files array
- [x] Build successful (npm run build)
- [x] Lint passing (0 errors, 144 acceptable warnings)
- [x] New tests added (memory-auto-conversation.test.ts - 5 tests)
- [x] Auto-conversation creation implemented and tested
- [x] Security: Removed shell: true from dev-runner.mjs

### Wizard (create-cortex-memories@0.1.1)
- [x] Version bumped to 0.1.1
- [x] CHANGELOG.md created
- [x] Template bugs fixed (memory.importance, conversations.get)
- [x] Docker Compose v2 compatible (removed version field)
- [x] Auto-start graph database in dev-runner
- [x] Docker daemon detection
- [x] Clean exit handling (no code 254)
- [x] ESLint configured and passing (0 errors)
- [x] Build successful (npm run build)
- [x] Smoke tests passing (8/8)
- [x] prepublishOnly hooks configured

### Documentation
- [x] Installation Guide created
- [x] Five-Minute Quickstart created
- [x] Configuration Guide created
- [x] Main README updated
- [x] Wizard README clear
- [x] CHANGELOG comprehensive

### GitHub Workflow
- [x] publish.yml updated for dual packages
- [x] Version detection for both packages
- [x] Publishing order correct (SDK first, then wizard)
- [x] WORKFLOWS-README.md updated

## Release Command

```bash
git add .
git commit -m "chore: release v0.8.2 with create-cortex-memories v0.1.1"
git push origin main
```

## What Gets Published

**@cortexmemory/sdk@0.8.2:**
- Auto-conversation creation in `memory.remember()`
- Includes convex-dev/ backend functions
- 5 new tests for auto-creation
- Security fixes in dev-runner

**create-cortex-memories@0.1.1:**
- Interactive project setup wizard
- Fixed template code bugs
- Auto-start graph database
- Docker daemon detection
- Clean exit handling
- ESLint + smoke tests in prepublish

## Post-Release Verification

After GitHub Actions completes:

```bash
# Wait ~5 minutes for npm registry

# Verify SDK
npm view @cortexmemory/sdk version
# Should show: 0.8.2

# Verify wizard
npm view create-cortex-memories version
# Should show: 0.1.1

# Test the published wizard
cd /tmp
npm create cortex-memories test-release-verification
cd test-release-verification
npm run dev
# Verify everything works
```

## Announcement

After successful publish:

**Twitter/X:**
```
🎉 Cortex v0.8.2 + create-cortex-memories v0.1.1 released!

✨ SDK: memory.remember() now auto-creates conversations
🚀 Wizard: Auto-start graph DB, better Docker detection

Get started in < 5 minutes:
npm create cortex-memories

#AI #OpenSource #ConvexDev
```

**GitHub Release:**
- Tag: v0.8.2
- Title: v0.8.2 - Interactive Setup Wizard + Auto-Conversation
- Notes: Copy from CHANGELOG.md

## Success Criteria

- [x] Both packages build successfully
- [x] All tests pass
- [x] 0 lint errors
- [x] Documentation complete
- [x] GitHub workflow configured
- [ ] Manual wizard test successful
- [ ] Published to npm
- [ ] GitHub release created
- [ ] Community announced

---

**Status: READY FOR RELEASE** 🚀

All code complete, tested, and verified. Just needs:
1. Final manual wizard test
2. Push to main
3. Verify GitHub Actions succeeds

