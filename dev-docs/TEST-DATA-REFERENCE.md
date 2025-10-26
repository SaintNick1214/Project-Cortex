# Test Data Reference - Automated vs Interactive

This document ensures that **interactive tests use identical data** to the automated tests.

## Test User/Agent IDs

### Automated Tests
Each test uses unique IDs to avoid conflicts:
- `user-123`, `agent-456` (basic creation test)
- `user-msg-test`, `agent-msg-test` (message test)
- `user-get-test`, `agent-get-test` (get test)
- etc.

### Interactive Tests
Uses consistent IDs across all operations:
- `TEST_USER_ID = "user-test-interactive"`
- `TEST_AGENT_ID = "agent-test-interactive"`

## API Operation Mapping

### 1. conversations.create (user-agent)

#### Automated Test
```typescript
const result = await cortex.conversations.create({
  type: "user-agent",
  participants: {
    userId: "user-123",
    agentId: "agent-456",
  },
  metadata: {
    source: "test",
  },
});
```

#### Interactive Test (Option 3)
```typescript
const input = {
  type: "user-agent",
  participants: {
    userId: TEST_USER_ID,      // "user-test-interactive"
    agentId: TEST_AGENT_ID,     // "agent-test-interactive"
  },
  metadata: {
    source: "interactive-runner",
  },
};
```

✅ **Aligned**: Both create user-agent conversations with metadata

---

### 2. conversations.create (agent-agent)

#### Automated Test
```typescript
const result = await cortex.conversations.create({
  type: "agent-agent",
  participants: {
    agentIds: ["agent-1", "agent-2", "agent-3"],
  },
});
```

#### Interactive Test (Option 4)
```typescript
const input = {
  type: "agent-agent",
  participants: {
    agentIds: [TEST_AGENT_ID, "agent-target-interactive", "agent-observer-interactive"],
  },
};
```

✅ **Aligned**: Both use `agentIds` array with 3+ agents

---

### 3. conversations.get

#### Automated Test
```typescript
const created = await cortex.conversations.create({
  type: "user-agent",
  participants: {
    userId: "user-get-test",
    agentId: "agent-get-test",
  },
});

const retrieved = await cortex.conversations.get(created.conversationId);
```

#### Interactive Test (Option 5)
```typescript
// Uses currentConversationId from previous create operation
const result = await cortex.conversations.get(currentConversationId);
```

✅ **Aligned**: Both retrieve by conversationId

---

### 4. conversations.addMessage

#### Automated Test
```typescript
const updated = await cortex.conversations.addMessage({
  conversationId: conversation.conversationId,
  message: {
    role: "user",
    content: "Hello, agent!",
    metadata: {
      sentiment: "positive",
    },
  },
});
```

#### Interactive Test (Option 6) ✅ FIXED
```typescript
const input = {
  conversationId: currentConversationId,
  message: {
    role: "user",  // ✅ Fixed from "assistant" to "user"
    content: "Hello, agent! This is a test message added interactively.",
    metadata: {
      source: "interactive-runner",
    },
  },
};
```

✅ **Aligned**: Both use role "user" (not "assistant"), include metadata

**Previous Bug**: Was using `role: "assistant"` which doesn't exist in the schema  
**Valid Roles**: `"user"`, `"agent"`, `"system"`

---

### 5. conversations.list (by user)

#### Automated Test
```typescript
const conversations = await cortex.conversations.list({
  userId: "user-list-test",
});

expect(conversations.length).toBeGreaterThanOrEqual(2);
```

#### Interactive Test (Option 7) ✅ FIXED
```typescript
const conversations = await cortex.conversations.list({
  userId: TEST_USER_ID,  // "user-test-interactive"
});

console.log(`Found ${conversations.length} conversation(s)`);
```

✅ **Aligned**: Both filter by userId

**Previous Bug**: Was trying to access `result.conversations.length` when SDK returns array directly  
**Return Type**: `Promise<Conversation[]>` - Returns array directly, NOT `{ conversations: [...] }`

---

### 6. conversations.list (by agent)

#### Automated Test
```typescript
const conversations = await cortex.conversations.list({
  agentId: "agent-list-test",
});

expect(conversations.length).toBeGreaterThanOrEqual(1);
```

#### Interactive Test (Option 8) ✅ FIXED
```typescript
const conversations = await cortex.conversations.list({
  agentId: TEST_AGENT_ID,  // "agent-test-interactive"
});

console.log(`Found ${conversations.length} conversation(s)`);
```

✅ **Aligned**: Both filter by agentId

**Previous Bug**: Same as option 7, was accessing `result.conversations.length` incorrectly

---

### 7. conversations.count

#### Automated Test
```typescript
const count = await cortex.conversations.count({
  userId: "user-count-test",
});

expect(count).toBeGreaterThan(0);
```

#### Interactive Test (Option 9) ✅ FIXED
```typescript
const count = await cortex.conversations.count({
  userId: TEST_USER_ID,  // "user-test-interactive"
});

console.log(`Count: ${count}`);
```

✅ **Aligned**: Both count by userId

**Previous Bug**: Was trying to access `result.count` when SDK returns number directly  
**Return Type**: `Promise<number>` - Returns number directly, NOT `{ count: 5 }`

---

### 8. conversations.delete

#### Automated Test
```typescript
await cortex.conversations.delete(conversation.conversationId);

// Verify deletion
const retrieved = await cortex.conversations.get(conversation.conversationId);
expect(retrieved).toBeNull();
```

