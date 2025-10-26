# Testing Guide - Step-by-Step Test Validation

## 🎯 What We Built

A comprehensive testing system that lets you:

1. ✅ **Purge tables before tests** - Start with clean slate
2. ✅ **Inspect storage after each operation** - See exactly what's stored
3. ✅ **Step through tests individually** - Validate each test manually
4. ✅ **Compare SDK results with storage** - Ensure consistency

## 🚀 Quick Start

### Option 1: Fast Tests (Default - CI/CD)

```bash
npm test
```

**Features:**

- Fast execution (~2 seconds)
- Purges table before suite
- All 26 tests pass
- Perfect for CI/CD

**Output:**

```
🧹 Purging conversations table before tests...
✅ Purged 0 conversations
✅ Conversations table is empty

PASS tests/conversations.test.ts
  Conversations API (Layer 1a)
    create()
      ✓ creates a user-agent conversation (28 ms)
      ✓ creates an agent-agent conversation (13 ms)
      ...

Test Suites: 1 passed, 1 total
Tests:       26 passed, 26 total
```

### Option 2: Debug Tests (Development - Step-by-Step)

```bash
# Install cross-env first
npm install

# Run debug tests
npm run test:debug
```

**Features:**

- ✅ Detailed storage inspection
- ✅ Step-by-step logging
- ✅ Compare SDK with storage
- ✅ Statistics after each operation
- ✅ Warm fuzzy feelings! 🤗

**Example Output:**

```
🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛
🐛 DEBUG MODE ENABLED
🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛
Configuration:
  - Pause after each test: false
  - Verbose logging: true
  - Inspect storage: true
🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛🐛

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TEST: Create User-Agent Conversation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

================================================================================
📝 STEP 1: Call SDK create method
================================================================================

🔍 [SDK Response] Conversation created
{
  "conversationId": "conv-1729900000000-abc123",
  "type": "user-agent",
  "messageCount": 0
}

================================================================================
📝 STEP 2: Validate SDK response
================================================================================

================================================================================
📝 STEP 3: Inspect storage
================================================================================

================================================================================
📊 CONVERSATION INSPECTION: conv-1729900000000-abc123
================================================================================
Type:          user-agent
Created:       2025-10-26T10:30:00.000Z
Updated:       2025-10-26T10:30:00.000Z
Message Count: 0

Participants:
{
  "userId": "user-123",
  "agentId": "agent-456"
}

Metadata:
{
  "source": "debug-test"
}

Messages (0):
(empty)
================================================================================

================================================================================
📝 STEP 4: Compare SDK result with storage
================================================================================

✅ SDK result matches storage for conv-1729900000000-abc123

================================================================================
📝 STEP 5: Print storage statistics
================================================================================

================================================================================
📊 STORAGE STATISTICS
================================================================================
Total Conversations:      1
User-Agent Conversations: 1
Agent-Agent Conversations: 0
================================================================================
```

### Option 3: Manual Step-Through (Ultra Debug)

Edit `conversations.debug.test.ts` and change:

```typescript
enableDebugMode({
  verboseLogging: true,
  inspectStorage: true,
  pauseAfterEachTest: true, // ← Change to true
});
```

Then run:

```bash
npm run test:debug
```

Now the test will pause after each test and wait for you to press ENTER!

## 📊 What Gets Inspected

### 1. Table Cleanup (Before All Tests)

```
🧹 Purging conversations table before tests...
✅ Purged 5 conversations
✅ Conversations table is empty
```

### 2. After Each Create

```
================================================================================
📊 CONVERSATION INSPECTION: conv-abc123
================================================================================
Type:          user-agent
Created:       2025-10-26T10:30:00.000Z
Message Count: 0
Participants:  { userId: "user-123", agentId: "agent-456" }
================================================================================
```

### 3. After Adding Messages

