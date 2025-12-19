# Five-Minute Quickstart

> **Last Updated**: 2025-12-18

Get your first AI agent with persistent memory running in 5 minutes.

---

## Step 1: Install the CLI (30 seconds)

```bash
npm install -g @cortexmemory/cli
```

Verify installation:

```bash
cortex --version
# Should show: 0.21.0 or higher
```

---

## Step 2: Create Your Project (1 minute)

```bash
cortex init my-first-agent
```

The interactive wizard will ask:

**Question 1:** Project name

- Default: `my-first-agent`
- Press Enter to accept

**Question 2:** Convex setup

- Choose: **"Create new Convex project"** for full features
- Or: **"Local development"** for quick start without account

**Question 3:** Graph database

- Choose: **Skip** (not needed for quickstart)
- You can add this later

**Question 4:** CLI scripts

- Choose: **Yes** to add helpful npm scripts
- These are optional but useful

**Question 5:** Confirm setup

- Review the summary
- Press Enter to proceed

The wizard will:

- ✅ Create project structure
- ✅ Install dependencies
- ✅ Deploy Convex backend
- ✅ Configure environment (.env.local)
- ✅ Save deployment to `~/.cortexrc`

---

## Step 3: Start Services (30 seconds)

```bash
cd my-first-agent
cortex start
```

You should see:

```
   Starting 1 deployment(s)...

   my-first-agent
   Project: /path/to/my-first-agent
   URL: http://127.0.0.1:3210

   ✓ Convex development server started in background

   ✓ All deployments started

   Use 'cortex stop' to stop all services
   Use 'cortex config list' to see deployment status
```

**Alternative:** Use interactive dev mode for a live dashboard:

```bash
cortex dev
```

This gives you:
- Live status dashboard
- Streaming logs from all services
- Keyboard shortcuts (press `?` for help)

---

## Step 4: Run Your First Agent (30 seconds)

In a **new terminal**:

```bash
cd my-first-agent
npm start
```

You should see:

```
🧠 Cortex Memory SDK - Example
================================

💾 Storing a memory...
✓ Memory stored!

🔍 Searching memories...
✓ Found 1 relevant memories
```

**Congratulations!** Your AI agent just:

- Stored a memory in Cortex
- Retrieved it using search
- All with persistent storage

---

## What Just Happened?

Let's look at the code that ran (`src/index.ts`):

```typescript
import { Cortex } from "@cortexmemory/sdk";

// Initialize Cortex
const cortex = new Cortex({
  convexUrl: process.env.CONVEX_URL!, // From .env.local
});

// Store a memory
await cortex.memory.remember({
  memorySpaceId: "my-first-agent", // Isolation boundary
  conversationId: "conversation-1", // Conversation ID
  userMessage: "I prefer dark mode", // What user said
  agentResponse: "Got it!", // What agent said
  userId: "user-123", // User identifier
  userName: "User", // User name
});

// Search memories
const results = await cortex.memory.search(
  "my-first-agent",
  "what are the user preferences?",
);
```

**Key concepts:**

- **Memory Space** - Isolated memory bank (like `my-first-agent`)
- **Conversation** - Thread of messages
- **Search** - Natural language retrieval
- **Persistence** - Survives restarts automatically

---

## Next Steps

### 1. Modify the Agent

Edit `src/index.ts` to experiment:

```typescript
// Try different messages
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
  "what is the user's name?",
);
```

**Hot tip:** The example keeps Convex running in watch mode, so just save and re-run `npm start`!

### 2. View Your Data

Open the Convex dashboard: **http://127.0.0.1:3210**

You'll see:

- **conversations** table - All conversation threads
- **memories** table - Searchable memory index
- **immutable** table - Versioned message history

Click around to explore your data!

### 3. Add Vector Embeddings (Optional)

For semantic search, add an embedding provider:

```bash
npm install openai
```

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

**Note:** Vector search requires cloud Convex (not local).

