# MCP Server: Cross-Application Memory

> **Last Updated**: 2026-01-01

Share Cortex memory across all your AI tools with the Model Context Protocol server.

## Overview

The Cortex MCP (Model Context Protocol) Server enables **your AI memory to follow you everywhere**. Whether you're using Cursor IDE, Claude Desktop, or custom AI tools, they all share the same persistent memory through a standard protocol.

**The Problem:**

- Cursor remembers your coding preferences
- Claude remembers your writing style
- ChatGPT remembers your project details
- But they don't share memory - you repeat yourself constantly! ❌

**The Solution:**

- Cortex MCP Server runs locally (or in cloud)
- All AI tools connect to it
- They all share one memory store ✅
- Tell one tool something, all tools remember it!

## Quick Start

### Installation

```bash
# Install globally
npm install -g @cortex-platform/mcp-server

# Or use npx (no install)
npx @cortex-platform/mcp-server
```

### Start Server

```bash
# With your Convex URL
cortex-mcp-server --convex-url=https://your-project.convex.cloud

# Server starts on http://localhost:3000
```

### Configure AI Clients

**Cursor IDE:**

Create `.cursor/mcp-config.json`:

```json
{
  "memory": {
    "provider": "cortex",
    "endpoint": "http://localhost:3000",
    "user_id": "your-email@example.com"
  }
}
```

**Claude Desktop:**

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cortex": {
      "url": "http://localhost:3000"
    }
  }
}
```

**That's it!** Now Cursor and Claude share memory via Cortex.

## How It Works

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Cursor IDE    │     │  Claude Desktop │     │  Custom Tool    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                         HTTP/JSON (MCP Protocol)
                                 │
                                 ↓
                  ┌──────────────────────────────┐
                  │   Cortex MCP Server          │
                  │   (localhost:3000)           │
                  └──────────────┬───────────────┘
                                 │
                                 ↓
                  ┌──────────────────────────────┐
                  │   Cortex SDK                 │
                  │   (Memory Operations)        │
                  └──────────────┬───────────────┘
                                 │
                                 ↓
                  ┌──────────────────────────────┐
                  │   Your Convex Instance       │
                  │   (Data Storage)             │
                  └──────────────────────────────┘
```

### Example Flow

1. **In Cursor:** You say "I prefer TypeScript for backend"
2. **Cursor → MCP:** `POST /add_memories` with the message
3. **MCP → Cortex:** Stores in Convex via SDK
4. **Later, in Claude:** You ask about coding advice
5. **Claude → MCP:** `POST /search_memory` for "coding preferences"
6. **MCP → Cortex:** Searches and returns "User prefers TypeScript"
7. **Claude:** Uses that fact to personalize response ✅

**Result:** Claude knows your preferences without you repeating them!

## MCP Endpoints

### add_memories

Store new memories from conversation:

```typescript
POST /add_memories
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "I like dark mode" },
    { "role": "assistant", "content": "Noted!" }
  ],
  "user_id": "user-123"
}

// Response
{
  "success": true,
  "memory_ids": ["mem_abc", "mem_def"]
}
```

**Or store single memory:**

```typescript
{
  "memory": "User prefers dark mode",
  "user_id": "user-123",
  "metadata": {
    "source": "cursor",
    "importance": 70
  }
}
```

### search_memory

Find relevant memories:

```typescript
POST /search_memory
Content-Type: application/json

{
  "query": "user preferences",
  "user_id": "user-123",
  "limit": 5
}

// Response
{
  "results": [
    {
      "id": "mem_abc",
      "memory": "User prefers dark mode",
      "score": 0.92,
      "metadata": { "importance": 70 },
      "created_at": "2025-10-28T10:00:00Z"
    }
  ]
}
```

### list_memories

Get recent memories:

```typescript
GET /list_memories?user_id=user-123&limit=20

// Response
{
  "results": [
    {
      "id": "mem_xyz",
      "memory": "User prefers TypeScript",
      "created_at": "2025-10-28T09:00:00Z"
    },
    // ... more memories
  ],
  "total": 45,
  "has_more": true
}
```

### delete_all_memories

Clear all memories for a user:

```typescript
POST /delete_all_memories
Content-Type: application/json

{
  "user_id": "user-123"
}

// Response
{
  "success": true,
  "deleted_count": 45
}
```

## User and Session Isolation

### Multi-User Support

Each user has isolated memories:

