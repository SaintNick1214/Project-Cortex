# Five-Minute Quickstart

> **Last Updated**: January 1, 2026

Get your first AI agent with persistent memory running in 5 minutes.

---

## Step 1: Install the CLI (30 seconds)

```bash
npm install -g @cortexmemory/cli
```

Verify installation:

```bash
cortex --version
# Should show: 0.27.4 or higher
```

---

## Step 2: Initialize Your Project (1 minute)

```bash
cortex init my-first-agent
```

The interactive wizard will guide you through:

**1. Project name**
- Default: `my-first-agent`
- Press Enter to accept

**2. Convex setup**
- Choose: **"Create new Convex project"** (full features, free tier)
- Or: **"Use local"** (fastest, no account needed)

**3. Template selection** (optional)
- Choose: **"vercel-ai-quickstart"** for a full working example
- Or: **"basic"** for minimal setup

**4. Graph database** (optional)
- Choose: **"Skip"** for now (not needed for quickstart)
- You can add this later with `cortex convex init --graph`

**What the wizard does:**
- ✅ Creates project structure
- ✅ Installs dependencies (`@cortexmemory/sdk`, `convex`)
- ✅ Configures environment (`.env.local`)
- ✅ Sets up Convex backend
- ✅ Deploys Cortex functions
- ✅ Saves configuration to `~/.cortexrc`

---

## Step 3: Start Development Services (30 seconds)

```bash
cd my-first-agent
cortex start
```

**What's running:**
- ✅ Convex backend (database + functions)
- ✅ Next.js dev server (if using vercel-ai-quickstart template)
- ✅ Your app at http://localhost:3000

You should see:

```
Starting 1 deployment(s)...

my-first-agent
Project: /path/to/my-first-agent
URL: http://127.0.0.1:3210

✓ Convex development server started
✓ All deployments started

Use 'cortex stop' to stop services
Use 'cortex dev' for interactive dashboard
```

---

## Step 4: Check Status (Optional)

```bash
cortex status
```

**Output shows:**
- Active deployments
- Running services (Convex, apps)
- Database statistics
- Configuration details
- Dashboard URLs

---

## Step 5: Interactive Development (Recommended)

For the best development experience:

```bash
cortex dev
```

**You get an Expo-style dashboard with:**
- 📊 Live service status
- 📜 Streaming logs from all services
- 🔄 Auto-reload on code changes
- ⌨️ Keyboard shortcuts

**Keyboard shortcuts:**
- `c` - Clear screen
- `s` - Show status
- `r` - Restart all services
- `g` - Toggle graph database
- `k` - Kill stuck processes (port conflicts)
- `h` or `?` - Help
- `q` - Quit (or Ctrl+C)

---

## What Just Happened?

Your project is now set up with:

### 1. Project Structure

```
my-first-agent/
├── src/
│   └── index.ts              # Your agent code
├── convex/                   # Cortex backend (auto-deployed)
│   ├── schema.ts             # Database schema
│   ├── memories.ts           # Memory operations
│   ├── conversations.ts      # Conversation storage
│   ├── users.ts              # User profiles
│   └── ...                   # More Cortex functions
├── .env.local                # Environment config (git-ignored)
├── package.json              # Dependencies
└── README.md                 # Project docs
```

### 2. Environment Configuration

The CLI created `.env.local`:

```env
CONVEX_URL=http://127.0.0.1:3210
# Or: https://your-deployment.convex.cloud
```

### 3. Deployment Configuration

The CLI saved to `~/.cortexrc`:

```json
{
  "deployments": {
    "my-first-agent": {
      "url": "http://127.0.0.1:3210",
      "projectPath": "/path/to/my-first-agent",
      "enabled": true
    }
  },
  "default": "my-first-agent"
}
```

---

## Try Your Agent

### Option A: Using the Vercel AI Quickstart Template

If you selected the `vercel-ai-quickstart` template:

1. **Open the app:**
   ```bash
   open http://localhost:3000
   ```

2. **Chat with your agent:**
   - Type: "I prefer dark mode"
   - Agent: "I'll remember that!"
   - Type: "What are my preferences?"
   - Agent: "You prefer dark mode"

3. **Memory persists across sessions:**
   - Refresh the page
   - Start a new conversation
   - Agent still remembers your preferences ✅

### Option B: Using the Basic Template

If you selected the `basic` template, run the example:

```bash
npm start
```

**Output:**

```
🧠 Cortex Memory SDK - Example
================================

💾 Storing a memory...
✓ Memory stored!

🔍 Searching memories...
✓ Found 1 relevant memories

Memory: I prefer dark mode
```

**What happened:**

The example code (`src/index.ts`) did:

```typescript
import { Cortex } from "@cortexmemory/sdk";

const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!, // From .env.local
});

// 1. Store a memory
await cortex.memory.remember({
  memorySpaceId: "my-first-agent",
  conversationId: "conversation-1",
  userMessage: "I prefer dark mode",
  agentResponse: "Got it!",
  userId: "user-123",
  userName: "User",
});

// 2. Search memories
const results = await cortex.memory.search(
  "my-first-agent",
  "what are the user preferences?"
);

console.log("Found:", results.length, "memories");
```

---

## Explore Your Data

### Using the Convex Dashboard

Open your Convex dashboard:

```bash
# For local development
open http://127.0.0.1:3210

# Or use CLI command
cortex convex dashboard
```

**What you'll see:**

**Tables:**
- `conversations` - All conversation threads
- `memories` - Searchable memory index (vector store)
- `immutable` - Versioned message history
- `users` - User profiles
- `memorySpaces` - Memory space registry (if registered)

