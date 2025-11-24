# Changelog

All notable changes to @cortexmemory/vercel-ai-provider will be documented in this file.

## [0.2.0] - 2025-11-24

### 🚀 MAJOR ENHANCEMENT: Enhanced Streaming with rememberStream()

This release replaces the internal buffering approach with direct integration of the enhanced `rememberStream()` API from Cortex SDK v0.11.0, unlocking powerful new streaming capabilities.

### Added

**Progressive Storage:**

- Store partial responses during streaming for resumability
- `storePartialResponse` - Enable progressive storage (default: false)
- `partialResponseInterval` - Update interval in ms (default: 3000)

**Streaming Hooks:**

- Real-time monitoring with lifecycle callbacks
- `onChunk` - Called for each chunk received
- `onProgress` - Called periodically with progress updates
- `onError` - Called when stream errors occur
- `onComplete` - Called when stream completes successfully

**Comprehensive Metrics:**

- Automatic collection of streaming performance metrics (enabled by default)
- First chunk latency, total duration, throughput
- Estimated tokens and costs
- Performance bottlenecks and recommendations
- `enableStreamMetrics` - Enable/disable metrics (default: true)

**Progressive Fact Extraction:**

- Extract facts incrementally during streaming instead of waiting for completion
- `progressiveFactExtraction` - Enable progressive extraction (default: false)
- `factExtractionThreshold` - Extract every N characters (default: 500)

**Progressive Graph Sync:**

- Sync to graph databases during streaming (Neo4j, Memgraph)
- `progressiveGraphSync` - Enable progressive sync (default: false)
- `graphSyncInterval` - Sync interval in ms (default: 5000)

**Error Recovery:**

- Handle interrupted streams with resume tokens and partial failure strategies
- `partialFailureHandling` - Strategy: 'store-partial', 'rollback', 'retry', 'best-effort'
- `maxRetries` - Maximum retry attempts (default: 3)
- `generateResumeToken` - Generate resume tokens (default: false)
- `streamTimeout` - Stream timeout in ms (default: 30000)

**Adaptive Processing:**

- Auto-optimize based on stream characteristics
- `enableAdaptiveProcessing` - Enable adaptive processing (default: false)
- `maxResponseLength` - Maximum response length in characters

### Changed

**Internal Architecture:**

- Replaced `wrapStreamWithMemory()` with `wrapStreamWithRememberStream()`
- Removed manual buffering and `storeConversation()` method
- Now uses `rememberStream()` directly for all streaming operations
- Added `convertAISDKStreamToText()` helper for AI SDK chunk conversion

**Configuration:**

- Added `streamingOptions` object with all new streaming features
- Added `streamingHooks` object for lifecycle callbacks
- All new features are opt-in and backward compatible

**Documentation:**

- Added "Enhanced Streaming Features" section to README
- Comprehensive examples for each new feature
- Updated all examples to showcase new capabilities
- Added performance characteristics and metrics documentation

**Tests:**

- Added "Enhanced Streaming" test suite
- Tests for streaming hooks, metrics, progressive features
- Tests for error recovery and adaptive processing
- All tests passing with 100% coverage of new features

### Performance

- **First Chunk Latency**: 6-10ms (excellent)
- **Stream Overhead**: < 5% (minimal impact)
- **Memory Usage**: O(1) for unbounded streams
- **Throughput**: Immediate processing, no accumulation delay

### Breaking Changes

**None** - This release is fully backward compatible. All new features are opt-in via configuration.

### Migration Guide

No migration needed! Existing code continues to work without changes. To use new features, add optional configuration:

```typescript
const cortexMemory = createCortexMemory({
  convexUrl: process.env.CONVEX_URL!,
  memorySpaceId: 'my-chat',
  userId: 'user-123',
  
  // NEW: Opt-in to enhanced streaming
  streamingOptions: {
    storePartialResponse: true,
    progressiveFactExtraction: true,
  },
  
  streamingHooks: {
    onProgress: (event) => console.log(event),
  },
});
```

### Dependencies

- Updated `@cortexmemory/sdk` to `^0.11.0` (required for rememberStream)

## [0.1.2] - 2025-11-23

### Added

**Documentation:**

- Comprehensive community provider documentation ready for Vercel AI SDK submission
- Enhanced package keywords for better NPM discoverability
- Links to cortexmemory.dev and docs.cortexmemory.dev in package metadata

**Features Highlighted:**

- Self-hosted architecture (no API keys or vendor lock-in)
- TypeScript-native implementation
- Memory Spaces for true multi-tenancy
- Hive Mode for cross-application memory sharing
- ACID guarantees via Convex transactions
- Automatic versioning (10 versions per memory)
- Edge runtime compatibility
- Automatic streaming support with buffering