```typescript
// User A's memory
POST /add_memories
{
  "memory": "I prefer light mode",
  "user_id": "alice@example.com"
}

// User B's memory
POST /add_memories
{
  "memory": "I prefer dark mode",
  "user_id": "bob@example.com"
}

// Searches are isolated
POST /search_memory
{
  "query": "theme preference",
  "user_id": "alice@example.com"
}
// Returns: "I prefer light mode" (Alice's only) ✅
```

### Session Scoping

Temporary context that doesn't persist across sessions:

```typescript
POST /add_memories
{
  "memory": "Currently working on feature-branch-123",
  "user_id": "user-123",
  "session_id": "session-abc"  // Session-specific
}

// Search within session
POST /search_memory
{
  "query": "current work",
  "user_id": "user-123",
  "session_id": "session-abc"
}

// Different session doesn't see it
POST /search_memory
{
  "query": "current work",
  "user_id": "user-123",
  "session_id": "session-xyz"  // Different session
}
// Returns: [] (empty)
```

## Client Integration

### Cursor IDE

Cursor automatically integrates with MCP servers.

**Setup:**

1. Start Cortex MCP Server:

```bash
cortex-mcp-server --convex-url=$CONVEX_URL --port=3000
```

2. Create `.cursor/mcp-config.json` in your project:

```json
{
  "memory": {
    "provider": "cortex",
    "endpoint": "http://localhost:3000",
    "user_id": "${USER_EMAIL}"
  }
}
```

**Usage:**

- Cursor will automatically store context as you code
- Ask Cursor about preferences: "What's my preferred framework?"
- Cursor retrieves from MCP: "User prefers React with TypeScript"

### Claude Desktop

**Setup:**

1. Start Cortex MCP Server (if not running)

2. Edit Claude's config:

```bash
# macOS
~/Library/Application Support/Claude/claude_desktop_config.json

# Windows
%APPDATA%\Claude\claude_desktop_config.json

# Linux
~/.config/Claude/claude_desktop_config.json
```

3. Add Cortex:

```json
{
  "mcpServers": {
    "cortex": {
      "url": "http://localhost:3000"
    }
  }
}
```

4. Restart Claude Desktop

**Usage:**

- Tell Claude: "Remember that I prefer formal communication"
- Later, switch to different conversation
- Claude maintains the preference across all chats ✅

### Custom Integration

```typescript
// Your application
import axios from "axios";

const MCP_ENDPOINT = "http://localhost:3000";
const USER_ID = "user-123";

// Store memory
async function rememberInMCP(content: string) {
  await axios.post(`${MCP_ENDPOINT}/add_memories`, {
    memory: content,
    user_id: USER_ID,
    metadata: {
      source: "my-app",
      importance: 70,
    },
  });
}

// Retrieve context
async function getRelevantContext(query: string) {
  const response = await axios.post(`${MCP_ENDPOINT}/search_memory`, {
    query,
    user_id: USER_ID,
    limit: 5,
  });

  return response.data.results.map((r) => r.memory);
}

// Usage in your AI agent
const userQuery = "What should I work on?";
const context = await getRelevantContext(userQuery);

const llmResponse = await yourLLM.complete({
  messages: [
    { role: "system", content: `Context: ${context.join("; ")}` },
    { role: "user", content: userQuery },
  ],
});
```

## Advanced Configuration

### Environment Variables

```bash
# Required
CONVEX_URL=https://your-project.convex.cloud

# Optional
MCP_PORT=3000
MCP_LOG_LEVEL=info          # debug, info, warn, error
MCP_AUTH_ENABLED=false
MCP_API_KEY=secret-key

# Optional: Embedding (for semantic search)
OPENAI_API_KEY=sk-...

# Optional: Fact extraction
MCP_EXTRACT_FACTS=false
MCP_FACT_MIN_CONFIDENCE=0.7

# Optional: Graph DB
GRAPH_DB_ENABLED=false
GRAPH_DB_URI=bolt://localhost:7687
GRAPH_DB_USER=neo4j
GRAPH_DB_PASSWORD=password
```

### Programmatic Control

