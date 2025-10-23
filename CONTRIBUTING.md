# Contributing to Cortex

Thank you for your interest in contributing to Cortex! This document provides guidelines and instructions for contributing to the project.

## 🌟 Ways to Contribute

- **Bug Reports**: Found a bug? Open an issue with detailed reproduction steps
- **Feature Requests**: Have an idea? Share it in GitHub Discussions first
- **Code Contributions**: Submit pull requests for bug fixes or new features
- **Documentation**: Improve docs, add examples, fix typos
- **Community Support**: Help others in Discussions and Discord
- **Testing**: Test pre-releases and provide feedback

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- TypeScript 5.0+
- A Convex account (free tier works great)
- Git
- Familiarity with AI/LLM concepts

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/SaintNick1214/cortex.git
   cd cortex
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Convex**
   ```bash
   npx convex dev
   ```
   
   This creates a local dev deployment. Follow the prompts to authenticate.

4. **Configure Environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Convex URL
   ```

5. **Run Tests**
   ```bash
   npm test
   ```

6. **Build**
   ```bash
   npm run build
   ```

### Project Structure

```
cortex/
├── src/                    # Source code
│   ├── memory/            # Memory operations
│   ├── agents/            # Agent management
│   ├── contexts/          # Context chains
│   ├── users/             # User profiles
│   ├── analytics/         # Access analytics
│   └── types/             # TypeScript types
├── convex/                # Convex backend functions
│   ├── memories.ts        # Memory CRUD operations
│   ├── search.ts          # Vector search logic
│   ├── contexts.ts        # Context chain operations
│   └── schema.ts          # Convex schema definitions
├── tests/                 # Test files
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/              # End-to-end tests
├── docs/                  # Documentation
├── examples/              # Example applications
└── scripts/               # Build and utility scripts
```

## 📝 Code Standards

### TypeScript Guidelines

- **Strict Mode**: All code must pass `strict: true` type checking
- **Explicit Types**: Use explicit return types for public functions
- **No `any`**: Avoid `any` type; use `unknown` if needed
- **Interfaces over Types**: Prefer interfaces for object shapes
- **ESM**: Use ES modules (`import`/`export`)

```typescript
// Good
export interface MemoryEntry {
  id: string;
  agentId: string;
  content: string;
  embedding: number[];
  metadata: MemoryMetadata;
  createdAt: Date;
}

export async function storeMemory(
  agentId: string,
  entry: Omit<MemoryEntry, 'id' | 'createdAt'>
): Promise<MemoryEntry> {
  // Implementation
}

// Bad
export function storeMemory(agentId: any, entry: any): any {
  // Implementation
}
```

### Code Style

- **Formatting**: Use Prettier (run `npm run format`)
- **Linting**: Use ESLint (run `npm run lint`)
- **Naming**:
  - `camelCase` for variables and functions
  - `PascalCase` for classes and interfaces
  - `UPPER_SNAKE_CASE` for constants
  - Descriptive names over abbreviations

### Error Handling

```typescript
// Use custom error classes
export class CortexError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CortexError';
  }
}

// Always provide context
throw new CortexError(
  'Failed to store memory',
  'MEMORY_STORE_FAILED',
  { agentId, memoryId }
);
```

### Testing

- **Coverage**: Aim for 80%+ code coverage
- **Unit Tests**: Test individual functions in isolation
- **Integration Tests**: Test Convex function calls
- **E2E Tests**: Test complete user workflows
- **Test Files**: Co-locate with source (`*.test.ts`)

```typescript
// Example test
describe('memory.store', () => {
  it('should store a memory with embedding', async () => {
    const cortex = new Cortex({ convexUrl: testConvexUrl });
    
    const memory = await cortex.memory.store('agent-1', {
      content: 'Test memory',
      embedding: [0.1, 0.2, 0.3],
      metadata: { importance: 'medium' }
    });
    
    expect(memory.id).toBeDefined();
    expect(memory.agentId).toBe('agent-1');
    expect(memory.content).toBe('Test memory');
  });
});
```

## 🔄 Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

Branch naming:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test improvements

### 2. Make Changes

- Write clear, focused commits
- Follow code standards
- Add tests for new functionality
- Update documentation if needed

### 3. Test Locally

```bash
# Run all tests
npm test

# Run specific test file
npm test -- memory.test.ts

# Run with coverage
npm run test:coverage

# Type check
npm run type-check

# Lint
npm run lint

# Format
npm run format
```

### 4. Commit

Write clear commit messages following [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build process or tooling changes

Examples:
```
feat(memory): add support for custom vector dimensions

fix(search): resolve multi-strategy fallback issue

docs(readme): update quick start example

test(contexts): add tests for context chain traversal
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title and description
- Reference related issues (`Fixes #123`)
- Screenshots/videos if UI changes
- Test results
- Breaking changes noted

## 📋 Pull Request Checklist

