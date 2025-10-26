# Quick Test Reference

## NPM Scripts vs Commands

⚠️ **Important**: Custom scripts require `npm run`

```powershell
# ❌ This doesn't work
npm test:watch

# ✅ This works  
npm run test:watch
```

Exception: `npm test` is a built-in alias, so both work:
```powershell
npm test         # ✅ Works
npm run test     # ✅ Also works
```

## Available Test Commands

| Command | Type | Speed | Interactive | Best For |
|---------|------|-------|-------------|----------|
| `npm test` | Automated | ⚡ Fast | ❌ No | CI/CD, quick validation |
| `npm run test:watch` | Automated | ⚡ Fast | ❌ No | Active development, TDD |
| `npm run test:interactive` | Manual | 🐢 Manual | ✅ **Yes** | Debugging, learning, step-by-step |
| `npm run test:debug` | Automated | 🐢 Slow | ❌ No | Understanding behavior |
| `npm run test:coverage` | Automated | 🐢 Slow | ❌ No | Quality checks, PR reviews |

### 1. 🏃 **Regular Tests** (Fast, CI-ready)
```powershell
npm test
```
- Runs all `*.test.ts` files (excluding `*.debug.test.ts`)
- No debug output
- Fast execution
- Perfect for CI/CD

### 2. 👀 **Watch Mode** (Development)
```powershell
npm run test:watch
```
- Re-runs tests automatically on file changes
- Great for TDD workflow
- Keeps running until you stop it (Ctrl+C)

### 2.5. 🎮 **Interactive Mode** (Manual Testing) ⭐ NEW!
```powershell
npm run test:interactive
```
- **Menu-driven test execution**
- Run individual API operations one-by-one
- Inspect database state between operations
- Perfect for debugging and understanding behavior

**Example Menu:**
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

### 3. 🔍 **Debug Tests** (Step-by-Step Validation)
```powershell
npm run test:debug
```
- Runs `*.debug.test.ts` files only
- Shows detailed step-by-step logging
- Inspects storage after each operation
- Validates each assertion with verbose output
- **Automated** - runs without interaction

**Example Output:**
```
═══════════════════════════════════════
📋 TEST SUITE INITIALIZATION
═══════════════════════════════════════

🏁 [Setup] SDK and helpers initialized

═══════════════════════════════════════
🔥 STEP 1: Purging conversations table
═══════════════════════════════════════

✅ [Result] Table purged: 0 conversations deleted
✅ [Verify] Table is empty

═══════════════════════════════════════
🔥 STEP 2: Creating user-agent conversation
═══════════════════════════════════════

📊 [Storage Inspection] After create:
{
  conversationId: "conv-test-001",
  type: "user-agent",
  messageCount: 1,
  participants: {
    userId: "user-123",
    agentId: "agent-456"
  }
}

✅ [Verify] Conversation stored correctly
```

### 4. 📊 **Coverage Report**
```powershell
npm run test:coverage
```
- Generates code coverage report
- Shows which lines are tested
- Creates `coverage/` folder with HTML report

## Environment Variables

Debug tests use these environment variables:

```powershell
# Set in npm script (see package.json)
TEST_DEBUG=true          # Enable debug mode
TEST_VERBOSE=true        # Verbose logging
TEST_INSPECT=true        # Storage inspection
```

You can also run manually:
```powershell
cross-env TEST_DEBUG=true npm test
```

## Test Files

| File | Purpose | Run With |
|------|---------|----------|
| `*.test.ts` | Regular E2E tests | `npm test` |
| `*.debug.test.ts` | Debug/validation tests | `npm run test:debug` |

### Current Test Files

- `tests/conversations.test.ts` - Full E2E test suite for conversations
- `tests/conversations.debug.test.ts` - Step-by-step validation for conversations

## Test Helpers

Located in `tests/helpers/`:

### 🧹 TestCleanup
```typescript
const cleanup = new TestCleanup(client);
await cleanup.purgeConversations();
await cleanup.verifyConversationsEmpty();
```

### 🔍 StorageInspector
```typescript
const inspector = new StorageInspector(client);
await inspector.inspectConversation(conversationId);
await inspector.inspectAllConversations();
await inspector.printStats();
```

### 📝 Debug Helpers
```typescript
import { enableDebugMode, logStep, logResult, debugLog } from './helpers';

enableDebugMode();
logStep("Creating conversation");
logResult("Conversation created", result);
debugLog("Additional info");
```

## Running Specific Tests

### Single test file:
```powershell
npm test conversations.test
```

### Single test suite:
```powershell
npm test -- --testNamePattern="should create conversation"
```

### Debug single test:
```powershell
npm run test:debug -- --testNamePattern="should create and inspect"
```

## Troubleshooting

### Tests fail immediately
- Make sure Convex is running: `npm run dev`
- Check `.env.test` has `CONVEX_URL` set

### "Cannot find module" errors
- Run `npm install`
- Check `convex-dev/_generated/` exists

### Watch mode not updating
- Press `a` to run all tests
- Press `f` to run only failed tests
- Press `q` to quit watch mode

## Quick Tips

1. **Use watch mode during development**: `npm run test:watch`
2. **Use debug tests to understand behavior**: `npm run test:debug`
3. **Use regular tests for CI**: `npm test`
4. **Check coverage before PR**: `npm run test:coverage`

## File Structure

```
tests/
├── conversations.test.ts       ← Regular E2E tests
├── conversations.debug.test.ts ← Debug/validation tests
├── helpers/
│   ├── cleanup.ts              ← Table purging
│   ├── inspector.ts            ← Storage inspection
│   ├── debug.ts                ← Debug logging
│   └── index.ts                ← Export all
└── README.md                   ← Detailed guide
```

---

**See Also**:
- `tests/README.md` - Comprehensive testing documentation
- `dev-docs/TESTING-GUIDE.md` - Testing philosophy and patterns
- `dev-docs/API-Development/` - API development workflow

