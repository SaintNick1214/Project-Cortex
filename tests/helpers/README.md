# Test Helpers

Utilities for debugging, inspecting, and validating E2E tests with step-by-step execution support.

## 📦 Utilities

### 1. TestCleanup (`cleanup.ts`)

Manages test data cleanup and table purging.

```typescript
import { TestCleanup } from "./helpers";

const cleanup = new TestCleanup(client);

// Purge all conversations
await cleanup.purgeConversations();

// Verify table is empty
const isEmpty = await cleanup.verifyConversationsEmpty();

// Get current table state
const state = await cleanup.getConversationsState();
console.log(`${state.count} conversations in storage`);
```

### 2. StorageInspector (`inspector.ts`)

Deep inspection of Convex storage with detailed output.

```typescript
import { StorageInspector } from "./helpers";

const inspector = new StorageInspector(client);

// Inspect a single conversation
await inspector.inspectConversation("conv-abc123");

// Inspect all conversations
await inspector.inspectAllConversations();

// Compare SDK result with storage
const comparison = await inspector.compareWithStorage("conv-abc123", sdkResult);

// Print statistics
await inspector.printStats();
```

**Example Output:**

```
================================================================================
📊 CONVERSATION INSPECTION: conv-abc123
================================================================================
Type:          user-agent
Created:       2025-10-26T...
Updated:       2025-10-26T...
Message Count: 3

Participants:
{
  "userId": "user-123",
  "agentId": "agent-456"
}

Messages (3):
  [1] user (2025-10-26T...)
      ID: msg-1
      Content: Hello, agent!
  [2] agent (2025-10-26T...)
      ID: msg-2
      Agent: agent-456
      Content: Hi! How can I help?
  [3] user (2025-10-26T...)
      ID: msg-3
      Content: Thanks!
================================================================================
```

### 3. Debug Mode (`debug.ts`)

Enable step-by-step test execution with pausing and verbose logging.

```typescript
import { enableDebugMode, logStep, pause } from "./helpers";

// Enable debug mode
enableDebugMode({
  verboseLogging: true,
  inspectStorage: true,
  pauseAfterEachTest: false,
});

// Log test steps
logStep(1, "Create conversation");
const result = await cortex.conversations.create({ ... });

// Pause for inspection
await pause("Review the conversation above");

// Verbose debug logging
debugLog("SDK Response", "Conversation created", {
  conversationId: result.conversationId
});
```

## 🎯 Use Cases

### Use Case 1: Regular Fast Tests

Default behavior - no cleanup between tests, runs quickly.

```typescript
// conversations.test.ts
describe("Conversations API", () => {
  beforeAll(async () => {
    // Initialize
    cortex = new Cortex({ convexUrl });
    cleanup = new TestCleanup(client);

    // Purge before all tests
    await cleanup.purgeConversations();
  });

  it("should create conversation", async () => {
    // Test runs fast
    const result = await cortex.conversations.create({ ... });
    expect(result.conversationId).toBeDefined();
  });
});
```

### Use Case 2: Debug Mode with Inspection

Step through tests with detailed inspection.

```typescript
// conversations.debug.test.ts
describe("Conversations API - DEBUG", () => {
  beforeAll(async () => {
    // Enable debug mode
    enableDebugMode({
      verboseLogging: true,
      inspectStorage: true,
    });

    // Purge and verify
    await cleanup.purgeConversations();
    await cleanup.verifyConversationsEmpty();
  });

  it("should create conversation with inspection", async () => {
    logStep(1, "Call SDK");
    const result = await cortex.conversations.create({ ... });

    logStep(2, "Inspect storage");
    await inspector.inspectConversation(result.conversationId);

    logStep(3, "Compare with storage");
    await inspector.compareWithStorage(result.conversationId, result);

    await pause("Review storage state above");
  });
});
```

### Use Case 3: Manual Step-Through

Pause between every test for manual validation.

```typescript
beforeAll(() => {
  enableDebugMode({
    pauseAfterEachTest: true, // ← Pause after each test
    verboseLogging: true,
    inspectStorage: true,
  });
});

it("test 1", async () => {
  // ... test code
  // Automatically pauses after this test
});

it("test 2", async () => {
  // ... test code
  // Automatically pauses after this test
});
```