```typescript
import { CortexMCPServer } from "@cortex-platform/mcp-server";

const server = new CortexMCPServer({
  port: 3000,
  convexUrl: process.env.CONVEX_URL,

  // Optional features
  auth: {
    enabled: true,
    apiKey: "secret-key-here",
  },

  cors: {
    enabled: true,
    origins: ["http://localhost:*"],
  },

  logging: {
    enabled: true,
    verbose: false,
    logFile: "cortex-mcp.log",
  },

  embedding: {
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY,
  },

  factExtraction: {
    enabled: true,
    autoExtract: false, // Manual trigger only
  },
});

await server.start();

console.log("MCP Server ready on http://localhost:3000");
```

## Cloud Mode: Premium MCP

### Hosted MCP Endpoint

Instead of running locally, use Cortex Cloud's managed MCP:

```typescript
// No local server needed!
// Configure clients to use Cloud MCP

// Cursor: .cursor/mcp-config.json
{
  "memory": {
    "provider": "cortex-cloud",
    "endpoint": "https://mcp.cortex.cloud/v1",
    "api_key": "cortex_sk_your_api_key_here",
    "user_id": "${USER_EMAIL}"
  }
}

// Claude Desktop
{
  "mcpServers": {
    "cortex-cloud": {
      "url": "https://mcp.cortex.cloud/v1",
      "auth": {
        "type": "bearer",
        "token": "cortex_sk_your_api_key_here"
      }
    }
  }
}
```

### Premium Features via MCP

**Auto-Embeddings:**

```json
// Client request
POST https://mcp.cortex.cloud/v1/add_memories
{
  "memory": "User prefers React",
  "user_id": "user-123",
  "auto_embed": true  // ← Cortex Cloud generates embedding
}

// No OPENAI_API_KEY needed! ✅
```

**Auto-Fact-Extraction:**

```json
POST https://mcp.cortex.cloud/v1/add_memories
{
  "messages": [
    { "role": "user", "content": "I work at Acme Corp as a senior engineer" }
  ],
  "user_id": "user-123",
  "auto_extract_facts": true  // ← Cortex extracts facts automatically
}

// Cortex Cloud:
// 1. Stores raw in ACID
// 2. Extracts facts: "User works at Acme Corp", "User's role: Senior Engineer"
// 3. Stores facts in immutable + vector
// 4. Returns memory IDs
```

**GDPR Cascade:**

```json
POST https://mcp.cortex.cloud/v1/delete_all_memories
{
  "user_id": "user-123",
  "cascade": true  // ← Deletes from ALL stores (Cloud Mode only)
}

// Removes data from conversations, immutable, mutable, vector ✅
```

**Graph Queries (Graph-Premium):**

```json
POST https://mcp.cortex.cloud/v1/graph/traverse
{
  "start": { "type": "user", "id": "user-123" },
  "relationships": ["CREATED", "TRIGGERED"],
  "max_depth": 5,
  "user_id": "user-123"
}

// Returns connected entities from graph DB
```

### Premium Benefits

| Feature             | Free (Localhost)               | Premium (Cloud)                 |
| ------------------- | ------------------------------ | ------------------------------- |
| **Availability**    | Only when local server running | Always available (99.9% uptime) |
| **Setup**           | Must run server locally        | Zero setup (cloud endpoint)     |
| **Embedding**       | Bring your own API key         | Auto-generated (no key needed)  |
| **Fact Extraction** | Manual (DIY)                   | Automatic                       |
| **GDPR Cascade**    | Manual deletion                | One-click cascade               |
| **Graph Queries**   | If you run graph DB            | Included (Graph-Premium tier)   |
| **Team Sharing**    | Single user (localhost)        | Organization-wide memory        |
| **Authentication**  | Optional local                 | API key + SSO/SAML              |
| **Analytics**       | None                           | Full dashboard                  |
| **Support**         | Community                      | Priority email                  |

**Pricing:**

- Free: Open-source server (Direct Mode)
- Pro: $49/month (includes Cloud MCP endpoint)
- Scale: $199/month (team collaboration features)
- Enterprise: $999/month (SSO, unlimited, SLA)

## Protocol Specification

### Request Format

All endpoints accept JSON POST (or GET where noted):

```typescript
// Standard fields
{
  "user_id": string,      // Required: User identifier
  "agent_id"?: string,    // Optional: Agent scope (default: 'mcp-agent')
  "session_id"?: string,  // Optional: Session scope
  "metadata"?: object     // Optional: Custom metadata
}
```

### Response Format

