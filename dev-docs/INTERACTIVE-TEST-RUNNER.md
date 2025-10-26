# Interactive Test Runner 🎮

The Interactive Test Runner provides a **menu-driven interface** for manually testing Cortex SDK APIs one operation at a time.

## Quick Start

```powershell
# Make sure Convex is running
npm run dev

# In another terminal, start the interactive runner
npm run test:interactive
```

## What It Does

Unlike automated tests that run all at once, the Interactive Test Runner lets you:

1. **Choose what to test** - Pick individual API operations from a menu
2. **Control the flow** - Decide when to run each operation
3. **Inspect state** - See database contents at any time
4. **Repeat operations** - Run the same test multiple times
5. **Clean up** - Purge the database whenever needed

## Menu Options

```
══════════════════════════════════════════════════════════════════════════════
  🧪 CORTEX SDK - INTERACTIVE TEST RUNNER
══════════════════════════════════════════════════════════════════════════════

   1) 🧹 Purge Database (conversations)
   2) 📊 Inspect Database State
   3) ➕ Test: conversations.create (user-agent)
   4) ➕ Test: conversations.create (agent-agent)
   5) 📖 Test: conversations.get
   6) 💬 Test: conversations.addMessage
   7) 📋 Test: conversations.list (by user)
   8) 📋 Test: conversations.list (by agent)
   9) 🔢 Test: conversations.count
  10) 🗑️  Test: conversations.delete
  11) 🎯 Run All Tests (Sequential)
   0) ❌ Exit

══════════════════════════════════════════════════════════════════════════════
👉 Select an option:
```

## Typical Workflow

### Example 1: Testing a Single Operation

1. Start the runner: `npm run test:interactive`
2. **Option 1**: Purge database (clean slate)
3. **Option 3**: Create a user-agent conversation
4. **Option 2**: Inspect database state
5. **Option 0**: Exit

### Example 2: Testing a Full Flow

1. Start the runner: `npm run test:interactive`
2. **Option 1**: Purge database
3. **Option 3**: Create a conversation
4. **Option 6**: Add a message
5. **Option 5**: Get the conversation (verify message was added)
6. **Option 2**: Inspect database
7. **Option 10**: Delete the conversation
8. **Option 2**: Inspect database (verify deletion)
9. **Option 0**: Exit

### Example 3: Run All Tests

1. Start the runner: `npm run test:interactive`
2. **Option 11**: Run all tests sequentially
3. Review the results
4. **Option 2**: Inspect final state
5. **Option 0**: Exit

## Features

### 🎯 State Tracking

The runner tracks the **current conversation ID** between operations:

```
═══════════════════════════════════════════════════════════════════
🎯 Current Conversation: conv-test-20250101-abc123
═══════════════════════════════════════════════════════════════════
```

This means:

- After creating a conversation, operations like `get`, `addMessage`, and `delete` automatically use the current conversation ID
- You don't need to copy/paste IDs manually
- The ID persists across operations until you delete the conversation or purge the database

### 📊 Automatic Storage Inspection

After operations that modify data, the runner automatically:

1. Shows the SDK response
2. Queries the database to show the stored result
3. Validates that the data was correctly stored

Example output after creating a conversation:

```
➕ Testing: conversations.create (user-agent)...

📤 Input:
{
  "type": "user-agent",
  "participants": {
    "userId": "user-test-interactive",
    "agentId": "agent-test-interactive"
  },
  "initialMessage": {
    "role": "user",
    "content": "Hello, this is an interactive test!"
  }
}

📥 Result:
{
  "conversationId": "conv-20250101-abc123",
  "type": "user-agent",
  "participants": { ... },
  "messageCount": 1,
  "createdAt": 1735689600000
}

🎯 Current conversation ID set to: conv-20250101-abc123

📊 Storage validation:
Conversation: conv-20250101-abc123
  Type: user-agent
  Participants: {"userId":"user-test-interactive","agentId":"agent-test-interactive"}
  Messages: 1
  Created: 2025-01-01T00:00:00.000Z
  Message[0]:
    Role: user
    Content: "Hello, this is an interactive test!"
```

### 🧹 Database Purging

The **Purge Database** option:

- Lists all conversations in the database
- Deletes them one by one
- Verifies the table is empty
- Resets the current conversation ID

Safe to run at any time!

### 🔄 Repeatability

You can run the same operation multiple times:

- Create multiple conversations
- Add multiple messages
- List conversations repeatedly (see how the list grows)
- Delete and recreate

## Use Cases

### 🐛 Debugging

When a test fails or behavior is unexpected:

1. Run the interactive runner
2. Purge the database
3. Reproduce the exact steps that cause the issue
4. Inspect the database state at each step
5. Identify where things go wrong

### 📚 Learning

New to the Cortex SDK?

1. Run each operation one at a time
2. See the exact input and output
3. Inspect how data is stored
4. Understand the full flow