**Click into a table:**
- View all records
- See document structure
- Inspect timestamps and IDs
- Watch real-time updates

### Using CLI Commands

```bash
# View database statistics
cortex db stats

# List memory spaces
cortex spaces list

# List users
cortex users list

# List memories in a space
cortex memory list --space my-first-agent

# Search memories
cortex memory search "preferences" --space my-first-agent
```

---

## Next Steps

### 1. Modify the Agent

Edit `src/index.ts` to experiment:

```typescript
// Try storing different information
await cortex.memory.remember({
  memorySpaceId: "my-first-agent",
  conversationId: "conversation-2",
  userMessage: "My name is Alice and I love TypeScript",
  agentResponse: "Nice to meet you, Alice!",
  userId: "alice",
  userName: "Alice",
});

// Search with different queries
const results = await cortex.memory.search(
  "my-first-agent",
  "what is the user's name?"
);
```

**Then re-run:**

```bash
npm start
```

### 2. Add Vector Embeddings (Optional)

For semantic search, add an embedding provider:

```bash
npm install openai
```

**Update your code:**

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

await cortex.memory.remember({
  memorySpaceId: "my-first-agent",
  conversationId: "conv-1",
  userMessage: "I love machine learning",
  agentResponse: "That's awesome!",
  userId: "user-1",
  userName: "User",
  // Add embedding generation
  generateEmbedding: async (text) => {
    const result = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return result.data[0].embedding;
  },
});
```

**Note:** Vector search requires cloud Convex (not local). Switch with:

```bash
cortex config add-deployment cloud
cortex use cloud
cortex start
```

### 3. Build a Real Chatbot

Combine search and generation:

```typescript
async function chat(userId: string, message: string) {
  const memorySpaceId = `user-${userId}`;
  const conversationId = `conv-${Date.now()}`;

  // 1. Search relevant memories
  const context = await cortex.memory.search(
    memorySpaceId,
    message,
    { limit: 5 }
  );

  // 2. Build prompt with context
  const systemPrompt = `You are a helpful assistant.
  
Here's what you remember about this user:
${context.map(m => m.content).join("\n")}`;

  // 3. Generate response
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ]
  });

  const agentMessage = response.choices[0].message.content;

  // 4. Store this interaction
  await cortex.memory.remember({
    memorySpaceId,
    conversationId,
    userMessage: message,
    agentResponse: agentMessage,
    userId,
    userName: "User",
  });

  return agentMessage;
}

// Use it
const reply = await chat("alice", "What did I tell you about my preferences?");
console.log(reply);
```

### 4. Explore CLI Commands

```bash
# Project lifecycle
cortex start                  # Start all services
cortex stop                   # Stop all services
cortex dev                    # Interactive development
cortex status                 # View status

# Database operations
cortex db stats               # View statistics
cortex db backup              # Backup database
cortex db restore             # Restore from backup

# Memory management
cortex memory list --space <id>
cortex memory search "query" --space <id>
cortex memory export --space <id>

# Configuration
cortex config list            # View deployments
cortex use <deployment>       # Switch deployment
cortex convex dashboard       # Open dashboard

# Full reference
cortex --help
```

**See:** [CLI Reference](../06-tools/01-cli-reference.md) for all commands

---

## Managing Multiple Deployments

The CLI makes it easy to work with multiple environments:

```bash
# Add cloud deployment
cortex config add-deployment cloud \
  --url https://my-app.convex.cloud \
  --key "prod|..."

# Switch between them
cortex use local     # For development
cortex use cloud     # For production

# View all deployments
cortex config list

# Target specific deployment
cortex db stats -d cloud
cortex memory list -d local --space my-agent
```

---

## Common CLI Workflows

### Development Workflow

```bash
# 1. Start interactive dev mode
cortex dev

# 2. Make code changes
# (Convex auto-reloads)

# 3. View live logs in dashboard
# (Streaming in real-time)

# 4. Test with CLI commands
cortex memory list --space my-agent

# 5. Quit when done
# Press 'q'
```

### Production Deployment

```bash
# 1. Add production deployment
cortex config add-deployment production \
  --url https://prod.convex.cloud \
  --key "prod|..."

# 2. Switch to production
cortex use production

# 3. Deploy backend
cortex deploy

# 4. Verify deployment
cortex status
cortex db stats
```

### Backup and Restore

```bash
# Backup database
cortex db backup --output backup-$(date +%Y%m%d).json

# Restore database
cortex db restore --input backup-20260101.json
```

---

## What's Next?

You now have a working Cortex project! Here's what to explore:

1. **[Core Concepts](./04-core-concepts.md)** - Understand memory spaces, isolation, and architecture
2. **[Configuration](./05-configuration.md)** - Multi-deployment setup and environment config
3. **[Memory Operations API](../03-api-reference/02-memory-operations.md)** - Full SDK API reference
4. **[CLI Reference](../06-tools/01-cli-reference.md)** - All CLI commands and options
5. **[Memory Spaces Guide](../02-core-features/01-memory-spaces.md)** - Isolation boundaries and Hive Mode

---

## Getting Help

**Stuck?**
- [GitHub Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions)
- [CLI Reference](../06-tools/01-cli-reference.md)
- Run `cortex --help` for command help

**Found a bug?**
- [GitHub Issues](https://github.com/SaintNick1214/Project-Cortex/issues)

---

**Ready to dive deeper?** Continue to [Core Concepts](./04-core-concepts.md) →
