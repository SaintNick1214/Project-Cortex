# Publishing Guide: v0.8.1

## Pre-Flight Checklist

Before publishing, verify:

- [x] All code implemented and tested
- [x] Version bumped to 0.8.1 in package.json
- [x] CHANGELOG updated with v0.8.1 entry
- [x] README updated with Quick Start section
- [x] Smoke tests passing
- [ ] Manual end-to-end test completed
- [ ] Logged into npm (`npm whoami`)
- [ ] Clean git status (or committed changes)

## Step-by-Step Publishing

### Step 1: Build and Test SDK

```bash
cd /Users/SaintNick/Documents/Cortex/Project-Cortex

# Clean and rebuild
npm run clean
npm run build

# Run tests
npm test

# Verify convex-dev is included in build
npm pack --dry-run
# Should list: convex-dev/ folder and all its files

# Optional: Inspect the tarball
npm pack
tar -tzf cortexmemory-sdk-0.8.1.tgz | grep convex-dev
rm cortexmemory-sdk-0.8.1.tgz
```

### Step 2: Build create-cortex-memories

```bash
cd packages/create-cortex-memories

# Install dependencies if needed
npm install

# Build
npm run build

# Verify build
./test-smoke.sh

# Verify package contents
npm pack --dry-run
# Should include: dist/, templates/

# Optional: Test locally before publishing
npm link
cd /tmp
npm create cortex-memories@latest test-verify
cd test-verify
npm run dev
# Ctrl+C when Convex starts successfully
cd ..
rm -rf test-verify
```

### Step 3: Publish SDK First

**IMPORTANT:** Publish SDK before create-cortex-memories!

```bash
cd /Users/SaintNick/Documents/Cortex/Project-Cortex

# Login to npm if needed
npm whoami
# If not logged in: npm login

# Publish (use --dry-run first to check)
npm publish --dry-run

# If dry-run looks good, publish for real
npm publish

# Verify it's published
npm view @cortexmemory/sdk version
# Should show: 0.8.1

# Verify convex-dev is included
npm pack @cortexmemory/sdk@0.8.1
tar -tzf cortexmemory-sdk-0.8.1.tgz | grep convex-dev
rm cortexmemory-sdk-0.8.1.tgz
```

### Step 4: Publish create-cortex-memories

```bash
cd packages/create-cortex-memories

# Publish (use --dry-run first)
npm publish --dry-run

# If dry-run looks good, publish
npm publish

# Verify it's published
npm view create-cortex-memories version
# Should show: 0.1.0
```

### Step 5: Test Published Packages

**Critical:** Test that everything works from npm:

```bash
# Clean test directory
rm -rf /tmp/cortex-final-test
mkdir /tmp/cortex-final-test
cd /tmp/cortex-final-test

# Test the published wizard
npm create cortex-memories@latest my-test-app

# Follow the wizard:
# - Choose "Local development" for fastest test
# - Skip graph database

# Verify the setup
cd my-test-app
ls -la
# Should see: src/, convex/, package.json, .env.local, README.md

# Verify convex-dev files were copied
ls convex/
# Should see: schema.ts, conversations.ts, memories.ts, etc.

# Verify dependencies installed
ls node_modules/@cortexmemory/sdk
# Should exist

# Start Convex (test that everything works)
npm run dev
# Wait for "✅ Convex LOCAL server initialized"
# Then Ctrl+C

# Clean up
cd /tmp
rm -rf cortex-final-test
```

## Post-Publishing Tasks

### 1. Tag the Release in Git

```bash
cd /Users/SaintNick/Documents/Cortex/Project-Cortex

# Commit all changes if not already
git add .
git commit -m "Release v0.8.1: Create Cortex Memories wizard"

# Create and push tag
git tag -a v0.8.1 -m "v0.8.1: Interactive setup wizard and improved onboarding"
git push origin main
git push origin v0.8.1
```

### 2. Create GitHub Release

Go to: https://github.com/SaintNick1214/Project-Cortex/releases/new

**Tag:** v0.8.1  
**Title:** v0.8.1 - Create Cortex Memories 🎉

