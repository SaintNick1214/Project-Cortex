# Changelog

All notable changes to @cortexmemory/vercel-ai-provider will be documented in this file.

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