```
================================================================================
📊 CONVERSATION INSPECTION: conv-abc123
================================================================================
Message Count: 3

Messages (3):
  [1] user (2025-10-26T10:30:01.000Z)
      ID: msg-1
      Content: Hello, agent! This is message 1.
      Metadata: {"sentiment":"positive"}

  [2] agent (2025-10-26T10:30:02.000Z)
      ID: msg-2
      Agent: agent-msg-debug
      Content: Hi! This is message 2 from the agent.

  [3] user (2025-10-26T10:30:03.000Z)
      ID: msg-3
      Content: Great! This is message 3.
================================================================================
```

### 4. Storage Statistics

```
================================================================================
📊 STORAGE STATISTICS
================================================================================
Total Conversations:      10
User-Agent Conversations: 8
Agent-Agent Conversations: 2
================================================================================
```

### 5. Compare SDK with Storage

```
✅ SDK result matches storage for conv-abc123
```

OR if there's a mismatch:

```
❌ Differences found for conv-abc123:
   - messageCount: SDK=3, Storage=2
   - messages.length: SDK=3, Storage=2
```

## 🔧 Available Scripts

```bash
# Normal tests (fast)
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Debug mode (step-by-step inspection)
npm run test:debug
```

## 📂 Files Created

```
tests/
├── conversations.test.ts           # Fast tests (26 tests)
├── conversations.debug.test.ts     # Debug tests with inspection
├── helpers/
│   ├── cleanup.ts                  # Table cleanup utilities
│   ├── inspector.ts                # Storage inspection
│   ├── debug.ts                    # Debug mode controls
│   ├── index.ts                    # Export all helpers
│   └── README.md                   # Detailed helper docs
└── TESTING-GUIDE.md                # This file
```

## 🎯 Example Workflow

### Developing a New Test

1. **Write the test in debug mode**

   ```typescript
   it("should do something", async () => {
     logStep(1, "Call SDK");
     const result = await cortex.conversations.create({ ... });

     logStep(2, "Inspect storage");
     await inspector.inspectConversation(result.conversationId);

     logStep(3, "Validate");
     expect(result.conversationId).toBeDefined();
   });
   ```

2. **Run in debug mode**

   ```bash
   npm run test:debug
   ```

3. **Review the inspection output**
   - See exact storage state
   - Verify SDK response matches
   - Check message order, timestamps, etc.

4. **Once confident, simplify for production**
   ```typescript
   it("should do something", async () => {
     const result = await cortex.conversations.create({ ... });

     // Validate SDK
     expect(result.conversationId).toBeDefined();

     // Validate storage
     const stored = await client.query(api.conversations.get, {
       conversationId: result.conversationId
     });
     expect(stored).toMatchObject({ ... });
   });
   ```

## ✅ What Each Test Validates

Every test now validates:

1. ✅ **SDK Response** - Correct structure and values
2. ✅ **Storage State** - Data persisted correctly
3. ✅ **Consistency** - SDK matches storage
4. ✅ **Clean Start** - Table purged before suite

## 🎉 Benefits

### For Development

- 🔍 **See exactly what's stored** - No guessing
- 🐛 **Debug failing tests easily** - Inspect storage state
- ✅ **Validate manually** - Step through each operation
- 🧹 **Clean slate every time** - No test pollution

### For Production

- ⚡ **Fast execution** - Tests run in ~2 seconds
- 🤖 **CI/CD ready** - Reliable, repeatable
- 📊 **High coverage** - 26 tests covering all operations
- 🎯 **Storage validation** - Every test checks DB

## 📖 Next Steps

1. **Run fast tests** to ensure everything works:

   ```bash
   npm test
   ```

2. **Run debug tests** to see storage inspection:

   ```bash
   npm run test:debug
   ```

3. **Review output** - You'll see detailed inspection of every operation

4. **Apply same pattern** to Layer 1b (Immutable) and Layer 1c (Mutable)

---

**You now have the warm fuzzies! 🤗**

Every test:

- ✅ Starts with empty table
- ✅ Shows you exactly what's in storage
- ✅ Compares SDK with storage
- ✅ Validates data consistency

**No more wondering what's actually stored!** 🎯