### ✅ Manual Validation

Need to manually verify a specific scenario?

1. Set up the exact state you want
2. Run the operation
3. Inspect the results
4. Confirm behavior matches expectations

### 🧪 Experimentation

Want to try something out?

- Modify the test data in `interactive-runner.ts`
- Run your custom scenario
- See the results immediately
- No need to write a full test suite

## How It Works

The Interactive Test Runner is a TypeScript script (`tests/interactive-runner.ts`) that:

1. **Initializes** the Cortex SDK and Convex client
2. **Displays** a menu of options
3. **Waits** for your input
4. **Executes** the selected operation
5. **Shows** the results (input, output, storage state)
6. **Pauses** for you to review
7. **Loops** back to the menu

Each operation uses:

- **Cortex SDK** for the API call
- **TestCleanup** for database purging
- **StorageInspector** for viewing database state
- **ConvexClient** for direct database queries

## Customization

Want to add your own test scenarios? Edit `tests/interactive-runner.ts`:

```typescript
// Add a new menu option
const MENU_OPTIONS = {
  // ... existing options ...
  "12": { label: "🎯 My Custom Test", action: myCustomTest },
};

// Add the test function
async function myCustomTest() {
  console.log("\n🎯 Running my custom test...");

  // Your test logic here
  const result = await cortex.conversations.create({ ... });

  console.log("Result:", JSON.stringify(result, null, 2));
}
```

Then restart the runner and your option will appear!

## Comparison with Other Test Modes

| Feature       | Interactive  | test:debug | test:watch | npm test |
| ------------- | ------------ | ---------- | ---------- | -------- |
| Speed         | 🐢 Manual    | 🐢 Slow    | ⚡ Fast    | ⚡ Fast  |
| Control       | ✅ Full      | ❌ None    | ❌ None    | ❌ None  |
| Learning      | ✅ Best      | ✅ Good    | ❌ Poor    | ❌ Poor  |
| CI/CD         | ❌ No        | ❌ No      | ❌ No      | ✅ Yes   |
| Debugging     | ✅ Best      | ✅ Good    | ✅ OK      | ❌ Poor  |
| Inspection    | ✅ On-demand | ✅ Auto    | ❌ None    | ❌ None  |
| Repeatability | ✅ Yes       | ❌ No\*    | ✅ Yes     | ✅ Yes   |

\*Debug tests run once and exit

## Tips

### 💡 Use Between Code Changes

The Interactive Runner is perfect for TDD:

1. Write a new API operation in the SDK
2. Add it to the interactive runner menu
3. Test it manually with the runner
4. Once it works, write automated tests
5. Use the runner again if tests fail

### 💡 Combine with Watch Mode

Run both simultaneously:

- **Terminal 1**: `npm run dev` (Convex)
- **Terminal 2**: `npm run test:watch` (automated tests)
- **Terminal 3**: `npm run test:interactive` (manual testing)

Make a code change → watch tests run → manually verify with interactive runner

### 💡 Inspect After Every Operation

Get in the habit of inspecting the database after each operation:

1. Run an operation
2. Select "Inspect Database State"
3. Verify the data looks correct
4. Continue to the next operation

This catches issues immediately!

### 💡 Use Option 11 for Smoke Testing

**Option 11** (Run All Tests) is great for:

- Quick smoke test of all operations
- Verifying everything still works after changes
- Generating test data for inspection
- Learning the full API flow

## Troubleshooting

### "Cannot find module" error

Make sure you've installed dependencies:

```powershell
npm install
```

### "CONVEX_URL not set" error

The runner needs Convex to be running:

```powershell
npm run dev
```

Then try the interactive runner again in a new terminal.

### Operations fail with network errors

Check that Convex is still running in the other terminal. If it stopped, restart it:

```powershell
npm run dev
```

### "Current conversation ID not set"

Some operations (like `get`, `addMessage`, `delete`) require a current conversation ID. Run option 3 or 4 first to create a conversation.

### Menu looks garbled

Your terminal might not support the Unicode characters. This is cosmetic only and doesn't affect functionality.

## Future Enhancements

As we add more APIs to Cortex SDK, we'll expand the Interactive Test Runner with:

- **Immutable Store Operations** (Layer 1b)
- **Mutable Store Operations** (Layer 1c)
- **Memory Operations** (Layer 2)
- **User Operations** (Coordination)
- **Context Operations** (Coordination)
- **A2A Communication** (Coordination)

Each API will get its own menu section for interactive testing!

## Source Code

Location: `tests/interactive-runner.ts`

The script is well-commented and easy to extend. Feel free to modify it for your needs!

---

**Happy Testing!** 🎉

For questions or issues, check:

- `dev-docs/QUICK-TEST-REFERENCE.md` - All test modes
- `dev-docs/TESTING-GUIDE.md` - Testing philosophy
- `tests/README.md` - Test infrastructure
