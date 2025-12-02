# Troubleshooting

Common issues and solutions.

## Installation Issues

### "Cannot find module '@cortexmemory/sdk'"

```bash
npm install @cortexmemory/sdk@^0.9.0
```

### "Peer dependency warnings"

Ensure compatible versions:

```bash
npm install ai@^3.0.0 convex@^1.28.2
```

## Runtime Issues

### "Failed to connect to Convex"

1. Check `CONVEX_URL` is set correctly
2. Ensure Convex is running: `npx convex dev`
3. Verify Cortex backend is deployed

### "Memory search returns empty"

Common causes:

- No prior conversations (expected for first use)
- Using local Convex (no vector search support)
- Embeddings not configured (uses keyword search)

Solution: Use cloud Convex + embeddings for best results.

### "Type errors with LanguageModelV1"

Update to latest versions:

```bash
npm update ai @cortexmemory/vercel-ai-provider
```

## Edge Runtime Issues

### "process is not defined"

You're using Node.js APIs in edge runtime. Cortex is edge-compatible, but check your own code.

### "Cannot use fs module"

Edge runtimes don't have `fs`. Use web-standard APIs only.

## Performance Issues

### "Slow responses"

Causes:

- Too many memories searched (`memorySearchLimit`)
- Slow embedding generation
- Network latency to Convex

Solutions:

- Reduce `memorySearchLimit` to 3-5
- Cache embeddings
- Use Convex regions close to your users

## Support

- [GitHub Issues](https://github.com/SaintNick1214/Project-Cortex/issues)
- [Getting Started Guide](./getting-started.md)