**Description:**
```markdown
# v0.8.1 - Interactive Setup Wizard

## 🎉 Major Onboarding Improvement

Introducing `npm create cortex-memories` - get started with Cortex in under 5 minutes!

### ✨ What's New

- **Interactive Setup Wizard** - Guides you through complete project setup
- **Three Convex Modes** - Local, new cloud, or existing database
- **Optional Graph Database** - Neo4j/Memgraph integration
- **Automatic Configuration** - Zero manual setup required
- **Improved Package** - SDK now includes convex-dev backend functions

### 🚀 Quick Start

```bash
npm create cortex-memories@latest my-ai-agent
cd my-ai-agent
npm run dev
npm start
```

### 📦 What's Included

- @cortexmemory/sdk@0.8.1 - Now includes Convex backend functions
- create-cortex-memories@0.1.0 - NEW! Interactive setup wizard

### 📚 Documentation

- [Quick Start Guide](https://github.com/SaintNick1214/Project-Cortex#-quick-start)
- [Full Changelog](https://github.com/SaintNick1214/Project-Cortex/blob/main/CHANGELOG.md)
- [Implementation Summary](https://github.com/SaintNick1214/Project-Cortex/blob/main/IMPLEMENTATION-SUMMARY-v0.8.1.md)

### ⏱️ Time Saved

**Before:** 30-60 minutes of manual setup  
**After:** < 5 minutes with interactive wizard

Perfect for new users, workshops, and rapid prototyping!
```

### 3. Update Website (if applicable)

Update cortexmemory.dev with:
- New Quick Start instructions
- Link to `npm create cortex-memories`
- Updated version badges

### 4. Announce Release

**Twitter/X:**
```
🎉 Cortex v0.8.1 is here!

Now you can set up AI agents with persistent memory in under 5 minutes:

npm create cortex-memories@latest my-agent

✨ Interactive wizard
🗄️ Automatic Convex setup  
🕸️ Optional graph database
🚀 Ready-to-run example

Try it: https://github.com/SaintNick1214/Project-Cortex

#AI #OpenSource #ConvexDev
```

**Discord/Community:**
```
🎉 **Cortex v0.8.1 Released!**

We've dramatically improved the getting started experience with a new interactive setup wizard.

**Try it now:**
\`\`\`bash
npm create cortex-memories@latest my-agent
\`\`\`

**What you get:**
- Complete project setup in < 5 minutes
- Interactive wizard for configuration
- Three Convex setup modes (local/cloud/existing)
- Optional graph database integration
- Working example code

**Before:** 30-60 minutes of manual setup
**After:** One command, guided setup, ready to code

Check it out: https://github.com/SaintNick1214/Project-Cortex
Feedback welcome!
```

### 5. Monitor for Issues

After publishing, watch for:
- GitHub issues
- npm download stats
- User feedback on Discord
- Bug reports

Quick response checklist:
- [ ] Monitor GitHub issues for 24 hours
- [ ] Check npm stats after 1 week
- [ ] Collect user feedback
- [ ] Note any common issues for v0.8.2

## Rollback Plan (If Needed)

If critical issues are discovered:

```bash
# Unpublish a version (within 72 hours)
npm unpublish @cortexmemory/sdk@0.8.1
npm unpublish create-cortex-memories@0.1.0

# Or deprecate (after 72 hours)
npm deprecate @cortexmemory/sdk@0.8.1 "Critical bug, use 0.8.0 instead"
npm deprecate create-cortex-memories@0.1.0 "Use later version"

# Then fix and republish as 0.8.2
```

## Success Criteria

Release is successful when:
- [x] Both packages published to npm
- [ ] `npm create cortex-memories` works end-to-end
- [ ] Generated projects run successfully
- [ ] No critical bugs reported within 24 hours
- [ ] Positive community feedback
- [ ] Documentation is clear and helpful

## Notes

- SDK must be published BEFORE create-cortex-memories (dependency)
- Test thoroughly in isolated directory before announcing
- Keep this guide for future releases
- Update for v0.9.0 with lessons learned

---

**Good luck with the release! 🚀**