```typescript
// Success response
{
  "success": true,
  "data": { /* endpoint-specific data */ }
}

// Error response
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Supported Endpoints

| Endpoint               | Method | Purpose                | Auth     |
| ---------------------- | ------ | ---------------------- | -------- |
| `/health`              | GET    | Server health          | No       |
| `/add_memories`        | POST   | Store memories         | Optional |
| `/search_memory`       | POST   | Search                 | Optional |
| `/list_memories`       | GET    | List all/recent        | Optional |
| `/delete_all_memories` | POST   | Clear user memories    | Optional |
| `/get_memory`          | GET    | Get by ID              | Optional |
| `/update_memory`       | POST   | Update specific memory | Optional |
| `/delete_memory`       | DELETE | Delete specific memory | Optional |

## Data Isolation

### Per-User Memory

```typescript
// User A stores preference
POST /add_memories
{
  "memory": "I prefer vim keybindings",
  "user_id": "alice@example.com"
}

// User B stores different preference
POST /add_memories
{
  "memory": "I prefer VS Code keybindings",
  "user_id": "bob@example.com"
}

// Searches are isolated
POST /search_memory
{
  "query": "keybinding preference",
  "user_id": "alice@example.com"
}
// Returns: "I prefer vim keybindings" (Alice's only) ✅

POST /search_memory
{
  "query": "keybinding preference",
  "user_id": "bob@example.com"
}
// Returns: "I prefer VS Code keybindings" (Bob's only) ✅
```

### Per-Agent Memory (Optional)

```typescript
// Coding assistant memory
POST /add_memories
{
  "memory": "User prefers React",
  "user_id": "user-123",
  "agent_id": "code-assistant"
}

// Writing assistant memory
POST /add_memories
{
  "memory": "User prefers formal tone",
  "user_id": "user-123",
  "agent_id": "writing-assistant"
}

// Search scoped to agent
POST /search_memory
{
  "query": "user preferences",
  "user_id": "user-123",
  "agent_id": "code-assistant"
}
// Returns: "User prefers React" (code-assistant's memory)
```

## Security

### Local Security (Free)

**Localhost binding:**

- Server binds to `127.0.0.1` only by default
- Only local applications can access
- No password needed (trusted local environment)

**Optional authentication:**

```bash
# Start with auth enabled
cortex-mcp-server --convex-url=$CONVEX_URL --auth --api-key=your-api-key-here

# Clients must provide API key
curl -H "Authorization: Bearer your-api-key-here" \
  -X POST http://localhost:3000/search_memory \
  -d '{"query": "...", "user_id": "..."}'
```

### Cloud Security (Premium)

**API Key Authentication:**

```json
{
  "mcpServers": {
    "cortex-cloud": {
      "url": "https://mcp.cortex.cloud/v1",
      "auth": {
        "type": "bearer",
        "token": "<your-cortex-api-key>"
      }
    }
  }
}
```

**SSO/SAML (Enterprise):**

- Organization-wide authentication
- Okta, Azure AD, Google Workspace
- Role-based access control
- Audit logging of all MCP requests

## Performance

### Local MCP Server

**Latency:**

- add_memories: 20-50ms
- search_memory: 50-150ms (depends on embedding)
- list_memories: 10-30ms
- delete_all: 50-200ms

**Throughput:**

- ~100-200 requests/second (single process)
- Can run multiple instances if needed

**Caching:**

- Search results cached for 60s
- Embeddings cached (common queries)
- Reduces Convex queries

### Cloud MCP Endpoint

**Latency:**

- add_memories: 100-200ms (includes auto-embed if enabled)
- search_memory: 80-150ms (auto-embed + search)
- Global CDN reduces network latency

**Scalability:**

- Auto-scales to demand
- No query limits
- Built-in rate limiting

## Monitoring

### Local Server Logs

```bash
# Start with verbose logging
cortex-mcp-server --convex-url=$CONVEX_URL --log-level=debug

# Logs show:
[MCP] POST /add_memories - user: user-123
[MCP] Stored memory: mem_abc123
[MCP] POST /search_memory - user: user-123, query: "preferences"
[MCP] Found 3 results in 45ms
```

### Metrics Endpoint

```bash
# Get server stats
curl http://localhost:3000/metrics