#### Interactive Test (Option 10)
```typescript
await cortex.conversations.delete(currentConversationId);

// Verify deletion
try {
  await cortex.conversations.get(currentConversationId);
  console.log("❌ ERROR: Conversation still exists!");
} catch (error) {
  if (error.message?.includes("CONVERSATION_NOT_FOUND")) {
    console.log("✅ Verified: Conversation no longer exists");
  }
}
```

✅ **Aligned**: Both delete and verify deletion

---

## Message Role Reference

### Valid Message Roles
From the schema:
```typescript
role: v.union(
  v.literal("user"),
  v.literal("agent"),
  v.literal("system")
)
```

✅ Valid:
- `"user"` - Messages from users
- `"agent"` - Messages from agents
- `"system"` - System messages

❌ Invalid:
- `"assistant"` - ❌ Not in schema (common mistake from OpenAI API patterns)
- `"function"` - ❌ Not in schema
- `"tool"` - ❌ Not in schema

---

## Participants Structure Reference

### User-Agent Conversations
```typescript
participants: {
  userId: string,
  agentId: string,
}
```

### Agent-Agent Conversations
```typescript
participants: {
  agentIds: string[],  // Must have 2+ agents
}
```

❌ **Common Mistakes**:
- Using `initiatorAgentId` and `targetAgentId` (doesn't exist in schema)
- Using only 1 agent in `agentIds` (must be 2+)

---

## Bugs Fixed by Interactive Testing

### Bug #1: Agent-Agent Structure
**Found**: First run of interactive test option 4  
**Error**: `ArgumentValidationError: Object contains extra field 'initiatorAgentId'`  
**Fix**: Changed from:
```typescript
participants: {
  initiatorAgentId: "agent-1",
  targetAgentId: "agent-2",
}
```
To:
```typescript
participants: {
  agentIds: ["agent-1", "agent-2"],
}
```

### Bug #2: Message Role "assistant"
**Found**: Interactive test option 6  
**Error**: `ArgumentValidationError: Value does not match validator. Value: "assistant"`  
**Fix**: Changed from:
```typescript
message: {
  role: "assistant",  // ❌
  content: "...",
}
```
To:
```typescript
message: {
  role: "user",  // ✅ or "agent" or "system"
  content: "...",
}
```

### Bug #3: List Returns Array, Not Object
**Found**: Interactive test option 7 (Run All Tests)  
**Error**: `TypeError: Cannot read properties of undefined (reading 'length')`  
**Fix**: Changed from:
```typescript
const result = await cortex.conversations.list({ userId: "..." });
console.log(result.conversations.length);  // ❌ result.conversations is undefined
```
To:
```typescript
const conversations = await cortex.conversations.list({ userId: "..." });
console.log(conversations.length);  // ✅ SDK returns array directly
```

### Bug #4: Count Returns Number, Not Object
**Found**: Interactive test option 9 (Run All Tests)  
**Error**: Would have failed with `TypeError: Cannot read properties of undefined (reading 'count')`  
**Fix**: Changed from:
```typescript
const result = await cortex.conversations.count({ userId: "..." });
console.log(result.count);  // ❌ result.count is undefined
```
To:
```typescript
const count = await cortex.conversations.count({ userId: "..." });
console.log(count);  // ✅ SDK returns number directly
```

---

## Testing Strategy

### Automated Tests
- **Purpose**: CI/CD, regression testing, coverage
- **Pattern**: Create unique IDs per test to avoid conflicts
- **Speed**: Fast (all tests run in ~5 seconds)
- **Verification**: Jest assertions + storage inspection

### Interactive Tests
- **Purpose**: Manual debugging, learning, step-by-step validation
- **Pattern**: Reuse same IDs, maintain state between operations
- **Speed**: Manual (as fast as you can type)
- **Verification**: Visual inspection + storage inspector

### Complementary Approach
1. **Use automated tests** for development and CI/CD
2. **Use interactive tests** when:
   - Something fails and you need to debug
   - Learning how an API works
   - Testing edge cases manually
   - Verifying storage state visually

---

## Maintenance

When adding new tests or modifying existing ones:

1. **Update automated tests first** (`tests/conversations.test.ts`)
2. **Align interactive tests** (`tests/interactive-runner.ts`)
3. **Update this document** with any new patterns

This ensures the interactive runner always matches real-world usage patterns from the automated test suite.

---

**Last Updated**: October 26, 2025  
**Bugs Fixed**: 4  
**Status**: ✅ All tests aligned

## API Return Types Summary

Quick reference for correct return types:

| Method | Return Type | Example |
|--------|-------------|---------|
| `create()` | `Promise<Conversation>` | `const conv = await create(...)` |
| `get()` | `Promise<Conversation \| null>` | `const conv = await get(id)` |
| `addMessage()` | `Promise<Conversation>` | `const conv = await addMessage(...)` |
| `list()` | `Promise<Conversation[]>` | `const convs = await list(...)` ⚠️ Array! |
| `count()` | `Promise<number>` | `const n = await count(...)` ⚠️ Number! |
| `delete()` | `Promise<void>` | `await delete(id)` |

⚠️ **Common Mistakes**: Expecting `list()` to return `{ conversations: [...] }` or `count()` to return `{ count: 5 }`. Both return primitive types directly!