## 🔧 Environment Variables

Control debug mode via environment variables:

```bash
# Enable debug mode
TEST_DEBUG=true npm test

# Enable pausing between tests
TEST_PAUSE=true npm test

# Enable verbose logging
TEST_VERBOSE=true npm test

# Enable storage inspection
TEST_INSPECT=true npm test

# Combine multiple flags
TEST_DEBUG=true TEST_VERBOSE=true TEST_INSPECT=true npm test

# Run specific debug test
TEST_DEBUG=true npm test conversations.debug
```

## 📊 Storage Inspection Examples

### Inspect After Create

```typescript
const conversation = await cortex.conversations.create({
  type: "user-agent",
  participants: { userId: "user-1", agentId: "agent-1" },
});

// Inspect what was actually stored
await inspector.inspectConversation(conversation.conversationId);
```

### Inspect After Multiple Messages

```typescript
await cortex.conversations.addMessage({ ... }); // Message 1
await cortex.conversations.addMessage({ ... }); // Message 2
await cortex.conversations.addMessage({ ... }); // Message 3

// See all messages in storage
await inspector.inspectConversation(conversationId);
```

### Compare Before/After

```typescript
// Before
await inspector.printStats();
// Total: 5 conversations

await cortex.conversations.create({ ... });

// After
await inspector.printStats();
// Total: 6 conversations
```

## 🚀 Quick Start

### 1. Add to Existing Test

```typescript
import { TestCleanup, StorageInspector } from "./helpers";

let cleanup: TestCleanup;
let inspector: StorageInspector;

beforeAll(async () => {
  cleanup = new TestCleanup(client);
  inspector = new StorageInspector(client);

  // Purge before tests
  await cleanup.purgeConversations();
});

it("should work", async () => {
  const result = await cortex.conversations.create({ ... });

  // Inspect storage
  await inspector.inspectConversation(result.conversationId);
});
```

### 2. Create Debug Version

```bash
# Copy your test file
cp tests/conversations.test.ts tests/conversations.debug.test.ts

# Add debug utilities
# See conversations.debug.test.ts for complete example
```

### 3. Run Tests

```bash
# Normal (fast)
npm test

# Debug mode
TEST_DEBUG=true npm test

# Just debug tests
npm test conversations.debug
```

## 📋 Checklist for Each Test

When writing tests, ensure:

- [ ] **beforeAll**: Purge table
- [ ] **beforeAll**: Verify table is empty
- [ ] **Each test**: Validate SDK response
- [ ] **Each test**: Validate storage (via direct query)
- [ ] **Each test**: Compare SDK result with storage
- [ ] **Debug version**: Add inspection after key operations
- [ ] **Debug version**: Add steps with `logStep()`
- [ ] **Debug version**: Add pauses for manual review

## 🎯 Best Practices

1. **Always purge before test suite** - Start with clean slate
2. **Inspect after mutations** - Verify storage after create/update/delete
3. **Compare SDK with storage** - Ensure consistency
4. **Use debug mode during development** - Then disable for CI/CD
5. **Keep both versions** - Fast tests for CI, debug tests for development

## 📖 Complete Example

See `tests/conversations.debug.test.ts` for a complete example with:

- ✅ Table cleanup before all tests
- ✅ Step-by-step execution
- ✅ Storage inspection after each operation
- ✅ Comparison of SDK results with storage
- ✅ Pause points for manual review
- ✅ Comprehensive logging

## 🔍 Troubleshooting

### Tests failing with "table not empty"

```typescript
// Add cleanup to beforeAll
beforeAll(async () => {
  await cleanup.purgeConversations();
  await cleanup.verifyConversationsEmpty();
});
```

### Want to see what's in storage

```typescript
// Add inspection
await inspector.inspectAllConversations();
await inspector.printStats();
```

### Need to debug a specific test

```typescript
// Add debug logging
enableDebugMode({ verboseLogging: true });
logStep(1, "What I'm doing");
debugLog("Category", "Details", { data });
await pause("Check storage now");
```

---

**Next Steps:**

1. Use these helpers in all Layer 1 tests
2. Create similar helpers for Layer 2 (memories) when ready
3. Extend for Layer 3 (memory API) validation