{
  "uptime": 3600,
  "total_requests": 1543,
  "requests_by_endpoint": {
    "/add_memories": 890,
    "/search_memory": 543,
    "/list_memories": 110
  },
  "unique_users": 12,
  "avg_response_time": 67,
  "cache_hit_rate": 0.34
}
```

### Cloud Mode Analytics

Premium users get full analytics dashboard:

- Request volume over time
- Popular queries
- User engagement
- Storage usage
- Cost attribution
- Error rates

## Use Cases

### Use Case 1: Cross-IDE Preferences

**Scenario:** Use multiple coding tools

```
1. In Cursor: "I prefer 2-space indentation"
   → Stores in MCP

2. Later, in Windsurf: Ask AI to generate code
   → Windsurf queries MCP, gets "2-space indentation" preference
   → Generates code with correct indentation ✅

3. In Claude: "Help me write a config file"
   → Claude queries MCP, knows your preferences
   → Suggests 2-space indent ✅
```

### Use Case 2: Personal Knowledge Base

**Scenario:** Accumulate knowledge across tools

```
Day 1 (Cursor): "I'm working on Project Apollo, a React app"
Day 3 (Claude): "Project Apollo uses PostgreSQL database"
Day 7 (Custom tool): "Apollo's API is at api.apollo.com"

Day 10 (Any tool): "Tell me about Project Apollo"
→ MCP returns all accumulated facts:
  - React app
  - PostgreSQL database
  - API endpoint

All tools have complete context! ✅
```

### Use Case 3: Team Collaboration (Premium)

**Scenario:** Shared team memory

```
Setup: Team members all use Premium MCP with org account

Engineer A (Cursor): "We decided to use TypeScript for backend"
→ Stores in team's shared Cortex

Engineer B (Claude): "What's our backend tech stack?"
→ Claude queries team MCP
→ Returns: "Team decided to use TypeScript for backend"
→ Consistent team knowledge ✅

PM (Custom tool): Search for "technical decisions"
→ Gets all team's engineering decisions
→ Aligned context across team ✅
```

## Limitations and Considerations

### Local Server Limitations

**Must be running:**

- Server must be active for AI tools to access memory
- If server stops, tools lose memory access
- Consider running as system service (systemd, launchd)

**Single machine:**

- Localhost server = single machine only
- Can't share across devices
- (Use Cloud Mode for cross-device memory)

**No automatic sync:**

- Each machine runs separate MCP server
- Memories don't sync between machines
- (Use Cloud Mode for unified memory everywhere)

### Performance Considerations

**Embedding generation:**

- Requires API key (OpenAI, etc.) for semantic search
- Without embeddings, falls back to keyword search (less accurate)
- Cloud Mode handles embeddings automatically

**Storage costs:**

- All data stored in your Convex instance
- Grows with usage (typical: 1-10MB per user)
- Monitor Convex usage and costs

**Rate limits:**

- Convex has rate limits (usually generous)
- If many AI tools hitting MCP simultaneously, could hit limits
- Cloud Mode has higher limits

## Troubleshooting

### Server Won't Start

**Check Convex URL:**

```bash
# Test Convex connectivity
curl https://your-project.convex.cloud/api/query

# If fails, check CONVEX_URL is correct
```

**Check port availability:**

```bash
# Port 3000 already in use?
lsof -i :3000

# Use different port
cortex-mcp-server --port=3001
```

### AI Client Can't Connect

**Verify server running:**

```bash
curl http://localhost:3000/health

# Should return:
{"status": "ok", "version": "1.0.0"}
```

**Check client configuration:**

- Ensure endpoint URL is correct (`http://localhost:3000`, not `https`)
- Verify user_id is set
- Check client supports MCP (Cursor, Claude Desktop do)

### No Results from Search

**Test directly:**

```bash
# Add a memory
curl -X POST http://localhost:3000/add_memories \
  -H "Content-Type: application/json" \
  -d '{"memory": "test memory", "user_id": "test-user"}'

# Search for it
curl -X POST http://localhost:3000/search_memory \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "user_id": "test-user"}'

# Should return the memory
```

**Check user_id:**

- Ensure same user_id used for add and search
- MCP isolates by user_id strictly

## Best Practices

### 1. Use Meaningful user_id

```typescript
// ✅ Good: Stable identifier
user_id: "alice@example.com";
user_id: "user-stable-uuid-123";

// ❌ Bad: Changing identifier
user_id: "session-temp-abc"; // Changes each session
user_id: Math.random(); // Different every time
```

### 2. Add Metadata for Context

