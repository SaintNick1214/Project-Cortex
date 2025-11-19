# CI/CD Workflows

## Overview

This repository uses GitHub Actions for automated testing and publishing.

## Workflows

### 1. PR Checks (`pr-checks.yml`)
**Trigger:** Pull requests to `main` or `dev`

Validates code before merge:
- Code quality (lint, type check)
- TypeScript SDK tests (if version changed)
- Python SDK tests (if version changed)  
- Security scan (Trivy)

**Blocks merge if any check fails.**

### 2. Publish (`publish.yml`)
**Trigger:** Push to `main` branch

Automatically publishes SDKs when versions change:
- TypeScript SDK → npm (`@cortexmemory/sdk`)
- Python SDK → PyPI (`cortex-memory`)
- Create Cortex Memories wizard → npm

### 3. Documentation (`jekyll-gh-pages.yml`)
**Trigger:** Push to `main` branch

Deploys documentation site to GitHub Pages.

## Release Process

### Bump version → Create PR → Merge = Auto-publish ✅

**TypeScript SDK:**
```bash
npm version minor
git add package.json package-lock.json
git commit -m "chore: bump version to 0.9.2"
# Create PR, merge to main = auto-publish
```

**Python SDK:**
```bash
# Edit cortex-sdk-python/pyproject.toml version
git add cortex-sdk-python/pyproject.toml  
git commit -m "chore: bump Python SDK to 0.9.2"
# Create PR, merge to main = auto-publish
```

## Required Secrets

Configure in Settings → Secrets:
- `CONVEX_URL` - Convex backend URL
- `CONVEX_DEPLOY_KEY` - Convex deployment key
- `NPM_TOKEN` - npm publishing token

## PyPI Trusted Publishing

Python SDK uses trusted publishing (no token needed). Configure in PyPI project settings:
- Publisher: GitHub
- Repository: `SaintNick1214/Project-Cortex`
- Workflow: `publish.yml`
- Environment: `pypi`