### 4. Build Something Real

Now that you understand the basics, build a real chatbot:

```typescript
import { Cortex } from "@cortexmemory/sdk";
import OpenAI from "openai";

const cortex = new Cortex({ convexUrl: process.env.CONVEX_URL! });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function chat(userId: string, message: string) {
  const memorySpaceId = `user-${userId}`;
  const conversationId = `conv-${Date.now()}`;

  // Search relevant memories
  const context = await cortex.memory.search(memorySpaceId, message, {
    limit: 5,
  });

  // Build prompt with context
  const systemPrompt = `You are a helpful assistant.
  
Here's what you remember about this user:
${context.map((m) => m.content).join("\n")}`;

  // Generate response
  const response = await openai.chat.completions.create({
    model: "gpt-5-nano",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
  });

  const agentMessage = response.choices[0].message.content;

  // Store this interaction
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

---

## Switching from Local to Cloud

When you're ready for production features (vector search, scaling):

### 1. Create Convex Account

Sign up at [convex.dev](https://convex.dev) (free tier available)

### 2. Add Cloud Deployment via CLI

```bash
# Add a new cloud deployment
cortex config add-deployment cloud

# The CLI will prompt for:
# - Convex deployment URL
# - Deploy key (for production deployments)
```

### 3. Switch to Cloud

```bash
# Set cloud as your current deployment
cortex use cloud

# Start with cloud deployment
cortex start
```

### 4. Or Update Manually

```bash
# Update .env.local with your cloud URL
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOY_KEY=your-deploy-key-here

# Redeploy
npx convex deploy
```

### Managing Multiple Deployments

The CLI makes it easy to manage local and cloud deployments:

```bash
# List all deployments
cortex config list

# Switch between them
cortex use local    # For development
cortex use cloud    # For production

# Or target specific deployment
cortex db stats -d cloud
```

---

## Project Structure

After installation, your project looks like:

```
my-first-agent/
├── src/
│   └── index.ts              # Your agent code
├── convex/                   # Backend functions (Cortex)
│   ├── schema.ts             # Database schema
│   ├── conversations.ts      # Conversation management
│   ├── memories.ts           # Memory storage/search
│   ├── immutable.ts          # Versioned storage
│   ├── mutable.ts            # Live data
│   ├── facts.ts              # Fact extraction
│   ├── contexts.ts           # Context chains
│   ├── memorySpaces.ts       # Memory space registry
│   ├── users.ts              # User profiles
│   ├── agents.ts             # Agent registry
│   └── graphSync.ts          # Graph integration
├── .env.local                # Environment config (not committed)
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
└── README.md                 # Project-specific docs
```

---

## Common Commands

### CLI Commands (Recommended)

```bash
# Start all services (Convex + graph DB)
cortex start

# Interactive dev mode with live dashboard
cortex dev

# Stop all services
cortex stop

# View deployment status
cortex status

# Database statistics
cortex db stats

# Switch deployments
cortex use <name>

# View all deployments
cortex config list
```

### npm Scripts (Also Available)

```bash
# Run your agent
npm start

# Build TypeScript
npm run build

# Start Convex manually (if not using CLI)
npm run dev
```

---

## What's Next?

You now have a working Cortex project! Here's what to explore:

1. **[Core Concepts](./04-core-concepts.md)** - Understand memory spaces, conversations, and search
2. **[Configuration](./05-configuration.md)** - Customize Cortex for your use case
3. **[Memory Operations API](../03-api-reference/02-memory-operations.md)** - Full API reference

---

## Getting Help

**Stuck?**

- Ask in [GitHub Discussions](https://github.com/SaintNick1214/Project-Cortex/discussions)

**Found a bug?**

Open an issue: [GitHub Issues](https://github.com/SaintNick1214/Project-Cortex/issues)

---

**Ready to dive deeper?** Continue to [Core Concepts](./04-core-concepts.md) →