```typescript
// Enrich memories with metadata
POST /add_memories
{
  "memory": "User prefers TypeScript",
  "user_id": "user-123",
  "metadata": {
    "source": "cursor",
    "project": "apollo",
    "importance": 80,
    "tags": ["preference", "programming"]
  }
}

// Filter searches by metadata
POST /search_memory
{
  "query": "programming preferences",
  "user_id": "user-123",
  "metadata": {
    "project": "apollo"  // Only project-specific prefs
  }
}
```

### 3. Periodic Cleanup

```typescript
// Clean up old session-specific memories
async function cleanupOldSessions(memorySpaceId: string) {
  // Get sessions older than 30 days
  const oldSessions = await cortex.memory.list(memorySpaceId, {
    metadata: {
      temporary: true,
      expiresAt: { $lt: Date.now() },
    },
  });

  // Delete them
  for (const memory of oldSessions.memories) {
    await cortex.memory.forget(memorySpaceId, memory.id);
  }
}

// Run daily
setInterval(() => cleanupOldSessions("mcp-agent-space"), 24 * 60 * 60 * 1000);
```

### 4. Monitor Usage

```bash
# Check metrics regularly
curl http://localhost:3000/metrics

# Watch for:
# - High request rates (might need scaling)
# - Low cache hit rate (tune cache settings)
# - High error rate (investigate issues)
```

## Advanced Features

### Custom MCP Client

Build your own MCP client:

```typescript
class CortexMCPClient {
  constructor(
    private endpoint: string,
    private userId: string,
  ) {}

  async addMemory(content: string, metadata?: any) {
    const response = await fetch(`${this.endpoint}/add_memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memory: content,
        user_id: this.userId,
        metadata,
      }),
    });

    return await response.json();
  }

  async search(query: string, limit = 5) {
    const response = await fetch(`${this.endpoint}/search_memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        user_id: this.userId,
        limit,
      }),
    });

    const data = await response.json();
    return data.results;
  }

  async list(limit = 50) {
    const response = await fetch(
      `${this.endpoint}/list_memories?user_id=${this.userId}&limit=${limit}`,
    );

    return await response.json();
  }

  async deleteAll() {
    const response = await fetch(`${this.endpoint}/delete_all_memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: this.userId,
      }),
    });

    return await response.json();
  }
}

// Usage
const mcp = new CortexMCPClient("http://localhost:3000", "user-123");

await mcp.addMemory("I like TypeScript");
const results = await mcp.search("programming preferences");
console.log(results);
```

### Running as System Service

**macOS (launchd):**

```xml
<!-- ~/Library/LaunchAgents/com.cortex.mcp.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cortex.mcp</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/cortex-mcp-server</string>
        <string>--convex-url=https://your-project.convex.cloud</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

```bash
# Load service
launchctl load ~/Library/LaunchAgents/com.cortex.mcp.plist

# Start
launchctl start com.cortex.mcp
```

**Linux (systemd):**

```ini
# /etc/systemd/system/cortex-mcp.service
[Unit]
Description=Cortex MCP Server
After=network.target

[Service]
Type=simple
User=your-user
Environment="CONVEX_URL=https://your-project.convex.cloud"
ExecStart=/usr/bin/cortex-mcp-server
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable cortex-mcp
sudo systemctl start cortex-mcp

# Check status
sudo systemctl status cortex-mcp
```

## Roadmap

### Current (v1.0)

- ✅ Core MCP endpoints (add, search, list, delete)
- ✅ Free local server
- ✅ Basic authentication
- ✅ Cursor and Claude compatibility

### Near-Term (v1.1)

- [ ] Premium Cloud endpoint
- [ ] Auto-embedding support
- [ ] Fact extraction integration
- [ ] Enhanced metadata filtering
- [ ] Server-Sent Events (SSE) for real-time updates

### Future (v2.0)

- [ ] Graph query pass-through (if graph DB connected)
- [ ] Team collaboration features (Premium)
- [ ] Cross-device sync
- [ ] Mobile app support
- [ ] Browser extension

## Next Steps

- **[Installation Guide](../01-getting-started/02-installation.md)** - Set up Cortex SDK
- **[Fact Extraction](./08-fact-extraction.md)** - Optimize memory with facts
- **[Graph Integration](../07-advanced-topics/02-graph-database-integration.md)** - Add graph queries
- **[API Reference](../03-api-reference/01-overview.md)** - Complete API docs

---

**Questions?** Ask in [GitHub Discussions](https://github.com/SaintNick1214/cortex/discussions).