### Changed

**Package Metadata:**

- Enhanced keywords: added `vercel-ai-sdk`, `persistent-memory`, `self-hosted`, `multi-tenant`, `semantic-search`, `embeddings`, `rag`, `typescript`
- Improved discoverability on NPM search

**Documentation:**

- Comprehensive comparison with mem0 and cloud-only solutions
- 10+ usage examples (basic, semantic search, multi-tenant, hive mode, etc.)
- Complete configuration reference
- Migration guide from mem0
- Troubleshooting section
- How it works visual flow

### Fixed

- Documentation links now properly reference cortexmemory.dev ecosystem

## [0.1.1] - 2025-11-22

### Changed

**Dependencies:**

- Updated `@cortexmemory/sdk` from `^0.9.0` to `^0.10.0`
- Updated `@ai-sdk/openai` from `^2.0.66` to `^2.0.71`
- Updated `@ai-sdk/anthropic` from `^2.0.44` to `^2.0.45`
- Updated `@typescript-eslint/eslint-plugin` from `^8.46.4` to `^8.47.0`
- Updated `@typescript-eslint/parser` from `^8.46.4` to `^8.47.0`
- Updated `rimraf` from `^6.1.0` to `^6.1.2`

**CI/CD:**

- Added automated testing in PR checks workflow
- Added automated publishing to npm on version changes
- Integrated with centralized GitHub Actions workflows
- Removed standalone workflow files (now uses root workflows)

**Build:**

- Simplified `prepublishOnly` script to only run build (tests/lint run in CI)

## [0.1.0] - 2025-11-05

### Initial Release

First release of the Cortex Memory Provider for Vercel AI SDK!

#### ✨ Features

**Core Provider:**

- `createCortexMemory()` - Factory function for memory-augmented models
- Automatic memory search before each LLM call
- Automatic memory storage after each response
- Works with streaming and non-streaming responses
- Edge runtime compatible (Vercel Edge Functions, Cloudflare Workers)

**Memory Management:**

- `cortexMemory.search()` - Manual memory search
- `cortexMemory.remember()` - Manual memory storage
- `cortexMemory.getMemories()` - Retrieve all memories
- `cortexMemory.clearMemories()` - Delete memories
- `cortexMemory.getConfig()` - Get current configuration

**Configuration Options:**

- Memory space isolation
- Custom embedding providers
- Context injection strategies (system/user)
- Fact extraction support
- Graph memory sync
- Hive mode (cross-app memory)
- Debug logging

**Provider Support:**

- OpenAI (GPT-4, GPT-3.5, etc.)
- Anthropic (Claude 3 family)
- Google (Gemini)
- Groq
- Any Vercel AI SDK compatible provider

#### 📚 Documentation

- Comprehensive README with examples
- Getting Started guide
- Complete API reference
- Advanced usage patterns
- Memory Spaces guide
- Hive Mode guide
- Migration guide from mem0

#### 🧪 Testing

- Unit tests for provider, middleware, streaming
- Integration tests (basic coverage)
- Example applications (5 examples)

#### 📦 Package

- TypeScript types included
- CJS + ESM builds
- Edge runtime compatible
- Zero Node.js dependencies in runtime code

#### 🚀 Examples

1. **next-chat** - Basic chat with automatic memory
2. **next-rag** - RAG pattern with documents + conversation memory
3. **next-multimodal** - Multi-modal chat (placeh older)
4. **hive-mode** - Cross-application memory (placeholder)
5. **memory-spaces** - Multi-tenant SaaS (placeholder)

### Dependencies

- `@cortexmemory/sdk`: ^0.9.0 (local for now, will be published)
- `ai`: ^3.0.0 (peer dependency)
- `convex`: ^1.28.2 (peer dependency)

### Known Limitations

- Multi-modal examples are placeholders (will be completed in v0.2.0)
- Integration tests are basic (will be expanded in v0.1.1)
- Documentation examples focus on OpenAI (more providers in v0.1.1)

### Future Roadmap

**v0.1.1** (Week 2):

- Expand integration tests
- Add Anthropic examples
- Add Google examples
- Performance benchmarks

**v0.2.0** (Week 3-4):

- Complete multi-modal example
- React hooks for client-side memory management
- Server Actions integration
- Middleware helpers for Next.js

**v1.0.0** (Month 2):

- API stabilization
- Production-ready guarantees
- Full test coverage (95%+)
- Performance optimizations