Before submitting, ensure:

- [ ] Code follows TypeScript and style guidelines
- [ ] Tests added/updated and passing
- [ ] Documentation updated if needed
- [ ] No linter errors or warnings
- [ ] Commit messages follow Conventional Commits
- [ ] PR description clearly explains changes
- [ ] Related issues referenced
- [ ] Breaking changes documented
- [ ] Examples updated if API changed

## 🧪 Testing Guidelines

### Unit Tests

Test individual functions in isolation:

```typescript
describe('extractTags', () => {
  it('should extract finance tags', () => {
    const tags = extractTags('Budget review meeting');
    expect(tags).toContain('finance');
  });
});
```

### Integration Tests

Test Convex function interactions:

```typescript
describe('memory integration', () => {
  it('should store and retrieve memory', async () => {
    const stored = await storeMemory(ctx, { ... });
    const retrieved = await getMemory(ctx, stored._id);
    expect(retrieved).toMatchObject(stored);
  });
});
```

### E2E Tests

Test complete workflows:

```typescript
describe('chatbot memory workflow', () => {
  it('should remember user preferences across sessions', async () => {
    // Store preference
    await cortex.memory.store('agent-1', { ... });
    
    // New session
    const memories = await cortex.memory.search('agent-1', 'preference');
    
    // Verify retrieval
    expect(memories[0].content).toContain('preference');
  });
});
```

## 📚 Documentation Guidelines

### Code Documentation

- Use JSDoc for public APIs
- Include examples in comments
- Explain "why" not "what"

```typescript
/**
 * Stores a memory for a specific agent with semantic search capabilities.
 * 
 * Memories are automatically indexed for fast retrieval. The embedding
 * parameter enables semantic search - provide a vector from your
 * embedding model of choice (OpenAI, Cohere, local, etc.).
 * 
 * @param agentId - Unique identifier for the agent
 * @param entry - Memory content and metadata
 * @returns The stored memory with generated ID and timestamp
 * 
 * @example
 * ```typescript
 * const memory = await cortex.memory.store('agent-1', {
 *   content: 'User prefers dark mode',
 *   embedding: await openai.embeddings.create({
 *     model: 'text-embedding-3-large',
 *     input: 'User prefers dark mode'
 *   }),
 *   metadata: { importance: 'high', tags: ['preferences'] }
 * });
 * ```
 */
export async function storeMemory(
  agentId: string,
  entry: MemoryEntryInput
): Promise<MemoryEntry> {
  // Implementation
}
```

### Markdown Documentation

- Use clear, descriptive headings
- Include code examples
- Add table of contents for long docs
- Link related documentation
- Include "Last Updated" date

## 🐛 Bug Reports

Good bug reports include:

1. **Clear Title**: Summarize the issue
2. **Description**: What happened vs. what should happen
3. **Reproduction Steps**: Minimal steps to reproduce
4. **Environment**: OS, Node version, Cortex version
5. **Code Sample**: Minimal reproducible example
6. **Error Messages**: Full error output
7. **Screenshots**: If applicable

**Template:**
```markdown
### Description
Brief description of the bug

### Steps to Reproduce
1. Initialize Cortex with...
2. Call memory.store with...
3. See error

### Expected Behavior
What should happen

### Actual Behavior
What actually happens

### Environment
- OS: macOS 14.0
- Node: v20.10.0
- Cortex: v0.1.0
- Convex: v1.8.0

### Code Sample
\`\`\`typescript
// Minimal reproduction
\`\`\`

### Error Output
\`\`\`
Full error stack trace
\`\`\`
```

## 🎯 Feature Requests

For feature requests:

1. **Start a Discussion**: Post in GitHub Discussions first
2. **Describe Use Case**: Why is this needed?
3. **Propose API**: What would the API look like?
4. **Consider Alternatives**: What other approaches exist?
5. **Gauge Interest**: See if others want it too

## 📜 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of:
- Experience level
- Gender identity and expression
- Sexual orientation
- Disability
- Personal appearance
- Body size
- Race
- Ethnicity
- Age
- Religion
- Nationality

### Expected Behavior

- Be respectful and considerate
- Welcome newcomers
- Focus on constructive feedback
- Accept responsibility for mistakes
- Prioritize community well-being

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Personal or political attacks
- Publishing private information
- Spam or self-promotion

## 🏆 Recognition

Contributors are recognized in:
- [CHANGELOG.md](./CHANGELOG.md) for each release
- GitHub contributors page
- Annual contributor spotlight posts

## 📞 Questions?

- **General Questions**: [GitHub Discussions](https://github.com/yourusername/cortex/discussions)
- **Bug Reports**: [GitHub Issues](https://github.com/yourusername/cortex/issues)
- **Real-time Chat**: [Discord](https://discord.gg/cortex)
- **Email**: contribute@cortexmemory.dev

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make Cortex better! 🎉

